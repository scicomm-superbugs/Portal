import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Users, Briefcase, Bell, UserCircle, Search, Trophy, Shield, MessageCircle, Calendar, AlertTriangle, Menu, Moon, Sun, Building2, Video } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLiveCollection } from '../db';
import { useState, useEffect, useRef } from 'react';
import { AVATARS } from './scicommConstants';
import '../scicomm.css';

export default function SciCommLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  const scientists = useLiveCollection('scientists');
  const me = scientists?.find(s => String(s.id) === String(user.id));

  const tasksData = useLiveCollection('tasks') || [];
  const warningsData = useLiveCollection('scicomm_warnings') || [];
  const pendingAccounts = (scientists || []).filter(s => s.accountStatus === 'pending');
  const chatMessages = useLiveCollection('scicomm_chat_messages') || [];
  const meetingsData = useLiveCollection('scicomm_meetings') || [];
  
  const myPendingTasks = tasksData.filter(t => String(t.assignedTo) === String(user.id) && t.status !== 'Completed' && t.status !== 'Approved');
  const myWarnings = warningsData.filter(w => String(w.userId) === String(user.id) && !w.seen);
  
  const upcomingMeetings = meetingsData.filter(m => ((m.members || []).includes(user.id) || m.allMembers) && new Date(m.date) >= new Date(new Date().toDateString()));
  
  const isAdmin = user.role === 'admin' || user.role === 'master';

  const notifCount = myWarnings.length + (isAdmin ? pendingAccounts.length : 0);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(localStorage.getItem('scicommDarkMode') === 'true');
  const connectionsData = useLiveCollection('scicomm_connections') || [];
  const pendingConnections = connectionsData.filter(c => c.status === 'pending' && String(c.toId) === String(user.id));

  // Push notifications
  const prevTaskCount = useRef(myPendingTasks.length);
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  }, []);
  useEffect(() => {
    if (myPendingTasks.length > prevTaskCount.current && Notification.permission === 'granted') {
      new Notification('📋 New Task Assigned!', { body: myPendingTasks[0]?.title, icon: './aiu_scicomm_logo.png' });
    }
    prevTaskCount.current = myPendingTasks.length;
  }, [myPendingTasks.length]);

  const prevWarningCount = useRef(myWarnings.length);
  useEffect(() => {
    if (myWarnings.length > prevWarningCount.current && Notification.permission === 'granted') {
      new Notification('⚠️ Warning Received', { body: myWarnings[0]?.message, icon: './aiu_scicomm_logo.png' });
    }
    prevWarningCount.current = myWarnings.length;
  }, [myWarnings.length]);

  const toggleDarkMode = () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    localStorage.setItem('scicommDarkMode', next);
  };

  const handleLogout = () => { logout(); navigate('/login'); };
  const isActive = (path) => location.pathname === path;

  const renderAvatar = (size = 24) => {
    if (me?.avatar) return <img src={me.avatar} alt="Me" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />;
    const av = AVATARS.find(a => a.id === me?.avatarId);
    if (av) return <div style={{ width: size, height: size, borderRadius: '50%', background: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.5 }}>{av.svg}</div>;
    return <UserCircle size={size} />;
  };

  const PLATFORM_VERSION = 'v3.4.1';
  const [showChangelog, setShowChangelog] = useState(() => {
    const seen = localStorage.getItem('scicomm_version_seen');
    return seen !== PLATFORM_VERSION;
  });
  const dismissChangelog = () => {
    localStorage.setItem('scicomm_version_seen', PLATFORM_VERSION);
    setShowChangelog(false);
  };

  useEffect(() => {
    const handler = () => setShowChangelog(true);
    window.addEventListener('show-changelog', handler);
    return () => window.removeEventListener('show-changelog', handler);
  }, []);

  return (
    <div className={`scicomm-app ${isDarkMode ? 'scicomm-dark-mode' : ''}`}>
      <header className="scicomm-header">
        <div className="scicomm-header-content">
          <div className="scicomm-header-left">
            <Link to="/"><img src={isDarkMode ? "./aiu_scicomm_dark.png" : "./aiu_scicomm_light.png"} alt="AIU SciComm" className="scicomm-logo" onError={e => e.target.style.display='none'} /></Link>
            <div className="scicomm-search-box"><Search size={16} /><input type="text" placeholder="Search people..." value={searchText} onChange={e => setSearchText(e.target.value)} onKeyDown={e => { if(e.key === 'Enter' && searchText.trim()) { navigate('/network?q=' + encodeURIComponent(searchText)); setSearchText(''); } }} /></div>
          </div>
          <nav className="scicomm-nav">
            <Link to="/" className={`scicomm-nav-item ${isActive('/') ? 'active' : ''}`}><Home size={20} /><span className="nav-text">Home</span></Link>
            <Link to="/network" className={`scicomm-nav-item ${isActive('/network') ? 'active' : ''}`} style={{position:'relative'}}><Users size={20} />{pendingConnections.length > 0 && <span className="scicomm-notif-badge">{pendingConnections.length}</span>}<span className="nav-text">Network</span></Link>
            <Link to="/tasks" className={`scicomm-nav-item ${isActive('/tasks') ? 'active' : ''}`} style={{position:'relative'}}><Briefcase size={20} />{myPendingTasks.length > 0 && <span className="scicomm-notif-badge">{myPendingTasks.length}</span>}<span className="nav-text">Tasks</span></Link>
            <Link to="/calendar" className={`scicomm-nav-item ${isActive('/calendar') ? 'active' : ''}`} style={{position:'relative'}}><Calendar size={20} />{upcomingMeetings.length > 0 && <span className="scicomm-notif-badge">{upcomingMeetings.length}</span>}<span className="nav-text">Calendar</span></Link>
            <Link to="/meetings" className={`scicomm-nav-item ${isActive('/meetings') ? 'active' : ''}`}><Video size={20} /><span className="nav-text">Meetings</span></Link>
            <Link to="/chat" className={`scicomm-nav-item ${isActive('/chat') ? 'active' : ''}`}><MessageCircle size={20} /><span className="nav-text">Chat</span></Link>
            <Link to="/leaderboard" className={`scicomm-nav-item ${isActive('/leaderboard') ? 'active' : ''}`}><Trophy size={20} /><span className="nav-text">Leaderboard</span></Link>
            <Link to="/notifications" className={`scicomm-nav-item ${isActive('/notifications') ? 'active' : ''}`} style={{position:'relative'}}><Bell size={20} />{notifCount > 0 && <span className="scicomm-notif-badge">{notifCount}</span>}<span className="nav-text">Alerts</span></Link>
            
            <div className="scicomm-nav-item profile-dropdown-container">
              {renderAvatar(24)}
              <span className="nav-text">Me ▼</span>
              <div className="scicomm-dropdown">
                <div style={{padding:'12px 16px', borderBottom:'1px solid #e0dfdc'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                    {renderAvatar(44)}
                    <div>
                      <div style={{fontWeight:600,fontSize:'14px'}}>{user.name}</div>
                      <div style={{fontSize:'12px',color:'rgba(0,0,0,0.6)'}}>{me?.department || 'Member'}</div>
                    </div>
                  </div>
                  <Link to="/profile" className="scicomm-btn-secondary" style={{marginTop:'8px',display:'block',textAlign:'center',textDecoration:'none',padding:'4px 12px',fontSize:'13px'}}>View Profile</Link>
                </div>
                {isAdmin && <Link to="/admin" className="dropdown-item" style={{display:'flex',alignItems:'center',gap:'8px'}}><Shield size={16} /> Admin Dashboard {pendingAccounts.length > 0 && <span className="scicomm-notif-badge" style={{position:'static'}}>{pendingAccounts.length}</span>}</Link>}
                <button onClick={toggleDarkMode} className="dropdown-item" style={{display:'flex',alignItems:'center',gap:'8px'}}>
                  {isDarkMode ? <Sun size={16} /> : <Moon size={16} />} {isDarkMode ? 'Light Mode' : 'Dark Mode'}
                </button>
                <button onClick={() => { localStorage.removeItem('workspaceId'); window.location.href = '#/portal'; }} className="dropdown-item" style={{display:'flex',alignItems:'center',gap:'8px'}}>
                  <Building2 size={16} /> Switch Hub
                </button>
                <div className="dropdown-divider"></div>
                <button onClick={handleLogout} className="dropdown-item">Sign Out</button>
              </div>
            </div>
          </nav>
        </div>
      </header>

      <div className="scicomm-page-content">
        <div style={{ minHeight: 'calc(100vh - 300px)' }}>
          <Outlet />
        </div>
        
        {/* FOOTER */}
        {/* Footer Removed - Now relocated to Portal.jsx */}
      </div>

      <nav className="scicomm-mobile-bar" style={{ overflowX: 'auto', justifyContent: 'flex-start', paddingLeft: '8px', paddingRight: '8px' }}>
        <style>{`.scicomm-mobile-bar::-webkit-scrollbar { display: none; }`}</style>
        <Link to="/" className={`scicomm-mobile-item ${isActive('/') ? 'active' : ''}`}><Home size={20} /><span>Home</span></Link>
        <Link to="/calendar" className={`scicomm-mobile-item ${isActive('/calendar') ? 'active' : ''}`} style={{position:'relative'}}><Calendar size={20} />{upcomingMeetings.length > 0 && <span className="scicomm-notif-badge">{upcomingMeetings.length}</span>}<span>Calendar</span></Link>
        <Link to="/meetings" className={`scicomm-mobile-item ${isActive('/meetings') ? 'active' : ''}`}><Video size={20} /><span>Meetings</span></Link>
        <Link to="/tasks" className={`scicomm-mobile-item ${isActive('/tasks') ? 'active' : ''}`} style={{position:'relative'}}><Briefcase size={20} />{myPendingTasks.length > 0 && <span className="scicomm-notif-badge">{myPendingTasks.length}</span>}<span>Tasks</span></Link>
        <Link to="/chat" className={`scicomm-mobile-item ${isActive('/chat') ? 'active' : ''}`}><MessageCircle size={20} /><span>Chat</span></Link>
        <Link to="/network" className={`scicomm-mobile-item ${isActive('/network') ? 'active' : ''}`} style={{position:'relative'}}><Users size={20} />{pendingConnections.length > 0 && <span className="scicomm-notif-badge">{pendingConnections.length}</span>}<span>Network</span></Link>
        <Link to="/notifications" className={`scicomm-mobile-item ${isActive('/notifications') ? 'active' : ''}`} style={{position:'relative'}}><Bell size={20} />{notifCount > 0 && <span className="scicomm-notif-badge">{notifCount}</span>}<span>Alerts</span></Link>
        <Link to="/profile" className={`scicomm-mobile-item ${isActive('/profile') ? 'active' : ''}`}>{renderAvatar(20)}<span>Me</span></Link>
        {isAdmin && <Link to="/admin" className={`scicomm-mobile-item ${isActive('/admin') ? 'active' : ''}`}><Shield size={20} /><span>Admin</span></Link>}
      </nav>

      {/* Version Changelog Popup */}
      {showChangelog && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '28px', maxWidth: '480px', width: '100%', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '48px', marginBottom: '8px' }}>🚀</div>
              <h2 style={{ margin: '0 0 4px', fontSize: '22px' }}>What's New in {PLATFORM_VERSION}</h2>
              <p style={{ margin: 0, color: 'rgba(0,0,0,0.5)', fontSize: '13px' }}>SciComm Platform Update</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              <div style={{ background: '#eff6ff', padding: '14px', borderRadius: '10px' }}>
                <h4 style={{ margin: '0 0 6px', color: '#1e3a8a', fontSize: '14px' }}>✨ New Features</h4>
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#1e3a8a', lineHeight: '1.8' }}>
                  <li><strong>Reply Reactions:</strong> 👍❤️🔥 React to replies with Like, Love, or Fire — just like comments!</li>
                  <li><strong>Emoji Picker Stays Open:</strong> Select multiple emojis without the picker closing each time.</li>
                </ul>
              </div>
              <div style={{ background: '#fef3c7', padding: '14px', borderRadius: '10px' }}>
                <h4 style={{ margin: '0 0 6px', color: '#92400e', fontSize: '14px' }}>🔧 Fixes & Improvements</h4>
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#92400e', lineHeight: '1.8' }}>
                  <li>Fixed: Only post owners and admins/masters can edit or delete posts now</li>
                  <li>Fixed: Post impressions now count 1 per unique viewer (reactions + commenters)</li>
                  <li>Fixed: Emoji picker no longer auto-closes after selecting one emoji</li>
                </ul>
              </div>
              <div style={{ background: '#dbeafe', padding: '14px', borderRadius: '10px' }}>
                <h4 style={{ margin: '0 0 6px', color: '#1e3a8a', fontSize: '14px' }}>🎨 UI & Experience</h4>
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#1e3a8a', lineHeight: '1.8' }}>
                  <li>Reply reaction bar matches comment reaction bar styling</li>
                  <li>Reaction counts appear next to each emoji on replies</li>
                  <li>Impressions metric is now accurate and meaningful</li>
                </ul>
              </div>
            </div>
            <button onClick={dismissChangelog} className="scicomm-btn-primary" style={{ width: '100%', padding: '14px', justifyContent: 'center', fontSize: '16px', fontWeight: 700 }}>Got It! 🎉</button>
          </div>
        </div>
      )}
    </div>
  );
}
