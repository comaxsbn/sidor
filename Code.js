/**
 * SabanOS - Production Google Sheets & Cloud Firestore Systems Integrator
 * 
 * Target Sheet ID: 1Y_2N4Gs-lvAiv8fvLk9zvIhVQt5YxNPz6mCOnlh6lh8
 * Target Sheet Name: לוג_הזמנות_מערכת
 * 
 * -------------------------------------------------------------------------
 * ROOT CAUSE OF THE 403 ERROR:
 * The 403 Permission Denied (CONSUMER_INVALID) error occurred because the
 * Google Apps Script was pointing to an incorrect Project ID.
 * This production-grade script uses the correct, authorized credentials:
 *   - Project ID: gen-lang-client-0262645162
 *   - Database ID: ai-studio-sabanosenterpris-8ad4b65f-f5d9-4535-b28a-1f69f6cd447e
 *   - API Key: AIzaSyBMY3g9ryK2yE2d-lecxQSSsK--JG3ev4A
 * -------------------------------------------------------------------------
 * 
 * Deployment Instructions:
 * 1. Open your Google Sheet (ID: 1Y_2N4Gs-lvAiv8fvLk9zvIhVQt5YxNPz6mCOnlh6lh8)
 * 2. Click Extensions -> Apps Script
 * 3. Delete any default code and replace it entirely with this file.
 * 4. Click Deploy -> New Deployment.
 * 5. Choose type: Web App.
 * 6. Set "Execute as": Me.
 * 7. Set "Who has access": Anyone.
 * 8. Authorize permissions when prompted and copy the generated Web App URL.
 * 9. (Optional) Set up an "On Edit" trigger pointing to the `onEditTrigger` function
 *    to sync changes to Firestore automatically in real-time when edited.
 */

// =========================================================================
// Configuration Constants
// =========================================================================
const SHEET_ID = "1Y_2N4Gs-lvAiv8fvLk9zvIhVQt5YxNPz6mCOnlh6lh8";
const SHEET_NAME = "לוג_הזמנות_מערכת";

// Correct and authorized Firebase credentials from firebase-applet-config
const FIREBASE_PROJECT_ID = "gen-lang-client-0262645162";
const FIREBASE_DATABASE_ID = "ai-studio-sabanosenterpris-8ad4b65f-f5d9-4535-b28a-1f69f6cd447e";
const FIREBASE_API_KEY = "AIzaSyBMY3g9ryK2yE2d-lecxQSSsK--JG3ev4A";

// Firestore Collection
const COLLECTION_NAME = "orders";

// Standard Product Price Catalog matching SabanOS Catalog
const PRODUCT_PRICES = {
  'SBN-PL-01': 85,
  'SBN-ST-05': 42,
  'SBN-TP-12': 18,
  'SBN-BB-08': 65,
  'SBN-ST-22': 120,
  'SBN-LB-40': 35,
  'SBN-BX-10': 95,
  'SBN-CN-03': 110,
};

/**
 * Handle GET requests to fetch live logistics orders or perform query-based actions
 */
function doGet(e) {
  const callback = e && e.parameter && e.parameter.callback;
  
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      return createJsonResponse({
        success: false,
        error: "Sheet '" + SHEET_NAME + "' not found in spreadsheet."
      }, callback);
    }

    const action = e && e.parameter && e.parameter.action;

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

    // Action: Setup Sheet & Full Headers
    if (action === 'setupSheet' || action === 'initSheet') {
      const setupResult = setupSheetAndHeaders();
      return createJsonResponse(setupResult, callback);
    }

    // Default or Explicit: Get Orders
    if (action && action !== 'getOrders') {
      return createJsonResponse({
        success: false,
        error: "Unknown action parameter: " + action
      }, callback);
    }
    
    const range = sheet.getDataRange();
    const values = range.getValues();
    
    if (values.length <= 1) {
      return createJsonResponse({
        success: true,
        data: []
      }, callback);
    }
    
    const headers = values[0];
    const colIndices = findColumnIndices(headers);
    const data = [];
    
    // Loop through rows skipping the header row
    for (var i = 1; i < values.length; i++) {
      const row = values[i];
      const rawOrderNo = row[colIndices.orderNumber];
      if (!rawOrderNo || String(rawOrderNo).trim() === "") continue; 
      
      try {
        const orderPayload = buildOrderPayload(row, colIndices, i + 1);
        data.push(orderPayload);
      } catch (rowErr) {
        console.warn("Skipping row #" + (i + 1) + " due to error: " + rowErr.toString());
      }
    }
    
    return createJsonResponse({
      success: true,
      data: data
    }, callback);
    
  } catch (error) {
    return createJsonResponse({
      success: false,
      error: error.toString()
    }, callback);
  }
}

