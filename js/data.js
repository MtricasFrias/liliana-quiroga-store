// Única fuente de datos de la tienda y del panel.
// ponytail: vive en localStorage (un navegador, un equipo). Para compartir datos entre el celular
// del local y la web, reemplazar load/persist por Supabase o Cloudflare D1 manteniendo esta API.

const KEY = 'lq.store.v3';
const CHANNEL = 'lq:change';

export const CATEGORIES = {
  A: { name: 'Polos', kg: 0.3 },
  B: { name: 'Camisas', kg: 0.35 },
  C: { name: 'Camisetas', kg: 0.25 },
  D: { name: 'Gorras', kg: 0.3 },
  E: { name: 'Suéteres', kg: 0.6 },
  F: { name: 'Pantalones y bermudas', kg: 0.5 },
  G: { name: 'Accesorios', kg: 0.3 },
};
export const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Única'];
export const METHODS = ['Efectivo', 'Transferencia', 'Nequi', 'Tarjeta'];
export const CHANNELS = ['Tienda', 'WhatsApp', 'Web'];

export const money = n => '$' + Math.round(n).toLocaleString('es-CO');
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const dayKey = t => new Date(t).toLocaleDateString('en-CA');

// Color por nombre, como lo dicen en la tienda ("verde botella", "magenta"). Sin selector RGB.
const COLORS = [['verde botella', '#14452F'], ['verde menta', '#8FD3B0'], ['verde lima', '#A4CF3E'], ['verde oliva', '#6B6B3A'], ['verde', '#2E7D4F'],
  ['azul marino', '#1C2A4A'], ['azul rey', '#2140A8'], ['azul cielo', '#A9CBEB'], ['celeste', '#A9CBEB'], ['turquesa', '#2BB3B1'], ['azul', '#2F5DA8'],
  ['amarillo', '#F2C12E'], ['mostaza', '#C9A227'], ['naranja', '#E9792B'], ['coral', '#EE7C6B'], ['salmón', '#F4A28C'],
  ['rojo', '#B42A2F'], ['vinotinto', '#5E1A2B'], ['burdeos', '#5E1A2B'], ['fucsia', '#C2185B'], ['magenta', '#B5157A'],
  ['rosa pálido', '#F2D3D6'], ['rosado', '#F1B7C8'], ['rosa', '#F1B7C8'], ['lila', '#9C8FD9'], ['morado', '#5B3A8C'], ['lavanda', '#B8A9E3'],
  ['beige', '#D8C7A8'], ['arena', '#D8C7A8'], ['camel', '#B98A57'], ['café', '#5A3E2B'], ['marrón', '#5A3E2B'], ['caqui', '#B5A67A'], ['crema', '#EFE6D2'],
  ['gris jaspe', '#A7A9AC'], ['gris oscuro', '#4A4D52'], ['gris', '#9A9DA1'], ['plata', '#C9CCCF'], ['negro', '#1A1A1A'], ['blanco', '#F6F5F1'], ['marfil', '#F3EEDF']];
export function colorHex(name = '') {
  const n = name.toLowerCase();
  return (COLORS.find(([k]) => n.includes(k)) || [, '#B8B4AA'])[1];
}

// ---------- persistencia ----------
let cache = null;

export function load() {
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(KEY)); } catch { cache = null; }
  if (!cache?.products) { cache = fresh(true); persist(); }
  return cache;
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(cache)); }
  catch (e) { alert('No se pudo guardar: el almacenamiento del navegador está lleno. Usa fotos más livianas.'); throw e; }
  dispatchEvent(new CustomEvent(CHANNEL));
}

// Otra pestaña (panel o tienda) cambió los datos: se recarga y se avisa al instante.
export function onChange(fn) {
  addEventListener(CHANNEL, fn);
  addEventListener('storage', e => { if (e.key === KEY) { cache = null; fn(); } });
}

export function replaceAll(data) { cache = data; persist(); }
export function resetAll(withExamples) { cache = fresh(withExamples); persist(); }

// ---------- catálogo ----------
export const products = () => load().products;
export const find = code => products().find(p => p.code === String(code).toUpperCase());
export const totalStock = p => Object.values(p.stock).reduce((a, b) => a + b, 0);
export const sizesOf = p => SIZE_ORDER.filter(s => s in p.stock);
export const brands = () => [...new Set(products().map(p => p.brand).filter(Boolean))].sort();

