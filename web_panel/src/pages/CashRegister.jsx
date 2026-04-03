import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../constants';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { Banknote, List, Filter, DollarSign, CreditCard, Building2, Coins, ArrowRightLeft, ShoppingCart, CheckCircle, XCircle, Plus } from 'lucide-react';

export default function CashRegister() {
  const [payments, setPayments] = useState([]);
  const [clients, setClients] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [amount, setAmount] = useState('');
  const [uzsAmount, setUzsAmount] = useState('');
  const [kurs, setKurs] = useState(localStorage.getItem('kurs') || '12800');
  const [method, setMethod] = useState('USD (Naqd)');
  const [exchangeRateSaving, setExchangeRateSaving] = useState(false);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { user } = useAuth();
  const { t } = useTranslation();
  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => { 
    fetchData(); 
  }, []);

  const saveKurs = () => {
    localStorage.setItem('kurs', kurs);
    setExchangeRateSaving(true);
    setTimeout(() => setExchangeRateSaving(false), 2000);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pRes, cRes, oRes] = await Promise.all([
        axios.get(`${API_URL}/payments`),
        axios.get(`${API_URL}/clients`),
        axios.get(`${API_URL}/orders`)
      ]);
      setPayments(pRes.data || []);
      setClients(cRes.data || []);
      // Show orders waiting for payment or approval
      setPendingOrders((oRes.data || []).filter(o => o.status === 'PENDING_PAYMENT' || o.status === 'WAITING_APPROVAL'));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const startPaymentForOrder = (order) => {
    setSelectedClient(order.clientId);
    setSelectedOrder(order);
    setAmount(order.amount);
    setUzsAmount((order.amount * kurs).toFixed(0));
    setMethod('USD (Naqd)');
    setNotes(`Buyurtma #${order.orderNumber || order.id.substring(0,8)} uchun to'lov`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDebtWrite = async (order) => {
    if (!window.confirm("Bu buyurtmani mijozning qarzi sifatida yozib qo'yamizmi?")) return;
    setLoading(true);
    try {
      // Approve order directly (this increments currentDebt in backend)
      await axios.post(`${API_URL}/orders/${order.id}/approve`);
      alert("Buyurtma qarzga yozildi!");
      fetchData();
    } catch (e) { alert("Xato: " + (e.response?.data?.error || "Xato")); }
    setLoading(false);
  };

  const submitPayment = async (e) => {
    e.preventDefault();
    if (!selectedClient) return alert("Mijozni tanlang!");
    
    setLoading(true);
    try {
      await axios.post(`${API_URL}/payments`, {
        clientId: selectedClient,
        orderId: selectedOrder?.id || null,
        amount: Number(amount),
        paymentMethod: method,
        notes: notes,
        exchangeRate: parseFloat(kurs),
        originalAmount: parseFloat(uzsAmount) || parseFloat(amount)
      });
      alert("To'lov saqlandi. Admin tasdiqlashi kutilyapti.");
      fetchData();
      resetForm();
    } catch (e) { alert("Xato: " + (e.response?.data?.error || "Xato")); }
    setLoading(false);
  };

  const resetForm = () => {
    setSelectedClient(''); setSelectedOrder(null); setAmount(''); setUzsAmount(''); setNotes('');
  };

  const confirmedPayments = payments.filter(p => p.status === 'CONFIRMED');
  const stats = {
    usd: confirmedPayments.filter(p => p.paymentMethod?.includes('USD')).reduce((a, b) => a + (b.amount || 0), 0),
    uzs: confirmedPayments.filter(p => p.paymentMethod?.includes('UZS')).reduce((a, b) => a + (b.amount || 0), 0),
    card: confirmedPayments.filter(p => p.paymentMethod?.includes('CARD') || p.paymentMethod?.includes('KARTA') || p.paymentMethod?.includes('Terminal')).reduce((a, b) => a + (b.amount || 0), 0),
    bank: confirmedPayments.filter(p => p.paymentMethod?.includes('BANK') || p.paymentMethod?.includes('TRANSFER')).reduce((a, b) => a + (b.amount || 0), 0),
  };

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
        <h2>💸 {t('cash')}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-surface)', padding: '6px 15px', borderRadius: '15px', border: '1px solid var(--primary)' }}>
           <ArrowRightLeft size={16} color="var(--primary)"/>
           <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Kurs:</span>
           <input type="number" className="form-control" style={{ width: '85px', border: 'none', background: 'transparent', fontWeight: 'bold', color: 'var(--primary)', padding: '0' }} value={kurs} onChange={e => setKurs(e.target.value)} />
           <span style={{ fontSize: '0.8rem', marginRight: '5px' }}>UZS</span>
           <button onClick={saveKurs} className="btn-icon" style={{ width: '28px', height: '28px', background: exchangeRateSaving ? 'var(--success)' : 'var(--primary)', color: 'white' }}>
              {exchangeRateSaving ? <CheckCircle size={14}/> : <Plus size={14}/>}
           </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '30px' }}>
        <div className="card glass-panel" style={{ borderBottom: '3px solid var(--primary)' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>USD NAQD</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>${stats.usd.toLocaleString()}</div>
        </div>
        <div className="card glass-panel" style={{ borderBottom: '3px solid var(--success)' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>UZS NAQD ($)</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>${stats.uzs.toLocaleString()}</div>
        </div>
        <div className="card glass-panel" style={{ borderBottom: '3px solid var(--warning)' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>KARTA / PAYME / CLICK</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>${stats.card.toLocaleString()}</div>
        </div>
        <div className="card glass-panel" style={{ borderBottom: '3px solid #6366f1' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>BANK O'TKAZMALARI</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>${stats.bank.toLocaleString()}</div>
        </div>
      </div>

      <div className="responsive-grid">
        {/* PAYMENT FORM */}
        <div className="card" style={{ height: 'fit-content' }}>
          <h3 style={{ marginBottom: '20px' }}>{selectedOrder ? `To'lov: #${selectedOrder.orderNumber || selectedOrder.id.substring(0,8)}` : "To'lov qabul qilish"}</h3>
          <form onSubmit={submitPayment}>
            <div className="form-group">
              <label className="form-label">{t('client')}</label>
              <select className="form-control" value={selectedClient} onChange={e => setSelectedClient(e.target.value)} required disabled={!!selectedOrder}>
                <option value="">-- Tanlang --</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name} (${c.currentDebt})</option>)}
              </select>
            </div>
            
            <div className="form-group">
              <label className="form-label">To'lov Usuli</label>
              <select className="form-control" value={method} onChange={e => setMethod(e.target.value)}>
                <option value="USD (Naqd)">USD (Naqd)</option>
                <option value="UZS (Naqd)">UZS (Naqd)</option>
                <option value="KARTA (Payme/Click)">KARTA (Payme/Click)</option>
                <option value="BANK (Bank o'tkazmalari)">BANK (Bank o'tkazmalari)</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '15px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Summa ($)</label>
                <input type="number" step="0.01" className="form-control" value={amount} onChange={e => { setAmount(e.target.value); setUzsAmount((e.target.value * kurs).toFixed(0)); }} placeholder="Dollarda" />
                {amount > 0 && <div style={{ fontSize: '0.75rem', marginTop: '5px', color: 'var(--primary)', fontWeight: '500' }}>≈ {(amount * kurs).toLocaleString()} so'm</div>}
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Variant: UZS</label>
                <input type="number" className="form-control" value={uzsAmount} onChange={e => { setUzsAmount(e.target.value); setAmount((e.target.value / kurs).toFixed(2)); }} placeholder="So'mda" />
                {uzsAmount > 0 && <div style={{ fontSize: '0.75rem', marginTop: '5px', color: 'var(--success)', fontWeight: '500' }}>≈ {(uzsAmount / kurs).toFixed(2)} dollar</div>}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Izoh</label>
              <textarea className="form-control" value={notes} onChange={e => setNotes(e.target.value)}></textarea>
            </div>
            
            <div style={{ display: 'flex', gap: '10px' }}>
               <button type="submit" disabled={loading} className="btn btn-primary" style={{ flex: 2, padding: '15px' }}>Saqlash</button>
               {selectedOrder && <button type="button" onClick={resetForm} className="btn btn-secondary" style={{ flex: 1 }}>Bekor qilish</button>}
            </div>
          </form>
        </div>

        {/* PENDING ORDERS LIST */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
           <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><ShoppingCart color="var(--primary)"/> Kutilayotgan Buyurtmalar</h3>
           <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
             {pendingOrders.map(o => (
               <div key={o.id} className="card glass-panel" style={{ padding: '15px', borderLeft: '4px solid var(--warning)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <div>
                        <div style={{ fontWeight: 'bold' }}>#{o.orderNumber || o.id.substring(0,8)} | {o.client?.name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(o.createdAt).toLocaleString()}</div>
                        <div style={{ marginTop: '5px', fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--primary)' }}>${o.amount.toLocaleString()}</div>
                     </div>
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <button onClick={() => startPaymentForOrder(o)} className="btn btn-success" style={{ padding: '8px 12px', fontSize: '0.85rem' }}>💵 To'lov qilish</button>
                        <button onClick={() => handleDebtWrite(o)} className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: '0.85rem' }}>💸 Qarzga yozish</button>
                     </div>
                  </div>
               </div>
             ))}
             {pendingOrders.length === 0 && <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Hozircha yangi buyurtmalar yo'q.</div>}
           </div>
           
           <h3 style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}><List /> To'lovlar tarixi</h3>
           <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
             {payments.map(p => (
                <div key={p.id} className="card" style={{ padding: '12px', borderLeft: `4px solid ${p.status === 'CONFIRMED' ? 'var(--success)' : 'var(--warning)'}` }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div style={{ flex: 1 }}>
                         <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{p.client?.name}</div>
                         <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{p.paymentMethod} | {new Date(p.date || p.createdAt).toLocaleDateString()}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                         <div style={{ fontWeight: 'bold' }}>${p.amount}</div>
                         <div style={{ fontSize: '0.7rem' }}>{p.status}</div>
                      </div>
                   </div>
                </div>
             ))}
           </div>
        </div>
      </div>
    </div>
  );
}
