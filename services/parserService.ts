import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { BookEntry, PaymentEntry, ColumnMapping } from '../types';

// Helper to clean currency strings to numbers
const parseCurrency = (value: any): number => {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  // Remove commas, currency symbols, and 'Dr'/'Cr' suffixes, keep dot and minus
  const cleanStr = String(value).replace(/[^0-9.-]+/g, '');
  return parseFloat(cleanStr) || 0;
};

// Helper to normalize keys
const normalizeKey = (key: string) => key.trim().toLowerCase();

// Helper to extract clean ID from text
// We look for 6-9 digit numbers. 
// We explicitly avoid 10 digit numbers (phone numbers) by enforcing word boundaries.
const extractIdFromText = (text: string): string | null => {
    if (!text) return null;
    
    // Regex explanation:
    // \b represents a word boundary.
    // \d{6,9} matches 6 to 9 digits.
    // This effectively ignores "8757065466" (10 digits) but matches "11146737" (8 digits) and "131426" (6 digits).
    const matches = text.match(/\b\d{6,9}\b/g);
    
    if (matches && matches.length > 0) {
        return matches[0];
    }
    return null;
}

// Date Parser: Supports DD-MM-YYYY, YYYY-MM-DD, MM/DD/YYYY, and DD-MMM-YYYY (09-Feb-2026)
const parseDate = (value: any): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  
  const str = String(value).trim();
  if (!str) return null;

  // Excel serial dates (numbers)
  if (!isNaN(Number(str)) && !str.includes('-') && !str.includes('/')) {
     const excelDate = new Date((Number(str) - (25567 + 2)) * 86400 * 1000);
     return excelDate;
  }

  // Handle DD-MMM-YYYY (e.g. 09-Feb-2026)
  const monthNames = {jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11};
  const mmmMatch = str.match(/^(\d{1,2})[-/]([a-zA-Z]{3})[-/](\d{4})/);
  if (mmmMatch) {
    const day = parseInt(mmmMatch[1], 10);
    const monthStr = mmmMatch[2].toLowerCase();
    const year = parseInt(mmmMatch[3], 10);
    if (monthNames.hasOwnProperty(monthStr as keyof typeof monthNames)) {
      return new Date(year, monthNames[monthStr as keyof typeof monthNames], day);
    }
  }

  // Try parsing DD-MM-YYYY or DD/MM/YYYY
  const parts = str.split(/[-/.]/);
  if (parts.length >= 3) {
    // Check if it looks like DD-MM-YYYY (Year is last and 4 digits)
    const p0 = parseInt(parts[0], 10);
    const p1 = parseInt(parts[1], 10);
    const p2 = parseInt(parts[2], 10);

    if (String(parts[2]).length === 4 && !isNaN(p0) && !isNaN(p1) && !isNaN(p2)) {
       return new Date(p2, p1 - 1, p0);
    }
    // Check YYYY-MM-DD
    if (String(parts[0]).length === 4 && !isNaN(p0) && !isNaN(p1) && !isNaN(p2)) {
      return new Date(p0, p1 - 1, p2);
    }
  }

  // Fallback to standard JS parsing
  const date = new Date(str);
  if (!isNaN(date.getTime())) return date;

  return null;
};

// Generic Raw Parser with Duplicate Header Handling
export const parseRawCsv = (file: File): Promise<{ headers: string[], rows: any[] }> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: false,
      skipEmptyLines: 'greedy', 
      complete: (results) => {
        const rows = results.data as string[][];
        if (rows.length === 0) {
          resolve({ headers: [], rows: [] });
          return;
        }

        // Auto-detect header row
        // Scans first 20 rows for keywords
        let headerIndex = 0;
        let bestScore = 0;
        const scanLimit = Math.min(rows.length, 25);

        rows.slice(0, scanLimit).forEach((row, idx) => {
          let score = 0;
          const normRow = row.map(c => normalizeKey(String(c)));
          if (normRow.some(c => c.includes('date'))) score += 3;
          if (normRow.some(c => c.includes('amount') || c.includes('debit') || c.includes('price') || c.includes('basic'))) score += 3;
          if (normRow.some(c => c.includes('id') || c.includes('account') || c.includes('particulars') || c.includes('narration'))) score += 3;
          
          if (score > bestScore) {
            bestScore = score;
            headerIndex = idx;
          }
        });

        const rawHeaders = rows[headerIndex].map(h => String(h).trim());
        
        // Handle Duplicate Headers (e.g. NARRATION, NARRATION) by appending suffix
        const headerCounts: Record<string, number> = {};
        const uniqueHeaders = rawHeaders.map(h => {
          const key = h || 'UNKNOWN';
          headerCounts[key] = (headerCounts[key] || 0) + 1;
          return headerCounts[key] > 1 ? `${key}_${headerCounts[key] - 1}` : key;
        });

        const dataRows = rows.slice(headerIndex + 1).map(row => {
            const obj: any = {};
            uniqueHeaders.forEach((h, i) => {
                obj[h] = row[i];
            });
            return obj;
        });

        resolve({ headers: uniqueHeaders, rows: dataRows });
      },
      error: (err) => reject(err)
    });
  });
};

