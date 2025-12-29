
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.payment.system',
  appName: 'Payment Order System',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'http', // Changed to http to avoid SSL issues on local network
    cleartext: true, // Critical for local development (IP address)
    allowNavigation: ['*']
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    }
  }
};

export default config;
