import * as db from './data.js';
import { CATEGORIES, money, priceOf, activeDiscount, colorHex } from './data.js';
import { garmentSVG } from './garments.js';
import { quote, DEPARTMENTS } from './shipping.js';
import { $, $$, esc, wa, toast, icon, X, socialButtons, LINKS, STORE, tick } from './util.js';
import { buildOrder, orderText, cardURL } from './order.js';
import { CONFIG } from './config.js';

const CART = 'lq.cart.v3';
let cart = read();
let filter = { brand: '', cat: '', gender: '', size: '', sort: 'new' };
let openCode = null;
let step = 1;
let sent = null;   // solicitud ya armada y enviada a WhatsApp
let ready = !db.isRemote();
const order = { pay: 'ahora', paid: false, mode: 'recoger', dep: 'Tolima', city: 'Ibagué', carrier: '', name: '', address: '', notes: '', gift: false, to: '', message: '' };

function read() { try { return JSON.parse(localStorage.getItem(CART)) || []; } catch { return []; } }
function write() { try { localStorage.setItem(CART, JSON.stringify(cart)); } catch { /* modo privado: el carrito vive en memoria */ } }

// Imagen de la prenda: foto en gancho, si no la ilustración. La foto con modelo IA va en la ficha.
const art = (p, prefer = 'img') => {
  const src = prefer === 'model' ? (p.modelImg || p.img) : (p.img || p.modelImg);
  return src ? `<img class="hang" src="${src}" alt="${esc(p.name)}, ${esc(p.color)}" loading="lazy">` : garmentSVG(p);
};
const stockLeft = (code, size) => db.find(code)?.stock[size] ?? 0;
const priceHTML = p => {
  const d = activeDiscount(p);
  return d ? `<span class="price"><s>${money(p.price)}</s> ${money(priceOf(p))}</span>` : `<span class="price">${money(p.price)}</span>`;
};
const flags = p => [
  activeDiscount(p) ? `<span class="tag-sale">−${activeDiscount(p).pct} %</span>` : '',
  db.totalStock(p) === 0 ? '<span>Agotado</span>' : db.totalStock(p) === 1 ? '<span>Última pieza</span>' : '',
].join('');

// Ficha de vitrina: marco blanco, la foto con modelo aparece al pasar, tallas para agregar directo.
function piece(p, big = false) {
  const alt = p.img && p.modelImg ? `<img class="alt" src="${p.modelImg}" alt="" loading="lazy">` : '';
  const sizes = db.sizesOf(p);
  return `<article class="pieza sway ${big ? 'pieza-big' : ''} ${db.totalStock(p) ? '' : 'is-out'}">
    <button class="hit" data-open="${p.code}" aria-label="Ver ${esc(p.name)}, ${esc(p.brand)}, ${esc(p.color)}"></button>
    <div class="frame">${art(p)}${alt}
      <span class="plaque">${p.code}</span><div class="tags">${flags(p)}</div>
      ${db.totalStock(p) ? `<div class="quick" aria-label="Agregar talla"><span>Agregar</span>${sizes.map(s => `<button data-quick="${p.code}|${s}" ${p.stock[s] ? '' : 'disabled'} aria-label="Agregar talla ${s}">${s}</button>`).join('')}</div>` : ''}
    </div>
    <div class="info">
      <h3>${esc(p.name)}</h3>
      <p class="meta">${esc(p.brand)}<span aria-hidden="true">·</span>${esc(p.color)}</p>
      ${priceHTML(p)}
    </div>
  </article>`;
}

// ---------- portada ----------
function renderHero() {
  const all = db.products();
  const p = all.find(x => x.exclusive && db.totalStock(x)) || all.find(x => db.totalStock(x)) || all[0];
  const box = $('#hero-piece');
  if (!p) { box.innerHTML = ''; return; }
  box.innerHTML = `<button class="hero-niche sway" data-open="${p.code}" aria-label="Ver ${esc(p.name)}">${art(p, 'model')}</button>
    <figcaption><span class="plaque">${p.exclusive ? 'Colección Privada' : 'Pieza'} · ${p.code}</span>
      <strong>${esc(p.name)}</strong><span>${esc(p.brand)} · ${priceHTML(p)}</span></figcaption>`;
  $('#brand-list').innerHTML = db.brands().map(b => `<li>${esc(b)}</li>`).join('');
}

