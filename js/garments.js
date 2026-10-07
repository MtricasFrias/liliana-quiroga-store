// Ilustraciones planas (ficha técnica) por silueta, teñidas con el color de la referencia.
// Se usan mientras la tienda no suba la foto real de la prenda.

const hex2rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const lum = h => { const [r, g, b] = hex2rgb(h); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
export function shade(h, amt) {
  const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
  return '#' + hex2rgb(h).map(c => Math.round(c + (t - c) * p).toString(16).padStart(2, '0')).join('');
}

const SIL = {
  polo: {
    body: 'M166 58C150 62 128 66 112 72L50 118L84 178L118 160L116 404Q200 416 284 404L282 160L316 178L350 118L288 72C272 66 250 62 234 58Q200 74 166 58Z',
    seams: 'M112 72Q126 118 118 160M288 72Q274 118 282 160M60 111L94 171M340 111L306 171M118 392Q200 404 282 392M118 388V404M282 388V404',
    cuffs: ['M54 115L88 175', 'M346 115L312 175'],
    collar: true, placket: [80, 76, 2],
  },
  'polo-mujer': {
    body: 'M170 60L142 66C146 100 138 138 124 158C134 206 138 246 132 280C128 320 122 344 120 364Q200 376 280 364C278 344 272 320 268 280C262 246 266 206 276 158C262 138 254 100 258 66L230 60Q200 74 170 60Z',
    seams: 'M124 158Q140 112 142 66M276 158Q260 112 258 66M122 352Q200 364 278 352',
    cuffs: ['M140 70Q148 112 128 156', 'M260 70Q252 112 272 156'],
    collar: true, placket: [80, 92, 4],
  },
  'polo-mujer-mc': {
    body: 'M170 60L140 68L98 108L116 152L128 144C136 200 138 244 132 280C128 320 122 344 120 364Q200 376 280 364C278 344 272 320 268 280C262 244 264 200 272 144L284 152L302 108L260 68L230 60Q200 74 170 60Z',
    seams: 'M140 68Q138 110 128 144M260 68Q262 110 272 144M106 104L122 146M294 104L278 146M122 352Q200 364 278 352',
    cuffs: ['M101 106L118 149', 'M299 106L282 149'],
    collar: true, placket: [80, 92, 4],
  },
  camiseta: {
    body: 'M164 56C148 62 128 66 112 72L50 118L84 178L118 160L116 404Q200 416 284 404L282 160L316 178L350 118L288 72C272 66 252 62 236 56Q200 92 164 56Z',
    seams: 'M112 72Q126 118 118 160M288 72Q274 118 282 160M60 111L94 171M340 111L306 171M118 392Q200 404 282 392',
    cuffs: [], crew: true,
  },
  camisa: {
    body: 'M166 58C150 62 128 66 110 72L72 150L52 384L94 392L118 214L118 168L116 404Q200 440 284 404L282 168L282 214L306 392L348 384L328 150L290 72C272 66 250 62 234 58Q200 74 166 58Z',
    seams: 'M110 72Q122 120 118 168M290 72Q278 120 282 168M56 352L96 360M344 352L304 360M200 86V424',
    cuffs: [], shirtCollar: true, buttons: [112, 160, 208, 256, 304, 352, 398],
  },
  sueter: {
    body: 'M168 50C150 58 128 64 110 72L72 150L54 380L98 388L118 214L118 168L118 392L282 392L282 168L282 214L302 388L346 380L328 150L290 72C272 64 250 58 232 50Z',
    seams: 'M110 72Q122 120 118 168M290 72Q278 120 282 168M58 350L100 358M342 350L300 358',
    cuffs: [], rib: true, zip: true,
  },
};

function shirtTop(c, d, tipColor) {
  const tip = tipColor ? `<path d="M168 62L180 96M232 62L220 96" stroke="${tipColor}" stroke-width="3" fill="none"/>` : '';
  return `<path d="M166 58Q200 40 234 58L230 66Q200 52 170 66Z" fill="${d}"/>
    <path d="M164 57L176 100L199 84L190 68Z" fill="${c}" stroke="${d}" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M236 57L224 100L201 84L210 68Z" fill="${c}" stroke="${d}" stroke-width="1.5" stroke-linejoin="round"/>${tip}`;
}

export function garmentSVG(p) {
  const m = p.model || '';
  const key = m.startsWith('camisa') ? 'camisa' : m === 'gorra' ? 'gorra' : m === 'sueter' ? 'sueter'
    : m === 'camiseta' ? 'camiseta' : m === 'polo-mujer' ? 'polo-mujer' : m === 'polo-mujer-mc' ? 'polo-mujer-mc' : 'polo';
  const c = p.hex || '#888888';
  const dark = lum(c) < 0.18;
  const d = dark ? shade(c, 0.22) : shade(c, -0.28);
  const label = `${p.name}, color ${p.color}`;
  if (key === 'gorra') return cap(c, d, label);
  const s = SIL[key];
  const stripes = p.stripe ? `<pattern id="st-${p.code}" width="400" height="26" patternUnits="userSpaceOnUse"><rect width="400" height="13" fill="${p.stripe}"/></pattern>
    <path d="${s.body}" fill="url(#st-${p.code})"/>` : '';
  const placket = s.placket ? (() => {
    const [y, h, n] = s.placket;
    const btn = Array.from({ length: n }, (_, i) => `<circle cx="200" cy="${y + 18 + i * (h - 26) / Math.max(1, n - 1)}" r="3.4" fill="${shade(c, dark ? 0.4 : 0.55)}" stroke="${d}" stroke-width="1"/>`).join('');
    return `<rect x="191" y="${y}" width="18" height="${h}" rx="2" fill="none" stroke="${d}" stroke-width="1.5"/>${btn}`;
  })() : '';
  const shirt = s.shirtCollar ? `<path d="M166 58Q200 42 234 58L228 70Q200 56 172 70Z" fill="${d}"/>
    <path d="M164 56L170 104L200 86Z" fill="${c}" stroke="${d}" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M236 56L230 104L200 86Z" fill="${c}" stroke="${d}" stroke-width="1.5" stroke-linejoin="round"/>
    ${s.buttons.map(y => `<circle cx="200" cy="${y}" r="3.2" fill="${shade(c, dark ? 0.4 : 0.55)}" stroke="${d}"/>`).join('')}
    ${m === 'camisa-oxford' ? `<path d="M226 150H262V190Q244 198 226 190Z" fill="none" stroke="${d}" stroke-width="1.5"/>` : ''}
    <path d="M52 384L94 392L96 372L55 364Z" fill="none" stroke="${d}" stroke-width="1.5"/><path d="M348 384L306 392L304 372L345 364Z" fill="none" stroke="${d}" stroke-width="1.5"/>` : '';
  const crew = s.crew ? `<path d="M164 56Q200 92 236 56L226 52Q200 80 174 52Z" fill="${d}" opacity=".9"/><path d="M168 50Q200 40 232 50Q200 74 168 50Z" fill="${d}" opacity=".55"/>` : '';
  const rib = s.rib ? `<path d="M118 372H282M54 362L100 370M346 362L300 370" stroke="${d}" stroke-width="1.5" fill="none"/>
    <path d="${Array.from({ length: 33 }, (_, i) => `M${122 + i * 5} 374V390`).join('')}" stroke="${d}" stroke-width="1" opacity=".6"/>` : '';
  const zip = s.zip ? `<path d="M168 50Q200 62 232 50L234 30Q200 42 166 30Z" fill="${c}" stroke="${d}" stroke-width="1.5"/>
    <path d="M200 40V150" stroke="${d}" stroke-width="3"/><path d="M200 40V150" stroke="${shade(c, dark ? 0.5 : 0.3)}" stroke-width="1" stroke-dasharray="2 2"/>
    <rect x="196" y="148" width="8" height="16" rx="3" fill="#C9B27C"/>` : '';
  const cuffs = (s.cuffs || []).map(dd => `<path d="${dd}" stroke="${p.trim || d}" stroke-width="${p.trim ? 3 : 1.5}" fill="none"/>`).join('');
  return `<svg viewBox="30 20 340 420" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg">
  <path d="${s.body}" fill="${c}" stroke="${d}" stroke-width="1.5" stroke-linejoin="round"/>${stripes}
  <path d="${s.seams}" stroke="${d}" stroke-width="1.3" fill="none" opacity=".75"/>
  ${cuffs}${rib}${crew}${zip}${s.collar ? shirtTop(c, d, p.trim) : ''}${placket}${shirt}
</svg>`;
}

function cap(c, d, label) {
  return `<svg viewBox="0 40 380 380" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg">
  <path d="M122 296C120 200 182 142 250 142C318 142 352 214 346 300Q234 318 122 296Z" fill="${c}" stroke="${d}" stroke-width="1.5"/>
  <path d="M250 142C224 196 214 250 220 308M250 142C286 192 300 246 300 304M250 142C200 168 160 220 146 290" stroke="${d}" stroke-width="1.3" fill="none" opacity=".8"/>
  <path d="M126 290C84 292 40 306 22 326C62 344 128 340 178 314Q150 300 126 290Z" fill="${c}" stroke="${d}" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M34 324C70 334 120 330 164 312" stroke="${d}" stroke-width="1" fill="none" opacity=".6"/>
  <path d="M122 296Q234 318 346 300" stroke="${d}" stroke-width="3" fill="none"/>
  <circle cx="250" cy="143" r="8" fill="${c}" stroke="${d}" stroke-width="1.5"/>
  <circle cx="186" cy="198" r="3" fill="${d}"/><circle cx="292" cy="190" r="3" fill="${d}"/>
</svg>`;
}
