/**
 * SabanOS - Production Google Apps Script & Cloud Firestore Integration Engine
 * 
 * Target Sheet ID: 1Y_2N4Gs-lvAiv8fvLk9zvIhVQt5YxNPz6mCOnlh6lh8
 * Target Sheet Name: לוג_הזמנות_מערכת
 * 
 * Features Included:
 * 1. Automatic deposit calculation across 4 deposit categories (בלות, משטחים, חביות, משטחי בלוק).
 * 2. Anti-double-counting engine (מנגנון מניעת כפל חישוב): Gives priority to explicit deposit SKUs 
 *    (e.g., SKU 60002 for Bale Deposit) and overrides automatic dictionary calculations (e.g., SKU 11511).
 * 3. Real-time `onEdit(e)` trigger for interactive sheet editing and instant deposit calculation updates.
 * 4. Automatic real-time sync with Firebase Firestore via REST API.
 * 5. Web App REST endpoints (doGet/doPost) for frontend integration.
 */

// =========================================================================
// Configuration Constants
// =========================================================================
const SHEET_ID = "1Y_2N4Gs-lvAiv8fvLk9zvIhVQt5YxNPz6mCOnlh6lh8";
const SHEET_NAME = "לוג_הזמנות_מערכת";

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
  'SBN-PL-01': 85,
  'SBN-ST-05': 42,
  'SBN-TP-12': 18,
  'SBN-BB-08': 65
};

// =========================================================================
// 1. OnEdit Triggers & Event Handler
// =========================================================================

/**
 * Simple trigger fired automatically on cell edit in Google Sheets.
 */
function onEdit(e) {
  processSheetEdit(e);
}

/**
 * Installable trigger function (if configured under Apps Script Triggers).
 */
function onEditTrigger(e) {
  processSheetEdit(e);
}

/**
 * Core event handler for sheet row edits
 */
function processSheetEdit(e) {
  if (!e || !e.source) return;
  try {
    const sheet = e.source.getActiveSheet();
    if (sheet.getName() !== SHEET_NAME) return;

    const range = e.range;
    const rowIndex = range.getRow();

    // Skip header row
    if (rowIndex <= 1) return;

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const colIndices = findColumnIndices(headers);

    // Read full row values
    const row = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
    const rawOrderNo = row[colIndices.orderNumber];
    if (!rawOrderNo || String(rawOrderNo).trim() === "") return;

    const itemsStr = String(row[colIndices.items] || '').trim();
    const parsedItems = parseItemsString(itemsStr, rowIndex);

    // Calculate deposits with anti-double-counting mechanism
    const deposits = calculateDepositsWithDeduplication(parsedItems, itemsStr);

    // Write updated deposit values back to the Google Sheet row (columns 13, 14, 15, 16)
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

    // Sync updated row payload to Firebase Firestore REST API
    const orderNumber = String(rawOrderNo).trim();
    const orderPayload = buildOrderPayload(row, colIndices, rowIndex);
    syncToFirestoreRest(orderNumber, orderPayload);

    console.log("onEdit processed for Order #" + orderNumber + ". Deposits updated: Bales=" + deposits.depositBales + ", Pallets=" + deposits.depositPallets + ", Drums=" + deposits.depositDrums + ", BlockPallets=" + deposits.depositBlockPallets);
  } catch (err) {
    console.error("Error in processSheetEdit: " + err.toString());
  }
}

// =========================================================================
// 2. Deposit Engine & Anti-Double-Counting Mechanism
// =========================================================================

/**
 * Calculates standard deposits from item breakdown while strictly preventing double counting.
 * 
 * Logic & Priority Rules:
 * 1. Scans for Explicit Deposit Items (e.g. SKU 60002 for Bale Deposit, SKU 60060 for Pallet Deposit).
 * 2. Scans for Implicit Products requiring deposits from the Logistics Dictionary (e.g. SKU 11511 Gravel Bale).
 * 3. Anti-Double-Counting Rule (מנגנון מניעת כפל חישוב): If explicit deposits are present, they OVERRIDE 
 *    the implicit dictionary calculation for that deposit category, ensuring no duplicate charging occurs.
 */
