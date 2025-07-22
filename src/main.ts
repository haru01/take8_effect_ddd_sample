import { Effect, Console, Layer } from "effect";
import { createRegistrationSession } from "./contexts/enrollment/application/commands/create-registration-session.js";
import { StudentId, Term } from "./contexts/enrollment/domain/models/shared/value-objects.js";
import { InMemoryEventStore } from "./contexts/shared/infrastructure/event-store/in-memory-event-store.js";
import { InMemoryRegistrationSessionRepository } from "./contexts/enrollment/infrastructure/persistence/in-memory-registration-session-repository.js";
import { InMemoryEventBus } from "./contexts/shared/infrastructure/event-bus/in-memory-event-bus.js";

const ApplicationLayer = Layer.mergeAll(
  InMemoryEventStore,
  InMemoryRegistrationSessionRepository,
  InMemoryEventBus
);

const program = Effect.gen(function* () {
  yield* Console.log("=== 履修管理システム - Effect-TS CQRS/イベントソーシング実装 ===");
  yield* Console.log("");
  
  // Story 1: 履修登録セッション開始のデモ
  yield* Console.log("📝 Story 1: 履修登録セッション開始");
  
  try {
    const studentId = StudentId.make("S12345678");
    const term = Term.make("2024-Spring");
    
    yield* Console.log(`👤 学生ID: ${studentId}`);
    yield* Console.log(`📅 学期: ${term}`);
    
    // セッション作成
    yield* Console.log("🔄 履修登録セッションを作成中...");
    const sessionId = yield* createRegistrationSession({ studentId, term });
    yield* Console.log(`✅ セッション作成完了: ${sessionId}`);
    
    // 重複作成のテスト
    yield* Console.log("🔄 重複セッション作成をテスト中...");
    const duplicateResult = yield* Effect.either(
      createRegistrationSession({ studentId, term })
    );
    
    if (duplicateResult._tag === "Left") {
      yield* Console.log(`❌ 期待通り重複エラー: ${duplicateResult.left.message}`);
    } else {
      yield* Console.log(`⚠️  予期しない成功: ${duplicateResult.right}`);
    }
    
    // 異なる学期でのセッション作成
    yield* Console.log("🔄 異なる学期でセッション作成中...");
    const fallTerm = Term.make("2024-Fall");
    const fallSessionId = yield* createRegistrationSession({ 
      studentId, 
      term: fallTerm 
    });
    yield* Console.log(`✅ 秋学期セッション作成完了: ${fallSessionId}`);
    
  } catch (error) {
    yield* Console.log(`💥 エラーが発生しました: ${error}`);
  }
  
  yield* Console.log("");
  yield* Console.log("🎉 Story 1 実装完了！");
});

Effect.runPromise(
  program.pipe(Effect.provide(ApplicationLayer))
).catch(console.error);