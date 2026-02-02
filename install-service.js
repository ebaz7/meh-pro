
import { Service } from 'node-windows';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("---------------------------------------------------------");
console.log("   Payment System - Robust Service Installer             ");
console.log("---------------------------------------------------------");

rl.question('Please enter the port number (Default 80): ', (inputPort) => {
  const port = inputPort.trim() || '80';
  
  // Create absolute path for env and storage
  const envContent = `PORT=${port}\nDB_PATH=${path.join(__dirname, 'database.json')}\n`;
  fs.writeFileSync(path.join(__dirname, '.env'), envContent);

  const svc = new Service({
    name: 'PaymentSystemPro',
    description: 'Payment Management System Server',
    script: path.join(__dirname, 'server.js'),
    workingDirectory: __dirname,
    env: [
        { name: "PORT", value: port },
        { name: "NODE_ENV", value: "production" }
    ]
  });

  svc.on('install', function() {
    console.log('> Installed successfully!');
    svc.start();
  });

  svc.on('start', function() {
    console.log(`> App running on http://localhost:${port}`);
    rl.close();
  });

  svc.on('error', (e) => {
    console.error('> Service Error:', e);
    rl.close();
  });

  if (svc.exists) {
      console.log("> Service already exists. Reinstalling...");
      svc.uninstall();
      svc.on('uninstall', () => svc.install());
  } else {
      svc.install();
  }
});