function calculateDepositsWithDeduplication(items, itemsRawString) {
  // -----------------------------------------------------------------------
  // Category 1: Bales (פקדונות בלות / שק גדול / ביג בג)
  // Explicit SKU: 60002 (שק גדול פקדון)
  // Implicit SKUs: 11511 (חצץ בלה 1.5 טון), 11512 (חול בלה 1.5 טון)
  // -----------------------------------------------------------------------
  let explicitBales = 0;
  let implicitBales = 0;

  items.forEach(function(item) {
    const sku = String(item.sku || '').trim();
    const name = String(item.name || '').toLowerCase();
    const qty = Number(item.quantity) || 1;

    if (sku === '60002' || (name.indexOf('פקדון') !== -1 && (name.indexOf('בלה') !== -1 || name.indexOf('שק גדול') !== -1))) {
      explicitBales += qty;
    } else if (sku === '11511' || sku === '11512' || name.indexOf('בלה') !== -1 || name.indexOf('שק גדול') !== -1 || name.indexOf('ביג בג') !== -1) {
      implicitBales += qty;
    }
  });

  // Anti-Double-Counting Rule: Explicit overrides implicit
  const finalBales = explicitBales > 0 ? explicitBales : implicitBales;

  // -----------------------------------------------------------------------
  // Category 2: Pallets (פקדונות משטחים / משטח סבן)
  // Explicit SKU: 60060 (משטח סבן פקדון)
  // Implicit Calculation: 1 pallet per 10 heavy bags (25kg bags / cement / adhesive) or items mentioning 'משטח'
  // -----------------------------------------------------------------------
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

  // Anti-Double-Counting Rule: Explicit overrides implicit
  const finalPallets = explicitPallets > 0 ? explicitPallets : implicitPallets;

  // -----------------------------------------------------------------------
  // Category 3: Drums (פקדונות חביות / תוף)
  // Explicit SKU: 60003 (חבית פקדון)
  // Implicit Items: Items containing 'חבית' or 'תוף'
  // -----------------------------------------------------------------------
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

  // Anti-Double-Counting Rule: Explicit overrides implicit
  const finalDrums = explicitDrums > 0 ? explicitDrums : implicitDrums;

  // -----------------------------------------------------------------------
  // Category 4: Block Pallets (פקדונות משטחי בלוק)
  // Explicit SKU: 60004 (משטח בלוק פקדון)
  // Implicit Items: Items containing 'משטח בלוק' or 'בלוקים'
  // -----------------------------------------------------------------------
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

  // Anti-Double-Counting Rule: Explicit overrides implicit
  const finalBlockPallets = explicitBlockPallets > 0 ? explicitBlockPallets : implicitBlockPallets;

  return {
    depositBales: finalBales,
    depositPallets: finalPallets,
    depositDrums: finalDrums,
    depositBlockPallets: finalBlockPallets
  };
}

// =========================================================================
// 3. Web App Request Endpoints (doGet / doPost)
// =========================================================================

/**
 * Handle GET requests to fetch live logistics orders or execute sheet administrative actions
 */
function doGet(e) {
  const callback = e && e.parameter && e.parameter.callback;
  
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      return createJsonResponse({
        success: false,
        error: "Sheet '" + SHEET_NAME + "' not found."
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

/**
 * Handle POST requests for updating order details or inserting new orders
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
// 4. Data Parsing & Helper Functions
// =========================================================================

/**
 * Maps dynamic header positions across 16 standard columns
 */
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

/**
 * Builds structured JSON order payload from a Sheet row
 */
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
  
  // Calculate deposits with anti-double-counting engine
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

/**
 * Parses item string into array of items with SKU, Name, Quantity, and Price
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
// 5. Firebase Sync & Administrative Operations
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
    headerRange.setBackground("#1E293B")
               .setFontColor("#FFFFFF")
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
      .addItem('🛠️ צור גליון וכותרות עמודים', 'setupSheetAndHeaders')
      .addItem('🔄 סנכרן את כל ההזמנות ל-Firebase', 'syncSheetToFirebase')
      .addToUi();
  } catch (e) {
    console.log("onOpen skipped: " + e.toString());
  }
}
