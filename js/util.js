export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const STORE = {
  name: 'Liliana Quiroga Store',
  address: 'Cl. 54 #7B-55, Rincón de Piedra Pintada, Ibagué, Tolima',
  phone: '320 560 5644',
  whatsapp: '573205605644',
};
export const LINKS = {
  whatsapp: `https://wa.me/${STORE.whatsapp}`,
  instagram: 'https://www.instagram.com/lqstore26',
  facebook: 'https://www.facebook.com/share/1FUBMbLKKj/',
  maps: 'https://maps.app.goo.gl/mFwqeGpskEbdD5488',
};
export const wa = (text, phone = STORE.whatsapp) => `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;

// Íconos propios, trazo 1.5 sobre 24 px.
const P = {
  whatsapp: '<path d="M12 3.4a8.6 8.6 0 0 0-7.4 12.9L3.4 20.6l4.4-1.2A8.6 8.6 0 1 0 12 3.4Z"/><path d="M9 8.7c.2-.4.5-.4.8-.4h.4c.2 0 .4.1.5.3l.7 1.6c.1.2 0 .4-.1.6l-.5.6a6.4 6.4 0 0 0 2.8 2.7l.6-.6c.2-.2.4-.2.6-.1l1.6.7c.2.1.4.3.4.5v.5c0 .3-.2.6-.4.8-.5.4-1.2.6-1.9.4A8 8 0 0 1 8.7 11c-.2-.7 0-1.6.3-2.3Z"/>',
  instagram: '<rect x="3.6" y="3.6" width="16.8" height="16.8" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r=".6" fill="currentColor"/>',
  facebook: '<path d="M14.5 8.2h2V4.8h-2.6c-2.4 0-3.6 1.5-3.6 3.9v2H8v3.3h2.3v7.2h3.3V14h2.5l.5-3.3h-3V9.1c0-.6.3-.9.9-.9Z"/>',
  maps: '<path d="M12 21s6.5-5.8 6.5-11.2a6.5 6.5 0 0 0-13 0C5.5 15.2 12 21 12 21Z"/><circle cx="12" cy="9.8" r="2.3"/>',
  star: '<path d="m12 3.6 2.5 5.3 5.8.7-4.3 4 1.1 5.7L12 16.5l-5.1 2.8L8 13.6l-4.3-4 5.8-.7L12 3.6Z"/>',
  bag: '<path d="M5.5 8.5h13l-1 11.5h-11l-1-11.5Z"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  gift: '<rect x="3.8" y="8.5" width="16.4" height="4" rx="1"/><path d="M5.3 12.5V20h13.4v-7.5M12 8.5V20M12 8.5S10.9 4 8.6 4.4C6.4 4.8 7 8.5 12 8.5Zm0 0s1.1-4.5 3.4-4.1c2.2.4 1.6 4.1-3.4 4.1Z"/>',
  store: '<path d="M4 9.5 5.5 4h13L20 9.5M4 9.5h16M4 9.5c0 1.5 1.2 2.5 2.7 2.5S9.3 11 9.3 9.5c0 1.5 1.2 2.5 2.7 2.5s2.7-1 2.7-2.5c0 1.5 1.1 2.5 2.6 2.5S20 11 20 9.5M5.5 12v8h13v-8M10 20v-4.5h4V20"/>',
  bike: '<circle cx="6" cy="16.5" r="3"/><circle cx="18" cy="16.5" r="3"/><path d="M6 16.5 9.5 9h5l3.5 7.5M9.5 9 8 6H6M14.5 9l-2 7.5"/>',
  truck: '<path d="M3 6.5h11v9H3zM14 9.5h3.8l3.2 3.4v2.6h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17.5" cy="17.5" r="1.8"/>',
  camera: '<path d="M4 8.5h3l1.5-2.5h7L17 8.5h3V19H4z"/><circle cx="12" cy="13.3" r="3.4"/>',
  search: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/>',
  tag: '<path d="M3.5 12.2V4.5h7.7l9.3 9.3-7.7 7.7-9.3-9.3Z"/><circle cx="8" cy="9" r="1.4"/>',
  print: '<path d="M7 9V4h10v5M7 17H4.5V9.5h15V17H17M7 14h10v6H7z"/>',
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="m4 7 8 6 8-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/>',
  trash: '<path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  box: '<path d="M3.5 7.5 12 3.5l8.5 4v9L12 20.5l-8.5-4v-9Z"/><path d="m3.5 7.5 8.5 4 8.5-4M12 11.5v9"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  percent: '<path d="M6 18 18 6"/><circle cx="7.5" cy="7.5" r="2.3"/><circle cx="16.5" cy="16.5" r="2.3"/>',
  users: '<circle cx="9" cy="8.5" r="3.3"/><path d="M3 19.5c.6-3.4 3-5.3 6-5.3s5.4 1.9 6 5.3M15.5 5.5a3.2 3.2 0 0 1 0 6.2M17.5 14.6c1.8.6 3 2.3 3.5 4.9"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M5.6 18.4l1.6-1.6M16.8 7.2l1.6-1.6"/>',
  receipt: '<path d="M6 3.5h12v17l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4z"/><path d="M9 8h6M9 11.5h6M9 15h4"/>',
};
export const icon = (name, cls = 'ico') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[name]}</svg>`;
export const X = icon('close');

export const socialButtons = (extra = '') => `<ul class="socials ${extra}">
  <li><a class="soc" href="${LINKS.whatsapp}" target="_blank" rel="noopener" aria-label="WhatsApp">${icon('whatsapp')}<span class="tip">WhatsApp</span></a></li>
  <li><a class="soc" href="${LINKS.instagram}" target="_blank" rel="noopener" aria-label="Instagram">${icon('instagram')}<span class="tip">Instagram</span></a></li>
  <li><a class="soc" href="${LINKS.facebook}" target="_blank" rel="noopener" aria-label="Facebook">${icon('facebook')}<span class="tip">Facebook</span></a></li>
  <li><a class="soc" href="${LINKS.maps}" target="_blank" rel="noopener" aria-label="Google Maps">${icon('maps')}<span class="tip">Cómo llegar</span></a></li>
</ul>`;

let toastTimer;
export function toast(msg, kind = 'ok') {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); }
  t.textContent = msg; t.dataset.kind = kind; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3400);
}

export function download(name, text, type = 'text/csv;charset=utf-8') {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Reduce una foto a 1000 px (webp, conserva transparencia) para que quepa en el almacenamiento del navegador.
export function shrinkImage(file, max = 1000) {
  return new Promise((ok, fail) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * k), height: Math.round(img.height * k) });
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      ok(c.toDataURL('image/webp', 0.82)); URL.revokeObjectURL(img.src);
    };
    img.onerror = fail;
    img.src = URL.createObjectURL(file);
  });
}

// Los números corren hasta el nuevo valor (marcador del pedido, indicadores).
export function tick(el, to, fmt = String, ms = 650) {
  if (!el) return;
  const from = +el.dataset.v || 0;
  el.dataset.v = to;
  if (from === to || matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = fmt(to); return; }
  const t0 = performance.now();
  const step = t => { const k = Math.min(1, (t - t0) / ms); el.textContent = fmt(Math.round(from + (to - from) * (1 - (1 - k) ** 3))); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
