
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.payment.system',
  appName: 'Payment Order System',
  webDir: 'dist',
  server: {
    // برای اتصال به دامین‌های خارجی (چه HTTP چه HTTPS)
    androidScheme: 'https',
    cleartext: true,
    allowNavigation: ['*']
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    }
  }
};

export default config;
