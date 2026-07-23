import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Truck, 
  Cpu, 
  ShieldAlert,
  Search,
  MapPin,
  Clock,
  RotateCcw,
  CloudLightning,
  ExternalLink,
  Package,
  Layers,
  Sparkles,
  ArrowUpRight,
  Database,
  FileCheck,
  Send,
  User as UserIcon,
  LogOut,
  Inbox,
  Paperclip,
  Check,
  X,
  MessageSquare,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from 'firebase/auth';
import { Order, Language, GmailMessage } from '../types';
import { triggerProcessIncomingOrders, getLiveOrdersData, formatDate } from '../utils/api';
import { initAuth, googleSignIn, logoutUser, getAccessToken } from '../utils/firebase';
import { listGmailMessages, sendGmailMessage } from '../utils/gmail';

interface IntegrationsPortalProps {
  orders: Order[];
  auditLogs?: any[];
  lang: Language;
  onRefreshOrders?: () => void;
}

export default function IntegrationsPortal({ orders: initialOrders, lang, onRefreshOrders }: IntegrationsPortalProps) {
  const isHe = lang === 'he';
  const [orders, setOrders] = useState<Order[]>(initialOrders || []);
  const [isLoadingOrders, setIsLoadingOrders] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncResult, setSyncResult] = useState<{
    success: boolean;
    message?: string;
    processedCount?: number;
    timestamp?: string;
    error?: string;
  } | null>(null);

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState<string>('all');

  // Gmail OAuth Authentication State
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Active Tab: 'orders' | 'gmail' | 'send_email'
  const [activeTab, setActiveTab] = useState<'orders' | 'gmail' | 'send_email'>('orders');

  // Live Gmail Inbox Messages
  const [gmailMessages, setGmailMessages] = useState<GmailMessage[]>([]);
  const [isLoadingGmail, setIsLoadingGmail] = useState<boolean>(false);
  const [gmailQuery, setGmailQuery] = useState<string>('label:INBOX');
  const [selectedGmailMessage, setSelectedGmailMessage] = useState<GmailMessage | null>(null);

  // Email Compose State
  const [emailTo, setEmailTo] = useState<string>('');
  const [emailSubject, setEmailSubject] = useState<string>('');
  const [emailBody, setEmailBody] = useState<string>('');
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);
  const [emailSendStatus, setEmailSendStatus] = useState<{ success: boolean; message: string } | null>(null);

  // Confirmation Modal for Sending Email (MANDATORY per Workspace Integration Guidelines)
  const [showSendConfirmation, setShowSendConfirmation] = useState<boolean>(false);

  // Initialize Firebase Auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (authUser, token) => {
        setUser(authUser);
        setAccessToken(token);
        setIsAuthLoading(false);
      },
      () => {
        setUser(null);
        setAccessToken(null);
        setIsAuthLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Sync internal orders state with prop updates
  useEffect(() => {
    if (initialOrders && initialOrders.length > 0) {
      setOrders(initialOrders);
    }
  }, [initialOrders]);

  // Load live orders on mount
  useEffect(() => {
    loadLiveOrders();
  }, []);

  // Fetch live Gmail messages whenever token or query changes
  useEffect(() => {
    if (accessToken && activeTab === 'gmail') {
      fetchGmailInbox();
    }
  }, [accessToken, activeTab, gmailQuery]);

  const loadLiveOrders = async () => {
    setIsLoadingOrders(true);
    try {
      const liveData = await getLiveOrdersData();
      if (liveData && liveData.length > 0) {
        setOrders(liveData);
      }
    } catch (err) {
      console.error('Error fetching live orders:', err);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  const handleGoogleLogin = async () => {
    setAuthError(null);
    setIsAuthLoading(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setAccessToken(result.accessToken);
      }
    } catch (err: any) {
      setAuthError(err.message || 'התחברות באמצעות Google נכשלה');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    setUser(null);
    setAccessToken(null);
    setGmailMessages([]);
  };

  const fetchGmailInbox = async () => {
    if (!accessToken) return;
    setIsLoadingGmail(true);
    try {
      const msgs = await listGmailMessages(accessToken, gmailQuery, 15);
      setGmailMessages(msgs);
    } catch (err: any) {
      console.error('Failed to load Gmail messages:', err);
    } finally {
      setIsLoadingGmail(false);
    }
  };

  // Trigger processIncomingOrders via Google Apps Script Backend
  const handleRunProcessIncomingOrders = async () => {
    setIsSyncing(true);
    setSyncResult(null);

    try {
      const result = await triggerProcessIncomingOrders();
      setSyncResult(result);

      // Refresh orders table immediately
      await loadLiveOrders();
      if (onRefreshOrders) {
        onRefreshOrders();
      }
    } catch (err: any) {
      setSyncResult({
        success: false,
        error: err.message || 'שגיאה בחיבור לשרת Google Apps Script'
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Execute Send Email after Explicit User Confirmation
  const confirmAndSendEmail = async () => {
    setShowSendConfirmation(false);
    if (!accessToken) {
      setEmailSendStatus({ success: false, message: 'נדרשת התחברות לחשבון Google כדי לשלוח מייל' });
      return;
    }

    setIsSendingEmail(true);
    setEmailSendStatus(null);

    try {
      const res = await sendGmailMessage(accessToken, {
        to: emailTo,
        subject: emailSubject,
        body: emailBody
      });

      if (res.success) {
        setEmailSendStatus({ success: true, message: `המייל נשלח בהצלחה דרך חשבון Gmail! מזהה: ${res.messageId}` });
        setEmailTo('');
        setEmailSubject('');
        setEmailBody('');
      } else {
        setEmailSendStatus({ success: false, message: res.error || 'שליחת המייל נכשלה' });
      }
    } catch (err: any) {
      setEmailSendStatus({ success: false, message: err.message || 'שגיאה בשליחת המייל' });
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Filter orders based on search & warehouse
  const filteredOrders = orders.filter(o => {
    const matchesSearch = 
      o.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.deliveryAddress.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (o.notes || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesWarehouse = 
      selectedWarehouseFilter === 'all' || o.warehouse === selectedWarehouseFilter;

    return matchesSearch && matchesWarehouse;
  });

  // Calculate stats
  const totalOrders = orders.length;
  const noaVerifiedCount = orders.filter(o => !o.noaAnalysis || o.noaAnalysis.includes('✅') || o.noaAnalysis.includes('תואם')).length;
  const totalDepositBales = orders.reduce((sum, o) => sum + (o.depositBales || 0), 0);
  const totalDepositPallets = orders.reduce((sum, o) => sum + (o.depositPallets || 0), 0);

  return (
    <div className="space-y-6 text-slate-100 font-sans dir-rtl" dir="rtl">
      
      {/* Top Header Banner - Navy Blue & Electric Orange */}
      <div className="bg-slate-900 border-r-4 border-orange-500 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className="px-3 py-1 bg-orange-500/20 text-orange-400 border border-orange-500/30 text-xs font-bold rounded-full flex items-center gap-1.5">
                <CloudLightning className="w-3.5 h-3.5 text-orange-400 animate-pulse" />
                SabanOS Gmail & Ingestion Engine
              </span>
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Google Workspace OAuth 2.0 מחובר
              </span>
            </div>
            
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <Mail className="w-8 h-8 text-orange-500" />
              אינטגרציית Gmail בלייב, חילוץ מסמכים וניתוח נועה
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-3xl">
              קליטת הזמנות בזמן אמת מחשבון ה-Gmail, חילוץ טקסט מ-PDF, הפעלת מנוע הפיקדונות הדיטרמיניסטי ושליחת הודעות עדכון ללקוחות ולנהגים במייל.
            </p>
          </div>

          {/* User Auth Status / Google Sign-In */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
            {user ? (
              <div className="bg-slate-800/90 border border-slate-700 p-3 rounded-xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName || 'Google User'} className="w-9 h-9 rounded-full border border-orange-500/50" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold">
                      <UserIcon className="w-5 h-5" />
                    </div>
                  )}
                  <div>
                    <div className="text-xs font-bold text-white truncate max-w-[150px]">{user.displayName || user.email}</div>
                    <div className="text-[11px] text-emerald-400 font-mono">Gmail מחובר</div>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-700 rounded-lg transition-colors"
                  title="התנתק מחשבון Google"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleGoogleLogin}
                disabled={isAuthLoading}
                className="gsi-material-button bg-white text-slate-900 font-bold px-5 py-3 rounded-xl shadow-lg hover:bg-slate-100 transition-all flex items-center justify-center gap-3 text-sm cursor-pointer border border-slate-300"
              >
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5 shrink-0">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                </svg>
                <span>התחבר עם Google (Gmail)</span>
              </button>
            )}

            <button
              onClick={handleRunProcessIncomingOrders}
              disabled={isSyncing}
              className="bg-orange-500 hover:bg-orange-600 active:bg-orange-700 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold px-5 py-3 rounded-xl shadow-lg shadow-orange-500/25 transition-all flex items-center justify-center gap-2 text-sm border border-orange-400/30 cursor-pointer shrink-0"
            >
              {isSyncing ? (
                <>
                  <RotateCcw className="w-4 h-4 animate-spin text-white" />
                  <span>מעבד מיילים...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-200" />
                  <span>סנכרון מיילים חם</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {authError && (
        <div className="bg-rose-500/15 border border-rose-500/40 p-4 rounded-xl text-rose-300 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
          <span>{authError}</span>
        </div>
      )}

      {/* Sync Status Feedback Console */}
      <AnimatePresence>
        {syncResult && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-5 rounded-xl border ${
              syncResult.success 
                ? 'bg-slate-900/90 border-emerald-500/50 text-emerald-200' 
                : 'bg-slate-900/90 border-rose-500/50 text-rose-200'
            } shadow-xl relative`}
          >
            <div className="flex items-start gap-4">
              {syncResult.success ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <h4 className="font-bold text-base text-white flex items-center justify-between">
                  <span>{syncResult.success ? 'סנכרון מיילים ו-PDF הושלם בהצלחה!' : 'שגיאה בסנכרון מיילים'}</span>
                  {syncResult.timestamp && (
                    <span className="text-xs font-normal text-slate-400">
                      {formatDate(syncResult.timestamp, isHe ? 'he' : 'en')}
                    </span>
                  )}
                </h4>
                <p className="text-sm mt-1 text-slate-300">
                  {syncResult.message || syncResult.error}
                </p>

                {syncResult.processedCount !== undefined && syncResult.processedCount > 0 && (
                  <div className="mt-3 bg-slate-950/80 p-3 rounded-lg border border-emerald-500/30 flex items-center justify-between">
                    <span className="text-xs text-emerald-300 font-medium">
                      נקלטו והוזרקו {syncResult.processedCount} הזמנות חדשות ללוח הסידור ולגיליון המרכזי
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">
                      16 עמודות הוזרקו
                    </span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mode Switch Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'orders' 
              ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' 
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>טבלת הזמנות מגיליון SabanOS</span>
          <span className="px-2 py-0.5 text-xs rounded-full bg-slate-950/60 font-mono">
            {orders.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('gmail')}
          className={`px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'gmail' 
              ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' 
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Inbox className="w-4 h-4" />
          <span>תיבת Gmail בלייב</span>
          {user && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('send_email')}
          className={`px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'send_email' 
              ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' 
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>שליחת מייל עדכון (Gmail API)</span>
        </button>
      </div>

      {/* TAB 1: Live Orders Table */}
      {activeTab === 'orders' && (
        <div className="space-y-6">
          {/* Analytics KPI Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-lg relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">סה"כ הזמנות הפצה</p>
                  <h3 className="text-3xl font-black text-white mt-2 tracking-tight">{totalOrders}</h3>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                    <Database className="w-3.5 h-3.5 text-orange-400" />
                    לוג הזמנות מערכת פעיל
                  </p>
                </div>
                <div className="p-3 bg-slate-800 rounded-xl border border-slate-700 text-orange-400">
                  <Layers className="w-6 h-6" />
                </div>
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-lg relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">מאומתות נועה (AI)</p>
                  <h3 className="text-3xl font-black text-emerald-400 mt-2 tracking-tight">{noaVerifiedCount}</h3>
                  <p className="text-xs text-emerald-400/80 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    פקדונות תואמים ללא כפל
                  </p>
                </div>
                <div className="p-3 bg-slate-800 rounded-xl border border-slate-700 text-emerald-400">
                  <FileCheck className="w-6 h-6" />
                </div>
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-lg relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">פקדונות בלות (שק גדול)</p>
                  <h3 className="text-3xl font-black text-orange-400 mt-2 tracking-tight">{totalDepositBales}</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    חישוב עדיפות מפורשת (מק"ט 60002)
                  </p>
                </div>
                <div className="p-3 bg-slate-800 rounded-xl border border-slate-700 text-orange-400">
                  <Package className="w-6 h-6" />
                </div>
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-lg relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">פקדונות משטחים</p>
                  <h3 className="text-3xl font-black text-amber-400 mt-2 tracking-tight">{totalDepositPallets}</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    חישוב עדיפות מפורשת (מק"ט 60060)
                  </p>
                </div>
                <div className="p-3 bg-slate-800 rounded-xl border border-slate-700 text-amber-400">
                  <Truck className="w-6 h-6" />
                </div>
              </div>
            </div>
          </div>

          {/* Main Order Integration Table Section */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 bg-slate-950/60 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-orange-500" />
                <h3 className="font-bold text-lg text-white">טבלת הזמנות חיה מגיליון Google Apps Script (16 עמודות)</h3>
                <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded-full border border-slate-700 font-mono">
                  {filteredOrders.length} הזמנות
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="חפש הזמנה, לקוח, כתובת..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pr-9 pl-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                  />
                </div>

                <select
                  value={selectedWarehouseFilter}
                  onChange={(e) => setSelectedWarehouseFilter(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-orange-500"
                >
                  <option value="all">כל המחסנים</option>
                  <option value="מחסן החרש">מחסן החרש</option>
                  <option value="מחסן התלמיד">מחסן התלמיד</option>
                  <option value="מחסן עטרות">מחסן עטרות</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              {isLoadingOrders ? (
                <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                  <RotateCcw className="w-8 h-8 text-orange-500 animate-spin" />
                  <p className="text-sm font-semibold text-slate-300">טוען נתוני אמת מהגיליון המרכזי...</p>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                  <Mail className="w-10 h-10 text-slate-600 mb-1" />
                  <p className="text-base font-bold text-slate-300">לא נמצאו הזמנות תואמות</p>
                  <p className="text-xs text-slate-500">לחץ על כפתור "סנכרון מיילים חם" כדי לשאוב הזמנות חדשות מג'ימייל</p>
                </div>
              ) : (
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-950 text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3.5 px-4">מספר הזמנה ותאריך</th>
                      <th className="py-3.5 px-4">לקוח יעד וכתובת</th>
                      <th className="py-3.5 px-4">מחסן הפצה</th>
                      <th className="py-3.5 px-4">פריטים שחולצו (AI)</th>
                      <th className="py-3.5 px-4 text-center">פקדונות מחושבים</th>
                      <th className="py-3.5 px-4 text-center">אימות נועה (AI)</th>
                      <th className="py-3.5 px-4 text-center">מסמך PDF</th>
                      <th className="py-3.5 px-4 text-center">סטטוס הזרקה</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {filteredOrders.map((order) => {
                      const isVerified = !order.noaAnalysis || order.noaAnalysis.includes('✅') || order.noaAnalysis.includes('תואם');
                      const pdfUrl = (order as any).pdfUrl || (order.notes && order.notes.includes('PDF:') ? order.notes.match(/PDF:\s*(https?:\/\/[^\s]+)/)?.[1] : null);

                      return (
                        <tr key={order.id || order.orderNumber} className="hover:bg-slate-800/50 transition-colors">
                          <td className="py-4 px-4 whitespace-nowrap">
                            <div className="font-bold text-orange-400 text-base">{order.orderNumber}</div>
                            <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3" />
                              {formatDate(order.timestamp, isHe ? 'he' : 'en')}
                            </div>
                          </td>

                          <td className="py-4 px-4">
                            <div className="font-semibold text-white">{order.customerName}</div>
                            <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5 max-w-xs truncate">
                              <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                              <span>{order.deliveryAddress || 'לפי תעודת משלוח'}</span>
                            </div>
                          </td>

                          <td className="py-4 px-4 whitespace-nowrap">
                            <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs border border-slate-700">
                              {order.warehouse || 'מחסן החרש'}
                            </span>
                          </td>

                          <td className="py-4 px-4 max-w-xs">
                            <div className="space-y-1">
                              {(order.items || []).slice(0, 3).map((item, idx) => (
                                <div key={idx} className="text-xs text-slate-300 flex items-center justify-between gap-2 bg-slate-950/60 px-2 py-1 rounded border border-slate-800/80">
                                  <span className="truncate">{item.name}</span>
                                  <span className="font-bold text-orange-400 shrink-0">x{item.quantity}</span>
                                </div>
                              ))}
                              {(order.items || []).length > 3 && (
                                <div className="text-[11px] text-slate-500 font-medium">
                                  + עוד {(order.items || []).length - 3} פריטים
                                </div>
                              )}
                            </div>
                          </td>

                          <td className="py-4 px-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              {(order.depositBales || 0) > 0 && (
                                <span className="px-2 py-0.5 rounded text-xs font-bold bg-orange-500/20 text-orange-300 border border-orange-500/40">
                                  בלות: {order.depositBales}
                                </span>
                              )}
                              {(order.depositPallets || 0) > 0 && (
                                <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                  משטחים: {order.depositPallets}
                                </span>
                              )}
                              {(order.depositDrums || 0) > 0 && (
                                <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                                  חביות: {order.depositDrums}
                                </span>
                              )}
                              {(!order.depositBales && !order.depositPallets && !order.depositDrums && !order.depositBlockPallets) && (
                                <span className="text-xs text-slate-500 font-mono">ללא פקדון</span>
                              )}
                            </div>
                          </td>

                          <td className="py-4 px-4 text-center whitespace-nowrap">
                            {isVerified ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>אימות נועה תואם</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                                <ShieldAlert className="w-3.5 h-3.5" />
                                <span>חריגה - נדרשת בדיקה</span>
                              </span>
                            )}
                          </td>

                          <td className="py-4 px-4 text-center whitespace-nowrap">
                            {pdfUrl ? (
                              <a
                                href={pdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 px-3 py-1.5 rounded-lg border border-orange-500/30 transition-colors"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>צפה ב-PDF</span>
                                <ArrowUpRight className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-xs text-slate-500 italic">נקלט ממייל</span>
                            )}
                          </td>

                          <td className="py-4 px-4 text-center whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-800 text-slate-200 border border-slate-700">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                              <span>הוזרק (16 עמודות)</span>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Live Gmail Inbox Viewer */}
      {activeTab === 'gmail' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl p-6 space-y-6">
          {!user ? (
            <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-4 bg-slate-950/60 rounded-xl border border-slate-800">
              <Mail className="w-12 h-12 text-orange-500" />
              <h3 className="text-xl font-bold text-white">התחבר עם Gmail לצפייה ישירה בהודעות</h3>
              <p className="text-sm text-slate-400 max-w-md">
                התחבר באמצעות חשבון Google של הארגון כדי לצפות בהודעות דוא"ל נכנסות, לחלץ מסמכי PDF ולהתרשם מנתוני Gmail בזמן אמת.
              </p>
              <button
                onClick={handleGoogleLogin}
                className="bg-white hover:bg-slate-100 text-slate-900 font-bold px-6 py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-3 text-sm cursor-pointer"
              >
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5 shrink-0">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                </svg>
                <span>התחבר באמצעות Google Sign-In</span>
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                <div className="flex items-center gap-3">
                  <Inbox className="w-5 h-5 text-orange-500" />
                  <h3 className="font-bold text-lg text-white">תיבת Gmail נכנסת (מחובר: {user.email})</h3>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="שאילתת חיפוש Gmail (למשל: filename:pdf או סבן)"
                    value={gmailQuery}
                    onChange={(e) => setGmailQuery(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500 w-full sm:w-72"
                  />
                  <button
                    onClick={fetchGmailInbox}
                    disabled={isLoadingGmail}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 p-2.5 rounded-xl border border-slate-700 transition-colors"
                    title="רענן תיבת מייל"
                  >
                    <RotateCcw className={`w-4 h-4 ${isLoadingGmail ? 'animate-spin text-orange-500' : ''}`} />
                  </button>
                </div>
              </div>

              {isLoadingGmail ? (
                <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                  <RotateCcw className="w-8 h-8 text-orange-500 animate-spin" />
                  <p className="text-sm font-semibold text-slate-300">טוען הודעות מ-Gmail API...</p>
                </div>
              ) : gmailMessages.length === 0 ? (
                <div className="p-12 text-center text-slate-400 bg-slate-950/40 rounded-xl border border-slate-800">
                  <Mail className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-base font-bold text-slate-300">לא נמצאו הודעות דוא"ל מתאימות</p>
                  <p className="text-xs text-slate-500">נסה לשנות את שאילתת החיפוש למעלה למשל: "label:INBOX"</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Messages List */}
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                    {gmailMessages.map((msg) => (
                      <div
                        key={msg.id}
                        onClick={() => setSelectedGmailMessage(msg)}
                        className={`p-4 rounded-xl border transition-all cursor-pointer ${
                          selectedGmailMessage?.id === msg.id
                            ? 'bg-slate-800 border-orange-500 shadow-md'
                            : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2 mb-1">
                          <span className="font-bold text-white text-sm truncate max-w-[220px]">
                            {msg.from}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono shrink-0">
                            {formatDate(msg.date, isHe ? 'he' : 'en')}
                          </span>
                        </div>
                        <h4 className="font-semibold text-orange-400 text-xs truncate mb-1">
                          {msg.subject}
                        </h4>
                        <p className="text-xs text-slate-400 line-clamp-2">
                          {msg.snippet}
                        </p>
                        {msg.hasAttachments && (
                          <div className="mt-2 flex items-center gap-1 text-[11px] text-amber-400 font-bold">
                            <Paperclip className="w-3.5 h-3.5" />
                            <span>מכיל קובץ מצורף (PDF/תמונה)</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Selected Message Preview Pane */}
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 relative">
                    {selectedGmailMessage ? (
                      <div className="space-y-4">
                        <div className="border-b border-slate-800 pb-3">
                          <span className="text-xs text-orange-400 font-mono">מזהה הודעה: {selectedGmailMessage.id}</span>
                          <h3 className="text-lg font-bold text-white mt-1">{selectedGmailMessage.subject}</h3>
                          <div className="text-xs text-slate-400 mt-1">
                            <span className="font-semibold text-slate-300">מאת:</span> {selectedGmailMessage.from}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            <span className="font-semibold text-slate-300">בתאריך:</span> {selectedGmailMessage.date}
                          </div>
                        </div>

                        <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 text-xs text-slate-300 whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed">
                          {selectedGmailMessage.body || selectedGmailMessage.snippet}
                        </div>

                        {selectedGmailMessage.hasAttachments && (
                          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-between">
                            <span className="text-xs text-amber-300 font-medium flex items-center gap-1.5">
                              <Paperclip className="w-4 h-4 text-amber-400" />
                              מפתח קובצי PDF / נספחים זוהה להזמנה זו
                            </span>
                            <button
                              onClick={handleRunProcessIncomingOrders}
                              className="text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                            >
                              עבד ב-SabanOS Backend
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-slate-500 text-center gap-2">
                        <MessageSquare className="w-8 h-8 text-slate-600" />
                        <p className="text-sm font-medium">בחר הודעה מהרשימה מימין לצפייה בתוכן המלא</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Send Email via Gmail API (With Explicit User Confirmation) */}
      {activeTab === 'send_email' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl p-6 max-w-3xl mx-auto space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
            <Send className="w-6 h-6 text-orange-500" />
            <div>
              <h3 className="text-xl font-bold text-white">שליחת הודעת דוא"ל דרך Gmail API</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                שליחת הודעת עדכון / אישור הזמנה ללקוח או לנהג דרך חשבון Google המחובר
              </p>
            </div>
          </div>

          {!user ? (
            <div className="p-8 text-center text-slate-400 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
              <p className="text-sm">יש להתחבר לחשבון Google כדי לעשות שימוש בשירות שליחת הודעות Gmail.</p>
              <button
                onClick={handleGoogleLogin}
                className="bg-white hover:bg-slate-100 text-slate-900 font-bold px-5 py-2.5 rounded-xl text-sm transition-all inline-flex items-center gap-2 cursor-pointer"
              >
                <span>התחבר עם Google Sign-In</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  נמען (כתובת דוא"ל):
                </label>
                <input
                  type="email"
                  placeholder="customer@example.com"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  נושא ההודעה:
                </label>
                <input
                  type="text"
                  placeholder='עדכון סטטוס הזמנה #10045 - סבן מוצרי נייר'
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  תוכן ההודעה:
                </label>
                <textarea
                  rows={6}
                  placeholder="שלום רב, ההזמנה שלך יצאה לדרך עם הנהג משה. לפרטים נוספים ניתן ליצור קשר..."
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500 resize-none"
                />
              </div>

              {/* Status Banner */}
              {emailSendStatus && (
                <div className={`p-4 rounded-xl text-xs font-medium border flex items-center gap-3 ${
                  emailSendStatus.success 
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300' 
                    : 'bg-rose-500/10 border-rose-500/40 text-rose-300'
                }`}>
                  {emailSendStatus.success ? <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" /> : <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />}
                  <span>{emailSendStatus.message}</span>
                </div>
              )}

              {/* Action Button - Triggers Confirmation Dialog */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  disabled={!emailTo || !emailSubject || !emailBody || isSendingEmail}
                  onClick={() => setShowSendConfirmation(true)}
                  className="bg-orange-500 hover:bg-orange-600 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold px-6 py-3 rounded-xl shadow-lg transition-all flex items-center gap-2 text-sm cursor-pointer border border-orange-400/30"
                >
                  <Send className="w-4 h-4" />
                  <span>שלח הודעה ב-Gmail</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MANDATORY Explicit User Confirmation Modal for Destructive/Sending Workspace Operations */}
      <AnimatePresence>
        {showSendConfirmation && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-orange-500/20 text-orange-400 rounded-xl border border-orange-500/30">
                  <Send className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">אישור שליחת דוא"ל מחשבונך</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    האם אתה בטוח שברצונך לשלוח דוא"ל זה באמצעות Gmail API בשם החשבון המחובר?
                  </p>
                </div>
              </div>

              <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 text-xs space-y-2">
                <div>
                  <span className="font-bold text-slate-400">אל:</span>{' '}
                  <span className="text-white">{emailTo}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-400">נושא:</span>{' '}
                  <span className="text-orange-400 font-semibold">{emailSubject}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-400">תוכן:</span>
                  <p className="text-slate-300 mt-1 bg-slate-900 p-2 rounded border border-slate-800 line-clamp-3">
                    {emailBody}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSendConfirmation(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  ביטול
                </button>
                <button
                  type="button"
                  onClick={confirmAndSendEmail}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 border border-orange-400/30 shadow-lg shadow-orange-500/20 transition-all flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>מאשר שליחה כעת</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

