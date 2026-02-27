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
}

export interface DashboardStats {
  totalBooksRecords: number;
  totalPaymentsRecords: number;
  totalMatched: number;
  totalOverpaid: number;
  totalMissing: number;
  totalRevenueCollected: number;
  totalTargetRevenue: number;
}