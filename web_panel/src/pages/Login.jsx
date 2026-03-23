import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { LogIn, Lock, User } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      setError('');
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login yoki parol xato!');
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at top right, #1e293b, #0f172a)' }}>
      <div className="card glass-panel" style={{ maxWidth: '400px', width: '90%', padding: '40px' }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{ width: '60px', height: '60px', background: 'var(--primary)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px', color: 'white', fontSize: '1.5rem', fontWeight: 'bold' }}>
            SFM
          </div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '5px' }}>SFM Mobile</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{t('welcome')}</p>
        </div>

        {error && (
          <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '20px', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">Login</label>
            <div style={{ position: 'relative' }}>
              <User size={18} style={{ position: 'absolute', top: '12px', left: '15px', color: 'var(--text-muted)' }} />
              <input type="text" className="form-control" style={{ paddingLeft: '45px' }} value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: '25px' }}>
            <label className="form-label">Parol</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', top: '12px', left: '15px', color: 'var(--text-muted)' }} />
              <input type="password" className="form-control" style={{ paddingLeft: '45px' }} value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', height: '48px' }} disabled={loading}>
            {loading ? t('loading') : <><LogIn size={20} /> Tizimga kirish</>}
          </button>
        </form>
      </div>
    </div>
  );
}
