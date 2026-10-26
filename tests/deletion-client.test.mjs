import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeletionClient } from '../deletion-client.js';

function fixture({ state = 'eligible', deleteResults = [] } = {}) {
  let session = null;
  const calls = [], signedOut = [], user = { id: 'user-a', email:'synthetic@example.invalid', is_anonymous:false };
  const supabase = {
    auth: {
      signOut: async options => { signedOut.push(options); session = null; return { error:null }; },
      signInWithPassword: async () => { session = { user, access_token:'pinned-test-token' }; return { data:{user, session}, error:null }; },
      getSession: async () => ({ data:{ session } }),
    },
    functions: { invoke: async (name, input) => {
      calls.push({name, ...input});
      if (input.body.action === 'get_state') return { data:{ok:true, value:{status:state}} };
      if (input.body.action === 'challenge') return { data:{ok:true, value:{challenge:'session-bound-proof'}} };
      return deleteResults.shift() || { data:{ok:true, value:{requestId:'receipt-1',status:'pending',pendingSteps:['auth','confirm']}} };
    } },
  };
  return { client:createDeletionClient(supabase), calls, signedOut, changeSession: value => { session = value; } };
}
test('requires sign-in, then sends challenge and deletion to privacy with pinned token and closes the session', async () => {
  const {client,calls,signedOut} = fixture();
  await assert.rejects(client.requestDeletion(), {code:'unauthorized'});
  await client.signIn('synthetic@example.invalid','test-only');
  const receipt = await client.requestDeletion();
  assert.equal(receipt.status,'pending');
  assert.deepEqual(calls.map(call => call.body.action),['get_state','challenge','delete_account']);
  const command = calls.at(-1);
  assert.equal(command.name,'privacy');
  assert.equal(command.body.challenge,'session-bound-proof');
  assert.match(command.body.commandId,/^[a-f0-9-]{36}$/);
  assert.deepEqual(command.headers,{Authorization:'Bearer pinned-test-token'});
  assert(signedOut.every(options => options.scope === 'local'));
  await assert.rejects(client.requestDeletion(), {code:'unauthorized'});
});
test('lost response retains one command ID across retries with a new challenge', async () => {
  const {client,calls} = fixture({deleteResults:[{error:{context:new Response(JSON.stringify({ok:false,error:{code:'network',retryable:true}}),{status:503})}}]});
  await client.signIn('synthetic@example.invalid','test-only');
  await assert.rejects(client.requestDeletion(), {code:'network'});
  await client.requestDeletion();
  const commands = calls.filter(call => call.body.action === 'delete_account');
  assert.equal(commands.length,2);
  assert.equal(commands[0].body.commandId,commands[1].body.commandId);
  assert.equal(calls.filter(call => call.body.action === 'challenge').length,2);
});
test('account switches cannot redirect a deletion to another identity', async () => {
  const {client,calls,changeSession} = fixture();
  await client.signIn('synthetic@example.invalid','test-only');
  changeSession({user:{id:'user-b'},access_token:'other-token'});
  await assert.rejects(client.requestDeletion(), {code:'unauthorized'});
  assert.equal(calls.length,1);
});
test('pending state ends sign-in without sending another deletion command', async () => {
  const {client,calls} = fixture({state:'deletion_pending'});
  const result = await client.signIn('synthetic@example.invalid','test-only');
  assert.equal(result.pending,true);
  assert.equal(calls.length,1);
  await assert.rejects(client.requestDeletion(), {code:'unauthorized'});
});
test('requires fresh sign-in after five minutes', async () => {
  const {client,calls} = fixture();
  await client.signIn('synthetic@example.invalid','test-only');
  const original = Date.now;
  Date.now = () => original() + 300001;
  try { await assert.rejects(client.requestDeletion(), {code:'reauth_required'}); }
  finally { Date.now = original; }
  assert.equal(calls.length,1);
});
