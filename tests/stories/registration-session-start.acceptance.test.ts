import { describe, it } from "vitest";
import { Effect, Layer, Ref } from "effect";
import { createRegistrationSession } from "../../src/contexts/enrollment/application/commands/create-registration-session.js";
import { StudentId, Term } from "../../src/contexts/enrollment/domain/models/shared/value-objects.js";
import { InvalidRegistrationSessionId } from "../../src/contexts/enrollment/domain/errors/domain-errors.js";
import { InMemoryEventStore } from "../../src/contexts/shared/infrastructure/event-store/in-memory-event-store.js";
import { InMemoryRegistrationSessionRepository } from "../../src/contexts/enrollment/infrastructure/persistence/in-memory-registration-session-repository.js";
import { InMemoryEventBus } from "../../src/contexts/shared/infrastructure/event-bus/in-memory-event-bus.js";
import { EventBus } from "../../src/contexts/shared/kernel/types/event-bus.js";
import { DomainEvent } from "../../src/contexts/enrollment/domain/events/registration-session-events.js";
import {
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

// Given: 田中太郎（S12345678）が2024年春学期の履修登録を行う前提
const givenValidStudentAndTerm = () =>
  Effect.gen(function* () {
    const studentId = StudentId.make("S12345678"); // 田中太郎の学生ID
    const term = Term.make("2024-Spring");          // 2024年春学期
    return { studentId, term };
  });

// Given: 複数学生の並行履修シナリオ（田中太郎・佐藤花子、春学期・秋学期）
const givenMultipleStudentsAndTerms = () =>
  Effect.gen(function* () {
    const student1Id = StudentId.make("S12345678"); // 田中太郎の学生ID
    const student2Id = StudentId.make("S87654321"); // 佐藤花子の学生ID
    const springTerm = Term.make("2024-Spring");     // 2024年春学期
    const fallTerm = Term.make("2024-Fall");         // 2024年秋学期
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


describe("ストーリー1: 履修登録セッション開始", () => {
  // EventStoreとEventBusを先に提供し、それを使ってRepositoryを構築し、全てをマージ
  const TestLayer = Layer.mergeAll(
    InMemoryEventStore,
    InMemoryEventBus,
    InMemoryRegistrationSessionRepository.pipe(
      Layer.provide(Layer.mergeAll(InMemoryEventStore, InMemoryEventBus))
    )
  );

  describe("基本シナリオ", () => {
    it("学生が新学期の履修計画を開始する", () =>
      Effect.gen(function* () {
        // Given: 学生（S12345678）が2024年春学期の履修登録を始めようとしている
        const { studentId, term } = yield* givenValidStudentAndTerm();
        const capturedEvents = yield* givenEventCapture();

        // When: 学生が履修登録セッションを開始する
        const sessionId = yield* createRegistrationSession({ studentId, term });

        // Then: 学生が識別可能なセッションIDが発行される
        thenSessionIdFormatIsValid(sessionId);

        // And: システムにセッション作成が永続記録される
        yield* thenRegistrationSessionCreatedEventIsStoredInEventStore(sessionId, studentId, term);

        // And: 他システムにセッション作成が通知される
        yield* thenRegistrationSessionCreatedEventIsPublished(capturedEvents, sessionId, studentId, term);

        // And: 学生がセッションにアクセス可能になる
        yield* thenRegistrationSessionCanBeRetrieved(sessionId, studentId, term);
      })
        .pipe(Effect.provide(TestLayer))
        .pipe(Effect.runPromise)
    );

    it("同一学生・学期での重複セッション作成を防止する", () =>
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

        // === Then: セッション重複エラーが発生すること ===
        thenDuplicateSessionErrorOccurs(error, firstSessionId);

        // === And: 最初のセッション作成イベントのみがイベントバスに発行されること ===
        yield* thenExactlyNEventsArePublished(capturedEvents, 1);
      })
        .pipe(Effect.provide(TestLayer))
        .pipe(Effect.runPromise)
    );

    it("複数学生の並行履修計画をサポートする", () =>
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

        // === Then: 全ての履修登録セッションが集約として正常に作成され取得可能であること ===
        yield* thenMultipleSessionsAreCreatedSuccessfully([
          { sessionId: session1Id, studentId: student1Id, term: springTerm },
          { sessionId: session2Id, studentId: student2Id, term: springTerm },
          { sessionId: session3Id, studentId: student1Id, term: fallTerm }
        ], capturedEvents);
      })
        .pipe(Effect.provide(TestLayer))
        .pipe(Effect.runPromise)
    );

    it("セッションが編集可能なDraft状態で作成される", () =>
      Effect.gen(function* () {
        // === Given: 有効な学生IDと学期が指定される ===
        const { studentId, term } = yield* givenValidStudentAndTerm();

        // === When: 履修登録セッションを作成する ===
        const sessionId = yield* createRegistrationSession({ studentId, term });

        // === Then: セッションが集約としてDraft状態で作成されること ===
        const session = yield* thenRegistrationSessionCanBeRetrieved(sessionId, studentId, term);
        thenSessionIsInDraftState(session);
      })
        .pipe(Effect.provide(TestLayer))
        .pipe(Effect.runPromise)
    );
  });

  describe("異常系シナリオ", () => {
    it("不正な学生IDでの履修計画開始を拒否する", () =>
      Effect.gen(function* () {
        // === Given: 不正な形式の学生IDと有効な学期が指定される ===
        const invalidStudentId = StudentId.make("INVALID");
        const validTerm = Term.make("2024-Spring");

        // === When: 不正な学生IDで履修登録セッション作成を試行する ===
        const commandError = yield* createRegistrationSession({
          studentId: invalidStudentId,
          term: validTerm
        }).pipe(Effect.flip);

        // === Then: 学生IDの形式エラーが発生すること ===
        thenInvalidSessionIdErrorOccurs(commandError as InvalidRegistrationSessionId, "INVALID", validTerm);
      })
        .pipe(Effect.provide(TestLayer))
        .pipe(Effect.runPromise)
    );

    it("不正な学期での履修計画開始を拒否する", () =>
      Effect.gen(function* () {
        // === Given: 有効な学生IDと不正な形式の学期が指定される ===
        const validStudentId = StudentId.make("S12345678");
        const invalidTerm = Term.make("BAD-TERM");

        // === When: 不正な学期で履修登録セッション作成を試行する ===
        const commandError = yield* createRegistrationSession({
          studentId: validStudentId,
          term: invalidTerm
        }).pipe(Effect.flip);

        // === Then: 学期の形式エラーが発生すること ===
        thenInvalidSessionIdErrorOccurs(commandError as InvalidRegistrationSessionId, validStudentId, "BAD-TERM");
      })
        .pipe(Effect.provide(TestLayer))
        .pipe(Effect.runPromise)
    );
  });
});