// ---------- catálogo ----------
function renderCatalog() {
  const all = db.products();
  const regular = all.filter(p => !p.exclusive);
  let list = regular.filter(p => (!filter.brand || p.brand === filter.brand) && (!filter.cat || p.cat === filter.cat)
    && (!filter.gender || p.gender === filter.gender || p.gender === 'Unisex') && (!filter.size || p.stock[filter.size] > 0));
  if (filter.sort === 'low') list = [...list].sort((a, b) => priceOf(a) - priceOf(b));
  if (filter.sort === 'high') list = [...list].sort((a, b) => priceOf(b) - priceOf(a));
  if (filter.sort === 'new') list = [...list].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  $('#cat-filters').innerHTML = [['', 'Todo', regular.length], ...Object.entries(CATEGORIES).filter(([k]) => regular.some(p => p.cat === k)).map(([k, c]) => [k, c.name, regular.filter(p => p.cat === k).length])]
    .map(([k, n, c]) => `<button class="cat" data-cat="${k}" aria-pressed="${filter.cat === k}">${n}<sup>${c}</sup></button>`).join('');
  const bs = $('#brand-select');
  bs.innerHTML = '<option value="">Todas</option>' + db.brands().map(b => `<option ${filter.brand === b ? 'selected' : ''}>${esc(b)}</option>`).join('');
  $('#count').textContent = `${list.length} ${list.length === 1 ? 'pieza' : 'piezas'}`;
  $('#grid').innerHTML = !ready ? '<p class="empty">Cargando la colección…</p>'
    : list.map(p => piece(p)).join('') || '<p class="empty">No hay piezas con ese filtro. Escríbenos por WhatsApp y te ayudamos a encontrarla.</p>';

  const priv = all.filter(p => p.exclusive);
  $('#privada').hidden = !priv.length;
  $('#private-grid').innerHTML = priv.map(p => piece(p, true)).join('');
}

