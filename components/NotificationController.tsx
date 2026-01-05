
import React, { useEffect, useState } from 'react';
import { apiCall } from '../services/apiService';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { Share, PlusSquare, X, Bell } from 'lucide-react';
import { User } from '../types';

interface Props {
    currentUser?: User | null;
}

const NotificationController: React.FC<Props> = ({ currentUser }) => {
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);

  // Helper to convert Key
  function urlBase64ToUint8Array(base64String: string) {
      const padding = '='.repeat((4 - base64String.length % 4) % 4);
      const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
      return outputArray;
  }

  function arrayBufferToBase64(buffer: ArrayBuffer) {
      let binary = '';
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
      }
      return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  useEffect(() => {
    if (!currentUser) return; 

    const registerOrUpdateSubscription = async () => {
        try {
            if (Capacitor.isNativePlatform()) {
                const permStatus = await PushNotifications.checkPermissions();
                if (permStatus.receive !== 'granted') {
                    await PushNotifications.requestPermissions();
                }
                await PushNotifications.register();
            } else {
                if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
                    console.log('WebPush not supported');
                    return;
                }

                // 1. Register SW
                const registration = await navigator.serviceWorker.register('/sw.js');
                await navigator.serviceWorker.ready;

                // 2. Get Public Key from Server
                const { publicKey } = await apiCall<{ publicKey: string }>('/vapid-key');
                if (!publicKey) return;

                const convertedVapidKey = urlBase64ToUint8Array(publicKey);

                // 3. Check Existing Subscription
                const existingSub = await registration.pushManager.getSubscription();
                
                if (existingSub) {
                    // Check if key changed (Server rotated keys)
                    const existingKey = existingSub.options.applicationServerKey;
                    if (existingKey) {
                        const existingKeyStr = arrayBufferToBase64(existingKey);
                        // Simple comparison (might need better normalization, but usually effective)
                        // If they differ significantly, unsubscribe.
                        // Actually, easiest way is to try subscribing again.
                    }
                    
                    // Always update server with current subscription details to ensure it's fresh
                    const payload = {
                        ...JSON.parse(JSON.stringify(existingSub)),
                        username: currentUser.username,
                        role: currentUser.role,
                        deviceType: 'web'
                    };
                    await apiCall('/subscribe', 'POST', payload);
                } else {
                    // 4. Subscribe New
                    const subscription = await registration.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: convertedVapidKey
                    });

                    if (subscription) {
                        console.log('Got New Sub:', subscription);
                        const payload = {
                            ...JSON.parse(JSON.stringify(subscription)),
                            username: currentUser.username,
                            role: currentUser.role,
                            deviceType: 'web'
                        };
                        await apiCall('/subscribe', 'POST', payload);
                    }
                }
            }
        } catch (error) {
            console.error('Notification Setup Error:', error);
            // If subscription failed (e.g. key mismatch error from browser), try to unsubscribe old one
            if (error.name === 'InvalidStateError' || error.message.includes('subscription')) {
                 try {
                     const reg = await navigator.serviceWorker.getRegistration();
                     const sub = await reg?.pushManager.getSubscription();
                     await sub?.unsubscribe();
                     console.log("Old subscription removed. Refresh page to retry.");
                 } catch(e) {}
            }
        }
    };

    // iOS Add to Home Screen Check
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    if (isIOS && !isStandalone && !sessionStorage.getItem('ios_prompt_shown')) {
        setShowIOSPrompt(true);
        sessionStorage.setItem('ios_prompt_shown', 'true');
    }

    registerOrUpdateSubscription();

    if (Capacitor.isNativePlatform()) {
        PushNotifications.removeAllListeners(); 
        PushNotifications.addListener('registration', token => {
            const subObject = { 
                endpoint: token.value, 
                keys: { p256dh: 'native', auth: 'native' }, 
                type: 'android',
                username: currentUser.username,
                role: currentUser.role
            };
            apiCall('/subscribe', 'POST', subObject);
        });
    }

  }, [currentUser]);


  if (showIOSPrompt) {
      return (
        <div className="fixed inset-0 bg-black/80 z-[9999] flex flex-col justify-end pb-8 animate-fade-in backdrop-blur-sm">
            <div className="bg-white mx-4 rounded-2xl p-6 shadow-2xl relative">
                <button onClick={() => setShowIOSPrompt(false)} className="absolute top-3 right-3 text-gray-400 hover:text-red-500"><X size={20} /></button>
                <div className="flex flex-col items-center text-center">
                    <div className="bg-blue-100 p-4 rounded-full mb-4 animate-bounce"><PlusSquare size={32} className="text-blue-600" /></div>
                    <h3 className="text-lg font-black text-gray-800 mb-2">نصب نسخه وب اپلیکیشن (PWA)</h3>
                    <p className="text-sm text-gray-600 leading-relaxed mb-4">برای دریافت <span className="font-bold text-blue-600">نوتیفیکیشن‌ها</span>، لطفاً برنامه را نصب کنید.</p>
                    <div className="w-full bg-gray-50 rounded-xl p-4 border border-gray-200 text-right space-y-3">
                        <div className="flex items-center gap-3"><div className="bg-white p-1.5 rounded shadow-sm"><Share size={18} className="text-blue-500"/></div><span className="text-xs font-bold text-gray-700">۱. دکمه Share را بزنید.</span></div>
                        <div className="flex items-center gap-3"><div className="bg-white p-1.5 rounded shadow-sm"><PlusSquare size={18} className="text-blue-500"/></div><span className="text-xs font-bold text-gray-700">۲. گزینه Add to Home Screen را انتخاب کنید.</span></div>
                    </div>
                    <button onClick={() => setShowIOSPrompt(false)} className="mt-6 w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors">متوجه شدم</button>
                </div>
            </div>
        </div>
      );
  }

  return null;
};

export default NotificationController;
