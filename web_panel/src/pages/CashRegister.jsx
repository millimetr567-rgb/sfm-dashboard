import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../constants';
import { useAuth } from '../context/AuthContext';
import { 
  Banknote, CreditCard, Smartphone, DollarSign, Building2, 
  RefreshCcw, Info, Wallet, LogOut, CheckCircle, X, ChevronDown, Trash2, Save, ShoppingCart
} from 'lucide-react';

export default function CashRegister() {
  const { user } = useAuth();
  
  // Data lists
  const [clients, setClients] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  
  // Form State
  const [clientId, setClientId] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [orderId, setOrderId] = useState('');
  
  const [cash, setCash] = useState(''); // Sum
  const [terminal, setTerminal] = useState(''); 
  const [click, setClick] = useState('');
  const [bank, setBank] = useState('');
  const [usd, setUsd] = useState('');
  const [kurs, setKurs] = useState('12200');
  const [convert, setConvert] = useState(true);
  
  const [qaytarish, setQaytarish] = useState('');
  const [bankChegirma, setBankChegirma] = useState('');
  const [notes, setNotes] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { 
    fetchData(); 
  }, []);

  const fetchData = async () => {
    try {
      const [cRes, oRes, sRes] = await Promise.all([
        axios.get(`${API_URL}/clients`),
        axios.get(`${API_URL}/orders`),
        axios.get(`${API_URL}/settings/public`)
      ]);
      setClients(cRes.data);
      setPendingOrders(oRes.data.filter(o => o.status === 'PENDING_PAYMENT' || o.status === 'WAITING_APPROVAL'));
      if (sRes.data?.exchangeRate) setKurs(sRes.data.exchangeRate.toString());
    } catch (e) {
      console.error("Data fetch error", e);
    }
  };

  const handleClientChange = (id) => {
    setClientId(id);
    const client = clients.find(c => c.id === id);
    setSelectedClient(client);
    // Find first pending order for this client if exists
    const order = pendingOrders.find(o => o.clientId === id);
    if (order) setOrderId(order.id);
    else setOrderId('');
  };

  // Helper to parse strings safely
  const p = (v) => {
    if (!v) return 0;
    return parseFloat(v.toString().replaceAll(",", ".")) || 0;
  };

  // Calculation Logic
  const calculateTotal = () => {
    // Current formula: (cash + terminal + click + bank + (convert ? usd * kurs : 0) - qaytarish - chegirma)
    const c = p(cash);
    const t = p(terminal);
    const ck = p(click);
    const b = p(bank);
    const u = p(usd);
    const k = p(kurs) || 1;
    const q = p(qaytarish);
    const ch = p(bankChegirma);

    let finalUzs = c + t + ck + b - q - ch;
    if (convert) {
       finalUzs += u * k;
    }
    
    // Round to 2 decimal places for USD to avoid .00000001 errors
    const finalUsd = Math.round((finalUzs / k) * 100) / 100;
    
    return {
        uzs: Math.round(finalUzs),
        usd: finalUsd
    };
  };

  const sums = calculateTotal();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validations
    if (!clientId) return setError("Mijozni tanlang!");
    if (p(usd) > 0 && p(kurs) === 0) return setError("Valyuta kursini kiriting!");
    if (p(qaytarish) > (p(cash) + p(terminal) + p(click) + p(bank) + (convert ? p(usd) * p(kurs) : 0))) {
        return setError("Qaytarish summasi jami to'lovdan katta!");
    }
    if (p(cash) < 0 || p(terminal) < 0 || p(usd) < 0 || p(bankChegirma) < 0) {
        return setError("Manfiy son kiritish mumkin emas!");
    }

    setLoading(true);
    try {
      const data = {
        clientId,
        orderId: orderId || null,
        amount: sums.usd, // Save standard USD equivalent
        notes,
        paymentMethod: 'Kalkulyator (Mix)',
        // Breakdown
        cashAmount: p(cash),
        terminalAmount: p(terminal),
        clickAmount: p(click),
        bankAmount: p(bank),
        usdAmount: p(usd),
        changeAmount: p(qaytarish),
        discountAmount: p(bankChegirma),
        isConverted: convert,
        exchangeRate: p(kurs)
      };

      await axios.post(`${API_URL}/payments`, data);
      alert("To'lov yuborildi! Admin tasdiqlashi kutilyapti.");
      resetForm();
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || "Xato yuz berdi");
    }
    setLoading(false);
  };

  const resetForm = () => {
    setCash(''); setTerminal(''); setClick(''); setBank(''); setUsd(''); 
    setQaytarish(''); setBankChegirma(''); setNotes(''); setClientId(''); 
    setSelectedClient(null); setOrderId('');
  };

  const saveExchangeRate = async () => {
    try {
        await axios.post(`${API_URL}/settings`, { exchangeRate: p(kurs) });
        alert("Valyuta kursi saqlandi!");
    } catch (e) { alert("Xato: " + e.message); }
  };

  // Currency & Conversion
  const inputStyle = { width: '100%', padding: '12px 15px', background: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-main)', fontSize: '0.95rem', outline: 'none' };
  const labelStyle = { display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' };
  const inputGroupStyle = { marginBottom: '15px' };

  return (
    <div className="pos-root animate-fade-in">
      <div className="pos-main-layout">
        <div className="pos-content-side scroll-styled" style={{ padding: '20px' }}>
          {/* Client Selection & Kurs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px', marginBottom: '20px' }} className="grid-mobile-1">
            <div style={{ background: 'var(--bg-surface)', padding: '20px', borderRadius: '15px', border: 'var(--glass-border)' }}>
              <h4 style={{ margin: '0 0 15px 0', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Wallet size={20} color="var(--primary)" /> Mijozni tanlang
              </h4>
              <select style={inputStyle} value={clientId} onChange={(e) => handleClientChange(e.target.value)}>
                  <option value="">-- Tanlash --</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              
              {selectedClient && (
                  <div style={{ marginTop: '15px', padding: '15px', background: 'var(--input-bg)', borderRadius: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Balans (Qarz)</div>
                              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: (selectedClient.currentDebt || 0) > 0 ? 'var(--danger)' : 'var(--success)' }}>
                                  ${selectedClient.currentDebt?.toLocaleString()} 
                              </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Oxirgi to'lov</div>
                              <div style={{ fontSize: '0.85rem' }}>{selectedClient.lastPaymentDate ? new Date(selectedClient.lastPaymentDate).toLocaleDateString() : '—'}</div>
                          </div>
                      </div>
                  </div>
              )}
            </div>

            <div style={{ background: 'var(--bg-surface)', padding: '20px', borderRadius: '15px', border: 'var(--glass-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <label style={labelStyle}>VALYUTA KURSI (1$)</label>
                    <input type="checkbox" checked={convert} onChange={e => setConvert(e.target.checked)} />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <input type="number" style={{ ...inputStyle, padding: '10px' }} value={kurs} onChange={e => setKurs(e.target.value)} />
                    <button type="button" onClick={saveExchangeRate} className="btn btn-primary" style={{ padding: '10px' }}><Save size={18}/></button>
                </div>
            </div>
          </div>

          {/* Pending Orders scroll */}
          {selectedClient && pendingOrders.some(o => o.clientId === selectedClient.id) && (
            <div style={{ background: 'var(--bg-surface)', padding: '15px', borderRadius: '15px', border: 'var(--glass-border)', marginBottom: '20px' }}>
                <h5 style={{ marginBottom: '10px', fontSize: '0.85rem', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '8px' }}><ShoppingCart size={16}/> TO'LOV KUTILAYOTGAN BUYURTMALAR</h5>
                <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '5px' }}>
                    {pendingOrders.filter(o => o.clientId === selectedClient.id).map(o => (
                        <div key={o.id} onClick={() => setOrderId(o.id)} style={{ minWidth: '160px', padding: '12px', background: orderId === o.id ? 'rgba(99,102,241,0.1)' : 'var(--input-bg)', border: orderId === o.id ? '2px solid var(--primary)' : '1px solid var(--border-color)', borderRadius: '12px', cursor: 'pointer' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>#{o.orderNumber || o.id.substring(0,6)}</div>
                            <div style={{ fontSize: '1rem', fontWeight: 'bold', margin: '4px 0' }}>${o.amount?.toLocaleString()}</div>
                        </div>
                    ))}
                </div>
            </div>
          )}

          {/* Payment Inputs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
              <div style={inputGroupStyle}><label style={labelStyle}><Banknote size={14}/> NAQD (So'm)</label><input type="number" style={inputStyle} value={cash} onChange={e => setCash(e.target.value)} placeholder="0" /></div>
              <div style={inputGroupStyle}><label style={labelStyle}><CreditCard size={14}/> TERMINAL</label><input type="number" style={inputStyle} value={terminal} onChange={e => setTerminal(e.target.value)} placeholder="0" /></div>
              <div style={inputGroupStyle}><label style={labelStyle}><Smartphone size={14}/> CLICK / PAYME</label><input type="number" style={inputStyle} value={click} onChange={e => setClick(e.target.value)} placeholder="0" /></div>
              <div style={inputGroupStyle}><label style={labelStyle}><Building2 size={14}/> PUL KO'CHIRISH (Bank)</label><input type="number" style={inputStyle} value={bank} onChange={e => setBank(e.target.value)} placeholder="0" /></div>
              <div style={inputGroupStyle}><label style={labelStyle}><DollarSign size={14}/> VALYUTA ($)</label><input type="number" style={inputStyle} value={usd} onChange={e => setUsd(e.target.value)} placeholder="0" /></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '10px' }}>
              <div><label style={labelStyle}>Chegirma (Bank)</label><input type="number" style={inputStyle} value={bankChegirma} onChange={e => setBankChegirma(e.target.value)} placeholder="0" /></div>
              <div><label style={labelStyle}>Qaytarish (Naqd)</label><input type="number" style={inputStyle} value={qaytarish} onChange={e => setQaytarish(e.target.value)} placeholder="0" /></div>
          </div>
          
          <div style={{ marginTop: '15px' }}>
              <label style={labelStyle}>Izoh</label>
              <textarea style={{ ...inputStyle, minHeight: '80px' }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Xaridor uchun eslatma..."></textarea>
          </div>
        </div>

        {/* SIDEBAR - RESULTS */}
        <div className="pos-sidebar-side">
          <div className="pos-cart-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '20px' }}>TO'LOV XULOSASI</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Jami (UZS):</span>
                  <span style={{ fontWeight: 'bold' }}>{sums.uzs.toLocaleString()} UZS</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', color: 'var(--primary)', borderTop: '1px solid var(--border-color)', paddingTop: '15px' }}>
                  <span style={{ fontWeight: 'bold' }}>JAMI ($):</span>
                  <span style={{ fontWeight: '800' }}>${sums.usd.toLocaleString()}</span>
                </div>

                {orderId && (
                  <div style={{ marginTop: '10px', padding: '15px', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--danger)' }}>
                      <span>Qarzga yozildi:</span>
                      <span style={{ fontWeight: 'bold' }}>
                        ${Math.max(0, (pendingOrders.find(o => o.id === orderId)?.amount || 0) - sums.usd).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ flex: 1 }}></div>

            <div style={{ padding: '20px', background: 'var(--bg-card)', borderTop: '1px solid var(--border-color)' }}>
               {error && <div style={{ color: 'var(--danger)', marginBottom: '10px', fontSize: '0.8rem' }}>{error}</div>}
               <button 
                onClick={handleSubmit} 
                disabled={loading || !clientId} 
                className="btn btn-primary" 
                style={{ width: '100%', height: '56px', borderRadius: '14px', fontSize: '1.1rem' }}
               >
                 {loading ? 'Yuborilmoqda...' : 'TASDIQLASH VA SAQLASH'}
               </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
