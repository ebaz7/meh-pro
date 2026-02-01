
import React, { useState, useEffect } from 'react';
import { ExitPermit, ExitPermitStatus, User, ExitPermitItem, ExitPermitDestination, UserRole } from '../types';
import { saveExitPermit, getNextExitPermitNumber } from '../services/storageService';
import { generateUUID, getCurrentShamsiDate, jalaliToGregorian, formatDate } from '../constants';
import { Save, Loader2, Truck, Package, MapPin, Hash, Plus, Trash2, ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { apiCall } from '../services/apiService';
import { getUsers } from '../services/authService';

interface Props {
  onSuccess: () => void;
  currentUser: User;
}

const STEPS = [
  { id: 1, title: 'اطلاعات پایه', icon: Hash },
  { id: 2, title: 'اقلام و کالا', icon: Package },
  { id: 3, title: 'مقصد و راننده', icon: Truck },
];

const CreateExitPermit: React.FC<Props> = ({ onSuccess, currentUser }) => {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [permitNumber, setPermitNumber] = useState('');
  
  // Date State
  const currentShamsi = getCurrentShamsiDate();
  const [shamsiDate, setShamsiDate] = useState({ year: currentShamsi.year, month: currentShamsi.month, day: currentShamsi.day });

  // Data State
  const [items, setItems] = useState<ExitPermitItem[]>([{ id: generateUUID(), goodsName: '', cartonCount: 0, weight: 0 }]);
  const [destinations, setDestinations] = useState<ExitPermitDestination[]>([{ id: generateUUID(), recipientName: '', address: '', phone: '' }]);
  const [driverInfo, setDriverInfo] = useState({ plateNumber: '', driverName: '', description: '' });

  useEffect(() => { getNextExitPermitNumber().then(num => setPermitNumber(num.toString())); }, []);

  // --- Helpers ---
  const getIsoDate = () => {
      try {
          const d = jalaliToGregorian(shamsiDate.year, shamsiDate.month, shamsiDate.day);
          d.setHours(12, 0, 0, 0);
          return d.toISOString().split('T')[0];
      } catch { return new Date().toISOString().split('T')[0]; }
  };

  const handleNext = () => {
      if (step === 1 && !permitNumber) return alert('شماره مجوز الزامی است');
      if (step === 2 && items.some(i => !i.goodsName)) return alert('نام کالا الزامی است');
      if (step === 3) handleSubmit();
      else setStep(s => s + 1);
  };

  const handleBack = () => setStep(s => s - 1);

  const handleSubmit = async () => {
      if (destinations.some(d => !d.recipientName)) return alert('نام گیرنده الزامی است');
      
      setIsSubmitting(true);
      try {
          const totalCartons = items.reduce((acc, i) => acc + (Number(i.cartonCount) || 0), 0);
          const totalWeight = items.reduce((acc, i) => acc + (Number(i.weight) || 0), 0);
          
          const newPermit: ExitPermit = {
              id: generateUUID(),
              permitNumber: Number(permitNumber),
              date: getIsoDate(),
              requester: currentUser.fullName,
              items,
              destinations,
              goodsName: items.map(i => i.goodsName).join('، '),
              recipientName: destinations.map(d => d.recipientName).join('، '),
              cartonCount: totalCartons,
              weight: totalWeight,
              plateNumber: driverInfo.plateNumber,
              driverName: driverInfo.driverName,
              description: driverInfo.description,
              status: ExitPermitStatus.PENDING_CEO,
              createdAt: Date.now()
          };

          await saveExitPermit(newPermit);

          // Notification Logic
          try {
              const users = await getUsers();
              const ceo = users.find(u => u.role === UserRole.CEO && u.phoneNumber);
              if (ceo) {
                   const msg = `🚛 *درخواست خروج جدید*\nشماره: ${newPermit.permitNumber}\nدرخواست کننده: ${currentUser.fullName}\nگیرنده: ${newPermit.recipientName}\n\nجهت بررسی به کارتابل مراجعه کنید.`;
                   await apiCall('/send-whatsapp', 'POST', { number: ceo.phoneNumber, message: msg });
              }
          } catch (e) { console.error("Notification failed", e); }

          onSuccess();
      } catch (e) {
          alert('خطا در ثبت اطلاعات');
          setIsSubmitting(false);
      }
  };

  // --- Render Steps ---
  const renderStep1 = () => {
      const years = Array.from({ length: 5 }, (_, i) => 1402 + i);
      const months = [ 'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند' ];
      const days = Array.from({ length: 31 }, (_, i) => i + 1);

      return (
          <div className="space-y-6 animate-fade-in">
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                  <label className="text-sm font-bold text-gray-700 block mb-2">شماره مجوز</label>
                  <input type="number" className="w-full border-2 border-blue-200 rounded-xl p-3 text-center text-xl font-bold text-blue-700 outline-none focus:border-blue-500" value={permitNumber} onChange={e => setPermitNumber(e.target.value)} autoFocus />
              </div>
              <div>
                  <label className="text-sm font-bold text-gray-700 block mb-2">تاریخ خروج</label>
                  <div className="flex gap-2">
                      <select className="flex-1 border rounded-xl p-3 bg-white" value={shamsiDate.day} onChange={e => setShamsiDate({...shamsiDate, day: +e.target.value})}>{days.map(d => <option key={d} value={d}>{d}</option>)}</select>
                      <select className="flex-1 border rounded-xl p-3 bg-white" value={shamsiDate.month} onChange={e => setShamsiDate({...shamsiDate, month: +e.target.value})}>{months.map((m, i) => <option key={i} value={i+1}>{m}</option>)}</select>
                      <select className="flex-1 border rounded-xl p-3 bg-white" value={shamsiDate.year} onChange={e => setShamsiDate({...shamsiDate, year: +e.target.value})}>{years.map(y => <option key={y} value={y}>{y}</option>)}</select>
                  </div>
              </div>
          </div>
      );
  };

  const renderStep2 = () => (
      <div className="space-y-4 animate-fade-in">
          {items.map((item, idx) => (
              <div key={item.id} className="bg-gray-50 p-4 rounded-xl border border-gray-200 relative group">
                  <div className="absolute top-2 left-2 text-xs font-bold text-gray-400 bg-gray-200 px-2 rounded-full">#{idx + 1}</div>
                  <div className="space-y-3 mt-2">
                      <input className="w-full border rounded-lg p-2 text-sm" placeholder="نام کالا..." value={item.goodsName} onChange={e => { const n = [...items]; n[idx].goodsName = e.target.value; setItems(n); }} />
                      <div className="flex gap-2">
                          <input type="number" className="flex-1 border rounded-lg p-2 text-sm text-center" placeholder="تعداد" value={item.cartonCount || ''} onChange={e => { const n = [...items]; n[idx].cartonCount = +e.target.value; setItems(n); }} />
                          <input type="number" className="flex-1 border rounded-lg p-2 text-sm text-center" placeholder="وزن (kg)" value={item.weight || ''} onChange={e => { const n = [...items]; n[idx].weight = +e.target.value; setItems(n); }} />
                      </div>
                  </div>
                  {items.length > 1 && <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="absolute bottom-2 left-2 text-red-400 hover:text-red-600"><Trash2 size={16}/></button>}
              </div>
          ))}
          <button onClick={() => setItems([...items, { id: generateUUID(), goodsName: '', cartonCount: 0, weight: 0 }])} className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-bold hover:bg-gray-50 flex items-center justify-center gap-2"><Plus size={18}/> افزودن کالای دیگر</button>
      </div>
  );

  const renderStep3 = () => (
      <div className="space-y-6 animate-fade-in">
          <div className="bg-green-50 p-4 rounded-xl border border-green-200 space-y-3">
              <h4 className="font-bold text-green-800 text-sm flex items-center gap-2"><MapPin size={16}/> گیرنده کالا</h4>
              <input className="w-full border rounded-lg p-2" placeholder="نام گیرنده..." value={destinations[0].recipientName} onChange={e => { const d = [...destinations]; d[0].recipientName = e.target.value; setDestinations(d); }} />
              <input className="w-full border rounded-lg p-2" placeholder="آدرس..." value={destinations[0].address} onChange={e => { const d = [...destinations]; d[0].address = e.target.value; setDestinations(d); }} />
          </div>
          <div className="bg-orange-50 p-4 rounded-xl border border-orange-200 space-y-3">
              <h4 className="font-bold text-orange-800 text-sm flex items-center gap-2"><Truck size={16}/> حمل و نقل (اختیاری)</h4>
              <div className="flex gap-2">
                  <input className="flex-1 border rounded-lg p-2" placeholder="نام راننده" value={driverInfo.driverName} onChange={e => setDriverInfo({...driverInfo, driverName: e.target.value})} />
                  <input className="flex-1 border rounded-lg p-2 text-center dir-ltr" placeholder="پلاک" value={driverInfo.plateNumber} onChange={e => setDriverInfo({...driverInfo, plateNumber: e.target.value})} />
              </div>
          </div>
      </div>
  );

  return (
    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-auto overflow-hidden flex flex-col h-[600px]">
        {/* Header */}
        <div className="bg-gray-900 text-white p-4 flex justify-between items-center">
            <h3 className="font-bold text-lg">ثبت درخواست خروج</h3>
            <div className="flex gap-1">
                {STEPS.map(s => (
                    <div key={s.id} className={`w-2 h-2 rounded-full ${step >= s.id ? 'bg-green-400' : 'bg-gray-600'}`}></div>
                ))}
            </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
            <div className="text-center mb-6">
                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2 border-4 border-blue-50">
                    {React.createElement(STEPS[step-1].icon, { size: 32 })}
                </div>
                <h2 className="font-bold text-gray-800">{STEPS[step-1].title}</h2>
            </div>
            
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 flex justify-between">
            {step > 1 ? (
                <button onClick={handleBack} className="px-6 py-3 rounded-xl bg-white border border-gray-300 text-gray-700 font-bold flex items-center gap-2 hover:bg-gray-100"><ArrowRight size={18}/> مرحله قبل</button>
            ) : (
                <div></div>
            )}
            
            <button 
                onClick={handleNext} 
                disabled={isSubmitting}
                className="px-8 py-3 rounded-xl bg-blue-600 text-white font-bold flex items-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all disabled:opacity-70"
            >
                {isSubmitting ? <Loader2 className="animate-spin"/> : (step === 3 ? 'ثبت نهایی' : 'مرحله بعد')} 
                {!isSubmitting && step !== 3 && <ArrowLeft size={18}/>}
            </button>
        </div>
    </div>
  );
};

export default CreateExitPermit;
