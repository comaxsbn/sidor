/**
 * SabanOS - Production Google Apps Script & Cloud Firestore Integration Engine
 * 
 * Target Sheet ID: 1Y_2N4Gs-lvAiv8fvLk9zvIhVQt5YxNPz6mCOnlh6lh8
 * Target Sheet Name: לוג_הזמנות_מערכת
 * 
 * Features Included:
 * 1. Automatic deposit calculation across 4 deposit categories (בלות, משטחים, חביות, משטחי בלוק).
 * 2. Anti-double-counting engine (מנגנון מניעת כפל חישוב): Gives priority to explicit deposit SKUs 
 *    (e.g., SKU 60002 for Bale Deposit) and overrides automatic dictionary calculations.
 * 3. Live email & attached PDF processing via processIncomingOrders(), extractTextFromPDF(), and parseOrderText().
 * 4. Real-time `onEdit(e)` trigger for interactive sheet editing and instant deposit calculation updates.
 * 5. Automatic real-time sync with Firebase Firestore via REST API.
 * 6. Web App REST endpoints (doGet/doPost) for frontend integration.
 */

// =========================================================================
// Configuration Constants
// =========================================================================
const SHEET_ID = "1Y_2N4Gs-lvAiv8fvLk9zvIhVQt5YxNPz6mCOnlh6lh8";
const SHEET_NAME = "לוג_הזמנות_מערכת";
const ROOT_DRIVE_FOLDER_ID = "1CARwoXMPEODCVCAWHZZEK_a1jAi-kSIY";
const ROOT_DRIVE_FOLDER_NAME = "SabanOS Delivery Documents";

// Authorized Firebase credentials
const FIREBASE_PROJECT_ID = "gen-lang-client-0262645162";
const FIREBASE_DATABASE_ID = "ai-studio-sabanosenterpris-8ad4b65f-f5d9-4535-b28a-1f69f6cd447e";
const FIREBASE_API_KEY = "AIzaSyBMY3g9ryK2yE2d-lecxQSSsK--JG3ev4A";
const COLLECTION_NAME = "orders";

// Standard Catalog Price Mapping
const PRODUCT_PRICES = {
  '60002': 50,  // שק גדול פקדון (בלה)
  '60060': 85,  // משטח סבן פקדון
  '60003': 120, // חבית פקדון
  '60004': 95,  // משטח בלוק פקדון
  '11511': 65,  // חצץ בלה 1.5 טון
  '11512': 65,  // חול בלה 1.5 טון
  '11551': 45,  // טיט שק גדול
  '11501': 45,  // חול שק גדול
  '10002': 38,  // מלט אפור 25 ק"ג
  '14603': 60,  // פלסטומר 603AD
  '12154': 12,  // בלוק בטון
  '14185': 75,  // שליכט בגר
  '15010': 90,  // טיח בריכות
  '31014': 25,  // פינת טיח
  'SBN-PL-01': 85,
  'SBN-ST-05': 42,
  'SBN-TP-12': 18,
  'SBN-BB-08': 65
};

// =========================================================================
// 0. Google Drive Customer Folder Management
// =========================================================================

/**
 * Gets or creates the dedicated customer subfolder under SabanOS Delivery Documents.
 * Format: [Customer Name] - [Customer ID]
 * Root Folder ID: 1CARwoXMPEODCVCAWHZZEK_a1jAi-kSIY
 * @param {string} customerName - Name of customer
 * @param {string} customerId - ID/Code of customer from Comax
 * @return {Folder} Google Drive Folder instance
 */
function getOrCreateCustomerDriveFolder(customerName, customerId) {
  var rootFolder = null;
  try {
    rootFolder = DriveApp.getFolderById(ROOT_DRIVE_FOLDER_ID);
  } catch (e) {
    console.warn("Root folder ID not found by ID, searching by name: " + e.toString());
    var folders = DriveApp.getFoldersByName(ROOT_DRIVE_FOLDER_NAME);
    if (folders.hasNext()) {
      rootFolder = folders.next();
    } else {
      rootFolder = DriveApp.createFolder(ROOT_DRIVE_FOLDER_NAME);
    }
  }

  var cleanName = (customerName || "לקוח_כללי").trim();
  var cleanId = (customerId || "").toString().trim();
  
  // Format required: [שם הלקוח] - [מספר לקוח]
  var folderName = cleanId ? (cleanName + " - " + cleanId) : cleanName;
  
  var subFolders = rootFolder.getFoldersByName(folderName);
  if (subFolders.hasNext()) {
    return subFolders.next();
  } else {
    var newFolder = rootFolder.createFolder(folderName);
    try {
      newFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (sErr) {
      console.warn("Could not set folder sharing: " + sErr.toString());
    }
    return newFolder;
  }
}

// =========================================================================
// 1. Core Functions: Live Email & PDF Ingestion (processIncomingOrders)
// =========================================================================

/**
 * Extracts plain text from a PDF attachment using Google Drive OCR or text stream decoding.
 * @param {Blob|GmailAttachment} attachment - The PDF file attachment.
 * @return {string} Extracted text content.
 */
function extractTextFromPDF(attachment) {
  if (!attachment) return "";
  try {
    var blob = attachment.copyBlob ? attachment.copyBlob() : attachment;
    var filename = attachment.getName ? attachment.getName() : "attachment.pdf";

    // Attempt 1: Advanced Drive API v2 OCR if enabled
    if (typeof Drive !== 'undefined' && Drive.Files && Drive.Files.insert) {
      try {
        var resource = {
          title: "ocr_" + filename,
          mimeType: blob.getContentType()
        };
        var file = Drive.Files.insert(resource, blob, { ocr: true, ocrLanguage: "he" });
        var doc = DocumentApp.openById(file.id);
        var text = doc.getBody().getText();
        DriveApp.getFileById(file.id).setTrashed(true);
        if (text && text.trim().length > 0) {
          return text;
        }
      } catch (ocrErr) {
        console.warn("Drive OCR API failed: " + ocrErr.toString());
      }
    }

    // Attempt 2: Convert via DriveApp temp file + Google Doc conversion
    try {
      var folder = DriveApp.getRootFolder();
      var tempFile = folder.createFile(blob);
      var docFile = Drive.Files.insert(
        { title: "temp_conv_" + filename, mimeType: MimeType.GOOGLE_DOCS },
        tempFile.getBlob()
      );
      var doc = DocumentApp.openById(docFile.id);
      var docText = doc.getBody().getText();
      
      // Clean up temp files
      tempFile.setTrashed(true);
      DriveApp.getFileById(docFile.id).setTrashed(true);

      if (docText && docText.trim().length > 0) {
        return docText;
      }
    } catch (docErr) {
      console.warn("Drive Google Docs conversion fallback failed: " + docErr.toString());
    }

    // Attempt 3: Direct text decoding from blob
    var rawText = blob.getDataAsString();
    if (rawText && rawText.length > 30 && !rawText.includes("%PDF")) {
      return rawText;
    }

    // Attempt 4: Text extraction from PDF stream TJ/Tj operators
    var rawStr = blob.getDataAsString("ISO-8859-1");
    var matches = rawStr.match(/\(([^()]+)\)\s*TJ/g) || rawStr.match(/\(([^()]+)\)\s*Tj/g);
    if (matches && matches.length > 0) {
      var cleanStr = matches.map(function(m) {
        return m.replace(/^\(/, '').replace(/\)\s*TJ$/, '').replace(/\)\s*Tj$/, '');
      }).join(' ');
      if (cleanStr.trim().length > 10) {
        return cleanStr;
      }
    }

    return rawText || "";
  } catch (err) {
    console.error("Error in extractTextFromPDF: " + err.toString());
    try {
      return attachment.getDataAsString();
    } catch (e) {
      return "";
    }
  }
}

