import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL, TRANSLATE_ACTION } from '../constants';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { UserPlus, Save, Trash2, List, ShieldAlert } from 'lucide-react';

export default function Agents() {
  const [agents, setAgents] = useState([]);
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('agents'); // 'agents' or 'logs'
  const { user } = useAuth();
  const { t } = useTranslation();
  
  // New Agent Form
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('AGENT');
  const [newPermissions, setNewPermissions] = useState(['kassa', 'order', 'debt', 'product', 'crm', 'history']);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAgents();
    fetchLogs();
  }, []);

  const fetchAgents = () => {
    axios.get(`${API_URL}/admin/agents`).then(r => setAgents(r.data));
  };

  const fetchLogs = () => {
    axios.get(`${API_URL}/admin/logs`).then(r => setLogs(r.data));
  };

  const addAgent = async (e) => {
    e.preventDefault();
    if (!newUsername || !newPassword) return alert("Hamma ma'lumotlar kiritilsin!");
    setLoading(true);
    try {
      await axios.post(`${API_URL}/admin/agents`, { 
        username: newUsername, 
        password: newPassword, 
        role: newRole,
        permissions: newPermissions.join(',')
      });
      alert(t('action_save'));
      fetchAgents();
      setNewUsername(''); setNewPassword('');
      setNewPermissions(['kassa', 'order', 'debt', 'product', 'crm', 'history']);
    } catch (err) { alert("Xato: " + err.response?.data?.error); }
    setLoading(false);
  };

  const updateAgent = async (id, role, password, permissions) => {
    try {
      await axios.put(`${API_URL}/admin/agents/${id}`, { 
        role, 
        password: password || undefined,
        permissions: permissions || undefined
      });
      alert(t('action_save'));
      fetchAgents();
    } catch (err) { alert("Xato"); }
  };

  const deleteAgent = async (id) => {
    if (!window.confirm(t('action_delete') + "?")) return;
    try {
      await axios.delete(`${API_URL}/admin/agents/${id}`);
      fetchAgents();
    } catch (err) { alert("Xato"); }
  };

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', gap: '20px', marginBottom: '25px', borderBottom: '1px solid rgba(128,128,128,0.1)' }}>
        <button 
          onClick={() => setActiveTab('agents')} 
          style={{ padding: '15px 25px', color: activeTab === 'agents' ? 'var(--primary)' : 'var(--text-muted)', borderBottom: activeTab === 'agents' ? '3px solid var(--primary)' : '3px solid transparent', fontWeight: 'bold' }}>
          {t('agents')}
        </button>
        <button 
          onClick={() => setActiveTab('logs')} 
          style={{ padding: '15px 25px', color: activeTab === 'logs' ? 'var(--primary)' : 'var(--text-muted)', borderBottom: activeTab === 'logs' ? '3px solid var(--primary)' : '3px solid transparent', fontWeight: 'bold' }}>
          {t('system_log')}
        </button>
      </div>

      {activeTab === 'agents' && (
        <div className="responsive-grid">
          <div className="card">
            <h3>{t('add_new')}</h3>
            <form onSubmit={addAgent} style={{ marginTop: '20px' }}>
              <div className="form-group"><label className="form-label">Login</label><input type="text" className="form-control" value={newUsername} onChange={e => setNewUsername(e.target.value)} required /></div>
              <div className="form-group"><label className="form-label">Parol</label><input type="password" className="form-control" value={newPassword} onChange={e => setNewPassword(e.target.value)} required /></div>
              <div className="form-group"><label className="form-label">Rol</label>
                <select className="form-control" value={newRole} onChange={e => setNewRole(e.target.value)}>
                  <option value="AGENT">AGENT</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Huquqlar (Permissions)</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '10px', background: 'var(--input-bg)', borderRadius: '10px' }}>
                  {[
                    { key: 'kassa', label: "Kassa / To'lov" },
                    { key: 'order', label: "Yangi Buyurtma" },
                    { key: 'debt', label: "Qarzdorlik Sverkasi" },
                    { key: 'product', label: "Sklad (Ombor)" },
                    { key: 'crm', label: "Mijozlar" },
                    { key: 'history', label: "Buyurtmalar Tarixi" }
                  ].map(p => (
                    <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={newPermissions.includes(p.key)} 
                        onChange={(e) => {
                          if (e.target.checked) setNewPermissions([...newPermissions, p.key]);
                          else setNewPermissions(newPermissions.filter(x => x !== p.key));
                        }}
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', padding: '15px', marginTop: '10px' }}><UserPlus size={18} /> {loading ? t('loading') : t('action_save')}</button>
            </form>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {agents.map(a => (
              <div key={a.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 20px' }}>
                <div>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {a.username} 
                    <span className={`badge ${a.role === 'ADMIN' ? 'badge-danger' : 'badge-success'}`}>
                        {a.role}
                    </span>
                  </h4>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '5px' }}>ID: {a.id}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '8px' }}>
                    {(a.permissions === 'all' ? ['kassa', 'order', 'debt', 'product', 'crm', 'history'] : (a.permissions || '').split(',')).map(p => {
                        const labels = { kassa: "Kassa", order: "Buyurtma", debt: "Sverka", product: "Sklad", crm: "Mijozlar", history: "Tarix" };
                        return p && <span key={p} style={{ fontSize: '0.65rem', background: 'var(--primary)', color: 'white', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>{labels[p] || p}</span>
                    })}
                  </div>
                </div>
                {user.id !== a.id && (
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <select 
                      className="form-control" 
                      style={{ width: '120px', padding: '10px' }} 
                      value={a.role} 
                      onChange={e => updateAgent(a.id, e.target.value, '')}
                    >
                      <option value="AGENT">AGENT</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                    <button onClick={() => {
                      const p = prompt("Yangi parolni kiriting (bo'sh qolsa o'zgarmaydi):");
                      if (p !== null) updateAgent(a.id, a.role, p, a.permissions);
                    }} className="btn btn-secondary" style={{ padding: '10px' }}>🔐</button>
                    <button onClick={() => {
                        const current = (a.permissions === 'all' ? 'kassa,order,debt,product,crm,history' : (a.permissions || ''));
                        const p = prompt("Huquqlarni kiriting (vergul bilan ajrating: kassa,order,debt,product,crm,history):", current);
                        if (p !== null) updateAgent(a.id, a.role, '', p);
                    }} className="btn btn-secondary" style={{ padding: '10px' }}>🛠️</button>
                    <button onClick={() => deleteAgent(a.id)} className="btn btn-danger" style={{ padding: '10px' }}><Trash2 size={18} /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="card table-container">
          <table className="custom-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>{t('date')}</th>
                <th>{t('actor')}</th>
                <th>{t('action')}</th>
                <th>{t('info')}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(lg => {
                let meta = {};
                try {
                  meta = typeof lg.metadata === 'string' ? JSON.parse(lg.metadata) : (lg.metadata || {});
                } catch(e) { meta = { raw: lg.metadata }; }
                
                const date = new Date(lg.timestamp);
                return (
                  <tr key={lg.id}>
                    <td style={{ fontSize: '0.8rem' }}>{date.toLocaleDateString()} {date.toLocaleTimeString()}</td>
                    <td><b>{lg.actorRole}</b> ({lg.actorId?.substring(0,8) || 'SYS'})</td>
                    <td style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{TRANSLATE_ACTION[lg.action] || lg.action}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {Object.entries(meta).map(([k, v]) => (
                        <div key={k}>{k}: <b>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</b></div>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {logs.length === 0 && <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>{t('loading')}</div>}
        </div>
      )}
    </div>
  );
}
