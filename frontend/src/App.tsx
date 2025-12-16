import React, { useEffect, useState, useRef } from 'react';
import { extractTextFromPDF } from './services/pdfService';
import apiService, { User } from './services/apiService';
import { Asset, ViewMode, ImportSessionData, ImportConflict, MovementHistory, ConferenceSession, ConferenceRecord } from './types';
import { Dashboard } from './components/Dashboard';
import { AssetTable } from './components/AssetTable';
import { AIChat } from './components/AIChat';
import { ImportPreview } from './components/ImportPreview';
import { Conference } from './components/Conference';
import { AssetDetail } from './components/AssetDetail';
import { AdminPanel } from './components/AdminPanel';
import { LayoutDashboard, Table, MessageSquareText, ShieldCheck, Upload, FileText, Database, QrCode, Menu, X, Shield, LogOut } from 'lucide-react';

const App: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.DASHBOARD);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // Import Session State
  const [importSession, setImportSession] = useState<ImportSessionData | null>(null);

  // Conference State
  const [conferenceSession, setConferenceSession] = useState<ConferenceSession | null>(null);
  const [conferenceHistory, setConferenceHistory] = useState<ConferenceRecord[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load Initial Data from Backend
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load current user
        const { user } = await apiService.getMe();
        setCurrentUser(user);

        // Load assets from backend
        const loadedAssets = await apiService.getAssets();
        setAssets(loadedAssets);

        // Load conference history from backend
        const loadedConferences = await apiService.getConferences();
        setConferenceHistory(loadedConferences);
      } catch (error) {
        console.error("Error loading data from backend:", error);
        alert('Erro ao carregar dados do servidor. Verifique se o backend está rodando.');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const handleUpdateAssets = (updatedAssets: Asset[]) => {
    setAssets(prevAssets => {
      const updatesMap = new Map(updatedAssets.map(a => [a.id, a]));
      return prevAssets.map(asset => updatesMap.get(asset.id) || asset);
    });
  };

  const handleConferenceCommit = async (
    newAssets: Asset[], 
    updates: { id: string, newLocation: string }[],
    summary: { matches: number; aliens: number; newItems: number; missing: number }
  ) => {
    try {
      setIsLoading(true);

      // 1. Create conference record first
      let conferenceId: string;
      if (conferenceSession) {
        const record: ConferenceRecord = {
          id: crypto.randomUUID(),
          date: new Date().toISOString(),
          location: conferenceSession.targetLocation,
          stats: summary,
          scannedItemsSnapshot: conferenceSession.scannedItems
        };
        
        const createdConference = await apiService.createConference(record);
        conferenceId = createdConference.id;
      } else {
        throw new Error('No conference session');
      }

      // 2. Commit changes to backend (new assets, updates, etc.)
      await apiService.commitConference(conferenceId, {
        newAssets,
        updates,
        summary
      });

      // 3. Reload data from backend
      const updatedAssets = await apiService.getAssets();
      setAssets(updatedAssets);

      const updatedConferences = await apiService.getConferences();
      setConferenceHistory(updatedConferences);
      
      // 4. Clear Session
      setConferenceSession(null);
      alert('Conferência salva e finalizada com sucesso!');
    } catch (error) {
      console.error('Error committing conference:', error);
      alert('Erro ao salvar conferência. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
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
      // Extract text from PDF (client-side)
      const pdfText = await extractTextFromPDF(file);
      
      // Send to backend for processing and conflict detection
      const importResult = await apiService.importAssets(pdfText);
      
      if (importResult.newAssets.length === 0 && importResult.conflicts.length === 0) {
        alert('Nenhum dado identificado. Verifique o PDF.');
        setIsLoading(false);
        return;
      }

      setImportSession({
        newAssets: importResult.newAssets,
        conflicts: importResult.conflicts,
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

  const handleConfirmImport = async (finalAssetsToMerge: Asset[]) => {
    try {
      setIsLoading(true);
      
      // Send to backend for bulk upsert
      await apiService.bulkUpsertAssets(finalAssetsToMerge);
      
      // Reload assets from backend
      const updatedAssets = await apiService.getAssets();
      setAssets(updatedAssets);

      setImportSession(null);
      setViewMode(ViewMode.LIST);
    } catch (error) {
      console.error('Error confirming import:', error);
      alert('Erro ao salvar importação. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const cancelImport = () => {
    setImportSession(null);
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleLogout = async () => {
    if (confirm('Deseja realmente sair?')) {
      try {
        await apiService.logout();
        window.location.reload();
      } catch (error) {
        console.error('Erro ao fazer logout:', error);
      }
    }
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

          {currentUser?.isAdmin && (
            <button
              onClick={() => setViewMode(ViewMode.ADMIN)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                viewMode === ViewMode.ADMIN ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/20' : 'hover:bg-slate-800'
              }`}
            >
              <Shield size={20} />
              <span>Gerenciar Usuários</span>
            </button>
          )}

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

        <div className="p-4 border-t border-slate-800 space-y-3">
          <div className="bg-slate-800 rounded-lg p-3">
            <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
              <Database size={10} /> Banco de Dados SQLite
            </p>
            <div className="flex items-center gap-2 text-xs text-green-400">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Ativo ({assets.length} registros)
            </div>
          </div>

          {currentUser && (
            <div className="bg-slate-800 rounded-lg p-3">
              <p className="text-xs text-slate-400 mb-1">Usuário:</p>
              <p className="text-xs text-white font-semibold truncate">{currentUser.name}</p>
              <p className="text-xs text-slate-400 truncate">{currentUser.email}</p>
              {currentUser.isAdmin && (
                <div className="mt-1 inline-flex items-center px-2 py-1 bg-purple-600 rounded text-xs text-white font-semibold">
                  <Shield size={10} className="mr-1" /> Admin
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-slate-300 hover:bg-red-900/50 hover:text-white group"
          >
            <LogOut size={20} className="text-slate-500 group-hover:text-red-400 transition-colors" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside className={`fixed top-0 left-0 h-full w-64 bg-slate-900 text-slate-300 z-50 transform transition-transform duration-300 ease-in-out md:hidden ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-blue-500" size={28} />
            <div>
              <h1 className="text-white font-bold text-lg leading-tight">PatrimonioView</h1>
              <p className="text-xs text-slate-500">Gestão Inteligente</p>
            </div>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="text-slate-400 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <button
            onClick={() => {
              setViewMode(ViewMode.DASHBOARD);
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              viewMode === ViewMode.DASHBOARD ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'hover:bg-slate-800'
            }`}
          >
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </button>
          
          <button
            onClick={() => {
              setViewMode(ViewMode.LIST);
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              viewMode === ViewMode.LIST ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'hover:bg-slate-800'
            }`}
          >
            <Table size={20} />
            <span>Lista de Bens</span>
          </button>

          <button
            onClick={() => {
              setViewMode(ViewMode.CONFERENCE);
              setIsMobileMenuOpen(false);
            }}
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
            onClick={() => {
              setViewMode(ViewMode.AI_CHAT);
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              viewMode === ViewMode.AI_CHAT ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'hover:bg-slate-800'
            }`}
          >
            <MessageSquareText size={20} />
            <span>Consultar IA</span>
          </button>

          <div className="pt-4 mt-4 border-t border-slate-800">
            <button
              onClick={() => {
                triggerFileUpload();
                setIsMobileMenuOpen(false);
              }}
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
              <Database size={10} /> Banco de Dados SQLite
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
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
            >
              <Menu size={24} />
            </button>
            <ShieldCheck className="text-blue-600" size={24} />
            <span className="font-bold text-slate-800">PatrimonioView</span>
           </div>
           
           <div className="flex gap-2">
             <button 
               onClick={() => setViewMode(ViewMode.CONFERENCE)} 
               className={`p-2 rounded-full relative ${viewMode === ViewMode.CONFERENCE ? 'bg-blue-100 text-blue-600' : 'text-slate-600 hover:bg-slate-100'}`}
             >
                <QrCode size={20} />
                {conferenceSession && <span className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full border border-white"></span>}
             </button>
             <button 
               onClick={() => setViewMode(ViewMode.DASHBOARD)} 
               className={`p-2 rounded-full ${viewMode === ViewMode.DASHBOARD ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
             >
               <LayoutDashboard size={20} />
             </button>
           </div>
        </header>

        {viewMode === ViewMode.DASHBOARD && <Dashboard assets={assets} />}
        {viewMode === ViewMode.LIST && (
          <AssetTable 
            assets={assets} 
            onUpdateAssets={handleUpdateAssets}
            onViewAsset={(asset) => {
              setSelectedAsset(asset);
              setViewMode(ViewMode.ASSET_DETAIL);
            }}
          />
        )}
        {viewMode === ViewMode.AI_CHAT && <AIChat assets={assets} />}
        {viewMode === ViewMode.ADMIN && <AdminPanel />}
        {viewMode === ViewMode.CONFERENCE && (
          <Conference 
            assets={assets} 
            session={conferenceSession}
            history={conferenceHistory}
            onUpdateSession={setConferenceSession}
            onCommitChanges={handleConferenceCommit} 
          />
        )}
        {viewMode === ViewMode.ASSET_DETAIL && selectedAsset && (
          <AssetDetail
            asset={selectedAsset}
            onBack={() => {
              setViewMode(ViewMode.LIST);
              setSelectedAsset(null);
            }}
            onEdit={async (asset) => {
              // Reload asset from backend to get latest data
              try {
                const updatedAsset = await apiService.getAsset(asset.id);
                setSelectedAsset(updatedAsset);
                // Keep in detail view, but could also open edit modal here
              } catch (error) {
                console.error('Error loading asset:', error);
              }
            }}
            onUpdateAsset={async (updatedAsset) => {
              try {
                await apiService.updateAsset(updatedAsset.id, updatedAsset);
                // Reload all assets to ensure consistency
                const updatedAssets = await apiService.getAssets();
                setAssets(updatedAssets);
                // Update selected asset to show latest data
                const refreshedAsset = updatedAssets.find(a => a.id === updatedAsset.id);
                if (refreshedAsset) {
                  setSelectedAsset(refreshedAsset);
                }
              } catch (error) {
                console.error('Error updating asset:', error);
                alert('Erro ao atualizar item. Tente novamente.');
              }
            }}
          />
        )}
      </main>
    </div>
  );
};

export default App;