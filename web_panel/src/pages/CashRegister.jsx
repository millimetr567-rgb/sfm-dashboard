import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../constants';
import { useAuth } from '../context/AuthContext';
import { 
  Banknote, CreditCard, Smartphone, DollarSign, Building2, 
  RefreshCcw, Info, Wallet, LogOut, CheckCircle, X, ChevronDown, Trash2
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
      const [cRes, oRes] = await Promise.all([
        axios.get(`${API_URL}/clients`),
        axios.get(`${API_URL}/orders`)
      ]);
      setClients(cRes.data);
      setPendingOrders(oRes.data.filter(o => o.status === 'PENDING_PAYMENT' || o.status === 'WAITING_APPROVAL'));
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

  const inputGroupStyle = {
    marginBottom: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '5px'
  };

  const inputStyle = {
    background: 'var(--input-bg)',
    border: 'var(--glass-border)',
    borderRadius: '12px',
    padding: '14px',
    color: 'var(--text-main)',
    fontSize: '1rem',
    width: '100%',
    outline: 'none',
  };

  const labelStyle = {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    fontWeight: '500',
    marginLeft: '5px'
  };

  return (
    <div style={{ background: 'var(--bg-color)', minHeight: '100vh', color: 'var(--text-main)', padding: '15px' }}>
      {/* Client Selection Card */}
      <div style={{ background: 'var(--bg-surface)', padding: '20px', borderRadius: '15px', marginBottom: '15px', border: 'var(--glass-border)' }}>
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
            <div style={{ marginTop: '15px', padding: '12px', background: 'var(--input-bg)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', border: 'var(--glass-border)' }}>
                <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Balans</div>
                    <div style={{ fontSize: '1rem', fontWeight: 'bold', color: (selectedClient.currentDebt || 0) > 0 ? 'var(--danger)' : 'var(--success)' }}>
                        ${selectedClient.currentDebt?.toLocaleString()} | {((selectedClient.currentDebt || 0) * p(kurs)).toLocaleString()} UZS
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Oxirgi to'lov</div>
                    <div style={{ fontSize: '0.85rem' }}>{selectedClient.lastPaymentDate ? new Date(selectedClient.lastPaymentDate).toLocaleDateString() : '—'}</div>
                </div>
            </div>
        )}
      </div>

      {/* Main Payment Form */}
      <form onSubmit={handleSubmit} style={{ paddingBottom: '100px' }}>
        <div style={inputGroupStyle}>
            <label style={labelStyle}>Naqd (So'm)</label>
            <div style={{ position: 'relative' }}>
                <input type="number" step="any" placeholder="0" style={inputStyle} value={cash} onChange={e => setCash(e.target.value)} />
                {cash && <X size={18} style={{ position: 'absolute', right: '15px', top: '15px', color: 'var(--text-muted)' }} onClick={() => setCash('')} />}
            </div>
        </div>

        <div style={inputGroupStyle}>
            <label style={labelStyle}>Terminal</label>
            <div style={{ position: 'relative' }}>
                <input type="number" step="any" placeholder="0" style={inputStyle} value={terminal} onChange={e => setTerminal(e.target.value)} />
                {terminal && <X size={18} style={{ position: 'absolute', right: '15px', top: '15px', color: 'var(--text-muted)' }} onClick={() => setTerminal('')} />}
            </div>
        </div>

        <div style={inputGroupStyle}>
            <label style={labelStyle}>Click / Payme</label>
            <div style={{ position: 'relative' }}>
                <input type="number" step="any" placeholder="0" style={inputStyle} value={click} onChange={e => setClick(e.target.value)} />
                {click && <X size={18} style={{ position: 'absolute', right: '15px', top: '15px', color: 'var(--text-muted)' }} onClick={() => setClick('')} />}
            </div>
        </div>

        <div style={inputGroupStyle}>
            <label style={labelStyle}>Valyuta ($)</label>
            <div style={{ position: 'relative' }}>
                <input type="number" step="any" placeholder="0" style={inputStyle} value={usd} onChange={e => setUsd(e.target.value)} />
                {usd && <X size={18} style={{ position: 'absolute', right: '15px', top: '15px', color: 'var(--text-muted)' }} onClick={() => setUsd('')} />}
            </div>
        </div>

        <div style={inputGroupStyle}>
            <label style={labelStyle}>Bank O'tkazmasi</label>
            <div style={{ position: 'relative' }}>
                <input type="number" step="any" placeholder="0" style={inputStyle} value={bank} onChange={e => setBank(e.target.value)} />
                {bank && <X size={18} style={{ position: 'absolute', right: '15px', top: '15px', color: 'var(--text-muted)' }} onClick={() => setBank('')} />}
            </div>
        </div>

        {/* Currency & Conversion */}
        <div style={{ background: 'var(--bg-surface)', padding: '15px', borderRadius: '15px', margin: '15px 0', border: 'var(--glass-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <label style={labelStyle}>Valyuta kursi</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Konvertatsiya</span>
                    <input type="checkbox" checked={convert} onChange={e => setConvert(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                </div>
            </div>
            <input type="number" style={{ ...inputStyle, background: 'var(--bg-color)' }} value={kurs} onChange={e => setKurs(e.target.value)} />
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
