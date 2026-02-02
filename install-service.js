
import { Service } from 'node-windows';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// چک کردن اینکه آیا دیتابیس در این پوشه هست یا نه
const dbPath = path.join(__dirname, 'database.json');
if (!fs.existsSync(dbPath)) {
    console.warn('⚠️ هشدار: فایل database.json در این پوشه یافت نشد.');
    console.log('سرویس نصب می‌شود، اما مطمئن شوید فایل را در مسیر زیر کپی کرده‌اید:');
    console.log(dbPath);
} else {
    console.log('✅ فایل دیتابیس با موفقیت شناسایی شد و آماده بازیابی است.');
}

const svc = new Service({
  name: 'PaymentOrderPro',
  description: 'سیستم مدیریت پرداخت و انبارداری - با قابلیت بک‌آپ خودکار',
  script: path.join(__dirname, 'server.js'),
  workingDirectory: __dirname,
  env: [
    { name: "NODE_ENV", value: "production" },
    { name: "PORT", value: "3000" }
  ]
});

svc.on('install', function() {
  console.log('--------------------------------------------------');
  console.log('سرویس با موفقیت نصب شد.');
  console.log('بک‌آپ خودکار فعال گردید.');
  console.log('برنامه از طریق http://localhost:3000 در دسترس است.');
  console.log('--------------------------------------------------');
  svc.start();
});

svc.on('alreadyinstalled', function() {
    console.log('سرویس از قبل نصب شده است. در حال بازنشانی...');
    svc.uninstall();
});

svc.on('uninstall', function() {
    console.log('نسخه قبلی حذف شد. نصب نسخه جدید...');
    svc.install();
});

if (svc.exists) {
    svc.uninstall();
} else {
    svc.install();
}
