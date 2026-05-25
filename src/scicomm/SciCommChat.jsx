import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Plus, Trash2, Pin, CornerUpLeft, Edit3, Copy, MoreVertical, 
  Smile, Paperclip, Send, ChevronLeft, Phone, Video, Info, X, 
  MessageSquare, User, Users, Shield, TrendingUp, Activity, Database, Check
} from 'lucide-react';

// ==========================================
// DYNAMIC MOCK DATA ARCHITECTURE
// ==========================================

const MOCK_CONTACTS = [
  {
    id: 'sarah_jenkins',
    name: 'Dr. Sarah Jenkins',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=120',
    onlineStatus: 'online',
    department: 'Lead Virologist',
    isGroup: false
  },
  {
    id: 'alan_turing',
    name: 'Prof. Alan Turing',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=120',
    onlineStatus: 'Active 10m ago',
    department: 'Computation & Crypto',
    isGroup: false
  },
  {
    id: 'rosalind_franklin',
    name: 'Dr. Rosalind Franklin',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=120',
    onlineStatus: 'Active 1h ago',
    department: 'Biophysics & DNA Structure',
    isGroup: false
  },
  {
    id: 'alexander_fleming',
    name: 'Dr. Alexander Fleming',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=120',
    onlineStatus: 'offline',
    department: 'Microbiologist',
    isGroup: false
  },
  {
    id: 'science_alliance',
    name: 'Science Alliance Group',
    avatar: '',
    onlineStatus: '5 members active',
    department: 'Universal Hub',
    isGroup: true,
    members: ['sarah_jenkins', 'alan_turing', 'rosalind_franklin', 'me']
  }
];

const INITIAL_MESSAGES = [
  {
    id: 'msg_1',
    contactId: 'sarah_jenkins',
    senderId: 'sarah_jenkins',
    senderName: 'Dr. Sarah Jenkins',
    text: 'Welcome to the portal! Let me know if you need access to the incubation chamber B data sheet.',
    timestamp: '10:15 AM',
    vectorFiles: []
  },
  {
    id: 'msg_2',
    contactId: 'sarah_jenkins',
    senderId: 'me',
    senderName: 'You',
    text: 'That would be great! Did you confirm the sample incubation parameters for tomorrow?',
    timestamp: '10:20 AM',
    vectorFiles: []
  },
  {
    id: 'msg_3',
    contactId: 'sarah_jenkins',
    senderId: 'sarah_jenkins',
    senderName: 'Dr. Sarah Jenkins',
    text: 'Yes! 37°C for 24 hours in the anaerobic chamber. I updated the protocol sheet.',
    timestamp: '10:24 AM',
    vectorFiles: ['incubation_protocol_v4.pdf'],
    replyToMessageId: 'msg_2'
  },
  {
    id: 'msg_4',
    contactId: 'sarah_jenkins',
    senderId: 'sarah_jenkins',
    senderName: 'Dr. Sarah Jenkins',
    text: 'fluorescent_culture_capture.png',
    timestamp: '10:28 AM',
    vectorFiles: [],
    storyThumbnailUrl: 'https://images.unsplash.com/photo-1576086213369-97a306d36557?auto=format&fit=crop&q=80&w=200',
    storyBadge: 'Story Reaction 🔬',
    userComment: 'Latest microscopy fluorescents from anaerobic culture! Chamber B looks ready. 🔥'
  },
  {
    id: 'msg_5',
    contactId: 'alan_turing',
    senderId: 'alan_turing',
    senderName: 'Prof. Alan Turing',
    text: 'I have analyzed the encrypted cellular communication files. The sequence suggests a dynamic feedback loop.',
    timestamp: 'Yesterday',
    vectorFiles: ['crypt_seq_analysis.xlsx']
  },
  {
    id: 'msg_6',
    contactId: 'science_alliance',
    senderId: 'rosalind_franklin',
    senderName: 'Dr. Rosalind Franklin',
    text: 'Hi everyone! Just finished uploading the crystallography diffraction pattern results to the main drive.',
    timestamp: '11:05 AM',
    vectorFiles: []
  },
  {
    id: 'msg_7',
    contactId: 'science_alliance',
    senderId: 'me',
    senderName: 'You',
    text: 'Incredible speed Rosalind! Let me review the density charts.',
    timestamp: '11:10 AM',
    vectorFiles: [],
    replyToMessageId: 'msg_6'
  }
];

