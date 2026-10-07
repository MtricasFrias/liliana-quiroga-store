# Liliana Quiroga Store — boutique en línea, panel y kit de marca

Vista previa del sitio de Liliana Quiroga Store, boutique multimarca en Ibagué (Tolima).

| Página | Para quién | Qué hace |
|---|---|---|
| `index.html` | Clientes | Portada, colección con filtros, Colección Privada, ficha de cada prenda, pedido por pasos (prendas, entrega, datos y tarjeta de regalo) que se envía por WhatsApp, y la boutique con mapa. |
| `admin.html` | Solo los dueños (no está enlazada en la tienda) | Vender, Hoy, Inventario, Descuentos, Finanzas, Redes, Etiquetas y Ajustes. |
| `marca.html` | Equipo y diseñadores | Kit de marca: poses del cocodrilo, logotipo, colores, tipografías e imágenes para redes. |

> **Vista previa.** Los datos viven en el navegador (localStorage): cada computador o celular ve su propia copia. Trae ocho prendas de ejemplo y las finanzas en cero. Ver «Pasar a producción».

## Códigos de prenda

```
A001-M
│└┬┘ └─ talla (XS, S, M, L, XL, XXL o «Única»)
│ └──── número de la prenda dentro de su tipo
└────── tipo: A Polos · B Camisas · C Camisetas · D Gorras · E Suéteres · F Pantalones y bermudas · G Accesorios
```

- Cada color es su propia prenda, con su propio costo de compra y su precio (el polo negro puede costar 250.000 y el amarillo 280.000). En Inventario, «Otro color» copia todo y solo pide color, costo y unidades.
- No se necesita lector de barras: en **Vender** se toca la prenda y luego la talla. También se puede escribir el código (A001-M) o, en Android, escanear con la cámara el QR de la etiqueta.

## Panel

- **Vender:** prendas en mosaico con buscador y filtros; un toque en la prenda y otro en la talla. Al cobrar sale un **comprobante** que se envía por WhatsApp o correo, o se imprime/guarda en PDF, con los enlaces a Google Maps, Instagram y Facebook. No reemplaza la factura electrónica de la DIAN.
- **Hoy:** lo vendido en el día (por tipo de prenda, marca y medio de pago), la ganancia y lo gastado en mercancía. Se puede consultar cualquier día.
- **Inventario:** unidades por talla editables, costo, precio, margen, fotos (en gancho y con modelo IA), Colección Privada y «Entrada de mercancía». Toda unidad nueva queda registrada como compra a su costo.
- **Descuentos:** elegir prendas (o una marca o un tipo entero), porcentaje y fecha límite. Se ve tachado en la tienda y se cobra así en Vender.
- **Finanzas:** ventas, ganancia y margen, gastado en mercancía, ticket promedio, ventas por día, por marca, por tipo y ganancia por prenda. Exporta CSV para el contador.
- **Redes:** registro semanal de seguidores, publicaciones y reseñas de Google, con su crecimiento. Más adelante puede llenarse solo con la API de Meta y la de Google Places.
- **Etiquetas:** código grande y QR, listas para imprimir.

## Envíos

`js/shipping.js` estima el envío desde Ibagué: recoger en la boutique (gratis), domicilio en Ibagué (8.000) o Interrapidísimo y Servientrega por zona (Tolima, resto del país, zonas de difícil acceso), con primer kilo, kilo adicional y 2 % de manejo sobre el valor declarado. Son estimados basados en la tarifa publicada de Servientrega y rangos 2026 de Interrapidísimo; actualiza `RATES` cuando tengan su tarifa negociada.

## Fotos

- **En gancho o doblada, sobre blanco:** es la foto principal de cada prenda en la vitrina.
- **Con modelo (IA):** aparece al pasar el mouse sobre la prenda, en la ficha y en la portada.
- Mientras no haya foto, se muestra una ilustración de la prenda colgada.

## Ver en tu computador

```bash
python -m http.server 5500
```

Luego abre `http://localhost:5500`, `http://localhost:5500/admin.html` y `http://localhost:5500/marca.html`.

## Publicar

Está publicado con GitHub Pages desde la rama `main`. Cuando compren el dominio se configura en *Settings → Pages → Custom domain*.

## Pasar a producción

1. Base de datos en la nube (Supabase o Cloudflare D1) en lugar de `load()` y `persist()` de `js/data.js`, conservando sus funciones.
2. Inicio de sesión real del servidor en lugar del PIN de la vista previa.
3. Fotos y precios reales, y pasarela de pago (Wompi o Mercado Pago) si quieren cobrar en línea.
