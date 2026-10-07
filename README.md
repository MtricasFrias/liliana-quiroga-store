# Liliana Quiroga Store — boutique en línea, panel y kit de marca

Vista previa del sitio de Liliana Quiroga Store, boutique multimarca en Ibagué (Tolima).

| Página | Para quién | Qué hace |
|---|---|---|
| `index.html` | Clientes | Portada, colección con filtros, Colección Privada, ficha de cada prenda, pedido por pasos (prendas, entrega, datos y tarjeta de regalo) que se envía por WhatsApp, y la boutique con mapa. |
| `admin.html` | Solo los dueños (no está enlazada en la tienda) | Vender, Hoy, Inventario, Descuentos, Finanzas, Redes, Etiquetas y Ajustes. |
| `marca.html` | Equipo y diseñadores | Kit de marca: poses del cocodrilo, logotipo, colores, tipografías e imágenes para redes. |

> **Dos modos.** Mientras `js/config.js` no tenga la conexión, los datos viven en cada navegador (vista previa, con ocho prendas de ejemplo). Con la conexión a Supabase, todos los equipos comparten inventario, ventas y compras en vivo.

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
- **Acceso:** en vista previa con un PIN; con la base compartida, con correo y contraseña de administrador.
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

## Base de datos compartida (Supabase)

Con la base conectada, una venta registrada en el celular de la boutique agota la talla al instante en la web y en cualquier otro equipo. Dos personas no pueden vender la misma última unidad: la base revisa y descuenta el stock en un solo paso.

1. Crear una cuenta gratis en [supabase.com](https://supabase.com) y un proyecto nuevo (región São Paulo). Guardar la contraseña de la base en un lugar seguro.
2. Abrir `supabase/schema.sql`, cambiar los dos correos de la sección 1 por los de los dueños, pegarlo en **SQL Editor** y pulsar **Run**.
3. **Authentication → Users → Add user → Create new user** con cada uno de esos correos y su contraseña (marcar *Auto Confirm User*).
4. **Authentication → Sign In / Providers → Email**: desactivar *Allow new users to sign up*.
5. **Project Settings → API**: copiar *Project URL* y la clave *anon public* en `js/config.js`. Esa clave es pública por diseño; la seguridad está en las reglas del paso 2: el catálogo lo ve cualquiera, y ventas, compras y redes solo los correos administradores.

Para cargar las prendas de ejemplo en la base: Panel → Ajustes → «Cargar prendas de ejemplo».

## WhatsApp de pedidos

`ordersWhatsapp` en `js/config.js` define a qué número llegan los pedidos, reservas y asesorías que arma la página. Para producción debe ser el de la boutique: `573205605644`.

## Pendiente para producción

Fotos y precios reales, dominio propio y pasarela de pago (Wompi o Mercado Pago) si quieren cobrar en línea.
