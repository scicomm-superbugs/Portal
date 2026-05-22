import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, useLiveCollection, uploadFile } from '../db';
import { Search, Plus, MessageSquare, Image, Video, FileText, Send, MoreHorizontal, UserCircle, Settings, Trash2, X, ChevronLeft, ArrowLeft, Users, Lock, AtSign, Smile } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AVATARS, timeAgo } from './scicommConstants';
import ImageCropperModal from './ImageCropperModal';

export default function SciCommChat() {
  const { user } = useAuth();
  const scientists = useLiveCollection('scientists') || [];
  const allMessages = useLiveCollection('scicomm_chat_messages') || [];
  const chatRooms = useLiveCollection('scicomm_chat_rooms') || [];
  const connections = useLiveCollection('scicomm_connections') || [];
  
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [msgText, setMsgText] = useState('');
  const fileInputRef = useRef(null);
  const [fileUploading, setFileUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [roomSearch, setRoomSearch] = useState('');
  const [activeTab, setActiveTab] = useState('chats'); // chats, requests
  const [showEmoji, setShowEmoji] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMsg, setEditingMsg] = useState(null);
  const [hoveredMessage, setHoveredMessage] = useState(null);
  const [activeMsgMenu, setActiveMsgMenu] = useState(null);
  const [swipeState, setSwipeState] = useState({ id: null, startX: 0, currentX: 0 });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [highlightedMsgId, setHighlightedMsgId] = useState(null);
  const isAdmin = user.role === 'admin' || user.role === 'master';
  const EMOJI_LIST = ['😀','😂','😍','🥳','👏','🔥','❤️','💡','🧪','🧬','🔬','⚗️','🎉','👍','🙌','💪','🤔','😎','🤩','✨'];

  // Overlay states
  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [showChatMenu, setShowChatMenu] = useState(false);

  // Mentions logic
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const myRooms = chatRooms.filter(r => (r.members || []).includes(user.id))
    .sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
  
  const myRequests = myRooms.filter(r => r.status === 'request' && r.initiator !== user.id);
  const myActiveRooms = myRooms.filter(r => r.status !== 'request' || r.initiator === user.id);

  const activeRoom = myRooms.find(r => r.id === selectedRoom);
  const roomMessages = allMessages.filter(m => {
    if (m.roomId !== selectedRoom) return false;
    if (activeRoom?.clearedAt?.[user.id]) {
      if (new Date(m.createdAt) < new Date(activeRoom.clearedAt[user.id])) return false;
    }
    return true;
  }).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const myConnectedIds = new Set(connections
    .filter(c => c.status === 'accepted' && (String(c.fromId) === String(user.id) || String(c.toId) === String(user.id)))
    .map(c => String(c.fromId) === String(user.id) ? String(c.toId) : String(c.fromId)));

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [selectedRoom, roomMessages.length]);

  const mentionSuggestions = activeRoom ? [
    ...(activeRoom.type === 'group' && (!mentionQuery || 'all'.includes(mentionQuery.toLowerCase())) ? [{ id: 'all', name: 'All Members', username: 'all' }] : []),
    ...scientists.filter(s => 
      activeRoom.members.includes(s.id) && 
      String(s.id) !== String(user.id) &&
      (!mentionQuery || 
       s.name.toLowerCase().includes(mentionQuery.toLowerCase()) || 
       (s.username || '').toLowerCase().includes(mentionQuery.toLowerCase()))
    )
  ].slice(0, 5) : [];

  const handleInputChange = (val) => {
    setMsgText(val);
    const atIdx = val.lastIndexOf('@');
    if (atIdx >= 0) {
      const afterAt = val.slice(atIdx + 1);
      if (!afterAt.includes(' ')) {
        setMentionQuery(afterAt);
        setShowMentions(true);
        return;
      }
    }
    setShowMentions(false);
  };

  const insertMention = (person) => {
    const atIdx = msgText.lastIndexOf('@');
    const prefix = msgText.slice(0, atIdx);
    const username = person.username || person.name.replace(/\s+/g, '');
    setMsgText(prefix + '@' + username + ' ');
    setShowMentions(false);
  };

  // Group Settings states
  const [groupNameEdit, setGroupNameEdit] = useState('');
  const [groupDescEdit, setGroupDescEdit] = useState('');
  const [groupAvatarEdit, setGroupAvatarEdit] = useState('');
  const [groupMembersEdit, setGroupMembersEdit] = useState([]);
  const [cropGroupImageSrc, setCropGroupImageSrc] = useState(null);
  
  // New Room states
  const [newChatSearch, setNewChatSearch] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);

  const filteredActiveRooms = myActiveRooms.filter(r => {
    if (r.hiddenFor?.includes(user.id)) return false;
    const title = r.type === 'group' ? r.name : (r.memberNames?.[r.members.find(id => id !== user.id)] || 'Chat');
    return title.toLowerCase().includes(roomSearch.toLowerCase());
  });

  const filteredNewChatUsers = scientists.filter(s => 
    String(s.id) !== String(user.id) && 
    (s.name.toLowerCase().includes(newChatSearch.toLowerCase()) || (s.username || '').toLowerCase().includes(newChatSearch.toLowerCase()))
  );

  const getRoomOther = (room) => {
    if (!room) return null;
    const otherId = room.members.find(id => id !== user.id);
    return scientists.find(s => String(s.id) === String(otherId));
  };

  const getRoomTitle = (room) => {
    if (!room) return '';
    if (room.type === 'group') return room.name;
    const other = getRoomOther(room);
    return other?.name || room.memberNames?.[room.members.find(id => id !== user.id)] || 'Chat';
  };

  const renderAvatar = (person, size = 40) => {
    if (person?.avatar) return <img src={person.avatar} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />;
    const av = AVATARS.find(a => a.id === person?.avatarId);
    if (av) return <div style={{ width: size, height: size, borderRadius: '50%', background: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4 }}>{av.svg}</div>;
    return <UserCircle size={size} color="#94a3b8" />;
  };

  const createPrivateRoom = async (otherId, otherName) => {
    const existing = chatRooms.find(r => r.type === 'private' && r.members.includes(user.id) && r.members.includes(otherId));
    if (existing) {
      setSelectedRoom(existing.id);
      setShowNewChat(false);
      setMobileSidebarOpen(false);
      return;
    }
    const isFriend = myConnectedIds.has(String(otherId));
    const roomId = await db.scicomm_chat_rooms.add({
      type: 'private',
      members: [user.id, otherId],
      memberNames: { [user.id]: user.name, [otherId]: otherName },
      createdAt: new Date().toISOString(),
      lastMessageAt: new Date().toISOString(),
      initiator: user.id,
      status: isFriend ? 'active' : 'request'
    });
    setSelectedRoom(roomId);
    setShowNewChat(false);
    setMobileSidebarOpen(false);
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
      lastMessageAt: new Date().toISOString(),
      status: 'active'
    });

    selectedMembers.forEach(memberId => {
      db.scicomm_notifications.add({
        userId: memberId,
        type: 'group_added',
        senderId: user.id,
        title: `${user.name.split(' ')[0]} added you to a group chat`,
        message: newGroupName,
        link: '/chat',
        createdAt: new Date().toISOString(),
        read: false
      }).catch(console.error);
    });

    setSelectedRoom(roomId);
    setShowNewGroup(false);
    setNewGroupName('');
    setSelectedMembers([]);
    setMobileSidebarOpen(false);
  };

  const acceptRequest = async (roomId) => {
    try {
      await db.scicomm_chat_rooms.update(roomId, { status: 'active' });
      setSelectedRoom(roomId);
      setActiveTab('chats');
    } catch (e) {
      console.error(e);
      alert('Error accepting request: ' + e.message);
    }
  };

  const declineRequest = async (roomId) => {
    setDeleteConfirm({
      title: 'Decline Request',
      message: 'Are you sure you want to decline this message request?',
      onConfirm: async () => {
        try {
          await db.scicomm_chat_rooms.delete(roomId);
          if (selectedRoom === roomId) setSelectedRoom(null);
        } catch (e) {
          console.error(e);
          alert('Error declining request: ' + e.message);
        }
        setDeleteConfirm(null);
      }
    });
  };

  const openGroupSettings = () => {
    if (!activeRoom) return;
    setGroupNameEdit(activeRoom.name || '');
    setGroupDescEdit(activeRoom.description || '');
    setGroupAvatarEdit(activeRoom.avatar || '');
    setGroupMembersEdit(activeRoom.members.filter(id => id !== user.id));
    setShowGroupSettings(true);
  };

  const saveGroupSettings = async () => {
    // Read the freshest room data to preserve any members added/removed via the Add Members overlay
    const freshRoom = chatRooms.find(r => r.id === selectedRoom);
    const currentMembers = freshRoom?.members || [user.id, ...groupMembersEdit];
    const memberNames = {};
    currentMembers.forEach(id => {
      const m = scientists.find(s => String(s.id) === String(id));
      if (m) memberNames[id] = m.name;
      else if (String(id) === String(user.id)) memberNames[id] = user.name;
    });
    await db.scicomm_chat_rooms.update(selectedRoom, {
      name: groupNameEdit,
      description: groupDescEdit,
      avatar: groupAvatarEdit,
      members: currentMembers,
      memberNames
    });

    setShowGroupSettings(false);
  };

  const handleGroupCropComplete = async (croppedFile) => {
    setCropGroupImageSrc(null);
    try {
      const url = await uploadFile(croppedFile, `groups/${user.id}_${Date.now()}`);
      setGroupAvatarEdit(url);
    } catch (e) {
      console.error(e);
      alert('Failed to upload image.');
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedRoom) return;
    setFileUploading(true);
    setUploadProgress(0);

    try {
      const path = `chats/${selectedRoom}/${user.id}_${Date.now()}_${file.name}`;
      const downloadUrl = await uploadFile(file, path, (progress) => {
        setUploadProgress(progress);
      });

      const msgData = {
        roomId: selectedRoom,
        senderId: user.id,
        senderName: user.name,
        content: `Sent an attachment: ${file.name}`,
        type: 'file',
        fileUrl: downloadUrl,
        fileName: file.name,
        fileType: file.type,
        readBy: [user.id],
        createdAt: new Date().toISOString()
      };
      
      await db.scicomm_chat_messages.add(msgData);

      await db.scicomm_chat_rooms.update(selectedRoom, {
        lastMessageAt: new Date().toISOString(),
        lastMessage: `📎 ${file.name}`,
        lastSender: user.name,
        hiddenFor: []
      });

    } catch (err) {
      console.error('File upload failed:', err);
      alert('File upload failed: ' + err.message);
    } finally {
      setFileUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

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

    const roomUpdates = { 
      lastMessageAt: new Date().toISOString(), 
      lastMessage: msgText, 
      lastSender: user.name,
      hiddenFor: []
    };

    if (activeRoom.type === 'private') {
      const otherUserId = activeRoom.members.find(id => id !== user.id);
      if (activeRoom.hiddenFor?.includes(otherUserId) && !myConnectedIds.has(otherUserId)) {
        roomUpdates.status = 'request';
        roomUpdates.initiator = user.id;
      }
    }

    await db.scicomm_chat_rooms.update(selectedRoom, roomUpdates);
    
    // Mentions Notification
    const mentions = msgText.match(/@\w+/g) || [];
    const notifiedIds = new Set();
    
    mentions.forEach(mention => {
      const username = mention.slice(1).toLowerCase();
      
      if (username === 'all' && activeRoom?.type === 'group') {
        activeRoom.members.forEach(memberId => {
          if (String(memberId) !== String(user.id) && !notifiedIds.has(String(memberId))) {
            notifiedIds.add(String(memberId));
            db.scicomm_notifications.add({
              userId: memberId, type: 'mention',
              senderId: user.id,
              title: `${user.name} mentioned everyone in ${activeRoom.name}`,
              message: msgText.substring(0, 50) + '...',
              link: `/chat`, createdAt: new Date().toISOString(), read: false
            }).catch(() => {});
          }
        });
        return;
      }
      
      const userMatch = scientists.find(s => (s.username || '').toLowerCase() === username || s.name.replace(/\s+/g, '').toLowerCase() === username);
      if (userMatch && activeRoom?.members.includes(userMatch.id) && String(userMatch.id) !== String(user.id) && !notifiedIds.has(String(userMatch.id))) {
        notifiedIds.add(String(userMatch.id));
        db.scicomm_notifications.add({
          userId: userMatch.id, type: 'mention',
          senderId: user.id,
          title: `${user.name} mentioned you in a chat`,
          message: msgText.substring(0, 50) + '...',
          link: `/chat`, createdAt: new Date().toISOString(), read: false
        }).catch(() => {});
      }
    });

    setMsgText('');
    setReplyingTo(null);
  };

  const handleDeleteMessage = async (msg) => {
    const isMe = msg.senderId === user.id;
    setDeleteConfirm({
      title: 'Delete Message',
      message: 'Are you sure you want to delete this message? It will be replaced with a deleted notice.',
      onConfirm: async () => {
        try { 
          await db.scicomm_chat_messages.update(msg.id, { 
            deleted: true, 
            deletedBy: isMe ? 'user' : 'admin',
            deletedByName: user.name
          }); 
        } catch (e) { console.error(e); }
        setDeleteConfirm(null);
      }
    });
  };

  const handleLeaveGroup = async () => {
    if (!activeRoom || activeRoom.type !== 'group') return;
    setDeleteConfirm({
      title: 'Leave Group',
      message: 'Are you sure you want to leave this group?',
      onConfirm: async () => {
        const newMembers = activeRoom.members.filter(id => id !== user.id);
        const newNames = { ...activeRoom.memberNames };
        delete newNames[user.id];
        await db.scicomm_chat_rooms.update(activeRoom.id, { members: newMembers, memberNames: newNames });
        
        await db.scicomm_chat_messages.add({
          roomId: activeRoom.id, senderId: 'system', senderName: 'System',
          content: `${user.name} left the group.`,
          type: 'system', readBy: [], createdAt: new Date().toISOString()
        });
        setSelectedRoom(null);
        setShowChatMenu(false);
        setDeleteConfirm(null);
      }
    });
  };

  const handleDeleteChat = async () => {
    if (!activeRoom) return;
    setDeleteConfirm({
      title: 'Delete Chat',
      message: 'Are you sure you want to delete this chat from your view? Admins can still restore it.',
      onConfirm: async () => {
        const hiddenFor = activeRoom.hiddenFor || [];
        const clearedAt = activeRoom.clearedAt || {};
        const updateData = { clearedAt: { ...clearedAt, [user.id]: new Date().toISOString() } };
        if (!hiddenFor.includes(user.id)) {
          updateData.hiddenFor = [...hiddenFor, user.id];
        }
        await db.scicomm_chat_rooms.update(activeRoom.id, updateData);
        setSelectedRoom(null);
        setShowChatMenu(false);
        setDeleteConfirm(null);
      }
    });
  };

  const handlePromoteToAdmin = async (memberId) => {
    if (!activeRoom || activeRoom.type !== 'group') return;
    const admins = activeRoom.admins || [];
    if (!admins.includes(memberId)) {
      await db.scicomm_chat_rooms.update(activeRoom.id, { admins: [...admins, memberId] });
      await db.scicomm_chat_messages.add({
        roomId: activeRoom.id, senderId: 'system', senderName: 'System',
        content: `${scientists.find(s=>s.id===memberId)?.name} was promoted to group admin.`,
        type: 'system', readBy: [], createdAt: new Date().toISOString()
      });
    }
  };

  const handleReplyClick = (replyToId) => {
    if (!replyToId) return;
    const msgEl = document.getElementById(`msg-${replyToId}`);
    if (msgEl) {
      msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMsgId(replyToId);
      setTimeout(() => setHighlightedMsgId(null), 2000);
    }
  };

  const unreadPerRoom = (roomId) => allMessages.filter(m =>
    m.roomId === roomId && m.senderId !== user.id && !(m.readBy || []).includes(user.id)
  ).length;

  useEffect(() => {
    if (!selectedRoom) return;
    const unread = allMessages.filter(m => m.roomId === selectedRoom && m.senderId !== user.id && !(m.readBy || []).includes(user.id));
    unread.forEach(m => {
      db.scicomm_chat_messages.update(m.id, { readBy: [...(m.readBy || []), user.id] }).catch(() => {});
    });
  }, [selectedRoom, allMessages.length]);

  return (
    <div className="scicomm-chat-container" style={{ 
      display: 'flex', 
      height: 'calc(100vh - 100px)', 
      background: '#f8fafc', 
      overflow: 'hidden',
      borderRadius: '16px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
      marginTop: '2px',
      position: 'relative',
      width: '100%'
    }}>
      {/* Sidebar */}
      <div className={`scicomm-chat-sidebar ${mobileSidebarOpen ? 'open' : ''}`} style={{ 
        width: '360px', 
        background: 'white', 
        borderRight: '1px solid #e2e8f0', 
        display: 'flex', 
        flexDirection: 'column',
        position: 'relative',
        zIndex: 100
      }}>
        <div style={{ padding: '24px 20px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px' }}>Messages</h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowNewChat(true)} style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#eff6ff', color: '#1d4ed8', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="New Chat"><MessageSquare size={20} /></button>
              <button onClick={() => setShowNewGroup(true)} style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#f0fdf4', color: '#166534', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="New Group"><Plus size={24} /></button>
            </div>
          </div>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', background: '#f1f5f9', borderRadius: '14px', padding: '10px 16px', gap: '10px' }}>
            <Search size={18} color="#64748b" />
            <input 
              type="text" 
              placeholder="Search conversations..." 
              value={roomSearch} 
              onChange={e => setRoomSearch(e.target.value)} 
              style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '14px', fontWeight: 500 }} 
            />
          </div>
        </div>

        <div style={{ display: 'flex', padding: '0 20px', gap: '20px', borderBottom: '1px solid #f1f5f9' }}>
          <button onClick={() => setActiveTab('chats')} style={{ background: 'none', border: 'none', padding: '12px 4px', fontSize: '14px', fontWeight: activeTab === 'chats' ? 800 : 500, color: activeTab === 'chats' ? '#1d4ed8' : '#64748b', borderBottom: activeTab === 'chats' ? '2px solid #1d4ed8' : '2px solid transparent', cursor: 'pointer' }}>Chats</button>
          <button onClick={() => setActiveTab('requests')} style={{ background: 'none', border: 'none', padding: '12px 4px', fontSize: '14px', fontWeight: activeTab === 'requests' ? 800 : 500, color: activeTab === 'requests' ? '#1d4ed8' : '#64748b', borderBottom: activeTab === 'requests' ? '2px solid #1d4ed8' : '2px solid transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            Requests
            {myRequests.length > 0 && <span style={{ background: '#ef4444', color: 'white', borderRadius: '10px', padding: '2px 6px', fontSize: '10px', fontWeight: 800 }}>{myRequests.length}</span>}
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
          {activeTab === 'chats' ? (
            filteredActiveRooms.length > 0 ? filteredActiveRooms.map(r => {
              const unread = unreadPerRoom(r.id);
              const isActive = selectedRoom === r.id;
              const other = getRoomOther(r);
              return (
                <div key={r.id} onClick={() => { setSelectedRoom(r.id); setMobileSidebarOpen(false); }} style={{ 
                  display: 'flex', gap: '12px', padding: '12px', borderRadius: '16px', cursor: 'pointer', transition: 'all 0.2s',
                  background: isActive ? '#f0f7ff' : 'transparent',
                  marginBottom: '4px'
                }} onMouseEnter={e => !isActive && (e.currentTarget.style.background = '#f8fafc')} onMouseLeave={e => !isActive && (e.currentTarget.style.background = 'transparent')}>
                <div style={{ position: 'relative' }}>
                    {r.type === 'group' ? (
                      r.avatar ? (
                        <img src={r.avatar} alt="Group" style={{ width: 48, height: 48, borderRadius: '16px', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: 48, height: 48, borderRadius: '16px', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Users size={24} color="white" /></div>
                      )
                    ) : renderAvatar(other, 48)}
                    {unread > 0 && <div style={{ position: 'absolute', top: '-4px', right: '-4px', background: '#1d4ed8', color: 'white', borderRadius: '50%', width: '20px', height: '20px', fontSize: '10px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid white' }}>{unread}</div>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <div style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{getRoomTitle(r)}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>{timeAgo(r.lastMessageAt)}</div>
                    </div>
                    <div style={{ fontSize: '13px', color: unread > 0 ? '#1e293b' : '#64748b', fontWeight: unread > 0 ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.lastSender === user.name ? 'You: ' : ''}{r.lastMessage || 'Start a conversation'}
                    </div>
                  </div>
                </div>
              );
            }) : <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>No conversations found.</div>
          ) : (
            myRequests.map(r => (
              <div key={r.id} onClick={() => { setSelectedRoom(r.id); setMobileSidebarOpen(false); }} style={{ display: 'flex', gap: '12px', padding: '12px', borderRadius: '16px', cursor: 'pointer', background: selectedRoom === r.id ? '#fef2f2' : 'transparent' }}>
                {renderAvatar(getRoomOther(r), 48)}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '15px' }}>{getRoomTitle(r)}</div>
                  <div style={{ fontSize: '13px', color: '#dc2626', fontWeight: 600 }}>New Message Request</div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* New Chat Overlay */}
        {showNewChat && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'white', zIndex: 110, display: 'flex', flexDirection: 'column', animation: 'slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
            <div style={{ padding: '24px 20px', display: 'flex', alignItems: 'center', gap: '16px', borderBottom: '1px solid #f1f5f9' }}>
              <button onClick={() => setShowNewChat(false)} style={{ background: '#f1f5f9', border: 'none', color: '#64748b', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><ChevronLeft size={24} /></button>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 900 }}>New Chat</h3>
            </div>
            <div style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', borderRadius: '14px', padding: '12px 16px', gap: '10px' }}>
                <Search size={18} color="#64748b" />
                <input type="text" placeholder="Search people..." value={newChatSearch} onChange={e => setNewChatSearch(e.target.value)} style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '14px' }} />
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px 20px' }}>
              {filteredNewChatUsers.map(u => (
                <div key={u.id} onClick={() => createPrivateRoom(u.id, u.name)} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 16px', borderRadius: '16px', cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background='#f8fafc'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                  {renderAvatar(u, 44)}
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '15px' }}>{u.name}</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>{u.department || 'Member'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* New Group Overlay */}
        {showNewGroup && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'white', zIndex: 110, display: 'flex', flexDirection: 'column', animation: 'slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
            <div style={{ padding: '24px 20px', display: 'flex', alignItems: 'center', gap: '16px', borderBottom: '1px solid #f1f5f9' }}>
              <button onClick={() => setShowNewGroup(false)} style={{ background: '#f1f5f9', border: 'none', color: '#64748b', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><ChevronLeft size={24} /></button>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 900 }}>Create Group</h3>
            </div>
            <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#94a3b8', letterSpacing: '1px', marginBottom: '8px' }}>GROUP NAME</label>
                <input type="text" placeholder="Enter group name..." value={newGroupName} onChange={e => setNewGroupName(e.target.value)} style={{ width: '100%', padding: '14px 18px', borderRadius: '14px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '15px', outline: 'none', transition: 'border-color 0.2s' }} />
              </div>
              <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#94a3b8', letterSpacing: '1px' }}>SELECT MEMBERS ({selectedMembers.length})</label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', borderRadius: '14px', padding: '12px 16px', gap: '10px', marginBottom: '16px' }}>
                <Search size={18} color="#64748b" />
                <input type="text" placeholder="Search people..." value={newChatSearch} onChange={e => setNewChatSearch(e.target.value)} style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '14px' }} />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                {selectedMembers.map(id => {
                  const m = scientists.find(s => String(s.id) === String(id));
                  return (
                    <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#eff6ff', color: '#1d4ed8', padding: '6px 10px', borderRadius: '10px', fontSize: '12px', fontWeight: 700 }}>
                      {m?.name} <X size={12} style={{ cursor: 'pointer' }} onClick={() => setSelectedMembers(selectedMembers.filter(mid => mid !== id))} />
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {filteredNewChatUsers.slice(0, 30).map(u => (
                  <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '10px 16px', borderRadius: '16px', cursor: 'pointer', background: selectedMembers.includes(u.id) ? '#f0f7ff' : 'transparent' }}>
                    <input type="checkbox" checked={selectedMembers.includes(u.id)} onChange={e => setSelectedMembers(e.target.checked ? [...selectedMembers, u.id] : selectedMembers.filter(id => id !== u.id))} style={{ width: 18, height: 18, borderRadius: '6px' }} />
                    {renderAvatar(u, 36)}
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{u.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div style={{ padding: '20px', borderTop: '1px solid #f1f5f9' }}>
              <button onClick={createGroupRoom} disabled={!newGroupName.trim() || selectedMembers.length === 0} style={{ width: '100%', padding: '16px', borderRadius: '14px', border: 'none', background: '#1d4ed8', color: 'white', fontWeight: 800, fontSize: '16px', cursor: 'pointer', opacity: (!newGroupName.trim() || selectedMembers.length === 0) ? 0.6 : 1, boxShadow: '0 10px 25px rgba(29,78,216,0.3)' }}>Create Group</button>
            </div>
          </div>
        )}
      </div>

      {/* Main Chat Area */}
      <div className="scicomm-chat-main" style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        position: 'relative', 
        width: '100%',
        minWidth: 0,
        overflow: 'hidden'
      }}>
        {activeRoom ? (
          <>
            {/* Chat Header */}
            <div className="chat-header" style={{ height: '70px', background: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', zIndex: 50 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <button onClick={() => setMobileSidebarOpen(true)} className="chat-show-mobile" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', marginLeft: '-8px', flexShrink: 0 }}><ArrowLeft size={24} /></button>
                {activeRoom.type === 'group' ? (
                  activeRoom.avatar ? (
                    <img src={activeRoom.avatar} alt="Group" style={{ width: 44, height: 44, borderRadius: '14px', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: 44, height: 44, borderRadius: '14px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Users size={22} color="#1d4ed8" /></div>
                  )
                ) : renderAvatar(getRoomOther(activeRoom), 44)}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: '15px', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{getRoomTitle(activeRoom)}</div>
                  <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeRoom.type === 'group' ? `${activeRoom.members?.length} members` : (getRoomOther(activeRoom)?.department || 'Member')}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', position: 'relative' }}>
                {activeRoom.type === 'group' && <button onClick={openGroupSettings} style={{ background: '#f8fafc', border: 'none', color: '#64748b', width: 40, height: 40, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Settings size={20} /></button>}
                <div style={{ position: 'relative' }}>
                  <button onClick={() => setShowChatMenu(!showChatMenu)} style={{ background: '#f8fafc', border: 'none', color: '#64748b', width: 40, height: 40, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><MoreHorizontal size={20} /></button>
                  {showChatMenu && (
                    <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: '8px', background: 'white', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', minWidth: '160px', overflow: 'hidden', zIndex: 100 }}>
                      <button onClick={handleDeleteChat} style={{ width: '100%', padding: '12px 16px', background: 'transparent', border: 'none', borderBottom: '1px solid #f1f5f9', textAlign: 'left', fontWeight: 600, color: '#ef4444', cursor: 'pointer' }} onMouseEnter={e=>e.currentTarget.style.background='#fee2e2'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>Delete Chat</button>
                      {activeRoom.type === 'group' && (
                        <button onClick={handleLeaveGroup} style={{ width: '100%', padding: '12px 16px', background: 'transparent', border: 'none', textAlign: 'left', fontWeight: 600, color: '#ef4444', cursor: 'pointer' }} onMouseEnter={e=>e.currentTarget.style.background='#fee2e2'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>Leave Group</button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="chat-messages-container" style={{ flex: 1, overflowY: 'auto', padding: '16px', background: '#f8fafc', backgroundImage: 'radial-gradient(#e2e8f0 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
              {roomMessages.map((m, idx) => {
                const isMe = m.senderId === user.id;
                const prev = roomMessages[idx - 1];
                const isFirstInGroup = !prev || prev.senderId !== m.senderId;
                const isDeleted = m.deleted;
                const isSwiping = swipeState.id === m.id;
                const translateX = isSwiping ? swipeState.currentX - swipeState.startX : 0;
                const constrainedTranslateX = isMe ? Math.max(-60, Math.min(0, translateX)) : Math.max(0, Math.min(60, translateX));

                return (
                  <div 
                    key={m.id} 
                    id={`msg-${m.id}`}
                    style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: isMe ? 'flex-end' : 'flex-start', 
                      marginBottom: '4px',
                      transform: `translateX(${constrainedTranslateX}px)`,
                      transition: isSwiping ? 'none' : 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      zIndex: activeMsgMenu === m.id ? 100 : 1,
                      position: 'relative'
                    }}
                    onTouchStart={(e) => {
                      if (isDeleted) return;
                      setSwipeState({ id: m.id, startX: e.touches[0].clientX, currentX: e.touches[0].clientX });
                    }}
                    onTouchMove={(e) => {
                      if (swipeState.id !== m.id) return;
                      setSwipeState(prev => ({ ...prev, currentX: e.touches[0].clientX }));
                    }}
                    onTouchEnd={() => {
                      if (swipeState.id === m.id) {
                        if (Math.abs(constrainedTranslateX) >= 50) {
                          setReplyingTo(m);
                        }
                        setSwipeState({ id: null, startX: 0, currentX: 0 });
                      }
                    }}
                  >
                    {isFirstInGroup && !isMe && activeRoom.type === 'group' && <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', marginLeft: '16px', marginBottom: '2px' }}>{m.senderName}</div>}
                    <div style={{ 
                      maxWidth: '75%', 
                      padding: '10px 16px', 
                      borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      background: isDeleted ? (isMe ? 'rgba(29, 78, 216, 0.1)' : '#f8fafc') : (highlightedMsgId === m.id ? (isMe ? '#2563eb' : '#fef3c7') : (isMe ? '#1d4ed8' : 'white')),
                      color: isDeleted ? '#94a3b8' : (isMe ? 'white' : '#1e293b'),
                      fontSize: '14px',
                      lineHeight: '1.5',
                      boxShadow: highlightedMsgId === m.id ? (isMe ? '0 0 0 4px rgba(219, 234, 254, 0.5)' : '0 0 0 4px rgba(253, 230, 138, 0.5)') : (isDeleted ? 'none' : '0 2px 8px rgba(0,0,0,0.03)'),
                      border: isDeleted ? '1px dashed #cbd5e1' : (highlightedMsgId === m.id && !isMe ? '1px solid #fcd34d' : (isMe ? 'none' : '1px solid #e2e8f0')),
                      position: 'relative',
                      fontStyle: isDeleted ? 'italic' : 'normal',
                      transition: 'all 0.6s ease'
                    }}>
                      <div style={{ 
                        whiteSpace: 'pre-wrap'
                      }}>
                        {m.replyToContent && (
                          <div onClick={() => handleReplyClick(m.replyToId)} style={{ background: isMe ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)', padding: '6px 10px', borderRadius: '8px', marginBottom: '6px', borderLeft: `3px solid ${isMe ? 'white' : '#1d4ed8'}`, fontSize: '12px', cursor: 'pointer', transition: 'opacity 0.2s' }} onMouseEnter={e => e.currentTarget.style.opacity = 0.8} onMouseLeave={e => e.currentTarget.style.opacity = 1}>
                            <div style={{ fontWeight: 700, marginBottom: '2px', opacity: 0.9 }}>{m.replyToSender}</div>
                            <div style={{ opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.replyToContent}</div>
                          </div>
                        )}
                        {(() => {
                          const text = isDeleted ? `🚫 This message was deleted by ${m.deletedByName || (m.deletedBy === 'admin' ? 'an admin' : 'the user')}${m.deletedBy === 'admin' && m.deletedByName ? ' (Admin)' : ''}.` : m.content;
                          const isEmojiOnly = !isDeleted && /^[\p{Emoji}\s]+$/u.test(text) && text.trim().length <= 12;
                          return <span style={{ fontSize: isEmojiOnly ? '32px' : 'inherit', lineHeight: isEmojiOnly ? '1.4' : 'inherit' }}>{text}</span>;
                        })()}
                        {!isDeleted && m.fileUrl && (
                          <div style={{ marginTop: '8px' }}>
                            {m.fileType?.startsWith('image/') || m.fileUrl.startsWith('data:image/') ? (
                              <img src={m.fileUrl} alt="attachment" style={{ width: '100%', maxWidth: '280px', borderRadius: '12px', cursor: 'pointer', display: 'block', border: '1px solid rgba(255,255,255,0.1)' }} onClick={() => window.open(m.fileUrl, '_blank')} />
                            ) : m.fileType?.startsWith('video/') ? (
                              <video src={m.fileUrl} controls style={{ width: '100%', maxWidth: '280px', borderRadius: '12px', display: 'block' }} />
                            ) : (
                              <a href={m.fileUrl} download={m.fileName || 'file'} target="_blank" rel="noreferrer" style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '8px', 
                                padding: '10px 14px', 
                                background: isMe ? 'rgba(255, 255, 255, 0.15)' : '#f1f5f9', 
                                color: isMe ? 'white' : '#1d4ed8', 
                                borderRadius: '12px', 
                                textDecoration: 'none', 
                                fontWeight: 600, 
                                fontSize: '13px',
                                wordBreak: 'break-all'
                              }}>
                                <FileText size={18} />
                                <span>{m.fileName || 'Download Attachment'}</span>
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: '10px', marginTop: '4px', textAlign: 'right', opacity: 0.6 }}>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      
                      {!isDeleted && (
                        <div 
                          className="msg-actions"
                          style={{ 
                            position: 'absolute', 
                            top: '50%', 
                            transform: 'translateY(-50%)',
                            [isMe ? 'left' : 'right']: '-36px',
                            display: activeMsgMenu === m.id ? 'flex' : 'none',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: activeMsgMenu === m.id ? 60 : 1
                          }}
                        >
                          <button 
                            onClick={(e) => { e.stopPropagation(); setActiveMsgMenu(activeMsgMenu === m.id ? null : m.id); }} 
                            style={{ background: 'white', border: '1px solid #e2e8f0', color: '#64748b', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }} 
                            title="More options"
                          >
                            <MoreHorizontal size={14} />
                          </button>
                          
                          {activeMsgMenu === m.id && (
                            <div style={{ position: 'absolute', top: '100%', [isMe ? 'left' : 'right']: 0, marginTop: '4px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 100, padding: '4px', minWidth: '140px' }}>
                              <button onClick={() => { setReplyingTo(m); setActiveMsgMenu(null); }} style={{ display: 'block', width: '100%', padding: '8px 12px', border: 'none', background: 'transparent', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#0f172a', cursor: 'pointer', borderRadius: '8px' }} onMouseEnter={e=>e.currentTarget.style.background='#f1f5f9'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>Reply</button>
                              {isMe && <button onClick={() => { setEditingMsg(m.id); setMsgText(m.content); setActiveMsgMenu(null); }} style={{ display: 'block', width: '100%', padding: '8px 12px', border: 'none', background: 'transparent', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#0f172a', cursor: 'pointer', borderRadius: '8px' }} onMouseEnter={e=>e.currentTarget.style.background='#f1f5f9'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>Edit</button>}
                              {(isMe || isAdmin) && <button onClick={() => { setActiveMsgMenu(null); handleDeleteMessage(m); }} style={{ display: 'block', width: '100%', padding: '8px 12px', border: 'none', background: 'transparent', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#ef4444', cursor: 'pointer', borderRadius: '8px' }} onMouseEnter={e=>e.currentTarget.style.background='#fee2e2'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>Delete</button>}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <style>{`.msg-actions { display: none; } div[style*="position: relative"]:hover .msg-actions { display: flex !important; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
              <div ref={messagesEndRef} />
            </div>

            {/* Mention Dropdown */}
            {showMentions && mentionSuggestions.length > 0 && (
              <div style={{ position: 'absolute', bottom: '80px', left: '20px', right: '20px', background: 'white', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)', border: '1px solid #e2e8f0', zIndex: 100, maxHeight: '200px', overflowY: 'auto' }}>
                {mentionSuggestions.map(s => (
                  <div key={s.id} onClick={() => insertMention(s)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }} onMouseOver={e => e.currentTarget.style.background='#f8fafc'} onMouseOut={e => e.currentTarget.style.background='white'}>
                    {s.id === 'all' ? (
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Users size={16} color="#1d4ed8" />
                      </div>
                    ) : renderAvatar(s, 32)}
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '14px' }}>{s.name}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>@{s.username || s.name.replace(/\s+/g, '')}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Input Bar */}
            <div style={{ padding: '20px 24px', background: 'white', borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
              {replyingTo && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '10px 16px', background: '#f8fafc', borderRadius: '12px', borderLeft: '4px solid #1d4ed8', marginBottom: '12px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#1d4ed8', marginBottom: '2px' }}>Replying to {replyingTo.senderName}</div>
                    <div style={{ fontSize: '13px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{replyingTo.deleted ? '🚫 This message was deleted.' : replyingTo.content}</div>
                  </div>
                  <button onClick={() => setReplyingTo(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}>×</button>
                </div>
              )}
              {activeRoom.status === 'request' && activeRoom.initiator !== user.id ? (
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '16px' }}>{getRoomTitle(activeRoom)} wants to message you.</p>
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                    <button onClick={() => declineRequest(activeRoom.id)} style={{ padding: '10px 24px', borderRadius: '12px', border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', fontWeight: 700, cursor: 'pointer' }}>Decline</button>
                    <button onClick={() => acceptRequest(activeRoom.id)} style={{ padding: '10px 24px', borderRadius: '12px', border: 'none', background: '#22c55e', color: 'white', fontWeight: 700, cursor: 'pointer' }}>Accept</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px' }}>
                    <div style={{ flex: 1, background: '#f1f5f9', borderRadius: '18px', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }} 
                        disabled={fileUploading}
                        style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', opacity: fileUploading ? 0.5 : 1, display: 'flex', alignItems: 'center' }}
                      >
                        <Plus size={20} />
                      </button>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        style={{ position: 'absolute', opacity: 0, width: '1px', height: '1px', overflow: 'hidden', zIndex: -1, pointerEvents: 'none' }} 
                      />
                      {fileUploading ? (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', color: '#64748b', fontSize: '14px', fontWeight: 600, padding: '8px 0' }}>
                          <div style={{ width: '16px', height: '16px', border: '2px solid #1d4ed8', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                          <span>Uploading: {uploadProgress}%</span>
                        </div>
                      ) : (
                        <textarea dir="auto"
                          placeholder="Type a message... (@ to mention)"
                          value={msgText}
                          onChange={e => handleInputChange(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); setShowEmoji(false); } }}
                          style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: '15px', color: '#0f172a', padding: '8px 0', minHeight: '24px', maxHeight: '120px', resize: 'none', fontFamily: 'inherit' }}
                        />
                      )}
                      <button onClick={() => setShowEmoji(!showEmoji)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><Smile size={20} /></button>
                    </div>
                    <button onClick={() => { sendMessage(); setShowEmoji(false); }} disabled={!msgText.trim()} style={{ width: '44px', height: '44px', borderRadius: '16px', background: msgText.trim() ? '#1d4ed8' : '#e2e8f0', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s', boxShadow: msgText.trim() ? '0 4px 12px rgba(29,78,216,0.3)' : 'none' }}><Send size={20} /></button>
                  </div>
                  {showEmoji && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', background: '#f9fafb', padding: '10px', borderRadius: '12px', border: '1px solid #e0dfdc' }}>
                      {EMOJI_LIST.map(e => (
                        <button key={e} onClick={() => setMsgText(prev => prev + e)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '4px' }}>{e}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', background: '#f8fafc' }} className="chat-hide-mobile">
            <div style={{ width: '140px', height: '140px', borderRadius: '50%', background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', boxShadow: '0 20px 40px rgba(59,130,246,0.1)' }}>
              <MessageSquare size={56} color="#1d4ed8" />
            </div>
            <h3 style={{ margin: '0 0 12px', fontSize: '28px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px' }}>Your Hub Messages</h3>
            <p style={{ fontSize: '16px', color: '#64748b', margin: 0 }}>Select a chat or start a new conversation with any scientist.</p>
          </div>
        )}

        {/* Group Settings Overlay */}
        {showGroupSettings && activeRoom && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'white', zIndex: 120, display: 'flex', flexDirection: 'column', animation: 'slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
            <div style={{ padding: '24px 20px', display: 'flex', alignItems: 'center', gap: '16px', borderBottom: '1px solid #f1f5f9' }}>
              <button onClick={() => setShowGroupSettings(false)} style={{ background: '#f1f5f9', border: 'none', color: '#64748b', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><ChevronLeft size={24} /></button>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 900 }}>Group Settings</h3>
            </div>
            <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ position: 'relative', width: '100px', height: '100px', marginBottom: '16px' }}>
                  {groupAvatarEdit ? (
                    <img src={groupAvatarEdit} alt="Group" style={{ width: '100%', height: '100%', borderRadius: '32px', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', borderRadius: '32px', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Users size={40} color="white" /></div>
                  )}
                  <label style={{ position: 'absolute', bottom: '-8px', right: '-8px', width: '36px', height: '36px', borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', border: '1px solid #f1f5f9' }}>
                    <Image size={18} color="#1d4ed8" />
                    <input type="file" accept="image/*" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => setCropGroupImageSrc(reader.result);
                      reader.readAsDataURL(file);
                      e.target.value = '';
                    }} style={{ display: 'none' }} />
                  </label>
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#1d4ed8' }}>Change Group Photo</div>
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#94a3b8', letterSpacing: '1px', marginBottom: '8px' }}>GROUP NAME</label>
                <input type="text" value={groupNameEdit} onChange={e => setGroupNameEdit(e.target.value)} style={{ width: '100%', padding: '14px 18px', borderRadius: '14px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '15px', outline: 'none' }} />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#94a3b8', letterSpacing: '1px', marginBottom: '8px' }}>DESCRIPTION</label>
                <textarea dir="auto" value={groupDescEdit} onChange={e => setGroupDescEdit(e.target.value)} placeholder="What is this group about?" style={{ width: '100%', padding: '14px 18px', borderRadius: '14px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '15px', outline: 'none', resize: 'none' }} rows={3} />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#94a3b8', letterSpacing: '1px' }}>MEMBERS ({activeRoom.members?.length})</label>
                  <button onClick={() => setShowAddMembers(true)} style={{ background: 'none', border: 'none', color: '#1d4ed8', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>+ Add Member</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {activeRoom.members?.map(id => {
                    const m = scientists.find(s => String(s.id) === String(id));
                    const isMe = String(id) === String(user.id);
                    const isMemberAdmin = activeRoom.admins?.includes(id);
                    const canPromote = (isAdmin || activeRoom.admins?.includes(user.id)) && !isMemberAdmin && !isMe;
                    return (
                      <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {renderAvatar(m, 36)}
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: 700 }}>{m?.name} {isMe && '(You)'} {isMemberAdmin && <span style={{fontSize: '10px', background: '#1d4ed8', color: 'white', padding: '2px 6px', borderRadius: '8px', marginLeft: '4px'}}>Admin</span>}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>{m?.department || 'Member'}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          {canPromote && <button onClick={() => handlePromoteToAdmin(id)} style={{ background: '#eff6ff', border: 'none', color: '#1d4ed8', fontSize: '12px', fontWeight: 700, padding: '4px 8px', borderRadius: '8px', cursor: 'pointer' }}>Make Admin</button>}
                          {!isMe && <button onClick={() => {
                            const newMembers = activeRoom.members.filter(mid => mid !== id);
                            const newNames = { ...activeRoom.memberNames };
                            delete newNames[id];
                            db.scicomm_chat_rooms.update(selectedRoom, { members: newMembers, memberNames: newNames });
                          }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={18} /></button>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div style={{ padding: '20px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '12px' }}>
              <button onClick={() => setShowGroupSettings(false)} style={{ flex: 1, padding: '16px', borderRadius: '14px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: 800, cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveGroupSettings} style={{ flex: 2, padding: '16px', borderRadius: '14px', border: 'none', background: '#1d4ed8', color: 'white', fontWeight: 800, cursor: 'pointer', boxShadow: '0 10px 25px rgba(29,78,216,0.3)' }}>Save Changes</button>
            </div>
          </div>
        )}

        {/* Add Members Overlay */}
        {showAddMembers && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'white', zIndex: 130, display: 'flex', flexDirection: 'column', animation: 'slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
            <div style={{ padding: '24px 20px', display: 'flex', alignItems: 'center', gap: '16px', borderBottom: '1px solid #f1f5f9' }}>
              <button onClick={() => setShowAddMembers(false)} style={{ background: '#f1f5f9', border: 'none', color: '#64748b', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><ChevronLeft size={24} /></button>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 900 }}>Add Members</h3>
            </div>
            <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', borderRadius: '14px', padding: '12px 16px', gap: '10px', marginBottom: '20px' }}>
                <Search size={18} color="#64748b" />
                <input type="text" placeholder="Search people..." value={newChatSearch} onChange={e => setNewChatSearch(e.target.value)} style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '14px' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {(() => {
                  const freshRoom = chatRooms.find(r => r.id === selectedRoom);
                  const currentMemberIds = (freshRoom?.members || []).map(String);
                  return scientists.filter(s => !currentMemberIds.includes(String(s.id)) && (s.name.toLowerCase().includes(newChatSearch.toLowerCase()) || (s.username||'').toLowerCase().includes(newChatSearch.toLowerCase()))).map(u => (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: '16px', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background='#f8fafc'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {renderAvatar(u, 40)}
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '15px' }}>{u.name}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>{u.department || 'Member'}</div>
                      </div>
                    </div>
                    <button onClick={async () => {
                      // Read freshest room data directly from the live collection to avoid stale state
                      const freshRoom = chatRooms.find(r => r.id === selectedRoom);
                      if (!freshRoom) return;
                      const currentMembers = freshRoom.members || [];
                      // Prevent duplicate adds
                      if (currentMembers.map(String).includes(String(u.id))) return;
                      const newMembers = [...currentMembers, u.id];
                      const newNames = { ...(freshRoom.memberNames || {}), [u.id]: u.name };
                      await db.scicomm_chat_rooms.update(selectedRoom, { members: newMembers, memberNames: newNames });
                      await db.scicomm_notifications.add({
                        userId: u.id, type: 'group_added', senderId: user.id,
                        title: `${user.name.split(' ')[0]} added you to a group chat`,
                        message: freshRoom.name || 'Group Chat',
                        link: '/chat', createdAt: new Date().toISOString(), read: false
                      });
                      await db.scicomm_chat_messages.add({
                        roomId: selectedRoom, senderId: 'system', senderName: 'System',
                        content: `${user.name} added ${u.name} to the group.`,
                        type: 'system', readBy: [], createdAt: new Date().toISOString()
                      });
                    }} style={{ padding: '8px 16px', borderRadius: '10px', border: 'none', background: '#eff6ff', color: '#1d4ed8', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>Add</button>
                  </div>
                ));
                })()}
              </div>
            </div>
            <div style={{ padding: '20px', borderTop: '1px solid #f1f5f9' }}>
              <button onClick={() => setShowAddMembers(false)} style={{ width: '100%', padding: '16px', borderRadius: '14px', border: 'none', background: '#1d4ed8', color: 'white', fontWeight: 800, fontSize: '16px', cursor: 'pointer' }}>Done</button>
            </div>
          </div>
        )}
      </div>

      {cropGroupImageSrc && (
        <ImageCropperModal
          imageSrc={cropGroupImageSrc}
          onCropComplete={handleGroupCropComplete}
          onCancel={() => setCropGroupImageSrc(null)}
        />
      )}

      {deleteConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.2s' }}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '24px', width: '90%', maxWidth: '400px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Trash2 size={32} />
            </div>
            <h3 style={{ margin: '0 0 12px', fontSize: '22px', fontWeight: 900, textAlign: 'center', color: '#0f172a' }}>{deleteConfirm.title}</h3>
            <p style={{ margin: '0 0 24px', color: '#64748b', fontSize: '15px', textAlign: 'center', lineHeight: '1.5' }}>{deleteConfirm.message}</p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: '14px', borderRadius: '16px', background: '#f1f5f9', border: 'none', fontWeight: 800, color: '#64748b', fontSize: '15px', cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={e=>e.currentTarget.style.background='#e2e8f0'} onMouseLeave={e=>e.currentTarget.style.background='#f1f5f9'}>Cancel</button>
              <button onClick={deleteConfirm.onConfirm} style={{ flex: 1, padding: '14px', borderRadius: '16px', background: '#ef4444', border: 'none', fontWeight: 800, color: 'white', fontSize: '15px', cursor: 'pointer', transition: 'background 0.2s', boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)' }} onMouseEnter={e=>e.currentTarget.style.background='#dc2626'} onMouseLeave={e=>e.currentTarget.style.background='#ef4444'}>Delete</button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideIn { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
        
        .scicomm-chat-sidebar {
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        @media (max-width: 768px) {
          .scicomm-chat-container {
            border-radius: 0 !important;
          }
          .chat-hide-mobile { display: none !important; }
          .chat-show-mobile { display: flex !important; }
          .scicomm-chat-sidebar {
            position: absolute !important;
            top: 0; left: 0; bottom: 0;
            width: 100% !important;
            transform: translateX(-100%);
          }
          .scicomm-chat-sidebar.open {
            transform: translateX(0);
          }
        }
        
        @media (min-width: 769px) {
          .chat-show-mobile { display: none !important; }
        }
        
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #e2e8f0; borderRadius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>
    </div>
  );
}