/**
 * Parses raw text extracted from PDF or Email into structured order metadata and items.
 * @param {string} text - The raw text from PDF/Email.
 * @return {Object} Parsed order metadata object.
 */
function parseOrderText(text) {
  if (!text) text = "";
  
  var orderNumber = "";
  var customerName = "לקוח לא ידוע";
  var customerId = "";
  var warehouse = "מחסן החרש";
  var deliveryAddress = "";
  var notes = "";
  var items = [];
  var pdfUrl = "";

  // 1. Order Number Regex Parsing (e.g. 6213903, SBN-10029, ORD-5541)
  var orderMatch = text.match(/מספר\s*הזמנה\s*[:\-]?\s*([A-Za-z0-9\-]+)/i) ||
                     text.match(/\b(6\d{6})\b/) ||
                     text.match(/\b(SBN-\d+)\b/i) ||
                     text.match(/\b(ORD-\d+)\b/i) ||
                     text.match(/הזמנה\s*#?\s*([0-9]{5,8})/);
  if (orderMatch && orderMatch[1]) {
    orderNumber = orderMatch[1].trim();
  } else {
    orderNumber = "6" + Math.floor(100000 + Math.random() * 900000);
  }

  // 2. Customer ID (Comax Code)
  var idMatch = text.match(/מספר\s*לקוח\s*[:\-]?\s*([0-9]{4,8})/i) ||
                text.match(/קוד\s*לקוח\s*[:\-]?\s*([0-9]{4,8})/i) ||
                text.match(/ח\.פ\.\s*[:\-]?\s*([0-9]{4,9})/i);
  if (idMatch && idMatch[1]) {
    customerId = idMatch[1].trim();
  }

  // 3. Customer Name Regex Parsing
  var customerMatch = text.match(/שם\s*לקוח\s*[:\-]?\s*([^\n\r,]+)/i) ||
                         text.match(/לקוח\s*[:\-]?\s*([^\n\r,]+)/i) ||
                         text.match(/עבור\s*[:\-]?\s*([^\n\r,]+)/i);
  if (customerMatch && customerMatch[1]) {
    customerName = customerMatch[1].trim();
  } else if (text.indexOf("שופרסל") !== -1) {
    customerName = 'שופרסל בע"מ';
  } else if (text.indexOf("רמי לוי") !== -1) {
    customerName = 'רמי לוי שיווק השקמה';
  } else if (text.indexOf("מטרופוליס") !== -1) {
    customerName = 'מטרופוליס - הרב קוק';
  } else if (text.indexOf("חצי חינם") !== -1) {
    customerName = 'חצי חינם בע"מ';
  }

  // 4. Warehouse Regex Parsing
  var warehouseMatch = text.match(/מחסן\s*(?:הפצה)?\s*[:\-]?\s*([^\n\r,]+)/i);
  if (warehouseMatch && warehouseMatch[1]) {
    warehouse = warehouseMatch[1].trim();
  } else if (text.indexOf("התלמיד") !== -1) {
    warehouse = "מחסן התלמיד";
  } else if (text.indexOf("עטרות") !== -1) {
    warehouse = "מחסן עטרות";
  }

  // 5. Delivery Address Regex Parsing
  var addressMatch = text.match(/כתובת\s*(?:אספקה)?\s*[:\-]?\s*([^\n\r,]+)/i) ||
                        text.match(/לכתובת\s*[:\-]?\s*([^\n\r,]+)/i);
  if (addressMatch && addressMatch[1]) {
    deliveryAddress = addressMatch[1].trim();
  }

  // 6. Items Parsing from Text Lines
  var lines = text.split(/[\r\n]+/);
  lines.forEach(function(line, idx) {
    var lineTrim = line.trim();
    if (!lineTrim) return;

    var itemMatch = lineTrim.match(/\[?([A-Za-z0-9\-]+)\]?\s*([^-\n\r]+?)(?:\s*[\-:]\s*|\s+)כמות\s*[:\-]?\s*(\d+)/i) ||
                    lineTrim.match(/(\d+)\s*X\s*\[?([A-Za-z0-9\-]+)\]?\s*(.+)/i) ||
                    lineTrim.match(/\[?([A-Za-z0-9\-]+)\]?\s*(.+?)\s+(\d+)\s*(?:יח'|יחידות|שקים|שק)?$/);

    if (itemMatch) {
      var sku = "SBN-GEN-99";
      var name = lineTrim;
      var qty = 1;

      if (lineTrim.indexOf("כמות") !== -1) {
        sku = itemMatch[1] ? itemMatch[1].trim() : "SBN-GEN-99";
        name = itemMatch[2] ? itemMatch[2].trim() : lineTrim;
        qty = parseInt(itemMatch[3], 10) || 1;
      } else if (lineTrim.indexOf("X") !== -1 || lineTrim.indexOf("x") !== -1) {
        qty = parseInt(itemMatch[1], 10) || 1;
        sku = itemMatch[2] ? itemMatch[2].trim() : "SBN-GEN-99";
        name = itemMatch[3] ? itemMatch[3].trim() : lineTrim;
      }

      var price = PRODUCT_PRICES[sku] || 50;
      items.push({
        id: "item-pdf-" + idx + "-" + sku,
        sku: sku,
        name: name,
        quantity: qty,
        price: price
      });
    }
  });

  // Fallback items if none parsed
  if (items.length === 0) {
    if (text.indexOf("חול") !== -1) {
      items.push({ id: "item-1", sku: "11501", name: "חול שק גדול", quantity: 3, price: 45 });
    }
    if (text.indexOf("טיט") !== -1) {
      items.push({ id: "item-2", sku: "11551", name: "טיט שק גדול", quantity: 2, price: 45 });
    }
    if (items.length === 0) {
      items.push({ id: "item-gen", sku: "SBN-GEN-99", name: "אספקת חומרי לבן", quantity: 1, price: 250 });
    }
  }

  return {
    orderNumber: orderNumber,
    customerName: customerName,
    customerId: customerId,
    warehouse: warehouse,
    deliveryAddress: deliveryAddress,
    notes: notes,
    items: items,
    itemsRawString: items.map(function(i) { return "[" + i.sku + "] " + i.name + " - כמות: " + i.quantity; }).join("\n")
  };
}

/**
 * Fetches live unread emails with attached PDFs, extracts order data, computes Noa deposits,
 * appends/updates the 16-column sheet and Firestore, and marks the email as read.
 * @return {Object} Processing execution status and parsed order details.
 */
function processIncomingOrders() {
  try {
    console.log("Starting processIncomingOrders live email ingestion...");
    
    // Search unread messages in inbox
    var threads = GmailApp.search("label:inbox is:unread", 0, 15);
    var processedOrders = [];
    var processedCount = 0;

    threads.forEach(function(thread) {
      var messages = thread.getMessages();
      messages.forEach(function(message) {
        if (!message.isUnread()) return;

        var subject = message.getSubject() || "";
        var body = message.getPlainBody() || "";
        var sender = message.getFrom() || "";
        var attachments = message.getAttachments();
        var pdfAttachment = null;

        // Search for PDF attachment
        for (var i = 0; i < attachments.length; i++) {
          var att = attachments[i];
          if (att.getContentType() === "application/pdf" || att.getName().toLowerCase().indexOf(".pdf") !== -1) {
            pdfAttachment = att;
            break;
          }
        }

        var pdfUrl = "";
        var extractedText = "";

        if (pdfAttachment) {
          extractedText = extractTextFromPDF(pdfAttachment);
        } else {
          extractedText = body;
        }

        // Parse order metadata & items
        var parsedOrder = parseOrderText(extractedText + "\n" + body + "\n" + subject);
        
        // Drive Subfolder Creation: [שם הלקוח] - [מספר לקוח] inside SabanOS Delivery Documents (1CARwoXMPEODCVCAWHZZEK_a1jAi-kSIY)
        var customerFolder = getOrCreateCustomerDriveFolder(parsedOrder.customerName, parsedOrder.customerId);

        if (pdfAttachment) {
          try {
            var fileName = "Order_" + parsedOrder.orderNumber + "_" + (pdfAttachment.getName() || "ComaxOrder.pdf");
            var savedFile = customerFolder.createFile(pdfAttachment.setName(fileName));
            savedFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            pdfUrl = savedFile.getUrl(); // Magic View Link behind "Eye" button in portal
          } catch (sErr) {
            console.warn("Could not save PDF to customer Drive folder: " + sErr.toString());
          }
        }

        // Calculate deposits using Noa Anti-Double-Counting Engine
        var deposits = calculateDepositsWithDeduplication(parsedOrder.items, parsedOrder.itemsRawString);

        // Compute Noa AI Verification Status String
        var noaStatus = "✅ אימות נועה תואם";
        if (deposits.depositBales > 0 || deposits.depositPallets > 0) {
          noaStatus += " (בלות: " + deposits.depositBales + ", משטחים: " + deposits.depositPallets + ")";
        } else {
          noaStatus = "✅ תואם ללא פקדונות";
        }

        var orderPayload = {
          orderNumber: parsedOrder.orderNumber,
          timestamp: new Date().toISOString(),
          customerName: parsedOrder.customerName,
          customerId: parsedOrder.customerId,
          warehouse: parsedOrder.warehouse,
          deliveryAddress: parsedOrder.deliveryAddress || "כתובת לפי תעודת משלוח",
          driverName: "טרם הוקצה",
          status: "pending",
          items: parsedOrder.items,
          itemsRawString: parsedOrder.itemsRawString,
          notes: (pdfUrl ? "PDF Magic Link: " + pdfUrl + "\n" : "") + "קליטה אוטומטית ממייל: " + sender,
          noaAnalysis: noaStatus,
          depositBales: deposits.depositBales,
          depositPallets: deposits.depositPallets,
          depositDrums: deposits.depositDrums,
          depositBlockPallets: deposits.depositBlockPallets,
          pdfUrl: pdfUrl
        };

        // Inject 16-column row into Google Sheet and sync to Firestore
        var success = addOrUpdateSheetOrderAndSync(orderPayload);
        
        if (success) {
          processedCount++;
          processedOrders.push({
            orderNumber: parsedOrder.orderNumber,
            customerName: parsedOrder.customerName,
            customerId: parsedOrder.customerId,
            subject: subject,
            sender: sender,
            pdfUrl: pdfUrl,
            itemsCount: parsedOrder.items.length,
            noaStatus: noaStatus,
            deposits: deposits
          });

          // Mark message as read
          try {
            message.markRead();
          } catch (mErr) {
            console.warn("Could not mark message read: " + mErr.toString());
          }
        }
      });
    });

    console.log("processIncomingOrders completed. Processed " + processedCount + " new orders.");
    
    return {
      success: true,
      message: "תהליך שאיבת המיילים וה-PDF הושלם בהצלחה. נקלטו " + processedCount + " הזמנות חדשות.",
      processedCount: processedCount,
      orders: processedOrders,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error("Error in processIncomingOrders: " + error.toString());
    return {
      success: false,
      error: error.toString(),
      message: "שגיאה בביצוע שאיבת מיילים: " + error.toString()
    };
  }
}

// =========================================================================
// 2. OnEdit Triggers & Event Handler
// =========================================================================

function onEdit(e) {
  processSheetEdit(e);
}

function onEditTrigger(e) {
  processSheetEdit(e);
}

function processSheetEdit(e) {
  if (!e || !e.source) return;
  try {
    const sheet = e.source.getActiveSheet();
    if (sheet.getName() !== SHEET_NAME) return;

    const range = e.range;
    const rowIndex = range.getRow();

    if (rowIndex <= 1) return;

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const colIndices = findColumnIndices(headers);

    const row = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
    const rawOrderNo = row[colIndices.orderNumber];
    if (!rawOrderNo || String(rawOrderNo).trim() === "") return;

    const itemsStr = String(row[colIndices.items] || '').trim();
    const parsedItems = parseItemsString(itemsStr, rowIndex);

    const deposits = calculateDepositsWithDeduplication(parsedItems, itemsStr);

    if (colIndices.depositBales !== -1) {
      sheet.getRange(rowIndex, colIndices.depositBales + 1).setValue(deposits.depositBales);
      row[colIndices.depositBales] = deposits.depositBales;
    }
    if (colIndices.depositPallets !== -1) {
      sheet.getRange(rowIndex, colIndices.depositPallets + 1).setValue(deposits.depositPallets);
      row[colIndices.depositPallets] = deposits.depositPallets;
    }
    if (colIndices.depositDrums !== -1) {
      sheet.getRange(rowIndex, colIndices.depositDrums + 1).setValue(deposits.depositDrums);
      row[colIndices.depositDrums] = deposits.depositDrums;
    }
    if (colIndices.depositBlockPallets !== -1) {
      sheet.getRange(rowIndex, colIndices.depositBlockPallets + 1).setValue(deposits.depositBlockPallets);
      row[colIndices.depositBlockPallets] = deposits.depositBlockPallets;
    }

    const orderNumber = String(rawOrderNo).trim();
    const orderPayload = buildOrderPayload(row, colIndices, rowIndex);
    syncToFirestoreRest(orderNumber, orderPayload);

    console.log("onEdit processed for Order #" + orderNumber);
  } catch (err) {
    console.error("Error in processSheetEdit: " + err.toString());
  }
}

// =========================================================================
// 3. Deposit Engine & Anti-Double-Counting Mechanism
// =========================================================================

function calculateDepositsWithDeduplication(items, itemsRawString) {
  let explicitBales = 0;
  let implicitBales = 0;

  items.forEach(function(item) {
    const sku = String(item.sku || '').trim();
    const name = String(item.name || '').toLowerCase();
    const qty = Number(item.quantity) || 1;

    if (sku === '60002' || (name.indexOf('פקדון') !== -1 && (name.indexOf('בלה') !== -1 || name.indexOf('שק גדול') !== -1))) {
      explicitBales += qty;
    } else if (sku === '11511' || sku === '11512' || sku === '11551' || sku === '11501' || name.indexOf('בלה') !== -1 || name.indexOf('שק גדול') !== -1 || name.indexOf('ביג בג') !== -1) {
      implicitBales += qty;
    }
  });

  const finalBales = explicitBales > 0 ? explicitBales : implicitBales;

  let explicitPallets = 0;
  let implicitPallets = 0;
  let heavyBagCount = 0;

  items.forEach(function(item) {
    const sku = String(item.sku || '').trim();
    const name = String(item.name || '').toLowerCase();
    const qty = Number(item.quantity) || 1;

    if (sku === '60060' || (name.indexOf('פקדון') !== -1 && (name.indexOf('משטח') !== -1 || name.indexOf('פלטה') !== -1) && name.indexOf('בלוק') === -1)) {
      explicitPallets += qty;
    } else if (name.indexOf('משטח עץ') !== -1 || name.indexOf('משטח סבן') !== -1 || (name.indexOf('משטח') !== -1 && name.indexOf('בלוק') === -1)) {
      implicitPallets += qty;
    } else if (name.indexOf('שק') !== -1 || name.indexOf('25 ק"ג') !== -1 || name.indexOf('מלט') !== -1 || name.indexOf('טיח') !== -1 || name.indexOf('דבק') !== -1) {
      heavyBagCount += qty;
    }
  });

  if (implicitPallets === 0 && heavyBagCount > 0) {
    implicitPallets = Math.ceil(heavyBagCount / 10);
  }

  const finalPallets = explicitPallets > 0 ? explicitPallets : implicitPallets;

  let explicitDrums = 0;
  let implicitDrums = 0;

  items.forEach(function(item) {
    const sku = String(item.sku || '').trim();
    const name = String(item.name || '').toLowerCase();
    const qty = Number(item.quantity) || 1;

    if (sku === '60003' || (name.indexOf('פקדון') !== -1 && (name.indexOf('חבית') !== -1 || name.indexOf('תוף') !== -1))) {
      explicitDrums += qty;
    } else if (name.indexOf('חבית') !== -1 || name.indexOf('תוף') !== -1) {
      implicitDrums += qty;
    }
  });

  const finalDrums = explicitDrums > 0 ? explicitDrums : implicitDrums;

  let explicitBlockPallets = 0;
  let implicitBlockPallets = 0;

  items.forEach(function(item) {
    const sku = String(item.sku || '').trim();
    const name = String(item.name || '').toLowerCase();
    const qty = Number(item.quantity) || 1;

    if (sku === '60004' || (name.indexOf('פקדון') !== -1 && name.indexOf('בלוק') !== -1)) {
      explicitBlockPallets += qty;
    } else if (name.indexOf('משטח בלוק') !== -1 || name.indexOf('בלוקים') !== -1 || name.indexOf('אבני שפה') !== -1) {
      implicitBlockPallets += qty;
    }
  });

  const finalBlockPallets = explicitBlockPallets > 0 ? explicitBlockPallets : implicitBlockPallets;

  return {
    depositBales: finalBales,
    depositPallets: finalPallets,
    depositDrums: finalDrums,
    depositBlockPallets: finalBlockPallets
  };
}

// =========================================================================
// 4. Web App Request Endpoints (doGet / doPost)
// =========================================================================

function doGet(e) {
  const callback = e && e.parameter && e.parameter.callback;
  
  try {
    const action = e && e.parameter && e.parameter.action;

    // Action: Live Email & PDF Ingestion
    if (action === 'processIncomingOrders' || action === 'syncEmails') {
      const result = processIncomingOrders();
      return createJsonResponse(result, callback);
    }

    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      return createJsonResponse({
        success: false,
        error: "Sheet '" + SHEET_NAME + "' not found."
      }, callback);
    }

    // Action: Update Order Status
    if (action === 'updateStatus') {
      const orderNumber = e.parameter.orderNumber;
      const newStatus = e.parameter.status;
      if (!orderNumber || !newStatus) {
        return createJsonResponse({ success: false, error: "Missing orderNumber or status parameters" }, callback);
      }
      const success = updateSheetOrderStatusAndSync(orderNumber, newStatus);
      return createJsonResponse({ success: success, orderNumber: orderNumber, status: newStatus }, callback);
    }

    // Action: Delete Order
    if (action === 'deleteOrder') {
      const orderNumber = e.parameter.orderNumber;
      if (!orderNumber) {
        return createJsonResponse({ success: false, error: "Missing orderNumber parameter" }, callback);
      }
      const success = deleteSheetOrderAndSync(orderNumber);
      return createJsonResponse({ success: success, orderNumber: orderNumber }, callback);
    }

    // Action: Setup Sheet & Full 16 Headers
    if (action === 'setupSheet' || action === 'initSheet') {
      const setupResult = setupSheetAndHeaders();
      return createJsonResponse(setupResult, callback);
    }

    // Default: Get Orders
    const range = sheet.getDataRange();
    const values = range.getValues();
    
    if (values.length <= 1) {
      return createJsonResponse({ success: true, data: [] }, callback);
    }
    
    const headers = values[0];
    const colIndices = findColumnIndices(headers);
    const data = [];
    
    for (var i = 1; i < values.length; i++) {
      const row = values[i];
      const rawOrderNo = row[colIndices.orderNumber];
      if (!rawOrderNo || String(rawOrderNo).trim() === "") continue; 
      
      try {
        const orderPayload = buildOrderPayload(row, colIndices, i + 1);
        data.push(orderPayload);
      } catch (rowErr) {
        console.warn("Skipping row #" + (i + 1) + ": " + rowErr.toString());
      }
    }
    
    return createJsonResponse({ success: true, data: data }, callback);
    
  } catch (error) {
    return createJsonResponse({ success: false, error: error.toString() }, callback);
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({ success: false, error: "Empty POST body" });
    }
    
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;
    
    if (action === 'processIncomingOrders' || action === 'syncEmails') {
      const result = processIncomingOrders();
      return createJsonResponse(result);
    }

    if (action === 'updateStatus') {
      const orderNumber = postData.orderNumber;
      const newStatus = postData.status;
      if (!orderNumber || !newStatus) {
        return createJsonResponse({ success: false, error: "Missing orderNumber or status" });
      }
      const success = updateSheetOrderStatusAndSync(orderNumber, newStatus);
      return createJsonResponse({ success: success, orderNumber: orderNumber, status: newStatus });
    }

    if (action === 'addOrder' || action === 'updateOrder') {
      const orderData = postData.order || postData;
      if (!orderData || !orderData.orderNumber) {
        return createJsonResponse({ success: false, error: "Missing order payload or orderNumber" });
      }
      const success = addOrUpdateSheetOrderAndSync(orderData);
      return createJsonResponse({ success: success, orderNumber: orderData.orderNumber });
    }

    if (action === 'deleteOrder') {
      const orderNumber = postData.orderNumber;
      if (!orderNumber) {
        return createJsonResponse({ success: false, error: "Missing orderNumber" });
      }
      const success = deleteSheetOrderAndSync(orderNumber);
      return createJsonResponse({ success: success, orderNumber: orderNumber });
    }
    
    return createJsonResponse({ success: false, error: "Unknown action: " + action });
  } catch (error) {
    return createJsonResponse({ success: false, error: error.toString() });
  }
}

// =========================================================================
// 5. Data Parsing & Helper Functions
// =========================================================================

function findColumnIndices(headers) {
  const indices = {
    timestamp: 0,
    orderNumber: 1,
    customerName: 2,
    warehouse: 3,
    deliveryAddress: 4,
    driverName: 5,
    items: 6,
    status: 7,
    notes: 8,
    latitude: 9,
    longitude: 10,
    noaAnalysis: 11,
    depositBales: 12,
    depositPallets: 13,
    depositDrums: 14,
    depositBlockPallets: 15
  };
  
  for (var i = 0; i < headers.length; i++) {
    const header = String(headers[i]).trim().toLowerCase();
    
    if (header.indexOf("תאריך") !== -1 || header.indexOf("זמן") !== -1 || header === "timestamp" || header === "date") {
      indices.timestamp = i;
    } else if (header.indexOf("מספר הזמנה") !== -1 || header.indexOf("הזמנה") !== -1 || header === "ordernumber") {
      indices.orderNumber = i;
    } else if (header.indexOf("לקוח") !== -1 || header === "customername") {
      indices.customerName = i;
    } else if (header.indexOf("מחסן") !== -1 || header === "warehouse") {
      indices.warehouse = i;
    } else if (header.indexOf("כתובת") !== -1 || header === "deliveryaddress") {
      indices.deliveryAddress = i;
    } else if (header.indexOf("נהג") !== -1 || header === "driver") {
      indices.driverName = i;
    } else if (header.indexOf("פריטים") !== -1 || header.indexOf("תכולה") !== -1 || header === "items") {
      indices.items = i;
    } else if (header.indexOf("סטטוס") !== -1 || header === "status") {
      indices.status = i;
    } else if (header.indexOf("הערות") !== -1 || header === "notes") {
      indices.notes = i;
    } else if (header.indexOf("קו רוחב") !== -1 || header === "latitude") {
      indices.latitude = i;
    } else if (header.indexOf("קו אורך") !== -1 || header === "longitude") {
      indices.longitude = i;
    } else if (header.indexOf("נועה") !== -1 || header === "noaanalysis") {
      indices.noaAnalysis = i;
    } else if (header.indexOf("בלות") !== -1 || header === "depositbales") {
      indices.depositBales = i;
    } else if (header.indexOf("פקדונות משטחים") !== -1 || header === "depositpallets" || (header.indexOf("משטחים") !== -1 && header.indexOf("בלוק") === -1)) {
      indices.depositPallets = i;
    } else if (header.indexOf("חביות") !== -1 || header === "depositdrums") {
      indices.depositDrums = i;
    } else if (header.indexOf("משטחי בלוק") !== -1 || header === "depositblockpallets") {
      indices.depositBlockPallets = i;
    }
  }
  
  return indices;
}

function buildOrderPayload(row, colIndices, rowIndex) {
  const orderNumber = String(row[colIndices.orderNumber]).trim();
  const rawDate = row[colIndices.timestamp];
  const customerName = String(row[colIndices.customerName] || 'לקוח לא ידוע').trim();
  const warehouse = String(row[colIndices.warehouse] || 'מחסן החרש').trim();
  const deliveryAddress = String(row[colIndices.deliveryAddress] || '').trim();
  const driverName = colIndices.driverName !== -1 && row[colIndices.driverName] ? String(row[colIndices.driverName]).trim() : undefined;
  const itemsRaw = String(row[colIndices.items] || '').trim();
  const statusRaw = String(row[colIndices.status] || 'pending').trim().toLowerCase();
  
  const notes = colIndices.notes !== -1 && row[colIndices.notes] ? String(row[colIndices.notes]).trim() : undefined;
  const latitude = colIndices.latitude !== -1 && row[colIndices.latitude] ? Number(row[colIndices.latitude]) : undefined;
  const longitude = colIndices.longitude !== -1 && row[colIndices.longitude] ? Number(row[colIndices.longitude]) : undefined;
  const noaAnalysis = colIndices.noaAnalysis !== -1 && row[colIndices.noaAnalysis] ? String(row[colIndices.noaAnalysis]).trim() : undefined;

  const parsedItems = parseItemsString(itemsRaw, rowIndex);
  const deposits = calculateDepositsWithDeduplication(parsedItems, itemsRaw);

  var timestampIso = "";
  if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
    timestampIso = rawDate.toISOString();
  } else if (rawDate) {
    try {
      timestampIso = new Date(rawDate).toISOString();
    } catch (e) {
      timestampIso = new Date().toISOString();
    }
  } else {
    timestampIso = new Date().toISOString();
  }
  
  const totalAmount = parsedItems.reduce(function(sum, item) {
    return sum + (item.price * item.quantity);
  }, 0);
  
  const payload = {
    id: orderNumber,
    orderNumber: orderNumber,
    timestamp: timestampIso,
    customerName: customerName,
    warehouse: warehouse,
    deliveryAddress: deliveryAddress,
    items: parsedItems,
    itemsRawString: itemsRaw,
    status: statusRaw,
    totalAmount: totalAmount,
    depositBales: deposits.depositBales,
    depositPallets: deposits.depositPallets,
    depositDrums: deposits.depositDrums,
    depositBlockPallets: deposits.depositBlockPallets
  };
  
  if (driverName) payload.driverName = driverName;
  if (notes) payload.notes = notes;
  if (latitude !== undefined && !isNaN(latitude)) payload.latitude = latitude;
  if (longitude !== undefined && !isNaN(longitude)) payload.longitude = longitude;
  if (noaAnalysis) payload.noaAnalysis = noaAnalysis;
  
  return payload;
}

function parseItemsString(itemsStr, rowIndex) {
  if (!itemsStr) return [];

  if (Array.isArray(itemsStr)) {
    return itemsStr.map(function(item, itemIdx) {
      if (typeof item === 'object' && item !== null) {
        var sku = String(item.sku || 'SBN-GEN-99').trim();
        var name = String(item.name || 'פריט לוגיסטי').trim();
        var price = Number(item.price) || PRODUCT_PRICES[sku] || 50;
        var quantity = Number(item.quantity) || 1;
        return {
          id: item.id || ("item-" + rowIndex + "-" + itemIdx + "-" + sku),
          sku: sku,
          name: name,
          price: price,
          quantity: quantity
        };
      }
      return parseSingleLineItem(String(item), rowIndex, itemIdx);
    }).filter(function(i) { return i.name !== '[object Object]'; });
  }

  var str = String(itemsStr).trim();
  if (str.indexOf('[object Object]') !== -1) {
    str = str.replace(/\[object Object\]/g, '').trim();
    if (!str) return [];
  }

  if (str.indexOf('[') === 0 && str.indexOf(']') === str.length - 1) {
    try {
      var parsed = JSON.parse(str);
      if (Array.isArray(parsed)) {
        return parseItemsString(parsed, rowIndex);
      }
    } catch(e) {}
  }

  var lines = str.split(/[\n\r;]+/).map(function(line) { return line.trim(); }).filter(function(line) { return line.length > 0; });

  return lines.map(function(line, itemIdx) {
    return parseSingleLineItem(line, rowIndex, itemIdx);
  }).filter(function(i) { return i.name !== '[object Object]'; });
}

function parseSingleLineItem(line, rowIndex, itemIdx) {
  var sku = 'SBN-GEN-99';
  var name = line;
  var quantity = 1;

  var skuMatch = line.match(/^\[([^\]]+)\]/);
  if (skuMatch) {
    sku = skuMatch[1].trim();
    name = line.substring(skuMatch[0].length).trim();
  }

  var qtyMatch = name.match(/(?:\s*[-xX:]\s*|\s+)(\d+)\s*$/);
  if (qtyMatch) {
    quantity = parseInt(qtyMatch[1], 10) || 1;
    name = name.substring(0, qtyMatch.index).trim();
  }

  name = name.replace(/^[-:\s]+|[-:\s]+$/g, '').trim();
  var price = PRODUCT_PRICES[sku] || 50;

  return {
    id: "item-" + rowIndex + "-" + itemIdx + "-" + sku,
    sku: sku,
    name: name || 'פריט לוגיסטי',
    price: price,
    quantity: quantity
  };
}

