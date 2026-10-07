// Estimador de envío desde Ibagué. Valores ESTIMADOS para orientar al cliente; el valor real
// lo da la guía (peso real o volumétrico, destino y valor declarado).
// Fuentes: tarifa corporativa Servientrega "Mercancía Premier" (kilo inicial / adicional por trayecto,
// tasa de manejo 2 % del valor declarado), ajustada a 2026; rangos de referencia de Interrapidísimo 2026
// (urbano 11.000–13.500, regional 14.500–17.500, especial 20.000–25.000 por 1 kg).
// Actualizar RATES cuando la tienda tenga su tarifa negociada.

import { CATEGORIES } from './data.js';

export const CARRIERS = {
  interrapidisimo: { name: 'Interrapidísimo', manejo: 0.02 }, // manejo asumido igual al de Servientrega: confirmar
  servientrega: { name: 'Servientrega', manejo: 0.02 },
};

// [primer kilo, kilo adicional] en COP por trayecto
const RATES = {
  interrapidisimo: { regional: [14500, 3500], nacional: [17000, 4200], especial: [24000, 7000] },
  servientrega: { regional: [12000, 4000], nacional: [18000, 4500], especial: [37000, 9200] },
};
const DAYS = { local: 'Hoy o mañana', regional: '1 a 2 días hábiles', nacional: '2 a 4 días hábiles', especial: '4 a 7 días hábiles' };
const LOCAL = { recoger: { name: 'Recoger en la tienda', cost: 0 }, domicilio: { name: 'Domicilio en Ibagué', cost: 8000 } };

export const DEPARTMENTS = ['Amazonas', 'Antioquia', 'Arauca', 'Atlántico', 'Bogotá D.C.', 'Bolívar', 'Boyacá', 'Caldas',
  'Caquetá', 'Casanare', 'Cauca', 'Cesar', 'Chocó', 'Córdoba', 'Cundinamarca', 'Guainía', 'Guaviare', 'Huila',
  'La Guajira', 'Magdalena', 'Meta', 'Nariño', 'Norte de Santander', 'Putumayo', 'Quindío', 'Risaralda',
  'San Andrés y Providencia', 'Santander', 'Sucre', 'Tolima', 'Valle del Cauca', 'Vaupés', 'Vichada'];
const SPECIAL = ['Amazonas', 'Guainía', 'Guaviare', 'San Andrés y Providencia', 'Vaupés', 'Vichada'];

const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

export function zoneOf(department, city = '') {
  if (department === 'Tolima') return norm(city) === 'ibague' ? 'local' : 'regional';
  return SPECIAL.includes(department) ? 'especial' : 'nacional';
}

// ponytail: peso por categoría + 200 g de empaque, redondeado al kilo; sin volumétrico (prendas dobladas en bolsa).
export function weightKg(items) {
  const kg = items.reduce((a, i) => a + (CATEGORIES[i.code[0]]?.kg ?? 0.4) * i.qty, 0.2);
  return Math.max(1, Math.ceil(kg));
}

// Devuelve las opciones de envío para el destino con su costo estimado.
export function quote(items, subtotal, department, city) {
  if (!department || !items.length) return [];
  const zone = zoneOf(department, city);
  if (zone === 'local') return Object.entries(LOCAL).map(([id, o]) => ({ id, ...o, zone, days: DAYS.local, kg: 0, manejo: 0 }));
  const kg = weightKg(items);
  return Object.entries(CARRIERS).map(([id, c]) => {
    const [first, extra] = RATES[id][zone];
    const flete = first + extra * (kg - 1);
    const manejo = Math.round(subtotal * c.manejo / 100) * 100;
    return { id, name: c.name, zone, days: DAYS[zone], kg, flete, manejo, cost: flete + manejo };
  }).sort((a, b) => a.cost - b.cost);
}
