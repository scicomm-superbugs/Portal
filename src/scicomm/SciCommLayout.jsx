import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Users, Briefcase, Bell, UserCircle, Search, Trophy, Shield, MessageCircle, Calendar, AlertTriangle, Menu, Moon, Sun, Building2, Video, Settings, LayoutDashboard, Lock, FolderKanban, Smartphone, Plus, Globe } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLiveCollection } from '../db';
import { safeLocalStorage } from '../utils/safeStorage';
import { useState, useEffect, useRef } from 'react';
import { AVATARS } from './scicommConstants';
import '../scicomm.css';
import SciCommVerificationBadge from './SciCommVerificationBadge';

export default function SciCommLayout() {
  const { user, logout, isBannerDismissed, dismissBanner } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  const scientists = useLiveCollection('scientists');
  const me = scientists?.find(s => String(s.id) === String(user.id));

  const tasksDataRaw = useLiveCollection('tasks');
  const tasksData = tasksDataRaw || [];
  const warningsDataRaw = useLiveCollection('scicomm_warnings');
  const warningsData = warningsDataRaw || [];
  const pendingAccounts = (scientists || []).filter(s => s.accountStatus === 'pending');
  const chatMessagesRaw = useLiveCollection('scicomm_chat_messages');
  const chatMessages = chatMessagesRaw || [];
  const chatRooms = useLiveCollection('scicomm_chat_rooms') || [];
  const meetingsData = useLiveCollection('scicomm_meetings') || [];
  
  const myPendingTasks = tasksData.filter(t => String(t.assignedTo) === String(user.id) && t.status !== 'Completed' && t.status !== 'Approved');
  const myWarnings = warningsData.filter(w => String(w.userId) === String(user.id) && !w.seen);
  
  const upcomingMeetings = meetingsData.filter(m => ((m.members || []).includes(user.id) || m.allMembers) && new Date(m.date) >= new Date(new Date().toDateString()));
  
  // Unread chat messages: messages not sent by me, in rooms I'm in, and not yet read by me
  const myRoomIds = new Set(chatRooms.filter(r => (r.members || []).includes(user.id)).map(r => r.id));
  const unreadChatCount = chatMessages.filter(m => myRoomIds.has(m.roomId) && m.senderId !== user.id && !(m.readBy || []).includes(user.id)).length;

  const isAdmin = user.role === 'admin' || user.role === 'master';
  const isTeam = user.role === 'scicomm' || isAdmin;

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(safeLocalStorage.getItem('scicommDarkMode') === 'true');
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const postsRaw = useLiveCollection('scicomm_posts') || [];
  
  // Calculate stats for sidebar
  const profileViewers = me?.profileViews || 0;
  const myPosts = postsRaw.filter(p => String(p.authorId) === String(user.id));
  const postImpressions = myPosts.reduce((acc, post) => {
    const viewers = new Set();
    const rx = post.reactions || {};
    for (const arr of Object.values(rx)) arr.forEach(id => viewers.add(id));
    (post.comments || []).forEach(c => viewers.add(c.authorId));
    return acc + viewers.size;
  }, 0);
  const connectionsData = useLiveCollection('scicomm_connections') || [];
  const pendingConnections = connectionsData.filter(c => c.status === 'pending' && String(c.toId) === String(user.id));

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileSidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [mobileSidebarOpen]);

  // Disable pull-to-refresh globally on all pages and viewports
  useEffect(() => {
    const disablePull = true;

    if (disablePull) {
      document.documentElement.classList.add('no-pull-to-refresh');
    }

    // Fail-safe gesture interceptor: prevents Chrome/WebView from showing pull-to-refresh spinner
    let touchStartY = 0;

    const handleTouchStart = (e) => {
      if (e.touches.length === 1) {
        touchStartY = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e) => {
      if (e.touches.length !== 1) return;
      
      const touchY = e.touches[0].clientY;
      const touchDiff = touchY - touchStartY;

      // If dragging/swiping down (touchDiff > 0), check boundaries
      if (touchDiff > 0 && disablePull) {
        let target = e.target;
        let canScrollUp = false;

        // Traverse parent elements to check if any container is scrolled down and can scroll up
        while (target && target !== document.body && target !== document.documentElement) {
          const overflowY = window.getComputedStyle(target).overflowY;
          const isScrollable = overflowY === 'auto' || overflowY === 'scroll';
          if (isScrollable && target.scrollTop > 0) {
            canScrollUp = true;
            break;
          }
          target = target.parentNode;
        }

        // If we are at the absolute top of the page and cannot scroll any container up, block pull-down
        if (!canScrollUp && window.scrollY === 0) {
          if (e.cancelable) {
            e.preventDefault();
          }
        }
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      document.documentElement.classList.remove('no-pull-to-refresh');
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, [location.pathname, mobileSidebarOpen]);

  // Register service worker for mobile notifications
  useEffect(() => {
    if ('serviceWorker' in navigator && 'Notification' in window) {
      navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW registration failed:', err));
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, []);

  // Push notifications - safe wrapper for mobile and desktop
  const sendPushNotif = async (title, body) => {
    try {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.showNotification(title, { body, icon: './aiu_scicomm_logo.png' });
          return;
        }
      }
      
      // Fallback for desktop browsers without SW active
      if (!/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
        new Notification(title, { body, icon: './aiu_scicomm_logo.png' });
      }
    } catch (e) {
      console.log('Push notification failed:', e);
    }
  };
  const prevTaskCount = useRef(null);
  useEffect(() => {
    if (tasksDataRaw === null) return;
    if (prevTaskCount.current === null) {
      prevTaskCount.current = myPendingTasks.length;
      return;
    }
    if (myPendingTasks.length > prevTaskCount.current) {
      sendPushNotif('📋 New Task Assigned!', myPendingTasks[0]?.title || '');
    }
    prevTaskCount.current = myPendingTasks.length;
  }, [myPendingTasks.length, tasksDataRaw]);

  const generalNotifsRaw = useLiveCollection('scicomm_notifications');
  const generalNotifs = generalNotifsRaw || [];
  const myGeneralNotifs = generalNotifs.filter(n => String(n.userId) === String(user.id) && !n.read);
  const applicationsData = useLiveCollection('scicomm_applications') || [];
  const myApplications = applicationsData.filter(a => String(a.userId) === String(user.id) && !a.read);
  const pendingApps = isAdmin ? applicationsData.filter(a => a.status === 'pending') : [];

  const notifCount = myWarnings.length 
    + (isAdmin ? pendingAccounts.length : 0) 
    + (isAdmin ? pendingApps.length : 0)
    + unreadChatCount 
    + myGeneralNotifs.length 
    + myPendingTasks.length 
    + pendingConnections.length 
    + upcomingMeetings.length
    + myApplications.length;

  const prevWarningCount = useRef(null);
  useEffect(() => {
    if (warningsDataRaw === null) return;
    if (prevWarningCount.current === null) {
      prevWarningCount.current = myWarnings.length;
      return;
    }
    if (myWarnings.length > prevWarningCount.current) {
      sendPushNotif('⚠️ Warning Received', myWarnings[0]?.message || '');
    }
    prevWarningCount.current = myWarnings.length;
  }, [myWarnings.length, warningsDataRaw]);

  const prevGeneralNotifCount = useRef(null);
  useEffect(() => {
    if (generalNotifsRaw === null) return;
    if (prevGeneralNotifCount.current === null) {
      prevGeneralNotifCount.current = myGeneralNotifs.length;
      return;
    }
    if (myGeneralNotifs.length > prevGeneralNotifCount.current) {
      const latest = myGeneralNotifs.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
      if (latest) {
        sendPushNotif(latest.title, latest.message || 'Check your notifications');
      }
    }
    prevGeneralNotifCount.current = myGeneralNotifs.length;
  }, [myGeneralNotifs.length, generalNotifsRaw]);

  const prevUnreadChat = useRef(null);
  useEffect(() => {
    if (chatMessagesRaw === null) return;
    if (prevUnreadChat.current === null) {
      prevUnreadChat.current = unreadChatCount;
      return;
    }
    if (unreadChatCount > prevUnreadChat.current) {
      const latestUnread = chatMessages.find(m => myRoomIds.has(m.roomId) && m.senderId !== user.id && !(m.readBy || []).includes(user.id));
      sendPushNotif('💬 New Message', latestUnread ? `${latestUnread.senderName}: ${latestUnread.content?.substring(0, 60) || '📎 File'}` : 'You have a new message');
    }
    prevUnreadChat.current = unreadChatCount;
  }, [unreadChatCount, chatMessagesRaw]);

  const toggleDarkMode = () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    safeLocalStorage.setItem('scicommDarkMode', next);
  };

  const handleLogout = () => { logout(); navigate('/login'); };
  const isActive = (path) => location.pathname === path;

  const workspaceNotifs = (isTeam ? myPendingTasks.length : 0) + upcomingMeetings.length + (isAdmin ? pendingAccounts.length : 0);

  const renderAvatar = (size = 24) => {
    if (me?.avatar) return <img src={me.avatar} alt="Me" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />;
    const av = AVATARS.find(a => a.id === me?.avatarId);
    if (av) return <div className="avatar-emoji" style={{ width: size, height: size, borderRadius: '50%', background: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.5 }}><span className="emoji">{av.svg}</span></div>;
    return <UserCircle className="icon" size={size} />;
  };

  const PLATFORM_VERSION = 'v5.0.2';
  
  // One-time notification for the new mobile app
  useEffect(() => {
    if (scientists !== null && user && !isBannerDismissed('scicomm_app_notif_seen', me)) {
      const timer = setTimeout(() => {
        sendPushNotif("SUPERBUGS HUB is now on Mobile! 🚀", "Download our new native application for the best scientific communication experience.");
        dismissBanner('scicomm_app_notif_seen');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [scientists, me, user]);

  const changelogKey = `scicomm_version_seen_${PLATFORM_VERSION}`;
  const [showChangelog, setShowChangelog] = useState(false);
  
  useEffect(() => {
    if (scientists !== null) {
      setShowChangelog(!isBannerDismissed(changelogKey, me));
    }
  }, [scientists, me, changelogKey]);

  const dismissChangelog = () => {
    dismissBanner(changelogKey);
    setShowChangelog(false);
  };

  useEffect(() => {
    const handler = () => setShowChangelog(true);
    window.addEventListener('show-changelog', handler);
    return () => window.removeEventListener('show-changelog', handler);
  }, []);

  // Apply dark mode to html root to prevent filter stacking context issues with position:fixed
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('scicomm-dark-mode');
    } else {
      document.documentElement.classList.remove('scicomm-dark-mode');
    }
    return () => document.documentElement.classList.remove('scicomm-dark-mode');
  }, [isDarkMode]);

  return (
    <div className="scicomm-app">
      <header className="scicomm-header">
        <div className="scicomm-header-content">
          <div className="scicomm-header-left">
            {/* Mobile: Profile avatar triggers sidebar | Desktop: Logo */}
            <button onClick={() => setMobileSidebarOpen(true)} className="scicomm-mobile-profile-link" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', outline: 'none' }}><span className="scicomm-mobile-avatar">{renderAvatar(30)}</span></button>
            <Link to="/"><img src={isDarkMode ? "./aiu_scicomm_dark.png" : "./aiu_scicomm_light.png"} alt="AIU SciComm" className="scicomm-logo" onError={e => e.target.style.display='none'} /></Link>
            <div className="scicomm-search-box"><Search className="icon" size={16} /><input type="text" className="scicomm-search-input" placeholder="Search..." value={searchText} onChange={e => setSearchText(e.target.value)} onKeyDown={e => { if(e.key === 'Enter' && searchText.trim()) { navigate('/network?q=' + encodeURIComponent(searchText)); setSearchText(''); } }} /></div>
          </div>
          {/* Mobile: Chat icon top-right with unread badge */}
          <Link to="/chat" className="scicomm-mobile-chat-link" style={{ position: 'relative' }}>
            <MessageCircle className="icon" size={24} color="currentColor" />
            {unreadChatCount > 0 && (
              <span className="scicomm-notif-badge tag" style={{
                position: 'absolute', top: '-6px', right: '-6px',
                background: '#ef4444', color: 'white', borderRadius: '50%',
                width: '18px', height: '18px', fontSize: '10px', fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                lineHeight: 1, pointerEvents: 'none'
              }}>{unreadChatCount > 9 ? '9+' : unreadChatCount}</span>
            )}
          </Link>
          <nav className="scicomm-nav">
            <Link to="/" className={`scicomm-nav-item ${isActive('/') ? 'active' : ''}`}><Globe className="icon" size={20} /><span className="nav-text">Community</span></Link>
            <Link to="/network" className={`scicomm-nav-item ${isActive('/network') ? 'active' : ''}`} style={{position:'relative'}}><Users className="icon" size={20} />{pendingConnections.length > 0 && <span className="scicomm-notif-badge tag">{pendingConnections.length}</span>}<span className="nav-text">Network</span></Link>
            <Link to="/chat" className={`scicomm-nav-item ${isActive('/chat') ? 'active' : ''}`} style={{position:'relative'}}><MessageCircle className="icon" size={20} />{unreadChatCount > 0 && <span className="scicomm-notif-badge tag">{unreadChatCount > 9 ? '9+' : unreadChatCount}</span>}<span className="nav-text">Chat</span></Link>
            <Link to="/notifications" className={`scicomm-nav-item ${isActive('/notifications') ? 'active' : ''}`} style={{position:'relative'}}><Bell className="icon" size={20} />{notifCount > 0 && <span className="scicomm-notif-badge tag">{notifCount}</span>}<span className="nav-text">Alerts</span></Link>
            
            <Link to="/hub" className={`scicomm-nav-item ${isActive('/hub') ? 'active' : ''}`} style={{ position: 'relative' }}>
              <LayoutDashboard className="icon" size={20} />
              <span className="nav-text">WorkSpace</span>
              {workspaceNotifs > 0 && <span className="scicomm-notif-badge tag" style={{ position: 'absolute', top: 4, right: 4 }}>{workspaceNotifs}</span>}
            </Link>



            {/* Profile Dropdown */}
            <div className="scicomm-nav-item profile-dropdown-container">
              {renderAvatar(24)}
              <span className="nav-text">Me <span className="emoji">▼</span></span>
              <div className="scicomm-dropdown">
                <div style={{padding:'12px 16px', borderBottom:'1px solid #e0dfdc'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                    {renderAvatar(44)}
                    <div>
                      <div style={{fontWeight:600,fontSize:'14px',display:'flex',alignItems:'center',gap:'4px'}}>{user.name} <SciCommVerificationBadge role={me?.role || user.role} /></div>
                      <div style={{fontSize:'12px',color:'rgba(0,0,0,0.6)'}}>{me?.department || 'Member'}</div>
                    </div>
                  </div>
                  <Link to="/profile" className="scicomm-btn-secondary" style={{marginTop:'8px',display:'block',textAlign:'center',textDecoration:'none',padding:'4px 12px',fontSize:'13px'}}>View Profile</Link>
                </div>
                <button onClick={toggleDarkMode} className="dropdown-item" style={{display:'flex',alignItems:'center',gap:'8px'}}>
                  {isDarkMode ? <Sun className="icon" size={16} /> : <Moon className="icon" size={16} />} {isDarkMode ? 'Light Mode' : 'Dark Mode'}
                </button>
                <Link to="/settings" onClick={() => document.body.click()} className="dropdown-item" style={{display:'flex',alignItems:'center',gap:'8px', textDecoration:'none', color:'inherit'}}>
                  <Settings className="icon" size={16} /> Settings
                </Link>
                <button onClick={() => { safeLocalStorage.removeItem('workspaceId'); window.location.href = '#/portal'; }} className="dropdown-item" style={{display:'flex',alignItems:'center',gap:'8px'}}>
                  <Building2 className="icon" size={16} /> Switch Hub
                </button>
                <div className="dropdown-divider"></div>
                <button onClick={handleLogout} className="dropdown-item">Sign Out</button>
              </div>
            </div>

            <Link to="/download" className={`scicomm-download-btn-wrapper ${isActive('/download') ? 'active' : ''}`} style={{ position: 'relative', marginLeft: '8px' }}>
              <div className="scicomm-download-btn-inner">
                <Smartphone className="icon" size={16} />
                <span className="nav-text">Download App</span>
              </div>
            </Link>
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

      {/* Mobile Bottom Bar - LinkedIn Style: Home, Network, Post, Notifications, SciComm */}
      <nav className="scicomm-mobile-bar">
        <Link to="/" className={`scicomm-mobile-item ${isActive('/') ? 'active' : ''}`}><Globe className="icon" size={22} /><span>Community</span></Link>
        <Link to="/network" className={`scicomm-mobile-item ${isActive('/network') ? 'active' : ''}`} style={{position:'relative'}}><Users className="icon" size={22} />{pendingConnections.length > 0 && <span className="scicomm-notif-badge tag">{pendingConnections.length}</span>}<span>Network</span></Link>
        <Link to="/post" className={`scicomm-mobile-item scicomm-mobile-post-btn ${isActive('/post') ? 'active' : ''}`}><div className="scicomm-post-plus"><Plus size={20} /></div><span>Post</span></Link>
        <Link to="/notifications" className={`scicomm-mobile-item ${isActive('/notifications') ? 'active' : ''}`} style={{position:'relative'}}><Bell className="icon" size={22} />{notifCount > 0 && <span className="scicomm-notif-badge tag">{notifCount}</span>}<span>Alerts</span></Link>
        <Link to="/hub" className={`scicomm-mobile-item ${isActive('/hub') ? 'active' : ''}`} style={{position:'relative'}}>
          <LayoutDashboard className="icon" size={22} />
          {workspaceNotifs > 0 && <span className="scicomm-notif-badge tag">{workspaceNotifs}</span>}
          <span>WorkSpace</span>
        </Link>
      </nav>

      {/* Mobile Profile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, display: 'flex' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)' }} onClick={() => setMobileSidebarOpen(false)} />
          <div className="scicomm-mobile-sidebar" style={{ position: 'relative', width: '280px', maxWidth: '80%', background: 'white', height: '100%', display: 'flex', flexDirection: 'column', boxShadow: '2px 0 12px rgba(0,0,0,0.2)', animation: 'slideRight 0.3s ease' }}>
            <div className="scicomm-mobile-sidebar-header" style={{ padding: '20px 16px', borderBottom: '1px solid #e0dfdc' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                <Link to="/profile" onClick={() => setMobileSidebarOpen(false)} style={{ textDecoration: 'none' }}>{renderAvatar(56)}</Link>
                <button className="scicomm-mobile-sidebar-close" onClick={() => setMobileSidebarOpen(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666', marginTop: '-8px' }}>×</button>
              </div>
              <Link to="/profile" onClick={() => setMobileSidebarOpen(false)} style={{ textDecoration: 'none', color: 'inherit' }}>
                <h3 className="scicomm-mobile-sidebar-name" style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {user.name}
                  <SciCommVerificationBadge role={me?.role || user.role} />
                </h3>
              </Link>
              <div className="scicomm-mobile-sidebar-dept" style={{ color: '#4b5563', fontSize: '14px', marginBottom: '4px', fontWeight: 500 }}>{me?.department || 'Member'}</div>
            </div>

            <div className="scicomm-mobile-sidebar-stats" style={{ padding: '16px', borderBottom: '1px solid #e0dfdc' }}>
              <Link to="/profile" className="scicomm-mobile-sidebar-stat-link" onClick={() => setMobileSidebarOpen(false)} style={{ display: 'flex', justifyContent: 'space-between', textDecoration: 'none', color: '#374151', fontWeight: 600, fontSize: '14px', marginBottom: '16px' }}>
                <span>Profile viewers</span>
                <span className="scicomm-mobile-sidebar-stat-val" style={{ color: '#1d4ed8' }}>{profileViewers}</span>
              </Link>
              <Link to="/profile" className="scicomm-mobile-sidebar-stat-link" onClick={() => setMobileSidebarOpen(false)} style={{ display: 'flex', justifyContent: 'space-between', textDecoration: 'none', color: '#374151', fontWeight: 600, fontSize: '14px' }}>
                <span>Post impressions</span>
                <span className="scicomm-mobile-sidebar-stat-val" style={{ color: '#1d4ed8' }}>{postImpressions}</span>
              </Link>
            </div>

            <div className="scicomm-mobile-sidebar-menu" style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
              <button className="scicomm-mobile-sidebar-changelog-btn" onClick={() => { setMobileSidebarOpen(false); window.dispatchEvent(new CustomEvent('show-changelog')); }} style={{ width: '100%', padding: '14px 16px', background: 'none', border: 'none', textAlign: 'left', fontSize: '15px', fontWeight: 700, cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '18px' }}>🚀</span> What's New in {PLATFORM_VERSION}
              </button>
              {isAdmin && <Link to="/admin" className="scicomm-mobile-sidebar-menu-item" onClick={() => setMobileSidebarOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', textDecoration: 'none', color: '#1f2937', fontSize: '15px', fontWeight: 600 }}><Shield size={20} color="#4b5563" /> Admin Dashboard {pendingAccounts.length > 0 && <span className="scicomm-notif-badge" style={{position:'static', marginLeft:'auto'}}>{pendingAccounts.length}</span>}</Link>}
              <button className="scicomm-mobile-sidebar-menu-item" onClick={() => { toggleDarkMode(); setMobileSidebarOpen(false); }} style={{ width: '100%', padding: '14px 16px', background: 'none', border: 'none', textAlign: 'left', fontSize: '15px', fontWeight: 600, color: '#1f2937', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}>
                {isDarkMode ? <Sun size={20} color="#4b5563" /> : <Moon size={20} color="#4b5563" />} {isDarkMode ? 'Light Mode' : 'Dark Mode'}
              </button>
              <button className="scicomm-mobile-sidebar-menu-item" onClick={() => { safeLocalStorage.removeItem('workspaceId'); window.location.href = '#/portal'; }} style={{ width: '100%', padding: '14px 16px', background: 'none', border: 'none', textAlign: 'left', fontSize: '15px', fontWeight: 600, color: '#1f2937', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Building2 size={20} color="#4b5563" /> Switch Hub
              </button>
              <button className="scicomm-mobile-sidebar-menu-item" onClick={() => { setMobileSidebarOpen(false); navigate('/download'); }} style={{ width: '100%', padding: '14px 16px', background: 'none', border: 'none', textAlign: 'left', fontSize: '15px', fontWeight: 600, color: '#1f2937', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Smartphone size={20} color="#4b5563" /> Download App
              </button>
              <div style={{ padding: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: 'auto' }}>
                <img src={isDarkMode ? "./aiu_scicomm_dark.png" : "./aiu_scicomm_light.png"} alt="AIU SciComm" style={{ maxHeight: '120px', opacity: 0.9 }} onError={e => e.target.style.display='none'} />
              </div>
            </div>

            <div className="scicomm-mobile-sidebar-footer" style={{ padding: '12px 0', borderTop: '1px solid #e0dfdc' }}>
              <button className="scicomm-mobile-sidebar-footer-item" onClick={() => { setMobileSidebarOpen(false); navigate('/settings'); }} style={{ width: '100%', padding: '14px 16px', background: 'none', border: 'none', textAlign: 'left', fontSize: '15px', fontWeight: 600, color: '#4b5563', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}><Settings size={20} /> Settings</button>
              <button className="scicomm-mobile-sidebar-footer-item" onClick={() => { setMobileSidebarOpen(false); handleLogout(); }} style={{ width: '100%', padding: '14px 16px', background: 'none', border: 'none', textAlign: 'left', fontSize: '15px', fontWeight: 600, color: '#4b5563', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>Sign Out</button>
            </div>
          </div>
          <style>{`
            @keyframes slideRight {
              from { transform: translateX(-100%); }
              to { transform: translateX(0); }
            }
          `}</style>
        </div>
      )}

      {/* Version Changelog Popup */}
      {showChangelog && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="scicomm-changelog-modal">
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
                <img src={isDarkMode ? "./aiu_scicomm_dark.png" : "./aiu_scicomm_light.png"} alt="AIU SciComm" style={{ maxHeight: '160px' }} onError={e => e.target.style.display='none'} />
              </div>
              <h2 style={{ margin: '0 0 4px', fontSize: '22px' }}>What's New in {PLATFORM_VERSION}</h2>
              <p className="scicomm-changelog-subtitle">SciComm Platform Update</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              <div className="scicomm-changelog-box scicomm-changelog-box-blue">
                <h4>✨ New Features</h4>
                <ul>
                  <li><strong>Branding Update:</strong> Renamed app to <strong>"SUPERBUGS HUB"</strong>.</li>
                  <li><strong>Optimized Icons:</strong> Scaled brand logo to fit circular/square templates perfectly.</li>
                  <li><strong>External Deep-linking:</strong> Web links now load natively inside the system browser.</li>
                  <li><strong>Gallery Attachment Picker:</strong> Access device photo library and storage fields.</li>
                </ul>
              </div>
              <div className="scicomm-changelog-box scicomm-changelog-box-red">
                <h4>🛠️ Permissions Expansion</h4>
                <ul>
                  <li><strong>Future-proofing:</strong> Pre-declared Camera, Location, modern Media, and Notifications.</li>
                  <li><strong>Media Uploads:</strong> Added modern Android API 33+ permissions for media access.</li>
                </ul>
              </div>
              <div className="scicomm-changelog-box scicomm-changelog-box-green">
                <h4>🌍 Platform Expansion</h4>
                <ul>
                  <li><strong>Mobile:</strong> Restored native Google login account bottom sheet.</li>
                  <li><strong>Infrastructure:</strong> Placed v5.0.2 APK on the dedicated Download page.</li>
                  <li><strong>Stability:</strong> Resolved file selection bugs and general web app performance.</li>
                </ul>
              </div>
            </div>
            <button onClick={dismissChangelog} className="scicomm-btn-primary" style={{ width: '100%', padding: '14px', justifyContent: 'center', fontSize: '16px', fontWeight: 700 }}>Got It! 🎉</button>
          </div>
        </div>
      )}
      {/* Custom Apply Modal */}
      {showApplyModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(10px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ 
            background: 'white', 
            borderRadius: '24px', 
            padding: '32px', 
            maxWidth: '440px', 
            width: '100%', 
            textAlign: 'center',
            boxShadow: '0 20px 50px rgba(0,0,0,0.1), inset 0 0 0 1px rgba(255,255,255,0.5)',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '6px', background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)' }} />
            
            <div style={{ width: '64px', height: '64px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Lock size={32} color="#3b82f6" />
            </div>
            
            <h2 style={{ margin: '0 0 12px', fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Access Restricted</h2>
            <p style={{ margin: '0 0 24px', fontSize: '15px', color: '#64748b', lineHeight: '1.6' }}>
              This option is only available to the <strong>Science Communication Team</strong>. Do you want to apply to join the team now?
            </p>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setShowApplyModal(false)} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: 600, fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s' }} onMouseOver={e => e.currentTarget.style.background = '#f8fafc'} onMouseOut={e => e.currentTarget.style.background = 'white'}>
                Maybe Later
              </button>
              <button onClick={() => { setShowApplyModal(false); navigate('/apply'); }} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', color: 'white', fontWeight: 600, fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(139,92,246,0.3)', transition: 'all 0.2s' }} onMouseOver={e => e.currentTarget.style.transform = 'translateY(-1px)'} onMouseOut={e => e.currentTarget.style.transform = 'none'}>
                Apply Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Coming Soon Modal */}
      {showComingSoon && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(10px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ 
            background: 'white', 
            borderRadius: '24px', 
            padding: '32px', 
            maxWidth: '440px', 
            width: '100%', 
            textAlign: 'center',
            boxShadow: '0 20px 50px rgba(0,0,0,0.1), inset 0 0 0 1px rgba(255,255,255,0.5)',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '6px', background: 'linear-gradient(90deg, #14b8a6, #3b82f6)' }} />
            
            <div style={{ width: '80px', height: '80px', background: 'linear-gradient(135deg, #ccfbf1 0%, #eff6ff 100%)', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: '0 8px 16px rgba(20, 184, 166, 0.15)' }}>
              <LayoutDashboard size={40} color="#14b8a6" />
            </div>
            
            <h2 style={{ margin: '0 0 12px', fontSize: '24px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>Coming Soon! 🚀</h2>
            <p style={{ margin: '0 0 28px', fontSize: '15px', color: '#64748b', lineHeight: '1.6' }}>
              We're crafting an amazing new <strong>Projects</strong> experience for the SciComm team. It's not quite ready yet, but it will be worth the wait!
            </p>
            
            <button onClick={() => setShowComingSoon(false)} style={{ width: '100%', padding: '14px', borderRadius: '14px', border: 'none', background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)', color: 'white', fontWeight: 700, fontSize: '15px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(20, 184, 166, 0.3)', transition: 'all 0.2s' }} onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseOut={e => e.currentTarget.style.transform = 'none'}>
              Awesome, I'll wait!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