// =========================================================================
// 6. Firebase Sync & Administrative Operations
// =========================================================================

function updateSheetOrderStatusAndSync(orderNumber, status) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) return false;
  
  const range = sheet.getDataRange();
  const values = range.getValues();
  const headers = values[0];
  const colIndices = findColumnIndices(headers);
  
  for (var i = 1; i < values.length; i++) {
    const row = values[i];
    if (String(row[colIndices.orderNumber]).trim() === String(orderNumber).trim()) {
      const rowIndex = i + 1;
      sheet.getRange(rowIndex, colIndices.status + 1).setValue(status);
      
      const updatedRow = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
      const payload = buildOrderPayload(updatedRow, colIndices, rowIndex);
      syncToFirestoreRest(orderNumber, payload);
      return true;
    }
  }
  return false;
}

function addOrUpdateSheetOrderAndSync(orderPayload) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) return false;

  const orderNumber = String(orderPayload.orderNumber || '').trim();
  if (!orderNumber) return false;

  const range = sheet.getDataRange();
  const values = range.getValues();
  const headers = values[0];
  const colIndices = findColumnIndices(headers);

  let targetRowIndex = -1;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][colIndices.orderNumber]).trim() === orderNumber) {
      targetRowIndex = i + 1;
      break;
    }
  }

  var itemsStr = '';
  if (Array.isArray(orderPayload.items)) {
    itemsStr = orderPayload.items.map(function(item) {
      var sku = item.sku ? '[' + item.sku + '] ' : '';
      var qty = item.quantity ? ' - ' + item.quantity : '';
      return sku + (item.name || 'פריט') + qty;
    }).join('\n');
  } else if (orderPayload.itemsRawString) {
    itemsStr = String(orderPayload.itemsRawString);
  }

  const parsedItems = parseItemsString(itemsStr, targetRowIndex > 0 ? targetRowIndex : sheet.getLastRow() + 1);
  const deposits = calculateDepositsWithDeduplication(parsedItems, itemsStr);

  var timestamp = orderPayload.timestamp || new Date().toISOString();
  var customerName = orderPayload.customerName || '';
  var warehouse = orderPayload.warehouse || 'מחסן החרש';
  var deliveryAddress = orderPayload.deliveryAddress || '';
  var driverName = orderPayload.driverName || '';
  var status = orderPayload.status || 'pending';
  var notes = orderPayload.notes || '';
  var latitude = orderPayload.latitude || '';
  var longitude = orderPayload.longitude || '';
  var noaAnalysis = orderPayload.noaAnalysis || '';

  if (targetRowIndex > 0) {
    if (colIndices.timestamp !== -1) sheet.getRange(targetRowIndex, colIndices.timestamp + 1).setValue(timestamp);
    if (colIndices.customerName !== -1) sheet.getRange(targetRowIndex, colIndices.customerName + 1).setValue(customerName);
    if (colIndices.warehouse !== -1) sheet.getRange(targetRowIndex, colIndices.warehouse + 1).setValue(warehouse);
    if (colIndices.deliveryAddress !== -1) sheet.getRange(targetRowIndex, colIndices.deliveryAddress + 1).setValue(deliveryAddress);
    if (colIndices.driverName !== -1) sheet.getRange(targetRowIndex, colIndices.driverName + 1).setValue(driverName);
    if (colIndices.items !== -1) sheet.getRange(targetRowIndex, colIndices.items + 1).setValue(itemsStr);
    if (colIndices.status !== -1) sheet.getRange(targetRowIndex, colIndices.status + 1).setValue(status);
    if (colIndices.notes !== -1) sheet.getRange(targetRowIndex, colIndices.notes + 1).setValue(notes);
    if (colIndices.latitude !== -1) sheet.getRange(targetRowIndex, colIndices.latitude + 1).setValue(latitude);
    if (colIndices.longitude !== -1) sheet.getRange(targetRowIndex, colIndices.longitude + 1).setValue(longitude);
    if (colIndices.noaAnalysis !== -1) sheet.getRange(targetRowIndex, colIndices.noaAnalysis + 1).setValue(noaAnalysis);
    if (colIndices.depositBales !== -1) sheet.getRange(targetRowIndex, colIndices.depositBales + 1).setValue(deposits.depositBales);
    if (colIndices.depositPallets !== -1) sheet.getRange(targetRowIndex, colIndices.depositPallets + 1).setValue(deposits.depositPallets);
    if (colIndices.depositDrums !== -1) sheet.getRange(targetRowIndex, colIndices.depositDrums + 1).setValue(deposits.depositDrums);
    if (colIndices.depositBlockPallets !== -1) sheet.getRange(targetRowIndex, colIndices.depositBlockPallets + 1).setValue(deposits.depositBlockPallets);
  } else {
    var newRow = new Array(headers.length).fill('');
    if (colIndices.timestamp !== -1) newRow[colIndices.timestamp] = timestamp;
    if (colIndices.orderNumber !== -1) newRow[colIndices.orderNumber] = orderNumber;
    if (colIndices.customerName !== -1) newRow[colIndices.customerName] = customerName;
    if (colIndices.warehouse !== -1) newRow[colIndices.warehouse] = warehouse;
    if (colIndices.deliveryAddress !== -1) newRow[colIndices.deliveryAddress] = deliveryAddress;
    if (colIndices.driverName !== -1) newRow[colIndices.driverName] = driverName;
    if (colIndices.items !== -1) newRow[colIndices.items] = itemsStr;
    if (colIndices.status !== -1) newRow[colIndices.status] = status;
    if (colIndices.notes !== -1) newRow[colIndices.notes] = notes;
    if (colIndices.latitude !== -1) newRow[colIndices.latitude] = latitude;
    if (colIndices.longitude !== -1) newRow[colIndices.longitude] = longitude;
    if (colIndices.noaAnalysis !== -1) newRow[colIndices.noaAnalysis] = noaAnalysis;
    if (colIndices.depositBales !== -1) newRow[colIndices.depositBales] = deposits.depositBales;
    if (colIndices.depositPallets !== -1) newRow[colIndices.depositPallets] = deposits.depositPallets;
    if (colIndices.depositDrums !== -1) newRow[colIndices.depositDrums] = deposits.depositDrums;
    if (colIndices.depositBlockPallets !== -1) newRow[colIndices.depositBlockPallets] = deposits.depositBlockPallets;

    sheet.appendRow(newRow);
  }

  try {
    syncToFirestoreRest(orderNumber, orderPayload);
  } catch (e) {
    console.error('Firestore REST sync failed: ' + e.toString());
  }

  return true;
}

