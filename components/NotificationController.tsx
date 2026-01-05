
import React, { useEffect } from 'react';
import { apiCall } from '../services/apiService';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

const NotificationController: React.FC = () => {
  useEffect(() => {
    
    const initNotifications = async () => {
        if (Capacitor.isNativePlatform()) {
            
            // 1. Create Notification Channel (CRITICAL for Android 8+ to behave like Telegram)
            // This ensures sound and pop-up (heads-up) priority
            try {
                await PushNotifications.createChannel({
                    id: 'fcm_default_channel',
                    name: 'General Notifications',
                    description: 'General system alerts',
                    importance: 5, // MAX importance (Heads-up notification)
                    visibility: 1, // Public on lockscreen
                    sound: 'default',
                    vibration: true,
                    lights: true,
                    lightColor: '#2563EB'
                });
            } catch(e) {
                console.warn("Channel creation failed (might be existing)", e);
            }

            // 2. Listeners
            await PushNotifications.addListener('registration', token => {
                console.log('Push Registration Token:', token.value);
                // Register token with backend
                const subObject = { 
                    endpoint: token.value, 
                    keys: { p256dh: 'native', auth: 'native' }, 
                    type: 'android' 
                };
                apiCall('/subscribe', 'POST', subObject);
            });

            await PushNotifications.addListener('registrationError', err => {
                console.error('Push Registration Error:', err.error);
            });

            await PushNotifications.addListener('pushNotificationReceived', notification => {
                console.log('Push Received:', notification);
            });

            await PushNotifications.addListener('pushNotificationActionPerformed', notification => {
                console.log('Push Action:', notification.actionId);
                // Handle navigation when user taps notification
                window.focus();
            });

            // 3. Request Permissions & Register
            // We explicitly check/request permissions here on mount
            try {
                const permStatus = await PushNotifications.checkPermissions();
                if (permStatus.receive === 'granted') {
                    await PushNotifications.register();
                } else {
                    const request = await PushNotifications.requestPermissions();
                    if (request.receive === 'granted') {
                        await PushNotifications.register();
                    }
                }
            } catch (e) {
                console.error("Error requesting push permissions", e);
            }
        } else {
            // Web Logic (PWA)
            if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                const existingSub = await registration.pushManager.getSubscription();
                if (existingSub) {
                    await sendSubscriptionToBackend(existingSub);
                    return;
                }
                const { publicKey } = await apiCall<{ publicKey: string }>('/vapid-key');
                if (publicKey) {
                    const convertedVapidKey = urlBase64ToUint8Array(publicKey);
                    const subscription = await registration.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: convertedVapidKey
                    });
                    await sendSubscriptionToBackend(subscription);
                }
            } catch (error) { console.error('Web Push Error:', error); }
        }
    };

    function urlBase64ToUint8Array(base64String: string) {
      const padding = '='.repeat((4 - base64String.length % 4) % 4);
      const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
      return outputArray;
    }

    const sendSubscriptionToBackend = async (subscription: PushSubscription) => {
      await apiCall('/subscribe', 'POST', subscription);
    };

    // Always attempt init on mount
    initNotifications();

  }, []);

  return null;
};

export default NotificationController;
