import { Link } from 'react-router-dom';
import { Briefcase, Calendar, Trophy, Video, Shield, Users, Bell } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLiveCollection } from '../db';

export default function SciCommHub() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin' || user.role === 'master';
  const isTeam = user.role === 'scicomm' || isAdmin;
  const tasksData = useLiveCollection('tasks') || [];
  const meetingsData = useLiveCollection('scicomm_meetings') || [];
  const myPendingTasks = tasksData.filter(t => String(t.assignedTo) === String(user.id) && t.status !== 'Completed' && t.status !== 'Approved');
  const upcomingMeetings = meetingsData.filter(m => ((m.members || []).includes(user.id) || m.allMembers) && new Date(m.date) >= new Date(new Date().toDateString()));

  const items = [
    ...(isTeam ? [{ to: '/tasks', icon: <Briefcase size={32} />, label: 'Tasks', color: '#3b82f6', bg: '#eff6ff', badge: myPendingTasks.length }] : []),
    ...(isTeam ? [{ to: '/meetings', icon: <Video size={32} />, label: 'Meetings', color: '#8b5cf6', bg: '#f5f3ff', badge: 0 }] : []),
    { to: '/leaderboard', icon: <Trophy size={32} />, label: 'Leaderboard', color: '#f59e0b', bg: '#fffbeb', badge: 0 },
    { to: '/calendar', icon: <Calendar size={32} />, label: 'Calendar', color: '#10b981', bg: '#ecfdf5', badge: upcomingMeetings.length },
    ...(isAdmin ? [{ to: '/admin', icon: <Shield size={32} />, label: 'Admin', color: '#1d4ed8', bg: '#eff6ff', badge: 0 }] : []),
  ];

  return (
    <div style={{ padding: '20px 16px', minHeight: 'calc(100vh - 160px)' }}>
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <div style={{ fontSize: '28px', marginBottom: '4px' }}>🔬</div>
        <h1 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: 700 }}>SciComm Hub</h1>
        <p style={{ margin: 0, fontSize: '13px', color: 'rgba(0,0,0,0.5)' }}>Quick access to everything</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', maxWidth: '400px', margin: '0 auto' }}>
        {items.map(item => (
          <Link key={item.to} to={item.to} style={{
            textDecoration: 'none', color: 'inherit',
            background: 'white', borderRadius: '16px', padding: '24px 16px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
            border: '1px solid #e0dfdc', position: 'relative',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}>
            <div style={{
              width: '60px', height: '60px', borderRadius: '16px',
              background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: item.color,
            }}>
              {item.icon}
            </div>
            <span style={{ fontWeight: 600, fontSize: '14px', color: '#1e293b' }}>{item.label}</span>
            {item.badge > 0 && (
              <span style={{
                position: 'absolute', top: '10px', right: '10px',
                background: '#ef4444', color: 'white', fontSize: '11px', fontWeight: 700,
                width: '22px', height: '22px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{item.badge}</span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
