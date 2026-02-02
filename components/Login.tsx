import React, { useState, useEffect, useRef } from 'react';
import { login } from '../services/authService';
import { getServerHost, setServerHost, apiCall } from '../services/apiService';
import { User } from '../types';
import { LogIn, KeyRound, Loader2, Settings, Server, Wifi, WifiOff, Save, RefreshCw, Globe, CheckCircle2, XCircle, Database, UploadCloud } from 'lucide-react';
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
  
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const restoreFileInputRef = useRef<HTMLInputElement>(null);
  
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [testMessage, setTestMessage] = useState('');

  useEffect(() => {
    try {
        const savedUsername = localStorage.getItem('saved_username');
        if (savedUsername) setUsername(savedUsername);
        
        const native = Capacitor.isNativePlatform();
        setIsNative(native);

        const host = getServerHost();
        setServerUrl(host);

        if (native && !host) {
            setShowServerConfig(true);
        }
    } catch(e) {
        console.error("Login Init Error", e);
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
        if (e.message === "SERVER_URL_MISSING") {
            setError("آدرس سرور تنظیم نشده است.");
            setShowServerConfig(true);
        } else if (e.message && e.message.includes('401')) {
            setError('نام کاربری یا رمز عبور اشتباه است.');
        } else {
            setError('عدم ارتباط با سرور.');
        }
    }
  };

  const handleRestoreFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!confirm('⚠️ هشدار جدی:\nآیا مطمئن هستید که می‌خواهید دیتابیس را بازگردانی کنید؟\nاطلاعات فعلی حذف می‌شود.')) {
          e.target.value = '';
          return;
      }

      setRestoring(true);
      const reader = new FileReader();
      
      reader.onload = async (ev) => {
          const base64 = ev.target?.result as string;
          try {
              const response = await apiCall<{success: boolean}>('/emergency-restore', 'POST', { fileData: base64 });
              if (response.success) {
                  alert('✅ دیتابیس با موفقیت بازگردانی شد.');
                  window.location.reload();
              }
          } catch (error: any) {
              alert('خطا در بازگردانی: ' + error.message);
          } finally {
              setRestoring(false);
              setShowRestoreModal(false);
          }
      };
      reader.readAsDataURL(file);
  };

  const handleSaveServer = (e: React.FormEvent) => {
      e.preventDefault();
      let inputUrl = serverUrl.trim().replace(/\/$/, '');
      if (!inputUrl.startsWith('http')) inputUrl = `http://${inputUrl}`;
      setServerHost(inputUrl);
      setServerUrl(inputUrl);
      setShowServerConfig(false);
      alert('تنظیمات ذخیره شد.');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4 relative font-sans" dir="rtl">
      
      <button onClick={() => setShowServerConfig(!showServerConfig)} className="absolute top-6 left-6 p-3 bg-white rounded-full shadow text-gray-500 z-50">
        <Settings size={24} />
      </button>

      <button onClick={() => setShowRestoreModal(true)} className="absolute top-6 right-6 p-3 bg-white rounded-full shadow text-amber-500 z-50 md:flex hidden">
        <Database size={24} />
      </button>

      {/* Restore Modal */}
      {showRestoreModal && (
          <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
                  <h3 className="text-xl font-bold mb-4">بازگردانی دیتابیس</h3>
                  <input type="file" ref={restoreFileInputRef} className="hidden" accept=".json,.txt" onChange={handleRestoreFileChange}/>
                  <div className="space-y-3">
                      <button onClick={() => restoreFileInputRef.current?.click()} disabled={restoring} className="w-full bg-amber-500 text-white py-3 rounded-xl font-bold">
                          {restoring ? 'در حال انجام...' : 'انتخاب فایل بکاپ'}
                      </button>
                      <button onClick={() => setShowRestoreModal(false)} disabled={restoring} className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-bold">انصراف</button>
                  </div>
              </div>
          </div>
      )}

      <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md border border-gray-100 relative">
        {showServerConfig ? (
            <div className="space-y-4">
                <h1 className="text-2xl font-black text-center text-gray-800">تنظیمات سرور</h1>
                <form onSubmit={handleSaveServer} className="space-y-4">
                    <input type="text" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} className="w-full border-2 rounded-xl px-4 py-3 text-left dir-ltr" placeholder="192.168.1.10:3000" />
                    <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold">ذخیره</button>
                </form>
            </div>
        ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="text-center mb-6">
                    <h1 className="text-3xl font-black text-gray-800">ورود به سیستم</h1>
                </div>
                {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm text-center font-bold">{error}</div>}
                
                <div className="space-y-1">
                    <label className="text-sm font-bold text-gray-700 block">نام کاربری</label>
                    <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full border-2 rounded-xl px-4 py-3 text-left dir-ltr" required />
                </div>
                <div className="space-y-1">
                    <label className="text-sm font-bold text-gray-700 block">رمز عبور</label>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border-2 rounded-xl px-4 py-3 text-left dir-ltr" required />
                </div>

                <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold shadow-xl flex items-center justify-center gap-2">
                    {loading ? <Loader2 className="animate-spin" /> : <LogIn size={20} />} ورود
                </button>
                
                <div className="text-center pt-2">
                    <button type="button" onClick={() => setShowRestoreModal(true)} className="text-xs text-amber-600 font-bold hover:underline">بازیابی اطلاعات (Restore)</button>
                </div>
            </form>
        )}
      </div>
    </div>
  );
};
export default Login;