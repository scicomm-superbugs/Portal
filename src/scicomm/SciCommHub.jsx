import { Link, useNavigate } from 'react-router-dom';
import { Briefcase, Calendar, Trophy, Video, Shield, Users, Bell, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLiveCollection } from '../db';
import { useState } from 'react';

export default function SciCommHub() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin' || user.role === 'master';
  const isTeam = user.role === 'scicomm' || isAdmin;
  const tasksData = useLiveCollection('tasks') || [];
  const meetingsData = useLiveCollection('scicomm_meetings') || [];
  const myPendingTasks = tasksData.filter(t => String(t.assignedTo) === String(user.id) && t.status !== 'Completed' && t.status !== 'Approved');
  const upcomingMeetings = meetingsData.filter(m => ((m.members || []).includes(user.id) || m.allMembers) && new Date(m.date) >= new Date(new Date().toDateString()));

  const navigate = useNavigate();
  const [showApplyModal, setShowApplyModal] = useState(false);

  const items = [
    { to: '/tasks', icon: <Briefcase size={32} />, label: 'Tasks', color: isTeam ? '#3b82f6' : '#94a3b8', bg: isTeam ? '#eff6ff' : '#f8fafc', badge: myPendingTasks.length, locked: !isTeam },
    { to: '/meetings', icon: <Video size={32} />, label: 'Meetings', color: isTeam ? '#8b5cf6' : '#94a3b8', bg: isTeam ? '#f5f3ff' : '#f8fafc', badge: 0, locked: !isTeam },
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
        {items.map(item => {
          const content = (
            <>
              <div style={{
                width: '60px', height: '60px', borderRadius: '16px',
                background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: item.color,
              }}>
                {item.icon}
              </div>
              <span style={{ fontWeight: 600, fontSize: '14px', color: item.locked ? '#64748b' : '#1e293b' }}>{item.label}</span>
              {item.badge > 0 && (
                <span style={{
                  position: 'absolute', top: '10px', right: '10px',
                  background: '#ef4444', color: 'white', fontSize: '11px', fontWeight: 700,
                  width: '22px', height: '22px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{item.badge}</span>
              )}
              {item.locked && (
                <Lock size={14} color="#ef4444" style={{ position: 'absolute', top: '10px', right: '10px' }} />
              )}
            </>
          );

          return item.locked ? (
            <div key={item.label} onClick={() => setShowApplyModal(true)} style={{
              textDecoration: 'none', color: 'inherit',
              background: 'white', borderRadius: '16px', padding: '24px 16px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
              border: '1px solid #e0dfdc', position: 'relative',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              cursor: 'pointer'
            }}>
              {content}
            </div>
          ) : (
            <Link key={item.to} to={item.to} style={{
              textDecoration: 'none', color: 'inherit',
              background: 'white', borderRadius: '16px', padding: '24px 16px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
              border: '1px solid #e0dfdc', position: 'relative',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}>
              {content}
            </Link>
          );
        })}
      </div>

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
    </div>
  );
}
