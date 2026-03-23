import { useState } from 'react';
import axios from 'axios';
import { API_URL } from '../constants';
import { useAuth } from '../context/AuthContext';
import { Settings as SettingsIcon, Shield, RefreshCw } from 'lucide-react';

export default function Settings() {
  const { user, login } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const updatePassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 4) return alert("Parol juda qisqa!");
    setLoading(true);
    try {
      await axios.put(`${API_URL}/admin/agents/${user.id}`, { password: newPassword });
      alert("Parol o'zgartirildi!");
      setNewPassword('');
    } catch (err) {
      alert("Xato: O'zgartirib bo'lmadi");
    }
    setLoading(false);
  };

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', gap: '20px', alignItems: 'start' }}>
        <div className="card" style={{ flex: 1, maxWidth: '500px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <SettingsIcon color="var(--primary)" /> Shaxsiy Sozlamalar
          </h3>
          
          <form onSubmit={updatePassword}>
            <div className="form-group">
              <label>Yangi Parol o'rnatish</label>
              <div style={{ position: 'relative' }}>
                <Shield size={18} style={{ position: 'absolute', top: '12px', left: '15px', color: 'var(--text-muted)' }} />
                <input 
                  type="password" 
                  className="form-control" 
                  style={{ paddingLeft: '45px' }}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Yangi parol..."
                  required
                />
              </div>
            </div>
            
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ marginTop: '10px' }}>
              <RefreshCw size={16} /> Parolni Yangilash
            </button>
          </form>
          
          <div style={{ marginTop: '30px', padding: '15px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Eslatma: Administrator barcha agentlarning parolini "Agentlar" bo'limidan ham yangilashi mumkin.
          </div>
        </div>
      </div>
    </div>
  );
}
