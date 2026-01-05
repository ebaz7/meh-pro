
import React, { useState, useEffect } from 'react';
import { login } from '../services/authService';
import { getServerHost, setServerHost } from '../services/apiService';
import { User } from '../types';
import { LogIn, KeyRound, Loader2, Settings, Server, Wifi, WifiOff, Save, RefreshCw, AlertTriangle, Globe } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    const savedUsername = localStorage.getItem('saved_username');
    if (savedUsername) setUsername(savedUsername);
    
    const native = Capacitor.isNativePlatform();
    setIsNative(native);

    const host = getServerHost();
    setServerUrl(host);

    if (native && !host) {
        setShowServerConfig(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
        }
    } catch (e: any) {
        setLoading(false);
        console.error("Login Error:", e);
        
        if (e.message === "SERVER_URL_MISSING") {
            setError("آدرس سرور تنظیم نشده است.");
            setShowServerConfig(true);
        } else if (e.message && e.message.includes('401')) {
            setError('نام کاربری یا رمز عبور اشتباه است.');
        } else {
            // General connection error
            setError('خطا در اتصال به سرور. آدرس یا اینترنت را چک کنید.');
        }
    }
  };

  const handleSaveServer = (e: React.FormEvent) => {
      e.preventDefault();
      let inputUrl = serverUrl.trim();
      
      if(!inputUrl) {
          alert("لطفا آدرس سرور را وارد کنید");
          return;
      }
      
      // 1. Remove trailing slash
      inputUrl = inputUrl.replace(/\/$/, '');
      
      // 2. Smart Protocol Handling
      // If user provided http:// or https://, respect it.
      // If not, default to http:// (common for local IPs).
      if (!inputUrl.startsWith('http://') && !inputUrl.startsWith('https://')) {
          inputUrl = `http://${inputUrl}`;
      }
      
      setServerHost(inputUrl);
      setServerUrl(inputUrl); // Update UI to show the finalized URL
      
      setShowServerConfig(false);
      setError('');
      
      alert(`تنظیمات ذخیره شد:\n${inputUrl}\n\nاکنون می‌توانید وارد شوید.`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4 relative font-sans">
      
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
                        <Server size={40} />
                    </div>
                    <h1 className="text-2xl font-black text-gray-800">اتصال به سرور</h1>
                    <p className="text-gray-500 mt-2 text-sm text-center leading-relaxed px-4">
                        آدرس IP یا دامنه سرور را وارد کنید.
                    </p>
                </div>
                
                <form onSubmit={handleSaveServer} className="space-y-5">
                    <div>
                        <label className="text-xs font-bold text-gray-500 block mb-2 mr-1">آدرس سرور (IP یا دامنه)</label>
                        <div className="relative">
                            <input 
                                type="text" 
                                value={serverUrl} 
                                onChange={(e) => setServerUrl(e.target.value)} 
                                className="w-full border-2 border-gray-200 rounded-xl px-4 py-4 pl-12 text-left dir-ltr font-mono font-bold text-gray-700 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all outline-none" 
                                placeholder="192.168.1.100:3000"
                                autoCapitalize="off"
                                autoCorrect="off"
                            />
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                                <Globe size={20}/>
                            </div>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-2 mr-1">
                            مثال‌ها: <span className="font-mono text-indigo-600">192.168.1.50:3000</span> یا <span className="font-mono text-indigo-600">https://api.domain.com</span>
                        </p>
                    </div>

                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 text-[10px] text-blue-800 flex gap-2">
                        <Wifi size={16} className="shrink-0"/>
                        <p>اگر از IP عددی استفاده می‌کنید، مطمئن شوید گوشی و سرور به یک شبکه (وای‌فای) متصل هستند.</p>
                    </div>

                    <div className="pt-2">
                        <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 text-lg">
                            <Save size={20}/>
                            ذخیره تنظیمات
                        </button>
                        <button type="button" onClick={() => setShowServerConfig(false)} className="w-full mt-3 text-gray-500 py-3 rounded-xl font-medium hover:bg-gray-50 transition-all">
                            بازگشت به ورود
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
                    <div className="bg-amber-50 text-amber-800 p-4 rounded-xl text-xs mb-6 flex items-start gap-3 border border-amber-200 shadow-sm cursor-pointer" onClick={() => setShowServerConfig(true)}>
                        <WifiOff size={20} className="shrink-0 mt-0.5"/>
                        <span className="leading-5">هنوز آدرس سرور تنظیم نشده است. برای تنظیم اینجا کلیک کنید.</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  {error && (
                      <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm text-center border border-red-100 font-bold animate-pulse flex flex-col items-center gap-2">
                          <span>{error}</span>
                          {(error.includes('سرور') || error.includes('اتصال')) && (
                              <button type="button" onClick={() => setShowServerConfig(true)} className="text-xs bg-red-100 px-3 py-1 rounded-full flex items-center gap-1 hover:bg-red-200 mt-1">
                                  <RefreshCw size={12}/> تغییر آدرس سرور
                              </button>
                          )}
                      </div>
                  )}
                  
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
      
      <div className="absolute bottom-4 text-center text-gray-400 text-[10px] dir-ltr font-mono opacity-50">
          {isNative ? (serverUrl || 'No Server Set') : 'Web Mode'}
      </div>
    </div>
  );
};
export default Login;
