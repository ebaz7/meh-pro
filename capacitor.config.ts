
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.payment.system',
  appName: 'Payment Order System',
  webDir: 'dist',
  server: {
    // استفاده از http برای جلوگیری از مشکلات SSL در شبکه داخلی
    androidScheme: 'http',
    // اجازه دادن به ترافیک غیرامن (برای اتصال به IP سرور)
    cleartext: true,
    // اجازه ناوبری به همه آدرس‌ها
    allowNavigation: ['*']
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    }
  }
};

export default config;
