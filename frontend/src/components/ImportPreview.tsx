import React, { useState, useMemo } from 'react';
import { Asset, ImportSessionData, ImportConflict } from '../types';
import { FileText, AlertTriangle, Check, X, ArrowRight, Save, Database, AlertCircle } from 'lucide-react';

interface ImportPreviewProps {
  sessionData: ImportSessionData;
  onConfirm: (assetsToMerge: Asset[]) => void;
  onCancel: () => void;
}

export const ImportPreview: React.FC<ImportPreviewProps> = ({ sessionData, onConfirm, onCancel }) => {
  const [activeTab, setActiveTab] = useState<'new' | 'conflicts'>('new');
  const [conflicts, setConflicts] = useState<ImportConflict[]>(sessionData.conflicts);

  // Statistics
  const newCount = sessionData.newAssets.length;
  const conflictCount = conflicts.length;
  const pendingConflicts = conflicts.filter(c => !c.isResolved).length;

  const handleResolve = (id: string, resolution: 'current' | 'incoming') => {
    setConflicts(prev => prev.map(c => 
      c.assetId === id ? { ...c, isResolved: true, resolution } : c
    ));
  };

  const handleResolveAll = (resolution: 'current' | 'incoming') => {
    setConflicts(prev => prev.map(c => ({ ...c, isResolved: true, resolution })));
  };

  const handleFinalConfirm = () => {
    // 1. Start with new assets (inserts)
    const finalMergeList: Asset[] = [...sessionData.newAssets];

    // 2. Add resolved conflicts that chose 'incoming' (updates)
    // If 'current' was chosen, we simply don't add it to the merge list, preserving the DB state.
    conflicts.forEach(c => {
      if (c.isResolved && c.resolution === 'incoming') {
        finalMergeList.push(c.incomingAsset);
      }
    });

    onConfirm(finalMergeList);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 bg-slate-50">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Database className="text-blue-600" />
                Sincronização de Dados
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Processando arquivo: <span className="font-medium text-slate-700">{sessionData.fileName}</span>
              </p>
            </div>
            <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
              <X size={24} />
            </button>
          </div>

          <div className="flex gap-4">
            <button 
              onClick={() => setActiveTab('new')}
              className={`flex-1 p-3 rounded-lg border flex items-center justify-center gap-2 transition-all ${
                activeTab === 'new' 
                  ? 'bg-green-50 border-green-200 text-green-700 ring-1 ring-green-200' 
                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              <div className="bg-green-100 p-1 rounded text-green-600 text-xs font-bold">{newCount}</div>
              <span className="font-medium">Novos Registros</span>
            </button>

            <button 
              onClick={() => setActiveTab('conflicts')}
              disabled={conflictCount === 0}
              className={`flex-1 p-3 rounded-lg border flex items-center justify-center gap-2 transition-all ${
                activeTab === 'conflicts' 
                  ? 'bg-amber-50 border-amber-200 text-amber-700 ring-1 ring-amber-200' 
                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50'
              }`}
            >
              <div className="bg-amber-100 p-1 rounded text-amber-600 text-xs font-bold">{conflictCount}</div>
              <span className="font-medium">Conflitos de Dados</span>
              {pendingConflicts > 0 && <AlertTriangle size={16} className="text-amber-500 animate-pulse" />}
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden bg-slate-50/50 relative">
          
          {/* NEW RECORDS TAB */}
          {activeTab === 'new' && (
             <div className="h-full overflow-auto">
               {newCount === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center text-slate-400">
                   <Check size={48} className="mb-2 text-slate-300" />
                   <p>Nenhum registro novo encontrado.</p>
                 </div>
               ) : (
                 <table className="w-full text-left border-collapse">
                   <thead className="sticky top-0 bg-white shadow-sm z-10">
                     <tr className="text-xs font-semibold text-slate-500 uppercase">
                       <th className="p-3 border-b">Tombo</th>
                       <th className="p-3 border-b">Descrição</th>
                       <th className="p-3 border-b">Local</th>
                       <th className="p-3 border-b text-right">Valor</th>
                     </tr>
                   </thead>
                   <tbody className="bg-white divide-y divide-slate-100 text-sm">
                     {sessionData.newAssets.map((asset, i) => (
                       <tr key={i}>
                         <td className="p-3 font-mono text-green-600">{asset.id}</td>
                         <td className="p-3 truncate max-w-xs">{asset.description}</td>
                         <td className="p-3">{asset.location}</td>
                         <td className="p-3 text-right">{asset.valueFormatted}</td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               )}
             </div>
          )}

          {/* CONFLICTS TAB */}
          {activeTab === 'conflicts' && (
            <div className="h-full overflow-auto p-4 space-y-4">
              
              {/* Bulk Actions */}
              {pendingConflicts > 0 && (
                <div className="flex justify-between items-center bg-amber-50 border border-amber-100 p-3 rounded-lg mb-4">
                  <div className="flex items-center gap-2 text-amber-700 text-sm">
                    <AlertCircle size={18} />
                    <span>Há <b>{pendingConflicts}</b> itens com dados divergentes (ex: Localização alterada).</span>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleResolveAll('current')}
                      className="px-3 py-1.5 bg-white border border-amber-200 text-amber-700 text-xs font-medium rounded hover:bg-amber-100 transition-colors"
                    >
                      Manter Todos Originais
                    </button>
                    <button 
                      onClick={() => handleResolveAll('incoming')}
                      className="px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded hover:bg-amber-700 transition-colors"
                    >
                      Atualizar Todos
                    </button>
                  </div>
                </div>
              )}

              {conflicts.map((conflict) => {
                const isLocDiff = conflict.currentAsset.location !== conflict.incomingAsset.location;
                const isValDiff = conflict.currentAsset.value !== conflict.incomingAsset.value;

                return (
                  <div key={conflict.assetId} className={`bg-white border rounded-lg overflow-hidden transition-all ${conflict.isResolved ? 'opacity-60 border-slate-200' : 'border-amber-200 shadow-sm ring-1 ring-amber-100'}`}>
                    <div className="bg-slate-50 p-3 border-b border-slate-100 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                         <span className="font-mono font-bold text-slate-700 bg-slate-200 px-2 py-0.5 rounded text-xs">{conflict.assetId}</span>
                         <span className="text-sm text-slate-600 font-medium truncate max-w-md">{conflict.currentAsset.description}</span>
                      </div>
                      {conflict.isResolved && (
                        <span className={`text-xs px-2 py-1 rounded font-medium ${conflict.resolution === 'current' ? 'bg-slate-200 text-slate-600' : 'bg-green-100 text-green-700'}`}>
                          {conflict.resolution === 'current' ? 'Mantido Original' : 'Atualizado'}
                        </span>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 text-sm">
                      {/* Current Side */}
                      <div className={`p-4 border-r border-slate-100 ${conflict.resolution === 'current' ? 'bg-green-50/30' : ''}`}>
                        <div className="text-xs text-slate-400 uppercase font-bold mb-2">No Banco de Dados</div>
                        <div className={`flex justify-between items-center mb-1 ${isLocDiff ? 'bg-red-50 p-1 -mx-1 rounded' : ''}`}>
                          <span className="text-slate-500 text-xs">Local:</span>
                          <span className="font-medium">{conflict.currentAsset.location}</span>
                        </div>
                        <div className={`flex justify-between items-center ${isValDiff ? 'bg-red-50 p-1 -mx-1 rounded' : ''}`}>
                           <span className="text-slate-500 text-xs">Valor:</span>
                           <span>{conflict.currentAsset.valueFormatted}</span>
                        </div>
                        
                        {!conflict.isResolved && (
                          <button 
                            onClick={() => handleResolve(conflict.assetId, 'current')}
                            className="mt-4 w-full py-2 border border-slate-300 text-slate-600 rounded hover:bg-slate-50 text-xs font-bold transition-colors"
                          >
                            Manter Original
                          </button>
                        )}
                      </div>

                      {/* Incoming Side */}
                      <div className={`p-4 ${conflict.resolution === 'incoming' ? 'bg-green-50/30' : ''}`}>
                         <div className="text-xs text-blue-500 uppercase font-bold mb-2 flex items-center gap-2">
                           No Arquivo PDF <FileText size={10} />
                         </div>
                         <div className={`flex justify-between items-center mb-1 ${isLocDiff ? 'bg-green-50 p-1 -mx-1 rounded text-green-700' : ''}`}>
                          <span className="text-slate-500 text-xs">Local:</span>
                          <span className="font-medium">{conflict.incomingAsset.location}</span>
                        </div>
                        <div className={`flex justify-between items-center ${isValDiff ? 'bg-green-50 p-1 -mx-1 rounded text-green-700' : ''}`}>
                           <span className="text-slate-500 text-xs">Valor:</span>
                           <span>{conflict.incomingAsset.valueFormatted}</span>
                        </div>

                        {!conflict.isResolved && (
                          <button 
                             onClick={() => handleResolve(conflict.assetId, 'incoming')}
                             className="mt-4 w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs font-bold transition-colors shadow-sm"
                          >
                            Atualizar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex justify-between items-center">
          <div className="text-sm text-slate-500">
             {activeTab === 'conflicts' && pendingConflicts > 0 
                ? <span className="text-amber-600">Resolva os {pendingConflicts} conflitos pendentes para continuar.</span>
                : <span>Pronto para sincronizar.</span>
             }
          </div>
          <div className="flex gap-3">
            <button 
              onClick={onCancel}
              className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button 
              onClick={handleFinalConfirm}
              disabled={pendingConflicts > 0}
              className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={18} />
              Confirmar & Salvar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};