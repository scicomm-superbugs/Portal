import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLiveCollection, db, uploadFile } from '../db';
import { Send, Plus, UserCircle, Users, Search, Smile, Paperclip, ArrowLeft, Image as ImageIcon, BarChart2, X, Settings, Check, Trash2, Camera, MessageSquare } from 'lucide-react';
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
  const [editingMsg, setEditingMsg] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const messagesEnd = useRef(null);

  const [activeTab, setActiveTab] = useState('chats'); // 'chats' or 'requests'
  const [chatSearch, setChatSearch] = useState('');
  const [newChatSearch, setNewChatSearch] = useState('');
  
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [groupNameEdit, setGroupNameEdit] = useState('');
  const [groupDescEdit, setGroupDescEdit] = useState('');
  const [groupMembersEdit, setGroupMembersEdit] = useState([]);

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

  // Rooms categorization
  const myRoomsRaw = rooms.filter(r => (r.members || []).includes(user.id)).sort((a, b) => new Date(b.lastMessageAt || b.createdAt || 0).getTime() - new Date(a.lastMessageAt || a.createdAt || 0).getTime());
  
  const myRooms = myRoomsRaw.filter(r => r.type === 'group' || r.status !== 'request' || r.initiator === user.id);
  const myRequests = myRoomsRaw.filter(r => r.type === 'private' && r.status === 'request' && r.initiator !== user.id);

  const displayedRooms = activeTab === 'requests' ? myRequests : myRooms;
  const filteredRooms = displayedRooms.filter(r => {
    if (!chatSearch) return true;
    const title = getRoomTitle(r).toLowerCase();
    return title.includes(chatSearch.toLowerCase());
  });

  const roomMessages = allMessages.filter(m => m.roomId === selectedRoom).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [roomMessages.length, selectedRoom]);

  const createPrivateRoom = async (otherId, otherName) => {
    const existing = rooms.find(r => r.type === 'private' && r.members?.includes(user.id) && r.members?.includes(otherId));
    if (existing) { setSelectedRoom(existing.id); return; }
    
    // Check if connected
    const isFriend = myConnectedIds.has(String(otherId));
    
    const roomId = await db.scicomm_chat_rooms.add({
      type: 'private',
      status: isFriend ? 'active' : 'request',
      initiator: user.id,
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

  const acceptRequest = async (roomId) => {
    await db.scicomm_chat_rooms.update(roomId, { status: 'active' });
    setActiveTab('chats');
  };
  
  const declineRequest = async (roomId) => {
    await db.scicomm_chat_rooms.delete(roomId);
    setSelectedRoom(null);
  };

  const openGroupSettings = () => {
    if (!activeRoom || activeRoom.type !== 'group') return;
    setGroupNameEdit(activeRoom.name || '');
    setGroupDescEdit(activeRoom.description || '');
    setGroupMembersEdit([...(activeRoom.members || [])].filter(id => id !== user.id));
    setShowGroupSettings(true);
  };
  
  const saveGroupSettings = async () => {
    const memberNames = { [user.id]: user.name };
    groupMembersEdit.forEach(id => {
      const m = scientists.find(s => String(s.id) === String(id));
      if (m) memberNames[id] = m.name;
    });
    
    await db.scicomm_chat_rooms.update(selectedRoom, {
      name: groupNameEdit,
      description: groupDescEdit,
      members: [user.id, ...groupMembersEdit],
      memberNames
    });
    setShowGroupSettings(false);
  };
  
  const updateGroupPic = async (e) => {
     const file = e.target.files?.[0];
     if (!file) return;
     try {
       const url = await uploadFile(file, `chat/${selectedRoom}/avatar_${Date.now()}`);
       await db.scicomm_chat_rooms.update(selectedRoom, { avatarUrl: url });
     } catch(err) { console.error('Upload failed'); }
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

    if (editingMsg) {
      await db.scicomm_chat_messages.update(editingMsg, { content: msgText });
      setEditingMsg(null);
      setMsgText('');
      return;
    }

    const msgData = {
      roomId: selectedRoom,
      senderId: user.id,
      senderName: user.name,
      content: msgText,
      type: replyingTo ? 'reply' : 'text',
      readBy: [user.id],
      createdAt: new Date().toISOString()
    };

    if (replyingTo) {
      msgData.replyToId = replyingTo.id;
      msgData.replyToSender = replyingTo.senderName;
      msgData.replyToContent = replyingTo.content;
    }

    await db.scicomm_chat_messages.add(msgData);
    await db.scicomm_chat_rooms.update(selectedRoom, { lastMessageAt: new Date().toISOString(), lastMessage: msgText, lastSender: user.name });
    setMsgText('');
    setReplyingTo(null);
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
  
  // New chat search spanning ALL scientists
  const filteredNewChatUsers = scientists.filter(s => 
    s.id !== user.id && (!newChatSearch || s.name.toLowerCase().includes(newChatSearch.toLowerCase()) || (s.username||'').toLowerCase().includes(newChatSearch.toLowerCase()))
  );

    <div className="scicomm-chat-container" style={{ display: 'flex', height: 'calc(100dvh - 100px)', maxWidth: '1000px', margin: '0 auto', gap: '0', overflow: 'hidden', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(16px)', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
      {/* Room List Sidebar */}
      <div style={{ width: '320px', borderRight: '1px solid rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', flexShrink: 0, background: 'rgba(255,255,255,0.4)' }} className={`scicomm-chat-sidebar ${selectedRoom ? 'chat-hide-mobile' : 'chat-show-mobile'}`}>
        
        {/* Sidebar Header */}
        <div style={{ padding: '20px 16px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, background: 'linear-gradient(90deg, #1d4ed8, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Messages</h3>
          <button onClick={() => setShowNewChat(!showNewChat)} style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', color: 'white', border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(59,130,246,0.3)', transition: 'transform 0.2s' }} onMouseOver={e=>e.currentTarget.style.transform='scale(1.05)'} onMouseOut={e=>e.currentTarget.style.transform='none'}><Plus size={20} /></button>
        </div>

        {/* Search Bar */}
        <div style={{ padding: '0 16px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '20px', padding: '8px 14px', gap: '8px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
            <Search size={16} color="#64748b" />
            <input type="text" placeholder="Search chats..." value={chatSearch} onChange={e => setChatSearch(e.target.value)} style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', fontSize: '14px', color: '#0f172a' }} />
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', padding: '0 16px', borderBottom: '1px solid rgba(0,0,0,0.05)', gap: '16px' }}>
          <button onClick={() => setActiveTab('chats')} style={{ background: 'none', border: 'none', padding: '10px 4px', fontSize: '14px', fontWeight: activeTab === 'chats' ? 700 : 500, color: activeTab === 'chats' ? '#1d4ed8' : '#64748b', borderBottom: activeTab === 'chats' ? '2px solid #1d4ed8' : '2px solid transparent', cursor: 'pointer' }}>
            Chats
          </button>
          <button onClick={() => setActiveTab('requests')} style={{ background: 'none', border: 'none', padding: '10px 4px', fontSize: '14px', fontWeight: activeTab === 'requests' ? 700 : 500, color: activeTab === 'requests' ? '#1d4ed8' : '#64748b', borderBottom: activeTab === 'requests' ? '2px solid #1d4ed8' : '2px solid transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            Requests
            {myRequests.length > 0 && <span style={{ background: '#ef4444', color: 'white', borderRadius: '10px', padding: '2px 6px', fontSize: '10px', fontWeight: 800 }}>{myRequests.length}</span>}
          </button>
        </div>

        {/* New Chat Overlay */}
        {showNewChat && (
          <div style={{ padding: '16px', borderBottom: '1px solid rgba(0,0,0,0.05)', background: 'rgba(255,255,255,0.95)', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: '#0f172a' }}>Start a Conversation</div>
            <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', borderRadius: '16px', padding: '6px 12px', gap: '8px', marginBottom: '12px' }}>
              <Search size={14} color="#64748b" />
              <input type="text" placeholder="Search people..." value={newChatSearch} onChange={e => setNewChatSearch(e.target.value)} style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', fontSize: '13px' }} />
            </div>
            
            <div style={{ maxHeight: '180px', overflowY: 'auto', paddingRight: '4px', marginBottom: '12px' }}>
              {filteredNewChatUsers.slice(0, 20).map(m => {
                const isFriend = myConnectedIds.has(String(m.id));
                return (
                  <div key={m.id} onClick={() => createPrivateRoom(m.id, m.name)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px', cursor: 'pointer', borderRadius: '12px', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {renderAvatar(m, 32)}
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{m.name}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{isFriend ? 'Connection' : 'Send Request'}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div style={{ borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#0f172a' }}>Create Group</div>
              <input type="text" placeholder="Group name..." value={newGroupName} onChange={e => setNewGroupName(e.target.value)} style={{ width: '100%', padding: '10px', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '13px', marginBottom: '8px', boxSizing: 'border-box' }} />
              <div style={{ maxHeight: '100px', overflowY: 'auto', marginBottom: '8px' }}>
                {filteredNewChatUsers.slice(0, 20).map(m => (
                  <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '6px', cursor: 'pointer', padding: '4px', borderRadius: '8px' }} onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <input type="checkbox" checked={selectedMembers.includes(m.id)} onChange={e => setSelectedMembers(e.target.checked ? [...selectedMembers, m.id] : selectedMembers.filter(id => id !== m.id))} />
                    {m.name}
                  </label>
                ))}
              </div>
              <button className="scicomm-btn-primary" onClick={createGroupRoom} style={{ width: '100%', padding: '10px', fontSize: '13px', justifyContent: 'center', borderRadius: '12px' }}>Create Group</button>
            </div>
          </div>
        )}

        {/* Room List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredRooms.map(r => {
            const unread = unreadPerRoom(r.id);
            const isGroup = r.type === 'group';
            const otherUser = getRoomOther(r);
            
            return (
              <div key={r.id} onClick={() => setSelectedRoom(r.id)} style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', cursor: 'pointer', transition: 'all 0.2s',
                background: selectedRoom === r.id ? 'rgba(59,130,246,0.1)' : 'transparent', 
                borderLeft: selectedRoom === r.id ? '4px solid #3b82f6' : '4px solid transparent',
                borderBottom: '1px solid rgba(0,0,0,0.02)'
              }} onMouseEnter={e => { if (selectedRoom !== r.id) e.currentTarget.style.background = 'rgba(0,0,0,0.02)'; }} onMouseLeave={e => { if (selectedRoom !== r.id) e.currentTarget.style.background = 'transparent'; }}>
                {isGroup ? (
                  r.avatarUrl ? <img src={r.avatarUrl} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} /> :
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #dbeafe, #bfdbfe)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}><Users size={22} color="#1d4ed8" /></div> 
                ) : renderAvatar(otherUser, 44)}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                    <span style={{ fontWeight: unread > 0 ? 800 : 600, fontSize: '15px', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getRoomTitle(r)}</span>
                    <span style={{ fontSize: '11px', color: '#94a3b8', flexShrink: 0 }}>{timeAgo(r.lastMessageAt || r.createdAt, true)}</span>
                  </div>
                  <div style={{ fontSize: '13px', color: unread > 0 ? '#1d4ed8' : '#64748b', fontWeight: unread > 0 ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {activeTab === 'requests' ? 'Sent you a message request' : (r.lastSender ? `${r.lastSender}: ${r.lastMessage || ''}` : 'No messages yet')}
                  </div>
                </div>
                {unread > 0 && (
                  <div style={{ background: '#3b82f6', color: 'white', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0, boxShadow: '0 2px 4px rgba(59,130,246,0.3)' }}>{unread > 9 ? '9+' : unread}</div>
                )}
              </div>
            );
          })}
          {filteredRooms.length === 0 && <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>No conversations found.</div>}
        </div>
      </div>

      {/* Chat Panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }} className={selectedRoom ? 'chat-show-mobile' : 'chat-hide-mobile'}>
        {selectedRoom && activeRoom ? (
          <>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)', zIndex: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button onClick={() => setSelectedRoom(null)} className="chat-back-btn" style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'none', padding: '4px', color: '#64748b' }}><ArrowLeft size={22} /></button>
                {activeRoom.type === 'group' ? (
                  activeRoom.avatarUrl ? <img src={activeRoom.avatarUrl} alt="" style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover' }} /> :
                  <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg, #dbeafe, #bfdbfe)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}><Users size={20} color="#1d4ed8" /></div>
                ) : renderAvatar(getRoomOther(activeRoom), 42)}
                <div>
                  <div style={{ fontWeight: 700, fontSize: '16px', color: '#0f172a' }}>{getRoomTitle(activeRoom)}</div>
                  {activeRoom.type === 'group' && <div style={{ fontSize: '12px', color: '#64748b' }}>{(activeRoom.members || []).length} members {activeRoom.description ? `• ${activeRoom.description}` : ''}</div>}
                  {activeRoom.type !== 'group' && <div style={{ fontSize: '12px', color: '#64748b' }}>{getRoomOther(activeRoom)?.department || 'Member'}</div>}
                </div>
              </div>
              {activeRoom.type === 'group' && (
                <button onClick={openGroupSettings} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '8px', borderRadius: '50%', transition: 'background 0.2s' }} onMouseOver={e=>e.currentTarget.style.background='#f1f5f9'} onMouseOut={e=>e.currentTarget.style.background='transparent'}><Settings size={22} /></button>
              )}
            </div>

            {/* Request Banner */}
            {activeRoom.status === 'request' && activeRoom.initiator !== user.id && (
              <div style={{ background: '#f0fdf4', borderBottom: '1px solid #bbf7d0', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#166534', fontSize: '14px' }}>Message Request</div>
                  <div style={{ color: '#15803d', fontSize: '13px' }}>{getRoomOther(activeRoom)?.name} wants to connect with you.</div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => declineRequest(activeRoom.id)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>Decline</button>
                  <button onClick={() => acceptRequest(activeRoom.id)} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#22c55e', color: 'white', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>Accept</button>
                </div>
              </div>
            )}

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', background: '#f8fafc', backgroundImage: 'radial-gradient(#e2e8f0 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
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
                      {m.type === 'reply' && m.replyToContent && (
                        <div style={{ marginBottom: '8px', padding: '8px', background: isMe ? 'rgba(255,255,255,0.2)' : '#f3f4f6', borderRadius: '8px', borderLeft: `4px solid ${isMe ? 'white' : '#1d4ed8'}` }}>
                          <div style={{ fontSize: '11px', fontWeight: 600, marginBottom: '4px', opacity: 0.8 }}>Replying to {m.replyToSender}</div>
                          <div style={{ fontSize: '12px', opacity: 0.9, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.replyToContent.substring(0, 150)}{m.replyToContent.length > 150 ? '...' : ''}</div>
                        </div>
                      )}
                      {m.content && (
                        <div style={{ 
                          unicodeBidi: 'plaintext', 
                          direction: /[\u0600-\u06FF]/.test(m.content || '') ? 'rtl' : 'ltr',
                          textAlign: /[\u0600-\u06FF]/.test(m.content || '') ? 'right' : 'left',
                          whiteSpace: 'pre-wrap', 
                          wordBreak: 'break-word'
                        }}>
                          {renderMessageText(m.content, isMe)}
                        </div>
                      )}
                      
                      {/* Reactions Display */}
                      {m.reactions && Object.keys(m.reactions).length > 0 && (
                        <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                          {Object.entries(m.reactions).map(([emoji, userIds]) => (
                            <div key={emoji} onClick={() => handleReact(m.id, emoji)} title={userIds.map(id => scientists.find(s => String(s.id) === String(id))?.name || 'User').join(', ')} style={{ background: isMe ? 'rgba(255,255,255,0.2)' : '#f1f5f9', padding: '2px 6px', borderRadius: '10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '2px', cursor: 'pointer' }}>
                              <span>{emoji}</span>
                              <span style={{ opacity: 0.8 }}>{userIds.length}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <div style={{ fontSize: '10px', marginTop: '4px', opacity: 0.7, textAlign: 'right' }}>{timeAgo(m.createdAt)}</div>
                    </div>

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
                        alignItems: 'center',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        border: '1px solid #e0dfdc',
                        zIndex: 10
                      }}>
                        {QUICK_REACTIONS.map(emoji => (
                          <span key={emoji} onClick={() => handleReact(m.id, emoji)} style={{ cursor: 'pointer', fontSize: '16px', transition: 'transform 0.1s' }} onMouseOver={e => e.currentTarget.style.transform = 'scale(1.2)'} onMouseOut={e => e.currentTarget.style.transform = 'none'}>
                            {emoji}
                          </span>
                        ))}
                        <div style={{ width: '1px', height: '16px', background: '#e0dfdc', margin: '0 4px' }} />
                        <span onClick={() => setReplyingTo(m)} style={{ cursor: 'pointer', fontSize: '11px', color: '#1d4ed8', fontWeight: 600 }}>Reply</span>
                        {isMe && <span onClick={() => { setEditingMsg(m.id); setMsgText(m.content); }} style={{ cursor: 'pointer', fontSize: '11px', color: '#1d4ed8', fontWeight: 600 }}>Edit</span>}
                        {isMe && <span onClick={() => db.scicomm_chat_messages.delete(m.id)} style={{ cursor: 'pointer', fontSize: '11px', color: '#ef4444', fontWeight: 600 }}>Remove</span>}
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
            {/* Context Banner */}
            {(replyingTo || editingMsg) && (
              <div style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.9)', borderTop: '1px solid rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', backdropFilter: 'blur(8px)' }}>
                <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <span style={{ fontWeight: 700, color: '#3b82f6' }}>{editingMsg ? 'Editing message' : `Replying to ${replyingTo.senderName}`}</span>
                  <div style={{ color: '#64748b', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{(editingMsg ? msgText : replyingTo.content)?.substring(0, 50)}...</div>
                </div>
                <button onClick={() => { setReplyingTo(null); setEditingMsg(null); setMsgText(''); }} style={{ background: '#f1f5f9', border: 'none', cursor: 'pointer', color: '#64748b', padding: '6px', borderRadius: '50%' }}><X size={16} /></button>
              </div>
            )}
            
            {activeRoom.status !== 'request' || activeRoom.initiator === user.id ? (
              <div style={{ display: 'flex', gap: '8px', padding: '14px 20px', borderTop: '1px solid rgba(0,0,0,0.05)', alignItems: 'flex-end', background: 'white' }}>
                <button onClick={() => setShowEmoji(!showEmoji)} style={{ background: '#f1f5f9', border: 'none', cursor: 'pointer', color: '#64748b', padding: '10px', borderRadius: '50%', transition: 'background 0.2s' }} onMouseOver={e=>e.currentTarget.style.background='#e2e8f0'} onMouseOut={e=>e.currentTarget.style.background='#f1f5f9'}><Smile size={20} /></button>
                <label style={{ cursor: 'pointer', color: '#64748b', padding: '10px', display: 'flex', background: '#f1f5f9', borderRadius: '50%', transition: 'background 0.2s' }} onMouseOver={e=>e.currentTarget.style.background='#e2e8f0'} onMouseOut={e=>e.currentTarget.style.background='#f1f5f9'}><Paperclip size={20} /><input type="file" onChange={handleFileUpload} style={{ display: 'none' }} /></label>
                <button onClick={() => setShowPollCreator(true)} style={{ background: '#f1f5f9', border: 'none', cursor: 'pointer', color: '#64748b', padding: '10px', borderRadius: '50%', transition: 'background 0.2s' }} onMouseOver={e=>e.currentTarget.style.background='#e2e8f0'} onMouseOut={e=>e.currentTarget.style.background='#f1f5f9'}><BarChart2 size={20} /></button>
                <textarea value={msgText} onChange={e => setMsgText(e.target.value)} 
                  placeholder="Type a message..." style={{ flex: 1, padding: '12px 16px', border: '1px solid #e2e8f0', borderRadius: '24px', fontSize: '14px', outline: 'none', minWidth: 0, resize: 'none', minHeight: '44px', maxHeight: '140px', fontFamily: 'inherit', background: '#f8fafc', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }} rows={1} />
                <button onClick={sendMessage} style={{ padding: '12px', flexShrink: 0, alignSelf: 'flex-end', borderRadius: '50%', height: '44px', width: '44px', border: 'none', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(37,99,235,0.3)', transition: 'transform 0.2s' }} onMouseOver={e=>e.currentTarget.style.transform='scale(1.05)'} onMouseOut={e=>e.currentTarget.style.transform='none'}><Send size={18} style={{ marginLeft: '2px' }} /></button>
              </div>
            ) : (
              <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '13px', background: 'white', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                You must accept the request to send messages.
              </div>
            )}

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
            {/* Group Settings Modal */}
            {showGroupSettings && (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', zIndex: 100, display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.2s' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>Group Settings</h3>
                  <button onClick={() => setShowGroupSettings(false)} style={{ background: '#f1f5f9', border: 'none', cursor: 'pointer', color: '#64748b', padding: '8px', borderRadius: '50%' }}><X size={20} /></button>
                </div>
                
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px' }}>
                    <div style={{ position: 'relative', marginBottom: '16px' }}>
                      {activeRoom.avatarUrl ? <img src={activeRoom.avatarUrl} alt="" style={{ width: 100, height: 100, borderRadius: '50%', objectFit: 'cover', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} /> : 
                      <div style={{ width: 100, height: 100, borderRadius: '50%', background: 'linear-gradient(135deg, #dbeafe, #bfdbfe)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}><Users size={48} color="#1d4ed8" /></div>}
                      <label style={{ position: 'absolute', bottom: 0, right: 0, background: '#3b82f6', color: 'white', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 8px rgba(59,130,246,0.4)' }}>
                        <Camera size={16} />
                        <input type="file" accept="image/*" onChange={updateGroupPic} style={{ display: 'none' }} />
                      </label>
                    </div>
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>Group Name</label>
                    <input type="text" value={groupNameEdit} onChange={e => setGroupNameEdit(e.target.value)} style={{ width: '100%', padding: '12px 16px', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '15px', outline: 'none', background: '#f8fafc' }} />
                  </div>

                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>Description</label>
                    <textarea value={groupDescEdit} onChange={e => setGroupDescEdit(e.target.value)} rows={2} style={{ width: '100%', padding: '12px 16px', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '15px', outline: 'none', background: '#f8fafc', resize: 'none', fontFamily: 'inherit' }} placeholder="Add a description..." />
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>Manage Members</label>
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '12px', maxHeight: '200px', overflowY: 'auto' }}>
                      {scientists.map(m => {
                        if (m.id === user.id) return null;
                        const isMember = groupMembersEdit.includes(m.id);
                        return (
                          <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px', borderRadius: '12px', background: isMember ? 'white' : 'transparent', border: isMember ? '1px solid #e2e8f0' : '1px solid transparent', marginBottom: '4px', transition: 'all 0.2s' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              {renderAvatar(m, 32)}
                              <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>{m.name}</div>
                            </div>
                            <button onClick={() => {
                              if (isMember) setGroupMembersEdit(groupMembersEdit.filter(id => id !== m.id));
                              else setGroupMembersEdit([...groupMembersEdit, m.id]);
                            }} style={{ background: isMember ? '#fee2e2' : '#e0f2fe', color: isMember ? '#ef4444' : '#0284c7', border: 'none', borderRadius: '20px', padding: '6px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                              {isMember ? 'Remove' : 'Add'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div style={{ padding: '20px', borderTop: '1px solid rgba(0,0,0,0.05)', display: 'flex', gap: '12px' }}>
                  <button onClick={() => setShowGroupSettings(false)} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: 700, fontSize: '15px', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={saveGroupSettings} style={{ flex: 2, padding: '14px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white', fontWeight: 700, fontSize: '15px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}>Save Changes</button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#94a3b8', background: 'rgba(255,255,255,0.5)' }} className="chat-hide-mobile">
            <div style={{ width: '120px', height: '120px', borderRadius: '50%', background: 'linear-gradient(135deg, #e0f2fe, #dbeafe)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', boxShadow: '0 8px 32px rgba(59,130,246,0.1)' }}>
              <MessageSquare size={48} color="#1d4ed8" />
            </div>
            <h3 style={{ margin: '0 0 12px', fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>Your Messages</h3>
            <p style={{ fontSize: '15px', margin: 0 }}>Select a conversation or start a new one.</p>
          </div>
        )}
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
      `}</style>
    </div>
  );
}