const MOCK_STORIES = [
  { id: 's1', userAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=120', name: 'Sarah J.', active: true },
  { id: 's2', userAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=120', name: 'Alan T.', active: true },
  { id: 's3', userAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=120', name: 'Rosalind', active: true },
  { id: 's4', userAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=120', name: 'Alex F.', active: false }
];

export default function SciCommChat() {
  // Theme state: 'light' or 'arc'
  const [theme, setTheme] = useState('arc');
  
  // View states
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [mobileView, setMobileView] = useState('list'); // 'list' or 'chat'
  const [searchQuery, setSearchQuery] = useState('');
  
  // Data states
  const [contacts, setContacts] = useState(MOCK_CONTACTS);
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  
  // Interactive UI states
  const [inputMessage, setInputMessage] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editText, setEditText] = useState('');
  const [groupSettingsOpen, setGroupSettingsOpen] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [highlightedMsgId, setHighlightedMsgId] = useState(null);
  
  // Context Menu & Modals
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, messageId: null });
  const [deleteConfirmChat, setDeleteConfirmChat] = useState(null);
  const [toast, setToast] = useState({ visible: false, message: '' });

  // Swipe gesture variables
  const [swipeState, setSwipeState] = useState({ activeId: null, startX: 0, currentX: 0 });

  // Dashboard Chart State
  const [chartPeriod, setChartPeriod] = useState('weekly');

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (selectedContactId) {
      scrollToBottom();
    }
  }, [selectedContactId, messages]);

  // Click-to-Dismiss Context Menu
  useEffect(() => {
    const handleGlobalClick = () => {
      if (contextMenu.visible) {
        setContextMenu({ visible: false, x: 0, y: 0, messageId: null });
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [contextMenu]);

  // Toast handler
  const triggerToast = (msg) => {
    setToast({ visible: true, message: msg });
    setTimeout(() => setToast({ visible: false, message: '' }), 3000);
  };

  // Theme Toggler
  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'arc' : 'light');
    triggerToast(`Switched to ${theme === 'light' ? 'Arc Mode' : 'Light Mode'}`);
  };

  // Contacts filtering
  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeContact = contacts.find(c => c.id === selectedContactId);
  const activeMessages = messages.filter(m => m.contactId === selectedContactId);

  // Send message implementation
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const newMsg = {
      id: `msg_${Date.now()}`,
      contactId: selectedContactId,
      senderId: 'me',
      senderName: 'You',
      text: inputMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      vectorFiles: [],
      replyToMessageId: replyingTo ? replyingTo.id : undefined
    };

    setMessages(prev => [...prev, newMsg]);
    setInputMessage('');
    setReplyingTo(null);
    setShowEmojiPicker(false);
    triggerToast('Message sent!');
  };

  // Inline edit message
  const startEditing = (msg) => {
    setEditingMessageId(msg.id);
    setEditText(msg.text);
    setContextMenu({ visible: false, x: 0, y: 0, messageId: null });
  };

  const handleSaveEdit = (msgId) => {
    if (!editText.trim()) return;
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, text: editText } : m));
    setEditingMessageId(null);
    triggerToast('Message updated!');
  };

  // Delete message
  const handleDeleteMessage = (msgId) => {
    setMessages(prev => prev.filter(m => m.id !== msgId));
    triggerToast('Message deleted!');
  };

  // Delete Chat conversation
  const triggerDeleteChat = (contactId) => {
    setDeleteConfirmChat(contactId);
    setContextMenu({ visible: false, x: 0, y: 0, messageId: null });
  };

  const confirmDeleteChat = () => {
    if (!deleteConfirmChat) return;
    setMessages(prev => prev.filter(m => m.contactId !== deleteConfirmChat));
    setSelectedContactId(null);
    setDeleteConfirmChat(null);
    setMobileView('list');
    triggerToast('Conversation cleared!');
  };

  // Click-to-Scroll & Highlight Link Navigation
  const handleScrollToReply = (replyToId) => {
    if (!replyToId) return;
    const element = document.getElementById(`msg-${replyToId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMsgId(replyToId);
      setTimeout(() => setHighlightedMsgId(null), 2000);
    } else {
      triggerToast('Original message has been deleted.');
    }
  };

  // Custom Right Click / Long Press Menu handler
  const handleContextMenu = (e, messageId) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY - 20,
      messageId
    });
  };

  // Native Gesture handlers: Swipe to Reply
  const handleSwipeStart = (e, msgId) => {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    setSwipeState({
      activeId: msgId,
      startX: clientX,
      currentX: clientX
    });
  };

  const handleSwipeMove = (e) => {
    if (!swipeState.activeId) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    setSwipeState(prev => ({
      ...prev,
      currentX: clientX
    }));
  };

  const handleSwipeEnd = (msgId) => {
    if (swipeState.activeId === msgId) {
      const deltaX = swipeState.currentX - swipeState.startX;
      if (deltaX > 60) {
        const msg = messages.find(m => m.id === msgId);
        if (msg) {
          setReplyingTo(msg);
          triggerToast(`Replying to: ${msg.text.substring(0, 30)}...`);
        }
      }
    }
    setSwipeState({ activeId: null, startX: 0, currentX: 0 });
  };

  // Mock Upload Simulator
  const simulateFileUpload = () => {
    triggerToast('Diffraction density chart (Diffraction_Density_B.csv) uploaded successfully!');
  };

  // Emoji dispatch
  const injectEmoji = (emoji) => {
    setInputMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  // Mock Chart Coordinates Generator for Dashboard
  const getChartData = () => {
    switch (chartPeriod) {
      case 'weekly':
        return [
          { label: 'Mon', val: 40, barVal: 60 },
          { label: 'Tue', val: 75, barVal: 40 },
          { label: 'Wed', val: 50, barVal: 85 },
          { label: 'Thu', val: 90, barVal: 70 },
          { label: 'Fri', val: 65, barVal: 95 },
          { label: 'Sat', val: 35, barVal: 30 },
          { label: 'Sun', val: 55, barVal: 50 }
        ];
      case 'monthly':
        return [
          { label: 'Wk 1', val: 60, barVal: 40 },
          { label: 'Wk 2', val: 85, barVal: 75 },
          { label: 'Wk 3', val: 70, barVal: 90 },
          { label: 'Wk 4', val: 95, barVal: 80 }
        ];
      default:
        return [
          { label: 'Q1', val: 50, barVal: 65 },
          { label: 'Q2', val: 80, barVal: 75 },
          { label: 'Q3', val: 95, barVal: 85 },
          { label: 'Q4', val: 70, barVal: 90 }
        ];
    }
  };

  return (
    <div className={`scicomm-center-wrapper ${theme === 'arc' ? 'theme-arc' : 'theme-light'}`}>
      
      {/* ==========================================
          DYNAMIC STYLESHEET (Tailwind Translations & Micro-Interactions)
         ========================================== */}
      <style>{`
        /* Arc theme variables & layouts */
        .scicomm-center-wrapper.theme-arc {
          --bg-main: radial-gradient(circle at center, #0d1224 0%, #05070f 100%);
          --panel-bg: rgba(13, 17, 30, 0.7);
          --panel-border: rgba(255, 255, 255, 0.08);
          --text-primary: #f8fafc;
          --text-secondary: #94a3b8;
          --accent-primary: #6366f1;
          --accent-glow: 0 0 15px rgba(99, 102, 241, 0.4);
          --neon-gradient: linear-gradient(135deg, #8b5cf6, #06b6d4);
          --input-bg: rgba(255, 255, 255, 0.04);
          --scrollbar-thumb: rgba(255, 255, 255, 0.1);
        }

        .scicomm-center-wrapper.theme-light {
          --bg-main: #f1f5f9;
          --panel-bg: #ffffff;
          --panel-border: #e2e8f0;
          --text-primary: #0f172a;
          --text-secondary: #64748b;
          --accent-primary: #4f46e5;
          --accent-glow: 0 4px 12px rgba(79, 70, 229, 0.15);
          --neon-gradient: linear-gradient(135deg, #6366f1, #10b981);
          --input-bg: #f8fafc;
          --scrollbar-thumb: #cbd5e1;
        }

        .scicomm-center-wrapper {
          background: var(--bg-main);
          color: var(--text-primary);
          height: calc(100vh - 100px);
          display: flex;
          flex-direction: column;
          border-radius: 24px;
          border: 1px solid var(--panel-border);
          overflow: hidden;
          font-family: 'Inter', system-ui, sans-serif;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 20px 40px rgba(0,0,0,0.15);
        }

        /* Glassmorphic Panel Layout */
        .glass-panel {
          background: var(--panel-bg);
          backdrop-filter: blur(16px);
          border: 1px solid var(--panel-border);
          border-radius: 20px;
        }

        /* Grid Setup */
        .chat-layout-grid {
          display: grid;
          grid-template-columns: 340px 1fr;
          height: 100%;
          overflow: hidden;
        }

        @media (max-width: 768px) {
          .chat-layout-grid {
            grid-template-columns: 1fr;
          }
          .desktop-only { display: none !important; }
        }

        /* Navigation items */
        .contact-item {
          transition: all 0.2s ease;
          cursor: pointer;
          border-radius: 16px;
        }
        
        .contact-item.active {
          background: var(--neon-gradient);
          color: #ffffff !important;
          box-shadow: var(--accent-glow);
        }

        .contact-item.active .text-sec {
          color: rgba(255, 255, 255, 0.8) !important;
        }

        /* Message Bubbles */
        .msg-bubble {
          max-width: 70%;
          border-radius: 18px;
          position: relative;
          transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .msg-bubble.me {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: white;
          border-top-right-radius: 4px;
          box-shadow: 0 4px 15px rgba(99, 102, 241, 0.25);
        }

        .msg-bubble.other {
          background: var(--input-bg);
          border: 1px solid var(--panel-border);
          color: var(--text-primary);
          border-top-left-radius: 4px;
        }

        /* Gestures UI swipe-to-reply background arrow */
        .swipe-reply-reveal {
          position: absolute;
          left: 10px;
          color: #8b5cf6;
          display: flex;
          align-items: center;
          gap: 6px;
          font-weight: 700;
          font-size: 11px;
          opacity: 0;
          transform: translateX(-10px) scale(0.8);
          transition: all 0.2s ease;
        }

        .msg-row-container.swiping-active .swipe-reply-reveal {
          opacity: 1;
          transform: translateX(0) scale(1);
        }

        /* Click to scroll flash animation */
        .msg-bubble.highlight-flash {
          animation: pulseBorderHighlight 2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes pulseBorderHighlight {
          0%, 100% { border-color: var(--panel-border); box-shadow: none; }
          30% { border-color: #f59e0b; box-shadow: 0 0 20px rgba(245, 158, 11, 0.6); }
          60% { border-color: #10b981; box-shadow: 0 0 20px rgba(16, 185, 129, 0.6); }
        }

        /* Floating Scrollbars */
        .custom-scroll::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .custom-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scroll::-webkit-scrollbar-thumb {
          background: var(--scrollbar-thumb);
          border-radius: 10px;
        }

        /* Custom Dropdown animation */
        .dropdown-menu {
          animation: slideUpFade 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(8px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* Floating Toast */
        .interactive-toast {
          position: absolute;
          bottom: 24px;
          right: 24px;
          background: #0f172a;
          color: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
          border-radius: 14px;
          animation: slideUpFade 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          z-index: 10000;
        }
        .theme-light .interactive-toast {
          background: #ffffff;
          color: #0f172a;
          border-color: #e2e8f0;
        }
      `}</style>

      {/* ==========================================
          APPLICATION CORE INTERACTIVE GRID
         ========================================== */}
      <div className="chat-layout-grid flex-1">
        
        {/* SIDEBAR COMPONENT (Shown on Desktop, or Mobile list state) */}
        <div className={`flex flex-col border-r border-slate-200 dark:border-slate-800 ${
          mobileView === 'chat' ? 'hidden md:flex' : 'flex'
        }`} style={{ background: 'rgba(0,0,0,0.03)', height: '100%' }}>
          
          {/* Header Actions */}
          <div className="p-4 flex flex-col gap-3 border-b border-slate-200 dark:border-slate-800" style={{ borderColor: 'var(--panel-border)' }}>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold tracking-tight">Portal Chat</h2>
              
              {/* Mode & Create buttons */}
              <div className="flex items-center gap-2">
                <button 
                  onClick={toggleTheme} 
                  className="p-2 rounded-xl transition hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400"
                  title="Toggle Light/Arc Mode"
                >
                  {theme === 'arc' ? '☀️' : '🌙'}
                </button>
              </div>
            </div>

            {/* Live Search */}
            <div className="relative flex items-center rounded-xl px-3 py-2 border" style={{ 
              background: 'var(--input-bg)', 
              borderColor: 'var(--panel-border)' 
            }}>
              <Search size={16} className="text-slate-400 mr-2" />
              <input 
                type="text" 
                placeholder="Search collaborators..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-transparent border-none outline-none w-100 text-sm font-medium"
                style={{ color: 'var(--text-primary)' }}
              />
              {searchQuery && (
                <X size={14} className="cursor-pointer text-slate-400 ml-1" onClick={() => setSearchQuery('')} />
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2">
              <button 
                onClick={() => triggerToast("Initializing '+ New Order' dispatch portal...")}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl font-bold text-xs bg-indigo-600 text-white shadow-lg transition active:scale-95"
                style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}
              >
                <Plus size={14} /> New Order
              </button>
              <button 
                onClick={() => triggerToast("Launching '+ Create Group' chat workspace...")}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl font-bold text-xs bg-emerald-600 text-white shadow-lg transition active:scale-95"
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
              >
                <Plus size={14} /> Create Group
              </button>
            </div>
          </div>

          {/* Story Carousel */}
          <div className="p-3 flex gap-3 overflow-x-auto custom-scroll border-b" style={{ borderColor: 'var(--panel-border)', background: 'var(--panel-bg)' }}>
            {MOCK_STORIES.map(st => (
              <div 
                key={st.id} 
                onClick={() => triggerToast(`Viewing ${st.name}'s story reaction...`)}
                className="flex flex-col items-center min-w-[56px] cursor-pointer group"
              >
                <div className={`w-12 h-12 rounded-full p-[2px] flex items-center justify-center transition group-hover:scale-105 ${
                  st.active ? 'bg-gradient-to-tr from-pink-500 via-purple-500 to-indigo-500' : 'bg-slate-300 dark:bg-slate-700'
                }`} style={{ background: st.active ? 'linear-gradient(135deg, #ec4899, #8b5cf6, #3b82f6)' : '' }}>
                  <img src={st.userAvatar} alt="" className="w-full h-full rounded-full border-2 border-white dark:border-slate-900 object-cover" />
                </div>
                <span className="text-[10px] font-bold mt-1 text-slate-500 dark:text-slate-400 truncate max-w-full">{st.name}</span>
              </div>
            ))}
          </div>

          {/* Contact Lists */}
          <div className="flex-1 overflow-y-auto p-2 custom-scroll flex flex-col gap-1">
            {filteredContacts.length > 0 ? (
              filteredContacts.map(c => {
                const isActive = selectedContactId === c.id;
                const unread = c.id === 'sarah_jenkins' ? 1 : 0;
                
                return (
                  <div 
                    key={c.id} 
                    onClick={() => {
                      setSelectedContactId(c.id);
                      setMobileView('chat');
                    }}
                    className={`contact-item p-3 flex items-center gap-3 ${
                      isActive ? 'active' : 'hover:bg-slate-100 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    {/* Avatar with Status badge */}
                    <div className="relative">
                      {c.isGroup ? (
                        <div className="w-11 h-11 rounded-2xl bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-extrabold text-sm border border-indigo-200 dark:border-indigo-800">
                          <Users size={20} />
                        </div>
                      ) : (
                        <img src={c.avatar} alt="" className="w-11 h-11 rounded-2xl object-cover border" style={{ borderColor: 'var(--panel-border)' }} />
                      )}
                      
                      {c.onlineStatus === 'online' && (
                        <span className="absolute bottom-[-2px] right-[-2px] w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
                      )}
                    </div>

                    {/* Meta info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-0.5">
                        <span className="font-bold text-sm truncate">{c.name}</span>
                        <span className="text-[9.5px] text-sec text-slate-400 font-semibold">
                          {c.onlineStatus === 'online' ? 'Active' : c.onlineStatus}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-sec text-slate-400 truncate max-w-[180px] font-medium">
                          {c.department}
                        </span>
                        {unread > 0 && (
                          <span className="w-4 h-4 rounded-full bg-indigo-500 text-white font-extrabold text-[9px] flex items-center justify-center shadow-md animate-pulse">
                            {unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center p-8 text-sm text-slate-400 font-medium">
                No active collaborators found.
              </div>
            )}
          </div>
        </div>

        {/* ACTIVE CHAT MAIN WINDOW PANEL */}
        <div className={`flex flex-col overflow-hidden relative ${
          mobileView === 'list' && !selectedContactId ? 'hidden md:flex' : 'flex'
        }`} style={{ background: 'var(--panel-bg)', height: '100%' }}>
          
          {selectedContactId && activeContact ? (
            <>
              {/* Header Contact details */}
              <div className="p-4 border-b flex items-center justify-between relative z-20" style={{ borderColor: 'var(--panel-border)', background: 'var(--panel-bg)' }}>
                <div className="flex items-center gap-3">
                  {/* Mobile Back navigation */}
                  <button 
                    onClick={() => setMobileView('list')} 
                    className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 md:hidden hover:bg-slate-100 dark:hover:bg-slate-800"
                    style={{ borderColor: 'var(--panel-border)' }}
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {/* Icon or Avatar */}
                  {activeContact.isGroup ? (
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-extrabold border border-indigo-500/20">
                      <Users size={18} />
                    </div>
                  ) : (
                    <img src={activeContact.avatar} alt="" className="w-10 h-10 rounded-xl object-cover border" style={{ borderColor: 'var(--panel-border)' }} />
                  )}

                  <div>
                    <h3 className="font-extrabold text-sm flex items-center gap-1.5">
                      {activeContact.name}
                      {activeContact.onlineStatus === 'online' && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                      )}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold tracking-wide uppercase">
                      {activeContact.onlineStatus === 'online' ? 'Online Collaborator' : activeContact.onlineStatus}
                    </p>
                  </div>
                </div>

                {/* Header Call & Option Actions */}
                <div className="flex items-center gap-2 relative">
                  <button onClick={() => triggerToast("Starting encrypted audio transmission...")} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/40 text-slate-400 transition">
                    <Phone size={16} />
                  </button>
                  <button onClick={() => triggerToast("Launching secure live feed stream...")} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/40 text-slate-400 transition">
                    <Video size={16} />
                  </button>
                  
                  {/* Dropdown triggers */}
                  <button 
                    onClick={() => setGroupSettingsOpen(!groupSettingsOpen)} 
                    className={`p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/40 text-slate-400 transition ${
                      groupSettingsOpen ? 'bg-slate-100 dark:bg-slate-800 text-indigo-500' : ''
                    }`}
                  >
                    <MoreVertical size={16} />
                  </button>

                  {/* Dropdown Options Box */}
                  {groupSettingsOpen && (
                    <div className="absolute right-0 top-11 w-48 rounded-xl glass-panel dropdown-menu shadow-2xl p-1.5 z-[9999]" style={{ background: 'var(--panel-bg)' }}>
                      <button 
                        onClick={() => { setGroupSettingsOpen(false); triggerToast("Opening customization canvas..."); }}
                        className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition hover:bg-slate-100 dark:hover:bg-slate-800/40 flex items-center gap-2"
                      >
                        🎨 Change Group Pic
                      </button>
                      <button 
                        onClick={() => { setGroupSettingsOpen(false); triggerToast("Opening members configuration directory..."); }}
                        className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition hover:bg-slate-100 dark:hover:bg-slate-800/40 flex items-center gap-2"
                      >
                        👥 Manage Members
                      </button>
                      <div className="my-1 border-t border-slate-200 dark:border-slate-800" style={{ borderColor: 'var(--panel-border)' }} />
                      <button 
                        onClick={() => triggerDeleteChat(selectedContactId)}
                        className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-red-500 hover:bg-red-500/10 transition flex items-center gap-2"
                      >
                        <Trash2 size={12} /> Clear Conversation
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Message Feed Display */}
              <div 
                ref={chatContainerRef}
                onPointerMove={handleSwipeMove}
                className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scroll relative"
                style={{ 
                  background: 'var(--bg-main)',
                  backgroundImage: theme === 'arc' ? 'radial-gradient(rgba(255,255,255,0.015) 1px, transparent 1px)' : 'radial-gradient(rgba(0,0,0,0.02) 1px, transparent 1px)',
                  backgroundSize: '24px 24px'
                }}
              >
                {activeMessages.map((msg) => {
                  const isMe = msg.senderId === 'me';
                  const isHighlighted = highlightedMsgId === msg.id;
                  const isSwipingThis = swipeState.activeId === msg.id;
                  
                  // Compute swipe delta limit
                  const deltaX = isSwipingThis ? Math.max(0, Math.min(80, swipeState.currentX - swipeState.startX)) : 0;
                  const isSwipedReplyTrigger = deltaX > 60;

                  return (
                    <div 
                      key={msg.id} 
                      id={`msg-${msg.id}`}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} msg-row-container ${
                        isSwipingThis ? 'swiping-active' : ''
                      }`}
                    >
                      {/* Swipe Reply indicator underneath */}
                      <div className="swiped-reply-container w-full flex items-center relative"
                           onPointerDown={(e) => handleSwipeStart(e, msg.id)}
                           onPointerUp={() => handleSwipeEnd(msg.id)}
                           onPointerCancel={() => handleSwipeEnd(msg.id)}
                      >
                        {/* Hidden indicator */}
                        <div className="swipe-reply-reveal" style={{ 
                          transform: `translateX(${Math.min(20, deltaX / 3)}px) scale(${Math.min(1.1, 0.6 + deltaX / 100)})`,
                          opacity: Math.min(1, deltaX / 50)
                        }}>
                          <CornerUpLeft size={14} className={isSwipedReplyTrigger ? 'text-indigo-500 animate-bounce' : 'text-slate-400'} />
                          <span className={`text-[9px] font-bold uppercase tracking-wider ${isSwipedReplyTrigger ? 'text-indigo-400' : 'text-slate-500'}`}>
                            {isSwipedReplyTrigger ? 'Release' : 'Reply'}
                          </span>
                        </div>

                        {/* Interactive Swipe bubble */}
                        <div 
                          className="w-full flex flex-col"
                          style={{ 
                            transform: `translateX(${deltaX}px)`,
                            alignItems: isMe ? 'flex-end' : 'flex-start'
                          }}
                        >
                          <div 
                            onContextMenu={(e) => handleContextMenu(e, msg.id)}
                            className={`msg-bubble p-3.5 ${isMe ? 'me' : 'other'} ${
                              isHighlighted ? 'highlight-flash' : ''
                            }`}
                          >
                            {/* Original Reply Anchor Header */}
                            {msg.replyToMessageId && (
                              <div 
                                onClick={() => handleScrollToReply(msg.replyToMessageId)}
                                className="mb-2 text-xs p-2 rounded-lg cursor-pointer flex flex-col gap-0.5 border-l-2 transition hover:opacity-80"
                                style={{ 
                                  background: 'rgba(0,0,0,0.15)',
                                  borderColor: isMe ? 'white' : '#6366f1',
                                  color: isMe ? '#e0e7ff' : 'var(--text-secondary)'
                                }}
                              >
                                <span className="font-extrabold text-[10px] uppercase tracking-wide">
                                  {messages.find(m => m.id === msg.replyToMessageId)?.senderName || 'Original message'}
                                </span>
                                <span className="truncate max-w-[200px]">
                                  {messages.find(m => m.id === msg.replyToMessageId)?.text || 'Message cleared'}
                                </span>
                              </div>
                            )}

                            {/* Community Story Embed layout */}
                            {msg.storyThumbnailUrl && (
                              <div className="mb-3 rounded-xl overflow-hidden border border-slate-200/10 bg-black/20 flex flex-col max-w-[220px]">
                                <div className="relative">
                                  <img src={msg.storyThumbnailUrl} alt="" className="w-full h-24 object-cover" />
                                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[9px] font-extrabold text-white bg-rose-500/80 shadow-md">
                                    {msg.storyBadge}
                                  </span>
                                </div>
                                <div className="p-2 text-xs" style={{ color: isMe ? '#f8fafc' : 'var(--text-primary)' }}>
                                  <span className="font-semibold text-slate-300 mr-1">Comment:</span>
                                  {msg.userComment}
                                </div>
                              </div>
                            )}

                            {/* Message text body / Edit input bar */}
                            {editingMessageId === msg.id ? (
                              <div className="flex flex-col gap-2 min-w-[200px]">
                                <textarea 
                                  value={editText}
                                  onChange={e => setEditText(e.target.value)}
                                  className="w-full p-2 text-xs rounded-lg bg-black/20 text-white outline-none border border-white/10"
                                  rows={2}
                                />
                                <div className="flex justify-end gap-1.5">
                                  <button onClick={() => setEditingMessageId(null)} className="px-2 py-1 rounded bg-slate-800 text-[10px] font-bold text-white hover:bg-slate-700">Cancel</button>
                                  <button onClick={() => handleSaveEdit(msg.id)} className="px-2 py-1 rounded bg-indigo-600 text-[10px] font-bold text-white hover:bg-indigo-500">Save</button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-[13px] font-medium leading-relaxed break-words">{msg.text}</p>
                            )}

                            {/* Vector attachments list */}
                            {msg.vectorFiles && msg.vectorFiles.length > 0 && (
                              <div className="mt-2.5 flex flex-col gap-1">
                                {msg.vectorFiles.map((file, idx) => (
                                  <div 
                                    key={idx}
                                    onClick={() => triggerToast(`Downloading secure attachment: ${file}...`)}
                                    className="flex items-center gap-2 p-2 rounded-lg bg-black/10 hover:bg-black/20 cursor-pointer border border-white/5 transition"
                                  >
                                    <Paperclip size={12} className="text-indigo-400" />
                                    <span className="text-[11px] font-bold truncate max-w-[180px]">{file}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Time & Highlight logs */}
                          <div className="flex items-center gap-1.5 mt-1 px-1">
                            <span className="text-[9px] text-slate-400 font-semibold">{msg.timestamp}</span>
                            {isMe && <Check size={10} className="text-indigo-400" />}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Active Replying preview bar */}
              {replyingTo && (
                <div className="px-4 py-2 border-t flex items-center justify-between bg-slate-500/5 backdrop-blur-md" style={{ borderColor: 'var(--panel-border)' }}>
                  <div className="flex items-start gap-2.5 border-l-2 border-indigo-500 pl-2.5 py-0.5">
                    <div className="text-xs">
                      <p className="font-extrabold text-indigo-400 text-[10px] uppercase tracking-wide">Replying to {replyingTo.senderName}</p>
                      <p className="text-[11px] text-slate-400 truncate max-w-[400px]">{replyingTo.text}</p>
                    </div>
                  </div>
                  <button onClick={() => setReplyingTo(null)} className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400">
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Bottom message input field area */}
              <div className="p-4 border-t flex items-center gap-3 relative z-10" style={{ borderColor: 'var(--panel-border)', background: 'var(--panel-bg)' }}>
                {/* Vectors uploader */}
                <button 
                  onClick={simulateFileUpload}
                  className="p-3.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition"
                  title="Upload scientific vectors/files"
                >
                  <Paperclip size={18} />
                </button>

                {/* Input Text Form */}
                <form onSubmit={handleSendMessage} className="flex-1 flex items-center gap-3">
                  <div className="flex-1 flex items-center rounded-full px-4 py-3 relative border" style={{ 
                    background: 'var(--input-bg)',
                    borderColor: 'var(--panel-border)'
                  }}>
                    <input 
                      type="text"
                      placeholder="Type secure transmission..."
                      value={inputMessage}
                      onChange={e => setInputMessage(e.target.value)}
                      className="bg-transparent border-none outline-none w-full text-xs font-semibold"
                      style={{ color: 'var(--text-primary)' }}
                    />
                    
                    {/* Emoji panel selector */}
                    <div className="relative">
                      <button 
                        type="button" 
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className={`text-slate-400 transition hover:text-slate-200 ${showEmojiPicker ? 'text-indigo-400' : ''}`}
                      >
                        <Smile size={18} />
                      </button>

                      {/* Small Quick Emoji Dropdown */}
                      {showEmojiPicker && (
                        <div className="absolute right-0 bottom-8 p-2 rounded-xl shadow-2xl glass-panel flex gap-1 z-[99999]" style={{ background: 'var(--panel-bg)' }}>
                          {['👍', '🔥', '🔬', '💡', '🧪', '🧬', '👏'].map(emoji => (
                            <button 
                              key={emoji}
                              type="button"
                              onClick={() => injectEmoji(emoji)}
                              className="w-7 h-7 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-sm flex items-center justify-center transition active:scale-90"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <button 
                    type="submit"
                    className="p-3.5 rounded-full text-white transition active:scale-95 shadow-md flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                  >
                    <Send size={16} />
                  </button>
                </form>
              </div>
            </>
          ) : (
            // ==========================================
            // HIGH FIDELITY EMPTY STATE: ANALYTICS DASHBOARD
            // ==========================================
            <div className="flex-1 flex flex-col justify-center p-6 md:p-12 custom-scroll overflow-y-auto" style={{ background: 'var(--bg-main)' }}>
              <div className="max-w-[700px] mx-auto w-full flex flex-col gap-6">
                
                {/* Header title */}
                <div className="text-center md:text-left flex flex-col gap-2">
                  <div className="inline-flex self-center md:self-start items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    <Database size={12} /> System Terminal Activated
                  </div>
                  <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">Communications Diagnostics</h2>
                  <p className="text-xs text-slate-400 max-w-[500px]">
                    Select a collaborator or group workspace from the sidebar folder directory, or review the telemetry charts below.
                  </p>
                </div>

                {/* Quick Diagnostics Stats grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl border glass-panel flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                      <MessageSquare size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Transmissions</p>
                      <p className="text-lg font-black">1,482</p>
                    </div>
                  </div>
                  <div className="p-4 rounded-2xl border glass-panel flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                      <Activity size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Signal Health</p>
                      <p className="text-lg font-black">99.8%</p>
                    </div>
                  </div>
                  <div className="p-4 rounded-2xl border glass-panel flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 border border-cyan-500/20">
                      <TrendingUp size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Active Hubs</p>
                      <p className="text-lg font-black">12</p>
                    </div>
                  </div>
                </div>

                {/* Telemetry charts */}
                <div className="p-5 rounded-3xl border glass-panel flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sm flex items-center gap-1.5">
                      📈 Transmission Volumes
                    </span>
                    
                    {/* Period filters */}
                    <div className="flex rounded-lg p-0.5 border" style={{ borderColor: 'var(--panel-border)', background: 'var(--input-bg)' }}>
                      {['weekly', 'monthly', 'quarterly'].map(period => (
                        <button 
                          key={period}
                          onClick={() => setChartPeriod(period)}
                          className={`px-3 py-1 rounded-md text-[10px] font-bold tracking-wide uppercase transition ${
                            chartPeriod === period ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {period}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Fully Coded SVG Analytics Chart representation */}
                  <div className="relative pt-4">
                    <div className="h-44 flex items-end gap-3 justify-between px-2 relative z-10">
                      {getChartData().map((data, idx) => (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-2 group cursor-pointer">
                          {/* Hover Tooltip bar */}
                          <div className="w-full flex items-end justify-center gap-1.5 h-32 relative">
                            {/* Column Bar representation */}
                            <div 
                              className="w-3 rounded-full bg-slate-200 dark:bg-slate-800 transition-all duration-500 group-hover:bg-slate-700" 
                              style={{ height: `${data.barVal}%` }} 
                            />
                            {/* Core Signal Plot representation */}
                            <div 
                              className="w-3 rounded-full bg-gradient-to-t from-indigo-600 to-purple-500 transition-all duration-500" 
                              style={{ 
                                height: `${data.val}%`,
                                background: 'linear-gradient(to top, #6366f1, #8b5cf6)'
                              }} 
                            />
                          </div>
                          
                          <span className="text-[10px] font-extrabold text-slate-400">{data.label}</span>
                        </div>
                      ))}
                    </div>

                    {/* Horizontal background grids */}
                    <div className="absolute inset-0 top-8 flex flex-col justify-between pointer-events-none opacity-20">
                      {[1, 2, 3, 4].map(line => (
                        <div key={line} className="w-full border-t border-slate-300 dark:border-slate-700" />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="text-center text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                  Secure peer-to-peer data tunnel · TLS 1.3 encryption
                </div>

              </div>
            </div>
          )}

        </div>

      </div>

      {/* ==========================================
          ACTION OVERLAYS, DROPDOWNS, CONTEXT MENUS & MODALS
         ========================================== */}

      {/* Dynamic Context Menu Overlay */}
      {contextMenu.visible && (
        <div 
          className="fixed w-40 glass-panel dropdown-menu shadow-2xl p-1 z-[99999]"
          style={{ 
            top: contextMenu.y, 
            left: contextMenu.x,
            background: 'var(--panel-bg)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button 
            onClick={() => {
              const msg = messages.find(m => m.id === contextMenu.messageId);
              if (msg) setReplyingTo(msg);
              setContextMenu({ visible: false, x: 0, y: 0, messageId: null });
            }}
            className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition hover:bg-slate-100 dark:hover:bg-slate-800/40 flex items-center justify-between"
          >
            Reply <CornerUpLeft size={12} />
          </button>
          <button 
            onClick={() => {
              const msg = messages.find(m => m.id === contextMenu.messageId);
              if (msg) startEditing(msg);
            }}
            className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition hover:bg-slate-100 dark:hover:bg-slate-800/40 flex items-center justify-between"
          >
            Edit <Edit3 size={12} />
          </button>
          <button 
            onClick={() => {
              triggerToast('Message text copied to clipboard!');
              setContextMenu({ visible: false, x: 0, y: 0, messageId: null });
            }}
            className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition hover:bg-slate-100 dark:hover:bg-slate-800/40 flex items-center justify-between"
          >
            Copy <Copy size={12} />
          </button>
          <div className="my-1 border-t border-slate-200 dark:border-slate-800" style={{ borderColor: 'var(--panel-border)' }} />
          <button 
            onClick={() => {
              handleDeleteMessage(contextMenu.messageId);
              setContextMenu({ visible: false, x: 0, y: 0, messageId: null });
            }}
            className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-red-500 hover:bg-red-500/10 transition flex items-center justify-between"
          >
            Delete <Trash2 size={12} />
          </button>
        </div>
      )}

      {/* Confirmation modal: Clear conversation */}
      {deleteConfirmChat && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[999999] flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl p-6 glass-panel text-center flex flex-col gap-4" style={{ background: 'var(--panel-bg)' }}>
            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto border border-red-500/20 shadow-lg">
              <Trash2 size={22} />
            </div>
            <div>
              <h4 className="font-extrabold text-lg text-red-500">Confirm Deletion</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Are you sure you want to completely delete all message streams with this collaborator? This action is irreversible.
              </p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setDeleteConfirmChat(null)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDeleteChat}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-red-600 text-white hover:bg-red-500 shadow-md transition active:scale-95"
              >
                Clear Chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating System micro-toasts */}
      {toast.visible && (
        <div className="interactive-toast py-3 px-5 flex items-center gap-2 text-xs font-bold shadow-2xl">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          {toast.message}
        </div>
      )}

    </div>
  );
}
