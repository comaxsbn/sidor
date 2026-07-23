import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Trash2, Save, FileText, MapPin, Building2, User, Package, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Order, OrderItem, OrderStatus, Language } from '../types';

interface OrderFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (order: Order) => Promise<void> | void;
  initialOrder?: Order | null;
  lang: Language;
}

export const OrderFormModal: React.FC<OrderFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialOrder,
  lang
}) => {
  const isHe = lang === 'he';

  const [orderNumber, setOrderNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [warehouse, setWarehouse] = useState('מחסן החרש (סניף מרכזי)');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [status, setStatus] = useState<OrderStatus>('pending');
  const [notes, setNotes] = useState('');
  const [driverName, setDriverName] = useState('');
  const [depositBales, setDepositBales] = useState<number | undefined>(undefined);
  const [depositPallets, setDepositPallets] = useState<number | undefined>(undefined);
  const [depositDrums, setDepositDrums] = useState<number | undefined>(undefined);
  const [depositBlockPallets, setDepositBlockPallets] = useState<number | undefined>(undefined);
  const [noaAnalysis, setNoaAnalysis] = useState('');
  const [items, setItems] = useState<OrderItem[]>([
    { id: '1', sku: 'SBN-PL-01', name: 'משטח עץ תקני 120x80', quantity: 2, price: 85 }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (initialOrder) {
      setOrderNumber(initialOrder.orderNumber);
      setCustomerName(initialOrder.customerName);
      setWarehouse(initialOrder.warehouse || 'מחסן החרש (סניף מרכזי)');
      setDeliveryAddress(initialOrder.deliveryAddress);
      setStatus(initialOrder.status);
      setNotes(initialOrder.notes || '');
      setDriverName(initialOrder.driverName || '');
      setDepositBales(initialOrder.depositBales);
      setDepositPallets(initialOrder.depositPallets);
      setDepositDrums(initialOrder.depositDrums);
      setDepositBlockPallets(initialOrder.depositBlockPallets);
      setNoaAnalysis(initialOrder.noaAnalysis || '');
      setItems(initialOrder.items && initialOrder.items.length > 0 ? initialOrder.items : [
        { id: '1', sku: 'SBN-PL-01', name: 'משטח עץ תקני 120x80', quantity: 1, price: 85 }
      ]);
    } else {
      const randomNum = `SBN-LIVE-${Math.floor(1000000 + Math.random() * 9000000)}`;
      setOrderNumber(randomNum);
      setCustomerName('');
      setWarehouse('מחסן החרש (סניף מרכזי)');
      setDeliveryAddress('');
      setStatus('pending');
      setNotes('');
      setDriverName('');
      setDepositBales(undefined);
      setDepositPallets(undefined);
      setDepositDrums(undefined);
      setDepositBlockPallets(undefined);
      setNoaAnalysis('');
      setItems([
        { id: '1', sku: 'SBN-PL-01', name: 'משטח עץ תקני 120x80', quantity: 2, price: 85 }
      ]);
    }
  }, [initialOrder, isOpen]);

  if (!isOpen) return null;

  const handleAddItem = () => {
    const newItem: OrderItem = {
      id: String(Date.now()),
      sku: 'SBN-ST-05',
      name: 'סרט הדבקה מחוזק 50 מטר',
      quantity: 1,
      price: 42
    };
    setItems([...items, newItem]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) return;
    setItems(items.filter(i => i.id !== id));
  };

  const handleItemChange = (id: string, field: keyof OrderItem, val: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        return { ...item, [field]: val };
      }
      return item;
    }));
  };

  const totalAmount = items.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 1)), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderNumber || !customerName || !deliveryAddress) return;

    setIsSubmitting(true);
    try {
      const orderPayload: Order = {
        id: initialOrder ? initialOrder.id : `live-${orderNumber}`,
        orderNumber,
        timestamp: initialOrder ? initialOrder.timestamp : new Date().toISOString(),
        customerName,
        warehouse,
        deliveryAddress,
        items,
        status,
        totalAmount,
        notes: notes || undefined,
        driverName: driverName || undefined,
        depositBales: depositBales !== undefined ? Number(depositBales) : undefined,
        depositPallets: depositPallets !== undefined ? Number(depositPallets) : undefined,
        depositDrums: depositDrums !== undefined ? Number(depositDrums) : undefined,
        depositBlockPallets: depositBlockPallets !== undefined ? Number(depositBlockPallets) : undefined,
        noaAnalysis: noaAnalysis || undefined,
        latitude: initialOrder?.latitude,
        longitude: initialOrder?.longitude
      };

      await onSave(orderPayload);
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        setIsSubmitting(false);
        onClose();
      }, 600);
    } catch (err) {
      console.error('Failed to submit order:', err);
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800"
          dir={isHe ? 'rtl' : 'ltr'}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {initialOrder 
                    ? (isHe ? `עריכת הזמנה #${initialOrder.orderNumber}` : `Edit Order #${initialOrder.orderNumber}`)
                    : (isHe ? 'הוספת הזמנה חדשה לגליון' : 'Add New Order to Live Sheet')}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {isHe ? 'סנכרון בזמן אמת ל-Google Sheets ו-Firestore' : 'Real-time sync to Google Sheets & Firestore'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-all cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
            
            {/* Top Grid: Order # & Customer */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 text-blue-600" />
                  {isHe ? 'מספר הזמנה' : 'Order Number'}
                </label>
                <input
                  type="text"
                  required
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                  placeholder="SBN-10012"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-blue-600" />
                  {isHe ? 'שם הלקוח / חברה' : 'Customer Name'}
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                  placeholder={isHe ? 'לדוגמה: רמי לוי שיווק השקמה' : 'e.g. Acme Corp'}
                />
              </div>
            </div>

            {/* Warehouse & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-blue-600" />
                  {isHe ? 'מחסן מקור' : 'Source Warehouse'}
                </label>
                <select
                  value={warehouse}
                  onChange={(e) => setWarehouse(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 cursor-pointer transition-all"
                >
                  <option value="מחסן החרש (סניף מרכזי)">🏭 {isHe ? 'מחסן החרש (סניף מרכזי)' : 'HaCharash Warehouse'}</option>
                  <option value="מחסן התלמיד (סניף צפון)">🏬 {isHe ? 'מחסן התלמיד (סניף צפון)' : 'HaTalmid Warehouse'}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 text-blue-600" />
                  {isHe ? 'סטטוס משלוח' : 'Delivery Status'}
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as OrderStatus)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 cursor-pointer transition-all"
                >
                  <option value="pending">⏳ {isHe ? 'ממתין להפצה (Pending)' : 'Pending'}</option>
                  <option value="processing">🔄 {isHe ? 'בטיפול / בדרך (Processing)' : 'Processing'}</option>
                  <option value="delivered">✅ {isHe ? 'נמסר בהצלחה (Delivered)' : 'Delivered'}</option>
                  <option value="cancelled">❌ {isHe ? 'מבוטל (Cancelled)' : 'Cancelled'}</option>
                </select>
              </div>
            </div>

            {/* Delivery Address & Driver */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-blue-600" />
                  {isHe ? 'כתובת אספקה מלאה' : 'Delivery Address'}
                </label>
                <input
                  type="text"
                  required
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                  placeholder={isHe ? 'לדוגמה: דרך יפו 45, תל אביב' : 'e.g. Main St 10, Tel Aviv'}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-indigo-600" />
                  {isHe ? 'נהג מוקצה' : 'Assigned Driver'}
                </label>
                <select
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer"
                >
                  <option value="">{isHe ? 'ללא נהג (ממתין)' : 'Unassigned'}</option>
                  <option value="חכמת">🏗️ {isHe ? 'חכמת (מנוף)' : 'Hikmat'}</option>
                  <option value="עלי">🚛 {isHe ? 'עלי (משאית)' : 'Ali'}</option>
                  <option value="דניאל">🚐 {isHe ? 'דניאל (מסחרית)' : 'Daniel'}</option>
                  <option value="יוסף">🚚 {isHe ? 'יוסף (מנוף)' : 'Yousef'}</option>
                </select>
              </div>
            </div>

            {/* 4 Deposit Counters Section (SabanOS 16-Column Schema) */}
            <div className="bg-purple-50/50 border border-purple-100 p-3.5 rounded-xl space-y-2">
              <label className="block text-xs font-bold text-purple-900 flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-purple-600" />
                {isHe ? 'פקדונות אריזה וציוד (חביות, בלות, משטחים)' : 'Deposits Tracking'}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <span className="text-[10px] font-semibold text-slate-600 block mb-1">📦 {isHe ? 'פקדונות בלות' : 'Bales'}:</span>
                  <input
                    type="number"
                    min="0"
                    value={depositBales ?? ''}
                    onChange={(e) => setDepositBales(e.target.value === '' ? undefined : Number(e.target.value))}
                    className="w-full rounded-lg border border-purple-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-purple-500 text-center"
                    placeholder="0"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-600 block mb-1">🪵 {isHe ? 'פקדונות משטחים' : 'Pallets'}:</span>
                  <input
                    type="number"
                    min="0"
                    value={depositPallets ?? ''}
                    onChange={(e) => setDepositPallets(e.target.value === '' ? undefined : Number(e.target.value))}
                    className="w-full rounded-lg border border-purple-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-purple-500 text-center"
                    placeholder="0"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-600 block mb-1">🛢️ {isHe ? 'פקדונות חביות' : 'Drums'}:</span>
                  <input
                    type="number"
                    min="0"
                    value={depositDrums ?? ''}
                    onChange={(e) => setDepositDrums(e.target.value === '' ? undefined : Number(e.target.value))}
                    className="w-full rounded-lg border border-purple-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-purple-500 text-center"
                    placeholder="0"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-600 block mb-1">🧱 {isHe ? 'משטחי בלוק' : 'Block Pallets'}:</span>
                  <input
                    type="number"
                    min="0"
                    value={depositBlockPallets ?? ''}
                    onChange={(e) => setDepositBlockPallets(e.target.value === '' ? undefined : Number(e.target.value))}
                    className="w-full rounded-lg border border-purple-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-purple-500 text-center"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* Items List */}
            <div className="space-y-2 border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 text-indigo-600" />
                  {isHe ? 'פריטי ההזמנה ותכולה' : 'Order Items'}
                </label>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{isHe ? 'הוסף פריט' : 'Add Item'}</span>
                </button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {items.map((item, idx) => (
                  <div key={item.id || idx} className="flex items-center gap-2 bg-slate-50/80 p-2 rounded-xl border border-slate-200/80">
                    <input
                      type="text"
                      placeholder="SKU"
                      value={item.sku}
                      onChange={(e) => handleItemChange(item.id, 'sku', e.target.value)}
                      className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono font-bold outline-none"
                    />
                    <input
                      type="text"
                      placeholder={isHe ? 'שם פריט' : 'Item Name'}
                      value={item.name}
                      onChange={(e) => handleItemChange(item.id, 'name', e.target.value)}
                      className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium outline-none"
                    />
                    <div className="flex items-center gap-1 w-20">
                      <span className="text-[10px] text-slate-400 font-bold">{isHe ? 'כמות:' : 'Qty:'}</span>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(item.id, 'quantity', parseInt(e.target.value) || 1)}
                        className="w-12 rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs font-bold outline-none text-center"
                      />
                    </div>
                    <div className="flex items-center gap-1 w-24">
                      <span className="text-[10px] text-slate-400 font-bold">₪</span>
                      <input
                        type="number"
                        min="0"
                        value={item.price}
                        onChange={(e) => handleItemChange(item.id, 'price', parseFloat(e.target.value) || 0)}
                        className="w-16 rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs font-bold outline-none text-center"
                      />
                    </div>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="p-1 text-rose-500 hover:bg-rose-50 rounded-md transition-all cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-1 text-xs font-bold text-slate-700">
                <span>{isHe ? 'סה"כ לתשלום:' : 'Total:'} ₪{totalAmount.toLocaleString()}</span>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {isHe ? 'הערות מיוחדות לנהג / מחסנאי' : 'Driver / Warehouse Notes'}
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all resize-none"
                placeholder={isHe ? 'לדוגמה: לפרוק מאחור, דרוש מנוף' : 'Special notes...'}
              />
            </div>

            {/* Footer buttons */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-4">
              <div className="text-[11px] text-slate-500 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <span>{isHe ? 'עדכון ישיר בלוג השורות אונליין' : 'Direct online sheet stream update'}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  {isHe ? 'ביטול' : 'Cancel'}
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {savedSuccess ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-300 animate-bounce" />
                      <span>{isHe ? 'נשמר בהצלחה!' : 'Saved to Sheet!'}</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      <span>{isSubmitting ? (isHe ? 'שומר לגליון...' : 'Saving...') : (isHe ? 'שמור ועדכן גליון' : 'Save to Live Sheet')}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
