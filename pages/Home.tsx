import React, { useState, useCallback, useMemo } from 'react';
import { AppState, Transaction, FinancialInsights, View, FileState, GoalPlan, GoalInput } from '../types';
import { extractTransactions, getFinancialInsights, getGoalPlan } from '../services/geminiService';
import { isPdfEncrypted, getPdfPageImagesAsBase64 } from '../services/pdfService';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

import { FileUpload } from '../components/FileUpload';
import { ProcessingView } from '../components/ProcessingView';
import { ResultsTable } from '../components/ResultsTable';
import { InsightsView } from '../components/InsightsView';
import { GoalPlannerView } from '../components/GoalPlannerView';
import { SegmentedControl } from '../components/SegmentedControl';
import { Button } from '../components/Button';
import { XCircleIcon } from '../components/icons/XCircleIcon';
import { ArrowDownTrayIcon } from '../components/icons/ArrowDownTrayIcon';
import { ClipboardDocumentIcon } from '../components/icons/ClipboardDocumentIcon';
import { FilePasswordList } from '../components/FilePasswordList';
import { PaywallModal } from '../components/PaywallModal';
import { Footer } from '../components/Footer';

export const Home: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [files, setFiles] = useState<FileState[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [insights, setInsights] = useState<FinancialInsights | null>(null);
  const [goalPlan, setGoalPlan] = useState<GoalPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<View>(View.TRANSACTIONS);
  const [showPaywall, setShowPaywall] = useState(false);

  const { user, canConvert, remainingConversions, refreshSubscription } = useAuth();

  const handleFilesSelect = useCallback(async (selectedFiles: File[]) => {
    const validFiles = selectedFiles.filter(file => file.name.toLowerCase().endsWith('.pdf'));
    if (validFiles.length !== selectedFiles.length) {
      setError("One or more files were not PDFs and have been ignored.");
    }
    if (validFiles.length === 0) return;

    setAppState(AppState.FILES_SELECTED);

    const fileStates: FileState[] = validFiles.map(file => ({
      id: `${file.name}-${file.lastModified}`,
      file,
      status: 'pending',
    }));
    setFiles(fileStates);

    fileStates.forEach(async (fs) => {
      try {
        const encrypted = await isPdfEncrypted(fs.file);
        if (encrypted) {
          setFiles(prev => prev.map(f => f.id === fs.id ? { ...f, status: 'needsPassword' } : f));
        } else {
          setFiles(prev => prev.map(f => f.id === fs.id ? { ...f, status: 'ready' } : f));
        }
      } catch (err: any) {
        console.error(`Failed to process ${fs.file.name}:`, err);
        const message = err.message || 'Could not read this PDF. It may be corrupted or unsupported.';
        setFiles(prev => prev.map(f => f.id === fs.id ? { ...f, status: 'error', errorMessage: message } : f));
      }
    });
  }, []);

  const handlePasswordChange = (id: string, password: string) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, password } : f));
  };

  const handleConvertAll = async () => {
    if (!user) {
      setError('Please sign in to convert statements');
      return;
    }

    if (!canConvert()) {
      setShowPaywall(true);
      return;
    }

    setAppState(AppState.PROCESSING);
    setGoalPlan(null);

    const allTransactions: Transaction[] = [];
    const processingErrors: string[] = [];

    for (const fileState of files) {
      if (fileState.status === 'error' || fileState.status === 'success') continue;

      setFiles(prev => prev.map(f => f.id === fileState.id ? { ...f, status: 'processing' } : f));
      try {
        const pdfImages = await getPdfPageImagesAsBase64(fileState.file, fileState.password);
        const extracted = await extractTransactions(pdfImages, fileState.file.name);

        setFiles(prev => prev.map(f => f.id === fileState.id ? { ...f, status: 'success' } : f));

        if (extracted.length > 0) {
          allTransactions.push(...extracted);
        }
      } catch (err: any) {
        console.error(`Conversion failed for ${fileState.file.name}:`, err);
        const errorMessage = err.message || 'An unknown error occurred during processing.';
        processingErrors.push(`${fileState.file.name}: ${errorMessage}`);
        setFiles(prev => prev.map(f => f.id === fileState.id ? { ...f, status: 'error', errorMessage } : f));
      }
    }

    if (allTransactions.length > 0) {
      allTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setTransactions(allTransactions);

      try {
        const insightsData = await getFinancialInsights(allTransactions);
        setInsights(insightsData);
      } catch (err) {
        console.error("Could not generate AI insights:", err);
      }

      try {
        await supabase.from('conversions_history').insert({
          user_id: user.id,
          filename: files.map(f => f.file.name).join(', '),
          transaction_count: allTransactions.length,
          status: 'success'
        });

        const { data: currentUsage } = await supabase
          .from('user_usage')
          .select('conversions_used')
          .eq('user_id', user.id)
          .single();

        if (currentUsage) {
          await supabase
            .from('user_usage')
            .update({ conversions_used: currentUsage.conversions_used + 1 })
            .eq('user_id', user.id);
        }

        await refreshSubscription();
      } catch (err) {
        console.error('Error updating usage:', err);
      }

      setAppState(AppState.SUCCESS);
    } else {
      if (processingErrors.length > 0) {
        setError(`Processing failed for one or more files:\n- ${processingErrors.join('\n- ')}`);
      } else if (files.every(f => f.status !== 'error')) {
        setError("We successfully processed your document(s), but couldn't find any transactional data.");
      } else {
        setError("No transactions could be extracted from the selected files.");
      }
      setAppState(AppState.ERROR);
    }
  };

  const handleReset = () => {
    setAppState(AppState.IDLE);
    setFiles([]);
    setTransactions([]);
    setInsights(null);
    setGoalPlan(null);
    setError(null);
    setActiveView(View.TRANSACTIONS);
  };

  const handleDownload = () => {
    const convertToCSV = (data: Transaction[]): string => {
      const header = ['Date', 'Description', 'Debit', 'Credit', 'Balance', 'SourceFile'];
      const rows = data.map(tx =>
        [`"${tx.date ?? ''}"`, `"${(tx.description ?? '').replace(/"/g, '""')}"`, tx.debit ?? '', tx.credit ?? '', tx.balance ?? '', `"${tx.sourceFile ?? ''}"`].join(',')
      );
      return [header.join(','), ...rows].join('\n');
    };
    const csvData = convertToCSV(transactions);
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `combined_transactions.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopy = () => {
    const convertToTSV = (data: Transaction[]): string => {
      const header = ['Date', 'Description', 'Debit', 'Credit', 'Balance', 'SourceFile'];
      const rows = data.map(tx =>
        [tx.date ?? '', tx.description ?? '', tx.debit ?? '', tx.credit ?? '', tx.balance ?? '', tx.sourceFile ?? ''].join('\t')
      );
      return [header.join('\t'), ...rows].join('\n');
    };
    const tsvData = convertToTSV(transactions);
    navigator.clipboard.writeText(tsvData).then(() => {
      alert('Transaction data copied to clipboard!');
    }, (err) => {
      console.error('Failed to copy text: ', err);
      alert('Failed to copy data. Please try again.');
    });
  };

  const handleGetGoalPlan = async (goal: GoalInput): Promise<GoalPlan> => {
    const plan = await getGoalPlan(transactions, goal);
    setGoalPlan(plan);
    return plan;
  };

  const isConversionReady = useMemo(() => {
    if (files.length === 0) return false;
    const hasReadyFiles = files.some(f => f.status === 'ready' || f.status === 'needsPassword');
    const allPasswordsEntered = files.every(f => f.status !== 'needsPassword' || (f.password && f.password.length > 0));
    return hasReadyFiles && allPasswordsEntered;
  }, [files]);

  const renderSuccessView = () => (
    <div className="w-full max-w-6xl mx-auto animate-fade-in">
      <div className="mb-8">
        <SegmentedControl
          options={[
            { label: 'Transactions', value: View.TRANSACTIONS },
            { label: 'AI Insights', value: View.INSIGHTS },
            { label: 'Goal Planner', value: View.GOAL_PLANNER },
          ]}
          activeValue={activeView}
          onValueChange={(value) => setActiveView(value as View)}
        />
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 px-1">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Conversion Complete</h2>
          <p className="text-gray-500 mt-1">Extracted {transactions.length} transactions from {files.filter(f => f.status === 'success').length} statement(s).</p>
        </div>
        <div className="flex items-center flex-wrap justify-center gap-2 sm:gap-4 mt-4 sm:mt-0">
          <Button onClick={handleReset} variant="secondary">Convert More</Button>
          <Button onClick={handleCopy} variant="secondary" icon={<ClipboardDocumentIcon className="w-5 h-5" />}>Copy</Button>
          <Button onClick={handleDownload} icon={<ArrowDownTrayIcon className="w-5 h-5" />}>
            Download CSV
          </Button>
        </div>
      </div>

      {activeView === View.TRANSACTIONS && <ResultsTable transactions={transactions} />}
      {activeView === View.INSIGHTS && insights && <InsightsView insights={insights} />}
      {activeView === View.GOAL_PLANNER && (
        <GoalPlannerView
          onGetPlan={handleGetGoalPlan}
          existingPlan={goalPlan}
        />
      )}
    </div>
  );

  const renderContent = () => {
    switch (appState) {
      case AppState.IDLE:
        return (
          <>
            <div className="text-center mb-12">
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900">
                Statement Converter
              </h1>
              <p className="mt-3 text-lg text-gray-600 max-w-2xl mx-auto">
                Instantly transform your PDF bank statements into an organized Excel-ready format with the power of AI.
              </p>
              {user && (
                <p className="mt-2 text-sm text-blue-600 font-medium">
                  {remainingConversions() >= 0 ? `${remainingConversions()} conversions remaining` : 'Unlimited conversions'}
                </p>
              )}
            </div>
            <FileUpload onFilesSelect={handleFilesSelect} disabled={false} />
          </>
        );
      case AppState.FILES_SELECTED:
        return (
          <FilePasswordList
            files={files}
            onPasswordChange={handlePasswordChange}
            onConvert={handleConvertAll}
            isReady={isConversionReady}
            onCancel={handleReset}
          />
        );
      case AppState.PROCESSING:
        return <ProcessingView />;
      case AppState.SUCCESS:
        return renderSuccessView();
      case AppState.ERROR:
        return (
          <div className="w-full max-w-lg mx-auto text-center p-8 bg-white border border-red-200 rounded-2xl shadow-sm">
            <XCircleIcon className="w-16 h-16 text-red-500 mx-auto" />
            <h3 className="mt-4 text-xl font-semibold text-gray-800">An Error Occurred</h3>
            <p className="mt-2 text-gray-600 whitespace-pre-wrap">{error}</p>
            <Button onClick={handleReset} className="mt-6">
              Try Again
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 apple-gradient flex flex-col">
      <div className="flex-grow">
        <div className="container mx-auto px-4 py-8 sm:py-16">
          <main className="flex items-center justify-center">
            <div className="w-full transition-all duration-500 ease-in-out">
              {renderContent()}
            </div>
          </main>
        </div>
      </div>
      <Footer />
      <PaywallModal isOpen={showPaywall} onClose={() => setShowPaywall(false)} />
    </div>
  );
};
