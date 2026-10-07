// Única fuente de datos de la tienda y del panel.
// ponytail: vive en localStorage (un navegador, un equipo). Para compartir datos entre
// el celular del local y la web, reemplazar load/save por Supabase/D1 manteniendo esta API.

const KEY = 'lq.store.v2';
const CHANNEL = 'lq:change';

export const CATEGORIES = {
  A: { name: 'Polos', kg: 0.3 },
  B: { name: 'Camisas', kg: 0.35 },
  C: { name: 'Camisetas', kg: 0.25 },
  D: { name: 'Gorras', kg: 0.3 },
  E: { name: 'Suéteres', kg: 0.6 },
};
export const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Única'];
export const METHODS = ['Efectivo', 'Transferencia', 'Nequi', 'Tarjeta'];
export const CHANNELS = ['Local', 'WhatsApp', 'Web'];
export const EXPENSES = ['Compra de mercancía', 'Arriendo', 'Nómina', 'Servicios', 'Envíos', 'Publicidad', 'Otros'];

export const money = n => '$' + Math.round(n).toLocaleString('es-CO');
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// ---------- persistencia ----------
let cache = null;

export function load() {
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(KEY)); } catch { cache = null; }
  if (!cache?.products) { cache = seed(); persist(); }
  return cache;
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(cache)); }
  catch (e) { alert('No se pudo guardar: almacenamiento del navegador lleno. Usa fotos más livianas.'); throw e; }
  dispatchEvent(new CustomEvent(CHANNEL));
}

// Otra pestaña (panel o tienda) cambió los datos: se recarga y se avisa al instante.
export function onChange(fn) {
  addEventListener(CHANNEL, fn);
  addEventListener('storage', e => { if (e.key === KEY) { cache = null; fn(); } });
}

export function resetDemo() { cache = seed(); persist(); }

// ---------- catálogo ----------
export const products = () => load().products;
export const find = code => products().find(p => p.code === code.toUpperCase());
export const totalStock = p => Object.values(p.stock).reduce((a, b) => a + b, 0);
export const sizesOf = p => SIZE_ORDER.filter(s => s in p.stock);

// "a501 m", "A501-M", "A501M" -> { code: 'A501', size: 'M' }
export function parseCode(raw) {
  const m = String(raw).trim().toUpperCase().replace(/\s+/g, '-').match(/^([A-Z])(\d{1,4})-?(XXL|XL|XS|S|M|L|U|UNICA|ÚNICA)?$/);
  if (!m) return null;
  const code = m[1] + m[2].padStart(3, '0');
  const size = m[3] ? (m[3].startsWith('U') || m[3].startsWith('Ú') ? 'Única' : m[3]) : null;
  return { code, size };
}

export function nextCode(cat) {
  const nums = products().filter(p => p.cat === cat).map(p => +p.code.slice(1));
  return cat + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, '0');
}

export function saveProduct(p) {
  const s = load();
  const i = s.products.findIndex(x => x.code === p.code);
  if (i >= 0) s.products[i] = p; else s.products.unshift({ ...p, createdAt: Date.now() });
  persist();
}

export function deleteProduct(code) {
  const s = load();
  s.products = s.products.filter(p => p.code !== code);
  persist();
}

// Entrada de mercancía: suma unidades y, si se indica, registra el egreso de la compra.
export function restock(code, size, qty, unitCost = 0) {
  const p = find(code);
  if (!p || !(qty > 0)) throw new Error('Referencia o cantidad inválida');
  p.stock[size] = (p.stock[size] || 0) + qty;
  if (unitCost > 0) {
    p.cost = unitCost;
    load().cash.push({ id: uid(), at: Date.now(), type: 'out', concept: 'Compra de mercancía', note: `${code}-${size} x${qty}`, amount: unitCost * qty, method: 'Transferencia' });
  }
  persist();
}

// ---------- ventas ----------
// items: [{ code, size, qty }]. Valida stock de todo antes de descontar nada.
export function sell(items, { method = 'Efectivo', channel = 'Local', note = '' } = {}) {
  const lines = items.map(({ code, size, qty }) => {
    const p = find(code);
    if (!p) throw new Error(`No existe la referencia ${code}`);
    if (!(size in p.stock)) throw new Error(`${code} no maneja talla ${size}`);
    if (p.stock[size] < qty) throw new Error(`${code}-${size}: solo quedan ${p.stock[size]}`);
    return { p, size, qty };
  });
  const sale = {
    id: uid(), at: Date.now(), method, channel, note,
    items: lines.map(({ p, size, qty }) => ({ code: p.code, name: p.name, size, qty, price: p.price, cost: p.cost })),
  };
  sale.total = sale.items.reduce((a, i) => a + i.price * i.qty, 0);
  lines.forEach(({ p, size, qty }) => { p.stock[size] -= qty; });
  load().sales.push(sale);
  persist();
  return sale;
}

