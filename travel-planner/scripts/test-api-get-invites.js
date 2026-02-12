const http = require('http');

async function main(){
  const token = process.argv[2];
  if (!token) { console.error('Usage: node test-api-get-invites.js <session-token>'); process.exit(2); }
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/friend-invites',
    method: 'GET',
    headers: {
      'Cookie': `travel-planner-session=${token}`,
      'Accept': 'application/json'
    }
  };

  const req = http.request(options, (res) => {
    console.log('STATUS', res.statusCode);
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      try { console.log('BODY', JSON.parse(data)); } catch(e){ console.log('BODY', data); }
    });
  });

  req.on('error', (err)=>{ console.error('ERR', err.message); });
  req.end();
}

main();