// Descuento vigente: { pct, until } con until en formato AAAA-MM-DD (incluido).
export const activeDiscount = p => p.discount && (!p.discount.until || p.discount.until >= dayKey(Date.now())) ? p.discount : null;
export const priceOf = p => { const d = activeDiscount(p); return d ? Math.round(p.price * (1 - d.pct / 100) / 1000) * 1000 : p.price; };

// "a501 m", "A501-M", "A501M" -> { code: 'A501', size: 'M' }
export function parseCode(raw) {
  const m = String(raw).trim().toUpperCase().replace(/\s+/g, '-').match(/^([A-Z])(\d{1,4})-?(XXL|XL|XS|S|M|L|U|UNICA|ÚNICA)?$/);
  if (!m) return null;
  const size = m[3] ? (m[3][0] === 'U' || m[3][0] === 'Ú' ? 'Única' : m[3]) : null;
  return { code: m[1] + m[2].padStart(3, '0'), size };
}

export function nextCode(cat) {
  const nums = products().filter(p => p.cat === cat).map(p => +p.code.slice(1));
  return cat + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, '0');
}

// Guarda una referencia. Las unidades nuevas se registran como compra de mercancía al costo de esa referencia.
export function saveProduct(p, { logPurchase = true } = {}) {
  const s = load();
  const i = s.products.findIndex(x => x.code === p.code);
  const before = i >= 0 ? s.products[i].stock : {};
  if (logPurchase) {
    const added = SIZE_ORDER.reduce((a, z) => a + Math.max(0, (p.stock[z] || 0) - (before[z] || 0)), 0);
    if (added > 0 && p.cost > 0) s.purchases.push({ id: uid(), at: Date.now(), code: p.code, name: p.name, color: p.color, qty: added, unitCost: p.cost, total: added * p.cost });
  }
  if (i >= 0) s.products[i] = p; else s.products.unshift({ ...p, createdAt: Date.now() });
  persist();
}

export function deleteProduct(code) {
  const s = load();
  s.products = s.products.filter(p => p.code !== code);
  persist();
}

export function setDiscount(codes, pct, until) {
  codes.forEach(c => { const p = find(c); if (p) p.discount = pct > 0 ? { pct, until } : null; });
  persist();
}

// Entrada de mercancía: suma unidades a una talla y registra la compra al costo indicado.
export function restock(code, size, qty, unitCost) {
  const p = find(code);
  if (!p || !(qty > 0)) throw new Error('Referencia o cantidad inválida');
  p.stock[size] = (p.stock[size] || 0) + qty;
  if (unitCost > 0) p.cost = unitCost;
  load().purchases.push({ id: uid(), at: Date.now(), code, name: p.name, color: p.color, size, qty, unitCost: p.cost, total: p.cost * qty });
  persist();
}

export function removePurchase(id) { const s = load(); s.purchases = s.purchases.filter(x => x.id !== id); persist(); }

// ---------- ventas ----------
// items: [{ code, size, qty }]. Valida stock de todo antes de descontar nada. Guarda el precio cobrado (con descuento).
export function sell(items, { method = 'Efectivo', channel = 'Tienda', customer = {} } = {}) {
  const lines = items.map(({ code, size, qty }) => {
    const p = find(code);
    if (!p) throw new Error(`No existe la referencia ${code}`);
    if (!(size in p.stock)) throw new Error(`${code} no maneja talla ${size}`);
    if (p.stock[size] < qty) throw new Error(`${code}-${size}: solo quedan ${p.stock[size]}`);
    return { p, size, qty };
  });
  const s = load();
  s.seq = (s.seq || 0) + 1;
  const sale = {
    id: uid(), no: s.seq, at: Date.now(), method, channel, customer,
    items: lines.map(({ p, size, qty }) => ({ code: p.code, name: p.name, brand: p.brand, color: p.color, cat: p.cat, size, qty, list: p.price, price: priceOf(p), cost: p.cost })),
  };
  sale.total = sale.items.reduce((a, i) => a + i.price * i.qty, 0);
  lines.forEach(({ p, size, qty }) => { p.stock[size] -= qty; });
  s.sales.push(sale);
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

// ---------- resumen ----------
export function summary(from = 0, to = Infinity) {
  const s = load();
  const sales = s.sales.filter(x => x.at >= from && x.at < to);
  const purchases = s.purchases.filter(x => x.at >= from && x.at < to);
  const items = sales.flatMap(x => x.items.map(i => ({ ...i, method: x.method, at: x.at })));
  const sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0);
  const group = key => Object.values(items.reduce((acc, i) => {
    const k = key(i); (acc[k] ||= { label: k, value: 0, units: 0, cost: 0 });
    acc[k].value += i.price * i.qty; acc[k].units += i.qty; acc[k].cost += i.cost * i.qty; return acc;
  }, {})).sort((a, b) => b.value - a.value);
  const revenue = sum(sales, x => x.total);
  const cogs = sum(items, i => i.cost * i.qty);
  return {
    sales, purchases, items, revenue, cogs, gross: revenue - cogs,
    units: sum(items, i => i.qty), spent: sum(purchases, x => x.total), discounts: sum(items, i => (i.list - i.price) * i.qty),
    byCat: group(i => CATEGORIES[i.cat]?.name || i.cat), byBrand: group(i => i.brand || 'Sin marca'),
    byMethod: group(i => i.method), byRef: group(i => `${i.code} · ${i.color}`),
  };
}

