import { useLiveCollection, db } from '../db';
import { useAuth } from '../context/AuthContext';
import { Bell, AlertTriangle, Briefcase, UserCheck, Calendar, MessageCircle, UserPlus, Heart, MessageSquare, AtSign, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { timeAgo } from './scicommConstants';
import { Link } from 'react-router-dom';

export default function SciCommNotifications() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin' || user.role === 'master';
  const tasksData = useLiveCollection('tasks') || [];
  const warningsData = useLiveCollection('scicomm_warnings') || [];
  const scientists = useLiveCollection('scientists') || [];
  const connectionsData = useLiveCollection('scicomm_connections') || [];
  const meetingsData = useLiveCollection('scicomm_meetings') || [];
  const applicationsData = useLiveCollection('scicomm_applications') || [];
  const chatMessages = useLiveCollection('scicomm_chat_messages') || [];
  const chatRooms = useLiveCollection('scicomm_chat_rooms') || [];
  const generalNotifications = useLiveCollection('scicomm_notifications') || [];

  const [activeTab, setActiveTab] = useState('all');

  const myTasks = tasksData.filter(t => String(t.assignedTo) === String(user.id) && t.status !== 'Completed' && t.status !== 'Approved');
  const myWarnings = warningsData.filter(w => String(w.userId) === String(user.id));
  const pendingAccounts = isAdmin ? scientists.filter(s => s.accountStatus === 'pending') : [];
  const pendingApps = isAdmin ? applicationsData.filter(a => a.status === 'pending') : [];
  const pendingConnections = connectionsData.filter(c => c.status === 'pending' && String(c.toId) === String(user.id));
  const upcomingMeetings = meetingsData.filter(m => {
    const isInvited = (m.members || []).includes(user.id) || m.allMembers;
    return isInvited && new Date(m.date) >= new Date(new Date().toDateString());
  });

  const myGeneralNotifs = generalNotifications.filter(n => String(n.userId) === String(user.id));

  const getAuthor = (id) => scientists.find(s => String(s.id) === String(id));
  const getAvatar = (member) => {
    if (member?.avatar) return { type: 'img', src: member.avatar };
    const av = AVATARS.find(a => a.id === member?.avatarId);
    if (av) return { type: 'emoji', emoji: av.svg, bg: av.bg };
    return { type: 'fallback' };
  };

  const renderAvatar = (member, size = 48) => {
    const av = getAvatar(member);
    if (av.type === 'img') return <img src={av.src} alt="" style={{ width: size, height: size, borderRadius: '14px', objectFit: 'cover', flexShrink: 0 }} />;
    if (av.type === 'emoji') return <div style={{ width: size, height: size, borderRadius: '14px', background: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.5, flexShrink: 0 }}>{av.emoji}</div>;
    return <div style={{ width: size, height: size, borderRadius: '14px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><UserCircle size={size * 0.6} color="#94a3b8" /></div>;
  };

  const handleNotificationClick = async (n) => {
    if (n.type === 'application' && !n.read && n.rawId) {
      try { await db.scicomm_applications.update(n.rawId, { read: true }); } catch (e) {}
    }
    if (n.isGeneral && !n.read) {
      try { await db.scicomm_notifications.update(n.rawId, { read: true }); } catch (e) {}
    }
  };

  const markAllAsRead = async () => {
    // 1. Mark general notifications (comments, mentions, reactions) as read
    const unreadGen = myGeneralNotifs.filter(n => !n.read);
    const genPromises = unreadGen.map(n => 
      db.scicomm_notifications.update(n.id, { read: true }).catch(e => console.error(e))
    );

    // 2. Mark chat messages as read
    const myRoomIds = chatRooms.filter(r => (r.members || []).includes(user.id)).map(r => r.id);
    const unreadMessages = chatMessages.filter(m => 
      myRoomIds.includes(m.roomId) && 
      m.senderId !== user.id && 
      !(m.readBy || []).includes(user.id)
    );
    const chatPromises = unreadMessages.map(m => 
      db.scicomm_chat_messages.update(m.id, { readBy: [...(m.readBy || []), user.id] }).catch(e => console.error(e))
    );

    await Promise.all([...genPromises, ...chatPromises]);
  };

  useEffect(() => {
    myWarnings.filter(w => !w.seen).forEach(async (w) => {
      try { await db.scicomm_warnings.update(w.id, { seen: true }); } catch (e) {}
    });
  }, [myWarnings.length]);

  const allNotifications = [
    ...myTasks.map(t => ({ 
      type: 'task', 
      category: 'work',
      icon: <Briefcase size={18} />, 
      color: '#1d4ed8',
      bg: 'rgba(29, 78, 216, 0.1)', 
      title: `New Task Assigned`, 
      sub: t.title, 
      time: t.createdAt, 
      id: 't_' + t.id, 
      link: '/tasks',
      read: false
    })),
    ...myWarnings.filter(w => w.status !== 'removed').map(w => ({ 
      type: 'warning', 
      category: 'alert',
      icon: <AlertTriangle size={18} />, 
      color: '#ef4444',
      bg: 'rgba(239, 68, 68, 0.1)', 
      title: `Warning Issued (${w.warningNumber}/3)`, 
      sub: w.message, 
      time: w.issuedAt, 
      id: 'w_' + w.id, 
      link: '/profile',
      read: w.seen || false
    })),
    ...pendingAccounts.map(s => ({ 
      type: 'pending', 
      category: 'admin',
      icon: <UserCheck size={18} />, 
      color: '#f59e0b',
      bg: 'rgba(245, 158, 11, 0.1)', 
      title: `New Scientist Account`, 
      sub: `${s.name} is awaiting approval`, 
      time: s.createdAt || new Date().toISOString(), 
      id: 'p_' + s.id, 
      link: '/admin',
      read: false
    })),
    ...pendingConnections.map(c => ({ 
      type: 'connection', 
      category: 'social',
      icon: c.fromId ? renderAvatar(getAuthor(c.fromId), 48) : <UserPlus size={18} />, 
      color: c.fromId ? 'transparent' : '#3b82f6',
      bg: c.fromId ? 'transparent' : 'rgba(59, 130, 246, 0.1)', 
      title: `Connection Request`, 
      sub: `${c.fromName} wants to connect with you`, 
      time: c.createdAt, 
      id: 'c_' + c.id, 
      link: '/network',
      read: false
    })),
    ...upcomingMeetings.map(m => ({ 
      type: 'meeting', 
      category: 'work',
      icon: <Calendar size={18} />, 
      color: '#8b5cf6',
      bg: 'rgba(139, 92, 246, 0.1)', 
      title: `Meeting Scheduled`, 
      sub: `${m.title} at ${m.time || ''}`, 
      time: m.createdAt, 
      id: 'm_' + m.id, 
      link: '/meetings',
      read: false
    })),
    ...applicationsData.filter(a => String(a.userId) === String(user.id)).map(a => ({
      type: 'application',
      category: 'social',
      icon: renderAvatar(getAuthor(a.userId), 48),
      color: 'transparent',
      bg: 'transparent',
      title: `Team Application ${a.status.charAt(0).toUpperCase() + a.status.slice(1)}`,
      sub: a.status === 'approved' ? 'Welcome to the SciComm Team!' : (a.status === 'pending' ? 'Your application is being reviewed.' : 'Your application was not approved.'),
      time: a.reviewedAt || a.createdAt,
      id: 'app_' + a.id,
      link: '/leaderboard',
      read: a.read || false,
      rawId: a.id
    })),
    ...pendingApps.map(a => ({
      type: 'application_pending',
      category: 'admin',
      icon: renderAvatar(getAuthor(a.userId), 48),
      color: 'transparent',
      bg: 'transparent',
      title: `New Team Application`,
      sub: `${a.name || 'A user'} applied to join SciComm Team`,
      time: a.createdAt,
      id: 'app_admin_' + a.id,
      link: '/admin?tab=applications',
      read: false
    })),
    ...(() => {
      const groupedGenNotifs = [];
      const groups = {};
      
      myGeneralNotifs.forEach(n => {
        if (n.type === 'reaction' || n.type === 'comment' || n.type === 'reply' || n.type === 'mention') {
          const key = `${n.type}_${n.message || 'unknown'}`;
          if (!groups[key]) groups[key] = [];
          groups[key].push(n);
        } else {
          groupedGenNotifs.push(n);
        }
      });
      
      Object.values(groups).forEach(group => {
        if (group.length === 1) {
          groupedGenNotifs.push(group[0]);
        } else {
          group.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          const latest = group[0];
          const senders = [...new Set(group.map(g => String(g.senderId)).filter(id => id && id !== 'undefined'))];
          
          if (senders.length <= 1) {
            groupedGenNotifs.push(latest);
          } else {
            const firstSender = getAuthor(senders[0]);
            const mainName = firstSender ? firstSender.name.split(' ')[0] : 'Someone';
            const numOthers = senders.length - 1;
            
            let action = 'interacted with';
            if (latest.type === 'reaction') action = 'reacted to';
            else if (latest.type === 'comment') action = 'commented on';
            else if (latest.type === 'reply') action = 'replied to a comment on';
            else if (latest.type === 'mention') action = 'mentioned you in';
            
            const newTitle = `${mainName} and ${numOthers} other${numOthers > 1 ? 's' : ''} ${action} your post`;
            
            groupedGenNotifs.push({
              ...latest,
              title: newTitle
            });
          }
        }
      });

      return groupedGenNotifs.map(n => {
        let icon = <Bell size={18} />;
        let color = '#3b82f6';
        let bg = 'rgba(59, 130, 246, 0.1)';
        let category = 'social';

        if (n.type === 'mention') {
          icon = n.senderId ? renderAvatar(getAuthor(n.senderId), 48) : <AtSign size={18} />;
          color = n.senderId ? 'transparent' : '#06b6d4';
          bg = n.senderId ? 'transparent' : 'rgba(6, 182, 212, 0.1)';
        } else if (n.type === 'reaction') {
          icon = n.senderId ? renderAvatar(getAuthor(n.senderId), 48) : <Heart size={18} />;
          color = n.senderId ? 'transparent' : '#ec4899';
          bg = n.senderId ? 'transparent' : 'rgba(236, 72, 153, 0.1)';
        } else if (n.type === 'comment' || n.type === 'reply') {
          icon = n.senderId ? renderAvatar(getAuthor(n.senderId), 48) : <MessageSquare size={18} />;
          color = n.senderId ? 'transparent' : '#10b981';
          bg = n.senderId ? 'transparent' : 'rgba(16, 185, 129, 0.1)';
        } else if (n.type === 'new_post') {
          category = 'alert';
          icon = n.senderId ? renderAvatar(getAuthor(n.senderId), 48) : <Bell size={18} />;
          color = n.senderId ? 'transparent' : '#f59e0b';
          bg = n.senderId ? 'transparent' : 'rgba(245, 158, 11, 0.1)';
        } else if (n.type === 'master_deletion') {
          icon = <Trash2 size={18} />;
          color = '#ef4444';
          bg = 'rgba(239, 68, 68, 0.1)';
          category = 'alert';
        } else if (n.type === 'connection_accepted') {
          icon = n.senderId ? renderAvatar(getAuthor(n.senderId), 48) : <UserCheck size={18} />;
          color = n.senderId ? 'transparent' : '#10b981';
          bg = n.senderId ? 'transparent' : 'rgba(16, 185, 129, 0.1)';
        } else if (n.type === 'task_submitted') {
          icon = n.senderId ? renderAvatar(getAuthor(n.senderId), 48) : <Briefcase size={18} />;
          color = n.senderId ? 'transparent' : '#8b5cf6';
          bg = n.senderId ? 'transparent' : 'rgba(139, 92, 246, 0.1)';
          category = 'work';
        } else if (n.type === 'task_approved') {
          icon = <CheckCircle size={18} />;
          color = '#10b981';
          bg = 'rgba(16, 185, 129, 0.1)';
          category = 'work';
        } else if (n.type === 'task_rejected') {
          icon = <AlertCircle size={18} />;
          color = '#ef4444';
          bg = 'rgba(239, 68, 68, 0.1)';
          category = 'work';
        } else if (n.type === 'group_added') {
          icon = n.senderId ? renderAvatar(getAuthor(n.senderId), 48) : <MessageCircle size={18} />;
          color = n.senderId ? 'transparent' : '#1d4ed8';
          bg = n.senderId ? 'transparent' : 'rgba(29, 78, 216, 0.1)';
        }

        let finalLink = n.link || '/';
        if (typeof finalLink === 'string' && finalLink.startsWith('/feed?postId=')) {
          finalLink = finalLink.replace('/feed?postId=', '/view-post/');
        }

        return {
          ...n,
          link: finalLink,
          type: n.type,
          category,
          icon,
          color,
          bg,
          title: n.title,
          sub: n.message || 'Click to view',
          time: n.createdAt,
          id: 'gen_' + n.id,
          link: n.link,
          read: n.read,
          rawId: n.id,
          isGeneral: true
        };
      });
    })(),
    ...(() => {
      const myRoomIds = new Set(chatRooms.filter(r => (r.members || []).includes(user.id)).map(r => r.id));
      const unreadByRoom = {};
      chatMessages.forEach(m => {
        if (myRoomIds.has(m.roomId) && m.senderId !== user.id && !(m.readBy || []).includes(user.id)) {
          if (!unreadByRoom[m.roomId]) unreadByRoom[m.roomId] = { count: 0, senderName: m.senderName, senderId: m.senderId, roomId: m.roomId, lastTime: m.createdAt };
          unreadByRoom[m.roomId].count++;
          if (m.createdAt > unreadByRoom[m.roomId].lastTime) unreadByRoom[m.roomId].lastTime = m.createdAt;
        }
      });
      return Object.values(unreadByRoom).map(r => ({
        type: 'chat',
        category: 'social',
        icon: renderAvatar(getAuthor(r.senderId), 48),
        color: 'transparent',
        bg: 'transparent',
        title: `Unread Messages`,
        sub: `${r.count} new message${r.count > 1 ? 's' : ''} from ${r.senderName}`,
        time: r.lastTime,
        id: 'chat_' + r.roomId,
        link: '/chat',
        read: false
      }));
    })()
  ].sort((a, b) => new Date(b.time || 0).getTime() - new Date(a.time || 0).getTime());

  const filteredNotifications = activeTab === 'all' 
    ? allNotifications 
    : allNotifications.filter(n => n.category === activeTab);

  const unreadNotifications = filteredNotifications.filter(n => n.read === false);
  const readNotifications = filteredNotifications.filter(n => n.read !== false);

  const renderNotificationItem = (n) => {
    const isUnread = n.read === false;
    return (
      <Link 
        key={n.id} 
        to={n.link || '#'} 
        onClick={() => handleNotificationClick(n)}
        style={{ 
          display: 'flex', 
          gap: '16px', 
          padding: '16px 20px', 
          textDecoration: 'none', 
          color: 'inherit', 
          background: isUnread ? '#f0f7ff' : '#ffffff',
          borderBottom: '1px solid #f1f5f9',
          transition: 'all 0.2s ease',
          alignItems: 'center',
          opacity: isUnread ? 1 : 0.65
        }}
        onMouseEnter={e => e.currentTarget.style.background = isUnread ? '#e0f2fe' : '#f8fafc'}
        onMouseLeave={e => e.currentTarget.style.background = isUnread ? '#f0f7ff' : '#ffffff'}
      >
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: n.bg, color: n.color, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid #f1f5f9' }}>
            {n.icon}
          </div>
          {n.type !== 'chat' && n.type !== 'warning' && n.type !== 'task' && n.type !== 'pending' && n.type !== 'application_pending' && (
            <div style={{ position: 'absolute', bottom: '-4px', right: '-4px', width: '24px', height: '24px', background: n.color === 'transparent' ? '#3b82f6' : n.color, borderRadius: '50%', border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
              {n.type === 'reaction' ? <Heart size={12} fill="white" /> : 
               n.type === 'comment' || n.type === 'reply' ? <MessageSquare size={12} fill="white" /> : 
               n.type === 'mention' ? <AtSign size={12} /> : 
               n.type === 'connection_accepted' ? <UserCheck size={12} /> :
               n.type === 'group_added' ? <MessageCircle size={12} fill="white" /> :
               n.type === 'task_submitted' ? <Briefcase size={12} /> :
               <Bell size={12} />}
            </div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
            <p style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: isUnread ? 700 : 500, color: isUnread ? '#0f172a' : '#334155', lineHeight: '1.4' }}>
              {n.title}
            </p>
          </div>
          <p style={{ margin: 0, fontSize: '14px', color: isUnread ? '#3b82f6' : '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: isUnread ? 600 : 400 }}>
            {n.sub}
          </p>
          <span style={{ fontSize: '12px', color: isUnread ? '#2563eb' : '#94a3b8', fontWeight: isUnread ? 600 : 400, marginTop: '6px', display: 'block' }}>
            {timeAgo(n.time)}
          </span>
        </div>
        {isUnread && <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#2563eb', flexShrink: 0, boxShadow: '0 0 0 4px rgba(37,99,235,0.1)' }} />}
      </Link>
    );
  };

  return (
    <div className="scicomm-notifications-page" style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', background: 'white', padding: '20px', borderRadius: '24px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px' }}>Notifications</h2>
        </div>
        <button 
          onClick={markAllAsRead} 
          style={{ 
            background: 'linear-gradient(135deg, #3b82f6, #2563eb)', 
            color: 'white', 
            border: 'none', 
            padding: '10px 22px', 
            borderRadius: '14px', 
            fontSize: '13px', 
            fontWeight: 800, 
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 10px 20px rgba(37,99,235,0.2)',
            transition: 'transform 0.2s'
          }}
          onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <Bell size={16} />
          Mark all as read
        </button>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '4px' }}>
        {['all', 'social', 'work', 'alert', 'admin'].map(tab => (
          <button 
            key={tab} 
            onClick={() => setActiveTab(tab)} 
            style={{ 
              padding: '8px 16px', 
              borderRadius: '20px', 
              border: 'none', 
              fontSize: '13px', 
              fontWeight: 600, 
              cursor: 'pointer',
              background: activeTab === tab ? '#1d4ed8' : '#f1f5f9',
              color: activeTab === tab ? 'white' : '#64748b',
              transition: 'all 0.2s'
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', background: 'white', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9' }}>
        {unreadNotifications.length > 0 && (
          <div>
            <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>New Notifications</h3>
              <div style={{ background: '#3b82f6', color: 'white', fontSize: '12px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px' }}>{unreadNotifications.length}</div>
            </div>
            <div>
              {unreadNotifications.map(renderNotificationItem)}
            </div>
          </div>
        )}

        {readNotifications.length > 0 && (
          <div>
            <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', borderTop: unreadNotifications.length > 0 ? '1px solid #e2e8f0' : 'none', display: 'flex', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Earlier</h3>
            </div>
            <div>
              {readNotifications.map(renderNotificationItem)}
            </div>
          </div>
        )}

        {filteredNotifications.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ fontSize: '64px', marginBottom: '24px' }}>✨</div>
            <h3 style={{ margin: '0 0 12px', fontSize: '22px', fontWeight: 900 }}>Everything is clear!</h3>
            <p style={{ color: '#64748b', fontSize: '16px', maxWidth: '300px', margin: '0 auto' }}>You've caught up with all your scientific alerts and messages.</p>
          </div>
        )}
      </div>
    </div>
  );
}
