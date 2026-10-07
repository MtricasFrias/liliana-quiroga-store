// Única fuente de datos de la tienda y del panel.
// Dos modos con la misma API:
//  - Base compartida (Supabase), cuando js/config.js tiene URL y clave: todos los equipos ven el mismo inventario en vivo.
//  - Vista previa (localStorage), cuando config está vacío: los datos viven solo en este navegador.
import { CONFIG } from './config.js';

const KEY = 'lq.store.v3';
const CHANNEL = 'lq:change';
const REMOTE = !!(CONFIG.supabaseUrl && CONFIG.supabaseKey);
const BUCKET = 'prendas';
let sb = null;

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
export const isRemote = () => REMOTE;

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

// ---------- estado en memoria ----------
let cache = null;
const emit = () => dispatchEvent(new CustomEvent(CHANNEL));

export function load() {
  if (cache) return cache;
  if (REMOTE) return (cache = empty(false));          // se llena en init()
  try { cache = JSON.parse(localStorage.getItem(KEY)); } catch { cache = null; }
  if (!cache?.products) { cache = fresh(true); persist(); }
  return cache;
}

function persist() {
  if (REMOTE) return emit();
  try { localStorage.setItem(KEY, JSON.stringify(cache)); }
  catch (e) { alert('No se pudo guardar: el almacenamiento del navegador está lleno. Usa fotos más livianas.'); throw e; }
  emit();
}

export function onChange(fn) {
  addEventListener(CHANNEL, fn);
  if (!REMOTE) addEventListener('storage', e => { if (e.key === KEY) { cache = null; fn(); } });
}

// ---------- conexión a la base compartida ----------
const toMs = t => typeof t === 'number' ? t : Date.parse(t);
const rowSale = r => ({ ...r.data, id: r.id, no: r.no, at: toMs(r.at) });
const rowMove = r => ({ ...r.data, id: r.id, at: toMs(r.at) });

// admin: además del catálogo trae ventas, compras y redes (requiere sesión de administrador).
export async function init({ admin = false } = {}) {
  load();
  if (!REMOTE) return;
  if (!sb) {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
    sb = createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);
  }
  const { data: rows, error } = await sb.from('products').select('data').order('updated_at', { ascending: false });
  if (error) throw new Error('No se pudo leer el catálogo: ' + error.message);
  cache.products = rows.map(r => r.data);
  if (admin && await session()) await loadAdmin();
  subscribe(admin);
  emit();
}

async function loadAdmin() {
  const [s, p, so] = await Promise.all([
    sb.from('sales').select('*').order('at'), sb.from('purchases').select('*').order('at'), sb.from('social').select('*').order('at')]);
  const err = s.error || p.error || so.error;
  if (err) throw new Error(err.message);
  cache.sales = s.data.map(rowSale);
  cache.purchases = p.data.map(rowMove);
  cache.social = so.data.map(rowMove);
}

let live = null;
function subscribe(admin) {
  if (live) sb.removeChannel(live);
  const upsert = (list, item, key = 'id') => { const i = list.findIndex(x => x[key] === item[key]); i >= 0 ? (list[i] = item) : list.push(item); };
  const drop = (list, val, key = 'id') => list.splice(0, list.length, ...list.filter(x => x[key] !== val));
  live = sb.channel('lq-live').on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, e => {
    e.eventType === 'DELETE' ? drop(cache.products, e.old.code, 'code') : upsert(cache.products, e.new.data, 'code');
    emit();
  });
  if (admin) {
    const tables = { sales: [rowSale, () => cache.sales], purchases: [rowMove, () => cache.purchases], social: [rowMove, () => cache.social] };
    Object.entries(tables).forEach(([t, [map, list]]) => live.on('postgres_changes', { event: '*', schema: 'public', table: t }, e => {
      e.eventType === 'DELETE' ? drop(list(), e.old.id) : upsert(list(), map(e.new));
      emit();
    }));
  }
  live.subscribe();
}

// Si la base devolvió un error, se recarga lo real para no mostrar algo que no se guardó.
async function remote(fn) {
  const { data, error } = await fn();
  if (error) { await init({ admin: !!(await session()) }).catch(() => {}); throw new Error(error.message.replace(/^.*?: /, '')); }
  return data;
}

// ---------- sesión de administrador (base compartida) ----------
export async function session() { return REMOTE && sb ? (await sb.auth.getSession()).data.session : null; }
export async function isAdmin() { return !!(sb && (await sb.rpc('is_admin')).data); }
export async function signIn(email, password) {
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error('Correo o contraseña incorrectos');
  if (!(await isAdmin())) { await signOut(); throw new Error('Este correo no está autorizado como administrador'); }
  await loadAdmin();
  subscribe(true);
  emit();
}
export async function signOut() { if (sb) await sb.auth.signOut(); }

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
export async function saveProduct(p, { logPurchase = true } = {}) {
  const s = load();
  const i = s.products.findIndex(x => x.code === p.code);
  const before = i >= 0 ? s.products[i].stock : {};
  const added = logPurchase ? SIZE_ORDER.reduce((a, z) => a + Math.max(0, (p.stock[z] || 0) - (before[z] || 0)), 0) : 0;
  const item = i >= 0 ? p : { ...p, createdAt: Date.now() };
  const purchase = added > 0 && p.cost > 0 ? { code: p.code, name: p.name, color: p.color, qty: added, unitCost: p.cost, total: added * p.cost } : null;
  if (REMOTE) {
    await remote(() => sb.from('products').upsert({ code: item.code, data: item, updated_at: new Date().toISOString() }));
    if (purchase) await remote(() => sb.from('purchases').insert({ data: purchase }));
  } else if (purchase) s.purchases.push({ id: uid(), at: Date.now(), ...purchase });
  if (i >= 0) s.products[i] = item; else s.products.unshift(item);
  persist();
}

