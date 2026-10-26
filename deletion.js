import { config } from './config.js';
import { createDeletionClient } from './deletion-client.js';

const login = document.querySelector('#login-form');
const confirmation = document.querySelector('#confirmation-form');
const status = document.querySelector('#flow-status');
const cancel = document.querySelector('#cancel-session');
const errors = {
  unauthorized: 'No pudimos confirmar tu sesión. Revisa el correo y la contraseña de tu cuenta de Eternity e inténtalo de nuevo.',
  reauth_required: 'Para cuidar tu cuenta, vuelve a iniciar sesión y confirma de nuevo la solicitud. La comprobación de identidad dura cinco minutos.',
  rate_limited: 'Has hecho varios intentos seguidos. Espera un minuto y vuelve a intentarlo.',
  review_required: 'Tu cuenta necesita una revisión segura. Puedes volver a intentarlo desde Privacidad y autorizaciones en la app. El correo de contacto indicado en la política aún es provisional.',
  policy_stale: 'La configuración de privacidad se está actualizando. Inténtalo más tarde o abre Privacidad y autorizaciones en la app.',
  consent_required: 'No pudimos verificar el estado de privacidad. Inténtalo desde Privacidad y autorizaciones en la app.',
  invalid_input: 'No pudimos validar esta solicitud. Vuelve a iniciar sesión e inténtalo de nuevo.',
  key_unavailable: 'El servicio seguro no está disponible en este momento. Inténtalo más tarde.',
  network: 'No pudimos confirmar la respuesta del servidor. Si ya confirmaste la baja, puede haberse recibido. Reintenta en esta página; conservaremos la misma referencia de envío para evitar duplicados. Si vuelves a entrar, comprobaremos si la baja está pendiente.',
};
const steps = { stop_user_work:'Detener nuevas actividades', sessions_push:'Retirar sesiones y avisos', relational:'Eliminar perfil, progreso y relaciones', storage:'Eliminar archivos privados', analytics:'Confirmar el borrado de analítica', privacy:'Eliminar datos privados de elegibilidad', auth:'Eliminar la cuenta de acceso', confirm:'Confirmar la finalización' };
let client, working = false;
function showMessage(message, error = false) {
  status.replaceChildren();
  status.className = `status note${error ? ' error' : ''}`;
  const text = document.createElement('p'); text.textContent = message; status.append(text);
  status.hidden = false;
}
function focusStatus() { status.focus(); }
function setBusy(value) {
  working = value;
  document.querySelector('#flow').setAttribute('aria-busy', String(value));
  for (const button of document.querySelectorAll('#flow button')) button.disabled = value;
}
function resetLogin() {
  confirmation.hidden = true; login.hidden = false;
  document.querySelector('#confirm-deletion').checked = false;
  document.querySelector('#password').value = '';
}
function showPending(deleted = false) {
  login.hidden = true; confirmation.hidden = true;
  showMessage(deleted ? 'El servidor indica que tu cuenta ya está eliminada. Hemos cerrado esta sesión.' : 'Tu cuenta ya tiene una eliminación pendiente. No necesitas enviar otra solicitud. El servidor ha detenido las nuevas operaciones; la purga por sistemas y proveedores aún puede estar en curso. Hemos cerrado esta sesión.');
  focusStatus();
}
try {
  if (!window.supabase?.createClient) throw new Error('sdk_unavailable');
  const url = new URL(config.supabaseUrl);
  if (url.protocol !== 'https:' && !(['127.0.0.1','localhost'].includes(url.hostname) && url.port === '55321')) throw new Error('invalid_config');
  const supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseKey, {
    auth: { persistSession:false, autoRefreshToken:false, detectSessionInUrl:false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(20000) }) },
  });
  client = createDeletionClient(supabase);
  document.querySelector('#sign-in').disabled = false;
} catch {
  showMessage('No se pudo cargar el acceso seguro. Revisa tu conexión y recarga la página. También puedes solicitar la baja desde Privacidad y autorizaciones en la app.', true);
}
login.addEventListener('submit', async event => {
  event.preventDefault();
  if (working || !client) return;
  setBusy(true); showMessage('Confirmando tu sesión…');
  const password = document.querySelector('#password');
  try {
    const result = await client.signIn(document.querySelector('#email').value, password.value);
    password.value = '';
    if (result.pending) { showPending(result.deleted); return; }
    login.hidden = true; confirmation.hidden = false; status.hidden = true;
    document.querySelector('#account-email').textContent = result.email;
    document.querySelector('#confirmation-heading').focus();
  } catch (error) {
    showMessage(errors[error.code] || errors.network, true); focusStatus();
  } finally { password.value = ''; setBusy(false); }
});
confirmation.addEventListener('submit', async event => {
  event.preventDefault();
  if (working || !client || !document.querySelector('#confirm-deletion').checked) return;
  setBusy(true); showMessage('Enviando tu solicitud de eliminación…');
  try {
    const receipt = await client.requestDeletion();
    confirmation.hidden = true; login.hidden = true;
    const complete = receipt.status === 'completed';
    showMessage(complete ? 'El servidor confirmó la eliminación de tu cuenta. Las retenciones mínimas y los respaldos siguen los plazos indicados abajo. Hemos cerrado esta sesión.' : 'Solicitud recibida. Tu cuenta está en eliminación pendiente y las nuevas operaciones se han detenido. Esto aún no confirma el borrado completo en todos los sistemas y proveedores. Hemos cerrado esta sesión.');
    const reference = document.createElement('p'); reference.className = 'receipt'; reference.textContent = `Referencia privada: ${receipt.requestId}`; status.append(reference);
    const hint = document.createElement('p'); hint.textContent = 'Guarda esta referencia para tus consultas. No se almacena en este navegador y se perderá al cerrar o recargar la página.'; status.append(hint);
    if (['retry','failed'].includes(receipt.status)) {
      const pending = document.createElement('p'); pending.textContent = 'Hay pasos que necesitan reintento o revisión del servicio. La purga no se ha completado.'; status.append(pending);
    }
    if (receipt.pendingSteps.length) {
      const label = document.createElement('p'); label.textContent = 'Pasos aún pendientes de confirmación:'; status.append(label);
      const list = document.createElement('ul');
      for (const step of receipt.pendingSteps) { const item = document.createElement('li'); item.textContent = steps[step] || 'Confirmar un paso del servicio'; list.append(item); }
      status.append(list);
    }
    focusStatus();
  } catch (error) {
    if (error.code === 'deletion_pending') { showPending(); return; }
    if (['reauth_required','unauthorized'].includes(error.code)) resetLogin();
    showMessage(errors[error.code] || errors.network, true); focusStatus();
  } finally { setBusy(false); }
});
cancel.addEventListener('click', async () => {
  if (working) return;
  setBusy(true);
  try { await client.signOut(); resetLogin(); showMessage('Cerramos esta sesión. No se envió una nueva solicitud de eliminación.'); focusStatus(); }
  finally { setBusy(false); }
});
window.addEventListener('pagehide', () => { if (client) void client.signOut(); });
