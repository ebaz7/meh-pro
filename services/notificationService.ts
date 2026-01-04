
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';

const PREF_KEY = 'app_notification_pref';

export const isNotificationEnabledInApp = (): boolean => {
    return localStorage.getItem(PREF_KEY) !== 'false';
};

export const setNotificationPreference = (enabled: boolean) => {
    localStorage.setItem(PREF_KEY, String(enabled));
};

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (Capacitor.isNativePlatform()) {
      try {
          // 1. Request Permission
          const result = await PushNotifications.requestPermissions();
          
          if (result.receive === 'granted') {
              // 2. Register with FCM (This enables background notifications like Telegram)
              // NOTE: This REQUIRES google-services.json to be present in android/app/ folder
              await PushNotifications.register();
              return true;
          } else {
              return false;
          }
      } catch (e) {
          console.error("Push Registration Error (Check google-services.json):", e);
          // Fallback to local if Push fails (prevents crash, but user needs to add config file)
          try {
             await LocalNotifications.requestPermissions();
          } catch(err) {}
          return false;
      }
  }

  // Web Logic
  if (!("Notification" in window)) return false;
  try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
  } catch (e) {
      console.error("Web Permission Error:", e);
      return false;
  }
};

export const sendNotification = async (title: string, body: string) => {
  if (!isNotificationEnabledInApp()) return;

  // On Native, we rely on the Background Push (FCM) primarily.
  // But for immediate local alerts (like "Task Completed" while app is open), we use LocalNotifications.
  if (Capacitor.isNativePlatform()) {
      try {
          await LocalNotifications.schedule({
              notifications: [
                  {
                      title: title,
                      body: body,
                      id: new Date().getTime(),
                      schedule: { at: new Date(Date.now() + 100) },
                      sound: 'beep.wav', // Ensure this file exists in android/app/src/main/res/raw or standard sounds will play
                      smallIcon: 'ic_stat_icon_config_sample', 
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

  if (Notification.permission === "granted") {
      try {
        new Notification(title, { body, icon: '/pwa-192x192.png', dir: 'rtl', lang: 'fa' });
      } catch (e) {
          console.error("Web Notification Error:", e);
      }
  }
};
