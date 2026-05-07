import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLiveCollection, db, uploadFile } from '../db';
import { Image, Video, FileText, Send, MessageSquare, Share2, MoreHorizontal, UserCircle, ChevronLeft, ChevronRight, Settings, Plus, Trash2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { REACTIONS, AVATARS, timeAgo, isSpamPost, calculateScore, getUnlockedTags, getUserLevel } from './scicommConstants';

export default function SciCommFeed() {
  const { user } = useAuth();
  const scientists = useLiveCollection('scientists') || [];
  const currentUserData = scientists.find(s => String(s.id) === String(user.id));
  const postsRaw = useLiveCollection('scicomm_posts') || [];
  const bannersRaw = useLiveCollection('scicomm_banners') || [];
  const connectionsRaw = useLiveCollection('scicomm_connections') || [];
  const tasksData = useLiveCollection('tasks') || [];
  const meetingsData = useLiveCollection('scicomm_meetings') || [];
  const recognitions = useLiveCollection('scicomm_recognitions') || [];

  const [newPost, setNewPost] = useState('');
  const [commentText, setCommentText] = useState({});
  const [showComments, setShowComments] = useState({});
  const [activeReactionPicker, setActiveReactionPicker] = useState(null);
  const [bannerIdx, setBannerIdx] = useState(0);
  const [postError, setPostError] = useState('');
  const [postImage, setPostImage] = useState(null);
  const [postVideo, setPostVideo] = useState(null);
  const [isPostingMedia, setIsPostingMedia] = useState(false);
  const [showArticle, setShowArticle] = useState(false);
  const [articleTitle, setArticleTitle] = useState('');
  const [postFile, setPostFile] = useState(null);
  const [showPoll, setShowPoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState([{id:1, text:''}, {id:2, text:''}]);

  const [isEditingLinks, setIsEditingLinks] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [tempLinks, setTempLinks] = useState([]);

  const AVAILABLE_QUICK_LINKS = [
    { id: 'tasks', title: 'My Tasks', url: '/tasks', icon: '📋' },
    { id: 'leaderboard', title: 'Leaderboard', url: '/leaderboard', icon: '🏆' },
    { id: 'calendar', title: 'Calendar', url: '/calendar', icon: '📅' },
    { id: 'chat', title: 'Chat', url: '/chat', icon: '💬' },
    { id: 'network', title: 'Network', url: '/network', icon: '👥' },
    { id: 'profile', title: 'My Profile', url: '/profile', icon: '👤' },
    { id: 'notifications', title: 'Alerts', url: '/notifications', icon: '🔔' }
  ];

  const defaultQuickLinks = ['tasks', 'leaderboard', 'calendar', 'chat'];
  // Migrate old format if needed, or use defaults
  let myLinks = currentUserData?.quickLinks || defaultQuickLinks;
  if (myLinks.length > 0 && typeof myLinks[0] === 'object') {
    myLinks = defaultQuickLinks; // Reset if they had the old object format
  }

  const isAdmin = user.role === 'admin' || user.role === 'master';

  const banners = [...bannersRaw].sort((a,b) => (a.order||0) - (b.order||0));
  const posts = [...postsRaw].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const getAuthor = (id) => scientists.find(s => String(s.id) === String(id));
  const getAvatar = (member) => {
    if (member?.avatar) return { type: 'img', src: member.avatar };
    const av = AVATARS.find(a => a.id === member?.avatarId);
    if (av) return { type: 'emoji', emoji: av.svg, bg: av.bg };
    return { type: 'fallback' };
  };

  const renderAvatar = (member, size = 48) => {
    const av = getAvatar(member);
    if (av.type === 'img') return <img src={av.src} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
    if (av.type === 'emoji') return <div style={{ width: size, height: size, borderRadius: '50%', background: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.5, flexShrink: 0 }}>{av.emoji}</div>;
    return <div style={{ width: size, height: size, borderRadius: '50%', background: '#eef3f8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><UserCircle size={size * 0.6} color="#666" /></div>;
  };

  // Banner auto-slide
  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => setBannerIdx(i => (i + 1) % banners.length), 5000);
    return () => clearInterval(t);
  }, [banners.length]);

  // Post submission with spam check
  const handlePostSubmit = async (e) => {
    e?.preventDefault();
    if (!newPost.trim() && (!showPoll || !pollQuestion.trim())) return;
    setPostError('');
    const myRecentPosts = posts.filter(p => String(p.authorId) === String(user.id)).slice(0, 5);
    if (isSpamPost(newPost, myRecentPosts)) {
      setPostError('⚠️ Your post was flagged. Please write something unique and meaningful (min 10 chars).');
      return;
    }
    try {
      setIsPostingMedia(true);
      let imageUrl = null, videoUrl = null, fileUrl = null, fileName = null;
      if (postImage) {
        imageUrl = await uploadFile(postImage, `posts/${user.id}_${Date.now()}_${postImage.name}`);
      }
      if (postVideo) {
        videoUrl = await uploadFile(postVideo, `posts/${user.id}_${Date.now()}_${postVideo.name}`);
      }
      if (postFile) {
        fileUrl = await uploadFile(postFile, `posts/${user.id}_${Date.now()}_${postFile.name}`);
        fileName = postFile.name;
      }
      await db.scicomm_posts.add({
        content: newPost,
        imageUrl,
        videoUrl,
        fileUrl,
        fileName,
        articleTitle: showArticle ? articleTitle : null,
        poll: showPoll ? { question: pollQuestion, options: pollOptions.filter(o => o.text.trim()), votes: {} } : null,
        authorId: user.id,
        authorName: user.name,
        createdAt: new Date().toISOString(),
        reactions: {},
        comments: [],
        pinned: false
      });
      setNewPost('');
      setPostImage(null);
      setPostVideo(null);
      setPostFile(null);
      setShowArticle(false);
      setArticleTitle('');
      setShowPoll(false);
      setPollQuestion('');
      setPollOptions([{id:1, text:''}, {id:2, text:''}]);
    } catch (err) {
      console.error("Failed to post", err);
    }
    setIsPostingMedia(false);
  };

  // Multi-reaction toggle
  const handleReaction = async (post, reactionKey) => {
    const reactions = { ...(post.reactions || {}) };
    if (!reactions[reactionKey]) reactions[reactionKey] = [];
    const idx = reactions[reactionKey].indexOf(user.id);
    // Remove from all other reactions first
    for (const k in reactions) {
      reactions[k] = reactions[k].filter(id => id !== user.id);
      if (reactions[k].length === 0) delete reactions[k];
    }
    // Toggle current
    if (idx === -1) {
      if (!reactions[reactionKey]) reactions[reactionKey] = [];
      reactions[reactionKey].push(user.id);
    }
    try {
      await db.scicomm_posts.update(post.id, { reactions });
      setActiveReactionPicker(null);
    } catch (err) { console.error(err); }
  };

  const handleAddComment = async (post) => {
    const text = commentText[post.id];
    if (!text?.trim()) return;
    const comments = [...(post.comments || [])];
    comments.push({ authorId: user.id, authorName: user.name, text, createdAt: new Date().toISOString() });
    try {
      await db.scicomm_posts.update(post.id, { comments });
      setCommentText(prev => ({ ...prev, [post.id]: '' }));
    } catch (err) { console.error(err); }
  };

  const getTotalReactions = (post) => {
    const r = post.reactions || {};
    return Object.values(r).reduce((s, arr) => s + arr.length, 0);
  };

  const handleVote = async (post, optionId) => {
    if (!post.poll) return;
    const votes = { ...(post.poll.votes || {}) };
    votes[user.id] = optionId;
    try {
      await db.scicomm_posts.update(post.id, { poll: { ...post.poll, votes } });
    } catch(err) { console.error(err); }
  };

  const renderPostText = (text) => {
    if (!text) return null;
    const parts = text.split(/(#\w+|@\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('#')) return <Link key={i} to={`/network?q=${encodeURIComponent(part.slice(1))}`} style={{ color: '#0a66c2', fontWeight: 600, textDecoration: 'none' }}>{part}</Link>;
      if (part.startsWith('@')) {
        const username = part.slice(1).toLowerCase();
        const userMatch = scientists.find(s => (s.username || '').toLowerCase() === username || s.name.replace(/\s+/g, '').toLowerCase() === username);
        if (userMatch) return <Link key={i} to={`/member/${userMatch.id}`} style={{ background: '#eef3f8', color: '#0a66c2', padding: '2px 4px', borderRadius: '4px', fontWeight: 600, textDecoration: 'none' }}>{part}</Link>;
        return <span key={i} style={{ color: '#0a66c2', fontWeight: 600 }}>{part}</span>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  const getMyReaction = (post) => {
    const r = post.reactions || {};
    for (const [key, arr] of Object.entries(r)) {
      if (arr.includes(user.id)) return key;
    }
    return null;
  };

  const getReactionSummary = (post) => {
    const r = post.reactions || {};
    const summary = [];
    for (const [key, arr] of Object.entries(r)) {
      if (arr.length > 0) {
        const rc = REACTIONS.find(rx => rx.key === key);
        if (rc) summary.push({ ...rc, count: arr.length });
      }
    }
    return summary.sort((a,b) => b.count - a.count);
  };

  // Score for sidebar
  const myPosts = postsRaw.filter(p => String(p.authorId) === String(user.id));
  const myLikesReceived = myPosts.reduce((s, p) => s + Object.values(p.reactions || {}).reduce((ss, arr) => ss + arr.length, 0), 0);
  const myCompletedTasks = tasksData.filter(t => String(t.assignedTo) === String(user.id) && (t.status === 'Completed' || t.status === 'Approved')).length;
  const myConnections = connectionsRaw.filter(c => c.status === 'accepted' && (String(c.fromId) === String(user.id) || String(c.toId) === String(user.id))).length;
  const myAttended = meetingsData.filter(m => (m.attendees || []).includes(user.id)).length;
  const myScore = calculateScore({ completedTasks: myCompletedTasks, likesReceived: myLikesReceived, connectionCount: myConnections, meetingsAttended: myAttended, role: user.role });
  const myLevel = getUserLevel(myScore);
  const profileViewers = currentUserData?.profileViews || 0;
  const postImpressions = myPosts.length === 0 ? 0 : myPosts.reduce((acc, post) => {
    const rxCount = Object.values(post.reactions || {}).reduce((s, arr) => s + arr.length, 0);
    return acc + 15 + (rxCount * 25);
  }, 0);

  return (
    <div className="scicomm-feed-layout">
      {/* Left Sidebar */}
      <div className="scicomm-sidebar-left hide-on-mobile">
        <div className="scicomm-card" style={{ textAlign: 'center', overflow: 'hidden' }}>
          <div style={{ width: '100%', aspectRatio: '4 / 1', background: currentUserData?.coverPhoto ? `url(${currentUserData.coverPhoto}) center/cover` : 'linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 100%)' }}></div>
          <div style={{marginTop:'-28px'}}>{renderAvatar(currentUserData, 56)}</div>
          <div style={{ padding: '8px 12px 12px' }}>
            <h3 style={{ margin: '4px 0 2px', fontSize: '15px' }}>{user.name}</h3>
            <p style={{ color: 'rgba(0,0,0,0.6)', fontSize: '12px', margin: '0 0 8px' }}>{currentUserData?.department || 'Science Communicator'}</p>
            <div style={{ background: myLevel.bg, color: myLevel.color, padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600, display: 'inline-block', marginBottom: '8px', border: `1px solid ${myLevel.color}40` }}>
              Lv. {myLevel.level}{myLevel.title ? ' ' + myLevel.title : ''}
            </div>
            {myLevel.next && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ width: '100%', height: '6px', background: '#eef3f8', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${myLevel.progress}%`, height: '100%', background: `linear-gradient(90deg, ${myLevel.color}, ${myLevel.next.color})`, borderRadius: '4px' }} />
                </div>
                <div style={{ fontSize: '10px', color: 'rgba(0,0,0,0.5)', marginTop: '4px' }}>
                  {myScore} / {myLevel.next.threshold} to {myLevel.next.title}
                </div>
              </div>
            )}
            <div style={{ borderTop: '1px solid #e0dfdc', marginTop: '4px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: 'rgba(0,0,0,0.6)' }}>Score</span>
              <strong style={{ color: myScore === Infinity ? '#b45309' : '#1d4ed8' }}>{myScore === Infinity ? 'Infinity' : myScore}</strong>
            </div>
          </div>
        </div>
        <div className="scicomm-card scicomm-card-padding" style={{ marginTop: '8px', fontSize: '13px' }}>
          <div onClick={() => setShowAnalytics(true)} style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(0,0,0,0.8)', fontWeight: 600, marginBottom: '12px', cursor: 'pointer', padding: '4px 0' }}>
            <span>Profile viewers</span>
            <span style={{ color: '#1d4ed8' }}>{profileViewers}</span>
          </div>
          <div onClick={() => setShowAnalytics(true)} style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(0,0,0,0.8)', fontWeight: 600, cursor: 'pointer', padding: '4px 0' }}>
            <span>Post impressions</span>
            <span style={{ color: '#1d4ed8' }}>{postImpressions}</span>
          </div>
        </div>
      </div>

      {/* Main Feed */}
      <div className="scicomm-feed-main">
        {/* Banner Slider */}
        {banners.length > 0 && (
          <div className="scicomm-card" style={{ position: 'relative', overflow: 'hidden', marginBottom: '12px' }}>
            <div style={{ display: 'flex', transition: 'transform 0.5s ease', transform: `translateX(-${bannerIdx * 100}%)` }}>
              {banners.map((b, i) => (
                <div key={b.id} style={{ minWidth: '100%', position: 'relative' }}>
                  <img src={b.imageUrl} alt={b.title || 'Banner'} style={{ width: '100%', height: '180px', objectFit: 'cover' }} onError={e => e.target.style.display='none'} />
                  {b.title && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.7))', color: 'white', padding: '16px', fontSize: '14px', fontWeight: 600 }}>{b.title}</div>}
                </div>
              ))}
            </div>
            {banners.length > 1 && (
              <>
                <button onClick={() => setBannerIdx(i => (i - 1 + banners.length) % banners.length)} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronLeft size={18} /></button>
                <button onClick={() => setBannerIdx(i => (i + 1) % banners.length)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronRight size={18} /></button>
                <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '6px' }}>
                  {banners.map((_, i) => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: i === bannerIdx ? 'white' : 'rgba(255,255,255,0.5)', cursor: 'pointer' }} onClick={() => setBannerIdx(i)} />)}
                </div>
              </>
            )}
          </div>
        )}

        {/* Post Composer */}
        <div className="scicomm-card scicomm-card-padding">
          <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
            {renderAvatar(currentUserData, 44)}
            <input type="text" placeholder="Share your science communication thoughts..." value={newPost} onChange={e => setNewPost(e.target.value)} onKeyDown={e => e.key === 'Enter' && handlePostSubmit(e)}
              style={{ flex: 1, border: '1px solid #e0dfdc', borderRadius: '24px', padding: '0 16px', fontSize: '14px', outline: 'none', minHeight: '40px' }} />
          </div>
          {postError && <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '8px', padding: '6px 10px', background: '#fee2e2', borderRadius: '8px' }}>{postError}</div>}

          {/* Media Preview */}
          {postImage && <div style={{ marginBottom: '8px', position: 'relative' }}><img src={URL.createObjectURL(postImage)} alt="" style={{ maxHeight: '200px', borderRadius: '8px' }} /><button onClick={() => setPostImage(null)} style={{ position: 'absolute', top: 4, right: 4, background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer' }}>×</button></div>}
          {postVideo && <div style={{ marginBottom: '8px', position: 'relative' }}><video src={URL.createObjectURL(postVideo)} style={{ maxHeight: '200px', borderRadius: '8px' }} controls /><button onClick={() => setPostVideo(null)} style={{ position: 'absolute', top: 4, right: 4, background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer' }}>×</button></div>}
          {postFile && <div style={{ marginBottom: '8px', padding: '8px', background: '#eef3f8', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>📎 {postFile.name}<button onClick={() => setPostFile(null)} style={{ position: 'absolute', top: 4, right: 4, background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', fontSize: '12px' }}>×</button></div>}

          {/* Article Title Input */}
          {showArticle && (
            <div style={{ marginBottom: '8px' }}>
              <input type="text" placeholder="Article title..." value={articleTitle} onChange={e => setArticleTitle(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #e0dfdc', borderRadius: '8px', fontSize: '14px', fontWeight: 600, outline: 'none', boxSizing: 'border-box' }} />
            </div>
          )}

          {/* Poll Builder */}
          {showPoll && (
            <div style={{ marginBottom: '12px', border: '1px solid #e0dfdc', borderRadius: '8px', padding: '12px' }}>
              <input type="text" placeholder="Poll question..." value={pollQuestion} onChange={e => setPollQuestion(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #e0dfdc', borderRadius: '4px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', marginBottom: '8px' }} />
              {pollOptions.map((opt, i) => (
                <div key={opt.id} style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                  <input type="text" placeholder={`Option ${i+1}`} value={opt.text} onChange={e => {
                    const newOpts = [...pollOptions];
                    newOpts[i].text = e.target.value;
                    setPollOptions(newOpts);
                  }} style={{ flex: 1, padding: '6px 10px', border: '1px solid #e0dfdc', borderRadius: '4px', fontSize: '13px', outline: 'none' }} />
                  {pollOptions.length > 2 && <button onClick={() => setPollOptions(pollOptions.filter(o => o.id !== opt.id))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '16px' }}>×</button>}
                </div>
              ))}
              {pollOptions.length < 5 && <button onClick={() => setPollOptions([...pollOptions, {id: Date.now(), text: ''}])} style={{ background: 'none', border: 'none', color: '#1d4ed8', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>+ Add Option</button>}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
              <label className="scicomm-feed-action" style={{ cursor: 'pointer' }}><Image size={18} color="#70b5f9" /> <span>Photo/GIF</span><input type="file" accept="image/*" onChange={e => setPostImage(e.target.files[0])} style={{ display: 'none' }} /></label>
              <label className="scicomm-feed-action" style={{ cursor: 'pointer' }}><Video size={18} color="#7fc15e" /> <span>Video</span><input type="file" accept="video/*" onChange={e => setPostVideo(e.target.files[0])} style={{ display: 'none' }} /></label>
              <button className="scicomm-feed-action" onClick={() => setShowArticle(!showArticle)} style={{ color: showArticle ? '#e7a33e' : undefined }}><FileText size={18} color="#e7a33e" /> <span>Article</span></button>
              <button className="scicomm-feed-action" onClick={() => setShowPoll(!showPoll)} style={{ color: showPoll ? '#8b5cf6' : undefined }}><span>📊</span> <span>Poll</span></button>
              <label className="scicomm-feed-action" style={{ cursor: 'pointer' }}><span style={{ fontSize: '14px' }}>📎</span> <span>File</span><input type="file" onChange={e => setPostFile(e.target.files[0])} style={{ display: 'none' }} /></label>
            </div>
            {(newPost.trim() || postImage || postVideo || postFile || (showArticle && articleTitle.trim()) || (showPoll && pollQuestion.trim())) && <button className="scicomm-btn-primary" onClick={handlePostSubmit} disabled={isPostingMedia} style={{ padding: '6px 20px' }}>{isPostingMedia ? 'Posting...' : <><Send size={14} /> Post</>}</button>}
          </div>
        </div>

        {/* Posts */}
        {posts.length === 0 ? (
          <div className="scicomm-card scicomm-card-padding" style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📢</div>
            <h3 style={{ margin: '0 0 8px' }}>No posts yet</h3>
            <p style={{ fontSize: '14px' }}>Be the first to spark a discussion!</p>
          </div>
        ) : posts.map(post => {
          const author = getAuthor(post.authorId);
          const myReaction = getMyReaction(post);
          const totalReactions = getTotalReactions(post);
          const reactionSummary = getReactionSummary(post);
          const commentCount = (post.comments || []).length;
          const isCommentsOpen = showComments[post.id];
          const currentReactionDef = myReaction ? REACTIONS.find(r => r.key === myReaction) : null;

          return (
            <div key={post.id} className="scicomm-card" style={{ marginBottom: '8px' }}>
              <div className="scicomm-card-padding">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <Link to={`/member/${post.authorId}`} style={{ cursor: 'pointer', flexShrink: 0 }}>{renderAvatar(author, 48)}</Link>
                  <div style={{ flex: 1 }}>
                    <Link to={`/member/${post.authorId}`} style={{ textDecoration: 'none', color: 'inherit' }}><h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>{post.authorName}</h4></Link>
                    <div style={{ color: 'rgba(0,0,0,0.6)', fontSize: '12px' }}>{author?.department || 'Member'}</div>
                    <div style={{ color: 'rgba(0,0,0,0.5)', fontSize: '11px' }}>{timeAgo(post.createdAt)} • 🌐{post.recognized && ' ⭐ Master Recognized'}</div>
                  </div>
                  {isAdmin && (
                    <div style={{ position: 'relative' }}>
                      <button onClick={() => setActiveReactionPicker(activeReactionPicker === 'menu_'+post.id ? null : 'menu_'+post.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666' }}><MoreHorizontal size={18} /></button>
                      {activeReactionPicker === 'menu_'+post.id && (
                        <div style={{ position: 'absolute', right: 0, top: '100%', background: 'white', border: '1px solid #e0dfdc', borderRadius: '8px', padding: '4px 0', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, minWidth: '180px' }}>
                          <button onClick={async () => { await db.scicomm_posts.update(post.id, { recognized: true, recognizedBy: user.name, recognizedAt: new Date().toISOString() }); setActiveReactionPicker(null); }} style={{ display: 'block', width: '100%', padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', textAlign: 'left' }}>⭐ Recognize Contribution</button>
                          <button onClick={async () => { if(window.confirm('Delete this post?')) await db.scicomm_posts.delete(post.id); setActiveReactionPicker(null); }} style={{ display: 'block', width: '100%', padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', textAlign: 'left', color: '#ef4444' }}>🗑️ Delete Post</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <p style={{ margin: '0 0 8px', fontSize: '14px', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{renderPostText(post.content)}</p>
                {post.articleTitle && <div style={{ padding: '10px 14px', background: 'linear-gradient(135deg, #fef3c7, #fde68a)', borderRadius: '8px', marginBottom: '8px', fontWeight: 700, fontSize: '16px', color: '#92400e' }}>📝 {post.articleTitle}</div>}
                {post.imageUrl && <img src={post.imageUrl} alt="" style={{ width: '100%', borderRadius: '8px', marginBottom: '8px', maxHeight: '500px', objectFit: 'cover' }} />}
                {post.videoUrl && <video src={post.videoUrl} controls playsInline style={{ width: '100%', borderRadius: '8px', marginBottom: '8px', maxHeight: '500px' }} />}
                {post.fileUrl && <a href={post.fileUrl} target="_blank" rel="noreferrer" style={{ display: 'block', padding: '10px 14px', background: '#eef3f8', borderRadius: '8px', marginBottom: '8px', color: '#2563eb', textDecoration: 'none', fontWeight: 600, fontSize: '13px' }}>📎 {post.fileName || 'Download Attachment'}</a>}
                
                {post.poll && (
                  <div style={{ border: '1px solid #e0dfdc', borderRadius: '8px', padding: '16px', marginBottom: '12px' }}>
                    <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '12px' }}>📊 {post.poll.question}</div>
                    {post.poll.options.map(opt => {
                      const votes = post.poll.votes || {};
                      const totalVotes = Object.keys(votes).length;
                      const optVotes = Object.values(votes).filter(v => v === opt.id).length;
                      const percent = totalVotes === 0 ? 0 : Math.round((optVotes / totalVotes) * 100);
                      const myVote = votes[user.id] === opt.id;
                      return (
                        <div key={opt.id} onClick={() => handleVote(post, opt.id)} style={{ position: 'relative', background: myVote ? '#eff6ff' : '#f3f2ef', border: myVote ? '1px solid #1d4ed8' : '1px solid transparent', borderRadius: '4px', padding: '8px 12px', marginBottom: '6px', cursor: 'pointer', overflow: 'hidden' }}>
                          <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${percent}%`, background: myVote ? '#bfdbfe' : '#e0dfdc', opacity: 0.5, zIndex: 0 }}></div>
                          <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                            <span style={{ fontWeight: myVote ? 700 : 400 }}>{opt.text}</span>
                            <span style={{ fontWeight: myVote ? 700 : 400 }}>{percent}%</span>
                          </div>
                        </div>
                      );
                    })}
                    <div style={{ fontSize: '11px', color: 'rgba(0,0,0,0.5)', marginTop: '8px' }}>{Object.keys(post.poll.votes || {}).length} votes</div>
                  </div>
                )}
              </div>

              {/* Reaction summary + comment count */}
              {(totalReactions > 0 || commentCount > 0) && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 16px 8px', fontSize: '12px', color: 'rgba(0,0,0,0.6)' }}>
                  <span>{reactionSummary.map(r => r.emoji).join('')} {totalReactions > 0 && totalReactions}</span>
                  <span style={{ cursor: 'pointer' }} onClick={() => setShowComments(p => ({ ...p, [post.id]: !p[post.id] }))}>{commentCount > 0 ? `${commentCount} comment${commentCount > 1 ? 's' : ''}` : ''}</span>
                </div>
              )}

              {/* Action bar with reaction picker */}
              <div style={{ display: 'flex', borderTop: '1px solid #e0dfdc', position: 'relative' }}>
                <div style={{ flex: 1, position: 'relative' }}
                  onMouseEnter={() => setActiveReactionPicker(post.id)}
                  onMouseLeave={() => setActiveReactionPicker(null)}>
                  <button className={`scicomm-post-btn ${myReaction ? 'liked' : ''}`} style={{ color: currentReactionDef?.color || 'rgba(0,0,0,0.6)', width: '100%' }} onClick={() => handleReaction(post, myReaction || 'like')}>
                    {currentReactionDef ? currentReactionDef.emoji : '👍'} {currentReactionDef?.label || 'Like'}
                  </button>
                  {/* Reaction Picker */}
                  {activeReactionPicker === post.id && (
                    <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', background: 'white', borderRadius: '24px', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', padding: '6px 8px', display: 'flex', gap: '2px', zIndex: 50 }}>
                      {REACTIONS.map(r => (
                        <button key={r.key} onClick={() => handleReaction(post, r.key)} title={r.label}
                          style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', padding: '4px 6px', borderRadius: '50%', transition: 'transform 0.15s' }}
                          onMouseEnter={e => e.target.style.transform = 'scale(1.3)'} onMouseLeave={e => e.target.style.transform = 'scale(1)'}>
                          {r.emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button className="scicomm-post-btn" style={{ flex: 1 }} onClick={() => setShowComments(p => ({ ...p, [post.id]: !p[post.id] }))}>
                  <MessageSquare size={18} /> Comment
                </button>
                <button className="scicomm-post-btn" style={{ flex: 1 }}>
                  <Share2 size={18} /> Share
                </button>
              </div>

              {/* Comments section */}
              {isCommentsOpen && (
                <div style={{ padding: '8px 16px 16px', borderTop: '1px solid #e0dfdc' }}>
                  {(post.comments || []).map((c, i) => {
                    const cAuthor = getAuthor(c.authorId);
                    return (
                      <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                        <Link to={`/member/${c.authorId}`} style={{ flexShrink: 0 }}>{renderAvatar(cAuthor, 32)}</Link>
                        <div style={{ background: '#f3f2ef', borderRadius: '0 8px 8px 8px', padding: '8px 12px', flex: 1 }}>
                          <Link to={`/member/${c.authorId}`} style={{ textDecoration: 'none', color: 'inherit' }}><strong style={{ fontSize: '13px' }}>{c.authorName}</strong></Link>
                          <span style={{ fontSize: '11px', color: 'rgba(0,0,0,0.4)', marginLeft: '8px' }}>{timeAgo(c.createdAt)}</span>
                          <p style={{ margin: '4px 0 0', fontSize: '13px' }}>{c.text}</p>
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <input type="text" placeholder="Add a comment..." value={commentText[post.id] || ''} onChange={e => setCommentText(prev => ({ ...prev, [post.id]: e.target.value }))} onKeyDown={e => e.key === 'Enter' && handleAddComment(post)}
                      style={{ flex: 1, border: '1px solid #e0dfdc', borderRadius: '24px', padding: '6px 14px', fontSize: '13px', outline: 'none' }} />
                    <button className="scicomm-btn-primary" style={{ padding: '6px 14px', fontSize: '12px' }} onClick={() => handleAddComment(post)}>Post</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Right Sidebar */}
      <div className="scicomm-sidebar-right hide-on-mobile">
        <div className="scicomm-card scicomm-card-padding">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '15px' }}>📌 Quick Links</h3>
            <button onClick={() => { setTempLinks([...myLinks]); setIsEditingLinks(!isEditingLinks); }} style={{ background: 'none', border: 'none', color: '#1d4ed8', cursor: 'pointer' }}><Settings size={14} /></button>
          </div>
          
          {isEditingLinks ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Toggle the links you want to pin:</div>
              {AVAILABLE_QUICK_LINKS.map((link) => {
                const isActive = tempLinks.includes(link.id);
                return (
                  <label key={link.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', padding: '6px', borderRadius: '4px', background: isActive ? '#eff6ff' : 'transparent', border: isActive ? '1px solid #bfdbfe' : '1px solid transparent' }}>
                    <input type="checkbox" checked={isActive} onChange={() => {
                      if (isActive) setTempLinks(tempLinks.filter(id => id !== link.id));
                      else setTempLinks([...tempLinks, link.id]);
                    }} style={{ cursor: 'pointer' }} />
                    {link.icon} {link.title}
                  </label>
                );
              })}
              <button onClick={async () => { await db.scientists.update(user.id, { quickLinks: tempLinks }); setIsEditingLinks(false); }} className="scicomm-btn-primary" style={{ padding: '8px', justifyContent: 'center', marginTop: '4px' }}>Save Links</button>
            </div>
          ) : (
            <div>
              {myLinks.map(id => {
                const link = AVAILABLE_QUICK_LINKS.find(l => l.id === id);
                if (!link) return null;
                return (
                  <Link key={link.id} to={link.url} style={{ display: 'block', color: '#1d4ed8', fontSize: '13px', marginBottom: '6px', textDecoration: 'none', fontWeight: 600 }}>{link.icon} {link.title}</Link>
                );
              })}
            </div>
          )}
        </div>
        
        {recognitions.length > 0 && (
          <div className="scicomm-card scicomm-card-padding" style={{ marginTop: '8px' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: '15px' }}>🌟 Spotlights</h3>
            {recognitions.filter(r => r.type === 'post_of_month').map(r => {
              const targetPost = postsRaw.find(x => x.id === r.targetId);
              if (!targetPost) return null;
              return (
                <div key={r.id} style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#1d4ed8', marginBottom: '4px' }}>POST OF THE MONTH</div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {renderAvatar(getAuthor(targetPost.authorId), 32)}
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>{targetPost.authorName}</div>
                      <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.6)' }}>{targetPost.content.substring(0, 30)}...</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="scicomm-card scicomm-card-padding" style={{ marginTop: '8px' }}>
          <h3 style={{ margin: '0 0 10px', fontSize: '15px' }}>Team</h3>
          {scientists.filter(s => s.accountStatus !== 'pending').slice(0, 5).map(s => (
            <Link key={s.id} to={`/member/${s.id}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', textDecoration: 'none', color: 'inherit' }}>
              {renderAvatar(s, 32)}
              <div>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>{s.name}</div>
                <div style={{ color: 'rgba(0,0,0,0.5)', fontSize: '11px' }}>{s.department || 'Member'}</div>
              </div>
            </Link>
          ))}
          {scientists.filter(s => s.accountStatus !== 'pending').length > 5 && (
            <Link to="/network" style={{ display: 'block', textAlign: 'center', marginTop: '12px', padding: '8px', background: '#eef3f8', color: '#1d4ed8', borderRadius: '6px', fontSize: '12px', fontWeight: 600, textDecoration: 'none', transition: 'background 0.2s' }}>
              See more team members
            </Link>
          )}
        </div>
      </div>

      {/* Analytics Modal */}
      {showAnalytics && (
        <div className="scicomm-modal-overlay" onClick={() => setShowAnalytics(false)}>
          <div className="scicomm-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '18px' }}>📊 Your Analytics</h2>
              <button className="scicomm-btn-secondary" onClick={() => setShowAnalytics(false)} style={{ border: 'none', padding: '4px' }}><X size={18} /></button>
            </div>
            
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', marginBottom: '16px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '14px', color: '#334155' }}>Recent Profile Viewers</h3>
              {(currentUserData?.viewers || []).slice(0, 5).map((v, i) => {
                const other = scientists.find(s => String(s.id) === String(v.viewerId));
                if (!other) return null;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', borderBottom: i < 4 ? '1px solid #e2e8f0' : 'none' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#eef3f8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><UserCircle size={20} color="#64748b" /></div>
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{other.name}</div>
                      <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{other.department}</div>
                    </div>
                    <div style={{ marginLeft: 'auto', fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{timeAgo(v.timestamp)}</div>
                  </div>
                );
              })}
              {!(currentUserData?.viewers?.length > 0) && <div style={{ fontSize: '12px', color: '#64748b' }}>No one has viewed your profile recently.</div>}
            </div>

            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '14px', color: '#334155' }}>Post Performance</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: '#475569' }}>Total Impressions</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>{postImpressions}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: '#475569' }}>Total Engagements</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>{myLikesReceived}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: '#475569' }}>Search Appearances</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>{Math.floor(profileViewers * 0.4)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
