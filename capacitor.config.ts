
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.payment.system',
  appName: 'Payment Order System',
  webDir: 'dist',
  server: {
    // این تنظیمات برای کار با دامین‌های بین‌المللی ضروری است
    androidScheme: 'https',
    cleartext: true, // اجازه ارتباط HTTP غیر امن (برای مواقعی که SSL ندارید)
    allowNavigation: ['*'] // اجازه رفتن به همه آدرس‌ها
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    }
  }
};

export default config;