export function voidSale(id) {
  const s = load();
  const sale = s.sales.find(x => x.id === id);
  if (!sale) return;
  sale.items.forEach(i => { const p = find(i.code); if (p) p.stock[i.size] = (p.stock[i.size] || 0) + i.qty; });
  s.sales = s.sales.filter(x => x.id !== id);
  persist();
}

// ---------- caja ----------
export function addMovement(m) { load().cash.push({ id: uid(), at: Date.now(), ...m }); persist(); }
export function removeMovement(id) { const s = load(); s.cash = s.cash.filter(m => m.id !== id); persist(); }
export function saveClosing(c) { load().closings.push({ id: uid(), at: Date.now(), ...c }); persist(); }
export function setSettings(patch) { Object.assign(load().settings, patch); persist(); }

export const dayKey = t => new Date(t).toLocaleDateString('en-CA');

// Resumen entre dos fechas (ms). Utilidad = ventas − costo de lo vendido − gastos (sin compras de mercancía,
// que son inventario y ya se cuentan en el costo al venderse).
export function summary(from = 0, to = Infinity) {
  const s = load();
  const sales = s.sales.filter(x => x.at >= from && x.at < to);
  const moves = s.cash.filter(x => x.at >= from && x.at < to);
  const revenue = sales.reduce((a, x) => a + x.total, 0);
  const cogs = sales.reduce((a, x) => a + x.items.reduce((b, i) => b + i.cost * i.qty, 0), 0);
  const units = sales.reduce((a, x) => a + x.items.reduce((b, i) => b + i.qty, 0), 0);
  const expenses = moves.filter(m => m.type === 'out' && m.concept !== 'Compra de mercancía').reduce((a, m) => a + m.amount, 0);
  const purchases = moves.filter(m => m.type === 'out' && m.concept === 'Compra de mercancía').reduce((a, m) => a + m.amount, 0);
  const otherIn = moves.filter(m => m.type === 'in').reduce((a, m) => a + m.amount, 0);
  const byMethod = Object.fromEntries(METHODS.map(k => [k, 0]));
  sales.forEach(x => { byMethod[x.method] += x.total; });
  return { sales, moves, revenue, cogs, units, expenses, purchases, otherIn, gross: revenue - cogs, net: revenue - cogs - expenses, byMethod };
}

// Efectivo esperado en el cajón: base + ventas en efectivo + entradas en efectivo − salidas en efectivo, del día.
export function expectedCash(day = dayKey(Date.now())) {
  const s = load();
  const same = t => dayKey(t) === day;
  const cashSales = s.sales.filter(x => same(x.at) && x.method === 'Efectivo').reduce((a, x) => a + x.total, 0);
  const ins = s.cash.filter(m => same(m.at) && m.method === 'Efectivo' && m.type === 'in').reduce((a, m) => a + m.amount, 0);
  const outs = s.cash.filter(m => same(m.at) && m.method === 'Efectivo' && m.type === 'out').reduce((a, m) => a + m.amount, 0);
  return { base: s.settings.openingCash, cashSales, ins, outs, total: s.settings.openingCash + cashSales + ins - outs };
}

export function inventoryValue() {
  return products().reduce((a, p) => {
    const u = totalStock(p);
    return { units: a.units + u, atCost: a.atCost + u * p.cost, atPrice: a.atPrice + u * p.price };
  }, { units: 0, atCost: 0, atPrice: 0 });
}

export function toCSV(rows) {
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return '﻿' + rows.map(r => r.map(esc).join(';')).join('\n');
}

