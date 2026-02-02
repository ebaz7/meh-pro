
import { Service } from 'node-windows';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- 1. HARDCODED INSTALL PATH ---
const INSTALL_DIR = "C:\\PaymentSystem"; 

// Create Readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("---------------------------------------------------------");
console.log("   Payment System - Windows Service Installer (Advanced) ");
console.log("---------------------------------------------------------");
console.log(`> Target Installation Directory: ${INSTALL_DIR}`);

// 2. Ask for Port
rl.question('Please enter the port number (Press Enter for 80): ', (inputPort) => {
  const port = inputPort.trim() || '80';
  console.log(`> Using Port: ${port}`);

  // 3. Create .env in the target directory
  const envContent = `PORT=${port}\n`;
  try {
    if (!fs.existsSync(INSTALL_DIR)) {
        console.error(`ERROR: Directory ${INSTALL_DIR} does not exist! Please create it first.`);
        process.exit(1);
    }
    fs.writeFileSync(path.join(INSTALL_DIR, '.env'), envContent);
    console.log('> Saved configuration to .env file in C:\\PaymentSystem');
  } catch (err) {
    console.error('> Error writing .env file:', err);
    rl.close();
    return;
  }

  // 4. Configure Service
  const puppeteerCache = path.join(INSTALL_DIR, '.puppeteer');

  const svc = new Service({
    name: 'PaymentSystem',
    description: 'Payment Order Management System Web Server',
    // Point to the script INSIDE C:\PaymentSystem
    script: path.join(INSTALL_DIR, 'server.js'), 
    workingDirectory: INSTALL_DIR, // *** CRITICAL: Force Service to run in this dir ***
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
    console.log('Service already installed. Please run "node uninstall-service.js" first.');
    svc.start(); 
  });

  svc.on('start', function() {
    console.log(`> Service started! App is running on http://localhost:${port}`);
    console.log(`> Logs are located at ${path.join(INSTALL_DIR, 'server_status.log')}`);
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
