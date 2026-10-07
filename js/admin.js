import * as db from './data.js';
import { CATEGORIES, SIZE_ORDER, METHODS, CHANNELS, EXPENSES, money } from './data.js';
import { garmentSVG } from './garments.js';
import { $, $$, esc, toast, download, shrinkImage, X } from './util.js';
import { barChart, hBars } from './charts.js';

// ---------- acceso ----------
// ponytail: PIN validado en el navegador, solo para la vista previa. Con backend real se reemplaza por login del servidor.
const sha = async t => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('lq:' + t)))].map(b => b.toString(16).padStart(2, '0')).join('');
const SESSION = 'lq.admin.ok';

async function gate() {
  const form = $('#gate');
  const hasPin = !!db.load().settings.pinHash;
  $('#gate-title').textContent = hasPin ? 'Ingresa tu PIN' : 'Crea el PIN del panel';
  $('#gate-hint').textContent = hasPin ? 'Acceso solo para administración.' : 'Elige 4 a 8 dígitos. Lo pedirá cada vez que abras el panel.';
  if (sessionStorage.getItem(SESSION) === db.load().settings.pinHash && hasPin) return open();
  form.hidden = false;
  form.onsubmit = async e => {
    e.preventDefault();
    const pin = $('#pin').value.trim();
    if (!/^\d{4,8}$/.test(pin)) return toast('El PIN debe tener de 4 a 8 dígitos', 'err');
    const h = await sha(pin);
    if (!hasPin) db.setSettings({ pinHash: h });
    else if (h !== db.load().settings.pinHash) { $('#pin').value = ''; return toast('PIN incorrecto', 'err'); }
    sessionStorage.setItem(SESSION, h);
    open();
  };
  $('#pin').focus();
}

function open() {
  $('#gate').hidden = true;
  $('#app').hidden = false;
  route();
  addEventListener('hashchange', route);
  db.onChange(() => render(current));
}

// ---------- navegación ----------
const VIEWS = { venta: viewSale, inventario: viewInventory, caja: viewCash, finanzas: viewFinance, etiquetas: viewLabels, ajustes: viewSettings };
let current = 'venta';

function route() {
  current = location.hash.slice(1) in VIEWS ? location.hash.slice(1) : 'venta';
  $$('#nav a').forEach(a => a.setAttribute('aria-current', a.hash === '#' + current ? 'page' : 'false'));
  render(current, true);
}

function render(view, focus = false) {
  const main = $('#view');
  // No redibujar la venta mientras se escribe un código: se pierde el foco del lector de barras.
  if (!focus && view === 'venta' && main.contains(document.activeElement) && document.activeElement.matches('input')) return refreshTicket();
  VIEWS[view](main);
  $('#demo-flag').hidden = !db.load().demo;
  if (focus) main.querySelector('[autofocus]')?.focus();
}

const thumb = p => p.img ? `<img src="${p.img}" alt="">` : garmentSVG(p);
const stockBadge = n => n === 0 ? '<span class="badge out">Agotado</span>' : n <= 2 ? `<span class="badge low">Quedan ${n}</span>` : `<span class="badge">${n} und.</span>`;

// ---------- venta rápida ----------
let ticket = [];
let payMethod = 'Efectivo', channel = 'Local';

