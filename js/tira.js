// Comprobante en tira de 80 mm: vista previa, PDF (jsPDF) y enlace que abre el cliente (recibo.html).
// ponytail: la venta viaja dentro del enlace, igual que la carta de pedido; no hay servidor que guarde PDFs.
import { money } from './data.js';
import { STORE, LINKS, esc } from './util.js';
import { encode } from './order.js';

export const no4 = s => String(s.no).padStart(4, '0');
const when = t => new Date(t).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

const pack = s => ({ v: 1, n: s.no, t: s.at, c: s.customer?.name || '', m: s.method, T: s.total,
  i: s.items.map(i => [i.code, i.size, i.qty, i.price, i.list, i.name, i.brand, i.color]) });
export const unpack = o => ({ no: o.n, at: o.t, customer: { name: o.c }, method: o.m, total: o.T,
  items: o.i.map(([code, size, qty, price, list, name, brand, color]) => ({ code, size, qty, price, list, name, brand, color })) });
export const reciboURL = s => new URL('recibo.html', location.href).href.split('#')[0] + '#' + encode(pack(s));

export function tiraHTML(s) {
  const c = s.customer || {};
  return `<img class="rc-logo" src="assets/brand/lq-medallon.svg" alt="" width="72" height="72">
    <p class="rc-name">Liliana Quiroga</p><p class="rc-kind">Store · Boutique multimarca</p>
    <p class="rc-addr">Cl. 54 #7B-55 · Rincón de Piedra Pintada<br>Ibagué, Tolima · WhatsApp ${STORE.phone}</p>
    <dl class="rc-meta"><div><dt>Comprobante</dt><dd>N.º ${no4(s)}</dd></div><div><dt>Fecha</dt><dd>${when(s.at)}</dd></div>
      ${c.name ? `<div><dt>Cliente</dt><dd>${esc(c.name)}</dd></div>` : ''}<div><dt>Pago</dt><dd>${esc(s.method)}</dd></div></dl>
    <ol class="rc-items">${s.items.map(i => `<li><span><b>${esc(i.brand)} ${esc(i.name)}</b><small>${esc(i.color)} · Talla ${esc(i.size)} · ${esc(i.code)}${i.qty > 1 ? ` · ${i.qty} × ${money(i.price)}` : ''}</small></span>
      <span class="rc-amt">${money(i.price * i.qty)}${i.price < i.list ? `<s>${money(i.list * i.qty)}</s>` : ''}</span></li>`).join('')}</ol>
    <p class="rc-total"><span>Total</span><b>${money(s.total)}</b></p>
    <p class="rc-thanks">Gracias por elegirnos.</p>
    <p class="rc-social">Califícanos en Google · Instagram @lqstore26</p>
    <p class="rc-legal">Este comprobante no reemplaza la factura electrónica.</p>`;
}

export function tiraText(s) {
  const first = (s.customer?.name || '').trim().split(/\s+/)[0];
  return [`Hola${first ? ' ' + first : ''}, gracias por tu compra en *${STORE.name}*.`, '',
    `*Comprobante N.º ${no4(s)}* · ${when(s.at)}`,
    ...s.items.map(i => `• ${i.qty > 1 ? i.qty + ' × ' : ''}${i.brand} ${i.name} · ${i.color} · Talla ${i.size} · ${money(i.price * i.qty)}`),
    `*Total: ${money(s.total)}* · ${s.method}`, '',
    'Tu comprobante en PDF:', reciboURL(s), '',
    `Califícanos en Google: ${LINKS.maps}`, `Instagram: ${LINKS.instagram}`].join('\n');
}

// ---------- PDF ----------
let lib;
const loadPDF = () => lib ||= new Promise((ok, ko) => document.head.append(Object.assign(document.createElement('script'), {
  src: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  onload: () => ok(window.jspdf.jsPDF), onerror: () => { lib = null; ko(new Error('Sin conexión para crear el PDF')); },
})));
const raster = src => new Promise(ok => {
  const img = new Image();
  img.onload = () => {
    const c = Object.assign(document.createElement('canvas'), { width: 360, height: 360 }), x = c.getContext('2d');
    x.fillStyle = '#FFFDF8'; x.fillRect(0, 0, 360, 360); x.drawImage(img, 0, 0, 360, 360); ok(c.toDataURL('image/jpeg', .9));
  };
  img.onerror = () => ok(null);
  img.src = 'assets/brand/lq-medallon.svg';
});
// Las fuentes estándar del PDF solo traen Latin-1.
const t = v => String(v ?? '').replace(/[  ]/g, ' ').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/[^\x00-\xFF]/g, '');
const INK = [19, 36, 27], MUTED = [95, 111, 101], BRASS = [200, 163, 90], BRASS_LO = [125, 98, 48], LINE = [232, 224, 207];

