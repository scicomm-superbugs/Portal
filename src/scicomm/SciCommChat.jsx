import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, useLiveCollection, uploadFile } from '../db';
import { Search, Plus, MessageSquare, Image, Video, FileText, Send, MoreHorizontal, UserCircle, Settings, Trash2, X, ChevronLeft, ArrowLeft, Users, Lock, AtSign, Smile } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AVATARS, timeAgo } from './scicommConstants';
import ImageCropperModal from './ImageCropperModal';
import EmojiPicker from '../components/EmojiPicker';
import SciCommVerificationBadge from './SciCommVerificationBadge';

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
  const isDarkMode = document.documentElement.classList.contains('scicomm-dark-mode');

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
       (s.name || '').toLowerCase().includes(mentionQuery.toLowerCase()) || 
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
    const title = r.type === 'group' ? (r.name || '') : (r.memberNames?.[r.members.find(id => id !== user.id)] || 'Chat');
    return title.toLowerCase().includes(roomSearch.toLowerCase());
  });

  const filteredNewChatUsers = scientists.filter(s => 
    String(s.id) !== String(user.id) && 
    ((s.name || '').toLowerCase().includes(newChatSearch.toLowerCase()) || (s.username || '').toLowerCase().includes(newChatSearch.toLowerCase()))
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
      
      const userMatch = scientists.find(s => (s.username || '').toLowerCase() === username || (s.name || '').replace(/\s+/g, '').toLowerCase() === username);
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
    m.roomId === roomId && String(m.senderId) !== String(user.id) && !(m.readBy || []).includes(user.id)
  ).length;

  useEffect(() => {
    if (!selectedRoom) return;
    const unread = allMessages.filter(m => m.roomId === selectedRoom && String(m.senderId) !== String(user.id) && !(m.readBy || []).includes(user.id));
    unread.forEach(m => {
      db.scicomm_chat_messages.update(m.id, { readBy: [...(m.readBy || []), user.id] }).catch(() => {});
    });
  }, [selectedRoom, allMessages.length]);

  return (
    <div className="sc-chat">
      {/* Sidebar */}
      <div className={`sc-chat-sidebar ${!mobileSidebarOpen ? 'hidden' : ''}`}>
        <div className="sc-chat-sidebar-head">
          <div className="sc-chat-sidebar-title-row">
            <h2 className="sc-chat-sidebar-title">Messages</h2>
            <div className="sc-chat-sidebar-actions">
              <button onClick={() => setShowNewChat(true)} style={{ background: '#eff6ff', color: '#1d4ed8' }} title="New Chat">
                <MessageSquare size={20} />
              </button>
              <button onClick={() => setShowNewGroup(true)} style={{ background: '#f0fdf4', color: '#166534' }} title="New Group">
                <Plus size={24} />
              </button>
            </div>
          </div>
          <div className="sc-chat-search">
            <Search size={18} color="#64748b" />
            <input 
              type="text" 
              placeholder="Search conversations..." 
              value={roomSearch} 
              onChange={e => setRoomSearch(e.target.value)} 
            />
          </div>
        </div>

        <div className="sc-chat-tabs">
          <button 
            onClick={() => setActiveTab('chats')} 
            className={`sc-chat-tab ${activeTab === 'chats' ? 'active' : ''}`}
          >
            Chats
          </button>
          <button 
            onClick={() => setActiveTab('requests')} 
            className={`sc-chat-tab ${activeTab === 'requests' ? 'active' : ''}`}
          >
            Requests
            {myRequests.length > 0 && <span className="sc-chat-tab-badge">{myRequests.length}</span>}
          </button>
        </div>

        <div className="sc-chat-list">
          {activeTab === 'chats' ? (
            filteredActiveRooms.length > 0 ? filteredActiveRooms.map(r => {
              const unread = unreadPerRoom(r.id);
              const isActive = selectedRoom === r.id;
              const other = getRoomOther(r);
              return (
                <div 
                  key={r.id} 
                  onClick={() => { setSelectedRoom(r.id); setMobileSidebarOpen(false); }} 
                  className={`sc-chat-room ${isActive ? 'active' : ''}`}
                >
                  <div className="sc-chat-room-avatar">
                    {r.type === 'group' ? (
                      r.avatar ? (
                        <img src={r.avatar} alt="Group" />
                      ) : (
                        <div className="group-icon"><Users size={24} color="white" /></div>
                      )
                    ) : (
                      <>
                        {renderAvatar(other, 48)}
                        <div className="sc-avatar-status"></div>
                      </>
                    )}
                    {unread > 0 && <div className="sc-chat-room-unread">{unread}</div>}
                  </div>
                  <div className="sc-chat-room-info">
                    <div className="sc-chat-room-top">
                      <div className="sc-chat-room-name">
                        {getRoomTitle(r)}
                        {r.type !== 'group' && <SciCommVerificationBadge role={other?.role} />}
                      </div>
                      <div className="sc-chat-room-time">{timeAgo(r.lastMessageAt)}</div>
                    </div>
                    <div className={`sc-chat-room-last ${unread > 0 ? 'unread' : ''}`}>
                      {r.lastSender === user.name ? 'You: ' : ''}{r.lastMessage || 'Start a conversation'}
                    </div>
                  </div>
                </div>
              );
            }) : <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>No conversations found.</div>
          ) : (
            myRequests.length > 0 ? myRequests.map(r => (
              <div 
                key={r.id} 
                onClick={() => { setSelectedRoom(r.id); setMobileSidebarOpen(false); }} 
                className={`sc-chat-room ${selectedRoom === r.id ? 'active' : ''}`}
              >
                <div className="sc-chat-room-avatar">
                  {renderAvatar(getRoomOther(r), 48)}
                </div>
                <div className="sc-chat-room-info">
                  <div className="sc-chat-room-name">
                    {getRoomTitle(r)} 
                    <SciCommVerificationBadge role={getRoomOther(r)?.role} />
                  </div>
                  <div style={{ fontSize: '13px', color: '#dc2626', fontWeight: 600 }}>New Message Request</div>
                </div>
              </div>
            )) : <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>No requests found.</div>
          )}
        </div>

        {/* New Chat Overlay */}
        {showNewChat && (
          <div className="sc-chat-overlay">
            <div className="sc-chat-overlay-header">
              <button onClick={() => setShowNewChat(false)} className="sc-chat-overlay-back">
                <ChevronLeft size={24} />
              </button>
              <h3 className="sc-chat-overlay-title">New Chat</h3>
            </div>
            <div className="sc-chat-overlay-body">
              <div style={{ marginBottom: '16px' }}>
                <div className="sc-chat-search">
                  <Search size={18} color="#64748b" />
                  <input 
                    type="text" 
                    placeholder="Search people..." 
                    value={newChatSearch} 
                    onChange={e => setNewChatSearch(e.target.value)} 
                  />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {filteredNewChatUsers.map(u => (
                  <div 
                    key={u.id} 
                    onClick={() => createPrivateRoom(u.id, u.name)} 
                    className="sc-chat-overlay-user"
                  >
                    {renderAvatar(u, 44)}
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {u.name} 
                        <SciCommVerificationBadge role={u.role} />
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{u.department || 'Member'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* New Group Overlay */}
        {showNewGroup && (
          <div className="sc-chat-overlay">
            <div className="sc-chat-overlay-header">
              <button onClick={() => setShowNewGroup(false)} className="sc-chat-overlay-back">
                <ChevronLeft size={24} />
              </button>
              <h3 className="sc-chat-overlay-title">Create Group</h3>
            </div>
            <div className="sc-chat-overlay-body">
              <div style={{ marginBottom: '24px' }}>
                <label className="sc-chat-form-label">GROUP NAME</label>
                <input 
                  type="text" 
                  placeholder="Enter group name..." 
                  value={newGroupName} 
                  onChange={e => setNewGroupName(e.target.value)} 
                  className="sc-chat-form-input" 
                />
              </div>
              <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="sc-chat-form-label">SELECT MEMBERS ({selectedMembers.length})</label>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <div className="sc-chat-search">
                  <Search size={18} color="#64748b" />
                  <input 
                    type="text" 
                    placeholder="Search people..." 
                    value={newChatSearch} 
                    onChange={e => setNewChatSearch(e.target.value)} 
                  />
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                {selectedMembers.map(id => {
                  const m = scientists.find(s => String(s.id) === String(id));
                  return (
                    <div key={id} className="sc-chat-chip">
                      {m?.name} 
                      <X size={12} style={{ cursor: 'pointer', marginLeft: '4px' }} onClick={() => setSelectedMembers(selectedMembers.filter(mid => mid !== id))} />
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {filteredNewChatUsers.slice(0, 30).map(u => (
                  <label 
                    key={u.id} 
                    className="sc-chat-overlay-user" 
                    style={{ background: selectedMembers.includes(u.id) ? '#f0f7ff' : 'transparent', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
                  >
                    <input 
                      type="checkbox" 
                      checked={selectedMembers.includes(u.id)} 
                      onChange={e => setSelectedMembers(e.target.checked ? [...selectedMembers, u.id] : selectedMembers.filter(id => id !== u.id))} 
                      style={{ width: 18, height: 18, borderRadius: '6px' }} 
                    />
                    {renderAvatar(u, 36)}
                    <span style={{ fontWeight: 600, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {u.name} 
                      <SciCommVerificationBadge role={u.role} />
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="sc-chat-overlay-footer">
              <button 
                onClick={createGroupRoom} 
                disabled={!newGroupName.trim() || selectedMembers.length === 0} 
                className="sc-chat-btn-primary"
              >
                Create Group
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Chat Area */}
      <div className="sc-chat-main">
        {activeRoom ? (
          <>
            {/* Chat Header */}
            <div className="sc-chat-header">
              <div className="sc-chat-header-left">
                <button onClick={() => setMobileSidebarOpen(true)} className="sc-chat-back-btn">
                  <ArrowLeft size={24} />
                </button>
                {activeRoom.type === 'group' ? (
                  activeRoom.avatar ? (
                    <img src={activeRoom.avatar} alt="Group" style={{ width: 44, height: 44, borderRadius: '14px', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: 44, height: 44, borderRadius: '14px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Users size={22} color="#1d4ed8" /></div>
                  )
                ) : renderAvatar(getRoomOther(activeRoom), 44)}
                <div className="sc-chat-header-info">
                  <div className="sc-chat-header-name">
                    {getRoomTitle(activeRoom)}
                    {activeRoom.type !== 'group' && <SciCommVerificationBadge role={getRoomOther(activeRoom)?.role} />}
                  </div>
                  <div className="sc-chat-header-sub">
                    {activeRoom.type === 'group' ? `${activeRoom.members?.length} members` : (getRoomOther(activeRoom)?.department || 'Member')}
                  </div>
                </div>
              </div>
              <div className="sc-chat-header-actions">
                {activeRoom.type === 'group' && (
                  <button onClick={openGroupSettings} className="sc-chat-header-btn">
                    <Settings size={20} />
                  </button>
                )}
                <div style={{ position: 'relative' }}>
                  <button onClick={() => setShowChatMenu(!showChatMenu)} className="sc-chat-header-btn">
                    <MoreHorizontal size={20} />
                  </button>
                  {showChatMenu && (
                    <div className="sc-chat-header-menu">
                      <button onClick={handleDeleteChat}>Delete Chat</button>
                      {activeRoom.type === 'group' && (
                        <button onClick={handleLeaveGroup}>Leave Group</button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="sc-chat-messages">
              {roomMessages.map((m, idx) => {
                const isMe = String(m.senderId) === String(user.id);
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
                    className={`sc-msg-row ${isMe ? 'me' : 'other'}`}
                    style={{ 
                      transform: `translateX(${constrainedTranslateX}px)`,
                      transition: isSwiping ? 'none' : 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      zIndex: activeMsgMenu === m.id ? 100 : 1
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
                    {isFirstInGroup && !isMe && activeRoom.type === 'group' && (
                      <div className="sc-msg-sender">
                        {m.senderName}
                        <SciCommVerificationBadge userId={m.senderId} scientists={scientists} />
                      </div>
                    )}
                    <div className={`sc-bubble ${isMe ? 'me' : 'other'} ${isDeleted ? 'deleted' : ''} ${highlightedMsgId === m.id ? 'highlighted' : ''}`}>
                      <div style={{ whiteSpace: 'pre-wrap' }}>
                        {m.replyToContent && (
                          <div 
                            onClick={() => handleReplyClick(m.replyToId)} 
                            className={`sc-bubble-reply ${isMe ? 'me' : 'other'}`}
                          >
                            <div className="sc-bubble-reply-name">{m.replyToSender}</div>
                            <div className="sc-bubble-reply-text">{m.replyToContent}</div>
                          </div>
                        )}
                        {(() => {
                          const text = isDeleted ? `🚫 This message was deleted by ${m.deletedByName || (m.deletedBy === 'admin' ? 'an admin' : 'the user')}${m.deletedBy === 'admin' && m.deletedByName ? ' (Admin)' : ''}.` : m.content;
                          const isEmojiOnly = !isDeleted && /^[\p{Emoji}\s]+$/u.test(text) && text.trim().length <= 12;
                          return <span style={{ fontSize: isEmojiOnly ? '32px' : 'inherit', lineHeight: isEmojiOnly ? '1.4' : 'inherit' }}>{text}</span>;
                        })()}
                        {!isDeleted && m.fileUrl && (
                          <div className="sc-bubble-file" style={{ marginTop: '8px' }}>
                            {m.fileType?.startsWith('image/') || m.fileUrl.startsWith('data:image/') ? (
                              <img src={m.fileUrl} alt="attachment" onClick={() => window.open(m.fileUrl, '_blank')} />
                            ) : m.fileType?.startsWith('video/') ? (
                              <video src={m.fileUrl} controls />
                            ) : (
                              <a href={m.fileUrl} download={m.fileName || 'file'} target="_blank" rel="noreferrer" className={`sc-bubble-file-link ${isMe ? 'me' : 'other'}`}>
                                <FileText size={18} />
                                <span>{m.fileName || 'Download Attachment'}</span>
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="sc-bubble-time">
                        {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      
                      {!isDeleted && (
                        <div className={`sc-msg-actions-wrap ${isMe ? 'me' : 'other'} ${activeMsgMenu === m.id ? 'visible' : ''}`}>
                          <button 
                            className="sc-msg-actions-btn"
                            onClick={(e) => { e.stopPropagation(); setActiveMsgMenu(activeMsgMenu === m.id ? null : m.id); }} 
                            title="More options"
                          >
                            <MoreHorizontal size={14} />
                          </button>
                          
                          {activeMsgMenu === m.id && (
                            <div className={`sc-msg-menu ${isMe ? 'me' : 'other'}`}>
                              <button onClick={() => { setReplyingTo(m); setActiveMsgMenu(null); }} className="sc-msg-menu-item">Reply</button>
                              {isMe && <button onClick={() => { setEditingMsg(m.id); setMsgText(m.content); setActiveMsgMenu(null); }} className="sc-msg-menu-item">Edit</button>}
                              {(isMe || isAdmin) && <button onClick={() => { setActiveMsgMenu(null); handleDeleteMessage(m); }} className="sc-msg-menu-item danger">Delete</button>}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Mention Dropdown */}
            {showMentions && mentionSuggestions.length > 0 && (
              <div className="sc-chat-mentions">
                {mentionSuggestions.map(s => (
                  <div key={s.id} onClick={() => insertMention(s)} className="sc-chat-mention-item">
                    {s.id === 'all' ? (
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Users size={16} color="#1d4ed8" />
                      </div>
                    ) : renderAvatar(s, 32)}
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '14px' }}>{s.name}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>@{s.username || (s.name || '').replace(/\s+/g, '')}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Input Bar */}
            <div className="sc-chat-inputbar">
              {replyingTo && (
                <div className="sc-chat-reply-preview">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#1d4ed8', marginBottom: '2px' }}>Replying to {replyingTo.senderName}</div>
                    <div style={{ fontSize: '13px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{replyingTo.deleted ? '🚫 This message was deleted.' : replyingTo.content}</div>
                  </div>
                  <button onClick={() => setReplyingTo(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}>×</button>
                </div>
              )}
              {activeRoom.status === 'request' && activeRoom.initiator !== user.id ? (
                <div className="sc-chat-request-bar">
                  <p>{getRoomTitle(activeRoom)} wants to message you.</p>
                  <div className="sc-chat-request-actions">
                    <button onClick={() => declineRequest(activeRoom.id)} className="sc-chat-request-decline">Decline</button>
                    <button onClick={() => acceptRequest(activeRoom.id)} className="sc-chat-request-accept">Accept</button>
                  </div>
                </div>
              ) : (
                <div className="sc-chat-input-row">
                  <div className="sc-chat-input-field">
                    <label className="attach-label" style={{ opacity: fileUploading ? 0.5 : 1 }}>
                      <Plus size={20} />
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        disabled={fileUploading}
                      />
                    </label>
                    {fileUploading ? (
                      <div className="sc-chat-upload-progress">
                        <div className="sc-chat-upload-spinner"></div>
                        <span>Uploading: {uploadProgress}%</span>
                      </div>
                    ) : (
                      <textarea 
                        dir="auto"
                        placeholder="Type a message... (@ to mention)"
                        value={msgText}
                        onChange={e => handleInputChange(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); setShowEmoji(false); } }}
                      />
                    )}
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <button onClick={() => setShowEmoji(!showEmoji)} className="sc-chat-emoji-btn">
                        <Smile size={20} />
                      </button>
                      {showEmoji && (
                        <EmojiPicker 
                          onSelect={(emoji) => setMsgText(prev => prev + emoji)}
                          onClose={() => setShowEmoji(false)}
                          isDarkMode={isDarkMode} 
                        />
                      )}
                    </div>
                  </div>
                  <button 
                    onClick={() => { sendMessage(); setShowEmoji(false); }} 
                    disabled={!msgText.trim()} 
                    className={`sc-chat-send-btn ${msgText.trim() ? 'ready' : 'disabled'}`}
                  >
                    <Send size={20} />
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="sc-chat-empty">
            <div className="sc-chat-empty-icon">
              <MessageSquare size={56} color="#1d4ed8" />
            </div>
            <h3>Your Hub Messages</h3>
            <p>Select a chat or start a new conversation with any scientist.</p>
          </div>
        )}

        {/* Group Settings Overlay */}
        {showGroupSettings && activeRoom && (
          <div className="sc-chat-overlay">
            <div className="sc-chat-overlay-header">
              <button onClick={() => setShowGroupSettings(false)} className="sc-chat-overlay-back">
                <ChevronLeft size={24} />
              </button>
              <h3 className="sc-chat-overlay-title">Group Settings</h3>
            </div>
            <div className="sc-chat-overlay-body">
              <div className="sc-chat-group-avatar-edit">
                <div className="sc-chat-group-avatar-wrap">
                  {groupAvatarEdit ? (
                    <img src={groupAvatarEdit} alt="Group" />
                  ) : (
                    <div className="placeholder"><Users size={40} color="white" /></div>
                  )}
                  <label className="upload-label">
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
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#1d4ed8', marginTop: '8px' }}>Change Group Photo</div>
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label className="sc-chat-form-label">GROUP NAME</label>
                <input 
                  type="text" 
                  value={groupNameEdit} 
                  onChange={e => setGroupNameEdit(e.target.value)} 
                  className="sc-chat-form-input" 
                />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label className="sc-chat-form-label">DESCRIPTION</label>
                <textarea 
                  dir="auto" 
                  value={groupDescEdit} 
                  onChange={e => setGroupDescEdit(e.target.value)} 
                  placeholder="What is this group about?" 
                  className="sc-chat-form-input" 
                  rows={3} 
                  style={{ resize: 'none' }}
                />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <label className="sc-chat-form-label" style={{ marginBottom: 0 }}>MEMBERS ({activeRoom.members?.length})</label>
                  <button onClick={() => setShowAddMembers(true)} style={{ background: 'none', border: 'none', color: '#1d4ed8', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>+ Add Member</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {activeRoom.members?.map(id => {
                    const m = scientists.find(s => String(s.id) === String(id));
                    const isMe = String(id) === String(user.id);
                    const isMemberAdmin = activeRoom.admins?.includes(id);
                    const canPromote = (isAdmin || activeRoom.admins?.includes(user.id)) && !isMemberAdmin && !isMe;
                    return (
                      <div key={id} className="sc-chat-overlay-member">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {renderAvatar(m, 36)}
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                              {m?.name}
                              <SciCommVerificationBadge role={m?.role} />
                              {isMe && '(You)'}
                              {isMemberAdmin && <span style={{fontSize: '10px', background: '#1d4ed8', color: 'white', padding: '2px 6px', borderRadius: '8px', marginLeft: '4px'}}>Admin</span>}
                            </div>
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
            <div className="sc-chat-overlay-footer" style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setShowGroupSettings(false)} className="sc-chat-btn-secondary" style={{ flex: 1 }}>Cancel</button>
              <button onClick={saveGroupSettings} className="sc-chat-btn-primary" style={{ flex: 2 }}>Save Changes</button>
            </div>
          </div>
        )}

        {/* Add Members Overlay */}
        {showAddMembers && (
          <div className="sc-chat-overlay">
            <div className="sc-chat-overlay-header">
              <button onClick={() => setShowAddMembers(false)} className="sc-chat-overlay-back">
                <ChevronLeft size={24} />
              </button>
              <h3 className="sc-chat-overlay-title">Add Members</h3>
            </div>
            <div className="sc-chat-overlay-body">
              <div style={{ marginBottom: '20px' }}>
                <div className="sc-chat-search">
                  <Search size={18} color="#64748b" />
                  <input 
                    type="text" 
                    placeholder="Search people..." 
                    value={newChatSearch} 
                    onChange={e => setNewChatSearch(e.target.value)} 
                  />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {(() => {
                  const freshRoom = chatRooms.find(r => r.id === selectedRoom);
                  const currentMemberIds = (freshRoom?.members || []).map(String);
                  return scientists.filter(s => !currentMemberIds.includes(String(s.id)) && ((s.name || '').toLowerCase().includes(newChatSearch.toLowerCase()) || (s.username||'').toLowerCase().includes(newChatSearch.toLowerCase()))).map(u => (
                    <div key={u.id} className="sc-chat-overlay-user" style={{ justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {renderAvatar(u, 40)}
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '15px' }}>{u.name}</div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>{u.department || 'Member'}</div>
                        </div>
                      </div>
                      <button 
                        onClick={async () => {
                          const freshRoom = chatRooms.find(r => r.id === selectedRoom);
                          if (!freshRoom) return;
                          const currentMembers = freshRoom.members || [];
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
                        }} 
                        style={{ padding: '8px 16px', borderRadius: '10px', border: 'none', background: '#eff6ff', color: '#1d4ed8', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                      >
                        Add
                      </button>
                    </div>
                  ));
                })()}
              </div>
            </div>
            <div className="sc-chat-overlay-footer">
              <button onClick={() => setShowAddMembers(false)} className="sc-chat-btn-primary">Done</button>
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
        <div className="sc-chat-modal-overlay">
          <div className="sc-chat-modal">
            <div className="sc-chat-modal-icon">
              <Trash2 size={32} />
            </div>
            <h3>{deleteConfirm.title}</h3>
            <p>{deleteConfirm.message}</p>
            <div className="sc-chat-modal-actions">
              <button onClick={() => setDeleteConfirm(null)} className="sc-chat-modal-cancel">Cancel</button>
              <button onClick={deleteConfirm.onConfirm} className="sc-chat-modal-confirm">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
