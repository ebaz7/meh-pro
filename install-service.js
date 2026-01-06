
import { Service } from 'node-windows';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Create Readline interface for User Input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("---------------------------------------------------------");
console.log("   Payment System - Windows Service Installer            ");
console.log("---------------------------------------------------------");

// 2. Ask for Port (Default 80 for ArvanCloud Compatibility)
rl.question('Please enter the port number (Press Enter for 80): ', (inputPort) => {
  // If user types nothing, use 80. If they type something, use that.
  const port = inputPort.trim() || '80';
  console.log(`> Using Port: ${port}`);

  // 3. Create/Update .env file
  const envContent = `PORT=${port}\n`;
  try {
    fs.writeFileSync(path.join(__dirname, '.env'), envContent);
    console.log('> Saved configuration to .env file.');
  } catch (err) {
    console.error('> Error writing .env file:', err);
    rl.close();
    return;
  }

  // 4. Configure Service
  const puppeteerCache = path.join(__dirname, '.cache', 'puppeteer');

  const svc = new Service({
    name: 'PaymentSystem',
    description: 'Payment Order Management System Web Server',
    script: path.join(__dirname, 'server.js'),
    workingDirectory: __dirname, // CRITICAL
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
    console.log('\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    console.log(' WARNING: The service "PaymentSystem" is ALREADY INSTALLED!');
    console.log('------------------------------------------------------------');
    console.log(' TO FIX AND CHANGE PORT:');
    console.log(' 1. Run: node uninstall-service.js');
    console.log(' 2. Run this script again: node install-service.js');
    console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n');
    // We try to start it anyway, but port won't change until reinstall
    svc.start(); 
  });

  svc.on('start', function() {
    console.log(`> Service started! App is running on http://localhost:${port}`);
    console.log('> You can now close this window.');
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
