import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Search, Plus, X, Send, Smile, Paperclip, ArrowLeft, MoreVertical, UserCircle, Users, Image, Check, CheckCheck, Edit3, Trash2, Reply, Settings, UserPlus, LogOut, MessageCircle, Hash, Camera } from 'lucide-react';
import { db, useLiveCollection, uploadFile } from '../db';
import { useAuth } from '../context/AuthContext';
import { AVATARS, timeAgo } from './scicommConstants';
import SciCommVerificationBadge from './SciCommVerificationBadge';

// ── Emoji Grid ──────────────────────────────────────────────
const EMOJI_LIST = [
  '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😊',
  '😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋',
  '😛','😜','🤪','😝','🤑','🤗','🤭','🫢','🤫','🤔',
  '🫡','🤐','🤨','😐','😑','😶','🫥','😏','😒','🙄',
  '😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕',
  '🤢','🤮','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸',
  '😎','🤓','🧐','😕','🫤','😟','🙁','😮','😯','😲',
  '😳','🥺','🥹','😦','😧','😨','😰','😥','😢','😭',
  '😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡',
  '🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻',
  '👽','👾','🤖','😺','😸','😹','😻','😼','😽','🙀',
  '😿','😾','🙈','🙉','🙊','💋','💌','💘','💝','💖',
  '💗','💓','💞','💕','💟','❣️','💔','❤️‍🔥','❤️‍🩹','❤️',
  '🧡','💛','💚','💙','💜','🤎','🖤','🤍','💯','💢',
  '👍','👎','👏','🙌','🤝','🤲','🫶','💪','✌️','🤞',
  '🫰','🤟','🤘','🤙','👋','🫱','🫲','👆','👇','👉',
  '👈','🫳','🫴','☝️','✋','🤚','🖐️','🖖','🫵','👌',
  '🔥','⭐','🌟','✨','💫','🎉','🎊','🏆','🥇','🎯',
  '💎','🧬','🔬','🧪','⚗️','🧫','🦠','🧠','🫀','🫁',
];

const REACTION_EMOJIS = ['👍','❤️','😂','😮','😢','🔥','👏','🎉'];

// ── Helpers ─────────────────────────────────────────────────
const dateSeparatorLabel = (dateStr) => {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
};

const isOnline = (lastSeen) => {
  if (!lastSeen) return false;
  return (Date.now() - new Date(lastSeen).getTime()) < 5 * 60 * 1000; // 5 min
};

const getRecentActivity = (lastSeen) => {
  if (!lastSeen) return 'Offline';
  if (isOnline(lastSeen)) return 'Online';
  return `Active ${timeAgo(lastSeen)}`;
};

