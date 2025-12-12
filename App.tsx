import React, { useEffect, useState, useRef } from 'react';
import { RAW_OCR_DATA } from './constants';
import { parseOCRData } from './services/parser';
import { extractTextFromPDF } from './services/pdfService';
import { Asset, ViewMode, ImportSessionData, ImportConflict, MovementHistory, ConferenceSession, ConferenceRecord } from './types';
import { Dashboard } from './components/Dashboard';
import { AssetTable } from './components/AssetTable';
import { AIChat } from './components/AIChat';
import { ImportPreview } from './components/ImportPreview';
import { Conference } from './components/Conference';
import { LayoutDashboard, Table, MessageSquareText, ShieldCheck, Upload, FileText, Database, QrCode } from 'lucide-react';

const App: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.DASHBOARD);
  const [isLoading, setIsLoading] = useState(true);
  
  // Import Session State
  const [importSession, setImportSession] = useState<ImportSessionData | null>(null);

  // Conference State
  const [conferenceSession, setConferenceSession] = useState<ConferenceSession | null>(null);
  const [conferenceHistory, setConferenceHistory] = useState<ConferenceRecord[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load Initial Data
  useEffect(() => {
    const loadData = () => {
      try {
        // Assets
        const storedData = localStorage.getItem('patrimonio_db_v1');
        if (storedData) {
          setAssets(JSON.parse(storedData));
        } else {
          const parsedData = parseOCRData(RAW_OCR_DATA);
          setAssets(parsedData);
          localStorage.setItem('patrimonio_db_v1', JSON.stringify(parsedData));
        }

        // Conference History
        const storedHistory = localStorage.getItem('patrimonio_conferences_v1');
        if (storedHistory) {
          setConferenceHistory(JSON.parse(storedHistory));
        }

        // Active Session (Optional: could also be persisted if desired, currently memory only for simplicity)
        // Ideally, we might want to save current session to LS too.
      } catch (error) {
        console.error("Error loading database:", error);
      } finally {
        setIsLoading(false);
      }
    };

    setTimeout(loadData, 800);
  }, []);

  // Persist Assets
  useEffect(() => {
    if (!isLoading && assets.length > 0) {
      localStorage.setItem('patrimonio_db_v1', JSON.stringify(assets));
    }
  }, [assets, isLoading]);

  // Persist History
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem('patrimonio_conferences_v1', JSON.stringify(conferenceHistory));
    }
  }, [conferenceHistory, isLoading]);

  const handleUpdateAssets = (updatedAssets: Asset[]) => {
    setAssets(prevAssets => {
      const updatesMap = new Map(updatedAssets.map(a => [a.id, a]));
      return prevAssets.map(asset => updatesMap.get(asset.id) || asset);
    });
  };

  const handleConferenceCommit = (
    newAssets: Asset[], 
    updates: { id: string, newLocation: string }[],
    summary: { matches: number; aliens: number; newItems: number; missing: number }
  ) => {
    // 1. Update Assets Database
    setAssets(prev => {
      const assetMap = new Map(prev.map(a => [a.id, a]));

      // Process Updates (Moves)
      updates.forEach(u => {
        const asset = assetMap.get(u.id);
        if (asset && asset.location !== u.newLocation) {
          const historyEntry: MovementHistory = {
            date: new Date().toLocaleDateString('pt-BR'),
            fromLocation: asset.location,
            toLocation: u.newLocation,
            authorizedBy: 'Conferência'
          };
          assetMap.set(u.id, {
            ...asset,
            location: u.newLocation,
            history: [...asset.history, historyEntry]
          });
        }
      });

      // Process Inserts (New Items)
      newAssets.forEach(a => {
        if (!assetMap.has(a.id)) {
          assetMap.set(a.id, a);
        }
      });

      return Array.from(assetMap.values());
    });

    // 2. Save Conference Record to History
    if (conferenceSession) {
      const record: ConferenceRecord = {
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        location: conferenceSession.targetLocation,
        stats: summary,
        scannedItemsSnapshot: conferenceSession.scannedItems
      };
      setConferenceHistory(prev => [record, ...prev]);
    }
    
    // 3. Clear Session (Redirect to History View)
    setConferenceSession(null);
    alert('Conferência salva e finalizada com sucesso!');
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Por favor, selecione um arquivo PDF válido.');
      return;
    }

    setIsLoading(true);
    
    try {
      const pdfText = await extractTextFromPDF(file);
      const incomingAssets = parseOCRData(pdfText);
      
      if (incomingAssets.length === 0) {
        alert('Nenhum dado identificado. Verifique o PDF.');
        setIsLoading(false);
        return;
      }

      // --- Diff & Merge Logic ---
      const currentAssetMap = new Map(assets.map(a => [a.id, a]));
      const newRecords: Asset[] = [];
      const conflictRecords: ImportConflict[] = [];

      incomingAssets.forEach(incoming => {
        const existing = currentAssetMap.get(incoming.id);

        if (!existing) {
          newRecords.push(incoming);
        } else {
          const isLocationDifferent = existing.location !== incoming.location;
          const isValueDifferent = existing.value !== incoming.value;
          const isDescDifferent = existing.description !== incoming.description;

          if (isLocationDifferent || isValueDifferent || isDescDifferent) {
            conflictRecords.push({
              assetId: incoming.id,
              currentAsset: existing,
              incomingAsset: incoming,
              isResolved: false
            });
          }
        }
      });

      setImportSession({
        newAssets: newRecords,
        conflicts: conflictRecords,
        fileName: file.name
      });

    } catch (error) {
      console.error(error);
      alert('Erro ao processar o arquivo.');
    } finally {
      setIsLoading(false);
      if (event.target) event.target.value = '';
    }
  };

  const handleConfirmImport = (finalAssetsToMerge: Asset[]) => {
    setAssets(prev => {
      const currentMap = new Map(prev.map(a => [a.id, a]));
      finalAssetsToMerge.forEach(newItem => {
        currentMap.set(newItem.id, newItem);
      });
      return Array.from(currentMap.values());
    });

    setImportSession(null);
    setViewMode(ViewMode.LIST);
  };

  const cancelImport = () => {
    setImportSession(null);
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-lg font-semibold text-slate-700">Acessando Banco de Dados...</h2>
          <p className="text-sm text-slate-500 mt-2">Sincronizando registros.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        accept="application/pdf" 
        className="hidden" 
      />

      {/* Enhanced Import Preview with Conflict Resolution */}
      {importSession && (
        <ImportPreview 
          sessionData={importSession}
          onConfirm={handleConfirmImport}
          onCancel={cancelImport}
        />
      )}

      {/* Sidebar (Desktop) */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex-shrink-0 hidden md:flex flex-col">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <ShieldCheck className="text-blue-500" size={28} />
          <div>
            <h1 className="text-white font-bold text-lg leading-tight">PatrimonioView</h1>
            <p className="text-xs text-slate-500">Gestão Inteligente</p>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => setViewMode(ViewMode.DASHBOARD)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              viewMode === ViewMode.DASHBOARD ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'hover:bg-slate-800'
            }`}
          >
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </button>
          
          <button
            onClick={() => setViewMode(ViewMode.LIST)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              viewMode === ViewMode.LIST ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'hover:bg-slate-800'
            }`}
          >
            <Table size={20} />
            <span>Lista de Bens</span>
          </button>

          <button
            onClick={() => setViewMode(ViewMode.CONFERENCE)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              viewMode === ViewMode.CONFERENCE ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'hover:bg-slate-800'
            }`}
          >
            <QrCode size={20} />
            <div className="flex flex-col items-start">
               <span>Conferência</span>
               {conferenceSession && <span className="text-[10px] text-green-400 font-bold -mt-1">● Em andamento</span>}
            </div>
          </button>
          
          <button
            onClick={() => setViewMode(ViewMode.AI_CHAT)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              viewMode === ViewMode.AI_CHAT ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'hover:bg-slate-800'
            }`}
          >
            <MessageSquareText size={20} />
            <span>Consultar IA</span>
          </button>

          <div className="pt-4 mt-4 border-t border-slate-800">
            <button
              onClick={triggerFileUpload}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-slate-300 hover:bg-slate-800 hover:text-white group"
            >
              <Upload size={20} className="text-slate-500 group-hover:text-blue-400 transition-colors" />
              <span>Importar PDF</span>
            </button>
          </div>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="bg-slate-800 rounded-lg p-3">
            <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
              <Database size={10} /> Banco de Dados Local
            </p>
            <div className="flex items-center gap-2 text-xs text-green-400">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Ativo ({assets.length} registros)
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto h-screen relative">
        <header className="bg-white border-b border-slate-200 p-4 md:hidden flex justify-between items-center sticky top-0 z-10">
           <div className="flex items-center gap-2">
            <ShieldCheck className="text-blue-600" size={24} />
            <span className="font-bold text-slate-800">PatrimonioView</span>
           </div>
           
           <div className="flex gap-2">
             <button onClick={() => setViewMode(ViewMode.CONFERENCE)} className={`p-2 rounded-full relative ${viewMode === ViewMode.CONFERENCE ? 'bg-blue-100 text-blue-600' : 'text-slate-600'}`}>
                <QrCode size={20} />
                {conferenceSession && <span className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full border border-white"></span>}
             </button>
             <button onClick={() => setViewMode(ViewMode.DASHBOARD)} className="p-2 bg-slate-100 rounded-full text-slate-600">
               <LayoutDashboard size={20} />
             </button>
           </div>
        </header>

        {viewMode === ViewMode.DASHBOARD && <Dashboard assets={assets} />}
        {viewMode === ViewMode.LIST && <AssetTable assets={assets} onUpdateAssets={handleUpdateAssets} />}
        {viewMode === ViewMode.AI_CHAT && <AIChat assets={assets} />}
        {viewMode === ViewMode.CONFERENCE && (
          <Conference 
            assets={assets} 
            session={conferenceSession}
            history={conferenceHistory}
            onUpdateSession={setConferenceSession}
            onCommitChanges={handleConferenceCommit} 
          />
        )}
      </main>
    </div>
  );
};

export default App;