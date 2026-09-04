# 営業日報システム API仕様書

本書は `docs/requirements.md`（要件・ER図）および `docs/screen-definitions.md`（画面定義書）を実現するためのAPI仕様である。実装はまだ行わない。

## 1. 共通仕様

### 1.1 ベースURL・フォーマット

- ベースURL: `/api`
- リクエスト/レスポンスともに `application/json`
- 日付は `YYYY-MM-DD`、時刻は `HH:mm`、日時（作成日時等）は ISO8601（例: `2026-08-25T10:00:00+09:00`）とする。

### 1.2 「現在のユーザー」の指定方法（認証代替）

アプリケーション全体としてはSupabase Authによるログインを実装済みだが（画面定義書0.1参照）、APIエンドポイント自体はまだSupabase Authのセッションを検証していない。ログイン中のフロントエンドは、解決済みの `sales_person_id`（`GET /api/auth/me` の結果）を自動的に以下のカスタムヘッダーへ設定して送信し、サーバーはこの値のみを信頼して「誰として操作しているか」を解釈する（ユーザーが値を選択・入力する画面上のUIは存在しない）。

```
X-Sales-Person-Id: <int>
```

- サーバーはこの値を `SALES_PERSON.sales_person_id` として解釈し、以降の権限判定（`is_manager` の確認、日報の所有者チェック等）に用いる。
- 例外として `GET /api/sales-persons`（ヘッダーの現在のユーザー表示・上長向けの営業担当者絞り込みなどに使う一覧を取得するため）のみ、このヘッダーが無くても呼び出し可能とする。
- 将来的にAPIエンドポイント側でもSupabase Authのセッションを検証するよう改修する際は、このヘッダーの代わりにセッション/トークンから同じ値を取得する形に置き換える想定（APIのレスポンス形状は変えない）。

### 1.3 権限エラーの扱い

| コード             | HTTPステータス | 意味                                                         |
| ------------------ | -------------- | ------------------------------------------------------------ |
| `UNAUTHENTICATED`  | 401            | `X-Sales-Person-Id` が未指定、または存在しないIDが指定された |
| `FORBIDDEN`        | 403            | 認証（識別）はできているが、当該操作の権限がない             |
| `NOT_FOUND`        | 404            | 対象リソースが存在しない                                     |
| `CONFLICT`         | 409            | 一意制約違反、または参照されているため削除不可               |
| `VALIDATION_ERROR` | 422            | 入力値のバリデーションエラー                                 |

