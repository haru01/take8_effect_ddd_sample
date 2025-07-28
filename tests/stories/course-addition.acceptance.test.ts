import { describe, it } from "vitest";
import { Effect, Layer, Ref } from "effect";
import { createRegistrationSession } from "../../src/contexts/enrollment/application/commands/create-registration-session.js";
import { addCoursesToSession } from "../../src/contexts/enrollment/application/commands/add-courses-to-session.js";
import { StudentId, Term, CourseId, RegistrationSessionId } from "../../src/contexts/enrollment/domain/models/shared/value-objects.js";
import { CourseInfo } from "../../src/contexts/enrollment/domain/models/registration-session/registration-session.js";
import { InMemoryEventStore } from "../../src/contexts/shared/infrastructure/event-store/in-memory-event-store.js";
import { InMemoryRegistrationSessionRepository } from "../../src/contexts/enrollment/infrastructure/persistence/in-memory-registration-session-repository.js";
import { InMemoryEventBus } from "../../src/contexts/shared/infrastructure/event-bus/in-memory-event-bus.js";
import { EventBus } from "../../src/contexts/shared/kernel/types/event-bus.js";
import { DomainEvent } from "../../src/contexts/enrollment/domain/events/registration-session-events.js";
import {
  assertCoursesAddedSuccessfully,
  assertMaxUnitsExceededError,
  assertDuplicateCourseError,
  assertSessionNotFoundError,
  thenCoursesAreAddedToRegistrationSession,
  thenSessionReflectsAddedCourses,
  thenMaxUnitsExceededErrorOccurs,
  thenDuplicateCourseErrorOccurs,
  thenSessionNotFoundErrorOccurs
} from "../helpers/assertions.js";

// === テスト用ヘルパー関数 ===

// Given: Draft状態の履修登録セッションが存在する
const givenDraftRegistrationSessionExists = () =>
  Effect.gen(function* () {
    const studentId = StudentId.make("S12345678");
    const term = Term.make("2024-Spring");
    const sessionId = yield* createRegistrationSession({ studentId, term });
    return { studentId, term, sessionId };
  });

// Given: イベントキャプチャセットアップ
const givenEventCapture = () =>
  Effect.gen(function* () {
    const capturedEvents = yield* Ref.make<DomainEvent[]>([]);
    const eventBus = yield* EventBus;
    yield* eventBus.subscribe((event) =>
      Ref.update(capturedEvents, (events) => [...events, event])
    );
    return capturedEvents;
  });

// Given: 複数の科目情報
const givenMultipleCourses = (): CourseInfo[] => [
  { courseId: CourseId.make("C123456"), units: 3 },
  { courseId: CourseId.make("C234567"), units: 4 },
  { courseId: CourseId.make("C345678"), units: 2 }
];

// Given: 単位数上限を超える科目情報
const givenOverLimitCourses = (): CourseInfo[] => [
  { courseId: CourseId.make("C123456"), units: 10 },
  { courseId: CourseId.make("C234567"), units: 11 } // 合計21単位
];

// Given: 既に履修登録セッションに科目が追加されている状態
const givenSessionWithExistingCourses = () =>
  Effect.gen(function* () {
    const { studentId, term, sessionId } = yield* givenDraftRegistrationSessionExists();
    const existingCourses: CourseInfo[] = [
      { courseId: CourseId.make("C123456"), units: 3 }
    ];
    yield* addCoursesToSession({ sessionId, courses: existingCourses });
    return { studentId, term, sessionId, existingCourses };
  });

// Given: 重複科目を含む科目情報
const givenCoursesWithDuplicates = (): CourseInfo[] => [
  { courseId: CourseId.make("C123456"), units: 3 }, // 重複
  { courseId: CourseId.make("C234567"), units: 4 }
];

// Given: 存在しない履修登録セッション
const givenNonExistentSession = () =>
  Effect.gen(function* () {
    const studentId = StudentId.make("S12345678");
    const term = Term.make("2024-Spring");
    const nonExistentSessionId = yield* RegistrationSessionId.create(studentId, term);
    // 注意: セッション作成は行わない
    return { nonExistentSessionId };
  });

