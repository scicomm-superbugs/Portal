import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLiveCollection, db } from '../db';
import { UserCircle, MessageCircle, UserPlus, UserCheck, Award, Pin } from 'lucide-react';
import { AVATARS, calculateScore, getUnlockedTags, timeAgo, getUserLevel, AUTO_TAGS } from './scicommConstants';

export default function SciCommMemberProfile() {
  const { memberId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const scientists = useLiveCollection('scientists') || [];
  const postsData = useLiveCollection('scicomm_posts') || [];
  const tasksData = useLiveCollection('tasks') || [];
  const connectionsData = useLiveCollection('scicomm_connections') || [];
  const meetingsData = useLiveCollection('scicomm_meetings') || [];

  const member = scientists.find(s => String(s.id) === String(memberId));
  if (!member) return <div style={{ textAlign: 'center', padding: '60px', color: '#666' }}><h2>Member not found</h2></div>;

  // Redirect to own profile if viewing self
  if (String(memberId) === String(user.id)) { navigate('/profile', { replace: true }); return null; }

  const memberPosts = postsData.filter(p => String(p.authorId) === String(memberId));
  const likesReceived = memberPosts.reduce((s, p) => s + Object.values(p.reactions || {}).reduce((ss, arr) => ss + arr.length, 0), 0);
  const completedTasks = tasksData.filter(t => String(t.assignedTo) === String(memberId) && (t.status === 'Completed' || t.status === 'Approved')).length;
  const connectionCount = connectionsData.filter(c => c.status === 'accepted' && (String(c.fromId) === String(memberId) || String(c.toId) === String(memberId))).length;
  const meetingsAttended = meetingsData.filter(m => (m.attendees || []).includes(memberId)).length;
  const score = calculateScore({ completedTasks, likesReceived, connectionCount, meetingsAttended, role: member.role });
  const memberLevel = getUserLevel(score);
  const unlockedTags = getUnlockedTags(score);
  const pinnedTags = (member.pinnedTags || []).filter(t => AUTO_TAGS.some(a => a.tag === t));

  // Connection status
  const conn = connectionsData.find(c =>
    (String(c.fromId) === String(user.id) && String(c.toId) === String(memberId)) ||
    (String(c.toId) === String(user.id) && String(c.fromId) === String(memberId))
  );
  const isConnected = conn?.status === 'accepted';
  const isPending = conn?.status === 'pending';

  const handleConnect = async () => {
    if (conn) return;
    await db.scicomm_connections.add({
      fromId: user.id, fromName: user.name, toId: memberId,
      toName: member.name, status: 'pending', createdAt: new Date().toISOString()
    });
  };

  const handleRemoveConnection = async () => {
    if (conn && window.confirm('Remove connection with ' + member.name + '?')) {
      await db.scicomm_connections.delete(conn.id);
    }
  };

  const renderAvatar = (size = 120) => {
    if (member.avatar) return <img src={member.avatar} alt="" style={{ width: size, height: size, borderRadius: '50%', border: '4px solid white', objectFit: 'cover' }} />;
    const av = AVATARS.find(a => a.id === member.avatarId);
    if (av) return <div style={{ width: size, height: size, borderRadius: '50%', border: '4px solid white', background: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.45 }}>{av.svg}</div>;
    return <div style={{ width: size, height: size, borderRadius: '50%', border: '4px solid white', background: '#eef3f8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><UserCircle size={size * 0.5} color="#666" /></div>;
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '40px' }}>
      <div className="scicomm-card" style={{ overflow: 'hidden' }}>
        <div style={{ width: '100%', aspectRatio: '4 / 1', background: member.coverPhoto ? `url(${member.coverPhoto}) center/cover` : 'linear-gradient(135deg, #10b981 0%, #047857 50%, #064e3b 100%)' }}></div>
        <div style={{ padding: '0 24px 24px' }}>
          <div style={{ marginTop: '-60px', marginBottom: '12px' }}>{renderAvatar(120)}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h1 style={{ margin: '0', fontSize: '22px' }}>{member.name}</h1>
                <span style={{ background: memberLevel.bg, color: memberLevel.color, padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 700, border: `1px solid ${memberLevel.color}40` }}>
                  Lv. {memberLevel.level} {memberLevel.title}
                </span>
              </div>
              <p style={{ margin: '4px 0 6px', fontSize: '15px' }}>{member.department || 'Science Communicator'}</p>
              <p style={{ margin: 0, fontSize: '14px', color: 'rgba(0,0,0,0.6)' }}>{member.bio || 'Passionate about science communication.'}</p>
              {pinnedTags.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
                  {pinnedTags.map((t, i) => <span key={i} style={{ background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)', color: '#065f46', padding: '4px 12px', borderRadius: '16px', fontSize: '12px', fontWeight: 600, border: '1px solid #a7f3d0' }}>{t}</span>)}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {isConnected ? (
                <>
                  <button className="scicomm-btn-primary" onClick={() => navigate('/chat?with=' + memberId)} style={{ fontSize: '13px' }}><MessageCircle size={14} /> Message</button>
                  <button className="scicomm-btn-secondary" onClick={handleRemoveConnection} style={{ fontSize: '13px' }}>Remove Connection</button>
                </>
              ) : isPending ? (
                <button className="scicomm-btn-secondary" disabled style={{ fontSize: '13px' }}>⏳ Request Pending</button>
              ) : (
                <button className="scicomm-btn-primary" onClick={handleConnect} style={{ fontSize: '13px' }}><UserPlus size={14} /> Connect</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: '8px', margin: '8px 0' }}>
        {[
          { label: 'Score', value: score, color: '#10b981' },
          { label: 'Posts', value: memberPosts.length, color: '#3b82f6' },
          { label: 'Reactions', value: likesReceived, color: '#ef4444' },
          { label: 'Tasks Done', value: completedTasks, color: '#f59e0b' },
          { label: 'Connections', value: connectionCount, color: '#8b5cf6' },
          { label: 'Tags', value: unlockedTags.length, color: '#ec4899' },
        ].map((s, i) => (
          <div key={i} className="scicomm-card scicomm-card-padding" style={{ textAlign: 'center', marginBottom: 0 }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '11px', color: 'rgba(0,0,0,0.5)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Unlocked Tags */}
      {unlockedTags.length > 0 && member.role !== 'master' && (
        <div className="scicomm-card scicomm-card-padding">
          <h3 style={{ margin: '0 0 8px', fontSize: '16px' }}><Award size={18} color="#10b981" /> Achievement Tags</h3>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {unlockedTags.map((t, i) => {
              const isPinned = pinnedTags.includes(t);
              return <span key={i} style={{ background: isPinned ? 'linear-gradient(135deg, #10b981, #059669)' : '#f3f2ef', color: isPinned ? 'white' : '#333', padding: '5px 12px', borderRadius: '16px', fontSize: '12px', fontWeight: 600, border: isPinned ? 'none' : '1px solid #e0dfdc', display: 'flex', alignItems: 'center', gap: '4px' }}>{isPinned && <Pin size={12} />} {t}</span>;
            })}
          </div>
        </div>
      )}

      {/* CV */}
      {member.cvFileUrl && (
        <div className="scicomm-card scicomm-card-padding" style={{ marginTop: '8px' }}>
          <a href={member.cvFileUrl} target="_blank" rel="noreferrer" className="scicomm-btn-primary" style={{ textDecoration: 'none', display: 'inline-flex', width: '100%', justifyContent: 'center' }}>📄 View CV</a>
        </div>
      )}

      {/* Recent Posts */}
      <div className="scicomm-card scicomm-card-padding" style={{ marginTop: '8px' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: '16px' }}>Recent Posts</h3>
        {memberPosts.length === 0 ? <p style={{ color: '#666' }}>No posts yet.</p> : memberPosts.slice(0, 10).map(p => (
          <div key={p.id} style={{ padding: '10px 0', borderBottom: '1px solid #eef3f8' }}>
            <p style={{ margin: '0 0 4px', fontSize: '14px' }}>{p.content?.substring(0, 150)}{(p.content?.length || 0) > 150 ? '...' : ''}</p>
            {p.imageUrl && <img src={p.imageUrl} alt="" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', marginBottom: '4px' }} />}
            <div style={{ fontSize: '11px', color: 'rgba(0,0,0,0.4)' }}>
              👍 {Object.values(p.reactions || {}).reduce((s, a) => s + a.length, 0)} • 💬 {(p.comments || []).length} • {timeAgo(p.createdAt)}
              {p.recognized && ' • ⭐ Recognized'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
