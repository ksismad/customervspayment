import React from 'react';
import { ColumnMapping } from '../types';
import { TableProperties } from 'lucide-react';

interface ColumnMapperProps {
  filename: string;
  headers: string[];
  defaultMapping: ColumnMapping;
  onChange: (mapping: ColumnMapping) => void;
  type: 'BOOK' | 'PAYMENT';
}

export const ColumnMapper: React.FC<ColumnMapperProps> = ({ filename, headers, defaultMapping, onChange, type }) => {
  
  const handleChange = (field: keyof ColumnMapping, value: any) => {
    onChange({ ...defaultMapping, [field]: value });
  };

  return (
    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mt-3 animate-in fade-in slide-in-from-top-2">
      <div className="flex items-center gap-2 mb-3 text-slate-700 font-semibold text-sm">
        <TableProperties className="w-4 h-4" />
        <span>Map Columns for <span className="text-blue-700">{filename}</span></span>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wide">
            {type === 'BOOK' ? 'Date of Entry' : 'Payment Date'}
          </label>
          <div className="relative">
            <select 
              className={`w-full px-2 py-1.5 bg-white border rounded text-sm outline-none appearance-none cursor-pointer
                ${!defaultMapping.date ? 'border-red-300 ring-1 ring-red-100 text-red-500' : 'border-slate-300 text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-200'}
              `}
              value={defaultMapping.date}
              onChange={(e) => handleChange('date', e.target.value)}
            >
              <option value="">-- Select Date --</option>
              {headers.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wide">
            App ID / Narration / Account
          </label>
           <div className="relative">
            <select 
              className={`w-full px-2 py-1.5 bg-white border rounded text-sm outline-none appearance-none cursor-pointer
                ${!defaultMapping.appId ? 'border-red-300 ring-1 ring-red-100 text-red-500' : 'border-slate-300 text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-200'}
              `}
              value={defaultMapping.appId}
              onChange={(e) => handleChange('appId', e.target.value)}
            >
              <option value="">-- Select ID Column --</option>
              {headers.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wide">
            {type === 'BOOK' ? 'Debit Amount' : 'Paid Amount'}
          </label>
           <div className="relative">
            <select 
              className={`w-full px-2 py-1.5 bg-white border rounded text-sm outline-none appearance-none cursor-pointer
                ${!defaultMapping.amount ? 'border-red-300 ring-1 ring-red-100 text-red-500' : 'border-slate-300 text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-200'}
              `}
              value={defaultMapping.amount}
              onChange={(e) => handleChange('amount', e.target.value)}
            >
              <option value="">-- Select Amount --</option>
              {headers.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
        </div>
      </div>

      {type === 'PAYMENT' && (
        <div className="flex items-center mt-3 pt-3 border-t border-slate-200">
          <label className="flex items-center space-x-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
            <input 
              type="checkbox" 
              checked={defaultMapping.addGst ?? true} 
              onChange={(e) => handleChange('addGst', e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <span>Add 18% GST to Basic Amount</span>
          </label>
        </div>
      )}
    </div>
  );
};