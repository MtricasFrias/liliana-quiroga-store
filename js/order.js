// Solicitud de pedido: un solo objeto que alimenta el mensaje de WhatsApp y la carta de pedido (pedido.html).
// ponytail: la carta viaja dentro del enlace (sin servidor). Con la base compartida se puede guardar y numerar en Supabase.
import { money } from './data.js';
import { STORE } from './util.js';

export function orderNo(t = Date.now()) {
  const d = new Date(t);
  const ymd = String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  return `LQ-${ymd}-${String(Math.floor(1000 + Math.random() * 9000))}`;
}

// lines: [{ code, size, qty, price, list, name, brand, color }]; ship: { name, cost, days }; who: datos del cliente.
export function buildOrder(lines, ship, who) {
  const sub = lines.reduce((a, l) => a + l.price * l.qty, 0);
  return {
    v: 1, n: orderNo(), t: Date.now(), c: who.name,
    i: lines.map(l => [l.code, l.size, l.qty, l.price, l.list, l.name, l.brand, l.color]),
    e: { m: who.mode, s: ship.name, k: ship.cost || 0, d: ship.days || '', city: who.city || '', dep: who.dep || '', a: who.address || '' },
    g: who.gift ? [who.to || '', who.message || ''] : 0, o: who.notes || '', s: sub, T: sub + (ship.cost || 0),
    p: { m: who.pay || 'persona', ok: !!who.paid },
  };
}

export const items = o => o.i.map(([code, size, qty, price, list, name, brand, color]) => ({ code, size, qty, price, list, name, brand, color }));

const toB64 = s => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64 = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)));
export const encode = o => toB64(JSON.stringify(o));
export function decode(s) {
  try { const o = JSON.parse(fromB64(s)); return o?.v === 1 && Array.isArray(o.i) ? o : null; } catch { return null; }
}
export const cardURL = o => new URL('pedido.html', location.href).href.split('#')[0] + '#' + encode(o);

// Cómo se va a pagar, en palabras del cliente.
export function payLines(o) {
  const p = o.p || { m: 'persona' };
  if (p.m === 'ahora') return ['Pago en línea con Bre-B o QR Bancolombia', p.ok ? 'Ya realicé el pago; adjunto el comprobante en este chat.' : 'Pagaré en línea cuando confirmen disponibilidad.'];
  if (o.e.m === 'recoger') return ['Pago en la boutique al recoger'];
  if (o.e.m === 'domicilio') return ['Pago al recibir el domicilio'];
  return ['Quiero coordinar el pago con un asesor'];
}

export function deliveryLines(o) {
  const e = o.e;
  if (e.m === 'recoger') return ['Recoger en la boutique', STORE.address];
  if (e.m === 'domicilio') return ['Domicilio en Ibagué', e.a && `Dirección: ${e.a}`, e.d];
  return [`Envío a ${e.city}, ${e.dep}`, `${e.s} · ${e.d}`, e.a && `Dirección: ${e.a}`];
}

// Mensaje de WhatsApp con el formato de la app: *negrita*, _cursiva_ y > cita.
export function orderText(o) {
  const rule = '──────────────';
  const ls = items(o);
  return [
    `*${STORE.name.toUpperCase()}*`, `_Solicitud de pedido N.º ${o.n}_`, rule, '',
    `Hola, soy *${o.c}* y quiero hacer este pedido:`, '',
    '*PRENDAS*',
    ...ls.flatMap((l, k) => [`${k + 1}. *${l.name}* · ${l.brand}`, `    ${l.color} · Talla ${l.size} · Ref. ${l.code}-${l.size}`,
      `    ${l.qty} × ${money(l.price)}${l.price < l.list ? ` _(antes ${money(l.list)})_` : ''}`]), '',
    '*ENTREGA*', ...deliveryLines(o).filter(Boolean), '',
    '*PAGO*', ...payLines(o), '',
    ...(o.g ? ['*REGALO*', `Para: ${o.g[0] || 'alguien especial'}`, ...(o.g[1] ? o.g[1].split('\n').map(x => `> ${x}`) : []), ''] : []),
    '*RESUMEN*', `Subtotal: ${money(o.s)}`, `Envío${o.e.m === 'envio' ? ' (estimado)' : ''}: ${o.e.k ? money(o.e.k) : 'sin costo'}`, `*Total: ${money(o.T)}*`, '',
    ...(o.o ? [`_Notas:_ ${o.o}`, ''] : []),
    rule, 'Carta de pedido:', cardURL(o),
  ].join('\n');
}
