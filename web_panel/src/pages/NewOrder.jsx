import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../constants';
import { useTranslation } from '../context/LanguageContext';
import { ShoppingCart, Search, Plus, Trash2, Send, Box, ChevronDown, ChevronUp } from 'lucide-react';

export default function NewOrder() {
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [selectedClient, setSelectedClient] = useState('');
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    setLoading(true);
    Promise.all([
      axios.get(`${API_URL}/clients`),
      axios.get(`${API_URL}/products`)
    ]).then(([cRes, pRes]) => {
      setClients(cRes.data || []);
      setProducts(pRes.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const addToCart = (e, p) => {
    e.stopPropagation();
    if (p.stock <= 0) return alert(t('no_stock'));
    const existing = cart.find(item => item.productId === p.id);
    if (existing) {
      if (existing.quantity >= p.stock) return alert(t('no_stock'));
      setCart(cart.map(item => item.productId === p.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { productId: p.id, name: p.name, price: p.sellPrice, quantity: 1, stock: p.stock }]);
    }
  };

  const updateQty = (id, q) => {
    const item = cart.find(i => i.productId === id);
    if (q > item.stock) return alert(t('no_stock'));
    if (q <= 0) return removeFromCart(id);
    setCart(cart.map(i => i.productId === id ? { ...i, quantity: Number(q) } : i));
  };

  const removeFromCart = (id) => setCart(cart.filter(i => i.productId !== id));
  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const submitOrder = async () => {
    if (!selectedClient) return alert(t('client') + " tanlang!");
    if (cart.length === 0) return alert(t('empty_cart'));
    setLoading(true);
    try {
      await axios.post(`${API_URL}/orders`, {
        clientId: selectedClient,
        items: cart.map(i => ({ productId: i.productId, quantity: i.quantity, price: i.price }))
      });
      alert(t('order_success'));
      setCart([]); setSelectedClient('');
    } catch (err) { alert("Xato: " + (err.response?.data?.error || "Yuborib bo'lmadi")); }
    setLoading(false);
  };

  const s = search.toLowerCase();
  const filteredProducts = products.filter(p => 
    String(p.name || '').toLowerCase().includes(s) || 
    String(p.code || '').toLowerCase().includes(s)
  );

  return (
    <div className="animate-fade-in">
      <h2 style={{ marginBottom: '20px' }}>🛒 {t('new_order')}</h2>
      
      <div className="responsive-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Client select compact */}
          <div className="card" style={{ padding: '15px' }}>
            <h4 style={{ marginBottom: '10px', fontSize: '1rem' }}>1. {t('client')}</h4>
            <select className="form-control" style={{ height: '40px', fontSize: '0.9rem' }} value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)}>
              <option value="">-- {t('search')} --</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name} (${c.currentDebt})</option>)}
            </select>
          </div>

          {/* Product grid compact */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <h4 style={{ fontSize: '1rem' }}>2. {t('products')} <small style={{ color: 'var(--text-muted)' }}>({filteredProducts.length})</small></h4>
               <div style={{ position: 'relative', width: '200px' }}>
                 <Search size={14} style={{ position: 'absolute', top: '10px', left: '12px', color: 'var(--text-muted)' }} />
                 <input type="text" className="form-control" style={{ paddingLeft: '35px', borderRadius: '20px', height: '34px', fontSize: '0.85rem' }} placeholder={t('search')} value={search} onChange={(e) => setSearch(e.target.value)} />
               </div>
            </div>
            
            {loading ? <div style={{ textAlign: 'center', padding: '20px' }}>{t('loading')}</div> : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px', maxHeight: '500px', overflowY: 'auto' }}>
                {filteredProducts.map(p => (
                  <div 
                    key={p.id} 
                    className="card" 
                    style={{ 
                      padding: '10px 12px', cursor: 'pointer', background: 'var(--bg-surface)', border: selectedProductId === p.id ? '1px solid var(--primary)' : '1px solid var(--border-color)', 
                      transition: 'all 0.2s', boxShadow: selectedProductId === p.id ? '0 0 10px rgba(99,102,241,0.1)' : 'none'
                    }}
                    onClick={() => setSelectedProductId(selectedProductId === p.id ? null : p.id)}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                           <div style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--primary)' }}>${p.sellPrice}</div>
                           <button onClick={(e) => addToCart(e, p)} className="btn btn-primary" style={{ padding: '4px 8px', fontSize: '0.75rem', borderRadius: '6px' }}>+ Savat</button>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.02)', paddingTop: '4px' }}>
                           <span>Sklad: {p.stock}</span>
                           <span>{p.code || '—'}</span>
                        </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {filteredProducts.length === 0 && !loading && <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>Topilmadi.</div>}
          </div>
        </div>

        {/* Floating Cart section compact */}
        <div className="card" style={{ height: 'fit-content', position: 'sticky', top: '10px', display: 'flex', flexDirection: 'column', border: '2px solid var(--primary)', padding: '15px' }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', fontSize: '1rem' }}><ShoppingCart size={18} color="var(--primary)"/> {t('cart')}</h4>
          <div style={{ maxHeight: '350px', overflowY: 'auto', marginBottom: '15px' }}>
            {cart.map(item => (
              <div key={item.productId} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>{item.name}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>${item.price} x {item.quantity} = <b>${item.price * item.quantity}</b></div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="number" className="form-control" style={{ width: '45px', padding: '3px', fontSize: '0.8rem' }} value={item.quantity} onChange={(e) => updateQty(item.productId, e.target.value)} />
                  <button onClick={() => removeFromCart(item.productId)} style={{ color: 'var(--danger)', background: 'transparent' }}><Trash2 size={16}/></button>
                </div>
              </div>
            ))}
            {cart.length === 0 && <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px', fontSize: '0.85rem' }}>{t('empty_cart')}</div>}
          </div>
          <div style={{ paddingTop: '15px', borderTop: '2px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '15px' }}>
              <span>{t('total')}</span>
              <span style={{ color: 'var(--primary)' }}>${total.toLocaleString()}</span>
            </div>
            <button onClick={submitOrder} disabled={loading || cart.length === 0} className="btn btn-primary" style={{ width: '100%', padding: '12px', fontWeight: 'bold' }}>
               <Send size={18}/> Yuborish
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
