import { describe, it } from "vitest";
import { Effect, Layer, Ref } from "effect";
import { createRegistrationSession } from "../../src/contexts/enrollment/application/commands/create-registration-session.js";
import { StudentId, Term } from "../../src/contexts/enrollment/domain/models/shared/value-objects.js";
import { SessionAlreadyExists, InvalidRegistrationSessionId } from "../../src/contexts/enrollment/domain/errors/domain-errors.js";
import { InMemoryEventStore } from "../../src/contexts/shared/infrastructure/event-store/in-memory-event-store.js";
import { InMemoryRegistrationSessionRepository } from "../../src/contexts/enrollment/infrastructure/persistence/in-memory-registration-session-repository.js";
import { InMemoryEventBus } from "../../src/contexts/shared/infrastructure/event-bus/in-memory-event-bus.js";
import { EventBus } from "../../src/contexts/shared/kernel/types/event-bus.js";
import { DomainEvent } from "../../src/contexts/enrollment/domain/events/registration-session-events.js";
import {
  assertSessionCreatedSuccessfully,
  assertDuplicateSessionError,
  assertMultipleSessionsCreated,
  assertEventCount,
  assertSessionInDraftState,
  assertSessionExistsInRepository,
  assertInvalidRegistrationSessionIdError,
  thenSessionIdFormatIsValid,
  thenRegistrationSessionCreatedEventIsPublished,
  thenRegistrationSessionCanBeRetrieved,
  thenRegistrationSessionCreatedEventIsStoredInEventStore,
  thenDuplicateSessionErrorOccurs,
  thenExactlyNEventsArePublished,
  thenMultipleSessionsAreCreatedSuccessfully,
  thenSessionIsInDraftState,
  thenInvalidSessionIdErrorOccurs
} from "../helpers/assertions.js";

// === テスト用ヘルパー関数 ===

// Given: 有効な学生と学期の組み合わせ
const givenValidStudentAndTerm = () =>
  Effect.gen(function* () {
    const studentId = StudentId.make("S12345678");
    const term = Term.make("2024-Spring");
    return { studentId, term };
  });

