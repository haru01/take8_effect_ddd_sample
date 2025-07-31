# 履修管理システム - プロジェクト開発ガイド

## 概要

このドキュメントは、Effect-TSを用いたCQRS/イベントソーシング履修管理システムの開発ガイドラインです。GitHub Copilotを使用する際の指針として活用してください。

## プロジェクト構成

### アーキテクチャ概要
- **技術スタック**: TypeScript, Effect-TS, Vitest
- **設計パターン**: CQRS（コマンド・クエリ責任分離）、イベントソーシング、DDD（ドメイン駆動設計）
- **品質基準**: カバレッジ90%以上、TypeScriptエラー0、Effect-TSパターン厳守

### ディレクトリ構成
```
src/contexts/enrollment/
├── domain/
│   ├── models/          # 集約・エンティティ・値オブジェクト
│   ├── events/          # ドメインイベント
│   ├── errors/          # ドメインエラー
│   └── repositories/    # リポジトリインターフェース
├── application/
│   └── commands/        # アプリケーションコマンド
└── infrastructure/
    └── persistence/     # リポジトリ実装

tests/
├── stories/            # 受け入れテスト（ストーリーベース）
└── helpers/            # カスタムアサーション
```

## 開発ガイドライン

### 1. AcceptanceTDD（受け入れテスト駆動開発）必須

開発は必ず以下の手順で進めてください：

#### Phase 1: 基本正常系
1. 最重要な受け入れ条件を1つ選定
2. 失敗するテストを作成（Red）
3. 最小限の実装でテスト通過（Green）
4. リファクタリング（Refactor）

#### Phase 2: 主要異常系
1. 重要なエラーケースを1つずつ実装
2. Effect.flipパターンでエラーテスト
3. 段階的にテストを有効化

#### Phase 3: 境界値・エッジケース
1. 境界値テストの実装
2. エッジケースの網羅
3. 最終品質確保

### 2. コーディング規約

#### Effect-TSパターン（必須）
```typescript
// ✅ 良い例: Brand型使用
export type StudentId = string & Brand.Brand<"StudentId">;
function createSession(studentId: StudentId, term: Term) { ... }

// ❌ 悪い例: プリミティブ型使用
function createSession(studentId: string, term: string) { ... }

// ✅ 良い例: Effect型でエラーハンドリング
const session = yield* repository.findById(sessionId).pipe(
  Effect.flatMap(Option.match({
    onNone: () => Effect.fail(new SessionNotFound({ sessionId })),
    onSome: Effect.succeed
  }))
);

// ❌ 悪い例: 例外を投げる
if (!session) throw new Error("Session not found");
```

#### ドメインロジックパターン
```typescript
// ドメイン層: ビジネスロジック + イベント生成
export const addCoursesToSession = (
  session: RegistrationSession,
  courses: ReadonlyArray<CourseInfo>
): Effect.Effect<CoursesAddedToSession, DomainError> =>
  Effect.gen(function* () {
    // シンプルな順次バリデーション
    yield* validateDraftState(session);
    yield* validateNoDuplicates(session, courses);
    yield* validateUnitLimit(session, courses);

    // イベント生成
    return new CoursesAddedToSession({ ... });
  });

// アプリケーション層: インフラ調整のみ
export const addCoursesToSession = (command) =>
  Effect.gen(function* () {
    const session = yield* repository.findById(sessionId);
    const event = yield* addCoursesToSessionDomain(session, courses);

    yield* eventStore.appendEvent(sessionId, "RegistrationSession", event);
    yield* eventBus.publish(event);
    return sessionId;
  });
```

### 3. テスト実装パターン

#### 受け入れテストテンプレート
```typescript
describe("ストーリーX: [機能名]", () => {
  const TestLayer = Layer.mergeAll(
    InMemoryEventStore,
    InMemoryEventBus,
    InMemoryRegistrationSessionRepository.pipe(
      Layer.provide(Layer.mergeAll(InMemoryEventStore, InMemoryEventBus))
    )
  );

  describe("基本シナリオ", () => {
    it("AC1: [最重要な正常系]", () =>
      Effect.gen(function* () {
        // Given: 前提条件
        const { studentId, term } = yield* givenValidStudentAndTerm();
        const capturedEvents = yield* givenEventCapture();

        // When: 実行
        const sessionId = yield* createRegistrationSession({ studentId, term });

        // Then: 検証
        yield* thenSessionCreatedSuccessfully({ sessionId, studentId, term, capturedEvents });
      })
        .pipe(Effect.provide(TestLayer))
        .pipe(Effect.runPromise)
    );
  });

  describe("異常系シナリオ", () => {
    it.skip("AC2: [エラーケース]", () =>
      Effect.gen(function* () {
        // Effect.flipパターンでエラー捕捉
        const error = yield* someCommand().pipe(Effect.flip);
        assertSpecificError(error, expectedParams);
      })
        .pipe(Effect.provide(TestLayer))
        .pipe(Effect.runPromise)
    );
  });
});
```

### 4. 実装済み機能と設計パターン

#### 値オブジェクト（Brand型）
- `StudentId`: S12345678形式
- `CourseId`: C123456形式
- `Term`: YYYY-Season形式
- `RegistrationSessionId`: 複合キー
- `EnrollmentId`: 複合キー

#### ドメインイベント（実装済み）
- `RegistrationSessionCreated`: セッション作成時
- `CoursesAddedToSession`: 科目一括追加時

#### ドメインエラー（実装済み）
- `SessionAlreadyExists`: セッション重複
- `SessionNotFound`: セッション未発見
- `InvalidSessionState`: 不正な状態遷移
- `MaxUnitsExceeded`: 単位数超過
- `DuplicateCourseInSession`: 重複科目

## 開発フロー

### 新機能実装手順
1. **要件定義**: ユーザーストーリーと受け入れ条件を明確化
2. **技術設計**: CQRS/イベントソーシングパターンでの設計
3. **AcceptanceTDD実装**: 段階的にテストと実装を進める
4. **品質確認**: カバレッジ90%以上、TypeScriptエラー0を確認
5. **リファクタリング**: 必要に応じてコード品質を改善

### コマンド例
```bash
npm install          # 依存関係インストール
npm run test         # 全テスト実行
npm run test:coverage # カバレッジ確認
npm run typecheck    # TypeScript型チェック
npm run dev          # デモプログラム実行
```

## GitHub Copilot活用時の注意点

### やるべきこと
- AcceptanceTDDサイクルを厳守する
- Effect-TSパターンを一貫して使用する
- カスタムアサーションを活用する
- 段階的に実装を進める
- ドメインロジックとアプリケーション層を分離する

### やってはいけないこと
- 一度に全機能を実装する
- try-catchでエラーハンドリングする
- プリミティブ型を直接使用する
- テストなしで実装を進める
- 既存のアーキテクチャパターンから逸脱する

## 品質基準
- **テストカバレッジ**: 90%以上を維持
- **TypeScript**: エラー0を維持
- **テスト**: 全テスト通過必須
- **命名規則**: 日本語でビジネス価値を表現
- **Effect-TS**: パターンの一貫性を保つ