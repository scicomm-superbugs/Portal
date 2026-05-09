import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db, useLiveCollection } from '../db';
import { 
  ArrowLeft, 
  MoreHorizontal, 
  ThumbsUp, 
  MessageSquare, 
  Share2, 
  Send, 
  Trash2, 
  UserCircle
} from 'lucide-react';
import { AVATARS, timeAgo, REACTIONS } from './scicommConstants';

export default function SciCommSinglePost() {
  const { postId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const scientists = useLiveCollection('scientists') || [];
  const postsRaw = useLiveCollection('scicomm_posts') || [];
  const connectionsRaw = useLiveCollection('scicomm_connections') || [];
  const tasksData = useLiveCollection('tasks') || [];
  const meetingsData = useLiveCollection('scicomm_meetings') || [];

  const [commentText, setCommentText] = useState('');
  const [activeReactionPicker, setActiveReactionPicker] = useState(null);
  const [editingPost, setEditingPost] = useState(null);
  const [showReactors, setShowReactors] = useState(null);

  const post = postsRaw.find(p => p.id === postId);
  const isAdmin = user.role === 'admin' || user.role === 'master';
  const author = post ? scientists.find(s => String(s.id) === String(post.authorId)) : null;

  if (!post) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h2>Post not found</h2>
        <button onClick={() => navigate('/')} className="scicomm-btn-primary">Back to Feed</button>
      </div>
    );
  }

  const renderAvatar = (member, size = 48) => {
    if (member?.avatar) return <img src={member.avatar} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
    const av = AVATARS.find(a => a.id === member?.avatarId);
    if (av) return <div style={{ width: size, height: size, borderRadius: '50%', background: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.5, flexShrink: 0 }}>{av.svg}</div>;
    return <div style={{ width: size, height: size, borderRadius: '50%', background: '#eef3f8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><UserCircle size={size * 0.6} color="#666" /></div>;
  };

  const getMyReaction = (post) => {
    const r = post.reactions || {};
    for (const [key, arr] of Object.entries(r)) {
      if (arr.includes(user.id)) return key;
    }
    return null;
  };

  const handleReaction = async (post, reactionKey) => {
    const r = { ...(post.reactions || {}) };
    const myCurrent = getMyReaction(post);
    
    // Remove old
    if (myCurrent) {
      r[myCurrent] = r[myCurrent].filter(id => id !== user.id);
    }
    
    // Add new if different
    if (myCurrent !== reactionKey) {
      if (!r[reactionKey]) r[reactionKey] = [];
      r[reactionKey].push(user.id);
      
      // Notify owner
      if (String(post.authorId) !== String(user.id)) {
        db.scicomm_notifications.add({
          userId: post.authorId,
          type: 'reaction',
          senderId: user.id,
          title: `${user.name} reacted to your post`,
          message: `${REACTIONS.find(rx => rx.key === reactionKey)?.emoji} ${post.content?.substring(0, 30)}...`,
          link: `/view-post/${post.id}`,
          createdAt: new Date().toISOString(),
          read: false
        }).catch(() => {});
      }
    }
    
    await db.scicomm_posts.update(post.id, { reactions: r });
    setActiveReactionPicker(null);
  };

  const handleCommentSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!commentText.trim()) return;
    
    const newComment = {
      id: Date.now(),
      authorId: user.id,
      authorName: user.name,
      text: commentText.trim(),
      createdAt: new Date().toISOString()
    };
    
    const comments = [...(post.comments || []), newComment];
    await db.scicomm_posts.update(post.id, { comments });
    setCommentText('');
    
    // Notify owner
    if (String(post.authorId) !== String(user.id)) {
      db.scicomm_notifications.add({
        userId: post.authorId,
        type: 'comment',
        senderId: user.id,
        title: `${user.name} commented on your post`,
        message: commentText.trim().substring(0, 50),
        link: `/view-post/${post.id}`,
        createdAt: new Date().toISOString(),
        read: false
      }).catch(() => {});
    }

    // Notify mentioned users in comment
    const mentions = commentText.match(/@\w+/g) || [];
    mentions.forEach(mention => {
      const username = mention.slice(1).toLowerCase();
      const userMatch = scientists.find(s => (s.username || '').toLowerCase() === username || s.name.replace(/\s+/g, '').toLowerCase() === username);
      if (userMatch && String(userMatch.id) !== String(user.id)) {
        db.scicomm_notifications.add({
          userId: userMatch.id,
          type: 'mention',
          senderId: user.id,
          title: `${user.name} mentioned you in a comment`,
          message: commentText.trim().substring(0, 50),
          link: `/view-post/${post.id}`,
          createdAt: new Date().toISOString(),
          read: false
        }).catch(() => {});
      }
    });
  };

  const handleDeletePost = async (id) => {
    if (window.confirm('Delete this post?')) {
      await db.scicomm_posts.delete(id);
      navigate('/');
    }
  };

  const handleVote = async (post, optionId) => {
    const votes = { ...(post.poll.votes || {}) };
    votes[user.id] = optionId;
    await db.scicomm_posts.update(post.id, { 'poll.votes': votes });
  };

  const myReaction = getMyReaction(post);
  const totalReactions = Object.values(post.reactions || {}).reduce((acc, arr) => acc + (arr?.length || 0), 0);
  const commentCount = post.comments?.length || 0;

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '16px' }}>
      <button 
        onClick={() => navigate('/')} 
        style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: '#1d4ed8', cursor: 'pointer', marginBottom: '20px', fontWeight: 600 }}
      >
        <ArrowLeft size={20} /> Back to Feed
      </button>

      <div className="scicomm-card" style={{ overflow: 'visible' }}>
        <div className="scicomm-card-padding">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <Link to={`/member/${post.authorId}`}>{renderAvatar(author, 56)}</Link>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Link to={`/member/${post.authorId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>{post.authorName}</h4>
                </Link>
                {author?.role === 'master' && <span style={{ background: '#f59e0b', color: 'white', padding: '1px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: 700 }}>👑 Master</span>}
              </div>
              <div style={{ color: '#64748b', fontSize: '13px' }}>{author?.department || 'Member'}</div>
              <div style={{ color: '#94a3b8', fontSize: '12px' }}>{timeAgo(post.createdAt)} • 🌐{post.recognized && ' ⭐ Master Recognized'}</div>
            </div>
            {(isAdmin || String(post.authorId) === String(user.id)) && (
              <div style={{ position: 'relative' }}>
                <button onClick={() => setActiveReactionPicker(activeReactionPicker === 'menu' ? null : 'menu')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                  <MoreHorizontal size={20} />
                </button>
                {activeReactionPicker === 'menu' && (
                  <div style={{ position: 'absolute', right: 0, top: '100%', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '8px 0', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 100, minWidth: '160px' }}>
                    {(String(post.authorId) === String(user.id) || isAdmin) && (
                      <button onClick={() => handleDeletePost(post.id)} style={{ display: 'block', width: '100%', padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', textAlign: 'left', color: '#ef4444', fontWeight: 600 }}>🗑️ Delete Post</button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <p style={{ 
            fontSize: '16px', 
            lineHeight: '1.6', 
            whiteSpace: 'pre-wrap', 
            margin: '0 0 16px',
            unicodeBidi: 'plaintext',
            direction: /[\u0600-\u06FF]/.test(post.content || '') ? 'rtl' : 'ltr',
            textAlign: /[\u0600-\u06FF]/.test(post.content || '') ? 'right' : 'left'
          }}>{post.content}</p>

          {post.imageUrl && <img src={post.imageUrl} alt="" style={{ width: '100%', borderRadius: '12px', marginBottom: '16px', maxHeight: '600px', objectFit: 'cover' }} />}
          
          {post.poll && (
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', marginBottom: '16px', background: '#f8fafc' }}>
              <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '16px' }}>📊 {post.poll.question}</div>
              {post.poll.options.map(opt => {
                const votes = post.poll.votes || {};
                const totalVotes = Object.keys(votes).length;
                const optVotes = Object.values(votes).filter(v => v === opt.id).length;
                const percent = totalVotes === 0 ? 0 : Math.round((optVotes / totalVotes) * 100);
                const myVote = votes[user.id] === opt.id;
                return (
                  <div key={opt.id} onClick={() => handleVote(post, opt.id)} style={{ position: 'relative', background: myVote ? '#eff6ff' : 'white', border: myVote ? '1px solid #1d4ed8' : '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 16px', marginBottom: '8px', cursor: 'pointer', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${percent}%`, background: myVote ? '#bfdbfe' : '#f1f5f9', opacity: 0.5, zIndex: 0 }}></div>
                    <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: myVote ? 700 : 500 }}>
                      <span>{opt.text}</span>
                      <span>{percent}%</span>
                    </div>
                  </div>
                );
              })}
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>{Object.keys(post.poll.votes || {}).length} votes</div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', fontSize: '13px', color: '#64748b', borderTop: '1px solid #f1f5f9' }}>
          <span>{totalReactions > 0 ? `${totalReactions} reactions` : 'No reactions yet'}</span>
          <span>{commentCount} comments</span>
        </div>

        <div style={{ display: 'flex', borderTop: '1px solid #f1f5f9', position: 'relative' }}>
          <div style={{ flex: 1, position: 'relative' }} onMouseEnter={() => setActiveReactionPicker(post.id)} onMouseLeave={() => setActiveReactionPicker(null)}>
            <button className="scicomm-post-btn" style={{ width: '100%', color: myReaction ? REACTIONS.find(r => r.key === myReaction)?.color || '#1d4ed8' : 'inherit' }}>
              {myReaction ? REACTIONS.find(r => r.key === myReaction)?.emoji : <ThumbsUp size={18} />} {myReaction ? REACTIONS.find(r => r.key === myReaction)?.label : 'Like'}
            </button>
            {activeReactionPicker === post.id && (
              <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', background: 'white', borderRadius: '30px', padding: '6px 12px', display: 'flex', gap: '10px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)', border: '1px solid #e2e8f0', zIndex: 100, animation: 'fadeSlide 0.2s ease' }}>
                {REACTIONS.map(r => (
                  <button key={r.key} onClick={() => handleReaction(post, r.key)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', transition: 'transform 0.2s', padding: '2px' }} className="reaction-emoji" title={r.label}>{r.emoji}</button>
                ))}
              </div>
            )}
          </div>
          <button className="scicomm-post-btn" style={{ flex: 1 }}><MessageSquare size={18} /> Comment</button>
          <button className="scicomm-post-btn" style={{ flex: 1 }}><Share2 size={18} /> Share</button>
        </div>

        {/* Comments Section */}
        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '0 0 16px 16px' }}>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            {renderAvatar(scientists.find(s => String(s.id) === String(user.id)), 36)}
            <div style={{ flex: 1, position: 'relative' }}>
              <input 
                type="text" 
                placeholder="Write a comment..." 
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCommentSubmit()}
                style={{ width: '100%', padding: '10px 16px', borderRadius: '20px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '14px' }}
              />
              <button onClick={handleCommentSubmit} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#1d4ed8', cursor: 'pointer' }}>
                <Send size={18} />
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(post.comments || []).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).map(comment => {
              const cAuthor = scientists.find(s => String(s.id) === String(comment.authorId));
              return (
                <div key={comment.id} style={{ display: 'flex', gap: '10px' }}>
                  <Link to={`/member/${comment.authorId}`}>{renderAvatar(cAuthor, 32)}</Link>
                  <div style={{ flex: 1, background: 'white', padding: '10px 14px', borderRadius: '16px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <Link to={`/member/${comment.authorId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                        <span style={{ fontWeight: 700, fontSize: '13px' }}>{comment.authorName}</span>
                      </Link>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>{timeAgo(comment.createdAt)}</span>
                    </div>
                    <div style={{ fontSize: '14px', color: '#334155', lineHeight: '1.4' }}>{comment.text}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
