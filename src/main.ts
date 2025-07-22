import { Effect, Console } from "effect";

const program = Effect.gen(function* () {
  yield* Console.log("履修管理システム - Effect-TS CQRS/イベントソーシング実装");
  yield* Console.log("プロジェクトセットアップ完了！");
});

Effect.runPromise(program).catch(console.error);