export interface BookEntry {
  appId: string;
  debit: number; // Target price
  date: Date | null;
  originalRow: any;
}

export interface PaymentEntry {
  appId: string;
  pricePaid: number;
  date: Date | null;
  sourceFile: string;
}

export interface ColumnMapping {
  date: string;
  appId: string;
  amount: string;
  addGst?: boolean;
}

export enum MatchStatus {
  MATCHED = 'MATCHED', // Green: Paid <= Target (and > 0)
  OVERPAID = 'OVERPAID', // Red: Paid > Target
  MISSING_PAYMENT = 'MISSING_PAYMENT', // Yellow: Paid == 0
  FOUND_UNPAID = 'FOUND_UNPAID', // Red Alert: Found in payment file but amount is 0
  IGNORED = 'IGNORED'
}

export interface ReconciliationResult {
  appId: string;
  bookAmount: number;
  paymentAmount: number;
  difference: number;
  status: MatchStatus;
  sources: string[];
  bookDate: Date | null;
  discrepancyNote?: string;
}

export interface DashboardStats {
  totalBooksRecords: number;
  totalPaymentsRecords: number;
  totalMatched: number;
  totalOverpaid: number;
  totalMissing: number;
  totalFoundUnpaid: number;
  totalRevenueCollected: number;
  totalTargetRevenue: number;
}