// ---------- datos de demostración ----------
function seed() {
  const P = (code, name, model, gender, color, hex, fabric, fit, price, stock, extra = {}) => ({
    code, cat: code[0], name, model, gender, color, hex, fabric, fit, price, cost: Math.round(price * 0.62 / 1000) * 1000,
    stock, brand: 'Lacoste', img: '', care: 'Lavar a máquina en frío (30 °C) con colores similares. No usar secadora. Planchar a temperatura media.',
    createdAt: Date.now(), ...extra,
  });
  const piq = 'Petit piqué, 100 % algodón';
  const products = [
    P('A501', 'Polo clásico L.12.12', 'polo-clasico', 'Hombre', 'Verde botella', '#14452F', piq, 'Classic fit', 459000, { S: 1, M: 3, L: 2, XL: 1, XXL: 0 }, { isNew: true, details: ['Cuello acanalado', 'Tapeta de dos botones', 'Abertura lateral en el ruedo'] }),
    P('A502', 'Polo clásico L.12.12', 'polo-clasico', 'Hombre', 'Amarillo sol', '#F2C12E', piq, 'Classic fit', 459000, { S: 2, M: 2, L: 0, XL: 1, XXL: 1 }, { img: 'assets/img/p-A502.webp', details: ['Cuello acanalado', 'Tapeta de dos botones', 'Abertura lateral en el ruedo'] }),
    P('A503', 'Polo clásico L.12.12', 'polo-clasico', 'Hombre', 'Lila', '#9C8FD9', piq, 'Classic fit', 459000, { S: 0, M: 2, L: 3, XL: 0, XXL: 0 }, { img: 'assets/img/p-A503.webp', details: ['Cuello acanalado', 'Tapeta de dos botones', 'Abertura lateral en el ruedo'] }),
    P('A504', 'Polo clásico L.12.12', 'polo-clasico', 'Hombre', 'Azul marino', '#1C2A4A', piq, 'Classic fit', 459000, { S: 2, M: 4, L: 4, XL: 2, XXL: 1 }, { details: ['Cuello acanalado', 'Tapeta de dos botones', 'Abertura lateral en el ruedo'] }),
    P('A505', 'Polo clásico L.12.12', 'polo-clasico', 'Hombre', 'Blanco', '#F4F3EF', piq, 'Classic fit', 459000, { S: 3, M: 5, L: 4, XL: 2, XXL: 1 }, { details: ['Cuello acanalado', 'Tapeta de dos botones', 'Abertura lateral en el ruedo'] }),
    P('A506', 'Polo cuello y puños en contraste', 'polo-contraste', 'Hombre', 'Verde menta', '#7FC79A', piq, 'Regular fit', 469000, { S: 1, M: 2, L: 2, XL: 1 }, { isNew: true, trim: '#F4F3EF', details: ['Doble línea en cuello y puños', 'Tapeta de tres botones'] }),
    P('A507', 'Polo cuello y puños en contraste', 'polo-contraste', 'Hombre', 'Azul rey', '#2140A8', piq, 'Regular fit', 469000, { S: 0, M: 1, L: 2, XL: 1 }, { trim: '#F4F3EF', details: ['Doble línea en cuello y puños', 'Tapeta de tres botones'] }),
    P('A508', 'Polo cuello y puños en contraste', 'polo-contraste', 'Hombre', 'Rojo', '#B42A2F', piq, 'Regular fit', 469000, { S: 1, M: 2, L: 1, XL: 0 }, { trim: '#1C2A4A', details: ['Doble línea en cuello y puños', 'Tapeta de tres botones'] }),
    P('A509', 'Polo a rayas náutico', 'polo-rayas', 'Hombre', 'Marino y celeste', '#1C2A4A', 'Jersey de algodón', 'Regular fit', 489000, { S: 1, M: 2, L: 2, XL: 1 }, { stripe: '#7DB4E6', details: ['Rayas tejidas, no estampadas', 'Cuello de tela'] }),
    P('A510', 'Polo sin mangas mujer', 'polo-mujer', 'Mujer', 'Azul marino', '#1C2A4A', 'Piqué stretch, 94 % algodón y 6 % elastano', 'Slim fit', 389000, { XS: 2, S: 3, M: 2, L: 1 }, { img: 'assets/img/p-A510.webp', isNew: true, details: ['Silueta entallada', 'Tapeta de cuatro botones'] }),
    P('A511', 'Polo sin mangas mujer', 'polo-mujer', 'Mujer', 'Celeste agua', '#BFE6E4', 'Piqué stretch, 94 % algodón y 6 % elastano', 'Slim fit', 389000, { XS: 1, S: 2, M: 2, L: 0 }, { img: 'assets/img/p-A511.webp', details: ['Silueta entallada', 'Tapeta de cuatro botones'] }),
    P('A512', 'Polo manga corta mujer', 'polo-mujer-mc', 'Mujer', 'Verde botella', '#14452F', 'Piqué stretch, 94 % algodón y 6 % elastano', 'Slim fit', 419000, { XS: 1, S: 2, M: 3, L: 1 }, { details: ['Silueta entallada', 'Tapeta de cuatro botones'] }),
    P('A513', 'Polo manga corta mujer', 'polo-mujer-mc', 'Mujer', 'Rosa pálido', '#F2D3D6', 'Piqué stretch, 94 % algodón y 6 % elastano', 'Slim fit', 419000, { XS: 0, S: 1, M: 2, L: 1 }, { details: ['Silueta entallada', 'Tapeta de cuatro botones'] }),
    P('B101', 'Camisa de punto manga larga', 'camisa-punto', 'Hombre', 'Celeste', '#A9C6E8', 'Jersey de algodón Pima', 'Regular fit', 549000, { S: 1, M: 2, L: 2, XL: 1 }, { isNew: true, details: ['Cuello camisero', 'Puños con botón', 'Tejido de punto que no se arruga'] }),
    P('B102', 'Camisa Oxford manga larga', 'camisa-oxford', 'Hombre', 'Blanco', '#F4F3EF', 'Oxford, 100 % algodón', 'Slim fit', 529000, { S: 1, M: 3, L: 2, XL: 0 }, { details: ['Cuello abotonado', 'Bolsillo al pecho'] }),
    P('C201', 'Camiseta cuello redondo', 'camiseta', 'Hombre', 'Negro', '#1A1A1A', 'Jersey de algodón Pima', 'Regular fit', 239000, { S: 2, M: 3, L: 3, XL: 1 }, { details: ['Cuello redondo acanalado'] }),
    P('C202', 'Camiseta cuello redondo', 'camiseta', 'Hombre', 'Beige arena', '#D8C7A8', 'Jersey de algodón Pima', 'Regular fit', 239000, { S: 1, M: 2, L: 2, XL: 1 }, { details: ['Cuello redondo acanalado'] }),
    P('D301', 'Gorra de piqué', 'gorra', 'Unisex', 'Azul rey', '#2140A8', 'Piqué de algodón', 'Ajustable', 229000, { 'Única': 3 }, { details: ['Correa ajustable', 'Seis paneles con ojales bordados'] }),
    P('D302', 'Gorra de piqué', 'gorra', 'Unisex', 'Verde lima', '#9BCB3B', 'Piqué de algodón', 'Ajustable', 229000, { 'Única': 2 }, { details: ['Correa ajustable', 'Seis paneles con ojales bordados'] }),
    P('D303', 'Gorra de piqué', 'gorra', 'Unisex', 'Rosa', '#F1B7C8', 'Piqué de algodón', 'Ajustable', 229000, { 'Única': 0 }, { details: ['Correa ajustable', 'Seis paneles con ojales bordados'] }),
    P('D304', 'Gorra de piqué', 'gorra', 'Unisex', 'Gris jaspe', '#A7A9AC', 'Piqué de algodón', 'Ajustable', 229000, { 'Única': 4 }, { details: ['Correa ajustable', 'Seis paneles con ojales bordados'] }),
    P('E401', 'Suéter media cremallera', 'sueter', 'Hombre', 'Azul marino', '#1C2A4A', 'Punto de algodón', 'Regular fit', 689000, { S: 1, M: 2, L: 1, XL: 1 }, { details: ['Media cremallera', 'Puños y ruedo acanalados'] }),
  ];
  const s = { products, sales: [], cash: [], closings: [], settings: { openingCash: 300000, pinHash: '' }, demo: true };

  // Historial de 45 días con un generador determinista, para que el panel se vea vivo.
  let r = 7;
  const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  const day = 864e5;
  const start = new Date(); start.setHours(0, 0, 0, 0);
  for (let d = 45; d >= 1; d--) {
    const base = start.getTime() - d * day;
    const n = Math.floor(rnd() * 4);
    for (let k = 0; k < n; k++) {
      const p = products[Math.floor(rnd() * products.length)];
      const sizes = Object.keys(p.stock);
      const size = sizes[Math.floor(rnd() * sizes.length)];
      const qty = rnd() < 0.85 ? 1 : 2;
      s.sales.push({
        id: uid() + k, at: base + (10 + rnd() * 9) * 36e5, method: METHODS[Math.floor(rnd() * METHODS.length)],
        channel: CHANNELS[Math.floor(rnd() * 3)], note: '',
        items: [{ code: p.code, name: p.name, size, qty, price: p.price, cost: p.cost }], total: p.price * qty,
      });
    }
    const dt = new Date(base).getDate();
    if (dt === 1) s.cash.push({ id: uid() + 'a', at: base + 9 * 36e5, type: 'out', concept: 'Arriendo', note: 'Local', amount: 2800000, method: 'Transferencia' });
    if (dt === 5) s.cash.push({ id: uid() + 'b', at: base + 9 * 36e5, type: 'out', concept: 'Servicios', note: 'Energía, agua, internet', amount: 640000, method: 'Transferencia' });
    if (dt === 15 || dt === 30) s.cash.push({ id: uid() + 'c', at: base + 18 * 36e5, type: 'out', concept: 'Nómina', note: 'Quincena asesora', amount: 950000, method: 'Transferencia' });
    if (dt === 10) s.cash.push({ id: uid() + 'd', at: base + 11 * 36e5, type: 'out', concept: 'Publicidad', note: 'Pauta Instagram y Facebook', amount: 350000, method: 'Tarjeta' });
    if (rnd() < 0.15) s.cash.push({ id: uid() + 'e', at: base + 16 * 36e5, type: 'out', concept: 'Envíos', note: 'Guías Interrapidísimo', amount: 30000 + Math.round(rnd() * 4) * 8000, method: 'Efectivo' });
  }
  return s;
}
