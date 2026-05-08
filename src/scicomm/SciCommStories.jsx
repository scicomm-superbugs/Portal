import React, { useState } from 'react';
import { Plus, X, UserCircle } from 'lucide-react';
import { db, useLiveCollection, uploadFile } from '../db';
import { useAuth } from '../context/AuthContext';
import { AVATARS } from './scicommConstants';

export default function SciCommStories({ scientists }) {
  const { user } = useAuth();
  const allStories = useLiveCollection('scicomm_stories') || [];
  
  const renderAvatar = (member, size = 48) => {
    if (!member) return <UserCircle size={size} color="#94a3b8" />;
    if (member.avatar) return <img src={member.avatar} alt={member.name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />;
    const av = AVATARS.find(a => a.id === member.avatarId);
    if (av) return <div style={{ width: size, height: size, borderRadius: '50%', background: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.5 }}>{av.svg}</div>;
    return <UserCircle size={size} color="#94a3b8" />;
  };
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [mediaFile, setMediaFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [duration, setDuration] = useState(24); // hours
  const [caption, setCaption] = useState('');
  const [creating, setCreating] = useState(false);

  const [viewingUserId, setViewingUserId] = useState(null);
  const [storyIndex, setStoryIndex] = useState(0);
  const [showViewers, setShowViewers] = useState(false);

  // Filter active stories
  const now = new Date();
  const activeStories = allStories.filter(s => new Date(s.expiresAt) > now);

  // Group by user
  const storiesByUser = {};
  activeStories.forEach(s => {
    if (!storiesByUser[s.authorId]) storiesByUser[s.authorId] = [];
    storiesByUser[s.authorId].push(s);
  });

  // Sort groups: current user first, then by latest story
  const groupUserIds = Object.keys(storiesByUser).sort((a, b) => {
    if (a === String(user.id)) return -1;
    if (b === String(user.id)) return 1;
    const aLatest = Math.max(...storiesByUser[a].map(s => new Date(s.createdAt).getTime()));
    const bLatest = Math.max(...storiesByUser[b].map(s => new Date(s.createdAt).getTime()));
    return bLatest - aLatest;
  });

  const handleCreateStory = async () => {
    if (!mediaFile && !caption) return;
    setCreating(true);
    try {
      let finalMediaUrl = '';
      let finalMediaType = 'image';

      if (mediaFile) {
        finalMediaType = mediaFile.type.startsWith('video/') ? 'video' : 'image';
        const path = `stories/${user.id}_${Date.now()}_${mediaFile.name}`;
        finalMediaUrl = await uploadFile(mediaFile, path, setUploadProgress);
      }

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + Number(duration));
      await db.scicomm_stories.add({
        authorId: user.id,
        authorName: user.name,
        mediaUrl: finalMediaUrl,
        mediaType: finalMediaType,
        content: caption,
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
        viewers: []
      });
      setShowCreateModal(false);
      setMediaFile(null);
      setUploadProgress(0);
      setCaption('');
      setDuration(24);
    } catch (e) {
      console.error(e);
      alert(e.message || 'Upload failed');
    }
    setCreating(false);
  };

  const handleNextStory = () => {
    if (!viewingUserId) return;
    const userStories = storiesByUser[viewingUserId];
    if (storyIndex < userStories.length - 1) {
      setStoryIndex(i => i + 1);
    } else {
      // Next user
      const currentUserGroupIdx = groupUserIds.indexOf(viewingUserId);
      if (currentUserGroupIdx < groupUserIds.length - 1) {
        setViewingUserId(groupUserIds[currentUserGroupIdx + 1]);
        setStoryIndex(0);
      } else {
        setViewingUserId(null); // End of stories
      }
    }
  };

  const handlePrevStory = () => {
    if (!viewingUserId) return;
    if (storyIndex > 0) {
      setStoryIndex(i => i - 1);
    } else {
      // Prev user
      const currentUserGroupIdx = groupUserIds.indexOf(viewingUserId);
      if (currentUserGroupIdx > 0) {
        const prevUser = groupUserIds[currentUserGroupIdx - 1];
        setViewingUserId(prevUser);
        setStoryIndex(storiesByUser[prevUser].length - 1);
      }
    }
  };

  // Add view to story
  React.useEffect(() => {
    if (viewingUserId) {
      const story = storiesByUser[viewingUserId]?.[storyIndex];
      if (story && !story.viewers?.includes(user.id) && String(story.authorId) !== String(user.id)) {
        db.scicomm_stories.update(story.id, { viewers: [...(story.viewers || []), user.id] });
      }
    }
  }, [viewingUserId, storyIndex]);

  // Auto advance
  React.useEffect(() => {
    if (viewingUserId) {
      const timer = setTimeout(() => {
        handleNextStory();
      }, 5000); // 5 seconds per story
      return () => clearTimeout(timer);
    }
  }, [viewingUserId, storyIndex]);

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
          <div style={{ position: 'absolute', bottom: '12px', left: 0, right: 0, textAlign: 'center', fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>
            Create story
          </div>
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
                latestStory.mediaType === 'video' ? (
                  <video src={latestStory.mediaUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <img src={latestStory.mediaUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )
              ) : (
                <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', padding: '12px', color: 'white', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                  {latestStory.content}
                </div>
              )}
              <div style={{ position: 'absolute', top: '8px', left: '8px', width: '32px', height: '32px', borderRadius: '50%', border: allViewed ? '2px solid #e2e8f0' : '2px solid #3b82f6', overflow: 'hidden' }}>
                {renderAvatar(scientist, 32)}
              </div>
              <div style={{ position: 'absolute', bottom: '0', left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.8))', padding: '16px 8px 8px', color: 'white', fontSize: '11px', fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {scientist.name.split(' ')[0]}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Story Modal */}
      {showCreateModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="scicomm-card scicomm-card-padding" style={{ width: '100%', maxWidth: '400px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>Create Story</h3>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Photo or Video (Optional)</label>
              <input type="file" accept="image/*,video/*" onChange={e => {
                if (e.target.files && e.target.files[0]) {
                  setMediaFile(e.target.files[0]);
                } else {
                  setMediaFile(null);
                }
              }} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
              {uploadProgress > 0 && uploadProgress < 100 && (
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#1d4ed8' }}>Uploading... {uploadProgress}%</div>
              )}
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Text (Optional)</label>
              <textarea value={caption} onChange={e => setCaption(e.target.value)} placeholder="What's on your mind?" rows={3} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', boxSizing: 'border-box', fontFamily: 'inherit' }} />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Story Duration</label>
              <select value={duration} onChange={e => setDuration(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc' }}>
                <option value={24}>24 Hours</option>
                <option value={48}>2 Days</option>
                <option value={168}>1 Week</option>
              </select>
            </div>
            <button onClick={handleCreateStory} disabled={creating || (!mediaFile && !caption)} className="scicomm-btn-primary" style={{ width: '100%', padding: '12px', justifyContent: 'center' }}>
              {creating ? 'Posting...' : 'Share to Story'}
            </button>
          </div>
        </div>
      )}

      {/* Story Viewer Modal */}
      {viewingUserId && storiesByUser[viewingUserId] && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'black', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '450px', height: '100%', maxHeight: '900px', display: 'flex', flexDirection: 'column' }}>
            
            {/* Progress Bars */}
            <div style={{ display: 'flex', gap: '4px', padding: '12px 8px 0', position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}>
              {storiesByUser[viewingUserId].map((_, idx) => (
                <div key={idx} style={{ flex: 1, height: '3px', background: 'rgba(255,255,255,0.3)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: 'white', width: idx < storyIndex ? '100%' : idx === storyIndex ? '100%' : '0%', transition: idx === storyIndex ? 'width 5s linear' : 'none' }} />
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
                  <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '11px', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                    {new Date(storiesByUser[viewingUserId][storyIndex].createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
              <button onClick={() => setViewingUserId(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '4px' }}><X size={28} /></button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111' }}>
              {storiesByUser[viewingUserId][storyIndex].mediaUrl ? (
                <>
                  {storiesByUser[viewingUserId][storyIndex].mediaType === 'video' ? (
                    <video src={storiesByUser[viewingUserId][storyIndex].mediaUrl} autoPlay style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : (
                    <img src={storiesByUser[viewingUserId][storyIndex].mediaUrl} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  )}
                  {storiesByUser[viewingUserId][storyIndex].content && (
                    <div style={{ position: 'absolute', bottom: '40px', left: '20px', right: '20px', background: 'rgba(0,0,0,0.6)', padding: '12px', borderRadius: '12px', color: 'white', fontSize: '15px', textAlign: 'center' }}>
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

            {/* Nav Areas */}
            <div onClick={handlePrevStory} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '30%', zIndex: 5, cursor: 'pointer' }} />
            <div onClick={handleNextStory} style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: '70%', zIndex: 5, cursor: 'pointer' }} />

            {/* Views counter for own story */}
            {String(viewingUserId) === String(user.id) && (
              <div 
                onClick={(e) => { e.stopPropagation(); setShowViewers(true); }}
                style={{ position: 'absolute', bottom: '16px', left: '16px', color: 'white', background: 'rgba(0,0,0,0.5)', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, zIndex: 10, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.2)' }}>
                👁 {storiesByUser[viewingUserId][storyIndex].viewers?.length || 0} views
              </div>
            )}

            {/* Viewers List Modal */}
            {showViewers && String(viewingUserId) === String(user.id) && (
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'white', borderTopLeftRadius: '16px', borderTopRightRadius: '16px', padding: '16px', zIndex: 20, maxHeight: '60%', overflowY: 'auto', boxShadow: '0 -4px 12px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>👁 {storiesByUser[viewingUserId][storyIndex].viewers?.length || 0} Viewers</h3>
                  <button onClick={(e) => { e.stopPropagation(); setShowViewers(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
                </div>
                {(storiesByUser[viewingUserId][storyIndex].viewers || []).length > 0 ? (
                  (storiesByUser[viewingUserId][storyIndex].viewers).map((vid, i) => {
                    const viewer = scientists.find(s => String(s.id) === String(vid)) || { name: 'Unknown User' };
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                        {renderAvatar(viewer, 36)}
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a' }}>{viewer.name}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{viewer.department || 'Member'}</div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ padding: '20px 0', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>No views yet.</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
