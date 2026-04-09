import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../constants';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { Search, Trash2, CheckCircle, XCircle, Filter, Download, Edit2, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';

const STATUS_UZ = {
  'PENDING': 'Kutilmoqda',
  'PENDING_PAYMENT': 'To\'lov kutilmoqda',
  'WAITING_APPROVAL': 'Tasdiq kutilmoqda',
  'APPROVED': 'Tasdiqlangan',
  'CONFIRMED': 'Tasdiqlangan',
  'CANCELLED': 'Bekor qilingan',
  'PAID': 'To\'langan'
};

export default function OrderHistory() {
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Edit State
  const [editOrder, setEditOrder] = useState(null);
  
  const { user } = useAuth();
  const { t } = useTranslation();
  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => { fetchOrders(); }, []);

  const fetchOrders = () => {
    setLoading(true);
    axios.get(`${API_URL}/orders`).then(r => { setOrders(r.data); setLoading(false); });
  };

  const approveOrder = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm("Buyurtmani tasdiqlaysizmi?")) return;
    try {
      await axios.post(`${API_URL}/orders/${id}/approve`);
      fetchOrders();
    } catch (e) { alert(e.response?.data?.error || "Xato"); }
  };

  const deleteOrder = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm("O'chiramanmi?")) return;
    try {
      await axios.delete(`${API_URL}/orders/${id}`);
      fetchOrders();
    } catch (e) { alert("Xato"); }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/orders/${editOrder.id}`, editOrder);
      setEditOrder(null);
      fetchOrders();
    } catch (e) { alert("Xato yuz berdi"); }
  };

  const downloadOrderExcel = (e, order) => {
    e.stopPropagation();
    const data = order.items.map(item => ({
      'Mahsulot': item.product?.name || 'Nom' ,
      'Kod': item.product?.code || '—',
      'Miqdor': item.quantity,
      'Narx ($)': item.price,
      'Jami ($)': item.price * item.quantity
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Buyurtma Tafsiloti");
    XLSX.writeFile(wb, `Order_${order.orderNumber || order.id.substring(0,6)}.xlsx`);
  };

  const filtered = orders.filter(o => {
    const s = search.toLowerCase();
    const matchesSearch = String(o.client?.name || '').toLowerCase().includes(s) || 
                         String(o.orderNumber || '').toLowerCase().includes(s) ||
                         o.id.includes(s);
    const matchesFilter = filter === 'ALL' || o.status === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
        <h2>📜 {t('history')}</h2>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
           <div style={{ position: 'relative' }}>
             <Filter size={18} style={{ position: 'absolute', top: '12px', left: '15px', color: 'var(--text-muted)' }} />
             <select className="form-control" style={{ paddingLeft: '45px', width: '150px' }} value={filter} onChange={(e) => setFilter(e.target.value)}>
               <option value="ALL">Hammasi</option>
               {Object.keys(STATUS_UZ).map(k => <option key={k} value={k}>{STATUS_UZ[k]}</option>)}
             </select>
           </div>
           <div style={{ position: 'relative' }}>
             <Search size={18} style={{ position: 'absolute', top: '12px', left: '15px', color: 'var(--text-muted)' }} />
             <input type="text" className="form-control" style={{ paddingLeft: '45px', width: '220px' }} placeholder={t('search')} value={search} onChange={(e) => setSearch(e.target.value)} />
           </div>
        </div>
      </div>

      {editOrder && (
        <div className="card" style={{ marginBottom: '25px', border: '2px solid var(--primary)', padding: '20px' }}>
          <h3>Tahrirlash: #{editOrder.orderNumber || editOrder.id.substring(0,6)}</h3>
          <form onSubmit={handleUpdate} className="responsive-grid" style={{ marginTop: '15px' }}>
            <div className="form-group"><label>Summa ($)</label><input type="number" step="0.01" className="form-control" value={editOrder.amount} onChange={e => setEditOrder({...editOrder, amount: e.target.value})} /></div>
            <div className="form-group"><label>Holati</label>
              <select className="form-control" value={editOrder.status} onChange={e => setEditOrder({...editOrder, status: e.target.value})}>
                 {Object.keys(STATUS_UZ).map(k => <option key={k} value={k}>{STATUS_UZ[k]}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Haydovchi tel</label><input type="text" className="form-control" value={editOrder.driverPhone || ''} onChange={e => setEditOrder({...editOrder, driverPhone: e.target.value})} /></div>
            <div style={{ gridColumn: 'span 2', display: 'flex', gap: '10px' }}>
              <button type="submit" className="btn btn-primary">{t('action_save')}</button>
              <button type="button" onClick={() => setEditOrder(null)} className="btn btn-secondary">{t('action_cancel')}</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filtered.map(o => (
          <div key={o.id} className="card" style={{ padding: '0', overflow: 'hidden' }}>
            <div className="order-card-header" style={{ padding: '15px 20px', cursor: 'pointer' }} onClick={() => setExpandedOrderId(expandedOrderId === o.id ? null : o.id)}>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flex: 1, minWidth: 0 }}>
                  <div style={{ flexShrink: 0 }}>{expandedOrderId === o.id ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 'bold', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      #{o.orderNumber || o.id.substring(0,8)} | {o.client?.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(o.createdAt).toLocaleString()}</div>
                  </div>
                </div>
                
                <div className="order-card-actions" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '1rem' }}>${o.amount?.toLocaleString()}</div>
                    <div className={`badge ${o.status === 'CONFIRMED' || o.status === 'APPROVED' ? 'badge-success' : o.status === 'CANCELLED' ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: '0.65rem' }}>
                      {STATUS_UZ[o.status] || o.status}
                    </div>
                  </div>
                  
                  {isAdmin && (
                    <div style={{ display: 'flex', gap: '6px', borderLeft: '1px solid rgba(255,255,255,0.05)', paddingLeft: '10px' }}>
                      {(o.status === 'PENDING_PAYMENT' || o.status === 'WAITING_APPROVAL') && (
                         <button onClick={(e) => approveOrder(e, o.id)} className="btn-icon" style={{ color: 'var(--success)', padding: '8px' }} title="Tasdiqlash">
                           <CheckCircle size={20}/>
                         </button>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); setEditOrder(o); }} className="btn-icon" style={{ color: 'var(--primary)', padding: '8px' }}><Edit2 size={18}/></button>
                      <button onClick={(e) => deleteOrder(e, o.id)} className="btn-icon" style={{ color: 'var(--danger)', padding: '8px' }}><Trash2 size={18}/></button>
                    </div>
                  )}
                </div>
              </div>

            {expandedOrderId === o.id && (
              <div className="animate-fade-in" style={{ padding: '20px', background: 'rgba(0,0,0,0.1)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                   <h4>📦 Tovar Tafsilotlari</h4>
                   <button onClick={(e) => downloadOrderExcel(e, o)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
                      <Download size={16}/> Faylni yuklash
                   </button>
                </div>
                <div className="table-container" style={{ background: 'transparent', padding: '0' }}>
                   <table className="custom-table">
                     <thead>
                       <tr><th>Nomi</th><th>Soni</th><th>Narx</th><th>Jami</th></tr>
                     </thead>
                     <tbody>
                       {o.items?.map(it => (
                         <tr key={it.id}>
                           <td>{it.product?.name} <small style={{ color: 'var(--text-muted)' }}>#{it.product?.code}</small></td>
                           <td>{it.quantity}</td>
                           <td>${it.price}</td>
                           <td><b>${it.price * it.quantity}</b></td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                </div>
                {o.driverPhone && <div style={{ marginTop: '10px', fontSize: '0.9rem' }}><b>Haydovchi:</b> {o.driverPhone}</div>}
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && <div className="card" style={{ textAlign: 'center' }}>{t('loading')}</div>}
      </div>
      <style>{`
        .order-card-header {
           display: flex;
           justify-content: space-between;
           align-items: center;
        }
        @media (max-width: 600px) {
           .order-card-header {
              flex-direction: column;
              align-items: flex-start;
              gap: 12px;
           }
           .order-card-actions {
              width: 100%;
              justify-content: space-between;
              border-top: 1px solid rgba(255,255,255,0.05);
              padding-top: 10px;
           }
        }
      `}</style>
    </div>
  );
}
