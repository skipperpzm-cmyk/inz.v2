#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');

function runScript(scriptName) {
  const scriptPath = path.join(__dirname, scriptName);
  console.log('Running', scriptPath);
  const res = spawnSync(process.execPath, [scriptPath], { stdio: 'inherit' });
  if (res.error) {
    console.error('Failed to start', scriptName, res.error);
    process.exit(1);
  }
  if (res.status !== 0) {
    console.error(scriptName, 'exited with code', res.status);
    process.exit(res.status || 1);
  }
}

// Run migrations, then verification. Exit non-zero on any failure.
runScript('migrate-with-pg.js');
runScript('verify_username_display_slug.js');

console.log('Migrations and verification completed successfully.');
