import * as db from './data.js';
import { CATEGORIES, money } from './data.js';
import { garmentSVG } from './garments.js';
import { quote, DEPARTMENTS } from './shipping.js';
import { $, $$, esc, wa, toast, X } from './util.js';

const CART = 'lq.cart.v1';
let cart = read();
let filter = { cat: '', gender: '', size: '', sort: 'new' };
let openCode = null;
let ship = { dep: 'Tolima', city: 'Ibagué', option: 'recoger' };

function read() { try { return JSON.parse(localStorage.getItem(CART)) || []; } catch { return []; } }
function write() { try { localStorage.setItem(CART, JSON.stringify(cart)); } catch { /* modo privado: el carrito vive solo en memoria */ } }

const art = (p, cls = '') => p.img ? `<img class="${cls}" src="${p.img}" alt="${esc(p.name)}, ${esc(p.color)}" loading="lazy">` : garmentSVG(p);
const stockLeft = (code, size) => db.find(code)?.stock[size] ?? 0;

// ---------- catálogo ----------
function renderCatalog() {
  const all = db.products();
  let list = all.filter(p => (!filter.cat || p.cat === filter.cat) && (!filter.gender || p.gender === filter.gender || p.gender === 'Unisex')
    && (!filter.size || p.stock[filter.size] > 0));
  if (filter.sort === 'low') list = [...list].sort((a, b) => a.price - b.price);
  if (filter.sort === 'high') list = [...list].sort((a, b) => b.price - a.price);
  if (filter.sort === 'new') list = [...list].sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));

  $('#cat-filters').innerHTML = [['', 'Todo']].concat(Object.entries(CATEGORIES).filter(([k]) => all.some(p => p.cat === k)).map(([k, c]) => [k, c.name]))
    .map(([k, n]) => `<button class="tab" data-cat="${k}" aria-pressed="${filter.cat === k}"><span class="plq">${k || '·'}</span>${n}<small>${k ? all.filter(p => p.cat === k).length : all.length}</small></button>`).join('');
  $('#count').textContent = `${list.length} ${list.length === 1 ? 'referencia' : 'referencias'}`;
  $('#grid').innerHTML = list.map(p => {
    const sizes = db.sizesOf(p);
    const out = db.totalStock(p) === 0;
    return `<article class="card ${out ? 'is-out' : ''}">
      <button class="card-hit" data-open="${p.code}" aria-label="Ver ${esc(p.name)} ${esc(p.color)}"></button>
      <div class="card-art">${art(p)}${p.isNew ? '<span class="flag">Nuevo</span>' : ''}${out ? '<span class="flag out">Agotado</span>' : ''}${p.img ? '' : '<span class="illus">Ilustración</span>'}<span class="plaque">${p.code}</span></div>
      <div class="card-body">
        <h3>${esc(p.name)}</h3>
        <p class="card-color"><i style="--c:${p.hex}"></i>${esc(p.color)}</p>
        <p class="card-price">${money(p.price)}</p>
        <ul class="sizes" aria-label="Tallas">${sizes.map(s => `<li class="${p.stock[s] ? '' : 'gone'}" title="${p.stock[s] ? 'Disponible' : 'Agotada'}">${s}</li>`).join('')}</ul>
      </div>
    </article>`;
  }).join('') || '<p class="empty">No hay prendas con ese filtro. Prueba otra talla o escríbenos por WhatsApp.</p>';
}

