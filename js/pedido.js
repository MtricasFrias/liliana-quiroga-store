// Carta de pedido: se arma con los datos que viajan en el enlace y se compara con el catálogo actual.
import * as db from './data.js';
import { money, priceOf, colorHex } from './data.js';
import { garmentSVG } from './garments.js';
import { $, esc, wa, icon, STORE, LINKS } from './util.js';
import { decode, items, deliveryLines, payLines } from './order.js';

const o = decode(location.hash.slice(1));
const letter = $('#letter');

function render(checked) {
  if (!o) {
    letter.innerHTML = `<header class="lt-head"><img src="assets/brand/lq-medallon.svg" alt="" width="96" height="96"><h1>Carta no disponible</h1></header>
      <p class="lt-note">Este enlace de pedido está incompleto. Pide al cliente que lo reenvíe o vuelve a la tienda.</p>`;
    $('#actions').innerHTML = `<a class="btn btn-brass" href="index.html">Ir a la tienda</a>`;
    return;
  }
  const ls = items(o);
  const date = new Date(o.t).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' });
  const off = l => { const p = db.find(l.code); return checked && p && priceOf(p) !== l.price; };
  const art = l => { const p = db.find(l.code); return p ? (p.img ? `<img src="${p.img}" alt="">` : garmentSVG(p)) : `<span class="lt-dot" style="--c:${colorHex(l.color)}"></span>`; };
  letter.innerHTML = `
    <header class="lt-head">
      <img src="assets/brand/lq-medallon.svg" alt="" width="96" height="96">
      <p class="lt-house">${STORE.name}</p>
      <h1>Carta de <em>pedido</em></h1>
      <dl class="lt-meta"><div><dt>N.º</dt><dd>${esc(o.n)}</dd></div><div><dt>Fecha</dt><dd>${date}</dd></div><div><dt>A nombre de</dt><dd>${esc(o.c)}</dd></div></dl>
    </header>
    <section class="lt-sec"><h2>Prendas</h2>
      <ol class="lt-items">${ls.map(l => `<li>
        <span class="lt-art">${art(l)}</span>
        <span class="lt-desc"><b>${esc(l.name)}</b><small>${esc(l.brand)} · ${esc(l.color)} · Talla ${esc(l.size)}</small><small class="lt-ref">Ref. ${esc(l.code)}-${esc(l.size)}${off(l) ? ' · <em>precio por confirmar</em>' : ''}</small></span>
        <span class="lt-amt">${l.qty > 1 ? `<small>${l.qty} × ${money(l.price)}</small>` : ''}${l.price < l.list ? `<s>${money(l.list * l.qty)}</s>` : ''}<b>${money(l.price * l.qty)}</b></span></li>`).join('')}</ol>
    </section>
    <section class="lt-sec lt-two">
      <div><h2>Entrega</h2>${deliveryLines(o).filter(Boolean).map((x, k) => `<p${k ? '' : ' class="lt-strong"'}>${esc(x)}</p>`).join('')}</div>
      <div><h2>Pago</h2>${payLines(o).map((x, k) => `<p${k ? '' : ' class="lt-strong"'}>${esc(x)}</p>`).join('')}</div>
      ${o.g ? `<div><h2>Regalo</h2><figure class="lt-gift"><p class="lt-to">Para ${esc(o.g[0] || 'alguien especial')}</p><blockquote>${esc(o.g[1] || 'Sin mensaje')}</blockquote></figure></div>` : ''}
    </section>
    ${o.o ? `<section class="lt-sec"><h2>Notas</h2><p>${esc(o.o)}</p></section>` : ''}
    <dl class="lt-total"><div><dt>Subtotal</dt><dd>${money(o.s)}</dd></div><div><dt>Envío${o.e.m === 'envio' ? ' (estimado)' : ''}</dt><dd>${o.e.k ? money(o.e.k) : 'Sin costo'}</dd></div><div class="grand"><dt>Total</dt><dd>${money(o.T)}</dd></div></dl>
    <p class="lt-note">Solicitud enviada por WhatsApp. La boutique confirma disponibilidad, forma de pago y entrega antes de despachar.</p>
    <footer class="lt-foot"><span>${STORE.address}</span><span>WhatsApp ${STORE.phone}</span></footer>`;
  $('#actions').innerHTML = `
    <a class="btn btn-brass" href="${wa(`Hola, te escribo por mi pedido N.º ${o.n}.`)}" target="_blank" rel="noopener">${icon('whatsapp')}Escribir a la boutique</a>
    <button class="btn btn-ghost-light" id="print">${icon('print')}Guardar o imprimir</button>
    <a class="btn btn-ghost-light" href="index.html">Volver a la tienda</a>
    <a class="btn btn-ghost-light" href="${LINKS.maps}" target="_blank" rel="noopener">${icon('star')}Califícanos en Google</a>`;
  $('#print').onclick = () => print();
}

render(false);
// Con el catálogo cargado se muestran las prendas y se marca cualquier precio que no coincida.
db.init().then(() => render(true)).catch(() => {});