export function inventoryValue() {
  return products().reduce((a, p) => {
    const u = totalStock(p);
    return { units: a.units + u, atCost: a.atCost + u * p.cost, atPrice: a.atPrice + u * p.price };
  }, { units: 0, atCost: 0, atPrice: 0 });
}

// ---------- redes (registro manual por ahora) ----------
export function addSocial(entry) { load().social.push({ id: uid(), at: Date.now(), ...entry }); persist(); }
export function removeSocial(id) { const s = load(); s.social = s.social.filter(x => x.id !== id); persist(); }
export function setSettings(patch) { Object.assign(load().settings, patch); persist(); }

export function toCSV(rows) {
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return '﻿' + rows.map(r => r.map(esc).join(';')).join('\n');
}

// ---------- estado inicial ----------
// Sin ventas ni compras: las finanzas arrancan en cero. Solo unas referencias de ejemplo para ver la tienda.
function fresh(withExamples) {
  const P = (code, brand, name, model, gender, color, fabric, fit, price, cost, stock, extra = {}) => ({
    code, cat: code[0], brand, name, model, gender, color, fabric, fit, price, cost, stock, img: '', modelImg: '',
    details: [], care: 'Lavar a mano o a máquina en frío con colores similares. No usar secadora.', exclusive: false, discount: null, createdAt: Date.now(), ...extra,
  });
  const piq = 'Petit piqué, 100 % algodón';
  const examples = [
    P('A001', 'Lacoste', 'Polo clásico L.12.12', 'polo', 'Hombre', 'Verde botella', piq, 'Classic fit', 459000, 250000, { S: 1, M: 2, L: 2, XL: 1 }, { details: ['Cuello acanalado', 'Tapeta de dos botones'] }),
    P('A002', 'Lacoste', 'Polo clásico L.12.12', 'polo', 'Hombre', 'Amarillo', piq, 'Classic fit', 459000, 280000, { S: 1, M: 1, L: 2, XL: 0 }, { details: ['Cuello acanalado', 'Tapeta de dos botones'] }),
    P('A003', 'Lacoste', 'Polo sin mangas', 'polo-mujer', 'Mujer', 'Azul marino', 'Piqué stretch, 94 % algodón y 6 % elastano', 'Slim fit', 389000, 210000, { XS: 1, S: 2, M: 1 }),
    P('A004', 'Hugo Boss', 'Polo de algodón', 'polo', 'Hombre', 'Negro', 'Piqué de algodón', 'Slim fit', 529000, 300000, { M: 1, L: 1, XL: 1 }),
    P('B001', 'Hugo Boss', 'Camisa de vestir', 'camisa', 'Hombre', 'Blanco', 'Popelina de algodón', 'Slim fit', 589000, 330000, { M: 1, L: 1 }),
    P('D001', 'Lacoste', 'Gorra de piqué', 'gorra', 'Unisex', 'Azul rey', 'Piqué de algodón', 'Ajustable', 229000, 120000, { 'Única': 3 }),
    P('A005', 'Lacoste', 'Polo edición especial', 'polo-rayas', 'Hombre', 'Azul marino y blanco', 'Piqué de algodón', 'Regular fit', 789000, 450000, { M: 1, L: 1 }, { exclusive: true, stripe: '#F6F5F1' }),
    P('E001', 'Lacoste', 'Suéter de punto fino', 'sueter', 'Hombre', 'Verde botella', 'Lana merino', 'Regular fit', 899000, 520000, { L: 1 }, { exclusive: true }),
  ];
  return { products: withExamples ? examples : [], sales: [], purchases: [], social: [], seq: 0, settings: { pinHash: '' }, examples: withExamples };
}
