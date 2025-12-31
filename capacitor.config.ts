
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.payment.system',
  appName: 'Payment Order System',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true, // اجازه ترافیک HTTP (برای IP لوکال)
    allowNavigation: ['*'] // اجازه اتصال به هر آدرسی
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    }
  }
};

export default config;