export async function deleteProduct(code) {
  if (REMOTE) await remote(() => sb.from('products').delete().eq('code', code));
  const s = load();
  s.products = s.products.filter(p => p.code !== code);
  persist();
}

export async function setDiscount(codes, pct, until) {
  for (const c of codes) {
    const p = find(c); if (!p) continue;
    const next = { ...p, discount: pct > 0 ? { pct, until } : null };
    if (REMOTE) await remote(() => sb.from('products').update({ data: next, updated_at: new Date().toISOString() }).eq('code', c));
    Object.assign(p, next);
  }
  persist();
}

// Entrada de mercancía: suma unidades a una talla y registra la compra al costo indicado.
export async function restock(code, size, qty, unitCost) {
  const p = find(code);
  if (!p || !(qty > 0)) throw new Error('Referencia o cantidad inválida');
  if (REMOTE) return remote(() => sb.rpc('restock', { p_code: code, p_size: size, p_qty: qty, p_unit_cost: unitCost || 0 })).then(() => init({ admin: true }));
  p.stock[size] = (p.stock[size] || 0) + qty;
  if (unitCost > 0) p.cost = unitCost;
  load().purchases.push({ id: uid(), at: Date.now(), code, name: p.name, color: p.color, size, qty, unitCost: p.cost, total: p.cost * qty });
  persist();
}

export async function removePurchase(id) {
  if (REMOTE) await remote(() => sb.from('purchases').delete().eq('id', id));
  const s = load(); s.purchases = s.purchases.filter(x => x.id !== id); persist();
}

// ---------- ventas ----------
// items: [{ code, size, qty }]. Valida stock de todo antes de descontar nada. Guarda el precio cobrado (con descuento).
export async function sell(items, { method = 'Efectivo', channel = 'Tienda', customer = {} } = {}) {
  const meta = { method, channel, customer };
  if (REMOTE) {
    const sale = await remote(() => sb.rpc('sell', { items, meta }));
    const s = load();
    sale.items.forEach(i => { const p = find(i.code); if (p) p.stock[i.size] -= i.qty; });
    if (!s.sales.some(x => x.id === sale.id)) s.sales.push(sale);
    persist();
    return sale;
  }
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
    id: uid(), no: s.seq, at: Date.now(), ...meta,
    items: lines.map(({ p, size, qty }) => ({ code: p.code, name: p.name, brand: p.brand, color: p.color, cat: p.cat, size, qty, list: p.price, price: priceOf(p), cost: p.cost })),
  };
  sale.total = sale.items.reduce((a, i) => a + i.price * i.qty, 0);
  lines.forEach(({ p, size, qty }) => { p.stock[size] -= qty; });
  s.sales.push(sale);
  persist();
  return sale;
}

export async function voidSale(id) {
  const s = load();
  const sale = s.sales.find(x => x.id === id);
  if (!sale) return;
  if (REMOTE) await remote(() => sb.rpc('void_sale', { sale_id: id }));
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
export async function addSocial(entry) {
  if (REMOTE) { const [r] = await remote(() => sb.from('social').insert({ data: entry }).select()); upsertLocal('social', rowMove(r)); }
  else load().social.push({ id: uid(), at: Date.now(), ...entry });
  persist();
}
export async function removeSocial(id) {
  if (REMOTE) await remote(() => sb.from('social').delete().eq('id', id));
  const s = load(); s.social = s.social.filter(x => x.id !== id); persist();
}
const upsertLocal = (k, item) => { const l = load()[k]; if (!l.some(x => x.id === item.id)) l.push(item); };

// PIN del modo vista previa (en la base compartida se entra con correo y contraseña).
export function setSettings(patch) { Object.assign(load().settings, patch); persist(); }

// ---------- fotos ----------
// Vista previa: la foto se guarda dentro del navegador. Base compartida: se sube a la carpeta pública "prendas".
export async function uploadPhoto(blob, name) {
  if (!REMOTE) return new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(blob); });
  const path = `${name}-${Date.now()}.webp`;
  await remote(() => sb.storage.from(BUCKET).upload(path, blob, { contentType: 'image/webp', upsert: true }));
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// ---------- respaldo y reinicio ----------
export async function replaceAll(data) {
  if (REMOTE) throw new Error('Con la base compartida los respaldos se restauran desde Supabase');
  cache = data; persist();
}

export async function resetAll(withExamples) {
  if (!REMOTE) { const pin = load().settings.pinHash; cache = fresh(withExamples); cache.settings.pinHash = pin; return persist(); }
  const all = '00000000-0000-0000-0000-000000000000';
  await remote(() => sb.from('sales').delete().neq('id', all));
  await remote(() => sb.from('purchases').delete().neq('id', all));
  await remote(() => sb.from('social').delete().neq('id', all));
  await remote(() => sb.from('products').delete().neq('code', ''));
  if (withExamples) await remote(() => sb.from('products').insert(fresh(true).products.map(p => ({ code: p.code, data: p }))));
  await init({ admin: true });
}

export function toCSV(rows) {
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return '﻿' + rows.map(r => r.map(esc).join(';')).join('\n');
}

// ---------- estado inicial ----------
const empty = examples => ({ products: [], sales: [], purchases: [], social: [], seq: 0, settings: { pinHash: '' }, examples });

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
  return { ...empty(withExamples), products: withExamples ? examples : [] };
}
