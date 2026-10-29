import assert from 'node:assert/strict';
import { whatsappAccepted, whatsappFailure } from '../src/lib/whatsappResult.ts';

assert.equal(whatsappAccepted({ ok: true, data: { messages: [{ id: 'wamid.test' }] } }), true);
assert.equal(whatsappAccepted({ ok: true }), false);
assert.equal(whatsappAccepted({ success: false, data: { messages: [{ id: 'wamid.test' }] } }), false);
assert.equal(whatsappAccepted({ success: true, data: { messages: [{ id: 'wamid.test' }] } }), true);
assert.equal(await whatsappFailure(null, { context: new Response(JSON.stringify({ data: { error: { message: 'Invalid recipient' } } })) }), 'Invalid recipient');
assert.match(await whatsappFailure({ data: { error: { code: 131047 } } }, null), /24 horas/);
console.log('6 testes de resultado WhatsApp passaram');