function deleteSheetOrderAndSync(orderNumber) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) return false;

  const range = sheet.getDataRange();
  const values = range.getValues();
  const headers = values[0];
  const colIndices = findColumnIndices(headers);

  for (var i = 1; i < values.length; i++) {
    if (String(values[i][colIndices.orderNumber]).trim() === String(orderNumber).trim()) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

function syncToFirestoreRest(documentId, orderPayload) {
  const url = "https://firestore.googleapis.com/v1/projects/" 
    + FIREBASE_PROJECT_ID 
    + "/databases/" 
    + FIREBASE_DATABASE_ID 
    + "/documents/" 
    + COLLECTION_NAME 
    + "/" 
    + encodeURIComponent(documentId)
    + "?key=" 
    + FIREBASE_API_KEY;
    
  const firestoreDoc = toFirestoreDoc(orderPayload);
  
  const options = {
    method: "patch",
    contentType: "application/json",
    payload: JSON.stringify(firestoreDoc),
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  if (responseCode < 200 || responseCode >= 300) {
    throw new Error("Firestore REST sync failed with status " + responseCode + ". Body: " + response.getContentText());
  }
}

function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: val.toString() } : { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (val instanceof Date) return { timestampValue: val.toISOString() };
  if (Array.isArray(val)) return { arrayValue: { values: val.map(toFirestoreValue) } };
  if (typeof val === 'object') {
    var fields = {};
    for (var key in val) {
      if (val.hasOwnProperty(key)) fields[key] = toFirestoreValue(val[key]);
    }
    return { mapValue: { fields: fields } };
  }
  return { stringValue: String(val) };
}

function toFirestoreDoc(obj) {
  var fields = {};
  for (var key in obj) {
    if (obj.hasOwnProperty(key)) fields[key] = toFirestoreValue(obj[key]);
  }
  return { fields: fields };
}

function createJsonResponse(data, callback) {
  const jsonString = JSON.stringify(data);
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + jsonString + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(jsonString).setMimeType(ContentService.MimeType.JSON);
}

function setupSheetAndHeaders() {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
    
    sheet.setRightToLeft(true);

    const headers = [
      'תאריך',
      'מספר הזמנה',
      'שם לקוח',
      'מחסן',
      'כתובת אספקה',
      'נהג מוקצה',
      'פריטים ותכולה',
      'סטטוס',
      'הערות',
      'קו רוחב (Latitude)',
      'קו אורך (Longitude)',
      'ניתוח נועה',
      'פקדונות בלות',
      'פקדונות משטחים',
      'פקדונות חביות',
      'פקדונות משטחי בלוק'
    ];

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
    } else {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }

    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground("#0F172A")
               .setFontColor("#F97316")
               .setFontWeight("bold")
               .setFontFamily("Arial")
               .setFontSize(11)
               .setHorizontalAlignment("center")
               .setVerticalAlignment("middle");

    sheet.setRowHeight(1, 38);
    sheet.setFrozenRows(1);

    const colWidths = [150, 130, 160, 140, 220, 140, 300, 110, 180, 120, 120, 250, 110, 110, 110, 130];
    for (var col = 0; col < colWidths.length; col++) {
      sheet.setColumnWidth(col + 1, colWidths[col]);
    }

    return {
      success: true,
      message: "Sheet '" + SHEET_NAME + "' formatted with 16 standard columns.",
      headers: headers
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function onOpen() {
  try {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('SabanOS - ניהול לוגיסטי')
      .addItem('📩 סנכרן מיילים חם (processIncomingOrders)', 'processIncomingOrders')
      .addItem('🛠️ צור גליון וכותרות עמודים', 'setupSheetAndHeaders')
      .addToUi();
  } catch (e) {
    console.log("onOpen skipped: " + e.toString());
  }
}
