const object = value => typeof value === 'object' && value !== null && !Array.isArray(value);
export class DeletionError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const failure = code => { throw new DeletionError(code); };

export function createDeletionClient(supabase) {
  let actor = null, commandId = null, commandUserId = null, busy = false;
  async function call(action, input = {}) {
    if (!actor) failure('unauthorized');
    const session = (await supabase.auth.getSession()).data.session;
    if (!session || session.user.id !== actor.userId || session.access_token !== actor.token) failure('unauthorized');
    const { data, error } = await supabase.functions.invoke('privacy', {
      body: { action, ...input }, headers: { Authorization: `Bearer ${actor.token}` },
    });
    let result = data;
    if (error) {
      if (!(error.context instanceof Response)) failure('network');
      try { result = await error.context.clone().json(); } catch { failure('network'); }
    }
    if (!object(result)) failure('network');
    if (result.ok === false && object(result.error) && typeof result.error.code === 'string') failure(result.error.code);
    if (result.ok !== true || !Object.hasOwn(result, 'value')) failure('network');
    return result.value;
  }
  async function signOut() {
    actor = null;
    try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* No persistent browser session exists. */ }
  }
  return {
    async signIn(email, password) {
      if (busy) failure('busy');
      busy = true;
      try {
        await signOut();
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error || !data.session || !data.user || data.user.is_anonymous) failure('unauthorized');
        actor = { userId: data.user.id, token: data.session.access_token, signedInAt: Date.now() };
        if (commandUserId !== actor.userId) {
          commandId = null;
          commandUserId = actor.userId;
        }
        const state = await call('get_state');
        const pending = object(state) && ['deletion_pending', 'deleted'].includes(state.status);
        if (pending) await signOut();
        return { email: data.user.email || email.trim(), pending, deleted: object(state) && state.status === 'deleted' };
      } catch (error) { await signOut(); throw error; }
      finally { busy = false; }
    },
    async requestDeletion() {
      if (busy) failure('busy');
      busy = true;
      try {
        if (!actor) failure('unauthorized');
        if (Date.now() - actor.signedInAt > 290000) failure('reauth_required');
        // Same contract as PrivacyCenter: a session-bound, single-use challenge,
        // fresh password authentication, and one UUID retained across uncertain retries.
        commandId ??= crypto.randomUUID();
        const proof = await call('challenge');
        if (!object(proof) || typeof proof.challenge !== 'string') failure('network');
        const receipt = await call('delete_account', { challenge: proof.challenge, commandId });
        if (!object(receipt) || typeof receipt.requestId !== 'string' ||
            !['pending','running','completed','retry','failed'].includes(receipt.status) ||
            !Array.isArray(receipt.pendingSteps) || !receipt.pendingSteps.every(step => typeof step === 'string')) failure('network');
        await signOut();
        return receipt;
      } catch (error) {
        if (['reauth_required','unauthorized','deletion_pending'].includes(error.code)) await signOut();
        throw error;
      } finally { busy = false; }
    },
    signOut,
  };
}
