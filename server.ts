import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

// Helper to extract Spreadsheet ID from a Google Sheets URL or ID
function extractSpreadsheetId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (trimmed.includes("script.google.com") || trimmed.includes("macros/s/")) {
    return null;
  }
  if (/^[a-zA-Z0-9-_]{40,}$/.test(trimmed)) {
    return trimmed;
  }
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

// RFC 4180-compliant state machine CSV parser
function parseCSV(csvText: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];
    
    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          current += '"';
          i++; // skip next quote
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(current);
        current = '';
      } else if (char === '\r' || char === '\n') {
        row.push(current);
        current = '';
        if (row.length > 1 || row[0] !== '') {
          result.push(row);
        }
        row = [];
        if (char === '\r' && nextChar === '\n') {
          i++; // skip \n
        }
      } else {
        current += char;
      }
    }
  }
  if (row.length > 0 || current !== '') {
    row.push(current);
    result.push(row);
  }
  return result;
}

// Helper to extract text body from Gmail payload
function extractTextFromPayload(payload: any): string {
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64url').toString('utf-8');
  }
  if (payload.parts && Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64url').toString('utf-8');
      }
    }
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        const html = Buffer.from(part.body.data, 'base64url').toString('utf-8');
        return html.replace(/<[^>]+>/g, ' ');
      }
      if (part.parts) {
        const nested = extractTextFromPayload(part);
        if (nested) return nested;
      }
    }
  }
  return '';
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API proxy route for fetching orders from Google Apps Script WebApp or direct Google Sheet CSV
  app.get("/api/orders", async (req, res) => {
    const webappUrl = req.query.webappUrl as string;
    if (!webappUrl) {
      return res.status(400).json({ success: false, error: "Missing webappUrl parameter" });
    }

    const spreadsheetId = extractSpreadsheetId(webappUrl);
    if (spreadsheetId) {
      try {
        console.log(`Detected Google Sheet URL/ID: ${spreadsheetId}. Attempting direct CSV export...`);
        // Try fetching specifically the "לוג_הזמנות_מערכת" sheet first
        const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent("לוג_הזמנות_מערכת")}`;
        let response = await fetch(csvUrl);
        if (!response.ok) {
          // Fallback to first sheet
          const fallbackCsvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv`;
          response = await fetch(fallbackCsvUrl);
        }
        
        if (response.ok) {
          const csvText = await response.text();
          const rows = parseCSV(csvText);
          
          // Filter out headers if present
          let dataRows = rows;
          if (rows.length > 0) {
            const firstRowJoin = rows[0].join(" ").toLowerCase();
            if (
              firstRowJoin.includes("timestamp") || 
              firstRowJoin.includes("order") || 
              firstRowJoin.includes("customer") || 
              firstRowJoin.includes("תאריך") || 
              firstRowJoin.includes("הזמנה") ||
              firstRowJoin.includes("חתימת")
            ) {
              dataRows = rows.slice(1);
            }
          }
          
          return res.json({ success: true, data: dataRows });
        } else {
          console.warn(`Direct Google Sheet CSV export failed for both sheet names. Returning 403 authorization/sharing error.`);
          return res.status(403).json({
            success: false,
            error: "גישה נדחתה: לא ניתן לייצא נתוני CSV מקובץ הגוגל שיטס. ודא שהקובץ מוגדר כציבורי לצפייה ('Anyone with the link can view') או שהזנת קישור WebApp תקין."
          });
        }
      } catch (sheetError: any) {
        console.error("Direct Google Sheet CSV export encountered an exception:", sheetError);
        return res.status(500).json({
          success: false,
          error: `שגיאת סנכרון גוגל שיטס: ${sheetError.message || String(sheetError)}`
        });
      }
    }

    // Standard Google Apps Script WebApp execution or other custom proxy
    try {
      let fetchUrl = webappUrl;
      if (!fetchUrl.includes("action=")) {
        fetchUrl += (fetchUrl.includes("?") ? "&" : "?") + "action=getOrders";
      }
      console.log(`Proxy fetching from WebApp URL: ${fetchUrl}`);
      const response = await fetch(fetchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        redirect: 'follow'
      });
      if (!response.ok) {
        throw new Error(`Google Sheets WebApp returned HTTP ${response.status}`);
      }
      const text = await response.text();
      const trimmed = text.trim();
      
      if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) {
        // Extract Apps Script error if present in HTML body
        const gasErrorMatch = trimmed.match(/monospace;[^>]*>([^<]+)/i) || trimmed.match(/errorMessage[^>]*>([^<]+)/i);
        const scriptDetail = gasErrorMatch && gasErrorMatch[1] ? gasErrorMatch[1].trim() : '';
        
        let errorMsg = "שגיאת הרשאות או הגדרה: הקישור שהוזן החזיר דף אינטרנט (HTML) במקום נתוני JSON. " +
                       "ודא שה-WebApp של גוגל מוגדר לגישת 'Anyone' (כל אחד) ופורסם מחדש (Deploy -> New Deployment).";
        
        if (scriptDetail) {
          errorMsg = `שגיאה בסקריפט גוגל (${scriptDetail}). יש להעתיק את הקוד המעודכן מ-Code.js ל-Apps Script ולבצע פריסה חדשה (Deploy -> New Deployment).`;
        }

        return res.status(400).json({ 
          success: false, 
          error: errorMsg
        });
      }
      
      try {
        const data = JSON.parse(trimmed);
        res.json(data);
      } catch (parseErr) {
        console.error("Failed to parse JSON response:", parseErr);
        res.status(500).json({ success: false, error: "תגובת השרת אינה בפורמט JSON תקין" });
      }
    } catch (error: any) {
      console.error("Server proxy error fetching orders:", error);
      res.status(500).json({ success: false, error: error.message || String(error) });
    }
  });

  // API proxy route for updating order status in Google Sheets
  app.get("/api/update-status", async (req, res) => {
    const webappUrl = req.query.webappUrl as string;
    const orderNumber = req.query.orderNumber as string;
    const status = req.query.status as string;
    
    if (!webappUrl || !orderNumber || !status) {
      return res.status(400).json({ success: false, error: "Missing parameters" });
    }
    try {
      const url = `${webappUrl}${webappUrl.includes('?') ? '&' : '?'}action=updateStatus&orderNumber=${encodeURIComponent(orderNumber)}&status=${encodeURIComponent(status)}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Google Sheets WebApp returned HTTP ${response.status}`);
      }
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Server proxy error updating status:", error);
      res.status(500).json({ success: false, error: error.message || String(error) });
    }
  });

  // API proxy route for updating full order details in Google Sheets
  app.post("/api/update-order", async (req, res) => {
    const { webappUrl, order } = req.body;
    if (!webappUrl || !order || !order.orderNumber) {
      return res.status(400).json({ success: false, error: "Missing required order parameters" });
    }

    try {
      const response = await fetch(webappUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateOrder",
          order: order
        })
      });

      if (!response.ok) {
        throw new Error(`Google Sheets WebApp returned HTTP ${response.status}`);
      }
      const text = await response.text();
      try {
        const json = JSON.parse(text);
        res.json(json);
      } catch (parseErr) {
        res.json({ success: true, message: "Updated order in Google Sheet" });
      }
    } catch (error: any) {
      console.error("Server proxy error updating order:", error);
      res.status(500).json({ success: false, error: error.message || String(error) });
    }
  });

  // API proxy route for adding a new order to Google Sheets
  app.post("/api/add-order", async (req, res) => {
    const { webappUrl, order } = req.body;
    if (!webappUrl || !order || !order.orderNumber) {
      return res.status(400).json({ success: false, error: "Missing required order parameters" });
    }

    try {
      const response = await fetch(webappUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "addOrder",
          order: order
        })
      });

      if (!response.ok) {
        throw new Error(`Google Sheets WebApp returned HTTP ${response.status}`);
      }
      const text = await response.text();
      try {
        const json = JSON.parse(text);
        res.json(json);
      } catch (parseErr) {
        res.json({ success: true, message: "Added order to Google Sheet" });
      }
    } catch (error: any) {
      console.error("Server proxy error adding order:", error);
      res.status(500).json({ success: false, error: error.message || String(error) });
    }
  });

  // API proxy route for deleting an order from Google Sheets
  app.post("/api/delete-order", async (req, res) => {
    const { webappUrl, orderNumber } = req.body;
    if (!webappUrl || !orderNumber) {
      return res.status(400).json({ success: false, error: "Missing webappUrl or orderNumber" });
    }

    try {
      const response = await fetch(webappUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "deleteOrder",
          orderNumber: orderNumber
        })
      });

      if (!response.ok) {
        throw new Error(`Google Sheets WebApp returned HTTP ${response.status}`);
      }
      const text = await response.text();
      try {
        const json = JSON.parse(text);
        res.json(json);
      } catch (parseErr) {
        res.json({ success: true, message: "Deleted order from Google Sheet" });
      }
    } catch (error: any) {
      console.error("Server proxy error deleting order:", error);
      res.status(500).json({ success: false, error: error.message || String(error) });
    }
  });

  // API proxy route for triggering processIncomingOrders (live email & PDF ingestion)
  app.all("/api/process-incoming-orders", async (req, res) => {
    const webappUrl = (req.query.webappUrl as string) || (req.body && req.body.webappUrl);
    const targetUrl = webappUrl || process.env.VITE_GOOGLE_WEBAPP_URL || 'https://script.google.com/macros/s/AKfycbyLRZciGSmPeOitVGg1FBAGJnww54V32JvduopLa9LTlIo1iCL-k8ojeRZ3veHHYDNXVg/exec';

    try {
      const url = `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}action=processIncomingOrders`;
      console.log(`Triggering processIncomingOrders via proxy: ${url}`);
      const response = await fetch(url, {
        method: "GET",
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        redirect: 'follow'
      });

      if (!response.ok) {
        throw new Error(`Google Sheets WebApp returned HTTP ${response.status}`);
      }

      const text = await response.text();
      try {
        const json = JSON.parse(text);
        res.json(json);
      } catch (parseErr) {
        res.json({ success: true, message: "Processed incoming orders successfully", raw: text });
      }
    } catch (error: any) {
      console.error("Server proxy error triggering processIncomingOrders:", error);
      res.status(500).json({ success: false, error: error.message || String(error) });
    }
  });

  // Gmail API Proxy - List Messages (bypasses browser CORS & iframe limitations)
  app.get("/api/gmail/messages", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, error: "Missing Authorization header with OAuth access token" });
    }

    const query = (req.query.q as string) || "label:INBOX";
    const maxResults = (req.query.maxResults as string) || "15";

    try {
      const listUrl = `https://gmail.googleapis.com/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`;
      const response = await fetch(listUrl, {
        headers: { Authorization: authHeader }
      });

      if (!response.ok) {
        const errText = await response.text();
        return res.status(response.status).json({ success: false, error: `Gmail API HTTP ${response.status}: ${errText}` });
      }

      const data = await response.json();
      if (!data.messages || !Array.isArray(data.messages)) {
        return res.json({ success: true, messages: [] });
      }

      const detailPromises = data.messages.slice(0, 15).map(async (m: { id: string }) => {
        try {
          const msgRes = await fetch(`https://gmail.googleapis.com/v1/users/me/messages/${m.id}?format=full`, {
            headers: { Authorization: authHeader }
          });
          if (!msgRes.ok) return null;
          const msgData = await msgRes.json();
          const headers = msgData.payload?.headers || [];

          const getHeader = (name: string) => {
            const h = headers.find((item: any) => item.name.toLowerCase() === name.toLowerCase());
            return h ? h.value : "";
          };

          const subject = getHeader("Subject") || "ללא נושא";
          const from = getHeader("From") || "לא ידוע";
          const to = getHeader("To") || "";
          const date = getHeader("Date") || new Date().toISOString();

          let bodyText = msgData.snippet || "";
          if (msgData.payload) {
            bodyText = extractTextFromPayload(msgData.payload) || msgData.snippet || "";
          }

          const hasAttachments = Boolean(
            msgData.payload?.parts?.some((p: any) => p.filename && p.filename.length > 0)
          );

          return {
            id: msgData.id,
            threadId: msgData.threadId,
            snippet: msgData.snippet || "",
            subject,
            from,
            to,
            date,
            body: bodyText,
            hasAttachments
          };
        } catch (e) {
          return null;
        }
      });

      const messages = (await Promise.all(detailPromises)).filter(Boolean);
      return res.json({ success: true, messages });
    } catch (error: any) {
      console.error("Server proxy Gmail list error:", error);
      res.status(500).json({ success: false, error: error.message || String(error) });
    }
  });

  // Gmail API Proxy - Send Message
  app.post("/api/gmail/send", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, error: "Missing Authorization header" });
    }

    const { to, subject, body } = req.body || {};
    if (!to || !subject || !body) {
      return res.status(400).json({ success: false, error: "Missing required fields: to, subject, body" });
    }

    try {
      const mimeLines = [
        `To: ${to}`,
        `Subject: =?UTF-8?B?${Buffer.from(subject, 'utf-8').toString('base64')}?=`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset="UTF-8"',
        'Content-Transfer-Encoding: base64',
        '',
        Buffer.from(body, 'utf-8').toString('base64')
      ];

      const rawMime = mimeLines.join('\r\n');
      const base64UrlMime = Buffer.from(rawMime, 'utf-8')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const response = await fetch('https://gmail.googleapis.com/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ raw: base64UrlMime })
      });

      if (!response.ok) {
        const errText = await response.text();
        return res.status(response.status).json({ success: false, error: `Gmail Send HTTP ${response.status}: ${errText}` });
      }

      const json = await response.json();
      return res.json({ success: true, messageId: json.id });
    } catch (error: any) {
      console.error("Server proxy Gmail send error:", error);
      res.status(500).json({ success: false, error: error.message || String(error) });
    }
  });

  // Noa AI interactive assistant route - integrates Gemini 3.5 Flash lazily and securely
  app.post("/api/chat", async (req, res) => {
    const { message, orders } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, error: "Missing message parameter" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not defined in the environment. Returning error status so frontend can handle with intelligent offline rule-engine fallback.");
      return res.status(404).json({ success: false, error: "API Key missing" });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const systemPrompt = `את/ה מנוע הפיתוח והעוזרת הלוגיסטית החכמה "נועה" של מערכת SBN Logistics ב-SabanOS.
תפקידך לנהל את סנכרון הנתונים בטבלה המרכזית בת 16 העמודות (לוג_הזמנות_מערכת), לחשב באופן אוטומטי את ארבעת סוגי הפקדונות (בלות, משטחים, חביות, משטחי בלוק) מתוך מחרוזת הפריטים בהשוואה ל"מילון הלוגיסטי", ולהחזיר את הערכים במבנה JSON מדויק שמתעדכן ישירות בתיבות הממשק בזמן אמת.

מגדר: נקבה.
טון: מקצועי, שירותי, חם ומסביר פנים, ענייני ומדויק ביותר.
שפה: עברית (RTL). ענה תמיד בעברית בלבד!

מדיניות אבטחה, פרטיות וסודיות חמורה:
1. חל איסור מוחלט לחשוף את השווי הכספי הפרטני או הכולל של ההזמנות (השדות totalAmount או price) בתגובות צ'אט רגילות!
אם המשתמש שואל לגבי שווי הזמנה, שווי כולל, סכומים או מחיר, הסבר לו בנימוס ובבהירות שנתונים פיננסיים אלו מוסתרים מטעמי אבטחה ופרטיות (ניתן להראות ₪***) וכי הם זמינים לצפייה מורשית אך ורק תחת דוח הבוקר המאובטח או תחת כרטיסיית המדדים הלוגיסטיים המורשים.
2. אל תמציא פרטים או הזמנות שאינם קיימים במאגר. השתמש רק במידע האמיתי מתוך רשימת ההזמנות המצורפת.

הנה נתוני ההזמנות המעודכנים בזמן אמת ב-SabanOS (בפורמט JSON, כולל 16 עמודות הסכמה):
${JSON.stringify(orders || [])}

הנחיות תגובה:
- כאשר משתמש שואל על הזמנה ספציפית (לפי מספר הזמנה), חפש אותה ברשימה והצג את הסטטוס העדכני שלה (pending = ממתין, processing = בטיפול, delivered = סופק, cancelled = בוטל), נהג מוקצה, פקדונות (בלות, משטחים, חביות, משטחי בלוק), כתובת לקוח קצה, מחסן המקור, והערות מיוחדות.
- תמיד תציין את מספר ההזמנה במדויק בפורמט "#מספר" (למשל #6213944) כדי שהצ'אט יוכל לזהות אותו ולהציע כפתור הדגשה מהיר.
- אם המשתמש שואל על "דוח בוקר" או "סיכום יומי", תמצת את הנתונים העיקריים (כמות משלוחים, חלוקה בין מחסנים, פקדונות ועיכובים) ללא שווי פיננסי.
- אם המשתמש שואל לגבי חלוקת עומסים, סכם את מספר ההזמנות לפי מחסן (החרש או התלמיד) בצורה בהירה ונוחה לקריאה.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: message,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.7,
        }
      });

      res.json({ success: true, text: response.text });
    } catch (err: any) {
      console.error("Gemini API server failure:", err);
      res.status(500).json({ success: false, error: err.message || String(err) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
