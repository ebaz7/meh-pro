
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
console.log("   Payment System Service Installer (Absolute Mode)      ");
console.log("---------------------------------------------------------");

rl.question('Port (Default 3000): ', (inputPort) => {
  const port = inputPort.trim() || '3000';
  
  const svc = new Service({
    name: 'PaymentOrderPro',
    description: 'The Payment and Warehouse Management Service',
    script: path.join(__dirname, 'server.js'),
    workingDirectory: __dirname, // CRITICAL: Sets the context to the project folder
    env: [
        { name: "PORT", value: port },
        { name: "NODE_ENV", value: "production" }
    ]
  });

  svc.on('install', function() {
    console.log('> Service Installed Successfully.');
    svc.start();
  });

  svc.on('start', function() {
    console.log(`> Service Started. App is live at http://localhost:${port}`);
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
