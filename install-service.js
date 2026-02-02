
import { Service } from 'node-windows';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = "C:\\PaymentSystem"; // HARDCODED FIX

// 1. Create Readline interface for User Input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("---------------------------------------------------------");
console.log("   Payment System - Windows Service Installer            ");
console.log("---------------------------------------------------------");

// 2. Ask for Port
rl.question('Please enter the port number (Press Enter for 80): ', (inputPort) => {
  const port = inputPort.trim() || '80';
  console.log(`> Using Port: ${port}`);

  // 3. Create .env
  const envContent = `PORT=${port}\n`;
  try {
    // Write to C:\PaymentSystem\.env
    fs.writeFileSync(path.join(ROOT_DIR, '.env'), envContent);
    console.log('> Saved configuration to .env file in C:\\PaymentSystem');
  } catch (err) {
    console.error('> Error writing .env file:', err);
    rl.close();
    return;
  }

  // 4. Configure Service
  // Puppeteer cache path
  const puppeteerCache = path.join(ROOT_DIR, '.puppeteer');

  const svc = new Service({
    name: 'PaymentSystem',
    description: 'Payment Order Management System Web Server',
    script: path.join(ROOT_DIR, 'server.js'),
    workingDirectory: ROOT_DIR, // *** FORCE C:\PaymentSystem ***
    env: [{
      name: "PORT",
      value: port
    }, {
      name: "PUPPETEER_CACHE_DIR",
      value: puppeteerCache
    }]
  });

  // 5. Listen for events
  svc.on('install', function() {
    console.log('> Service installed successfully!');
    console.log('> Starting service...');
    svc.start();
  });

  svc.on('alreadyinstalled', function() {
    console.log('Service already installed. Try uninstalling first.');
    svc.start(); 
  });

  svc.on('start', function() {
    console.log(`> Service started! App is running on http://localhost:${port}`);
    rl.close();
  });

  svc.on('error', function(e) {
    console.error('> Error:', e);
    rl.close();
  });

  // 6. Install
  console.log('> Installing Windows Service...');
  svc.install();
});
