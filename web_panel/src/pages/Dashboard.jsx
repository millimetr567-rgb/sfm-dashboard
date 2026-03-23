import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../constants';
import { useTranslation } from '../context/LanguageContext';
import { TrendingUp, Users, ShoppingBag, DollarSign, Package, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

export default function Dashboard() {
  const [stats, setStats] = useState({ 
    totalSales: 0, 
    activeClients: 0, 
    orderCount: 0, 
    lowStock: 0, 
    recentSales: [] 
  });
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();

  useEffect(() => {
    setLoading(true);
    axios.get(`${API_URL}/admin/stats`)
      .then(r => {
        setStats(r.data);
        setLoading(false);
      })
      .catch(e => {
        console.error(e);
        setLoading(false);
      });
  }, []);

  const cards = [
    { title: t('total_sales'), value: `$${stats.totalSales?.toLocaleString()}`, icon: <DollarSign color="var(--success)"/>, bg: 'rgba(34, 197, 94, 0.1)' },
    { title: t('active_clients'), value: stats.activeClients, icon: <Users color="var(--primary)"/>, bg: 'rgba(99, 102, 241, 0.1)' },
    { title: t('order_count'), value: stats.orderCount, icon: <ShoppingBag color="var(--secondary)"/>, bg: 'rgba(236, 72, 153, 0.1)' },
    { title: "Kam qolgan tovar", value: stats.lowStock, icon: <AlertTriangle color="var(--danger)"/>, bg: 'rgba(239, 68, 68, 0.1)' },
  ];

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>{t('loading')}</div>;

  return (
    <div className="animate-fade-in">
      <h2 style={{ marginBottom: '25px' }}>⚡️ {t('dashboard')}</h2>
      
      <div className="responsive-grid">
        {cards.map((card, i) => (
          <div key={i} className="card glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '25px' }}>
            <div style={{ padding: '15px', borderRadius: '16px', background: card.bg }}>
              {card.icon}
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '5px' }}>
                {card.title}
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>
                {card.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="responsive-grid" style={{ marginTop: '30px' }}>
        <div className="card glass-panel" style={{ padding: '25px', height: '400px' }}>
          <h3 style={{ marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <TrendingUp size={20} color="var(--primary)"/> {t('sales_30d')}
          </h3>
          <ResponsiveContainer width="100%" height="80%">
            <BarChart data={stats.recentSales}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)"/>
              <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false}/>
              <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`}/>
              <Tooltip 
                contentStyle={{ background: 'var(--bg-surface)', border: 'var(--glass-border)', borderRadius: '12px' }}
                itemStyle={{ color: 'var(--primary)', fontWeight: 'bold' }}
              />
              <Bar dataKey="sales" fill="var(--primary)" radius={[6, 6, 0, 0]} barSize={35} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        <div className="card glass-panel" style={{ padding: '25px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ padding: '30px', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '50%', marginBottom: '20px' }}>
            <TrendingUp size={60} color="var(--primary)"/>
          </div>
          <h3>Tizim Yangiliklari</h3>
          <p style={{ color: 'var(--text-muted)', marginTop: '10px' }}>
            Barcha qismlar optimallashtirildi. <br/> 
            Kassa va mijozlar balansi endi real vaqtda yangilanadi.
          </p>
        </div>
      </div>
    </div>
  );
}
