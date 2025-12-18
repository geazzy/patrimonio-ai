import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Asset, ScannedItem, ScanStatus, ConferenceSession, ConferenceRecord, User } from '../types';
import { QrCode, CheckCircle, AlertTriangle, HelpCircle, ArrowRight, MapPin, X, Save, RotateCcw, ChevronLeft, Trash2, Calendar, ClipboardList, Plus, Eye, PlayCircle, Send, Trash } from 'lucide-react';
import apiService from '../services/apiService';

interface ConferenceProps {
  assets: Asset[];
  session: ConferenceSession | null;
  history: ConferenceRecord[];
  onUpdateSession: (session: ConferenceSession | null) => void;
  onCommitChanges: (
    newAssets: Asset[], 
    updates: { id: string, newLocation: string }[],
    summary: { matches: number; aliens: number; newItems: number; missing: number },
    notes?: string
  ) => void;
  onReloadAssets?: () => Promise<void>;
  onReloadConferences?: () => Promise<void>;
  currentUser?: User;
}

export const Conference: React.FC<ConferenceProps> = ({ assets, session, history, onUpdateSession, onCommitChanges, onReloadAssets, onReloadConferences, currentUser }) => {
  // View State: 'LIST' (History) or 'SETUP' (New Conf). If session exists, this is ignored.
  const [localView, setLocalView] = useState<'LIST' | 'SETUP' | 'VIEW'>('LIST');
  const [selectedRecord, setSelectedRecord] = useState<ConferenceRecord | null>(null);

  // Local state for Setup input
  const [setupLocation, setSetupLocation] = useState('');
  const [showNewLocationModal, setShowNewLocationModal] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');
  
  // Scanning Inputs
  const [inputId, setInputId] = useState('');
  const [newItemDesc, setNewItemDesc] = useState('');
  const [showNewItemModal, setShowNewItemModal] = useState(false);
  const [tempIdForNew, setTempIdForNew] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Transfer Selection State (IDs of Aliens selected to move)
  const [selectedTransfers, setSelectedTransfers] = useState<Set<string>>(new Set());

  // Conference notes (for REPORT stage)
  const [notes, setNotes] = useState<string>('');

  // Derived data for selected record (history preview)
  const selectedSnapshot = useMemo(() => {
    if (!selectedRecord) return [];
    return (selectedRecord.scannedItemsSnapshot || []).map((it) => ({
      ...it,
      timestamp: new Date(it.timestamp)
    }));
  }, [selectedRecord]);

  const selectedReportData = useMemo(() => {
    if (!selectedRecord) {
      return {
        matches: [],
        aliens: [],
        newItems: [],
        missing: [] as Asset[]
      };
    }
    const matches = selectedSnapshot.filter(i => i.status === 'MATCH');
    const aliens = selectedSnapshot.filter(i => i.status === 'ALIEN');
    const newItems = selectedSnapshot.filter(i => i.status === 'NEW');
    const scannedIds = new Set(selectedSnapshot.map(i => i.id));
    const missing = assets.filter(a => a.location === selectedRecord.location && !scannedIds.has(a.id));
    return { matches, aliens, newItems, missing };
  }, [selectedRecord, selectedSnapshot, assets]);

  const selectedMissingCount = useMemo(() => {
    if (!selectedRecord) return 0;
    return selectedReportData.missing.length || selectedRecord.stats.missing;
  }, [selectedRecord, selectedReportData]);

  // Derive State from Session
  const scannedItems = session?.scannedItems || [];
  const targetLocation = session?.targetLocation || '';
  const stage = session?.stage || 'SETUP';

  // Computed Lists
  const availableLocations = useMemo(() => 
    [...new Set(assets.map(a => a.location))].sort(), 
  [assets]);

  const expectedAssets = useMemo(() => 
    assets.filter(a => a.location === targetLocation),
  [assets, targetLocation]);

  // Report Stats
  const report = useMemo(() => {
    if (!session) return { matches: [], aliens: [], newItems: [], missing: [] };

    const scannedIds = new Set(scannedItems.map(i => i.id));
    const matches = scannedItems.filter(i => i.status === 'MATCH');
    const aliens = scannedItems.filter(i => i.status === 'ALIEN');
    const newItems = scannedItems.filter(i => i.status === 'NEW');
    const missing = expectedAssets.filter(a => !scannedIds.has(a.id));

    return { matches, aliens, newItems, missing };
  }, [scannedItems, expectedAssets, session]);

  // --- Helpers ---
  const updateSession = (updates: Partial<ConferenceSession>) => {
    if (session) {
      onUpdateSession({ ...session, ...updates });
    }
  };

  const validateLocationFormat = (location: string): boolean => {
    // Format: "ANDAR-SETOR", 5-10 characters, uppercase
    const pattern = /^[A-Z0-9]{2,10}(-[A-Z0-9]{2,10})?$/;
    return pattern.test(location) && location.length >= 3 && location.length <= 10;
  };

  const handleCreateNewLocation = async () => {
    const trimmedName = newLocationName.trim().toUpperCase();
    
    if (!validateLocationFormat(trimmedName)) {
      alert('Formato inválido. Use formato como "E-101" (maiúsculas, 3-10 caracteres)');
      return;
    }

    try {
      // Call backend to create location
      await apiService.createLocation(trimmedName);
      
      // Reload assets to update available locations
      if (onReloadAssets) {
        await onReloadAssets();
      }
      
      // Set as selected and close modal
      setSetupLocation(trimmedName);
      setNewLocationName('');
      setShowNewLocationModal(false);
      alert(`Local "${trimmedName}" criado com sucesso!`);
    } catch (error: any) {
      alert(`Erro ao criar local: ${error.message || 'Tente novamente'}`);
    }
  };

  const handleStart = () => {
    if (setupLocation) {
      onUpdateSession({
        targetLocation: setupLocation,
        scannedItems: [],
        startTime: new Date(),
        stage: 'SCANNING'
      });
      setSetupLocation('');
    }
  };

  const handleClearSession = () => {
    if (confirm('Tem certeza? Todo o progresso não salvo desta conferência será perdido.')) {
      onUpdateSession(null);
      setSetupLocation('');
      setSelectedTransfers(new Set());
      setNotes('');
      setLocalView('LIST');
    }
  };

  const processScan = (id: string) => {
    const cleanId = id.trim();
    if (!cleanId) return;

    if (scannedItems.some(i => i.id === cleanId)) {
      alert('Item já conferido nesta sessão.');
      setInputId('');
      return;
    }

    const existingAsset = assets.find(a => a.id === cleanId);

    if (existingAsset) {
      if (existingAsset.location === targetLocation) {
        addScan({
          id: cleanId,
          status: 'MATCH',
          description: existingAsset.description,
          timestamp: new Date()
        });
      } else {
        addScan({
          id: cleanId,
          status: 'ALIEN',
          description: existingAsset.description,
          expectedLocation: existingAsset.location,
          timestamp: new Date()
        });
      }
    } else {
      setTempIdForNew(cleanId);
      setShowNewItemModal(true);
    }
    setInputId('');
  };

  const addScan = (item: ScannedItem) => {
    if (session) {
      onUpdateSession({
        ...session,
        scannedItems: [item, ...session.scannedItems]
      });
    }
  };

  const confirmNewItem = () => {
    if (!newItemDesc.trim()) return;
    addScan({
      id: tempIdForNew,
      status: 'NEW',
      description: newItemDesc,
      timestamp: new Date()
    });
    setNewItemDesc('');
    setShowNewItemModal(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleRemoveItem = (itemId: string) => {
    if (confirm(`Remover item ${itemId} da conferência?`)) {
      if (session) {
        const updatedItems = session.scannedItems.filter(item => item.id !== itemId);
        onUpdateSession({
          ...session,
          scannedItems: updatedItems
        });
        // Remove from transfer selection if present
        const newTransfers = new Set(selectedTransfers);
        newTransfers.delete(itemId);
        setSelectedTransfers(newTransfers);
      }
    }
  };

  const handleToggleTransfer = (id: string) => {
    const newSet = new Set(selectedTransfers);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedTransfers(newSet);
  };

  const buildCommitPayload = () => {
    // 1. Create New Assets (Always create new if scanned)
    const assetsToCreate: Asset[] = report.newItems.map(item => ({
      id: item.id,
      description: item.description,
      value: 0,
      valueFormatted: 'R$ 0,00',
      termDate: new Date().toLocaleDateString('pt-BR'),
      location: targetLocation,
      responsible: 'A DEFINIR',
      sector: 'A DEFINIR',
      category: 'Outros',
      tags: ['Encontrado na Conferência'],
      history: []
    }));

    // 2. Prepare Updates for Alien Items (ONLY SELECTED)
    const updates = report.aliens
      .filter(item => selectedTransfers.has(item.id))
      .map(item => ({
        id: item.id,
        newLocation: targetLocation
      }));

    // 3. Prepare Summary
    const summary = {
      matches: report.matches.length,
      aliens: report.aliens.length,
      newItems: report.newItems.length,
      missing: report.missing.length
    };

    return { assetsToCreate, updates, summary };
  };

  const handleSaveChanges = () => {
    const { assetsToCreate, updates, summary } = buildCommitPayload();
    onCommitChanges(assetsToCreate, updates, summary);
    setSelectedTransfers(new Set());
    setLocalView('LIST');
  };

  const handleSaveChangesWithNotes = (notes?: string) => {
    const { assetsToCreate, updates, summary } = buildCommitPayload();
    onCommitChanges(assetsToCreate, updates, summary, notes);
    setSelectedTransfers(new Set());
    setLocalView('LIST');
  };

  const SnapshotList: React.FC<{ title: string; items: ScannedItem[] }> = ({ title, items }) => {
    if (!items || items.length === 0) {
      return (
        <div className="border border-slate-200 rounded-lg p-4 text-slate-500 bg-slate-50">
          <div className="flex items-center gap-2 text-sm"><ClipboardList size={16} className="text-slate-400" /> {title}</div>
          <p className="text-sm text-slate-400 mt-2">Nenhum item registrado.</p>
        </div>
      );
    }

    const ordered = [...items].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return (
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-sm font-semibold text-slate-700 flex items-center gap-2">
          <ClipboardList size={16} className="text-blue-600" /> {title}
        </div>
        <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
          {ordered.map((item, idx) => {
            const statusChip = {
              MATCH: { label: 'OK', cls: 'bg-green-50 text-green-700 border-green-100' },
              ALIEN: { label: 'Divergente', cls: 'bg-amber-50 text-amber-700 border-amber-100' },
              NEW: { label: 'Novo', cls: 'bg-blue-50 text-blue-700 border-blue-100' }
            }[item.status];

            return (
              <div key={idx} className="px-4 py-3 flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-slate-500">#{item.id}</p>
                  <p className="text-sm font-semibold text-slate-800">{item.description}</p>
                  {item.expectedLocation && (
                    <p className="text-xs text-amber-600 mt-1">Esperado em {item.expectedLocation}</p>
                  )}
                </div>
                <div className="text-right text-xs text-slate-500 flex flex-col items-end gap-1">
                  <span className={`px-2 py-0.5 rounded-full border text-[11px] ${statusChip.cls}`}>{statusChip.label}</span>
                  <span>{new Date(item.timestamp).toLocaleString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const StatCard: React.FC<{ label: string; value: number; color: string; bg: string }> = ({ label, value, color, bg }) => (
    <div className={`${bg} rounded-lg p-3 border border-slate-200`}> 
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );

  // --- RENDERERS ---

  // 1. NO ACTIVE SESSION: Show History or Setup Form
  if (!session) {
    if (localView === 'LIST') {
      return (
        <div className="p-4 md:p-8 animate-fade-in w-full">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Conferências Realizadas</h2>
              <p className="text-slate-500">Histórico de auditorias e verificações.</p>
            </div>
            <button
              onClick={() => setLocalView('SETUP')}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium shadow-sm transition-transform active:scale-95"
            >
              <Plus size={20} /> Nova Conferência
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {history.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <ClipboardList size={48} className="mx-auto mb-3 opacity-20" />
                <p>Nenhuma conferência registrada ainda.</p>
                <button 
                  onClick={() => setLocalView('SETUP')}
                  className="mt-4 text-blue-600 font-medium hover:underline"
                >
                  Começar agora
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto md:overflow-visible">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase">
                    <tr>
                      <th className="p-4 whitespace-nowrap">Data</th>
                      <th className="p-4 whitespace-nowrap">Local</th>
                      <th className="p-4 whitespace-nowrap">Status</th>
                      <th className="p-4 text-center whitespace-nowrap">Encontrados</th>
                      <th className="p-4 text-center whitespace-nowrap">Ausentes</th>
                      <th className="p-4 text-center whitespace-nowrap">Divergentes</th>
                      <th className="p-4 text-center whitespace-nowrap">Novos</th>
                      <th className="p-4 text-right whitespace-nowrap">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {history.map((record) => (
                      <tr 
                        key={record.id} 
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="p-4 text-slate-600 flex items-center gap-2 whitespace-nowrap">
                          <Calendar size={14} className="text-slate-400" />
                          {new Date(record.date).toLocaleDateString()}
                          <span className="text-xs text-slate-400 ml-1">
                            {new Date(record.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        </td>
                        <td className="p-4 font-medium text-slate-800 whitespace-nowrap">{record.location}</td>
                        <td className="p-4 whitespace-nowrap">
                          {record.status === 'DRAFT' && (
                            <span className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200">Rascunho</span>
                          )}
                          {record.status === 'PENDING_APPROVAL' && (
                            <span className="text-xs px-2 py-1 rounded bg-amber-50 text-amber-700 border border-amber-200">Pendente</span>
                          )}
                          {record.status === 'APPROVED' && (
                            <span className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 border border-green-200">Aprovado</span>
                          )}
                          {record.status === 'REJECTED' && (
                            <span title={record.rejectionReason || ''} className="text-xs px-2 py-1 rounded bg-red-50 text-red-700 border border-red-200">Rejeitado</span>
                          )}
                        </td>
                        <td className="p-4 text-center text-green-600 font-bold bg-green-50/50 whitespace-nowrap">{record.stats.matches}</td>
                        <td className="p-4 text-center text-red-600 font-bold bg-red-50/50 whitespace-nowrap">{record.stats.missing}</td>
                        <td className="p-4 text-center text-amber-600 font-bold bg-amber-50/50 whitespace-nowrap">{record.stats.aliens}</td>
                        <td className="p-4 text-center text-blue-600 font-bold bg-blue-50/50 whitespace-nowrap">{record.stats.newItems}</td>
                        <td className="p-4 text-right whitespace-nowrap">
                          <div className="flex justify-end gap-2">
                            <button
                              title="Visualizar relatório"
                              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                              onClick={() => { setSelectedRecord(record); setLocalView('VIEW'); }}
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              title="Continuar conferência"
                              className="p-2 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50"
                              onClick={() => {
                                if (session) {
                                  const proceed = confirm('Uma conferência já está em andamento. Deseja substituí-la por esta?');
                                  if (!proceed) return;
                                }
                                const converted = (record.scannedItemsSnapshot || []).map((it: any) => ({
                                  ...it,
                                  timestamp: new Date(it.timestamp)
                                }));
                                onUpdateSession({
                                  targetLocation: record.location,
                                  scannedItems: converted,
                                  startTime: new Date(record.date),
                                  stage: 'SCANNING',
                                  conferenceId: record.id
                                });
                              }}
                            >
                              <PlayCircle size={16} />
                            </button>
                            <button
                              title="Enviar para aprovação"
                              className="p-2 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50 disabled:opacity-40"
                              disabled={record.status === 'PENDING_APPROVAL' || record.status === 'APPROVED'}
                              onClick={async () => {
                                try {
                                  const submitter = currentUser?.email || currentUser?.name || 'unknown';
                                  await apiService.submitConference(record.id, {
                                    summary: record.stats,
                                    scannedItemsSnapshot: record.scannedItemsSnapshot,
                                    submittedBy: submitter,
                                    notes: record.notes
                                  });
                                  if (onReloadConferences) await onReloadConferences();
                                  alert('Conferência enviada para aprovação.');
                                } catch (err: any) {
                                  alert(err.message || 'Erro ao enviar conferência.');
                                }
                              }}
                            >
                              <Send size={16} />
                            </button>
                            {currentUser?.isAdmin && (
                              <button
                                title="Excluir conferência"
                                className="p-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                                onClick={async () => {
                                  if (!confirm('Excluir conferência? Esta ação é irreversível.')) return;
                                  try {
                                    await apiService.deleteConference(record.id);
                                    if (onReloadConferences) await onReloadConferences();
                                    alert('Conferência excluída.');
                                  } catch (err: any) {
                                    alert(err.message || 'Erro ao excluir conferência.');
                                  }
                                }}
                              >
                                <Trash size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Visualização de relatório movida para a view dedicada */}
        </div>
      );
    }

    // VIEW REPORT (standalone page)
    if (localView === 'VIEW' && selectedRecord) {
      return (
        <div className="p-4 md:p-8 max-w-5xl mx-auto animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-xs uppercase text-slate-500">Conferência</p>
              <h3 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Eye size={18} className="text-blue-600" /> {selectedRecord.location}
              </h3>
              <p className="text-xs text-slate-500">{new Date(selectedRecord.date).toLocaleString()}</p>
            </div>
            <button onClick={() => { setSelectedRecord(null); setLocalView('LIST'); }} className="text-slate-500 hover:text-slate-700 text-sm flex items-center gap-1">
              <ChevronLeft size={16} /> Voltar
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard label="Encontrados" value={selectedReportData.matches.length || selectedRecord.stats.matches} color="text-green-600" bg="bg-green-50" />
            <StatCard label="Ausentes" value={selectedMissingCount} color="text-red-600" bg="bg-red-50" />
            <StatCard label="Divergentes" value={selectedReportData.aliens.length || selectedRecord.stats.aliens} color="text-amber-600" bg="bg-amber-50" />
            <StatCard label="Novos" value={selectedReportData.newItems.length || selectedRecord.stats.newItems} color="text-blue-600" bg="bg-blue-50" />
          </div>

          {selectedRecord.notes && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4">
              <p className="text-xs uppercase text-slate-500 mb-1">Notas da Conferência</p>
              <p className="text-sm text-slate-800 whitespace-pre-wrap">{selectedRecord.notes}</p>
            </div>
          )}

          {selectedReportData.missing.length > 0 && (
            <div className="border border-red-100 rounded-lg overflow-hidden mb-6">
              <div className="px-4 py-3 bg-red-50 text-red-700 font-semibold flex items-center gap-2 text-sm">
                <X size={16} /> Itens não encontrados ({selectedReportData.missing.length})
              </div>
              <div className="divide-y divide-red-50 max-h-72 overflow-y-auto bg-white">
                {selectedReportData.missing.map(item => (
                  <div key={item.id} className="px-4 py-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs text-slate-500">#{item.id}</p>
                      <p className="text-sm font-semibold text-slate-800">{item.description}</p>
                    </div>
                    <span className="text-xs text-red-600 font-semibold">Ausente</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-sm font-semibold text-slate-700 flex items-center gap-2">
              <ClipboardList size={16} className="text-blue-600" /> Itens verificados
            </div>
            <div className="divide-y divide-slate-100 max-h-[50vh] overflow-y-auto">
              {selectedSnapshot.length === 0 ? (
                <div className="p-4 text-slate-400 text-sm">Nenhum item registrado.</div>
              ) : (
                selectedSnapshot
                  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                  .map((item, idx) => {
                    const statusChip = {
                      MATCH: { label: 'OK', cls: 'bg-green-50 text-green-700 border-green-100' },
                      ALIEN: { label: 'Divergente', cls: 'bg-amber-50 text-amber-700 border-amber-100' },
                      NEW: { label: 'Novo', cls: 'bg-blue-50 text-blue-700 border-blue-100' }
                    }[item.status];

                    return (
                      <div key={idx} className="px-4 py-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="font-mono text-xs text-slate-500">#{item.id}</p>
                          <p className="text-sm font-semibold text-slate-800">{item.description}</p>
                          {item.expectedLocation && (
                            <p className="text-xs text-amber-600 mt-1">Esperado em {item.expectedLocation}</p>
                          )}
                        </div>
                        <div className="text-right text-xs text-slate-500 flex flex-col items-end gap-1">
                          <span className={`px-2 py-0.5 rounded-full border text-[11px] ${statusChip.cls}`}>{statusChip.label}</span>
                          <span>{new Date(item.timestamp).toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <p className="text-xs text-slate-500">Você pode continuar esta conferência para adicionar mais itens.</p>
            <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
              <button
                onClick={() => { setSelectedRecord(null); setLocalView('LIST'); }}
                className="px-3 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 w-full md:w-auto"
              >
                Voltar ao Histórico
              </button>
              <button
                onClick={() => {
                  if (!selectedRecord) return;
                  if (session) {
                    const proceed = confirm('Uma conferência já está em andamento. Deseja substituí-la por esta?');
                    if (!proceed) return;
                  }
                  onUpdateSession({
                    targetLocation: selectedRecord.location,
                    scannedItems: selectedSnapshot,
                    startTime: new Date(selectedRecord.date),
                    stage: 'SCANNING',
                    conferenceId: selectedRecord.id
                  });
                  setSelectedRecord(null);
                  setLocalView('LIST');
                }}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium shadow-sm w-full md:w-auto"
              >
                Continuar Conferência
              </button>
            </div>
          </div>
        </div>
      );
    }

    // SETUP VIEW
    return (
      <div>
        <div className="p-6 max-w-md mx-auto animate-fade-in flex flex-col h-[calc(100vh-100px)] justify-center">
          <button 
            onClick={() => setLocalView('LIST')} 
            className="self-start mb-6 text-slate-500 hover:text-slate-800 flex items-center gap-1"
          >
            <ChevronLeft size={20} /> Voltar
          </button>
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
              <QrCode size={32} />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Nova Conferência</h2>
            <p className="text-slate-500">Selecione o local para iniciar a auditoria.</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Local da Conferência</label>
              <select
                className="w-full p-3 border border-slate-300 rounded-xl bg-white shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={setupLocation}
                onChange={(e) => setSetupLocation(e.target.value)}
              >
                <option value="">Selecione um local...</option>
                {availableLocations.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowNewLocationModal(true)}
                className="mt-2 text-xs text-blue-600 hover:underline"
              >
                Criar novo local
              </button>
            </div>

            <button
              onClick={handleStart}
              disabled={!setupLocation}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold shadow-lg hover:bg-blue-700 disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2"
            >
              Iniciar Conferência <ArrowRight size={20} />
            </button>
          </div>
        </div>

        {/* Modal to create a new location */}
        {showNewLocationModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 animate-bounce-in">
              <div className="flex items-center gap-3 mb-4 text-blue-600">
                <MapPin size={28} />
                <h3 className="text-lg font-bold text-slate-800">Novo Local</h3>
              </div>
              <p className="text-slate-600 mb-4 text-sm">
                Informe o identificador do novo local. Ex.: <b>E-101</b>
              </p>
              <input
                type="text"
                autoFocus
                className="w-full p-3 border border-slate-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 outline-none uppercase"
                placeholder="Ex: E-101"
                value={newLocationName}
                onChange={(e) => setNewLocationName(e.target.value.toUpperCase())}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setShowNewLocationModal(false)}
                  className="flex-1 py-2 text-slate-500 hover:bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateNewLocation}
                  className="flex-1 py-2 bg-blue-600 text-white font-medium rounded-lg shadow-sm"
                >
                  Criar & Selecionar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 2. ACTIVE SESSION: Scanning
  if (stage === 'SCANNING') {
    return (
      <div className="flex flex-col h-[calc(100vh-64px)] md:h-[calc(100vh-40px)] bg-slate-100 relative overflow-hidden">
        {/* Header Stats */}
        <div className="bg-slate-900 text-white p-4 pb-12 rounded-b-3xl shadow-md z-10 flex-shrink-0">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold flex items-center gap-2"><MapPin size={18} className="text-blue-400"/> {targetLocation}</h3>
            <button 
              onClick={() => updateSession({ stage: 'REPORT' })}
              className="text-xs bg-slate-700 px-3 py-1 rounded-full hover:bg-slate-600 flex items-center gap-1"
            >
              Conferir & Finalizar <ArrowRight size={12} />
            </button>
          </div>
          <div className="flex justify-between text-sm opacity-90">
             <div className="text-center">
               <p className="text-2xl font-bold">{expectedAssets.length}</p>
               <p className="text-xs uppercase">Previstos</p>
             </div>
             <div className="text-center">
               <p className="text-2xl font-bold text-green-400">{report.matches.length}</p>
               <p className="text-xs uppercase">Ok</p>
             </div>
             <div className="text-center">
               <p className="text-2xl font-bold text-amber-400">{report.aliens.length}</p>
               <p className="text-xs uppercase">Div.</p>
             </div>
             <div className="text-center">
               <p className="text-2xl font-bold text-blue-400">{report.newItems.length}</p>
               <p className="text-xs uppercase">Novos</p>
             </div>
          </div>
        </div>

        {/* Scrollable List with Input */}
        <div className="flex-1 overflow-y-auto p-4 -mt-8 space-y-3 pb-4 z-0 flex flex-col">
          {scannedItems.length === 0 && (
             <div className="text-center text-slate-400 mt-12">
               <QrCode size={48} className="mx-auto mb-2 opacity-50" />
               <p>Aguardando leitura...</p>
             </div>
          )}
          {scannedItems.map((item, idx) => (
            <div key={idx} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 animate-fade-in-up">
              <div className="flex justify-between items-start">
                <div className="flex items-start gap-3 flex-1">
                   {item.status === 'MATCH' && <CheckCircle className="text-green-500 mt-1" size={20} />}
                   {item.status === 'ALIEN' && <AlertTriangle className="text-amber-500 mt-1" size={20} />}
                   {item.status === 'NEW' && <HelpCircle className="text-blue-500 mt-1" size={20} />}
                   <div className="flex-1">
                     <p className="font-mono text-xs font-bold text-slate-500">#{item.id}</p>
                     <p className="font-medium text-slate-800 leading-tight">{item.description}</p>
                     {item.status === 'ALIEN' && (
                       <p className="text-xs text-amber-600 mt-1 bg-amber-50 px-2 py-0.5 rounded inline-block">
                         Pertence a: <b>{item.expectedLocation}</b>
                       </p>
                     )}
                   </div>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <span className="text-xs text-slate-400 whitespace-nowrap">{item.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  <button
                    onClick={() => handleRemoveItem(item.id)}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remover item"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Input Area - Inside Scrollable (Mobile Optimal) */}
          <div className="sticky bottom-0 left-0 right-0 bg-white p-4 border-t border-slate-200 shadow-lg z-30 mt-4 rounded-xl">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text" 
                inputMode="numeric"
                value={inputId}
                onChange={(e) => setInputId(e.target.value)}
                placeholder="Digitar ou Ler Tombo..."
                className="flex-1 p-4 text-lg border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                onKeyDown={(e) => e.key === 'Enter' && processScan(inputId)}
                autoComplete="off"
              />
              <button
                onClick={() => processScan(inputId)}
                className="px-6 bg-blue-600 text-white rounded-xl font-bold shadow-md active:scale-95 transition-transform"
              >
                OK
              </button>
            </div>
          </div>
        </div>

        {/* Modal for New Items */}
        {showNewItemModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
             <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 animate-bounce-in">
                <div className="flex items-center gap-3 mb-4 text-blue-600">
                  <HelpCircle size={28} />
                  <h3 className="text-lg font-bold text-slate-800">Item Não Identificado</h3>
                </div>
                <p className="text-slate-600 mb-4 text-sm">
                  O tombo <b>{tempIdForNew}</b> não consta na base de dados. Informe uma descrição para registrá-lo.
                </p>
                <input
                  type="text"
                  autoFocus
                  className="w-full p-3 border border-slate-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Descrição do item (Ex: Cadeira Azul)"
                  value={newItemDesc}
                  onChange={(e) => setNewItemDesc(e.target.value)}
                />
                <div className="flex gap-3">
                  <button 
                    onClick={() => { setShowNewItemModal(false); setInputId(''); }}
                    className="flex-1 py-2 text-slate-500 hover:bg-slate-100 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={confirmNewItem}
                    className="flex-1 py-2 bg-blue-600 text-white font-medium rounded-lg shadow-sm"
                  >
                    Registrar
                  </button>
                </div>
             </div>
          </div>
        )}
      </div>
    );
  }

  // 3. ACTIVE SESSION: Report
  if (stage === 'REPORT') {
     return (
       <div className="p-4 md:p-8 max-w-4xl mx-auto h-screen flex flex-col">
         <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Relatório da Conferência</h2>
              <p className="text-slate-500 flex items-center gap-2"><MapPin size={16}/> {targetLocation}</p>
            </div>
            
            <div className="flex gap-2">
              <button 
                onClick={() => updateSession({ stage: 'SCANNING' })} 
                className="text-blue-600 bg-blue-50 px-4 py-2 rounded-lg hover:bg-blue-100 flex items-center gap-1 text-sm font-semibold"
              >
                <ChevronLeft size={16} /> Voltar para Leitura
              </button>
            </div>
         </div>

         <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-green-50 p-4 rounded-xl border border-green-100">
              <span className="text-green-600 font-bold text-2xl block">{report.matches.length}</span>
              <span className="text-green-800 text-xs uppercase font-semibold">Corretos</span>
            </div>
            <div className="bg-red-50 p-4 rounded-xl border border-red-100">
              <span className="text-red-600 font-bold text-2xl block">{report.missing.length}</span>
              <span className="text-red-800 text-xs uppercase font-semibold">Não Encontrados</span>
            </div>
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
              <span className="text-amber-600 font-bold text-2xl block">{report.aliens.length}</span>
              <span className="text-amber-800 text-xs uppercase font-semibold">De Outro Local</span>
            </div>
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
              <span className="text-blue-600 font-bold text-2xl block">{report.newItems.length}</span>
              <span className="text-blue-800 text-xs uppercase font-semibold">Novos/Sobras</span>
            </div>
         </div>

         <div className="flex-1 overflow-y-auto space-y-6 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            
            {/* Alien Items Section */}
            {report.aliens.length > 0 && (
              <div className="mb-6">
                <h3 className="text-amber-700 font-bold mb-3 flex items-center gap-2">
                  <AlertTriangle size={18} /> Itens de Outros Locais (Divergentes)
                </h3>
                <p className="text-sm text-slate-500 mb-2">
                  Selecione os itens que deseja transferir para <b>{targetLocation}</b> agora. Itens não marcados permanecerão no local de origem.
                </p>
                <div className="border border-amber-100 rounded-lg overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-amber-50 text-amber-800">
                      <tr>
                        <th className="p-3 w-10 text-center">
                          {/* Bulk toggle could go here */}
                        </th>
                        <th className="p-3">Tombo</th>
                        <th className="p-3">Descrição</th>
                        <th className="p-3">Local Original</th>
                        <th className="p-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-50">
                      {report.aliens.map(item => {
                        const isSelected = selectedTransfers.has(item.id);
                        return (
                          <tr key={item.id} className={isSelected ? 'bg-amber-100/50' : ''}>
                            <td className="p-3 text-center">
                              <input 
                                type="checkbox" 
                                checked={isSelected} 
                                onChange={() => handleToggleTransfer(item.id)}
                                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                              />
                            </td>
                            <td className="p-3 font-mono">{item.id}</td>
                            <td className="p-3 truncate max-w-xs">{item.description}</td>
                            <td className="p-3">{item.expectedLocation}</td>
                            <td className="p-3 text-right text-xs font-bold">
                              {isSelected ? <span className="text-green-600">Transferir</span> : <span className="text-slate-400">Manter</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* New Items Section */}
            {report.newItems.length > 0 && (
              <div className="mb-6">
                <h3 className="text-blue-700 font-bold mb-3 flex items-center gap-2">
                  <HelpCircle size={18} /> Itens Novos (Sem Cadastro)
                </h3>
                 <div className="border border-blue-100 rounded-lg overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-blue-50 text-blue-800">
                      <tr>
                        <th className="p-3">Tombo</th>
                        <th className="p-3">Descrição</th>
                        <th className="p-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-blue-50">
                      {report.newItems.map(item => (
                        <tr key={item.id}>
                          <td className="p-3 font-mono">{item.id}</td>
                          <td className="p-3">{item.description}</td>
                          <td className="p-3 text-right text-xs font-bold text-green-600">
                            Será Cadastrado
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Missing Items */}
             {report.missing.length > 0 && (
              <div>
                <h3 className="text-red-700 font-bold mb-3 flex items-center gap-2">
                  <X size={18} /> Itens Não Encontrados
                </h3>
                 <ul className="space-y-2">
                   {report.missing.map(item => (
                     <li key={item.id} className="flex justify-between p-3 bg-red-50 rounded text-sm text-red-900">
                        <span className="font-mono font-bold mr-2">{item.id}</span>
                        <span className="truncate flex-1">{item.description}</span>
                     </li>
                   ))}
                 </ul>
              </div>
            )}

            {/* Notes Section */}
            <div>
              <h3 className="text-slate-800 font-bold mb-2 flex items-center gap-2">
                <ClipboardList size={18} /> Notas da Conferência (opcional)
              </h3>
              <textarea
                className="w-full min-h-[100px] border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Adicione observações gerais sobre esta conferência (ex.: dificuldades, locais inacessíveis, observações específicas)."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
         </div>

         <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between items-center">
             <button
               onClick={handleClearSession}
               className="px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 flex items-center gap-2"
             >
               <Trash2 size={16} /> Cancelar & Descartar
             </button>

             <div className="flex gap-3">
               <button
                 onClick={() => handleSaveChangesWithNotes(notes)}
                 className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg shadow-md hover:bg-blue-700 flex items-center gap-2"
               >
                 <Save size={18} />
                  Enviar para Aprovação
               </button>
             </div>
         </div>
         <p className="text-center text-xs text-slate-400 mt-2">
           Ao salvar, a conferência será enviada para aprovação do admin. Nenhuma alteração será aplicada até aprovação.
         </p>
       </div>
     )
  }

  return null;
};