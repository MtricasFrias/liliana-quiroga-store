// Comprobante que abre el cliente desde WhatsApp o el correo: la tira y su PDF.
import { decode } from './order.js';
import { tiraHTML, tiraPDF, unpack } from './tira.js';
import { $, download, toast, icon } from './util.js';

const o = decode(location.hash.slice(1));
if (!o) $('#rc').innerHTML = '<p>Este enlace de comprobante no es válido. Escríbenos por WhatsApp y te lo enviamos de nuevo.</p>';
else {
  const s = unpack(o);
  $('#rc').innerHTML = tiraHTML(s);
  $('#actions').hidden = false;
  $('#dl').insertAdjacentHTML('afterbegin', icon('download'));
  $('#dl').onclick = async () => {
    $('#dl').disabled = true;
    try { const f = await tiraPDF(s); download(f.name, f, f.type); } catch (e) { toast(e.message, 'err'); }
    $('#dl').disabled = false;
  };
}
