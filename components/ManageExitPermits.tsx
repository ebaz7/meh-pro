
import React, { useState, useEffect } from 'react';
import { ExitPermit, ExitPermitStatus, User, UserRole, SystemSettings } from '../types';
import { getExitPermits, updateExitPermitStatus, deleteExitPermit, getSettings } from '../services/storageService';
import { getUsers } from '../services/authService';
import { apiCall } from '../services/apiService';
import { Trash2, RefreshCw, Eye, CheckCircle, XCircle } from 'lucide-react';
import { formatDate } from '../constants';
import PrintExitPermit from './PrintExitPermit';

interface Props {
    currentUser: User;
    settings?: SystemSettings;
    statusFilter?: ExitPermitStatus | 'pending' | null;
}

const ManageExitPermits: React.FC<Props> = ({ currentUser, settings, statusFilter }) => {
    const [permits, setPermits] = useState<ExitPermit[]>([]);
    const [viewPermit, setViewPermit] = useState<ExitPermit | null>(null);
    const [permitForAutoSend, setPermitForAutoSend] = useState<ExitPermit | null>(null);
    const [isProcessingId, setIsProcessingId] = useState<string | null>(null);
    const [autoSendWatermark, setAutoSendWatermark] = useState<'DELETED' | 'EDITED' | null>(null);
    const [exitTimeValue, setExitTimeValue] = useState('');
    const [showExitTimeInput, setShowExitTimeInput] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, [statusFilter]);

    const loadData = async () => {
        const data = await getExitPermits();
        if (statusFilter === 'pending') {
            setPermits(data.filter(p => p.status !== ExitPermitStatus.EXITED && p.status !== ExitPermitStatus.REJECTED));
        } else if (statusFilter) {
            setPermits(data.filter(p => p.status === statusFilter));
        } else {
            setPermits(data);
        }
    };

    const generateFullCaption = (permit: ExitPermit, header: string, isFinal = false) => {
        let text = `${header}\n`;
        text += `🔢 شماره: ${permit.permitNumber}\n`;
        text += `👤 گیرنده: ${permit.recipientName}\n`;
        text += `📦 کالا: ${permit.goodsName}\n`;
        if (isFinal) {
            text += `🕒 ساعت خروج: ${permit.exitTime}\n`;
            text += `✅ وضعیت: خروج نهایی\n`;
        } else {
            text += `⏳ وضعیت: ${permit.status}\n`;
        }
        return text;
    };

    const sendWithRetry = async (payload: any, retries = 3): Promise<boolean> => {
        for (let i = 0; i < retries; i++) {
            try {
                await apiCall('/send-whatsapp', 'POST', payload);
                return true;
            } catch (e) {
                console.error(`Attempt ${i + 1} failed`, e);
                await new Promise(r => setTimeout(r, 1000));
            }
        }
        return false;
    };

    const updateExitPermitStatusWithNotify = async (id: string, nextStatus: ExitPermitStatus, extra?: any) => {
        setIsProcessingId(id);
        try {
            const updatedPermits = await updateExitPermitStatus(id, nextStatus, currentUser, extra);
            const updatedPermit = updatedPermits.find(p => p.id === id);
            
            if (updatedPermit) {
                setPermitForAutoSend(updatedPermit);
                
                // Wait for render
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                const element = document.getElementById(`print-permit-${id}`);
                if (element) {
                    try {
                        // @ts-ignore
                        const canvas = await window.html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
                        const base64 = canvas.toDataURL('image/png').split(',')[1];
                        const users = await getUsers();

                        // Notification Logic
                        if (nextStatus === ExitPermitStatus.PENDING_FACTORY) {
                            const caption = generateFullCaption(updatedPermit, "🏭 *تایید مدیرعامل انجام شد* (ارسال به مدیر کارخانه)");
                            const factoryUsers = users.filter(u => u.role === UserRole.FACTORY_MANAGER && u.phoneNumber);
                            for (const u of factoryUsers) {
                                await sendWithRetry({ number: u.phoneNumber!, message: caption, mediaData: { data: base64, mimeType: 'image/png' } });
                            }
                            
                            // Send to Notification Groups
                            if (settings?.exitPermitNotificationGroup) {
                                await sendWithRetry({ number: settings.exitPermitNotificationGroup, message: caption, mediaData: { data: base64, mimeType: 'image/png' } });
                            }
                            if (settings?.exitPermitNotificationGroup2) {
                                await sendWithRetry({ number: settings.exitPermitNotificationGroup2, message: caption, mediaData: { data: base64, mimeType: 'image/png' } });
                            }
                        }
                        else if (nextStatus === ExitPermitStatus.PENDING_WAREHOUSE) {
                            const caption = generateFullCaption(updatedPermit, "🏭 *تایید مدیر کارخانه انجام شد* (ارسال به سرپرست انبار)");
                            const warehouseUsers = users.filter(u => u.role === UserRole.WAREHOUSE_KEEPER && u.phoneNumber);
                            for (const u of warehouseUsers) {
                                await sendWithRetry({ number: u.phoneNumber!, message: caption, mediaData: { data: base64, mimeType: 'image/png' } });
                            }
                        }
                        else if (nextStatus === ExitPermitStatus.PENDING_SECURITY) {
                            const caption = generateFullCaption(updatedPermit, "📦 *تایید انبار و توزین نهایی انجام شد* (ارسال به انتظامات)");
                            const securityUsers = users.filter(u => (u.role === UserRole.SECURITY_GUARD || u.role === UserRole.SECURITY_HEAD) && u.phoneNumber);
                            for (const u of securityUsers) {
                                await sendWithRetry({ number: u.phoneNumber!, message: caption, mediaData: { data: base64, mimeType: 'image/png' } });
                            }
                        }
                        else if (nextStatus === ExitPermitStatus.EXITED) {
                            const caption = generateFullCaption(updatedPermit, "✅ *خروج نهایی بار از کارخانه ثبت شد*", true);
                            
                            const requester = users.find(u => u.fullName === updatedPermit.requester && u.phoneNumber);
                            if (requester) await sendWithRetry({ number: requester.phoneNumber!, message: caption, mediaData: { data: base64, mimeType: 'image/png' } });

                            if (settings?.exitPermitNotificationGroup) {
                                await sendWithRetry({ number: settings.exitPermitNotificationGroup, message: caption, mediaData: { data: base64, mimeType: 'image/png' } });
                            }
                            if (settings?.exitPermitNotificationGroup2) {
                                await sendWithRetry({ number: settings.exitPermitNotificationGroup2, message: caption, mediaData: { data: base64, mimeType: 'image/png' } });
                            }
                        }

                    } catch (e) { console.error("Notification Error", e); }
                }
            }
            loadData();
        } catch (e) {
            console.error(e);
            alert("خطا در عملیات");
        } finally {
            setIsProcessingId(null);
            setPermitForAutoSend(null);
            setViewPermit(null);
        }
    };

    const handleResendToGroup = async (permit: ExitPermit) => {
      if(!confirm('آیا مطمئن هستید که می‌خواهید مجوز را مجدداً به گروه ارسال کنید؟')) return;
      setIsProcessingId(permit.id);
      setAutoSendWatermark(null);
      setPermitForAutoSend({ ...permit });
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const element = document.getElementById(`print-permit-${permit.id}`);
      if (element) {
          try {
              // @ts-ignore
              const canvas = await window.html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
              const base64 = canvas.toDataURL('image/png').split(',')[1];
              
              let caption = "";
              if (permit.status === ExitPermitStatus.EXITED) {
                  caption = generateFullCaption(permit, "✅ *خروج نهایی بار از کارخانه ثبت شد* (ارسال مجدد)", true);
              } else {
                  caption = generateFullCaption(permit, "📢 *اطلاعیه: مجوز خروج صادر شد (ارسال مجدد)*");
              }
              
              if (settings?.exitPermitNotificationGroup) {
                  await apiCall('/send-whatsapp', 'POST', { number: settings.exitPermitNotificationGroup, message: caption, mediaData: { data: base64, mimeType: 'image/png' } });
              }
              if (settings?.exitPermitNotificationGroup2) {
                  await apiCall('/send-whatsapp', 'POST', { number: settings.exitPermitNotificationGroup2, message: caption, mediaData: { data: base64, mimeType: 'image/png' } });
              }
              alert('ارسال شد.');
          } catch (e) { alert('خطا در ارسال.'); }
      }
      setPermitForAutoSend(null);
      setIsProcessingId(null);
    };

    const handleDelete = async (id: string) => {
      if(!confirm('آیا از حذف این مجوز اطمینان دارید؟')) return;
      const permitToDelete = permits.find(p => p.id === id);
      if (!permitToDelete) return;

      setIsProcessingId(id);
      setAutoSendWatermark('DELETED');
      setPermitForAutoSend(permitToDelete);
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const element = document.getElementById(`print-permit-${id}`);
      if (element) {
          try {
              // @ts-ignore
              const canvas = await window.html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
              const base64 = canvas.toDataURL('image/png').split(',')[1];
              const caption = `❌❌ *مجوز خروج حذف شد* ❌❌\nشماره: ${permitToDelete.permitNumber}\nحذف کننده: ${currentUser.fullName}`;

              if (settings?.exitPermitNotificationGroup) {
                  await apiCall('/send-whatsapp', 'POST', { number: settings.exitPermitNotificationGroup, message: caption, mediaData: { data: base64, mimeType: 'image/png' } });
              }
          } catch(e) { console.error(e); }
      }
      
      await deleteExitPermit(id);
      setIsProcessingId(null);
      setPermitForAutoSend(null);
      loadData();
    };

    return (
        <div className="p-4 space-y-4">
            {/* Hidden Render for Auto Send */}
            {permitForAutoSend && (
                <div className="hidden-print-export" style={{position: 'absolute', top: '-9999px', left: '-9999px', width: '800px'}}>
                    <div id={`print-permit-${permitForAutoSend.id}`}>
                        <PrintExitPermit permit={permitForAutoSend} onClose={()=>{}} embed watermark={autoSendWatermark} />
                    </div>
                </div>
            )}

            {permits.map(permit => (
                <div key={permit.id} className="bg-white p-4 rounded-xl shadow-sm border flex justify-between items-center">
                    <div>
                        <div className="font-bold">شماره: {permit.permitNumber}</div>
                        <div className="text-sm text-gray-500">{permit.recipientName}</div>
                        <div className="text-xs bg-gray-100 px-2 py-1 rounded mt-1 inline-block">{permit.status}</div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setViewPermit(permit)} className="p-2 text-blue-600 bg-blue-50 rounded hover:bg-blue-100"><Eye size={18}/></button>
                        <button onClick={() => handleResendToGroup(permit)} className="p-2 text-orange-600 bg-orange-50 rounded hover:bg-orange-100"><RefreshCw size={18}/></button>
                        <button onClick={() => handleDelete(permit.id)} className="p-2 text-red-600 bg-red-50 rounded hover:bg-red-100"><Trash2 size={18}/></button>
                    </div>
                </div>
            ))}

            {viewPermit && (
                <PrintExitPermit 
                    permit={viewPermit} 
                    onClose={() => setViewPermit(null)} 
                    settings={settings}
                    onApprove={() => {
                        if (viewPermit.status === ExitPermitStatus.PENDING_CEO) updateExitPermitStatusWithNotify(viewPermit.id, ExitPermitStatus.PENDING_FACTORY);
                        else if (viewPermit.status === ExitPermitStatus.PENDING_FACTORY) updateExitPermitStatusWithNotify(viewPermit.id, ExitPermitStatus.PENDING_WAREHOUSE);
                        else if (viewPermit.status === ExitPermitStatus.PENDING_WAREHOUSE) updateExitPermitStatusWithNotify(viewPermit.id, ExitPermitStatus.PENDING_SECURITY);
                        else if (viewPermit.status === ExitPermitStatus.PENDING_SECURITY) {
                            const time = prompt("ساعت خروج (مثال: 14:30):");
                            if(time) updateExitPermitStatusWithNotify(viewPermit.id, ExitPermitStatus.EXITED, { exitTime: time });
                        }
                    }}
                    onReject={() => {
                        const reason = prompt("دلیل رد:");
                        if(reason) updateExitPermitStatusWithNotify(viewPermit.id, ExitPermitStatus.REJECTED, { rejectionReason: reason });
                    }}
                />
            )}
        </div>
    );
};

export default ManageExitPermits;
