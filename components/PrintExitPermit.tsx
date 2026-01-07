
import React, { useState, useEffect, useRef } from 'react';
import { ExitPermit, ExitPermitStatus, SystemSettings, UserRole } from '../types';
import { formatDate, formatCurrency } from '../constants';
import { X, Printer, Clock, MapPin, Package, Truck, CheckCircle, Share2, Edit, Loader2, Users, Search, FileDown } from 'lucide-react';
import { apiCall } from '../services/apiService';
import { getUsers } from '../services/authService';
import { generatePdf } from '../utils/pdfGenerator'; // Import Utility

interface Props {
  permit: ExitPermit;
  onClose: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  onEdit?: () => void;
  settings?: SystemSettings;
  embed?: boolean; 
  watermark?: 'DELETED' | 'EDITED' | null; // NEW PROP
}

const PrintExitPermit: React.FC<Props> = ({ permit, onClose, onApprove, onReject, onEdit, settings, embed, watermark }) => {
  const [sharing, setSharing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showContactSelect, setShowContactSelect] = useState(false);
  const [contactSearch, setContactSearch] = useState('');

  // Scaling State
  const [scale, setScale] = useState(1);
  const containerWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      const style = document.getElementById('page-size-style');
      if (style && !embed) { 
          style.innerHTML = '@page { size: A4 portrait; margin: 0; }';
      }
  }, [embed]);

  // Auto-Scale Logic
  useEffect(() => {
    const handleResize = () => {
        if (embed) return;
        const wrapper = containerWrapperRef.current;
        if (wrapper) {
            const wrapperWidth = wrapper.clientWidth;
            const targetWidth = 794; // A4 Width in px (approx)
            
            if (wrapperWidth < targetWidth + 40) {
                const newScale = (wrapperWidth - 32) / targetWidth;
                setScale(newScale);
            } else {
                setScale(1);
            }
        }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [embed]);

  const Stamp = ({ title, name, date }: { title: string, name: string, date?: string }) => (
      <div className="border-2 border-blue-800 text-blue-800 rounded-xl p-2 rotate-[-5deg] opacity-90 inline-block bg-white/80 print:bg-transparent shadow-sm">
          <div className="text-[10px] font-bold border-b border-blue-800 mb-1 pb-1 text-center">{title}</div>
          <div className="text-sm font-black text-center px-2">{name}</div>
          {date && <div className="text-[10px] text-center mt-1">{date}</div>}
      </div>
  );

  const containerId = embed ? `print-permit-${permit.id}` : "print-area-exit";

  const handleDownloadPDF = async () => {
      setProcessing(true);
      await generatePdf({
          elementId: containerId,
          filename: `Permit_${permit.permitNumber}.pdf`,
          format: 'A4',
          orientation: 'portrait',
          onComplete: () => setProcessing(false),
          onError: () => { alert('خطا در ایجاد PDF'); setProcessing(false); }
      });
  };

  const handleSendToWhatsApp = async (targetNumber: string) => {
      if (!targetNumber) return;
      setSharing(true);
      const element = document.getElementById(containerId);
      
      if (!element) { 
          alert("خطا: المان چاپ پیدا نشد."); 
          setSharing(false); 
          return; 
      }
      
      try {
          // @ts-ignore
          const canvas = await window.html2canvas(element, { 
              scale: 2, 
              backgroundColor: '#ffffff', 
              useCORS: true,
              windowWidth: 1200 
          });
          const base64 = canvas.toDataURL('image/png').split(',')[1];
          let caption = `🚛 *مجوز خروج کالا*\n🔢 شماره: ${permit.permitNumber}\n📅 تاریخ: ${formatDate(permit.date)}\n👤 گیرنده: ${permit.recipientName}\n📦 اقلام: ${permit.goodsName}`;
          if(permit.exitTime) caption += `\n🕒 ساعت خروج: ${permit.exitTime}`;
          await apiCall('/send-whatsapp', 'POST', {
              number: targetNumber,
              message: caption,
              mediaData: { data: base64, mimeType: 'image/png', filename: `Permit_${permit.permitNumber}.png` }
          });
          if (!embed) alert('ارسال شد.');
          setShowContactSelect(false);
      } catch(e: any) { 
          console.error("WhatsApp Send Error:", e);
          alert('خطا در ارسال: ' + (e.message || 'Unknown error')); 
      } finally { setSharing(false); }
  };

  const filteredContacts = settings?.savedContacts?.filter(c => 
    c.name.toLowerCase().includes(contactSearch.toLowerCase()) || 
    c.number.includes(contactSearch)
  ) || [];

  const displayItems = permit.items && permit.items.length > 0 ? permit.items : [{ id: 'legacy', goodsName: permit.goodsName || '', cartonCount: permit.cartonCount || 0, weight: permit.weight || 0, deliveredCartonCount: permit.cartonCount || 0, deliveredWeight: permit.weight || 0 }];
  const displayDestinations = permit.destinations && permit.destinations.length > 0 ? permit.destinations : [{ id: 'legacy', recipientName: permit.recipientName || '', address: permit.destinationAddress || '', phone: '' }];
  
  const totalCartonsReq = displayItems.reduce((acc, i) => acc + (Number(i.cartonCount) || 0), 0);
  const totalWeightReq = displayItems.reduce((acc, i) => acc + (Number(i.weight) || 0), 0);
  const totalCartonsDel = displayItems.reduce((acc, i) => acc + (Number(i.deliveredCartonCount ?? i.cartonCount) || 0), 0);
  const totalWeightDel = displayItems.reduce((acc, i) => acc + (Number(i.deliveredWeight ?? i.weight) || 0), 0);
  const showDeliveryColumns = displayItems.some(i => i.deliveredCartonCount !== undefined);

  const content = (
      <div id={containerId} 
        className="printable-content bg-white mx-auto shadow-2xl relative text-gray-900 flex flex-col" 
        style={{ 
            direction: 'rtl', 
            width: '210mm', 
            height: '296mm', 
            padding: '15mm', 
            boxSizing: 'border-box',
            margin: '0 auto',
            maxHeight: '296mm',
            overflow: 'hidden'
        }}>
            {watermark === 'DELETED' && (<div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none overflow-hidden"><div className="border-[12px] border-red-500 text-red-500 font-black text-9xl opacity-40 rotate-[-45deg] p-10 rounded-3xl whitespace-nowrap bg-white/50 backdrop-blur-[2px]">حذف شد</div></div>)}
            {watermark === 'EDITED' && (<div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none overflow-hidden"><div className="border-[12px] border-orange-500 text-orange-500 font-black text-9xl opacity-40 rotate-[-45deg] p-10 rounded-3xl whitespace-nowrap bg-white/50 backdrop-blur-[2px]">اصلاحیه</div></div>)}

            <div className="flex justify-between items-center border-b-4 border-black pb-4 mb-8">
                <div className="flex flex-col"><h1 className="text-3xl font-black mb-1">مجوز خروج کالا از کارخانه</h1><p className="text-sm font-bold text-gray-600">سیستم مکانیزه مدیریت بار و خروج</p></div>
                <div className="text-left space-y-2"><div className="text-xl font-black bg-gray-100 px-4 py-2 border-2 border-black rounded-lg">شماره: {permit.permitNumber}</div><div className="text-sm font-bold">تاریخ: {formatDate(permit.date)}</div>{permit.exitTime && <div className="text-sm font-black text-blue-700 flex items-center gap-1 justify-end"><Clock size={16}/> خروج: {permit.exitTime}</div>}</div>
            </div>
            <div className="flex-1 space-y-8">
                <div className="space-y-2"><h3 className="font-black text-lg flex items-center gap-2"><Package size={20}/> لیست اقلام و کالاها</h3>
                    <table className="w-full text-sm border-collapse border-2 border-black text-center">
                        <thead>
                            <tr className="bg-gray-100 text-base">
                                <th className="border-2 border-black p-3 w-12" rowSpan={2}>#</th>
                                <th className="border-2 border-black p-3 text-center" rowSpan={2}>شرح کالا / محصول</th>
                                <th className="border-2 border-black p-2" colSpan={showDeliveryColumns ? 2 : 1}>تعداد (کارتن)</th>
                                <th className="border-2 border-black p-2" colSpan={showDeliveryColumns ? 2 : 1}>وزن (KG)</th>
                            </tr>
                            {showDeliveryColumns && (
                                <tr className="bg-gray-50 text-xs">
                                    <th className="border-2 border-black p-1 text-gray-500 w-24">درخواستی</th>
                                    <th className="border-2 border-black p-1 w-24 bg-green-50 text-green-800">خروجی</th>
                                    <th className="border-2 border-black p-1 text-gray-500 w-24">درخواستی</th>
                                    <th className="border-2 border-black p-1 w-24 bg-green-50 text-green-800">خروجی</th>
                                </tr>
                            )}
                        </thead>
                        <tbody>
                            {displayItems.map((item, idx) => (
                                <tr key={idx} className="text-lg">
                                    <td className="border-2 border-black p-3">{idx + 1}</td>
                                    <td className="border-2 border-black p-3 font-bold text-center align-middle">{item.goodsName}</td>
                                    {showDeliveryColumns ? (
                                        <>
                                            <td className="border-2 border-black p-3 font-mono text-gray-400 bg-gray-50/50">{item.cartonCount}</td>
                                            <td className="border-2 border-black p-3 font-mono font-bold bg-green-50/30">{item.deliveredCartonCount ?? item.cartonCount}</td>
                                            <td className="border-2 border-black p-3 font-mono text-gray-400 bg-gray-50/50">{item.weight}</td>
                                            <td className="border-2 border-black p-3 font-mono font-bold bg-green-50/30">{item.deliveredWeight ?? item.weight}</td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="border-2 border-black p-3 font-mono">{item.cartonCount}</td>
                                            <td className="border-2 border-black p-3 font-mono">{item.weight}</td>
                                        </>
                                    )}
                                </tr>
                            ))}
                            <tr className="bg-gray-50 font-black text-xl">
                                <td colSpan={2} className="border-2 border-black p-4 text-left pl-8 text-lg">جمع کل مقادیر:</td>
                                {showDeliveryColumns ? (
                                    <>
                                        <td className="border-2 border-black p-4 font-mono text-gray-400 text-sm">{totalCartonsReq}</td>
                                        <td className="border-2 border-black p-4 font-mono">{totalCartonsDel}</td>
                                        <td className="border-2 border-black p-4 font-mono text-gray-400 text-sm">{totalWeightReq}</td>
                                        <td className="border-2 border-black p-4 font-mono">{totalWeightDel}</td>
                                    </>
                                ) : (
                                    <>
                                        <td className="border-2 border-black p-4 font-mono">{totalCartonsReq}</td>
                                        <td className="border-2 border-black p-4 font-mono">{totalWeightReq}</td>
                                    </>
                                )}
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div className="space-y-2"><h3 className="font-black text-lg flex items-center gap-2"><MapPin size={20}/> مقاصد و گیرندگان</h3>
                    <div className="space-y-2">{displayDestinations.map((dest, idx) => (<div key={idx} className="border-2 border-gray-300 rounded-xl p-4 flex flex-col gap-1 bg-gray-50/50"><div className="flex justify-between font-black text-base border-b border-gray-300 pb-1 mb-1"><span>گیرنده: {dest.recipientName}</span>{dest.phone && <span className="font-mono">تلفن: {dest.phone}</span>}</div><div className="text-sm">آدرس: {dest.address}</div></div>))}</div>
                </div>
                <div className="grid grid-cols-2 gap-6 bg-gray-100 border-2 border-black p-6 rounded-2xl">
                    <div className="flex items-center gap-3 text-lg"><Truck size={24} className="text-gray-600"/><span className="font-bold">نام راننده:</span> <span className="font-black">{permit.driverName || '---'}</span></div>
                    <div className="flex items-center gap-3 text-lg"><div className="font-bold">شماره پلاک:</div> <div className="font-black font-mono tracking-widest dir-ltr border-2 border-gray-400 bg-white px-4 py-1 rounded-lg">{permit.plateNumber || '---'}</div></div>
                </div>
            </div>
            
            <div className="mt-12 pt-8 border-t-4 border-black grid grid-cols-5 gap-4 text-center">
                <div className="flex flex-col items-center justify-end min-h-[120px]"><div className="mb-2"><Stamp title="مدیر فروش (درخواست)" name={permit.requester} /></div><div className="w-full border-t-2 border-gray-300 pt-2"><span className="text-[10px] font-black text-gray-700">مدیر فروش</span></div></div>
                <div className="flex flex-col items-center justify-end min-h-[120px]"><div className="mb-2">{permit.approverCeo ? <Stamp title="تایید مدیریت عامل" name={permit.approverCeo} /> : <span className="text-gray-300 text-xs italic">امضا مدیرعامل</span>}</div><div className="w-full border-t-2 border-gray-300 pt-2"><span className="text-[10px] font-black text-gray-700">مدیر عامل</span></div></div>
                <div className="flex flex-col items-center justify-end min-h-[120px]"><div className="mb-2">{permit.approverFactory ? <Stamp title="تایید مدیر کارخانه" name={permit.approverFactory} /> : <span className="text-gray-300 text-xs italic">امضا مدیر کارخانه</span>}</div><div className="w-full border-t-2 border-gray-300 pt-2"><span className="text-[10px] font-black text-gray-700">مدیر کارخانه</span></div></div>
                <div className="flex flex-col items-center justify-end min-h-[120px]"><div className="mb-2">{permit.approverWarehouse ? <Stamp title="تایید سرپرست انبار" name={permit.approverWarehouse} /> : <span className="text-gray-300 text-xs italic">امضا سرپرست انبار</span>}</div><div className="w-full border-t-2 border-gray-300 pt-2"><span className="text-[10px] font-black text-gray-700">سرپرست انبار</span></div></div>
                <div className="flex flex-col items-center justify-end min-h-[120px]"><div className="mb-2">{permit.approverSecurity ? <Stamp title="خروج نهایی (ساعت)" name={`${permit.approverSecurity} (${permit.exitTime})`} /> : <span className="text-gray-300 text-xs italic">تایید انتظامات</span>}</div><div className="w-full border-t-2 border-gray-300 pt-2"><span className="text-[10px] font-black text-gray-700">انتظامات / حراست</span></div></div>
            </div>
            <div className="mt-8 text-center text-[10px] text-gray-400">این سند به صورت سیستمی تولید شده و فاقد خدشه معتبر می‌باشد. | تاریخ چاپ: {new Date().toLocaleString('fa-IR')}</div>
        </div>
  );

  if (embed) return content;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex flex-col items-center justify-start md:justify-center p-4 overflow-y-auto animate-fade-in safe-pb">
        <div className="bg-white p-3 rounded-xl shadow-lg relative md:absolute md:top-4 md:left-4 z-[210] flex flex-col gap-2 no-print w-full md:w-56 mb-4 md:mb-0 order-1 border border-gray-200">
            <div className="flex justify-between items-center"><span className="text-sm font-bold">پنل عملیات</span><button onClick={onClose} className="text-gray-400 hover:text-red-500"><X size={20}/></button></div>
            {onApprove && <button onClick={onApprove} className="bg-green-600 text-white p-2.5 rounded-lg flex items-center gap-2 justify-center font-bold shadow-sm"><CheckCircle size={18}/> تایید مرحله بعدی</button>}
            <div className="grid grid-cols-2 gap-2">
                {onEdit && <button onClick={onEdit} className="bg-amber-500 text-white p-2 rounded-lg flex items-center justify-center gap-1 font-bold text-xs"><Edit size={16}/> ویرایش</button>}
                {onReject && <button onClick={onReject} className="bg-red-600 text-white p-2 rounded-lg flex items-center justify-center gap-1 font-bold text-xs"><X size={16}/> رد</button>}
            </div>
            <hr className="my-1"/>
            <button onClick={() => window.print()} className="bg-blue-600 text-white p-2.5 rounded-lg text-sm font-bold hover:bg-blue-700 flex items-center justify-center gap-2 transition-transform active:scale-95"><Printer size={18}/> چاپ (A4)</button>
            <button onClick={handleDownloadPDF} disabled={processing} className="bg-gray-100 text-gray-700 p-2.5 rounded-lg text-sm font-bold hover:bg-gray-200 flex items-center justify-center gap-2">{processing ? <Loader2 size={18} className="animate-spin"/> : <FileDown size={18}/>} دانلود PDF</button>
            <button onClick={() => setShowContactSelect(!showContactSelect)} disabled={sharing} className={`bg-green-600 text-white p-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all ${showContactSelect ? 'ring-2 ring-green-300' : ''}`}>{sharing ? <Loader2 size={18} className="animate-spin"/> : <Share2 size={18}/>} ارسال واتساپ</button>
            {showContactSelect && (
                <div className="absolute top-full right-0 md:-right-32 mt-2 w-full min-w-[280px] md:w-80 bg-white rounded-xl shadow-2xl border border-gray-200 z-[300] animate-scale-in flex flex-col overflow-hidden">
                    <div className="p-3 bg-gray-50 border-b flex flex-col gap-2">
                        <div className="flex justify-between items-center"><span className="text-xs font-black text-gray-700">انتخاب مخاطب</span><button onClick={()=>setShowContactSelect(false)}><X size={14}/></button></div>
                        <div className="relative"><Search size={14} className="absolute right-2 top-2 text-gray-400"/><input className="w-full bg-white border border-gray-300 rounded-lg pr-8 pl-2 py-1.5 text-xs outline-none focus:border-blue-500" placeholder="جستجو نام یا شماره..." value={contactSearch} onChange={e=>setContactSearch(e.target.value)} autoFocus/></div>
                    </div>
                    <div className="max-h-60 overflow-y-auto bg-white custom-scrollbar">
                        {filteredContacts.length > 0 ? filteredContacts.map(c => (
                            <div key={c.id} className="p-2 border-b border-gray-50 hover:bg-blue-50/50 flex items-center justify-between group">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <div className={`p-1.5 rounded-full shrink-0 ${c.isGroup ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}><Users size={12}/></div>
                                    <div className="truncate"><div className="font-bold text-[11px] text-gray-800 truncate">{c.name}</div><div className="text-[9px] text-gray-500 font-mono">{c.number}</div></div>
                                </div>
                                <button onClick={()=>handleSendToWhatsApp(c.number)} className="bg-green-600 text-white px-3 py-1 rounded-md text-[10px] font-bold hover:bg-green-700 shadow-sm whitespace-nowrap">ارسال</button>
                            </div>
                        )) : <div className="p-4 text-center text-[10px] text-gray-400">مخاطبی یافت نشد.</div>}
                    </div>
                    <div className="p-2 bg-gray-50 border-t"><button onClick={()=>{const n=prompt("شماره همراه:"); if(n) handleSendToWhatsApp(n);}} className="w-full text-center py-2 text-[10px] text-blue-600 font-black hover:bg-white rounded border border-blue-100 transition-colors">شماره دستی...</button></div>
                </div>
            )}
        </div>
        
        {/* Responsive Container for Scaling */}
        <div className="order-2 w-full flex justify-center pb-10" ref={containerWrapperRef}>
            <div style={{ 
              width: '210mm', 
              height: '296mm',
              backgroundColor: 'white', 
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              transform: `scale(${scale})`,
              transformOrigin: 'top center',
              marginBottom: `${(1 - scale) * -100}px` 
            }}>
                {content}
            </div>
        </div>
    </div>
  );
};
export default PrintExitPermit;
