import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  getStoredConfig, 
  saveStoredConfig, 
  getStoredOrders, 
  saveStoredOrders, 
  computeMetrics, 
  createRandomOrder, 
  fetchLiveOrders,
  updateLiveOrderStatus,
  addLiveOrder,
  updateLiveOrderDetails,
  deleteLiveOrder,
  getStoredAuditLogs,
  saveStoredAuditLogs,
  deduplicateOrders
} from './utils/api';
import { 
  getOrdersFromFirestore, 
  saveOrderToFirestore, 
  syncOrdersToFirestore, 
  deleteOrderFromFirestore,
  getAuditLogsFromFirestore, 
  saveAuditLogToFirestore, 
  syncAuditLogsToFirestore,
  subscribeToOrders,
  subscribeToAuditLogs
} from './utils/firebase';
import { Order, AppConfig, Language, OrderStatus, AuditLogEntry } from './types';
import MetricCard from './components/MetricCard';
import DispatchTable from './components/DispatchTable';
import AnalyticsView from './components/AnalyticsView';
import SettingsModal from './components/SettingsModal';
import OrderHistoryView from './components/OrderHistoryView';
import DashboardSkeleton from './components/DashboardSkeleton';
import ShortcutsModal from './components/ShortcutsModal';
import IntegrationsPortal from './components/IntegrationsPortal';