// ---------- ficha de producto ----------
function openProduct(code, size = null) {
  const p = db.find(code);
  if (!p) return;
  openCode = code;
  const sizes = db.sizesOf(p);
  const siblings = db.products().filter(x => x.model === p.model && x.gender === p.gender);
  const pick = size && p.stock[size] ? size : (sizes.length === 1 && p.stock[sizes[0]] ? sizes[0] : null);
  const dlg = $('#product');
  dlg.innerHTML = `<div class="pd">
    <button class="pd-close" data-close aria-label="Cerrar">${X}</button>
    <div class="pd-art">${art(p)}</div>
    <div class="pd-info">
      <h2>${esc(p.name)}</h2>
      <div class="pd-price-row"><p class="pd-price">${money(p.price)}</p><span class="plaque">Ref. ${p.code}</span></div>
      ${siblings.length > 1 ? `<fieldset class="pd-colors"><legend>Color: <b>${esc(p.color)}</b></legend>
        ${siblings.map(x => `<button class="swatch" style="--c:${x.hex}" data-sib="${x.code}" aria-pressed="${x.code === p.code}" aria-label="${esc(x.color)}${db.totalStock(x) ? '' : ' (agotado)'}" ${db.totalStock(x) ? '' : 'data-out'}></button>`).join('')}</fieldset>` : `<p class="pd-color"><i style="--c:${p.hex}"></i>${esc(p.color)}</p>`}
      <fieldset class="pd-sizes"><legend>Talla</legend>
        <div class="size-row">${sizes.map(s => `<button class="size" data-size="${s}" aria-pressed="${s === pick}" ${p.stock[s] ? '' : 'disabled'}>${s}</button>`).join('')}</div>
        <p class="pd-stock" id="pd-stock">${pick ? stockNote(p, pick) : 'Elige tu talla.'}</p>
      </fieldset>
      <button class="btn btn-primary btn-block" id="pd-add" ${pick ? '' : 'disabled'}>${db.totalStock(p) ? 'Agregar al pedido' : 'Agotado'}</button>
      <a class="btn btn-ghost btn-block" target="_blank" rel="noopener" href="${wa(`Hola, quiero asesoría con la referencia ${p.code} (${p.name}, ${p.color}).`)}">Pedir asesoría por WhatsApp</a>
      <dl class="spec">
        <div><dt>Marca</dt><dd>${esc(p.brand)} · original</dd></div>
        <div><dt>Tela</dt><dd>${esc(p.fabric)}</dd></div>
        <div><dt>Ajuste</dt><dd>${esc(p.fit)}</dd></div>
        <div><dt>Color</dt><dd>${esc(p.color)}</dd></div>
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
  $('#pd-add').onclick = () => { add(p.code, chosen, $('.pd-art', dlg)); dlg.close(); };
  if (!dlg.open) dlg.showModal();
}

const stockNote = (p, s) => p.stock[s] === 1 ? '<b>Última unidad</b> en esta talla.' : p.stock[s] <= 3 ? `Quedan <b>${p.stock[s]}</b> en talla ${s}.` : `Disponible en talla ${s}.`;

// ---------- carrito ----------
function add(code, size, fromEl) {
  const line = cart.find(l => l.code === code && l.size === size);
  if ((line?.qty || 0) + 1 > stockLeft(code, size)) return toast('No hay más unidades en esa talla', 'err');
  line ? line.qty++ : cart.push({ code, size, qty: 1 });
  write();
  renderScore();
  flyTo(fromEl);
  const p = db.find(code);
  toast(`${p.name} · ${p.color} · talla ${size} agregada`);
}

// La prenda viaja al marcador del pedido.
function flyTo(fromEl) {
  const target = $('#score-thumbs');
  if (!fromEl || !target || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const a = fromEl.getBoundingClientRect(), b = target.getBoundingClientRect();
  const ghost = fromEl.cloneNode(true);
  Object.assign(ghost.style, { position: 'fixed', left: a.left + 'px', top: a.top + 'px', width: a.width + 'px', height: a.height + 'px', zIndex: 99, pointerEvents: 'none', margin: 0 });
  ghost.className = 'fly';
  document.body.append(ghost);
  ghost.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${b.left - a.left}px, ${b.top - a.top}px) scale(${48 / a.width})`, opacity: 0.2 }],
    { duration: 650, easing: 'cubic-bezier(.6,.05,.3,1)' }).onfinish = () => ghost.remove();
}

// Ajusta el carrito si una venta en el local agotó una talla.
function reconcile() {
  let changed = false;
  cart.forEach(l => { const left = stockLeft(l.code, l.size); if (l.qty > left) { l.qty = left; changed = true; } });
  const before = cart.length;
  cart = cart.filter(l => l.qty > 0 && db.find(l.code));
  if (changed || before !== cart.length) { write(); toast('Una prenda de tu pedido se acaba de agotar en la tienda. Ajustamos tu pedido.', 'err'); }
}

const lines = () => cart.map(l => ({ ...l, p: db.find(l.code) })).filter(l => l.p);
const subtotal = () => lines().reduce((a, l) => a + l.p.price * l.qty, 0);

