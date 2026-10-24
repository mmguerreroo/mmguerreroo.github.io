// Shared by actualizar-seguidores.mjs and conectar.mjs: paths, .env, the encrypted token store,
// stats.js and one function per network API. Node 22+, no dependencies.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const ENV_FILE = join(ROOT, '.env');
export const STATS_FILE = join(ROOT, 'stats.js');
export const TOKENS_FILE = join(ROOT, 'datos', 'tokens.enc');
const IG_API = 'https://graph.instagram.com/v26.0';
const TT_API = 'https://open.tiktokapis.com/v2';

// Locally the secrets live in .env; on GitHub they come from the repository secrets.
export function loadEnv() {
  if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);
}

// ───── Token store: AES-256-GCM, so it can sit in a public repo ─────
// Instagram and TikTok hand out new tokens when they're renewed, and a GitHub Action can't
// rewrite its own secrets, so the tokens live in this file and only the key is a secret.
function stateKey() {
  const key = Buffer.from(process.env.STATE_KEY || '', 'base64');
  if (key.length !== 32) throw new Error('falta STATE_KEY o no es válida');
  return key;
}

export function readTokens() {
  if (!existsSync(TOKENS_FILE)) return {};
  const { iv, tag, data } = JSON.parse(readFileSync(TOKENS_FILE, 'utf8'));
  const decipher = createDecipheriv('aes-256-gcm', stateKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  try {
    const plain = Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]);
    return JSON.parse(plain.toString('utf8'));
  } catch {
    throw new Error('STATE_KEY no abre datos/tokens.enc: no es la misma clave con la que se guardaron');
  }
}

export function writeTokens(tokens) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', stateKey(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(tokens), 'utf8'), cipher.final()]);
  mkdirSync(dirname(TOKENS_FILE), { recursive: true });
  const box = { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') };
  writeFileSync(TOKENS_FILE, JSON.stringify(box, null, 2) + '\n');
}

// ───── stats.js: a script, not JSON, so the page can read it even opened from disk ─────
export function readStats() {
  try {
    const src = readFileSync(STATS_FILE, 'utf8');
    return JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));
  } catch {
    return {};
  }
}

export function writeStats(stats) {
  writeFileSync(STATS_FILE,
    '// Lo escribe scripts/actualizar-seguidores.mjs (GitHub, cada 6 h). No lo edites a mano.\n' +
    `window.STATS = ${JSON.stringify(stats, null, 2)};\n`);
}

// The YouTube handle comes from the YouTube button in index.html, so it's written in one place.
export function youtubeHandle() {
  if (process.env.YT_HANDLE) return '@' + process.env.YT_HANDLE.replace(/^@/, '');
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const m = html.match(/class="card" data-net="youtube" href="https:\/\/www\.youtube\.com\/(@[\w.-]+)"/);
  return m && m[1] !== '@tuusuario' ? m[1] : null;
}

async function getJson(url, init = {}) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(20000) });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, body };
}

// ───── YouTube Data API v3 (API key; YouTube rounds the count to 3 significant figures) ─────
export async function youtubeSubscribers(handle) {
  const url = 'https://www.googleapis.com/youtube/v3/channels?part=statistics' +
    `&forHandle=${encodeURIComponent(handle)}&key=${encodeURIComponent(process.env.YT_API_KEY)}`;
  const { ok, body } = await getJson(url);
  if (!ok) throw new Error(body.error?.message || 'la API de YouTube no respondió');
  const channel = body.items?.[0];
  if (!channel) throw new Error(`no existe el canal ${handle}`);
  if (channel.statistics.hiddenSubscriberCount) throw new Error('el canal tiene los suscriptores ocultos');
  return Number(channel.statistics.subscriberCount);
}

// ───── Instagram API with Instagram Login (professional account, long-lived token) ─────
export async function instagramFollowers(token) {
  const { ok, body } = await getJson(`${IG_API}/me?fields=username,followers_count&access_token=${encodeURIComponent(token)}`);
  if (!ok) throw new Error(body.error?.message || 'la API de Instagram no respondió');
  return { username: body.username, followers: Number(body.followers_count) };
}

// Gives 60 more days; the token must be at least 24 h old.
export async function instagramRefresh(token) {
  const { ok, body } = await getJson(
    `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`);
  if (!ok) throw new Error(body.error?.message || 'no se pudo renovar el token');
  return { token: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
}

// ───── TikTok Login Kit + Display API (scopes user.info.basic and user.info.stats) ─────
export function tiktokAuthUrl(state) {
  const q = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY,
    scope: 'user.info.basic,user.info.stats',
    response_type: 'code',
    redirect_uri: process.env.TIKTOK_REDIRECT_URI,
    state,
  });
  return `https://www.tiktok.com/v2/auth/authorize/?${q}`;
}

// Access tokens last 24 h; the refresh token lasts 365 days and may change on every refresh.
export async function tiktokToken(params) {
  const { ok, body } = await getJson(`${TT_API}/oauth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY,
      client_secret: process.env.TIKTOK_CLIENT_SECRET,
      ...params,
    }),
  });
  if (!ok || body.error) throw new Error(body.error_description || body.error || 'TikTok no respondió');
  return body;
}

export async function tiktokFollowers(accessToken) {
  const { ok, body } = await getJson(`${TT_API}/user/info/?fields=open_id,display_name,follower_count`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!ok || (body.error && body.error.code !== 'ok')) throw new Error(body.error?.message || 'TikTok no respondió');
  return { name: body.data.user.display_name, followers: Number(body.data.user.follower_count) };
}
