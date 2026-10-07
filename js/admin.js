import * as db from './data.js';
import { CATEGORIES, SIZE_ORDER, METHODS, CHANNELS, money, priceOf, activeDiscount, colorHex, dayKey } from './data.js';
import { garmentSVG } from './garments.js';
import { $, $$, esc, toast, download, shrinkImage, icon, X, LINKS, STORE, wa, tick } from './util.js';

// Ejecuta un cambio y, si la base lo rechaza, muestra el motivo.
const act = async (fn, ok) => { try { await fn(); if (ok) toast(ok); return true; } catch (e) { toast(e.message, 'err'); return false; } };
import { barChart, hBars } from './charts.js';

// ---------- acceso ----------
// ponytail: PIN validado en el navegador, solo para la vista previa. Con backend real se reemplaza por login del servidor.
const sha = async t => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('lq:' + t)))].map(b => b.toString(16).padStart(2, '0')).join('');
const SESSION = 'lq.admin.ok';

async function gate() {
  if (db.isRemote()) return gateRemote();
  const hasPin = !!db.load().settings.pinHash;
  $('#gate-title').textContent = hasPin ? 'Ingresa tu PIN' : 'Crea el PIN del panel';
  $('#gate-hint').textContent = hasPin ? 'Acceso solo para los dueños de la boutique.' : 'Elige 4 a 8 números. Lo pedirá cada vez que abras el panel.';
  if (hasPin && sessionStorage.getItem(SESSION) === db.load().settings.pinHash) return open();
  $('#gate').hidden = false;
  $('#gate').onsubmit = async e => {
    e.preventDefault();
    const pin = $('#pin').value.trim();
    if (!/^\d{4,8}$/.test(pin)) return toast('El PIN debe tener de 4 a 8 números', 'err');
    const h = await sha(pin);
    if (!hasPin) db.setSettings({ pinHash: h });
    else if (h !== db.load().settings.pinHash) { $('#pin').value = ''; return toast('PIN incorrecto', 'err'); }
    sessionStorage.setItem(SESSION, h);
    open();
  };
  $('#pin').focus();
}

// Base compartida: correo y contraseña de administrador (Supabase Auth). La sesión queda guardada en el equipo.
async function gateRemote() {
  const g = $('#gate');
  g.classList.add('remote');
  $('#gate-title').textContent = 'Panel de la boutique';
  $('#gate-hint').textContent = 'Entra con tu correo y contraseña de administrador.';
  $('#gate-note').textContent = 'Los datos se guardan en la base compartida: todos los equipos ven lo mismo al instante.';
  $('#email').hidden = false;
  Object.assign($('#pin'), { placeholder: 'Contraseña', inputMode: 'text' });
  $('#pin').removeAttribute('maxlength');
  try {
    await db.init({ admin: true });
    if (await db.session() && await db.isAdmin()) return open();
  } catch (e) { toast(e.message, 'err'); }
  g.hidden = false;
  g.onsubmit = async e => {
    e.preventDefault();
    const btn = g.querySelector('button'); btn.disabled = true;
    try { await db.signIn($('#email').value.trim(), $('#pin').value); open(); }
    catch (err) { toast(err.message, 'err'); $('#pin').value = ''; }
    finally { btn.disabled = false; }
  };
  $('#email').focus();
}

const VIEWS = {
  vender: ['Vender', 'bag', viewSell], hoy: ['Hoy', 'sun', viewToday], inventario: ['Inventario', 'box', viewInventory],
  descuentos: ['Descuentos', 'percent', viewDiscounts], finanzas: ['Finanzas', 'chart', viewFinance], redes: ['Redes', 'users', viewSocial],
  etiquetas: ['Etiquetas', 'tag', viewLabels], ajustes: ['Ajustes', 'gear', viewSettings],
};
let current = 'vender';

function open() {
  $('#gate').hidden = true;
  $('#app').hidden = false;
  $('#nav').innerHTML = Object.entries(VIEWS).map(([k, [name, ico]]) => `<a href="#${k}">${icon(ico)}<span>${name}</span></a>`).join('');
  route();
  addEventListener('hashchange', route);
  db.onChange(() => render(current));
}

function route() {
  current = location.hash.slice(1) in VIEWS ? location.hash.slice(1) : 'vender';
  $$('#nav a').forEach(a => a.setAttribute('aria-current', a.hash === '#' + current ? 'page' : 'false'));
  render(current, true);
  scrollTo(0, 0);
}

function render(view, first = false) {
  const main = $('#view');
  // Mientras se escribe en Vender no se redibuja: se perdería lo escrito.
  if (!first && view === 'vender' && main.contains(document.activeElement) && document.activeElement.matches('input')) return refreshTicket();
  VIEWS[view][2](main);
}

// Imagen pequeña de la referencia: foto en gancho o ilustración.
const thumb = p => p.img ? `<img src="${p.img}" alt="">` : garmentSVG(p);
const head = (title, side = '') => `<header class="view-head"><h1>${title}</h1>${side}</header>`;
const empty = (text, cta = '') => `<div class="empty-state"><img src="assets/brand/cocodrilo.svg" alt="" width="180" height="67"><p>${text}</p>${cta}</div>`;
const dateLabel = t => new Date(t).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });

// ==================== VENDER ====================
let ticket = [];
let sellFilter = { q: '', cat: '', brand: '' };
let sale = { method: 'Efectivo', channel: 'Tienda', name: '', phone: '', email: '' };

