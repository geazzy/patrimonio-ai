import React, { useEffect, useState } from 'react';
import { GoogleOAuthProvider, GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { apiService, User } from '../services/apiService';

interface AuthGateProps {
  children: React.ReactNode;
}

type AuthState = 'loading' | 'unauthenticated' | 'pending-approval' | 'authenticated';

export const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { user: currentUser } = await apiService.getMe();
      setUser(currentUser);
      
      if (!currentUser.isApproved) {
        setAuthState('pending-approval');
      } else {
        setAuthState('authenticated');
      }
    } catch (err) {
      setAuthState('unauthenticated');
    }
  };

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      setError('Credencial do Google não recebida');
      return;
    }

    try {
      setError(null);
      const { user: loggedUser } = await apiService.loginWithGoogle(credentialResponse.credential);
      setUser(loggedUser);

      if (!loggedUser.isApproved) {
        setAuthState('pending-approval');
      } else {
        setAuthState('authenticated');
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao fazer login';
      setError(errorMessage);

      // Se o erro indica usuário pendente
      if (errorMessage.includes('Aguardando aprovação')) {
        setAuthState('pending-approval');
      }
    }
  };

  const handleGoogleError = () => {
    setError('Erro ao fazer login com Google');
  };

  if (!googleClientId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
          <div className="text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Configuração Necessária</h2>
            <p className="text-gray-600">
              VITE_GOOGLE_CLIENT_ID não configurado. Por favor, configure a variável de ambiente.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (authState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (authState === 'unauthenticated') {
    return (
      <GoogleOAuthProvider clientId={googleClientId}>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
          <div className="max-w-md w-full bg-white shadow-2xl rounded-lg p-8">
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">🏛️</div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Patrimônio AI</h1>
              <p className="text-gray-600">Sistema de Gestão de Ativos</p>
            </div>

            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <p className="text-center text-gray-700 mb-4">
                Faça login com sua conta Google para continuar
              </p>

              <div className="flex justify-center">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  useOneTap
                  theme="filled_blue"
                  size="large"
                  text="signin_with"
                  shape="rectangular"
                />
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-200">
              <p className="text-xs text-gray-500 text-center">
                Ao fazer login, você concorda com os termos de uso do sistema.
                Apenas usuários autorizados têm acesso.
              </p>
            </div>
          </div>
        </div>
      </GoogleOAuthProvider>
    );
  }

  if (authState === 'pending-approval') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-50 to-yellow-100">
        <div className="max-w-md w-full bg-white shadow-2xl rounded-lg p-8">
          <div className="text-center">
            <div className="text-6xl mb-4">⏳</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Aguardando Aprovação</h2>
            <p className="text-gray-600 mb-6">
              Seu acesso foi solicitado com sucesso!
            </p>
            
            {user && (
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-600 mb-1">Usuário:</p>
                <p className="font-semibold text-gray-900">{user.name}</p>
                <p className="text-sm text-gray-600">{user.email}</p>
              </div>
            )}

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-yellow-800">
                ℹ️ Entre em contato com o administrador do sistema para aprovar seu acesso.
              </p>
            </div>

            <button
              onClick={() => {
                setAuthState('unauthenticated');
                setUser(null);
              }}
              className="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors"
            >
              Fazer login com outra conta
            </button>
          </div>
        </div>
      </div>
    );
  }

  // authState === 'authenticated' - renderiza o app
  return <>{children}</>;
};

export default AuthGate;
