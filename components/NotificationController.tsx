
import React, { useEffect, useState } from 'react';
import { apiCall } from '../services/apiService';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { Share, PlusSquare, X } from 'lucide-react';
import { User } from '../types';

interface Props {
    currentUser?: User | null;
}

const NotificationController: React.FC<Props> = ({ currentUser }) => {
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);

  useEffect(() => {
    if (!currentUser) return; // Don't register if not logged in

    const initNotifications = async () => {
        if (Capacitor.isNativePlatform()) {
            // ... (Native Logic) ...
            try {
                await PushNotifications.createChannel({
                    id: 'fcm_default_channel',
                    name: 'General Notifications',
                    description: 'General system alerts',
                    importance: 5,
                    visibility: 1,
                    sound: 'default',
                    vibration: true,
                    lights: true,
                    lightColor: '#2563EB'
                });
            } catch(e) {}

            await PushNotifications.addListener('registration', token => {
                // Send native token with user info
                const subObject = { 
                    endpoint: token.value, 
                    keys: { p256dh: 'native', auth: 'native' }, 
                    type: 'android',
                    username: currentUser.username,
                    role: currentUser.role
                };
                apiCall('/subscribe', 'POST', subObject);
            });

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
            } catch (e) {}
        } else {
            // --- WEB / PWA LOGIC (iOS & Android) ---
            
            // 1. Detect iOS PWA State
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;

            // If on iOS and NOT installed to Home Screen, show instruction
            if (isIOS && !isStandalone) {
                if (!sessionStorage.getItem('ios_prompt_shown')) {
                    setShowIOSPrompt(true);
                    sessionStorage.setItem('ios_prompt_shown', 'true');
                }
            }

            if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                await navigator.serviceWorker.ready;

                // Check existing subscription
                const existingSub = await registration.pushManager.getSubscription();
                if (existingSub) {
                    await sendSubscriptionToBackend(existingSub);
                    return;
                }

                // If installed (Standalone) or Android, try to subscribe automatically
                if (isStandalone || !isIOS) {
                    const { publicKey } = await apiCall<{ publicKey: string }>('/vapid-key');
                    if (publicKey) {
                        const convertedVapidKey = urlBase64ToUint8Array(publicKey);
                        const subscription = await registration.pushManager.subscribe({
                            userVisibleOnly: true,
                            applicationServerKey: convertedVapidKey
                        });
                        await sendSubscriptionToBackend(subscription);
                    }
                }
            } catch (error) { 
                console.error('Web Push Error:', error); 
            }
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
      // Enhance subscription object with user identity
      const payload = {
          ...JSON.parse(JSON.stringify(subscription)),
          username: currentUser.username,
          role: currentUser.role
      };
      await apiCall('/subscribe', 'POST', payload);
    };

    initNotifications();
  }, [currentUser]); // Re-run if user changes

  if (showIOSPrompt) {
      return (
        <div className="fixed inset-0 bg-black/80 z-[9999] flex flex-col justify-end pb-8 animate-fade-in backdrop-blur-sm">
            <div className="bg-white mx-4 rounded-2xl p-6 shadow-2xl relative">
                <button 
                    onClick={() => setShowIOSPrompt(false)} 
                    className="absolute top-3 right-3 text-gray-400 hover:text-red-500"
                >
                    <X size={20} />
                </button>
                
                <div className="flex flex-col items-center text-center">
                    <div className="bg-blue-100 p-4 rounded-full mb-4 animate-bounce">
                        <PlusSquare size={32} className="text-blue-600" />
                    </div>
                    <h3 className="text-lg font-black text-gray-800 mb-2">نصب نسخه وب اپلیکیشن (PWA)</h3>
                    <p className="text-sm text-gray-600 leading-relaxed mb-4">
                        برای دریافت <span className="font-bold text-blue-600">نوتیفیکیشن‌ها در پس‌زمینه</span> (حتی وقتی برنامه بسته است) و عملکرد مشابه اپلیکیشن، باید این وب‌سایت را به صفحه اصلی خود اضافه کنید.
                    </p>
                    
                    <div className="w-full bg-gray-50 rounded-xl p-4 border border-gray-200 text-right space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="bg-white p-1.5 rounded shadow-sm"><Share size={18} className="text-blue-500"/></div>
                            <span className="text-xs font-bold text-gray-700">۱. دکمه Share (اشتراک‌گذاری) در پایین مرورگر را بزنید.</span>
                        </div>
                        <div className="w-px h-4 bg-gray-300 mr-4"></div>
                        <div className="flex items-center gap-3">
                            <div className="bg-white p-1.5 rounded shadow-sm"><PlusSquare size={18} className="text-blue-500"/></div>
                            <span className="text-xs font-bold text-gray-700">۲. گزینه Add to Home Screen را انتخاب کنید.</span>
                        </div>
                    </div>
                    
                    <button 
                        onClick={() => setShowIOSPrompt(false)}
                        className="mt-6 w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors"
                    >
                        متوجه شدم
                    </button>
                </div>
                
                <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-white animate-bounce">
                    <div className="w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[10px] border-t-white mx-auto"></div>
                </div>
            </div>
        </div>
      );
  }

  return null;
};

export default NotificationController;
