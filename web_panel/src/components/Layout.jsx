import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { 
  Home, Wallet, ShoppingCart, Users, History, Package, 
  ShieldAlert, Settings, LogOut, Receipt, Menu, X, Moon, Sun, Globe
} from 'lucide-react';

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t, lang, setLang } = useTranslation();
  const isAdmin = user?.role === 'ADMIN';

  const [mobileOpen, setMobileOpen] = useState(false);

  const menuItems = [
    { to: '/', icon: <Home size={20}/>, label: t('dashboard') },
    { to: '/debt', icon: <Wallet size={20}/>, label: t('debt') },
    { to: '/new-order', icon: <ShoppingCart size={20}/>, label: t('new_order') },
    { to: '/crm', icon: <Users size={20}/>, label: t('crm') },
    { to: '/orders', icon: <History size={20}/>, label: t('history') },
    { to: '/products', icon: <Package size={20}/>, label: t('products') },
  ];

  const adminItems = [
    { to: '/agents', icon: <ShieldAlert size={20}/>, label: t('agents') },
    { to: '/cash-register', icon: <Receipt size={20}/>, label: t('cash') },
    { to: '/settings', icon: <Settings size={20}/>, label: t('settings') },
  ];

  const closeSidebar = () => setMobileOpen(false);

  return (
    <div className="app-container">
      {/* Mobile Overlay */}
      <div 
        className={`sidebar-overlay ${mobileOpen ? 'open' : ''}`} 
        onClick={closeSidebar}
      />

      {/* Sidebar */}
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div style={{ padding: '24px', borderBottom: '1px solid rgba(128,128,128,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ color: 'var(--primary)', marginBottom: '4px' }}>SFM Mobile</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)' }}></div>
              {user?.username} ({user?.role})
            </div>
          </div>
          <button className="menu-toggle btn-icon" onClick={closeSidebar}>
            <X size={24} />
          </button>
        </div>
        
        <nav style={{ flex: 1, padding: '20px 0', overflowY: 'auto' }}>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '0 12px' }}>
            {menuItems.map(item => (
              <li key={item.to}>
                <NavLink 
                  to={item.to} 
                  onClick={closeSidebar}
                  style={({ isActive }) => ({
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
                    borderRadius: '8px', color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                    background: isActive ? 'rgba(99,102,241,0.1)' : 'transparent',
                    borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent',
                    fontWeight: isActive ? '600' : '500',
                    transition: 'all 0.2s'
                  })}
                >
                  {item.icon}
                  {item.label}
                </NavLink>
              </li>
            ))}
            
            {isAdmin && (
              <>
                <div style={{ margin: '20px 16px 10px', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '600' }}>
                  {t('admin_panel')}
                </div>
                {adminItems.map(item => (
                  <li key={item.to}>
                    <NavLink 
                      to={item.to} 
                      onClick={closeSidebar}
                      style={({ isActive }) => ({
                        display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
                        borderRadius: '8px', color: isActive ? 'var(--secondary)' : 'var(--text-muted)',
                        background: isActive ? 'rgba(236,72,153,0.1)' : 'transparent',
                        borderLeft: isActive ? '3px solid var(--secondary)' : '3px solid transparent',
                        fontWeight: isActive ? '600' : '500',
                        transition: 'all 0.2s'
                      })}
                    >
                      {item.icon}
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </>
            )}
          </ul>
        </nav>

        <div style={{ padding: '20px', borderTop: '1px solid rgba(128,128,128,0.2)' }}>
          <button onClick={logout} className="btn btn-danger" style={{ width: '100%', justifyContent: 'center' }}>
            <LogOut size={18} /> {t('logout')}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="glass-header" style={{ padding: '20px 30px', position: 'sticky', top: 0, zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button className="menu-toggle btn-icon" onClick={() => setMobileOpen(true)}>
              <Menu size={24} />
            </button>
            <h3 style={{ margin: 0 }}>{t('welcome')}</h3>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--bg-surface)', padding: '5px 10px', borderRadius: '8px', border: 'var(--glass-border)' }}>
              <Globe size={16} color="var(--text-muted)" />
              <select 
                value={lang} 
                onChange={(e) => setLang(e.target.value)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none', cursor: 'pointer', fontFamily: 'Inter' }}
              >
                <option value="uz">UZB</option>
                <option value="ru">RUS</option>
                <option value="en">ENG</option>
              </select>
            </div>
            
            <button onClick={toggleTheme} className="btn-icon">
              {theme === 'dark' ? <Sun size={20} color="#f59e0b" /> : <Moon size={20} color="#6366f1" />}
            </button>
          </div>
        </header>

        <div style={{ padding: '30px', flex: 1 }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