function viewSell(main) {
  const ps = db.products();
  const q = sellFilter.q.toLowerCase();
  const list = ps.filter(p => (!sellFilter.cat || p.cat === sellFilter.cat) && (!sellFilter.brand || p.brand === sellFilter.brand)
    && (!q || `${p.code} ${p.name} ${p.color} ${p.brand}`.toLowerCase().includes(q)));
  const canScan = 'BarcodeDetector' in window && navigator.mediaDevices?.getUserMedia;
  main.innerHTML = head('Vender', `<p class="head-note">Toca la prenda y luego la talla. El stock de la tienda en línea se actualiza al instante.</p>`) + `
  <div class="sell">
    <section class="picker">
      <div class="picker-bar">
        <label class="search">${icon('search')}<span class="sr-only">Buscar prenda</span><input id="sell-q" type="search" placeholder="Código, prenda, color o marca" value="${esc(sellFilter.q)}" autocomplete="off"></label>
        ${canScan ? `<button class="btn btn-sm" id="scan-btn">${icon('camera')}Escanear</button>` : ''}
      </div>
      <div class="chip-row">${[['', 'Todo'], ...Object.entries(CATEGORIES).filter(([k]) => ps.some(p => p.cat === k)).map(([k, c]) => [k, c.name])]
        .map(([k, n]) => `<button class="chip" data-scat="${k}" aria-pressed="${sellFilter.cat === k}">${n}</button>`).join('')}
        ${db.brands().map(b => `<button class="chip" data-sbrand="${esc(b)}" aria-pressed="${sellFilter.brand === b}">${esc(b)}</button>`).join('')}</div>
      <div class="tiles">${list.map(p => {
        const n = db.totalStock(p);
        return `<button class="tile ${n ? '' : 'is-out'}" data-pick="${p.code}">
          <span class="tile-art">${thumb(p)}</span><span class="plaque">${p.code}</span>
          <b>${esc(p.name)}</b><small>${esc(p.brand)} · ${esc(p.color)}</small>
          <span class="tile-foot"><span>${money(priceOf(p))}</span><em>${n ? n + ' und.' : 'Agotado'}</em></span></button>`;
      }).join('') || '<p class="empty">No hay prendas con ese filtro.</p>'}</div>
    </section>
    <aside class="ticket-panel" id="ticket-panel">
      <div class="ticket-head"><h2>Venta actual</h2><button class="link" id="clear-ticket" ${ticket.length ? '' : 'hidden'}>Vaciar</button></div>
      <ol class="ticket" id="ticket"></ol>
      <div class="pay">
        <fieldset><legend>Medio de pago</legend><div class="chip-row">${METHODS.map(m => `<button type="button" class="chip" data-pay="${m}" aria-pressed="${m === sale.method}">${m}</button>`).join('')}</div></fieldset>
        <fieldset><legend>Dónde se vendió</legend><div class="chip-row">${CHANNELS.map(m => `<button type="button" class="chip" data-ch="${m}" aria-pressed="${m === sale.channel}">${m}</button>`).join('')}</div></fieldset>
        <details class="customer"><summary>Datos del cliente para el comprobante (opcional)</summary>
          <div class="form-grid one"><label>Nombre<input id="c-name" value="${esc(sale.name)}" autocomplete="off"></label>
          <label>WhatsApp<input id="c-phone" inputmode="tel" value="${esc(sale.phone)}" placeholder="300 123 4567"></label>
          <label>Correo<input id="c-email" type="email" value="${esc(sale.email)}" placeholder="cliente@correo.com"></label></div></details>
      </div>
      <button class="btn btn-brass btn-block charge" id="charge" disabled>Cobrar</button>
    </aside>
  </div>`;

  $('#sell-q').oninput = e => { sellFilter.q = e.target.value; viewSell(main); const i = $('#sell-q'); i.focus(); i.setSelectionRange(99, 99); };
  $('#sell-q').onkeydown = e => { // un código completo (A001-M) agrega directo
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const c = db.parseCode(e.target.value);
    if (c && db.find(c.code)) { c.size ? addToTicket(c.code, c.size) : pickSize(c.code); sellFilter.q = ''; viewSell(main); }
  };
  $$('[data-scat]').forEach(b => b.onclick = () => { sellFilter.cat = b.dataset.scat; viewSell(main); });
  $$('[data-sbrand]').forEach(b => b.onclick = () => { sellFilter.brand = sellFilter.brand === b.dataset.sbrand ? '' : b.dataset.sbrand; viewSell(main); });
  $$('[data-pick]').forEach(b => b.onclick = () => pickSize(b.dataset.pick));
  $$('[data-pay]').forEach(b => b.onclick = () => { sale.method = b.dataset.pay; $$('[data-pay]').forEach(x => x.setAttribute('aria-pressed', x === b)); });
  $$('[data-ch]').forEach(b => b.onclick = () => { sale.channel = b.dataset.ch; $$('[data-ch]').forEach(x => x.setAttribute('aria-pressed', x === b)); });
  ['name', 'phone', 'email'].forEach(k => $(`#c-${k}`).oninput = e => { sale[k] = e.target.value; });
  $('#clear-ticket').onclick = () => { ticket = []; refreshTicket(); };
  $('#charge').onclick = charge;
  $('#scan-btn')?.addEventListener('click', openScanner);
  refreshTicket();
}

// Hoja de tallas: un toque agrega una unidad.
function pickSize(code) {
  const p = db.find(code);
  const sizes = db.sizesOf(p);
  if (sizes.length === 1) return addToTicket(code, sizes[0]);
  const dlg = $('#dlg');
  dlg.innerHTML = `<div class="sheet"><header class="sheet-head"><span class="sheet-art">${thumb(p)}</span><div><span class="plaque">${p.code}</span><h2>${esc(p.name)}</h2><p>${esc(p.brand)} · ${esc(p.color)} · ${money(priceOf(p))}</p></div>
    <button class="x" type="button" data-close aria-label="Cerrar">${X}</button></header>
    <p class="sheet-q">¿Qué talla se vendió?</p>
    <div class="size-grid">${sizes.map(s => `<button class="size-big" data-s="${s}" ${p.stock[s] ? '' : 'disabled'}><b>${s}</b><small>${p.stock[s] ? p.stock[s] + ' en tienda' : 'Agotada'}</small></button>`).join('')}</div></div>`;
  $$('[data-s]', dlg).forEach(b => b.onclick = () => { addToTicket(code, b.dataset.s); dlg.close(); });
  $('[data-close]', dlg).onclick = () => dlg.close();
  dlg.showModal();
}

function addToTicket(code, size) {
  const p = db.find(code);
  if (!p || !(size in p.stock)) return toast(`${code} no maneja talla ${size}`, 'err');
  const line = ticket.find(t => t.code === code && t.size === size);
  if ((line?.qty || 0) + 1 > p.stock[size]) return toast(`${code}-${size} sin unidades disponibles`, 'err');
  line ? line.qty++ : ticket.push({ code, size, qty: 1 });
  toast(`${code}-${size} agregada a la venta`);
  refreshTicket(true);
}

function refreshTicket(bump = false) {
  const ol = $('#ticket');
  if (!ol) return;
  let total = 0;
  ol.innerHTML = ticket.map((t, i) => {
    const p = db.find(t.code);
    total += priceOf(p) * t.qty;
    return `<li><span class="t-art">${thumb(p)}</span><div class="t-info"><b>${esc(p.name)}</b><small>${t.code}-${t.size} · ${esc(p.color)}${activeDiscount(p) ? ` · −${activeDiscount(p).pct} %` : ''}</small>
      <div class="qty"><button type="button" aria-label="Quitar una" data-dec="${i}">−</button><span>${t.qty}</span><button type="button" aria-label="Agregar una" data-inc="${i}">+</button></div></div>
      <div class="t-end"><b>${money(priceOf(p) * t.qty)}</b><button type="button" class="link danger" data-del="${i}" aria-label="Quitar ${t.code}-${t.size}">${icon('trash')}</button></div></li>`;
  }).join('') || '<li class="t-empty">Toca una prenda para empezar la venta.</li>';
  const btn = $('#charge');
  btn.disabled = !ticket.length;
  btn.innerHTML = ticket.length ? `Cobrar <span id="charge-total">${money(total)}</span>` : 'Cobrar';
  $('#clear-ticket').hidden = !ticket.length;
  $('#ticket-panel').classList.toggle('has-items', !!ticket.length);
  if (bump) $('#ticket-panel').animate([{ boxShadow: '0 0 0 2px #C8A35A' }, { boxShadow: '0 0 0 0 transparent' }], { duration: 600 });
  $$('[data-inc]', ol).forEach(b => b.onclick = () => { const t = ticket[b.dataset.inc]; if (db.find(t.code).stock[t.size] > t.qty) { t.qty++; refreshTicket(); } else toast('No hay más unidades', 'err'); });
  $$('[data-dec]', ol).forEach(b => b.onclick = () => { const t = ticket[b.dataset.dec]; t.qty > 1 ? t.qty-- : ticket.splice(b.dataset.dec, 1); refreshTicket(); });
  $$('[data-del]', ol).forEach(b => b.onclick = () => { ticket.splice(b.dataset.del, 1); refreshTicket(); });
}

async function charge() {
  $('#charge').disabled = true;
  try {
    const s = await db.sell(ticket, { method: sale.method, channel: sale.channel, customer: { name: sale.name.trim(), phone: sale.phone.trim(), email: sale.email.trim() } });
    ticket = []; sale = { ...sale, name: '', phone: '', email: '' };
    render('vender', true);
    showReceipt(s);
  } catch (e) { toast(e.message, 'err'); $('#charge').disabled = false; }
}