function viewSale(main) {
  const today = db.summary(new Date().setHours(0, 0, 0, 0));
  main.innerHTML = `
  <header class="view-head"><div><h1>Venta rápida</h1></div>
    <div class="head-stats"><span>Hoy</span><strong>${money(today.revenue)}</strong><span>${today.units} ${today.units === 1 ? "prenda" : "prendas"} · ${today.sales.length} ${today.sales.length === 1 ? "venta" : "ventas"}</span></div></header>
  <div class="pos-grid">
    <section class="pos-scan panel">
      <form id="scan" autocomplete="off">
        <label for="code">Código de la prenda</label>
        <div class="scan-row"><input id="code" name="code" autofocus placeholder="A501-M" list="refs" spellcheck="false" inputmode="text" aria-describedby="code-help">
          <button class="btn">Agregar</button></div>
        <p id="code-help" class="help">Escribe o escanea la etiqueta. Formato: letra de categoría + referencia + talla (A501-M).</p>
        <datalist id="refs">${db.products().map(p => `<option value="${p.code}">${esc(p.name)} · ${esc(p.color)}</option>`).join('')}</datalist>
      </form>
      <div id="pick"></div>
      <ol id="ticket" class="ticket"></ol>
    </section>
    <aside class="pos-pay panel">
      <fieldset><legend>Medio de pago</legend><div class="chips">${METHODS.map(m => `<button type="button" class="chip" data-pay="${m}" aria-pressed="${m === payMethod}">${m}</button>`).join('')}</div></fieldset>
      <fieldset><legend>Canal</legend><div class="chips">${CHANNELS.map(m => `<button type="button" class="chip" data-ch="${m}" aria-pressed="${m === channel}">${m}</button>`).join('')}</div></fieldset>
      <label for="note">Nota (opcional)</label><input id="note" placeholder="Cliente, guía de envío…">
      <div class="pay-total"><span>Total</span><strong id="ticket-total">$0</strong></div>
      <button id="charge" class="btn btn-primary btn-block" disabled>Registrar venta</button>
    </aside>
  </div>
  <section class="panel">
    <h2>Ventas de hoy</h2>
    ${today.sales.length ? `<table class="table"><thead><tr><th>Hora</th><th>Prendas</th><th>Pago</th><th>Canal</th><th class="num">Total</th><th></th></tr></thead><tbody>
    ${today.sales.slice().reverse().map(s => `<tr><td>${new Date(s.at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</td>
      <td>${s.items.map(i => `<code>${i.code}-${i.size}</code>${i.qty > 1 ? ' ×' + i.qty : ''}`).join(', ')}</td><td>${s.method}</td><td>${s.channel}</td>
      <td class="num">${money(s.total)}</td><td><button class="link danger" data-void="${s.id}">Anular</button></td></tr>`).join('')}</tbody></table>`
    : '<p class="empty">Aún no hay ventas hoy. La primera se registra arriba.</p>'}
  </section>`;

  $('#scan').onsubmit = e => { e.preventDefault(); addCode($('#code').value); };
  // El lector de barras termina con Enter; sin esto el autocompletado del navegador se lo traga.
  $('#code').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); addCode(e.target.value); } };
  $$('[data-pay]').forEach(b => b.onclick = () => { payMethod = b.dataset.pay; $$('[data-pay]').forEach(x => x.setAttribute('aria-pressed', x === b)); });
  $$('[data-ch]').forEach(b => b.onclick = () => { channel = b.dataset.ch; $$('[data-ch]').forEach(x => x.setAttribute('aria-pressed', x === b)); });
  $('#charge').onclick = charge;
  $$('[data-void]').forEach(b => b.onclick = () => { if (confirm('¿Anular esta venta? Las prendas vuelven al inventario.')) { db.voidSale(b.dataset.void); toast('Venta anulada, stock devuelto'); } });
  refreshTicket();
}

function addCode(raw, sizeOverride) {
  const parsed = db.parseCode(raw);
  const p = parsed && db.find(parsed.code);
  $('#pick').innerHTML = '';
  if (!p) return toast(`No encuentro "${raw}". Revisa el código.`, 'err');
  const sizes = db.sizesOf(p);
  const size = sizeOverride || parsed.size || (sizes.length === 1 ? sizes[0] : null);
  if (!size) {
    $('#pick').innerHTML = `<div class="pick"><div class="pick-thumb">${thumb(p)}</div><div><strong>${p.code} · ${esc(p.name)}</strong><span>${esc(p.color)} · ${money(p.price)}</span>
      <div class="chips">${sizes.map(s => `<button type="button" class="chip size" data-size="${s}" ${p.stock[s] ? '' : 'disabled'}>${s}<small>${p.stock[s]}</small></button>`).join('')}</div></div></div>`;
    $$('[data-size]').forEach(b => b.onclick = () => addCode(p.code, b.dataset.size));
    $('[data-size]:not([disabled])')?.focus();
    return;
  }
  if (!(size in p.stock)) return toast(`${p.code} no maneja talla ${size}`, 'err');
  const inTicket = ticket.find(t => t.code === p.code && t.size === size);
  const want = (inTicket?.qty || 0) + 1;
  if (p.stock[size] < want) return toast(`${p.code}-${size} sin unidades disponibles`, 'err');
  if (inTicket) inTicket.qty++; else ticket.push({ code: p.code, size, qty: 1 });
  $('#code').value = '';
  $('#code').focus();
  refreshTicket();
}

function refreshTicket() {
  const ol = $('#ticket');
  if (!ol) return;
  let total = 0;
  ol.innerHTML = ticket.map((t, i) => {
    const p = db.find(t.code);
    total += p.price * t.qty;
    return `<li><div class="t-thumb">${thumb(p)}</div><div class="t-info"><code>${t.code}-${t.size}</code><strong>${esc(p.name)}</strong><span>${esc(p.color)} · quedan ${p.stock[t.size]}</span></div>
      <div class="qty"><button type="button" aria-label="Quitar una" data-dec="${i}">−</button><span>${t.qty}</span><button type="button" aria-label="Agregar una" data-inc="${i}">+</button></div>
      <strong class="num">${money(p.price * t.qty)}</strong><button type="button" class="link danger" data-del="${i}" aria-label="Eliminar ${t.code}-${t.size}">${X}</button></li>`;
  }).join('') || '<li class="empty">El ticket está vacío.</li>';
  $('#ticket-total').textContent = money(total);
  $('#charge').disabled = !ticket.length;
  $('#charge').textContent = ticket.length ? `Registrar venta · ${money(total)}` : 'Registrar venta';
  $$('[data-inc]').forEach(b => b.onclick = () => { const t = ticket[b.dataset.inc]; if (db.find(t.code).stock[t.size] > t.qty) { t.qty++; refreshTicket(); } else toast('No hay más unidades', 'err'); });
  $$('[data-dec]').forEach(b => b.onclick = () => { const t = ticket[b.dataset.dec]; t.qty > 1 ? t.qty-- : ticket.splice(b.dataset.dec, 1); refreshTicket(); });
  $$('[data-del]').forEach(b => b.onclick = () => { ticket.splice(b.dataset.del, 1); refreshTicket(); });
}

