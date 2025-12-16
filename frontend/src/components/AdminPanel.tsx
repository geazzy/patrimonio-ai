import React, { useState, useEffect } from 'react';
import { apiService, User } from '../services/apiService';
import { UserCheck, UserX, Shield, Clock, RefreshCw } from 'lucide-react';

export const AdminPanel: React.FC = () => {
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadPendingUsers();
  }, []);

  const loadPendingUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const { users } = await apiService.getPendingUsers();
      setPendingUsers(users);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar usuários pendentes');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId: string) => {
    try {
      setActionLoading(userId);
      setError(null);
      await apiService.approveUser(userId);
      await loadPendingUsers();
    } catch (err: any) {
      setError(err.message || 'Erro ao aprovar usuário');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevoke = async (userId: string) => {
    if (!confirm('Tem certeza que deseja revogar o acesso deste usuário?')) {
      return;
    }

    try {
      setActionLoading(userId);
      setError(null);
      await apiService.revokeUser(userId);
      await loadPendingUsers();
    } catch (err: any) {
      setError(err.message || 'Erro ao revogar usuário');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePromote = async (userId: string) => {
    if (!confirm('Tem certeza que deseja promover este usuário a administrador?')) {
      return;
    }

    try {
      setActionLoading(userId);
      setError(null);
      await apiService.approveUser(userId); // Primeiro aprovar
      await apiService.promoteUser(userId); // Depois promover
      await loadPendingUsers();
    } catch (err: any) {
      setError(err.message || 'Erro ao promover usuário');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando usuários...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white shadow-lg rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Shield className="w-6 h-6 text-blue-600" />
                Gerenciar Usuários
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Aprove ou revogue o acesso de usuários ao sistema
              </p>
            </div>
            <button
              onClick={loadPendingUsers}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Atualizar"
            >
              <RefreshCw className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {pendingUsers.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">Nenhum usuário pendente de aprovação</p>
              <p className="text-gray-500 text-sm mt-2">
                Todos os usuários foram revisados
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingUsers.map((user) => (
                <div
                  key={user.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 text-lg">{user.name}</h3>
                      <p className="text-gray-600 text-sm">{user.email}</p>
                      <div className="mt-2 flex gap-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          <Clock className="w-3 h-3 mr-1" />
                          Pendente
                        </span>
                        {user.isAdmin && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            <Shield className="w-3 h-3 mr-1" />
                            Admin
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(user.id)}
                        disabled={actionLoading === user.id}
                        className="flex items-center gap-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg transition-colors text-sm font-medium"
                        title="Aprovar usuário"
                      >
                        <UserCheck className="w-4 h-4" />
                        Aprovar
                      </button>

                      <button
                        onClick={() => handlePromote(user.id)}
                        disabled={actionLoading === user.id}
                        className="flex items-center gap-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-lg transition-colors text-sm font-medium"
                        title="Aprovar como administrador"
                      >
                        <Shield className="w-4 h-4" />
                        Admin
                      </button>

                      <button
                        onClick={() => handleRevoke(user.id)}
                        disabled={actionLoading === user.id}
                        className="flex items-center gap-1 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg transition-colors text-sm font-medium"
                        title="Rejeitar"
                      >
                        <UserX className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {actionLoading === user.id && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      Processando...
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
