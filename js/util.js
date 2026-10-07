export const $ = (s, el = document) => el.querySelector(s);
export const X = '<svg class="ico-x" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const WHATSAPP = '573205605644';
export const LINKS = {
  whatsapp: `https://wa.me/${WHATSAPP}`,
  instagram: 'https://www.instagram.com/lqstore26',
  facebook: 'https://www.facebook.com/share/1FUBMbLKKj/',
  maps: 'https://maps.app.goo.gl/mFwqeGpskEbdD5488',
};
export const wa = text => `${LINKS.whatsapp}?text=${encodeURIComponent(text)}`;

let toastTimer;
export function toast(msg, kind = 'ok') {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); }
  t.textContent = msg; t.dataset.kind = kind; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

export function download(name, text, type = 'text/csv;charset=utf-8') {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Reduce una foto a 900 px (webp) para que quepa en el almacenamiento del navegador.
export function shrinkImage(file, max = 900) {
  return new Promise((ok, fail) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * k), height: Math.round(img.height * k) });
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      ok(c.toDataURL('image/webp', 0.8)); URL.revokeObjectURL(img.src);
    };
    img.onerror = fail;
    img.src = URL.createObjectURL(file);
  });
}