// Cámara del celular: lee el QR de la etiqueta (Chrome en Android).
async function openScanner() {
  const dlg = $('#scan');
  dlg.innerHTML = `<div class="scan"><header class="sheet-head"><h2>Escanear etiqueta</h2><button class="x" type="button" data-close aria-label="Cerrar">${X}</button></header>
    <video id="cam" playsinline muted></video><p class="help">Apunta la cámara al código QR de la etiqueta.</p></div>`;
  let stream, alive = true;
  const stop = () => { alive = false; stream?.getTracks().forEach(t => t.stop()); };
  dlg.addEventListener('close', stop, { once: true });
  $('[data-close]', dlg).onclick = () => dlg.close();
  dlg.showModal();
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const v = $('#cam'); v.srcObject = stream; await v.play();
    const det = new BarcodeDetector({ formats: ['qr_code'] });
    const loop = async () => {
      if (!alive) return;
      const [hit] = await det.detect(v).catch(() => []);
      const c = hit && db.parseCode(hit.rawValue);
      if (c && db.find(c.code)) { dlg.close(); c.size ? addToTicket(c.code, c.size) : pickSize(c.code); return; }
      requestAnimationFrame(loop);
    };
    loop();
  } catch { toast('No se pudo abrir la cámara', 'err'); dlg.close(); }
}

// ==================== COMPROBANTE ====================
function receiptText(s) {
  return [`*${STORE.name}* · Comprobante N.º ${String(s.no).padStart(4, '0')}`, new Date(s.at).toLocaleString('es-CO'), '',
    ...s.items.map(i => `${i.qty} × ${i.brand} ${i.name} · ${i.color} · Talla ${i.size} · ${money(i.price * i.qty)}${i.price < i.list ? ` (antes ${money(i.list * i.qty)})` : ''}`), '',
    `*Total: ${money(s.total)}* · ${s.method}`, '', 'Gracias por elegirnos.',
    `Califícanos en Google: ${LINKS.maps}`, `Instagram: ${LINKS.instagram}`, `Facebook: ${LINKS.facebook}`].join('\n');
}

function showReceipt(s) {
  const dlg = $('#receipt');
  const c = s.customer || {};
  const phone = (c.phone || '').replace(/\D/g, '');
  dlg.innerHTML = `<div class="rc-wrap">
    <article class="rc" id="rc">
      <img src="assets/brand/lq-medallon.svg" alt="" width="84" height="84">
      <h2>${STORE.name}</h2><p class="rc-addr">${STORE.address} · WhatsApp ${STORE.phone}</p>
      <dl class="rc-meta"><div><dt>Comprobante</dt><dd>N.º ${String(s.no).padStart(4, '0')}</dd></div><div><dt>Fecha</dt><dd>${new Date(s.at).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}</dd></div>
        ${c.name ? `<div><dt>Cliente</dt><dd>${esc(c.name)}</dd></div>` : ''}<div><dt>Pago</dt><dd>${s.method}</dd></div></dl>
      <ol class="rc-items">${s.items.map(i => `<li><span><b>${esc(i.brand)} ${esc(i.name)}</b><small>${esc(i.color)} · Talla ${i.size} · ${i.code}${i.qty > 1 ? ` · ${i.qty} × ${money(i.price)}` : ''}</small></span>
        <span class="rc-amt">${i.price < i.list ? `<s>${money(i.list * i.qty)}</s>` : ''}${money(i.price * i.qty)}</span></li>`).join('')}</ol>
      <p class="rc-total"><span>Total</span><b>${money(s.total)}</b></p>
      <p class="rc-thanks">Gracias por elegirnos.</p>
      <p class="rc-social">Califícanos en Google Maps y síguenos en Instagram y Facebook.</p>
      <p class="rc-legal">Este comprobante no reemplaza la factura electrónica.</p>
    </article>
    <div class="rc-actions">
      <label>WhatsApp del cliente<input id="rc-phone" inputmode="tel" value="${esc(c.phone || '')}" placeholder="300 123 4567"></label>
      <button class="btn btn-brass btn-block" id="rc-wa">${icon('whatsapp')}Enviar por WhatsApp</button>
      <label>Correo del cliente<input id="rc-mail" type="email" value="${esc(c.email || '')}" placeholder="cliente@correo.com"></label>
      <button class="btn btn-block" id="rc-email">${icon('mail')}Enviar por correo</button>
      <button class="btn btn-block" id="rc-print">${icon('print')}Imprimir o guardar PDF</button>
      <button class="link" type="button" data-close>Cerrar</button>
    </div></div>`;
  $('#rc-wa').onclick = () => {
    const n = $('#rc-phone').value.replace(/\D/g, '');
    open(wa(receiptText(s), n ? (n.length === 10 ? '57' + n : n) : ''), '_blank', 'noopener');
  };
  $('#rc-email').onclick = () => { location.href = `mailto:${encodeURIComponent($('#rc-mail').value.trim())}?subject=${encodeURIComponent(`Tu compra en ${STORE.name}`)}&body=${encodeURIComponent(receiptText(s).replace(/\*/g, ''))}`; };
  $('#rc-print').onclick = () => { document.body.classList.add('printing-receipt'); print(); document.body.classList.remove('printing-receipt'); };
  $('[data-close]', dlg).onclick = () => dlg.close();
  if (!phone) $('#rc-phone').focus();
  dlg.showModal();
}

// ==================== HOY ====================
let todayDate = dayKey(Date.now());