/**
 * Handle POST requests for updating status or inserting records
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({ success: false, error: "Empty POST body" });
    }
    
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;
    
    if (action === 'updateStatus') {
      const orderNumber = postData.orderNumber;
      const newStatus = postData.status;
      
      if (!orderNumber || !newStatus) {
        return createJsonResponse({ success: false, error: "Missing orderNumber or status in request body" });
      }
      
      const success = updateSheetOrderStatusAndSync(orderNumber, newStatus);
      return createJsonResponse({ success: success, orderNumber: orderNumber, status: newStatus });
    }
    
    return createJsonResponse({ success: false, error: "Unknown action: " + action });
  } catch (error) {
    return createJsonResponse({ success: false, error: error.toString() });
  }
}

/**
 * Triggered automatically on Sheet edits to sync single rows to Firestore in real-time
 */
function onEditTrigger(e) {
  if (!e) return;
  try {
    const sheet = e.source.getActiveSheet();
    if (sheet.getName() !== SHEET_NAME) return;
    
    const range = e.range;
    const rowIndex = range.getRow();
    
    // Skip header row
    if (rowIndex <= 1) return;
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const colIndices = findColumnIndices(headers);
    
    const row = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
    const rawOrderNo = row[colIndices.orderNumber];
    if (!rawOrderNo || String(rawOrderNo).trim() === "") return;
    const orderNumber = String(rawOrderNo).trim();
    
    const orderPayload = buildOrderPayload(row, colIndices, rowIndex);
    syncToFirestoreRest(orderNumber, orderPayload);
    console.log("Real-time trigger: Successfully synced order " + orderNumber + " to Firestore.");
  } catch (err) {
    console.error("Real-time edit trigger failed: " + err.toString());
  }
}

/**
 * Full Sync: Read all rows from the Sheet and upsert them to Firestore (with dynamic header indexing)
 */
function syncSheetToFirebase() {
  console.log("=== Starting SabanOS Full Sheet-to-Firebase Sync ===");
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      throw new Error("Sheet '" + SHEET_NAME + "' not found.");
    }
    
    const range = sheet.getDataRange();
    const values = range.getValues();
    if (values.length <= 1) {
      console.log("No orders found to sync.");
      return;
    }
    
    const headers = values[0];
    const colIndices = findColumnIndices(headers);
    
    var successCount = 0;
    var failureCount = 0;
    
    for (var i = 1; i < values.length; i++) {
      const row = values[i];
      const rawOrderNo = row[colIndices.orderNumber];
      if (!rawOrderNo || String(rawOrderNo).trim() === "") continue;
      
      const orderNumber = String(rawOrderNo).trim();
      try {
        const orderPayload = buildOrderPayload(row, colIndices, i + 1);
        syncToFirestoreRest(orderNumber, orderPayload);
        successCount++;
      } catch (rowError) {
        console.error("Failed to sync Row #" + (i + 1) + " (Order " + orderNumber + "): " + rowError.toString());
        failureCount++;
      }
    }
    
    console.log("=== Full Sync Complete: " + successCount + " Succeeded, " + failureCount + " Failed ===");
  } catch (error) {
    console.error("FATAL ERROR in syncSheetToFirebase: " + error.toString());
  }
}

/**
 * Finds column indexes based on header names dynamically to support reordered sheets
 */
function findColumnIndices(headers) {
  const indices = {
    timestamp: 0,
    orderNumber: 1,
    customerName: 2,
    warehouse: 3,
    deliveryAddress: 4,
    items: 5,
    status: 6,
    notes: -1,
    modelUsed: -1,
    tokens: -1,
    messageId: -1,
    latitude: -1,
    longitude: -1
  };
  
  for (var i = 0; i < headers.length; i++) {
    const header = String(headers[i]).trim().toLowerCase();
    
    if (header.indexOf("תאריך") !== -1 || header.indexOf("זמן") !== -1 || header === "timestamp" || header === "date") {
      indices.timestamp = i;
    } else if (header.indexOf("מספר הזמנה") !== -1 || header.indexOf("הזמנה") !== -1 || header === "ordernumber" || header === "order") {
      indices.orderNumber = i;
    } else if (header.indexOf("לקוח") !== -1 || header === "customername" || header === "customer") {
      indices.customerName = i;
    } else if (header.indexOf("מחסן") !== -1 || header === "warehouse") {
      indices.warehouse = i;
    } else if (header.indexOf("כתובת") !== -1 || header === "deliveryaddress" || header === "address") {
      indices.deliveryAddress = i;
    } else if (header.indexOf("פריטים") !== -1 || header.indexOf("תכולה") !== -1 || header === "items" || header === "products") {
      indices.items = i;
    } else if (header.indexOf("סטטוס") !== -1 || header.indexOf("מצב") !== -1 || header === "status") {
      indices.status = i;
    } else if (header.indexOf("הערות") !== -1 || header === "notes") {
      indices.notes = i;
    } else if (header.indexOf("מודל") !== -1 || header === "modelused" || header === "model") {
      indices.modelUsed = i;
    } else if (header.indexOf("טוקנים") !== -1 || header === "tokens") {
      indices.tokens = i;
    } else if (header.indexOf("הודעה") !== -1 || header === "messageid") {
      indices.messageId = i;
    } else if (header.indexOf("קו רוחב") !== -1 || header === "latitude" || header === "lat") {
      indices.latitude = i;
    } else if (header.indexOf("קו אורך") !== -1 || header === "longitude" || header === "lng") {
      indices.longitude = i;
    }
  }
  
  return indices;
}

