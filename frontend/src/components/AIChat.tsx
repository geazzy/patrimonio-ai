import React, { useState } from 'react';
import { Asset } from '../types';
import apiService from '../services/apiService';
import { Send, Bot, User, Loader2 } from 'lucide-react';

interface AIChatProps {
  assets: Asset[];
}

interface Message {
  role: 'user' | 'ai';
  content: string;
}

export const AIChat: React.FC<AIChatProps> = ({ assets }) => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', content: 'Olá! Sou seu assistente de patrimônio. Pergunte-me sobre totais, locais ou detalhes específicos dos bens listados.' }
  ]);

  const handleSend = async () => {
    if (!query.trim()) return;

    const userMsg = query;
    setQuery('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      // Send query to backend with all asset IDs
      const assetIds = assets.map(a => a.id);
      const result = await apiService.queryAI(userMsg, assetIds);
      
      setMessages(prev => [...prev, { role: 'ai', content: result.response }]);
    } catch (error) {
      console.error('Error querying AI:', error);
      setMessages(prev => [...prev, { 
        role: 'ai', 
        content: 'Desculpe, ocorreu um erro ao processar sua consulta. Verifique se o backend está rodando.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 h-[calc(100vh-100px)] flex flex-col animate-fade-in">
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
        <div className="bg-slate-50 p-4 border-b border-slate-100 flex items-center gap-2">
          <Bot className="text-blue-600" />
          <h2 className="font-semibold text-slate-700">Assistente Inteligente (Gemini 2.5)</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex gap-3 max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-slate-200' : 'bg-blue-100'}`}>
                  {msg.role === 'user' ? <User size={16} /> : <Bot size={16} className="text-blue-600" />}
                </div>
                <div className={`p-3 rounded-lg text-sm ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-800'}`}>
                  {msg.content}
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
             <div className="flex justify-start">
             <div className="flex gap-3 max-w-[80%] flex-row">
               <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-blue-100">
                 <Bot size={16} className="text-blue-600" />
               </div>
               <div className="p-3 rounded-lg bg-slate-100 text-slate-500 flex items-center">
                 <Loader2 className="animate-spin mr-2" size={16} /> Analisando dados...
               </div>
             </div>
           </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 bg-white">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ex: Qual o valor total dos equipamentos no setor DACOM?"
              className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !query.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
