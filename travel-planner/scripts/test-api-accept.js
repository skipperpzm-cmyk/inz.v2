const http = require('http');

if (process.argv.length < 4) {
  console.error('Usage: node test-api-accept.js <session-token> <invite-id> [port]');
  process.exit(2);
}

const token = process.argv[2];
const inviteId = process.argv[3];
const port = process.argv[4] ? Number(process.argv[4]) : 3001;

const options = {
  hostname: 'localhost',
  port,
  path: `/api/friend-invites/${inviteId}/accept`,
  method: 'POST',
  headers: {
    'Cookie': `travel-planner-session=${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
};

const req = http.request(options, (res) => {
  console.log('STATUS', res.statusCode);
  let data = '';
  res.on('data', (c) => data += c);
  res.on('end', () => {
    try { console.log('BODY', JSON.parse(data)); } catch (e) { console.log('BODY', data); }
  });
});

req.on('error', (err) => { console.error('ERR', err.message); });
req.end();
