import { useLiveCollection } from '../db';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';
import { Trophy, UserCircle, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AVATARS, AUTO_TAGS, calculateScore, getUnlockedTags, REACTIONS, getUserLevel } from './scicommConstants';

export default function SciCommLeaderboard() {
  const { user } = useAuth();
  const scientists = useLiveCollection('scientists') || [];
  const postsData = useLiveCollection('scicomm_posts') || [];
  const tasksData = useLiveCollection('tasks') || [];
  const connectionsData = useLiveCollection('scicomm_connections') || [];
  const meetingsData = useLiveCollection('scicomm_meetings') || [];
  const warningsData = useLiveCollection('scicomm_warnings') || [];

  const [timeframe, setTimeframe] = useState('all'); // all | monthly | weekly | daily

  const activeMembers = scientists.filter(s => s.accountStatus !== 'pending' && s.role !== 'admin');

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
    return null; // all time
  };

  const getMemberScore = (s) => {
    const warnings = warningsData.filter(w => String(w.userId) === String(s.id) && w.status !== 'removed');
    if (warnings.length >= 3) return -1;
    const start = getTimeframeStart();
    const inRange = (dateStr) => !start || (dateStr && dateStr >= start);

    const likesReceived = postsData.filter(p => String(p.authorId) === String(s.id) && inRange(p.createdAt)).reduce((sum, p) => sum + Object.values(p.reactions || {}).reduce((ss, arr) => ss + arr.length, 0), 0);
    const completedTasks = tasksData.filter(t => String(t.assignedTo) === String(s.id) && (t.status === 'Completed' || t.status === 'Approved') && inRange(t.approvedAt || t.createdAt)).length;
    const connectionCount = connectionsData.filter(c => c.status === 'accepted' && (String(c.fromId) === String(s.id) || String(c.toId) === String(s.id)) && inRange(c.acceptedAt || c.createdAt)).length;
    const meetingsAttended = meetingsData.filter(m => (m.attendees || []).includes(s.id) && inRange(m.date)).length;
    
    return calculateScore({ completedTasks, likesReceived, connectionCount, meetingsAttended, role: s.role });
  };

  const normalLeaderboard = activeMembers
    .map(s => ({ ...s, score: getMemberScore(s) }))
    .filter(s => s.score >= 0 && s.role !== 'master')
    .sort((a, b) => b.score - a.score);

  const masterAccounts = activeMembers
    .filter(s => s.role === 'master')
    .map(s => ({ ...s, score: Infinity }));

  const getRankBadge = (index) => {
    if (index === 0) return { emoji: '🥇', color: '#fbbf24' };
    if (index === 1) return { emoji: '🥈', color: '#9ca3af' };
    if (index === 2) return { emoji: '🥉', color: '#d97706' };
    return { emoji: `#${index + 1}`, color: 'rgba(0,0,0,0.4)' };
  };

  return (
    <div className="scicomm-feed-layout">
      <div className="scicomm-sidebar-left hide-on-mobile">
        <div className="scicomm-card scicomm-card-padding">
          <h3 style={{ margin: '0 0 12px', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><Trophy size={18} color="#fbbf24" /> Scoring</h3>
          <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.6)', lineHeight: '2.2' }}>
            <div>✅ Task completed = <strong>25 pts</strong></div>
            <div>❤️ Reaction received = <strong>5 pts</strong></div>
            <div>📅 Meeting attended = <strong>15 pts</strong></div>
            <div>🤝 Connection = <strong>2 pts</strong></div>
            <div style={{ color: 'rgba(0,0,0,0.4)', fontSize: '11px' }}>Posts don't generate points to prevent spam.</div>
          </div>
        </div>
      </div>

      <div className="scicomm-feed-main">
        {/* Top 3 Podium */}
        <div className="scicomm-card scicomm-card-padding">
          <h2 style={{ margin: '0 0 16px', fontSize: '22px', textAlign: 'center' }}>🏆 SciComm Leaderboard</h2>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {[{id:'all',label:'All Time'},{id:'monthly',label:'Monthly'},{id:'weekly',label:'Weekly'},{id:'daily',label:'Daily'}].map(t => (
              <button key={t.id} onClick={() => setTimeframe(t.id)} style={{ padding: '6px 16px', borderRadius: '20px', border: timeframe === t.id ? 'none' : '1px solid #e0dfdc', background: timeframe === t.id ? '#1d4ed8' : 'transparent', color: timeframe === t.id ? 'white' : 'rgba(0,0,0,0.6)', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>{t.label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
            {[1, 0, 2].map(idx => {
              const person = normalLeaderboard[idx];
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
          
          {/* Master Accounts - Pinned at the very top */}
          {masterAccounts.map(s => {
            const isMe = String(s.id) === String(user.id);
            const pinned = (s.pinnedTags || []).filter(t => AUTO_TAGS.some(a => a.tag === t) || t === '👑 SciComm MasterMind');
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 8px', borderRadius: '8px', marginBottom: '4px', background: 'linear-gradient(90deg, #eff6ff 0%, transparent 100%)', border: '1px solid #fbbf24' }}>
                <div style={{ width: '32px', textAlign: 'center', fontSize: '20px' }}>👑</div>
                <Link to={`/member/${s.id}`} style={{ textDecoration: 'none', flexShrink: 0 }}>{renderAvatar(s, 44)}</Link>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '15px' }}>{s.name}</span>
                    <span style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 100%)', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 700 }}>Science Communication Master</span>
                    {isMe && <span style={{ color: '#1d4ed8', fontSize: '11px', fontWeight: 600 }}>(You)</span>}
                  </div>
                  {pinned.length > 0 && (
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                      {pinned.slice(0, 5).map((t, j) => {
                        const isMasterTag = t === '👑 SciComm MasterMind';
                        return <span key={j} style={{ fontSize: '10px', color: isMasterTag ? '#b45309' : '#1e3a8a', background: isMasterTag ? 'linear-gradient(135deg, #fef3c7, #fde68a)' : '#dbeafe', padding: '2px 8px', borderRadius: '10px', border: isMasterTag ? '1px solid #fde047' : '1px solid #bfdbfe', fontWeight: isMasterTag ? 700 : 400 }}>{t}</span>
                      })}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: '24px', color: '#1d4ed8', lineHeight: 1 }}>∞</div>
                  <div style={{ fontSize: '10px', color: '#1d4ed8', fontWeight: 600 }}>points</div>
                </div>
              </div>
            );
          })}

          {/* Normal Leaderboard */}
          {normalLeaderboard.map((s, i) => {
            const badge = getRankBadge(i);
            const isMe = String(s.id) === String(user.id);
            const sLevel = getUserLevel(s.score);
            const pinned = (s.pinnedTags || []).filter(t => AUTO_TAGS.some(a => a.tag === t) || t === '👑 SciComm MasterMind');
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 8px', borderRadius: '8px', marginBottom: '2px', background: isMe ? '#eff6ff' : 'transparent', border: isMe ? '1px solid #bfdbfe' : '1px solid transparent' }}>
                <div style={{ width: '32px', textAlign: 'center', fontWeight: 700, fontSize: '14px', color: badge.color }}>{badge.emoji}</div>
                <Link to={`/member/${s.id}`} style={{ textDecoration: 'none', flexShrink: 0 }}>{renderAvatar(s, 40)}</Link>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{s.name}</span>
                    <span style={{ background: sLevel.bg, color: sLevel.color, padding: '2px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: 700 }}>Lv. {sLevel.level}</span>
                    {isMe && <span style={{ color: '#1d4ed8', fontSize: '11px' }}>(You)</span>}
                  </div>
                  {pinned.length > 0 && (
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '2px' }}>
                      {pinned.slice(0, 3).map((t, j) => {
                        const isMasterTag = t === '👑 SciComm MasterMind';
                        return <span key={j} style={{ fontSize: '10px', color: isMasterTag ? '#b45309' : '#1e3a8a', background: isMasterTag ? 'linear-gradient(135deg, #fef3c7, #fde68a)' : '#eff6ff', padding: '1px 6px', borderRadius: '8px', border: isMasterTag ? '1px solid #fde047' : 'none', fontWeight: isMasterTag ? 700 : 400 }}>{t}</span>
                      })}
                    </div>
                  )}
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
          <h3 style={{ fontSize: '18px', color: '#1d4ed8', marginBottom: '8px' }}>Hidden Tags</h3>
          <p style={{ fontSize: '13px', lineHeight: '1.6' }}>Keep earning points to randomly unlock secret science achievements!</p>
          <div style={{ fontSize: '40px', marginTop: '16px' }}>🎁</div>
        </div>
      </div>
    </div>
  );
}
