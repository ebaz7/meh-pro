
import React, { useState, useEffect } from 'react';
import { ExitPermit, ExitPermitStatus, User, ExitPermitItem, ExitPermitDestination, UserRole } from '../types';
import { saveExitPermit, getNextExitPermitNumber } from '../services/storageService';
import { generateUUID, getCurrentShamsiDate, jalaliToGregorian } from '../constants';
// Fixed: Added Calendar to imports
import { Save, Loader2, Truck, Package, MapPin, Hash, Plus, Trash2, ArrowLeft, ArrowRight, CheckCircle2, Calendar } from 'lucide-react';

const CreateExitPermit: React.FC<{ onSuccess: () => void, currentUser: User }> = ({ onSuccess, currentUser }) => {
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [permitNumber, setPermitNumber] = useState('');
    
    const currentShamsi = getCurrentShamsiDate();
    const [shamsiDate, setShamsiDate] = useState({ year: currentShamsi.year, month: currentShamsi.month, day: currentShamsi.day });

    const [items, setItems] = useState<ExitPermitItem[]>([{ id: generateUUID(), goodsName: '', cartonCount: 0, weight: 0 }]);
    const [destinations, setDestinations] = useState<ExitPermitDestination[]>([{ id: generateUUID(), recipientName: '', address: '', phone: '' }]);
    const [driverInfo, setDriverInfo] = useState({ plateNumber: '', driverName: '', description: '' });

    useEffect(() => { getNextExitPermitNumber().then(num => setPermitNumber(num.toString())); }, []);

    const handleSubmit = async () => {
        if (!permitNumber) return alert('شماره مجوز الزامی است');
        if (items.some(i => !i.goodsName || !i.cartonCount)) return alert('اطلاعات کالا ناقص است');
        if (destinations.some(d => !d.recipientName)) return alert('اطلاعات گیرنده ناقص است');

        setIsSubmitting(true);
        try {
            const isoDate = jalaliToGregorian(shamsiDate.year, shamsiDate.month, shamsiDate.day).toISOString().split('T')[0];
            const newPermit: ExitPermit = {
                id: generateUUID(),
                permitNumber: Number(permitNumber),
                date: isoDate,
                requester: currentUser.fullName,
                items,
                destinations,
                goodsName: items.map(i => i.goodsName).join('، '),
                recipientName: destinations.map(d => d.recipientName).join('، '),
                cartonCount: items.reduce((acc, i) => acc + i.cartonCount, 0),
                weight: items.reduce((acc, i) => acc + i.weight, 0),
                plateNumber: driverInfo.plateNumber,
                driverName: driverInfo.driverName,
                description: driverInfo.description,
                status: ExitPermitStatus.PENDING_CEO,
                createdAt: Date.now()
            };
            await saveExitPermit(newPermit);
            onSuccess();
        } catch (e) {
            alert('خطا در ثبت درخواست');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto bg-white rounded-[2.5rem] shadow-2xl shadow-blue-100 overflow-hidden animate-fade-in border border-gray-100">
            {/* Steps Header */}
            <div className="bg-gray-900 p-8 text-white">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-2xl font-black">ثبت درخواست خروج بار</h2>
                    <Truck size={32} className="text-blue-400" />
                </div>
                <div className="flex gap-4">
                    {[1, 2, 3].map(s => (
                        <div key={s} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${step >= s ? 'bg-blue-500' : 'bg-gray-700'}`}></div>
                    ))}
                </div>
            </div>

            <div className="p-8">
                {step === 1 && (
                    <div className="space-y-6 animate-slide-up">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-black text-gray-700 flex items-center gap-2"><Hash size={16} className="text-blue-500"/> شماره سند خروج</label>
                                <input type="number" className="w-full border-2 border-gray-100 rounded-2xl p-4 bg-gray-50 font-mono font-bold text-xl text-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all outline-none" value={permitNumber} onChange={e => setPermitNumber(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-black text-gray-700 flex items-center gap-2"><Calendar size={16} className="text-blue-500"/> تاریخ خروج</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <input type="number" className="border-2 border-gray-100 rounded-2xl p-3 text-center text-sm" placeholder="روز" value={shamsiDate.day} onChange={e => setShamsiDate({...shamsiDate, day: +e.target.value})} />
                                    <input type="number" className="border-2 border-gray-100 rounded-2xl p-3 text-center text-sm" placeholder="ماه" value={shamsiDate.month} onChange={e => setShamsiDate({...shamsiDate, month: +e.target.value})} />
                                    <input type="number" className="border-2 border-gray-100 rounded-2xl p-3 text-center text-sm" placeholder="سال" value={shamsiDate.year} onChange={e => setShamsiDate({...shamsiDate, year: +e.target.value})} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-6 animate-slide-up">
                        <div className="flex justify-between items-center">
                            <h3 className="font-black text-gray-800 flex items-center gap-2"><Package size={20} className="text-blue-500"/> لیست اقلام بارگیری</h3>
                            <button onClick={() => setItems([...items, { id: generateUUID(), goodsName: '', cartonCount: 0, weight: 0 }])} className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm"><Plus size={20}/></button>
                        </div>
                        {items.map((item, idx) => (
                            <div key={item.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end bg-gray-50 p-4 rounded-3xl border border-gray-100">
                                <div className="md:col-span-6 space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400">نام کالا</label>
                                    <input className="w-full border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500" placeholder="مثلاً: میلگرد 14..." value={item.goodsName} onChange={e => { const n = [...items]; n[idx].goodsName = e.target.value; setItems(n); }} />
                                </div>
                                <div className="md:col-span-3 space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400">تعداد (کارتن/واحد)</label>
                                    <input type="number" className="w-full border-none rounded-xl p-3 text-sm text-center" value={item.cartonCount || ''} onChange={e => { const n = [...items]; n[idx].cartonCount = +e.target.value; setItems(n); }} />
                                </div>
                                <div className="md:col-span-2 space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400">وزن تقریبی (kg)</label>
                                    <input type="number" className="w-full border-none rounded-xl p-3 text-sm text-center" value={item.weight || ''} onChange={e => { const n = [...items]; n[idx].weight = +e.target.value; setItems(n); }} />
                                </div>
                                <div className="md:col-span-1 text-center">
                                    {items.length > 1 && <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 p-2"><Trash2 size={20}/></button>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {step === 3 && (
                    <div className="space-y-6 animate-slide-up">
                        <div className="bg-blue-50 p-6 rounded-[2rem] border border-blue-100 space-y-4">
                            <h3 className="font-black text-blue-900 flex items-center gap-2"><MapPin size={20}/> مشخصات تحویل</h3>
                            <input className="w-full border-none rounded-2xl p-4 text-sm shadow-sm" placeholder="نام دقیق گیرنده کالا..." value={destinations[0].recipientName} onChange={e => { const d = [...destinations]; d[0].recipientName = e.target.value; setDestinations(d); }} />
                            <textarea className="w-full border-none rounded-2xl p-4 text-sm shadow-sm h-24" placeholder="آدرس دقیق مقصد..." value={destinations[0].address} onChange={e => { const d = [...destinations]; d[0].address = e.target.value; setDestinations(d); }} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input className="w-full border-2 border-gray-100 rounded-2xl p-4 text-sm" placeholder="نام راننده..." value={driverInfo.driverName} onChange={e => setDriverInfo({...driverInfo, driverName: e.target.value})} />
                            <input className="w-full border-2 border-gray-100 rounded-2xl p-4 text-sm dir-ltr text-center font-mono" placeholder="پلاک خودرو" value={driverInfo.plateNumber} onChange={e => setDriverInfo({...driverInfo, plateNumber: e.target.value})} />
                        </div>
                    </div>
                )}

                {/* Footer buttons */}
                <div className="mt-12 flex justify-between gap-4">
                    {step > 1 && (
                        <button onClick={() => setStep(s => s - 1)} className="px-8 py-4 rounded-2xl bg-gray-100 text-gray-700 font-bold flex items-center gap-2 hover:bg-gray-200 transition-all">
                            <ArrowRight size={20}/> مرحله قبلی
                        </button>
                    )}
                    <button 
                        onClick={step === 3 ? handleSubmit : () => setStep(s => s + 1)} 
                        disabled={isSubmitting}
                        className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isSubmitting ? <Loader2 className="animate-spin" /> : (step === 3 ? 'تایید و ثبت نهایی' : 'ادامه مرحله بعد')}
                        {step < 3 && <ArrowLeft size={20}/>}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateExitPermit;
