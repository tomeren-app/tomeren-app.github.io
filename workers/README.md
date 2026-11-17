# tomeren-go Worker デプロイ手順

とめれん帳のクリック計測（/go/fanza → 302）とインプレッション計測（/count）用 Worker。

## 手順（Cloudflareダッシュボード）

1. Workers & Pages → 「Workerを作成」→ 名前 `tomeren-go` でデプロイ（初期コードでOK）。
2. 作成した Worker の「コードを編集」で、`tomeren-go.js` の内容を全部貼り付けて「デプロイ」。
3. ストレージ → KV → 「名前空間を作成」で名前空間 `tomeren-log` を作成。
4. Worker の 設定 → 変数とシークレット（バインディング）→ KV名前空間を追加：
   - 変数名: `TM_LOG`
   - 名前空間: `tomeren-log`
   保存して再デプロイ。
5. Worker の URL（例: `https://tomeren-go.<サブドメイン>.workers.dev`）を控える。
6. サイト側 `index.html` の `TM_GO.GO_BASE`（末尾の tmGo スクリプト内）を、その URL に差し替える。

## 動作確認

- `https://<worker>/go/fanza?p=result-main&src=result` → FANZA に 302 で飛べばOK。
- `https://<worker>/count?p=result` → 204 が返ればOK。
- `https://<worker>/stats` → `click:...` / `imp:...` の件数JSONが見える。

## 注意

- AFFILIATE_URLS の result-main / result-sub / hist-main は初期値として現行サイトの
  FANZA リンクを流用したプレースホルダ。DMM料率の一次確認と「無料お試し」案件の
  リンク確定後に、このファイルの定数だけを差し替える。
- ログに IPアドレスは保存していない（UA・Referer のみ）。
- KV の list は結果整合性に遅延があるため、/stats の件数は「目安」として扱う。
