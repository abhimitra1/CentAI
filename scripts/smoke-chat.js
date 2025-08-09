// scripts/smoke-chat.js
// Simple local smoke test for api/chat.js without Express
// It directly invokes the exported handler with mock req/res objects.

const chatHandler = require('../backend/api/chat');

function mockRes() {
  return {
    _status: 200,
    _json: null,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this._status = code; return this; },
    json(obj) { this._json = obj; console.log('STATUS', this._status); console.log(JSON.stringify(obj, null, 2)); return this; },
    end() { console.log('STATUS', this._status); return this; }
  };
}

async function call(body) {
  const req = { method: 'POST', body };
  const res = mockRes();
  await chatHandler(req, res);
  if (res._json) return res._json; else return null;
}

(async () => {
  const cases = [
    { name: 'Contact lookup', body: { message: 'Who is the Director, Admission?' } },
    { name: 'Faculty list dept+campus', body: { message: 'List CSE faculty at Bhubaneswar campus' } },
    { name: 'Single faculty', body: { message: 'Tell me about Prof. Raj Kumar Mohanta' } },
    { name: 'Hostels', body: { message: 'Show hostels in Paralakhemundi' } },
    { name: 'Clubs', body: { message: 'What clubs are there at Bhubaneswar?' } },
    { name: 'Campus addresses', body: { message: 'Where is the Vizianagaram campus located?' } },
    { name: 'Fallback to LLM (kept offline)', body: { message: 'What is the FinTech center?' } },
  ];

  for (const t of cases) {
    console.log('\n===', t.name, '===');
    try {
      const resp = await call(t.body);
      if (!resp) console.log('No JSON returned');
    } catch (e) {
      console.error('Error:', e.message);
    }
  }
})();
