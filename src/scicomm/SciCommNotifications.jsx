import { useLiveCollection, db } from '../db';
import { useAuth } from '../context/AuthContext';
import { Bell, AlertTriangle, Briefcase, UserCheck, Calendar, MessageCircle, UserPlus } from 'lucide-react';
import { useEffect } from 'react';
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

  const myTasks = tasksData.filter(t => String(t.assignedTo) === String(user.id) && t.status !== 'Completed' && t.status !== 'Approved');
  const myWarnings = warningsData.filter(w => String(w.userId) === String(user.id));
  const pendingAccounts = isAdmin ? scientists.filter(s => s.accountStatus === 'pending') : [];
  const pendingConnections = connectionsData.filter(c => c.status === 'pending' && String(c.toId) === String(user.id));
  const upcomingMeetings = meetingsData.filter(m => {
    const isInvited = (m.members || []).includes(user.id) || m.allMembers;
    return isInvited && new Date(m.date) >= new Date(new Date().toDateString());
  });

  // Mark warnings seen
  useEffect(() => {
    myWarnings.filter(w => !w.seen).forEach(async (w) => {
      try { await db.scicomm_warnings.update(w.id, { seen: true }); } catch (e) {}
    });
  }, [myWarnings.length]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  }, []);

  const notifications = [
    ...myTasks.map(t => ({ type: 'task', icon: <Briefcase size={18} color="#1d4ed8" />, bg: '#eff6ff', title: `📋 New task: ${t.title}`, sub: `Due: ${t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'TBD'} • Priority: ${t.priority || 'Medium'}`, time: t.createdAt, id: 't_' + t.id, link: '/tasks' })),
    ...myWarnings.filter(w => w.status !== 'removed').map(w => ({ type: 'warning', icon: <AlertTriangle size={18} color="#ef4444" />, bg: '#fee2e2', title: `⚠️ Warning ${w.warningNumber}/3 from ${w.issuedBy}`, sub: w.message, time: w.issuedAt, id: 'w_' + w.id, link: '/profile' })),
    ...pendingAccounts.map(s => ({ type: 'pending', icon: <UserCheck size={18} color="#f59e0b" />, bg: '#fef3c7', title: `👤 New account: ${s.name}`, sub: `@${s.username} — Awaiting approval`, time: '', id: 'p_' + s.id, link: '/admin' })),
    ...pendingConnections.map(c => ({ type: 'connection', icon: <UserCheck size={18} color="#3b82f6" />, bg: '#dbeafe', title: `🤝 ${c.fromName} wants to connect`, sub: 'Accept or ignore in Network tab', time: c.createdAt, id: 'c_' + c.id, link: '/network' })),
    ...upcomingMeetings.slice(0, 3).map(m => ({ type: 'meeting', icon: <Calendar size={18} color="#8b5cf6" />, bg: '#ede9fe', title: `📅 Upcoming: ${m.title}`, sub: `${new Date(m.date).toLocaleDateString()} ${m.time || ''}`, time: m.createdAt, id: 'm_' + m.id, link: '/meetings' })),
    // Application status notifications for the applicant
    ...applicationsData.filter(a => String(a.userId) === String(user.id) && a.status !== 'pending').map(a => ({
      type: 'application',
      icon: <UserPlus size={18} color={a.status === 'approved' ? '#16a34a' : '#ef4444'} />,
      bg: a.status === 'approved' ? '#dcfce7' : '#fee2e2',
      title: a.status === 'approved' ? '🎉 SciComm Team Application Approved!' : '❌ SciComm Team Application Not Approved',
      sub: a.status === 'approved' ? 'Welcome to the team! You now have access to Tasks & Meetings.' : 'Your application was reviewed and not approved. Update your profile and try again.',
      time: a.reviewedAt || a.createdAt,
      id: 'app_' + a.id,
      link: '/leaderboard'
    })),
    // Pending application notifications for the applicant
    ...applicationsData.filter(a => String(a.userId) === String(user.id) && a.status === 'pending').map(a => ({
      type: 'application',
      icon: <UserPlus size={18} color="#f59e0b" />,
      bg: '#fef3c7',
      title: '⏳ SciComm Team Application Pending',
      sub: 'Your application is under review by admins.',
      time: a.createdAt,
      id: 'app_' + a.id,
      link: '/leaderboard'
    })),
    // Admin notification for new applications
    ...(isAdmin ? applicationsData.filter(a => a.status === 'pending').map(a => {
      const applicant = scientists.find(s => String(s.id) === String(a.userId));
      return {
        type: 'application_admin',
        icon: <UserPlus size={18} color="#8b5cf6" />,
        bg: '#ede9fe',
        title: `📝 New Team Application: ${applicant?.name || 'Unknown'}`,
        sub: 'Review in Admin Dashboard → Applications tab',
        time: a.createdAt,
        id: 'appadm_' + a.id,
        link: '/admin'
      };
    }) : []),
  ].sort((a, b) => new Date(b.time || 0).getTime() - new Date(a.time || 0).getTime());

  return (
    <div className="scicomm-feed-layout">
      <div className="scicomm-sidebar-left hide-on-mobile">
        <div className="scicomm-card scicomm-card-padding">
          <h3 style={{ margin: '0 0 12px', fontSize: '16px' }}>Notifications</h3>
          {[
            { label: 'Tasks', count: myTasks.length, color: '#1d4ed8' },
            { label: 'Warnings', count: myWarnings.filter(w => w.status !== 'removed').length, color: '#ef4444' },
            { label: 'Connections', count: pendingConnections.length, color: '#3b82f6' },
            { label: 'Meetings', count: upcomingMeetings.length, color: '#8b5cf6' },
            { label: 'Applications', count: applicationsData.filter(a => String(a.userId) === String(user.id)).length + (isAdmin ? applicationsData.filter(a => a.status === 'pending').length : 0), color: '#8b5cf6' },
            ...(isAdmin ? [{ label: 'Pending Accounts', count: pendingAccounts.length, color: '#f59e0b' }] : []),
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
              <span style={{ color: 'rgba(0,0,0,0.6)' }}>{item.label}</span>
              <strong style={{ color: item.color }}>{item.count}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className="scicomm-feed-main">
        <div className="scicomm-card scicomm-card-padding">
          <h2 style={{ margin: '0 0 16px', fontSize: '18px' }}>🔔 Notifications</h2>
          {notifications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎉</div>
              <h3 style={{ margin: '0 0 8px' }}>All caught up!</h3>
              <p style={{ fontSize: '14px' }}>No new notifications.</p>
            </div>
          ) : notifications.map(n => (
            <Link key={n.id} to={n.link || '#'} style={{ display: 'flex', gap: '12px', padding: '14px 8px', borderBottom: '1px solid #eef3f8', textDecoration: 'none', color: 'inherit', borderRadius: '8px', transition: 'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: n.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{n.icon}</div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: '0 0 2px', fontSize: '14px', fontWeight: 600 }}>{n.title}</p>
                <p style={{ margin: 0, fontSize: '13px', color: 'rgba(0,0,0,0.6)' }}>{n.sub}</p>
                {n.time && <div style={{ fontSize: '11px', color: 'rgba(0,0,0,0.4)', marginTop: '4px' }}>{timeAgo(n.time)}</div>}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
