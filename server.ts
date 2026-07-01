import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

// Helper to extract Spreadsheet ID from a Google Sheets URL or ID
function extractSpreadsheetId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
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
        }
      } catch (sheetError: any) {
        console.warn("Direct Google Sheet CSV export failed, falling back to WebApp URL fetch...", sheetError);
      }
    }

    // Standard Google Apps Script WebApp execution or other custom proxy
    try {
      const response = await fetch(webappUrl);
      if (!response.ok) {
        throw new Error(`Google Sheets WebApp returned HTTP ${response.status}`);
      }
      const text = await response.text();
      const trimmed = text.trim();
      
      if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) {
        return res.status(400).json({ 
          success: false, 
          error: "שגיאת הרשאות או הגדרה: הקישור שהוזן החזיר דף אינטרנט (HTML) במקום נתוני JSON. " +
                 "ודא שה-WebApp של גוגל מוגדר לגישת 'Anyone' (כל אחד) ופורסם מחדש (Deploy -> New Deployment)."
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

      const systemPrompt = `אתה "נועה - עוזרת לוגיסטית חכמה" ב-SabanOS.
מגדר: נקבה.
טון: מקצועי, שירותי, חם ומסביר פנים, אך ענייני ומקצועי ביותר.
שפה: עברית (RTL). ענה תמיד בעברית בלבד!

מדיניות אבטחה, פרטיות וסודיות חמורה:
1. חל איסור מוחלט לחשוף את השווי הכספי הפרטני או הכולל של ההזמנות (השדות totalAmount או price) בתגובות צ'אט רגילות!
אם המשתמש שואל לגבי שווי הזמנה, שווי כולל, סכומים או מחיר, הסבר לו בנימוס ובבהירות שנתונים פיננסיים אלו מוסתרים מטעמי אבטחה ופרטיות (ניתן להראות ₪***) וכי הם זמינים לצפייה מורשית אך ורק תחת דוח הבוקר המאובטח או תחת כרטיסיית המדדים הלוגיסטיים המורשים.
2. אל תמציא פרטים או הזמנות שאינם קיימים במאגר. השתמש רק במידע האמיתי מתוך רשימת ההזמנות המצורפת.

הנה נתוני ההזמנות המעודכנים בזמן אמת ב-SabanOS (בפורמט JSON):
${JSON.stringify(orders || [])}

הנחיות תגובה:
- כאשר משתמש שואל על הזמנה ספציפית (לפי מספר הזמנה), חפש אותה ברשימה והצג את הסטטוס העדכני שלה (pending = ממתין, processing = בטיפול, delivered = סופק, cancelled = בוטל), כתובת לקוח קצה, מחסן המקור, והערות מיוחדות.
- תמיד תציין את מספר ההזמנה במדויק בפורמט "#מספר" (למשל #6213944) כדי שהצ'אט יוכל לזהות אותו ולהציע כפתור הדגשה מהיר.
- אם המשתמש שואל על "דוח בוקר" או "סיכום יומי", תמצת את הנתונים העיקריים (כמות משלוחים, חלוקה בין מחסנים ועיכובים) ללא שווי פיננסי.
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