function charge() {
  try {
    const sale = db.sell(ticket, { method: payMethod, channel, note: $('#note').value.trim() });
    const sold = sale.items.map(i => { const p = db.find(i.code); return `${i.code}-${i.size}${p.stock[i.size] === 0 ? ' (agotada en la web)' : ''}`; }).join(', ');
    ticket = [];
    toast(`Venta registrada: ${money(sale.total)}. ${sold}`);
    render('venta', true);
  } catch (e) { toast(e.message, 'err'); }
}

// ---------- inventario ----------
let invFilter = { q: '', cat: '', low: false };

function viewInventory(main) {
  const all = db.products();
  const list = all.filter(p => (!invFilter.cat || p.cat === invFilter.cat)
    && (!invFilter.low || Object.values(p.stock).some(n => n <= 1))
    && (!invFilter.q || `${p.code} ${p.name} ${p.color}`.toLowerCase().includes(invFilter.q.toLowerCase())));
  const inv = db.inventoryValue();
  const sizeCols = SIZE_ORDER.filter(s => list.some(p => s in p.stock));
  main.innerHTML = `
  <header class="view-head"><div><h1>Inventario</h1></div>
    <div class="head-actions"><button class="btn" id="btn-in">Entrada de mercancía</button><button class="btn btn-primary" id="btn-new">Nueva referencia</button></div></header>
  <div class="kpis">
    <div class="kpi"><span>Referencias</span><strong>${all.length}</strong></div>
    <div class="kpi"><span>Unidades</span><strong>${inv.units}</strong></div>
    <div class="kpi"><span>Valor a costo</span><strong>${money(inv.atCost)}</strong></div>
    <div class="kpi"><span>Valor a precio de venta</span><strong>${money(inv.atPrice)}</strong></div>
  </div>
  <section class="panel">
    <div class="toolbar">
      <input type="search" id="inv-q" placeholder="Buscar código, prenda o color" value="${esc(invFilter.q)}" aria-label="Buscar">
      <select id="inv-cat" aria-label="Categoría"><option value="">Todas las categorías</option>${Object.entries(CATEGORIES).map(([k, c]) => `<option value="${k}" ${invFilter.cat === k ? 'selected' : ''}>${k} · ${c.name}</option>`).join('')}</select>
      <label class="check"><input type="checkbox" id="inv-low" ${invFilter.low ? 'checked' : ''}> Solo agotado o por agotarse</label>
      <button class="link" id="inv-csv">Exportar CSV</button>
    </div>
    <div class="table-wrap"><table class="table inv">
      <thead><tr><th colspan="2">Referencia</th>${sizeCols.map(s => `<th class="num">${s}</th>`).join('')}<th class="num">Total</th><th class="num">Costo</th><th class="num">Precio</th><th class="num">Margen</th><th></th></tr></thead>
      <tbody>${list.map(p => {
        const tot = db.totalStock(p);
        return `<tr><td class="inv-thumb">${thumb(p)}</td><td><code>${p.code}</code><strong>${esc(p.name)}</strong><span class="muted">${esc(p.color)} · ${p.gender}</span></td>
        ${sizeCols.map(s => s in p.stock ? `<td class="num"><input class="stock-in ${p.stock[s] === 0 ? 'zero' : p.stock[s] <= 1 ? 'low' : ''}" type="number" min="0" value="${p.stock[s]}" data-code="${p.code}" data-size="${s}" aria-label="Stock ${p.code} talla ${s}"></td>` : '<td class="num muted">–</td>').join('')}
        <td class="num">${stockBadge(tot)}</td><td class="num">${money(p.cost)}</td><td class="num">${money(p.price)}</td><td class="num">${Math.round((1 - p.cost / p.price) * 100)} %</td>
        <td><button class="link" data-edit="${p.code}">Editar</button></td></tr>`;
      }).join('') || `<tr><td colspan="9" class="empty">Ninguna referencia coincide.</td></tr>`}</tbody>
    </table></div>
    <p class="help">Cambiar un número ajusta el stock de inmediato y la tienda en línea lo refleja al instante. Para compras con costo usa «Entrada de mercancía».</p>
  </section>`;
  $('#inv-q').oninput = e => { invFilter.q = e.target.value; viewInventory(main); $('#inv-q').focus(); $('#inv-q').setSelectionRange(99, 99); };
  $('#inv-cat').onchange = e => { invFilter.cat = e.target.value; viewInventory(main); };
  $('#inv-low').onchange = e => { invFilter.low = e.target.checked; viewInventory(main); };
  $$('.stock-in').forEach(i => i.onchange = () => {
    const p = db.find(i.dataset.code); const n = Math.max(0, parseInt(i.value, 10) || 0);
    p.stock[i.dataset.size] = n; db.saveProduct(p); toast(`${p.code}-${i.dataset.size}: ${n} en stock`);
  });
  $$('[data-edit]').forEach(b => b.onclick = () => productDialog(db.find(b.dataset.edit)));
  $('#btn-new').onclick = () => productDialog(null);
  $('#btn-in').onclick = restockDialog;
  $('#inv-csv').onclick = () => download('inventario.csv', db.toCSV([['Código', 'Categoría', 'Prenda', 'Color', 'Género', ...SIZE_ORDER, 'Total', 'Costo', 'Precio'],
    ...all.map(p => [p.code, CATEGORIES[p.cat]?.name, p.name, p.color, p.gender, ...SIZE_ORDER.map(s => p.stock[s] ?? ''), db.totalStock(p), p.cost, p.price])]));
}

