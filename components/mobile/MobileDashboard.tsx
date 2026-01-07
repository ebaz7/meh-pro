
import React from 'react';
import { PaymentOrder, OrderStatus, User } from '../../types';
import { Clock, CheckCircle, Activity, XCircle, Banknote, Package } from 'lucide-react';
import { formatCurrency } from '../../constants';

interface Props {
  orders: PaymentOrder[];
  currentUser: User;
  onNavigate: (tab: string) => void;
}

const MobileDashboard: React.FC<Props> = ({ orders, currentUser, onNavigate }) => {
  const pendingCount = orders.filter(o => o.status === OrderStatus.PENDING).length;
  const approvedCount = orders.filter(o => o.status === OrderStatus.APPROVED_CEO).length;
  const myRequests = orders.filter(o => o.requester === currentUser.fullName && o.status !== OrderStatus.APPROVED_CEO).length;

  return (
    <div className="space-y-4">
      {/* Welcome Card */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-5 text-white shadow-lg shadow-blue-200">
        <h2 className="text-xl font-black mb-1">خوش آمدید 👋</h2>
        <p className="text-blue-100 text-sm opacity-90">پنل مدیریت نسخه موبایل</p>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-4">
        <button onClick={() => onNavigate('create')} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform">
          <div className="bg-green-100 p-3 rounded-full text-green-600"><Banknote size={24}/></div>
          <span className="font-bold text-sm text-gray-700">ثبت پرداخت</span>
        </button>
        <button onClick={() => onNavigate('manage')} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform">
          <div className="bg-orange-100 p-3 rounded-full text-orange-600"><Activity size={24}/></div>
          <span className="font-bold text-sm text-gray-700">پیگیری</span>
        </button>
      </div>

      {/* Stats Vertical Stack */}
      <div className="space-y-3">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-amber-100 p-2 rounded-xl text-amber-600"><Clock size={20}/></div>
            <span className="font-bold text-gray-700">در انتظار بررسی</span>
          </div>
          <span className="text-lg font-black text-amber-600">{pendingCount}</span>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-xl text-blue-600"><CheckCircle size={20}/></div>
            <span className="font-bold text-gray-700">درخواست‌های من</span>
          </div>
          <span className="text-lg font-black text-blue-600">{myRequests}</span>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 p-2 rounded-xl text-green-600"><Package size={20}/></div>
            <span className="font-bold text-gray-700">بایگانی شده</span>
          </div>
          <span className="text-lg font-black text-green-600">{approvedCount}</span>
        </div>
      </div>
    </div>
  );
};

export default MobileDashboard;