// ---------- ficha de producto (todo lo demás se apaga) ----------
function openProduct(code, size = null, view = null) {
  const p = db.find(code);
  if (!p) return;
  openCode = code;
  const sizes = db.sizesOf(p);
  const siblings = db.products().filter(x => x.model === p.model && x.name === p.name && x.brand === p.brand);
  const pick = size && p.stock[size] ? size : (sizes.length === 1 && p.stock[sizes[0]] ? sizes[0] : null);
  const views = [p.img && 'img', p.modelImg && 'model'].filter(Boolean);
  const v = view || (views.includes('model') ? 'model' : 'img');
  const dlg = $('#product');
  dlg.innerHTML = `<div class="pd">
    <button class="x pd-close" data-close aria-label="Cerrar">${X}</button>
    <div class="pd-stage">
      <div class="pd-art sway">${art(p, v === 'model' ? 'model' : 'img')}</div>
      ${views.length > 1 ? `<div class="pd-views" role="group" aria-label="Vista">${views.map(x => `<button class="chip" data-view="${x}" aria-pressed="${x === v}">${x === 'model' ? 'Con modelo' : 'En gancho'}</button>`).join('')}</div>` : ''}
      <span class="plaque pd-plaque">${p.exclusive ? 'Colección Privada · ' : ''}${p.code}</span>
    </div>
    <div class="pd-info">
      <h2>${esc(p.name)}</h2>
      <p class="pd-meta">${esc(p.brand)} · ${esc(p.color)}</p>
      <p class="pd-price">${priceHTML(p)}${activeDiscount(p) ? `<span class="pd-save">Precio especial hasta el ${activeDiscount(p).until ? new Date(activeDiscount(p).until + 'T12:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long' }) : 'agotar existencias'}</span>` : ''}</p>
      ${siblings.length > 1 ? `<fieldset class="pd-colors"><legend>Color · <b>${esc(p.color)}</b></legend><div>
        ${siblings.map(x => `<button class="swatch" style="--c:${colorHex(x.color)}" data-sib="${x.code}" aria-pressed="${x.code === p.code}" aria-label="${esc(x.color)}${db.totalStock(x) ? '' : ' (agotado)'}" ${db.totalStock(x) ? '' : 'data-out'}></button>`).join('')}</div></fieldset>` : ''}
      <fieldset class="pd-sizes"><legend>Talla</legend>
        <div class="size-row">${sizes.map(s => `<button class="size" data-size="${s}" aria-pressed="${s === pick}" ${p.stock[s] ? '' : 'disabled'}>${s}</button>`).join('')}</div>
        <p class="pd-stock" id="pd-stock">${pick ? stockNote(p, pick) : 'Elige tu talla.'}</p>
      </fieldset>
      <div class="pd-actions">
        <button class="btn btn-dark btn-block" id="pd-add" ${pick ? '' : 'disabled'}>${db.totalStock(p) ? 'Agregar al pedido' : 'Agotado'}</button>
        <a class="btn btn-block" target="_blank" rel="noopener" href="${wa(`Hola, quiero ${p.exclusive ? 'reservar' : 'asesoría con'} la pieza ${p.code} (${p.brand} ${p.name}, ${p.color}).`)}">${icon('whatsapp')}${p.exclusive ? 'Reservar por WhatsApp' : 'Asesoría por WhatsApp'}</a>
      </div>
      <dl class="spec">
        <div><dt>Marca</dt><dd>${esc(p.brand)}</dd></div>
        <div><dt>Tela</dt><dd>${esc(p.fabric)}</dd></div>
        <div><dt>Ajuste</dt><dd>${esc(p.fit)}</dd></div>
        <div><dt>Línea</dt><dd>${p.gender}</dd></div>
        ${(p.details || []).length ? `<div><dt>Detalles</dt><dd>${p.details.map(esc).join(' · ')}</dd></div>` : ''}
        ${p.care ? `<div><dt>Cuidado</dt><dd>${esc(p.care)}</dd></div>` : ''}
      </dl>
    </div></div>`;
  let chosen = pick;
  $$('[data-size]', dlg).forEach(b => b.onclick = () => {
    chosen = b.dataset.size;
    $$('[data-size]', dlg).forEach(x => x.setAttribute('aria-pressed', x === b));
    $('#pd-stock').innerHTML = stockNote(p, chosen);
    $('#pd-add').disabled = false;
  });
  $$('[data-sib]', dlg).forEach(b => b.onclick = () => openProduct(b.dataset.sib, chosen));
  $$('[data-view]', dlg).forEach(b => b.onclick = () => openProduct(p.code, chosen, b.dataset.view));
  $('#pd-add').onclick = () => { add(p.code, chosen, $('.pd-art', dlg)); dlg.close(); };
  if (!dlg.open) dlg.showModal();
}
const stockNote = (p, s) => p.stock[s] === 1 ? 'Es la <b>última pieza</b> en esta talla.' : p.stock[s] <= 3 ? `Quedan <b>${p.stock[s]}</b> en talla ${s}.` : `Disponible en talla ${s}.`;

// ---------- pedido ----------
function add(code, size, fromEl) {
  sent = null;
  const line = cart.find(l => l.code === code && l.size === size);
  if ((line?.qty || 0) + 1 > stockLeft(code, size)) return toast('No hay más unidades en esa talla', 'err');
  line ? line.qty++ : cart.push({ code, size, qty: 1 });
  write();
  renderScore();
  flyTo(fromEl);
  const p = db.find(code);
  toast(`${p.name} · ${p.color} · talla ${size}, agregada a tu pedido`);
}

