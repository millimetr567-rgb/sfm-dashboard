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
    let totalUSD = p(usd);
    
    // Sum basic UZS payments
    let uzsTotal = p(cash) + p(terminal) + p(click) + p(bank);
    
    // Add USD converted to Sum if enabled
    if (convert) {
        // Here USD becomes part of the total USD equivalent correctly
        // total = (cash+term+click+bank)/kurs + usd - (qaytarish+chegirma)/kurs
    }

    // Following user formula: total = cash + terminal + click + bank; if (convert) total += usd * kurs; total -= qaytarish; total -= bankChegirma;
    // THIS FORMULA CALCULATES THE TOTAL IN UZS
    let finalUzs = p(cash) + p(terminal) + p(click) + p(bank);
    if (convert) {
        finalUzs += p(usd) * p(kurs);
    }
    
    finalUzs -= p(qaytarish);
    finalUzs -= p(bankChegirma);
    
    // Convert back to USD for the database (since debt is in USD)
    const finalUsd = finalUzs / (p(kurs) || 1);
    
    return {
        uzs: finalUzs,
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
    <div style={{ background: 'var(--bg-color)', minHeight: '100vh', color: 'var(--text-main)', padding: '15px' }}>
      {/* Client Selection Card */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: '20px', alignItems: 'start' }} className="grid-mobile-1">
        <div style={{ background: 'var(--bg-surface)', padding: '20px', borderRadius: '15px', border: 'var(--glass-border)' }}>
          <h4 style={{ margin: '0 0 15px 0', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Wallet size={20} color="var(--primary)" /> Mijozni tanlang
          </h4>
          <select 
              style={inputStyle} 
              value={clientId} 
              onChange={(e) => handleClientChange(e.target.value)}
          >
              <option value="" style={{ background: 'var(--bg-surface)' }}>-- Tanlash --</option>
              {clients.map(c => <option key={c.id} value={c.id} style={{ background: 'var(--bg-surface)' }}>{c.name}</option>)}
          </select>
          
          {selectedClient && (
              <div style={{ marginTop: '15px', padding: '15px', background: 'var(--input-bg)', borderRadius: '12px', border: 'var(--glass-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Balans</div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: (selectedClient.currentDebt || 0) > 0 ? 'var(--danger)' : 'var(--success)' }}>
                              ${selectedClient.currentDebt?.toLocaleString()} 
                          </div>
                          <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>≈ {((selectedClient.currentDebt || 0) * p(kurs)).toLocaleString()} UZS</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Oxirgi to'lov</div>
                          <div style={{ fontSize: '0.85rem' }}>{selectedClient.lastPaymentDate ? new Date(selectedClient.lastPaymentDate).toLocaleDateString() : '—'}</div>
                      </div>
                  </div>
              </div>
          )}
        </div>

        {/* Exchange Rate Card (Desktop Right, Mobile Top/Bottom) */}
        <div style={{ background: 'var(--bg-surface)', padding: '20px', borderRadius: '15px', border: 'var(--glass-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <label style={labelStyle}>Valyuta kursi (1$)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="checkbox" checked={convert} onChange={e => setConvert(e.target.checked)} style={{ width: '16px', height: '16px' }} />
                    <span style={{ fontSize: '0.75rem' }}>Konv.</span>
                </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
                <input type="number" style={{ ...inputStyle, padding: '10px' }} value={kurs} onChange={e => setKurs(e.target.value)} />
                <button onClick={saveExchangeRate} className="btn-icon" style={{ borderRadius: '12px', width: '45px', height: '45px', background: 'var(--primary)', color: 'white' }}><Save size={18}/></button>
            </div>
        </div>
      </div>

      {/* Debt List / Pending Orders */}
      {selectedClient && pendingOrders.some(o => o.clientId === selectedClient.id) && (
        <div style={{ marginTop: '15px', background: 'var(--bg-surface)', padding: '15px', borderRadius: '15px', border: 'var(--glass-border)' }}>
            <h5 style={{ marginBottom: '10px', fontSize: '0.9rem', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '8px' }}><ShoppingCart size={16}/> TO'LOV KUTILAYOTGAN BUYURTMALAR</h5>
            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '5px' }}>
                {pendingOrders.filter(o => o.clientId === selectedClient.id).map(o => (
                    <div 
                        key={o.id} 
                        onClick={() => setOrderId(o.id)}
                        style={{ 
                            minWidth: '180px', 
                            padding: '12px', 
                            background: orderId === o.id ? 'rgba(99,102,241,0.1)' : 'var(--input-bg)', 
                            border: orderId === o.id ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                            borderRadius: '12px',
                            cursor: 'pointer'
                        }}
                    >
                        <div style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>#{o.orderNumber || o.id.substring(0,6)}</div>
                        <div style={{ fontSize: '1rem', fontWeight: '900', margin: '4px 0' }}>${o.amount?.toLocaleString()}</div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{new Date(o.createdAt).toLocaleDateString()}</div>
                    </div>
                ))}
            </div>
        </div>
      )}

      {/* Main Payment Form */}
      <form onSubmit={handleSubmit} style={{ paddingBottom: '120px', marginTop: '15px' }}>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
            <div style={inputGroupStyle}>
                <label style={labelStyle}><Banknote size={14}/> NAQD (So'm)</label>
                <input type="number" style={inputStyle} value={cash} onChange={e => setCash(e.target.value)} placeholder="0" />
            </div>
            <div style={inputGroupStyle}>
                <label style={labelStyle}><CreditCard size={14}/> TERMINAL</label>
                <input type="number" style={inputStyle} value={terminal} onChange={e => setTerminal(e.target.value)} placeholder="0" />
            </div>
            <div style={inputGroupStyle}>
                <label style={labelStyle}><Smartphone size={14}/> CLICK / PAYME</label>
                <input type="number" style={inputStyle} value={click} onChange={e => setClick(e.target.value)} placeholder="0" />
            </div>
            <div style={inputGroupStyle}>
                <label style={labelStyle}><Building2 size={14}/> PERECHISLENIYE</label>
                <input type="number" style={inputStyle} value={bank} onChange={e => setBank(e.target.value)} placeholder="0" />
            </div>
            <div style={inputGroupStyle}>
                <label style={labelStyle}><DollarSign size={14}/> VALYUTA ($)</label>
                <input type="number" style={inputStyle} value={usd} onChange={e => setUsd(e.target.value)} placeholder="0" />
            </div>
        </div>

        {/* Deductions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={inputGroupStyle}>
                <label style={labelStyle}>Bank chegirma</label>
                <input type="number" style={inputStyle} value={bankChegirma} onChange={e => setBankChegirma(e.target.value)} placeholder="0" />
            </div>
            <div style={inputGroupStyle}>
                <label style={labelStyle}>Qaytarish (Change)</label>
                <input type="number" style={inputStyle} value={qaytarish} onChange={e => setQaytarish(e.target.value)} placeholder="0" />
            </div>
        </div>

        <div style={inputGroupStyle}>
            <label style={labelStyle}>Izoh</label>
            <textarea style={{ ...inputStyle, minHeight: '80px' }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="..."></textarea>
        </div>

        {error && <div style={{ color: 'var(--danger)', padding: '10px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '10px', marginTop: '10px', fontSize: '0.9rem' }}>{error}</div>}
      </form>

      {/* Sticky Bottom Bar */}
      <div style={{ 
        position: 'fixed', 
        bottom: 0, 
        left: 0, 
        right: 0, 
        background: 'var(--bg-surface)', 
        padding: '15px 20px', 
        borderTop: 'var(--glass-border)', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        zIndex: 100,
        boxShadow: '0 -4px 20px rgba(0,0,0,0.1)'
      }}>
        <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>JAMI SUMMA</div>
            <div style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--primary)' }}>
                {sums.uzs.toLocaleString()} <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>UZS</span>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                ≈ ${sums.usd.toLocaleString()}
            </div>
        </div>
        <button 
            type="button"
            onClick={handleSubmit}
            disabled={loading || !clientId}
            style={{ 
                background: 'var(--primary)', 
                color: '#fff', 
                border: 'none', 
                padding: '15px 30px', 
                borderRadius: '12px', 
                fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                opacity: (loading || !clientId) ? 0.5 : 1
            }}
        >
            {loading ? '...' : <><CheckCircle size={18}/> SAQLASH</>}
        </button>
      </div>
    </div>
  );
}