export const parseRawExcel = (file: File): Promise<{ headers: string[], rows: any[] }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        if (jsonData.length === 0) {
            resolve({ headers: [], rows: [] });
            return;
        }

        const rawHeaders = jsonData[0].map(h => String(h).trim());
        const headerCounts: Record<string, number> = {};
        const uniqueHeaders = rawHeaders.map(h => {
          const key = h || 'UNKNOWN';
          headerCounts[key] = (headerCounts[key] || 0) + 1;
          return headerCounts[key] > 1 ? `${key}_${headerCounts[key] - 1}` : key;
        });

        const rows = jsonData.slice(1).map(row => {
             const obj: any = {};
             uniqueHeaders.forEach((h, i) => {
                 obj[h] = row[i];
             });
             return obj;
        });
        resolve({ headers: uniqueHeaders, rows });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
};

// --- DATA EXTRACTORS ---

// Advanced Extractor for Books (Handles Single Line AND Multi-line OFA format)
export const extractBookData = (rows: any[], mapping: ColumnMapping): BookEntry[] => {
  const books: BookEntry[] = [];
  
  // State for multi-line transactions (OFA format)
  // Logic: "Pending Entry" is created when we see a Date/Debit but NO ID.
  // We then check subsequent rows for an ID in the mapped column.
  let pendingEntry: { date: Date, debit: number, originalRow: any } | null = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    
    // Parse core fields
    const date = parseDate(row[mapping.date]);
    const debit = parseCurrency(row[mapping.amount]);
    
    // Get text from the mapped ID column (could be 'Account' or 'Narration')
    const rawIdText = String(row[mapping.appId] || '').trim();
    const extractedId = extractIdFromText(rawIdText);

    // --- Scenario A: Start of a new Transaction (Has Date & Debit > 0) ---
    if (date && debit > 0) {
        // If we had a previous pending entry that never found an ID, it's effectively lost/ignored.
        // We start a new one.
        pendingEntry = null; 

        if (extractedId) {
            // Case A1: ID found on the SAME line. Standard CSV format.
            books.push({
                appId: extractedId,
                debit,
                date,
                originalRow: row
            });
        } else {
            // Case A2: ID not found on this line. It might be an OFA format where ID is on next line.
            // Save this as pending.
            pendingEntry = { date, debit, originalRow: row };
        }
        continue; // Done with this row
    }

    // --- Scenario B: Continuation Line (No Date/Debit, but potentially details for Pending Entry) ---
    if (pendingEntry) {
        if (extractedId) {
            // Found the ID on this subsequent line! Match it with pending entry.
            books.push({
                appId: extractedId,
                debit: pendingEntry.debit,
                date: pendingEntry.date,
                originalRow: pendingEntry.originalRow // Keep reference to header row
            });
            pendingEntry = null; // Transaction fully resolved
        }
        // If no ID found here, we continue loop. 
        // If the NEXT row starts a new transaction (Scenario A), pendingEntry gets reset there.
    }
  }

  return books;
};

// Extractor for Payments (Usually single line)
export const extractPaymentData = (rows: any[], mapping: ColumnMapping, fileName: string): PaymentEntry[] => {
  const payments: PaymentEntry[] = [];

  rows.forEach(row => {
    let pricePaid = parseCurrency(row[mapping.amount]);
    
    // Apply GST Logic: If user selected 'Add GST' (default true), multiply basic by 1.18
    if (mapping.addGst !== false) {
       pricePaid = pricePaid * 1.18;
    }

    const date = parseDate(row[mapping.date]);
    
    // Payment files usually have direct Application ID columns, simpler extraction
    const rawIdText = String(row[mapping.appId] || '').trim();
    
    // Use the same robust extractor to ignore phone numbers if mixed
    // Or simpler regex if it's a clean column. The robust one is safer.
    const appId = extractIdFromText(rawIdText);

    // Only add if ID found. Zero price is allowed (Missing Payment check relies on finding the ID).
    // Though usually payment records imply money.
    if (appId) {
      payments.push({
        appId,
        pricePaid,
        date,
        sourceFile: fileName
      });
    }
  });

  return payments;
};

export const getSavedMapping = (headers: string[]): ColumnMapping | null => {
  try {
    const key = `mapping_${headers.join(',')}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error("Failed to read saved mapping", e);
  }
  return null;
};

export const saveMapping = (headers: string[], mapping: ColumnMapping) => {
  try {
    const key = `mapping_${headers.join(',')}`;
    localStorage.setItem(key, JSON.stringify(mapping));
  } catch (e) {
    console.error("Failed to save mapping", e);
  }
};

// Auto-guesser for mapping
export const guessMapping = (headers: string[]): ColumnMapping => {
  const mapping: ColumnMapping = { date: '', appId: '', amount: '', addGst: true };
  
  headers.forEach(h => {
    const lower = h.toLowerCase();
    
    // 1. Date
    if (!mapping.date && (lower.includes('date') || lower.includes('time'))) mapping.date = h;
    
    // 2. Amount
    if (!mapping.amount) {
        if (lower.includes('debit')) mapping.amount = h; // High priority for Books
        else if (lower.includes('price') || lower.includes('amount') || lower.includes('paid') || lower.includes('basic')) mapping.amount = h;
    }

    // 3. ID
    if (!mapping.appId) {
        if (lower.includes('application') && (lower.includes('id') || lower.includes('no'))) mapping.appId = h; // High priority for Portal
        else if (lower.includes('account')) mapping.appId = h; // Priority for OFA (Account col has the ID in line 2)
        else if (lower.includes('narration') && !lower.includes('short')) mapping.appId = h; // Priority for Narration (but not short)
        else if (lower.includes('particulars')) mapping.appId = h;
    }
  });

  return mapping;
};