describe("受け入れテスト: 科目一括追加", () => {
  const TestLayer = Layer.mergeAll(
    InMemoryEventStore,
    InMemoryEventBus,
    InMemoryRegistrationSessionRepository.pipe(
      Layer.provide(Layer.mergeAll(InMemoryEventStore, InMemoryEventBus))
    )
  );

  describe("受け入れ条件", () => {
    it("複数科目を一度に追加できる", () =>
      Effect.gen(function* () {
        // === Given: Draft状態の履修登録セッションが存在し、追加する複数科目が準備されている ===
        const { sessionId } = yield* givenDraftRegistrationSessionExists();
        const capturedEvents = yield* givenEventCapture();
        const coursesToAdd = givenMultipleCourses();

        // === When: 複数の科目を履修登録セッションに一括追加する ===
        yield* addCoursesToSession({ sessionId, courses: coursesToAdd });

        // === Then: CoursesAddedToSessionイベントが発行されること ===
        yield* thenCoursesAreAddedToRegistrationSession(sessionId, coursesToAdd, capturedEvents);
        
        // === And: 履修登録セッションに科目が反映されていること ===
        yield* thenSessionReflectsAddedCourses(sessionId, coursesToAdd);
      })
        .pipe(Effect.provide(TestLayer))
        .pipe(Effect.runPromise)
    );

    it("単位数上限（20単位）を超える追加は失敗する", () =>
      Effect.gen(function* () {
        // === Given: Draft状態の履修登録セッションが存在し、単位数上限を超える科目が準備されている ===
        const { sessionId } = yield* givenDraftRegistrationSessionExists();
        const coursesToAdd = givenOverLimitCourses();

        // === When: 単位数上限を超える科目を履修登録セッションに追加しようとする ===
        const error = yield* addCoursesToSession({ sessionId, courses: coursesToAdd }).pipe(
          Effect.flip
        );

        // === Then: 単位数上限超過エラーが発生する ===
        thenMaxUnitsExceededErrorOccurs(error, {
          currentUnits: 0,
          requestedUnits: 21,
          maxUnits: 20
        });
      })
        .pipe(Effect.provide(TestLayer))
        .pipe(Effect.runPromise)
    );

    it("重複科目の追加は失敗する", () =>
      Effect.gen(function* () {
        // === Given: 履修登録セッションに既に科目が追加されており、重複する科目を含む科目群が準備されている ===
        const { sessionId, existingCourses } = yield* givenSessionWithExistingCourses();
        const duplicateCourses = givenCoursesWithDuplicates();

        // === When: 既存科目と重複する科目を履修登録セッションに追加しようとする ===
        const error = yield* addCoursesToSession({ sessionId, courses: duplicateCourses }).pipe(
          Effect.flip
        );

        // === Then: 重複科目エラーが発生する ===
        thenDuplicateCourseErrorOccurs(error, [CourseId.make("C123456")]);
      })
        .pipe(Effect.provide(TestLayer))
        .pipe(Effect.runPromise)
    );

    it("存在しないセッションへの科目追加は失敗する", () =>
      Effect.gen(function* () {
        // === Given: 存在しない履修登録セッションIDと追加する科目が準備されている ===
        const { nonExistentSessionId } = yield* givenNonExistentSession();
        const coursesToAdd = givenMultipleCourses();

        // === When: 存在しない履修登録セッションに科目を追加しようとする ===
        const error = yield* addCoursesToSession({ 
          sessionId: nonExistentSessionId, 
          courses: coursesToAdd 
        }).pipe(Effect.flip);

        // === Then: セッション未存在エラーが発生する ===
        thenSessionNotFoundErrorOccurs(error, nonExistentSessionId);
      })
        .pipe(Effect.provide(TestLayer))
        .pipe(Effect.runPromise)
    );

    it("Draft状態以外での科目追加は失敗する", () =>
      Effect.gen(function* () {
        // TODO: セッションをSubmitted状態に変更する機能が実装されたら有効化
        // 現在はDraft状態のみ実装されているため、このテストはスキップ
        // 将来のストーリー3（履修登録提出）実装後に有効化予定
      })
        .pipe(Effect.provide(TestLayer))
        .pipe(Effect.runPromise)
    );
  });
});