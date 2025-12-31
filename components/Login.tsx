
import React, { useState, useEffect } from 'react';
import { login } from '../services/authService';
import { getServerHost, setServerHost } from '../services/apiService';
import { User } from '../types';
import { LogIn, KeyRound, Loader2, Settings, Server, Wifi, Globe, Save } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // بخش تنظیمات سرور
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    const savedUsername = localStorage.getItem('saved_username');
    if (savedUsername) setUsername(savedUsername);
    
    setIsNative(Capacitor.isNativePlatform());
    
    // خواندن آدرس فعلی
    const currentHost = getServerHost();
    setServerUrl(currentHost);

    // اگر آدرس تنظیم نشده و در محیط موبایل هستیم، صفحه تنظیمات را باز کن
    if (Capacitor.isNativePlatform() && !currentHost) {
        setShowServerConfig(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // چک کردن تنظیم بودن آدرس سرور قبل از تلاش برای لاگین
    if (isNative && !getServerHost()) {
        setError('لطفا ابتدا آدرس سرور را تنظیم کنید.');
        setShowServerConfig(true);
        return;
    }

    setLoading(true);
    setError('');
    
    try {
        const user = await login(username, password);
        if (user) {
          localStorage.setItem('saved_username', username);
          onLogin(user);
        } else {
          setError('نام کاربری یا رمز عبور اشتباه است.');
        }
    } catch (e: any) {
        if (e.message === "SERVER_URL_MISSING") {
            setError("آدرس سرور تنظیم نشده است.");
            setShowServerConfig(true);
        } else {
            setError('خطا در اتصال به سرور. اینترنت یا آدرس سرور را بررسی کنید.');
        }
    } finally {
        setLoading(false);
    }
  };

  const handleSaveServer = (e: React.FormEvent) => {
      e.preventDefault();
      if(!serverUrl.trim()) {
          alert("لطفا آدرس سرور را وارد کنید");
          return;
      }
      
      setServerHost(serverUrl);
      setShowServerConfig(false);
      setError('');
      alert("آدرس سرور ذخیره شد.");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4 relative font-sans">
      
      {/* دکمه شناور تنظیمات در بالای صفحه */}
      <button 
        onClick={() => setShowServerConfig(!showServerConfig)} 
        className="absolute top-6 right-6 p-3 bg-white rounded-full shadow-md text-gray-500 hover:text-blue-600 transition-colors z-10"
        title="تنظیمات اتصال"
      >
        <Settings size={24} />
      </button>

      <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md border border-gray-100 relative overflow-hidden">
        
        {showServerConfig ? (
            <div className="animate-fade-in space-y-6">
                <div className="flex flex-col items-center mb-4">
                    <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 mb-4 border-4 border-indigo-100 shadow-inner">
                        <Globe size={40} />
                    </div>
                    <h1 className="text-2xl font-black text-gray-800">اتصال به سرور</h1>
                    <p className="text-gray-500 mt-2 text-sm text-center leading-relaxed px-4">
                        آدرس آی‌پی یا دامین سرور نرم‌افزار را وارد کنید.
                    </p>
                </div>
                
                <form onSubmit={handleSaveServer} className="space-y-5">
                    <div>
                        <label className="text-xs font-bold text-gray-500 block mb-2 mr-1">آدرس سرور (مثال: 192.168.1.100:3000)</label>
                        <div className="relative">
                            <input 
                                type="text" 
                                value={serverUrl} 
                                onChange={(e) => setServerUrl(e.target.value)} 
                                className="w-full border-2 border-gray-200 rounded-xl px-4 py-4 pl-12 text-left dir-ltr font-mono font-bold text-gray-700 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all outline-none" 
                                placeholder="https://... یا http://..."
                                required 
                            />
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                                <Server size={20}/>
                            </div>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-2 mr-1">اگر پورت ۳۰۰۰ است، حتما وارد کنید.</p>
                    </div>

                    <div className="pt-2">
                        <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 text-lg">
                            <Save size={20}/>
                            ذخیره و بازگشت
                        </button>
                        <button type="button" onClick={() => setShowServerConfig(false)} className="w-full mt-3 text-gray-500 py-3 rounded-xl font-medium hover:bg-gray-50 transition-all">
                            انصراف
                        </button>
                    </div>
                </form>
            </div>
        ) : (
            <>
                <div className="flex flex-col items-center mb-8">
                    <div className="w-20 h-20 bg-blue-600 rounded-2xl rotate-3 flex items-center justify-center text-white mb-6 shadow-xl shadow-blue-600/30">
                        <KeyRound size={40} className="-rotate-3" />
                    </div>
                    <h1 className="text-3xl font-black text-gray-800 tracking-tight">ورود به سیستم</h1>
                    <div className="mt-3 flex items-center gap-2 px-3 py-1 bg-gray-50 rounded-full border border-gray-200">
                        <div className={`w-2 h-2 rounded-full ${isNative ? 'bg-purple-500' : 'bg-green-500'}`}></div>
                        <p className="text-gray-500 text-xs font-bold">{isNative ? 'نسخه موبایل' : 'نسخه وب'}</p>
                    </div>
                </div>
                
                {isNative && !serverUrl && (
                    <div onClick={() => setShowServerConfig(true)} className="bg-amber-50 text-amber-800 p-4 rounded-xl text-xs mb-6 flex items-start gap-3 border border-amber-200 shadow-sm cursor-pointer hover:bg-amber-100 transition-colors">
                        <Wifi size={20} className="shrink-0 mt-0.5"/>
                        <span className="leading-5 font-bold">اتصال به سرور تنظیم نشده است. برای تنظیم کلیک کنید.</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  {error && <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm text-center border border-red-100 font-bold animate-pulse">{error}</div>}
                  
                  <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700 block mr-1">نام کاربری</label>
                      <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full border-2 border-gray-200 rounded-xl px-4 py-3.5 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all bg-white text-left dir-ltr outline-none font-medium" required />
                  </div>
                  
                  <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700 block mr-1">رمز عبور</label>
                      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border-2 border-gray-200 rounded-xl px-4 py-3.5 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all bg-white text-left dir-ltr outline-none font-medium" required />
                  </div>

                  <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold shadow-xl shadow-blue-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-70 text-lg mt-4">
                      {loading ? <Loader2 className="animate-spin" /> : <LogIn size={22} />}
                      ورود به حساب
                  </button>
                </form>
            </>
        )}
      </div>
      
      <div className="absolute bottom-4 text-center text-gray-400 text-[10px] dir-ltr font-mono">
          App Version 1.1 | {serverUrl ? serverUrl.replace(/^https?:\/\//, '') : 'No Server Configured'}
      </div>
    </div>
  );
};
export default Login;
