
import React, { useState } from 'react';
import { PaymentOrder, User, OrderStatus, UserRole } from '../../types';
import MobileOrderCard from './MobileOrderCard';
import { Search, Filter, RefreshCcw } from 'lucide-react';
import { deleteOrder } from '../../services/storageService';
import PrintVoucher from '../PrintVoucher';

interface Props {
  orders: PaymentOrder[];
  currentUser: User;
  refreshData: () => void;
}

const MobileOrderList: React.FC<Props> = ({ orders, currentUser, refreshData }) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<PaymentOrder | null>(null);

  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.payee.includes(searchTerm) || o.description.includes(searchTerm) || o.trackingNumber.toString().includes(searchTerm);
    if (!matchesSearch) return false;

    if (filter === 'pending') return o.status !== OrderStatus.APPROVED_CEO && o.status !== OrderStatus.REVOKED && o.status !== OrderStatus.REJECTED;
    if (filter === 'completed') return o.status === OrderStatus.APPROVED_CEO || o.status === OrderStatus.REVOKED;
    return true;
  });

  const handleDelete = async (id: string) => {
    if (confirm('حذف شود؟')) {
      await deleteOrder(id);
      refreshData();
    }
  };

  const canDelete = (order: PaymentOrder) => {
      // Replicating logic from ManageOrders
      if (currentUser.role === UserRole.ADMIN) return true;
      if (order.status === OrderStatus.APPROVED_CEO) return false;
      if (currentUser.role === UserRole.USER && order.requester === currentUser.fullName && order.status === OrderStatus.PENDING) return true;
      return false;
  };

  return (
    <div className="space-y-4">
      {/* Mobile Search & Filter Header */}
      <div className="sticky top-0 bg-gray-100 pt-2 pb-2 z-40 space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input 
              type="text" 
              placeholder="جستجو..." 
              className="w-full pl-8 pr-4 py-3 rounded-xl border-none shadow-sm text-sm focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            <Search className="absolute left-3 top-3.5 text-gray-400" size={16} />
          </div>
          <button onClick={refreshData} className="bg-white p-3 rounded-xl shadow-sm text-gray-600">
            <RefreshCcw size={20} />
          </button>
        </div>
        
        <div className="flex p-1 bg-gray-200 rounded-xl">
          <button onClick={() => setFilter('all')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${filter === 'all' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>همه</button>
          <button onClick={() => setFilter('pending')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${filter === 'pending' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>جاری</button>
          <button onClick={() => setFilter('completed')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${filter === 'completed' ? 'bg-white shadow text-green-600' : 'text-gray-500'}`}>بایگانی</button>
        </div>
      </div>

      {/* Cards List */}
      <div className="pb-20">
        {filteredOrders.length === 0 ? (
          <div className="text-center text-gray-400 mt-10">موردی یافت نشد</div>
        ) : (
          filteredOrders.map(order => (
            <MobileOrderCard 
              key={order.id} 
              order={order} 
              onView={setSelectedOrder} 
              onDelete={handleDelete}
              canDelete={canDelete(order)}
            />
          ))
        )}
      </div>

      {/* Detail Modal (Reusing existing PrintVoucher but making it full screen) */}
      {selectedOrder && (
        <div className="fixed inset-0 z-[100] bg-white overflow-y-auto">
            <PrintVoucher 
                order={selectedOrder} 
                onClose={() => setSelectedOrder(null)} 
                // Pass existing handlers if needed or reimplement minimal ones
            />
        </div>
      )}
    </div>
  );
};

export default MobileOrderList;