function viewToday(main) {
  const from = new Date(todayDate + 'T00:00').getTime();
  const s = db.summary(from, from + 864e5);
  main.innerHTML = head('Hoy', `<label class="date-pick">Día<input type="date" id="day" value="${todayDate}" max="${dayKey(Date.now())}"></label>`) + `
  <p class="day-title">${dateLabel(from)}</p>
  <div class="kpis">
    <div class="kpi lead"><span>Vendido</span><strong id="k-rev">$0</strong><em>${s.sales.length} ${s.sales.length === 1 ? 'venta' : 'ventas'}</em></div>
    <div class="kpi"><span>Prendas vendidas</span><strong>${s.units}</strong><em>${s.discounts ? 'Descuentos: ' + money(s.discounts) : 'Sin descuentos'}</em></div>
    <div class="kpi"><span>Ganancia</span><strong>${money(s.gross)}</strong><em>Venta menos costo de la prenda</em></div>
    <div class="kpi"><span>Gastado en mercancía</span><strong>${money(s.spent)}</strong><em>${s.purchases.length} ${s.purchases.length === 1 ? 'entrada' : 'entradas'}</em></div>
  </div>
  ${s.sales.length ? `<div class="cols">
    <section class="panel"><h2>Por tipo de prenda</h2>${hBars(s.byCat.map(r => ({ label: r.label, value: r.value })), money)}</section>
    <section class="panel"><h2>Por marca</h2>${hBars(s.byBrand.map(r => ({ label: r.label, value: r.value })), money)}</section>
    <section class="panel"><h2>Por medio de pago</h2>${hBars(s.byMethod.map(r => ({ label: r.label, value: r.value })), money)}</section>
  </div>` : ''}
  <section class="panel"><h2>Ventas del día</h2>
    ${s.sales.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Hora</th><th>N.º</th><th>Prendas</th><th>Pago</th><th class="num">Total</th><th></th></tr></thead><tbody>
    ${s.sales.slice().reverse().map(x => `<tr><td>${new Date(x.at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</td><td>${String(x.no).padStart(4, '0')}</td>
      <td>${x.items.map(i => `<span class="code">${i.code}-${i.size}</span>${i.qty > 1 ? ' ×' + i.qty : ''}`).join(' ')}</td><td>${x.method}</td><td class="num">${money(x.total)}</td>
      <td class="row-actions"><button class="link" data-rc="${x.id}">${icon('receipt')}Comprobante</button><button class="link danger" data-void="${x.id}">Anular</button></td></tr>`).join('')}</tbody></table></div>`
    : empty('No hay ventas registradas este día.', `<a class="btn btn-dark btn-sm" href="#vender">Registrar una venta</a>`)}
  </section>
  <section class="panel"><h2>Mercancía que entró</h2>
    ${s.purchases.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Hora</th><th>Prenda</th><th class="num">Unidades</th><th class="num">Costo c/u</th><th class="num">Total</th><th></th></tr></thead><tbody>
    ${s.purchases.slice().reverse().map(x => `<tr><td>${new Date(x.at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</td><td><span class="code">${x.code}${x.size ? '-' + x.size : ''}</span> ${esc(x.name)} · ${esc(x.color)}</td>
      <td class="num">${x.qty}</td><td class="num">${money(x.unitCost)}</td><td class="num">${money(x.total)}</td><td class="row-actions"><button class="link danger" data-rmp="${x.id}" aria-label="Borrar registro">${icon('trash')}</button></td></tr>`).join('')}</tbody></table></div>`
    : `<p class="empty">No entró mercancía este día. Se registra sola al crear una prenda con unidades o con «Entrada de mercancía» en Inventario.</p>`}
  </section>`;
  tick($('#k-rev'), s.revenue, money);
  $('#day').onchange = e => { todayDate = e.target.value || dayKey(Date.now()); viewToday(main); };
  $$('[data-rc]').forEach(b => b.onclick = () => showReceipt(db.load().sales.find(x => x.id === b.dataset.rc)));
  $$('[data-void]').forEach(b => b.onclick = () => { if (confirm('¿Anular esta venta? Las prendas vuelven al inventario.')) act(() => db.voidSale(b.dataset.void), 'Venta anulada, stock devuelto'); });
  $$('[data-rmp]').forEach(b => b.onclick = () => { if (confirm('¿Borrar este registro de compra? No cambia el stock.')) act(() => db.removePurchase(b.dataset.rmp)); });
}

// ==================== INVENTARIO ====================
let inv = { q: '', cat: '', brand: '', low: false };

function viewInventory(main) {
  const all = db.products();
  const q = inv.q.toLowerCase();
  const list = all.filter(p => (!inv.cat || p.cat === inv.cat) && (!inv.brand || p.brand === inv.brand)
    && (!inv.low || Object.values(p.stock).some(n => n <= 1)) && (!q || `${p.code} ${p.name} ${p.color} ${p.brand}`.toLowerCase().includes(q)));
  const val = db.inventoryValue();
  main.innerHTML = head('Inventario', `<div class="head-actions"><button class="btn btn-sm" id="btn-in">${icon('plus')}Entrada de mercancía</button><button class="btn btn-dark btn-sm" id="btn-new">${icon('plus')}Nueva prenda</button></div>`) + `
  <div class="kpis">
    <div class="kpi"><span>Referencias</span><strong>${all.length}</strong></div>
    <div class="kpi"><span>Unidades</span><strong>${val.units}</strong></div>
    <div class="kpi"><span>Invertido en lo que hay</span><strong>${money(val.atCost)}</strong></div>
    <div class="kpi"><span>Valor a precio de venta</span><strong>${money(val.atPrice)}</strong></div>
  </div>
  <section class="panel">
    <div class="toolbar">
      <label class="search">${icon('search')}<span class="sr-only">Buscar</span><input type="search" id="inv-q" placeholder="Código, prenda, color o marca" value="${esc(inv.q)}"></label>
      <select id="inv-cat" aria-label="Tipo de prenda"><option value="">Todos los tipos</option>${Object.entries(CATEGORIES).map(([k, c]) => `<option value="${k}" ${inv.cat === k ? 'selected' : ''}>${k} · ${c.name}</option>`).join('')}</select>
      <select id="inv-brand" aria-label="Marca"><option value="">Todas las marcas</option>${db.brands().map(b => `<option ${inv.brand === b ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>
      <label class="check"><input type="checkbox" id="inv-low" ${inv.low ? 'checked' : ''}> Por agotarse</label>
      <button class="link" id="inv-csv">Exportar CSV</button>
    </div>
    ${list.length ? `<div class="inv-list">${list.map(p => {
      const tot = db.totalStock(p); const d = activeDiscount(p);
      return `<article class="inv-row">
        <span class="inv-art">${thumb(p)}</span>
        <div class="inv-id"><span class="code">${p.code}</span>${p.exclusive ? '<span class="tag-priv">Privada</span>' : ''}<b>${esc(p.name)}</b><small>${esc(p.brand)} · <i style="--c:${colorHex(p.color)}"></i>${esc(p.color)}</small></div>
        <div class="inv-sizes">${db.sizesOf(p).map(s => `<label class="st ${p.stock[s] === 0 ? 'zero' : p.stock[s] <= 1 ? 'low' : ''}"><span>${s}</span><input type="number" min="0" inputmode="numeric" value="${p.stock[s]}" data-code="${p.code}" data-size="${s}" aria-label="Unidades ${p.code} talla ${s}"></label>`).join('')}</div>
        <dl class="inv-money"><div><dt>Costo</dt><dd>${money(p.cost)}</dd></div><div><dt>Precio</dt><dd>${d ? `<s>${money(p.price)}</s> ` : ''}${money(priceOf(p))}</dd></div>
          <div><dt>Margen</dt><dd>${p.price ? Math.round((1 - p.cost / priceOf(p)) * 100) : 0} %</dd></div><div><dt>Total</dt><dd>${tot} und.</dd></div></dl>
        <div class="inv-actions"><button class="btn btn-sm" data-edit="${p.code}">${icon('edit')}Editar</button><button class="link" data-color="${p.code}">${icon('plus')}Otro color</button></div>
      </article>`;
    }).join('')}</div>` : empty(all.length ? 'Ninguna prenda coincide con el filtro.' : 'Aún no hay prendas. Crea la primera con «Nueva prenda».')}
    <p class="help">Cambiar un número corrige el stock al instante (la tienda en línea lo refleja). Para mercancía nueva usa «Entrada de mercancía»: así queda registrado lo que se gastó.</p>
  </section>`;
  $('#inv-q').oninput = e => { inv.q = e.target.value; viewInventory(main); const i = $('#inv-q'); i.focus(); i.setSelectionRange(99, 99); };
  $('#inv-cat').onchange = e => { inv.cat = e.target.value; viewInventory(main); };
  $('#inv-brand').onchange = e => { inv.brand = e.target.value; viewInventory(main); };
  $('#inv-low').onchange = e => { inv.low = e.target.checked; viewInventory(main); };
  $$('.inv-sizes input').forEach(i => i.onchange = () => {
    const p = db.find(i.dataset.code); const n = Math.max(0, parseInt(i.value, 10) || 0);
    act(() => db.saveProduct({ ...p, stock: { ...p.stock, [i.dataset.size]: n } }, { logPurchase: false }), `${p.code}-${i.dataset.size}: ${n} en tienda`);
  });
  $$('[data-edit]').forEach(b => b.onclick = () => productForm(db.find(b.dataset.edit)));
  $$('[data-color]').forEach(b => b.onclick = () => productForm(null, db.find(b.dataset.color)));
  $('#btn-new').onclick = () => productForm(null);
  $('#btn-in').onclick = () => restockForm();
  $('#inv-csv').onclick = () => download('inventario.csv', db.toCSV([['Código', 'Tipo', 'Marca', 'Prenda', 'Color', 'Línea', ...SIZE_ORDER, 'Total', 'Costo', 'Precio', 'Precio con descuento', 'Colección Privada'],
    ...all.map(p => [p.code, CATEGORIES[p.cat]?.name, p.brand, p.name, p.color, p.gender, ...SIZE_ORDER.map(s => p.stock[s] ?? ''), db.totalStock(p), p.cost, p.price, priceOf(p), p.exclusive ? 'Sí' : 'No'])]));
}

const MODELS = { polo: 'Polo', 'polo-mujer': 'Polo mujer sin mangas', 'polo-mujer-mc': 'Polo mujer manga corta', 'polo-rayas': 'Polo a rayas', camisa: 'Camisa', camiseta: 'Camiseta', gorra: 'Gorra', sueter: 'Suéter' };

// Formulario de prenda. "Otro color" copia todo de la base y deja color, costo y unidades por llenar.
function productForm(p, base = null) {
  const isNew = !p;
  const src = p || (base ? { ...base, code: db.nextCode(base.cat), color: '', stock: Object.fromEntries(Object.keys(base.stock).map(s => [s, 0])), img: '', modelImg: '', discount: null }
    : { code: db.nextCode('A'), cat: 'A', brand: '', name: '', model: 'polo', gender: 'Hombre', color: '', fabric: '', fit: '', price: 0, cost: 0, stock: { S: 0, M: 0, L: 0, XL: 0 }, details: [], care: '', img: '', modelImg: '', exclusive: false, discount: null });
  const dlg = $('#dlg');
  dlg.innerHTML = `<form class="dlg-form" id="pform" novalidate>
    <header class="dlg-head"><h2>${isNew ? (base ? `Otro color de ${esc(base.name)}` : 'Nueva prenda') : 'Editar ' + src.code}</h2><button type="button" class="x" data-cancel aria-label="Cerrar sin guardar">${X}</button></header>
    <div class="dlg-body form-grid">
      <label>Tipo de prenda<select name="cat" ${isNew && !base ? '' : 'disabled'}>${Object.entries(CATEGORIES).map(([k, c]) => `<option value="${k}" ${src.cat === k ? 'selected' : ''}>${k} · ${c.name}</option>`).join('')}</select></label>
      <label>Código<input name="code" value="${src.code}" readonly></label>
      <label>Marca<input name="brand" value="${esc(src.brand)}" list="brands" placeholder="Lacoste, Hugo Boss…" required></label>
      <datalist id="brands">${db.brands().map(b => `<option value="${esc(b)}">`).join('')}</datalist>
      <label>Nombre<input name="name" value="${esc(src.name)}" placeholder="Polo clásico" required></label>
      <label>Color<input name="color" value="${esc(src.color)}" placeholder="Verde botella, magenta…" required><span class="swatch-live" style="--c:${colorHex(src.color)}"></span></label>
      <label>Línea<select name="gender">${['Hombre', 'Mujer', 'Unisex'].map(g => `<option ${src.gender === g ? 'selected' : ''}>${g}</option>`).join('')}</select></label>
      <label>Costo de compra de esta prenda<input name="cost" type="number" min="0" step="500" inputmode="numeric" value="${src.cost || ''}" placeholder="250000" required></label>
      <label>Precio de venta<input name="price" type="number" min="0" step="1000" inputmode="numeric" value="${src.price || ''}" placeholder="459000" required></label>
      <fieldset class="span2"><legend>Tallas y unidades que hay</legend><div class="size-inputs">
        ${SIZE_ORDER.map(s => `<label><span>${s}</span><input type="number" min="0" inputmode="numeric" name="sz-${s}" value="${src.stock[s] ?? ''}" placeholder="–"></label>`).join('')}</div>
        <p class="help">Deja vacía la talla que no maneja. Las unidades nuevas quedan registradas como mercancía comprada a este costo.</p></fieldset>
      <label>Foto en gancho<input name="img" type="file" accept="image/*"><small class="help">Ideal: la prenda colgada, fondo liso o recortado.</small></label>
      <label>Foto con modelo (IA)<input name="modelImg" type="file" accept="image/*"><small class="help">Se muestra en la ficha y en la portada.</small></label>
      ${src.img || src.modelImg ? `<div class="span2 photo-now">${src.img ? `<figure><img src="${src.img}" alt=""><figcaption>En gancho</figcaption><button type="button" class="link danger" data-rmimg="img">Quitar</button></figure>` : ''}${src.modelImg ? `<figure><img src="${src.modelImg}" alt=""><figcaption>Con modelo</figcaption><button type="button" class="link danger" data-rmimg="modelImg">Quitar</button></figure>` : ''}</div>` : ''}
      <label>Tela<input name="fabric" value="${esc(src.fabric)}" placeholder="Piqué de algodón"></label>
      <label>Ajuste<input name="fit" value="${esc(src.fit)}" placeholder="Slim fit, Classic fit…"></label>
      <label>Silueta de la ilustración<select name="model">${Object.entries(MODELS).map(([k, v]) => `<option value="${k}" ${src.model === k ? 'selected' : ''}>${v}</option>`).join('')}</select><small class="help">Solo mientras no haya foto.</small></label>
      <label class="check span1"><input type="checkbox" name="exclusive" ${src.exclusive ? 'checked' : ''}> Va en la Colección Privada</label>
      <label class="span2">Detalles (uno por línea)<textarea name="details" rows="2">${esc((src.details || []).join('\n'))}</textarea></label>
      <label class="span2">Cuidados<textarea name="care" rows="2">${esc(src.care)}</textarea></label>
    </div>
    <footer class="dlg-foot">${isNew ? '' : '<button type="button" class="link danger" id="pdel">Eliminar prenda</button>'}<span></span>
      <button type="button" class="btn btn-sm" data-cancel>Cancelar</button>
      <button type="submit" class="btn btn-sm" value="again">Guardar y agregar otro color</button>
      <button type="submit" class="btn btn-dark btn-sm" value="save">Guardar</button></footer>
  </form>`;
  const f = $('#pform');
  const removed = {};
  f.cat.onchange = () => { f.code.value = db.nextCode(f.cat.value); };
  f.color.oninput = () => $('.swatch-live', f).style.setProperty('--c', colorHex(f.color.value));
  $$('[data-cancel]', f).forEach(b => b.onclick = () => dlg.close());
  $$('[data-rmimg]', f).forEach(b => b.onclick = () => { removed[b.dataset.rmimg] = true; b.closest('figure').remove(); });
  $('#pdel')?.addEventListener('click', () => { if (confirm(`¿Eliminar ${src.code}? Desaparece de la tienda.`)) act(() => db.deleteProduct(src.code), 'Prenda eliminada').then(ok => ok && dlg.close()); });
  f.onsubmit = async e => {
    e.preventDefault();
    for (const name of ['brand', 'name', 'color', 'cost', 'price']) if (!f[name].value.trim()) { f[name].focus(); return toast('Completa marca, nombre, color, costo y precio', 'err'); }
    const fd = new FormData(f);
    const stock = {};
    SIZE_ORDER.forEach(s => { const v = fd.get('sz-' + s); if (v !== '') stock[s] = Math.max(0, parseInt(v, 10) || 0); });
    if (!Object.keys(stock).length) return toast('Indica al menos una talla', 'err');
    const code = f.code.value;
    const pic = async k => { const file = fd.get(k); return file?.size ? db.uploadPhoto(await shrinkImage(file), `${code}-${k}`) : removed[k] ? '' : src[k]; };
    const save = $('[value=save]', f), again = $('[value=again]', f);
    save.disabled = again.disabled = true;
    const saved = { ...src, cat: f.cat.value, code: f.code.value, brand: fd.get('brand').trim(), name: fd.get('name').trim(), color: fd.get('color').trim(), gender: fd.get('gender'),
      cost: +fd.get('cost'), price: +fd.get('price'), stock, img: await pic('img'), modelImg: await pic('modelImg'), fabric: fd.get('fabric').trim(), fit: fd.get('fit').trim(),
      model: fd.get('model'), exclusive: fd.get('exclusive') === 'on', details: fd.get('details').split('\n').map(s => s.trim()).filter(Boolean), care: fd.get('care').trim() };
    delete saved.hex;
    const ok = await act(() => db.saveProduct(saved), `${saved.code} guardada y publicada en la tienda`);
    save.disabled = again.disabled = false;
    if (!ok) return;
    if (e.submitter?.value === 'again') productForm(null, saved); else dlg.close();
  };
  dlg.showModal();
}

function restockForm() {
  const ps = db.products();
  if (!ps.length) return toast('Primero crea una prenda', 'err');
  const dlg = $('#dlg');
  dlg.innerHTML = `<form class="dlg-form" id="rform" novalidate>
    <header class="dlg-head"><h2>Entrada de mercancía</h2><button type="button" class="x" data-cancel aria-label="Cerrar sin guardar">${X}</button></header>
    <div class="dlg-body form-grid">
      <label class="span2">Prenda<select name="code">${ps.map(p => `<option value="${p.code}">${p.code} · ${esc(p.brand)} ${esc(p.name)} · ${esc(p.color)}</option>`).join('')}</select></label>
      <label>Talla<select name="size"></select></label>
      <label>Unidades<input name="qty" type="number" min="1" value="1" inputmode="numeric"></label>
      <label class="span2">Costo de compra por unidad<input name="cost" type="number" min="0" step="500" inputmode="numeric"><small class="help">Cada color puede costar distinto: se guarda en esta prenda.</small></label>
    </div>
    <footer class="dlg-foot"><span></span><button type="button" class="btn btn-sm" data-cancel>Cancelar</button><button type="submit" class="btn btn-dark btn-sm">Sumar al inventario</button></footer></form>`;
  const f = $('#rform');
  const sync = () => { const p = db.find(f.code.value); f.size.innerHTML = db.sizesOf(p).map(s => `<option>${s}</option>`).join(''); f.cost.value = p.cost || ''; };
  f.code.onchange = sync; sync();
  $$('[data-cancel]', f).forEach(b => b.onclick = () => dlg.close());
  f.onsubmit = async e => {
    e.preventDefault();
    if (await act(() => db.restock(f.code.value, f.size.value, +f.qty.value, +f.cost.value), `Entrada registrada: ${f.code.value}-${f.size.value} +${f.qty.value}`)) dlg.close();
  };
  dlg.showModal();
}

// ==================== DESCUENTOS ====================
const picked = new Set();

function viewDiscounts(main) {
  const ps = db.products();
  const active = ps.filter(p => activeDiscount(p));
  const week = dayKey(Date.now() + 6 * 864e5);
  main.innerHTML = head('Descuentos', '<p class="head-note">Elige prendas, el porcentaje y hasta cuándo. Se aplica en la tienda en línea y al vender en la boutique.</p>') + `
  <div class="cols cols-2">
    <section class="panel">
      <h2>Nuevo descuento</h2>
      <div class="quick-pick"><span class="help">Seleccionar rápido:</span>
        ${db.brands().map(b => `<button class="chip" data-qb="${esc(b)}">${esc(b)}</button>`).join('')}
        ${Object.entries(CATEGORIES).filter(([k]) => ps.some(p => p.cat === k)).map(([k, c]) => `<button class="chip" data-qc="${k}">${c.name}</button>`).join('')}
        <button class="link" id="qnone">Ninguna</button></div>
      <div class="pick-grid">${ps.map(p => `<label class="pick ${picked.has(p.code) ? 'on' : ''}"><input type="checkbox" value="${p.code}" ${picked.has(p.code) ? 'checked' : ''}><span class="pick-art">${thumb(p)}</span><span><b>${p.code}</b> ${esc(p.name)}<small>${esc(p.color)} · ${money(p.price)}</small></span></label>`).join('')}</div>
      <form id="dform" class="dform">
        <fieldset><legend>Porcentaje</legend><div class="chip-row">${[10, 15, 20, 30].map(n => `<button type="button" class="chip" data-pct="${n}">${n} %</button>`).join('')}
          <input name="pct" type="number" min="1" max="90" value="10" inputmode="numeric" aria-label="Porcentaje" class="pct-in"></div></fieldset>
        <label>Hasta (incluido)<input name="until" type="date" value="${week}" min="${dayKey(Date.now())}"></label>
        <button class="btn btn-brass" ${picked.size ? '' : 'disabled'}>Aplicar a ${picked.size} ${picked.size === 1 ? 'prenda' : 'prendas'}</button>
      </form>
    </section>
    <section class="panel">
      <h2>Descuentos activos</h2>
      ${active.length ? `<ul class="disc-list">${active.map(p => { const d = activeDiscount(p); return `<li><span class="pick-art">${thumb(p)}</span><span><b>${p.code} · ${esc(p.name)}</b><small>${esc(p.color)} · hasta ${d.until ? new Date(d.until + 'T12:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : 'nuevo aviso'}</small></span>
        <span class="disc-price"><s>${money(p.price)}</s><b>${money(priceOf(p))}</b><em>−${d.pct} %</em></span><button class="link danger" data-off="${p.code}">Quitar</button></li>`; }).join('')}</ul>`
        : empty('No hay descuentos activos.')}
    </section>
  </div>`;
  const redraw = () => viewDiscounts(main);
  $$('.pick input').forEach(i => i.onchange = () => { i.checked ? picked.add(i.value) : picked.delete(i.value); redraw(); });
  $$('[data-qb]').forEach(b => b.onclick = () => { ps.filter(p => p.brand === b.dataset.qb).forEach(p => picked.add(p.code)); redraw(); });
  $$('[data-qc]').forEach(b => b.onclick = () => { ps.filter(p => p.cat === b.dataset.qc).forEach(p => picked.add(p.code)); redraw(); });
  $('#qnone').onclick = () => { picked.clear(); redraw(); };
  $$('[data-pct]').forEach(b => b.onclick = () => { $('#dform').pct.value = b.dataset.pct; });
  $('#dform').onsubmit = async e => {
    e.preventDefault();
    const pct = Math.min(90, Math.max(1, +e.target.pct.value || 0));
    const n = picked.size;
    if (await act(() => db.setDiscount([...picked], pct, e.target.until.value), `Descuento del ${pct} % aplicado a ${n} ${n === 1 ? 'prenda' : 'prendas'}`)) { picked.clear(); render('descuentos'); }
  };
  $$('[data-off]').forEach(b => b.onclick = () => act(() => db.setDiscount([b.dataset.off], 0), 'Descuento quitado'));
}

// ==================== FINANZAS ====================
let period = 'mes';
const PERIODS = { hoy: 'Hoy', '7d': '7 días', mes: 'Este mes', '30d': '30 días', todo: 'Todo' };

function range() {
  const d0 = new Date(); d0.setHours(0, 0, 0, 0);
  const t = d0.getTime();
  if (period === 'hoy') return [t, 1];
  if (period === '7d') return [t - 6 * 864e5, 7];
  if (period === '30d') return [t - 29 * 864e5, 30];
  if (period === 'todo') { const first = Math.min(t, ...db.load().sales.map(s => s.at), ...db.load().purchases.map(s => s.at)); const f = new Date(first); f.setHours(0, 0, 0, 0); return [f.getTime(), Math.round((t - f) / 864e5) + 1]; }
  const m = new Date(d0); m.setDate(1); return [m.getTime(), d0.getDate()];
}

function viewFinance(main) {
  const [from, days] = range();
  const s = db.summary(from);
  const margin = s.revenue ? Math.round(s.gross / s.revenue * 100) : 0;
  const n = Math.min(Math.max(days, 7), 62);
  const start = from + (days - n) * 864e5;
  const perDay = Array.from({ length: n }, (_, i) => {
    const t0 = start + i * 864e5;
    return { label: new Date(t0).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }), value: s.sales.filter(x => dayKey(x.at) === dayKey(t0)).reduce((a, x) => a + x.total, 0) };
  });
  const val = db.inventoryValue();
  main.innerHTML = head('Finanzas', `<div class="chip-row" role="group" aria-label="Periodo">${Object.entries(PERIODS).map(([k, v]) => `<button class="chip" data-period="${k}" aria-pressed="${k === period}">${v}</button>`).join('')}</div>`) + `
  <div class="kpis kpis-4">
    <div class="kpi lead"><span>Ventas</span><strong id="f-rev">$0</strong><em>${s.units} ${s.units === 1 ? 'prenda' : 'prendas'} · ${s.sales.length} ${s.sales.length === 1 ? 'venta' : 'ventas'}</em></div>
    <div class="kpi"><span>Ganancia</span><strong id="f-gross">$0</strong><em>Margen ${margin} %</em></div>
    <div class="kpi"><span>Gastado en mercancía</span><strong>${money(s.spent)}</strong><em>${s.purchases.reduce((a, x) => a + x.qty, 0)} unidades compradas</em></div>
    <div class="kpi"><span>Ticket promedio</span><strong>${money(s.sales.length ? s.revenue / s.sales.length : 0)}</strong><em>Descuentos dados: ${money(s.discounts)}</em></div>
  </div>
  ${s.sales.length ? `
  <section class="panel"><h2>Ventas por día</h2><div class="chart">${barChart(perDay)}</div></section>
  <div class="cols">
    <section class="panel"><h2>Por marca</h2>${hBars(s.byBrand.map(r => ({ label: r.label, value: r.value })), money)}</section>
    <section class="panel"><h2>Por tipo de prenda</h2>${hBars(s.byCat.map(r => ({ label: r.label, value: r.value })), money)}</section>
    <section class="panel"><h2>Por medio de pago</h2>${hBars(s.byMethod.map(r => ({ label: r.label, value: r.value })), money)}</section>
  </div>
  <section class="panel"><h2>Ganancia por prenda</h2><div class="table-wrap"><table class="table"><thead><tr><th>Prenda</th><th class="num">Vendidas</th><th class="num">Ingreso</th><th class="num">Costo</th><th class="num">Ganancia</th><th class="num">Margen</th></tr></thead><tbody>
    ${s.byRef.map(r => `<tr><td><span class="code">${esc(r.label.split(' · ')[0])}</span> ${esc(r.label.split(' · ')[1] || '')}</td><td class="num">${r.units}</td><td class="num">${money(r.value)}</td><td class="num">${money(r.cost)}</td><td class="num">${money(r.value - r.cost)}</td><td class="num">${r.value ? Math.round((1 - r.cost / r.value) * 100) : 0} %</td></tr>`).join('')}
  </tbody></table></div></section>`
  : `<section class="panel">${empty('Todavía no hay ventas en este periodo. Cuando registres ventas en «Vender», aquí verás cuánto vendes por día, por marca y por tipo de prenda, y cuánto le ganas a cada una.', '<a class="btn btn-dark btn-sm" href="#vender">Ir a Vender</a>')}</section>`}
  <section class="panel"><h2>Lo que hay en la boutique</h2>
    <div class="kpis kpis-flat"><div class="kpi"><span>Unidades</span><strong>${val.units}</strong></div><div class="kpi"><span>Invertido</span><strong>${money(val.atCost)}</strong></div><div class="kpi"><span>Si se vende todo</span><strong>${money(val.atPrice)}</strong></div><div class="kpi"><span>Ganancia posible</span><strong>${money(val.atPrice - val.atCost)}</strong></div></div>
  </section>
  <p class="help"><button class="link" id="sales-csv">Exportar ventas del periodo (CSV)</button> para el contador.</p>`;
  tick($('#f-rev'), s.revenue, money);
  tick($('#f-gross'), s.gross, money);
  $$('[data-period]').forEach(b => b.onclick = () => { period = b.dataset.period; viewFinance(main); });
  $('#sales-csv').onclick = () => download(`ventas-${period}.csv`, db.toCSV([['Fecha', 'N.º', 'Código', 'Marca', 'Prenda', 'Color', 'Talla', 'Cant.', 'Precio lista', 'Precio cobrado', 'Costo', 'Pago', 'Canal', 'Cliente'],
    ...s.sales.flatMap(x => x.items.map(i => [new Date(x.at).toLocaleString('es-CO'), x.no, i.code, i.brand, i.name, i.color, i.size, i.qty, i.list, i.price, i.cost, x.method, x.channel, x.customer?.name || '']))]));
}

// ==================== REDES ====================
function viewSocial(main) {
  const log = db.load().social.slice().sort((a, b) => a.at - b.at);
  const last = log.at(-1), prev = log.at(-2);
  const delta = k => last && prev && last[k] != null && prev[k] != null ? last[k] - prev[k] : null;
  const card = (key, ico, name, href, metrics) => `<article class="soc-card"><header><span class="bq-ico">${icon(ico)}</span><b>${name}</b><a class="btn btn-sm" href="${href}" target="_blank" rel="noopener">Abrir</a></header>
    <div class="soc-metrics">${metrics.map(([k, label]) => { const d = delta(k); return `<div><span>${label}</span><strong>${last?.[k] ?? '—'}</strong>${d != null ? `<em class="${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '+' : ''}${d} desde el registro anterior</em>` : ''}</div>`; }).join('')}</div></article>`;
  main.innerHTML = head('Redes', '<p class="head-note">Lleva el registro de cómo crecen sus redes y sus reseñas. Anótalo una vez por semana.</p>') + `
  <div class="soc-grid">
    ${card('ig', 'instagram', 'Instagram', LINKS.instagram, [['ig', 'Seguidores'], ['igPosts', 'Publicaciones']])}
    ${card('fb', 'facebook', 'Facebook', LINKS.facebook, [['fb', 'Seguidores']])}
    ${card('g', 'star', 'Google Maps', LINKS.maps, [['gReviews', 'Reseñas'], ['gRating', 'Calificación']])}
  </div>
  ${log.length > 1 ? `<section class="panel"><h2>Seguidores de Instagram</h2><div class="chart">${barChart(log.map(r => ({ label: new Date(r.at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }), value: r.ig || 0 })), 'Seguidores de Instagram', String)}</div></section>` : ''}
  <div class="cols cols-2">
    <section class="panel"><h2>Nuevo registro</h2>
      <form id="sform" class="form-grid">
        <label>Seguidores en Instagram<input name="ig" type="number" min="0" inputmode="numeric"></label>
        <label>Publicaciones en Instagram<input name="igPosts" type="number" min="0" inputmode="numeric"></label>
        <label>Seguidores en Facebook<input name="fb" type="number" min="0" inputmode="numeric"></label>
        <label>Reseñas en Google<input name="gReviews" type="number" min="0" inputmode="numeric"></label>
        <label>Calificación en Google<input name="gRating" type="number" min="1" max="5" step="0.1" inputmode="decimal"></label>
        <button class="btn btn-dark span2">Guardar registro</button>
      </form></section>
    <section class="panel"><h2>Historial</h2>
      ${log.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Fecha</th><th class="num">IG</th><th class="num">Publ.</th><th class="num">FB</th><th class="num">Reseñas</th><th class="num">★</th><th></th></tr></thead><tbody>
      ${log.slice().reverse().map(r => `<tr><td>${new Date(r.at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}</td><td class="num">${r.ig ?? '—'}</td><td class="num">${r.igPosts ?? '—'}</td><td class="num">${r.fb ?? '—'}</td><td class="num">${r.gReviews ?? '—'}</td><td class="num">${r.gRating ?? '—'}</td><td class="row-actions"><button class="link danger" data-rms="${r.id}" aria-label="Borrar">${icon('trash')}</button></td></tr>`).join('')}</tbody></table></div>`
      : '<p class="empty">Aún no hay registros. Anota los números de hoy para empezar a medir el crecimiento.</p>'}
    </section>
  </div>
  <p class="help">Más adelante estos números pueden llegar solos conectando la API de Meta (Instagram y Facebook, cuenta profesional) y la API de Google Places.</p>`;
  $('#sform').onsubmit = e => {
    e.preventDefault();
    const fd = new FormData(e.target); const entry = {};
    for (const [k, v] of fd) if (v !== '') entry[k] = +v;
    if (!Object.keys(entry).length) return toast('Escribe al menos un número', 'err');
    act(() => db.addSocial(entry), 'Registro guardado');
  };
  $$('[data-rms]').forEach(b => b.onclick = () => { if (confirm('¿Borrar este registro?')) act(() => db.removeSocial(b.dataset.rms)); });
}

// ==================== ETIQUETAS ====================
const labelPick = new Set();

function viewLabels(main) {
  const ps = db.products();
  main.innerHTML = head('Etiquetas', `<div class="head-actions"><label class="check"><input type="checkbox" id="per-unit"> Una por unidad</label><button class="btn btn-dark btn-sm" id="print" ${labelPick.size ? '' : 'disabled'}>${icon('print')}Imprimir ${labelPick.size ? `(${labelPick.size})` : ''}</button></div>`) + `
  <section class="panel no-print">
    <p class="help">Cada etiqueta lleva el código grande (A001-M) para leerlo de un vistazo y un QR que se escanea con la cámara del celular en «Vender». No necesitas lector de barras.</p>
    <div class="pick-grid">${ps.map(p => `<label class="pick ${labelPick.has(p.code) ? 'on' : ''}"><input type="checkbox" value="${p.code}" ${labelPick.has(p.code) ? 'checked' : ''}><span class="pick-art">${thumb(p)}</span><span><b>${p.code}</b> ${esc(p.name)}<small>${esc(p.color)}</small></span></label>`).join('')}</div>
  </section>
  <div id="sheet" class="label-sheet"></div>`;
  $$('.pick input').forEach(i => i.onchange = () => { i.checked ? labelPick.add(i.value) : labelPick.delete(i.value); viewLabels(main); });
  $('#per-unit').onchange = drawLabels;
  $('#print').onclick = () => print();
  drawLabels();
}

function drawLabels() {
  const perUnit = $('#per-unit')?.checked;
  const items = [...labelPick].map(db.find).filter(Boolean).flatMap(p => db.sizesOf(p).flatMap(s => Array(perUnit ? Math.max(0, p.stock[s]) : 1).fill([p, s])));
  const qr = text => { if (!window.qrcode) return ''; const q = window.qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({ cellSize: 2, margin: 0, scalable: true }); };
  $('#sheet').innerHTML = items.map(([p, s]) => `<article class="tag"><header><img src="assets/brand/lq.svg" alt=""><span>Liliana Quiroga</span></header>
    <div class="tag-code">${p.code}<span>${s}</span></div><div class="tag-qr">${qr(`${p.code}-${s}`)}</div>
    <p class="tag-name">${esc(p.brand)} · ${esc(p.name)}<br>${esc(p.color)}</p><p class="tag-price">${money(p.price)}</p></article>`).join('');
}

// ==================== AJUSTES ====================
function viewSettings(main) {
  const st = db.load();
  main.innerHTML = head('Ajustes') + `
  <div class="cols cols-2">
    ${db.isRemote() ? `<section class="panel"><h2>Base compartida</h2><p class="help">Conectada. Inventario, ventas y compras se guardan en Supabase y se ven al instante en todos los equipos. Para agregar o quitar administradores, edita la tabla «admins» y los usuarios en Supabase.</p></section>`
    : `<section class="panel"><h2>Cambiar PIN</h2><form id="newpin" class="row-form"><input name="pin" inputmode="numeric" pattern="\\d{4,8}" required placeholder="Nuevo PIN (4 a 8 números)" aria-label="Nuevo PIN"><button class="btn btn-dark btn-sm">Cambiar</button></form></section>`}
    <section class="panel"><h2>Respaldo</h2><p class="help">${db.isRemote() ? 'Descarga una copia de todo lo registrado para guardarla aparte.' : 'Los datos de la vista previa viven en este navegador. Descarga un respaldo cada semana.'}</p>
      <div class="head-actions"><button class="btn btn-sm" id="backup">Descargar respaldo</button>${db.isRemote() ? '' : '<label class="btn btn-sm">Restaurar respaldo<input type="file" id="restore" accept="application/json" hidden></label>'}</div></section>
    <section class="panel"><h2>Empezar de nuevo</h2><p class="help">${st.examples ? 'Ahora hay prendas de ejemplo para ver cómo luce la tienda.' : 'La boutique está en limpio.'} Esto borra prendas, ventas, compras y registros de redes.</p>
      <div class="head-actions"><button class="btn btn-sm" id="reset-empty">Dejar todo en limpio</button><button class="btn btn-sm" id="reset-ex">Cargar prendas de ejemplo</button></div></section>
  </div>`;
  $('#newpin')?.addEventListener('submit', async e => { e.preventDefault(); const h = await sha(e.target.pin.value); db.setSettings({ pinHash: h }); sessionStorage.setItem(SESSION, h); toast('PIN actualizado'); e.target.reset(); });
  $('#backup').onclick = () => download(`respaldo-liliana-quiroga-${dayKey(Date.now())}.json`, JSON.stringify(db.load()), 'application/json');
  if ($('#restore')) $('#restore').onchange = async e => {
    try {
      const data = JSON.parse(await e.target.files[0].text());
      if (!Array.isArray(data.products) || !Array.isArray(data.sales)) throw new Error();
      await db.replaceAll({ purchases: [], social: [], seq: 0, ...data, settings: db.load().settings }); toast('Respaldo restaurado');
    } catch { toast('Archivo de respaldo inválido', 'err'); }
  };
  const reset = ex => { if (confirm('Se borra todo lo registrado. ¿Continuar?')) act(() => db.resetAll(ex), ex ? 'Prendas de ejemplo cargadas' : 'Boutique en limpio'); };
  $('#reset-empty').onclick = () => reset(false);
  $('#reset-ex').onclick = () => reset(true);
}

$('#logout').onclick = async () => { sessionStorage.removeItem(SESSION); await db.signOut(); location.reload(); };
gate();
