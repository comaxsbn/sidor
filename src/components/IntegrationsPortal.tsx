import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  FileSignature, 
  Truck, 
  Cpu, 
  ShieldAlert,
  ArrowRightLeft,
  Search,
  Check,
  Split,
  MapPin,
  Clock,
  Play,
  RotateCcw,
  CloudLightning,
  User,
  ExternalLink,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Order, OrderItem, Language, AuditLogEntry } from '../types';
import { saveOrderToFirestore, saveAuditLogToFirestore } from '../utils/firebase';
import { formatDate, translate, MOCK_PRODUCTS } from '../utils/api';

interface IntegrationsPortalProps {
  orders: Order[];
  auditLogs: AuditLogEntry[];
  lang: Language;
  onRefreshOrders?: () => void;
}

interface SimulatedEmail {
  id: string;
  sender: string;
  subject: string;
  body: string;
  timestamp: string;
  type: 'order' | 'delivery_note' | 'ituran';
  attachmentName?: string;
  attachmentSize?: string;
  processed: boolean;
  linkedOrderNo?: string;
}

export default function IntegrationsPortal({ orders, auditLogs, lang, onRefreshOrders }: IntegrationsPortalProps) {
  const isHe = lang === 'he';
  const [selectedEmail, setSelectedEmail] = useState<SimulatedEmail | null>(null);
  const [activeConsoleTab, setActiveConsoleTab] = useState<'ingestion' | 'split' | 'validation'>('ingestion');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingLog, setProcessingLog] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [simulationStatus, setSimulationStatus] = useState<string | null>(null);

  // Selected order for the Validation Console
  const [selectedOrderNoForValidation, setSelectedOrderNoForValidation] = useState<string>('');
  
  // Local states for signature status / verification
  const [verificationFeedback, setVerificationFeedback] = useState<Record<string, {
    signatureDetected: boolean;
    ptoCorrelated: boolean;
    ptoDuration: number;
    discrepancy: string;
  }>>({});

  // Simulated Inbox Emails
  const [emails, setEmails] = useState<SimulatedEmail[]>([
    {
      id: 'em-001',
      sender: 'comax-erp@sbn-logistics.co.il',
      subject: 'הזמנת לקוח חדשה קומאקס - שופרסל בע"מ [SBN-10029]',
      body: `מצורף קובץ הזמנה ממוחשב COMAX עבור שופרסל בע"מ.\nמספר הזמנה: SBN-10029\nכתובת אספקה: החרש 14, אזור התעשייה תל אביב\nמחסן הפצה: מחסן החרש\n\nפירוט פריטים:\n- שק גדול חול (כמות: 5)\n- שק גדול חצץ (כמות: 3)\n- [60002] שק גדול פקדון (כמות: 7)`,
      timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 mins ago
      type: 'order',
      attachmentName: 'COMAX_Order_SBN-10029_shufersal.pdf',
      attachmentSize: '245 KB',
      processed: false,
      linkedOrderNo: 'SBN-10029'
    },
    {
      id: 'em-002',
      sender: 'comax-erp@sbn-logistics.co.il',
      subject: 'הזמנה חדשה מקומאקס - רמי לוי שיווק השקמה [SBN-10030]',
      body: `קובץ PDF COMAX להזמנה SBN-10030 עבור סניף רמי לוי.\nכתובת: התלמיד 5, אזור תעשייה עטרות, ירושלים\nמחסן הפצה: מחסן התלמיד\n\nפירוט פריטים:\n- שק מלט 25 ק"ג (כמות: 12)\n- שק טיח (כמות: 8)\n- [60060] משטח סבן פקדון (כמות: 2)`,
      timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 mins ago
      type: 'order',
      attachmentName: 'COMAX_Order_SBN-10030_ramilevy.pdf',
      attachmentSize: '210 KB',
      processed: false,
      linkedOrderNo: 'SBN-10030'
    },
    {
      id: 'em-003',
      sender: 'delivery-system@sbn-logistics.co.il',
      subject: 'תעודות משלוח משולבות לסידור הפצה - SBN-DELIV-COMBINED-03',
      body: `מצורף קובץ תעודות משלוח משולב של נהגי חלוקה עבור הזמנות SBN-10029 ו-SBN-10030.\nיש לבצע חלוקה (Split), גיבוי ב-Google Drive, ואימות פריטים וחתימה.`,
      timestamp: new Date(Date.now() - 35 * 60 * 1000).toISOString(), // 35 mins ago
      type: 'delivery_note',
      attachmentName: 'SBN_COMBINED_DELIVERY_NOTES_03.pdf',
      attachmentSize: '1.2 MB',
      processed: false
    },
    {
      id: 'em-004',
      sender: 'ituran-telemetry@ituran.co.il',
      subject: 'התראת הפעלת מנוף משאית (PTO) - רכב 72-911-33 (נהג עלי)',
      body: `מערכת איתוראן מדווחת על הפעלת מנוף פריקה (PTO ON):\nרכב: 72-911-33\nנהג: עלי\nמיקום: 32.0853, 34.7818 (סמוך לרחוב החרש 14, תל אביב)\nזמן הפעלה: ${new Date(Date.now() - 1 * 60 * 60 * 1000).toLocaleTimeString('he-IL')}\nמשך פעילות מנוף: 18 דקות.`,
      timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45 mins ago
      type: 'ituran',
      processed: false
    },
    {
      id: 'em-005',
      sender: 'ituran-telemetry@ituran.co.il',
      subject: 'התראת הפעלת מנוף משאית (PTO) - רכב 88-302-14 (נהג יוסף)',
      body: `מערכת איתוראן מדווחת על הפעלת מנוף פריקה (PTO ON):\nרכב: 88-302-14\nנהג: יוסף\nמיקום: 31.8540, 35.2105 (עטרות, ירושלים)\nזמן הפעלה: ${new Date(Date.now() - 2 * 60 * 60 * 1000).toLocaleTimeString('he-IL')}\nמשך פעילות מנוף: 25 דקות.`,
      timestamp: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(), // 1.5 hours ago
      type: 'ituran',
      processed: false
    }
  ]);

  // Handle setting selected order for validation dropdown
  useEffect(() => {
    if (orders.length > 0 && !selectedOrderNoForValidation) {
      // Find a pending/processing order to default to
      const target = orders.find(o => o.status === 'pending' || o.status === 'processing') || orders[0];
      setSelectedOrderNoForValidation(target?.orderNumber || '');
    }
  }, [orders, selectedOrderNoForValidation]);

  // Filter emails based on search
  const filteredEmails = emails.filter(em => 
    em.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
    em.sender.toLowerCase().includes(searchTerm.toLowerCase()) ||
    em.body.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Run the Order Ingestion & Deposit Compliance Analysis
  const handleIngestOrder = async (email: SimulatedEmail) => {
    if (email.type !== 'order' || !email.linkedOrderNo) return;
    
    setIsProcessing(true);
    setProcessingLog([]);
    setActiveConsoleTab('ingestion');

    const logs = [
      `[INFO] Starting parsing of email attachment: ${email.attachmentName}...`,
      `[INFO] Target mailbox: comax.sbn@gmail.com`,
      `[AI] Extracting text schema from PDF document...`,
      `[AI] Order parsed successfully:`,
      `   - Order Number: ${email.linkedOrderNo}`,
      `   - Customer: ${email.linkedOrderNo === 'SBN-10029' ? 'שופרסל בע"מ' : 'רמי לוי שיווק השקמה'}`,
      `   - Delivery Address: ${email.linkedOrderNo === 'SBN-10029' ? 'החרש 14, אזור התעשייה תל אביב' : 'התלמיד 5, אזור תעשייה עטרות, ירושלים'}`,
      `[CALC] Initiating Deterministic Deposit compliance calculation:`
    ];

    setProcessingLog([...logs]);

    // Perform Deposit Calculation
    setTimeout(async () => {
      let logUpdates = [...logs];
      let bagStatus = '';
      let palletStatus = '';
      
      let targetOrder = orders.find(o => o.orderNumber === email.linkedOrderNo);
      
      if (!targetOrder) {
        // Fallback or create realistic order dynamically
        const isSBN29 = email.linkedOrderNo === 'SBN-10029';
        targetOrder = {
          id: `live-ingest-${Date.now()}`,
          orderNumber: email.linkedOrderNo || 'SBN-10029',
          timestamp: new Date().toISOString(),
          customerName: isSBN29 ? 'שופרסל בע"מ' : 'רמי לוי שיווק השקמה',
          warehouse: isSBN29 ? 'מחסן החרש' : 'מחסן התלמיד',
          deliveryAddress: isSBN29 ? 'החרש 14, אזור התעשייה תל אביב' : 'התלמיד 5, אזור תעשייה עטרות, ירושלים',
          status: 'pending',
          totalAmount: isSBN29 ? 1450 : 2100,
          latitude: isSBN29 ? 32.0853 : 31.8540,
          longitude: isSBN29 ? 34.7818 : 35.2105,
          items: isSBN29 ? [
            { id: 'item-1', name: 'שק גדול חול', quantity: 5, price: 150, sku: 'SBN-BAG-01' },
            { id: 'item-2', name: 'שק גדול חצץ', quantity: 3, price: 180, sku: 'SBN-BAG-02' },
            { id: 'deposit-bag', name: 'שק גדול פקדון', quantity: 7, price: 50, sku: '60002' }
          ] : [
            { id: 'item-1', name: 'שק מלט 25 ק"ג', quantity: 12, price: 40, sku: 'SBN-CMT-01' },
            { id: 'item-2', name: 'שק טיח לוגיסטי', quantity: 8, price: 35, sku: 'SBN-PLST-02' },
            { id: 'deposit-pallet', name: 'משטח סבן פקדון', quantity: 2, price: 85, sku: '60060' }
          ]
        };
      }

      // Calculation logic
      if (email.linkedOrderNo === 'SBN-10029') {
        // Shufersal
        // Total bags: 5 (hond) + 3 (chaz) = 8
        // SKU 60002 has quantity 7
        const totalBags = 8;
        const depositQty = 7;
        const diff = totalBags - depositQty;
        bagStatus = `❌ חסר: ${diff}`;
        
        logUpdates.push(`   - Bags (בלות) calculation: Found 8 heavy bags (שק גדול) in items.`);
        logUpdates.push(`   - Found SKU [60002] (שק גדול פקדון) with quantity: 7.`);
        logUpdates.push(`   - Compliance check: 8 required vs 7 deposited.`);
        logUpdates.push(`   - [RESULT] Deposit Mismatch -> ${bagStatus}`);
        
        palletStatus = `✅ תואם (0)`;
        logUpdates.push(`   - Pallets (משטחים) calculation: No heavy pallets needed. Match -> ${palletStatus}`);
      } else {
        // Rami Levy
        // Total heavy items: 12 (mement) + 8 (tiah) = 20 heavy items.
        // Required pallets = ceil(20 / 10) = 2
        // SKU 60060 quantity is 2
        const totalHeavy = 20;
        const reqPallets = Math.ceil(totalHeavy / 10); // 2
        const depositQty = 2;
        palletStatus = `✅ תואם (${depositQty})`;
        
        logUpdates.push(`   - Pallets (משטחים) calculation: Found 20 heavy bags (שק / 25 ק"ג) in items.`);
        logUpdates.push(`   - Calculated required pallets: ceil(20 / 10) = 2.`);
        logUpdates.push(`   - Found SKU [60060] (משטח סבן פקדון) with quantity: 2.`);
        logUpdates.push(`   - [RESULT] Deposit Compliance matched -> ${palletStatus}`);
        
        bagStatus = `✅ תואם (0)`;
      }

      // Update Order fields & save to Firebase Firestore
      const updatedOrder: Order = {
        ...targetOrder,
        depositStatusBags: bagStatus,
        depositStatusPallets: palletStatus,
        status: 'processing' // update to processing during ingestion sync
      };

      try {
        await saveOrderToFirestore(updatedOrder);
        
        // Save audit log
        const newLog: AuditLogEntry = {
          id: `audit-ingest-${email.linkedOrderNo}-${Date.now()}`,
          orderId: updatedOrder.id,
          orderNumber: updatedOrder.orderNumber,
          customerName: updatedOrder.customerName,
          oldStatus: 'pending',
          newStatus: 'processing',
          timestamp: new Date().toISOString(),
          updatedBy: 'COMAX Ingestion Engine'
        };
        await saveAuditLogToFirestore(newLog);

        logUpdates.push(`[FIREBASE] Synchronized updated order ${email.linkedOrderNo} with Firestore in real-time.`);
        logUpdates.push(`[SUCCESS] Ingestion & Compliance check completed for ${email.linkedOrderNo}.`);
        
        // Mark email as processed
        setEmails(prev => prev.map(em => em.id === email.id ? { ...em, processed: true } : em));
        setProcessingLog([...logUpdates]);
        setIsProcessing(false);
        setSimulationStatus(isHe ? `הזמנה ${email.linkedOrderNo} נקלטה ועודכנה בסטטוס 'בטיפול'!` : `Order ${email.linkedOrderNo} successfully ingested and status set to 'In-Transit'!`);
        
        if (onRefreshOrders) {
          onRefreshOrders();
        }
      } catch (err) {
        logUpdates.push(`[ERROR] Failed to write to Firestore: ${err}`);
        setProcessingLog([...logUpdates]);
        setIsProcessing(false);
      }
    }, 2500);
  };

  // Run bulk Delivery Note PDF split
  const handleSplitDeliveryNote = async (email: SimulatedEmail) => {
    if (email.type !== 'delivery_note') return;

    setIsProcessing(true);
    setProcessingLog([]);
    setActiveConsoleTab('split');

    const logs = [
      `[INFO] Target document: ${email.attachmentName}`,
      `[SPLIT] Initiating multi-page bulk PDF split pipeline...`,
      `[AI] Visual Layout Analysis: Scanning pages for client boundaries...`,
      `[AI] Page 1 detected boundary: customer "שופרסל בע"מ" (החרש 14, תל אביב)`,
      `[AI] Page 2 detected boundary: customer "רמי לוי שיווק השקמה" (עטרות, ירושלים)`,
      `[SPLIT] Creating individual customer delivery documents:`
    ];

    setProcessingLog([...logs]);

    setTimeout(async () => {
      let logUpdates = [...logs];
      
      const noteA = `SBN-10029_delivery_note_split_1.pdf`;
      const noteB = `SBN-10030_delivery_note_split_2.pdf`;

      logUpdates.push(`   - Generated document: ${noteA} (Customer: שופרסל בע"מ)`);
      logUpdates.push(`   - Generated document: ${noteB} (Customer: רמי לוי)`);
      logUpdates.push(`[DRIVE] Archiving documents on Google Drive: /SBN_Logistics/Customer_Archives/`);
      logUpdates.push(`   - Uploaded: /SBN_Logistics/Customer_Archives/שופרסל/2026/${noteA} (ID: gd_file_x902)`);
      logUpdates.push(`   - Uploaded: /SBN_Logistics/Customer_Archives/רמי_לוי/2026/${noteB} (ID: gd_file_z443)`);
      
      // Update linked orders with splitting status
      const orderA = orders.find(o => o.orderNumber === 'SBN-10029');
      const orderB = orders.find(o => o.orderNumber === 'SBN-10030');

      try {
        if (orderA) {
          await saveOrderToFirestore({
            ...orderA,
            splitCompleted: true,
            deliveryDiscrepancy: '⚠️ הפרש כמויות' // Shufersal has a missing bag of sand
          });
        }
        if (orderB) {
          await saveOrderToFirestore({
            ...orderB,
            splitCompleted: true,
            deliveryDiscrepancy: '✅ תואם'
          });
        }

        logUpdates.push(`[FIREBASE] Saved 'splitCompleted: true' back to matched orders in Firestore.`);
        logUpdates.push(`[SUCCESS] Delivery Note bulk split completed. Individual documents archived securely.`);

        setEmails(prev => prev.map(em => em.id === email.id ? { ...em, processed: true } : em));
        setProcessingLog([...logUpdates]);
        setIsProcessing(false);
        setSimulationStatus(isHe ? `תעודות המשלוח פוצלו ונשמרו ב-Google Drive בהצלחה!` : `Delivery Notes split and archived to Google Drive successfully!`);

        if (onRefreshOrders) {
          onRefreshOrders();
        }
      } catch (err) {
        logUpdates.push(`[ERROR] Save to database failed: ${err}`);
        setProcessingLog([...logUpdates]);
        setIsProcessing(false);
      }
    }, 2800);
  };

  // Run the Crane Telemetry & Signature Validation Pipeline
  const handleRunValidationPipeline = async (email: SimulatedEmail) => {
    if (email.type !== 'ituran') return;

    setIsProcessing(true);
    setProcessingLog([]);
    setActiveConsoleTab('validation');

    const isAli = email.body.includes('עלי');
    const targetOrderNo = isAli ? 'SBN-10029' : 'SBN-10030';
    const driverName = isAli ? 'עלי' : 'יוסף';

    const logs = [
      `[TELEMETRY] Initiating Ituran GPS PTO (Power Take-Off) correlation pipeline...`,
      `[INFO] Processing Ituran Crane Activation Email: ${email.subject}`,
      `[AI] Extracting GPS logs and Crane status:`,
      `   - Driver/Vehicle: ${driverName} (${isAli ? '72-911-33' : '88-302-14'})`,
      `   - Coordinates: ${isAli ? '32.0853, 34.7818' : '31.8540, 35.2105'}`,
      `   - Signal: PTO turned ON`,
      `[CORRELATION] Searching matching pending/processing deliveries in radius...`,
      `   - Found target Order: ${targetOrderNo}`
    ];

    setProcessingLog([...logs]);

    setTimeout(async () => {
      let logUpdates = [...logs];
      const targetOrder = orders.find(o => o.orderNumber === targetOrderNo);

      if (!targetOrder) {
        logUpdates.push(`[WARN] Target order ${targetOrderNo} not found in active database.`);
        setProcessingLog([...logUpdates]);
        setIsProcessing(false);
        return;
      }

      // Calculate distance between Ituran Coordinates and Delivery Address coordinates
      // Since we matched coordinates exactly in mock, we'll confirm 100m geofence validity
      logUpdates.push(`[GPS] Geofence verified: Truck coordinates are within 45 meters of customer address.`);
      logUpdates.push(`[TIME] Chronological Match: PTO active window matches estimated delivery timestamp.`);
      logUpdates.push(`[RESULT] Crane Validation: 🏗️ פריקת מנוף מאושרת (Duration: ${isAli ? 18 : 25} mins)`);

      // Signature Vision AI Simulation
      logUpdates.push(`[VISION AI] Analyzing Split Delivery Note PDF signature block...`);
      logUpdates.push(`   - Document: SBN_${targetOrderNo}_delivery_note.pdf`);
      logUpdates.push(`   - Vision AI output: Handwritten signature / customer stamp DETECTED on receipt section.`);
      logUpdates.push(`   - Signature check: ✍️ חתום (Verified)`);

      try {
        await saveOrderToFirestore({
          ...targetOrder,
          driverName: driverName,
          signatureDetected: true,
          ptoCorrelated: true,
          ptoDuration: isAli ? 18 : 25,
          status: 'delivered' // Auto-deliver upon crane and signature validation!
        });

        // Add Audit Log
        const newLog: AuditLogEntry = {
          id: `audit-validation-${targetOrderNo}-${Date.now()}`,
          orderId: targetOrder.id,
          orderNumber: targetOrder.orderNumber,
          customerName: targetOrder.customerName,
          oldStatus: 'processing',
          newStatus: 'delivered',
          timestamp: new Date().toISOString(),
          updatedBy: 'Ituran Telemetry Engine'
        };
        await saveAuditLogToFirestore(newLog);

        logUpdates.push(`[FIREBASE] Saved 'signatureDetected: true', 'ptoCorrelated: true', and 'status: delivered' to Firestore.`);
        logUpdates.push(`[SUCCESS] Delivery verified with Crane telemetry & client signature successfully!`);

        setEmails(prev => prev.map(em => em.id === email.id ? { ...em, processed: true } : em));
        setProcessingLog([...logUpdates]);
        setIsProcessing(false);
        setSimulationStatus(isHe 
          ? `המשלוח להזמנה ${targetOrderNo} אושר ונמסר בהצלחה באמצעות אימות מנוף איתוראן וחתימה!` 
          : `Delivery for ${targetOrderNo} verified and delivered successfully via Ituran crane PTO telemetry and signature validation!`
        );

        if (onRefreshOrders) {
          onRefreshOrders();
        }
      } catch (err) {
        logUpdates.push(`[ERROR] Save to Firestore failed: ${err}`);
        setProcessingLog([...logUpdates]);
        setIsProcessing(false);
      }
    }, 2500);
  };

  const handleResetSimulator = () => {
    setEmails(prev => prev.map(em => ({ ...em, processed: false })));
    setSimulationStatus(isHe ? 'הסימולטור אופס מחדש בהצלחה!' : 'Simulator reset successfully!');
  };

  const currentOrderForValidation = orders.find(o => o.orderNumber === selectedOrderNoForValidation);
  const depositBags = currentOrderForValidation?.depositStatusBags || '';
  const depositPallets = currentOrderForValidation?.depositStatusPallets || '';
  const deliveryDiscrepancy = currentOrderForValidation?.deliveryDiscrepancy || '';

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 min-h-[600px] text-slate-800 dark:text-slate-100 font-sans" dir={isHe ? 'rtl' : 'ltr'}>
      
      {/* 1. GMAIL INBOX FEED (Left Column - Span 5) */}
      <div className="xl:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col overflow-hidden">
        {/* Inbox Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/40">
              <Mail className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight text-slate-800 dark:text-slate-200">
                comax.sbn@gmail.com
              </h3>
              <p className="text-[10px] text-slate-400 font-medium">
                {isHe ? 'תיבת סנכרון ואינטגרציה לוגיסטית' : 'Logistics Ingestion Mailbox'}
              </p>
            </div>
          </div>
          <button
            id="reset-simulator-btn"
            onClick={handleResetSimulator}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-xs"
            title={isHe ? 'אפס סימולטור' : 'Reset Simulator'}
          >
            <RotateCcw className="h-3 w-3 text-slate-400" />
            <span>{isHe ? 'איפוס' : 'Reset'}</span>
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-slate-100 dark:border-slate-800/60 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder={isHe ? 'חיפוש במיילים נכנסים...' : 'Search incoming emails...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 text-xs rounded-lg border border-slate-200 dark:border-slate-800 py-2 pl-3 pr-9 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Email Feed List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 max-h-[480px]">
          {filteredEmails.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <Mail className="h-8 w-8 mx-auto mb-2 text-slate-300" />
              <p className="text-xs">{isHe ? 'לא נמצאו מיילים תואמים' : 'No matching emails found'}</p>
            </div>
          ) : (
            filteredEmails.map((email) => {
              const isSelected = selectedEmail?.id === email.id;
              return (
                <div
                  key={email.id}
                  onClick={() => setSelectedEmail(email)}
                  className={`p-4 cursor-pointer transition-all hover:bg-slate-50/80 dark:hover:bg-slate-800/20 flex flex-col gap-1.5 relative ${
                    isSelected ? 'bg-indigo-50/40 dark:bg-indigo-950/10 border-r-4 border-indigo-600' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 tracking-wider">
                      {email.sender}
                    </span>
                    <span className="text-[9px] font-mono text-slate-400">
                      {new Date(email.timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 leading-snug flex items-center gap-1.5">
                    {email.type === 'order' && <FileText className="h-3.5 w-3.5 text-indigo-500 shrink-0" />}
                    {email.type === 'delivery_note' && <Split className="h-3.5 w-3.5 text-blue-500 shrink-0" />}
                    {email.type === 'ituran' && <CloudLightning className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                    <span className="truncate">{email.subject}</span>
                  </h4>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {email.body}
                  </p>

                  <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-slate-50 dark:border-slate-800/40">
                    {email.attachmentName ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-50/70 dark:bg-indigo-950/20 px-2 py-0.5 rounded-full border border-indigo-100/40">
                        <FileText className="h-3 w-3" />
                        <span>{email.attachmentName}</span>
                        <span className="text-slate-400 font-normal">({email.attachmentSize})</span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-medium">
                        {email.type === 'ituran' ? '⚙️ Ituran GPS Log' : '✉️ Text/HTML Body'}
                      </span>
                    )}

                    {email.processed ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-full border border-emerald-100/40">
                        <Check className="h-3 w-3" />
                        <span>{isHe ? 'עובד' : 'Processed'}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded-full border border-amber-100/40">
                        <span>{isHe ? 'ממתין' : 'Pending Ingest'}</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 2. REAL-TIME AI INGESTION & CORRELATION CONSOLE (Right Column - Span 7) */}
      <div className="xl:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col overflow-hidden">
        
        {/* Banner of Status simulation feedback */}
        {simulationStatus && (
          <div className="bg-emerald-50 border-b border-emerald-100 text-emerald-800 px-4 py-2 text-xs flex items-center justify-between font-semibold animate-fade-in" dir={isHe ? 'rtl' : 'ltr'}>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>{simulationStatus}</span>
            </div>
            <button 
              onClick={() => setSimulationStatus(null)}
              className="text-emerald-500 hover:text-emerald-700 font-extrabold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Selected Email Detailed Panel or Instruction */}
        {!selectedEmail ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
            <Cpu className="h-12 w-12 text-indigo-500 mb-3 animate-pulse" />
            <h3 className="text-sm font-black text-slate-700 dark:text-slate-300">
              {isHe ? 'אנא בחר אימייל מהתיבה כדי להתחיל' : 'Please select an email to begin'}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mt-1 leading-relaxed">
              {isHe 
                ? 'בחר מייל הזמנה מקומאקס, תעודת משלוח משולבת או קובץ איתוראן כדי להפעיל את מנוע ה-AI והטלמטריה בזמן אמת.' 
                : 'Select a Comax order, delivery note or Ituran GPS log to trigger real-time AI compliance and telemetry correlations.'}
            </p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Active Email Title */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/10">
              <div className="flex items-center justify-between mb-2">
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider ${
                  selectedEmail.type === 'order' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                  selectedEmail.type === 'delivery_note' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                  'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  {selectedEmail.type}
                </span>
                <span className="text-xs text-slate-400 font-medium font-mono">
                  Received: {new Date(selectedEmail.timestamp).toLocaleString('he-IL')}
                </span>
              </div>
              <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 leading-snug">
                {selectedEmail.subject}
              </h2>
            </div>

            {/* Ingestion & Split Tabs */}
            <div className="flex border-b border-slate-100 dark:border-slate-800 text-xs">
              <button
                onClick={() => setActiveConsoleTab('ingestion')}
                className={`flex-1 py-3 text-center font-bold border-b-2 transition-colors ${
                  activeConsoleTab === 'ingestion'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-slate-50/40 dark:bg-slate-800/10'
                    : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50/20'
                }`}
              >
                {isHe ? 'קליטת הזמנה ופקדונות' : 'Order Ingestion & Deposits'}
              </button>
              <button
                onClick={() => setActiveConsoleTab('split')}
                className={`flex-1 py-3 text-center font-bold border-b-2 transition-colors ${
                  activeConsoleTab === 'split'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-slate-50/40 dark:bg-slate-800/10'
                    : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50/20'
                }`}
              >
                {isHe ? 'פיצול תעודות והפרשים' : 'PDF Split & Discrepancies'}
              </button>
              <button
                onClick={() => setActiveConsoleTab('validation')}
                className={`flex-1 py-3 text-center font-bold border-b-2 transition-colors ${
                  activeConsoleTab === 'validation'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-slate-50/40 dark:bg-slate-800/10'
                    : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50/20'
                }`}
              >
                {isHe ? 'אימות חתימה ואיתוראן' : 'Signature & Crane Correlator'}
              </button>
            </div>

            {/* Tab Workspace Contents */}
            <div className="flex-1 p-5 overflow-y-auto space-y-6">
              
              {/* TAB 1: ORDER INGESTION & DEPOSIT COMPLIANCE */}
              {activeConsoleTab === 'ingestion' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/60 dark:bg-slate-800/20">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Cpu className="h-3.5 w-3.5 text-indigo-500" />
                      {isHe ? 'זיהוי וחלוקת פקדונות ממוחשבת קומאקס' : 'COMAX Deterministic Deposit Compliance Logic'}
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {isHe 
                        ? 'המערכת סורקת פריטי הזמנה ומחשבת אוטומטית פקדונות נדרשים:'
                        : 'Analyzes item arrays and computes required deposits based on rigid business rules:'}
                    </p>
                    <ul className="mt-2 space-y-1.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed pl-1">
                      <li className="flex items-start gap-1.5">
                        <span className="text-indigo-500 mt-0.5">📦</span>
                        <div>
                          <strong>{isHe ? 'שקי ענק (בלות):' : 'Bags (בלות):'}</strong>{' '}
                          {isHe 
                            ? 'חיבור כל הפריטים המכילים "שק גדול". נדרש חיוב תואם במקביל עבור מק"ט פקדון [60002] (שק גדול פקדון).'
                            : 'Sum quantities of items containing "שק גדול". Compares against deposit SKU [60002].'}
                        </div>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-indigo-500 mt-0.5">🪵</span>
                        <div>
                          <strong>{isHe ? 'משטחי עץ סבן:' : 'Wood Pallets:'}</strong>{' '}
                          {isHe
                            ? 'חיבור כל פריטי השקים הכבדים (מכילים "שק" או "25 ק"ג"). כמות המשטחים הנדרשת מחושבת לפי נוסחה: ceil(סה"כ פריטים / 10). נדרש חיוב במק"ט פקדון [60060].'
                            : 'Sum quantities of heavy item SKU containing "שק" or "25 ק"ג". Required Pallets = ceil(TotalHeavyItems / 10). Matches against deposit SKU [60060].'}
                        </div>
                      </li>
                    </ul>
                  </div>

                  {/* Trigger Pipeline Action */}
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-500">
                      {selectedEmail.type === 'order' ? (
                        <span className="text-emerald-600 font-semibold flex items-center gap-1">
                          <Check className="h-3.5 w-3.5" />
                          {isHe ? 'המייל מכיל קובץ הזמנה תקין לקליטה' : 'Email contains valid Comax Order PDF'}
                        </span>
                      ) : (
                        <span className="text-amber-600 font-semibold flex items-center gap-1">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {isHe ? 'לצורך קליטת הזמנה מומלץ לבחור מייל מסוג הזמנה' : 'For ingestion, select an Order email'}
                        </span>
                      )}
                    </div>
                    <button
                      id="run-ingestion-btn"
                      onClick={() => handleIngestOrder(selectedEmail)}
                      disabled={isProcessing}
                      className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black py-2.5 px-4 rounded-xl shadow-md shadow-indigo-500/10 cursor-pointer disabled:opacity-50 transition-all"
                    >
                      {isProcessing ? (
                        <>
                          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          <span>{isHe ? 'מנתח קובץ קומאקס...' : 'Analyzing COMAX PDF...'}</span>
                        </>
                      ) : (
                        <>
                          <Play className="h-3.5 w-3.5 fill-current" />
                          <span>{isHe ? 'הפעלת מפענח קומאקס וחישוב פקדונות' : 'Run Ingestion & Deposit Pipeline'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: PDF SPLITTING & QUANTITY DISCREPANCY */}
              {activeConsoleTab === 'split' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/60 dark:bg-slate-800/20 space-y-2.5">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Split className="h-3.5 w-3.5 text-blue-500" />
                      {isHe ? 'מנגנון פיצול תעודות משולבות והפרש כמויות' : 'Combined PDF Splitting & Discrepancies'}
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {isHe 
                        ? 'נהגים חוזרים עם קובץ PDF המרכז מספר לקוחות יחד. המערכת מפצלת אותם למסמכים נפרדים, מגבה בתיקיית הלקוח המתאימה ב-Google Drive, ומשווה את הכמות שסופקה בפועל מול הזמנת המקור:'
                        : 'Splits bulk combined driver receipts, uploads individual customer notes to Drive, and highlights physical vs ordered inventory mismatches:'}
                    </p>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                        <span className="font-bold text-slate-600 dark:text-slate-300">SBN-10029 (שופרסל)</span>
                        <div className="text-[10px] text-slate-400 mt-1">
                          {isHe ? 'הוזמן: 5 שקי חול, 3 חצץ' : 'Ordered: 5 sand, 3 gravel'}
                        </div>
                        <div className="text-[10px] text-rose-500 font-bold mt-0.5">
                          {isHe ? 'סופק: 4 שקי חול (נרשם ידנית)' : 'Note says: 4 sand (Handwritten)'}
                        </div>
                        <div className="text-[10px] bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded-full mt-1.5 inline-block font-bold">
                          ⚠️ הפרש כמויות
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                        <span className="font-bold text-slate-600 dark:text-slate-300">SBN-10030 (רמי לוי)</span>
                        <div className="text-[10px] text-slate-400 mt-1">
                          {isHe ? 'הוזמן: 12 מלט, 8 טיח' : 'Ordered: 12 cement, 8 plaster'}
                        </div>
                        <div className="text-[10px] text-emerald-500 font-bold mt-0.5">
                          {isHe ? 'סופק: 12 מלט, 8 טיח (זהה)' : 'Delivered: 12 cement, 8 plaster (Identical)'}
                        </div>
                        <div className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full mt-1.5 inline-block font-bold">
                          ✅ תואם
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Trigger Action */}
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-500">
                      {selectedEmail.type === 'delivery_note' ? (
                        <span className="text-emerald-600 font-semibold flex items-center gap-1">
                          <Check className="h-3.5 w-3.5" />
                          {isHe ? 'קובץ תעודות משלוח מוכן לפיצול' : 'Combined delivery receipt ready'}
                        </span>
                      ) : (
                        <span className="text-amber-600 font-semibold flex items-center gap-1">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {isHe ? 'מומלץ לבחור מייל תעודות משלוח משולב' : 'Select a delivery note email'}
                        </span>
                      )}
                    </div>
                    <button
                      id="run-splitting-btn"
                      onClick={() => handleSplitDeliveryNote(selectedEmail)}
                      disabled={isProcessing}
                      className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black py-2.5 px-4 rounded-xl shadow-md shadow-indigo-500/10 cursor-pointer disabled:opacity-50 transition-all"
                    >
                      {isProcessing ? (
                        <>
                          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          <span>{isHe ? 'מפצל PDF ומאבחן הפרשים...' : 'Splitting & checking PDF...'}</span>
                        </>
                      ) : (
                        <>
                          <Play className="h-3.5 w-3.5 fill-current" />
                          <span>{isHe ? 'הפעלת פיצול והשוואת כמויות' : 'Run PDF Split & Discrepancy Engine'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: SIGNATURE & PTO CRANE TELEMETRY CORRELATION */}
              {activeConsoleTab === 'validation' && (
                <div className="space-y-4 animate-fade-in">
                  
                  {/* Validation side by side panel specs */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Visual signature detection */}
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50/40 dark:bg-slate-950/20">
                      <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <FileSignature className="h-3.5 w-3.5 text-indigo-500" />
                        {isHe ? 'זיהוי חתימה דיגיטלי (Vision AI)' : 'Vision AI Signature & Stamp'}
                      </h4>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        {isHe 
                          ? 'המערכת סורקת את קובץ ה-PDF המפוצל או ה-JPG ומזהה חותמות של מנהל עבודה או חתימה בכתב יד.'
                          : 'Scans the split delivery note receipt and detects handwritten signature / foreman stamps.'}
                      </p>
                      <div className="mt-3.5 h-20 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg flex items-center justify-center relative overflow-hidden group">
                        <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-indigo-50 text-[8px] font-black text-indigo-600 border border-indigo-100">
                          SCAN AREA
                        </div>
                        <div className="text-center">
                          <span className="text-xs text-slate-300 dark:text-slate-600 font-semibold font-mono border-2 border-dashed border-slate-200 dark:border-slate-800 p-2.5 rounded-lg">
                            {isHe ? '✍️ זיהוי חתימה מופעל' : '✍️ Handwriting Scanner Live'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Ituran PTO specs */}
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50/40 dark:bg-slate-950/20">
                      <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <Truck className="h-3.5 w-3.5 text-blue-500" />
                        {isHe ? 'הצלבת מנוף איתוראן (PTO)' : 'Ituran GPS PTO Correlation'}
                      </h4>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        {isHe 
                          ? 'קליטת אירוע PTO ON מאיתוראן ומעקב אחר פריקת הסחורה עם המנוף בטווח 100 מטר מכתובת הלקוח.'
                          : 'Correlates Ituran PTO ON alerts inside a 100m geofence at client address to confirm crane unloading.'}
                      </p>
                      <div className="mt-3.5 h-20 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg flex items-center justify-center text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-[10px] font-bold text-emerald-600">GEOFENCE COORD OK</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Trigger Action */}
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-500">
                      {selectedEmail.type === 'ituran' ? (
                        <span className="text-emerald-600 font-semibold flex items-center gap-1">
                          <Check className="h-3.5 w-3.5" />
                          {isHe ? 'התראת איתוראן מוכנה להצלבה' : 'Ituran alert ready for correlation'}
                        </span>
                      ) : (
                        <span className="text-amber-600 font-semibold flex items-center gap-1">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {isHe ? 'בחר מייל איתוראן כדי להצליב משלוח ומנוף' : 'Select an Ituran log to correlate'}
                        </span>
                      )}
                    </div>
                    <button
                      id="run-validation-btn"
                      onClick={() => handleRunValidationPipeline(selectedEmail)}
                      disabled={isProcessing}
                      className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black py-2.5 px-4 rounded-xl shadow-md shadow-indigo-500/10 cursor-pointer disabled:opacity-50 transition-all"
                    >
                      {isProcessing ? (
                        <>
                          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          <span>{isHe ? 'מצליב נתוני GPS ומזהה חתימה...' : 'Correlating GPS & checking signature...'}</span>
                        </>
                      ) : (
                        <>
                          <Play className="h-3.5 w-3.5 fill-current" />
                          <span>{isHe ? 'הפעלת אימות מנוף איתוראן וחתימה' : 'Correlate Telemetry & Signatures'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* LOGS TERMINAL CONTAINER (Always Visible when processing or logs exist) */}
              {(isProcessing || processingLog.length > 0) && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Cpu className="h-3.5 w-3.5 text-indigo-500" />
                    {isHe ? 'לוג הרצה ואימות בזמן אמת של מנועי ה-AI' : 'Real-Time AI Pipeline Run-Logs'}
                  </h4>
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-[11px] text-slate-300 space-y-1.5 max-h-[220px] overflow-y-auto shadow-inner text-left" dir="ltr">
                    {processingLog.map((logLine, idx) => {
                      let textColor = 'text-slate-300';
                      if (logLine.includes('[SUCCESS]')) textColor = 'text-emerald-400 font-bold';
                      if (logLine.includes('[ERROR]')) textColor = 'text-rose-400 font-bold';
                      if (logLine.includes('[AI]')) textColor = 'text-indigo-400';
                      if (logLine.includes('[VISION')) textColor = 'text-purple-400';
                      if (logLine.includes('[TELEMETRY]')) textColor = 'text-sky-400';
                      if (logLine.includes('[CALC]')) textColor = 'text-amber-400';
                      if (logLine.includes('❌')) textColor = 'text-rose-400 font-medium';
                      if (logLine.includes('✅')) textColor = 'text-emerald-400 font-medium';
                      
                      return (
                        <div key={idx} className={`${textColor} leading-relaxed`}>
                          {logLine}
                        </div>
                      );
                    })}
                    {isProcessing && (
                      <div className="text-indigo-400 font-bold animate-pulse flex items-center gap-2 mt-1">
                        <span>●</span>
                        <span>{isHe ? 'מריץ פעולות סימולציה...' : 'AI agents executing pipelines...'}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* REAL-TIME VALIDATION CHECKLIST & DISCREPANCY CONSOLE */}
              {currentOrderForValidation && (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/20 dark:bg-slate-950/20 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldAlert className="h-4 w-4 text-indigo-500" />
                      {isHe ? `קונסולת בקרה ואימות: הזמנה ${currentOrderForValidation.orderNumber}` : `Audit Console: Order ${currentOrderForValidation.orderNumber}`}
                    </h3>
                    <select
                      value={selectedOrderNoForValidation}
                      onChange={(e) => setSelectedOrderNoForValidation(e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700 cursor-pointer shadow-xs focus:outline-none"
                    >
                      {orders.map(o => (
                        <option key={o.id} value={o.orderNumber}>
                          {o.orderNumber} - {translate(o.customerName, lang)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    
                    {/* Item A: Deposit Verification */}
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
                      <span className="font-bold text-slate-400 text-[10px] uppercase tracking-wider block">
                        💰 {isHe ? 'בקרת הפקדת פקדונות' : 'Deposit Compliance'}
                      </span>
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-500">{isHe ? 'שקי בלות פקדון:' : 'Bags Deposit:'}</span>
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            depositBags.includes('❌') 
                              ? 'bg-rose-50 text-rose-700 border border-rose-100' 
                              : (depositBags ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-100 text-slate-500')
                          }`}>
                            {depositBags || (isHe ? 'טרם נבדק' : 'Not Ingested')}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-500">{isHe ? 'משטחי עץ פקדון:' : 'Pallets Deposit:'}</span>
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            depositPallets.includes('❌') 
                              ? 'bg-rose-50 text-rose-700 border border-rose-100' 
                              : (depositPallets ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-100 text-slate-500')
                          }`}>
                            {depositPallets || (isHe ? 'טרם נבדק' : 'Not Ingested')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Item B: Delivery Discrepancies */}
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
                      <span className="font-bold text-slate-400 text-[10px] uppercase tracking-wider block">
                        📊 {isHe ? 'התאמת פריטים (הפרשים)' : 'Delivery Discrepancies'}
                      </span>
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-500">{isHe ? 'תעודה פוצלה:' : 'Split Completed:'}</span>
                          <span className={`font-bold text-[10px] ${currentOrderForValidation.splitCompleted ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {currentOrderForValidation.splitCompleted ? (isHe ? 'כן' : 'Yes') : (isHe ? 'לא' : 'No')}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-500">{isHe ? 'סטטוס כמויות:' : 'Discrepancy Stat:'}</span>
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            deliveryDiscrepancy.includes('⚠️') 
                              ? 'bg-rose-50 text-rose-700 border border-rose-100' 
                              : (deliveryDiscrepancy ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-100 text-slate-500')
                          }`}>
                            {deliveryDiscrepancy || (isHe ? 'טרם הושווה' : 'Awaiting receipt')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Item C: Telemetry & Signature */}
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
                      <span className="font-bold text-slate-400 text-[10px] uppercase tracking-wider block">
                        🏗️ {isHe ? 'איתוראן וחתימה' : 'Telemetry & Signature'}
                      </span>
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-500">{isHe ? 'זיהוי חתימה:' : 'Signature:'}</span>
                          <span className={`font-bold text-[10px] ${currentOrderForValidation.signatureDetected ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {currentOrderForValidation.signatureDetected ? '✍️ החתימה זוהתה' : (isHe ? 'לא זוהה' : 'Not detected')}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-500">{isHe ? 'אימות מנוף איתוראן:' : 'Ituran PTO Sync:'}</span>
                          <span className={`font-bold text-[10px] ${currentOrderForValidation.ptoCorrelated ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {currentOrderForValidation.ptoCorrelated 
                              ? `🏗️ פריקה מאושרת (${currentOrderForValidation.ptoDuration || 18} דק)` 
                              : (isHe ? 'לא מופעל' : 'Not correlated')}
                          </span>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              )}

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
