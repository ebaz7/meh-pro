
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

const PREF_KEY = 'app_notification_pref';

// Check if user enabled notifications in the app settings
export const isNotificationEnabledInApp = (): boolean => {
    return localStorage.getItem(PREF_KEY) !== 'false';
};

export const setNotificationPreference = (enabled: boolean) => {
    localStorage.setItem(PREF_KEY, String(enabled));
};

export const requestNotificationPermission = async (): Promise<boolean> => {
  // 1. Native Android/iOS Logic
  if (Capacitor.isNativePlatform()) {
      try {
          const result = await PushNotifications.requestPermissions();
          if (result.receive === 'granted') {
              // Register to get the token immediately
              await PushNotifications.register();
              return true;
          }
          return false;
      } catch (e) {
          console.error("Native Push Error:", e);
          return false;
      }
  }

  // 2. Web/PWA Logic
  if (!("Notification" in window)) {
      alert("مرورگر شما از نوتیفیکیشن پشتیبانی نمی‌کند.");
      return false;
  }

  try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
          // Trigger PWA reload to activate Service Worker if needed
          if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
             // SW active
          } else {
             window.location.reload(); 
          }
          return true;
      } else {
          return false;
      }
  } catch (e) {
      console.error("Permission request error:", e);
      return false;
  }
};

// Deprecated in favor of Backend Push, but kept for Fallback
export const sendNotification = async (title: string, body: string) => {
  // Native Local Notification fallback
  if (Capacitor.isNativePlatform()) {
      // Typically handled by background listener, but simple trigger:
      // LocalNotifications plugin would be used here if installed, 
      // but we rely on PushNotifications plugin for remote messages.
      return;
  }

  // Web local notification (only works if tab is open)
  if (isNotificationEnabledInApp() && Notification.permission === "granted") {
      new Notification(title, { body, icon: '/pwa-192x192.png', dir: 'rtl', lang: 'fa' });
  }
};
