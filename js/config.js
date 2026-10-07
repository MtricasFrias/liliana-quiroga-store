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
};
