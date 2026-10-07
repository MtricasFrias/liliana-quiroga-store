# Liliana Quiroga Store — tienda online y panel

Propuesta preliminar del sitio de Liliana Quiroga Store (Ibagué, Tolima): catálogo con pedido por WhatsApp, panel privado de ventas, inventario y caja, y sistema de códigos para identificar cada prenda.

> **Vista previa.** El catálogo, los precios, el inventario y las ventas son **datos de demostración**. Los datos viven en el navegador (localStorage), así que cada computador o celular ve su propia copia. Ver «Pasar a producción».

## Qué incluye

| Página | Para quién | Qué hace |
|---|---|---|
| `index.html` | Clientes | Portada, colección con filtros, ficha de cada prenda (tela, ajuste, color, detalles, cuidados, stock por talla), carrito con miniaturas, envío estimado por ciudad y pedido por WhatsApp. |
| `admin.html` | Solo administración (no está enlazada desde la tienda) | Venta rápida por código, inventario por referencia y talla, caja del día con cierre, finanzas, etiquetas con código de barras, respaldo. |

La tienda y el panel comparten los mismos datos: **una venta registrada en el panel agota la talla en la tienda al instante** (en el mismo navegador, incluso con ambas páginas abiertas en pestañas distintas).

## Sistema de identificación de prendas

```
A501-M
│└┬┘ └─ talla (XS, S, M, L, XL, XXL o «Única»)
│ └──── número de referencia dentro de la categoría
└────── letra de categoría
```

| Letra | Categoría |
|---|---|
| A | Polos |
| B | Camisas |
| C | Camisetas |
| D | Gorras |
| E | Suéteres |

- Cada referencia es un diseño en un color (A501 = polo clásico verde botella). Los colores del mismo modelo se enlazan en la ficha.
- Al crear una referencia nueva, el panel propone el siguiente número libre de la categoría.
- Para agregar categorías, edita `CATEGORIES` en `js/data.js` (letra, nombre y peso aproximado en kg para el envío).
- **Etiquetas:** en *Panel → Etiquetas* se imprimen etiquetas de 63 × 40 mm con el código en barras CODE 128. Un lector de código de barras USB escribe el código en *Venta rápida* y la venta queda registrada con Enter.

## Uso del panel

1. Abre `admin.html`. La primera vez pide **crear un PIN** de 4 a 8 dígitos.
2. **Venta rápida:** escribe o escanea `A501-M`. Si escribes solo `A501`, el panel muestra las tallas disponibles. Elige medio de pago y canal, y registra.
3. **Inventario:** cambia unidades directamente en la tabla, crea o edita referencias (con foto real, que se reduce automáticamente) y registra entradas de mercancía con su costo.
4. **Caja:** muestra cuánto efectivo debe haber en el cajón (base + ventas en efectivo + entradas − salidas). Ingresa el conteo y cierra la caja; registra gastos (arriendo, nómina, servicios, envíos, publicidad).
5. **Finanzas:** ventas, utilidad bruta y margen, gastos, utilidad neta, ventas por día, por categoría, por medio de pago y referencias más vendidas. Exporta CSV para el contador.
6. **Ajustes:** base de caja, cambio de PIN, respaldo descargable y restauración, y restablecer los datos de ejemplo.

## Envíos

`js/shipping.js` estima el envío desde Ibagué por zona de destino:

- **Ibagué:** recoger en la tienda (gratis) o domicilio (valor de referencia $8.000).
- **Tolima (regional), resto del país (nacional) y zonas de difícil acceso** (Amazonas, Guainía, Guaviare, San Andrés, Vaupés, Vichada): Interrapidísimo y Servientrega, con primer kilo + kilo adicional + 2 % de manejo sobre el valor declarado.

Los valores parten de la tarifa corporativa publicada de Servientrega (Mercancía Premier, 2024) ajustada a 2026 y de los rangos de referencia 2026 de Interrapidísimo. **Son estimados**: cuando la tienda tenga su tarifa negociada, actualiza la tabla `RATES` de ese archivo. El manejo del 2 % para Interrapidísimo es un supuesto pendiente de confirmar.

## Logo

`assets/brand/cocodrilo.svg` (sobre fondos claros) y `cocodrilo-claro.svg` (sobre verde): cocodrilo coronado propio de la tienda. Antes de usarlo en letreros o etiquetas, se recomienda registrarlo ante la SIC.

## Ver el sitio en tu computador

Los módulos de JavaScript necesitan un servidor local (abrir el archivo con doble clic no funciona):

```bash
python -m http.server 5500
```

Luego abre `http://localhost:5500` (tienda) y `http://localhost:5500/admin.html` (panel).

## Publicar en GitHub Pages

1. Sube esta carpeta a un repositorio de GitHub.
2. En el repositorio: *Settings → Pages → Build and deployment → Deploy from a branch → `main` / root*.
3. La tienda queda en `https://<usuario>.github.io/<repositorio>/` y el panel en `…/admin.html`.

Cuando compren el dominio, se apunta a GitHub Pages desde el mismo menú (*Custom domain*).

## Pasar a producción

La vista previa guarda todo en el navegador. Para que el celular del local, el computador de caja y la tienda pública compartan los mismos datos:

1. Crear una base de datos en la nube (Supabase o Cloudflare D1).
2. Reemplazar `load()` y `persist()` de `js/data.js` por llamadas a esa base, conservando las funciones exportadas (el resto del código no cambia).
3. Cambiar el PIN del panel por inicio de sesión real del servidor; el PIN actual solo protege la vista previa.
4. Subir fotos reales de cada prenda y precios reales, y conectar una pasarela de pago (Wompi o Mercado Pago) si quieren cobrar en línea en lugar de cerrar por WhatsApp.

## Estructura

```
index.html          tienda
admin.html          panel
css/                base.css (tokens), store.css, admin.css
js/data.js          datos, ventas, caja, códigos (única fuente de datos)
js/shipping.js      estimador de envíos
js/garments.js      ilustraciones de prenda mientras no haya foto
js/store.js         tienda y carrito
js/admin.js         panel
js/charts.js        gráficas del panel
assets/img/         fotos de la tienda y retratos (de sus redes)
assets/brand/       cocodrilo y favicon
```
