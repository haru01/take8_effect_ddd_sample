# GitHub Copilot カスタムチャットモード

このディレクトリには、履修管理システムの開発で使用するGitHub Copilotのカスタムチャットモードが含まれています。各モードは特定の開発フェーズや専門領域に特化しています。

## 📚 チャットモード一覧

### 🎯 [programming-committer](./programming-committer.chatmode.md)
**タスク完成特化型開発者**
- 与えられたタスクの確実な実装
- AcceptanceTDDによる段階的実装
- 最小限のコードで機能完成
- 品質基準の厳守

### 👨‍💼 [domain-expert](./domain-expert.chatmode.md)
**履修管理ドメインエキスパート**
- ビジネス要件の整理
- ユーザーストーリー作成
- 受け入れ条件の定義
- ビジネスルール文書化

### 🏗️ [designing-committer](./designing-committer.chatmode.md)
**CQRS設計特化型開発者**
- 技術設計とアーキテクチャ
- ストーリーのタスク分解
- ドメインイベント設計
- AcceptanceTDD戦略立案

### 🔧 [refactoring-committer](./refactoring-committer.chatmode.md)
**リファクタリング専門開発者**
- コード品質向上
- 重複コードの解消
- パフォーマンス最適化
- 技術的負債の解消

### 🧪 [qa-ing-committer](./qa-ing-committer.chatmode.md)
**品質保証特化型開発者**
- テスト網羅性確保
- 品質基準の検証
- エッジケース特定
- 改善提案

### 🔄 [retrospecting-committer](./retrospecting-committer.chatmode.md)
**振り返り特化型開発者**
- プロセス改善
- 成果物分析
- パターン抽出
- 継続的改善推進

## 🚀 使い方

### VS Code / GitHub.comでの利用

1. GitHub Copilot Chatを開く
2. 使用したいチャットのカスタムモードを選択
3. プロンプトを入力

### 使用例


カスタムの domain-expert モードに切り替えてから
```
ストーリー3: 履修登録提出 のユーザーストーリーを作成してください
```

カスタムの designing-committer モードに切り替えてから
```
ストーリー3: 履修登録提出 の技術設計とタスク分解を行ってください
```

カスタムの programming-committer モードに切り替えてから
```
ストーリー3: 履修登録提出 の実装を行ってください
```

カスタムの refactoring-committer モードに切り替えてから
```
ストーリー3: リファクタリグ案を提案してください
```

カスタムの qa-ing-committer モードに切り替えてから
```
ストーリー3: 品質検証のレポートを作成してください
```

カスタムの retrospecting-committer モードに切り替えてから
```
ストーリー3の実装を振り返ってください
```

## 📋 開発フロー別の推奨モード

### 新機能開発時
1. `domain-expert` - ユーザーストーリーと受けれ条件の作成
  -> .github/tmp/{story-name}/user-story.md
2. `designing-committer` - 技術設計とタスク分解
  -> .github/tmp/{story-name}/design-and-tasks.md
3. `programming-committer` - 実装
  -> コードとテストの実装
4. `qa-ing-committer` - 品質確認
5. `refactoring-committer` - 改善（必要に応じて）
6. `retrospecting-committer` - 振り返り


### コード改善時
1. `refactoring-committer` - 改善
2. `qa-ing-committer` - 品質確認

## ⚡ クイックリファレンス

### 各モードの主要コマンド

**programming-committer**
- `npm run test` - テスト実行
- `npm run test:coverage` - カバレッジ確認
- `npm run typecheck` - 型チェック

**designing-committer**
- Phase分けによるタスク分解
- Effect-TSパターン適用
- CQRS/イベントソーシング設計

**qa-ing-committer**
- カバレッジ90%以上確認
- Effect.flipパターン検証
- カスタムアサーション評価

## 📝 カスタマイズ

各`.chatmode.md`ファイルを編集することで、プロジェクトに合わせてカスタマイズできます。

### カスタマイズ例
- 品質基準の調整
- 実装パターンの追加
- プロジェクト固有ルールの反映

## 📁 一時ファイル管理システム

各チャットモードの作業結果は `.github/tmp/` に保存され、次のモードに引き継がれます。


## 🔗 関連ドキュメント

- [プロジェクトガイド](../copilot-instructions/README.md)
- [開発パターン](../copilot-instructions/development-patterns.md)
- [テストガイド](../copilot-instructions/testing-guide.md)
- [ワークフロー](../copilot-instructions/workflow-guide.md)
