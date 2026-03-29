import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../constants';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { Search, Plus, Trash2, ChevronDown, ChevronUp, Download, UserCircle, Package } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function CRM() {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const { user } = useAuth();
  const { t } = useTranslation();
  const isAdmin = user?.role === 'ADMIN';

  const [showAdd, setShowAdd] = useState(false);
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newLimit, setNewLimit] = useState(10000);

  const [selectedClient, setSelectedClient] = useState(null);
  const [history, setHistory] = useState({ orders: [], payments: [] });
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expandedOrderInHistory, setExpandedOrderInHistory] = useState(null);

  useEffect(() => { fetchClients(); }, []);

  const fetchClients = () => {
    axios.get(`${API_URL}/clients`).then(r => setClients(r.data));
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
    } catch (e) { console.error(e); }
    setLoadingHistory(false);
  };

  const addClient = async (e) => {
    e.preventDefault();
    if (!newName) return alert("Nomi kiritilishi shart!");
    try {
      await axios.post(`${API_URL}/clients`, {
        customId: newId || null, 
        name: newName, 
        phone: newPhone || '', 
        address: newAddress || '',
        creditLimit: parseFloat(newLimit) || 0
      });
      alert('Mijoz saqlandi');
      fetchClients();
      setShowAdd(false);
      setNewId(''); setNewName(''); setNewPhone(''); setNewAddress(''); setNewLimit(10000);
    } catch (e) { 
      const msg = e.response?.data?.error || "Xato yuz berdi";
      alert(msg); 
    }
  };

  const deleteClient = (e, id) => {
    e.stopPropagation();
    if (!window.confirm("O'chiramanmi?")) return;
    axios.delete(`${API_URL}/clients/${id}`).then(() => fetchClients());
  };

  const exportSverka = () => {
    if (!selectedClient) return;
    const rows = [
      ...history.orders.map(o => ({ date: new Date(o.createdAt), desc: `Buyurtma #${o.orderNumber || o.id.substring(0,6)}`, debit: o.amount, credit: 0 })),
      ...history.payments.filter(p => p.status === 'CONFIRMED').map(p => ({ date: new Date(p.date || p.createdAt), desc: `To'lov: ${p.paymentMethod}`, debit: 0, credit: p.amount }))
    ].sort((a, b) => a.date - b.date);

    let runningBalance = 0;
    const excelData = rows.map(r => {
      runningBalance += (r.debit - r.credit);
      return { 'Sana': r.date.toLocaleString(), 'Operatsiya': r.desc, 'Debit ($)': r.debit, 'Kredit ($)': r.credit, 'Qoldiq ($)': runningBalance };
    });

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sverka");
    XLSX.writeFile(wb, `Sverka_${selectedClient.name}.xlsx`);
  };

  const filtered = clients.filter(c => 
    String(c.name || '').toLowerCase().includes(search.toLowerCase()) || 
    (c.customId && c.customId.includes(search))
  );
  const sortedClientsByDebt = [...filtered].sort((a,b) => (b.currentDebt || 0) - (a.currentDebt || 0));

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
        <h2>👥 {t('crm')} <small style={{ color: 'var(--text-muted)' }}>({clients.length})</small></h2>
        <div style={{ display: 'flex', gap: '10px' }}>
           <div style={{ position: 'relative', width: '220px' }}>
             <Search size={16} style={{ position: 'absolute', top: '10px', left: '12px', color: 'var(--text-muted)' }} />
             <input type="text" className="form-control" style={{ paddingLeft: '35px', borderRadius: '20px', height: '36px', fontSize: '0.85rem' }} placeholder={t('search')} value={search} onChange={(e) => setSearch(e.target.value)} />
           </div>
           <button onClick={() => setShowAdd(!showAdd)} className="btn btn-primary" style={{ padding: '8px 15px', fontSize: '0.85rem' }}><Plus size={16}/> {t('add_new')}</button>
        </div>
      </div>

      {showAdd && (
        <div className="card glass-panel" style={{ marginBottom: '25px', padding: '20px', borderLeft: '5px solid var(--secondary)' }}>
          <h3>{t('add_new')}</h3>
          <form onSubmit={addClient} className="responsive-grid" style={{ marginTop: '15px' }}>
            <div className="form-group"><label>Mijoz ID # (ixtiyoriy)</label><input type="text" className="form-control" value={newId} onChange={e => setNewId(e.target.value)} /></div>
            <div className="form-group"><label>F.I.O / Nomi *</label><input type="text" className="form-control" value={newName} onChange={e => setNewName(e.target.value)} required /></div>
            <div className="form-group"><label>Telefon</label><input type="text" className="form-control" value={newPhone} onChange={e => setNewPhone(e.target.value)} /></div>
            <div className="form-group"><label>Manzil</label><input type="text" className="form-control" value={newAddress} onChange={e => setNewAddress(e.target.value)} /></div>
            <div className="form-group"><label>Qarz Limiti ($)</label><input type="number" className="form-control" value={newLimit} onChange={e => setNewLimit(e.target.value)} /></div>
            <div style={{ gridColumn: 'span 2', display: 'flex', gap: '10px' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>{t('action_save')}</button>
              <button type="button" onClick={() => setShowAdd(false)} className="btn btn-secondary">{t('action_cancel')}</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filtered.map(c => (
          <div key={c.id} className="card" style={{ padding: '0', overflow: 'hidden' }}>
            <div 
              style={{ padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              onClick={() => loadHistory(c)}
            >
              <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                <div style={{ padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px' }}><UserCircle size={24} color="var(--primary)"/></div>
                <div>
                  <div style={{ fontWeight: 'bold' }}>{c.name} {c.customId && <small style={{ color: 'var(--text-muted)' }}>#{c.customId}</small>}</div>
                  <div style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>{c.phone || '-'} | {c.address || '-'}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right', display: 'flex', gap: '20px', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Mijoz Balansi / Limit</div>
                  <div style={{ fontWeight: 'bold', fontSize: '1.25rem', color: c.currentDebt > c.creditLimit ? 'var(--danger)' : c.currentDebt > 0 ? 'var(--warning)' : 'var(--success)' }}>
                    ${c.currentDebt?.toLocaleString()} <small style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>/ ${c.creditLimit?.toLocaleString()}</small>
                  </div>
                </div>
                {isAdmin && <button onClick={(e) => deleteClient(e, c.id)} style={{ color: 'var(--danger)', background: 'transparent' }}><Trash2 size={18}/></button>}
              </div>
            </div>

            {selectedClient?.id === c.id && (
              <div className="animate-fade-in" style={{ padding: '20px', background: 'rgba(0,0,0,0.1)', borderTop: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h4>📊 AKT Sverka / Hisob-kitoblar</h4>
                  <button onClick={exportSverka} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}><Download size={16}/> Excel yuklash</button>
                </div>
                {loadingHistory ? <div style={{ textAlign: 'center', padding: '20px' }}>{t('loading')}</div> : (
                  <div className="responsive-grid">
                    <div>
                      <h5 style={{ color: 'var(--warning)', marginBottom: '12px', textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '1px' }}>Buyurtmalar</h5>
                      {history.orders.map(o => (
                        <div key={o.id} style={{ marginBottom: '8px' }}>
                          <div 
                            onClick={() => setExpandedOrderInHistory(expandedOrderInHistory === o.id ? null : o.id)}
                            style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', cursor: 'pointer' }}
                          >
                             <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {expandedOrderInHistory === o.id ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                                <span>#{o.orderNumber || o.id.substring(0,8)}</span>
                             </div>
                             <span style={{ color: 'var(--danger)', fontWeight: 'bold' }}>+${o.amount}</span>
                          </div>
                          {expandedOrderInHistory === o.id && (
                            <div className="animate-fade-in" style={{ padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '0 0 8px 8px', fontSize: '0.8rem' }}>
                               {o.items?.map(it => (
                                 <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>{it.product?.name} x {it.quantity}</span>
                                    <span>${it.price * it.quantity}</span>
                                 </div>
                               ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <div>
                      <h5 style={{ color: 'var(--success)', marginBottom: '12px', textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '1px' }}>To'lovlar</h5>
                      {history.payments.filter(p => p.status === 'CONFIRMED').map(p => (
                        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Package size={14} color="var(--success)"/><span>{p.paymentMethod}</span></div>
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
