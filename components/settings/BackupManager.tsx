
import React, { useRef, useState } from 'react';
import { Database, DownloadCloud, UploadCloud, Clock, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { apiCall } from '../../services/apiService';

const BackupManager: React.FC = () => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [restoring, setRestoring] = useState(false);
    const [message, setMessage] = useState('');

    const handleDownloadBackup = (includeFiles: boolean) => {
        window.location.href = `/api/full-backup?includeFiles=${includeFiles}`;
    };

    const handleRestoreClick = () => {
        if (confirm('⚠️ هشدار بازگردانی هوشمند:\n\nآیا مطمئن هستید؟ این عملیات تمام اطلاعات فعلی را با فایل انتخاب شده جایگزین می‌کند.\n\nنکته: سیستم از «بازگردانی هوشمند» استفاده می‌کند، بنابراین اگر فایل بکاپ قدیمی باشد، مشکلی برای قابلیت‌های جدید پیش نمی‌آید و اطلاعات جدید (مثل تنظیمات سال مالی) حفظ می‌شوند.')) {
            fileInputRef.current?.click();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setRestoring(true);
        setMessage('');

        const reader = new FileReader();
        reader.onload = async (ev) => {
            const base64 = ev.target?.result as string;
            try {
                const response = await apiCall<{success: boolean}>('/emergency-restore', 'POST', { fileData: base64 });
                if (response.success) {
                    alert('✅ بازگردانی هوشمند با موفقیت انجام شد.\nسیستم رفرش می‌شود.');
                    window.location.reload();
                } else {
                    throw new Error("Restore failed on server");
                }
            } catch (error) {
                setMessage('❌ خطا در بازگردانی فایل. لطفاً فایل صحیح را انتخاب کنید.');
                setRestoring(false);
            }
        };
        reader.readAsDataURL(file);
        e.target.value = ''; // Reset input
    };

    return (
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden animate-fade-in mb-6">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <Database size={100}/>
            </div>
            
            <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2 relative z-10 text-lg border-b pb-2">
                <Database size={24} className="text-blue-600"/> 
                مدیریت پشتیبان‌گیری و بازیابی (سیستم هوشمند)
            </h3>
            
            {/* Auto-Backup Status */}
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-start gap-3 relative z-10">
                <div className="bg-green-100 p-2 rounded-full">
                    <Clock size={20} className="text-green-600 animate-pulse"/>
                </div>
                <div>
                    <span className="text-sm font-bold text-green-800 block mb-1">سیستم پشتیبان‌گیری خودکار فعال است</span>
                    <p className="text-xs text-green-700 leading-relaxed">
                        سیستم به صورت خودکار <strong>هر ۱ ساعت</strong> یک نسخه پشتیبان تهیه می‌کند. 
                        همچنین بکاپ‌های قدیمی‌تر از ۴۸ ساعت به طور خودکار حذف می‌شوند تا فضای سرور پر نشود.
                        <br/>
                        <span className="font-bold mt-1 block text-green-900">ویژگی جدید: بکاپ‌ها مستقل از آپدیت هستند. با خیال راحت آپدیت کنید.</span>
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                {/* Download Section */}
                <div className="space-y-3">
                    <h4 className="text-sm font-bold text-gray-700 mb-2">دریافت نسخه پشتیبان</h4>
                    <button 
                        type="button" 
                        onClick={() => handleDownloadBackup(false)} 
                        className="w-full flex items-center justify-between bg-gray-50 hover:bg-gray-100 text-gray-700 px-4 py-3 rounded-xl text-sm font-bold transition-colors border border-gray-200"
                    >
                        <span className="flex items-center gap-2"><DownloadCloud size={18} className="text-blue-600"/> دانلود دیتابیس (JSON)</span>
                        <span className="text-[10px] bg-white px-2 py-0.5 rounded border">سریع</span>
                    </button>
                    
                    <button 
                        type="button" 
                        onClick={() => handleDownloadBackup(true)} 
                        className="w-full flex items-center justify-between bg-gray-50 hover:bg-gray-100 text-gray-700 px-4 py-3 rounded-xl text-sm font-bold transition-colors border border-gray-200"
                    >
                        <span className="flex items-center gap-2"><DownloadCloud size={18} className="text-purple-600"/> دانلود کامل (با تصاویر)</span>
                        <span className="text-[10px] bg-white px-2 py-0.5 rounded border">حجیم</span>
                    </button>
                </div>

                {/* Restore Section */}
                <div className="border-r-0 md:border-r border-gray-100 md:pr-6">
                    <h4 className="text-sm font-bold text-gray-700 mb-2">بازیابی اطلاعات (Smart Restore)</h4>
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} accept=".json,.txt" />
                    
                    <button 
                        type="button" 
                        onClick={handleRestoreClick} 
                        disabled={restoring} 
                        className="w-full h-[106px] flex flex-col items-center justify-center gap-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border-2 border-dashed border-amber-300 px-4 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {restoring ? <Loader2 size={32} className="animate-spin"/> : <UploadCloud size={32}/>}
                        {restoring ? 'در حال بازگردانی هوشمند...' : 'آپلود فایل بکاپ برای بازگردانی'}
                        {!restoring && <span className="text-[10px] opacity-70 font-normal">سازگار با تمام نسخه‌های قبلی و بعدی</span>}
                    </button>
                    
                    {message && (
                        <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded text-center font-bold">
                            {message}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BackupManager;
