import React, { useMemo, useState, useEffect } from 'react';
import { ReconciliationResult, MatchStatus, DashboardStats } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { AlertCircle, CheckCircle2, FileWarning, Download, Percent, IndianRupee, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

interface DashboardProps {
  results: ReconciliationResult[];
}

interface ExtendedResult extends ReconciliationResult {
  discount: number;
  netPayment: number;
  computedDifference: number; // This is Net Difference
  computedStatus: MatchStatus;
}

// Added 'difference' (Gross Diff) to SortKey
type SortKey = 'appId' | 'bookDate' | 'bookAmount' | 'paymentAmount' | 'difference' | 'discount' | 'netPayment' | 'computedStatus' | 'sources';
type SortDirection = 'asc' | 'desc';

interface SortConfig {
  key: SortKey;
  direction: SortDirection;
}

export const Dashboard: React.FC<DashboardProps> = ({ results }) => {
  const [filter, setFilter] = useState<MatchStatus | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [globalDiscount, setGlobalDiscount] = useState<string>('0');
  const [data, setData] = useState<ExtendedResult[]>([]);
  
  // Sorting State
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'bookDate', direction: 'desc' });

  useEffect(() => {
    // Initial calculation based on Gross
    const initialData = results.map(r => {
      // Logic:
      // Red: Paid > Target (Overpaid)
      // Yellow: Paid == 0 (Missing)
      // Green: Paid <= Target (Matched) - includes underpaid
      let status = MatchStatus.MATCHED;
      if (r.paymentAmount > r.bookAmount) status = MatchStatus.OVERPAID;
      else if (r.paymentAmount === 0) status = MatchStatus.MISSING_PAYMENT;
      
      return {
        ...r,
        discount: 0,
        netPayment: r.paymentAmount,
        computedDifference: r.paymentAmount - r.bookAmount,
        computedStatus: status
      };
    });
    setData(initialData);
  }, [results]);

  const recalculateRow = (item: ExtendedResult, discountVal: number) => {
    // Payment Amount here already includes 18% GST from the service (if selected)
    // Net = (Gross) * (1 - Discount%)
    const net = item.paymentAmount * (1 - discountVal / 100);
    const diff = net - item.bookAmount;
    
    let status = MatchStatus.MATCHED;
    if (net > item.bookAmount) status = MatchStatus.OVERPAID;
    else if (net === 0 && item.paymentAmount === 0) status = MatchStatus.MISSING_PAYMENT;
    
    return {
      ...item,
      discount: discountVal,
      netPayment: net,
      computedDifference: diff,
      computedStatus: status
    };
  };

  const applyGlobalDiscount = () => {
    const val = parseFloat(globalDiscount) || 0;
    setData(prev => prev.map(item => recalculateRow(item, val)));
  };

  const handleRowDiscountChange = (appId: string, valStr: string) => {
    const val = parseFloat(valStr) || 0;
    setData(prev => prev.map(item => item.appId === appId ? recalculateRow(item, val) : item));
  };

  const handleSort = (key: SortKey) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const stats = useMemo(() => {
    const s: DashboardStats = {
      totalBooksRecords: data.length,
      totalPaymentsRecords: 0,
      totalMatched: 0,
      totalOverpaid: 0,
      totalMissing: 0,
      totalRevenueCollected: 0,
      totalTargetRevenue: 0
    };

    data.forEach(item => {
      s.totalRevenueCollected += item.netPayment;
      s.totalTargetRevenue += item.bookAmount;
      if (item.computedStatus === MatchStatus.MATCHED) s.totalMatched++;
      else if (item.computedStatus === MatchStatus.OVERPAID) s.totalOverpaid++;
      else if (item.computedStatus === MatchStatus.MISSING_PAYMENT) s.totalMissing++;
    });

    return s;
  }, [data]);

  const filteredAndSortedResults = useMemo(() => {
    // 1. Filter
    let processed = data.filter(r => {
      const matchesFilter = filter === 'ALL' || r.computedStatus === filter;
      const matchesSearch = r.appId.includes(searchTerm);
      return matchesFilter && matchesSearch;
    });

    // 2. Sort
    return processed.sort((a, b) => {
      let valA: any = a[sortConfig.key];
      let valB: any = b[sortConfig.key];

      // Handle specific types
      if (sortConfig.key === 'sources') {
        valA = a.sources.join(', ');
        valB = b.sources.join(', ');
      }

      if (valA === valB) return 0;
      
      // Handle nulls
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      const compareResult = valA < valB ? -1 : 1;
      return sortConfig.direction === 'asc' ? compareResult : -compareResult;
    });
  }, [data, filter, searchTerm, sortConfig]);

  const pieData = [
    { name: 'Matched (Green)', value: stats.totalMatched, color: '#10b981' }, 
    { name: 'Overpaid (Red)', value: stats.totalOverpaid, color: '#f43f5e' }, 
    { name: 'Missing (Yellow)', value: stats.totalMissing, color: '#f59e0b' }, 
  ].filter(d => d.value > 0);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  };

  const formatDate = (date: Date | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-GB'); 
  };

  const downloadCSV = () => {
    // Swapped: Paid (Gross + GST) comes before Diff (Gross)
    const headers = ['App ID', 'Date', 'Target (Book)', 'Paid (Gross + GST)', 'Diff (Gross)', 'Discount %', 'Paid (Net)', 'Diff (Net)', 'Status', 'Sources'];
    const csvContent = [
      headers.join(','),
      ...filteredAndSortedResults.map(r => [
        r.appId,
        r.bookDate ? formatDate(r.bookDate) : '',
        r.bookAmount,
        r.paymentAmount,
        r.difference, // Gross Difference
        r.discount,
        r.netPayment,
        r.computedDifference, // Net Difference
        r.computedStatus,
        `"${r.sources.join('; ')}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'audit_report.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="w-3 h-3 text-slate-300 ml-1" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="w-3 h-3 text-blue-600 ml-1" />
      : <ArrowDown className="w-3 h-3 text-blue-600 ml-1" />;
  };

  const HeaderCell = ({ label, column, align = 'left' }: { label: string, column: SortKey, align?: 'left'|'center'|'right' }) => (
    <th 
      className={`px-4 py-3 font-medium cursor-pointer hover:bg-slate-100 transition-colors select-none text-${align}`}
      onClick={() => handleSort(column)}
    >
      <div className={`flex items-center ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'}`}>
        {label} <SortIcon column={column} />
      </div>
    </th>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Net Revenue" 
          value={formatCurrency(stats.totalRevenueCollected)} 
          subValue={`Target: ${formatCurrency(stats.totalTargetRevenue)}`}
          icon={<IndianRupee className="w-5 h-5 text-blue-600" />}
          trend={stats.totalRevenueCollected >= stats.totalTargetRevenue ? 'up' : 'down'}
        />
        <StatCard 
          title="Matched / Safe" 
          value={stats.totalMatched.toString()} 
          subValue="Paid <= Target"
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
          color="emerald"
        />
        <StatCard 
          title="Overpaid / Alert" 
          value={stats.totalOverpaid.toString()} 
          subValue="Paid > Target"
          icon={<AlertCircle className="w-5 h-5 text-rose-600" />}
          color="rose"
        />
        <StatCard 
          title="Missing Payments" 
          value={stats.totalMissing.toString()} 
          subValue="No valid payment found"
          icon={<FileWarning className="w-5 h-5 text-amber-600" />}
          color="amber"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm lg:col-span-1 flex flex-col">
           <h3 className="text-lg font-semibold text-slate-800 mb-4">Settings</h3>
           <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">Global Discount (%)</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input 
                    type="number" 
                    min="0" 
                    max="100"
                    step="0.1"
                    className="w-full pl-3 pr-8 py-2 border border-slate-300 bg-white text-slate-900 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    value={globalDiscount}
                    onChange={(e) => setGlobalDiscount(e.target.value)}
                  />
                  <Percent className="absolute right-2.5 top-2.5 w-4 h-4 text-slate-400" />
                </div>
                <button 
                  onClick={applyGlobalDiscount}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Apply
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-2">Discount reduces the 'Paid' amount. Gross Paid includes 18% GST.</p>
           </div>

          <h3 className="text-lg font-semibold text-slate-800 mb-4">Status Distribution</h3>
          <div className="flex-1 min-h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm lg:col-span-2">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Top Overpaid Apps (Net)</h3>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data
                  .filter(r => r.computedDifference > 0) // Overpaid means difference > 0
                  .sort((a, b) => b.computedDifference - a.computedDifference)
                  .slice(0, 10)}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis type="number" tickFormatter={(val) => `₹${val}`} />
                <YAxis dataKey="appId" type="category" width={80} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Bar dataKey="computedDifference" fill="#f43f5e" radius={[0, 4, 4, 0]} name="Excess Paid" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-lg font-bold text-slate-800">Audit Details</h3>
          
          <div className="flex flex-col sm:flex-row gap-3">
             <input 
              type="text" 
              placeholder="Search App ID..." 
              className="px-3 py-2 border border-slate-300 bg-white text-slate-900 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select 
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
            >
              <option value="ALL">All Statuses</option>
              <option value={MatchStatus.MATCHED}>Matched (Green)</option>
              <option value={MatchStatus.OVERPAID}>Overpaid (Red)</option>
              <option value={MatchStatus.MISSING_PAYMENT}>Missing (Yellow)</option>
            </select>
            <button 
              onClick={downloadCSV}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-900 transition-colors"
            >
              <Download className="w-4 h-4" /> Export
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <HeaderCell label="App ID" column="appId" />
                <HeaderCell label="Book Date" column="bookDate" />
                <HeaderCell label="Target (Book)" column="bookAmount" align="right" />
                {/* Swapped order: Gross Paid first, then Diff */}
                <HeaderCell label="Gross Paid (Inc. GST)" column="paymentAmount" align="right" />
                <HeaderCell label="Diff (Gross)" column="difference" align="right" />
                
                <HeaderCell label="Disc %" column="discount" align="center" />
                <HeaderCell label="Net Paid" column="netPayment" align="right" />
                <HeaderCell label="Status" column="computedStatus" align="center" />
                <HeaderCell label="Sources" column="sources" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAndSortedResults.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-slate-500">
                    No records found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredAndSortedResults.map((row) => (
                  <tr key={row.appId} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900">{row.appId}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(row.bookDate)}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-600">{formatCurrency(row.bookAmount)}</td>
                    
                    {/* Swapped order in Body as well */}
                    <td className="px-4 py-3 text-right font-mono text-slate-400" title="Includes 18% GST">{formatCurrency(row.paymentAmount)}</td>
                    <td className={`px-4 py-3 text-right font-mono font-medium ${
                      row.difference > 0 ? 'text-rose-600' : row.difference < 0 ? 'text-amber-600' : 'text-slate-400'
                    }`}>
                      {formatCurrency(row.difference)}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <input 
                        type="number" 
                        min="0"
                        max="100"
                        className="w-16 px-2 py-1 text-center border border-slate-200 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                        value={row.discount}
                        onClick={(e) => e.stopPropagation()} // Prevent row click issues
                        onChange={(e) => handleRowDiscountChange(row.appId, e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium text-slate-800">{formatCurrency(row.netPayment)}</td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={row.computedStatus} />
                    </td>
                    <td className="px-4 py-3 text-slate-500 truncate max-w-xs text-xs" title={row.sources.join(', ')}>
                      {row.sources.length > 0 ? row.sources.join(', ') : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 text-xs text-slate-500 flex justify-between">
          <span>Showing {filteredAndSortedResults.length} records</span>
          <span>Filtered from {data.length} total</span>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ title: string, value: string, subValue: string, icon: React.ReactNode, trend?: 'up' | 'down', color?: string }> = ({ title, value, subValue, icon, trend, color }) => (
  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-full">
    <div className="flex justify-between items-start mb-4">
      <div className={`p-2 rounded-lg bg-${color || 'slate'}-50`}>
        {icon}
      </div>
      {trend && (
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${trend === 'up' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
          {trend === 'up' ? 'Surplus' : 'Deficit'}
        </span>
      )}
    </div>
    <div>
      <h4 className="text-slate-500 text-sm font-medium mb-1">{title}</h4>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      <p className="text-xs text-slate-400 mt-1">{subValue}</p>
    </div>
  </div>
);

const StatusBadge: React.FC<{ status: MatchStatus }> = ({ status }) => {
  switch (status) {
    case MatchStatus.MATCHED:
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
          <CheckCircle2 className="w-3.5 h-3.5" /> Matched
        </span>
      );
    case MatchStatus.OVERPAID:
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">
          <AlertCircle className="w-3.5 h-3.5" /> Overpaid
        </span>
      );
    case MatchStatus.MISSING_PAYMENT:
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
          <FileWarning className="w-3.5 h-3.5" /> Missing
        </span>
      );
    default:
      return <span className="text-slate-500">-</span>;
  }
};