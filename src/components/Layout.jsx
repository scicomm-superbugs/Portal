import { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link, Outlet } from 'react-router-dom';
import { Beaker, Users, Home, LogOut, Shield, User, Monitor, ClipboardList, MessageSquare, Crown, Menu, X, Search, FilePlus2, Settings, Package, Moon, Sun, Building2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLiveCollection } from '../db';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    
    // Set proper document title
    const workspaceId = localStorage.getItem('workspaceId');
    document.title = workspaceId === 'alamein' ? 'Alamein International University' : 'AIU SciComm Team';
  }, [theme]);
  
  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };
  
  const scientists = useLiveCollection('scientists');
  const currentUserData = scientists?.find(s => String(s.id) === String(user?.id));
  const messages = useLiveCollection('messages');
  const tasks = useLiveCollection('tasks');
  const usageLogs = useLiveCollection('usage_logs');

  // Calculate notifications
  const hasUnreadChats = messages?.some(m => 
    (String(m.receiverId) === String(user?.id) || m.receiverId === 'global') && 
    new Date(m.timestamp) > new Date(currentUserData?.lastReadChat || 0) &&
    String(m.senderId) !== String(user?.id)
  );

  const hasPendingTasks = tasks?.some(t => 
    String(t.assignedTo) === String(user?.id) && 
    (t.status === 'Pending' || t.status === 'In Progress')
  );

  const hasOverdueItems = usageLogs?.some(log => 
    String(log.scientistId) === String(user?.id) && 
    log.status === 'In Use' && 
    new Date(log.expectedReturnDate) < new Date()
  );

  const hasProfileAlert = currentUserData?.points > (currentUserData?.lastSeenPoints || 0);

  const isActive = (path) => {
    return location.pathname === path ? 'active' : '';
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleNavClick = () => {
    setMobileNavOpen(false);
  };

  // Ensure user exists before rendering
  if (!user) return null;

  const isAdminUser = user.role === 'admin' || user.role === 'master';

  return (
    <>
      <header className="app-header">
        <div className="container header-content">
          <div className="logo-container">
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <img src="./alamein_logo_2.png" alt="Alamein Logo" style={{ height: '48px', objectFit: 'contain' }} onError={(e) => { e.target.style.display = 'none'; }} />
            </div>
          </div>
          <button className="hamburger-btn" onClick={() => setMobileNavOpen(!mobileNavOpen)}>
            {mobileNavOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          {mobileNavOpen && <div className="mobile-nav-overlay open" onClick={() => setMobileNavOpen(false)} />}
          
          {/* Desktop Navigation */}
          <nav className={`nav-links ${mobileNavOpen ? 'mobile-open' : ''}`}>
            <Link to="/" className={`nav-link ${isActive('/')}`} onClick={handleNavClick}>
              <Home size={20} />
              <span>Dashboard</span>
            </Link>
            
            {isAdminUser && (
              <>
                <Link to="/devices" className={`nav-link ${isActive('/devices')}`} onClick={handleNavClick}>
                  <Monitor size={20} />
                  <span>Devices</span>
                </Link>
                <Link to="/equipment" className={`nav-link ${isActive('/equipment')}`} onClick={handleNavClick}>
                  <Package size={20} />
                  <span>Equipment</span>
                </Link>
                <Link to="/chemicals" className={`nav-link ${isActive('/chemicals')}`} onClick={handleNavClick}>
                  <Beaker size={20} />
                  <span>Chemicals</span>
                </Link>
                <Link to="/scientists" className={`nav-link ${isActive('/scientists')}`} onClick={handleNavClick}>
                  <Users size={20} />
                  <span>Scientists</span>
                </Link>
              </>
            )}
            
            <Link to="/tracking" className={`nav-link ${isActive('/tracking')}`} onClick={handleNavClick} style={{ position: 'relative' }}>
              <FilePlus2 size={20} />
              <span>Register</span>
              {hasOverdueItems && <div style={{ position: 'absolute', top: '8px', left: '8px', width: '8px', height: '8px', backgroundColor: 'var(--accent)', borderRadius: '50%' }}></div>}
            </Link>

            <Link to="/tasks" className={`nav-link ${isActive('/tasks')}`} onClick={handleNavClick} style={{ position: 'relative' }}>
              <ClipboardList size={20} />
              <span>Tasks</span>
              {hasPendingTasks && <div style={{ position: 'absolute', top: '8px', left: '8px', width: '8px', height: '8px', backgroundColor: 'var(--accent)', borderRadius: '50%' }}></div>}
            </Link>

            <Link to="/chat" className={`nav-link ${isActive('/chat')}`} onClick={handleNavClick} style={{ position: 'relative' }}>
              <MessageSquare size={20} />
              <span>Chat</span>
              {hasUnreadChats && <div style={{ position: 'absolute', top: '8px', left: '8px', width: '8px', height: '8px', backgroundColor: 'var(--accent)', borderRadius: '50%' }}></div>}
            </Link>

            <Link to="/team" className={`nav-link ${isActive('/team')}`} onClick={handleNavClick}>
              <Search size={20} />
              <span>Team</span>
            </Link>
            
            <div className="user-controls" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto', flexShrink: 0 }}>
              <button 
                onClick={toggleTheme} 
                className="btn btn-secondary" 
                style={{ padding: '0.4rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: 'var(--text-muted)' }}
                title="Toggle Dark Mode"
              >
                {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
              </button>
              
              <div className="nav-divider" style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', margin: '0 0.25rem' }}></div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem' }}>
                <Link to="/profile" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: 'inherit', position: 'relative' }} onClick={handleNavClick}>
                  {hasProfileAlert && <div style={{ position: 'absolute', top: '-2px', left: '-2px', width: '10px', height: '10px', backgroundColor: 'var(--accent)', borderRadius: '50%', border: '2px solid var(--surface)', zIndex: 10 }}></div>}
                  {currentUserData?.avatar ? (
                    <img src={currentUserData.avatar} alt="Avatar" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', flexShrink: 0 }}>
                      <User size={14} />
                    </div>
                  )}
                  <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</span>
                    {user.role === 'admin' && <Shield size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} title="Admin" />}
                    {user.role === 'master' && <Crown size={14} style={{ color: '#F6E05E', flexShrink: 0 }} title="Lab Master" />}
                  </span>
                </Link>
              </div>
              <button onClick={() => { handleLogout(); handleNavClick(); }} className="btn btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <LogOut size={16} /> Logout
              </button>
            </div>
          </nav>
        </div>
      </header>

      <main className="container page-content">
        <Outlet />
      </main>

      {!location.pathname.includes('/chat') && (
        <footer className="app-footer" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '2rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <img src="./alamein_logo_2.png" alt="Alamein" style={{ height: '40px', objectFit: 'contain' }} onError={(e) => { e.target.style.display = 'none'; }} />
          <div style={{ fontWeight: 'bold', color: 'var(--text)' }}>Alamein International University</div>
        </div>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          <p>Management System &copy; {new Date().getFullYear()}</p>
          <p>Made by Abdullah Amr Maged</p>
        </div>
      </footer>
      )}

      {/* Mobile Bottom Tab Bar */}
      <nav className="mobile-bottom-bar">
        <Link to="/" className={`bottom-tab ${isActive('/')}`}>
          <Home size={20} />
          <span>Home</span>
        </Link>
        <Link to="/tracking" className={`bottom-tab ${isActive('/tracking')}`} style={{ position: 'relative' }}>
          <FilePlus2 size={20} />
          {hasOverdueItems && <div style={{ position: 'absolute', top: '4px', right: '12px', width: '8px', height: '8px', backgroundColor: 'var(--accent)', borderRadius: '50%' }}></div>}
          <span>Register</span>
        </Link>
        <Link to="/chat" className={`bottom-tab ${isActive('/chat')}`} style={{ position: 'relative' }}>
          <MessageSquare size={20} />
          {hasUnreadChats && <div style={{ position: 'absolute', top: '4px', right: '12px', width: '8px', height: '8px', backgroundColor: 'var(--accent)', borderRadius: '50%' }}></div>}
          <span>Chat</span>
        </Link>
        <Link to="/team" className={`bottom-tab ${isActive('/team')}`}>
          <Search size={20} />
          <span>Team</span>
        </Link>
        <Link to="/profile" className={`bottom-tab ${isActive('/profile')}`} style={{ position: 'relative' }}>
          {hasProfileAlert && <div style={{ position: 'absolute', top: '4px', right: '12px', width: '8px', height: '8px', backgroundColor: 'var(--accent)', borderRadius: '50%', border: '2px solid var(--surface)', zIndex: 10 }}></div>}
          {currentUserData?.avatar ? (
            <img src={currentUserData.avatar} alt="" style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <User size={20} />
          )}
          <span>Profile</span>
        </Link>
      </nav>
    </>
  );
}
