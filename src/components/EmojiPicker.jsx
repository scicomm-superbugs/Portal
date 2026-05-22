import React, { useState, useEffect, useRef } from 'react';

// Standard emoji sets matching Google Keyboard categories
const EMOJI_CATEGORIES = [
  {
    id: 'smileys',
    name: 'Smileys & Emotion',
    icon: '😀',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
      '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
      '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗',
      '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐',
      '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '👺', '👹', '👿', '😈', '💀', '☠️', '💩', '🤡', '👻', '👽', '👾', '🤖'
    ]
  },
  {
    id: 'animals',
    name: 'Animals & Nature',
    icon: '🐻',
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒',
      '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜',
      '🕷️', '🕸️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈',
      '🐊', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🐄', '🐎', '🐖', '🐏', '🐑', '🐐', '🦌', '🐕',
      '🐈', '🐓', '🦃', '🦚', '🦜', '🦢', '🦩', '🕊️', '🐇', '🦝', '🦡', '🦦', '🦥', '🐿️', '🦔', '🐾', '🐉', '🌵', '🎄', '🌲',
      '🌳', '🌴', '🌱', '🌿', '☘️', '🍀', '🍁', '🍂', '🍃'
    ]
  },
  {
    id: 'food',
    name: 'Food & Drink',
    icon: '🍔',
    emojis: [
      '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦',
      '🥬', '🥒', '🌶️', '🌽', '🥕', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🥞', ' Bacon ', '🥓', '🥩', '🍗',
      '🍖', '🌭', '🍔', '🍟', '🍕', '🥪', '🥙', '🌮', '🌯', '🥗', '🥘', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🍤',
      '🍙', '🍚', '🍘', '🍥', '🍢', '🍡', '🍧', '🍨', '🍦', '🍰', '🎂', '🧁', '🥧', '🍫', '🍬', '🍭', '🍮', '🍯', '🍼', '🥛',
      '☕', '🍵', '🍶', '🍾', '🍷', '🍸', '🍹', '🍺', '🍻', '🥤'
    ]
  },
  {
    id: 'activities',
    name: 'Sports & Activities',
    icon: '⚽',
    emojis: [
      '👾', '🎮', '🕹️', '🎲', '🎯', '🎳', '🏈', '🏀', '⚽', '⚾', '🥎', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸', '🥅', '🏒', '🏑',
      '🏏', '⛳', '🏹', '🎣', '🤿', '🥊', '🥋', '⛸️', '🎿', '🛷', '🥌', '🏋️', '🤺', '🤼', '🤸', '⛹️', '🤾', '🚴', '🏃', '🚶',
      '🧗', '🏊', '🏄', '🚣', '🤽', '🏂', '🧘'
    ]
  },
  {
    id: 'travel',
    name: 'Travel & Places',
    icon: '🚗',
    emojis: [
      '🚗', '🚕', '🚙', '🚌', '🏎️', '🚓', '🚑', '🚒', '🚐', '🚚', '🚛', '🚜', '🛴', '🚲', '🛵', '🏍️', '🚨', '🚔', '🚍', '🚘',
      '🚃', '🚋', '🚞', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇', '🚉', '✈️', '🛫', '🛰️', '🚀', '🛸', '🚁', '🛶', '⛵', '🛥️', '🚤',
      '🛳️', '⛴️', '🚢', '⚓', '🗺️', '🧭', '🏔️', '⛰️', '🌋', '🗻', '🏕️', '🏖️', '🏜️', '🏝️', '🏞️', '🏟️', '🏛️', '🏠', '🏡',
      '🏢', '🏥', '🏦', '🏨', '🏪', '🏫', '🏬', '🏭', '🏯', '🏰', '🗼', '🗽', '⛪', '🕌', '🕋', '⛩️', '⛲', '⛺', '', '🌃',
      '🌄', '🌅', '🌆', '🌇', '🌉', '🎠', '🎡', '🎢'
    ]
  },
  {
    id: 'objects',
    name: 'Objects',
    icon: '💡',
    emojis: [
      '⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🗜️', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽️',
      '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋', '🔌', '💡',
      ' flashlight ', '🔦', '🕯️', '🪔', '🗑️', '🛢️', '💸', '💵', '💴', '💶', '💷', '🪙', '💰', '💳', '💎', '⚖️', '🧰', '🔧', '🔨', '⚒️',
      '🛠️', '⛏️', '🔩', '⚙️', '🧱', '⛓️', '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡️', '🛡️', '🚬', '⚰️', '⚱️', '🏺', '🔮', '📿',
      '🧿', '💈', '🧪', '🧫', '🧬', '🔭', '🔬', '🕳️', '💊', '💉', '🩹', '🩺', '🌡️', '🧹', '🧺', '🧻', '🧼', '🧽', '🧴', '🔑',
      '🗝️', '🔐', '🔏', '🔒', '🔓'
    ]
  },
  {
    id: 'symbols',
    name: 'Symbols',
    icon: '❤️',
    emojis: [
      '💘', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💝', '💟', '☮️',
      '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐',
      '♑', '♒', '♓', '🆔', '📴', '📳', '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆗', '🆘',
      '🆙', '🆒', '🆕', '🆓', '▶️', '⏸️', '⏯️', '⏹️', '⏺️', '⏭️', '⏮️', '⏩', '⏪', '⏫', '⏬', '◀️', '🔼', '🔽', '➡️', '⬅️',
      '⬆️', '⬇️', '↗️', '↘️', '↙️', '↖️', '↕️', '↔️', '↪️', '↩️', '⤴️', '⤵️', '🔀', '🔁', '🔂', '🔄', '🔃'
    ]
  }
];

