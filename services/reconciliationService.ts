import { BookEntry, PaymentEntry, ReconciliationResult, MatchStatus, DashboardStats } from '../types';

export const reconcileData = (books: BookEntry[], payments: PaymentEntry[]): { results: ReconciliationResult[], stats: DashboardStats } => {
  
  // 1. Group Payments
  // Group all payments by App ID first to optimize lookups
  const paymentMap = new Map<string, PaymentEntry[]>();

  payments.forEach(p => {
    const list = paymentMap.get(p.appId) || [];
    list.push(p);
    paymentMap.set(p.appId, list);
  });

  const results: ReconciliationResult[] = [];
  let totalMatched = 0;
  let totalOverpaid = 0;
  let totalMissing = 0;
  let totalRevenueCollected = 0;
  let totalTargetRevenue = 0;

  // 2. Iterate Books
  books.forEach(book => {
    const potentialPayments = paymentMap.get(book.appId) || [];
    
    // Date Condition: 
    // "date of book should be less then equal to company date"
    // Equiv: Company Date >= Book Date
    const validPayments = potentialPayments.filter(p => {
      if (!book.date || !p.date) return true; // If data is missing, give benefit of doubt or handle strictly? Assuming permissive for now.
      
      // Normalize time for accurate date comparison
      const bDate = new Date(book.date); bDate.setHours(0,0,0,0);
      const pDate = new Date(p.date); pDate.setHours(0,0,0,0);
      
      return pDate >= bDate;
    });

    // Calculate Amount Paid (Gross)
    // NOTE: GST is now added during parsing based on user configuration per file.
    // So p.pricePaid here is already inclusive of GST if selected.
    const amountPaid = validPayments.reduce((sum, p) => {
        return sum + p.pricePaid;
    }, 0);

    const sources = Array.from(new Set(validPayments.map(p => p.sourceFile)));

    let status: MatchStatus;

    // Status logic based on Gross Paid (inclusive of GST) vs Target
    if (amountPaid === 0) {
      status = MatchStatus.MISSING_PAYMENT;
      totalMissing++;
    } else if (amountPaid > book.debit) {
      status = MatchStatus.OVERPAID;
      totalOverpaid++;
    } else {
      status = MatchStatus.MATCHED;
      totalMatched++;
    }

    totalTargetRevenue += book.debit;
    totalRevenueCollected += amountPaid;

    results.push({
      appId: book.appId,
      bookAmount: book.debit,
      paymentAmount: amountPaid, 
      difference: amountPaid - book.debit,
      status,
      sources,
      bookDate: book.date
    });
  });

  const stats: DashboardStats = {
    totalBooksRecords: books.length,
    totalPaymentsRecords: payments.length,
    totalMatched,
    totalOverpaid,
    totalMissing,
    totalRevenueCollected,
    totalTargetRevenue
  };

  return { results, stats };
};