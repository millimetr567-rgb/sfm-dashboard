import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../constants';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { Search, Plus, Trash2, FileUp, Edit2, ChevronDown, ChevronUp, Box, Package, LayoutGrid, List } from 'lucide-react';
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
      fetchProducts();
    } catch (e) { alert("Xato"); }
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
        const normalized = data.map(row => ({
          code: row['Kodi'] || row['Код'] || null,
          name: row['Nomi'] || row['Наименование'],
          group: row['Guruh'] || row['Группа'] || 'Boshqa',
          costPrice: parseFloat(row['Tannarx'] || row['Себестоимость']) || 0,
          sellPrice: parseFloat(row['Sotish'] || row['Цена']) || 0,
          stock: parseInt(row['Sklad'] || row['Остаток']) || 0
        }));
        await axios.post(`${API_URL}/products/bulk`, { products: normalized });
        fetchProducts();
        alert("Tayyor!");
      } catch (err) { alert("Xato"); }
      setLoading(false);
    };
    reader.readAsBinaryString(file);
  };

  const deleteProduct = (e, id) => {
    e.stopPropagation();
    if (!window.confirm("O'chirishni tasdiqlaysizmi?")) return;
    axios.delete(`${API_URL}/products/${id}`).then(() => fetchProducts());
  };

  // ROBUST SEARCH & GROUPING
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
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
        <h2>📦 {t('products')} <small style={{ color: 'var(--text-muted)' }}>({products.length})</small></h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ position: 'relative', width: '220px' }}>
            <Search size={16} style={{ position: 'absolute', top: '10px', left: '12px', color: 'var(--text-muted)' }} />
            <input type="text" className="form-control" placeholder="Model, guruh yoki kod..." style={{ paddingLeft: '35px', borderRadius: '20px', height: '36px', fontSize: '0.85rem' }} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button onClick={() => setShowAdd(!showAdd)} className="btn btn-primary" style={{ padding: '8px 15px', fontSize: '0.85rem' }}><Plus size={16}/> Qo'shish</button>
          <label className="btn btn-secondary" style={{ cursor: 'pointer', padding: '8px 15px', fontSize: '0.85rem' }}>
            <FileUp size={16} />
            <input type="file" hidden accept=".xlsx,.xls" onChange={handleExcelImport} />
          </label>
        </div>
      </div>

      {(showAdd || editProduct) && (
        <div className="card glass-panel" style={{ marginBottom: '25px', padding: '20px', borderLeft: '5px solid var(--primary)' }}>
          <h3>{editProduct ? 'Tahrirlash' : 'Yangi Mahsulot'}</h3>
          <form onSubmit={editProduct ? handleUpdate : handleCreate} className="responsive-grid" style={{ marginTop: '15px' }}>
             <div className="form-group"><label>Nomi *</label><input type="text" className="form-control" value={editProduct ? editProduct.name : newProduct.name} onChange={e => editProduct ? setEditProduct({...editProduct, name: e.target.value}) : setNewProduct({...newProduct, name: e.target.value})} required/></div>
             <div className="form-group"><label>Guruh (Model)</label><input type="text" className="form-control" value={editProduct ? editProduct.group : newProduct.group} onChange={e => editProduct ? setEditProduct({...editProduct, group: e.target.value}) : setNewProduct({...newProduct, group: e.target.value})} placeholder="Samsung, Honor, Redmi..."/></div>
             <div className="form-group"><label>Kodi</label><input type="text" className="form-control" value={editProduct ? editProduct.code : newProduct.code} onChange={e => editProduct ? setEditProduct({...editProduct, code: e.target.value}) : setNewProduct({...newProduct, code: e.target.value})}/></div>
             <div className="form-group"><label>Sklad (Soni)</label><input type="number" className="form-control" value={editProduct ? editProduct.stock : newProduct.stock} onChange={e => editProduct ? setEditProduct({...editProduct, stock: e.target.value}) : setNewProduct({...newProduct, stock: e.target.value})}/></div>
             <div className="form-group"><label>Tannarx ($)</label><input type="number" step="0.01" className="form-control" value={editProduct ? editProduct.costPrice : newProduct.costPrice} onChange={e => editProduct ? setEditProduct({...editProduct, costPrice: e.target.value}) : setNewProduct({...newProduct, costPrice: e.target.value})}/></div>
             <div className="form-group"><label>Sotish ($)</label><input type="number" step="0.01" className="form-control" value={editProduct ? editProduct.sellPrice : newProduct.sellPrice} onChange={e => editProduct ? setEditProduct({...editProduct, sellPrice: e.target.value}) : setNewProduct({...newProduct, sellPrice: e.target.value})}/></div>
             <div style={{ gridColumn: 'span 2', display: 'flex', gap: '10px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>{editProduct ? 'Yangilash' : 'Saqlash'}</button>
                <button type="button" onClick={() => { setShowAdd(false); setEditProduct(null); }} className="btn btn-secondary" style={{ flex: 1 }}>Bekor qilish</button>
             </div>
          </form>
        </div>
      )}

      {loading ? <div style={{ textAlign: 'center', padding: '40px' }}>{t('loading')}</div> : (
        <div className="table-container card" style={{ padding: '0' }}>
          <table className="custom-table">
            <thead>
              <tr>
                <th>Mahsulot Nomi</th>
                <th>Guruh</th>
                <th>Kod</th>
                <th>Sklad</th>
                <th>Tannarx ($)</th>
                <th>Sotish ($)</th>
                {isAdmin && <th>Amallar</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} onClick={() => setSelectedProductId(p.id)} style={{ background: selectedProductId === p.id ? 'rgba(99,102,241,0.05)' : 'transparent', cursor: 'pointer' }}>
                  <td><div style={{ fontWeight: '600' }}>{p.name}</div></td>
                  <td>{p.group || '—'}</td>
                  <td><code style={{ fontSize: '0.8rem', opacity: 0.7 }}>{p.code || '—'}</code></td>
                  <td>
                    <span className={`badge ${p.stock <= p.minStock ? 'badge-danger' : 'badge-success'}`}>
                      {p.stock} dona
                    </span>
                  </td>
                  <td>${p.costPrice}</td>
                  <td><b style={{ color: 'var(--primary)' }}>${p.sellPrice}</b></td>
                  {isAdmin && (
                    <td>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={(e) => { e.stopPropagation(); setEditProduct(p); }} style={{ color: 'var(--primary)' }}><Edit2 size={16}/></button>
                        <button onClick={(e) => deleteProduct(e, p.id)} style={{ color: 'var(--danger)' }}><Trash2 size={16}/></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {filtered.length === 0 && !loading && <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Mahsulot topilmadi.</div>}
    </div>
  );
}
