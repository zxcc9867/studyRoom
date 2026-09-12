# 強制出席型スタディルーム

## StudyRoom 2.0 — 時間単位の技術フィード（ローカル実装）

新技術の発見 → 韓国語要約または配信元の紹介 → 原文 → 学習タスクの順に利用します。最新/保存、分野・配信元フィルター、20件ずつの追加読み込み、折りたたみ式購読設定を提供します。開始画面は引き続き「今日」です。購読・保存・タスクの関連付けはユーザー別にサーバーへ保存します。

出席処理とは独立したワーカーが承認済み RSS/Atom と Hacker News API を毎時確認します。無料 AI のみを使用し、既存の実呼び出し6回/ユーザー/日（失敗を含む）を共有します。全記事の要約は保証しません。推奨8ソースは**利用条件の確認待ち**で登録し、公開 HTTPS フィードの追加はプレビュー後に最大10件までです。

**本変更では本番デプロイ・有効化を行っていません。** DB・関数・Web・Cron の反映と利用条件の承認は別のリリース作業です。[要件](memory-bank/prd-tech-feed.md) · [リリース手順](docs/tech-feed/release.md) · [キャリア機能の復元](archive/career-coach/README.md)。タイムゾーン設定と学習再開コーチングは維持します。

[English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md)

決めた時刻に学習を始める約束を、計画・集中・振り返り・改善・報酬へつなげる個人向け学習習慣プロダクトです。

