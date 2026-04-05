import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { API_URL } from '../constants';
import { useTranslation } from '../context/LanguageContext';
import { 
  ShoppingCart, Search, Plus, Minus, Trash2, Send, 
  ChevronDown, ChevronRight, Filter, Calendar, User, Users, History, 
  Wallet, X, Receipt, ArrowRight, Package
} from 'lucide-react';

export default function NewOrder() {
  const [clients, setClients]     = useState([]);
  const [products, setProducts]   = useState([]);
  const [cart, setCart]           = useState([]);
  const [search, setSearch]       = useState('');
  const [openedCategory, setOpenedCategory] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [loading, setLoading]     = useState(false);
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);

  // Dropdown
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [dropdownPos, setDropdownPos]               = useState({ top: 0, left: 0, width: 0 });
  const [clientSearch, setClientSearch]             = useState('');

  // Statement modal
  const [showStatement, setShowStatement] = useState(false);
  const [statementData, setStatementData] = useState({ orders: [], payments: [] });

  const clientBtnRef  = useRef(null);
  const dropdownRef    = useRef(null);
  const searchInputRef = useRef(null);
  const { t } = useTranslation();
  const [exchangeRate, setExchangeRate] = useState(12800);

  /* ─── DATA ─────────────────────────────────────────────── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, pRes, sRes] = await Promise.all([
        axios.get(`${API_URL}/clients`),
        axios.get(`${API_URL}/products`),
        axios.get(`${API_URL}/settings/public`)
      ]);
      setClients(Array.isArray(cRes.data) ? cRes.data : []);
      setProducts(Array.isArray(pRes.data) ? pRes.data : []);
      if (sRes.data?.exchangeRate) setExchangeRate(sRes.data.exchangeRate);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ─── DROPDOWN OPEN (FIXED POSITION) ───────────────────── */
  const openDropdown = () => {
    if (!clientBtnRef.current) return;
    const rect = clientBtnRef.current.getBoundingClientRect();
    setDropdownPos({
      top:   rect.bottom + 6,
      left:  rect.left,
      width: rect.width,
    });
    setShowClientDropdown(true);
    setClientSearch('');
  };

  // Close on outside click — must NOT close when clicking inside the portal dropdown
  useEffect(() => {
    if (!showClientDropdown) return;
    const handler = (e) => {
      const inBtn      = clientBtnRef.current  && clientBtnRef.current.contains(e.target);
      const inDropdown = dropdownRef.current   && dropdownRef.current.contains(e.target);
      if (inBtn || inDropdown) return;   // keep open
      setShowClientDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showClientDropdown]);

  // Auto-focus search input
  useEffect(() => {
    if (showClientDropdown && searchInputRef.current) searchInputRef.current.focus();
  }, [showClientDropdown]);

  /* ─── STATEMENT ─────────────────────────────────────────── */
  const openStatement = async (clientId) => {
    if (!clientId) return;
    setLoading(true);
    try {
      const [oRes, pRes] = await Promise.all([
        axios.get(`${API_URL}/orders`),
        axios.get(`${API_URL}/payments`),
      ]);
      setStatementData({
        orders:   Array.isArray(oRes.data) ? oRes.data.filter(o => o.clientId === clientId).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)) : [],
        payments: Array.isArray(pRes.data) ? pRes.data.filter(p => p.clientId === clientId).sort((a,b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)) : [],
      });
      setShowStatement(true);
    } catch (err) {
      console.error('Statement error:', err);
    } finally {
      setLoading(false);
    }
  };

  /* ─── CART ───────────────────────────────────────────────── */
  const addToCart = (p) => {
    if (Number(p.stock) <= 0) return alert("Omborda mahsulot qolmagan!");
    const existing = cart.find(i => i.productId === p.id);
    if (existing) {
      if (existing.quantity >= p.stock) return alert("Omborda yetarli mahsulot yo'q!");
      setCart(cart.map(i => i.productId === p.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setCart([...cart, { productId: p.id, name: p.name, price: Number(p.sellPrice), quantity: 1, stock: p.stock }]);
    }
  };

  const updateQty = (id, delta) => {
    const item = cart.find(i => i.productId === id);
    if (!item) return;
    const newQty = item.quantity + delta;
    if (newQty > item.stock) return alert(`${item.name} omborda faqat ${item.stock} ta bor!`);
    if (newQty <= 0) { setCart(cart.filter(i => i.productId !== id)); return; }
    setCart(cart.map(i => i.productId === id ? { ...i, quantity: newQty } : i));
  };

  const totalUSD   = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const totalUZS   = totalUSD * exchangeRate;
  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);

  /* ─── SUBMIT ─────────────────────────────────────────────── */
  const submitOrder = async () => {
    if (!selectedClient) return alert("Iltimos, mijozni tanlang!");
    if (cart.length === 0) return alert("Savatcha bo'sh!");
    setLoading(true);
    try {
      await axios.post(`${API_URL}/orders`, {
        clientId: selectedClient.id,
        due_date: orderDate,
        items: cart.map(i => ({ productId: i.productId, quantity: i.quantity, price: i.price })),
      });
      alert("Buyurtma muvaffaqiyatli saqlandi!");
      setCart([]);
      setSelectedClient(null);
      await fetchData();
    } catch (err) {
      alert("Xato: " + (err.response?.data?.error || "Server xatosi."));
    } finally {
      setLoading(false);
    }
  };

  /* ─── DERIVED DATA ───────────────────────────────────────── */
  const filteredClients = clients
    .filter(c =>
      c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
      (c.phone && c.phone.includes(clientSearch))
    ).slice(0, 15);

  const filteredProducts = isSearchActive =>
    products.filter(p =>
      [p.name, p.code, p.group].some(v =>
        String(v || '').toLowerCase().includes(search.toLowerCase())
      )
    );

  const groupedProducts = products
    .filter(p => [p.name, p.code, p.group].some(v =>
      String(v || '').toLowerCase().includes(search.toLowerCase())
    ))
    .reduce((acc, p) => {
      const g = p.group || 'Boshqa';
      if (!acc[g]) acc[g] = [];
      acc[g].push(p);
      return acc;
    }, {});

  const groups = Object.keys(groupedProducts).sort();
  const isSearchActive = search.trim().length > 0;

  /* ════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════ */
  return (
    <>
      <div className="pos-root animate-fade-in">
      {/* ══ HEADER ══ */}
      <div className="pos-header">
        <div className="h-card">
          <div className="h-cell h-cell-border h-cell-clickable" onClick={() => document.getElementById('dateRef').showPicker()}>
            <Calendar size={17} className="h-icon-blue" />
            <div className="h-text">
              <span className="h-label">O'PERASIYA SANASI</span>
              <input
                type="date" id="dateRef"
                value={orderDate}
                onChange={e => setOrderDate(e.target.value)}
                className="h-date-input"
              />
            </div>
          </div>
          <div className="h-cell h-cell-border h-cell-clickable" onClick={openDropdown} ref={clientBtnRef}>
            <div className={`h-icon-blue ${!selectedClient ? 'animate-pulse' : ''}`}><Users size={24}/></div>
            <div className="h-text">
               <div className="h-label">MIJOZ TANLASH</div>
               <div className={`h-val ${selectedClient ? 'h-val-active' : 'h-val-empty'}`}>
                 {selectedClient ? selectedClient.name : 'TANLANMAGAN'}
               </div>
               {selectedClient && <div className="h-sublabel">${selectedClient.currentDebt?.toLocaleString()} qarz</div>}
            </div>
          </div>
          <div className="h-cell h-cell-clickable" onClick={() => selectedClient && setShowStatement(true)}>
            <div className="h-icon-blue"><Wallet size={24}/></div>
            <div className="h-text">
               <div className="h-label">BALANS KO'RISH</div>
               <div className="h-val text-success">AKT SVERKA</div>
            </div>
          </div>
        </div>
      </div>

      <div className="pos-main-layout">
        <div className="pos-content-side">
          {/* SEARCH */}
          <div className="pos-search-zone">
            <div className="pos-search-box">
              <Search size={20} color="var(--text-muted)" />
              <input 
                type="text" 
                className="pos-search-input" 
                placeholder="Mahsulot qidirish..." 
                value={search} 
                onChange={e => setSearch(e.target.value)}
              />
              {search && <X size={20} style={{ cursor: 'pointer' }} onClick={() => setSearch('')}/>}
            </div>
          </div>

          <div className="pos-feed scroll-styled">
            {Object.keys(groupedProducts).length === 0 ? (
              <div className="pos-loading">
                <div className="pos-spinner"></div>
                <div>Mahsulotlar topilmadi...</div>
              </div>
            ) : (
              Object.keys(groupedProducts).map(group => (
                <div key={group} className="cat-group" style={{ marginBottom: '10px' }}>
                  <div 
                    className="pos-cat-card" 
                    onClick={() => setOpenedCategory(openedCategory === group ? null : group)}
                    style={{ cursor: 'pointer', borderLeft: openedCategory === group ? '4px solid var(--primary)' : '1px solid var(--border-color)' }}
                  >
                    <div className="cat-icon"><Package size={20} /></div>
                    <div className="v-stack flex-grow-1 ms-3">
                      <div className="cat-name">{group}</div>
                      <div className="cat-count">{groupedProducts[group].length} xil mahsulot</div>
                    </div>
                    <ChevronRight 
                      size={18} 
                      style={{ 
                        color: '#555', 
                        flexShrink: 0,
                        transform: openedCategory === group ? 'rotate(90deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s' 
                      }} 
                    />
                  </div>
                  {openedCategory === group && groupedProducts[group].map(p => (
                    <div key={p.id} className="pos-sub-item" onClick={() => addToCart(p)}>
                      <div className="v-stack flex-grow-1 overflow-hidden pe-3">
                        <div className="sub-name truncate">{p.name}</div>
                        <div className={`sub-stock ${Number(p.stock) < 5 ? 'low' : ''}`}>Ost: {p.stock} ta</div>
                      </div>
                      <div className="d-flex align-items-center gap-3">
                        <div className="sub-price">${p.sellPrice}</div>
                        <div className="btn-add-mini"><Plus size={13} /></div>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>

        {/* ══ CART SIDEBAR ══ */}
        <div className="pos-sidebar-side">
          <div className="pos-cart-panel">
            <div style={{ padding: '15px', borderBottom: '1px solid var(--border-color)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-card)' }}>
              <ShoppingCart size={18} color="var(--primary)"/> BUYURTMA RO'YXATI
            </div>
            {/* Cart rows */}
            <div className="pos-cart-rows scroll-styled">
              {cart.length === 0 ? (
                <div className="cart-empty">SAVATCHA BO'SH</div>
              ) : cart.map(item => (
                <div key={item.productId} className="cart-row">
                  <div className="flex-grow-1 overflow-hidden pe-3">
                    <div className="cart-name truncate">{item.name}</div>
                    <div className="cart-meta">${item.price} × {item.quantity}</div>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <div className="qty-ctrl">
                      <button className="btn-qty" onClick={() => updateQty(item.productId, -1)}><Minus size={11} /></button>
                      <span className="qty-num">{item.quantity}</span>
                      <button className="btn-qty" onClick={() => updateQty(item.productId, +1)}><Plus size={11} /></button>
                    </div>
                    <div className="cart-total">${(item.price * item.quantity).toFixed(1)}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary + Button */}
            <div className="pos-summary">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <div className="sum-label">JAMI SONI: {totalItems} TA</div>
                  <div className="sum-usd">${totalUSD.toLocaleString()}</div>
                </div>
                <div className="text-end">
                  <div className="sum-label">JAMI SUMMA</div>
                  <div className="sum-uzs">{totalUZS.toLocaleString()} SO'M</div>
                </div>
              </div>
              <button
                className="btn-submit"
                onClick={submitOrder}
                disabled={loading || cart.length === 0 || !selectedClient}
              >
                <Send size={20} />
                {loading ? 'YUKLANMOQDA...' : "SAQLASH VA JO'NATISH"}
              </button>
            </div>
          </div>
        </div>
      </div>

      </div>

      {/* ══ DROPDOWN PORTAL (hamma narsadan tepada) ══════════ */}
      {showClientDropdown && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top:   dropdownPos.top,
            left:  dropdownPos.left,
            width: dropdownPos.width,
            background: '#111',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 16,
            zIndex: 99999,
            overflow: 'hidden',
            boxShadow: '0 24px 60px rgba(0,0,0,0.9)',
            animation: 'ddFadeIn 0.15s ease-out',
          }}
        >
          <div className="dd-search-row">
            <Search size={15} style={{ color: '#555', flexShrink: 0 }} />
            <input
              ref={searchInputRef}
              type="text"
              className="dd-search-input"
              placeholder="Ism yoki telefon..."
              value={clientSearch}
              onChange={e => setClientSearch(e.target.value)}
            />
          </div>
          <div className="dd-list scroll-styled">
            {filteredClients.length === 0 ? (
              <div className="dd-empty">Mijoz topilmadi</div>
            ) : filteredClients.map(c => (
              <div
                key={c.id}
                className="dd-item"
                onMouseDown={e => e.preventDefault()}   /* prevent blur/close before click */
                onClick={() => { setSelectedClient(c); setShowClientDropdown(false); }}
              >
                <div className="flex-grow-1 overflow-hidden pe-3">
                  <div className="dd-name truncate">{c.name}</div>
                  <div className="dd-phone">{c.phone || 'Tel yo\'q'} | Limiti: ${c.creditLimit?.toLocaleString()}</div>
                </div>
                <div className={(c.currentDebt || 0) > 0 ? 'dd-debt danger' : 'dd-debt success'}>
                  ${Number(c.currentDebt || 0).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}


      {/* ══ STATEMENT MODAL ═════════════════════════════════ */}
      {showStatement && (
        <div className="modal-backdrop" onClick={() => setShowStatement(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <div style={{ flex: 1 }}>
                <div className="modal-title">MOLIYAVIY HISOBOT</div>
                <div className="modal-sub">{selectedClient?.name}</div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button className="btn-modal-sec" style={{ height: '36px', padding: '0 12px', fontSize: '0.8rem', borderRadius: '10px' }}>
                  <Receipt size={14} /> PDF
                </button>
                <button className="modal-close" onClick={() => setShowStatement(false)}><X size={22} /></button>
              </div>
            </div>
            <div className="modal-tiles">
              <div className="m-tile red">
                <div className="tile-label">QARZ (USD)</div>
                <div className="tile-val" style={{ fontSize: '1.1rem' }}>${Number(selectedClient?.currentDebt || 0).toLocaleString()}</div>
              </div>
              <div className="m-tile blue">
                <div className="tile-label">SO'MDA</div>
                <div className="tile-val" style={{ fontSize: '1.1rem' }}>≈ {((selectedClient?.currentDebt || 0) * exchangeRate).toLocaleString()}</div>
              </div>
            </div>
            <div className="modal-timeline scroll-styled" style={{ flex: 1 }}>
              <div className="table-container" style={{ border: 'none', background: 'transparent' }}>
                <table className="custom-table" style={{ fontSize: '0.8rem' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '8px 12px' }}>Sana</th>
                      <th style={{ padding: '8px 12px' }}>Amaliyot</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Summa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ...statementData.orders.map(o => ({ ...o, _type: 'order', date: o.createdAt })),
                      ...statementData.payments.map(p => ({ ...p, _type: 'payment', date: p.date || p.createdAt })),
                    ]
                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                    .map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{new Date(item.date).toLocaleDateString()}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {item._type === 'order' ? <Package size={12} color="var(--warning)"/> : <Wallet size={12} color="var(--success)"/>}
                            <span style={{ fontWeight: 500 }}>{item._type === 'order' ? 'Savdo' : 'To\'lov'}</span>
                          </div>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 'bold', color: item._type === 'order' ? 'var(--danger)' : 'var(--success)' }}>
                          {item._type === 'order' ? '+' : '-'}${Number(item.amount).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', padding: '12px' }}>
              <button 
                className="btn-modal-pri" 
                style={{ width: '100%', height: '44px', borderRadius: '12px' }}
                onClick={() => { setShowStatement(false); }}
              >
                YOPISH
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        /* ── BASE ── */
        .pos-root {
          height: 100vh;
          background: var(--bg-color);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          color: var(--text-main);
          font-family: 'Inter', sans-serif;
        }

        /* ── HEADER ── */
        .pos-header { padding: 14px; flex-shrink: 0; }
        .h-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          display: flex;
          height: 76px;
        }
        .h-cell {
          flex: 1;
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 14px;
          cursor: default;
        }
        .h-cell-border { border-right: 1px solid var(--border-color); }
        .h-cell-clickable { cursor: pointer; transition: background 0.15s; border-radius: 0; }
        .h-cell-clickable:hover { background: rgba(255,255,255,0.04); }
        .h-icon-blue { color: var(--primary); flex-shrink: 0; }
        .h-text { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
        .h-label { font-size: 0.55rem; font-weight: 900; color: var(--text-muted); letter-spacing: 0.06em; line-height: 1; margin-bottom: 3px; }
        .h-val { font-size: 0.9rem; font-weight: 800; line-height: 1.2; }
        .h-val-active { color: var(--text-main); }
        .h-val-empty { color: var(--text-muted); }
        .h-sublabel { font-size: 0.6rem; color: var(--text-muted); margin-top: 1px; }
        .h-date-input { background: transparent; border: none; color: var(--primary); font-weight: 900; outline: none; width: 100%; font-size: 0.9rem; font-family: inherit; cursor: pointer; }
        .text-danger { color: var(--danger) !important; }
        .text-success { color: var(--success) !important; }

        /* ── SEARCH ── */
        .pos-search-zone { padding: 0 14px 14px; flex-shrink: 0; }
        .pos-search-box {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: 28px;
          height: 52px;
          padding: 0 18px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .pos-search-input { border: none; background: transparent; color: var(--text-main); outline: none; flex-grow: 1; font-size: 0.95rem; }
        .pos-search-input::placeholder { color: var(--text-muted); }

        /* ── FEED ── */
        .pos-feed { flex-grow: 1; overflow-y: auto; padding: 0 14px 10px; }
        .pos-product-card {
          height: 78px;
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          padding: 10px 18px;
          display: flex;
          align-items: center;
          margin-bottom: 10px;
          transition: border-color 0.2s;
        }
        .pos-product-card:hover { border-color: var(--primary); }
        .p-name { font-weight: 800; font-size: 0.95rem; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .p-meta { font-size: 0.7rem; color: var(--text-muted); margin-top: 1px; }
        .p-stock { font-size: 0.68rem; font-weight: 900; color: var(--success); margin-top: 3px; }
        .p-stock.low { color: var(--danger); }
        .p-price { font-weight: 900; font-size: 1.05rem; color: var(--primary); flex-shrink: 0; }

        .pos-cat-card {
          height: 68px;
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: 14px;
          display: flex;
          align-items: center;
          padding: 0 18px;
          margin-bottom: 6px;
          transition: border-color 0.2s;
        }
        .pos-cat-card:hover { border-color: var(--primary); }
        .pos-spinner { width: 32px; height: 32px; border: 3px solid var(--border-color); border-top-color: var(--primary); border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── LAYOUT ── */
        .pos-main-layout { display: flex; flex: 1; overflow: hidden; }
        .pos-content-side { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }
        .pos-sidebar-side { width: 380px; background: var(--bg-surface); border-left: 1px solid var(--border-color); display: flex; flex-direction: column; flex-shrink: 0; }
        .pos-sidebar-side .pos-cart-panel { border-top: none; height: 100%; display: flex; flex-direction: column; }
        .pos-sidebar-side .pos-cart-rows { flex: 1; max-height: none; }

        .scroll-styled::-webkit-scrollbar { width: 4px; }
        .scroll-styled::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 10px; }
        .animate-fade-in { animation: fadeIn 0.25s ease-out; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        @media (max-width: 1000px) {
          .pos-sidebar-side { width: 300px; }
        }

        @media (max-width: 768px) {
          .pos-main-layout { flex-direction: column; }
          .pos-sidebar-side { width: 100%; border-left: none; border-top: 1px solid var(--border-color); height: auto; flex-shrink: 0; }
          .pos-sidebar-side .pos-cart-rows { max-height: 180px; }
          .pos-sidebar-side .pos-cart-panel { height: auto; }
        }

        @media (max-width: 600px) {
          .h-card { flex-direction: column; height: auto; border: none; background: transparent; }
          .h-cell { height: 62px; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 12px; margin-bottom: 8px; }
          .h-cell-border { border-right: 1px solid var(--border-color); }
        }
      `}</style>
    </>
  );
}
