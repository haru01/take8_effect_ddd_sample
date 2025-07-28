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

// Given: 複数の科目情報（数学・英語・物理 合計9単位）
const givenMultipleCourses = (): CourseInfo[] => [
  { courseId: CourseId.make("C123456"), units: 3 }, // 数学基礎（3単位）
  { courseId: CourseId.make("C234567"), units: 4 }, // 英語コミュニケーション（4単位）
  { courseId: CourseId.make("C345678"), units: 2 }  // 物理学入門（2単位）
];

// Given: 単位数上限を超える科目情報（高度数学・高度英語 合計21単位）
const givenOverLimitCourses = (): CourseInfo[] => [
  { courseId: CourseId.make("C123456"), units: 10 }, // 高度数学（10単位）
  { courseId: CourseId.make("C234567"), units: 11 }  // 高度英語（11単位） → 合計21単位（上限20単位超過）
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

describe("ストーリー2: 科目一括追加", () => {
  const TestLayer = Layer.mergeAll(
    InMemoryEventStore,
    InMemoryEventBus,
    InMemoryRegistrationSessionRepository.pipe(
      Layer.provide(Layer.mergeAll(InMemoryEventStore, InMemoryEventBus))
    )
  );

  describe("基本シナリオ", () => {
    it("学生が複数科目を履修計画に効率的に追加する", () =>
      Effect.gen(function* () {
        // === Given: Draft状態の履修登録セッションが存在し、追加する複数科目が準備されている ===
        const { sessionId } = yield* givenDraftRegistrationSessionExists();
        const capturedEvents = yield* givenEventCapture();
        const coursesToAdd = givenMultipleCourses();

        // === When: 複数の科目を履修登録セッションに一括追加する ===
        // (ビジネス価値: 学生が効率的に複数科目を履修計画に追加)
        yield* addCoursesToSession({ sessionId, courses: coursesToAdd });

        // === Then: 科目追加イベントがイベントバスを通じて発行されること ===
        // (技術実装: CoursesAddedToSessionイベントのEventBus経由での通知確認)
        yield* thenCoursesAreAddedToRegistrationSession(sessionId, coursesToAdd, capturedEvents);
        
        // === And: 履修登録セッション集約に科目が反映されていること ===
        // (技術実装: イベント再生による集約状態の更新確認)
        yield* thenSessionReflectsAddedCourses(sessionId, coursesToAdd);
      })
        .pipe(Effect.provide(TestLayer))
        .pipe(Effect.runPromise)
    );

    it("単位数上限超過で過剰履修を防止する", () =>
      Effect.gen(function* () {
        // === Given: Draft状態の履修登録セッションが存在し、単位数上限を超える科目が準備されている ===
        const { sessionId } = yield* givenDraftRegistrationSessionExists();
        const coursesToAdd = givenOverLimitCourses();

        // === When: 単位数上限を超える科目を履修登録セッションに追加しようとする ===
        // (ビジネス価値: 過剰履修防止による学習効率と成績品質の保持)
        const error = yield* addCoursesToSession({ sessionId, courses: coursesToAdd }).pipe(
          Effect.flip
        );

        // === Then: 単位数上限超過エラーが発生すること ===
        // (技術実装: MaxUnitsExceededドメインエラーの適切な発生確認)
        thenMaxUnitsExceededErrorOccurs(error, {
          currentUnits: 0,
          requestedUnits: 21,
          maxUnits: 20
        });
      })
        .pipe(Effect.provide(TestLayer))
        .pipe(Effect.runPromise)
    );

    it("重複科目で単位重複取得を防止する", () =>
      Effect.gen(function* () {
        // === Given: 履修登録セッションに既に科目が追加されており、重複する科目を含む科目群が準備されている ===
        const { sessionId, existingCourses } = yield* givenSessionWithExistingCourses();
        const duplicateCourses = givenCoursesWithDuplicates();

        // === When: 既存科目と重複する科目を履修登録セッションに追加しようとする ===
        // (ビジネス価値: 重複履修防止による単位重複取得の回避、学位要件の整合性保持)
        const error = yield* addCoursesToSession({ sessionId, courses: duplicateCourses }).pipe(
          Effect.flip
        );

        // === Then: 重複科目エラーが発生すること ===
        // (技術実装: DuplicateCourseInSessionドメインエラーの適切な発生確認)
        thenDuplicateCourseErrorOccurs(error, [CourseId.make("C123456")]);
      })
        .pipe(Effect.provide(TestLayer))
        .pipe(Effect.runPromise)
    );

    it("存在しないセッションへの操作を拒否する", () =>
      Effect.gen(function* () {
        // === Given: 存在しない履修登録セッションIDと追加する科目が準備されている ===
        const { nonExistentSessionId } = yield* givenNonExistentSession();
        const coursesToAdd = givenMultipleCourses();

        // === When: 存在しない履修登録セッションに科目を追加しようとする ===
        // (ビジネス価値: 不正操作防止による履修データの整合性保持)
        const error = yield* addCoursesToSession({ 
          sessionId: nonExistentSessionId, 
          courses: coursesToAdd 
        }).pipe(Effect.flip);

        // === Then: セッション未存在エラーが発生すること ===
        // (技術実装: SessionNotFoundドメインエラーの適切な発生確認)
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