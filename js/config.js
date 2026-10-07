// Conexión a la base de datos compartida (Supabase).
// Vacío = modo vista previa: los datos viven solo en este navegador.
// Se llena con Project Settings → API → Project URL y la clave "anon public" (es pública por diseño;
// la seguridad la ponen las reglas de supabase/schema.sql).
export const CONFIG = {
  supabaseUrl: '',
  supabaseKey: '',
  // WhatsApp que recibe los pedidos, reservas y asesorías que arma la página (57 + número).
  // Ahora apunta a un número de prueba; para producción cámbialo por el de la boutique: '573205605644'.
  ordersWhatsapp: '573132697130',
  // Pago en línea. demo: true muestra el aviso "datos de ejemplo"; ponlo en false con los datos reales.
  payments: {
    demo: true,
    breb: '@lqstore-ejemplo',                 // llave Bre-B de la boutique
    holder: 'Liliana Quiroga Store',          // titular que verá el cliente al pagar
    qrImage: '',                              // imagen del QR real de Bancolombia, ej. 'assets/pagos/qr-bancolombia.png'
    qrText: 'EJEMPLO - Este no es un QR de pago real de Liliana Quiroga Store',
  },
};
