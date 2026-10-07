// Gráficas de una sola serie (magnitud): un tono, sin leyenda, tooltip por barra y tabla accesible.
const short = v => v >= 1e6 ? (v / 1e6).toFixed(1).replace('.0', '') + ' M' : v >= 1e3 ? Math.round(v / 1e3) + ' mil' : String(Math.round(v));
const full = v => '$' + Math.round(v).toLocaleString('es-CO');

// Columnas verticales: ventas por día.
export function barChart(rows) {
  const max = Math.max(1, ...rows.map(r => r.value));
  const step = niceStep(max);
  const top = step * 3;
  const ticks = [0, 1, 2, 3].map(i => i * step);
  const peak = rows.reduce((a, r, i) => r.value > rows[a].value ? i : a, 0);
  const every = Math.ceil(rows.length / 8);
  return `<div class="vbars" style="--n:${rows.length}">
    <div class="vbars-grid" aria-hidden="true">${ticks.map(t => `<span style="bottom:${t / top * 100}%"><i>${short(t)}</i></span>`).join('')}</div>
    <div class="vbars-plot">${rows.map((r, i) => `<div class="vbar" tabindex="0" style="--h:${r.value / top * 100}%">
      <span class="vbar-fill"></span>${i === peak && r.value ? `<b class="vbar-peak">${short(r.value)}</b>` : ''}
      <span class="tip" role="tooltip"><strong>${r.label}</strong>${full(r.value)}</span></div>`).join('')}</div>
    <div class="vbars-x" aria-hidden="true">${rows.map((r, i) => `<span>${i % every === 0 ? r.label : ''}</span>`).join('')}</div>
  </div>
  <table class="sr-only"><caption>Ventas por día</caption><tbody>${rows.map(r => `<tr><th>${r.label}</th><td>${full(r.value)}</td></tr>`).join('')}</tbody></table>`;
}

// Barras horizontales con etiqueta y valor directos.
export function hBars(rows, fmt) {
  const max = Math.max(1, ...rows.map(r => r.value));
  return `<ul class="hbars">${rows.map(r => `<li><span class="hb-label">${r.label}</span>
    <span class="hb-track"><span class="hb-fill" style="--w:${r.value / max * 100}%"></span></span><span class="hb-val">${fmt(r.value)}</span></li>`).join('')}</ul>`;
}

function niceStep(max) {
  const raw = max / 3, mag = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw);
}