// La prenda viaja al marcador del pedido.
function flyTo(fromEl) {
  const target = $('#score-thumbs');
  if (!fromEl || !target || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const a = fromEl.getBoundingClientRect(), b = target.getBoundingClientRect();
  const ghost = fromEl.cloneNode(true);
  Object.assign(ghost.style, { position: 'fixed', left: a.left + 'px', top: a.top + 'px', width: a.width + 'px', height: a.height + 'px', zIndex: 99, pointerEvents: 'none', margin: 0 });
  document.body.append(ghost);
  ghost.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${b.left - a.left}px, ${b.top - a.top}px) scale(${44 / a.width})`, opacity: .3 }],
    { duration: 700, easing: 'cubic-bezier(.6,.05,.3,1)' }).onfinish = () => ghost.remove();
}

// Si una venta en la boutique agotó una talla, el pedido se ajusta solo.
function reconcile() {
  let changed = false;
  cart.forEach(l => { const left = stockLeft(l.code, l.size); if (l.qty > left) { l.qty = left; changed = true; } });
  const before = cart.length;
  cart = cart.filter(l => l.qty > 0 && db.find(l.code));
  if (changed || before !== cart.length) { write(); toast('Una pieza de tu pedido se acaba de vender en la boutique. Ajustamos tu pedido.', 'err'); }
}

const lines = () => cart.map(l => ({ ...l, p: db.find(l.code) })).filter(l => l.p);
const subtotal = () => lines().reduce((a, l) => a + priceOf(l.p) * l.qty, 0);
const units = () => lines().reduce((a, l) => a + l.qty, 0);

function shipping() {
  if (order.mode === 'recoger') return { name: 'Recoger en la boutique', cost: 0, days: 'Te avisamos cuando esté lista' };
  if (order.mode === 'domicilio') return { name: 'Domicilio en Ibagué', cost: 8000, days: 'Hoy o mañana' };
  const opts = quote(lines(), subtotal(), order.dep, order.city);
  return opts.find(o => o.id === order.carrier) || opts[0] || null;
}

function renderScore() {
  const n = units();
  $('#score').hidden = !n;
  $('#score-thumbs').innerHTML = lines().slice(-3).map(l => `<span class="mini">${art(l.p)}</span>`).join('');
  tick($('#score-count'), n);
  tick($('#score-total'), subtotal(), money);
  $('#cart-count').textContent = n;
  $('#cart-count').hidden = !n;
}

const STEPS = ['Prendas', 'Entrega', 'Pago', 'Tus datos'];

function renderCart() {
  const ls = lines();
  const sub = subtotal();
  const sh = shipping();
  const total = sub + (sh?.cost || 0);
  const dlg = $('#cart');
  if (sent) return renderSent(dlg);
  if (!ls.length) step = 1;
  const body = !ls.length ? `<div class="cart-empty"><img src="assets/brand/cocodrilo-caminando.svg" alt="" width="200" height="52"><p>Tu pedido está vacío.</p><button class="btn btn-dark" data-close>Ver la colección</button></div>`
    : step === 1 ? stepItems(ls) : step === 2 ? stepDelivery(sub) : step === 3 ? stepPay(total) : stepDetails(ls, sh, total);
  const next = step === 1 ? 'Elegir entrega' : step === 2 ? 'Elegir pago' : step === 3 ? 'Continuar' : 'Enviar pedido por WhatsApp';
  dlg.innerHTML = `<div class="cart">
    <header class="cart-head">
      <div class="cart-top">${step > 1 && ls.length ? `<button class="x" data-step="${step - 1}" aria-label="Volver">${icon('back')}</button>` : ''}<h2>Tu pedido</h2><button class="x" data-close aria-label="Cerrar">${X}</button></div>
      ${ls.length ? `<ol class="steps">${STEPS.map((s, i) => `<li><button data-step="${i + 1}" aria-current="${step === i + 1 ? 'step' : 'false'}" ${i + 1 > step ? 'disabled' : ''}><b>${i + 1}</b>${s}</button></li>`).join('')}</ol>` : ''}
    </header>
    <div class="cart-body">${body}</div>
    ${ls.length ? `<footer class="cart-foot">
      <div class="cart-sum"><span>${units()} ${units() === 1 ? 'prenda' : 'prendas'}${step > 1 && sh ? ` · ${sh.cost ? money(sh.cost) + ' envío' : 'sin costo de envío'}` : ''}</span><strong>${money(step > 1 ? total : sub)}</strong></div>
      <button class="btn btn-brass btn-block" id="cart-next">${step === 4 ? icon('whatsapp') : ''}${next}${step < 4 ? icon('arrow') : ''}</button>
    </footer>` : ''}
  </div>`;
  wireCart(dlg, ls, sh, total);
}

function stepItems(ls) {
  return `<ol class="cart-lines">${ls.map((l, i) => `<li>
    <div class="cl-art">${art(l.p)}</div>
    <div class="cl-info"><strong>${esc(l.p.name)}</strong><span>${esc(l.p.brand)} · ${esc(l.p.color)} · Talla <b>${l.size}</b></span>
      <span class="cl-unit">${money(priceOf(l.p))} c/u${activeDiscount(l.p) ? ` <em>−${activeDiscount(l.p).pct} %</em>` : ''}</span>
      <div class="qty"><button aria-label="Quitar una" data-dec="${i}">−</button><span aria-live="polite">${l.qty}</span><button aria-label="Agregar una" data-inc="${i}" ${l.qty >= stockLeft(l.code, l.size) ? 'disabled' : ''}>+</button></div></div>
    <div class="cl-end"><strong>${money(priceOf(l.p) * l.qty)}</strong><button class="link" data-del="${i}">Quitar</button></div></li>`).join('')}</ol>`;
}

function stepDelivery(sub) {
  const opts = quote(lines(), sub, order.dep, order.city);
  if (!opts.some(o => o.id === order.carrier)) order.carrier = opts[0]?.id || '';
  const card = (mode, ico, title, price, text) => `<label class="deliv ${order.mode === mode ? 'on' : ''}"><input type="radio" name="mode" value="${mode}" ${order.mode === mode ? 'checked' : ''}>
    <span class="deliv-ico">${icon(ico)}</span><span class="deliv-txt"><b>${title}</b><small>${text}</small></span><span class="deliv-price">${price}</span></label>`;
  return `<div class="deliv-list" role="radiogroup" aria-label="Forma de entrega">
    ${card('recoger', 'store', 'Recoger en la boutique', 'Gratis', 'Cl. 54 #7B-55, Ibagué. Te escribimos cuando esté lista.')}
    ${card('domicilio', 'bike', 'Domicilio en Ibagué', money(8000), 'Llega hoy o mañana a tu puerta.')}
    ${card('envio', 'truck', 'Envío a otra ciudad', 'Según destino', 'Interrapidísimo o Servientrega a toda Colombia.')}
  </div>
  ${order.mode === 'envio' ? `<div class="ship-box">
    <div class="ship-dest"><label>Departamento<select id="dep">${DEPARTMENTS.map(d => `<option ${d === order.dep ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
    <label>Ciudad o municipio<input id="city" value="${esc(order.city)}" autocomplete="address-level2" placeholder="Ej. Bogotá"></label></div>
    ${opts.length && opts[0].zone !== 'local' ? `<div class="carriers" role="radiogroup" aria-label="Transportadora">${opts.map(o => `<label class="carrier ${o.id === order.carrier ? 'on' : ''}"><input type="radio" name="carrier" value="${o.id}" ${o.id === order.carrier ? 'checked' : ''}>
      <span><b>${o.name}</b><small>${o.days} · ${o.kg} kg</small></span><strong>${money(o.cost)}</strong></label>`).join('')}</div>
      <p class="help">Valor estimado: flete más manejo sobre el valor declarado. Te confirmamos el valor exacto al generar la guía.</p>`
      : '<p class="help">Para Ibagué elige recoger en la boutique o domicilio.</p>'}
  </div>` : ''}`;
}

// Pago: en línea (Bre-B o QR, sin hablar con nadie) o en persona / con asesoría.
function stepPay(total) {
  const pm = CONFIG.payments;
  const persona = order.mode === 'recoger' ? 'Pagas en la boutique al recoger: efectivo, tarjeta o transferencia.'
    : order.mode === 'domicilio' ? 'Pagas al recibir el domicilio: efectivo o transferencia.' : 'Un asesor te escribe por WhatsApp para coordinar el pago antes del despacho.';
  const card = (val, ico, title, text) => `<label class="deliv ${order.pay === val ? 'on' : ''}"><input type="radio" name="pay" value="${val}" ${order.pay === val ? 'checked' : ''}>
    <span class="deliv-ico">${icon(ico)}</span><span class="deliv-txt"><b>${title}</b><small>${text}</small></span></label>`;
  return `<div class="deliv-list" role="radiogroup" aria-label="Forma de pago">
    ${card('ahora', 'qr', 'Pagar ahora en línea', 'Con Bre-B o el QR de Bancolombia, desde tu banco o billetera.')}
    ${card('persona', 'users', 'Pagar en persona o con asesoría', persona)}
  </div>
  ${order.pay === 'ahora' ? `<div class="paybox">
    ${pm.demo ? '<p class="pay-demo">Datos de ejemplo · todavía no transfieras</p>' : ''}
    <div class="pay-amount"><span>Valor a pagar</span><strong>${money(total)}</strong><button class="link" data-copy="${total}">Copiar valor</button></div>
    <div class="pay-grid">
      <figure class="pay-qr"><div id="pay-qr" aria-label="Código QR de pago">${pm.qrImage ? `<img src="${pm.qrImage}" alt="QR de pago Bancolombia">` : ''}</div>
        ${pm.demo ? '<span class="pay-stamp">Ejemplo</span>' : ''}<figcaption>QR Bancolombia<br><small>Escanéalo desde tu app</small></figcaption></figure>
      <div class="pay-key"><span>Llave Bre-B</span><b>${esc(pm.breb)}</b><button class="btn btn-sm" data-copy="${esc(pm.breb)}">Copiar llave</button>
        <small>A nombre de ${esc(pm.holder)}. Funciona desde Bancolombia, Nequi, Daviplata y las demás entidades de Bre-B.</small></div>
    </div>
    <ol class="pay-steps"><li>Paga ${money(total)} desde tu app.</li><li>Toma una captura del comprobante.</li><li>Envía el pedido y adjunta la captura en el chat de WhatsApp.</li></ol>
    ${order.mode === 'envio' ? '<p class="help">El envío es un valor estimado: si el valor real cambia, te devolvemos o te cobramos la diferencia.</p>' : ''}
    <label class="check paid"><input type="checkbox" id="o-paid" ${order.paid ? 'checked' : ''}> Ya hice el pago</label>
  </div>` : ''}`;
}

function stepDetails(ls, sh, total) {
  return `<div class="details">
    <label>Tu nombre<input id="o-name" value="${esc(order.name)}" autocomplete="name" required></label>
    ${order.mode === 'recoger' ? '' : `<label>Dirección de entrega<input id="o-addr" value="${esc(order.address)}" autocomplete="street-address" placeholder="Calle, número, barrio"></label>`}
    <label class="gift-toggle"><input type="checkbox" id="o-gift" ${order.gift ? 'checked' : ''}><span>${icon('gift')}<b>Es un regalo</b><small>Incluimos una tarjeta con tu mensaje.</small></span></label>
    ${order.gift ? `<div class="gift">
      <label>Para<input id="o-to" value="${esc(order.to)}" placeholder="Nombre de quien lo recibe"></label>
      <label>Mensaje de la tarjeta<textarea id="o-msg" rows="3" maxlength="240" placeholder="Escribe tu mensaje">${esc(order.message)}</textarea></label>
      <div class="card-preview" aria-label="Vista previa de la tarjeta"><img src="assets/brand/cocodrilo-cabeza-verde.svg" alt="" width="54" height="54">
        <p class="cp-to">${order.to ? 'Para ' + esc(order.to) : 'Para alguien especial'}</p><p class="cp-msg" id="cp-msg">${esc(order.message) || 'Tu mensaje aparecerá aquí.'}</p><p class="cp-from">Liliana Quiroga Store</p></div>
    </div>` : ''}
    <label>Notas (opcional)<input id="o-notes" value="${esc(order.notes)}" placeholder="Horario de entrega, referencias…"></label>
    <dl class="recap">
      <div><dt>Prendas</dt><dd>${ls.map(l => `${l.p.name} · ${l.size}${l.qty > 1 ? ' ×' + l.qty : ''}`).join('<br>')}</dd></div>
      <div><dt>Entrega</dt><dd>${sh ? `${sh.name}${order.mode === 'envio' ? ` · ${esc(order.city)}, ${esc(order.dep)}` : ''}` : 'Por confirmar'}</dd></div>
      <div><dt>Pago</dt><dd>${order.pay === 'ahora' ? `En línea${order.paid ? ' · ya pagado' : ''}` : 'En persona o con asesor'}</dd></div>
      <div><dt>Total</dt><dd><b>${money(total)}</b></dd></div>
    </dl>
  </div>`;
}

function wireCart(dlg, ls, sh, total) {
  const keep = () => { order.name = $('#o-name')?.value ?? order.name; order.address = $('#o-addr')?.value ?? order.address; order.notes = $('#o-notes')?.value ?? order.notes; order.to = $('#o-to')?.value ?? order.to; order.message = $('#o-msg')?.value ?? order.message; };
  $$('[data-step]', dlg).forEach(b => b.onclick = () => { keep(); step = +b.dataset.step; renderCart(); });
  $$('[data-inc]', dlg).forEach(b => b.onclick = () => { const l = cart[b.dataset.inc]; if (l.qty < stockLeft(l.code, l.size)) { l.qty++; write(); renderCart(); renderScore(); } });
  $$('[data-dec]', dlg).forEach(b => b.onclick = () => { const l = cart[b.dataset.dec]; l.qty > 1 ? l.qty-- : cart.splice(b.dataset.dec, 1); write(); renderCart(); renderScore(); });
  $$('[data-del]', dlg).forEach(b => b.onclick = () => { cart.splice(b.dataset.del, 1); write(); renderCart(); renderScore(); });
  $$('[name=mode]', dlg).forEach(r => r.onchange = () => { order.mode = r.value; if (r.value === 'envio' && order.dep === 'Tolima' && order.city === 'Ibagué') { order.dep = 'Bogotá D.C.'; order.city = 'Bogotá'; } renderCart(); });
  $$('[name=carrier]', dlg).forEach(r => r.onchange = () => { order.carrier = r.value; renderCart(); });
  $$('[name=pay]', dlg).forEach(r => r.onchange = () => { order.pay = r.value; renderCart(); });
  $('#o-paid', dlg)?.addEventListener('change', e => { order.paid = e.target.checked; });
  $$('[data-copy]', dlg).forEach(b => b.onclick = async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); toast('Copiado'); } catch { toast(b.dataset.copy); }
  });
  const qr = $('#pay-qr', dlg);
  if (qr && window.qrcode) { const q = window.qrcode(0, 'M'); q.addData(CONFIG.payments.qrText); q.make(); qr.innerHTML = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); }
  $('#dep', dlg)?.addEventListener('change', e => { order.dep = e.target.value; order.city = ''; renderCart(); $('#city')?.focus(); });
  $('#city', dlg)?.addEventListener('change', e => { order.city = e.target.value; renderCart(); });
  $('#o-gift', dlg)?.addEventListener('change', e => { keep(); order.gift = e.target.checked; renderCart(); });
  $('#o-to', dlg)?.addEventListener('input', e => { order.to = e.target.value; $('.cp-to').textContent = order.to ? 'Para ' + order.to : 'Para alguien especial'; });
  $('#o-msg', dlg)?.addEventListener('input', e => { order.message = e.target.value; $('#cp-msg').textContent = order.message || 'Tu mensaje aparecerá aquí.'; });
  $('#cart-next', dlg)?.addEventListener('click', () => {
    keep();
    if (step === 2 && order.mode === 'envio' && !order.city.trim()) { $('#city')?.focus(); return toast('Escribe la ciudad de destino', 'err'); }
    if (step < 4) { step++; renderCart(); $('.cart-body', dlg).scrollTop = 0; return; }
    if (!order.name.trim()) { $('#o-name').focus(); return toast('Escribe tu nombre para enviar el pedido', 'err'); }
    if (order.mode !== 'recoger' && !order.address.trim()) { $('#o-addr').focus(); return toast('Escribe la dirección de entrega', 'err'); }
    sent = buildOrder(ls.map(l => ({ code: l.code, size: l.size, qty: l.qty, price: priceOf(l.p), list: l.p.price, name: l.p.name, brand: l.p.brand, color: l.p.color })),
      sh, { ...order, name: order.name.trim() });
    open(wa(orderText(sent)), '_blank', 'noopener');
    renderCart();
  });
}

