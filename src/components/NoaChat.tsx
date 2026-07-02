import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Order } from '../types';
import { Send, CheckCheck, Smile, Paperclip, MoreVertical, Phone, Video, RefreshCw, AlertCircle, MapPin, Clipboard } from 'lucide-react';

interface NoaChatProps {
  orders: Order[];
  lang: 'he' | 'en';
  onSelectOrderNumber?: (orderNumber: string | null) => void;
}

interface Message {
  id: string;
  sender: 'noa' | 'user';
  text: string;
  timestamp: string;
  isRead?: boolean;
  highlightOrder?: string; // If this message references a specific order number
}

export default function NoaChat({ orders, lang, onSelectOrderNumber }: NoaChatProps) {
  const isHe = lang === 'he';
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'noa',
      text: isHe
        ? 'שלום! אני נועה, העוזרת הלוגיסטית החכמה שלך. 🚚\nאני מסונכרנת בזמן אמת עם מאגר ההזמנות ב-SabanOS ויכולה לענות לך על סטטוסים של הזמנות, זמני הפצה, מלאי מחסנים ועיכובים.\n\nאיך אוכל לעזור לך היום?'
        : 'Hello! I am Noa, your smart logistics assistant. 🚚\nI am synchronized in real-time with the SabanOS orders database and can answer questions about statuses, deliveries, warehouse logs, and delays.\n\nHow can I help you today?',
      timestamp: getFormattedTime(),
      isRead: true
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  function getFormattedTime() {
    const d = new Date();
    return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  }

  // Get a real order number from the active database to show as a clickable dynamic suggestion pill!
  const suggestedOrderNum = useMemo(() => {
    if (orders && orders.length > 0) {
      // Prioritize pending or processing orders for better contextual demonstration
      const active = orders.find(o => o.status === 'pending' || o.status === 'processing');
      if (active) return active.orderNumber;
      return orders[0].orderNumber;
    }
    return '6213944';
  }, [orders]);

  // Handle send message
  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim()) return;
    
    const userMsgId = `user-${Date.now()}`;
    const userMsgText = textToSend.trim();
    
    // Append user message
    const userMessage: Message = {
      id: userMsgId,
      sender: 'user',
      text: userMsgText,
      timestamp: getFormattedTime(),
      isRead: true
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);
    setChatError(null);

    // AI Response generation (calls server or falls back to intelligent rule-based parsing)
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsgText, orders })
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.text) {
          addNoaMessage(data.text);
          setIsTyping(false);
          return;
        }
      }
      
      // Fallback to our offline/rule-based smart matching engine if the server call fails or has no key
      setTimeout(() => {
        const responseText = processLocalLogisticsQuery(userMsgText);
        addNoaMessage(responseText);
        setIsTyping(false);
      }, 800);

    } catch (err) {
      console.warn("AI Chat request failed, using intelligent rule-based fallback response", err);
      setTimeout(() => {
        const responseText = processLocalLogisticsQuery(userMsgText);
        addNoaMessage(responseText);
        setIsTyping(false);
      }, 800);
    }
  };

  const addNoaMessage = (text: string) => {
    // Check if the response mentions a specific order number in the database so we can add an interactive map action button
    const matchedNum = findOrderNumberInText(text);
    
    setMessages(prev => [
      ...prev,
      {
        id: `noa-${Date.now()}`,
        sender: 'noa',
        text,
        timestamp: getFormattedTime(),
        isRead: true,
        highlightOrder: matchedNum || undefined
      }
    ]);
  };

  const findOrderNumberInText = (text: string): string | null => {
    // Look for patterns like #12345 or # 12345 or just digits matching actual orders
    const regex = /#\s*(\d+)/;
    const match = text.match(regex);
    if (match && match[1]) {
      const num = match[1];
      // Verify if it exists in our orders list
      if (orders.some(o => o.orderNumber === num)) {
        return num;
      }
    }
    
    // Direct lookup of any number in text
    const words = text.replace(/[#,.:;!?]/g, ' ').split(/\s+/);
    for (const w of words) {
      if (/^\d+$/.test(w) && w.length >= 4) {
        if (orders.some(o => o.orderNumber === w)) {
          return w;
        }
      }
    }
    return null;
  };

  // Safe Hebrew Local Logistics Rule-based Brain (guarantees offline functionality + exact data lookup)
  const processLocalLogisticsQuery = (msg: string): string => {
    const text = msg.toLowerCase().trim();
    
    // 1. Specific Order Status Lookup e.g., "Where is order #6213944?" or "איפה הזמנה #6213944"
    const orderNumberMatch = text.match(/\d+/);
    if (orderNumberMatch) {
      const extractedNum = orderNumberMatch[0];
      const foundOrder = orders.find(o => o.orderNumber === extractedNum);
      
      if (foundOrder) {
        const statusTranslations = {
          pending: 'ממתינה לטעינה (Pending)',
          processing: 'בטיפול והכנה במחסן (Processing)',
          delivered: 'סופקה בהצלחה ליעד (Delivered)',
          cancelled: 'בוטלה במערכת (Cancelled)'
        };
        const statusText = statusTranslations[foundOrder.status] || foundOrder.status;
        
        // Hide/mask financial data for privacy requirement!
        return `🔍 מצאתי את הזמנה מספר *#${foundOrder.orderNumber}* עבור הלקוח *${foundOrder.customerName}*.\n\n` +
               `📍 *סטטוס:* ${statusText}\n` +
               `🏭 *מחסן מקור:* ${foundOrder.warehouse}\n` +
               `🏠 *כתובת למשלוח:* ${foundOrder.deliveryAddress}\n` +
               `📦 *תכולה:* ${foundOrder.items?.map(i => `${i.name} (x${i.quantity})`).join(', ') || 'אין פירוט פריטים'}\n` +
               `📅 *תאריך עדכון:* ${new Date(foundOrder.timestamp).toLocaleString('he-IL')}\n\n` +
               `⚠️ *אבטחת מידע:* ערך הזמנה זה מוסתר מטעמי סודיות תפעולית (₪***).\n` +
               `לחץ על הכפתור למטה כדי למקם ולהדגיש את המשלוח בלוח הסידור.`;
      }
    }

    // 2. Global status briefing
    if (text.includes('סטטוס') || text.includes('מצב') || text.includes('brief') || text.includes('status')) {
      const activeCount = orders.filter(o => o.status !== 'cancelled').length;
      const delivered = orders.filter(o => o.status === 'delivered').length;
      const pending = orders.filter(o => o.status === 'pending').length;
      const processing = orders.filter(o => o.status === 'processing').length;
      return `📊 *ריכוז סטטוס משלוחים בסידור הנוכחי:*\n\n` +
             `• סה"כ הזמנות פעילות: *${activeCount}*\n` +
             `• סופקו בהצלחה: *${delivered}* ✅\n` +
             `• ממתינים לטעינה: *${pending}* ⏳\n` +
             `• בטיפול מחסן: *${processing}* ⚙️\n\n` +
             `רוצה שאפיק עבורך דוח בוקר לוגיסטי מלא להעתקה קלה לוואטסאפ? הקלד "דוח בוקר" או לחץ על הכפתור המתאים.`;
    }

    // 3. Delayed/critical issues
    if (text.includes('חריג') || text.includes('עיכוב') || text.includes('בעיה') || text.includes('delay') || text.includes('issue')) {
      const delays = orders.filter(o => o.notes && (o.notes.includes('עיכוב') || o.notes.includes('דחוף') || o.notes.toLowerCase().includes('delay')));
      if (delays.length > 0) {
        let response = `⚠️ *זיהיתי את המשלוחים הבאים עם הערות עיכוב או דחיפות:*\n\n`;
        delays.forEach(d => {
          response += `• הזמנה *#${d.orderNumber}* (${d.customerName}) - הערה: _"${d.notes}"_\n`;
        });
        return response;
      } else {
        return `✅ מעולה! לא נמצאו עיכובים או משלוחים חריגים הרשומים בסידור כרגע. כל המשלוחים מתקדמים לפי לוח הזמנים המתוכנן.`;
      }
    }

    // 4. Warehouse loading distributions
    if (text.includes('מחסן') || text.includes('מלאי') || text.includes('warehouse') || text.includes('stock')) {
      const charashCount = orders.filter(o => {
        const wh = o.warehouse || '';
        return wh.includes('החרש') && o.status !== 'cancelled';
      }).length;
      const talmidCount = orders.filter(o => {
        const wh = o.warehouse || '';
        return wh.includes('התלמיד') && o.status !== 'cancelled';
      }).length;
      return `🏭 *עומס המשלוחים הנוכחי במחסני המקור (הזמנות פעילות):*\n\n` +
             `1️⃣ *מחסן החרש:* מנהל כרגע *${charashCount}* משלוחי הפצה פעילים.\n` +
             `2️⃣ *מחסן התלמיד:* מנהל כרגע *${talmidCount}* משלוחי הפצה פעילים.\n\n` +
             `העומס מבוזר בצורה מיטבית לפי פריסת נהגי החלוקה והאזורים הגיאוגרפיים.`;
    }

    // 5. Morning briefing request
    if (text.includes('בוקר') || text.includes('דוח') || text.includes('briefing') || text.includes('report')) {
      return `📋 מצוין! דוח הבוקר הלוגיסטי מוכן ומעודכן בזמן אמת.\nתוכל למצוא אותו בכל עת תחת כרטיסיית "דוח בוקר" שלצידי או פשוט להעתיק את הגרסה המקוצרת הזו:\n\n` +
             `*דוח בוקר לוגיסטי* 📦\n` +
             `סה"כ משלוחים: ${orders.length}\n` +
             `סופקו: ${orders.filter(o => o.status === 'delivered').length}\n` +
             `בטיפול/המתנה: ${orders.filter(o => o.status === 'pending' || o.status === 'processing').length}\n\n` +
             `לגרסה מלאה, מעוצבת ומאובטחת הכוללת כפתור העתקה מהירה לוואטסאפ של הנהגים, עבור לכרטיסיית "דוח בוקר לוגיסטי" למעלה!`;
    }

    // Default polite/helpful logistics response
    return `אני מבינה. כעוזרת הלוגיסטית של SabanOS, אני יכולה לעזור לך למצוא פרטי הזמנה ספציפיים, לבדוק זמני הגעה של רכבים, עומס במחסנים ועוד.\n\n` +
           `*נסה לשאול אותי לדוגמה:*\n` +
           `• "איפה הזמנה מספר #${suggestedOrderNum}?"\n` +
           `• "האם יש משלוחים חריגים או מעוכבים?"\n` +
           `• "מה עומס העבודה כרגע במחסנים?"`;
  };

  const selectSuggestedPrompt = (prompt: string) => {
    setInput(prompt);
  };

  return (
    <div id="noa-ai-chat-container" className="h-full flex flex-col bg-[#efeae2] rounded-xl border border-slate-200 overflow-hidden shadow-sm font-sans" style={{ backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')", backgroundBlendMode: 'overlay', backgroundColor: '#efeae2' }}>
      {/* WhatsApp header bar */}
      <div className="bg-[#00a884] text-white px-4 py-3 flex items-center justify-between shadow-sm shrink-0 select-none">
        <div className="flex items-center gap-3">
          {/* Avatar container */}
          <div className="relative">
            <img
              src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=200&auto=format&fit=crop"
              alt="Noa AI Avatar"
              className="h-10 w-10 rounded-full border border-white/20 object-cover"
              referrerPolicy="no-referrer"
            />
            <span className="absolute bottom-0 end-0 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-[#00a884]" />
          </div>

          <div className="text-right">
            <h3 className="font-extrabold text-xs md:text-sm leading-tight">נועה - עוזרת לוגיסטית חכמה</h3>
            <div className="flex items-center gap-1.5 mt-0.5 justify-start">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse"></span>
              <span className="text-[10px] text-emerald-50 font-medium">מחוברת ● Noa AI</span>
            </div>
          </div>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-3.5 text-white/80">
          <button className="hover:text-white transition-colors cursor-pointer"><Video className="h-4.5 w-4.5" /></button>
          <button className="hover:text-white transition-colors cursor-pointer"><Phone className="h-4 w-4" /></button>
          <button className="hover:text-white transition-colors cursor-pointer"><MoreVertical className="h-4.5 w-4.5" /></button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin flex flex-col min-h-0">
        <div className="self-center bg-[#ffeecd] border border-[#ffdca3] text-[#5c4014] text-[10px] font-bold px-3 py-1 rounded-lg text-center shadow-sm mb-2 max-w-[90%]" dir="rtl">
          🔒 ההודעות והמידע מסונכרנים ישירות משרתי SabanOS המאובטחים
        </div>

        {messages.map(msg => {
          const isNoa = msg.sender === 'noa';
          return (
            <div
              key={msg.id}
              className={`flex flex-col max-w-[85%] md:max-w-[70%] ${
                isNoa ? 'self-start' : 'self-end'
              }`}
            >
              {/* Bubble */}
              <div
                dir="rtl"
                className={`relative p-3.5 rounded-2xl text-xs md:text-sm leading-relaxed shadow-sm ${
                  isNoa
                    ? 'bg-white text-slate-800 rounded-tl-none border border-slate-200/50'
                    : 'bg-[#d9fdd3] text-slate-800 rounded-tr-none border border-emerald-100/40'
                }`}
              >
                {/* Text */}
                <span className="whitespace-pre-wrap block font-medium font-sans">{msg.text}</span>

                {/* Footer details in bubble */}
                <div className="flex items-center justify-end gap-1 mt-1 text-[9px] text-slate-400 font-bold select-none">
                  <span>{msg.timestamp}</span>
                  {!isNoa && <CheckCheck className="h-3 w-3 text-blue-500 shrink-0" />}
                </div>

                {/* Optional Map Highlights CTA inside Noa's reply bubble */}
                {msg.highlightOrder && (
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-2">
                    <button
                      onClick={() => onSelectOrderNumber?.(msg.highlightOrder || null)}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-600 border border-blue-100 rounded-lg py-1.5 px-2.5 text-[10px] font-black transition-all cursor-pointer shadow-sm text-center"
                    >
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span>הצג והדגש בלוח הסידור ➔</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isTyping && (
          <div className="self-start flex flex-col max-w-[85%]">
            <div className="bg-white text-slate-800 rounded-2xl rounded-tl-none border border-slate-200/50 p-3 shadow-sm">
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested prompts pills panel */}
      <div className="px-3 py-2 bg-slate-50/90 border-t border-slate-100 flex flex-wrap gap-1.5 select-none shrink-0" dir="rtl">
        <button
          onClick={() => selectSuggestedPrompt(`איפה נמצאת הזמנה מספר #${suggestedOrderNum}?`)}
          className="text-[10px] font-bold bg-white text-slate-700 hover:bg-blue-50 hover:text-blue-600 border border-slate-200/80 rounded-full px-2.5 py-1.5 transition-all cursor-pointer shadow-sm"
        >
          🔍 איפה הזמנה #{suggestedOrderNum}?
        </button>
        <button
          onClick={() => selectSuggestedPrompt('האם יש עיכובים או משלוחים חריגים?')}
          className="text-[10px] font-bold bg-white text-slate-700 hover:bg-blue-50 hover:text-blue-600 border border-slate-200/80 rounded-full px-2.5 py-1.5 transition-all cursor-pointer shadow-sm"
        >
          ⚠️ משלוחים מעוכבים?
        </button>
        <button
          onClick={() => selectSuggestedPrompt('מה מצב העומס במחסני המקור?')}
          className="text-[10px] font-bold bg-white text-slate-700 hover:bg-blue-50 hover:text-blue-600 border border-slate-200/80 rounded-full px-2.5 py-1.5 transition-all cursor-pointer shadow-sm"
        >
          🏭 עומס במחסנים
        </button>
        <button
          onClick={() => selectSuggestedPrompt('הפק דוח בוקר לוגיסטי')}
          className="text-[10px] font-bold bg-white text-slate-700 hover:bg-blue-50 hover:text-blue-600 border border-slate-200/80 rounded-full px-2.5 py-1.5 transition-all cursor-pointer shadow-sm"
        >
          📋 דוח בוקר יומי
        </button>
      </div>

      {/* Chat bottom input bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage(input);
        }}
        className="bg-[#f0f2f5] px-3 py-2.5 flex items-center gap-2 border-t border-slate-200/60 shrink-0"
        dir="rtl"
      >
        <div className="flex items-center gap-3 text-slate-500 shrink-0">
          <Smile className="h-5 w-5 hover:text-slate-800 transition-colors cursor-pointer" />
          <Paperclip className="h-5 w-5 hover:text-slate-800 transition-colors cursor-pointer" />
        </div>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isHe ? 'הקלד הודעה לוגיסטית...' : 'Type a logistics query...'}
          className="flex-1 bg-white text-slate-800 border-none outline-none rounded-xl py-2 px-3.5 text-xs md:text-sm shadow-inner focus:ring-1 focus:ring-[#00a884] transition-all font-sans"
        />

        <button
          type="submit"
          disabled={!input.trim()}
          className={`flex h-9 w-9 items-center justify-center rounded-full text-white shadow-sm transition-all shrink-0 ${
            input.trim()
              ? 'bg-[#00a884] hover:bg-[#008f70] cursor-pointer'
              : 'bg-slate-300 cursor-not-allowed'
          }`}
        >
          <Send className="h-4.5 w-4.5 rotate-180" />
        </button>
      </form>
    </div>
  );
}