function renderScore() {
  const ls = lines();
  const n = ls.reduce((a, l) => a + l.qty, 0);
  const bar = $('#score');
  bar.hidden = !n;
  $('#score-thumbs').innerHTML = ls.slice(-4).map(l => `<span class="mini">${art(l.p)}</span>`).join('');
  tick($('#score-count'), n, String);
  tick($('#score-total'), subtotal(), money);
  $('#cart-count').textContent = n;
  $('#cart-count').hidden = !n;
}

// Los números del marcador corren hasta el nuevo valor, como un marcador de club.
function tick(el, to, fmt) {
  const from = +el.dataset.v || 0;
  el.dataset.v = to;
  if (from === to || matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = fmt(to); return; }
  const t0 = performance.now();
  const step = t => { const k = Math.min(1, (t - t0) / 650); el.textContent = fmt(Math.round(from + (to - from) * (1 - (1 - k) ** 3))); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

function renderCart() {
  const ls = lines();
  const sub = subtotal();
  const opts = quote(ls, sub, ship.dep, ship.city);
  if (!opts.some(o => o.id === ship.option)) ship.option = opts[0]?.id;
  const o = opts.find(x => x.id === ship.option);
  const local = o?.zone === 'local';
  const dlg = $('#cart');
  dlg.innerHTML = `<div class="cart">
    <header class="cart-head"><h2>Tu pedido</h2><button data-close class="pd-close" aria-label="Cerrar">${X}</button></header>
    ${ls.length ? `<ol class="cart-lines">${ls.map((l, i) => `<li>
      <div class="cl-art">${art(l.p)}</div>
      <div class="cl-info"><strong>${esc(l.p.name)}</strong><span>${esc(l.p.color)} · Talla <b>${l.size}</b></span><span class="muted">Ref. ${l.code}-${l.size} · ${money(l.p.price)} c/u</span>
        <div class="qty"><button aria-label="Quitar una" data-dec="${i}">−</button><span aria-live="polite">${l.qty}</span><button aria-label="Agregar una" data-inc="${i}" ${l.qty >= stockLeft(l.code, l.size) ? 'disabled' : ''}>+</button></div></div>
      <div class="cl-end"><strong>${money(l.p.price * l.qty)}</strong><button class="link" data-del="${i}">Quitar</button></div></li>`).join('')}</ol>

    <section class="cart-ship"><h3>Entrega</h3>
      <div class="ship-dest">
        <label>Departamento<select id="dep">${DEPARTMENTS.map(d => `<option ${d === ship.dep ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
        <label>Ciudad o municipio<input id="city" value="${esc(ship.city)}" autocomplete="address-level2"></label>
      </div>
      <div class="ship-opts" role="radiogroup" aria-label="Forma de envío">${opts.map(x => `<label class="ship-opt"><input type="radio" name="ship" value="${x.id}" ${x.id === ship.option ? 'checked' : ''}>
        <span><b>${x.name}</b><small>${x.days}${x.kg ? ` · ${x.kg} kg facturable` : ''}</small></span><strong>${x.cost ? money(x.cost) : 'Gratis'}</strong></label>`).join('')}</div>
      ${o && !local ? `<p class="help">Flete ${money(o.flete)} + manejo sobre valor declarado ${money(o.manejo)}. Valor estimado: se confirma al generar la guía.</p>` : ''}
    </section>

    <section class="cart-who"><h3>Tus datos</h3>
      <label>Nombre<input id="who" autocomplete="name" required></label>
      ${ship.option === 'recoger' ? '' : '<label>Dirección de entrega<input id="addr" autocomplete="street-address"></label>'}
      <label>Notas (opcional)<input id="notes" placeholder="Para regalo, horario de entrega…"></label>
    </section>

    <footer class="cart-total">
      <dl><div><dt>Subtotal</dt><dd>${money(sub)}</dd></div><div><dt>Envío ${o && !local ? '(estimado)' : ''}</dt><dd>${o ? (o.cost ? money(o.cost) : 'Gratis') : '—'}</dd></div>
      <div class="grand"><dt>Total</dt><dd>${money(sub + (o?.cost || 0))}</dd></div></dl>
      <button class="btn btn-primary btn-block" id="checkout">Enviar pedido por WhatsApp</button>
      <p class="help">Confirmamos disponibilidad, pago y envío contigo por WhatsApp. Todas nuestras prendas son originales.</p>
    </footer>`
    : `<div class="cart-empty"><p>Tu pedido está vacío.</p><button class="btn" data-close>Ver la colección</button></div>`}
  </div>`;

  $$('[data-inc]', dlg).forEach(b => b.onclick = () => { const l = cart[b.dataset.inc]; if (l.qty < stockLeft(l.code, l.size)) { l.qty++; write(); renderCart(); renderScore(); } });
  $$('[data-dec]', dlg).forEach(b => b.onclick = () => { const l = cart[b.dataset.dec]; l.qty > 1 ? l.qty-- : cart.splice(b.dataset.dec, 1); write(); renderCart(); renderScore(); });
  $$('[data-del]', dlg).forEach(b => b.onclick = () => { cart.splice(b.dataset.del, 1); write(); renderCart(); renderScore(); });
  $('#dep', dlg)?.addEventListener('change', e => { ship.dep = e.target.value; ship.city = e.target.value === 'Tolima' ? 'Ibagué' : ''; renderCart(); });
  $('#city', dlg)?.addEventListener('change', e => { ship.city = e.target.value; renderCart(); });
  $$('[name=ship]', dlg).forEach(r => r.onchange = () => { ship.option = r.value; renderCart(); });
  $('#checkout', dlg)?.addEventListener('click', () => {
    const who = $('#who').value.trim();
    if (!who) { $('#who').focus(); return toast('Escribe tu nombre para enviar el pedido', 'err'); }
    if (!ship.city.trim()) { $('#city').focus(); return toast('Escribe tu ciudad', 'err'); }
    const msg = [`Hola Liliana Quiroga Store, quiero hacer este pedido:`, '',
      ...ls.map((l, i) => `${i + 1}. ${l.code}-${l.size} · ${l.p.name} · ${l.p.color} · Talla ${l.size} × ${l.qty} · ${money(l.p.price * l.qty)}`), '',
      `Subtotal: ${money(sub)}`, `Envío: ${o ? `${o.name}${local ? '' : ' (estimado)'} ${o.cost ? money(o.cost) : 'gratis'}` : 'por confirmar'}`,
      `Total: ${money(sub + (o?.cost || 0))}`, '', `Nombre: ${who}`, `Destino: ${ship.city}, ${ship.dep}`,
      $('#addr')?.value.trim() ? `Dirección: ${$('#addr').value.trim()}` : '', $('#notes').value.trim() ? `Notas: ${$('#notes').value.trim()}` : '']
      .filter((x, i, a) => x !== '' || a[i - 1] !== '').join('\n');
    open(wa(msg), '_blank', 'noopener');
  });
}

// ---------- eventos ----------
document.addEventListener('click', e => {
  const t = e.target.closest('[data-open],[data-cat],[data-close],[data-cart],[data-filter-gender],[data-shop]');
  if (!t) return;
  if (t.dataset.open) openProduct(t.dataset.open);
  else if (t.dataset.cat !== undefined) { filter.cat = t.dataset.cat; renderCatalog(); }
  else if ('close' in t.dataset) t.closest('dialog').close();
  else if ('cart' in t.dataset) { renderCart(); $('#cart').showModal(); }
  else if (t.dataset.filterGender !== undefined) { filter.gender = t.dataset.filterGender; filter.cat = 'A'; syncFilterForm(); renderCatalog(); }
  else if (t.dataset.shop) { const [code, size] = t.dataset.shop.split('|'); openProduct(code, size); }
});
$$('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));
$('#product').addEventListener('close', () => { openCode = null; });

const form = $('#filters');
function syncFilterForm() { form.gender.value = filter.gender; form.size.value = filter.size; form.sort.value = filter.sort; }
form.addEventListener('change', () => { filter = { ...filter, gender: form.gender.value, size: form.size.value, sort: form.sort.value }; renderCatalog(); });

db.onChange(() => {
  reconcile();
  renderCatalog();
  renderScore();
  if (openCode && $('#product').open) openProduct(openCode, $('[data-size][aria-pressed=true]', $('#product'))?.dataset.size);
  if ($('#cart').open) renderCart();
});

renderCatalog();
reconcile();
renderScore();
$('#demo-flag').hidden = !db.load().demo;