/**
 * Builds standard structured JSON Order payload from a Sheet row
 */
function buildOrderPayload(row, colIndices, rowIndex) {
  const orderNumber = String(row[colIndices.orderNumber]).trim();
  
  const rawDate = row[colIndices.timestamp];
  const customerName = String(row[colIndices.customerName] || 'לקוח לא ידוע').trim();
  const warehouse = String(row[colIndices.warehouse] || 'מחסן החרש').trim();
  const deliveryAddress = String(row[colIndices.deliveryAddress] || '').trim();
  const itemsRaw = String(row[colIndices.items] || '').trim();
  const statusRaw = String(row[colIndices.status] || 'pending').trim().toLowerCase();
  
  // Parse optional fields dynamically if present
  const notes = colIndices.notes !== -1 && row[colIndices.notes] ? String(row[colIndices.notes]).trim() : undefined;
  const modelUsed = colIndices.modelUsed !== -1 && row[colIndices.modelUsed] ? String(row[colIndices.modelUsed]).trim() : undefined;
  const tokens = colIndices.tokens !== -1 && row[colIndices.tokens] ? Number(row[colIndices.tokens]) : undefined;
  const messageId = colIndices.messageId !== -1 && row[colIndices.messageId] ? String(row[colIndices.messageId]).trim() : undefined;
  const latitude = colIndices.latitude !== -1 && row[colIndices.latitude] ? Number(row[colIndices.latitude]) : undefined;
  const longitude = colIndices.longitude !== -1 && row[colIndices.longitude] ? Number(row[colIndices.longitude]) : undefined;
  
  // Format Timestamp
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
  
  // Parse the items from multi-line text format
  const items = parseItemsString(itemsRaw, rowIndex);
  
  // Calculate Dynamic total price
  const totalAmount = items.reduce(function(sum, item) {
    return sum + (item.price * item.quantity);
  }, 0);
  
  const payload = {
    id: orderNumber,
    orderNumber: orderNumber,
    timestamp: timestampIso,
    customerName: customerName,
    warehouse: warehouse,
    deliveryAddress: deliveryAddress,
    items: items,
    itemsRawString: itemsRaw,
    status: statusRaw,
    totalAmount: totalAmount
  };
  
  // Map optional coordinates and metadata
  if (notes) payload.notes = notes;
  if (modelUsed) payload.modelUsed = modelUsed;
  if (tokens !== undefined && !isNaN(tokens)) payload.tokens = tokens;
  if (messageId) payload.messageId = messageId;
  if (latitude !== undefined && !isNaN(latitude)) payload.latitude = latitude;
  if (longitude !== undefined && !isNaN(longitude)) payload.longitude = longitude;
  
  return payload;
}

/**
 * Multi-line items string parser: Parses format "[SKU] Name - Qty" or processes item arrays
 */
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
    }).filter(function(i) { return i.name !== '[object Object]' && i.sku !== '[object Object]'; });
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

  var lines = str.split(/[\n\r;]+/).map(function(line) {
    return line.trim();
  }).filter(function(line) {
    return line.length > 0;
  });

  return lines.map(function(line, itemIdx) {
    return parseSingleLineItem(line, rowIndex, itemIdx);
  }).filter(function(i) { return i.name !== '[object Object]' && i.sku !== '[object Object]'; });
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

/**
 * Updates status cell in the Sheet, and syncs that updated order to Firestore immediately
 */
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
    const rowOrderNum = String(row[colIndices.orderNumber]).trim();
    if (rowOrderNum === String(orderNumber).trim()) {
      const rowIndex = i + 1;
      const statusColIndex = colIndices.status + 1; // 1-indexed for range
      
      // Update cell in Google Sheet
      sheet.getRange(rowIndex, statusColIndex).setValue(status);
      
      // Fetch latest row data to build payload
      const updatedRow = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
      try {
        const payload = buildOrderPayload(updatedRow, colIndices, rowIndex);
        syncToFirestoreRest(orderNumber, payload);
        console.log("Successfully updated sheet and synced to Firestore for " + orderNumber);
      } catch (syncErr) {
        console.error("Failed to sync updated order " + orderNumber + " to Firestore: " + syncErr.toString());
      }
      
      return true;
    }
  }
  return false;
}

