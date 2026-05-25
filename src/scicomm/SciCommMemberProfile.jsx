import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLiveCollection, db, firestore, getCollectionName } from '../db';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { UserCircle, MessageCircle, UserPlus, UserCheck, Award, Pin, FileText, UserX } from 'lucide-react';
import { AVATARS, calculateScore, getUnlockedTags, timeAgo, getUserLevel, AUTO_TAGS } from './scicommConstants';
import SciCommVerificationBadge from './SciCommVerificationBadge';

const base64ToBlob = (base64, contentType) => {
  const byteCharacters = atob(base64);
  const byteArrays = [];
  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }
  return new Blob(byteArrays, {type: contentType});
};

const FuturisticVideoPreview = ({ videoUrl }) => {
  const [src, setSrc] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileId = videoUrl.replace('chunked://', '');
  const videoRef = useRef(null);
  
  const loadVideo = async () => {
    setLoading(true);
    try {
      const q = query(collection(firestore, getCollectionName('scicomm_file_chunks')), where('fileId', '==', fileId));
      const snap = await getDocs(q);
      const chunks = snap.docs.map(doc => doc.data()).sort((a,b) => a.chunkIndex - b.chunkIndex);
      
      if (chunks.length > 0) {
        const base64Data = chunks.map(c => c.data.split(',')[1]).join('');
        const contentType = chunks[0].data.split(',')[0].split(':')[1].split(';')[0];
        
        const blob = base64ToBlob(base64Data, contentType);
        setSrc(URL.createObjectURL(blob));
      }
    } catch (e) {
      console.error('Failed to load chunked video', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadVideo();
  }, []);

  useEffect(() => {
    if (!src || !videoRef.current) return;
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          videoRef.current.play().catch(e => console.log('Autoplay blocked', e));
        } else {
          videoRef.current.pause();
        }
      });
    }, { threshold: 0.5 });
    
    observer.observe(videoRef.current);
    
    return () => {
      if (videoRef.current) observer.unobserve(videoRef.current);
    };
  }, [src]);

  if (!src) {
    return (
      <div style={{ width: '240px', height: '135px', background: 'rgba(0,0,0,0.8)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', cursor: 'pointer', overflow: 'hidden', marginBottom: '8px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(29, 78, 216, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 15px rgba(29, 78, 216, 0.8)' }}>
          <div style={{ width: 0, height: 0, borderTop: '8px solid transparent', borderBottom: '8px solid transparent', borderLeft: '12px solid white', marginLeft: '3px' }}></div>
        </div>
        <div style={{ position: 'absolute', bottom: '8px', left: '8px', color: 'rgba(255,255,255,0.6)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '10px', height: '10px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          Loading...
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return <video ref={videoRef} src={src} controls={false} muted playsInline loop style={{ width: '240px', height: '135px', borderRadius: '12px', background: '#000', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 15px rgba(0,0,0,0.3)', marginBottom: '8px' }} />;
};

export default function SciCommMemberProfile() {
  const { memberId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const scientists = useLiveCollection('scientists') || [];
  const postsData = useLiveCollection('scicomm_posts') || [];
  const tasksData = useLiveCollection('tasks') || [];
  const connectionsData = useLiveCollection('scicomm_connections') || [];
  const meetingsData = useLiveCollection('scicomm_meetings') || [];

  useEffect(() => {
    async function trackView() {
      if (String(memberId) !== String(user.id)) {
        const target = await db.scientists.get(memberId);
        if (target) {
          const now = new Date().toISOString();
          let viewers = target.viewers || [];
          viewers = viewers.filter(v => String(v.viewerId) !== String(user.id));
          viewers.unshift({ viewerId: user.id, timestamp: now });
          if (viewers.length > 50) viewers.pop();

          await db.scientists.update(target.id, {
            profileViews: (target.profileViews || 0) + 1,
            viewers
          });
        }
      }
    }
    trackView();
  }, [memberId, user.id]);

  const member = scientists.find(s => String(s.id) === String(memberId));
  if (!member) return <div style={{ textAlign: 'center', padding: '60px', color: '#666' }}><h2>Member not found</h2></div>;

  // Removed redirect so user can preview their own profile
  const memberPosts = postsData.filter(p => String(p.authorId) === String(memberId));
  const likesReceived = memberPosts.reduce((acc, p) => {
    const reactions = p.reactions || {};
    const count = Object.values(reactions).reduce((sum, users) => sum + (users?.length || 0), 0);
    return acc + count;
  }, 0);
  const completedTasks = tasksData.filter(t => String(t.assignedTo) === String(memberId) && (t.status === 'Completed' || t.status === 'Approved')).length;
  const taskPoints = tasksData.filter(t => String(t.assignedTo) === String(memberId) && (t.status === 'Completed' || t.status === 'Approved')).reduce((s, t) => s + (t.awardedPoints || 0), 0);
  const connectionCount = connectionsData.filter(c => c.status === 'accepted' && (String(c.fromId) === String(memberId) || String(c.toId) === String(memberId))).length;
  const meetingsAttended = meetingsData.filter(m => (m.attendees || []).includes(memberId)).length;
  const score = calculateScore({ taskPoints, meetingsAttended, role: member.role });
  const memberLevel = getUserLevel(score);
  const unlockedTags = getUnlockedTags(score);
  const pinnedTags = (member.pinnedTags || []).filter(t => AUTO_TAGS.some(a => a.tag === t) || t === '👑 SciComm MasterMind');

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
    if (av) return <div className="avatar-emoji" style={{ width: size, height: size, borderRadius: '50%', border: '4px solid white', background: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.45 }}><span className="emoji">{av.svg}</span></div>;
    return <div style={{ width: size, height: size, borderRadius: '50%', border: '4px solid white', background: '#eef3f8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><UserCircle size={size * 0.5} color="#666" /></div>;
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '40px' }}>
      <div className="scicomm-card" style={{ overflow: 'visible' }}>
        <div style={{ width: '100%', aspectRatio: '4 / 1', background: member.coverPhoto ? `url(${member.coverPhoto}) center/cover` : 'linear-gradient(135deg, #1d4ed8 0%, #0f172a 50%, #020617 100%)' }}></div>
        <div style={{ padding: '0 24px 24px' }}>
          <div style={{ marginTop: '-60px', marginBottom: '12px' }}>{renderAvatar(120)}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <h1 style={{ margin: '0', fontSize: '26px', fontWeight: 800, color: '#0f172a' }}>
                  {member.name}
                  <SciCommVerificationBadge role={member.role} size={20} style={{ marginLeft: '8px' }} showTooltip={true} />
                </h1>
                <span className="tag" style={{ background: memberLevel.bg, color: memberLevel.color, padding: '4px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 800, border: `1px solid ${memberLevel.color}40`, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                  Lv. {memberLevel.level}{memberLevel.title ? ' ' + memberLevel.title : ''}
                </span>
              </div>
              <p style={{ margin: '6px 0 16px', fontSize: '16px', fontWeight: 600, color: '#1d4ed8' }}>{member.department || 'Science Communicator'}</p>
            </div>
            
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {String(memberId) === String(user.id) ? (
                <button className="scicomm-btn-secondary" onClick={() => navigate('/profile')} style={{ fontSize: '13px', background: '#eef3f8', border: 'none' }}>✏️ Back to Edit Mode</button>
              ) : isConnected ? (
                <>
                  <button className="scicomm-btn-primary" onClick={() => navigate('/chat?with=' + memberId)} style={{ fontSize: '13px' }}><MessageCircle size={14} /> Message</button>
                  <button className="scicomm-btn-secondary" onClick={handleRemoveConnection} style={{ fontSize: '13px' }}>Remove Connection</button>
                </>
              ) : conn?.status === 'pending' && String(conn.fromId) === String(user.id) ? (
                <button className="scicomm-btn-secondary" onClick={handleRemoveConnection} style={{ fontSize: '13px', color: '#ef4444' }}><UserX size={14} /> Cancel Request</button>
              ) : conn?.status === 'pending' && String(conn.toId) === String(user.id) ? (
                <button className="scicomm-btn-secondary" disabled style={{ fontSize: '13px' }}>⏳ Sent You Request</button>
              ) : (
                <button className="scicomm-btn-primary" onClick={handleConnect} style={{ fontSize: '13px' }}><UserPlus size={14} /> Connect</button>
              )}
            </div>
          </div>
              
          {/* Graphical Bio Block */}
          <div style={{ background: '#f8fafc', padding: '16px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
            <p style={{ margin: 0, fontSize: '15px', lineHeight: '1.7', color: '#334155' }}>{member.bio || 'Passionate about science communication.'}</p>
          </div>

          {/* Pinned Tags inside Header */}
          {pinnedTags.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '14px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pinned Tags</h3>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {pinnedTags.map((t, i) => {
                  const isMasterTag = t === '👑 SciComm MasterMind';
                  return <span key={i} className="tag" style={{ background: isMasterTag ? 'linear-gradient(135deg, #fef3c7, #fde68a)' : 'linear-gradient(135deg, #eff6ff, #dbeafe)', color: isMasterTag ? '#b45309' : '#1e3a8a', padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 700, border: isMasterTag ? '1px solid #fde047' : '1px solid #bfdbfe', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>{t}</span>;
                })}
              </div>
            </div>
          )}

          {/* Graphical Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '12px', padding: '16px', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
            {[
              { label: 'Score', value: score === Infinity ? 'Infinity' : score, color: score === Infinity ? '#b45309' : '#1d4ed8', icon: '✨' },
              { label: 'Posts', value: memberPosts.length, color: '#3b82f6', icon: '📝' },
              { label: 'Reactions', value: likesReceived, color: '#ef4444', icon: '❤️' },
              { label: 'Tasks Done', value: completedTasks, color: '#f59e0b', icon: '✅' },
              { label: 'Connections', value: connectionCount, color: '#8b5cf6', icon: '👥' },
              { label: 'Tags', value: unlockedTags.length, color: '#ec4899', icon: '🏷️' },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px' }}>
                <div className="emoji" style={{ fontSize: '20px', marginBottom: '4px' }}>{s.icon}</div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CV */}
      {member.cvFileUrl && (
        <div className="scicomm-card scicomm-card-padding" style={{ marginTop: '8px' }}>
          <a href={member.cvFileUrl} download={member.cvFileName || "CV_Resume.pdf"} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'center', width: '100%', padding: '12px', background: 'linear-gradient(135deg, #1d4ed8, #1e3a8a)', color: 'white', borderRadius: '8px', fontWeight: 700, fontSize: '15px', boxShadow: '0 4px 12px rgba(29, 78, 216, 0.3)', transition: 'all 0.2s' }}>
            <FileText size={20} /> Download / View CV
          </a>
        </div>
      )}

      {/* Recent Posts */}
      <div className="scicomm-card scicomm-card-padding" style={{ marginTop: '8px' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: '16px' }}>Recent Posts</h3>
        {memberPosts.length === 0 ? <p style={{ color: '#666' }}>No posts yet.</p> : memberPosts.slice(0, 10).map(p => (
          <div key={p.id} style={{ padding: '10px 0', borderBottom: '1px solid #eef3f8' }}>
            <p style={{ margin: '0 0 4px', fontSize: '14px' }}>{p.content?.substring(0, 150)}{(p.content?.length || 0) > 150 ? '...' : ''}</p>
            {p.imageUrl && <img src={p.imageUrl} alt="" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', marginBottom: '4px', objectFit: 'cover' }} />}
            {p.videoUrl && <FuturisticVideoPreview videoUrl={p.videoUrl} />}
            <div style={{ fontSize: '11px', color: 'rgba(0,0,0,0.4)' }}>
              <span className="emoji">👍</span> {Object.values(p.reactions || {}).reduce((s, a) => s + a.length, 0)} • <span className="emoji">💬</span> {(p.comments || []).length} • {timeAgo(p.createdAt)}
              {p.recognized && <span> • <span className="emoji">⭐</span> Recognized</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