// ── Main Component ──────────────────────────────────────────
export default function SciCommChat() {
  const { user } = useAuth();
  const scientists = useLiveCollection('scientists') || [];
  const chatRooms = useLiveCollection('scicomm_chat_rooms') || [];
  const chatMessages = useLiveCollection('scicomm_chat_messages') || [];

  const me = scientists.find(s => String(s.id) === String(user.id));

  // ── State ───────────────────────────────────────────────
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [messageText, setMessageText] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupMembers, setGroupMembers] = useState([]);
  const [groupSearch, setGroupSearch] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null); // message object
  const [editingMessage, setEditingMessage] = useState(null); // message object
  const [showMessageMenu, setShowMessageMenu] = useState(null); // message id
  const [showReactionPicker, setShowReactionPicker] = useState(null); // message id
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [addMemberSearch, setAddMemberSearch] = useState('');
  const [showChatMenu, setShowChatMenu] = useState(false); // header ⋮ menu
  const [highlightedMsgId, setHighlightedMsgId] = useState(null);
  const [attachFile, setAttachFile] = useState(null);
  const [attachPreview, setAttachPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [editGroupName, setEditGroupName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isMobileView, setIsMobileView] = useState(window.innerWidth <= 768);

  // Touch/swipe state for mobile reply
  const [swipeMsgId, setSwipeMsgId] = useState(null);
  const [swipeX, setSwipeX] = useState(0);
  const touchStartRef = useRef({ x: 0, y: 0, msgId: null });

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  // ── Responsive ──────────────────────────────────────────
  useEffect(() => {
    const onResize = () => setIsMobileView(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── Update lastSeen every minute ────────────────────────
  useEffect(() => {
    const update = () => {
      db.scientists.update(String(user.id), { lastSeen: new Date().toISOString() }).catch(() => {});
    };
    update();
    const iv = setInterval(update, 60000);
    return () => clearInterval(iv);
  }, [user.id]);

  // ── Rooms sorted & filtered ─────────────────────────────
  const myRooms = useMemo(() => {
    return chatRooms
      .filter(r => (r.members || []).includes(user.id))
      .sort((a, b) => new Date(b.lastMessageAt || b.createdAt) - new Date(a.lastMessageAt || a.createdAt));
  }, [chatRooms, user.id]);

  const filteredRooms = useMemo(() => {
    if (!sidebarSearch.trim()) return myRooms;
    const q = sidebarSearch.toLowerCase();
    return myRooms.filter(r => {
      if (r.groupName && r.groupName.toLowerCase().includes(q)) return true;
      const names = Object.values(r.memberNames || {});
      return names.some(n => n.toLowerCase().includes(q));
    });
  }, [myRooms, sidebarSearch]);

  // ── Active room messages ────────────────────────────────
  const activeRoom = chatRooms.find(r => r.id === activeRoomId);
  const roomMessages = useMemo(() => {
    if (!activeRoomId) return [];
    return chatMessages
      .filter(m => m.roomId === activeRoomId)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }, [chatMessages, activeRoomId]);

  // ── Mark messages as read ───────────────────────────────
  useEffect(() => {
    if (!activeRoomId) return;
    const unread = roomMessages.filter(m => m.senderId !== user.id && !(m.readBy || []).includes(user.id));
    unread.forEach(m => {
      db.scicomm_chat_messages.update(m.id, { readBy: [...(m.readBy || []), user.id] }).catch(() => {});
    });
  }, [roomMessages, activeRoomId, user.id]);

  // ── Auto scroll to bottom ──────────────────────────────
  useEffect(() => {
    if (messagesEndRef.current && !highlightedMsgId) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [roomMessages.length]);

  // ── Avatar renderer ─────────────────────────────────────
  const renderAvatar = (member, size = 40) => {
    if (!member) return <UserCircle size={size} color="#94a3b8" />;
    if (member.avatar) return <img src={member.avatar} alt={member.name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />;
    const av = AVATARS.find(a => a.id === member.avatarId);
    if (av) return <div className="avatar-emoji" style={{ width: size, height: size, borderRadius: '50%', background: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.5 }}><span className="emoji">{av.svg}</span></div>;
    return <UserCircle size={size} color="#94a3b8" />;
  };

  // ── Room display helpers ────────────────────────────────
  const getRoomName = (room) => {
    if (room.groupName) return room.groupName;
    const otherNames = Object.entries(room.memberNames || {}).filter(([id]) => id !== user.id).map(([, name]) => name);
    return otherNames.join(', ') || 'Chat';
  };

  const getRoomAvatar = (room) => {
    if (room.type === 'group') {
      if (room.groupIcon) return <img src={room.groupIcon} alt="" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />;
      return <div className="mc-group-avatar"><Users size={22} /></div>;
    }
    const otherId = (room.members || []).find(id => id !== user.id);
    const other = scientists.find(s => String(s.id) === String(otherId));
    return renderAvatar(other, 48);
  };

  const getRoomAvatarSmall = (room) => {
    if (room.type === 'group') {
      if (room.groupIcon) return <img src={room.groupIcon} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />;
      return <div className="mc-group-avatar" style={{ width: 36, height: 36 }}><Users size={16} /></div>;
    }
    const otherId = (room.members || []).find(id => id !== user.id);
    const other = scientists.find(s => String(s.id) === String(otherId));
    return renderAvatar(other, 36);
  };

  const getRoomOnlineStatus = (room) => {
    if (room.type === 'group') return null;
    const otherId = (room.members || []).find(id => id !== user.id);
    const other = scientists.find(s => String(s.id) === String(otherId));
    return other?.lastSeen ? isOnline(other.lastSeen) : false;
  };

  const getRoomActivity = (room) => {
    if (room.type === 'group') return `${(room.members || []).length} members`;
    const otherId = (room.members || []).find(id => id !== user.id);
    const other = scientists.find(s => String(s.id) === String(otherId));
    return getRecentActivity(other?.lastSeen);
  };

  const getUnreadCount = (room) => {
    return chatMessages.filter(m => m.roomId === room.id && m.senderId !== user.id && !(m.readBy || []).includes(user.id)).length;
  };

  // ── Open room ───────────────────────────────────────────
  const openRoom = (roomId) => {
    setActiveRoomId(roomId);
    setShowNewChat(false);
    setShowNewGroup(false);
    setReplyingTo(null);
    setEditingMessage(null);
    setShowEmojiPicker(false);
    setShowMessageMenu(null);
    setShowReactionPicker(null);
    setShowGroupSettings(false);
    setShowChatMenu(false);
    setMessageText('');
    setAttachFile(null);
    setAttachPreview(null);
  };

  // ── Start new private chat ──────────────────────────────
  const startPrivateChat = async (scientist) => {
    const existing = chatRooms.find(r => r.type === 'private' && r.members?.includes(user.id) && r.members?.includes(scientist.id));
    if (existing) { openRoom(existing.id); return; }
    const roomId = await db.scicomm_chat_rooms.add({
      type: 'private',
      members: [user.id, scientist.id],
      memberNames: { [user.id]: user.name, [scientist.id]: scientist.name },
      createdAt: new Date().toISOString(),
      lastMessageAt: new Date().toISOString()
    });
    openRoom(roomId);
  };

  // ── Create group ────────────────────────────────────────
  const createGroup = async () => {
    if (!groupName.trim() || groupMembers.length === 0) return;
    const memberNames = { [user.id]: user.name };
    groupMembers.forEach(id => {
      const s = scientists.find(sc => String(sc.id) === String(id));
      if (s) memberNames[id] = s.name;
    });
    const roomId = await db.scicomm_chat_rooms.add({
      type: 'group',
      groupName: groupName.trim(),
      members: [user.id, ...groupMembers],
      memberNames,
      createdBy: user.id,
      createdAt: new Date().toISOString(),
      lastMessageAt: new Date().toISOString()
    });
    setGroupName('');
    setGroupMembers([]);
    setShowNewGroup(false);
    openRoom(roomId);
  };

  // ── Send message ────────────────────────────────────────
  const sendMessage = async () => {
    if (uploading) return;

    // Handle editing
    if (editingMessage) {
      if (!messageText.trim()) return;
      await db.scicomm_chat_messages.update(editingMessage.id, { content: messageText.trim(), edited: true });
      setEditingMessage(null);
      setMessageText('');
      return;
    }

    if (!messageText.trim() && !attachFile) return;
    if (!activeRoomId) return;

    let fileUrl = null;
    let fileType = 'text';
    let fileName = null;

    if (attachFile) {
      setUploading(true);
      try {
        fileUrl = await uploadFile(attachFile, `chat/${activeRoomId}/${Date.now()}_${attachFile.name}`);
        fileType = attachFile.type.startsWith('image/') ? 'image' : attachFile.type.startsWith('video/') ? 'video' : 'file';
        fileName = attachFile.name;
      } catch (e) {
        alert('Upload failed: ' + e.message);
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    const msg = {
      roomId: activeRoomId,
      senderId: user.id,
      senderName: user.name,
      content: messageText.trim(),
      type: fileUrl ? fileType : 'text',
      fileUrl: fileUrl || null,
      fileName: fileName || null,
      readBy: [user.id],
      createdAt: new Date().toISOString(),
    };

    if (replyingTo) {
      msg.replyTo = replyingTo.id;
      msg.replyPreview = replyingTo.content?.substring(0, 100) || (replyingTo.type === 'image' ? '📷 Photo' : '📎 File');
      msg.replyToSender = replyingTo.senderName;
    }

    await db.scicomm_chat_messages.add(msg);

    await db.scicomm_chat_rooms.update(activeRoomId, {
      lastMessageAt: new Date().toISOString(),
      lastMessage: fileUrl ? (fileType === 'image' ? '📷 Photo' : '📎 File') : messageText.trim().substring(0, 60),
      lastSender: user.name
    });

    setMessageText('');
    setReplyingTo(null);
    setAttachFile(null);
    setAttachPreview(null);
    setShowEmojiPicker(false);
  };

  // ── File attach ─────────────────────────────────────────
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAttachFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setAttachPreview(ev.target.result);
      reader.readAsDataURL(file);
    } else {
      setAttachPreview(null);
    }
  };

  // ── Delete message ──────────────────────────────────────
  const deleteMessage = async (msgId) => {
    await db.scicomm_chat_messages.delete(msgId);
    setShowMessageMenu(null);
  };

  // ── React to message ────────────────────────────────────
  const toggleReaction = async (msg, emoji) => {
    const reactions = { ...(msg.reactions || {}) };
    const users = reactions[emoji] || [];
    if (users.includes(user.id)) {
      reactions[emoji] = users.filter(id => id !== user.id);
      if (reactions[emoji].length === 0) delete reactions[emoji];
    } else {
      reactions[emoji] = [...users, user.id];
    }
    await db.scicomm_chat_messages.update(msg.id, { reactions });
    setShowReactionPicker(null);
  };

  // ── Scroll to replied message ───────────────────────────
  const scrollToMessage = (msgId) => {
    setHighlightedMsgId(msgId);
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => setHighlightedMsgId(null), 2500);
    }
  };

  // ── Delete chat ─────────────────────────────────────────
  const deleteChat = async () => {
    if (!activeRoomId) return;
    // Delete all messages in this room
    const msgs = chatMessages.filter(m => m.roomId === activeRoomId);
    for (const m of msgs) {
      await db.scicomm_chat_messages.delete(m.id);
    }
    await db.scicomm_chat_rooms.delete(activeRoomId);
    setActiveRoomId(null);
    setShowDeleteConfirm(false);
    setShowChatMenu(false);
  };

  // ── Group management ────────────────────────────────────
  const updateGroupName = async () => {
    if (!editGroupName.trim() || !activeRoom) return;
    await db.scicomm_chat_rooms.update(activeRoomId, { groupName: editGroupName.trim() });
    setEditGroupName('');
  };

  const updateGroupIcon = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const url = await uploadFile(file, `groups/${activeRoomId}/icon_${Date.now()}`);
      await db.scicomm_chat_rooms.update(activeRoomId, { groupIcon: url });
    } catch (err) {
      alert('Upload failed');
    }
  };

  const addMemberToGroup = async (memberId) => {
    if (!activeRoom) return;
    const members = [...(activeRoom.members || []), memberId];
    const memberNames = { ...(activeRoom.memberNames || {}) };
    const s = scientists.find(sc => String(sc.id) === String(memberId));
    if (s) memberNames[memberId] = s.name;
    await db.scicomm_chat_rooms.update(activeRoomId, { members, memberNames });
  };

  const removeMemberFromGroup = async (memberId) => {
    if (!activeRoom) return;
    const members = (activeRoom.members || []).filter(id => id !== memberId);
    const memberNames = { ...(activeRoom.memberNames || {}) };
    delete memberNames[memberId];
    await db.scicomm_chat_rooms.update(activeRoomId, { members, memberNames });
  };

  const leaveGroup = async () => {
    if (!activeRoom) return;
    await removeMemberFromGroup(user.id);
    setActiveRoomId(null);
    setShowGroupSettings(false);
  };

  // ── Swipe-to-reply (mobile) ─────────────────────────────
  const handleTouchStart = (e, msgId) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, msgId };
  };

  const handleTouchMove = (e, msgId) => {
    const dx = e.touches[0].clientX - touchStartRef.current.x;
    const dy = Math.abs(e.touches[0].clientY - touchStartRef.current.y);
    if (dy > 30) { setSwipeMsgId(null); setSwipeX(0); return; }
    if (dx > 10 && touchStartRef.current.msgId === msgId) {
      setSwipeMsgId(msgId);
      setSwipeX(Math.min(dx, 80));
    }
  };

  const handleTouchEnd = (msg) => {
    if (swipeX > 50) {
      setReplyingTo(msg);
      textareaRef.current?.focus();
    }
    setSwipeMsgId(null);
    setSwipeX(0);
  };

  // ── Close overlays on click outside ─────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (showMessageMenu && !e.target.closest('.mc-msg-menu')) setShowMessageMenu(null);
      if (showChatMenu && !e.target.closest('.mc-chat-header-menu')) setShowChatMenu(false);
      if (showReactionPicker && !e.target.closest('.mc-reaction-picker')) setShowReactionPicker(null);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [showMessageMenu, showChatMenu, showReactionPicker]);

  // ── Textarea auto-resize ────────────────────────────────
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [messageText]);

  // ════════════════════════════════════════════════════════
  // ── RENDER ──────────────────────────────────────────────
  // ════════════════════════════════════════════════════════

  const showSidebar = !isMobileView || !activeRoomId;
  const showChatArea = !isMobileView || activeRoomId;

  return (
    <div className="mc-container" style={{ height: isMobileView ? 'calc(100dvh - 112px)' : 'calc(100vh - 100px)', marginTop: '2px', width: '100%' }}>

      {/* ═══════ SIDEBAR ═══════ */}
      {showSidebar && (
        <div className="mc-sidebar">
          {/* Sidebar Header */}
          <div className="mc-sidebar-header">
            <h2 className="mc-sidebar-title">Messages</h2>
            <div className="mc-sidebar-actions">
              <button className="mc-icon-btn" onClick={() => { setShowNewGroup(true); setShowNewChat(false); }} title="New Group">
                <Users size={18} />
              </button>
              <button className="mc-icon-btn mc-icon-btn-primary" onClick={() => { setShowNewChat(true); setShowNewGroup(false); }} title="New Chat">
                <Edit3 size={18} />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="mc-sidebar-search">
            <Search size={16} className="mc-search-icon" />
            <input type="text" placeholder="Search conversations..." value={sidebarSearch} onChange={e => setSidebarSearch(e.target.value)} className="mc-search-input" />
          </div>

          {/* Chat List */}
          <div className="mc-chat-list">
            {filteredRooms.length === 0 && (
              <div className="mc-empty-list">
                <MessageCircle size={48} strokeWidth={1} />
                <p>No conversations yet</p>
                <button className="mc-start-btn" onClick={() => setShowNewChat(true)}>Start a chat</button>
              </div>
            )}
            {filteredRooms.map(room => {
              const unread = getUnreadCount(room);
              const online = getRoomOnlineStatus(room);
              const otherId = (room.members || []).find(id => id !== user.id);
              const other = scientists.find(s => String(s.id) === String(otherId));
              return (
                <div key={room.id} className={`mc-chat-item ${room.id === activeRoomId ? 'active' : ''} ${unread > 0 ? 'unread' : ''}`} onClick={() => openRoom(room.id)}>
                  <div className="mc-chat-item-avatar">
                    {getRoomAvatarSmall(room)}
                    {online && <span className="mc-online-dot" />}
                  </div>
                  <div className="mc-chat-item-info">
                    <div className="mc-chat-item-top">
                      <span className="mc-chat-item-name" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {getRoomName(room)}
                        {room.type === 'private' && other && (
                          <SciCommVerificationBadge role={other.role} style={{ verticalAlign: 'middle', display: 'inline-flex' }} />
                        )}
                      </span>
                      <span className="mc-chat-item-time">{timeAgo(room.lastMessageAt || room.createdAt)}</span>
                    </div>
                    <div className="mc-chat-item-bottom">
                      <span className="mc-chat-item-preview">
                        {room.lastSender && room.type === 'group' ? `${room.lastSender.split(' ')[0]}: ` : ''}
                        {room.lastMessage || 'No messages yet'}
                      </span>
                      {unread > 0 && <span className="mc-unread-badge">{unread > 9 ? '9+' : unread}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── New Chat Overlay ── */}
          {showNewChat && (
            <div className="mc-overlay-panel">
              <div className="mc-overlay-header">
                <button className="mc-icon-btn" onClick={() => setShowNewChat(false)}><X size={20} /></button>
                <h3>New Message</h3>
              </div>
              <div className="mc-overlay-search">
                <Search size={16} className="mc-search-icon" />
                <input type="text" placeholder="Search people..." value={newChatSearch} onChange={e => setNewChatSearch(e.target.value)} className="mc-search-input" autoFocus />
              </div>
              <div className="mc-overlay-list">
                {scientists
                  .filter(s => String(s.id) !== String(user.id) && s.name?.toLowerCase().includes(newChatSearch.toLowerCase()))
                  .map(s => (
                    <div key={s.id} className="mc-contact-item" onClick={() => startPrivateChat(s)}>
                      <div style={{ position: 'relative' }}>
                        {renderAvatar(s, 40)}
                        {isOnline(s.lastSeen) && <span className="mc-online-dot" />}
                      </div>
                      <div className="mc-contact-info">
                        <div className="mc-contact-name">{s.name} <SciCommVerificationBadge role={s.role} /></div>
                        <div className="mc-contact-dept">{s.department || 'Member'}</div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* ── New Group Overlay ── */}
          {showNewGroup && (
            <div className="mc-overlay-panel">
              <div className="mc-overlay-header">
                <button className="mc-icon-btn" onClick={() => { setShowNewGroup(false); setGroupMembers([]); setGroupName(''); }}><X size={20} /></button>
                <h3>New Group</h3>
              </div>
              <div style={{ padding: '12px 16px' }}>
                <input type="text" placeholder="Group name..." value={groupName} onChange={e => setGroupName(e.target.value)} className="mc-group-name-input" />
              </div>
              {groupMembers.length > 0 && (
                <div className="mc-selected-members">
                  {groupMembers.map(id => {
                    const s = scientists.find(sc => String(sc.id) === String(id));
                    return (
                      <div key={id} className="mc-selected-chip">
                        <span>{s?.name?.split(' ')[0]}</span>
                        <button onClick={() => setGroupMembers(prev => prev.filter(m => m !== id))}><X size={12} /></button>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="mc-overlay-search">
                <Search size={16} className="mc-search-icon" />
                <input type="text" placeholder="Add members..." value={groupSearch} onChange={e => setGroupSearch(e.target.value)} className="mc-search-input" />
              </div>
              <div className="mc-overlay-list">
                {scientists
                  .filter(s => String(s.id) !== String(user.id) && !groupMembers.includes(s.id) && s.name?.toLowerCase().includes(groupSearch.toLowerCase()))
                  .map(s => (
                    <div key={s.id} className="mc-contact-item" onClick={() => setGroupMembers(prev => [...prev, s.id])}>
                      {renderAvatar(s, 36)}
                      <div className="mc-contact-info">
                        <div className="mc-contact-name">{s.name}</div>
                        <div className="mc-contact-dept">{s.department || 'Member'}</div>
                      </div>
                      <Plus size={18} style={{ color: '#3b82f6', flexShrink: 0 }} />
                    </div>
                  ))}
              </div>
              {groupMembers.length > 0 && groupName.trim() && (
                <div style={{ padding: '12px 16px' }}>
                  <button className="mc-create-group-btn" onClick={createGroup}>Create Group ({groupMembers.length} members)</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════ CHAT AREA ═══════ */}
      {showChatArea && (
        <div className="mc-chat-area">
          {!activeRoomId ? (
            /* ── Empty State ── */
            <div className="mc-empty-state">
              <div className="mc-empty-icon">
                <MessageCircle size={64} strokeWidth={1} />
              </div>
              <h3>Your Messages</h3>
              <p>Send private messages or create group conversations</p>
              <button className="mc-start-btn" onClick={() => { setShowNewChat(true); if (isMobileView) setActiveRoomId(null); }}>
                <Edit3 size={16} /> Start a conversation
              </button>
            </div>
          ) : (
            <>
              {/* ── Chat Header ── */}
              <div className="mc-chat-header">
                {isMobileView && (
                  <button className="mc-icon-btn mc-back-btn" onClick={() => { setActiveRoomId(null); setShowGroupSettings(false); setShowChatMenu(false); }}>
                    <ArrowLeft size={22} />
                  </button>
                )}
                <div className="mc-chat-header-avatar" onClick={() => activeRoom?.type === 'group' && setShowGroupSettings(true)}>
                  {activeRoom && getRoomAvatar(activeRoom)}
                </div>
                <div className="mc-chat-header-info" onClick={() => activeRoom?.type === 'group' && setShowGroupSettings(true)}>
                  <div className="mc-chat-header-name" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {activeRoom && getRoomName(activeRoom)}
                    {activeRoom?.type === 'private' && (() => {
                      const otherId = (activeRoom.members || []).find(id => id !== user.id);
                      const other = scientists.find(s => String(s.id) === String(otherId));
                      return other ? <SciCommVerificationBadge role={other.role} style={{ verticalAlign: 'middle', display: 'inline-flex' }} /> : null;
                    })()}
                  </div>
                  <div className="mc-chat-header-status">{activeRoom && getRoomActivity(activeRoom)}</div>
                </div>
                <div className="mc-chat-header-menu" style={{ position: 'relative' }}>
                  <button className="mc-icon-btn" onClick={(e) => { e.stopPropagation(); setShowChatMenu(!showChatMenu); }}>
                    <MoreVertical size={20} />
                  </button>
                  {showChatMenu && (
                    <div className="mc-dropdown-menu">
                      {activeRoom?.type === 'group' && (
                        <button onClick={() => { setShowGroupSettings(true); setShowChatMenu(false); }}><Settings size={16} /> Group Settings</button>
                      )}
                      <button onClick={() => setShowDeleteConfirm(true)} style={{ color: '#ef4444' }}><Trash2 size={16} /> Delete Chat</button>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Messages ── */}
              <div className="mc-messages" ref={messagesContainerRef}>
                {roomMessages.map((msg, idx) => {
                  const isMine = msg.senderId === user.id;
                  const showDateSep = idx === 0 || dateSeparatorLabel(msg.createdAt) !== dateSeparatorLabel(roomMessages[idx - 1].createdAt);
                  const sender = scientists.find(s => String(s.id) === String(msg.senderId));
                  const showSenderName = activeRoom?.type === 'group' && !isMine && (idx === 0 || roomMessages[idx - 1].senderId !== msg.senderId);
                  const isHighlighted = highlightedMsgId === msg.id;
                  const allRead = activeRoom?.type === 'private' && (msg.readBy || []).length >= (activeRoom.members || []).length;

                  return (
                    <React.Fragment key={msg.id}>
                      {showDateSep && <div className="mc-date-sep"><span>{dateSeparatorLabel(msg.createdAt)}</span></div>}
                      <div
                        id={`msg-${msg.id}`}
                        className={`mc-msg-row ${isMine ? 'mc-msg-sent' : 'mc-msg-received'} ${isHighlighted ? 'mc-msg-highlighted' : ''}`}
                        onTouchStart={isMobileView ? (e) => handleTouchStart(e, msg.id) : undefined}
                        onTouchMove={isMobileView ? (e) => handleTouchMove(e, msg.id) : undefined}
                        onTouchEnd={isMobileView ? () => handleTouchEnd(msg) : undefined}
                        style={swipeMsgId === msg.id ? { transform: `translateX(${swipeX}px)`, transition: 'none' } : undefined}
                      >
                        {/* Swipe reply indicator */}
                        {swipeMsgId === msg.id && swipeX > 20 && (
                          <div className="mc-swipe-indicator" style={{ opacity: Math.min(swipeX / 60, 1) }}>
                            <Reply size={20} />
                          </div>
                        )}

                        {!isMine && activeRoom?.type === 'group' && (
                          <div className="mc-msg-avatar-col">
                            {showSenderName && renderAvatar(sender, 28)}
                          </div>
                        )}

                        <div className="mc-msg-bubble-wrap">
                          {showSenderName && (
                            <div className="mc-msg-sender-name" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                              {msg.senderName}
                              {(() => {
                                const sender = scientists.find(s => String(s.id) === String(msg.senderId));
                                return sender ? <SciCommVerificationBadge role={sender.role} style={{ verticalAlign: 'middle', display: 'inline-flex' }} /> : null;
                              })()}
                            </div>
                          )}

                          <div className={`mc-msg-bubble ${isMine ? 'sent' : 'received'}`}
                            onContextMenu={(e) => { e.preventDefault(); setShowMessageMenu(msg.id); }}
                            onMouseEnter={!isMobileView ? () => setShowMessageMenu(msg.id) : undefined}
                            onMouseLeave={!isMobileView ? () => { if (showMessageMenu === msg.id) setShowMessageMenu(null); } : undefined}
                          >
                            {/* Reply preview bar */}
                            {msg.replyTo && (
                              <div className="mc-reply-bar" onClick={() => scrollToMessage(msg.replyTo)}>
                                <div className="mc-reply-bar-name">{msg.replyToSender || 'Someone'}</div>
                                <div className="mc-reply-bar-text">{msg.replyPreview || '...'}</div>
                              </div>
                            )}

                            {/* Story reply card */}
                            {msg.type === 'story_reply' && (
                              <div className="mc-story-card">
                                {msg.storyUrl && msg.storyType === 'image' && <img src={msg.storyUrl} alt="" className="mc-story-thumb" />}
                                {msg.storyUrl && msg.storyType === 'video' && (
                                  <div className="mc-story-thumb mc-story-video-thumb">🎬 Video Story</div>
                                )}
                                {msg.storyContent && <div className="mc-story-caption">{msg.storyContent.substring(0, 60)}</div>}
                                <div className="mc-story-label">Replied to story</div>
                              </div>
                            )}

                            {/* Image */}
                            {msg.type === 'image' && msg.fileUrl && (
                              <img src={msg.fileUrl} alt="" className="mc-msg-image" onClick={() => window.open(msg.fileUrl, '_blank')} />
                            )}

                            {/* File */}
                            {msg.type === 'file' && msg.fileUrl && (
                              <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" className="mc-msg-file">
                                <Paperclip size={16} /> {msg.fileName || 'Download File'}
                              </a>
                            )}

                            {/* Text content */}
                            {msg.content && <div className="mc-msg-text" dir="auto">{msg.content}</div>}

                            {/* Time + read receipt */}
                            <div className="mc-msg-meta">
                              <span className="mc-msg-time">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              {msg.edited && <span className="mc-msg-edited">edited</span>}
                              {isMine && (
                                <span className="mc-msg-read">
                                  {allRead ? <CheckCheck size={14} /> : <Check size={14} />}
                                </span>
                              )}
                            </div>

                            {/* Hover/long-press actions */}
                            {showMessageMenu === msg.id && (
                              <div className="mc-msg-menu" onClick={e => e.stopPropagation()}>
                                <button onClick={() => { setReplyingTo(msg); setShowMessageMenu(null); textareaRef.current?.focus(); }} title="Reply"><Reply size={16} /></button>
                                <button onClick={() => { setShowReactionPicker(msg.id); setShowMessageMenu(null); }} title="React"><Smile size={16} /></button>
                                {isMine && <button onClick={() => { setEditingMessage(msg); setMessageText(msg.content); setShowMessageMenu(null); textareaRef.current?.focus(); }} title="Edit"><Edit3 size={16} /></button>}
                                {isMine && <button onClick={() => deleteMessage(msg.id)} title="Delete" style={{ color: '#ef4444' }}><Trash2 size={16} /></button>}
                              </div>
                            )}
                          </div>

                          {/* Reactions */}
                          {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                            <div className="mc-reactions">
                              {Object.entries(msg.reactions).map(([emoji, users]) => (
                                users.length > 0 && (
                                  <button key={emoji} className={`mc-reaction-chip ${users.includes(user.id) ? 'active' : ''}`} onClick={() => toggleReaction(msg, emoji)}>
                                    {emoji} {users.length > 1 && <span>{users.length}</span>}
                                  </button>
                                )
                              ))}
                            </div>
                          )}

                          {/* Reaction picker */}
                          {showReactionPicker === msg.id && (
                            <div className="mc-reaction-picker" onClick={e => e.stopPropagation()}>
                              {REACTION_EMOJIS.map(emoji => (
                                <button key={emoji} onClick={() => toggleReaction(msg, emoji)}>{emoji}</button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* ── Input Area ── */}
              <div className="mc-input-area">
                {/* Reply preview */}
                {replyingTo && (
                  <div className="mc-input-reply-preview">
                    <div className="mc-input-reply-info">
                      <span className="mc-input-reply-name">Replying to {replyingTo.senderName}</span>
                      <span className="mc-input-reply-text">{replyingTo.content?.substring(0, 80) || '📎 Attachment'}</span>
                    </div>
                    <button className="mc-icon-btn" onClick={() => setReplyingTo(null)}><X size={16} /></button>
                  </div>
                )}

                {/* Edit indicator */}
                {editingMessage && (
                  <div className="mc-input-reply-preview mc-editing-preview">
                    <div className="mc-input-reply-info">
                      <span className="mc-input-reply-name">Editing message</span>
                      <span className="mc-input-reply-text">{editingMessage.content?.substring(0, 80)}</span>
                    </div>
                    <button className="mc-icon-btn" onClick={() => { setEditingMessage(null); setMessageText(''); }}><X size={16} /></button>
                  </div>
                )}

                {/* Attach preview */}
                {attachFile && (
                  <div className="mc-attach-preview">
                    {attachPreview ? <img src={attachPreview} alt="" className="mc-attach-thumb" /> : <div className="mc-attach-file-badge"><Paperclip size={16} /> {attachFile.name}</div>}
                    <button className="mc-icon-btn" onClick={() => { setAttachFile(null); setAttachPreview(null); }}><X size={16} /></button>
                  </div>
                )}

                <div className="mc-input-row">
                  <button className="mc-icon-btn" onClick={() => setShowEmojiPicker(!showEmojiPicker)} title="Emoji"><Smile size={22} /></button>
                  <button className="mc-icon-btn" onClick={() => fileInputRef.current?.click()} title="Attach"><Paperclip size={22} /></button>
                  <input type="file" ref={fileInputRef} hidden accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={handleFileSelect} />
                  <textarea
                    ref={textareaRef}
                    dir="auto"
                    className="mc-input-textarea"
                    placeholder="Type a message..."
                    value={messageText}
                    onChange={e => setMessageText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    rows={1}
                  />
                  <button className={`mc-send-btn ${(messageText.trim() || attachFile) ? 'active' : ''}`} onClick={sendMessage} disabled={uploading}>
                    {uploading ? <div className="mc-spinner" /> : <Send size={20} />}
                  </button>
                </div>

                {/* Emoji Picker */}
                {showEmojiPicker && (
                  <div className="mc-emoji-picker">
                    {EMOJI_LIST.map(e => (
                      <button key={e} className="mc-emoji-btn" onClick={() => { setMessageText(prev => prev + e); textareaRef.current?.focus(); }}>{e}</button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Group Settings Modal ── */}
          {showGroupSettings && activeRoom?.type === 'group' && (
            <div className="mc-modal-overlay" onClick={() => setShowGroupSettings(false)}>
              <div className="mc-modal" onClick={e => e.stopPropagation()}>
                <div className="mc-modal-header">
                  <h3>Group Settings</h3>
                  <button className="mc-icon-btn" onClick={() => setShowGroupSettings(false)}><X size={20} /></button>
                </div>
                <div className="mc-modal-body">
                  {/* Group avatar */}
                  <div className="mc-group-settings-avatar" onClick={() => document.getElementById('mc-group-icon-input')?.click()}>
                    {activeRoom.groupIcon ? <img src={activeRoom.groupIcon} alt="" /> : <div className="mc-group-avatar" style={{ width: 80, height: 80 }}><Camera size={28} /></div>}
                    <div className="mc-group-settings-avatar-overlay"><Camera size={20} /></div>
                    <input id="mc-group-icon-input" type="file" hidden accept="image/*" onChange={updateGroupIcon} />
                  </div>

                  {/* Group name edit */}
                  <div className="mc-group-settings-name">
                    <input type="text" defaultValue={activeRoom.groupName} onChange={e => setEditGroupName(e.target.value)} placeholder="Group name" className="mc-group-name-input" />
                    {editGroupName.trim() && editGroupName !== activeRoom.groupName && (
                      <button className="mc-save-name-btn" onClick={updateGroupName}>Save</button>
                    )}
                  </div>

                  {/* Members */}
                  <div className="mc-group-members-section">
                    <div className="mc-group-members-header">
                      <h4>Members ({(activeRoom.members || []).length})</h4>
                      <button className="mc-icon-btn mc-icon-btn-primary" onClick={() => setShowAddMembers(true)}><UserPlus size={16} /></button>
                    </div>
                    {(activeRoom.members || []).map(mid => {
                      const s = scientists.find(sc => String(sc.id) === String(mid));
                      const isMe = mid === user.id;
                      const isCreator = mid === activeRoom.createdBy;
                      return (
                        <div key={mid} className="mc-contact-item">
                          {renderAvatar(s, 36)}
                          <div className="mc-contact-info">
                            <div className="mc-contact-name" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              {s?.name || 'Unknown'}
                              {s && <SciCommVerificationBadge role={s.role} style={{ verticalAlign: 'middle', display: 'inline-flex' }} />}
                              {isCreator && <span className="mc-admin-tag">Admin</span>}
                              {isMe && <span className="mc-you-tag">You</span>}
                            </div>
                            <div className="mc-contact-dept">{s?.department || 'Member'}</div>
                          </div>
                          {!isMe && user.id === activeRoom.createdBy && (
                            <button className="mc-icon-btn" onClick={() => removeMemberFromGroup(mid)} title="Remove"><X size={16} style={{ color: '#ef4444' }} /></button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Actions */}
                  <div className="mc-group-actions">
                    <button className="mc-danger-btn" onClick={leaveGroup}><LogOut size={16} /> Leave Group</button>
                    {user.id === activeRoom.createdBy && (
                      <button className="mc-danger-btn" onClick={() => setShowDeleteConfirm(true)}><Trash2 size={16} /> Delete Group</button>
                    )}
                  </div>
                </div>

                {/* Add Members Sub-Modal */}
                {showAddMembers && (
                  <div className="mc-add-members-overlay">
                    <div className="mc-overlay-header">
                      <button className="mc-icon-btn" onClick={() => setShowAddMembers(false)}><ArrowLeft size={20} /></button>
                      <h3>Add Members</h3>
                    </div>
                    <div className="mc-overlay-search">
                      <Search size={16} className="mc-search-icon" />
                      <input type="text" placeholder="Search..." value={addMemberSearch} onChange={e => setAddMemberSearch(e.target.value)} className="mc-search-input" autoFocus />
                    </div>
                    <div className="mc-overlay-list">
                      {scientists
                        .filter(s => !activeRoom.members.includes(s.id) && String(s.id) !== String(user.id) && s.name?.toLowerCase().includes(addMemberSearch.toLowerCase()))
                        .map(s => (
                          <div key={s.id} className="mc-contact-item" onClick={() => { addMemberToGroup(s.id); setShowAddMembers(false); }}>
                            {renderAvatar(s, 36)}
                            <div className="mc-contact-info">
                              <div className="mc-contact-name" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {s.name}
                                <SciCommVerificationBadge role={s.role} style={{ verticalAlign: 'middle', display: 'inline-flex' }} />
                              </div>
                              <div className="mc-contact-dept">{s.department || 'Member'}</div>
                            </div>
                            <Plus size={18} style={{ color: '#3b82f6' }} />
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Delete Confirmation ── */}
          {showDeleteConfirm && (
            <div className="mc-modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
              <div className="mc-confirm-modal" onClick={e => e.stopPropagation()}>
                <div className="mc-confirm-icon"><Trash2 size={32} /></div>
                <h3>Delete this chat?</h3>
                <p>All messages will be permanently removed for everyone.</p>
                <div className="mc-confirm-actions">
                  <button className="mc-cancel-btn" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                  <button className="mc-delete-btn" onClick={deleteChat}>Delete</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