import { 
  TrendingUp, 
  DollarSign, 
  Building2, 
  Clock, 
  Truck, 
  CheckCircle2, 
  AlertTriangle,
  LayoutDashboard,
  BarChart3,
  Settings,
  RefreshCw,
  PlusCircle,
  Globe,
  User,
  Shield,
  Users,
  Map,
  MapPin,
  MessageSquare,
  Sparkles,
  History,
  Moon,
  Sun,
  Menu,
  X,
  Keyboard,
  Mail,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';

import { motion, AnimatePresence } from 'motion/react';

import NoaChat from './components/NoaChat';
import MorningReport from './components/MorningReport';

const OrderMap = React.lazy(() => import('./components/OrderMap'));

export default function App() {
  // Config & State
  const [config, setConfig] = useState<AppConfig>(getStoredConfig);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [lang, setLang] = useState<Language>('he');
  const [currentTab, setCurrentTab] = useState<'dispatch' | 'analytics' | 'map' | 'noa-ai' | 'morning-report' | 'order-history' | 'integrations'>('dispatch');
  const [selectedOrderNumber, setSelectedOrderNumber] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('sabanos_theme_v1');
    return saved === 'dark';
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('sabanos_theme_v1', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('sabanos_theme_v1', 'light');
    }
  }, [darkMode]);

  const isHe = lang === 'he';

  // Desktop Sidebar Collapse & Auto-Hide state (5 seconds)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isSidebarPinned, setIsSidebarPinned] = useState<boolean>(false);

  // Auto-collapse sidebar after 5 seconds of inactivity when expanded & not pinned
  useEffect(() => {
    if (isSidebarCollapsed || isSidebarPinned) return;

    const timer = setTimeout(() => {
      setIsSidebarCollapsed(true);
    }, 5000);

    return () => clearTimeout(timer);
  }, [isSidebarCollapsed, isSidebarPinned, currentTab]);

  // Auto-Refresh state & context menu state
  const [isAutoRefresh, setIsAutoRefresh] = useState<boolean>(() => {
    return localStorage.getItem('sabanos_auto_refresh') === 'true';
  });
  const [refreshMenuOpen, setRefreshMenuOpen] = useState(false);
  const refreshMenuRef = useRef<HTMLDivElement>(null);
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressActive = useRef(false);

  // Sync auto-refresh preference
  useEffect(() => {
    localStorage.setItem('sabanos_auto_refresh', String(isAutoRefresh));
  }, [isAutoRefresh]);

  // Keep a mutable ref of handleRefresh to avoid recreation of interval
  const handleRefreshRef = useRef<() => Promise<void>>(undefined);

  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (refreshMenuRef.current && !refreshMenuRef.current.contains(e.target as Node)) {
        setRefreshMenuOpen(false);
      }
    };
    const handleTouchOutside = (e: TouchEvent) => {
      if (refreshMenuRef.current && !refreshMenuRef.current.contains(e.target as Node)) {
        setRefreshMenuOpen(false);
      }
    };

    if (refreshMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleTouchOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleTouchOutside);
    };
  }, [refreshMenuOpen]);

  // Auto-Refresh interval
  useEffect(() => {
    if (!isAutoRefresh) return;

    const interval = setInterval(() => {
      if (handleRefreshRef.current) {
        handleRefreshRef.current();
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [isAutoRefresh]);

  const handleRefreshContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setRefreshMenuOpen(true);
  };

  const handleRefreshTouchStart = (e: React.TouchEvent) => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
    }
    isLongPressActive.current = false;

    longPressTimeoutRef.current = setTimeout(() => {
      isLongPressActive.current = true;
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      setRefreshMenuOpen(true);
    }, 600);
  };

  const handleRefreshTouchEnd = (e: React.TouchEvent) => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
    if (isLongPressActive.current) {
      e.preventDefault();
      e.stopPropagation();
      isLongPressActive.current = false;
    }
  };

  const handleRefreshTouchMove = () => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  };

  const handleRefreshMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isLongPressActive.current = false;
    longPressTimeoutRef.current = setTimeout(() => {
      isLongPressActive.current = true;
      setRefreshMenuOpen(true);
    }, 600);
  };

  const handleRefreshMouseUp = (e: React.MouseEvent) => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
    if (isLongPressActive.current) {
      e.preventDefault();
      e.stopPropagation();
      isLongPressActive.current = false;
    }
  };

  const handleRefreshMouseLeave = () => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  };

  const handleRefreshButtonClick = (e: React.MouseEvent) => {
    if (isLongPressActive.current) {
      e.preventDefault();
      e.stopPropagation();
      isLongPressActive.current = false;
      return;
    }
    handleRefresh();
  };

  // Real-time synchronization of orders and audit logs
  useEffect(() => {
    setIsLoading(true);
    setSyncError(null);

    console.log('Subscribing to real-time updates from Firestore...');

    let isInitialSeeding = false;

    // 1. Subscribe to orders
    const unsubscribeOrders = subscribeToOrders(
      async (liveOrders) => {
        if (liveOrders.length === 0 && !isInitialSeeding) {
          isInitialSeeding = true;
          console.log('Firestore is empty. Fetching initial data from WebApp to populate Firestore...');
          const targetUrl = config.webappUrl || import.meta.env.VITE_GOOGLE_WEBAPP_URL || 'https://script.google.com/macros/s/AKfycbyLRZciGSmPeOitVGg1FBAGJnww54V32JvduopLa9LTlIo1iCL-k8ojeRZ3veHHYDNXVg/exec';
          try {
            const liveData = await fetchLiveOrders(targetUrl);
            await syncOrdersToFirestore(liveData);
            
            const initialLogs = getStoredAuditLogs(liveData);
            await syncAuditLogsToFirestore(initialLogs);
          } catch (sheetErr) {
            console.error('Failed to seed Firestore from WebApp:', sheetErr);
            // Fallback to local storage if even sheet fetch fails
            const loadedOrders = getStoredOrders();
            setOrders(loadedOrders);
            setIsLoading(false);
          }
        } else {
          const cleanOrders = deduplicateOrders(liveOrders);
          setOrders(cleanOrders);
          saveStoredOrders(cleanOrders);
          setIsLoading(false);
        }
      },
      (err) => {
        console.error('Real-time sync error for orders:', err);
        setSyncError(isHe 
          ? 'סנכרון בזמן אמת נכשל. מציג נתונים שמורים מקומיים.' 
          : 'Real-time sync failed. Showing local saved state.'
        );
        const loadedOrders = getStoredOrders();
        setOrders(loadedOrders);
        setIsLoading(false);
      }
    );

    // 2. Subscribe to audit logs
    const unsubscribeLogs = subscribeToAuditLogs(
      (liveLogs) => {
        if (liveLogs.length > 0) {
          setAuditLogs(liveLogs);
          saveStoredAuditLogs(liveLogs);
        }
      },
      (err) => {
        console.error('Real-time sync error for audit logs:', err);
        const loadedLogs = getStoredAuditLogs(getStoredOrders());
        setAuditLogs(loadedLogs);
      }
    );

    // Clean up subscriptions on unmount
    return () => {
      console.log('Unsubscribing from real-time Firestore updates...');
      unsubscribeOrders();
      unsubscribeLogs();
    };
  }, [config.webappUrl, isHe]);

  // Global keyboard shortcuts for tab navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
         activeEl.tagName === 'TEXTAREA' ||
         activeEl.tagName === 'SELECT' ||
         activeEl.isContentEditable)
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'd') {
        setCurrentTab('dispatch');
      } else if (key === 'a') {
        setCurrentTab('analytics');
      } else if (key === 'm') {
        setCurrentTab('map');
      } else if (key === 'n') {
        setCurrentTab('noa-ai');
      } else if (key === 'r') {
        setCurrentTab('morning-report');
      } else if (key === 'h') {
        setCurrentTab('order-history');
      } else if (key === '?' || e.key === '?' || key === 'k') {
        setIsShortcutsOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Pull refresh trigger
  const handleRefresh = async () => {
    setIsRefreshing(true);
    setSyncError(null);

    const targetUrl = config.webappUrl || import.meta.env.VITE_GOOGLE_WEBAPP_URL || 'https://script.google.com/macros/s/AKfycbyLRZciGSmPeOitVGg1FBAGJnww54V32JvduopLa9LTlIo1iCL-k8ojeRZ3veHHYDNXVg/exec';
    
    try {
      const liveData = await fetchLiveOrders(targetUrl);
      const cleanLiveData = deduplicateOrders(liveData);
      setOrders(cleanLiveData);
      saveStoredOrders(cleanLiveData);
      
      // Update Firestore with the fresh live orders list
      await syncOrdersToFirestore(cleanLiveData);
      
      console.log(isHe ? 'הנתונים סונכרנו בהצלחה!' : 'Logistics stream updated!');
    } catch (err: any) {
      setSyncError(err.message || String(err));
    }

    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  useEffect(() => {
    handleRefreshRef.current = handleRefresh;
  }, [handleRefresh]);

  // Update order status live in sheet
  const handleUpdateStatus = async (orderId: string, status: OrderStatus) => {
    const targetOrder = orders.find(o => o.id === orderId);
    if (!targetOrder) return;

    const oldStatus = targetOrder.status;
    if (oldStatus === status) return;

    // Optimistically update local state
    const updatedOrder = { ...targetOrder, status };
    const updated = orders.map(o => {
      if (o.id === orderId) {
        return updatedOrder;
      }
      return o;
    });
    setOrders(updated);
    saveStoredOrders(updated);

    // Write audit log entry
    const newLog: AuditLogEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      orderId: targetOrder.id,
      orderNumber: targetOrder.orderNumber,
      customerName: targetOrder.customerName,
      oldStatus,
      newStatus: status,
      timestamp: new Date().toISOString(),
      updatedBy: 'Dispatcher'
    };
    const updatedLogs = [newLog, ...auditLogs];
    setAuditLogs(updatedLogs);
    saveStoredAuditLogs(updatedLogs);

    // Save to Firestore
    try {
      await saveOrderToFirestore(updatedOrder);
      await saveAuditLogToFirestore(newLog);
    } catch (fsErr) {
      console.error('Failed to save to Firestore:', fsErr);
    }

    // Call live update API on the spreadsheet
    if (config.webappUrl) {
      try {
        await updateLiveOrderStatus(config.webappUrl, targetOrder.orderNumber, status);
      } catch (err) {
        console.error('Failed to sync status update to live sheet:', err);
      }
    }
  };

  // Create new order live in Google Sheet & Firestore
  const handleCreateOrder = async (newOrder: Order) => {
    const updated = [newOrder, ...orders];
    setOrders(updated);
    saveStoredOrders(updated);

    // Write audit log entry
    const newLog: AuditLogEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      orderId: newOrder.id,
      orderNumber: newOrder.orderNumber,
      customerName: newOrder.customerName,
      oldStatus: 'pending',
      newStatus: newOrder.status,
      timestamp: new Date().toISOString(),
      updatedBy: 'Manager (Created)'
    };
    const updatedLogs = [newLog, ...auditLogs];
    setAuditLogs(updatedLogs);
    saveStoredAuditLogs(updatedLogs);

    // Save to Firestore
    try {
      await saveOrderToFirestore(newOrder);
      await saveAuditLogToFirestore(newLog);
    } catch (fsErr) {
      console.error('Failed to save created order to Firestore:', fsErr);
    }

    // Call live add order API on Google Sheets
    if (config.webappUrl) {
      try {
        await addLiveOrder(config.webappUrl, newOrder);
      } catch (err) {
        console.error('Failed to sync new order to live sheet:', err);
      }
    }
  };

  // Update full order details live in Google Sheet & Firestore
  const handleUpdateOrderDetails = async (updatedOrder: Order) => {
    const updated = orders.map(o => o.id === updatedOrder.id ? updatedOrder : o);
    setOrders(updated);
    saveStoredOrders(updated);

    // Save to Firestore
    try {
      await saveOrderToFirestore(updatedOrder);
    } catch (fsErr) {
      console.error('Failed to save updated order to Firestore:', fsErr);
    }

    // Sync full order details to live Google Sheet
    if (config.webappUrl) {
      try {
        await updateLiveOrderDetails(config.webappUrl, updatedOrder);
      } catch (err) {
        console.error('Failed to sync order update to live sheet:', err);
      }
    }
  };

  // Assign driver to order
  const handleAssignDriver = async (orderId: string, driverName: string) => {
    const targetOrder = orders.find(o => o.id === orderId);
    if (!targetOrder) return;

    // Optimistically update local state
    const updatedOrder = { ...targetOrder, driverName };
    const updated = orders.map(o => {
      if (o.id === orderId) {
        return updatedOrder;
      }
      return o;
    });
    setOrders(updated);
    saveStoredOrders(updated);

    // Save to Firestore
    try {
      await saveOrderToFirestore(updatedOrder);
    } catch (fsErr) {
      console.error('Failed to save order driver update to Firestore:', fsErr);
    }

    // Sync to live sheet
    if (config.webappUrl) {
      try {
        await updateLiveOrderDetails(config.webappUrl, updatedOrder);
      } catch (err) {
        console.error('Failed to sync driver update to live sheet:', err);
      }
    }
  };

  // Delete an individual log locally and in Google Sheet
  const handleDeleteOrder = async (orderId: string) => {
    const targetOrder = orders.find(o => o.id === orderId);
    const updated = orders.filter(o => o.id !== orderId);
    setOrders(updated);
    saveStoredOrders(updated);

    if (targetOrder) {
      const newLog: AuditLogEntry = {
        id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        orderId: targetOrder.id,
        orderNumber: targetOrder.orderNumber,
        customerName: targetOrder.customerName,
        oldStatus: targetOrder.status,
        newStatus: 'cancelled',
        timestamp: new Date().toISOString(),
        updatedBy: 'Manager (Removal)'
      };
      const updatedLogs = [newLog, ...auditLogs];
      setAuditLogs(updatedLogs);
      saveStoredAuditLogs(updatedLogs);

      // Save/Delete to Firestore
      try {
        await deleteOrderFromFirestore(orderId);
        await saveAuditLogToFirestore(newLog);
      } catch (fsErr) {
        console.error('Failed to delete/audit to Firestore:', fsErr);
      }

      // Delete from live Google Sheet
      if (config.webappUrl) {
        try {
          await deleteLiveOrder(config.webappUrl, targetOrder.orderNumber);
        } catch (err) {
          console.error('Failed to delete order from live sheet:', err);
        }
      }
    }
  };

  // Save modified configurations
  const handleSaveConfig = (newConfig: AppConfig) => {
    setConfig(newConfig);
    saveStoredConfig(newConfig);
  };

  // Memoized unique months from orders
  const months = useMemo(() => {
    const list = new Set<string>();
    orders.forEach(o => {
      if (o.timestamp) {
        const d = new Date(o.timestamp);
        if (!isNaN(d.getTime())) {
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          list.add(key);
        }
      }
    });
    return Array.from(list).sort().reverse();
  }, [orders]);

  // Translate month keys to elegant name
  const getMonthName = (yearMonth: string, isHeMode: boolean) => {
    const parts = yearMonth.split('-');
    if (parts.length < 2) return yearMonth;
    const year = parts[0];
    const monthStr = parts[1];
    const monthNamesHe: Record<string, string> = {
      '01': 'ינואר', '02': 'פברואר', '03': 'מרץ', '04': 'אפריל', '05': 'מאי', '06': 'יוני',
      '07': 'יולי', '08': 'אוגוסט', '09': 'ספטמבר', '10': 'אוקטובר', '11': 'נובמבר', '12': 'דצמבר'
    };
    const monthNamesEn: Record<string, string> = {
      '01': 'January', '02': 'February', '03': 'March', '04': 'April', '05': 'May', '06': 'June',
      '07': 'July', '08': 'August', '09': 'September', '10': 'October', '11': 'November', '12': 'December'
    };
    return isHeMode
      ? `${monthNamesHe[monthStr] || monthStr} ${year}`
      : `${monthNamesEn[monthStr] || monthStr} ${year}`;
  };

  // Memoized unique customer count based on selectedMonth
  const filteredCustomerCount = useMemo(() => {
    const activeOrders = orders.filter(o => o.status !== 'cancelled');
    const targetOrders = selectedMonth === 'all'
      ? activeOrders
      : activeOrders.filter(o => {
          if (!o.timestamp) return false;
          const d = new Date(o.timestamp);
          if (isNaN(d.getTime())) return false;
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          return key === selectedMonth;
        });
    return new Set(targetOrders.map(o => o.customerName)).size;
  }, [orders, selectedMonth]);

  // Active undelivered orders for HaCharash Warehouse
  const charashActiveCount = useMemo(() => {
    return orders.filter(o => {
      const wh = o.warehouse || '';
      const isCharash = wh.includes('החרש') || wh.toLowerCase().includes('charash');
      const isNotDelivered = o.status !== 'delivered' && o.status !== 'cancelled';
      return isCharash && isNotDelivered;
    }).length;
  }, [orders]);

  // Active undelivered orders for HaTalmid Warehouse
  const talmidActiveCount = useMemo(() => {
    return orders.filter(o => {
      const wh = o.warehouse || '';
      const isTalmid = wh.includes('התלמיד') || wh.toLowerCase().includes('talmid');
      const isNotDelivered = o.status !== 'delivered' && o.status !== 'cancelled';
      return isTalmid && isNotDelivered;
    }).length;
  }, [orders]);

  // Memoized daily trends for the last 7 days (including today)
  const last7DaysTrends = useMemo(() => {
    const totalOrdersTrend: number[] = [];
    const pendingTrend: number[] = [];
    
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().split('T')[0]; // YYYY-MM-DD
      
      const dailyOrders = orders.filter(o => {
        if (!o.timestamp) return false;
        const orderDateStr = o.timestamp.split('T')[0];
        return orderDateStr === dateStr;
      });
      
      totalOrdersTrend.push(dailyOrders.length);
      
      const dailyActive = dailyOrders.filter(o => o.status === 'pending' || o.status === 'processing').length;
      pendingTrend.push(dailyActive);
    }
    
    return {
      totalOrdersTrend,
      pendingTrend
    };
  }, [orders]);

  // Memoized metric calculations
  const metrics = useMemo(() => computeMetrics(orders), [orders]);

  return (
    <div 
      dir={isHe ? 'rtl' : 'ltr'} 
      className={`flex h-screen w-full overflow-hidden font-sans transition-colors duration-300 ${
        darkMode 
          ? 'dark bg-slate-950 text-slate-100' 
          : 'bg-slate-50/80 text-slate-900'
      }`}
    >
      {/* Mobile Drawer Slide-out Layered Menu (Hamburger) */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-950 z-50 md:hidden"
            />
            
            {/* Drawer Content */}
            <motion.aside
              initial={{ x: isHe ? '100%' : '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: isHe ? '100%' : '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={`fixed top-0 bottom-0 ${
                isHe ? 'right-0' : 'left-0'
              } w-72 bg-slate-900 text-slate-300 flex flex-col z-50 shadow-2xl border-l border-slate-800 md:hidden`}
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 shadow-md shadow-blue-500/20">
                    <span className="font-mono text-base font-bold text-white">S</span>
                  </div>
                  <div>
                    <h2 className="font-sans text-base font-extrabold tracking-tight text-white leading-none">
                      Saban<span className="text-blue-500">OS</span>
                    </h2>
                    <p className="text-[9px] font-medium text-slate-500 mt-0.5 uppercase tracking-wider">
                      {isHe ? 'לוגיסטיקה ושרשרת אספקה' : 'Logistics Control'}
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-800 bg-slate-950/40 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title={isHe ? 'סגור תפריט' : 'Close Menu'}
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* Navigation Links */}
              <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                <button
                  onClick={() => {
                    setCurrentTab('dispatch');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all ${
                    currentTab === 'dispatch'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-900/10'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <LayoutDashboard className="h-4.5 w-4.5 shrink-0" />
                  <span>{isHe ? 'לוח סידור ראשי' : 'Dispatch Control'}</span>
                </button>
                
                <button
                  onClick={() => {
                    setCurrentTab('analytics');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all ${
                    currentTab === 'analytics'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-900/10'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <BarChart3 className="h-4.5 w-4.5 shrink-0" />
                  <span>{isHe ? 'דוחות וניתוח מוצרים' : 'Product Analytics'}</span>
                </button>

                <button
                  onClick={() => {
                    setCurrentTab('map');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all ${
                    currentTab === 'map'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-900/10'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Map className="h-4.5 w-4.5 shrink-0" />
                  <span>{isHe ? 'מפת סידור הפצה' : 'Logistics Map'}</span>
                </button>

                <button
                  onClick={() => {
                    setCurrentTab('noa-ai');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-bold transition-all ${
                    currentTab === 'noa-ai'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/10'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-4.5 w-4.5 shrink-0" />
                    <span>{isHe ? 'נועה Noa AI (צ׳אט)' : 'Noa AI Assistant'}</span>
                  </div>
                  <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
                </button>

                <button
                  onClick={() => {
                    setCurrentTab('morning-report');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all ${
                    currentTab === 'morning-report'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-900/10'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Sparkles className="h-4.5 w-4.5 shrink-0 text-amber-400" />
                  <span>{isHe ? 'דוח בוקר לוגיסטי' : 'Logistics Briefing'}</span>
                </button>

                <button
                  onClick={() => {
                    setCurrentTab('order-history');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all ${
                    currentTab === 'order-history'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-900/10'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <History className="h-4.5 w-4.5 shrink-0" />
                  <span>{isHe ? 'היסטוריית סטטוסים' : 'Order History'}</span>
                </button>
              </nav>

              {/* Extra settings controls on mobile drawer for ultimate convenience */}
              <div className="p-3 bg-slate-950/20 border-t border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                  <span>{isHe ? 'הגדרות מהירות:' : 'Quick Controls:'}</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    onClick={() => setLang(isHe ? 'en' : 'he')}
                    className="flex flex-col items-center justify-center p-2 rounded-xl border border-slate-800 bg-slate-950/40 hover:bg-slate-800 hover:text-white transition-all text-[11px] font-bold cursor-pointer"
                  >
                    <Globe className="h-4 w-4 mb-1 text-slate-400" />
                    <span>{isHe ? 'English' : 'עברית'}</span>
                  </button>
                  <button
                    onClick={() => setDarkMode(!darkMode)}
                    className="flex flex-col items-center justify-center p-2 rounded-xl border border-slate-800 bg-slate-950/40 hover:bg-slate-800 hover:text-white transition-all text-[11px] font-bold cursor-pointer"
                  >
                    {darkMode ? (
                      <Sun className="h-4 w-4 mb-1 text-amber-500" />
                    ) : (
                      <Moon className="h-4 w-4 mb-1 text-slate-400" />
                    )}
                    <span>{darkMode ? (isHe ? 'יום' : 'Light') : (isHe ? 'לילה' : 'Dark')}</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsSettingsOpen(true);
                      setIsMobileMenuOpen(false);
                    }}
                    className="flex flex-col items-center justify-center p-2 rounded-xl border border-slate-800 bg-slate-950/40 hover:bg-slate-800 hover:text-white transition-all text-[11px] font-bold cursor-pointer"
                  >
                    <Settings className="h-4 w-4 mb-1 text-slate-400" />
                    <span>{isHe ? 'הגדרות' : 'Config'}</span>
                  </button>
                </div>
              </div>

              {/* Shift Manager Block (Footer) */}
              <div className="p-4 border-t border-slate-800 bg-slate-950/40">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">{isHe ? ' ראמי מסארוה' : 'Avi Cohen'}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <p className="text-[10px] font-medium text-slate-500">{isHe ? 'מנהל תורן פעיל' : 'Active Shift Manager'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* 1. Elegant Dashboard Sidebar (Desktop Only) */}
      <aside 
        onMouseEnter={() => {
          if (!isSidebarPinned) setIsSidebarCollapsed(false);
        }}
        onMouseLeave={() => {
          if (!isSidebarPinned) {
            // Auto-collapse handled by effect or when leaving
          }
        }}
        className={`${
          isSidebarCollapsed ? 'w-16' : 'w-64'
        } bg-slate-900 flex flex-col text-slate-300 shrink-0 hidden md:flex transition-all duration-300 z-30 relative group shadow-xl border-r border-slate-800`}
      >
        {/* Brand Header & Pin Controls */}
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between overflow-hidden shrink-0 h-16">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 shadow-md shadow-blue-500/20">
              <span className="font-mono text-lg font-bold tracking-tight text-white">S</span>
            </div>
            {!isSidebarCollapsed && (
              <div className="min-w-0 transition-opacity duration-200">
                <h1 className="font-sans text-base font-extrabold tracking-tight text-white leading-none whitespace-nowrap">
                  Saban<span className="text-blue-500">OS</span>
                </h1>
                <p className="text-[10px] font-medium text-slate-400 mt-1 uppercase tracking-wider whitespace-nowrap">
                  {isHe ? 'לוגיסטיקה ושרשרת אספקה' : 'Logistics Control'}
                </p>
              </div>
            )}
          </div>

          {!isSidebarCollapsed && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setIsSidebarPinned(prev => !prev)}
                className={`p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all ${
                  isSidebarPinned ? 'text-blue-400 bg-slate-800/80' : ''
                }`}
                title={isSidebarPinned ? (isHe ? 'בטל נעץ' : 'Unpin Sidebar') : (isHe ? 'נעץ תפריט צד (מנע הסתרה)' : 'Pin Sidebar')}
              >
                <Pin className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setIsSidebarCollapsed(true)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                title={isHe ? 'קפל תפריט צד' : 'Collapse Sidebar'}
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Sidebar Navigation Links */}
        <nav className="flex-1 px-2.5 py-4 space-y-1.5 overflow-x-hidden overflow-y-auto">
          <button
            id="sidebar-dispatch-btn"
            onClick={() => setCurrentTab('dispatch')}
            title={isHe ? 'לוח סידור ראשי' : 'Dispatch Control'}
            className={`w-full flex items-center gap-3 ${
              isSidebarCollapsed ? 'justify-center px-0' : 'px-3'
            } py-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              currentTab === 'dispatch'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            <LayoutDashboard className="h-4.5 w-4.5 shrink-0" />
            {!isSidebarCollapsed && (
              <span className="truncate text-right">{isHe ? 'לוח סידור ראשי' : 'Dispatch Control'}</span>
            )}
          </button>

          <button
            id="sidebar-integrations-btn"
            onClick={() => setCurrentTab('integrations')}
            title={isHe ? 'סנכרון מיילים ואינטגרציות' : 'Email Sync & Ingestion'}
            className={`w-full flex items-center justify-between ${
              isSidebarCollapsed ? 'justify-center px-0' : 'px-3'
            } py-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              currentTab === 'integrations'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            <div className={`flex items-center gap-3 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
              <Mail className="h-4.5 w-4.5 shrink-0" />
              {!isSidebarCollapsed && (
                <span className="truncate text-right">{isHe ? 'אינטגרציות ומיילים' : 'Integrations'}</span>
              )}
            </div>
            <span className="flex h-2 w-2 rounded-full bg-indigo-400 animate-pulse shrink-0"></span>
          </button>
          
          <button
            id="sidebar-analytics-btn"
            onClick={() => setCurrentTab('analytics')}
            title={isHe ? 'דוחות וניתוח מוצרים' : 'Product Analytics'}
            className={`w-full flex items-center gap-3 ${
              isSidebarCollapsed ? 'justify-center px-0' : 'px-3'
            } py-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              currentTab === 'analytics'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            <BarChart3 className="h-4.5 w-4.5 shrink-0" />
            {!isSidebarCollapsed && (
              <span className="truncate text-right">{isHe ? 'דוחות וניתוח מוצרים' : 'Analytics'}</span>
            )}
          </button>

          <button
            id="sidebar-map-btn"
            onClick={() => setCurrentTab('map')}
            title={isHe ? 'מפת סידור הפצה' : 'Logistics Map'}
            className={`w-full flex items-center gap-3 ${
              isSidebarCollapsed ? 'justify-center px-0' : 'px-3'
            } py-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              currentTab === 'map'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            <Map className="h-4.5 w-4.5 shrink-0" />
            {!isSidebarCollapsed && (
              <span className="truncate text-right">{isHe ? 'מפת סידור הפצה' : 'Map'}</span>
            )}
          </button>

          <button
            id="sidebar-noa-btn"
            onClick={() => setCurrentTab('noa-ai')}
            title={isHe ? 'נועה Noa AI (צ׳אט)' : 'Noa AI Assistant'}
            className={`w-full flex items-center justify-between ${
              isSidebarCollapsed ? 'justify-center px-0' : 'px-3'
            } py-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              currentTab === 'noa-ai'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            <div className={`flex items-center gap-3 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
              <MessageSquare className="h-4.5 w-4.5 shrink-0" />
              {!isSidebarCollapsed && (
                <span className="truncate text-right">{isHe ? 'נועה Noa AI (צ׳אט)' : 'Noa AI'}</span>
              )}
            </div>
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
          </button>

          <button
            id="sidebar-morning-btn"
            onClick={() => setCurrentTab('morning-report')}
            title={isHe ? 'דוח בוקר לוגיסטי' : 'Logistics Briefing'}
            className={`w-full flex items-center gap-3 ${
              isSidebarCollapsed ? 'justify-center px-0' : 'px-3'
            } py-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              currentTab === 'morning-report'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            <Sparkles className="h-4.5 w-4.5 shrink-0 text-amber-400" />
            {!isSidebarCollapsed && (
              <span className="truncate text-right">{isHe ? 'דוח בוקר לוגיסטי' : 'Morning Report'}</span>
            )}
          </button>

          <button
            id="sidebar-history-btn"
            onClick={() => setCurrentTab('order-history')}
            title={isHe ? 'היסטוריית סטטוסים' : 'Order History'}
            className={`w-full flex items-center gap-3 ${
              isSidebarCollapsed ? 'justify-center px-0' : 'px-3'
            } py-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              currentTab === 'order-history'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            <History className="h-4.5 w-4.5 shrink-0" />
            {!isSidebarCollapsed && (
              <span className="truncate text-right">{isHe ? 'היסטוריית סטטוסים' : 'Order History'}</span>
            )}
          </button>
        </nav>

        {/* Shift Manager Block (Footer) */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-950/50 shrink-0">
          <div className={`flex items-center gap-3 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 border border-slate-700 text-slate-300">
              <User className="h-4.5 w-4.5" />
            </div>
            {!isSidebarCollapsed && (
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">{isHe ? 'ראמי מסארוה' : 'Avi Cohen'}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                  <p className="text-[10px] font-medium text-slate-400 truncate">{isHe ? 'מנהל תורן פעיל' : 'Shift Manager'}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* 2. Main Column Viewport */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        
        {/* Top Header Row */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between px-6 lg:px-8 shrink-0">
          <div className="flex items-center gap-3">
            {/* Desktop Sidebar Toggle Button */}
            <button
              onClick={() => setIsSidebarCollapsed(prev => !prev)}
              className="hidden md:flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 bg-white dark:bg-slate-800 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer shadow-xs"
              title={isSidebarCollapsed ? (isHe ? 'הרחב תפריט צד (מתקפל אוטומטית ב-5 שניות)' : 'Expand Sidebar') : (isHe ? 'קפל תפריט צד' : 'Collapse Sidebar')}
            >
              {isSidebarCollapsed ? <PanelLeftOpen className="h-4.5 w-4.5 text-blue-600" /> : <PanelLeftClose className="h-4.5 w-4.5" />}
            </button>

            {/* Hamburger menu & left brand indicator for mobile */}
            <div className="flex md:hidden items-center gap-2">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 bg-white dark:bg-slate-800 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer shadow-xs"
                title={isHe ? 'תפריט ניווט' : 'Navigation Menu'}
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
                <span className="font-mono text-base font-bold text-white">S</span>
              </div>
            </div>
            
            {/* Status Badge */}
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50">
              <span className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                {isHe ? 'מחובר (Google Sheets)' : 'Live Sheets'}
              </span>
            </span>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            {/* Refresh stream */}
            <div className="relative">
              <button
                id="header-refresh-btn"
                onClick={handleRefreshButtonClick}
                onContextMenu={handleRefreshContextMenu}
                onMouseDown={handleRefreshMouseDown}
                onMouseUp={handleRefreshMouseUp}
                onMouseLeave={handleRefreshMouseLeave}
                onTouchStart={handleRefreshTouchStart}
                onTouchEnd={handleRefreshTouchEnd}
                onTouchMove={handleRefreshTouchMove}
                disabled={isRefreshing}
                className={`relative flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white ${
                  isRefreshing ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                title={isHe ? 'רענן נתונים (לחיצה ארוכה או קליק ימני להפעלה אוטומטית)' : 'Refresh Data (Long-press or right-click for auto-refresh)'}
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isAutoRefresh && (
                  <span className="absolute -top-1 -right-1 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                )}
              </button>

              {refreshMenuOpen && (
                <div
                  ref={refreshMenuRef}
                  className={`absolute mt-2 ${isHe ? 'left-0' : 'right-0'} z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 w-56 text-slate-700 dark:text-slate-200 animate-in fade-in slide-in-from-top-1 duration-150`}
                >
                  <button
                    onClick={() => {
                      setIsAutoRefresh(!isAutoRefresh);
                      setRefreshMenuOpen(false);
                    }}
                    className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div className={`h-4 w-4 rounded border flex items-center justify-center transition-colors ${
                        isAutoRefresh 
                          ? 'bg-blue-600 border-blue-600 text-white' 
                          : 'border-slate-300 dark:border-slate-600'
                      }`}>
                        {isAutoRefresh && (
                          <svg className="h-3 w-3 fill-current text-white" viewBox="0 0 20 20">
                            <path d="M0 11l2-2 5 5L18 3l2 2L7 18z" />
                          </svg>
                        )}
                      </div>
                      <span>{isHe ? 'רענון אוטומטי (60 שניות)' : 'Auto-Refresh (60s)'}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">60s</span>
                  </button>
                </div>
              )}
            </div>

            {/* Language Toggle */}
            <button
              id="header-lang-btn"
              onClick={() => setLang(isHe ? 'en' : 'he')}
              className="flex items-center gap-1 h-8 rounded-lg border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 px-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-all"
            >
              <Globe className="h-3.5 w-3.5" />
              <span>{isHe ? 'EN' : 'עב'}</span>
            </button>

            {/* Dark Mode Toggle */}
            <button
              id="header-theme-toggle"
              onClick={() => setDarkMode(!darkMode)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-all"
              title={isHe ? 'שנה מצב תצוגה' : 'Toggle Theme'}
            >
              {darkMode ? (
                <Sun className="h-4 w-4 text-amber-500" />
              ) : (
                <Moon className="h-4 w-4 text-slate-500" />
              )}
            </button>

            {/* Keyboard Shortcuts */}
            <button
              id="header-shortcuts-btn"
              onClick={() => setIsShortcutsOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer shadow-xs"
              title={isHe ? 'קיצורי מקלדת' : 'Keyboard Shortcuts'}
            >
              <Keyboard className="h-4 w-4 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200" />
            </button>

            {/* Settings */}
            <button
              id="header-settings-btn"
              onClick={() => setIsSettingsOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-all"
              title={isHe ? 'הגדרות סנכרון' : 'Sync Configurations'}
            >
              <Settings className="h-4 w-4 text-slate-500" />
            </button>
          </div>
        </header>

        {/* Scrollable Main Workspace */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
          {/* Connection Failure Error banner */}
          {syncError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-800 flex items-start gap-3 shadow-sm">
              <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-bold">{isHe ? 'שגיאת סנכרון לוגיסטי:' : 'Sync Alert:'}</span>
                <p className="mt-0.5 opacity-90">{syncError}</p>
              </div>
              <button 
                onClick={() => setSyncError(null)}
                className="mr-auto text-rose-400 hover:text-rose-700 font-bold text-xs"
              >
                {isHe ? 'סגור' : 'Dismiss'}
              </button>
            </div>
          )}

          {/* Top KPI Metrics Row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title={isHe ? 'סה"כ הזמנות הפצה' : 'Total Logistics Orders'}
              value={metrics.totalOrders}
              subtitle={isHe ? 'כלל המשלוחים' : 'All shipment logs'}
              icon={Truck}
              colorScheme="indigo"
              isLoading={isLoading}
              sparklineData={last7DaysTrends.totalOrdersTrend}
              darkMode={darkMode}
            />
            {/* Dynamic Customer Count with Month Filter */}
            {isLoading ? (
              <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm animate-pulse">
                <div className="relative flex items-start justify-between">
                  <div className="space-y-2 w-2/3">
                    <div className="h-3.5 w-1/2 rounded bg-slate-200" />
                    <div className="h-7 w-2/3 rounded bg-slate-200 mt-1" />
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-slate-100 border border-slate-200" />
                </div>
                <div className="relative mt-3.5 flex items-center justify-between border-t border-slate-100 pt-2.5">
                  <div className="h-3 w-1/3 rounded bg-slate-100" />
                  <div className="h-4 w-1/4 rounded bg-slate-100" />
                </div>
              </div>
            ) : (
              <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-slate-300">
                <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br from-emerald-500/5 to-transparent blur-xl" />
                <div className="relative flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {isHe ? 'כמות לקוחות פעילים' : 'Active Customer Count'}
                    </span>
                    <h3 className="font-sans text-2xl font-bold tracking-tight text-slate-900">
                      {filteredCustomerCount}
                    </h3>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50/70 border border-emerald-100 shadow-inner">
                    <Users className="h-4.5 w-4.5 text-emerald-600" />
                  </div>
                </div>
                <div className="relative mt-3.5 flex items-center justify-between border-t border-slate-100 pt-2.5">
                  <span className="text-[10px] font-semibold text-slate-500">
                    {isHe ? 'סנן לפי חודש:' : 'Filter by month:'}
                  </span>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="text-[10px] bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-slate-700 font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="all">{isHe ? 'כל החודשים' : 'All Months'}</option>
                    {months.map(m => (
                      <option key={m} value={m}>{getMonthName(m, isHe)}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Improved Active Warehouses displaying HaCharash & HaTalmid counts */}
            {isLoading ? (
              <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm animate-pulse">
                <div className="relative flex items-start justify-between">
                  <div className="space-y-2 w-2/3">
                    <div className="h-3.5 w-1/2 rounded bg-slate-200" />
                    <div className="h-3 w-1/3 rounded bg-slate-100 mt-1" />
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-slate-100 border border-slate-200" />
                </div>
                <div className="relative mt-2.5 space-y-2 pt-2.5 border-t border-slate-100">
                  <div className="h-4 w-full rounded bg-slate-100" />
                  <div className="h-4 w-full rounded bg-slate-100" />
                </div>
              </div>
            ) : (
              <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-slate-300">
                <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br from-blue-500/5 to-transparent blur-xl" />
                <div className="relative flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {isHe ? 'מחסנים פעילים בסידור' : 'Active Storage Hubs'}
                    </span>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                      <span className="text-[10px] font-bold text-slate-500">
                        {isHe ? 'הזמנות שלא סופקו' : 'Undelivered Orders'}
                      </span>
                    </div>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50/70 border border-blue-100 shadow-inner">
                    <Building2 className="h-4.5 w-4.5 text-blue-600" />
                  </div>
                </div>
                
                <div className="relative mt-2.5 space-y-2 pt-2.5 border-t border-slate-100">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-700">{isHe ? 'מחסן החרש' : 'HaCharash Hub'}</span>
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-100">
                      {charashActiveCount} {isHe ? 'הזמנות' : 'orders'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-700">{isHe ? 'מחסן התלמיד' : 'HaTalmid Hub'}</span>
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                      {talmidActiveCount} {isHe ? 'הזמנות' : 'orders'}
                    </span>
                  </div>
                </div>
              </div>
            )}
            <MetricCard
              title={isHe ? 'משלוחים בצנרת (בקבוק)' : 'Active Dispatch Pipeline'}
              value={metrics.pendingDeliveries}
              subtitle={isHe ? 'חדש + בטיפול' : 'Awaiting loading / route'}
              icon={Clock}
              colorScheme="amber"
              isLoading={isLoading}
              sparklineData={last7DaysTrends.pendingTrend}
              darkMode={darkMode}
            />
          </div>

          {/* Main Tab content rendering */}
          {isLoading ? (
            <DashboardSkeleton currentTab={currentTab} isHe={isHe} darkMode={darkMode} />
          ) : (
            <>
              {currentTab === 'dispatch' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1">
                    <div>
                      <h2 className="text-lg font-bold tracking-tight text-slate-900">
                        {isHe ? 'לוח סידור הפצה ראשי' : 'Main Dispatch Control'}
                      </h2>
                      <p className="text-xs text-slate-500">
                        {isHe 
                          ? 'ניהול, סינון ועדכון בזמן אמת של סחורות, מחסנים ויעדי לקוחות קצה.' 
                          : 'Manage fulfillment pipelines, dispatch status updates, and custom carrier routing.'}
                      </p>
                    </div>
                  </div>
                  
                  <DispatchTable
                    orders={orders}
                    auditLogs={auditLogs}
                    onUpdateStatus={handleUpdateStatus}
                    onAssignDriver={handleAssignDriver}
                    onDeleteOrder={handleDeleteOrder}
                    onCreateOrder={handleCreateOrder}
                    onUpdateOrderDetails={handleUpdateOrderDetails}
                    lang={lang}
                    isLoading={isLoading}
                    selectedOrderNumber={selectedOrderNumber}
                    onSelectOrderNumber={setSelectedOrderNumber}
                  />
                </div>
              )}

              {currentTab === 'integrations' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1">
                    <div>
                      <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
                        {isHe ? 'פורטל אימות, בקרה וסנכרון מיילים' : 'Email Sync & AI Ingestion Hub'}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {isHe 
                          ? 'ניטור ואימות אוטומטי של תעודות משולבות, התאמת כמויות, חישובי פקדון קומאקס והצלבת מנוף איתוראן.' 
                          : 'AI-assisted processing of Comax ERP orders, PDF splitting, and correlation of vehicle PTO GPS telemetry.'}
                      </p>
                    </div>
                  </div>
                  
                  <IntegrationsPortal
                    orders={orders}
                    auditLogs={auditLogs}
                    lang={lang}
                    onRefreshOrders={handleRefresh}
                  />
                </div>
              )}

              {currentTab === 'analytics' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1">
                    <div>
                      <h2 className="text-lg font-bold tracking-tight text-slate-900">
                        {isHe ? 'דוחות וניתוח מוצרים' : 'Product Analytics Dashboard'}
                      </h2>
                      <p className="text-xs text-slate-500">
                        {isHe 
                          ? 'ניתוח קשרי לקוחות, מוצרים מבוקשים והתפלגות עומס לוגיסטי בין המחסנים.' 
                          : 'Evaluates fulfillment speed, high-demand SKUs, and storage hub loading metrics.'}
                      </p>
                    </div>
                  </div>

                  <AnalyticsView
                    orders={orders}
                    lang={lang}
                    auditLogs={auditLogs}
                  />
                </div>
              )}

              {currentTab === 'map' && (
                <div className="space-y-4 animate-fade-in h-full flex flex-col min-h-0">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1 shrink-0">
                    <div>
                      <h2 className="text-lg font-bold tracking-tight text-slate-900">
                        {isHe ? 'מפת סידור הפצה אינטראקטיבית' : 'Interactive Dispatch Map'}
                      </h2>
                      <p className="text-xs text-slate-500">
                        {isHe 
                          ? 'ניטור גיאוגרפי של יעדי המשלוח, פריסת מחסנים ומיקומי סיכות לקוח בזמן אמת.' 
                          : 'Real-time geographic tracking of customer delivery endpoints and origin warehouse hubs.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex-1 min-h-[450px] relative rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-white">
                    <React.Suspense fallback={
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 text-slate-500 gap-3 font-sans" dir="rtl">
                        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
                        <p className="text-xs font-bold">{isHe ? 'טוען מפת הפצה...' : 'Loading interactive map...'}</p>
                      </div>
                    }>
                      <OrderMap
                        orders={orders}
                        lang={lang}
                        isLoading={isLoading}
                        selectedOrderNumber={selectedOrderNumber}
                        onSelectOrderNumber={(orderNum) => {
                          setSelectedOrderNumber(orderNum);
                          if (orderNum) {
                            setCurrentTab('dispatch');
                          }
                        }}
                        darkMode={darkMode}
                      />
                    </React.Suspense>
                  </div>
                </div>
              )}

              {currentTab === 'noa-ai' && (
                <div className="space-y-4 animate-fade-in h-[calc(100vh-14rem)] md:h-[calc(100vh-12rem)] flex flex-col min-h-[400px]">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1 shrink-0">
                    <div>
                      <h2 className="text-lg font-bold tracking-tight text-slate-900">
                        {isHe ? 'עוזרת לוגיסטית חכמה Noa AI' : 'Noa AI Logistics Assistant'}
                      </h2>
                      <p className="text-xs text-slate-500">
                        {isHe 
                          ? 'צ׳אט אינטראקטיבי לברור סטטוסים, מיקומי הפצה, עיכובים ועומסי מחסנים בזמן אמת.' 
                          : 'Interactive agent chat to query delivery logs, delay statuses, and live fleet details.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex-1 min-h-0">
                    <NoaChat
                      orders={orders}
                      lang={lang}
                      onSelectOrderNumber={(orderNum) => {
                        setSelectedOrderNumber(orderNum);
                        if (orderNum) {
                          setCurrentTab('dispatch');
                        }
                      }}
                    />
                  </div>
                </div>
              )}

              {currentTab === 'morning-report' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1">
                    <div>
                      <h2 className="text-lg font-bold tracking-tight text-slate-900">
                        {isHe ? 'דוח הפצה וריכוז בוקר' : 'Morning Logistics Report'}
                      </h2>
                      <p className="text-xs text-slate-500">
                        {isHe 
                          ? 'הפקת דוח לוגיסטי מסוכם ומאושר המותאם לשיתוף מהיר והעתקה ישירה לקבוצות וואטסאפ של נהגים.' 
                          : 'Generate consolidated and approved delivery reports formatted for easy driver dispatch via WhatsApp.'}
                      </p>
                    </div>
                  </div>

                  <MorningReport
                    orders={orders}
                    lang={lang}
                  />
                </div>
              )}

              {currentTab === 'order-history' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1">
                    <div>
                      <h2 className="text-lg font-bold tracking-tight text-slate-900">
                        {isHe ? 'יומן מעקב ושינויי סטטוסים' : 'Order Lifecycle Audit History'}
                      </h2>
                      <p className="text-xs text-slate-500">
                        {isHe 
                          ? 'היסטוריית שינויי סטטוסים, עדכוני הפצה, שינויים שבוצעו על ידי מנהלים וסינכרונים בזמן אמת.' 
                          : 'Audit trail tracking state changes, driver dispatches, and manual manager overrides.'}
                      </p>
                    </div>
                  </div>

                  <OrderHistoryView
                    auditLogs={auditLogs}
                    orders={orders}
                    lang={lang}
                    onSelectOrderNumber={(orderNum) => {
                      setSelectedOrderNumber(orderNum);
                      if (orderNum) {
                        setCurrentTab('dispatch');
                      }
                    }}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Mobile bottom navigation tab bar */}
        <div className="flex md:hidden border-t border-slate-200 bg-white p-1 justify-center gap-1 shrink-0">
          <button
            id="mob-tab-dispatch-btn"
            onClick={() => setCurrentTab('dispatch')}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 rounded-lg py-2 text-[10px] font-bold transition-all ${
              currentTab === 'dispatch'
                ? 'bg-slate-100 text-blue-600'
                : 'text-slate-600'
            }`}
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>{isHe ? 'לוח סידור' : 'Dispatch'}</span>
          </button>

          <button
            id="mob-tab-integrations-btn"
            onClick={() => setCurrentTab('integrations')}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 rounded-lg py-2 text-[10px] font-bold transition-all ${
              currentTab === 'integrations'
                ? 'bg-indigo-50 text-indigo-600'
                : 'text-slate-600'
            }`}
          >
            <Mail className="h-4 w-4" />
            <span>{isHe ? 'מיילים' : 'Inbox'}</span>
          </button>

          <button
            id="mob-tab-noa-btn"
            onClick={() => setCurrentTab('noa-ai')}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 rounded-lg py-2 text-[10px] font-bold transition-all ${
              currentTab === 'noa-ai'
                ? 'bg-emerald-50 text-emerald-600'
                : 'text-slate-600'
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            <span>{isHe ? 'נועה AI' : 'Noa AI'}</span>
          </button>

          <button
            id="mob-tab-map-btn"
            onClick={() => setCurrentTab('map')}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 rounded-lg py-2 text-[10px] font-bold transition-all ${
              currentTab === 'map'
                ? 'bg-slate-100 text-blue-600'
                : 'text-slate-600'
            }`}
          >
            <Map className="h-4 w-4" />
            <span>{isHe ? 'מפת סידור' : 'Map'}</span>
          </button>

          <button
            id="mob-tab-morning-btn"
            onClick={() => setCurrentTab('morning-report')}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 rounded-lg py-2 text-[10px] font-bold transition-all ${
              currentTab === 'morning-report'
                ? 'bg-slate-100 text-blue-600'
                : 'text-slate-600'
            }`}
          >
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span>{isHe ? 'דוח בוקר' : 'Briefing'}</span>
          </button>

          <button
            id="mob-tab-history-btn"
            onClick={() => setCurrentTab('order-history')}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 rounded-lg py-2 text-[10px] font-bold transition-all ${
              currentTab === 'order-history'
                ? 'bg-slate-100 text-blue-600'
                : 'text-slate-600'
            }`}
          >
            <History className="h-4 w-4" />
            <span>{isHe ? 'היסטוריה' : 'History'}</span>
          </button>
          
          <button
            id="mob-tab-analytics-btn"
            onClick={() => setCurrentTab('analytics')}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 rounded-lg py-2 text-[10px] font-bold transition-all ${
              currentTab === 'analytics'
                ? 'bg-slate-100 text-blue-600'
                : 'text-slate-600'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            <span>{isHe ? 'ניתוח' : 'Analytics'}</span>
          </button>
        </div>
      </main>

      {/* Connection & Setup Config Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onSaveConfig={handleSaveConfig}
        lang={lang}
      />

      {/* Keyboard Shortcuts Helper Modal */}
      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
        lang={lang}
      />
    </div>
  );
}