// La solicitud quedó lista: número, resumen y accesos a WhatsApp y a la carta de pedido.
function renderSent(dlg) {
  const o = sent;
  dlg.innerHTML = `<div class="cart">
    <header class="cart-head"><div class="cart-top"><h2>Solicitud lista</h2><button class="x" data-close aria-label="Cerrar">${X}</button></div></header>
    <div class="cart-body sent">
      <img src="assets/brand/cocodrilo-cabeza-verde.svg" alt="" width="84" height="84">
      <p class="sent-no">Pedido N.º ${o.n}</p>
      <h3>Gracias, ${esc(o.c.split(' ')[0])}.</h3>
      <p>${o.p?.m === 'ahora' && o.p.ok ? 'Abrimos WhatsApp con tu solicitud. <b>Adjunta allí la captura del comprobante de pago</b> y la boutique confirma tu pedido.' : 'Abrimos WhatsApp con tu solicitud para enviarla a la boutique. Allí te confirmamos disponibilidad, pago y entrega.'}</p>
      <dl class="recap"><div><dt>Prendas</dt><dd>${o.i.reduce((a, x) => a + x[2], 0)}</dd></div><div><dt>Entrega</dt><dd>${esc(o.e.s)}</dd></div><div><dt>Total</dt><dd><b>${money(o.T)}</b></dd></div></dl>
      <a class="btn btn-brass btn-block" href="${wa(orderText(o))}" target="_blank" rel="noopener">${icon('whatsapp')}Abrir WhatsApp de nuevo</a>
      <a class="btn btn-block" href="${cardURL(o)}" target="_blank" rel="noopener">${icon('receipt')}Ver mi carta de pedido</a>
      <button class="link" id="sent-done">Vaciar el pedido y seguir viendo la colección</button>
    </div></div>`;
  $('#sent-done', dlg).onclick = () => { sent = null; cart = []; step = 1; write(); renderScore(); dlg.close(); };
}

