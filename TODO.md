# 履修管理システム実装計画

## 概要
Effect-TSを使用したCQRS/イベントソーシングによる履修管理システムの実装計画です。
ハッピーパスシナリオから段階的に機能を実装していきます。

## ハッピーパスシナリオ
1. 学生が履修登録セッションを開始
2. 科目を一括追加（または置換）
3. 履修登録を一括提出
4. アドバイザーが確認・承認
5. 個別履修が開始

## フェーズ1: 基盤構築（優先度: 高）

### 1.1 プロジェクトの初期セットアップ
- TypeScriptプロジェクトの作成
- Effect-TSの依存関係追加
- 境界づけられたコンテキストに基づくディレクトリ構造の作成

#### ディレクトリ構造（境界づけられたコンテキスト）

```
src/
├── contexts/                      # 境界づけられたコンテキスト
│   ├── enrollment/               # 履修管理コンテキスト
│   │   ├── domain/              # ドメイン層
│   │   │   ├── models/          # エンティティ・値オブジェクト
│   │   │   │   ├── registration-session/
│   │   │   │   │   ├── registration-session.ts
│   │   │   │   │   ├── events.ts
│   │   │   │   │   └── errors.ts
│   │   │   │   ├── enrollment/
│   │   │   │   │   ├── enrollment.ts
│   │   │   │   │   ├── events.ts
│   │   │   │   │   └── errors.ts
│   │   │   │   └── shared/
│   │   │   │       └── value-objects.ts
│   │   │   ├── repositories/   # リポジトリインターフェース
│   │   │   └── services/       # ドメインサービス
│   │   ├── application/         # アプリケーション層
│   │   │   ├── commands/       # コマンドハンドラー
│   │   │   ├── queries/        # クエリハンドラー
│   │   │   └── ports/          # ポート（外部インターフェース）
│   │   └── infrastructure/     # インフラ層
│   │       ├── persistence/    # 永続化実装
│   │       └── messaging/      # メッセージング実装
│   └── shared/                  # 共有コンテキスト
│       ├── kernel/             # 共有カーネル
│       │   ├── types/          # 共通型定義
│       │   └── errors/         # 共通エラー
│       └── infrastructure/     # 共通インフラ
│           ├── event-store/    # イベントストア
│           └── event-bus/      # イベントバス
├── api/                         # APIエントリーポイント
└── main.ts                      # アプリケーションエントリーポイント
```

### 1.2 ドメイン層の基本実装
- [ ] 値オブジェクトの定義
  - StudentId, CourseId, Term, EnrollmentId
  - ブランド型による型安全性の確保
- [ ] 履修登録セッション（RegistrationSession）集約
  - セッション状態管理（Draft/Submitted/Approved/Rejected）
  - 科目リストと合計単位数の管理
- [ ] 個別履修（Enrollment）エンティティ
  - 履修状態管理（Requested/Approved/InProgress/Completed等）
  - 成績情報の管理

### 1.3 ドメインイベントとエラー
- [ ] セッション関連イベント
  - RegistrationSessionCreated
  - CoursesAddedToSession（一括追加）
  - SessionCoursesReplaced（一括置換）
  - RegistrationSessionSubmitted
  - RegistrationSessionApproved/Rejected
- [ ] 履修関連イベント
  - EnrollmentsRequestedBatch（一括作成）
  - EnrollmentsApprovedBatch（一括承認）
  - EnrollmentStarted（個別）
- [ ] ドメインエラー
  - MaxUnitsExceeded, MinUnitsNotMet
  - InvalidSessionState, DuplicateCourseInSession

### 1.4 ドメインロジック
- [ ] 科目の一括追加ロジック（重複チェック、単位数チェック）
- [ ] 科目の一括削除ロジック
- [ ] 科目の全置換ロジック
- [ ] セッション提出ロジック（最小単位数チェック）
- [ ] セッション承認/却下ロジック

## フェーズ2: アプリケーション層（優先度: 中）

### 2.1 インターフェース定義
- [ ] RegistrationSessionRepository
- [ ] EnrollmentRepository
- [ ] EventStore（イベントの永続化）
- [ ] EventBus（イベントの配信）

### 2.2 コマンドハンドラー
- [ ] createRegistrationSessionCommand - セッション作成
- [ ] addCoursesToSessionCommand - 科目一括追加
- [ ] replaceAllCoursesInSessionCommand - 科目全置換
- [ ] submitRegistrationSessionCommand - 提出
- [ ] approveRegistrationSessionCommand - 承認
- [ ] startEnrollmentCommand - 履修開始

## フェーズ3: テスト基盤（優先度: 低）

### 3.1 テスト用実装
- [ ] インメモリイベントストア
- [ ] インメモリリポジトリ
- [ ] テスト用のLayerとDI設定

### 3.2 E2Eテスト
- [ ] ハッピーパスシナリオの完全なテスト
  1. セッション作成
  2. 科目追加（3科目）
  3. 一括提出
  4. アドバイザー承認
  5. 履修開始
- [ ] 科目置換シナリオのテスト

## フェーズ4: 本番向け実装（優先度: 低）

### 4.1 PostgreSQL実装
- [ ] イベントストアのPostgreSQL実装
- [ ] イベント投影（Projector）の実装
- [ ] Read Model用のテーブル設計

### 4.2 クエリ層
- [ ] getSessionDetailsQuery
- [ ] getStudentEnrollmentsQuery
- [ ] その他の読み取り専用クエリ

## 実装の進め方

1. **最初に作るもの**: プロジェクトセットアップとドメイン層の基本型
2. **次に作るもの**: 履修登録セッションの基本的な操作（作成、科目追加、提出）
3. **その次**: アプリケーション層のコマンドでハッピーパスを実現
4. **最後に**: インフラ層の実装とE2Eテスト

各フェーズは独立してテスト可能なように設計し、段階的に機能を追加していきます。