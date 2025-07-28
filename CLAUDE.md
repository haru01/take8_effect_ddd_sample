# 履修管理システム - 実装状況と開発ガイド

## 概要
Effect-TSを用いたCQRS/イベントソーシング履修管理システムの実装状況と開発方針。


## 実装状況

### ✅ 完了（15-20%）
**基盤実装**: 値オブジェクト（Brand型）、集約（RegistrationSession）、イベント・エラー体系、アプリケーション層、インメモリインフラ、受け入れテスト

**完成ストーリー**:
- ストーリー1: 履修登録セッション開始
- ストーリー2: 科目一括追加（バリデーション付き）

**品質状況**: 91.87%カバレッジ、65テスト通過、TypeScriptエラー0

**技術特徴**:
- Effect-TSによる型安全な関数型実装
- CQRS/イベントソーシングパターン
- AcceptanceTDD（段階的テスト駆動開発）
- シンプル順次バリデーション

### ❌ 未実装（80-85%）

**次期開発対象**: セッション提出、アドバイザー承認、履修開始・完了、成績付与、PostgreSQL移行、REST API

**設計済みイベント**: RegistrationSessionSubmitted、RegistrationSessionApproved、RegistrationSessionRejected、EnrollmentStarted、EnrollmentCompleted

## 開発ロードマップ

### 🎯 Phase 2: ストーリー3（履修登録提出）
**目標**: Draft→Submitted状態遷移とバリデーション

### Phase 3: 履修ライフサイクル（4-6週間）
**目標**: 承認→履修開始の完全ワークフロー

### Phase 4: プロダクション基盤（8-12週間）
**目標**: PostgreSQL、投影、REST API

## 開発者向けガイド

### 開発環境セットアップ
```bash
npm install
npm run test        # 全テスト実行
npm run test:coverage # カバレッジ確認
npm run dev         # デモプログラム実行
npm run typecheck   # TypeScript型チェック
```

### AcceptanceTDD開発手法（必須）

**原則**: 段階的実装（Red→Green→Refactor）、最小限コード、継続的改善

**3段階アプローチ**:
1. **基本正常系**: 最重要受け入れ条件1つの完成
2. **主要異常系**: エラーケースの段階的実装
3. **境界値・エッジケース**: 包括的品質確保

**テスト構成**: Given-When-Thenパターン、カスタムアサーション活用、段階的テスト有効化（`it.skip()` → `it()`）

**命名規則**: 日本語ストーリー名、AC1/AC2プレフィックス、ビジネス価値重視

### コード規約
1. **Effect-TS優先**: Promiseではなく常にEffectを使用
2. **Brand型活用**: プリミティブ値には必ずBrand型を適用
3. **不変性**: すべてのドメインオブジェクトはイミュータブル
4. **AcceptanceTDD必須**: 新機能は必ずAcceptanceTDDで段階的実装
5. **型安全**: `any`型の使用禁止、完全な型注釈

### AcceptanceTDD品質基準（必須）
1. **段階的実装**: 受け入れ条件を1つずつ完了（一括実装禁止）
2. **TDDサイクル**: 各受け入れ条件でRed→Green→Refactorサイクル実行
3. **最小限実装**: 各モードで過剰実装回避、必要最小限の実装
4. **継続的リファクタリング**: 各モード完了時の設計品質向上
5. **テスト進行管理**: `it.skip()` から `it()` への段階的変更記録
6. **モード別コミット**: Phase毎の独立したコミットによる進捗管理

### テスト品質基準（必須遵守）

#### Effect.flipパターンによる失敗テスト
```typescript
// ✅ 標準的な失敗テストパターン
it("AC2: 同一学生・学期での重複セッション作成を防止する", () =>
  Effect.gen(function* () {
    // Given: 既存セッションが存在する状況
    const { studentId, term } = yield* givenValidStudentAndTerm();
    const firstSessionId = yield* createRegistrationSession({ studentId, term });

    // When: 同じ条件で再度セッション作成を試行（失敗が期待される）
    const error = yield* createRegistrationSession({ studentId, term }).pipe(
      Effect.flip // 失敗をSuccessに変換して捕捉
    );

    // Then: 期待されるエラーの詳細検証
    thenDuplicateSessionErrorOccurs(error, firstSessionId);
  })
    .pipe(Effect.provide(TestLayer))
    .pipe(Effect.runPromise)
);

// ❌ 悪い例: try-catchやPromise.rejectの使用
try {
  await createRegistrationSession({ studentId, term });
  expect.fail("Should have thrown error");
} catch (error) {
  // Effect-TSの型安全性を損なう
}
```

#### TestLayer構成の標準パターン
```typescript
// ✅ 標準的なTestLayer構成
const TestLayer = Layer.mergeAll(
  InMemoryEventStore,                    // イベントストア
  InMemoryEventBus,                      // イベントバス
  InMemoryRegistrationSessionRepository.pipe(  // リポジトリ
    Layer.provide(Layer.mergeAll(InMemoryEventStore, InMemoryEventBus))
  )
);

// インメモリ実装による高速テスト実行
// 実際のDB/外部サービスへの依存を排除
// Effect-TSのLayer合成による依存性注入
```

#### カスタムアサーション活用の必須パターン
```typescript
// ✅ カスタムアサーション使用（推奨）
yield* thenRegistrationSessionCreatedEventIsPublished(
  capturedEvents, sessionId, studentId, term
);
yield* thenRegistrationSessionCanBeRetrieved(sessionId, studentId, term);

// ❌ 直接アサーション（非推奨）
const events = yield* Ref.get(capturedEvents);
expect(events).toHaveLength(1);
expect(events[0]._tag).toBe("RegistrationSessionCreated");
// 詳細検証が冗長になり、再利用性が低い
```

