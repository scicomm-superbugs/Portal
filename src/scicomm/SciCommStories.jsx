import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, UserCircle, Heart, Send, ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react';
import { db, useLiveCollection, uploadFile, firestore, getCollectionName } from '../db';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { AVATARS } from './scicommConstants';

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

const StoryVideo = ({ videoUrl, isPaused, style, onEnded }) => {
  const [src, setSrc] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileId = videoUrl.replace('chunked://', '');
  const videoRef = useRef(null);
  const [audioUnlocked, setAudioUnlocked] = useState(sessionStorage.getItem('audio_unlocked') === 'true');
  
  useEffect(() => {
    const loadVideo = async () => {
      if (!videoUrl.startsWith('chunked://')) {
        setSrc(videoUrl);
        return;
      }
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
    loadVideo();
  }, [fileId, videoUrl]);

  useEffect(() => {
    if (videoRef.current && src) {
      if (isPaused) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(e => console.log('Autoplay blocked', e));
      }
    }
  }, [isPaused, src]);

  const toggleAudio = (e) => {
    e.stopPropagation();
    const next = !audioUnlocked;
    setAudioUnlocked(next);
    if (next) sessionStorage.setItem('audio_unlocked', 'true');
    else sessionStorage.removeItem('audio_unlocked');
  };

  if (loading || !src) {
    return (
      <div style={{ ...style, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', background: '#111' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <div style={{ marginTop: '12px', fontSize: '12px', opacity: 0.8 }}>Loading video...</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <video ref={videoRef} src={src} playsInline muted={!audioUnlocked} style={style} onEnded={onEnded} />
      {isPaused && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.5)', borderRadius: '50%', padding: '20px', zIndex: 15 }}>
          <Pause size={40} color="white" />
        </div>
      )}
      <button onClick={toggleAudio} style={{ position: 'absolute', top: '120px', right: '16px', background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 20 }}>
        {audioUnlocked ? '🔊' : '🔇'}
      </button>
    </div>
  );
};

export default function SciCommStories({ scientists }) {
  const { user } = useAuth();
  const allStories = useLiveCollection('scicomm_stories') || [];
  
  // Filter out expired stories from display
  const now = new Date();
  const activeStories = allStories.filter(s => {
    if (!s.expiresAt) return true; // legacy stories without expiresAt
    return new Date(s.expiresAt) > now;
  });

  // Auto-cleanup: delete expired stories from the database
  useEffect(() => {
    const expired = allStories.filter(s => s.expiresAt && new Date(s.expiresAt) <= new Date());
    expired.forEach(s => {
      db.scicomm_stories.delete(s.id).catch(console.error);
    });
  }, [allStories.length]);

  const renderAvatar = (member, size = 48) => {
    if (!member) return <UserCircle size={size} color="#94a3b8" />;
    if (member.avatar) return <img src={member.avatar} alt={member.name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />;
    const av = AVATARS.find(a => a.id === member.avatarId);
    if (av) return <div style={{ width: size, height: size, borderRadius: '50%', background: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.5 }}>{av.svg}</div>;
    return <UserCircle size={size} color="#94a3b8" />;
  };
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [mediaFile, setMediaFile] = useState(null);
  const [duration, setDuration] = useState(24); // hours
  const [caption, setCaption] = useState('');
  const [creating, setCreating] = useState(false);

  const [viewingUserId, setViewingUserId] = useState(null);
  const [storyIndex, setStoryIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showViewers, setShowViewers] = useState(false);

  // Group stories by user (using only active/non-expired stories)
  const storiesByUser = activeStories.reduce((acc, s) => {
    if (!acc[s.authorId]) acc[s.authorId] = [];
    acc[s.authorId].push(s);
    return acc;
  }, {});

  // Sort each user's stories by time
  Object.keys(storiesByUser).forEach(uid => {
    storiesByUser[uid].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  });

  const groupUserIds = Object.keys(storiesByUser).sort((a, b) => {
    if (String(a) === String(user.id)) return -1;
    if (String(b) === String(user.id)) return 1;
    const aLatest = storiesByUser[a][storiesByUser[a].length - 1];
    const bLatest = storiesByUser[b][storiesByUser[b].length - 1];
    return new Date(bLatest.createdAt) - new Date(aLatest.createdAt);
  });

  const handleNextStory = () => {
    const currentUserStories = storiesByUser[viewingUserId];
    if (storyIndex < currentUserStories.length - 1) {
      setStoryIndex(storyIndex + 1);
    } else {
      const currentUserPos = groupUserIds.indexOf(String(viewingUserId));
      if (currentUserPos < groupUserIds.length - 1) {
        setViewingUserId(groupUserIds[currentUserPos + 1]);
        setStoryIndex(0);
      } else {
        setViewingUserId(null);
      }
    }
  };

  const handlePrevStory = () => {
    if (storyIndex > 0) {
      setStoryIndex(storyIndex - 1);
    } else {
      const currentUserPos = groupUserIds.indexOf(String(viewingUserId));
      if (currentUserPos > 0) {
        setViewingUserId(groupUserIds[currentUserPos - 1]);
        const prevUserStories = storiesByUser[groupUserIds[currentUserPos - 1]];
        setStoryIndex(prevUserStories.length - 1);
      } else {
        setViewingUserId(null);
      }
    }
  };

  // Auto advance logic
  useEffect(() => {
    if (viewingUserId && !isPaused && !replyText) {
      const story = storiesByUser[viewingUserId][storyIndex];
      if (!story) return;
      const isVideo = story.mediaType === 'video';
      const maxDuration = isVideo ? 90000 : 7000;
      
      const timer = setTimeout(() => {
        handleNextStory();
      }, maxDuration); 
      return () => clearTimeout(timer);
    }
  }, [viewingUserId, storyIndex, isPaused, replyText]);

  // Mark story as viewed
  useEffect(() => {
    if (viewingUserId && storyIndex >= 0) {
      const story = storiesByUser[viewingUserId][storyIndex];
      if (story && String(story.authorId) !== String(user.id) && !(story.viewers || []).includes(user.id)) {
        db.scicomm_stories.update(story.id, { viewers: [...(story.viewers || []), user.id] });
      }
    }
  }, [viewingUserId, storyIndex]);

  const chatRooms = useLiveCollection('scicomm_chat_rooms') || [];

  const handleReply = async () => {
    if (!replyText.trim() || !viewingUserId) return;
    const story = storiesByUser[viewingUserId][storyIndex];
    
    let roomId = null;
    const existing = chatRooms.find(r => r.type === 'private' && r.members?.includes(user.id) && r.members?.includes(viewingUserId));
    if (existing) roomId = existing.id;
    else {
      const otherUser = scientists.find(s => String(s.id) === String(viewingUserId));
      roomId = await db.scicomm_chat_rooms.add({
        type: 'private',
        members: [user.id, viewingUserId],
        memberNames: { [user.id]: user.name, [viewingUserId]: otherUser?.name || story.authorName },
        createdAt: new Date().toISOString(),
        lastMessageAt: new Date().toISOString()
      });
    }

    await db.scicomm_chat_messages.add({
      roomId, senderId: user.id, senderName: user.name, content: replyText, type: 'story_reply',
      storyUrl: story.mediaUrl || null, storyType: story.mediaType || 'text', storyContent: story.content || null,
      readBy: [user.id], createdAt: new Date().toISOString()
    });

    await db.scicomm_chat_rooms.update(roomId, {
      lastMessageAt: new Date().toISOString(),
      lastMessage: 'Replied to story',
      lastSender: user.name
    });

    setReplyText('');
  };

  const handleLikeStory = async () => {
    if (!viewingUserId) return;
    const story = storiesByUser[viewingUserId][storyIndex];
    const likes = story.likes || [];
    if (likes.includes(user.id)) {
      await db.scicomm_stories.update(story.id, { likes: likes.filter(id => id !== user.id) });
    } else {
      await db.scicomm_stories.update(story.id, { likes: [...likes, user.id] });
    }
  };

  const handleUpload = async () => {
    if (!mediaFile && !caption) return;
    setCreating(true);
    try {
      let mediaUrl = '';
      let mediaType = 'text';
      if (mediaFile) {
        mediaUrl = await uploadFile(mediaFile, `stories/${user.id}/${Date.now()}_${mediaFile.name}`);
        mediaType = mediaFile.type.startsWith('video/') ? 'video' : 'image';
      }
      await db.scicomm_stories.add({
        authorId: user.id, authorName: user.name, content: caption, mediaUrl, mediaType,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + duration * 3600 * 1000).toISOString(),
        viewers: [], likes: []
      });
      setShowCreateModal(false);
      setMediaFile(null);
      setCaption('');
    } catch (e) { alert('Failed to share story'); }
    finally { setCreating(false); }
  };

  return (
    <>
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '12px', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {/* Create Story Card */}
        <div onClick={() => setShowCreateModal(true)} style={{ width: '100px', height: '160px', flexShrink: 0, borderRadius: '12px', background: 'white', position: 'relative', overflow: 'hidden', cursor: 'pointer', border: '1px solid #e0dfdc', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ height: '100px', background: '#f3f2ef', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {renderAvatar(scientists.find(s => String(s.id) === String(user.id)) || { name: user.name }, 100)}
          </div>
          <div style={{ position: 'absolute', top: '85px', left: '50%', transform: 'translateX(-50%)', background: '#1d4ed8', color: 'white', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid white' }}>
            <Plus size={20} />
          </div>
          <div style={{ position: 'absolute', bottom: '12px', left: 0, right: 0, textAlign: 'center', fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>Create story</div>
        </div>

        {/* User Story Cards */}
        {groupUserIds.map(uid => {
          const userStories = storiesByUser[uid];
          const latestStory = userStories[userStories.length - 1];
          const scientist = scientists.find(s => String(s.id) === String(uid)) || { name: latestStory.authorName };
          const allViewed = userStories.every(s => s.viewers?.includes(user.id) || String(s.authorId) === String(user.id));
          return (
            <div key={uid} onClick={() => { setViewingUserId(uid); setStoryIndex(0); }} style={{ width: '100px', height: '160px', flexShrink: 0, borderRadius: '12px', background: 'white', position: 'relative', overflow: 'hidden', cursor: 'pointer', border: '1px solid #e0dfdc', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
              {latestStory.mediaUrl ? (
                latestStory.mediaType === 'video' ? <StoryVideo videoUrl={latestStory.mediaUrl} isPaused={true} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <img src={latestStory.mediaUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '10px', textAlign: 'center' }}>{latestStory.content}</div>
              )}
              <div style={{ position: 'absolute', top: '8px', left: '8px', border: allViewed ? '2px solid #e0dfdc' : '2px solid #1d4ed8', borderRadius: '50%', padding: '2px' }}>{renderAvatar(scientist, 32)}</div>
              <div style={{ position: 'absolute', bottom: '8px', left: '8px', right: '8px', fontSize: '11px', fontWeight: 600, color: 'white', textShadow: '0 1px 2px rgba(0,0,0,0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{scientist.name}</div>
            </div>
          );
        })}
      </div>

      {/* Story Viewer */}
      {viewingUserId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'black', zIndex: 9999, display: 'flex', flexDirection: 'column' }}>
          <div style={{ maxWidth: '500px', width: '100%', height: '100%', margin: '0 auto', position: 'relative', display: 'flex', flexDirection: 'column' }}>
            
            {/* Progress Bars */}
            <div style={{ position: 'absolute', top: '12px', left: '12px', right: '12px', zIndex: 10, display: 'flex', gap: '4px' }}>
              {storiesByUser[viewingUserId].map((s, idx) => (
                <div key={idx} style={{ height: '2px', flex: 1, background: idx < storyIndex ? 'white' : 'rgba(255,255,255,0.3)', borderRadius: '1px', overflow: 'hidden' }}>
                  {idx === storyIndex && (
                    <div style={{ 
                      height: '100%', background: 'white', width: '0%', 
                      animation: (isPaused || replyText) ? 'none' : `progress ${s.mediaType === 'video' ? 90 : 7}s linear forwards` 
                    }} />
                  )}
                </div>
              ))}
            </div>

            {/* Header */}
            <div style={{ position: 'absolute', top: '24px', left: '12px', right: '12px', zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden', border: '2px solid white' }}>
                  {renderAvatar(scientists.find(s => String(s.id) === String(viewingUserId)) || { name: storiesByUser[viewingUserId][storyIndex].authorName }, 36)}
                </div>
                <div>
                  <div style={{ color: 'white', fontWeight: 600, fontSize: '14px', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>{storiesByUser[viewingUserId][storyIndex].authorName}</div>
                  <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '11px', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>{new Date(storiesByUser[viewingUserId][storyIndex].createdAt).toLocaleString()}</div>
                </div>
              </div>
              <button onClick={() => setViewingUserId(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '4px' }}><X size={28} /></button>
            </div>

            {/* Content Area with Hold-to-Pause and Arrow-to-Pause/Desktop Toggle */}
            <div 
              onPointerDown={() => setIsPaused(true)}
              onPointerUp={() => setIsPaused(false)}
              onPointerLeave={() => setIsPaused(false)}
              style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111', cursor: 'pointer' }}
            >
              {storiesByUser[viewingUserId][storyIndex].mediaUrl ? (
                <>
                  {storiesByUser[viewingUserId][storyIndex].mediaType === 'video' ? (
                    <StoryVideo videoUrl={storiesByUser[viewingUserId][storyIndex].mediaUrl} isPaused={isPaused || !!replyText} onEnded={() => { if(!isPaused && !replyText) handleNextStory() }} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : (
                    <img src={storiesByUser[viewingUserId][storyIndex].mediaUrl} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  )}
                  {storiesByUser[viewingUserId][storyIndex].content && (
                    <div style={{ position: 'absolute', bottom: '70px', left: '20px', right: '20px', background: 'rgba(0,0,0,0.6)', padding: '12px', borderRadius: '12px', color: 'white', fontSize: '15px', textAlign: 'center', zIndex: 6 }}>
                      {storiesByUser[viewingUserId][storyIndex].content}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: 'white', fontSize: '24px', padding: '32px', textAlign: 'center', fontWeight: 600 }}>
                  {storiesByUser[viewingUserId][storyIndex].content}
                </div>
              )}
            </div>

            {/* Navigation Side Areas */}
            <div 
              onClick={(e) => { e.stopPropagation(); handlePrevStory(); }}
              style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '20%', zIndex: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', paddingLeft: '8px' }}>
              <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '50%', color: 'white', padding: '8px', opacity: 0.5 }}><ChevronLeft size={24} /></div>
            </div>
            
            <div 
              onClick={(e) => { e.stopPropagation(); handleNextStory(); }}
              style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: '20%', zIndex: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '8px' }}>
              <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '50%', color: 'white', padding: '8px', opacity: 0.5 }}><ChevronRight size={24} /></div>
            </div>

            {/* Own Views / Likes */}
            {String(viewingUserId) === String(user.id) && (
              <div onClick={(e) => { e.stopPropagation(); setShowViewers(true); }} style={{ position: 'absolute', bottom: '16px', left: '16px', color: 'white', background: 'rgba(0,0,0,0.5)', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, zIndex: 20, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.2)' }}>
                👁 {storiesByUser[viewingUserId][storyIndex].viewers?.length || 0} views {storiesByUser[viewingUserId][storyIndex].likes?.length > 0 && `❤️ ${storiesByUser[viewingUserId][storyIndex].likes.length}`}
              </div>
            )}

            {/* Interaction Bar */}
            {String(viewingUserId) !== String(user.id) && (() => {
              const hasLiked = (storiesByUser[viewingUserId][storyIndex].likes || []).includes(user.id);
              return (
                <div style={{ position: 'absolute', bottom: '16px', left: '16px', right: '16px', zIndex: 20, display: 'flex', gap: '12px', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.3)', padding: '0 16px' }}>
                    <input type="text" placeholder="Send message..." value={replyText} onChange={e => setReplyText(e.target.value)} style={{ flex: 1, background: 'none', border: 'none', color: 'white', height: '40px', outline: 'none', fontSize: '14px' }} />
                    {replyText.trim() && <button onClick={handleReply} style={{ background: 'none', border: 'none', color: '#60a5fa', fontWeight: 700, cursor: 'pointer' }}>Send</button>}
                  </div>
                  <button onClick={handleLikeStory} style={{ background: 'none', border: 'none', color: hasLiked ? '#ef4444' : 'white', cursor: 'pointer' }}><Heart size={24} fill={hasLiked ? '#ef4444' : 'none'} /></button>
                  <button style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><Send size={24} /></button>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '16px', maxWidth: '400px', width: '100%', overflow: 'hidden' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Share Story</h3>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', color: '#64748b' }}><X size={20} /></button>
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Photo or Video</label>
                <div style={{ border: '2px dashed #cbd5e1', borderRadius: '12px', padding: '32px', textAlign: 'center', cursor: 'pointer' }} onClick={() => document.getElementById('story-file').click()}>
                  <Plus size={32} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
                  <div style={{ fontSize: '13px', color: '#64748b' }}>{mediaFile ? mediaFile.name : 'Click to select media'}</div>
                  <input type="file" id="story-file" hidden accept="image/*,video/*" onChange={e => setMediaFile(e.target.files[0])} />
                </div>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Caption (Optional)</label>
                <textarea dir="auto" value={caption} onChange={e => setCaption(e.target.value)} placeholder="Add a caption..." style={{ width: '100%', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', resize: 'none' }} rows={3} />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Duration</label>
                <select value={duration} onChange={e => setDuration(Number(e.target.value))} style={{ width: '100%', padding: '10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px' }}>
                  <option value={24}>24 Hours</option><option value={48}>48 Hours</option><option value={72}>3 Days</option><option value={168}>1 Week</option>
                </select>
              </div>
              <button onClick={handleUpload} disabled={creating || (!mediaFile && !caption)} style={{ width: '100%', padding: '14px', background: '#1d4ed8', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', opacity: (creating || (!mediaFile && !caption)) ? 0.6 : 1 }}>
                {creating ? 'Sharing...' : 'Share Story'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Viewers Modal */}
      {showViewers && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '16px', maxWidth: '400px', width: '100%', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Story Views</h3>
              <button onClick={() => setShowViewers(false)} style={{ background: 'none', border: 'none', color: '#64748b' }}><X size={20} /></button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
              {storiesByUser[viewingUserId][storyIndex].viewers?.length > 0 ? (
                storiesByUser[viewingUserId][storyIndex].viewers.map(uid => {
                  const s = scientists.find(sc => String(sc.id) === String(uid));
                  return (
                    <div key={uid} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', borderBottom: '1px solid #f1f5f9' }}>
                      {renderAvatar(s, 32)}<div style={{ fontSize: '14px', fontWeight: 600 }}>{s?.name || 'Unknown User'}</div>
                    </div>
                  );
                })
              ) : <div style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>No views yet</div>}
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes progress { from { width: 0%; } to { width: 100%; } }`}</style>
    </>
  );
}