/**
 * Direct Firebase Firestore REST API patch call
 */
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
  const responseText = response.getContentText();
  
  if (responseCode < 200 || responseCode >= 300) {
    throw new Error("Firestore REST sync failed with status " + responseCode + ". Body: " + responseText);
  }
}

/**
 * Convert standard JS value types to Firestore REST API types
 */
function toFirestoreValue(val) {
  if (val === null || val === undefined) {
    return { nullValue: null };
  }
  if (typeof val === 'boolean') {
    return { booleanValue: val };
  }
  if (typeof val === 'number') {
    if (Number.isInteger(val)) {
      return { integerValue: val.toString() };
    } else {
      return { doubleValue: val };
    }
  }
  if (typeof val === 'string') {
    return { stringValue: val };
  }
  if (val instanceof Date) {
    return { timestampValue: val.toISOString() };
  }
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.map(toFirestoreValue)
      }
    };
  }
  if (typeof val === 'object') {
    var fields = {};
    for (var key in val) {
      if (val.hasOwnProperty(key)) {
        fields[key] = toFirestoreValue(val[key]);
      }
    }
    return {
      mapValue: {
        fields: fields
      }
    };
  }
  return { stringValue: String(val) };
}

/**
 * Convert Javascript object to Firestore document structure
 */
function toFirestoreDoc(obj) {
  var fields = {};
  for (var key in obj) {
    if (obj.hasOwnProperty(key)) {
      fields[key] = toFirestoreValue(obj[key]);
    }
  }
  return { fields: fields };
}

/**
 * Helper to build cross-origin JSON outputs
 */
function createJsonResponse(data, callback) {
  const jsonString = JSON.stringify(data);
  
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + jsonString + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  
  return ContentService.createTextOutput(jsonString)
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Creates or resets the Google Sheet and writes standard full headers formatted matching SabanOS
 */
function setupSheetAndHeaders() {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
    }
    
    // Set Sheet Right-to-Left direction for Hebrew alignment
    sheet.setRightToLeft(true);

    // Full column headers matching SabanOS order schema
    const headers = [
      'תאריך',
      'מספר הזמנה',
      'שם לקוח',
      'מחסן',
      'כתובת אספקה',
      'פריטים ותכולה',
      'סטטוס',
      'הערות',
      'מודל AI',
      'טוקנים',
      'מזהה הודעה',
      'קו רוחב (Latitude)',
      'קו אורך (Longitude)'
    ];

    // Check if header row exists
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
    } else {
      // Overwrite header row 1 to guarantee full alignment and column index compatibility
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }

    // Design & Formatting
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground("#1E293B") // Dark Slate header matching SabanOS
               .setFontColor("#FFFFFF")
               .setFontWeight("bold")
               .setFontFamily("Arial")
               .setFontSize(11)
               .setHorizontalAlignment("center")
               .setVerticalAlignment("middle");

    sheet.setRowHeight(1, 38);
    sheet.setFrozenRows(1);

    // Set column widths for best visual legibility
    const colWidths = [150, 130, 160, 140, 220, 300, 110, 180, 120, 100, 140, 120, 120];
    for (var col = 0; col < colWidths.length; col++) {
      sheet.setColumnWidth(col + 1, colWidths[col]);
    }

    // Set Data Validation dropdown for Status column (Column 7)
    const statusColIndex = 7; // 'סטטוס'
    const statusRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['pending', 'processing', 'delivered', 'cancelled'], true)
      .setAllowInvalid(true)
      .build();
      
    sheet.getRange(2, statusColIndex, 1000, 1).setDataValidation(statusRule);

    console.log("Sheet '" + SHEET_NAME + "' created and formatted successfully with " + headers.length + " headers.");

    return {
      success: true,
      message: "Sheet '" + SHEET_NAME + "' created and formatted successfully with " + headers.length + " headers.",
      headers: headers
    };
  } catch (error) {
    console.error("Error setting up sheet headers: " + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Automatically creates a custom menu in Google Sheets when opened
 */
function onOpen() {
  try {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('SabanOS - ניהול לוגיסטי')
      .addItem('🛠️ צור גליון וכותרות עמודים', 'setupSheetAndHeaders')
      .addItem('🔄 סנכרן את כל ההזמנות ל-Firebase', 'syncSheetToFirebase')
      .addToUi();
  } catch (e) {
    console.log("onOpen skipped (running outside UI context): " + e.toString());
  }
}