#### 日本語テスト名の命名基準
```typescript
// ✅ 良い例: ビジネス価値を表現する日本語名
describe("ストーリー1: 履修登録セッション開始", () => {
  it("学生が新学期の履修計画を開始する", () => { ... });
  it("同一学生・学期での重複セッション作成を防止する", () => { ... });
  it("複数学生の並行履修計画をサポートする", () => { ... });
});

// ❌ 悪い例: 技術的詳細に焦点を当てた命名
describe("RegistrationSession", () => {
  it("should create session with valid input", () => { ... });
  it("should throw error on duplicate", () => { ... });
});
```

### テスト規約（プロトタイプフェーズ）
1. **AcceptanceTDD優先**: 段階的受け入れテスト実装最優先
2. **カスタムアサーション必須**: 複雑な検証ロジックは再利用可能な関数化
3. **Effect.flip活用**: 失敗テストは必ずEffect.flipパターンを使用
4. **日本語命名**: テスト名は日本語でビジネス価値を表現
5. **TestLayer統一**: 標準的なLayer構成パターンを使用
6. **統合テスト保留**: プロトタイプフェーズでは受け入れテストで代替
7. **90%+カバレッジ**: 品質基準の維持必須
8. **ROI重視**: 投資対効果を考慮したテスト実装判断

### アーキテクチャパターン

#### ドメイン層
```typescript
// ❌ 悪い例: プリミティブ値使用
function createSession(studentId: string, term: string) { ... }

// ✅ 良い例: Brand型使用
function createSession(studentId: StudentId, term: Term) { ... }

// ❌ 悪い例: ドメインロジックがアプリケーション層に漏れる
// application layer
const event = new RegistrationSessionCreated({ ... });

// ✅ 良い例: ドメインロジックはドメイン層に
// domain layer
export const createRegistrationSession = (...) => new RegistrationSessionCreated({ ... });
// application layer
const event = createRegistrationSession(...);
```

#### アプリケーション層
```typescript
// ❌ 悪い例: 例外投げる
if (!session) throw new Error("Session not found");

// ✅ 良い例: Effect型でエラーハンドリング
const session = yield* repository.findById(sessionId).pipe(
  Effect.flatMap(Option.match({
    onNone: () => Effect.fail(new SessionNotFound({ sessionId })),
    onSome: Effect.succeed
  }))
);
```

#### テスト
```typescript
// ❌ 悪い例: 実装詳細のテスト
it("内部バリデーション関数を呼び出す", () => {
  // 内部実装に依存するテスト
});

// ✅ 良い例: ビジネス価値のテスト
it("AC1: 12単位以上のセッションを提出できる", async () => {
  const sessionId = yield* setupTestSession(studentId, term, [4, 4, 4]);
  yield* submitRegistrationSession({ sessionId, submittedBy: studentId });
  yield* assertSessionSubmittedSuccessfully({ sessionId, capturedEvents });
});

// ✅ 良い例: カスタムアサーション使用
yield* assertSessionCreatedSuccessfully({
  sessionId, expectedStudentId, expectedTerm, capturedEvents
});

// ✅ 良い例: Effect.flipによる失敗テスト
const error = yield* createRegistrationSession({ studentId, term }).pipe(
  Effect.flip
);
// エラーをSuccessとして扱い、その後アサーション
assertDuplicateSessionError(error, expectedSessionId);
```

## まとめ

このプロジェクトは **高品質な基盤実装** を持つ優秀なプロトタイプです。Effect-TSによる関数型CQRS/イベントソーシングパターンの実装例として価値があり、今後の段階的な機能拡張により本格的な履修管理システムに発展可能です。

**現在の価値**:
- ✅ アーキテクチャパターンの学習・参考実装
- ✅ Effect-TSエコシステムのベストプラクティス
- ✅ CQRS/イベントソーシングの実践例
- ✅ 型安全な関数型DDD実装

**今後の発展性**:
- 🎯 エンタープライズレベルの履修管理システム
- 🎯 マイクロサービスアーキテクチャの基盤
- 🎯 Effect-TSによる大規模システム開発の参考実装

適切な開発リソースが投入されれば、**6-12ヶ月でプロダクション対応**の履修管理システム構築が可能な優秀な基盤です。

## エージェントシステム活用ガイド

### エージェント概要
特化型エージェントによる段階的開発支援システム。一貫した品質とパターンで開発加速。

**主要エージェント**:
1. **domain-expert**: 要件整理・ストーリー作成
2. **designing-committer**: CQRS技術設計・タスク分解
3. **programming-committer**: TDD実装・テスト通過
4. **refactoring-committer**: コード品質向上・技術的負債解消
5. **qa-ing-committer**: テスト戦略・品質検証
6. **retrospecting-committer**: 振り返り・継続改善

### 標準開発フロー
```
domain-expert → designing-committer → programming-committer → [refactoring-committer] → qa-ing-committer
```

**成果物管理**: `.claude/tmp/{story-name}/` にストーリー単位で保存
- `user-story.md` (domain-expert)
- `design-and-tasks.md` (designing-committer)
- `qa-report.md` (qa-ing-committer)

### 品質基準統一
- 全テスト通過、TypeScriptエラー0、カバレッジ90%以上
- Effect-TSパターン強制、AcceptanceTDD必須
