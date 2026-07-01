/**
 * SabanOS - Production Google Sheets Systems Integrator
 * Sheet ID: 1Y_2N4Gs-lvAiv8fvLk9zvIhVQt5YxNPz6mCOnlh6lh8
 * Sheet Name: לוג_הזמנות_מערכת
 * 
 * Instructions:
 * 1. Open your Google Sheet
 * 2. Click Extensions -> Apps Script
 * 3. Replace all code with this file's contents
 * 4. Click Deploy -> New Deployment
 * 5. Choose Type: Web App
 * 6. Set "Execute as": Me
 * 7. Set "Who has access": Anyone
 * 8. Click Deploy, authorize permissions, and copy the Web App URL.
 * 9. Paste this URL into the SabanOS dashboard settings panel.
 */

const SHEET_ID = "1Y_2N4Gs-lvAiv8fvLk9zvIhVQt5YxNPz6mCOnlh6lh8";
const SHEET_NAME = "לוג_הזמנות_מערכת";

/**
 * Handle GET requests to fetch live logistics orders or perform query-based actions
 */
function doGet(e) {
  // Support JSONP or CORS
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

    // Determine requested action
    const action = e && e.parameter && e.parameter.action;

    // Handle query parameter actions (e.g. updating order status via GET for simplicity)
    if (action === 'updateStatus') {
      const orderNumber = e.parameter.orderNumber;
      const newStatus = e.parameter.status;
      if (!orderNumber || !newStatus) {
        return createJsonResponse({ success: false, error: "Missing orderNumber or status parameters" }, callback);
      }
      const success = updateSheetOrderStatus(orderNumber, newStatus);
      return createJsonResponse({ success: success, orderNumber: orderNumber, status: newStatus }, callback);
    }

    // Default to fetch orders if action is empty or is specifically 'getOrders'
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
    
    const data = [];
    
    // Row 0 is header. Loop through remaining rows.
    for (var i = 1; i < values.length; i++) {
      const row = values[i];
      // Skip row if Order Number is empty or blank
      if (!row[1] || String(row[1]).trim() === "") continue; 
      
      // Map precisely to production indices:
      // [0] תאריך קליטה (timestamp)
      // [1] הזמנה (orderNumber / Order Number)
      // [2] לקוח (customerName / Customer)
      // [3] מחסן (warehouse / Warehouse)
      // [4] כתובת (deliveryAddress / Address)
      // [5] פריטים (items string: newline-separated, format like [SKU] Name - Qty)
      // [6] סטטוס (status / Status/Make)
      // [7] מודל מנצח (modelUsed / Model)
      // [8] טוקנים (tokens / Tokens)
      // [9] מזהה מייל (messageId / Message ID)
      
      data.push({
        timestamp: row[0] ? formatCellDate(row[0]) : "",
        orderNumber: String(row[1]).trim(),
        customerName: String(row[2]).trim(),
        warehouse: String(row[3]).trim(),
        deliveryAddress: String(row[4]).trim(),
        items: String(row[5] || "").trim(),
        status: String(row[6] || "pending").trim().toLowerCase(),
        modelUsed: String(row[7] || "").trim(),
        tokens: Number(row[8]) || 0,
        messageId: String(row[9] || "").trim()
      });
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
      
      const success = updateSheetOrderStatus(orderNumber, newStatus);
      return createJsonResponse({ success: success, orderNumber: orderNumber, status: newStatus });
    }
    
    return createJsonResponse({ success: false, error: "Unknown action: " + action });
  } catch (error) {
    return createJsonResponse({ success: false, error: error.toString() });
  }
}

/**
 * Find order row in sheet and update its status cell (Column Index 6 -> Column G)
 */
function updateSheetOrderStatus(orderNumber, status) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) return false;
  
  const range = sheet.getDataRange();
  const values = range.getValues();
  
  for (var i = 1; i < values.length; i++) {
    // Column [1] is 'הזמנה' (orderNumber)
    if (String(values[i][1]).trim() === String(orderNumber).trim()) {
      // Column [6] (G) is 'סטטוס' (status).
      // Row is i + 1 (1-indexed in Google Sheets), Column G is 7.
      sheet.getRange(i + 1, 7).setValue(status);
      return true;
    }
  }
  return false;
}

/**
 * Helper to format date cells safely to ISO strings
 */
function formatCellDate(cellValue) {
  if (cellValue instanceof Date) {
    return cellValue.toISOString();
  }
  try {
    const d = new Date(cellValue);
    if (!isNaN(d.getTime())) {
      return d.toISOString();
    }
  } catch (e) {}
  return String(cellValue);
}

/**
 * Helper to build standard cross-origin JSON responses
 */
function createJsonResponse(data, callback) {
  const jsonString = JSON.stringify(data);
  
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + jsonString + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  
  return ContentService.createTextOutput(jsonString)
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
