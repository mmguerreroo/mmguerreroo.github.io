// ═══ EDITA AQUÍ TU EMAIL ═══
// Va partido en dos para que los robots que buscan emails en las webs no lo encuentren.
const CONTACTO = {
  usuario: 'mguem10',
  dominio: 'gmail.com',
  asunto: 'Hola Miguel',
};

const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const toastEl = document.querySelector('.toast');
let toastTimer;

function toast(text) {
  toastEl.textContent = text;
  toastEl.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 2200);
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Some in-app browsers block the clipboard API; fall back to a hidden textarea.
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

// Inside a frame (vista-movil.html) the networks refuse to load, so open them in a new tab.
if (window.top !== window.self) {
  document.querySelectorAll('a[href^="http"]').forEach((a) => {
    a.target = '_blank';
    a.rel = 'noopener';
  });
}

// ───── Counters: 12400 → "12,4 mil", counting up on load ─────
// The only source is stats.js, which GitHub refreshes every 6 h from each network. A network with
// no count yet shows no number, so the page never shows a figure someone has to keep up by hand.
const compact = new Intl.NumberFormat('es-ES', { notation: 'compact', maximumFractionDigits: 1 });
const live = window.STATS || {};

document.querySelectorAll('.count').forEach((el, i) => {
  const target = live[el.closest('.card').dataset.net];
  if (typeof target !== 'number') return;
  el.closest('.stat').hidden = false;
  el.textContent = compact.format(target);
  if (calm || !target) return;
  // Hold the final width so the card doesn't shift while the digits change.
  el.style.minWidth = el.offsetWidth + 'px';
  const start = performance.now() + 450 + i * 70;
  const dur = 1100;
  const tick = (now) => {
    const t = Math.min(1, Math.max(0, (now - start) / dur));
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = compact.format(Math.round(target * eased));
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});

// ───── Cards: the colour floods out from where the finger or cursor comes in ─────
const cards = [...document.querySelectorAll('.card')];

function aim(card, x, y) {
  const r = card.getBoundingClientRect();
  const px = x - r.left;
  const py = y - r.top;
  // Diameter that reaches the farthest corner from the touch point.
  const d = 2 * Math.hypot(Math.max(px, r.width - px), Math.max(py, r.height - py));
  card.style.setProperty('--x', px + 'px');
  card.style.setProperty('--y', py + 'px');
  card.style.setProperty('--d', d + 'px');
}

cards.forEach((card) => {
  card.addEventListener('pointerenter', (e) => {
    if (e.pointerType !== 'mouse') return;
    aim(card, e.clientX, e.clientY);
    card.classList.add('is-on');
  });
  card.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') card.classList.remove('is-on');
  });
  card.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    aim(card, e.clientX, e.clientY);
    card.classList.add('is-on');
  });
  // A finger that scrolls instead of tapping turns the card back off.
  card.addEventListener('pointercancel', () => card.classList.remove('is-on'));
  card.addEventListener('pointerup', (e) => {
    if (e.pointerType !== 'mouse') setTimeout(() => card.classList.remove('is-on'), 600);
  });
  card.addEventListener('focus', () => {
    if (!card.matches(':focus-visible')) return;
    const r = card.getBoundingClientRect();
    aim(card, r.left + 34, r.top + r.height / 2);
    card.classList.add('is-on');
  });
  card.addEventListener('blur', () => card.classList.remove('is-on'));
});

// Coming back with the back button restores the page from cache with the card still lit.
addEventListener('pageshow', () => cards.forEach((c) => c.classList.remove('is-on')));

// On load each card lights up once, in turn, so phones (no hover) see the colours too.
if (!calm) {
  cards.forEach((card, i) => {
    setTimeout(() => {
      if (card.classList.contains('is-on')) return;
      const r = card.getBoundingClientRect();
      aim(card, r.left + 34, r.top + r.height / 2);
      card.classList.add('is-on', 'is-intro');
      setTimeout(() => card.classList.contains('is-intro') && card.classList.remove('is-on', 'is-intro'), 520);
    }, 900 + i * 160);
  });
  cards.forEach((c) => c.addEventListener('pointerdown', () => c.classList.remove('is-intro'), { capture: true }));
}

// ───── Contact: straight to a Gmail draft addressed to me ─────
const email = `${CONTACTO.usuario}@${CONTACTO.dominio}`;
const to = encodeURIComponent(email);
const subject = encodeURIComponent(CONTACTO.asunto);
const gmailWeb = `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${subject}`;
const mailto = `mailto:${email}?subject=${subject}`;
const ua = navigator.userAgent;
const isPhone = /iPhone|iPad|iPod|Android/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);

// On a computer: Gmail on the web, in a new tab.
// On a phone: a plain mailto: link, which opens the phone's mail app (Gmail on Android, and on an
// iPhone whatever is set as the default mail app). A tap on a real link is the only way to another
// app that in-app browsers like Instagram's and TikTok's reliably allow; jumping to an app from
// script (googlegmail://), or after a delay, gets blocked there and nothing opens.
const contact = document.querySelector('[data-contact]');
contact.href = isPhone ? mailto : gmailWeb;
if (isPhone) contact.removeAttribute('target');

// ───── Share ─────
document.querySelector('[data-share]').addEventListener('click', async () => {
  const data = { title: document.title, url: location.href };
  if (navigator.share) {
    try { await navigator.share(data); } catch { /* closed the share menu */ }
    return;
  }
  toast((await copy(location.href)) ? 'Enlace copiado' : 'No se pudo copiar');
});
