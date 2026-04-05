import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../constants';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { Search, Plus, Trash2, FileUp, Edit2, Box, Package, Filter } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { t } = useTranslation();
  const isAdmin = user?.role === 'ADMIN';
  
  const [showAdd, setShowAdd] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [newProduct, setNewProduct] = useState({ code: '', name: '', group: '', costPrice: 0, sellPrice: 0, stock: 0, minStock: 5 });
  const [activeCategory, setActiveCategory] = useState('ALL');

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API_URL}/products`);
      setProducts(r.data || []);
    } catch (e) { console.error("Fetch error", e); }
    setLoading(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/products`, newProduct);
      alert('Saqlandi');
      fetchProducts();
      setShowAdd(false);
      setNewProduct({ code: '', name: '', group: '', costPrice: 0, sellPrice: 0, stock: 0, minStock: 5 });
    } catch (err) { alert("Xato"); }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/products/${editProduct.id}`, editProduct);
      alert('Yangilandi');
      setEditProduct(null);
      setShowAdd(false);
      fetchProducts();
    } catch (e) { alert("Xato"); }
  };

  const handleDeleteAll = async () => {
    if (isAdmin && window.confirm("Barcha mahsulotlarni o'chirib yuborishga ishonchingiz komilmi?")) {
      try {
        await axios.delete(`${API_URL}/products`);
        fetchProducts();
        alert("Barcha mahsulotlar o'chirildi!");
      } catch (e) { alert("Xato o'chirishda"); }
    }
  };

  const handleExcelImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        
        const finalProducts = [];
        let inheritedGroup = 'Boshqa';

        for (let row of data) {
          const rowKeys = Object.keys(row);
          const findKey = (keys) => {
            const found = rowKeys.find(k => {
              const kClean = String(k || '').trim().toLowerCase();
              return keys.some(pk => kClean.includes(pk.toLowerCase()) || pk.toLowerCase().includes(kClean));
            });
            return found ? row[found] : null;
          };

          const parseNum = (val) => {
            if (val === null || val === undefined) return 0;
            if (typeof val === 'number') return val;
            const stripped = String(val).replace(/[^0-9.]/g, '');
            const parsed = parseFloat(stripped);
            return isNaN(parsed) ? 0 : parsed;
          };

          const name = findKey(['nomi', 'наименование', 'name', 'название', 'tovar', 'product']);
          if (!name) continue;

          const code = String(findKey(['kodi', 'kod', 'код', 'artikul', 'code', 'id', 'sn', 'barcode']) || '').trim();
          const groupExplicit = findKey(['guruh', 'группа', 'group', 'kategoriya', 'category']);
          const cost = parseNum(findKey(['tannarx', 'себестоимост', 'cost', 'вход', 'buy', 'prixody']));
          const sell = parseNum(findKey(['sotish', 'narxi', 'narx', 'цена', 'sell', 'price', 'sotuv']));
          const stk = parseNum(findKey(['sklad', 'остаток', 'soni', 'son', 'qoldiq', 'miqdor', 'stock', 'количество', 'count', 'itog']));
          const minStk = parseNum(findKey(['min', 'zapas', 'minimum', 'limit', 'savdo']));

          const isHeader = (cost === null || cost === undefined) && (sell === null || sell === undefined) && (stk === null || stk === undefined) && !code;
          if (isHeader && !groupExplicit) { inheritedGroup = String(name).trim(); continue; }

          finalProducts.push({
            code: code ? String(code).trim() : null,
            name: String(name).trim(),
            group: groupExplicit ? String(groupExplicit).trim() : inheritedGroup,
            costPrice: parseFloat(cost) || 0,
            sellPrice: parseFloat(sell) || 0,
            stock: parseFloat(stk) || 0,
            minStock: parseFloat(minStk) || 0
          });
        }

        await axios.post(`${API_URL}/products/bulk`, { products: finalProducts });
        fetchProducts();
        alert("Fayl import qilindi!");
      } catch (err) { alert("Xato importda!"); }
      setLoading(false);
    };
    reader.readAsBinaryString(file);
  };

  const deleteProduct = (e, id) => {
    e.stopPropagation();
    if (!window.confirm("O'chirishni tasdiqlaysizmi?")) return;
    axios.delete(`${API_URL}/products/${id}`).then(() => fetchProducts());
  };

  const s = search.toLowerCase();
  const filtered = products.filter(p => 
    String(p.name || '').toLowerCase().includes(s) || 
    String(p.code || '').toLowerCase().includes(s) || 
    String(p.group || '').toLowerCase().includes(s)
  );

  const grouped = filtered.reduce((acc, p) => {
    const g = p.group || 'Boshqa';
    if (!acc[g]) acc[g] = [];
    acc[g].push(p);
    return acc;
  }, {});

  const groups = Object.keys(grouped).sort();

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
        <h2 style={{ margin: 0 }}>📦 {t('products')} <small style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>({products.length})</small></h2>
        <div style={{ display: 'flex', gap: '10px', flex: '1 1 auto', justifyContent: 'flex-end' }}>
          <button onClick={() => { setEditProduct(null); setShowAdd(!showAdd); }} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}><Plus size={16}/> Qo'shish</button>
          <label className="btn btn-secondary" style={{ cursor: 'pointer', padding: '8px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
            <FileUp size={16} /> Excel
            <input type="file" hidden accept=".xlsx,.xls" onChange={handleExcelImport} />
          </label>
        </div>
      </div>

      <div className="card glass-panel" style={{ padding: '12px', marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
         <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', top: '12px', left: '15px', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              className="form-control" 
              style={{ paddingLeft: '45px', background: 'var(--bg-body)', border: 'none', height: '40px' }} 
              placeholder="Qidirish..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
         </div>
         {isAdmin && (
            <button onClick={handleDeleteAll} className="btn" style={{ padding: '10px', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', borderRadius: '12px' }}>
               <Trash2 size={18}/>
            </button>
         )}
      </div>

      {(showAdd || editProduct) && (
        <div className="card glass-panel animate-fade-in" style={{ marginBottom: '25px', padding: '20px', borderLeft: '5px solid var(--primary)' }}>
          <h3>{editProduct ? 'Tahrirlash' : 'Yangi Mahsulot'}</h3>
          <form onSubmit={editProduct ? handleUpdate : handleCreate} className="responsive-grid" style={{ marginTop: '15px' }}>
             <div className="form-group"><label className="form-label">Nomi *</label><input type="text" className="form-control" value={editProduct ? editProduct.name : newProduct.name} onChange={e => editProduct ? setEditProduct({...editProduct, name: e.target.value}) : setNewProduct({...newProduct, name: e.target.value})} required/></div>
             <div className="form-group"><label className="form-label">Guruh</label><input type="text" className="form-control" value={editProduct ? editProduct.group : newProduct.group} onChange={e => editProduct ? setEditProduct({...editProduct, group: e.target.value}) : setNewProduct({...newProduct, group: e.target.value})}/></div>
             <div className="form-group"><label className="form-label">Kodi</label><input type="text" className="form-control" value={editProduct ? editProduct.code : newProduct.code} onChange={e => editProduct ? setEditProduct({...editProduct, code: e.target.value}) : setNewProduct({...newProduct, code: e.target.value})}/></div>
             <div className="form-group"><label className="form-label">Sklad</label><input type="number" className="form-control" value={editProduct ? editProduct.stock : newProduct.stock} onChange={e => editProduct ? setEditProduct({...editProduct, stock: e.target.value}) : setNewProduct({...newProduct, stock: e.target.value})}/></div>
             <div className="form-group"><label className="form-label">Tannarx ($)</label><input type="number" step="0.01" className="form-control" value={editProduct ? editProduct.costPrice : newProduct.costPrice} onChange={e => editProduct ? setEditProduct({...editProduct, costPrice: e.target.value}) : setNewProduct({...newProduct, costPrice: e.target.value})}/></div>
             <div className="form-group"><label className="form-label">Sotish ($)</label><input type="number" step="0.01" className="form-control" value={editProduct ? editProduct.sellPrice : newProduct.sellPrice} onChange={e => editProduct ? setEditProduct({...editProduct, sellPrice: e.target.value}) : setNewProduct({...newProduct, sellPrice: e.target.value})}/></div>
             <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '14px' }}>Saqlash</button>
                <button type="button" onClick={() => { setShowAdd(false); setEditProduct(null); }} className="btn btn-secondary" style={{ flex: 1, padding: '14px' }}>Bekor qilish</button>
             </div>
          </form>
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', marginBottom: '20px', paddingBottom: '10px' }}>
         <button onClick={() => setActiveCategory('ALL')} style={{ 
           whiteSpace: 'nowrap', padding: '8px 18px', borderRadius: '12px', fontWeight: 'bold', fontSize: '0.85rem',
           background: activeCategory === 'ALL' ? 'var(--primary)' : 'var(--bg-card)', color: activeCategory === 'ALL' ? '#fff' : 'var(--text-muted)', border: '1px solid var(--border-color)'
         }}>Barchasi</button>
         {groups.map(g => (
           <button key={g} onClick={() => setActiveCategory(g)} style={{ 
             whiteSpace: 'nowrap', padding: '8px 18px', borderRadius: '12px', fontWeight: 'bold', fontSize: '0.85rem',
             background: activeCategory === g ? 'var(--primary)' : 'var(--bg-card)', color: activeCategory === g ? '#fff' : 'var(--text-muted)', border: '1px solid var(--border-color)'
           }}>{g}</button>
         ))}
      </div>

      {loading ? <div className="card" style={{ textAlign: 'center', padding: '60px' }}>{t('loading')}</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', background: 'var(--border-color)', borderRadius: '16px', overflow: 'hidden' }}>
          {groups.filter(g => activeCategory === 'ALL' || g === activeCategory).map(group => (
            <div key={group} style={{ background: 'var(--bg-card)' }}>
              <div style={{ padding: '10px 16px', background: 'rgba(255,255,255,0.02)', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--primary)', textTransform: 'uppercase' }}>{group}</div>
              {grouped[group].map(p => (
                <div key={p.id} className="compact-list-item" onClick={() => setSelectedProductId(selectedProductId === p.id ? null : p.id)}>
                  <div style={{ flex: 1, display: 'flex', gap: '15px', alignItems: 'center' }}>
                     <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--bg-body)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}><Package size={20} /></div>
                     <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '1rem', fontWeight: '700' }}>{p.name}</span>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '2px' }}>
                           <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{p.code || '—'}</span>
                           <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--primary)' }}>${p.sellPrice} <small style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}> / ${p.costPrice}</small></span>
                        </div>
                     </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                     <div className="stock-badge" style={{ border: p.stock <= p.minStock ? '1px solid var(--danger)' : '1px solid transparent' }}>
                        <span className="count" style={{ color: p.stock <= p.minStock ? 'var(--danger)' : 'inherit' }}>{p.stock}</span>
                        <span className="unit">Dona</span>
                     </div>
                     {isAdmin && selectedProductId === p.id && (
                        <div className="animate-fade-in" style={{ display: 'flex', gap: '8px' }}>
                           <button onClick={(e) => { e.stopPropagation(); setEditProduct(p); setShowAdd(true); window.scrollTo(0,0); }} className="btn-icon"><Edit2 size={16}/></button>
                           <button onClick={(e) => deleteProduct(e, p.id)} className="btn-icon" style={{ color: 'var(--danger)' }}><Trash2 size={16}/></button>
                        </div>
                     )}
                  </div>
                </div>
              ))}
            </div>
          ))}
          {filtered.length === 0 && <div style={{ textAlign: 'center', padding: '60px', background: 'var(--bg-card)' }}>Mahsulot topilmadi.</div>}
        </div>
      )}
    </div>
  );
}
