#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');
const { hashPassword } = require('../server/auth');

const envPath = path.join(__dirname, '../server/.env');

function writeEnv(hash) {
  const content = `PORT=4000\nADMIN_PASSWORD_HASH=${hash}\n`;
  fs.writeFileSync(envPath, content, { mode: 0o600 });
  console.log(`Updated ${envPath} (permissions 0600) with scrypt password hash.`);
}

const argPassword = process.argv[2];
if (argPassword === '--random') {
  const generated = crypto.randomBytes(18).toString('base64url');
  writeEnv(hashPassword(generated));
  console.log(`Generated random admin password: ${generated}`);
  console.log('Store this securely; it will not be logged or committed to git.');
  process.exit(0);
}

if (argPassword) {
  writeEnv(hashPassword(argPassword));
  process.exit(0);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('Enter new ProtocolX Dashboard admin password: ', (pwd) => {
  rl.close();
  if (!pwd || pwd.length < 8) {
    console.error('Error: Password must be at least 8 characters.');
    process.exit(1);
  }
  writeEnv(hashPassword(pwd));
});
