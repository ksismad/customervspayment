import React, { useState, useRef } from 'react';
import { ReconciliationResult, ColumnMapping, BookEntry, PaymentEntry } from './types';
import { parseRawCsv, parseRawExcel, extractBookData, extractPaymentData, guessMapping, getSavedMapping, saveMapping } from './services/parserService';
import { reconcileData } from './services/reconciliationService';
import { FileUpload } from './components/FileUpload';
import { ColumnMapper } from './components/ColumnMapper';
import { Dashboard } from './components/Dashboard';
import { ShieldCheck, RefreshCw, ChevronRight, Settings2, Trash2, ArrowLeft } from 'lucide-react';

// Type to track file processing state
interface FileData {
  file: File;
  headers: string[];
  rows: any[];
  mapping: ColumnMapping | null;
}

const App: React.FC = () => {
  // State
  const [bookFile, setBookFile] = useState<FileData | null>(null);
  const [paymentFiles, setPaymentFiles] = useState<FileData[]>([]);
  const [results, setResults] = useState<ReconciliationResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1); 

  // Refs for replacement inputs
  const bookInputRef = useRef<HTMLInputElement>(null);
  const paymentInputRef = useRef<HTMLInputElement>(null);
  const [replacingPaymentIndex, setReplacingPaymentIndex] = useState<number | null>(null);

  // Handlers
  const handleBookUpload = async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    try {
      const { headers, rows } = await parseRawCsv(file); 
      const guessed = guessMapping(headers);
      setBookFile({ file, headers, rows, mapping: guessed });
    } catch (e) {
      setError("Failed to parse Books file.");
    }
  };

  const handleBookReplace = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        await handleBookUpload(Array.from(e.target.files));
    }
    // Reset input
    if (bookInputRef.current) bookInputRef.current.value = '';
  };

  const handlePaymentUpload = async (files: File[]) => {
    const newFiles: FileData[] = [];
    for (const file of files) {
       try {
         const { headers, rows } = file.name.endsWith('csv') ? await parseRawCsv(file) : await parseRawExcel(file);
         const guessed = getSavedMapping(headers) || guessMapping(headers);
         newFiles.push({ file, headers, rows, mapping: guessed });
       } catch (e) {
         console.error("Failed to parse", file.name);
       }
    }
    setPaymentFiles(prev => [...prev, ...newFiles]);
  };

  const triggerPaymentReplace = (index: number) => {
    setReplacingPaymentIndex(index);
    paymentInputRef.current?.click();
  };

  const handlePaymentReplace = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && replacingPaymentIndex !== null) {
        const file = e.target.files[0];
        try {
            const { headers, rows } = file.name.endsWith('csv') ? await parseRawCsv(file) : await parseRawExcel(file);
            const guessed = getSavedMapping(headers) || guessMapping(headers);
            const newData: FileData = { file, headers, rows, mapping: guessed };
            
            setPaymentFiles(prev => prev.map((item, idx) => idx === replacingPaymentIndex ? newData : item));
        } catch (err) {
            console.error("Replace failed", err);
            setError(`Failed to replace file: ${file.name}`);
        }
    }
    if (paymentInputRef.current) paymentInputRef.current.value = '';
    setReplacingPaymentIndex(null);
  };

  const updateBookMapping = (m: ColumnMapping) => {
    if (bookFile) {
      setBookFile({ ...bookFile, mapping: m });
    }
  };

  const updatePaymentMapping = (index: number, m: ColumnMapping) => {
    setPaymentFiles(prev => {
      const newFiles = [...prev];
      newFiles[index] = { ...newFiles[index], mapping: m };
      saveMapping(newFiles[index].headers, m);
      return newFiles;
    });
  };

  const removePaymentFile = (index: number) => {
    setPaymentFiles(prev => prev.filter((_, i) => i !== index));
  };

  const runAudit = () => {
    if (!bookFile || !bookFile.mapping || paymentFiles.length === 0) {
      setError("Please ensure files are uploaded and columns are mapped.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    // 1. Extract Typed Data
    const books: BookEntry[] = extractBookData(bookFile.rows, bookFile.mapping);
    const allPayments: PaymentEntry[] = [];
    
    paymentFiles.forEach(pf => {
      if (pf.mapping) {
        const pData = extractPaymentData(pf.rows, pf.mapping, pf.file.name);
        allPayments.push(...pData);
      }
    });

    if (books.length === 0) {
        setError("No valid book entries found. Please check column mapping (Debit > 0, valid App IDs).");
        setIsProcessing(false);
        return;
    }

    // 2. Reconcile
    const { results } = reconcileData(books, allPayments);
    setResults(results);
    setStep(2);
    setIsProcessing(false);
  };

  const editConfiguration = () => {
    setStep(1);
    setResults([]);
  };

  const reset = () => {
    if (window.confirm("Are you sure? This will clear all uploaded files and settings.")) {
      setResults([]);
      setStep(1);
      setBookFile(null);
      setPaymentFiles([]);
      setError(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-blue-500">
              AuditMatch Pro
            </h1>
          </div>
          {step === 2 && (
            <div className="flex items-center gap-3">
              <button 
                onClick={editConfiguration} 
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Edit Inputs
              </button>
              <button 
                onClick={reset} 
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" /> New Audit
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {step === 1 && (
          <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-slate-900">Upload Financial Records</h2>
              <p className="mt-3 text-lg text-slate-500">Upload CSVs, map columns, and verify payments against book targets.</p>
            </div>

            {/* Hidden Inputs for Replacements */}
            <input 
              type="file" 
              ref={bookInputRef} 
              accept=".csv" 
              className="hidden" 
              onChange={handleBookReplace} 
            />
            <input 
              type="file" 
              ref={paymentInputRef} 
              accept=".csv,.xlsx,.xls" 
              className="hidden" 
              onChange={handlePaymentReplace} 
            />

            {/* Books Section */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">1</div>
                <h3 className="text-lg font-semibold text-slate-800">Internal Books (OFA)</h3>
              </div>
              
              {!bookFile ? (
                <FileUpload 
                  label="Upload Books CSV" 
                  subLabel="Contains Date, Debit Amount and App ID" 
                  accept=".csv"
                  files={[]}
                  onFilesSelected={handleBookUpload}
                  onRemoveFile={() => {}}
                />
              ) : (
                <div>
                   <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg border border-blue-100 mb-2">
                      <div className="flex items-center gap-2">
                         <span className="font-medium text-blue-800">{bookFile.file.name}</span>
                         <span className="text-xs text-blue-400">({bookFile.rows.length} rows)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => bookInputRef.current?.click()} 
                          className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:bg-blue-100 px-2 py-1 rounded transition-colors"
                        >
                          <RefreshCw className="w-3 h-3" /> Replace
                        </button>
                        <button 
                          onClick={() => setBookFile(null)} 
                          className="flex items-center gap-1 text-xs font-medium text-red-500 hover:bg-red-100 px-2 py-1 rounded transition-colors"
                        >
                          <Trash2 className="w-3 h-3" /> Remove
                        </button>
                      </div>
                   </div>
                   {bookFile.mapping && (
                     <ColumnMapper 
                        filename={bookFile.file.name} 
                        headers={bookFile.headers} 
                        defaultMapping={bookFile.mapping} 
                        onChange={updateBookMapping}
                        type="BOOK"
                     />
                   )}
                </div>
              )}
            </div>

            {/* Payments Section */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
               <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold">2</div>
                  <h3 className="text-lg font-semibold text-slate-800">Company Payments</h3>
               </div>
               
               <FileUpload 
                  label="Add Payment Files" 
                  subLabel="Multiple CSV/Excel files allowed" 
                  accept=".csv,.xlsx,.xls"
                  multiple={true}
                  files={[]}
                  onFilesSelected={handlePaymentUpload}
                  onRemoveFile={() => {}}
                />

                <div className="space-y-4 mt-4">
                  {paymentFiles.map((pf, idx) => (
                    <div key={idx} className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
                       <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-2">
                             <span className="font-medium text-slate-700">{pf.file.name}</span>
                             <span className="text-xs text-slate-400">({pf.rows.length} rows)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => triggerPaymentReplace(idx)} 
                              className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                            >
                              <RefreshCw className="w-3 h-3" /> Replace
                            </button>
                            <button 
                              onClick={() => removePaymentFile(idx)} 
                              className="flex items-center gap-1 text-xs font-medium text-red-500 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                            >
                              <Trash2 className="w-3 h-3" /> Remove
                            </button>
                          </div>
                       </div>
                       {pf.mapping && (
                         <ColumnMapper 
                            filename={pf.file.name} 
                            headers={pf.headers} 
                            defaultMapping={pf.mapping} 
                            onChange={(m) => updatePaymentMapping(idx, m)}
                            type="PAYMENT"
                         />
                       )}
                    </div>
                  ))}
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5" />
                  {error}
                </div>
            )}

            <div className="flex justify-end pt-4 pb-20">
                <button
                  onClick={runAudit}
                  disabled={isProcessing || !bookFile || paymentFiles.length === 0}
                  className={`
                    flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-lg shadow-lg shadow-blue-500/20 transition-all
                    ${isProcessing || !bookFile || paymentFiles.length === 0
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-blue-500/30 transform hover:-translate-y-0.5'}
                  `}
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" /> Processing...
                    </>
                  ) : (
                    <>
                      Run Audit <ChevronRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>

          </div>
        )}

        {step === 2 && <Dashboard results={results} />}
      </main>
    </div>
  );
};

export default App;