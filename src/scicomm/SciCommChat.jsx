import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLiveCollection, db, uploadFile } from '../db';
import { Send, Plus, UserCircle, Users, Search, Smile, Paperclip, ArrowLeft, Image as ImageIcon, BarChart2, X } from 'lucide-react';
import { useSearchParams, Link } from 'react-router-dom';
import { AVATARS, timeAgo } from './scicommConstants';

export default function SciCommChat() {
  const { user } = useAuth();
  const scientists = useLiveCollection('scientists') || [];
  const rooms = useLiveCollection('scicomm_chat_rooms') || [];
  const allMessages = useLiveCollection('scicomm_chat_messages') || [];
  const connections = useLiveCollection('scicomm_connections') || [];
  const [searchParams] = useSearchParams();

  const [selectedRoom, setSelectedRoom] = useState(null);
  const [msgText, setMsgText] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const messagesEnd = useRef(null);

  // Auto-open chat if ?with= param
  useEffect(() => {
    const withId = searchParams.get('with');
    if (withId && rooms.length > 0) {
      const existing = rooms.find(r => r.type === 'private' && r.members?.includes(user.id) && r.members?.includes(withId));
      if (existing) setSelectedRoom(existing.id);
      else {
        const other = scientists.find(s => String(s.id) === String(withId));
        if (other) {
          createPrivateRoom(withId, other.name);
        }
      }
    }
  }, [searchParams.get('with'), rooms.length]);

  const renderAvatar = (member, size = 40) => {
    if (!member) return <div style={{ width: size, height: size, borderRadius: '50%', background: '#eef3f8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><UserCircle size={size * 0.6} color="#666" /></div>;
    if (member.avatar) return <img src={member.avatar} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
    const av = AVATARS.find(a => a.id === member.avatarId);
    if (av) return <div style={{ width: size, height: size, borderRadius: '50%', background: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.45, flexShrink: 0 }}>{av.svg}</div>;
    return <div style={{ width: size, height: size, borderRadius: '50%', background: '#eef3f8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><UserCircle size={size * 0.6} color="#666" /></div>;
  };

  const renderMessageText = (text, isMe) => {
    if (!text) return null;
    const parts = text.split(/(#\w+|@\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('#')) return <Link key={i} to={`/network?q=${encodeURIComponent(part.slice(1))}`} style={{ color: isMe ? '#e0f2fe' : '#0a66c2', fontWeight: 600, textDecoration: 'none' }}>{part}</Link>;
      if (part.startsWith('@')) {
        const username = part.slice(1).toLowerCase();
        const userMatch = scientists.find(s => (s.username || '').toLowerCase() === username || s.name.replace(/\s+/g, '').toLowerCase() === username);
        if (userMatch) return <Link key={i} to={`/member/${userMatch.id}`} style={{ background: isMe ? 'rgba(255,255,255,0.2)' : '#eef3f8', color: isMe ? '#fff' : '#0a66c2', padding: '2px 4px', borderRadius: '4px', fontWeight: 600, textDecoration: 'none' }}>{part}</Link>;
        return <span key={i} style={{ color: isMe ? '#e0f2fe' : '#0a66c2', fontWeight: 600 }}>{part}</span>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  // Rooms I'm in
  const myRooms = rooms.filter(r => (r.members || []).includes(user.id)).sort((a, b) => new Date(b.lastMessageAt || b.createdAt || 0).getTime() - new Date(a.lastMessageAt || a.createdAt || 0).getTime());

  // Messages for selected room
  const roomMessages = allMessages.filter(m => m.roomId === selectedRoom).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [roomMessages.length, selectedRoom]);

  const createPrivateRoom = async (otherId, otherName) => {
    const existing = rooms.find(r => r.type === 'private' && r.members?.includes(user.id) && r.members?.includes(otherId));
    if (existing) { setSelectedRoom(existing.id); return; }
    const roomId = await db.scicomm_chat_rooms.add({
      type: 'private',
      members: [user.id, otherId],
      memberNames: { [user.id]: user.name, [otherId]: otherName },
      createdAt: new Date().toISOString(),
      lastMessageAt: new Date().toISOString()
    });
    setSelectedRoom(roomId);
    setShowNewChat(false);
  };

  const createGroupRoom = async () => {
    if (!newGroupName.trim() || selectedMembers.length === 0) return;
    const memberNames = { [user.id]: user.name };
    selectedMembers.forEach(id => {
      const m = scientists.find(s => String(s.id) === String(id));
      if (m) memberNames[id] = m.name;
    });
    const roomId = await db.scicomm_chat_rooms.add({
      type: 'group',
      name: newGroupName,
      members: [user.id, ...selectedMembers],
      memberNames,
      createdAt: new Date().toISOString(),
      lastMessageAt: new Date().toISOString()
    });
    setSelectedRoom(roomId);
    setShowNewChat(false);
    setNewGroupName('');
    setSelectedMembers([]);
  };

  // Mark all messages in current room as read for current user
  useEffect(() => {
    if (!selectedRoom) return;
    const unread = allMessages.filter(m => m.roomId === selectedRoom && m.senderId !== user.id && !(m.readBy || []).includes(user.id));
    unread.forEach(m => {
      db.scicomm_chat_messages.update(m.id, { readBy: [...(m.readBy || []), user.id] }).catch(() => {});
    });
  }, [selectedRoom, allMessages.length]);

  // Count total unread messages across all rooms
  const unreadCount = allMessages.filter(m => {
    const myRoom = myRooms.find(r => r.id === m.roomId);
    return myRoom && m.senderId !== user.id && !(m.readBy || []).includes(user.id);
  }).length;

  // Unread count per room
  const unreadPerRoom = (roomId) => allMessages.filter(m =>
    m.roomId === roomId && m.senderId !== user.id && !(m.readBy || []).includes(user.id)
  ).length;

  const sendMessage = async () => {
    if (!msgText.trim() || !selectedRoom) return;
    const room = rooms.find(r => r.id === selectedRoom);
    const otherMembers = (room?.members || []).filter(id => id !== user.id);
    await db.scicomm_chat_messages.add({
      roomId: selectedRoom,
      senderId: user.id,
      senderName: user.name,
      content: msgText,
      type: 'text',
      readBy: [user.id], // sender has already read it
      createdAt: new Date().toISOString()
    });
    await db.scicomm_chat_rooms.update(selectedRoom, { lastMessageAt: new Date().toISOString(), lastMessage: msgText, lastSender: user.name });
    setMsgText('');
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedRoom) return;
    try {
      const url = await uploadFile(file, `chat/${selectedRoom}/${Date.now()}_${file.name}`);
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      await db.scicomm_chat_messages.add({
        roomId: selectedRoom, senderId: user.id, senderName: user.name,
        content: (isImage || isVideo) ? '' : file.name, fileUrl: url, fileName: file.name,
        type: isVideo ? 'video' : isImage ? 'image' : 'file',
        readBy: [user.id],
        createdAt: new Date().toISOString()
      });
      await db.scicomm_chat_rooms.update(selectedRoom, { lastMessageAt: new Date().toISOString(), lastMessage: isImage ? '📷 Photo' : `📎 ${file.name}`, lastSender: user.name });
    } catch (err) { alert('Upload failed'); }
  };

  const EMOJI_LIST = ['😀','😂','😍','🔥','👍','❤️','🎉','💡','🧪','🔬','🧬','🧲','⚗️','💀','👀','🤯','🙏','✅','❌','🚀'];
  const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
  const [showEmoji, setShowEmoji] = useState(false);
  const [hoveredMessage, setHoveredMessage] = useState(null);
  
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);

  const handleReact = async (messageId, emoji) => {
    const msg = allMessages.find(m => m.id === messageId);
    if (!msg) return;
    const currentReactions = msg.reactions || {};
    const users = currentReactions[emoji] || [];
    
    let newUsers;
    if (users.includes(user.id)) {
      newUsers = users.filter(id => id !== user.id);
    } else {
      newUsers = [...users, user.id];
    }
    
    const newReactions = { ...currentReactions };
    if (newUsers.length === 0) {
      delete newReactions[emoji];
    } else {
      newReactions[emoji] = newUsers;
    }
    
    await db.scicomm_chat_messages.update(messageId, { reactions: newReactions });
  };

  const handleVote = async (messageId, optionIdx) => {
    const msg = allMessages.find(m => m.id === messageId);
    if (!msg || msg.type !== 'poll') return;
    
    const newOptions = [...msg.poll.options];
    const votes = newOptions[optionIdx].votes || [];
    
    if (votes.includes(user.id)) {
      newOptions[optionIdx].votes = votes.filter(id => id !== user.id);
    } else {
      newOptions.forEach(opt => {
        if (opt.votes) opt.votes = opt.votes.filter(id => id !== user.id);
      });
      newOptions[optionIdx].votes = [...votes, user.id];
    }
    
    await db.scicomm_chat_messages.update(messageId, { poll: { ...msg.poll, options: newOptions } });
  };

  const sendPoll = async () => {
    if (!pollQuestion.trim() || pollOptions.some(opt => !opt.trim())) return;
    await db.scicomm_chat_messages.add({
      roomId: selectedRoom, senderId: user.id, senderName: user.name,
      type: 'poll',
      poll: {
        question: pollQuestion,
        options: pollOptions.map(opt => ({ text: opt, votes: [] }))
      },
      readBy: [user.id],
      createdAt: new Date().toISOString()
    });
    await db.scicomm_chat_rooms.update(selectedRoom, { lastMessageAt: new Date().toISOString(), lastMessage: `📊 Poll: ${pollQuestion}`, lastSender: user.name });
    setShowPollCreator(false);
    setPollQuestion('');
    setPollOptions(['', '']);
  };

  const renderTag = (senderId) => {
    const s = scientists.find(u => String(u.id) === String(senderId));
    if (!s) return null;
    const isAdm = s.role === 'admin' || s.role === 'master';
    const isTm = s.role === 'scicomm' || isAdm;
    
    if (isAdm) return <span style={{ background: '#fee2e2', color: '#b91c1c', fontSize: '10px', padding: '1px 4px', borderRadius: '4px', marginLeft: '4px', fontWeight: 600 }}>Admin</span>;
    if (isTm) return <span style={{ background: '#dcfce7', color: '#15803d', fontSize: '10px', padding: '1px 4px', borderRadius: '4px', marginLeft: '4px', fontWeight: 600 }}>Team</span>;
    return <span style={{ background: '#f1f5f9', color: '#475569', fontSize: '10px', padding: '1px 4px', borderRadius: '4px', marginLeft: '4px', fontWeight: 600 }}>Visitor</span>;
  };

  const getRoomTitle = (room) => {
    if (room.type === 'group') return room.name || 'Group Chat';
    const otherId = (room.members || []).find(id => id !== user.id);
    return room.memberNames?.[otherId] || 'Chat';
  };

  const getRoomOther = (room) => {
    if (room.type === 'group') return null;
    const otherId = (room.members || []).find(id => id !== user.id);
    return scientists.find(s => String(s.id) === String(otherId));
  };

  const activeRoom = rooms.find(r => r.id === selectedRoom);

  // Connected members for new chat
  const myConnectedIds = new Set();
  connections.filter(c => c.status === 'accepted' && (String(c.fromId) === String(user.id) || String(c.toId) === String(user.id))).forEach(c => {
    myConnectedIds.add(String(c.fromId));
    myConnectedIds.add(String(c.toId));
  });
  myConnectedIds.delete(String(user.id));
  const connectedMembers = scientists.filter(s => myConnectedIds.has(String(s.id)));

  return (
    <div className="scicomm-chat-container" style={{ display: 'flex', height: 'calc(100dvh - 100px)', maxWidth: '900px', margin: '0 auto', gap: '0', overflow: 'hidden', borderRadius: '8px', border: '1px solid #e0dfdc', background: 'white' }}>
      {/* Room List - hidden on mobile when a room is selected */}
      <div style={{ borderRight: '1px solid #e0dfdc', display: 'flex', flexDirection: 'column', flexShrink: 0 }} className={`scicomm-chat-sidebar ${selectedRoom ? 'chat-hide-mobile' : 'chat-show-mobile'}`}>
        <div style={{ padding: '12px', borderBottom: '1px solid #e0dfdc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '16px' }}>💬 Messaging</h3>
          <button onClick={() => setShowNewChat(!showNewChat)} style={{ background: '#1d4ed8', color: 'white', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={16} /></button>
        </div>

        {showNewChat && (
          <div style={{ padding: '12px', borderBottom: '1px solid #e0dfdc', background: '#f9fafb' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>New Chat</div>
            {connectedMembers.map(m => (
              <div key={m.id} onClick={() => createPrivateRoom(m.id, m.name)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px', cursor: 'pointer', borderRadius: '6px' }}
                onMouseEnter={e => e.currentTarget.style.background = '#eef3f8'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                {renderAvatar(m, 28)}
                <span style={{ fontSize: '13px' }}>{m.name}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid #e0dfdc', marginTop: '8px', paddingTop: '8px' }}>
              <input type="text" placeholder="Group name..." value={newGroupName} onChange={e => setNewGroupName(e.target.value)} style={{ width: '100%', padding: '6px 8px', border: '1px solid #e0dfdc', borderRadius: '6px', fontSize: '13px', marginBottom: '6px', boxSizing: 'border-box' }} />
              {connectedMembers.map(m => (
                <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', marginBottom: '4px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={selectedMembers.includes(m.id)} onChange={e => setSelectedMembers(e.target.checked ? [...selectedMembers, m.id] : selectedMembers.filter(id => id !== m.id))} />
                  {m.name}
                </label>
              ))}
              <button className="scicomm-btn-primary" onClick={createGroupRoom} style={{ width: '100%', padding: '6px', fontSize: '12px', marginTop: '6px', justifyContent: 'center' }}>Create Group</button>
            </div>
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {myRooms.map(r => {
            const unread = unreadPerRoom(r.id);
            return (
              <div key={r.id} onClick={() => setSelectedRoom(r.id)} style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', cursor: 'pointer',
                background: selectedRoom === r.id ? '#eef3f8' : unread > 0 ? '#f0f7ff' : 'transparent', borderBottom: '1px solid #f3f2ef'
              }}>
                {r.type === 'group' ? <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Users size={20} color="#1d4ed8" /></div> : renderAvatar(getRoomOther(r), 40)}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: unread > 0 ? 800 : 600, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getRoomTitle(r)}</div>
                  <div style={{ fontSize: '12px', color: unread > 0 ? '#1d4ed8' : 'rgba(0,0,0,0.5)', fontWeight: unread > 0 ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.lastSender ? `${r.lastSender}: ${r.lastMessage || ''}` : 'No messages yet'}</div>
                </div>
                {unread > 0 && (
                  <div style={{ background: '#1d4ed8', color: 'white', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>{unread > 9 ? '9+' : unread}</div>
                )}
              </div>
            );
          })}
          {myRooms.length === 0 && <div style={{ padding: '24px', textAlign: 'center', color: '#666', fontSize: '13px' }}>No conversations yet. Connect with team members to start chatting!</div>}
        </div>
      </div>

      {/* Chat Panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }} className={selectedRoom ? 'chat-show-mobile' : 'chat-hide-mobile'}>
        {selectedRoom && activeRoom ? (
          <>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e0dfdc', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button onClick={() => setSelectedRoom(null)} className="chat-back-btn" style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'none', padding: '4px' }}><ArrowLeft size={20} /></button>
              {activeRoom.type === 'group' ? <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Users size={18} color="#1d4ed8" /></div> : renderAvatar(getRoomOther(activeRoom), 36)}
              <div>
                <div style={{ fontWeight: 600, fontSize: '15px' }}>{getRoomTitle(activeRoom)}</div>
                {activeRoom.type === 'group' && <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.5)' }}>{(activeRoom.members || []).length} members</div>}
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', background: '#f9fafb' }}>
              {roomMessages.map(m => {
                const isMe = m.senderId === user.id;
                return (
                  <div key={m.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: '8px', position: 'relative' }}
                    onMouseEnter={() => setHoveredMessage(m.id)}
                    onMouseLeave={() => setHoveredMessage(null)}
                  >
                    <div style={{
                      maxWidth: '70%', padding: '10px 14px', borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      background: isMe ? '#1d4ed8' : 'white', color: isMe ? 'white' : 'rgba(0,0,0,0.9)',
                      border: isMe ? 'none' : '1px solid #e0dfdc', fontSize: '14px', lineHeight: '1.4',
                      position: 'relative'
                    }}>
                      {!isMe && activeRoom.type === 'group' && (
                        <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: '#1d4ed8', display: 'flex', alignItems: 'center' }}>
                          {m.senderName}
                          {renderTag(m.senderId)}
                        </div>
                      )}
                      {m.type === 'image' && m.fileUrl && <img src={m.fileUrl} alt="" style={{ maxWidth: '100%', borderRadius: '8px', marginBottom: '4px' }} />}
                      {m.type === 'video' && m.fileUrl && <video src={m.fileUrl} controls style={{ maxWidth: '100%', borderRadius: '8px', marginBottom: '4px' }} />}
                      {m.type === 'file' && m.fileUrl && <a href={m.fileUrl} target="_blank" rel="noreferrer" style={{ color: isMe ? 'white' : '#2563eb', textDecoration: 'underline' }}>📎 {m.fileName || 'File'}</a>}
                      {m.type === 'poll' && (
                        <div style={{ background: isMe ? 'rgba(255,255,255,0.1)' : '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '4px', minWidth: '200px' }}>
                          <div style={{ fontWeight: 600, marginBottom: '8px', color: isMe ? 'white' : '#0f172a' }}>{m.poll?.question}</div>
                          {m.poll?.options.map((opt, idx) => {
                            const totalVotes = m.poll.options.reduce((acc, o) => acc + (o.votes?.length || 0), 0);
                            const percent = totalVotes > 0 ? Math.round(((opt.votes?.length || 0) / totalVotes) * 100) : 0;
                            const hasVoted = opt.votes?.includes(user.id);
                            
                            return (
                              <div key={idx} onClick={() => handleVote(m.id, idx)} style={{ 
                                padding: '8px', background: isMe ? 'rgba(255,255,255,0.2)' : 'white', border: `1px solid ${hasVoted ? '#3b82f6' : '#e2e8f0'}`, borderRadius: '6px', marginBottom: '4px', cursor: 'pointer',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', position: 'relative', overflow: 'hidden'
                              }}>
                                <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${percent}%`, background: isMe ? 'rgba(255,255,255,0.1)' : '#e0f2fe', zIndex: 1 }} />
                                <span style={{ zIndex: 2, color: isMe ? 'white' : '#1e293b', fontWeight: hasVoted ? 600 : 400 }}>{opt.text}</span>
                                <span style={{ zIndex: 2, fontSize: '11px', color: isMe ? 'rgba(255,255,255,0.8)' : '#64748b' }}>{opt.votes?.length || 0} ({percent}%)</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {m.type === 'story_reply' && (
                        <div style={{ marginBottom: '8px', padding: '8px', background: isMe ? 'rgba(255,255,255,0.2)' : '#f3f4f6', borderRadius: '8px', borderLeft: `4px solid ${isMe ? 'white' : '#1d4ed8'}` }}>
                          <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', opacity: 0.9 }}>Reply to Story</div>
                          {m.storyUrl && m.storyType === 'video' && <video src={m.storyUrl} style={{ width: '100%', maxHeight: '120px', objectFit: 'cover', borderRadius: '4px', marginBottom: '4px' }} />}
                          {m.storyUrl && m.storyType !== 'video' && <img src={m.storyUrl} style={{ width: '100%', maxHeight: '120px', objectFit: 'cover', borderRadius: '4px', marginBottom: '4px' }} />}
                          {m.storyContent && <div style={{ fontSize: '13px', fontStyle: 'italic', opacity: 0.8 }}>"{m.storyContent}"</div>}
                        </div>
                      )}
                      {m.content && (
                        <div style={{ 
                          unicodeBidi: 'plaintext', 
                          direction: /[\u0600-\u06FF]/.test(m.content || '') ? 'rtl' : 'ltr',
                          textAlign: /[\u0600-\u06FF]/.test(m.content || '') ? 'right' : 'left'
                        }}>
                          {renderMessageText(m.content, isMe)}
                        </div>
                      )}
                      
                      {/* Reactions Display */}
                      {m.reactions && Object.keys(m.reactions).length > 0 && (
                        <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                          {Object.entries(m.reactions).map(([emoji, userIds]) => (
                            <div key={emoji} onClick={() => handleReact(m.id, emoji)} style={{ background: isMe ? 'rgba(255,255,255,0.2)' : '#f1f5f9', padding: '2px 6px', borderRadius: '10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '2px', cursor: 'pointer' }}>
                              <span>{emoji}</span>
                              <span style={{ opacity: 0.8 }}>{userIds.length}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <div style={{ fontSize: '10px', marginTop: '4px', opacity: 0.7, textAlign: 'right' }}>{timeAgo(m.createdAt)}</div>
                    </div>

                    {/* Quick Reactions Tooltip */}
                    {hoveredMessage === m.id && (
                      <div style={{
                        position: 'absolute',
                        top: '-30px',
                        left: isMe ? 'auto' : '10px',
                        right: isMe ? '10px' : 'auto',
                        background: 'white',
                        borderRadius: '20px',
                        padding: '4px 8px',
                        display: 'flex',
                        gap: '6px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        border: '1px solid #e0dfdc',
                        zIndex: 10
                      }}>
                        {QUICK_REACTIONS.map(emoji => (
                          <span key={emoji} onClick={() => handleReact(m.id, emoji)} style={{ cursor: 'pointer', fontSize: '16px', transition: 'transform 0.1s' }} onMouseOver={e => e.currentTarget.style.transform = 'scale(1.2)'} onMouseOut={e => e.currentTarget.style.transform = 'none'}>
                            {emoji}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={messagesEnd} />
            </div>
            {/* Emoji Picker */}
            {showEmoji && (
              <div style={{ padding: '8px 16px', borderTop: '1px solid #e0dfdc', display: 'flex', flexWrap: 'wrap', gap: '4px', background: '#f9fafb' }}>
                {EMOJI_LIST.map(e => <button key={e} onClick={() => { setMsgText(prev => prev + e); setShowEmoji(false); }} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '4px' }}>{e}</button>)}
              </div>
            )}
            <div style={{ display: 'flex', gap: '6px', padding: '10px 12px', borderTop: '1px solid #e0dfdc', alignItems: 'center' }}>
              <button onClick={() => setShowEmoji(!showEmoji)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666', padding: '4px' }}><Smile size={20} /></button>
              <label style={{ cursor: 'pointer', color: '#666', padding: '4px', display: 'flex' }}><Paperclip size={20} /><input type="file" onChange={handleFileUpload} style={{ display: 'none' }} /></label>
              <button onClick={() => setShowPollCreator(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666', padding: '4px' }}><BarChart2 size={20} /></button>
              <input type="text" value={msgText} onChange={e => setMsgText(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Type a message..." style={{ flex: 1, padding: '10px 14px', border: '1px solid #e0dfdc', borderRadius: '24px', fontSize: '14px', outline: 'none', minWidth: 0 }} />
              <button className="scicomm-btn-primary" onClick={sendMessage} style={{ padding: '10px 14px', flexShrink: 0 }}><Send size={16} /></button>
            </div>

            {/* Poll Creator Modal */}
            {showPollCreator && (
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(5px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                <div style={{ background: 'white', borderRadius: '16px', padding: '24px', maxWidth: '400px', width: '100%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Create Poll</h3>
                    <button onClick={() => setShowPollCreator(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
                  </div>
                  
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: '#475569' }}>Question</label>
                    <input type="text" value={pollQuestion} onChange={e => setPollQuestion(e.target.value)} placeholder="What's the question?" style={{ width: '100%', padding: '10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} />
                  </div>
                  
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: '#475569' }}>Options</label>
                    {pollOptions.map((opt, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        <input type="text" value={opt} onChange={e => {
                          const newOpts = [...pollOptions];
                          newOpts[idx] = e.target.value;
                          setPollOptions(newOpts);
                        }} placeholder={`Option ${idx + 1}`} style={{ flex: 1, padding: '10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px' }} />
                        {pollOptions.length > 2 && (
                          <button onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><X size={16} /></button>
                        )}
                      </div>
                    ))}
                    {pollOptions.length < 5 && (
                      <button onClick={() => setPollOptions([...pollOptions, ''])} style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '13px', fontWeight: 600, cursor: 'pointer', padding: '4px 0' }}>+ Add Option</button>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={() => setShowPollCreator(false)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>Cancel</button>
                    <button onClick={sendPoll} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#3b82f6', color: 'white', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>Send Poll</button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#666' }} className="chat-hide-mobile">
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>💬</div>
            <h3 style={{ margin: '0 0 8px' }}>Select a conversation</h3>
            <p style={{ fontSize: '14px' }}>Or start a new chat with the + button</p>
          </div>
        )}
      </div>
    </div>
  );
}
