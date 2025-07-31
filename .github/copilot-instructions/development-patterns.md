# 開発パターンガイド

このドキュメントは、履修管理システムの開発で使用する具体的なパターンとテンプレートを提供します。

## 1. ドメインイベント実装パターン

### 基本テンプレート
```typescript
import { Data } from "effect";
import type { RegistrationSessionId, StudentId, Term } from "../models/shared/value-objects.js";

export class YourEventName extends Data.TaggedClass("YourEventName")<{
  readonly sessionId: RegistrationSessionId;
  readonly timestamp: Date;
  // その他必要なプロパティ
}> {}

// 使用例
const event = new YourEventName({
  sessionId,
  timestamp: new Date(),
  // その他のプロパティ
});
```

## 2. ドメインエラー実装パターン

### 基本テンプレート
```typescript
import { Data } from "effect";

export class YourErrorName extends Data.TaggedError("YourErrorName")<{
  readonly sessionId: RegistrationSessionId;
  readonly message: string;
  // その他エラー詳細
}> {}

// 使用例
Effect.fail(new YourErrorName({
  sessionId,
  message: "具体的なエラー内容"
}));
```

## 3. ドメインロジック関数パターン

### バリデーション関数
```typescript
export const validateSomething = (
  aggregate: AggregateType,
  input: InputType
): Effect.Effect<void, DomainError> =>
  condition
    ? Effect.void
    : Effect.fail(new SpecificError({ details }));
```

### ドメインロジック関数（イベント生成）
```typescript
export const performDomainAction = (
  aggregate: AggregateType,
  input: InputType
): Effect.Effect<DomainEvent, DomainError> =>
  Effect.gen(function* () {
    // シンプルな順次バリデーション
    yield* validateCondition1(aggregate, input);
    yield* validateCondition2(aggregate, input);
    yield* validateCondition3(aggregate, input);

    // イベント生成
    return new DomainEvent({
      aggregateId: aggregate.id,
      timestamp: new Date(),
      // その他のプロパティ
    });
  });
```

## 4. アプリケーションコマンドパターン

### 基本テンプレート
```typescript
import { Effect } from "effect";
import type { EventStore } from "../../../shared/kernel/types/event-store.js";
import type { EventBus } from "../../../shared/kernel/types/event-bus.js";

export interface YourCommandName {
  readonly aggregateId: AggregateId;
  // その他のパラメータ
}

export const yourCommandName = (command: YourCommandName) =>
  Effect.gen(function* () {
    // 依存性の取得
    const repository = yield* RegistrationSessionRepository;
    const eventStore = yield* EventStore;
    const eventBus = yield* EventBus;

    // 1. 集約の取得
    const aggregate = yield* repository.findById(command.aggregateId);

    // 2. ドメインロジック実行
    const event = yield* domainLogicFunction(aggregate, command);

    // 3. イベント保存・パブリッシュ
    yield* eventStore.appendEvent(
      command.aggregateId,
      "AggregateType",
      event
    );
    yield* eventBus.publish(event);

    return command.aggregateId;
  });
```

## 5. 受け入れテストパターン

### Given-When-Thenヘルパー関数
```typescript
// Given: 前提条件ヘルパー
const givenValidStudentAndTerm = () =>
  Effect.gen(function* () {
    const studentId = StudentId.make("S12345678");
    const term = Term.make("2024-Spring");
    return { studentId, term };
  });

const givenEventCapture = () =>
  Effect.gen(function* () {
    const capturedEvents = yield* Ref.make<DomainEvent[]>([]);
    const eventBus = yield* EventBus;
    yield* eventBus.subscribe((event) =>
      Ref.update(capturedEvents, (events) => [...events, event])
    );
    return capturedEvents;
  });
```

### カスタムアサーション
```typescript
// Then: 結果検証ヘルパー
export const thenEventPublished = (
  capturedEvents: Ref.Ref<DomainEvent[]>,
  expectedEventType: string,
  matcher: (event: any) => boolean
) =>
  Effect.gen(function* () {
    const events = yield* Ref.get(capturedEvents);
    const matchingEvent = events.find(
      e => e._tag === expectedEventType && matcher(e)
    );
    expect(matchingEvent).toBeDefined();
  });

export const thenAggregateCanBeRetrieved = (
  aggregateId: AggregateId,
  expectedState: Partial<AggregateType>
) =>
  Effect.gen(function* () {
    const repository = yield* Repository;
    const aggregate = yield* repository.findById(aggregateId);
    expect(aggregate).toMatchObject(expectedState);
  });
```

### Effect.flipによる失敗テスト
```typescript
it("エラーケースのテスト", () =>
  Effect.gen(function* () {
    // Given: エラーが発生する前提条件
    const invalidInput = createInvalidInput();

    // When: 失敗が期待される操作
    const error = yield* someCommand(invalidInput).pipe(
      Effect.flip // 失敗をSuccessに変換
    );

    // Then: エラーの詳細検証
    expect(error._tag).toBe("ExpectedErrorType");
    expect(error.details).toMatchObject(expectedDetails);
  })
    .pipe(Effect.provide(TestLayer))
    .pipe(Effect.runPromise)
);
```

## 6. リポジトリ実装パターン

### イベントソーシングリポジトリ
```typescript
export const InMemoryAggregateRepository = Layer.effect(
  AggregateRepository,
  Effect.gen(function* () {
    const eventStore = yield* EventStore;

    return {
      findById: (aggregateId: AggregateId) =>
        Effect.gen(function* () {
          const events = yield* eventStore.getEvents(
            aggregateId,
            "AggregateType"
          );

          if (events.length === 0) {
            return Option.none();
          }

          // イベントから集約を再構築
          const aggregate = events.reduce(
            (agg, event) => applyEvent(agg, event),
            initialAggregateState
          );

          return Option.some(aggregate);
        }),
    };
  })
);
```

## 7. バリデーション共通パターン

### 状態チェック
```typescript
export const validateState = (
  aggregate: AggregateType,
  expectedState: string,
  action: string
) =>
  aggregate.status._tag === expectedState
    ? Effect.void
    : Effect.fail(new InvalidState({
        aggregateId: aggregate.id,
        currentState: aggregate.status._tag,
        attemptedAction: action
      }));
```

### 数値範囲チェック
```typescript
export const validateRange = (
  value: number,
  min: number,
  max: number,
  errorConstructor: new (details: any) => DomainError
) =>
  value >= min && value <= max
    ? Effect.void
    : Effect.fail(new errorConstructor({
        currentValue: value,
        minValue: min,
        maxValue: max
      }));
```

### 重複チェック
```typescript
export const validateNoDuplicates = <T>(
  existingItems: ReadonlyArray<T>,
  newItems: ReadonlyArray<T>,
  getId: (item: T) => string
) => {
  const existingIds = new Set(existingItems.map(getId));
  const duplicates = newItems.filter(item => existingIds.has(getId(item)));
  
  return duplicates.length === 0
    ? Effect.void
    : Effect.fail(new DuplicateItems({ duplicateIds: duplicates.map(getId) }));
};
```

## 使用上の注意

1. **これらのパターンは基本形です** - プロジェクトの要件に応じて適切に調整してください
2. **Effect-TSの型安全性を活用** - any型の使用は避け、適切な型注釈を付けてください
3. **ドメインロジックの配置** - ビジネスロジックは必ずドメイン層に配置してください
4. **テストファースト** - 実装前に必ず失敗するテストを書いてください
5. **段階的な実装** - 一度に全てを実装せず、小さなステップで進めてください