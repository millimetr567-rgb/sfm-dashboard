import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../constants';
import { useAuth } from '../context/AuthContext';
import { 
  Settings as SettingsIcon, MessageSquare, Send, Save, 
  Info, Smartphone, User, Shield, RefreshCw 
} from 'lucide-react';

export default function Settings() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('telegram');
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    telegramToken: '',
    chatId1: '',
    chatId2: '',
    chatId3: '',
    templateKassa: '',
    templateChek: '',
    templateQarz: '',
    templateBirthday: ''
  });

  const [passwordForm, setPasswordForm] = useState({ newPassword: '' });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await axios.get(`${API_URL}/settings`);
      if (res.data) setSettings(res.data);
    } catch (err) {
      console.error("Settings fetch error", err);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API_URL}/settings`, settings);
      alert("Sozlamalar saqlandi!");
    } catch (err) {
      alert("Xato: Saqlab bo'lmadi");
    }
    setLoading(false);
  };

  const updatePassword = async (e) => {
    e.preventDefault();
    if (!passwordForm.newPassword || passwordForm.newPassword.length < 4) return alert("Parol juda qisqa!");
    setLoading(true);
    try {
      await axios.put(`${API_URL}/admin/agents/${user.id}`, { password: passwordForm.newPassword });
      alert("Parol o'zgartirildi!");
      setPasswordForm({ newPassword: '' });
    } catch (err) {
      alert("Xato: O'zgartirib bo'lmadi");
    }
    setLoading(false);
  };

  const tabs = [
    { id: 'telegram', label: 'Telegram', icon: <Send size={18} /> },
    { id: 'templates', label: 'SMS Shablonlari', icon: <MessageSquare size={18} /> },
    { id: 'account', label: 'Shaxsiy Account', icon: <User size={18} /> },
  ];

  const inputStyle = {
    background: '#1A1A1A',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#fff',
    padding: '12px 15px',
    borderRadius: '10px',
    width: '100%',
    fontSize: '0.9rem'
  };

  const textareaStyle = {
      ...inputStyle,
      minHeight: '100px',
      resize: 'vertical',
      fontFamily: 'monospace'
  };

  return (
    <div className="animate-fade-in" style={{ 
        background: '#0D0D0D', 
        minHeight: '80vh', 
        borderRadius: '20px',
        display: 'flex',
        flexDirection: 'column',
        color: '#fff',
        overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{ padding: '25px 30px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '15px' }}>
         <div style={{ background: 'var(--primary)', padding: '10px', borderRadius: '12px' }}>
            <SettingsIcon size={24} color="#fff" />
         </div>
         <div>
            <h2 style={{ margin: 0 }}>Sozlamalar</h2>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>Tizim, xabarnoma va shablonlar boshqaruvi</p>
         </div>
      </div>

      <div style={{ display: 'flex', flex: 1 }}>
        {/* Left Sidebar Menu */}
        <div style={{ width: '250px', borderRight: '1px solid rgba(255,255,255,0.05)', padding: '20px 10px' }}>
           <ul style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {tabs.map(tab => (
                <li key={tab.id}>
                    <button 
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px 15px',
                            borderRadius: '12px',
                            background: activeTab === tab.id ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                            color: activeTab === tab.id ? 'var(--primary)' : 'rgba(255,255,255,0.6)',
                            fontWeight: activeTab === tab.id ? '600' : '400',
                            textAlign: 'left'
                        }}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                </li>
              ))}
           </ul>
        </div>

        {/* Right Form Content */}
        <div style={{ flex: 1, padding: '30px', maxWidth: '800px' }}>
           {activeTab === 'telegram' && (
             <form onSubmit={handleSaveSettings} className="animate-fade-in">
                <section style={{ marginBottom: '30px' }}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', color: 'var(--primary)' }}>
                        <Send size={20} /> SMS va Telegram sozlamalari
                    </h4>

                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', padding: '15.5px', borderRadius: '12px', marginBottom: '25px', color: 'var(--danger)', fontSize: '0.9rem', fontWeight: '500' }}>
                        <strong>IMPORTANT Action Required:</strong> Since the Chat ID changed, please go to the "SMS va Telegram sozlamalari" section in the Admin panel and update the Chat IDs. You can find the new ID by sending /start to the bot in your group.
                    </div>
                    
                    <div className="form-group" style={{ marginBottom: '25px' }}>
                        <label className="form-label" style={{ color: 'rgba(255,255,255,0.7)' }}>Telegram Bot Token (Majburiy)</label>
                        <input 
                            type="text" 
                            style={inputStyle}
                            value={settings.telegramToken || ''}
                            onChange={e => setSettings({...settings, telegramToken: e.target.value})}
                            placeholder="7123456789:AAE-Example-Token..."
                            required
                        />
                        <p style={{ fontSize: '0.75rem', marginTop: '5px', color: 'rgba(255,255,255,0.4)' }}>BotFather orqali olingan token</p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                         <div className="form-group">
                            <label className="form-label">Chat ID 1</label>
                            <input 
                                type="text"
                                style={inputStyle}
                                value={settings.chatId1 || ''}
                                onChange={e => setSettings({...settings, chatId1: e.target.value})}
                                placeholder="-100..."
                            />
                         </div>
                         <div className="form-group">
                            <label className="form-label">Chat ID 2</label>
                            <input 
                                type="text"
                                style={inputStyle}
                                value={settings.chatId2 || ''}
                                onChange={e => setSettings({...settings, chatId2: e.target.value})}
                                placeholder="Optional"
                            />
                         </div>
                         <div className="form-group">
                            <label className="form-label">Chat ID 3</label>
                            <input 
                                type="text"
                                style={inputStyle}
                                value={settings.chatId3 || ''}
                                onChange={e => setSettings({...settings, chatId3: e.target.value})}
                                placeholder="Optional"
                            />
                         </div>
                    </div>
                </section>
                
                <button type="submit" disabled={loading} className="btn btn-primary" style={{ padding: '12px 30px' }}>
                    <Save size={18} /> Saqlash
                </button>
             </form>
           )}

           {activeTab === 'templates' && (
             <form onSubmit={handleSaveSettings} className="animate-fade-in">
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', color: 'var(--primary)' }}>
                    <MessageSquare size={20} /> SMS va Xabarnoma Shablonlari
                </h4>

                <div style={{ background: 'rgba(99, 102, 241, 0.05)', border: '1px dashed var(--primary)', padding: '15px', borderRadius: '12px', marginBottom: '25px', display: 'flex', gap: '12px' }}>
                    <Info size={24} color="var(--primary)" style={{ flexShrink: 0 }} />
                    <div style={{ fontSize: '0.85rem' }}>
                        <strong>Dinamik o'zgaruvchilar:</strong><br/>
                        <code style={{ color: 'var(--secondary)' }}>@name</code> - Mijoz ismi, 
                        <code style={{ color: 'var(--secondary)' }}>@cur_sum</code> - Qarz summasi, 
                        <code style={{ color: 'var(--secondary)' }}>@days</code> - Muddati o'tgan kunlar
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div className="form-group">
                        <label className="form-label">SMS Kassa</label>
                        <textarea 
                            style={textareaStyle} 
                            value={settings.templateKassa || ''} 
                            onChange={e => setSettings({...settings, templateKassa: e.target.value})}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">SMS Chek</label>
                        <textarea 
                            style={textareaStyle} 
                            value={settings.templateChek || ''} 
                            onChange={e => setSettings({...settings, templateChek: e.target.value})}
                        />
                    </div>
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <label className="form-label">SMS Qarzdorlik (Eng muhim)</label>
                        <textarea 
                            style={textareaStyle} 
                            value={settings.templateQarz || ''} 
                            onChange={e => setSettings({...settings, templateQarz: e.target.value})}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">SMS Tug'ilgan kun</label>
                        <textarea 
                            style={textareaStyle} 
                            value={settings.templateBirthday || ''} 
                            onChange={e => setSettings({...settings, templateBirthday: e.target.value})}
                        />
                    </div>
                </div>

                <button type="submit" disabled={loading} className="btn btn-primary" style={{ marginTop: '20px', padding: '12px 30px' }}>
                    <Save size={18} /> Saqlash
                </button>
             </form>
           )}

           {activeTab === 'account' && (
              <div className="animate-fade-in" style={{ maxWidth: '500px' }}>
                 <h4 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', color: 'var(--primary)' }}>
                    <Shield size={20} /> Akkaunt Xavfsizligi
                 </h4>
                 
                 <form onSubmit={updatePassword}>
                    <div className="form-group">
                       <label className="form-label">Yangi Parol o'rnatish</label>
                       <input 
                         type="password" 
                         className="form-control" 
                         style={inputStyle}
                         value={passwordForm.newPassword}
                         onChange={e => setPasswordForm({newPassword: e.target.value})}
                         placeholder="Kamida 4 ta belgi..."
                         required
                       />
                    </div>
                    
                    <button type="submit" disabled={loading} className="btn btn-secondary" style={{ marginTop: '10px', borderColor: 'var(--primary)', color: 'var(--primary)' }}>
                       <RefreshCw size={16} /> Parolni Yangilash
                    </button>
                 </form>
              </div>
           )}
        </div>
      </div>
    </div>
  );
}
