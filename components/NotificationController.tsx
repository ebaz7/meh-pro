
import React, { useEffect } from 'react';
import { apiCall } from '../services/apiService';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

const NotificationController: React.FC = () => {
  useEffect(() => {
    
    const initNotifications = async () => {
        // --- NATIVE APP LOGIC (ANDROID) ---
        if (Capacitor.isNativePlatform()) {
            // Listeners
            await PushNotifications.addListener('registration', token => {
                console.log('Push Registration Token:', token.value);
                // Send FCM token to backend (using same endpoint format)
                const subObject = { 
                    endpoint: token.value, 
                    keys: { p256dh: 'native', auth: 'native' }, 
                    type: 'android' // Mark as android
                };
                apiCall('/subscribe', 'POST', subObject);
            });

            await PushNotifications.addListener('registrationError', err => {
                console.error('Push Registration Error:', err.error);
            });

            await PushNotifications.addListener('pushNotificationReceived', notification => {
                console.log('Push Received:', notification);
                // In foreground, show a toast or alert if needed, or let system handle
            });

            await PushNotifications.addListener('pushNotificationActionPerformed', notification => {
                console.log('Push Action:', notification.actionId, notification.inputValue);
                // Navigate if needed
            });

            // If permission already granted, register
            const permStatus = await PushNotifications.checkPermissions();
            if (permStatus.receive === 'granted') {
                await PushNotifications.register();
            }
            return;
        }

        // --- WEB / PWA LOGIC ---
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            return;
        }

        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            
            const existingSub = await registration.pushManager.getSubscription();
            if (existingSub) {
                // Ensure backend has it
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
        } catch (error) {
            console.error('Web Push Error:', error);
        }
    };

    // Helper for Web Push Key
    function urlBase64ToUint8Array(base64String: string) {
      const padding = '='.repeat((4 - base64String.length % 4) % 4);
      const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      return outputArray;
    }

    const sendSubscriptionToBackend = async (subscription: PushSubscription) => {
      await apiCall('/subscribe', 'POST', subscription);
    };

    // Initialize if pref is true
    if (localStorage.getItem('app_notification_pref') === 'true') {
        initNotifications();
    }

  }, []);

  return null;
};

export default NotificationController;
