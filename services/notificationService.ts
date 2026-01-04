
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';

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
          // Request Local Notifications permission (critical for background alerts without FCM)
          const localResult = await LocalNotifications.requestPermissions();
          
          // Try Push Notification Registration - Wrap in try/catch to prevent crashes if google-services.json is missing
          let pushResult = { receive: 'denied' };
          try {
              pushResult = await PushNotifications.requestPermissions();
          } catch (e) {
              console.warn("Push Notifications Plugin not available or configured correctly (ignoring):", e);
          }
          
          if (localResult.display === 'granted' || pushResult.receive === 'granted') {
              // Register to get the token immediately if push is granted
              if (pushResult.receive === 'granted') {
                  try {
                    await PushNotifications.register();
                  } catch (e) {
                      console.warn("Push register failed (might be emulator or missing config)", e);
                  }
              }
              return true;
          }
          return false;
      } catch (e) {
          console.error("Native Permission Error:", e);
          return false;
      }
  }

  // 2. Web/PWA Logic
  if (!("Notification" in window)) {
      // Don't alert here to avoid spamming user
      return false;
  }

  try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
          return true;
      } else {
          return false;
      }
  } catch (e) {
      console.error("Permission request error:", e);
      return false;
  }
};

// Send a notification (Local for mobile, Web API for desktop)
export const sendNotification = async (title: string, body: string) => {
  if (!isNotificationEnabledInApp()) return;

  // Native Local Notification (Works in background/minimized on Android)
  if (Capacitor.isNativePlatform()) {
      try {
          await LocalNotifications.schedule({
              notifications: [
                  {
                      title: title,
                      body: body,
                      id: new Date().getTime(), // Unique ID
                      schedule: { at: new Date(Date.now() + 100) }, // Show immediately
                      sound: 'beep.wav', // Default sound
                      smallIcon: 'ic_stat_icon_config_sample', // Android resource name if custom, else default
                      actionTypeId: "",
                      extra: null
                  }
              ]
          });
      } catch (e) {
          console.error("Local Notification Error:", e);
      }
      return;
  }

  // Web local notification (only works if tab is open)
  if (Notification.permission === "granted") {
      try {
        new Notification(title, { body, icon: '/pwa-192x192.png', dir: 'rtl', lang: 'fa' });
      } catch (e) {
          console.error("Web Notification Error:", e);
      }
  }
};
