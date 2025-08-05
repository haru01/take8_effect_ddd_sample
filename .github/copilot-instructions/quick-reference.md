# クイックリファレンス

## 🚀 新機能実装の最速手順

### 1. テストファイル作成
```bash
touch tests/stories/your-feature.acceptance.test.ts
```

### 2. 基本テスト構造
```typescript
describe("ストーリーX: [機能名]", () => {
  const TestLayer = Layer.mergeAll(
    InMemoryEventStore,
    InMemoryEventBus,
    InMemoryRegistrationSessionRepository.pipe(
      Layer.provide(Layer.mergeAll(InMemoryEventStore, InMemoryEventBus))
    )
  );

  it("最重要な正常系", () =>
    Effect.gen(function* () {
      // Given → When → Then
    }).pipe(Effect.provide(TestLayer)).pipe(Effect.runPromise)
  );

  it.skip("エラーケース", () => /* 後で実装 */);
});
```

### 3. 実装順序
1. 失敗するテストを実行（Red）
2. ドメインイベント実装
3. ドメインロジック実装
4. アプリケーションコマンド実装
5. テスト通過確認（Green）
6. リファクタリング（Refactor）

## 📝 必須パターン

### ドメインイベント
```typescript
export class YourEvent extends Data.TaggedClass("YourEvent")<{
  readonly aggregateId: AggregateId;
  readonly timestamp: Date;
}> {}
```

### ドメインエラー
```typescript
export class YourError extends Data.TaggedError("YourError")<{
  readonly aggregateId: AggregateId;
  readonly message: string;
}> {}
```

### ドメインロジック
```typescript
export const performAction = (aggregate: Aggregate, input: Input) =>
  Effect.gen(function* () {
    yield* validate1(aggregate, input);
    yield* validate2(aggregate, input);
    return new YourEvent({ ... });
  });
```

### アプリケーションコマンド
```typescript
export const yourCommand = (command: Command) =>
  Effect.gen(function* () {
    const aggregate = yield* repository.findById(id);
    const event = yield* domainLogic(aggregate, command);
    yield* eventStore.appendEvent(id, "Type", event);
    yield* eventBus.publish(event);
    return id;
  });
```

### 失敗テスト（Effect.flip）
```typescript
const error = yield* someCommand().pipe(Effect.flip);
expect(error._tag).toBe("ExpectedError");
```

## ✅ 品質チェックリスト

```bash
npm run test          # 全テスト通過
npm run test:coverage # カバレッジ90%以上
npm run typecheck     # TypeScriptエラー0
```

## 🚫 やってはいけないこと

- ❌ try-catch使用
- ❌ プリミティブ型の直接使用
- ❌ アプリケーション層にビジネスロジック
- ❌ 一度に全機能実装
- ❌ テストなしの実装

## 📁 ファイル配置

```
src/contexts/enrollment/
├── domain/
│   ├── models/         # 集約・値オブジェクト
│   ├── events/         # ドメインイベント
│   └── errors/         # ドメインエラー
├── application/
│   └── commands/       # コマンド
└── infrastructure/
    └── persistence/    # リポジトリ実装

tests/
├── stories/           # 受け入れテスト
└── helpers/           # カスタムアサーション
```

## 🔍 トラブルシューティング

### テスト失敗時
```bash
npm run test -- --reporter=verbose
```

### 型エラー時
```bash
npm run typecheck -- --listFiles
```

### カバレッジ確認
```bash
open coverage/index.html
```