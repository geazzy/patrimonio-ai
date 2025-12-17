import React, { useEffect, useMemo, useState } from 'react';
import apiService, { ConferenceRecord, User } from '../services/apiService';
import { AlertTriangle, Calendar, CheckCircle, HelpCircle, MapPin, RefreshCw, X } from 'lucide-react';

interface DecisionItem {
  id: string;
  type: 'ALIEN' | 'NEW';
  decision: 'APPROVE' | 'REJECT';
  newLocation?: string;
  reason?: string;
}

export const AdminApprovalPanel: React.FC<{ currentUser: User | undefined; onApprovalComplete?: () => Promise<void> }> = ({ currentUser, onApprovalComplete }) => {
  const [conferences, setConferences] = useState<ConferenceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ConferenceRecord | null>(null);
  const [decisions, setDecisions] = useState<Record<string, DecisionItem>>({}); // keyed by item id
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadConferences = async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await apiService.getConferences();
      setConferences(list.filter((c) => c.status === 'PENDING_APPROVAL'));
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar conferências pendentes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadConferences(); }, []);

  const aliasedItems = useMemo(() => {
    if (!selected) return [] as Array<{ id: string; description: string; expectedLocation?: string }>;
    return (selected.scannedItemsSnapshot || []).filter((i: any) => i.status === 'ALIEN');
  }, [selected]);

  const newItems = useMemo(() => {
    if (!selected) return [] as Array<{ id: string; description: string }>;
    return (selected.scannedItemsSnapshot || []).filter((i: any) => i.status === 'NEW');
  }, [selected]);

  const setItemDecision = (id: string, item: DecisionItem) => {
    setDecisions((prev) => ({ ...prev, [id]: item }));
  };

  const approveAll = () => {
    const map: Record<string, DecisionItem> = {};
    aliasedItems.forEach((a: any) => { map[a.id] = { id: a.id, type: 'ALIEN', decision: 'APPROVE', newLocation: selected?.location }; });
    newItems.forEach((n: any) => { map[n.id] = { id: n.id, type: 'NEW', decision: 'APPROVE' }; });
    setDecisions(map);
  };

  const rejectAll = () => {
    const map: Record<string, DecisionItem> = {};
    aliasedItems.forEach((a: any) => { map[a.id] = { id: a.id, type: 'ALIEN', decision: 'REJECT', reason: 'Rejeitado em massa' }; });
    newItems.forEach((n: any) => { map[n.id] = { id: n.id, type: 'NEW', decision: 'REJECT', reason: 'Rejeitado em massa' }; });
    setDecisions(map);
  };

  const submitDecisions = async () => {
    if (!selected) return;
    try {
      setSubmitting(true);
      const decisionArray: DecisionItem[] = Object.values(decisions) as DecisionItem[];
      const payload = {
        decisions: decisionArray,
        decidedBy: currentUser?.name || currentUser?.email || 'admin'
      };
      await apiService.approveConference(selected.id, payload);
      setSelected(null);
      setDecisions({});
      await loadConferences();
      // Reload assets if callback provided
      if (onApprovalComplete) {
        await onApprovalComplete();
      }
      alert('Conferência salva. Alterações aplicadas aos bens.');
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar conferência');
    } finally {
      setSubmitting(false);
    }
  };

  const submitRejection = async () => {
    if (!selected) return;
    if (!rejectReason.trim()) { alert('Informe um motivo para rejeição.'); return; }
    try {
      setSubmitting(true);
      await apiService.rejectConference(selected.id, { reason: rejectReason.trim(), decidedBy: currentUser?.name || currentUser?.email || 'admin' });
      setSelected(null);
      setDecisions({});
      setRejectReason('');
      await loadConferences();
      alert('Conferência rejeitada.');
    } catch (err: any) {
      alert(err.message || 'Erro ao rejeitar conferência');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando conferências...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-lg rounded-lg mt-6">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-600" /> Aprovação de Conferências
          </h2>
          <p className="text-sm text-gray-600 mt-1">Revisar divergências e sobras antes de aplicar mudanças.</p>
        </div>
        <button onClick={loadConferences} className="p-2 hover:bg-gray-100 rounded-lg" title="Atualizar">
          <RefreshCw className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      <div className="p-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {conferences.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">Nenhuma conferência pendente</p>
            <p className="text-gray-500 text-sm mt-2">Tudo revisado!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {conferences.map((c) => (
              <div key={c.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => {setSelected(c); setDecisions({});}}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="font-semibold text-gray-900">{c.location}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(c.date).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex gap-3 text-xs">
                    <span className="px-2 py-1 rounded bg-green-50 text-green-700 border border-green-100">OK: {c.stats.matches}</span>
                    <span className="px-2 py-1 rounded bg-red-50 text-red-700 border border-red-100">Aus.: {c.stats.missing}</span>
                    <span className="px-2 py-1 rounded bg-amber-50 text-amber-700 border border-amber-100">Div.: {c.stats.aliens}</span>
                    <span className="px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-100">Novos: {c.stats.newItems}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
              <div>
                <p className="text-xs uppercase text-slate-500">Conferência</p>
                <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <MapPin size={16} className="text-blue-600" /> {selected.location}
                </h3>
                <p className="text-xs text-slate-500">{new Date(selected.date).toLocaleString()}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-6">
              {/* ALIENS */}
              <div>
                <h4 className="text-amber-700 font-bold mb-3 flex items-center gap-2"><AlertTriangle size={18} /> Itens Divergentes</h4>
                {aliasedItems.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhum item divergente.</p>
                ) : (
                  <div className="border border-amber-100 rounded-lg overflow-hidden">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-amber-50 text-amber-800">
                        <tr>
                          <th className="p-3">Tombo</th>
                          <th className="p-3">Descrição</th>
                          <th className="p-3">Local Original</th>
                          <th className="p-3">Decisão</th>
                          <th className="p-3">Motivo (se rejeitar)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-50">
                        {aliasedItems.map((item: any) => {
                          const current = decisions[item.id];
                          return (
                            <tr key={item.id}>
                              <td className="p-3 font-mono">{item.id}</td>
                              <td className="p-3 truncate max-w-xs">{item.description}</td>
                              <td className="p-3">{item.expectedLocation}</td>
                              <td className="p-3">
                                <select
                                  className="border border-slate-300 rounded p-2 text-xs"
                                  value={current?.decision || ''}
                                  onChange={(e) => setItemDecision(item.id, { id: item.id, type: 'ALIEN', decision: e.target.value as any, newLocation: selected.location })}
                                >
                                  <option value="">Selecionar...</option>
                                  <option value="APPROVE">Aprovar Transferência</option>
                                  <option value="REJECT">Rejeitar</option>
                                </select>
                              </td>
                              <td className="p-3">
                                <input
                                  type="text"
                                  className="w-full border border-slate-300 rounded p-2 text-xs"
                                  placeholder="Motivo da rejeição"
                                  value={current?.reason || ''}
                                  onChange={(e) => setItemDecision(item.id, { ...(current || { id: item.id, type: 'ALIEN', decision: 'REJECT', newLocation: selected.location }), reason: e.target.value })}
                                  disabled={(current?.decision || '') !== 'REJECT'}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* NEW ITEMS */}
              <div>
                <h4 className="text-blue-700 font-bold mb-3 flex items-center gap-2"><HelpCircle size={18} /> Itens Novos/Sobras</h4>
                {newItems.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhum item novo.</p>
                ) : (
                  <div className="border border-blue-100 rounded-lg overflow-hidden">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-blue-50 text-blue-800">
                        <tr>
                          <th className="p-3">Tombo</th>
                          <th className="p-3">Descrição</th>
                          <th className="p-3">Decisão</th>
                          <th className="p-3">Motivo (se rejeitar)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-blue-50">
                        {newItems.map((item: any) => {
                          const current = decisions[item.id];
                          return (
                            <tr key={item.id}>
                              <td className="p-3 font-mono">{item.id}</td>
                              <td className="p-3 truncate max-w-xs">{item.description}</td>
                              <td className="p-3">
                                <select
                                  className="border border-slate-300 rounded p-2 text-xs"
                                  value={current?.decision || ''}
                                  onChange={(e) => setItemDecision(item.id, { id: item.id, type: 'NEW', decision: e.target.value as any })}
                                >
                                  <option value="">Selecionar...</option>
                                  <option value="APPROVE">Aprovar Cadastro</option>
                                  <option value="REJECT">Rejeitar</option>
                                </select>
                              </td>
                              <td className="p-3">
                                <input
                                  type="text"
                                  className="w-full border border-slate-300 rounded p-2 text-xs"
                                  placeholder="Motivo da rejeição"
                                  value={current?.reason || ''}
                                  onChange={(e) => setItemDecision(item.id, { ...(current || { id: item.id, type: 'NEW', decision: 'REJECT' }), reason: e.target.value })}
                                  disabled={(current?.decision || '') !== 'REJECT'}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <button onClick={approveAll} className="px-3 py-2 text-xs bg-green-600 text-white rounded">Aprovar Tudo</button>
                  <button onClick={rejectAll} className="px-3 py-2 text-xs bg-amber-600 text-white rounded">Rejeitar Tudo</button>
                </div>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    className="border border-slate-300 rounded p-2 text-xs w-64"
                    placeholder="Motivo para rejeitar conferência"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                  <button onClick={submitRejection} className="px-3 py-2 text-xs bg-red-600 text-white rounded">Rejeitar</button>
                  <button onClick={submitDecisions} disabled={submitting} className="px-3 py-2 text-xs bg-blue-600 text-white rounded font-semibold">Salvar</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminApprovalPanel;
