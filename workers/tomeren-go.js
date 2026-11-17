// tomeren-go — とめれん帳 収益化Wave 1 の計測配管（クリック302＋インプレッション計測）
//
// エンドポイント:
//   GET  /go/fanza?p=<配置ID>&src=<流入元>   クリックをKVに記録して FANZA へ 302
//   GET|POST /count?p=<画面ID>               インプレッション（分母）をKVに記録して 204
//   GET  /stats                              配置・画面ごとの件数をJSONで返す（確認用）
//
// ログ保存先: Cloudflare KV（バインディング名 TM_LOG）
//   キー形式: click:<配置ID>:<ISO時刻>:<ランダム> / imp:<画面ID>:<ISO時刻>:<ランダム>
//   件数はキー prefix の list で数える。IPアドレスは保存しない（UA・Refererのみ）。
//
// リダイレクト先は AFFILIATE_URLS で一箇所管理する。
// 初期値は現行サイトで使われている FANZA リンク（af_id=tomeren-003）の流用。
// ★ result-main / result-sub / hist-main は、DMM料率の一次確認と
//   「無料お試し」案件リンクの確定後に差し替える前提のプレースホルダ。

const AF_ID = 'tomeren-003';

function fanzaUrl(dest) {
  return 'https://al.fanza.co.jp/?lurl=' + encodeURIComponent(dest) +
    '&af_id=' + AF_ID + '&ch=search_link&ch_id=link';
}

const AFFILIATE_URLS = {
  // 結果画面・主CTA（無料お試し系に差し替え予定。当面は既存リンク流用）
  'result-main': fanzaUrl('https://video.dmm.co.jp/'),
  // 結果画面・従CTA（月額動画系に差し替え予定。当面は既存リンク流用）
  'result-sub': fanzaUrl('https://video.dmm.co.jp/'),
  // 履歴画面CTA（無料お試し系に差し替え予定。当面は既存リンク流用）
  'hist-main': fanzaUrl('https://video.dmm.co.jp/'),
  // 広告ポップアップのフォールバックリンク（現行サイトと同一）
  'banner-fallback': fanzaUrl('https://video.dmm.co.jp/'),
  // 'search' は動的生成（下記 searchUrl）なのでここには置かない
};

// 動画検索用: 検索語から遷移先を組み立てる（現行サイトの挙動と同一）
function searchUrl(key) {
  const dest = 'https://video.dmm.co.jp/list/?key=' + encodeURIComponent(key || '');
  return fanzaUrl(dest);
}

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

async function logEvent(env, kind, id, req) {
  if (!env.TM_LOG) return;
  const ts = new Date().toISOString();
  const key = kind + ':' + id + ':' + ts + ':' + rand();
  const val = JSON.stringify({
    ts,
    ua: req.headers.get('user-agent') || '',
    ref: req.headers.get('referer') || '',
    // IPアドレスは保存しない
  });
  await env.TM_LOG.put(key, val);
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);

    if (url.pathname === '/go/fanza') {
      const p = (url.searchParams.get('p') || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '');
      const src = (url.searchParams.get('src') || '').replace(/[^a-zA-Z0-9_-]/g, '');
      let dest;
      if (p === 'search') {
        dest = searchUrl(url.searchParams.get('key') || '');
      } else {
        dest = AFFILIATE_URLS[p];
      }
      if (!dest) {
        return new Response('unknown placement: ' + p, { status: 404 });
      }
      // ログ記録を待ってから飛ばす（記録失敗でもリダイレクトは止めない）
      try {
        await logEvent(env, 'click', p + (src ? ':' + src : ''), req);
      } catch (e) { /* logging must never block the redirect */ }
      return Response.redirect(dest, 302);
    }

    if (url.pathname === '/count') {
      const p = (url.searchParams.get('p') || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '');
      try {
        await logEvent(env, 'imp', p, req);
      } catch (e) { /* ignore */ }
      return new Response(null, { status: 204 });
    }

    if (url.pathname === '/stats') {
      // 確認用: prefix ごとにキー件数を数える（KV list は結果整合性に遅延あり・小規模用途前提）
      if (!env.TM_LOG) return new Response('KV not bound', { status: 500 });
      const counts = {};
      let cursor;
      do {
        const list = await env.TM_LOG.list({ cursor, limit: 1000 });
        for (const k of list.keys) {
          const parts = k.name.split(':');
          const bucket = parts.slice(0, 2).join(':');
          counts[bucket] = (counts[bucket] || 0) + 1;
        }
        cursor = list.list_complete ? undefined : list.cursor;
      } while (cursor);
      return new Response(JSON.stringify(counts, null, 2), {
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    }

    return new Response('tomeren-go', { status: 200 });
  },
};
