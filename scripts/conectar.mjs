// Connects the accounts once, from the PC. Tokens are saved encrypted in datos/tokens.enc; the key
// that opens them (STATE_KEY) stays in .env and is copied to the GitHub secrets.
//   node scripts/conectar.mjs              → what's connected
//   node scripts/conectar.mjs youtube      → tests the API key and the channel
//   node scripts/conectar.mjs instagram    → asks for the token, checks it and saves it
//   node scripts/conectar.mjs tiktok       → prints the link to authorize; then run it again
//                                            with the address TikTok sends you to
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import {
  ENV_FILE, TOKENS_FILE, loadEnv, readTokens, writeTokens, youtubeHandle, youtubeSubscribers,
  instagramFollowers, tiktokAuthUrl, tiktokToken, tiktokFollowers,
} from './lib.mjs';

loadEnv();
const [cmd, arg] = process.argv.slice(2);
const env = process.env;

async function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return answer.trim();
}

// The first time, create the key that encrypts the tokens and keep it in .env.
function ensureKey() {
  if (env.STATE_KEY) return;
  env.STATE_KEY = randomBytes(32).toString('base64');
  const line = `STATE_KEY=${env.STATE_KEY}`;
  const old = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, 'utf8') : '';
  // Fill an empty "STATE_KEY=" line if there is one, so the file never ends up with two.
  const updated = /^STATE_KEY=\s*$/m.test(old)
    ? old.replace(/^STATE_KEY=\s*$/m, line)
    : old + (old && !old.endsWith('\n') ? '\n' : '') + line + '\n';
  writeFileSync(ENV_FILE, updated);
  console.log('Creada la clave STATE_KEY en .env. Cópiala a los secrets de GitHub (ver README).');
}

const fmt = (n) => n.toLocaleString('es-ES');
const day = (ms) => new Date(ms).toLocaleDateString('es-ES');

async function youtube() {
  const handle = youtubeHandle();
  if (!env.YT_API_KEY) throw new Error('falta YT_API_KEY en .env');
  if (!handle) throw new Error('pon tu canal en el botón de YouTube de index.html (youtube.com/@tucanal)');
  console.log(`YouTube ${handle}: ${fmt(await youtubeSubscribers(handle))} suscriptores`);
}

async function instagram() {
  ensureKey();
  const token = arg || await ask('Pega el token de Instagram: ');
  const me = await instagramFollowers(token);
  const tokens = readTokens();
  tokens.instagram = { token, refreshedAt: Date.now() };
  writeTokens(tokens);
  console.log(`Instagram @${me.username}: ${fmt(me.followers)} seguidores. Guardado.`);
}

async function tiktok() {
  for (const k of ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET', 'TIKTOK_REDIRECT_URI']) {
    if (!env[k]) throw new Error(`falta ${k} en .env (ver README)`);
  }
  if (!arg) {
    console.log('1. Abre este enlace, entra con tu cuenta de TikTok y acepta:\n');
    console.log(tiktokAuthUrl(randomBytes(8).toString('hex')));
    console.log('\n2. TikTok te lleva a tu web con ?code=... en la dirección. Copia la dirección entera y ejecuta:');
    console.log('   node scripts/conectar.mjs tiktok "LA-DIRECCIÓN"');
    return;
  }
  ensureKey();
  const code = arg.includes('code=') ? new URL(arg).searchParams.get('code') : arg;
  const t = await tiktokToken({ grant_type: 'authorization_code', code, redirect_uri: env.TIKTOK_REDIRECT_URI });
  const me = await tiktokFollowers(t.access_token);
  const tokens = readTokens();
  tokens.tiktok = { refreshToken: t.refresh_token, openId: t.open_id, connectedAt: Date.now() };
  writeTokens(tokens);
  console.log(`TikTok ${me.name}: ${fmt(me.followers)} seguidores. Guardado.`);
  console.log(`Hay que volver a conectar TikTok antes del ${day(Date.now() + t.refresh_expires_in * 1000)}.`);
}

function status() {
  let tokens = {};
  try {
    if (env.STATE_KEY) tokens = readTokens();
  } catch (e) {
    console.log(`No se pueden abrir los tokens (${e.message}).`);
  }
  const handle = youtubeHandle();
  console.log(`YouTube:   ${env.YT_API_KEY && handle ? `listo (${handle})` : !env.YT_API_KEY ? 'falta YT_API_KEY en .env' : 'falta tu canal en index.html'}`);
  console.log(`Instagram: ${tokens.instagram ? `conectado (token renovado el ${day(tokens.instagram.refreshedAt)})` : 'sin conectar → node scripts/conectar.mjs instagram'}`);
  console.log(`TikTok:    ${tokens.tiktok ? `conectado el ${day(tokens.tiktok.connectedAt)}` : 'sin conectar → node scripts/conectar.mjs tiktok'}`);
  if (existsSync(TOKENS_FILE)) console.log('\nRecuerda subir datos/tokens.enc a GitHub después de conectar.');
}

const commands = { youtube, instagram, tiktok };
try {
  if (commands[cmd]) await commands[cmd]();
  else status();
} catch (e) {
  console.error(`Error: ${e.message}`);
  process.exitCode = 1;
}
