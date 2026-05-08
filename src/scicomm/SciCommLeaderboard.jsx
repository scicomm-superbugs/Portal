import { useLiveCollection } from '../db';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';
import { Trophy, UserCircle, TrendingUp, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AVATARS, AUTO_TAGS, calculateScore, getUnlockedTags, REACTIONS, getUserLevel } from './scicommConstants';

export default function SciCommLeaderboard() {
  const { user } = useAuth();
  const scientists = useLiveCollection('scientists') || [];
  const tasksData = useLiveCollection('tasks') || [];
  const meetingsData = useLiveCollection('scicomm_meetings') || [];
  const warningsData = useLiveCollection('scicomm_warnings') || [];

  const [timeframe, setTimeframe] = useState('all');

  const isTeam = user.role === 'scicomm' || user.role === 'admin' || user.role === 'master';

  // Only scicomm team members appear on leaderboard (not visitors, not admins/master)
  const teamMembers = scientists.filter(s => s.accountStatus !== 'pending' && s.role === 'scicomm');

  // Admins and master are shown separately at top
  const adminAccounts = scientists.filter(s => s.accountStatus !== 'pending' && (s.role === 'admin' || s.role === 'master'));

  const renderAvatar = (member, size = 48) => {
    if (member?.avatar) return <img src={member.avatar} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
    const av = AVATARS.find(a => a.id === member?.avatarId);
    if (av) return <div style={{ width: size, height: size, borderRadius: '50%', background: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.45, flexShrink: 0 }}>{av.svg}</div>;
    return <div style={{ width: size, height: size, borderRadius: '50%', background: '#eef3f8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><UserCircle size={size * 0.55} color="#666" /></div>;
  };

  const getTimeframeStart = () => {
    const now = new Date();
    if (timeframe === 'daily') return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    if (timeframe === 'weekly') { const d = new Date(now); d.setDate(d.getDate() - 7); return d.toISOString(); }
    if (timeframe === 'monthly') { const d = new Date(now); d.setMonth(d.getMonth() - 1); return d.toISOString(); }
    return null;
  };

  const getMemberScore = (s) => {
    const warnings = warningsData.filter(w => String(w.userId) === String(s.id) && w.status !== 'removed');
    if (warnings.length >= 3) return -1;
    const start = getTimeframeStart();
    const inRange = (dateStr) => !start || (dateStr && dateStr >= start);

    const taskPoints = tasksData
      .filter(t => String(t.assignedTo) === String(s.id) && (t.status === 'Completed' || t.status === 'Approved') && inRange(t.approvedAt || t.createdAt))
      .reduce((sum, t) => sum + (t.awardedPoints || 0), 0);
    const meetingsAttended = meetingsData.filter(m => (m.attendees || []).includes(s.id) && inRange(m.date)).length;
    
    return calculateScore({ taskPoints, meetingsAttended, role: s.role });
  };

  const leaderboard = teamMembers
    .map(s => ({ ...s, score: getMemberScore(s) }))
    .filter(s => s.score >= 0)
    .sort((a, b) => b.score - a.score);

  const getRankBadge = (index) => {
    if (index === 0) return { emoji: '🥇', color: '#fbbf24' };
    if (index === 1) return { emoji: '🥈', color: '#9ca3af' };
    if (index === 2) return { emoji: '🥉', color: '#d97706' };
    return { emoji: `#${index + 1}`, color: 'rgba(0,0,0,0.4)' };
  };

  // Visitor message
  if (!isTeam) {
    return (
      <div className="scicomm-feed-layout">
        <div className="scicomm-feed-main" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div className="scicomm-card scicomm-card-padding" style={{ textAlign: 'center', padding: '60px 30px' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>🏆</div>
            <h2 style={{ margin: '0 0 12px', fontSize: '24px', color: '#1e3a8a' }}>SciComm Team Leaderboard</h2>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '16px' }}>
              <Lock size={18} color="#94a3b8" />
              <span style={{ color: '#64748b', fontWeight: 600 }}>Team Members Only</span>
            </div>
            <p style={{ color: '#64748b', fontSize: '14px', lineHeight: '1.8', maxWidth: '400px', margin: '0 auto 20px' }}>
              The leaderboard is exclusively for <strong style={{ color: '#ef4444' }}>🔬 SciComm Team</strong> members who are assigned tasks and attend meetings. 
              Points are earned through task evaluations by admins and meeting attendance.
            </p>
            <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '16px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '13px', color: '#475569', lineHeight: '2' }}>
                <div>📋 Complete assigned tasks → <strong>5–50 pts</strong> (quality-based)</div>
                <div>📅 Attend meetings → <strong>15 pts</strong> each</div>
              </div>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '12px', marginTop: '16px' }}>
              Contact an admin or master to be promoted to the SciComm Team.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="scicomm-feed-layout">
      <div className="scicomm-sidebar-left hide-on-mobile">
        <div className="scicomm-card scicomm-card-padding">
          <h3 style={{ margin: '0 0 12px', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><Trophy size={18} color="#fbbf24" /> Scoring</h3>
          <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.6)', lineHeight: '2.2' }}>
            <div>📋 Task quality = <strong>5–50 pts</strong></div>
            <div>📅 Meeting attended = <strong>15 pts</strong></div>
            <div style={{ color: 'rgba(0,0,0,0.4)', fontSize: '11px', marginTop: '8px' }}>Points are awarded by admins based on task quality evaluation.</div>
          </div>
        </div>
      </div>

      <div className="scicomm-feed-main">
        {/* Top 3 Podium */}
        <div className="scicomm-card scicomm-card-padding">
          <h2 style={{ margin: '0 0 16px', fontSize: '22px', textAlign: 'center' }}>🏆 SciComm Leaderboard</h2>
          <p style={{ textAlign: 'center', fontSize: '12px', color: '#64748b', margin: '-8px 0 16px' }}>🔬 SciComm Team Members Only</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {[{id:'all',label:'All Time'},{id:'monthly',label:'Monthly'},{id:'weekly',label:'Weekly'},{id:'daily',label:'Daily'}].map(t => (
              <button key={t.id} onClick={() => setTimeframe(t.id)} style={{ padding: '6px 16px', borderRadius: '20px', border: timeframe === t.id ? 'none' : '1px solid #e0dfdc', background: timeframe === t.id ? '#1d4ed8' : 'transparent', color: timeframe === t.id ? 'white' : 'rgba(0,0,0,0.6)', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>{t.label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
            {[1, 0, 2].map(idx => {
              const person = leaderboard[idx];
              if (!person) return null;
              const isFirst = idx === 0;
              const badge = getRankBadge(idx);
              return (
                <div key={person.id} style={{ textAlign: 'center', width: isFirst ? '140px' : '110px', order: idx === 0 ? 1 : idx === 1 ? 0 : 2 }}>
                  <div style={{ fontSize: isFirst ? '36px' : '24px', marginBottom: '6px' }}>{badge.emoji}</div>
                  <Link to={`/member/${person.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    {renderAvatar(person, isFirst ? 80 : 60)}
                    <div style={{ fontWeight: 700, fontSize: '14px', marginTop: '6px', textAlign: 'center' }}>{person.name}</div>
                  </Link>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#1d4ed8', marginTop: '4px' }}>{person.score}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Full Rankings */}
        <div className="scicomm-card scicomm-card-padding">
          <h3 style={{ margin: '0 0 12px', fontSize: '18px' }}>Full Rankings</h3>
          
          {/* Admin/Master Accounts - Pinned */}
          {adminAccounts.map(s => {
            const isMe = String(s.id) === String(user.id);
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 8px', borderRadius: '8px', marginBottom: '4px', background: 'linear-gradient(90deg, #eff6ff 0%, transparent 100%)', border: '1px solid #fbbf24' }}>
                <div style={{ width: '32px', textAlign: 'center', fontSize: '20px' }}>{s.role === 'master' ? '👑' : '🛡️'}</div>
                <Link to={`/member/${s.id}`} style={{ textDecoration: 'none', flexShrink: 0 }}>{renderAvatar(s, 44)}</Link>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '15px' }}>{s.name}</span>
                    <span style={{ background: s.role === 'master' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 700 }}>{s.role === 'master' ? '👑 Master' : '🛡️ Admin'}</span>
                    {isMe && <span style={{ color: '#1d4ed8', fontSize: '11px', fontWeight: 600 }}>(You)</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: '24px', color: '#1d4ed8', lineHeight: 1 }}>∞</div>
                  <div style={{ fontSize: '10px', color: '#1d4ed8', fontWeight: 600 }}>points</div>
                </div>
              </div>
            );
          })}

          {/* SciComm Team Leaderboard */}
          {leaderboard.length === 0 && (
            <div style={{ textAlign: 'center', padding: '30px', color: '#666' }}>
              <div style={{ fontSize: '36px', marginBottom: '8px' }}>📊</div>
              <p style={{ fontSize: '14px' }}>No SciComm team members have earned points yet.</p>
            </div>
          )}
          {leaderboard.map((s, i) => {
            const badge = getRankBadge(i);
            const isMe = String(s.id) === String(user.id);
            const sLevel = getUserLevel(s.score);
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 8px', borderRadius: '8px', marginBottom: '2px', background: isMe ? '#eff6ff' : 'transparent', border: isMe ? '1px solid #bfdbfe' : '1px solid transparent' }}>
                <div style={{ width: '32px', textAlign: 'center', fontWeight: 700, fontSize: '14px', color: badge.color }}>{badge.emoji}</div>
                <Link to={`/member/${s.id}`} style={{ textDecoration: 'none', flexShrink: 0 }}>{renderAvatar(s, 40)}</Link>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{s.name}</span>
                    <span style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: 'white', padding: '2px 6px', borderRadius: '8px', fontSize: '9px', fontWeight: 700 }}>🔬</span>
                    <span style={{ background: sLevel.bg, color: sLevel.color, padding: '2px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: 700 }}>Lv. {sLevel.level}</span>
                    {isMe && <span style={{ color: '#1d4ed8', fontSize: '11px' }}>(You)</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '18px', color: '#1d4ed8' }}>{s.score}</div>
                  <div style={{ fontSize: '10px', color: 'rgba(0,0,0,0.4)' }}>points</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="scicomm-sidebar-right hide-on-mobile">
        <div className="scicomm-card scicomm-card-padding" style={{ textAlign: 'center', color: '#666', padding: '30px 20px' }}>
          <h3 style={{ fontSize: '18px', color: '#1d4ed8', marginBottom: '8px' }}>How to Earn Points</h3>
          <p style={{ fontSize: '13px', lineHeight: '1.6' }}>Complete tasks assigned by admins. Quality of work determines points awarded (5–50 pts per task).</p>
          <div style={{ fontSize: '40px', marginTop: '16px' }}>⭐</div>
        </div>
      </div>
    </div>
  );
}
