import { describe, it } from "vitest";
import { Effect, Layer, Ref } from "effect";
import { createRegistrationSession } from "../../src/contexts/enrollment/application/commands/create-registration-session.js";
import { StudentId, Term } from "../../src/contexts/enrollment/domain/models/shared/value-objects.js";
import { SessionAlreadyExists } from "../../src/contexts/enrollment/domain/errors/domain-errors.js";
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
  assertValidationError
} from "../helpers/assertions.js";

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
        // Arrange
        const studentId = StudentId.make("S12345678");
        const term = Term.make("2024-Spring");
        
        // イベントキャプチャ用
        const capturedEvents = yield* Ref.make<DomainEvent[]>([]);
        const eventBus = yield* EventBus;
        
        // イベントハンドラを登録
        yield* eventBus.subscribe((event) =>
          Ref.update(capturedEvents, (events) => [...events, event])
        );

        // Act
        const sessionId = yield* createRegistrationSession({ studentId, term });

        // Assert - カスタムアサーションで包括的に検証
        yield* assertSessionCreatedSuccessfully({
          sessionId,
          expectedStudentId: studentId,
          expectedTerm: term,
          capturedEvents
        });
      })
        .pipe(Effect.provide(TestLayer))
        .pipe(Effect.runPromise)
    );

    it("同じ学生・学期の重複セッション作成は失敗する", () =>
      Effect.gen(function* () {
        // Arrange
        const studentId = StudentId.make("S12345678");
        const term = Term.make("2024-Spring");
        
        // イベントキャプチャ用
        const capturedEvents = yield* Ref.make<DomainEvent[]>([]);
        const eventBus = yield* EventBus;
        
        yield* eventBus.subscribe((event) =>
          Ref.update(capturedEvents, (events) => [...events, event])
        );

        // Act - 最初のセッション作成（成功）
        const firstSessionId = yield* createRegistrationSession({ studentId, term });
        
        // Assert - 最初のセッションの作成を確認
        yield* assertSessionExistsInRepository(firstSessionId, studentId, term);

        // Act - 同じ学生・学期で再度作成を試行（失敗）
        const error = yield* createRegistrationSession({ studentId, term }).pipe(
          Effect.flip
        );

        // Assert - 重複エラーの確認
        assertDuplicateSessionError(error, firstSessionId);
        
        // Assert - イベントは最初の作成分のみ発行されていることを確認
        yield* assertEventCount(capturedEvents, 1);
      })
        .pipe(Effect.provide(TestLayer))
        .pipe(Effect.runPromise)
    );

    it("異なる学生または学期であれば複数セッションを作成できる", () =>
      Effect.gen(function* () {
        // Arrange
        const student1Id = StudentId.make("S12345678");
        const student2Id = StudentId.make("S87654321");
        const springTerm = Term.make("2024-Spring");
        const fallTerm = Term.make("2024-Fall");
        
        // イベントキャプチャ用
        const capturedEvents = yield* Ref.make<DomainEvent[]>([]);
        const eventBus = yield* EventBus;
        
        yield* eventBus.subscribe((event) =>
          Ref.update(capturedEvents, (events) => [...events, event])
        );

        // Act - 複数セッション作成
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

        // Assert - 複数セッション作成の包括的な検証
        yield* assertMultipleSessionsCreated([
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
        // Arrange
        const studentId = StudentId.make("S12345678");
        const term = Term.make("2024-Spring");

        // Act
        const sessionId = yield* createRegistrationSession({ studentId, term });

        // Assert - リポジトリから取得してDraft状態を確認
        const session = yield* assertSessionExistsInRepository(sessionId, studentId, term);
        assertSessionInDraftState(session);
      })
        .pipe(Effect.provide(TestLayer))
        .pipe(Effect.runPromise)
    );
  });

  describe("エラーケース (E2E)", () => {
    it("不正な学生IDでコマンド実行は失敗する", () =>
      Effect.gen(function* () {
        // Arrange - 不正な学生IDと有効な学期（E2Eテスト: コマンド層からの完全な処理）
        const invalidStudentId = StudentId.make("INVALID");
        const validTerm = Term.make("2024-Spring");

        // Act & Assert - createRegistrationSession コマンドがアーキテクチャ全体を通じて失敗することを確認
        const commandError = yield* createRegistrationSession({ 
          studentId: invalidStudentId, 
          term: validTerm 
        }).pipe(Effect.flip);

        // Assert - 複合キー生成時のバリデーションエラーがコマンド層まで伝播することを確認
        assertValidationError(commandError, "セッションIDは'S12345678:YYYY-Season'形式である必要があります");
      })
        .pipe(Effect.provide(TestLayer))
        .pipe(Effect.runPromise)
    );

    it("不正な学期でコマンド実行は失敗する", () =>
      Effect.gen(function* () {
        // Arrange - 有効な学生IDと不正な学期（E2Eテスト）
        const validStudentId = StudentId.make("S12345678");
        const invalidTerm = Term.make("BAD-TERM");

        // Act & Assert - createRegistrationSession コマンドがアーキテクチャ全体を通じて失敗することを確認
        const commandError = yield* createRegistrationSession({ 
          studentId: validStudentId, 
          term: invalidTerm 
        }).pipe(Effect.flip);

        // Assert - 複合キー生成時のバリデーションエラーがコマンド層まで伝播することを確認
        assertValidationError(commandError, "セッションIDは'S12345678:YYYY-Season'形式である必要があります");
      })
        .pipe(Effect.provide(TestLayer))
        .pipe(Effect.runPromise)
    );
  });
});