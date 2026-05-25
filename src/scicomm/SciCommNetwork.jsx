import { useLiveCollection, db } from '../db';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import { UserPlus, UserCheck, MessageCircle, UserCircle, Search, UserX, ShieldOff } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AVATARS } from './scicommConstants';

export default function SciCommNetwork() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const scientists = useLiveCollection('scientists') || [];
  const connections = useLiveCollection('scicomm_connections') || [];
  const [searchTerm, setSearchTerm] = useState('');
  const [tab, setTab] = useState('discover'); // discover | connections | pending
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) { setSearchTerm(q); setTab('discover'); }
  }, [searchParams.get('q')]);

  const activeMembers = scientists.filter(s => s.accountStatus !== 'pending' && String(s.id) !== String(user.id));

  const getAvatar = (member) => {
    if (member?.avatar) return { type: 'img', src: member.avatar };
    const av = AVATARS.find(a => a.id === member?.avatarId);
    if (av) return { type: 'emoji', emoji: av.svg, bg: av.bg };
    return { type: 'fallback' };
  };

  const renderAvatar = (member, size = 64) => {
    const av = getAvatar(member);
    if (av.type === 'img') return <img src={av.src} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />;
    if (av.type === 'emoji') return <div className="avatar-emoji" style={{ width: size, height: size, borderRadius: '50%', background: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.45 }}><span className="emoji">{av.emoji}</span></div>;
    return <div style={{ width: size, height: size, borderRadius: '50%', background: '#eef3f8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><UserCircle size={size * 0.55} color="#666" /></div>;
  };

  // Connection helpers
  const getConnectionStatus = (otherId) => {
    const conn = connections.find(c =>
      (String(c.fromId) === String(user.id) && String(c.toId) === String(otherId)) ||
      (String(c.toId) === String(user.id) && String(c.fromId) === String(otherId))
    );
    if (!conn) return { status: 'none', conn: null };
    return { status: conn.status, conn };
  };

  const handleConnect = async (otherId) => {
    const existing = getConnectionStatus(otherId);
    if (existing.status !== 'none') return;
    await db.scicomm_connections.add({
      fromId: user.id,
      fromName: user.name,
      toId: otherId,
      toName: scientists.find(s => String(s.id) === String(otherId))?.name || '',
      status: 'pending',
      createdAt: new Date().toISOString()
    });
  };

  const handleAccept = async (connId) => {
    const conn = connections.find(c => c.id === connId);
    await db.scicomm_connections.update(connId, { status: 'accepted', acceptedAt: new Date().toISOString() });
    if (conn) {
      await db.scicomm_notifications.add({
        userId: conn.fromId,
        type: 'connection_accepted',
        senderId: user.id,
        title: `${user.name.split(' ')[0]} accepted your connection request`,
        message: 'You are now connected',
        link: '/network',
        createdAt: new Date().toISOString(),
        read: false
      });
    }
  };

  const handleReject = async (connId) => {
    await db.scicomm_connections.delete(connId);
  };

  const handleRemoveConnection = async (connId) => {
    if (window.confirm('Remove this connection?')) await db.scicomm_connections.delete(connId);
  };

  const handleStartChat = async (otherId) => {
    navigate('/chat?with=' + otherId);
  };

  // Lists
  const myConnections = connections.filter(c => c.status === 'accepted' && (String(c.fromId) === String(user.id) || String(c.toId) === String(user.id)));
  const pendingReceived = connections.filter(c => c.status === 'pending' && String(c.toId) === String(user.id));
  const pendingSent = connections.filter(c => c.status === 'pending' && String(c.fromId) === String(user.id));

  const connectedIds = new Set();
  myConnections.forEach(c => {
    connectedIds.add(String(c.fromId));
    connectedIds.add(String(c.toId));
  });
  connectedIds.delete(String(user.id));

  const suggestions = activeMembers.filter(m => {
    const cs = getConnectionStatus(m.id);
    if (searchTerm) {
      // When searching, show ALL members matching the query
      return (m.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
             (m.department || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
             (m.username || '').toLowerCase().includes(searchTerm.toLowerCase());
    }
    // Without search, only show non-connected
    return cs.status === 'none';
  });

  const filteredConnections = activeMembers.filter(m => connectedIds.has(String(m.id)));

  return (
    <div className="scicomm-feed-layout">
      <div className="scicomm-sidebar-left hide-on-mobile">
        <div className="scicomm-card scicomm-card-padding">
          <h3 style={{ margin: '0 0 16px', fontSize: '16px' }}>My Network</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
            <span style={{ color: 'rgba(0,0,0,0.6)' }}>Connections</span>
            <strong style={{ color: '#1d4ed8' }}>{myConnections.length}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
            <span style={{ color: 'rgba(0,0,0,0.6)' }}>Pending Received</span>
            <strong style={{ color: pendingReceived.length > 0 ? '#ef4444' : '#f59e0b' }}>{pendingReceived.length}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span style={{ color: 'rgba(0,0,0,0.6)' }}>Sent Requests</span>
            <strong>{pendingSent.length}</strong>
          </div>
        </div>
      </div>

      <div className="scicomm-feed-main">
        {/* Tabs */}
        <div className="scicomm-card" style={{ display: 'flex', overflow: 'hidden' }}>
          {[{ id: 'discover', label: 'Discover' }, { id: 'connections', label: `Connections (${myConnections.length})` }, { id: 'pending', label: `Pending (${pendingReceived.length})`, count: pendingReceived.length }, { id: 'sent', label: `Sent (${pendingSent.length})` }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, padding: '14px 8px', border: 'none', background: tab === t.id ? '#1d4ed8' : 'transparent', position: 'relative',
              color: tab === t.id ? 'white' : 'rgba(0,0,0,0.6)', fontWeight: 600, cursor: 'pointer', fontSize: '14px', transition: 'all 0.2s'
            }}>
              {t.label}
              {t.count > 0 && <span className="tag" style={{ position: 'absolute', top: '4px', right: '10%', background: '#ef4444', color: 'white', fontSize: '10px', padding: '2px 5px', borderRadius: '10px', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(239,68,68,0.3)' }}><span className="emoji">✨</span> New</span>}
            </button>
          ))}
        </div>

        {tab === 'discover' && (
          <div className="scicomm-card scicomm-card-padding">
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#eef3f8', borderRadius: '8px', padding: '0 12px' }}>
                <Search size={16} color="#666" />
                <input type="text" placeholder="Search members..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  style={{ border: 'none', background: 'transparent', padding: '10px 8px', width: '100%', outline: 'none', fontSize: '14px' }} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
              {suggestions.map(s => {
                const cs = getConnectionStatus(s.id);
                return (
                <div key={s.id} className="scicomm-card" style={{ textAlign: 'center', padding: '16px', border: '1px solid #e0dfdc' }}>
                  <Link to={`/member/${s.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>{renderAvatar(s, 72)}</div>
                    <h4 style={{ margin: '0 0 4px', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', flexWrap: 'wrap' }}>
                      {s.name}
                      {s.role === 'master' && <span className="tag" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', fontSize: '9px', padding: '2px 6px', borderRadius: '10px', fontWeight: 700 }}><span className="emoji">👑</span></span>}
                      {s.role === 'admin' && <span className="tag" style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: 'white', fontSize: '9px', padding: '2px 6px', borderRadius: '10px', fontWeight: 700 }}><span className="emoji">🛡️</span></span>}
                      {s.role === 'scicomm' && <span className="tag" style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: 'white', fontSize: '9px', padding: '2px 6px', borderRadius: '10px', fontWeight: 700 }}><span className="emoji">🔬</span></span>}
                    </h4>
                    <p style={{ color: 'rgba(0,0,0,0.6)', margin: '0 0 12px', fontSize: '12px', height: '32px', overflow: 'hidden' }}>{s.department || 'Science Communicator'}</p>
                  </Link>
                  {cs.status === 'none' ? (
                    <button className="scicomm-btn-secondary" onClick={() => handleConnect(s.id)} style={{ width: '100%', justifyContent: 'center' }}><UserPlus size={16} /> Connect</button>
                  ) : cs.status === 'accepted' ? (
                    <button className="scicomm-btn-primary" onClick={() => navigate('/chat?with=' + s.id)} style={{ width: '100%', justifyContent: 'center' }}><MessageCircle size={16} /> Message</button>
                  ) : (cs.status === 'pending' && String(cs.conn?.toId) === String(user.id)) ? (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="scicomm-btn-primary" onClick={() => handleAccept(cs.conn.id)} style={{ flex: 1, padding: '6px', fontSize: '12px', justifyContent: 'center' }}>Accept</button>
                      <button onClick={() => handleReject(cs.conn.id)} style={{ flex: 1, padding: '6px', fontSize: '12px', border: '1px solid #e0dfdc', borderRadius: '24px', background: 'transparent', cursor: 'pointer' }}>Ignore</button>
                    </div>
                  ) : (
                    <button className="scicomm-btn-secondary" disabled style={{ width: '100%', justifyContent: 'center', opacity: 0.6 }}>⏳ Pending</button>
                  )}
                </div>
                );
              })}
              {suggestions.length === 0 && <p style={{ color: '#666', gridColumn: '1/-1', textAlign: 'center', padding: '20px' }}>No more members to discover.</p>}
            </div>
          </div>
        )}

        {tab === 'connections' && (
          <div className="scicomm-card scicomm-card-padding">
            <h3 style={{ margin: '0 0 16px', fontSize: '18px' }}>Your Connections</h3>
            {filteredConnections.length === 0 ? (
              <p style={{ color: '#666', textAlign: 'center', padding: '24px' }}>No connections yet. Start connecting!</p>
            ) : filteredConnections.map(m => {
              const conn = myConnections.find(c => String(c.fromId) === String(m.id) || String(c.toId) === String(m.id));
              return (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: '1px solid #eef3f8' }}>
                <Link to={`/member/${m.id}`} style={{ flexShrink: 0 }}>{renderAvatar(m, 48)}</Link>
                <div style={{ flex: 1 }}>
                  <Link to={`/member/${m.id}`} style={{ textDecoration: 'none', color: 'inherit' }}><div style={{ fontWeight: 600, fontSize: '14px' }}>{m.name}</div></Link>
                  <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.6)' }}>{m.department || 'Member'}</div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button className="scicomm-network-chat-btn" onClick={() => handleStartChat(m.id)} title="Chat"><MessageCircle size={15} /></button>
                  {conn && <button className="scicomm-network-remove-btn" onClick={() => handleRemoveConnection(conn.id)} title="Remove Connection"><UserX size={15} /></button>}
                </div>
              </div>
              );
            })}
          </div>
        )}

        {tab === 'pending' && (
          <div className="scicomm-card scicomm-card-padding">
            <h3 style={{ margin: '0 0 16px', fontSize: '18px' }}>Pending Requests</h3>
            {pendingReceived.length === 0 ? (
              <p style={{ color: '#666', textAlign: 'center', padding: '24px' }}>No pending requests.</p>
            ) : pendingReceived.map(c => {
              const sender = scientists.find(s => String(s.id) === String(c.fromId));
              return (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: '1px solid #eef3f8' }}>
                  <Link to={`/member/${c.fromId}`} style={{ flexShrink: 0 }}>{renderAvatar(sender, 48)}</Link>
                  <div style={{ flex: 1 }}>
                    <Link to={`/member/${c.fromId}`} style={{ textDecoration: 'none', color: 'inherit' }}><div style={{ fontWeight: 600, fontSize: '14px' }}>{c.fromName}</div></Link>
                    <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.6)' }}>wants to connect</div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="scicomm-btn-primary" style={{ padding: '6px 14px', fontSize: '13px' }} onClick={() => handleAccept(c.id)}>Accept</button>
                    <button style={{ padding: '6px 14px', fontSize: '13px', border: '1px solid #e0dfdc', borderRadius: '24px', background: 'transparent', cursor: 'pointer' }} onClick={() => handleReject(c.id)}>Ignore</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'sent' && (
          <div className="scicomm-card scicomm-card-padding">
            <h3 style={{ margin: '0 0 16px', fontSize: '18px' }}>Sent Requests</h3>
            {pendingSent.length === 0 ? (
              <p style={{ color: '#666', textAlign: 'center', padding: '24px' }}>No sent requests.</p>
            ) : pendingSent.map(c => {
              const receiver = scientists.find(s => String(s.id) === String(c.toId));
              return (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: '1px solid #eef3f8' }}>
                  <Link to={`/member/${c.toId}`} style={{ flexShrink: 0 }}>{renderAvatar(receiver, 48)}</Link>
                  <div style={{ flex: 1 }}>
                    <Link to={`/member/${c.toId}`} style={{ textDecoration: 'none', color: 'inherit' }}><div style={{ fontWeight: 600, fontSize: '14px' }}>{c.toName}</div></Link>
                    <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.6)' }}>Request sent</div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button style={{ padding: '6px 14px', fontSize: '13px', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '24px', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => handleRemoveConnection(c.id)}><UserX size={14}/> Cancel</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