export async function tiraPDF(s) {
  const [jsPDF, logo] = await Promise.all([loadPDF(), raster()]);
  const W = 80, L = 7, R = W - 7, c = s.customer || {};
  const draw = (doc, H) => {
    let y;
    const font = (f, st, size, col = INK) => { doc.setFont(f, st); doc.setFontSize(size); doc.setTextColor(...col); };
    const center = (str, cs = 0) => { str = t(str); doc.text(str, (W - doc.getTextWidth(str) - cs * (str.length - 1)) / 2, y, { charSpace: cs }); };
    const rule = (col = BRASS, w = .25) => { doc.setDrawColor(...col); doc.setLineWidth(w); doc.line(L, y, R, y); };
    const pair = (label, value, x, w) => {
      font('helvetica', 'normal', 5.2, MUTED); doc.text(label.toUpperCase(), x, y, { charSpace: .35 });
      font('helvetica', 'normal', 7.6); doc.text(doc.splitTextToSize(t(value), w)[0], x, y + 3.6);
    };
    doc.setFillColor(255, 253, 248); doc.rect(0, 0, W, H, 'F');
    doc.setFillColor(...BRASS); doc.rect(0, 0, W, 1.4, 'F'); doc.rect(0, H - 1.4, W, 1.4, 'F');
    y = 7; if (logo) doc.addImage(logo, 'JPEG', W / 2 - 10, y, 20, 20); y += 27;
    font('times', 'normal', 16); center('Liliana Quiroga'); y += 4.4;
    font('helvetica', 'normal', 5.6, BRASS_LO); center('STORE · BOUTIQUE MULTIMARCA', .55); y += 5;
    font('helvetica', 'normal', 6.4, MUTED); center('Cl. 54 #7B-55 · Rincón de Piedra Pintada'); y += 3.2;
    center(`Ibagué, Tolima · WhatsApp ${STORE.phone}`); y += 4.6;
    rule(); y += 5;
    const half = (R - L) / 2 - 2;
    pair('Comprobante', 'N.º ' + no4(s), L, half); pair('Fecha', when(s.at), W / 2 + 1, half); y += 9;
    if (c.name) { pair('Cliente', c.name, L, half); pair('Pago', s.method, W / 2 + 1, half); } else pair('Pago', s.method, L, half);
    y += 7.5; rule(LINE); y += 5;
    for (const i of s.items) {
      const amt = money(i.price * i.qty);
      font('helvetica', 'bold', 7.8);
      const name = doc.splitTextToSize(t(`${i.brand} ${i.name}`), R - L - doc.getTextWidth(amt) - 4);
      doc.text(name, L, y); doc.text(amt, R, y, { align: 'right' });
      y += name.length * 3.2;
      font('helvetica', 'normal', 6.4, MUTED);
      const sub = doc.splitTextToSize(t(`${i.color} · Talla ${i.size} · ${i.code}${i.qty > 1 ? ` · ${i.qty} × ${money(i.price)}` : ''}`), R - L - 22);
      doc.text(sub, L, y);
      if (i.price < i.list) {
        const was = money(i.list * i.qty), w = doc.getTextWidth(was);
        doc.text(was, R, y, { align: 'right' }); doc.setDrawColor(...MUTED); doc.setLineWidth(.15); doc.line(R - w, y - .9, R, y - .9);
      }
      y += sub.length * 2.8 + 3;
    }
    y -= 1; rule(INK, .35); y += 7;
    font('helvetica', 'normal', 6, INK); doc.text('TOTAL', L, y, { charSpace: .5 });
    font('times', 'normal', 17); doc.text(money(s.total), R, y + .5, { align: 'right' }); y += 10;
    font('times', 'italic', 12.5); center('Gracias por elegirnos.'); y += 6;
    if (window.qrcode) {
      const q = qrcode(0, 'M'); q.addData(LINKS.maps); q.make();
      const n = q.getModuleCount(), size = 17, cell = size / n, x0 = (W - size) / 2;
      doc.setFillColor(...INK);
      for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) doc.rect(x0 + k * cell, y + r * cell, cell + .02, cell + .02, 'F');
      doc.link(x0, y, size, size, { url: LINKS.maps });
      y += size + 3.6;
      font('helvetica', 'normal', 5.4, MUTED); center('CALIFÍCANOS EN GOOGLE', .35); y += 5.6;
    }
    font('helvetica', 'normal', 6.6, INK);
    for (const [label, url] of [['Instagram @lqstore26', LINKS.instagram], ['Facebook · Liliana Quiroga Store', LINKS.facebook], ['Ver la colección en línea', new URL('./', location.href).href]]) {
      doc.textWithLink(label, (W - doc.getTextWidth(label)) / 2, y, { url }); y += 3.6;
    }
    y += 1.6; font('helvetica', 'normal', 5.2, MUTED); center('Este comprobante no reemplaza la factura electrónica.');
    return y + 6;
  };
  const h = draw(new jsPDF({ unit: 'mm', format: [W, 600], compress: true }), 600);
  const doc = new jsPDF({ unit: 'mm', format: [W, h], compress: true });
  doc.setProperties({ title: `Comprobante ${no4(s)} · ${STORE.name}` });
  draw(doc, h);
  return new File([doc.output('blob')], `Comprobante-LQ-${no4(s)}.pdf`, { type: 'application/pdf' });
}