function productDialog(p) {
  const isNew = !p;
  p = p || { code: db.nextCode('A'), cat: 'A', name: '', brand: 'Lacoste', model: 'polo-clasico', gender: 'Hombre', color: '', hex: '#14452F', fabric: '', fit: 'Regular fit', price: 0, cost: 0, stock: { S: 0, M: 0, L: 0, XL: 0 }, details: [], care: '', img: '' };
  const dlg = $('#dlg');
  const models = { 'polo-clasico': 'Polo', 'polo-contraste': 'Polo con contraste', 'polo-rayas': 'Polo a rayas', 'polo-mujer': 'Polo mujer sin mangas', 'polo-mujer-mc': 'Polo mujer manga corta', 'camisa-punto': 'Camisa', 'camisa-oxford': 'Camisa con bolsillo', camiseta: 'Camiseta', gorra: 'Gorra', sueter: 'Suéter' };
  dlg.innerHTML = `<form method="dialog" class="dlg-form" id="pform">
    <header><h2>${isNew ? 'Nueva referencia' : 'Editar ' + p.code}</h2><button value="cancel" class="link" aria-label="Cerrar">${X}</button></header>
    <div class="form-grid">
      <label>Categoría<select name="cat" ${isNew ? '' : 'disabled'}>${Object.entries(CATEGORIES).map(([k, c]) => `<option value="${k}" ${p.cat === k ? 'selected' : ''}>${k} · ${c.name}</option>`).join('')}</select></label>
      <label>Código<input name="code" value="${p.code}" readonly></label>
      <label class="span2">Nombre de la prenda<input name="name" required value="${esc(p.name)}" placeholder="Polo clásico L.12.12"></label>
      <label>Marca<input name="brand" value="${esc(p.brand)}"></label>
      <label>Género<select name="gender">${['Hombre', 'Mujer', 'Unisex'].map(g => `<option ${p.gender === g ? 'selected' : ''}>${g}</option>`).join('')}</select></label>
      <label>Color<input name="color" required value="${esc(p.color)}" placeholder="Verde botella"></label>
      <label>Tono<input name="hex" type="color" value="${p.hex}"></label>
      <label>Tela y composición<input name="fabric" value="${esc(p.fabric)}" placeholder="Petit piqué, 100 % algodón"></label>
      <label>Ajuste<input name="fit" value="${esc(p.fit)}" placeholder="Classic fit"></label>
      <label>Silueta (ilustración)<select name="model">${Object.entries(models).map(([k, v]) => `<option value="${k}" ${p.model === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label>Foto real<input name="img" type="file" accept="image/*"></label>
      <label>Costo unitario<input name="cost" type="number" min="0" step="1000" value="${p.cost}"></label>
      <label>Precio de venta<input name="price" type="number" min="0" step="1000" required value="${p.price}"></label>
      <label class="span2">Detalles (uno por línea)<textarea name="details" rows="3">${esc((p.details || []).join('\n'))}</textarea></label>
      <label class="span2">Cuidados<textarea name="care" rows="2">${esc(p.care)}</textarea></label>
      <fieldset class="span2"><legend>Tallas y unidades</legend><div class="size-grid">
        ${SIZE_ORDER.map(s => `<label><span>${s}</span><input type="number" min="0" name="sz-${s}" value="${p.stock[s] ?? ''}" placeholder="–"></label>`).join('')}</div>
        <p class="help">Deja vacía la talla que la referencia no maneja. Usa «Única» para gorras.</p></fieldset>
      <label class="check span2"><input type="checkbox" name="isNew" ${p.isNew ? 'checked' : ''}> Marcar como novedad</label>
    </div>
    <footer>${isNew ? '' : '<button type="button" class="link danger" id="pdel">Eliminar referencia</button>'}<span></span><button value="cancel" class="btn">Cancelar</button><button id="psave" value="save" class="btn btn-primary">Guardar</button></footer>
  </form>`;
  const f = $('#pform');
  f.cat.onchange = () => { f.code.value = db.nextCode(f.cat.value); };
  $('#pdel')?.addEventListener('click', () => { if (confirm(`¿Eliminar ${p.code}? Desaparece de la tienda.`)) { db.deleteProduct(p.code); dlg.close(); toast('Referencia eliminada'); } });
  f.onsubmit = async e => {
    if (e.submitter?.value !== 'save') return;
    e.preventDefault();
    const fd = new FormData(f);
    const stock = {};
    SIZE_ORDER.forEach(s => { const v = fd.get('sz-' + s); if (v !== '') stock[s] = Math.max(0, parseInt(v, 10) || 0); });
    if (!Object.keys(stock).length) return toast('Indica al menos una talla', 'err');
    const file = fd.get('img');
    const img = file?.size ? await shrinkImage(file) : p.img;
    const cat = isNew ? fd.get('cat') : p.cat;
    db.saveProduct({ ...p, cat, code: f.code.value, name: fd.get('name').trim(), brand: fd.get('brand').trim(), gender: fd.get('gender'), color: fd.get('color').trim(),
      hex: fd.get('hex'), fabric: fd.get('fabric').trim(), fit: fd.get('fit').trim(), model: fd.get('model'), cost: +fd.get('cost'), price: +fd.get('price'),
      details: fd.get('details').split('\n').map(s => s.trim()).filter(Boolean), care: fd.get('care').trim(), stock, img, isNew: fd.get('isNew') === 'on' });
    dlg.close();
    toast(`${f.code.value} guardada y publicada en la tienda`);
  };
  dlg.showModal();
}

function restockDialog() {
  const dlg = $('#dlg');
  dlg.innerHTML = `<form method="dialog" class="dlg-form" id="rform">
    <header><h2>Entrada de mercancía</h2><button value="cancel" class="link" aria-label="Cerrar">${X}</button></header>
    <div class="form-grid">
      <label class="span2">Código con talla<input name="code" required placeholder="A501-M" list="refs2" autocomplete="off"></label>
      <datalist id="refs2">${db.products().flatMap(p => db.sizesOf(p).map(s => `<option value="${p.code}-${s}">${esc(p.name)} · ${esc(p.color)}</option>`)).join('')}</datalist>
      <label>Unidades<input name="qty" type="number" min="1" value="1" required></label>
      <label>Costo unitario (opcional)<input name="cost" type="number" min="0" step="1000" placeholder="Registra el egreso en caja"></label>
    </div>
    <footer><span></span><button value="cancel" class="btn">Cancelar</button><button value="save" class="btn btn-primary">Sumar al inventario</button></footer></form>`;
  $('#rform').onsubmit = e => {
    if (e.submitter?.value !== 'save') return;
    e.preventDefault();
    const fd = new FormData(e.target);
    const c = db.parseCode(fd.get('code'));
    try {
      if (!c?.size) throw new Error('Escribe el código con talla, por ejemplo A501-M');
      db.restock(c.code, c.size, +fd.get('qty'), +fd.get('cost') || 0);
      dlg.close(); toast(`Entrada registrada: ${c.code}-${c.size} +${fd.get('qty')}`);
    } catch (err) { toast(err.message, 'err'); }
  };
  dlg.showModal();
}

// ---------- caja ----------
function viewCash(main) {
  const s = db.load();
  const exp = db.expectedCash();
  const startMonth = new Date(); startMonth.setDate(1); startMonth.setHours(0, 0, 0, 0);
  const moves = s.cash.filter(m => m.at >= startMonth.getTime()).sort((a, b) => b.at - a.at);
  const closings = s.closings.slice(-8).reverse();
  main.innerHTML = `
  <header class="view-head"><div><h1>Caja de hoy</h1></div>
    <div class="head-stats"><span>Efectivo esperado</span><strong>${money(exp.total)}</strong><span>${new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}</span></div></header>
  <div class="cash-grid">
    <section class="panel ledger">
      <h2>Cuadre de efectivo</h2>
      <dl class="ledger-rows">
        <div><dt>Base de caja</dt><dd>${money(exp.base)}</dd></div>
        <div><dt>Ventas en efectivo</dt><dd>+ ${money(exp.cashSales)}</dd></div>
        <div><dt>Otras entradas en efectivo</dt><dd>+ ${money(exp.ins)}</dd></div>
        <div><dt>Salidas en efectivo</dt><dd>− ${money(exp.outs)}</dd></div>
        <div class="total"><dt>Debe haber en el cajón</dt><dd>${money(exp.total)}</dd></div>
      </dl>
      <form id="close" class="close-form">
        <label for="counted">Efectivo contado</label>
        <div class="scan-row"><input id="counted" type="number" min="0" step="50" required placeholder="0"><button class="btn btn-primary">Cerrar caja</button></div>
        <p id="diff" class="help">Cuenta billetes y monedas e ingresa el total.</p>
      </form>
    </section>
    <section class="panel">
      <h2>Registrar movimiento</h2>
      <form id="move" class="form-grid">
        <label>Tipo<select name="type"><option value="out">Salida (gasto)</option><option value="in">Entrada</option></select></label>
        <label>Concepto<select name="concept">${EXPENSES.map(c => `<option>${c}</option>`).join('')}<option>Otro ingreso</option></select></label>
        <label>Valor<input name="amount" type="number" min="1" step="50" required></label>
        <label>Medio<select name="method">${METHODS.map(m => `<option>${m}</option>`).join('')}</select></label>
        <label class="span2">Nota<input name="note" placeholder="Detalle del movimiento"></label>
        <button class="btn btn-primary span2">Registrar</button>
      </form>
    </section>
  </div>
  <section class="panel">
    <h2>Movimientos del mes</h2>
    ${moves.length ? `<table class="table"><thead><tr><th>Fecha</th><th>Concepto</th><th>Nota</th><th>Medio</th><th class="num">Valor</th><th></th></tr></thead><tbody>
    ${moves.map(m => `<tr><td>${new Date(m.at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}</td><td>${esc(m.concept)}</td><td class="muted">${esc(m.note || '')}</td><td>${m.method}</td>
      <td class="num ${m.type === 'out' ? 'neg' : 'pos'}">${m.type === 'out' ? '−' : '+'} ${money(m.amount)}</td><td><button class="link danger" data-rm="${m.id}" aria-label="Eliminar movimiento">${X}</button></td></tr>`).join('')}
    </tbody></table>` : '<p class="empty">Sin movimientos este mes.</p>'}
  </section>
  ${closings.length ? `<section class="panel"><h2>Cierres anteriores</h2><table class="table"><thead><tr><th>Fecha</th><th class="num">Esperado</th><th class="num">Contado</th><th class="num">Diferencia</th></tr></thead><tbody>
    ${closings.map(c => `<tr><td>${new Date(c.at).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td><td class="num">${money(c.expected)}</td><td class="num">${money(c.counted)}</td>
    <td class="num ${c.counted - c.expected < 0 ? 'neg' : 'pos'}">${money(c.counted - c.expected)}</td></tr>`).join('')}</tbody></table></section>` : ''}`;

  $('#counted').oninput = e => {
    const d = (+e.target.value || 0) - exp.total;
    $('#diff').textContent = !e.target.value ? 'Cuenta billetes y monedas e ingresa el total.' : d === 0 ? 'Cuadra exacto.' : d > 0 ? `Sobran ${money(d)}.` : `Faltan ${money(-d)}.`;
    $('#diff').dataset.state = d === 0 ? 'ok' : d > 0 ? 'over' : 'short';
  };
  $('#close').onsubmit = e => { e.preventDefault(); db.saveClosing({ expected: exp.total, counted: +$('#counted').value }); toast('Cierre de caja guardado'); };
  $('#move').onsubmit = e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    db.addMovement({ type: fd.get('type'), concept: fd.get('concept'), amount: +fd.get('amount'), method: fd.get('method'), note: fd.get('note').trim() });
    toast('Movimiento registrado');
  };
  $$('[data-rm]').forEach(b => b.onclick = () => { if (confirm('¿Eliminar este movimiento?')) db.removeMovement(b.dataset.rm); });
}

// ---------- finanzas ----------
let period = '30d';
const PERIODS = { hoy: 'Hoy', '7d': '7 días', mes: 'Este mes', '30d': '30 días' };

function range() {
  const now = new Date(); const d0 = new Date(now); d0.setHours(0, 0, 0, 0);
  if (period === 'hoy') return [d0.getTime(), 1];
  if (period === '7d') return [d0.getTime() - 6 * 864e5, 7];
  if (period === '30d') return [d0.getTime() - 29 * 864e5, 30];
  const m = new Date(d0); m.setDate(1); return [m.getTime(), now.getDate()];
}

function viewFinance(main) {
  const [from, days] = range();
  const s = db.summary(from);
  const inv = db.inventoryValue();
  const margin = s.revenue ? Math.round(s.gross / s.revenue * 100) : 0;
  const perDay = Array.from({ length: Math.max(days, 7) }, (_, i) => {
    const t0 = from + (i - Math.max(0, 7 - days)) * 864e5;
    const tot = s.sales.filter(x => db.dayKey(x.at) === db.dayKey(t0)).reduce((a, x) => a + x.total, 0);
    return { label: new Date(t0).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }), value: tot };
  });
  const byCat = Object.entries(CATEGORIES).map(([k, c]) => ({ label: c.name, value: s.sales.reduce((a, x) => a + x.items.filter(i => i.code[0] === k).reduce((b, i) => b + i.price * i.qty, 0), 0) })).filter(r => r.value);
  const top = Object.values(s.sales.flatMap(x => x.items).reduce((acc, i) => { (acc[i.code] ||= { label: i.code, value: 0 }).value += i.qty; return acc; }, {})).sort((a, b) => b.value - a.value).slice(0, 6)
    .map(r => ({ ...r, label: `${r.label} · ${db.find(r.label)?.color ?? ''}` }));
  const low = db.products().filter(p => Object.values(p.stock).some(n => n === 0));
  main.innerHTML = `
  <header class="view-head"><div><h1>Resultados</h1></div>
    <div class="chips" role="group" aria-label="Periodo">${Object.entries(PERIODS).map(([k, v]) => `<button class="chip" data-period="${k}" aria-pressed="${k === period}">${v}</button>`).join('')}</div></header>
  <div class="kpis">
    <div class="kpi lead"><span>Ventas</span><strong>${money(s.revenue)}</strong><em>${s.units} prendas · ${s.sales.length} ${s.sales.length === 1 ? "venta" : "ventas"}</em></div>
    <div class="kpi"><span>Utilidad bruta</span><strong>${money(s.gross)}</strong><em>Margen ${margin} %</em></div>
    <div class="kpi"><span>Gastos operativos</span><strong>${money(s.expenses)}</strong><em>Sin compras de mercancía</em></div>
    <div class="kpi ${s.net < 0 ? 'neg' : ''}"><span>Utilidad neta</span><strong>${money(s.net)}</strong><em>Ticket promedio ${money(s.sales.length ? s.revenue / s.sales.length : 0)}</em></div>
  </div>
  <section class="panel"><h2>Ventas por día</h2><div class="chart">${barChart(perDay)}</div></section>
  <div class="cash-grid">
    <section class="panel"><h2>Por categoría</h2>${byCat.length ? hBars(byCat, money) : '<p class="empty">Sin ventas en el periodo.</p>'}</section>
    <section class="panel"><h2>Referencias más vendidas</h2>${top.length ? hBars(top, v => v + ' und.') : '<p class="empty">Sin ventas en el periodo.</p>'}</section>
    <section class="panel"><h2>Por medio de pago</h2>${hBars(Object.entries(s.byMethod).map(([label, value]) => ({ label, value })), money)}</section>
    <section class="panel"><h2>Inventario</h2>
      <dl class="ledger-rows"><div><dt>Unidades en tienda</dt><dd>${inv.units}</dd></div><div><dt>Valor a costo</dt><dd>${money(inv.atCost)}</dd></div>
      <div><dt>Valor a precio de venta</dt><dd>${money(inv.atPrice)}</dd></div><div><dt>Compras de mercancía del periodo</dt><dd>${money(s.purchases)}</dd></div>
      <div class="total"><dt>Referencias con alguna talla agotada</dt><dd>${low.length}</dd></div></dl>
      ${low.length ? `<p class="help">${low.slice(0, 8).map(p => `<code>${p.code}</code>`).join(' ')}${low.length > 8 ? '…' : ''}</p>` : ''}
    </section>
  </div>
  <p class="help"><button class="link" id="sales-csv">Exportar ventas del periodo (CSV)</button> para el contador.</p>`;
  $$('[data-period]').forEach(b => b.onclick = () => { period = b.dataset.period; viewFinance(main); });
  $('#sales-csv').onclick = () => download(`ventas-${period}.csv`, db.toCSV([['Fecha', 'Código', 'Prenda', 'Talla', 'Cant.', 'Precio', 'Costo', 'Medio', 'Canal'],
    ...s.sales.flatMap(x => x.items.map(i => [new Date(x.at).toLocaleString('es-CO'), i.code, i.name, i.size, i.qty, i.price, i.cost, x.method, x.channel]))]));
}

// ---------- etiquetas ----------
const picked = new Set();

function viewLabels(main) {
  const all = db.products();
  main.innerHTML = `
  <header class="view-head"><div><h1>Etiquetas con código de barras</h1></div>
    <div class="head-actions"><label class="check"><input type="checkbox" id="per-unit"> Una etiqueta por unidad en stock</label><button class="btn btn-primary" id="print" ${picked.size ? '' : 'disabled'}>Imprimir ${picked.size ? `(${picked.size})` : ''}</button></div></header>
  <section class="panel no-print">
    <p class="help">Cada etiqueta lleva el código con talla (A501-M) en barras CODE 128. Un lector USB lo escribe en «Venta rápida» y la venta queda registrada al instante.</p>
    <div class="label-pick">${all.map(p => `<label class="pick-item"><input type="checkbox" value="${p.code}" ${picked.has(p.code) ? 'checked' : ''}><span class="pick-thumb">${thumb(p)}</span><span><code>${p.code}</code> ${esc(p.name)}<br><small>${esc(p.color)}</small></span></label>`).join('')}</div>
  </section>
  <div id="sheet" class="label-sheet"></div>`;
  $$('.label-pick input').forEach(i => i.onchange = () => { i.checked ? picked.add(i.value) : picked.delete(i.value); viewLabels(main); });
  $('#per-unit').onchange = drawLabels;
  $('#print').onclick = () => print();
  drawLabels();
}

function drawLabels() {
  const perUnit = $('#per-unit')?.checked;
  const items = [...picked].map(db.find).filter(Boolean).flatMap(p => db.sizesOf(p).flatMap(s => Array(perUnit ? Math.max(0, p.stock[s]) : 1).fill([p, s])));
  $('#sheet').innerHTML = items.map(([p, s], i) => `<article class="tag"><header><img src="assets/brand/cocodrilo.svg" alt=""><span>Liliana Quiroga Store</span></header>
    <strong>${esc(p.name)}</strong><span>${esc(p.color)} · ${esc(p.fabric)}</span><div class="tag-size">${s}</div>
    <svg class="bc" id="bc${i}"></svg><footer><code>${p.code}-${s}</code><b>${money(p.price)}</b></footer></article>`).join('');
  items.forEach(([p, s], i) => {
    const el = $(`#bc${i}`);
    window.JsBarcode?.(el, `${p.code}-${s}`, { format: 'CODE128', height: 34, width: 1.6, displayValue: false, margin: 0 });
    // Escala el código al ancho de la etiqueta sin importar cuántos caracteres tenga.
    el.setAttribute('viewBox', `0 0 ${parseFloat(el.getAttribute('width'))} 34`);
    el.setAttribute('preserveAspectRatio', 'none');
  });
}

// ---------- ajustes ----------
function viewSettings(main) {
  const st = db.load().settings;
  main.innerHTML = `
  <header class="view-head"><div><h1>Ajustes</h1></div></header>
  <div class="cash-grid">
    <section class="panel"><h2>Base de caja</h2><form id="base" class="scan-row"><input name="base" type="number" min="0" step="1000" value="${st.openingCash}" aria-label="Base de caja"><button class="btn btn-primary">Guardar</button></form>
      <p class="help">Efectivo con el que abre el cajón cada día.</p></section>
    <section class="panel"><h2>Cambiar PIN</h2><form id="newpin" class="scan-row"><input name="pin" inputmode="numeric" pattern="\\d{4,8}" required placeholder="Nuevo PIN" aria-label="Nuevo PIN"><button class="btn btn-primary">Cambiar</button></form></section>
    <section class="panel"><h2>Respaldo</h2><p class="help">Los datos viven en este navegador. Descarga un respaldo cada semana.</p>
      <div class="head-actions"><button class="btn" id="backup">Descargar respaldo</button><label class="btn">Restaurar respaldo<input type="file" id="restore" accept="application/json" hidden></label></div></section>
    <section class="panel"><h2>Datos de demostración</h2><p class="help">El catálogo, los precios y las ventas actuales son de ejemplo para la propuesta.</p>
      <button class="btn danger" id="reset">Restablecer datos de ejemplo</button></section>
  </div>`;
  $('#base').onsubmit = e => { e.preventDefault(); db.setSettings({ openingCash: +e.target.base.value }); toast('Base de caja actualizada'); };
  $('#newpin').onsubmit = async e => { e.preventDefault(); const h = await sha(e.target.pin.value); db.setSettings({ pinHash: h }); sessionStorage.setItem(SESSION, h); toast('PIN actualizado'); };
  $('#backup').onclick = () => download(`respaldo-lq-${db.dayKey(Date.now())}.json`, JSON.stringify(db.load()), 'application/json');
  $('#restore').onchange = async e => {
    try {
      const data = JSON.parse(await e.target.files[0].text());
      if (!Array.isArray(data.products) || !Array.isArray(data.sales)) throw new Error();
      localStorage.setItem('lq.store.v1', JSON.stringify(data)); location.reload();
    } catch { toast('Archivo de respaldo inválido', 'err'); }
  };
  $('#reset').onclick = () => { if (confirm('Se borran ventas, movimientos y cambios. ¿Continuar?')) { db.resetDemo(); toast('Datos de ejemplo restablecidos'); } };
}

$('#logout').onclick = () => { sessionStorage.removeItem(SESSION); location.reload(); };
gate();