// ---------- eventos ----------
document.addEventListener('click', e => {
  const t = e.target.closest('[data-quick],[data-open],[data-cat],[data-close],[data-cart]');
  if (!t) return;
  if (t.dataset.quick) { const [code, size] = t.dataset.quick.split('|'); add(code, size, t.closest('.frame')); }
  else if (t.dataset.open) openProduct(t.dataset.open);
  else if (t.dataset.cat !== undefined && t.closest('#cat-filters')) { filter.cat = t.dataset.cat; renderCatalog(); }
  else if ('close' in t.dataset) t.closest('dialog').close();
  else if ('cart' in t.dataset) { renderCart(); $('#cart').showModal(); }
});
$$('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));
$('#product').addEventListener('close', () => { openCode = null; });

const form = $('#filters');
form.addEventListener('change', () => { filter = { ...filter, brand: form.brand.value, gender: form.gender.value, size: form.size.value, sort: form.sort.value }; renderCatalog(); });

db.onChange(() => {
  reconcile();
  renderHero(); renderCatalog(); renderScore();
  if (openCode && $('#product').open) openProduct(openCode, $('[data-size][aria-pressed=true]', $('#product'))?.dataset.size);
  if ($('#cart').open) renderCart();
});

// Botones e íconos fijos
$('#top-wa').innerHTML = icon('whatsapp');
$('#bag-ico').outerHTML = icon('bag');
$('#wa-float').innerHTML = icon('whatsapp');
$('#hero-socials').innerHTML = socialButtons();
$('#foot-socials').innerHTML = socialButtons();
$('#bq-links').innerHTML = [
  ['maps', 'Cómo llegar', 'Abre la ruta en Google Maps', LINKS.maps],
  ['whatsapp', 'Escríbenos', `WhatsApp ${STORE.phone}`, LINKS.whatsapp],
  ['instagram', 'Instagram', 'Novedades y llegadas', LINKS.instagram],
  ['facebook', 'Facebook', 'Colecciones y eventos', LINKS.facebook],
  ['star', 'Déjanos tu reseña', 'Tu opinión en Google nos ayuda', LINKS.maps],
].map(([ico, t, s, href]) => `<a class="bq-link" href="${href}" target="_blank" rel="noopener"><span class="bq-ico">${icon(ico)}</span><span><b>${t}</b><small>${s}</small></span>${icon('arrow')}</a>`).join('');

renderHero();
renderCatalog();
reconcile();
renderScore();
// Base compartida: trae el catálogo real y queda escuchando cada venta de la boutique.
db.init().then(() => { ready = true; renderHero(); renderCatalog(); reconcile(); renderScore(); })
  .catch(() => toast('No se pudo cargar la colección. Revisa tu conexión y recarga.', 'err'));
document.body.classList.add('lit');