[本番アプリを開く](https://study-room-attendance.vercel.app/) · [本番デプロイ workflow](https://github.com/zxcc9867/studyRoom/actions)

![スタディルームのサムネイル](docs/images/study-room-thumbnail.png)

> READMEは現在のユーザー体験と運用モデルを要約しています。詳細な要件、設計判断、進捗は[メモリーバンク](memory-bank/)で管理します。

## このプロジェクトの目的

学習計画を立てることより、毎日実際に始めることのほうが難しい場合があります。このプロダクトは設定した出席時刻に適度な強制力を与え、欠席を罰として扱わずに学習セッション全体を支援します。

Vite/ReactのWebアプリ、Expoモバイル、Supabase Auth/Postgres/RPC/Realtime、予約通知、Three.jsの報酬空間を統合しています。

## 基本的な利用フロー

1. 保存済みSupabaseセッションを復元し、必要に応じてメールOTPまたはGoogle OAuthでログインします。
2. 日付別todo、時間計画、繰り返し予定、目標、D-dayを設定します。
3. Web Push、Slack、メールfallbackで設定時刻のリマインダーを受け取ります。
4. 当日の未完了todoを1件以上選択してセッションを開始します。
5. セッションは1時間のleaseで始まり、1時間単位で延長できます。現在時刻からの残り時間は最大2時間です。
6. 休憩時間を学習時間から除外し、10・20・40分後の復帰予定を設定できます。
7. Webでは上半身の在席をブラウザ内だけで判定します。写真、動画、顔特徴、姿勢ランドマークの原本は保存しません。
8. 終了時に集中度、エネルギー、妨げ、メモ、完了todo、次の行動を振り返ります。
9. 直近7日間の未振り返りセッションを後から整理し、最新の次の行動を次回計画へつなげます。
10. 10分の開始、日次目標、5/7の柔軟なリズム、非懲罰的な再開サインで習慣を育てます。
11. マイページで現在・過去の週/月の学習レポートを比較し、繰り返す妨げに対する具体的な環境調整案を確認します。
12. 出席と継続的な開始を、Study Forestの木、家具、屋外報酬、種の光、蛍のガーランドへ変換します。

## セッションleaseポリシー

- 開始時の基本leaseは1時間です。
- 1回の操作で1時間延長します。
- 現在時刻からの残り時間は最大2時間です。
- WebとSlackは同じサーバーRPCを使用します。
- 満了5分前にSlack警告を送信します。
- Webは15秒ごとにサーバーの締切時刻を同期します。
- ブラウザが閉じていてもSupabase Cronが満了セッションを終了します。
- lease満了後の時間は学習時間として保存されません。

## 主な機能

### 計画と学習セッション

- 日付別・繰り返しtodo、日付をまたぐ予定、月次完了履歴、目標連携。
- 重複時間を表示する円形デイリープランナー。
- サーバーで原子的に処理する開始・休憩・再開・延長・終了。
- 休憩時間の除外と任意の復帰予定。
- WebとExpoで同じセッション・todoルールを共有。

### 継続学習ループ

- セッション振り返りと直近の振り返りインボックス。
- 平日・週末の大きな目標の前に置く10分チェックポイント。
- 最新の次の行動を次回計画へ引き継ぐ仕組み。
- 休み・10分開始・目標・花を示す直近7日間のリズム。
- 2日の休息余白を持つ5/7目標。
- 過去期間も選べる週次・月次レポート、比較期間の明示、月別の日平均。
- 保存済みアカウントのタイムゾーンで完了セッションを集計。読み込み/エラーを0分として表示せず、再試行できます。
- 次の行動の計画化、繰り返す妨げへの対策、適応型リマインダー候補を維持。
- レポートは保存記録から再計算します。自動配信や固定スナップショットではありません。[要件](memory-bank/prd-study-reports.md)。

### Study Forest

- 家、川、橋、庭、照明、時間帯表現を持つThree.js低ポリゴン島。
- キーボード、タッチ、クリック移動、自動散歩。
- 出席連続日数の木とマイルストーン報酬。
- 島テーマ、家のアクセント、代表報酬のユーザー設定。
- 完了セッションから再計算される種の光と蛍のガーランド。

#### 実際に歩けて、育っていく習慣空間

<p align="center">
  <img src="docs/images/study-forest-growth-path.png" alt="低ポリゴンの島、シードの木、5/7の蛍の進捗、成長ロードマップを示すStudy Forest" width="100%" />
</p>

Study Forestは単なる出席バッジではありません。アバターが島を歩き、水を通り抜けない橋を渡り、家の中に入って学習空間を歩けます。出席と小さな開始が積み重なるほど、島も変化します。

| 生きた島を歩く | 自分の学習コテージへ入る |
| --- | --- |
| ![橋の上に立つアバターと低ポリゴンの島](docs/images/study-forest-live-island.png) | ![Cozy Study Cottageの中を歩くアバター](docs/images/study-forest-cottage-interior.png) |
| **意図どおりに移動。** キーボード、タッチ、クリック、自動散歩はいずれも陸地と橋の歩行可能な経路に従います。 | **報酬が残る場所。** 実際の扉から入り、家具のある室内を歩き、下側の出口から島へ戻れます。 |

**成長は島に残ります。** 5/7の小さな開始は木の周りの種の明かりを灯し、7日連続出席で木が完成します。完成した木の数に応じて、新しい家具と屋外報酬が解放されます。

<p align="center">
  <img src="docs/images/study-forest-atelier.png" alt="島テーマ、家のアクセント、屋外報酬、ロック済みアイテムを示す森のカスタマイズ画面" width="100%" />
</p>
### 出席・在席・回復

- 平日・週末目標と遅い時間の学習による出席回復。
- 5分警告と10分後の学習時間停止を行うブラウザ内在席判定。
- 欠席または繰り返し離席に対する回復リクエスト。
- 累積欠席は全デバイスで一つの回復ルーティンに集約し、対象期間・日数を表示。補習タスクはユーザーの現地の今日に作成します。
- 週次回復サマリーと原因分類。

### 通知と診断

- Web Push、Slack Bot、Resendメールfallback。
- すでに出席済みでも設定時刻の初回通知を1回送信し、その状態では再通知や欠席への降格を行いません。
- 重複を防ぐ通知claimと配信履歴。
- Slackテスト通知、lease警告、todo時刻通知、回復アクション。
- Supabase CronとEdge Functionによるサーバー側スケジュール。

## 最新ワークフローの補足

- Web の Today 画面は「集中・計画・記録」に分かれ、タイマー、今日の予定、最近の習慣と履歴を短い導線で確認できます。
- Web の学習開始モーダルでは、タイトルと開始・終了時刻を含む todo を追加でき、円形スケジュールと今回のセッション選択に即時反映されます。
- Expo のクイック追加は現時点でタイトル入力のみをサポートします。
- セッションは1時間の lease で開始し、1回につき1時間延長できますが、現在時刻からの残り時間は最大2時間です。
- モバイルのカメラ監視は、別 PRD の承認までは対象外です。
## アーキテクチャ

```text
apps/web          Vite + ReactダッシュボードとThree.js Study Forest
apps/mobile       Expo React Nativeクライアント
packages/core     出席、日付、OTP、通知、migrationテスト
supabase          Postgres migration、RLS、RPC、Cron、Edge Functions
infra/aws-cdk     任意のS3/CloudFront/EventBridge/Lambda構成
memory-bank       要件、設計判断、進捗、トラブルシューティング
```

- WebはVercel上の静的Viteアプリとして配信します。
- 両クライアントは同じSupabaseプロジェクトとRPC契約を利用します。
- Postgres RLSと明示的な実行権限でユーザーデータを分離します。
- Supabase Cronが毎分attendance Edge Functionを呼び出します。
- 日次・週次・月次の学習時間はタイムゾーン対応のサーバー集計を使用します。
- 習慣表示は読み込み済みセッションとtodoを再利用し、追加API負荷を発生させません。

[インフラ構成](docs/infrastructure-architecture.md)と[実装計画](memory-bank/implementation-plan.md)も参照してください。

## 主なデータ領域

- `profiles`: タイムゾーンと通知設定。
- `attendance_days`: 日次出席と通知claim。
- `study_todos`, `study_goals`: 計画と目標。
- `study_sessions`, `study_session_todos`: セッション、lease、選択todo。
- `study_session_reflections`: 振り返りと次の行動。
- `study_forest_preferences`: 報酬表示設定。
- `study_recovery_requests`, `study_recovery_weekly_reports`: 回復フロー。
- `notification_targets`, `notification_deliveries`: 通知設定と結果。
- `study_presence_events`: メディアを含まない在席イベント。

## 環境変数

実際のキーやトークンをコミットしないでください。ローカル設定は`.env.example`を参照します。

```text
# Web
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_WEB_PUSH_VAPID_PUBLIC_KEY
VITE_GOOGLE_AUTH_ENABLED

# Expo
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
EXPO_PUBLIC_EAS_PROJECT_ID

# Edge Functions / scheduler
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
CRON_SECRET
WEB_PUSH_VAPID_PUBLIC_KEY
WEB_PUSH_VAPID_PRIVATE_KEY
WEB_PUSH_SUBJECT
RESEND_API_KEY
RESEND_FROM_EMAIL
SLACK_BOT_TOKEN
SLACK_SIGNING_SECRET
APP_ORIGIN
```

## ローカル実行

```bash
npm.cmd install
npm.cmd run dev:web
```

Webは通常`http://127.0.0.1:5173`で起動します。必要に応じてViteが次の空きポートを選びます。

```bash
npm.cmd run dev:mobile
```

## 検証

```bash
npm.cmd test
npm.cmd run build
npm.cmd run mobile:check
```

テストは出席ポリシー、認証復旧、session lease、休憩、10分チェックポイント、計画、通知、回復、継続学習、Study Forest、README契約、SQL migrationを対象にします。

## デプロイ

- `main`へのpushでGitHub ActionsがテストとWeb buildを実行し、Vercel productionへデプロイします。
- Supabase変更はmigrationとして適用し、RLS、関数権限、migration状態を確認します。
- 任意のAWS構成は次のコマンドでsynthできます。

```bash
npm.cmd run infra:synth
```

## セキュリティとプライバシー

- service role、Slack、Resend、VAPID秘密鍵をフロントエンドへ置きません。
- 公開スキーマのテーブルはRLSとユーザー所有権ポリシーを使用します。
- `SECURITY DEFINER` RPCは入力と所有権を検証し、広いpublic実行権限を削除します。
- カメラメディアと生体特徴は保存しません。
- ドキュメントに実際のユーザーID、チャンネルID、メール、トークンを記載しません。

## 詳細ドキュメント

READMEは概要です。継続学習ループ、認証復旧、session lease、休憩復帰予定、週次習慣リズム、Study Forest、通知、デプロイなどの機能要件と運用履歴は[`memory-bank/`](memory-bank/)で管理します。

## AI 連携の基盤

今後の AI 機能向けに、サーバー専用 OpenRouter クライアントと GitHub→Vercel 環境変数同期を用意しました。生成用の公開 API や自動モデル呼び出しは有効にしていません。[設定とサーバー側の使用方法（韓国語）](docs/openrouter-setup.md)を参照してください。
## アーカイブ: 以前のキャリアコーチ

以下の説明と画像は以前の実装記録であり、本バージョンの有効な機能ではありません。専用コードとテストは `archive/career-coach/` に保管し、既存 DB 履歴は維持します。

一つのキャリア目標、編集可能なスキルロードマップ、予定と学習記録を結び付け、今日の学習を自動提案します。承認した提案だけを実際のタスクに登録します。

- ソウル・東京などのタイムゾーンを選択し、端末変更や通知設定の保存でも選択を保持します。
- 学習可能時間・休憩・生活予定を設定し、選択した Google カレンダーを読み取り専用で接続します。予定の件名は AI に送りません。
- 関連スキル・所要時間・完了条件を確認し、承認・時間変更・スキップを選択します。
- Slack・Web Push・メールは接続して有効にしたチャネルのみに送信します。未接続の場合はアプリ内のみで表示し、メールへ自動転送しません。
- 選択した公開・非公開 GitHub リポジトリの改善案にファイルとコミットの根拠を示します。非公開コードの AI 分析は個別設定です。コード実行・変更・PR 作成は行いません。

外部アプリ登録、ユーザー接続、実機通知の確認は別の手順です。[接続と運用](docs/studyroom-v2-setup.md)・[要件とリリース基準](memory-bank/prd-studyroom-v2.md)を参照してください。

## AI サービスとモデル

| 項目 | 動作 |
| --- | --- |
| サービス | サーバー専用 OpenRouter |
| 設定モデル | `OPENROUTER_MODEL`、既定は `openrouter/free` または指定した `:free` モデル |
| 実際のモデル | 成功レスポンスのモデル ID を記録。ルーター名と区別 |
| 費用方針 | 無料モデルと価格ゼロ制約、有料への自動切り替えなし |
| 既定の上限 | 出力 1,024 トークン・20 秒、環境変数で設定可能 |
| パイロットの共通予算 | ユーザーごとに実呼び出し最大 6 回/日、失敗を含む。キャッシュは呼び出さない |
| 障害時 | 確認済みロードマップに基づくルール提案を使用し、AI 生成として表示しない |

動的ルーターは固定モデルや常に最高の品質を保証しません。秘密鍵、個人のプロンプト、非公開コードはこの文書に含めません。

## 実装画面

実装した React 画面を合成テストデータで実行して撮影しました。Google・GitHub の実接続や通知受信の証明ではありません。

![自動提案と根拠・完了条件](docs/images/studyroom-v2-today.png)

![編集可能なキャリアとスキルロードマップ](docs/images/studyroom-v2-career.png)

![学習時間とチャネル別通知設定](docs/images/studyroom-v2-settings.png)

![390px のブラウザー幅での設定画面](docs/images/studyroom-v2-mobile.png)

![生活予定の編集と保存したタイムゾーン](docs/images/studyroom-v2-calendar.png)
