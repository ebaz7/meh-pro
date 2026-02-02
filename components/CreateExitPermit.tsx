
import React, { useState, useEffect } from 'react';
import { ExitPermit, ExitPermitStatus, User, ExitPermitItem, ExitPermitDestination, UserRole, SystemSettings } from '../types';
import { saveExitPermit, getSettings } from '../services/storageService';
import { generateUUID, getCurrentShamsiDate, jalaliToGregorian } from '../constants';
import { apiCall } from '../services/apiService';
import { Save, Loader2, Truck, Package, MapPin, Hash, Plus, Trash2, ArrowLeft, ArrowRight, CheckCircle2, Calendar, RefreshCcw, User as UserIcon, Building2 } from 'lucide-react';

const CreateExitPermit: React.FC<{ onSuccess: () => void, currentUser: User }> = ({ onSuccess, currentUser }) => {
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [permitNumber, setPermitNumber] = useState('');
    const [loadingNum, setLoadingNum] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState('');
    const [availableCompanies, setAvailableCompanies] = useState<string[]>([]);
    
    const currentShamsi = getCurrentShamsiDate();
    const [shamsiDate, setShamsiDate] = useState({ year: currentShamsi.year, month: currentShamsi.month, day: currentShamsi.day });

    const [items, setItems] = useState<ExitPermitItem[]>([{ id: generateUUID(), goodsName: '', cartonCount: 0, weight: 0 }]);
    const [destinations, setDestinations] = useState<ExitPermitDestination[]>([{ id: generateUUID(), recipientName: '', address: '', phone: '' }]);
    const [driverInfo, setDriverInfo] = useState({ plateNumber: '', driverName: '', description: '' });

    // Initial load for companies
    useEffect(() => {
        getSettings().then(s => {
            const names = s.companies?.map(c => c.name) || s.companyNames || [];
            setAvailableCompanies(names);
            if (s.defaultCompany) {
                setSelectedCompany(s.defaultCompany);
                fetchNextNumber(s.defaultCompany);
            }
        });
    }, []);

    // Function to fetch next number - PER COMPANY
    const fetchNextNumber = (company?: string) => {
        if (!company) return;
        setLoadingNum(true);
        apiCall<{ nextNumber: number }>(`/next-exit-permit-number?company=${encodeURIComponent(company)}&t=${Date.now()}`)
            .then(res => {
                if (res && res.nextNumber) {
                    setPermitNumber(res.nextNumber.toString());
                } else {
                    setPermitNumber('1001');
                }
            })
            .catch(() => setPermitNumber('1001'))
            .finally(() => setLoadingNum(false));
    };

    const handleCompanyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        setSelectedCompany(val);
        fetchNextNumber(val);
    };

    const handleSubmit = async () => {
        if (!permitNumber) return alert('شماره مجوز الزامی است');
        if (!selectedCompany) return alert('انتخاب شرکت الزامی است');
        if (items.some(i => !i.goodsName || !i.cartonCount)) return alert('اطلاعات کالا ناقص است');
        if (destinations.some(d => !d.recipientName)) return alert('اطلاعات گیرنده ناقص است');

        setIsSubmitting(true);
        try {
            const isoDate = jalaliToGregorian(shamsiDate.year, shamsiDate.month, shamsiDate.day).toISOString().split('T')[0];
            const newPermit: ExitPermit = {
                id: generateUUID(),
                permitNumber: Number(permitNumber),
                company: selectedCompany,
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
        <div className="max-w-3xl mx-auto bg-white md:rounded-[2.5rem] shadow-none md:shadow-2xl md:shadow-blue-100 overflow-hidden animate-fade-in border-0 md:border border-gray-100 min-h-screen md:min-h-0">
            <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-6 text-white sticky top-0 z-10 md:static">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-xl font-black">ثبت خروج</h2>
                        <p className="text-xs text-gray-400 mt-1">درخواست جدید</p>
                    </div>
                    <div className="bg-white/10 p-2 rounded-xl backdrop-blur-sm">
                         {step === 1 ? <Hash size={24} className="text-blue-300" /> : step === 2 ? <Package size={24} className="text-blue-300" /> : <MapPin size={24} className="text-blue-300" />}
                    </div>
                </div>
                <div className="flex gap-2">
                    {[1, 2, 3].map(s => (
                        <div key={s} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${step >= s ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-gray-700'}`}></div>
                    ))}
                </div>
            </div>

            <div className="p-4 md:p-8 pb-24 md:pb-8">
                {step === 1 && (
                    <div className="space-y-6 animate-slide-up">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-black text-gray-700 flex items-center gap-2"><Building2 size={18} className="text-blue-500"/> شرکت صادر کننده</label>
                                <select 
                                    className="w-full border-2 border-gray-200 rounded-2xl p-4 bg-white font-bold focus:border-blue-500 outline-none transition-all"
                                    value={selectedCompany}
                                    onChange={handleCompanyChange}
                                >
                                    <option value="">-- انتخاب شرکت --</option>
                                    {availableCompanies.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-black text-gray-700 flex items-center gap-2"><Hash size={18} className="text-blue-500"/> شماره سند</label>
                                <div className="relative">
                                    <input type="number" className="w-full border-2 border-gray-200 rounded-2xl p-4 pl-12 bg-gray-50 font-mono font-bold text-xl text-blue-600 focus:border-blue-500 outline-none transition-all" value={permitNumber} onChange={e => setPermitNumber(e.target.value)} />
                                    <button 
                                        onClick={() => fetchNextNumber(selectedCompany)} 
                                        disabled={loadingNum || !selectedCompany}
                                        className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-blue-50 rounded-xl text-blue-600 hover:bg-blue-100 transition-colors"
                                    >
                                        <RefreshCcw size={18} className={loadingNum ? 'animate-spin' : ''}/>
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-black text-gray-700 flex items-center gap-2"><Calendar size={18} className="text-blue-500"/> تاریخ خروج</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <input type="number" className="border-2 border-gray-200 rounded-2xl p-3 text-center font-bold text-lg focus:border-blue-500 outline-none transition-all" placeholder="روز" value={shamsiDate.day} onChange={e => setShamsiDate({...shamsiDate, day: +e.target.value})} />
                                    <input type="number" className="border-2 border-gray-200 rounded-2xl p-3 text-center font-bold text-lg focus:border-blue-500 outline-none transition-all" placeholder="ماه" value={shamsiDate.month} onChange={e => setShamsiDate({...shamsiDate, month: +e.target.value})} />
                                    <input type="number" className="border-2 border-gray-200 rounded-2xl p-3 text-center font-bold text-lg focus:border-blue-500 outline-none transition-all" placeholder="سال" value={shamsiDate.year} onChange={e => setShamsiDate({...shamsiDate, year: +e.target.value})} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-4 animate-slide-up">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="font-black text-gray-800 flex items-center gap-2 text-lg">لیست اقلام</h3>
                            <button onClick={() => setItems([...items, { id: generateUUID(), goodsName: '', cartonCount: 0, weight: 0 }])} className="px-4 py-2 bg-blue-100 text-blue-700 rounded-xl hover:bg-blue-200 transition-colors font-bold text-xs flex items-center gap-1"><Plus size={16}/> افزودن</button>
                        </div>
                        {items.map((item, idx) => (
                            <div key={item.id} className="bg-white p-4 rounded-3xl border-2 border-gray-100 shadow-sm relative group">
                                <span className="absolute top-4 right-4 text-xs font-black text-gray-300 bg-gray-100 px-2 py-0.5 rounded-lg">#{idx+1}</span>
                                <div className="space-y-4 pt-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-500">نام کالا</label>
                                        <input className="w-full border-b-2 border-gray-200 p-2 text-base font-bold text-gray-800 focus:border-blue-500 outline-none bg-transparent" placeholder="مثلاً: میلگرد..." value={item.goodsName} onChange={e => { const n = [...items]; n[idx].goodsName = e.target.value; setItems(n); }} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1 bg-gray-50 p-2 rounded-xl">
                                            <label className="text-[10px] font-bold text-gray-400 block text-center">تعداد (کارتن)</label>
                                            <input type="number" className="w-full bg-transparent text-center font-black text-lg outline-none" value={item.cartonCount || ''} onChange={e => { const n = [...items]; n[idx].cartonCount = +e.target.value; setItems(n); }} placeholder="0" />
                                        </div>
                                        <div className="space-y-1 bg-gray-50 p-2 rounded-xl">
                                            <label className="text-[10px] font-bold text-gray-400 block text-center">وزن (کیلوگرم)</label>
                                            <input type="number" className="w-full bg-transparent text-center font-black text-lg outline-none" value={item.weight || ''} onChange={e => { const n = [...items]; n[idx].weight = +e.target.value; setItems(n); }} placeholder="0" />
                                        </div>
                                    </div>
                                </div>
                                {items.length > 1 && (
                                    <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-red-100 text-red-500 p-2 rounded-full shadow-sm hover:bg-red-200 border-2 border-white">
                                        <Trash2 size={16}/>
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {step === 3 && (
                    <div className="space-y-6 animate-slide-up">
                        <div className="bg-blue-50 p-5 rounded-[2rem] border border-blue-100 space-y-4">
                            <div className="flex items-center gap-2 text-blue-800 font-black border-b border-blue-200 pb-2">
                                <UserIcon size={20}/>
                                <h3>مشخصات گیرنده</h3>
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs text-blue-600 font-bold block mb-1">نام گیرنده</label>
                                    <input className="w-full bg-white rounded-xl p-3 text-sm font-bold shadow-sm outline-none focus:ring-2 focus:ring-blue-300" placeholder="نام..." value={destinations[0].recipientName} onChange={e => { const d = [...destinations]; d[0].recipientName = e.target.value; setDestinations(d); }} />
                                </div>
                                <div>
                                    <label className="text-xs text-blue-600 font-bold block mb-1">آدرس مقصد</label>
                                    <textarea className="w-full bg-white rounded-xl p-3 text-sm shadow-sm h-20 outline-none focus:ring-2 focus:ring-blue-300" placeholder="آدرس دقیق..." value={destinations[0].address} onChange={e => { const d = [...destinations]; d[0].address = e.target.value; setDestinations(d); }} />
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-50 p-5 rounded-[2rem] border border-gray-200 space-y-4">
                            <div className="flex items-center gap-2 text-gray-700 font-black border-b border-gray-200 pb-2">
                                <Truck size={20}/>
                                <h3>حمل و نقل (اختیاری)</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-gray-500 font-bold block mb-1">نام راننده</label>
                                    <input className="w-full bg-white rounded-xl p-3 text-sm shadow-sm outline-none" value={driverInfo.driverName} onChange={e => setDriverInfo({...driverInfo, driverName: e.target.value})} />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 font-bold block mb-1">شماره پلاک</label>
                                    <input className="w-full bg-white rounded-xl p-3 text-sm shadow-sm dir-ltr text-center font-mono outline-none" placeholder="12 A 345 67" value={driverInfo.plateNumber} onChange={e => setDriverInfo({...driverInfo, plateNumber: e.target.value})} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="fixed md:static bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 md:p-0 md:bg-transparent md:border-0 md:mt-8 z-20 safe-pb">
                    <div className="flex gap-3">
                        {step > 1 && (
                            <button onClick={() => setStep(s => s - 1)} className="px-6 py-4 rounded-2xl bg-gray-100 text-gray-600 font-bold flex items-center justify-center hover:bg-gray-200 transition-all active:scale-95">
                                <ArrowRight size={20}/>
                            </button>
                        )}
                        <button 
                            onClick={step === 3 ? handleSubmit : () => setStep(s => s + 1)} 
                            disabled={isSubmitting || !selectedCompany}
                            className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-blue-200 hover:shadow-blue-300 transition-all flex items-center justify-center gap-2 disabled:opacity-70 active:scale-95"
                        >
                            {isSubmitting ? <Loader2 className="animate-spin" /> : (step === 3 ? 'ثبت نهایی' : 'مرحله بعد')}
                            {step < 3 && !isSubmitting && <ArrowLeft size={20}/>}
                            {step === 3 && !isSubmitting && <CheckCircle2 size={20}/>}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreateExitPermit;