### 1.4 共通エラーレスポンス形式

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "入力内容に誤りがあります",
    "details": [{ "field": "email", "message": "メールアドレスは必須です" }]
  }
}
```

`details` はフィールド単位のバリデーションエラー時のみ付与する。

### 1.5 一覧APIの共通事項

- 本プロトタイプでは想定データ量が小さいため、ページネーションは実装しない（全件返却）。データ量増加時に `page` / `per_page` を追加する余地を残す。

---

## 2. エンドポイント一覧

| #   | メソッド | パス                        | 概要                                   | 対応画面 |
| --- | -------- | --------------------------- | -------------------------------------- | -------- |
| 1   | GET      | `/api/sales-persons`        | 営業担当者一覧取得                     | SCR-06   |
| 2   | GET      | `/api/sales-persons/:id`    | 営業担当者詳細取得                     | SCR-07   |
| 3   | POST     | `/api/sales-persons`        | 営業担当者登録                         | SCR-07   |
| 4   | PUT      | `/api/sales-persons/:id`    | 営業担当者更新                         | SCR-07   |
| 5   | DELETE   | `/api/sales-persons/:id`    | 営業担当者削除                         | SCR-07   |
| 6   | GET      | `/api/customers`            | 顧客一覧取得（会社名検索可）           | SCR-04   |
| 7   | GET      | `/api/customers/:id`        | 顧客詳細取得                           | SCR-05   |
| 8   | POST     | `/api/customers`            | 顧客登録                               | SCR-05   |
| 9   | PUT      | `/api/customers/:id`        | 顧客更新                               | SCR-05   |
| 10  | DELETE   | `/api/customers/:id`        | 顧客削除                               | SCR-05   |
| 11  | GET      | `/api/reports`              | 日報一覧取得（権限によりスコープ変化） | SCR-01   |
| 12  | GET      | `/api/reports/:id`          | 日報詳細取得（訪問記録・コメント含む） | SCR-03   |
| 13  | POST     | `/api/reports`              | 日報新規作成（下書き/提出）            | SCR-02   |
| 14  | PUT      | `/api/reports/:id`          | 日報更新（下書き/提出）                | SCR-02   |
| 15  | POST     | `/api/reports/:id/comments` | コメント投稿                           | SCR-03   |

`VISIT_RECORD` は独立したエンドポイントを持たない。日報の作成・更新API（#13, #14）の中で配列としてまとめて登録・置換する（画面上で行の追加・削除を自由に行い、保存時にまとめて送信する設計のため）。

日報・コメントの削除、コメントの編集・削除は画面定義書に操作が存在しないため、本フェーズのAPIスコープ外とする。

---

## 3. 営業マスタ API

### 3.1 GET /api/sales-persons

一覧取得。`X-Sales-Person-Id` 不要。

**レスポンス 200**

```json
[
  {
    "sales_person_id": 1,
    "name": "山田太郎",
    "email": "yamada@example.com",
    "department": "営業1課",
    "is_manager": false,
    "created_at": "2026-08-01T09:00:00+09:00",
    "updated_at": "2026-08-01T09:00:00+09:00"
  }
]
```

### 3.2 GET /api/sales-persons/:id

**レスポンス 200**: 3.1の要素1件と同形式
**エラー**: 404（存在しないID）

### 3.3 POST /api/sales-persons

**リクエストボディ**

```json
{
  "name": "山田太郎",
  "email": "yamada@example.com",
  "department": "営業1課",
  "is_manager": false
}
```

| フィールド | 必須 | バリデーション       |
| ---------- | ---- | -------------------- |
| name       | ○    | 1文字以上            |
| email      | ○    | メール形式、重複不可 |
| department | -    |                      |
| is_manager | -    | 未指定時は `false`   |

**レスポンス 201**: 登録内容（3.1の1件分の形式、`sales_person_id`等を含む）
**エラー**: 422（必須項目未入力・メール形式不正）、409（`email` 重複）

### 3.4 PUT /api/sales-persons/:id

リクエスト/レスポンス/バリデーションは3.3と同様（全項目送信で更新）。
**エラー**: 404、422、409（他レコードとの `email` 重複）

### 3.5 DELETE /api/sales-persons/:id

**レスポンス**: 204 No Content
**エラー**:

- 404（存在しないID）
- 409 `CONFLICT`（`DAILY_REPORT.sales_person_id` または `MANAGER_COMMENT.manager_id` から参照されている場合。メッセージ例: `"この営業担当者は日報またはコメントで使用されているため削除できません"`）

---

## 4. 顧客マスタ API

### 4.1 GET /api/customers

**クエリパラメータ**

| パラメータ   | 必須 | 説明                 |
| ------------ | ---- | -------------------- |
| company_name | -    | 会社名の部分一致検索 |

**レスポンス 200**

```json
[
  {
    "customer_id": 1,
    "company_name": "株式会社A社",
    "contact_person": "佐藤様",
    "phone": "03-1234-5678",
    "email": "sato@a-corp.example.com",
    "address": "東京都千代田区...",
    "created_at": "2026-08-01T09:00:00+09:00",
    "updated_at": "2026-08-01T09:00:00+09:00"
  }
]
```

### 4.2 GET /api/customers/:id

**レスポンス 200**: 4.1の要素1件と同形式
**エラー**: 404

### 4.3 POST /api/customers

**リクエストボディ**

```json
{
  "company_name": "株式会社A社",
  "contact_person": "佐藤様",
  "phone": "03-1234-5678",
  "email": "sato@a-corp.example.com",
  "address": "東京都千代田区..."
}
```

| フィールド                               | 必須 | バリデーション |
| ---------------------------------------- | ---- | -------------- |
| company_name                             | ○    | 1文字以上      |
| contact_person / phone / email / address | -    |                |

**レスポンス 201**: 登録内容
**エラー**: 422（`company_name` 未入力）

### 4.4 PUT /api/customers/:id

3.3と同様の形式で全項目更新。
**エラー**: 404、422

### 4.5 DELETE /api/customers/:id

**レスポンス**: 204 No Content
**エラー**:

- 404
- 409 `CONFLICT`（`VISIT_RECORD.customer_id` から参照されている場合。メッセージ例: `"この顧客は訪問記録で使用されているため削除できません"`）

---

## 5. 日報 API

### 5.1 GET /api/reports

**必須ヘッダー**: `X-Sales-Person-Id`

**クエリパラメータ**

| パラメータ      | 必須 | 説明                                                                                               |
| --------------- | ---- | -------------------------------------------------------------------------------------------------- |
| date_from       | -    | `report_date >= date_from`                                                                         |
| date_to         | -    | `report_date <= date_to`                                                                           |
| sales_person_id | -    | 上長が営業担当者で絞り込む場合に指定（営業本人が使う場合は無視され、常に自分自身にスコープされる） |

**スコープ（権限）**

- `X-Sales-Person-Id` の `is_manager = false`（営業）の場合:
  - 自分が作成した日報のみ返却（`status` は DRAFT / SUBMITTED 両方含む）
  - `sales_person_id` クエリは無視する
- `X-Sales-Person-Id` の `is_manager = true`（上長）の場合:
  - `status = SUBMITTED` の日報のみ、全営業担当者分を返却（`sales_person_id` 指定時はその担当者分のみに絞る）

**レスポンス 200**

```json
[
  {
    "report_id": 10,
    "sales_person_id": 1,
    "sales_person_name": "山田太郎",
    "report_date": "2026-08-25",
    "status": "SUBMITTED",
    "visit_count": 2
  }
]
```

### 5.2 GET /api/reports/:id

**必須ヘッダー**: `X-Sales-Person-Id`

**アクセス可否**

- `status = DRAFT` の場合: 作成者本人（`sales_person_id` 一致）のみアクセス可。それ以外は 403。
- `status = SUBMITTED` の場合: 作成者本人、または `is_manager = true` のユーザーがアクセス可。

**レスポンス 200**

```json
{
  "report_id": 10,
  "sales_person_id": 1,
  "sales_person_name": "山田太郎",
  "report_date": "2026-08-25",
  "status": "SUBMITTED",
  "problem": "A社の見積もり承認が遅れている",
  "plan": "C社へ初回訪問予定",
  "created_at": "2026-08-25T18:00:00+09:00",
  "updated_at": "2026-08-25T18:00:00+09:00",
  "visit_records": [
    {
      "visit_id": 101,
      "customer_id": 1,
      "customer_name": "株式会社A社",
      "visit_content": "新商品の提案を実施",
      "visit_time": "10:00",
      "created_at": "2026-08-25T18:00:00+09:00"
    },
    {
      "visit_id": 102,
      "customer_id": 2,
      "customer_name": "株式会社B社",
      "visit_content": "定期フォロー訪問",
      "visit_time": "13:30",
      "created_at": "2026-08-25T18:00:00+09:00"
    }
  ],
  "comments": [
    {
      "comment_id": 201,
      "manager_id": 5,
      "manager_name": "鈴木一郎",
      "comment": "見積もりの件、私からも確認します",
      "created_at": "2026-08-25T19:10:00+09:00"
    }
  ]
}
```

**エラー**: 404、403（アクセス権限なし）

### 5.3 POST /api/reports

**必須ヘッダー**: `X-Sales-Person-Id`（作成者として使用。ボディでの `sales_person_id` 指定は不要かつ無視する）

**リクエストボディ**

```json
{
  "report_date": "2026-08-25",
  "status": "SUBMITTED",
  "problem": "A社の見積もり承認が遅れている",
  "plan": "C社へ初回訪問予定",
  "visit_records": [
    { "customer_id": 1, "visit_content": "新商品の提案を実施", "visit_time": "10:00" },
    { "customer_id": 2, "visit_content": "定期フォロー訪問", "visit_time": "13:30" }
  ]
}
```

| フィールド     | 必須                                                           | バリデーション                                                          |
| -------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------- |
| report_date    | ○                                                              | 日付形式。`(sales_person_id, report_date)` が既存の日報と重複しないこと |
| status         | ○                                                              | `DRAFT` または `SUBMITTED`                                              |
| problem / plan | -                                                              |                                                                         |
| visit_records  | status=DRAFTなら任意（0件可）、status=SUBMITTEDなら1件以上必須 | 各要素の `customer_id` と `visit_content` は必須。`visit_time` は任意   |

**レスポンス 201**: 5.2と同じ形式（作成された日報の詳細）
**エラー**:

- 422（`report_date` 未入力、`visit_records` の必須項目不足、SUBMITTED時に0件など）
- 409 `CONFLICT`（同一営業担当者・同一日付の日報が既に存在）

### 5.4 PUT /api/reports/:id

**必須ヘッダー**: `X-Sales-Person-Id`（作成者本人のみ許可。一致しない場合 403）

**リクエストボディ**: 5.3と同形式。`visit_records` は送信された内容で全置換する（既存の訪問記録は一旦削除し、送信された配列で作り直す）。

**レスポンス 200**: 5.2と同じ形式
**エラー**:

- 403（作成者本人でない）
- 404
- 422（5.3と同様）
- 409（`report_date` を変更した結果、他の自分の日報と重複する場合）

---

## 6. コメント API

### 6.1 POST /api/reports/:id/comments

**必須ヘッダー**: `X-Sales-Person-Id`（コメント投稿者。`is_manager = true` である必要がある）

**アクセス可否**

- `X-Sales-Person-Id` が `is_manager = false` の場合: 403
- 対象日報の `status` が `DRAFT` の場合: 403（提出済みの日報にのみコメント可能）

**リクエストボディ**

```json
{
  "comment": "見積もりの件、私からも確認します"
}
```

| フィールド | 必須 | バリデーション |
| ---------- | ---- | -------------- |
| comment    | ○    | 1文字以上      |

**レスポンス 201**

```json
{
  "comment_id": 201,
  "report_id": 10,
  "manager_id": 5,
  "manager_name": "鈴木一郎",
  "comment": "見積もりの件、私からも確認します",
  "created_at": "2026-08-25T19:10:00+09:00"
}
```

**エラー**: 404（日報が存在しない）、403（権限なし、または対象がDRAFT）、422（`comment` 未入力）

---

## 7. 今後の検討事項

- APIエンドポイント側でもSupabase Authのセッション検証を導入し、`X-Sales-Person-Id` ヘッダーをセッション/トークンベースの識別に置き換える（エンドポイント仕様・レスポンス形状は変更しない想定）。
- データ量増加時のページネーション追加（一覧系エンドポイント）。
- 日報・コメントの削除/編集が必要になった場合のエンドポイント追加。
- マスタ管理を上長限定にする場合、`is_manager` チェックを3章・4章のPOST/PUT/DELETEに追加する。
