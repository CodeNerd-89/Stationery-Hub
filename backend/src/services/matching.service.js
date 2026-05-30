// ─── Matching Service ────────────────────────────────
// Parses OCR text into items and fuzzy-matches against product catalog

const Fuse = require('fuse.js');

/**
 * Parse raw OCR text into structured line items
 * Handles various PO formats
 */
function parseExtractedItems(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];

  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 3); // Skip very short lines

  const items = [];

  // Patterns to detect quantity + item combos
  const patterns = [
    // "5 pcs A4 Paper" or "10 box Stapler Pins"
    /^(\d+)\s*(pcs?|packs?|box(?:es)?|reams?|sets?|rolls?|dozens?|units?)?\s+(.+)$/i,
    // "A4 Paper x 5" or "A4 Paper × 5"
    /^(.+?)\s*[x×]\s*(\d+)\s*(pcs?|packs?|box(?:es)?|reams?|sets?|rolls?|dozens?|units?)?$/i,
    // "A4 Paper - 5 pcs"
    /^(.+?)\s*[-–—]\s*(\d+)\s*(pcs?|packs?|box(?:es)?|reams?|sets?|rolls?|dozens?|units?)?$/i,
    // "A4 Paper    5    pcs" (tabular with spaces)
    /^(.+?)\s{3,}(\d+)\s*(pcs?|packs?|box(?:es)?|reams?|sets?|rolls?|dozens?|units?)?$/i,
    // "1. A4 Paper 5pcs" (numbered list)
    /^\d+[.)]\s*(.+?)\s+(\d+)\s*(pcs?|packs?|box(?:es)?|reams?|sets?|rolls?|dozens?|units?)?$/i,
  ];

  for (const line of lines) {
    let matched = false;

    // Try pattern: QTY UNIT ITEM_NAME
    const p1 = line.match(patterns[0]);
    if (p1) {
      items.push({
        name: p1[3].trim(),
        quantity: parseInt(p1[1], 10),
        unit: normalizeUnit(p1[2]),
        rawLine: line,
      });
      matched = true;
    }

    if (!matched) {
      // Try pattern: ITEM_NAME x QTY
      const p2 = line.match(patterns[1]);
      if (p2) {
        items.push({
          name: p2[1].trim(),
          quantity: parseInt(p2[2], 10),
          unit: normalizeUnit(p2[3]),
          rawLine: line,
        });
        matched = true;
      }
    }

    if (!matched) {
      // Try pattern: ITEM_NAME - QTY
      const p3 = line.match(patterns[2]);
      if (p3) {
        items.push({
          name: p3[1].trim(),
          quantity: parseInt(p3[2], 10),
          unit: normalizeUnit(p3[3]),
          rawLine: line,
        });
        matched = true;
      }
    }

    if (!matched) {
      // Try tabular pattern: ITEM_NAME     QTY
      const p4 = line.match(patterns[3]);
      if (p4) {
        items.push({
          name: p4[1].trim(),
          quantity: parseInt(p4[2], 10),
          unit: normalizeUnit(p4[3]),
          rawLine: line,
        });
        matched = true;
      }
    }

    if (!matched) {
      // Try numbered list: 1. ITEM_NAME QTY
      const p5 = line.match(patterns[4]);
      if (p5) {
        items.push({
          name: p5[1].trim(),
          quantity: parseInt(p5[2], 10),
          unit: normalizeUnit(p5[3]),
          rawLine: line,
        });
        matched = true;
      }
    }

    // Fallback: treat the whole line as an item name with qty 1
    if (!matched && line.length > 5 && !/^(date|from|to|total|subtotal|tax|note|phone|email|address|invoice|purchase|order|po\s|p\.o)/i.test(line)) {
      // Check if line contains any number that could be quantity
      const numMatch = line.match(/(\d+)/);
      if (numMatch && parseInt(numMatch[1], 10) > 0 && parseInt(numMatch[1], 10) < 10000) {
        items.push({
          name: line.replace(/\d+/g, '').replace(/\s+/g, ' ').trim(),
          quantity: parseInt(numMatch[1], 10),
          unit: null,
          rawLine: line,
        });
      }
    }
  }

  return items;
}

/**
 * Normalize unit strings
 */
function normalizeUnit(unit) {
  if (!unit) return 'pc';
  const u = unit.toLowerCase().replace(/s$/, '');
  const map = {
    pc: 'pc', piece: 'pc',
    pack: 'pack', packet: 'pack',
    box: 'box', boxe: 'box',
    ream: 'ream',
    set: 'set',
    roll: 'roll',
    dozen: 'dozen',
    unit: 'pc',
  };
  return map[u] || 'pc';
}

/**
 * Fuzzy-match extracted items against product catalog
 */
function matchWithCatalog(extractedItems, products) {
  if (!extractedItems || extractedItems.length === 0) return [];
  if (!products || products.length === 0) {
    return extractedItems.map((item) => ({
      extractedName: item.name,
      matchedProduct: null,
      confidence: 0,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: 0,
      suggestions: [],
      rawLine: item.rawLine,
    }));
  }

  const fuse = new Fuse(products, {
    keys: [
      { name: 'name', weight: 0.6 },
      { name: 'sku', weight: 0.2 },
      { name: 'description', weight: 0.2 },
    ],
    threshold: 0.5,
    includeScore: true,
    minMatchCharLength: 2,
  });

  return extractedItems.map((item) => {
    const results = fuse.search(item.name);
    const topMatch = results[0];
    const confidence = topMatch ? Math.round((1 - topMatch.score) * 100) / 100 : 0;

    let matchedProduct = null;
    let unitPrice = 0;

    // Auto-match if confidence > 0.6
    if (confidence > 0.6 && topMatch) {
      matchedProduct = {
        id: topMatch.item.id,
        name: topMatch.item.name,
        sku: topMatch.item.sku,
        price: topMatch.item.price,
        stock: topMatch.item.stock,
        unit: topMatch.item.unit,
      };
      unitPrice = parseFloat(topMatch.item.price);
    }

    // Get top 3 suggestions
    const suggestions = results.slice(0, 3).map((r) => ({
      id: r.item.id,
      name: r.item.name,
      sku: r.item.sku,
      price: parseFloat(r.item.price),
      confidence: Math.round((1 - r.score) * 100) / 100,
    }));

    return {
      extractedName: item.name,
      matchedProduct,
      confidence,
      quantity: item.quantity,
      unit: item.unit || matchedProduct?.unit || 'pc',
      unitPrice,
      suggestions,
      rawLine: item.rawLine,
    };
  });
}

module.exports = { parseExtractedItems, matchWithCatalog };
