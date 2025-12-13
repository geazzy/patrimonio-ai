import React, { useState, useEffect } from 'react';
import { Asset, MovementHistory } from '../types';
import { 
  ArrowLeft, 
  MapPin, 
  Tag, 
  Calendar, 
  DollarSign, 
  User, 
  Building2, 
  Layers, 
  History, 
  ArrowRight,
  Edit2,
  ShieldCheck,
  X,
  UserCheck
} from 'lucide-react';
import apiService from '../services/apiService';

interface AssetDetailProps {
  asset: Asset;
  onBack: () => void;
  onEdit: (asset: Asset) => void;
  onUpdateAsset: (asset: Asset) => void;
}

export const AssetDetail: React.FC<AssetDetailProps> = ({ 
  asset, 
  onBack, 
  onEdit,
  onUpdateAsset 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editCategory, setEditCategory] = useState(asset.category);
  const [editTags, setEditTags] = useState(asset.tags.join(', '));
  const [editLocation, setEditLocation] = useState(asset.location);
  const [editAuthBy, setEditAuthBy] = useState('');
  const [currentAsset, setCurrentAsset] = useState(asset);

  // Update local state when asset prop changes
  useEffect(() => {
    setCurrentAsset(asset);
    setEditCategory(asset.category);
    setEditTags(asset.tags.join(', '));
    setEditLocation(asset.location);
  }, [asset]);

  const handleDelete = async () => {
    if (window.confirm(`Tem certeza que deseja excluir o item ${displayAsset.id}?`)) {
      try {
        await apiService.deleteAsset(displayAsset.id);
        alert('Item excluído com sucesso!');
        onBack();
      } catch (error) {
        console.error('Error deleting asset:', error);
        alert('Erro ao excluir item. Tente novamente.');
      }
    }
  };

  const handleSaveEdit = async () => {
    try {
      let updatedHistory = [...(currentAsset.history || [])];
      let location = currentAsset.location;

      // Handle Location Change and History
      if (editLocation !== currentAsset.location) {
        location = editLocation;
        const historyEntry: MovementHistory = {
          date: new Date().toISOString(),
          fromLocation: currentAsset.location,
          toLocation: editLocation,
          authorizedBy: editAuthBy || 'Não informado'
        };
        updatedHistory.push(historyEntry);
      }

      const updatedAsset: Asset = {
        ...currentAsset,
        category: editCategory,
        tags: editTags.split(',').map(t => t.trim()).filter(t => t.length > 0),
        location: location,
        history: updatedHistory
      };

      await onUpdateAsset(updatedAsset);
      setCurrentAsset(updatedAsset);
      setIsEditing(false);
      setEditAuthBy('');
    } catch (error) {
      console.error('Error saving asset:', error);
      alert('Erro ao salvar alterações. Tente novamente.');
    }
  };

  const hasLocationChanged = editLocation !== currentAsset.location;
  
  // Use currentAsset for display
  const displayAsset = currentAsset;

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft size={20} />
          <span className="font-medium">Voltar</span>
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Edit2 size={18} />
            <span>Editar</span>
          </button>
        </div>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <ShieldCheck size={32} className="text-blue-200" />
                <div>
                  <div className="text-sm text-blue-200 font-medium mb-1">Tombo</div>
                  <div className="text-3xl font-bold font-mono">{displayAsset.id}</div>
                </div>
              </div>
              {/* Header shows only Tombo; description moved to content section */}
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-6 space-y-6">
          {/* Basic Information Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Descrição */}
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 md:col-span-2">
              <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                <Tag size={16} />
                <span>Descrição</span>
              </div>
              <div className="text-lg font-semibold text-slate-800">{displayAsset.description}</div>
            </div>
            {/* Valor */}
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                <DollarSign size={16} />
                <span>Valor</span>
              </div>
              <div className="text-2xl font-bold text-slate-800">{displayAsset.valueFormatted}</div>
            </div>

            {/* Termo (número + data) */}
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                <Calendar size={16} />
                <span>Termo</span>
              </div>
              <div className="text-lg font-semibold text-slate-800">{displayAsset.termDate}</div>
            </div>

            {/* Localização */}
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                <MapPin size={16} />
                <span>Localização Atual</span>
              </div>
              <div className="text-lg font-semibold text-slate-800">{displayAsset.location}</div>
            </div>

            {/* Responsável */}
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                <User size={16} />
                <span>Responsável</span>
              </div>
              <div className="text-lg font-semibold text-slate-800">{displayAsset.responsible}</div>
            </div>

            {/* Setor removido conforme solicitação */}

            {/* Categoria */}
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                <Layers size={16} />
                <span>Categoria</span>
              </div>
              <div className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-semibold border border-blue-200">
                {displayAsset.category}
              </div>
            </div>
          </div>

          {/* Tags Section */}
          {displayAsset.tags && displayAsset.tags.length > 0 && (
            <div className="border-t border-slate-200 pt-6">
              <div className="flex items-center gap-2 text-slate-700 font-semibold mb-3">
                <Tag size={18} className="text-blue-600" />
                <span>Tags</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {displayAsset.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm border border-blue-200"
                  >
                    <Tag size={12} />
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* History Section */}
          <div className="border-t border-slate-200 pt-6">
            <div className="flex items-center gap-2 text-slate-700 font-semibold mb-4">
              <History size={18} className="text-blue-600" />
              <span>Histórico de Movimentações</span>
            </div>
            {displayAsset.history && displayAsset.history.length > 0 ? (
              <div className="space-y-4">
                {displayAsset.history.slice().reverse().map((record, index) => (
                  <div
                    key={index}
                    className="relative pl-8 pb-4 border-l-2 border-blue-200 last:border-0"
                  >
                    <div className="absolute -left-2 top-1 w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-sm"></div>
                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-semibold text-slate-600">
                          {new Date(record.date).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-slate-700 mb-2">
                        <span className="font-medium">{record.fromLocation}</span>
                        <ArrowRight size={16} className="text-blue-500" />
                        <span className="font-semibold text-blue-600">{record.toLocation}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-2">
                        Autorizado por: <span className="text-slate-700 font-medium">{record.authorizedBy}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-lg border border-slate-200">
                <History size={32} className="mx-auto mb-2 text-slate-300" />
                <p className="text-sm">Nenhuma movimentação registrada</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 flex justify-end gap-3">
          <button
            onClick={handleDelete}
            className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-200"
          >
            Excluir Item
          </button>
        </div>
      </div>

      {/* Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 flex-shrink-0">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <Edit2 size={18} className="text-blue-600" />
                Editar Bem: {displayAsset.id}
              </h3>
              <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
                <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-600 border border-slate-200">
                  {displayAsset.description}
                </div>
              </div>

              {/* Location Field */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <label className="block text-sm font-medium text-slate-700 flex items-center gap-2 mb-2">
                  <MapPin size={16} className="text-slate-500" />
                  Localização
                </label>
                <input 
                  type="text" 
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  placeholder="Nova localização..."
                />
                
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
                      autoFocus
                    />
                    <p className="text-xs text-orange-600 mt-1">Obrigatório registrar o responsável pela movimentação.</p>
                  </div>
                )}
              </div>

              {/* Category Field */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
                <select 
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
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
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tags</label>
                <div className="relative">
                  <Tag className="absolute left-3 top-2.5 text-slate-400" size={16} />
                  <input 
                    type="text" 
                    className="w-full pl-9 p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="Ex: Novo, Em conserto"
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">Separe por vírgulas. Ex: Laboratório, Urgente</p>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50 flex-shrink-0">
              <button 
                onClick={() => {
                  setIsEditing(false);
                  setEditCategory(displayAsset.category);
                  setEditTags(displayAsset.tags.join(', '));
                  setEditLocation(displayAsset.location);
                  setEditAuthBy('');
                }}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveEdit}
                disabled={hasLocationChanged && !editAuthBy.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
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

