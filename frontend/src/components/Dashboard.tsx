import React, { useMemo } from 'react';
import { Asset } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { Coins, Boxes, MapPin, TrendingUp, Tag } from 'lucide-react';

interface DashboardProps {
  assets: Asset[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export const Dashboard: React.FC<DashboardProps> = ({ assets }) => {
  
  const stats = useMemo(() => {
    const totalAssets = assets.length;
    const totalValue = assets.reduce((acc, curr) => acc + curr.value, 0);
    
    // Group by Location
    const locationMap = new Map<string, number>();
    assets.forEach(a => {
      const count = locationMap.get(a.location) || 0;
      locationMap.set(a.location, count + 1);
    });
    
    const assetsByLocation = Array.from(locationMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8); // Top 8 locations

    // Group by Category
    const categoryMap = new Map<string, number>();
    assets.forEach(a => {
      const count = categoryMap.get(a.category) || 0;
      categoryMap.set(a.category, count + 1);
    });

    const assetsByCategory = Array.from(categoryMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Group by Responsible (Top 5 for Value)
    const respMap = new Map<string, number>();
    assets.forEach(a => {
      const val = respMap.get(a.responsible) || 0;
      respMap.set(a.responsible, val + a.value);
    });

    const valueByResponsible = Array.from(respMap.entries())
      .map(([name, value]) => ({ name: name.split('-')[0].trim(), value })) // Simplify name
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    return { totalAssets, totalValue, assetsByLocation, assetsByCategory, valueByResponsible };
  }, [assets]);

  const formatCurrency = (val: number) => 
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <h2 className="text-2xl font-bold text-slate-800">Visão Geral do Patrimônio</h2>
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="p-3 bg-blue-100 rounded-lg text-blue-600">
            <Boxes size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500">Total de Bens</p>
            <p className="text-2xl font-bold text-slate-800">{stats.totalAssets}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="p-3 bg-green-100 rounded-lg text-green-600">
            <Coins size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500">Valor Total</p>
            <p className="text-2xl font-bold text-slate-800">{formatCurrency(stats.totalValue)}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="p-3 bg-purple-100 rounded-lg text-purple-600">
            <MapPin size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500">Locais Distintos</p>
            <p className="text-2xl font-bold text-slate-800">{stats.assetsByLocation.length}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="p-3 bg-orange-100 rounded-lg text-orange-600">
            <Tag size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500">Categorias</p>
            <p className="text-2xl font-bold text-slate-800">
              {stats.assetsByCategory.length}
            </p>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart: Category Distribution */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-96">
          <h3 className="text-lg font-semibold text-slate-700 mb-4">Distribuição por Categoria</h3>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={stats.assetsByCategory}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
              >
                {stats.assetsByCategory.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend verticalAlign="bottom" height={36} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Bar Chart: Items per Location */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-96">
          <h3 className="text-lg font-semibold text-slate-700 mb-4">Itens por Localização (Top 8)</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.assetsByLocation} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={100} style={{ fontSize: '12px' }} />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                cursor={{ fill: '#f1f5f9' }}
              />
              <Bar dataKey="value" fill="#4f46e5" radius={[0, 4, 4, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
