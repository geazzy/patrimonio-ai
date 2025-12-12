import React, { useState, useEffect } from 'react';
import { Asset, MovementHistory } from '../types';
import { Search, MapPin, Tag, Edit2, X, CheckSquare, Square, Layers, History, ArrowRight, UserCheck } from 'lucide-react';

interface AssetTableProps {
  assets: Asset[];
  onUpdateAssets: (assets: Asset[]) => void;
}

export const AssetTable: React.FC<AssetTableProps> = ({ assets, onUpdateAssets }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Edit Form State
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [editCategory, setEditCategory] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editAuthBy, setEditAuthBy] = useState('');
  
  // Bulk Edit Options
  const [applyCategory, setApplyCategory] = useState(false);
  const [applyTags, setApplyTags] = useState(false);
  const [applyLocation, setApplyLocation] = useState(false);

  const itemsPerPage = 10;

  const filteredAssets = assets.filter(asset => {
    const term = searchTerm.toLowerCase();
    return (
      asset.description.toLowerCase().includes(term) ||
      asset.id.includes(term) ||
      asset.location.toLowerCase().includes(term) ||
      asset.responsible.toLowerCase().includes(term) ||
      asset.category.toLowerCase().includes(term) ||
      asset.tags.some(tag => tag.toLowerCase().includes(term))
    );
  });

  const totalPages = Math.ceil(filteredAssets.length / itemsPerPage);
  const currentAssets = filteredAssets.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Checkbox Logic
  const allFilteredSelected = filteredAssets.length > 0 && filteredAssets.every(a => selectedIds.has(a.id));
  const isIndeterminate = selectedIds.size > 0 && !allFilteredSelected;

  const handleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAssets.map(a => a.id)));
    }
  };

  const handleSelectRow = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const openSingleEdit = (asset: Asset) => {
    setEditingAsset(asset);
    setIsBulkEditing(false);
    setEditCategory(asset.category);
    setEditTags(asset.tags.join(', '));
    setEditLocation(asset.location);
    setEditAuthBy('');
  };

  const openBulkEdit = () => {
    setIsBulkEditing(true);
    setEditingAsset(null);
    setEditCategory('Outros'); // Default value
    setEditTags('');
    setEditLocation(''); 
    setEditAuthBy('');
    setApplyCategory(false);
    setApplyTags(false);
    setApplyLocation(false);
  };

  const closeEditModal = () => {
    setEditingAsset(null);
    setIsBulkEditing(false);
  };

  const saveEdit = () => {
    if (isBulkEditing) {
      const updatedAssets = assets
        .filter(a => selectedIds.has(a.id))
        .map(a => {
          const newAsset = { ...a };

          if (applyCategory) {
            newAsset.category = editCategory;
          }

          if (applyTags) {
            newAsset.tags = editTags.split(',').map(t => t.trim()).filter(Boolean);
          }

          if (applyLocation && editLocation && editLocation !== a.location) {
             const historyEntry: MovementHistory = {
                date: new Date().toLocaleDateString('pt-BR'),
                fromLocation: a.location,
                toLocation: editLocation,
                authorizedBy: editAuthBy || 'Massa'
             };
             newAsset.location = editLocation;
             newAsset.history = [...(a.history || []), historyEntry];
          }

          return newAsset;
        });

      onUpdateAssets(updatedAssets);
      setSelectedIds(new Set()); // Clear selection after bulk update
    } else if (editingAsset) {
      let updatedHistory = [...(editingAsset.history || [])];
      let location = editingAsset.location;

      // Handle Location Change and History
      if (editLocation !== editingAsset.location) {
        location = editLocation;
        const historyEntry: MovementHistory = {
          date: new Date().toLocaleDateString('pt-BR'),
          fromLocation: editingAsset.location,
          toLocation: editLocation,
          authorizedBy: editAuthBy || 'Não informado'
        };
        updatedHistory.push(historyEntry);
      }

      const updatedAsset: Asset = {
        ...editingAsset,
        category: editCategory,
        tags: editTags.split(',').map(t => t.trim()).filter(t => t.length > 0),
        location: location,
        history: updatedHistory
      };
      onUpdateAssets([updatedAsset]);
    }
    closeEditModal();
  };

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const hasLocationChanged = (editingAsset && editLocation !== editingAsset.location) || (isBulkEditing && applyLocation);

  return (
    <div className="p-6 space-y-4 animate-fade-in relative pb-24">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800">Inventário Detalhado</h2>
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por descrição, tombo, local..." 
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                <th className="p-4 border-b border-slate-100 w-12 text-center">
                  <button 
                    onClick={handleSelectAll}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {allFilteredSelected ? (
                      <CheckSquare size={20} className="text-blue-600" />
                    ) : isIndeterminate ? (
                      <div className="relative">
                         <Square size={20} />
                         <div className="absolute inset-0 flex items-center justify-center">
                           <div className="w-2.5 h-2.5 bg-blue-600 rounded-sm"></div>
                         </div>
                      </div>
                    ) : (
                      <Square size={20} />
                    )}
                  </button>
                </th>
                <th className="p-4 border-b border-slate-100">Tombo (ID)</th>
                <th className="p-4 border-b border-slate-100">Descrição</th>
                <th className="p-4 border-b border-slate-100">Categoria</th>
                <th className="p-4 border-b border-slate-100">Tags</th>
                <th className="p-4 border-b border-slate-100">Localização</th>
                <th className="p-4 border-b border-slate-100">Valor</th>
                <th className="p-4 border-b border-slate-100 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-700 divide-y divide-slate-100">
              {currentAssets.length > 0 ? (
                currentAssets.map((asset) => {
                  const isSelected = selectedIds.has(asset.id);
                  return (
                    <tr 
                      key={asset.id} 
                      className={`transition-colors ${isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50'}`}
                      onClick={() => handleSelectRow(asset.id)}
                    >
                      <td className="p-4 text-center cursor-pointer" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => handleSelectRow(asset.id)} className="text-slate-400">
                          {isSelected ? (
                            <CheckSquare size={20} className="text-blue-600" />
                          ) : (
                            <Square size={20} />
                          )}
                        </button>
                      </td>
                      <td className="p-4 font-mono font-medium text-blue-600">{asset.id}</td>
                      <td className="p-4 max-w-xs truncate" title={asset.description}>{asset.description}</td>
                      <td className="p-4">
                        <span className="inline-block px-2 py-1 bg-slate-100 rounded text-xs text-slate-600 border border-slate-200">
                          {asset.category}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {asset.tags.length > 0 ? (
                            asset.tags.slice(0, 2).map((tag, i) => (
                              <span key={i} className="inline-flex items-center text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">
                                <Tag size={8} className="mr-1" />{tag}
                              </span>
                            ))
                          ) : <span className="text-slate-400 text-xs">-</span>}
                          {asset.tags.length > 2 && <span className="text-[10px] text-slate-400">+{asset.tags.length - 2}</span>}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center text-xs text-slate-600">
                          <MapPin size={12} className="mr-1 text-slate-400" />
                          {asset.location}
                        </span>
                      </td>
                      <td className="p-4 font-medium">{asset.valueFormatted}</td>
                      <td className="p-4 text-center">
                        <button 
                          onClick={(e) => { e.stopPropagation(); openSingleEdit(asset); }}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all"
                          title="Detalhes e Edição"
                        >
                          <Edit2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    Nenhum item encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="p-4 flex justify-between items-center border-t border-slate-100">
          <span className="text-sm text-slate-500">
            Mostrando {currentAssets.length} de {filteredAssets.length} resultados
          </span>
          <div className="flex gap-2">
            <button 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
              className="px-3 py-1 text-sm border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50"
            >
              Anterior
            </button>
            <span className="text-sm text-slate-700 self-center">
              Página {currentPage} de {totalPages || 1}
            </span>
            <button 
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage(p => p + 1)}
              className="px-3 py-1 text-sm border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50"
            >
              Próximo
            </button>
          </div>
        </div>
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white pl-6 pr-4 py-3 rounded-full shadow-xl flex items-center gap-6 z-40 animate-bounce-in ring-1 ring-white/10">
          <div className="flex items-center gap-2">
            <Layers size={20} className="text-blue-400" />
            <span className="font-semibold text-sm">{selectedIds.size} itens selecionados</span>
          </div>
          <div className="h-6 w-px bg-slate-600"></div>
          <div className="flex items-center gap-2">
            <button 
              onClick={openBulkEdit}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-full transition-colors"
            >
              Editar em Massa
            </button>
            <button 
              onClick={() => setSelectedIds(new Set())}
              className="p-2 hover:bg-slate-700 rounded-full transition-colors text-slate-400 hover:text-white"
              title="Limpar seleção"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Edit Modal (Unified for Single & Bulk) */}
      {(editingAsset || isBulkEditing) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 flex-shrink-0">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                {isBulkEditing ? (
                  <>
                    <Layers size={18} className="text-blue-600" />
                    Edição em Massa ({selectedIds.size} itens)
                  </>
                ) : (
                  <>
                    <Edit2 size={18} className="text-blue-600" />
                    Editar Bem: {editingAsset?.id}
                  </>
                )}
              </h3>
              <button onClick={closeEditModal} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {!isBulkEditing && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
                  <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-600 border border-slate-200">
                    {editingAsset?.description}
                  </div>
                </div>
              )}

              {/* Location Field (Unified for Single and Bulk) */}
              <div className={`bg-slate-50 p-4 rounded-lg border border-slate-200 transition-opacity ${isBulkEditing && !applyLocation ? 'opacity-60' : ''}`}>
                   <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-slate-700 flex items-center gap-2">
                      <MapPin size={16} className="text-slate-500" />
                      Localização
                    </label>
                    {isBulkEditing && (
                        <label className="flex items-center gap-2 text-xs text-blue-600 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={applyLocation} 
                            onChange={(e) => setApplyLocation(e.target.checked)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                          />
                          Alterar em massa
                        </label>
                      )}
                   </div>
                   <input 
                      type="text" 
                      className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-slate-200"
                      value={editLocation}
                      onChange={(e) => {
                          setEditLocation(e.target.value);
                          if(isBulkEditing) setApplyLocation(true);
                      }}
                      disabled={isBulkEditing && !applyLocation}
                      placeholder={isBulkEditing ? "Nova localização..." : ""}
                    />
                    
                    {/* Authorized By Input - Appears if location changed (single or bulk applied) */}
                    {hasLocationChanged && (
                      <div className="mt-3 animate-fade-in">
                        <label className="block text-sm font-medium text-slate-700 flex items-center gap-2 mb-1">
                          <UserCheck size={16} className="text-orange-500" />
                          Autorizado por
                        </label>
                        <input 
                          type="text" 
                          placeholder="Nome do responsável pela mudança"
                          className="w-full p-2 border border-orange-200 bg-orange-50 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-sm"
                          value={editAuthBy}
                          onChange={(e) => setEditAuthBy(e.target.value)}
                          autoFocus={!isBulkEditing}
                        />
                        <p className="text-xs text-orange-600 mt-1">Obrigatório registrar o responsável pela movimentação.</p>
                      </div>
                    )}
                </div>

              {/* Category Field */}
              <div className={isBulkEditing && !applyCategory ? 'opacity-50' : ''}>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-slate-700">Categoria</label>
                  {isBulkEditing && (
                    <label className="flex items-center gap-2 text-xs text-blue-600 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={applyCategory} 
                        onChange={(e) => setApplyCategory(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                      />
                      Aplicar alteração
                    </label>
                  )}
                </div>
                <select 
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-slate-100"
                  value={editCategory}
                  onChange={(e) => { setEditCategory(e.target.value); if(isBulkEditing) setApplyCategory(true); }}
                  disabled={isBulkEditing && !applyCategory}
                >
                  <option value="Outros">Outros</option>
                  <option value="Informática">Informática</option>
                  <option value="Mobiliário">Mobiliário</option>
                  <option value="Audiovisual">Audiovisual</option>
                  <option value="Veículo">Veículo</option>
                  <option value="Periféricos">Periféricos</option>
                  <option value="Imóvel">Imóvel</option>
                  <option value="Obra de Arte">Obra de Arte</option>
                </select>
              </div>

              {/* Tags Field */}
              <div className={isBulkEditing && !applyTags ? 'opacity-50' : ''}>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-slate-700">Tags</label>
                   {isBulkEditing && (
                    <label className="flex items-center gap-2 text-xs text-blue-600 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={applyTags} 
                        onChange={(e) => setApplyTags(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                      />
                      Substituir tags
                    </label>
                  )}
                </div>
                <div className="relative">
                  <Tag className="absolute left-3 top-2.5 text-slate-400" size={16} />
                  <input 
                    type="text" 
                    className="w-full pl-9 p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-slate-100"
                    placeholder={isBulkEditing ? "Deixe vazio para limpar tags..." : "Ex: Novo, Em conserto"}
                    value={editTags}
                    onChange={(e) => { setEditTags(e.target.value); if(isBulkEditing) setApplyTags(true); }}
                    disabled={isBulkEditing && !applyTags}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {isBulkEditing ? "Se marcado, substituirá todas as tags existentes." : "Separe por vírgulas. Ex: Laboratório, Urgente"}
                </p>
              </div>

              {/* History Section (Single Edit Only) */}
              {!isBulkEditing && (
                <div className="border-t border-slate-100 pt-4">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <History size={16} className="text-blue-600" />
                    Histórico de Movimentações
                  </h4>
                  <div className="space-y-3 pl-2">
                    {editingAsset?.history && editingAsset.history.length > 0 ? (
                      editingAsset.history.slice().reverse().map((record, index) => (
                        <div key={index} className="relative pl-6 pb-2 border-l border-slate-200 last:border-0">
                          <div className="absolute -left-1.5 top-1 w-3 h-3 rounded-full bg-blue-400 border-2 border-white"></div>
                          <div className="text-xs text-slate-500 mb-0.5">{record.date}</div>
                          <div className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                            <span>{record.fromLocation}</span>
                            <ArrowRight size={12} className="text-slate-400" />
                            <span>{record.toLocation}</span>
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            Autorizado por: <span className="text-slate-700">{record.authorizedBy}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 italic">Nenhuma movimentação registrada.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50 flex-shrink-0">
              <button 
                onClick={closeEditModal}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={saveEdit}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};