export default function EmojiPicker({ onSelect, onClose, isDarkMode = false }) {
  const [activeCategory, setActiveCategory] = useState('smileys');
  const [recentEmojis, setRecentEmojis] = useState([]);
  const pickerRef = useRef(null);
  const scrollContainerRef = useRef(null);

  // Load recents on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('scicomm_recent_emojis');
      if (saved) {
        setRecentEmojis(JSON.parse(saved));
        setActiveCategory('recent');
      } else {
        setActiveCategory('smileys');
      }
    } catch (e) {
      console.error("Failed to load recent emojis", e);
      setActiveCategory('smileys');
    }
  }, []);

  // Handle click outside to close
  useEffect(() => {
    function handleClickOutside(event) {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        if (onClose) onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Add selected emoji to recents
  const handleEmojiClick = (emoji) => {
    onSelect(emoji);
    
    // Update recents
    const updated = [emoji, ...recentEmojis.filter(e => e !== emoji)].slice(0, 36);
    setRecentEmojis(updated);
    try {
      localStorage.setItem('scicomm_recent_emojis', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  // Switch category and scroll container back to top
  const handleCategorySwitch = (categoryId) => {
    setActiveCategory(categoryId);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  };

  // Get current emojis to display
  const getCurrentEmojis = () => {
    if (activeCategory === 'recent') return recentEmojis;
    const cat = EMOJI_CATEGORIES.find(c => c.id === activeCategory);
    return cat ? cat.emojis : [];
  };

  // Styling config based on light/dark mode
  const styles = {
    picker: {
      position: 'absolute',
      bottom: '100%',
      right: '0px',
      marginBottom: '8px',
      width: '290px',
      height: '340px',
      background: isDarkMode ? '#1e293b' : '#ffffff',
      border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
      borderRadius: '20px',
      boxShadow: isDarkMode 
        ? '0 12px 30px rgba(0,0,0,0.5), 0 0 1px rgba(255,255,255,0.1)' 
        : '0 12px 30px rgba(15,23,42,0.15)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 9999,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      overflow: 'hidden',
      animation: 'emojiPopup 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
    },
    header: {
      padding: '12px 14px 8px',
      fontSize: '12px',
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: '0.8px',
      color: isDarkMode ? '#94a3b8' : '#64748b',
      borderBottom: `1px solid ${isDarkMode ? '#334155' : '#f1f5f9'}`,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    scrollContainer: {
      flex: 1,
      overflowY: 'auto',
      padding: '10px 8px',
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(7, 1fr)',
      gap: '6px',
    },
    emojiBtn: {
      background: 'transparent',
      border: 'none',
      fontSize: '24px',
      cursor: 'pointer',
      padding: '4px',
      borderRadius: '10px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'transform 0.1s ease, background 0.1s ease',
      WebkitTapHighlightColor: 'transparent',
      outline: 'none',
    },
    bottomBar: {
      height: '48px',
      background: isDarkMode ? '#0f172a' : '#f8fafc',
      borderTop: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
      display: 'flex',
      justifyContent: 'space-around',
      alignItems: 'center',
      padding: '0 4px',
    },
    tabBtn: {
      background: 'transparent',
      border: 'none',
      fontSize: '18px',
      cursor: 'pointer',
      width: '32px',
      height: '32px',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.15s ease',
      WebkitTapHighlightColor: 'transparent',
      outline: 'none',
    }
  };

  const activeTabStyle = {
    background: isDarkMode ? '#334155' : '#eff6ff',
    transform: 'scale(1.1)'
  };

  const categoryName = activeCategory === 'recent' 
    ? 'Recents' 
    : EMOJI_CATEGORIES.find(c => c.id === activeCategory)?.name || '';

  return (
    <div ref={pickerRef} style={styles.picker} className="gboard-emoji-picker">
      {/* Dynamic Keyframes inject */}
      <style>{`
        @keyframes emojiPopup {
          from { opacity: 0; transform: translateY(10px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .gboard-emoji-picker ::-webkit-scrollbar {
          width: 4px;
        }
        .gboard-emoji-picker ::-webkit-scrollbar-track {
          background: transparent;
        }
        .gboard-emoji-picker ::-webkit-scrollbar-thumb {
          background: ${isDarkMode ? '#475569' : '#cbd5e1'};
          border-radius: 4px;
        }
      `}</style>

      {/* Header */}
      <div style={styles.header}>
        <span>{categoryName}</span>
        {activeCategory === 'recent' && recentEmojis.length === 0 && (
          <span style={{ fontSize: '11px', fontWeight: 'normal', textTransform: 'none' }}>Empty</span>
        )}
      </div>

      {/* Scrollable Emojis list */}
      <div ref={scrollContainerRef} style={styles.scrollContainer}>
        {activeCategory === 'recent' && recentEmojis.length === 0 ? (
          <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: isDarkMode ? '#64748b' : '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
            <span style={{ fontSize: '32px', marginBottom: '8px' }}>🕒</span>
            Your recently used emojis will appear here
          </div>
        ) : (
          <div style={styles.grid}>
            {getCurrentEmojis().map((emoji, index) => (
              <button 
                key={`${emoji}_${index}`}
                onClick={() => handleEmojiClick(emoji)}
                style={styles.emojiBtn}
                onMouseEnter={(e) => {
                  e.target.style.background = isDarkMode ? '#334155' : '#f1f5f9';
                  e.target.style.transform = 'scale(1.15)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
                  e.target.style.transform = 'none';
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Category switcher bar */}
      <div style={styles.bottomBar}>
        {/* Recents Icon */}
        <button
          onClick={() => handleCategorySwitch('recent')}
          style={{
            ...styles.tabBtn,
            ...(activeCategory === 'recent' ? activeTabStyle : {})
          }}
          title="Recents"
        >
          🕒
        </button>

        {/* Regular categories */}
        {EMOJI_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => handleCategorySwitch(cat.id)}
            style={{
              ...styles.tabBtn,
              ...(activeCategory === cat.id ? activeTabStyle : {})
            }}
            title={cat.name}
          >
            {cat.icon}
          </button>
        ))}
      </div>
    </div>
  );
}
