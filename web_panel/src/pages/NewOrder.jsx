import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { API_URL } from '../constants';
import { useTranslation } from '../context/LanguageContext';
import { 
  ShoppingCart, Search, Plus, Minus, Trash2, Send, 
  ChevronDown, ChevronRight, Filter, Calendar, User, History, 
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
  const exchangeRate = 12600;

  /* ─── DATA ─────────────────────────────────────────────── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, pRes] = await Promise.all([
        axios.get(`${API_URL}/clients`),
        axios.get(`${API_URL}/products`),
      ]);
      setClients(Array.isArray(cRes.data) ? cRes.data : []);
      setProducts(Array.isArray(pRes.data) ? pRes.data : []);
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
      <div className="pos-root">

        {/* ══ HEADER ══════════════════════════════════════════ */}
        <div className="pos-header">
          <div className="h-card">

            {/* DATE */}
            <div className="h-cell h-cell-border" onClick={() => document.getElementById('dateRef').showPicker()}>
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

            {/* MIJOZ */}
            <div
              className="h-cell h-cell-border h-cell-clickable"
              ref={clientBtnRef}
              onClick={openDropdown}
            >
              <User size={17} color={selectedClient ? '#fbbf24' : '#555'} />
              <div className="h-text overflow-hidden">
                <span className="h-label">MIJOZ</span>
                <div className={selectedClient ? 'h-val h-val-active truncate' : 'h-val h-val-empty truncate'}>
                  {selectedClient ? selectedClient.name : 'Mijozni tanlang...'}
                </div>
              </div>
              <ChevronDown size={13} style={{ opacity: 0.3, flexShrink: 0 }} />
            </div>

            {/* BALANS */}
            <div
              className={`h-cell ${selectedClient ? 'h-cell-clickable' : ''}`}
              onClick={() => selectedClient && openStatement(selectedClient.id)}
            >
              <Wallet size={17} color={(selectedClient?.currentDebt || 0) > 0 ? '#ef4444' : '#10b981'} />
              <div className="h-text">
                <span className="h-label">BALANS</span>
                {selectedClient ? (
                  <>
                    <div className={(selectedClient.currentDebt || 0) > 0 ? 'h-val text-danger' : 'h-val text-success'}>
                      ${Number(selectedClient.currentDebt || 0).toLocaleString()}
                    </div>
                    <div className="h-sublabel">
                      ≈ {(Number(selectedClient.currentDebt || 0) * exchangeRate).toLocaleString()} so'm
                    </div>
                  </>
                ) : (
                  <div className="h-val h-val-empty">--</div>
                )}
              </div>
              {selectedClient && <History size={13} style={{ opacity: 0.35, flexShrink: 0 }} />}
            </div>

          </div>
        </div>

        {/* ══ SEARCH ══════════════════════════════════════════ */}
        <div className="pos-search-zone">
          <div className="pos-search-box">
            <Search size={19} style={{ color: '#555', flexShrink: 0 }} />
            <input
              type="text"
              className="pos-search-input"
              placeholder="Mahsulot qidirish..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <Filter size={17} style={{ color: '#555', flexShrink: 0 }} />
          </div>
        </div>

        {/* ══ FEED ════════════════════════════════════════════ */}
        <div className="pos-feed scroll-styled">
          {loading && !search ? (
            <div className="pos-loading">
              <div className="pos-spinner" />
              <span>Yuklanmoqda...</span>
            </div>
          ) : isSearchActive ? (
            /* SEARCH RESULTS */
            filteredProducts(true).map(p => (
              <div key={p.id} className="pos-product-card" onClick={() => addToCart(p)}>
                <div className="flex-grow-1 overflow-hidden pe-3">
                  <div className="p-name">{p.name}</div>
                  <div className="p-meta">{p.code || 'B/K'} · {p.group}</div>
                  <div className={`p-stock ${Number(p.stock) < 5 ? 'low' : ''}`}>Ost: {p.stock} ta</div>
                </div>
                <div className="p-price">${p.sellPrice}</div>
              </div>
            ))
          ) : (
            /* CATEGORY LIST */
            groups.map(group => (
              <div key={group}>
                <div
                  className="pos-cat-card"
                  onClick={() => setOpenedCategory(openedCategory === group ? null : group)}
                >
                  <div className="cat-icon"><Package size={20} /></div>
                  <div className="v-stack flex-grow-1 ms-3 overflow-hidden">
                    <div className="cat-name truncate">{group}</div>
                    <div className="cat-count">{groupedProducts[group].length} mahsulot</div>
                  </div>
                  <ChevronRight
                    size={18}
                    style={{
                      color: '#555',
                      flexShrink: 0,
                      transform: openedCategory === group ? 'rotate(90deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s',
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

        {/* ══ CART ════════════════════════════════════════════ */}
        <div className="pos-cart-panel">

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
                  <div className="dd-phone">{c.phone || 'Tel yo\'q'}</div>
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
              <div>
                <div className="modal-title">MOLIYAVIY HISOBOT</div>
                <div className="modal-sub">{selectedClient?.name}</div>
              </div>
              <button className="modal-close" onClick={() => setShowStatement(false)}><X size={22} /></button>
            </div>
            <div className="modal-tiles">
              <div className="m-tile red">
                <div className="tile-label">JAMI QARZ (USD)</div>
                <div className="tile-val">${Number(selectedClient?.currentDebt || 0).toLocaleString()}</div>
              </div>
              <div className="m-tile blue">
                <div className="tile-label">SO'MDAGI HISOB</div>
                <div className="tile-val">≈ {(Number(selectedClient?.currentDebt || 0) * exchangeRate).toLocaleString()}</div>
              </div>
            </div>
            <div className="modal-timeline scroll-styled">
              {[
                ...statementData.orders.map(o => ({ ...o, _type: 'order' })),
                ...statementData.payments.map(p => ({ ...p, _type: 'payment' })),
              ]
                .sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date))
                .map((item, idx) => (
                  <div key={idx} className="tl-row">
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <div className="tl-date">{new Date(item.createdAt || item.date).toLocaleDateString()}</div>
                        <div className="tl-title">
                          {item._type === 'order' ? 'Savdo buyurtmasi' : `To'lov (${item.paymentMethod || 'Tizim'})`}
                        </div>
                      </div>
                      <div className={item._type === 'order' ? 'tl-amount danger' : 'tl-amount success'}>
                        {item._type === 'order' ? '-' : '+'}${Number(item.amount).toLocaleString()}
                      </div>
                    </div>
                    {item.items && (
                      <div className="tl-items truncate">
                        {item.items.map(i => `${i.product?.name} x${i.quantity}`).join(', ')}
                      </div>
                    )}
                  </div>
                ))}
            </div>
            <div className="modal-footer">
              <button className="btn-modal-sec"><Receipt size={16} /> PDF Chek</button>
              <button className="btn-modal-pri"><ArrowRight size={16} /> To'lov</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        /* ── BASE ── */
        .pos-root {
          height: 100vh;
          background: #0D0D0D;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          color: #E2E8F0;
          font-family: 'Inter', sans-serif;
        }

        /* ── HEADER ── */
        .pos-header { padding: 14px; flex-shrink: 0; }
        .h-card {
          background: #1A1A1A;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 16px;
          display: flex;
          height: 76px;
          /* NO overflow:hidden here — dropdown needs to escape */
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
        .h-cell-border { border-right: 1px solid rgba(255,255,255,0.06); }
        .h-cell-clickable { cursor: pointer; transition: background 0.15s; border-radius: 0; }
        .h-cell-clickable:hover { background: rgba(255,255,255,0.04); }
        .h-icon-blue { color: #3b82f6; flex-shrink: 0; }
        .h-text { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
        .h-label { font-size: 0.55rem; font-weight: 900; color: #555; letter-spacing: 0.06em; line-height: 1; margin-bottom: 3px; }
        .h-val { font-size: 0.9rem; font-weight: 800; line-height: 1.2; }
        .h-val-active { color: #F8FAFC; }
        .h-val-empty { color: #666; }
        .h-sublabel { font-size: 0.6rem; color: #555; margin-top: 1px; }
        .h-date-input { background: transparent; border: none; color: #3b82f6; font-weight: 900; outline: none; width: 100%; font-size: 0.9rem; font-family: inherit; cursor: pointer; }
        .text-danger { color: #ef4444 !important; }
        .text-success { color: #10b981 !important; }

        /* ── SEARCH ── */
        .pos-search-zone { padding: 0 14px 14px; flex-shrink: 0; }
        .pos-search-box {
          background: #1A1A1A;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 28px;
          height: 52px;
          padding: 0 18px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .pos-search-input { border: none; background: transparent; color: #fff; outline: none; flex-grow: 1; font-size: 0.95rem; }
        .pos-search-input::placeholder { color: #555; }

        /* ── FEED ── */
        .pos-feed { flex-grow: 1; overflow-y: auto; padding: 0 14px 10px; }
        .pos-product-card {
          height: 78px;
          background: #1A1A1A;
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 16px;
          padding: 10px 18px;
          display: flex;
          align-items: center;
          margin-bottom: 10px;
          transition: border-color 0.2s;
        }
        .pos-product-card:hover { border-color: #3b82f6; }
        .p-name { font-weight: 800; font-size: 0.95rem; color: #F8FAFC; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .p-meta { font-size: 0.7rem; color: #555; margin-top: 1px; }
        .p-stock { font-size: 0.68rem; font-weight: 900; color: #10b981; margin-top: 3px; }
        .p-stock.low { color: #ef4444; }
        .p-price { font-weight: 900; font-size: 1.05rem; color: #3b82f6; flex-shrink: 0; }

        .pos-cat-card {
          height: 68px;
          background: #111;
          border: 1px solid rgba(255,255,255,0.04);
          border-radius: 14px;
          display: flex;
          align-items: center;
          padding: 0 18px;
          margin-bottom: 6px;
          transition: border-color 0.2s;
        }
        .pos-cat-card:hover { border-color: #3b82f6; }
        .cat-icon { width: 42px; height: 42px; background: rgba(59,130,246,0.08); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #3b82f6; flex-shrink: 0; }
        .cat-name { font-weight: 900; font-size: 0.95rem; color: #F1F5F9; }
        .cat-count { font-size: 0.7rem; color: #555; }

        .pos-sub-item { padding: 12px 18px 12px 22px; border-bottom: 1px solid rgba(255,255,255,0.04); display: flex; align-items: center; transition: background 0.15s; }
        .pos-sub-item:hover { background: rgba(255,255,255,0.02); }
        .sub-name { font-weight: 700; color: #CBD5E1; font-size: 0.88rem; }
        .sub-stock { font-size: 0.65rem; font-weight: 900; color: #10b981; }
        .sub-stock.low { color: #ef4444; }
        .sub-price { font-weight: 800; font-size: 0.9rem; color: #a5b4fc; }
        .btn-add-mini { background: #3b82f6; color: white; border-radius: 8px; padding: 5px; display: flex; align-items: center; justify-content: center; }

        /* ── CART PANEL ── */
        .pos-cart-panel { flex-shrink: 0; border-top: 1px solid rgba(255,255,255,0.06); background: #080808; }
        .pos-cart-rows { max-height: 130px; overflow-y: auto; padding: 10px 14px; }
        .cart-empty { padding: 18px; text-align: center; color: #444; font-size: 0.8rem; font-weight: 700; }
        .cart-row { display: flex; align-items: center; padding: 7px 0; border-bottom: 1px dashed rgba(255,255,255,0.04); }
        .cart-name { font-weight: 700; font-size: 0.85rem; color: #F1F5F9; }
        .cart-meta { font-size: 0.68rem; color: #555; }
        .qty-ctrl { display: flex; align-items: center; background: #111; border-radius: 10px; padding: 2px; border: 1px solid rgba(255,255,255,0.05); }
        .btn-qty { width: 26px; height: 26px; border: none; background: #1A1A1A; color: #ccc; border-radius: 8px; display: flex; align-items: center; justify-content: center; transition: 0.15s; }
        .btn-qty:hover { background: #3b82f6; color: white; }
        .qty-num { font-weight: 900; font-size: 0.85rem; margin: 0 8px; min-width: 16px; text-align: center; }
        .cart-total { font-weight: 900; color: #fbbf24; font-size: 0.85rem; min-width: 55px; text-align: right; }

        .pos-summary { padding: 14px; }
        .sum-label { font-size: 0.6rem; font-weight: 900; color: #555; letter-spacing: 0.06em; }
        .sum-usd { font-size: 1.3rem; font-weight: 900; color: #fff; }
        .sum-uzs { font-size: 1.5rem; font-weight: 900; color: #3b82f6; }
        .btn-submit {
          width: 100%;
          padding: 20px;
          background: #10b981;
          color: white;
          border: none;
          border-radius: 18px;
          font-weight: 900;
          font-size: 1.1rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          box-shadow: 0 10px 25px rgba(16,185,129,0.35);
          transition: 0.2s;
        }
        .btn-submit:disabled { opacity: 0.3; filter: grayscale(1); }
        .btn-submit:not(:disabled):active { transform: scale(0.97); }

        /* ── DROPDOWN PORTAL ── */
        .dd-portal {
          position: fixed;
          background: #111;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 16px;
          z-index: 99999;
          overflow: hidden;
          box-shadow: 0 24px 60px rgba(0,0,0,0.9);
          animation: ddFadeIn 0.15s ease-out;
        }
        @keyframes ddFadeIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        .dd-search-row { padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; gap: 10px; }
        .dd-search-input { border: none; background: transparent; color: white; outline: none; width: 100%; font-size: 0.9rem; }
        .dd-search-input::placeholder { color: #555; }
        .dd-list { max-height: 260px; overflow-y: auto; }
        .dd-empty { padding: 20px; text-align: center; color: #555; font-size: 0.85rem; }
        .dd-item { padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.04); display: flex; align-items: center; transition: background 0.15s; }
        .dd-item:hover { background: #1A1A1A; }
        .dd-name { font-weight: 800; font-size: 0.95rem; color: #F8FAFC; }
        .dd-phone { font-size: 0.72rem; color: #555; margin-top: 1px; }
        .dd-debt { font-weight: 900; font-size: 0.9rem; flex-shrink: 0; }
        .dd-debt.danger { color: #ef4444; }
        .dd-debt.success { color: #10b981; }

        /* ── MODAL ── */
        .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.92); backdrop-filter: blur(10px); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .modal-box { background: #0D0D0D; border: 1px solid rgba(255,255,255,0.08); border-radius: 28px; width: 100%; max-width: 480px; max-height: 88vh; display: flex; flex-direction: column; overflow: hidden; }
        .modal-head { padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; justify-content: space-between; align-items: flex-start; }
        .modal-title { font-size: 1rem; font-weight: 900; color: #fff; }
        .modal-sub { font-size: 0.8rem; color: #3b82f6; margin-top: 2px; }
        .modal-close { background: rgba(255,255,255,0.06); border: none; color: #ccc; border-radius: 12px; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; transition: 0.15s; }
        .modal-close:hover { background: rgba(255,255,255,0.1); }
        .modal-tiles { padding: 18px; display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .m-tile { padding: 16px; border-radius: 16px; }
        .m-tile.red { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.15); }
        .m-tile.blue { background: rgba(59,130,246,0.08); border: 1px solid rgba(59,130,246,0.15); }
        .tile-label { font-size: 0.6rem; font-weight: 900; color: #555; letter-spacing: 0.05em; }
        .tile-val { font-size: 1.3rem; font-weight: 900; margin-top: 4px; color: #fff; }
        .modal-timeline { flex-grow: 1; overflow-y: auto; }
        .tl-row { padding: 16px 18px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .tl-date { font-size: 0.65rem; font-weight: 800; color: #fbbf24; background: rgba(251,191,36,0.08); padding: 2px 8px; border-radius: 4px; display: inline-block; }
        .tl-title { font-weight: 800; font-size: 0.9rem; color: #F1F5F9; margin-top: 4px; }
        .tl-amount { font-weight: 900; font-size: 1.05rem; flex-shrink: 0; }
        .tl-amount.danger { color: #ef4444; }
        .tl-amount.success { color: #10b981; }
        .tl-items { font-size: 0.7rem; color: #555; margin-top: 6px; }
        .modal-footer { padding: 16px 18px; border-top: 1px solid rgba(255,255,255,0.06); display: flex; gap: 12px; }
        .btn-modal-sec { flex: 1; height: 50px; background: rgba(255,255,255,0.05); border: none; color: #ccc; border-radius: 14px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .btn-modal-pri { flex: 1; height: 50px; background: #3b82f6; border: none; color: white; border-radius: 14px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 8px; }

        /* ── UTILITY ── */
        .v-stack { display: flex; flex-direction: column; }
        .truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pos-loading { flex-grow: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; color: #444; }
        .pos-spinner { width: 32px; height: 32px; border: 3px solid #222; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .scroll-styled::-webkit-scrollbar { width: 3px; }
        .scroll-styled::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 10px; }
        .animate-fade-in { animation: fadeIn 0.25s ease-out; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        @media (max-width: 600px) {
          .h-card { flex-direction: column; height: auto; }
          .h-cell { height: 62px; }
          .h-cell-border { border-right: none; border-bottom: 1px solid rgba(255,255,255,0.06); }
        }
      `}</style>
    </>
  );
}