// Given: 複数の異なる学生と学期の組み合わせ
const givenMultipleStudentsAndTerms = () =>
  Effect.gen(function* () {
    const student1Id = StudentId.make("S12345678");
    const student2Id = StudentId.make("S87654321");
    const springTerm = Term.make("2024-Spring");
    const fallTerm = Term.make("2024-Fall");
    return { student1Id, student2Id, springTerm, fallTerm };
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

// Given: 不正な学生IDと有効な学期
const givenInvalidStudentIdAndValidTerm = () =>
  Effect.gen(function* () {
    const invalidStudentId = StudentId.make("INVALID");
    const validTerm = Term.make("2024-Spring");
    return { invalidStudentId, validTerm };
  });

// Given: 有効な学生IDと不正な学期
const givenValidStudentIdAndInvalidTerm = () =>
  Effect.gen(function* () {
    const validStudentId = StudentId.make("S12345678");
    const invalidTerm = Term.make("BAD-TERM");
    return { validStudentId, invalidTerm };
  });

describe("受け入れテスト: 履修登録セッション開始", () => {
  // EventStoreとEventBusを先に提供し、それを使ってRepositoryを構築し、全てをマージ
  const TestLayer = Layer.mergeAll(
    InMemoryEventStore,
    InMemoryEventBus,
    InMemoryRegistrationSessionRepository.pipe(
      Layer.provide(Layer.mergeAll(InMemoryEventStore, InMemoryEventBus))
    )
  );

  describe("受け入れ条件", () => {
    it("学生IDと学期を指定してセッションを作成できる", () =>
      Effect.gen(function* () {
        // === Given: 履修登録セッションがまだ作成されていない 学生IDと学期が指定される ===
        const { studentId, term } = yield* givenValidStudentAndTerm();
        const capturedEvents = yield* givenEventCapture();

        // === When: 学生がセッションを作成する ===
        const sessionId = yield* createRegistrationSession({ studentId, term });

        // === Then: セッションIDの形式が正しいこと ===
        thenSessionIdFormatIsValid(sessionId);

        // === And: RegistrationSessionCreatedがイベントストアに登録されていること ===
        yield* thenRegistrationSessionCreatedEventIsStoredInEventStore(sessionId, studentId, term);

        // === And: RegistrationSessionCreatedのイベントバスにて発行されていること ===
        yield* thenRegistrationSessionCreatedEventIsPublished(capturedEvents, sessionId, studentId, term);

        // === And: 該当の履修登録セッションが取得できること ===
        yield* thenRegistrationSessionCanBeRetrieved(sessionId, studentId, term);
      })
        .pipe(Effect.provide(TestLayer))
        .pipe(Effect.runPromise)
    );

    it("同じ学生・学期の重複セッション作成は失敗する", () =>
      Effect.gen(function* () {
        // === Given: 既に履修登録セッションが存在する学生・学期の組み合わせ ===
        const { studentId, term } = yield* givenValidStudentAndTerm();
        const capturedEvents = yield* givenEventCapture();
        // 最初のセッションを作成
        const firstSessionId = yield* createRegistrationSession({ studentId, term });
        yield* thenRegistrationSessionCanBeRetrieved(firstSessionId, studentId, term);

        // === When: 同じ学生・学期でセッション作成を再試行する ===
        const error = yield* createRegistrationSession({ studentId, term }).pipe(
          Effect.flip
        );

        // === Then: 履修登録セッションの重複エラーが発生する ===
        thenDuplicateSessionErrorOccurs(error, firstSessionId);

        // === And: 最初のセッションのイベントのみが発行されている ===
        yield* thenExactlyNEventsArePublished(capturedEvents, 1);
      })
        .pipe(Effect.provide(TestLayer))
        .pipe(Effect.runPromise)
    );

    it("異なる学生または学期であれば複数セッションを作成できる", () =>
      Effect.gen(function* () {
        // === Given: 異なる学生と学期の組み合わせが複数存在する ===
        const { student1Id, student2Id, springTerm, fallTerm } = yield* givenMultipleStudentsAndTerms();
        const capturedEvents = yield* givenEventCapture();

        // === When: 複数の異なる学生・学期の組み合わせでセッションを作成する ===
        const session1Id = yield* createRegistrationSession({
          studentId: student1Id,
          term: springTerm
        });
        const session2Id = yield* createRegistrationSession({
          studentId: student2Id,
          term: springTerm
        });
        const session3Id = yield* createRegistrationSession({
          studentId: student1Id,
          term: fallTerm
        });

        // === Then: 全ての履修登録セッションが正常に作成される ===
        yield* thenMultipleSessionsAreCreatedSuccessfully([
          { sessionId: session1Id, studentId: student1Id, term: springTerm },
          { sessionId: session2Id, studentId: student2Id, term: springTerm },
          { sessionId: session3Id, studentId: student1Id, term: fallTerm }
        ], capturedEvents);
      })
        .pipe(Effect.provide(TestLayer))
        .pipe(Effect.runPromise)
    );

    it("作成されたセッションはDraft状態である", () =>
      Effect.gen(function* () {
        // === Given: 有効な学生IDと学期が指定される ===
        const studentId = StudentId.make("S12345678");
        const term = Term.make("2024-Spring");

        // === When: 履修登録セッションを作成する ===
        const sessionId = yield* createRegistrationSession({ studentId, term });

        // === Then: セッションがDraft状態で作成される ===
        const session = yield* thenRegistrationSessionCanBeRetrieved(sessionId, studentId, term);

        // === And: 履修登録セッションが編集可能なDraft状態である ===
        thenSessionIsInDraftState(session);
      })
        .pipe(Effect.provide(TestLayer))
        .pipe(Effect.runPromise)
    );
  });

  describe("エラーケース (E2E)", () => {
    it("不正な学生IDでコマンド実行は失敗する", () =>
      Effect.gen(function* () {
        // === Given: 不正な形式の学生IDと有効な学期が指定される ===
        const { invalidStudentId, validTerm } = yield* givenInvalidStudentIdAndValidTerm();

        // === When: 不正な学生IDで履修登録セッション作成を試行する ===
        const commandError = yield* createRegistrationSession({
          studentId: invalidStudentId,
          term: validTerm
        }).pipe(Effect.flip);

        // === Then: 学生IDの形式エラーが発生すること ===
        thenInvalidSessionIdErrorOccurs(commandError as InvalidRegistrationSessionId, "INVALID", "2024-Spring");
      })
        .pipe(Effect.provide(TestLayer))
        .pipe(Effect.runPromise)
    );

    it("不正な学期でコマンド実行は失敗する", () =>
      Effect.gen(function* () {
        // === Given: 有効な学生IDと不正な形式の学期が指定される ===
        const { validStudentId, invalidTerm } = yield* givenValidStudentIdAndInvalidTerm();

        // === When: 不正な学期で履修登録セッション作成を試行する ===
        const commandError = yield* createRegistrationSession({
          studentId: validStudentId,
          term: invalidTerm
        }).pipe(Effect.flip);

        // === Then: 学期の形式エラーが発生すること ===
        thenInvalidSessionIdErrorOccurs(commandError as InvalidRegistrationSessionId, "S12345678", "BAD-TERM");
      })
        .pipe(Effect.provide(TestLayer))
        .pipe(Effect.runPromise)
    );
  });
});