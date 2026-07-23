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
