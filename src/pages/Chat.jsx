import { useState, useRef, useEffect } from 'react';
import { db, useLiveCollection } from '../db';
import { Send, User, Users, MessageSquare, Smile, Paperclip, X, FileText, ArrowLeft, MoreVertical } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Chat() {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [recipient, setRecipient] = useState('global');
  const [showEmojis, setShowEmojis] = useState(false);
  const [filePreview, setFilePreview] = useState(null);
  const [mobileShowInbox, setMobileShowInbox] = useState(true);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const rawMessages = useLiveCollection('messages');
  const scientists = useLiveCollection('scientists');

  const emojis = ['😀','😂','😍','👍','👏','🔬','🧪','✅','❌','🔥','👀','🎉','💡','🚀','💪','❤️','🙏','🤔','😎','⚡'];

  const filteredMessages = rawMessages ? [...rawMessages]
    .filter(msg => {
      if (recipient === 'global') {
        return !msg.receiverId || msg.receiverId === 'global';
      } else {
        return (String(msg.senderId) === String(user.id) && String(msg.receiverId) === String(recipient)) || 
               (String(msg.senderId) === String(recipient) && String(msg.receiverId) === String(user.id));
      }
    })
    .sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()) : [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
    // Update last read chat to clear notifications
    if (user?.id) {
      db.scientists.update(user.id, { lastReadChat: new Date().toISOString() }).catch(() => {});
    }
  }, [filteredMessages, user?.id]);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 500 * 1024) {
      alert('File must be less than 500KB for chat uploads.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFilePreview({
        name: file.name,
        type: file.type,
        data: reader.result,
        isImage: file.type.startsWith('image/')
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim() && !filePreview) return;
    try {
      const msgData = {
        text: text || '',
        senderId: user.id,
        receiverId: recipient,
        timestamp: new Date().toISOString()
      };

      if (filePreview) {
        msgData.attachment = {
          name: filePreview.name,
          type: filePreview.type,
          data: filePreview.data,
          isImage: filePreview.isImage
        };
      }

      await db.messages.add(msgData);
      setText('');
      setFilePreview(null);
      setShowEmojis(false);
    } catch (err) {
      console.error("Failed to send message", err);
    }
  };

  // Helper to fetch the last message object in a conversation
  const getLastMessageInfo = (recipId) => {
    if (!rawMessages) return null;
    const msgs = rawMessages.filter(msg => {
      if (recipId === 'global') {
        return !msg.receiverId || msg.receiverId === 'global';
      } else {
        return (String(msg.senderId) === String(user.id) && String(msg.receiverId) === String(recipId)) || 
               (String(msg.senderId) === String(recipId) && String(msg.receiverId) === String(user.id));
      }
    });
    if (msgs.length === 0) return null;
    const sorted = [...msgs].sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return sorted[sorted.length - 1];
  };

  // Format timestamp nicely for sidebar
  const formatMsgTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // Render a smart snippet for the last message
  const getLastMessageText = (recipId) => {
    const lastMsg = getLastMessageInfo(recipId);
    if (!lastMsg) return 'No messages yet';
    
    const senderName = String(lastMsg.senderId) === String(user?.id) 
      ? 'You' 
      : (scientists?.find(s => String(s.id) === String(lastMsg.senderId))?.name?.split(' ')[0] || 'Unknown');
    
    const textContent = lastMsg.text 
      ? lastMsg.text 
      : (lastMsg.attachment ? '📁 Attachment' : '');
    
    return `${senderName}: ${textContent}`;
  };

  // Calculate unread count per conversation
  const getUnreadCount = (recipId) => {
    if (!rawMessages || !user || !scientists) return 0;
    const currentUserData = scientists.find(s => String(s.id) === String(user.id));
    const lastRead = currentUserData?.lastReadChat ? new Date(currentUserData.lastReadChat).getTime() : 0;
    
    const unread = rawMessages.filter(m => {
      const isIncoming = recipId === 'global' 
        ? (!m.receiverId || m.receiverId === 'global') && String(m.senderId) !== String(user.id)
        : String(m.senderId) === String(recipId) && String(m.receiverId) === String(user.id);
      
      return isIncoming && new Date(m.timestamp).getTime() > lastRead;
    });
    return unread.length;
  };

  // Get display details for the active conversation
  const getRecipientName = () => {
    if (recipient === 'global') return '🌐 Global Team Chat';
    const s = scientists?.find(s => String(s.id) === String(recipient));
    return s ? `🔒 ${s.name}` : '🔒 Private Chat';
  };

  const getRecipientAvatar = () => {
    if (recipient === 'global') return null;
    const s = scientists?.find(s => String(s.id) === String(recipient));
    return s?.avatar || null;
  };

  if (!rawMessages || !scientists) return <div className="page-content container">Loading chat...</div>;

  // Sort scientists by last active chat timestamp (active ones float to top)
  const sortedScientists = [...scientists]
    .filter(s => String(s.id) !== String(user?.id))
    .sort((a, b) => {
      const msgA = getLastMessageInfo(String(a.id));
      const msgB = getLastMessageInfo(String(b.id));
      
      const timeA = msgA ? new Date(msgA.timestamp).getTime() : 0;
      const timeB = msgB ? new Date(msgB.timestamp).getTime() : 0;
      
      return timeB - timeA;
    });

  return (
    <div className="chat-container-main">
      {/* Scope-contained Custom Styles */}
      <style>{`
        .chat-container-main {
          height: calc(100dvh - 160px);
          display: flex;
          flex-direction: column;
          margin-bottom: 1.5rem;
        }

        .chat-card {
          flex: 1;
          display: flex;
          overflow: hidden;
          padding: 0;
          border-radius: 12px;
          background: var(--surface);
          border: 1px solid var(--border-color);
          box-shadow: var(--shadow-md);
        }

        .chat-sidebar {
          width: 320px;
          border-right: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          background-color: var(--surface);
          flex-shrink: 0;
          z-index: 10;
        }

        .chat-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
          background-color: var(--bg-color);
        }

        /* --- Custom Sidebar UI --- */
        .sidebar-header {
          padding: 1rem 1.25rem;
          border-bottom: 1px solid var(--border-color);
          font-weight: 700;
          font-size: 1.1rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: var(--primary-dark);
        }

        .contacts-list {
          flex: 1;
          overflow-y: auto;
        }

        .contact-item {
          display: flex;
          align-items: center;
          gap: 0.85rem;
          padding: 0.9rem 1.25rem;
          cursor: pointer;
          border-bottom: 1px solid var(--border-color);
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
        }

        .contact-item:hover {
          background-color: var(--secondary);
          opacity: 0.95;
        }

        .contact-item.active {
          background-color: var(--secondary);
          border-left: 4px solid var(--primary);
        }

        .avatar-wrapper {
          position: relative;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: var(--secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--primary);
          flex-shrink: 0;
        }

        .avatar-wrapper img {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid var(--surface);
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .global-avatar {
          background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);
          color: white;
        }

        .contact-details {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .contact-name-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .contact-name {
          font-weight: 600;
          font-size: 0.925rem;
          color: var(--text-main);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .contact-time {
          font-size: 0.7rem;
          color: var(--text-muted);
        }

        .contact-snippet-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.5rem;
        }

        .contact-snippet {
          font-size: 0.775rem;
          color: var(--text-muted);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          flex: 1;
        }

        .unread-badge {
          background-color: var(--accent);
          color: white;
          font-size: 0.7rem;
          font-weight: 700;
          min-width: 18px;
          height: 18px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 5px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.15);
        }

        /* --- Custom Active Chat UI --- */
        .chat-area-header {
          padding: 0.75rem 1.25rem;
          border-bottom: 1px solid var(--border-color);
          background-color: var(--surface);
          display: flex;
          align-items: center;
          justify-content: space-between;
          z-index: 5;
          box-shadow: 0 1px 2px rgba(0,0,0,0.02);
        }

        .chat-header-left {
          display: flex;
          align-items: center;
          gap: 0.85rem;
          min-width: 0;
        }

        .chat-header-title {
          font-size: 1rem;
          font-weight: 600;
          margin: 0;
          color: var(--primary-dark);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .chat-header-status {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .mobile-back-btn {
          display: none;
          background: none;
          border: none;
          color: var(--text-main);
          padding: 0.35rem;
          cursor: pointer;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: background 0.2s;
          flex-shrink: 0;
          margin-right: -0.25rem;
        }

        .mobile-back-btn:hover {
          background: var(--secondary);
        }

        .messages-list-wrapper {
          flex: 1;
          overflow-y: auto;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
          background-color: var(--bg-color);
        }

        /* --- Custom Message Bubble UI --- */
        .chat-bubble-container {
          display: flex;
          flex-direction: column;
          max-width: 75%;
          animation: fadeInBubble 0.22s cubic-bezier(0.1, 0.8, 0.25, 1);
        }

        @keyframes fadeInBubble {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .bubble-mine {
          align-self: flex-end;
          align-items: flex-end;
        }

        .bubble-other {
          align-self: flex-start;
          align-items: flex-start;
        }

        .bubble-sender {
          font-size: 0.725rem;
          color: var(--text-muted);
          margin-bottom: 3px;
          margin-left: 6px;
          margin-right: 6px;
          display: flex;
          align-items: center;
          gap: 4px;
          font-weight: 500;
        }

        .bubble-content {
          padding: 0.7rem 0.95rem;
          font-size: 0.925rem;
          line-height: 1.45;
          box-shadow: 0 1.5px 3px rgba(0, 0, 0, 0.05);
          word-break: break-word;
          max-width: 100%;
        }

        .bubble-content-mine {
          background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);
          color: white;
          border-radius: 18px 18px 4px 18px;
        }

        .bubble-content-other {
          background: var(--surface);
          color: var(--text-main);
          border: 1px solid var(--border-color);
          border-radius: 18px 18px 18px 4px;
        }

        .bubble-time {
          font-size: 0.65rem;
          color: var(--text-muted);
          margin-top: 4px;
          align-self: inherit;
        }

        /* --- Attachment Style inside Bubble --- */
        .attachment-container {
          margin-bottom: 0.5rem;
        }

        .attachment-image {
          max-width: 100%;
          max-height: 220px;
          border-radius: 10px;
          cursor: pointer;
          object-fit: contain;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          transition: transform 0.2s;
        }

        .attachment-image:hover {
          transform: scale(1.02);
        }

        .attachment-file-box {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          padding: 0.6rem 0.85rem;
          border-radius: 8px;
          text-decoration: none;
          font-size: 0.8rem;
          font-weight: 500;
          color: inherit;
          transition: background 0.2s;
        }

        .bubble-content-mine .attachment-file-box {
          background: rgba(255,255,255,0.15);
        }

        .bubble-content-mine .attachment-file-box:hover {
          background: rgba(255,255,255,0.25);
        }

        .bubble-content-other .attachment-file-box {
          background: var(--secondary);
        }

        .bubble-content-other .attachment-file-box:hover {
          background: var(--border-color);
        }

        /* --- Typing Input Bar UI --- */
        .chat-input-bar {
          padding: 0.8rem 1.25rem;
          border-top: 1px solid var(--border-color);
          background-color: var(--surface);
          position: relative;
          z-index: 5;
        }

        .chat-input-form {
          display: flex;
          gap: 0.6rem;
          align-items: center;
        }

        .chat-input-field {
          flex: 1;
          height: 42px;
          border-radius: 24px;
          padding: 0.5rem 1.25rem;
          border: 1px solid var(--border-color);
          background-color: var(--bg-color);
          color: var(--text-main);
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          font-size: 0.95rem;
        }

        .chat-input-field:focus {
          outline: none;
          border-color: var(--primary);
          background-color: var(--surface);
          box-shadow: 0 0 0 3px rgba(33, 40, 69, 0.12);
        }

        .chat-action-btn {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          background: var(--secondary);
          border: none;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          flex-shrink: 0;
          cursor: pointer;
        }

        .chat-action-btn:hover {
          background: var(--border-color);
          color: var(--text-main);
          transform: scale(1.06);
        }

        .chat-send-btn {
          background: var(--primary);
          color: white;
        }

        .chat-send-btn:hover {
          background: var(--primary-light);
          color: white;
          transform: scale(1.06);
        }

        /* --- Emoji Tray UI --- */
        .emoji-tray {
          position: absolute;
          bottom: 100%;
          left: 1.25rem;
          margin-bottom: 0.6rem;
          background: var(--surface);
          backdrop-filter: blur(12px);
          padding: 0.75rem;
          border-radius: 16px;
          box-shadow: var(--shadow-lg);
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 0.4rem;
          border: 1px solid var(--border-color);
          max-width: 250px;
          z-index: 20;
          animation: slideUpTray 0.2s cubic-bezier(0.1, 0.8, 0.25, 1);
        }

        @keyframes slideUpTray {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .emoji-item {
          cursor: pointer;
          font-size: 1.4rem;
          padding: 5px;
          border-radius: 8px;
          text-align: center;
          transition: all 0.15s ease;
          user-select: none;
        }

        .emoji-item:hover {
          background-color: var(--secondary);
          transform: scale(1.22);
        }

        /* --- File Preview UI --- */
        .preview-tray {
          padding: 0.6rem 1.25rem;
          border-top: 1px solid var(--border-color);
          backgroundColor: var(--secondary);
          display: flex;
          align-items: center;
          gap: 0.85rem;
          animation: slideUpTray 0.2s ease;
        }

        .preview-avatar {
          width: 48px;
          height: 48px;
          border-radius: 8px;
          object-fit: cover;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .preview-icon-box {
          width: 48px;
          height: 48px;
          border-radius: 8px;
          background-color: var(--secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--primary);
        }

        /* ================================================
           RESPONSIVE STYLE overrides
           ================================================ */
        @media (max-width: 768px) {
          .chat-container-main {
            height: auto !important;
            min-height: calc(100dvh - 130px);
            margin-bottom: 0;
            display: block;
          }

          .chat-card {
            border-radius: 0;
            border: none;
            background: transparent;
            box-shadow: none;
            height: auto !important;
            min-height: calc(100dvh - 130px);
            display: block;
          }

          /* --- Dual-screen state navigation on mobile --- */
          .chat-sidebar {
            width: 100% !important;
            display: ${mobileShowInbox ? 'flex' : 'none'} !important;
            border-right: none;
            height: auto !important;
          }

          .chat-area {
            width: 100% !important;
            display: ${!mobileShowInbox ? 'flex' : 'none'} !important;
            height: auto !important;
            background: transparent;
          }

          .chat-area-header {
            position: sticky;
            top: 50px; /* height of slim app header */
            z-index: 90;
            border-bottom: 1px solid var(--border-color);
          }

          .messages-list-wrapper {
            height: auto !important;
            overflow: visible !important;
            flex: none !important;
            padding: 1rem 0.5rem;
          }

          .chat-input-bar {
            position: sticky;
            bottom: var(--bottom-bar-height, 64px);
            z-index: 90;
            border-top: 1px solid var(--border-color);
            background: var(--surface);
          }

          .mobile-back-btn {
            display: inline-flex;
          }

          .emoji-tray {
            left: 0.5rem;
            right: 0.5rem;
            max-width: none;
            grid-template-columns: repeat(10, 1fr);
          }

          /* Hide scrollbars on internal scrollable lists */
          .messages-list-wrapper::-webkit-scrollbar,
          .contacts-list::-webkit-scrollbar {
            display: none;
          }
          .messages-list-wrapper,
          .contacts-list {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        }
      `}</style>

      <div className="chat-card">
        {/* Inbox/Conversations Directory Panel */}
        <div className="chat-sidebar">
          <div className="sidebar-header">
            <span>💬 Chats</span>
            <Users size={18} style={{ color: 'var(--text-muted)' }} />
          </div>

          <div className="contacts-list">
            {/* Global Chat Row */}
            <div 
              className={`contact-item ${recipient === 'global' ? 'active' : ''}`}
              onClick={() => {
                setRecipient('global');
                setMobileShowInbox(false);
              }}
            >
              <div className="avatar-wrapper global-avatar">
                <MessageSquare size={18} />
              </div>
              <div className="contact-details">
                <div className="contact-name-row">
                  <span className="contact-name">🌐 Global Team Chat</span>
                  <span className="contact-time">
                    {formatMsgTime(getLastMessageInfo('global')?.timestamp)}
                  </span>
                </div>
                <div className="contact-snippet-row">
                  <span className="contact-snippet">{getLastMessageText('global')}</span>
                  {getUnreadCount('global') > 0 && (
                    <span className="unread-badge">{getUnreadCount('global')}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Individual Scientists Rows */}
            {sortedScientists.map(s => {
              const sId = String(s.id);
              const unreadCount = getUnreadCount(sId);
              const isActive = recipient === sId;
              
              return (
                <div 
                  key={sId}
                  className={`contact-item ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    setRecipient(sId);
                    setMobileShowInbox(false);
                  }}
                >
                  <div className="avatar-wrapper">
                    {s.avatar ? (
                      <img src={s.avatar} alt={s.name} />
                    ) : (
                      <User size={18} />
                    )}
                  </div>
                  <div className="contact-details">
                    <div className="contact-name-row">
                      <span className="contact-name">{s.name}</span>
                      <span className="contact-time">
                        {formatMsgTime(getLastMessageInfo(sId)?.timestamp)}
                      </span>
                    </div>
                    <div className="contact-snippet-row">
                      <span className="contact-snippet">{getLastMessageText(sId)}</span>
                      {unreadCount > 0 && (
                        <span className="unread-badge">{unreadCount}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Active Conversation Panel */}
        <div className="chat-area">
          <div className="chat-area-header">
            <div className="chat-header-left">
              <button 
                className="mobile-back-btn" 
                onClick={() => setMobileShowInbox(true)}
                title="Back to inbox"
              >
                <ArrowLeft size={18} />
              </button>

              <div className="avatar-wrapper" style={{ width: '36px', height: '36px' }}>
                {recipient === 'global' ? (
                  <div className="avatar-wrapper global-avatar" style={{ width: '36px', height: '36px' }}>
                    <MessageSquare size={15} />
                  </div>
                ) : getRecipientAvatar() ? (
                  <img src={getRecipientAvatar()} alt={getRecipientName()} />
                ) : (
                  <User size={15} />
                )}
              </div>

              <div>
                <h2 className="chat-header-title">{getRecipientName()}</h2>
                <span className="chat-header-status">
                  {recipient === 'global' ? 'All team members' : 'Secure private connection'}
                </span>
              </div>
            </div>
            
            <button className="chat-action-btn" style={{ width: '36px', height: '36px', background: 'transparent' }}>
              <MoreVertical size={18} />
            </button>
          </div>
          
          {/* Messages Scrolling Area */}
          <div className="messages-list-wrapper">
            {filteredMessages.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', margin: 'auto' }}>
                <div style={{ fontSize: '3.5rem', marginBottom: '0.75rem' }}>💬</div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                  No messages yet
                </h3>
                <p style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                  Start the conversation! Type a message below.
                </p>
              </div>
            ) : (
              filteredMessages.map((msg, idx) => {
                const isMine = String(msg.senderId) === String(user.id);
                const sender = scientists.find(s => String(s.id) === String(msg.senderId));
                const showHeader = idx === 0 || String(filteredMessages[idx-1].senderId) !== String(msg.senderId);

                return (
                  <div 
                    key={msg.id} 
                    className={`chat-bubble-container ${isMine ? 'bubble-mine' : 'bubble-other'}`}
                  >
                    {showHeader && (
                      <div className="bubble-sender">
                        {!isMine && sender?.avatar && (
                          <img 
                            src={sender.avatar} 
                            alt="" 
                            style={{ width: '14px', height: '14px', borderRadius: '50%', objectFit: 'cover' }} 
                          />
                        )}
                        {!isMine && !sender?.avatar && <User size={11} />}
                        <span>{isMine ? 'You' : (sender?.name || 'Unknown')}</span>
                      </div>
                    )}
                    
                    <div className={`bubble-content ${isMine ? 'bubble-content-mine' : 'bubble-content-other'}`}>
                      {/* Attachment preview */}
                      {msg.attachment && (
                        <div className="attachment-container">
                          {msg.attachment.isImage ? (
                            <img 
                              src={msg.attachment.data} 
                              alt={msg.attachment.name} 
                              className="attachment-image"
                              onClick={() => window.open(msg.attachment.data, '_blank')}
                            />
                          ) : (
                            <a 
                              href={msg.attachment.data} 
                              download={msg.attachment.name}
                              className="attachment-file-box"
                            >
                              <FileText size={16} />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {msg.attachment.name}
                              </span>
                            </a>
                          )}
                        </div>
                      )}
                      
                      {msg.text && <div>{msg.text}</div>}
                    </div>
                    
                    <span className="bubble-time">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
          
          {/* File Upload Preview Panel */}
          {filePreview && (
            <div className="preview-tray">
              {filePreview.isImage ? (
                <img src={filePreview.data} alt="Preview" className="preview-avatar" />
              ) : (
                <div className="preview-icon-box">
                  <FileText size={20} />
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.825rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-main)' }}>
                  {filePreview.name}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {filePreview.isImage ? '🖼️ Image' : '📄 File'}
                </div>
              </div>
              <button 
                onClick={() => setFilePreview(null)} 
                style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <X size={18} />
              </button>
            </div>
          )}

          {/* Chat Message Input Controls */}
          <div className="chat-input-bar">
            {showEmojis && (
              <div className="emoji-tray">
                {emojis.map(e => (
                  <span 
                    key={e} 
                    className="emoji-item"
                    onClick={() => setText(prev => prev + e)}
                  >
                    {e}
                  </span>
                ))}
              </div>
            )}
            
            <form onSubmit={handleSend} className="chat-input-form">
              <button 
                type="button" 
                className="chat-action-btn" 
                onClick={() => setShowEmojis(!showEmojis)}
                title="Add emoji"
              >
                <Smile size={18} />
              </button>
              
              <button 
                type="button" 
                className="chat-action-btn" 
                onClick={() => fileInputRef.current.click()}
                title="Attach file"
              >
                <Paperclip size={18} />
              </button>
              
              <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                onChange={handleFileSelect}
                accept="image/*,.pdf,.doc,.docx,.txt,.xlsx,.csv"
              />
              
              <input 
                type="text" 
                className="chat-input-field" 
                placeholder="Type your message..." 
                value={text} 
                onChange={e => setText(e.target.value)} 
              />
              
              <button 
                type="submit" 
                className="chat-action-btn chat-send-btn"
                title="Send message"
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
