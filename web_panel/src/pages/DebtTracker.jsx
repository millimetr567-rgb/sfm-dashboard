import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../constants';
import { useTranslation } from '../context/LanguageContext';
import { Search, History, Download, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function DebtTracker() {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [history, setHistory] = useState({ orders: [], payments: [] });
  const [loadingHistory, setLoadingHistory] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    const res = await axios.get(`${API_URL}/clients`);
    setClients(res.data);
  };

  const loadHistory = async (client) => {
    if (selectedClient?.id === client.id) {
      setSelectedClient(null);
      return;
    }
    setLoadingHistory(true);
    setSelectedClient(client);
    try {
      const res = await axios.get(`${API_URL}/clients/${client.id}/history`);
      setHistory(res.data);
    } catch (e) {
      alert("Tarixni olib bo'lmadi");
    }
    setLoadingHistory(false);
  };

  const exportSverka = () => {
    if (!selectedClient) return;
    const rows = [
      ...history.orders.map(o => ({ 
        date: new Date(o.createdAt), 
        desc: `Zakas #${o.orderNumber || o.id.substring(0,6)}`, 
        debit: o.amount, credit: 0 
      })),
      ...history.payments.filter(p => p.status === 'CONFIRMED').map(p => ({ 
        date: new Date(p.date || p.createdAt), 
        desc: `To'lov: ${p.paymentMethod}`, 
        debit: 0, credit: p.amount 
      }))
    ].sort((a, b) => a.date - b.date);

    let balance = 0;
    const data = rows.map(r => {
      balance += (r.debit - r.credit);
      return {
        'Sana': r.date.toLocaleString(),
        'Izoh': r.desc,
        'Olingan Tovar ($)': r.debit,
        'To\'langan Pul ($)': r.credit,
        'Qoldiq ($)': balance
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sverka");
    XLSX.writeFile(wb, `Sverka_${selectedClient.name}.xlsx`);
  };

  const filtered = clients.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    (c.customId && c.customId.includes(search))
  );

  const totalDebt = filtered.reduce((sum, c) => sum + (c.currentDebt > 0 ? c.currentDebt : 0), 0);
  const totalPrepayment = filtered.reduce((sum, c) => sum + (c.currentDebt < 0 ? Math.abs(c.currentDebt) : 0), 0);

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
        <h2>📉 {t('debt')}</h2>
        <div style={{ position: 'relative', width: '300px' }}>
          <Search size={18} style={{ position: 'absolute', top: '12px', left: '15px', color: 'var(--text-muted)' }} />
          <input type="text" className="form-control" style={{ paddingLeft: '45px', borderRadius: '20px' }} placeholder={t('search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        <div className="card glass-panel" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '5px' }}>{t('pending_debt')}</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--danger)' }}>${totalDebt.toLocaleString()}</div>
        </div>
        <div className="card glass-panel" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '5px' }}>Haqdorlik (Kredit)</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--success)' }}>${totalPrepayment.toLocaleString()}</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filtered.map(c => (
          <div key={c.id} className="card" style={{ padding: '0', overflow: 'hidden' }}>
            <div 
              style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 25px', alignItems: 'center', cursor: 'pointer' }}
              onClick={() => loadHistory(c)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                 {selectedClient?.id === c.id ? <ChevronUp/> : <ChevronDown/>}
                 <div>
                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{c.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Limit: ${c.creditLimit} | {c.phone}</div>
                 </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: c.currentDebt > 0 ? 'var(--danger)' : 'var(--success)' }}>
                  ${c.currentDebt?.toLocaleString()}
                </div>
              </div>
            </div>

            {selectedClient?.id === c.id && (
              <div className="animate-fade-in" style={{ padding: '20px', background: 'rgba(0,0,0,0.1)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h4>📊 {t('debt')} (AKT)</h4>
                  <button onClick={exportSverka} className="btn btn-secondary" style={{ padding: '8px 15px' }}><Download size={16}/> {t('excel_export')}</button>
                </div>
                
                {loadingHistory ? <div style={{ textAlign: 'center', padding: '20px' }}>{t('loading')}</div> : (
                  <div className="responsive-grid">
                     <div className="card">
                        <h5 style={{ color: 'var(--warning)', marginBottom: '15px' }}>{t('orders')}</h5>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                          {history.orders.map(o => (
                            <div key={o.id} style={{ padding: '12px', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', background: 'rgba(255,255,255,0.02)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '5px' }}>
                                <span style={{ fontWeight: 'bold' }}>#{o.orderNumber || o.id.substring(0,6)} <small style={{ fontWeight: 'normal', opacity: 0.6 }}>({new Date(o.createdAt).toLocaleDateString()})</small></span>
                                <span style={{ color: 'var(--danger)', fontWeight: 'bold' }}>+${o.amount.toLocaleString()}</span>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {o.items?.map((it, idx) => (
                                  <div key={idx} style={{ fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', opacity: 0.8 }}>
                                    <span>• {it.product?.name} ({it.quantity} ta)</span>
                                    <span>${it.price}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                     </div>
                     <div className="card">
                        <h5 style={{ color: 'var(--success)', marginBottom: '10px' }}>{t('payments')}</h5>
                        {history.payments.filter(p => p.status === 'CONFIRMED').map(p => (
                          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                            <span>{p.paymentMethod} <small style={{ color: 'var(--text-muted)' }}>({new Date(p.date || p.createdAt).toLocaleDateString()})</small></span>
                            <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>-${p.amount}</span>
                          </div>
                        ))}
                     </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
