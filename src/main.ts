import { Effect, Console, Layer, Ref } from "effect";
import { createRegistrationSession } from "./contexts/enrollment/application/commands/create-registration-session.js";
import { StudentId, Term } from "./contexts/enrollment/domain/models/shared/value-objects.js";
import { InMemoryEventStore } from "./contexts/shared/infrastructure/event-store/in-memory-event-store.js";
import { InMemoryRegistrationSessionRepository } from "./contexts/enrollment/infrastructure/persistence/in-memory-registration-session-repository.js";
import { InMemoryEventBus } from "./contexts/shared/infrastructure/event-bus/in-memory-event-bus.js";
import { EventBus } from "./contexts/shared/kernel/types/event-bus.js";
import { RegistrationSessionRepository } from "./contexts/enrollment/domain/repositories/registration-session-repository.js";
import { DomainEvent } from "./contexts/enrollment/domain/events/registration-session-events.js";

const ApplicationLayer = Layer.mergeAll(
  InMemoryEventStore,
  InMemoryEventBus,
  InMemoryRegistrationSessionRepository.pipe(
    Layer.provide(InMemoryEventStore)
  )
);

const program = Effect.gen(function* () {
  yield* Console.log("=== 履修管理システム - CQRS/イベントソーシング動作確認 ===");
  yield* Console.log("");
  
  // イベントキャプチャ用
  const capturedEvents = yield* Ref.make<DomainEvent[]>([]);
  const eventBus = yield* EventBus;
  const repository = yield* RegistrationSessionRepository;
  
  // イベントハンドラを登録
  yield* eventBus.subscribe((event) =>
    Effect.gen(function* () {
      yield* Ref.update(capturedEvents, (events) => [...events, event]);
      yield* Console.log(`📢 イベント受信: ${event._tag}`);
      if (event._tag === "RegistrationSessionCreated") {
        yield* Console.log(`   セッションID: ${event.sessionId}`);
        yield* Console.log(`   学生ID: ${event.studentId}`);
        yield* Console.log(`   学期: ${event.term}`);
      }
    })
  );

  const studentId = StudentId.make("S12345678");
  const term = Term.make("2024-Spring");
  
  yield* Console.log(`👤 学生ID: ${studentId}`);
  yield* Console.log(`📅 学期: ${term}`);
  yield* Console.log("");
  
  // セッション作成
  yield* Console.log("🔄 履修登録セッション作成中...");
  const sessionId = yield* createRegistrationSession({ studentId, term });
  yield* Console.log(`✅ セッション作成完了: ${sessionId}`);
  yield* Console.log("");
  
  // イベント発行確認
  const events = yield* Ref.get(capturedEvents);
  yield* Console.log(`📊 発行されたイベント数: ${events.length}`);
  yield* Console.log("");
  
  // リポジトリから復元確認
  yield* Console.log("🔍 リポジトリからのセッション復元確認...");
  const restoredSession = yield* repository.findById(sessionId);
  yield* Console.log(`✅ セッション復元成功:`);
  yield* Console.log(`   ID: ${restoredSession.id}`);
  yield* Console.log(`   学生ID: ${restoredSession.studentId}`);
  yield* Console.log(`   学期: ${restoredSession.term}`);
  yield* Console.log(`   状態: ${restoredSession.status._tag}`);
  yield* Console.log(`   履修数: ${restoredSession.enrollments.length}`);
  yield* Console.log(`   合計単位: ${restoredSession.totalUnits}`);
  yield* Console.log(`   バージョン: ${restoredSession.version}`);
  
  yield* Console.log("");
  yield* Console.log("🎉 CQRS/イベントソーシングアーキテクチャ動作確認完了！");
});

Effect.runPromise(
  program.pipe(Effect.provide(ApplicationLayer))
).catch(console.error);