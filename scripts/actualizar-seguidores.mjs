// Fetches the real follower counts and writes them to stats.js, which the page reads on load.
// GitHub runs it every 6 h (.github/workflows/publicar.yml). Locally: node scripts/actualizar-seguidores.mjs
// A network that isn't connected is skipped; one that fails keeps its last count, and the run
// ends with an error so GitHub emails you.
import {
  loadEnv, readStats, writeStats, readTokens, writeTokens, youtubeHandle, youtubeSubscribers,
  instagramFollowers, instagramRefresh, tiktokToken, tiktokFollowers,
} from './lib.mjs';

loadEnv();
const NETS = ['tiktok', 'instagram', 'youtube'];
const prev = readStats();
const next = { ...Object.fromEntries(NETS.map((n) => [n, prev[n] ?? null])), updated: prev.updated ?? null };
const failed = [];
let tokens = {};
let tokensChanged = false;

try {
  if (process.env.STATE_KEY) tokens = readTokens();
} catch (e) {
  failed.push('tokens');
  console.error(`No se pudieron abrir los tokens: ${e.message}`);
}

async function update(net, fetchCount) {
  try {
    const n = await fetchCount();
    if (n == null) return console.log(`${net}: sin conectar`);
    next[net] = n;
    console.log(`${net}: ${n}`);
  } catch (e) {
    failed.push(net);
    const why = e.message.replace(/\.+$/, '');
    console.error(`${net}: ERROR, ${why}. Se queda la última cifra (${prev[net] ?? 'ninguna'}).`);
  }
}

await update('youtube', async () => {
  const handle = youtubeHandle();
  if (!process.env.YT_API_KEY || !handle) return null;
  return youtubeSubscribers(handle);
});

await update('instagram', async () => {
  const ig = tokens.instagram;
  if (!ig?.token) return null;
  // The token lasts 60 days; renewing it every week keeps it alive for good.
  if (Date.now() - (ig.refreshedAt || 0) > 7 * 864e5) {
    try {
      const fresh = await instagramRefresh(ig.token);
      tokens.instagram = { ...ig, token: fresh.token, refreshedAt: Date.now(), expiresAt: fresh.expiresAt };
      tokensChanged = true;
    } catch (e) {
      failed.push('instagram (renovar token)');
      console.error(`instagram: no se pudo renovar el token, ${e.message}`);
    }
  }
  return (await instagramFollowers(tokens.instagram.token)).followers;
});

await update('tiktok', async () => {
  const tt = tokens.tiktok;
  if (!tt?.refreshToken || !process.env.TIKTOK_CLIENT_KEY) return null;
  const t = await tiktokToken({ grant_type: 'refresh_token', refresh_token: tt.refreshToken });
  if (t.refresh_token && t.refresh_token !== tt.refreshToken) {
    tokens.tiktok = { ...tt, refreshToken: t.refresh_token };
    tokensChanged = true;
  }
  return (await tiktokFollowers(t.access_token)).followers;
});

// Only rewrite stats.js when a number moved, so GitHub doesn't get an empty commit every 6 h.
if (NETS.some((n) => next[n] !== prev[n])) {
  next.updated = new Date().toISOString();
  writeStats(next);
  console.log('stats.js actualizado');
} else {
  console.log('Las cifras no han cambiado');
}
if (tokensChanged) {
  writeTokens(tokens);
  console.log('Tokens renovados');
}
if (failed.length) {
  console.error(`Fallo en: ${failed.join(', ')}`);
  process.exitCode = 1;
}
