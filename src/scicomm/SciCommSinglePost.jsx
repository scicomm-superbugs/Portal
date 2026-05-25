import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db, useLiveCollection, uploadFile } from '../db';
import { 
  ArrowLeft, 
  MoreHorizontal, 
  ThumbsUp, 
  MessageSquare, 
  Share2, 
  Send, 
  Trash2, 
  UserCircle,
  X,
  Bell,
  Heart,
  MessageCircle,
  AtSign,
  UserCheck,
  Briefcase,
  CheckCircle,
  AlertCircle,
  Smile,
  Image
} from 'lucide-react';
import { AVATARS, timeAgo, REACTIONS } from './scicommConstants';
import EmojiPicker from '../components/EmojiPicker';
import SciCommVerificationBadge from './SciCommVerificationBadge';

export default function SciCommSinglePost() {
  const { postId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const scientists = useLiveCollection('scientists') || [];
  const postsRaw = useLiveCollection('scicomm_posts') || [];
  
  const [commentText, setCommentText] = useState({});
  const [commentImage, setCommentImage] = useState({});
  const [replyTo, setReplyTo] = useState(null);
  const [activeReactionPicker, setActiveReactionPicker] = useState(null);
  const [showPostMenu, setShowPostMenu] = useState(false);
  const [activeCommentMenu, setActiveCommentMenu] = useState(null);
  const [editingComment, setEditingComment] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(null);
  const [showReactors, setShowReactors] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const post = postsRaw.find(p => p.id === postId);
  const isAdmin = user.role === 'admin' || user.role === 'master';
  const isDarkMode = document.documentElement.classList.contains('scicomm-dark-mode');

  const getAuthor = (id) => scientists.find(s => String(s.id) === String(id)) || {};

  if (!post) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h2>Post not found</h2>
        <button onClick={() => navigate('/')} className="scicomm-btn-primary">Back to Feed</button>
      </div>
    );
  }

  const author = getAuthor(post.authorId);

  const renderAvatar = (member, size = 48) => {
    if (member?.avatar) return <img src={member.avatar} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
    const av = AVATARS.find(a => a.id === member?.avatarId);
    if (av) return <div style={{ width: size, height: size, borderRadius: '50%', background: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.5, flexShrink: 0 }}>{av.svg}</div>;
    return <div style={{ width: size, height: size, borderRadius: '50%', background: '#eef3f8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><UserCircle size={size * 0.6} color="#64748b" /></div>;
  };

  const renderPostText = (text) => {
    if (!text) return null;
    const parts = text.split(/(#\w+|@\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('#')) return <span key={i} style={{ color: '#1d4ed8', fontWeight: 600 }}>{part}</span>;
      if (part.startsWith('@')) {
        const username = part.slice(1).toLowerCase();
        const mentioned = scientists.find(s => (s.username || '').toLowerCase() === username || (s.name || '').replace(/\s+/g, '').toLowerCase() === username);
        if (mentioned) return <Link key={i} to={`/member/${mentioned.id}`} style={{ color: '#1d4ed8', fontWeight: 600, textDecoration: 'none' }}>{part}</Link>;
      }
      return part;
    });
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
    if (myCurrent) r[myCurrent] = r[myCurrent].filter(id => id !== user.id);
    if (myCurrent !== reactionKey) {
      if (!r[reactionKey]) r[reactionKey] = [];
      r[reactionKey].push(user.id);
      if (String(post.authorId) !== String(user.id)) {
        db.scicomm_notifications.add({
          userId: post.authorId, type: 'reaction', senderId: user.id,
          title: `${user.name} reacted to your post`,
          message: `${REACTIONS.find(rx => rx.key === reactionKey)?.emoji} ${post.content?.substring(0, 30)}...`,
          link: `/view-post/${post.id}`, createdAt: new Date().toISOString(), read: false
        }).catch(() => {});
      }
    }
    await db.scicomm_posts.update(post.id, { reactions: r });
    setActiveReactionPicker(null);
  };

  const handleAddComment = async (post) => {
    const isReply = replyTo?.postId === post.id;
    const key = isReply ? `reply_${post.id}_${replyTo.path.join('_')}` : post.id;
    const text = commentText[key];
    const imgFile = commentImage[key];
    if (!text?.trim() && !imgFile) return;

    let imageUrl = null;
    if (imgFile) {
      try { imageUrl = await uploadFile(imgFile, 'comment_images'); } catch(e) { console.error(e); }
    }

    const comments = JSON.parse(JSON.stringify(post.comments || []));
    const newEntry = { id: Date.now(), authorId: user.id, authorName: user.name, text: text || '', createdAt: new Date().toISOString(), ...(imageUrl ? { imageUrl } : {}) };
    
    let targetAuthorId = post.authorId;
    if (isReply) {
      let target = comments;
      for (let i = 0; i < replyTo.path.length; i++) {
        target = target[replyTo.path[i]];
        if (i < replyTo.path.length - 1) {
          if (!target.replies) target.replies = [];
          target = target.replies;
        }
      }
      targetAuthorId = target.authorId;
      if (!target.replies) target.replies = [];
      target.replies.push(newEntry);
      setReplyTo(null);
    } else {
      comments.push(newEntry);
    }

    try {
      await db.scicomm_posts.update(post.id, { comments });
      setCommentText(prev => ({ ...prev, [key]: '' }));
      setCommentImage(prev => ({ ...prev, [key]: null }));
    } catch (err) { console.error(err); }
  };

  const handleReactionOnComment = async (post, path, reactionKey) => {
    const comments = JSON.parse(JSON.stringify(post.comments || []));
    let target = comments;
    for (let i = 0; i < path.length; i++) {
      target = target[path[i]];
      if (i < path.length - 1) target = target.replies;
    }
    
    const reactions = { ...(target.reactions || {}) };
    if (!reactions[reactionKey]) reactions[reactionKey] = [];
    const idx = reactions[reactionKey].indexOf(user.id);
    
    // Remove from all reactions first
    for (const k in reactions) {
      reactions[k] = reactions[k].filter(id => id !== user.id);
      if (reactions[k].length === 0) delete reactions[k];
    }
    
    if (idx === -1) {
      if (!reactions[reactionKey]) reactions[reactionKey] = [];
      reactions[reactionKey].push(user.id);
    }
    
    target.reactions = reactions;
    try {
      await db.scicomm_posts.update(post.id, { comments });
    } catch (err) { console.error(err); }
  };

  const handleDeleteComment = async (post, path) => {
    const postObj = postsRaw.find(p => p.id === post.id);
    if (!postObj) return;

    const comments = JSON.parse(JSON.stringify(postObj.comments || []));
    let target = comments;
    let idx = -1;
    for (let i = 0; i < path.length; i++) {
      idx = path[i];
      if (i < path.length - 1) target = target[idx].replies;
    }
    
    const comment = target[idx];
    if (isAdmin && String(comment.authorId) !== String(user.id)) {
      if (window.confirm('Blur this comment for everyone? (Admin action)')) {
        target[idx].deletedByAdmin = true;
        await db.scicomm_posts.update(post.id, { comments });
      }
    } else {
      if (window.confirm('Delete your comment permanently?')) {
        target.splice(idx, 1);
        await db.scicomm_posts.update(post.id, { comments });
      }
    }
  };

  const handleSaveEditComment = async (post) => {
    const comments = JSON.parse(JSON.stringify(post.comments || []));
    let target = comments;
    for (let i = 0; i < editingComment.path.length; i++) {
      target = target[editingComment.path[i]];
      if (i < editingComment.path.length - 1) target = target.replies;
    }
    target.text = editingComment.text;
    target.editedAt = new Date().toISOString();
    await db.scicomm_posts.update(post.id, { comments });
    setEditingComment(null);
  };

  const renderCommentTree = (post, comments, path = []) => {
    return comments.map((c, i) => {
      const currentPath = [...path, i];
      const isReplying = replyTo?.postId === post.id && JSON.stringify(replyTo?.path) === JSON.stringify(currentPath);
      const replyKey = `reply_${post.id}_${currentPath.join('_')}`;
      const cReactions = c.reactions || {};
      const myReaction = Object.entries(cReactions).find(([, arr]) => arr.includes(user.id))?.[0];
      const cAuthor = getAuthor(c.authorId);
      const isDeleted = c.deletedByAdmin;
      const hasReacts = Object.values(cReactions).some(arr => arr.length > 0);
      const bubbleClass = `scicomm-comment-bubble ${isDeleted ? "moderated-comment" : (path.length === 0 ? "main-comment" : "reply-comment")} ${hasReacts ? "has-reactions" : ""}`;
      return (
        <div key={i} className={path.length > 0 ? "scicomm-comment-thread-line" : ""} style={{ marginBottom: path.length === 0 ? '12px' : '8px', marginTop: path.length > 0 ? '8px' : '0', paddingLeft: path.length > 0 ? '12px' : '0', position: 'relative' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Link to={`/member/${c.authorId}`} style={{ flexShrink: 0, opacity: isDeleted ? 0.3 : 1 }}>{renderAvatar(cAuthor, path.length === 0 ? 32 : 24)}</Link>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className={bubbleClass} style={{ position: 'relative' }}>
                <Link to={`/member/${c.authorId}`} style={{ textDecoration: 'none', color: 'inherit' }}><strong style={{ fontSize: '13px' }}>{c.authorName}</strong></Link>
                <SciCommVerificationBadge userId={c.authorId} scientists={scientists} size={11} style={{ marginLeft: '4px' }} showTooltip={true} />
                {isDeleted ? (
                  <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>🛡️</span>
                    <p style={{ margin: 0, fontSize: '11px', color: '#991b1b', fontWeight: 700, lineHeight: 1.3 }}>
                      MODERATED CONTENT: Removed by admin for community safety.
                    </p>
                  </div>
                ) : (
                  editingComment?.path && JSON.stringify(editingComment.path) === JSON.stringify(currentPath) ? (
                    <div style={{ marginTop: '4px' }}>
                       <textarea dir="auto" value={editingComment.text} onChange={e => setEditingComment({...editingComment, text: e.target.value})} style={{ width: '100%', minHeight: '40px', padding: '6px', border: '1px solid #1d4ed8', borderRadius: '4px', fontSize: '13px' }} />
                      <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                        <button onClick={() => handleSaveEditComment(post)} className="scicomm-btn-primary" style={{ padding: '2px 8px', fontSize: '11px' }}>Save</button>
                        <button onClick={() => setEditingComment(null)} className="scicomm-btn-secondary" style={{ padding: '2px 8px', fontSize: '11px' }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p dir="auto" style={{ margin: '2px 0 0', fontSize: '13px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{renderPostText(c.text)}</p>
                      {c.imageUrl && <img src={c.imageUrl} alt="" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '6px', marginTop: '6px' }} />}
                    </>
                  )
                )}

                {/* Floating Facebook comment reactions overlapping the bubble */}
                {Object.values(cReactions).some(arr => arr.length > 0) && (
                  <div className="scicomm-comment-react-pill" onClick={() => setShowReactors({ reactions: cReactions, title: 'Reactions' })}>
                    {Object.entries(cReactions)
                      .filter(([, arr]) => arr.length > 0)
                      .map(([key]) => REACTIONS.find(r => r.key === key)?.emoji)
                      .join('')}
                    <span style={{ marginLeft: '2px' }}>
                      {Object.values(cReactions).reduce((sum, arr) => sum + arr.length, 0)}
                    </span>
                  </div>
                )}
              </div>
              
              {!isDeleted && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px', paddingLeft: '8px' }}>
                  <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
                    onMouseEnter={() => { clearTimeout(window.reactionLeaveTimer); setActiveReactionPicker("comment_" + post.id + "_" + currentPath.join("_")); }}
                    onMouseLeave={() => { window.reactionLeaveTimer = setTimeout(() => setActiveReactionPicker(null), 400); }}
                    onTouchStart={() => { window.reactionTimer = setTimeout(() => setActiveReactionPicker("comment_" + post.id + "_" + currentPath.join("_")), 200); }}
                    onTouchEnd={() => clearTimeout(window.reactionTimer)}
                    onTouchMove={() => clearTimeout(window.reactionTimer)}
                    onContextMenu={(e) => { e.preventDefault(); setActiveReactionPicker("comment_" + post.id + "_" + currentPath.join("_")); }}>
                    <button 
                      className="scicomm-comment-reply-btn"
                      onClick={() => handleReactionOnComment(post, currentPath, myReaction || 'like')} 
                      style={{ 
                        background: 'none', border: 'none', cursor: 'pointer', 
                        fontSize: '12px', fontWeight: 700, 
                        color: myReaction ? (REACTIONS.find(r => r.key === myReaction)?.color || '#1877f2') : '#65676b', 
                        padding: '2px 0' 
                      }}
                    >
                      {myReaction ? (REACTIONS.find(r => r.key === myReaction)?.label || 'Liked') : 'Like'}
                    </button>
                    {activeReactionPicker === "comment_" + post.id + "_" + currentPath.join("_") && (
                      <div className="scicomm-reacts-popup" style={{ bottom: '100%', left: '0px' }}>
                        {REACTIONS.map(r => (
                          <button key={r.key} onClick={() => { clearTimeout(window.reactionLeaveTimer); handleReactionOnComment(post, currentPath, r.key); }} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '4px 6px', borderRadius: '50%', transition: 'transform 0.15s' }} onMouseEnter={e => { clearTimeout(window.reactionLeaveTimer); e.target.style.transform = 'scale(1.3)'; }} onMouseLeave={e => e.target.style.transform = 'scale(1)'}>
                            <span className="emoji">{r.emoji}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button 
                    className="scicomm-comment-reply-btn"
                    onClick={() => setReplyTo(isReplying ? null : { postId: post.id, path: currentPath, authorName: c.authorName })} 
                    style={{ 
                      background: 'none', border: 'none', cursor: 'pointer', 
                      fontSize: '12px', fontWeight: 700, 
                      color: isReplying ? '#1d4ed8' : '#65676b', 
                      padding: '2px 0' 
                    }}
                  >Reply</button>

                  <span style={{ fontSize: '12px', color: '#65676b' }}>{timeAgo(c.createdAt)}</span>

                  <div style={{ position: 'relative' }}>
                    <button onClick={() => setActiveCommentMenu(activeCommentMenu === `${currentPath.join('_')}` ? null : `${currentPath.join('_')}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(0,0,0,0.3)' }}><MoreHorizontal size={14} /></button>
                    {activeCommentMenu === `${currentPath.join('_')}` && (
                      <div style={{ position: 'absolute', left: '100%', top: 0, background: 'white', border: '1px solid #e0dfdc', borderRadius: '8px', padding: '4px 0', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 60, minWidth: '100px', marginLeft: '4px' }}>
                        {String(c.authorId) === String(user.id) && <button onClick={() => { setEditingComment({ path: currentPath, text: c.text }); setActiveCommentMenu(null); }} style={{ display: 'block', width: '100%', padding: '6px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '12px', textAlign: 'left' }}>Edit</button>}
                        {(String(c.authorId) === String(user.id) || isAdmin) && <button onClick={() => handleDeleteComment(post, currentPath)} style={{ display: 'block', width: '100%', padding: '6px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '12px', textAlign: 'left', color: '#ef4444' }}>Delete</button>}
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {c.replies?.length > 0 && <div style={{ marginTop: '4px' }}>{renderCommentTree(post, c.replies, currentPath)}</div>}
              {/* Reply Input - uses same flat structure as main comment input */}
              {isReplying && (
                <div style={{ marginTop: '8px' }}>
                  <div className="scicomm-comment-input-row" style={{ display: 'flex', gap: '8px', alignItems: 'center', position: 'relative' }}>
                    {renderAvatar(getAuthor(user.id), 24)}
                    <div className="scicomm-comment-capsule" onClick={e => { if (!['BUTTON', 'INPUT', 'LABEL', 'SPAN', 'SVG', 'PATH'].includes(e.target.tagName) && !e.target.closest('button') && !e.target.closest('label')) e.currentTarget.querySelector('textarea')?.focus(); }}>
                      <div style={{ flex: 1, position: 'relative' }}>
                        <textarea className="scicomm-comment-textarea-field" dir="auto" placeholder={`Replying to ${c.authorName}...`} value={commentText[replyKey] || ''} 
                          onChange={e => {
                            setCommentText({...commentText, [replyKey]: e.target.value});
                            e.target.style.height = 'auto';
                            e.target.style.height = e.target.scrollHeight + 'px';
                          }} 
                          rows={1}
                          autoFocus />
                      </div>
                      <div className="scicomm-comment-tools">
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <button className="scicomm-comment-emoji-btn" onClick={() => setShowEmojiPicker(showEmojiPicker === replyKey ? null : replyKey)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}><Smile size={18} style={{ color: '#65676b' }} /></button>
                          {showEmojiPicker === replyKey && (
                            <EmojiPicker
                              onSelect={(emoji) => setCommentText(prev => ({...prev, [replyKey]: (prev[replyKey]||'')+emoji}))}
                              onClose={() => setShowEmojiPicker(null)}
                              isDarkMode={isDarkMode}
                            />
                          )}
                        </div>
                        <label className="scicomm-comment-image-btn" style={{ cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Image size={18} style={{ color: '#65676b' }} /><input type="file" accept="image/*" onChange={e => setCommentImage(prev => ({...prev, [replyKey]: e.target.files[0]}))} style={{ display: 'none' }} /></label>
                      </div>
                    </div>
                    <button className="scicomm-comment-send-btn" style={{ padding: '8px 16px', flexShrink: 0, alignSelf: 'center', borderRadius: '24px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => handleAddComment(post)}><Send size={16} /></button>
                    <button onClick={() => { setReplyTo(null); setCommentText(prev => ({...prev, [replyKey]: ''})); setCommentImage(prev => ({...prev, [replyKey]: null})); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={16} /></button>
                  </div>
                  {commentImage[replyKey] && <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}><span className="emoji">📎</span> {commentImage[replyKey].name} <button onClick={() => setCommentImage(prev => ({...prev, [replyKey]: null}))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '11px' }}>✕ Remove</button></div>}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    });
  };

  const myReaction = getMyReaction(post);
  const totalReactions = Object.values(post.reactions || {}).reduce((acc, arr) => acc + (arr?.length || 0), 0);
  const commentCount = post.comments?.length || 0;
  const reactionSummary = REACTIONS.filter(r => (post.reactions?.[r.key]?.length || 0) > 0);

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '16px' }}>
      <button onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: '#1d4ed8', cursor: 'pointer', marginBottom: '20px', fontWeight: 600 }}>
        <ArrowLeft size={20} /> Back to Feed
      </button>

      <div className="scicomm-card" style={{ overflow: 'visible' }}>
        <div className="scicomm-card-padding">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <Link to={`/member/${post.authorId}`}>{renderAvatar(author, 56)}</Link>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <Link to={`/member/${post.authorId}`} style={{ textDecoration: 'none', color: 'inherit' }}><h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>{post.authorName}</h4></Link>
                <SciCommVerificationBadge role={author?.role} size={16} style={{ marginLeft: '4px' }} showTooltip={true} />
              </div>
              <div style={{ color: 'rgba(0,0,0,0.6)', fontSize: '13px' }}>{author?.department || 'Member'}</div>
              <div style={{ color: 'rgba(0,0,0,0.5)', fontSize: '12px' }}>{timeAgo(post.createdAt)} • 🌐{post.recognized && ' ⭐ Master Recognized'}</div>
            </div>
            {(isAdmin || String(post.authorId) === String(user.id)) && (
              <div style={{ position: 'relative' }}>
                <button onClick={() => setShowPostMenu(!showPostMenu)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(0,0,0,0.4)' }}><MoreHorizontal size={20} /></button>
                {showPostMenu && (
                  <div style={{ position: 'absolute', right: 0, top: '100%', background: 'white', border: '1px solid #e0dfdc', borderRadius: '12px', padding: '8px 0', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 100, minWidth: '160px' }}>
                    <button onClick={() => { if(window.confirm('Delete this post?')) { setShowPostMenu(false); db.scicomm_posts.delete(post.id); navigate('/'); } }} style={{ display: 'block', width: '100%', padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', textAlign: 'left', color: '#ef4444', fontWeight: 600 }}>🗑️ Delete Post</button>
                  </div>
                )}
              </div>
            )}
          </div>

          {(() => {
            const shouldTruncate = post.content && (post.content.length > 280 || post.content.split('\n').length > 3);
            let displayText = post.content;
            if (shouldTruncate && !isExpanded) {
              const newlineIndices = [];
              let idx = post.content.indexOf('\n');
              while (idx !== -1) {
                newlineIndices.push(idx);
                idx = post.content.indexOf('\n', idx + 1);
              }
              
              let truncateIdx = 280;
              if (newlineIndices.length >= 3) {
                truncateIdx = Math.min(truncateIdx, newlineIndices[2]);
              }
              
              displayText = post.content.substring(0, truncateIdx) + '...';
            }
            return (
              <p dir="auto" style={{ fontSize: '16px', lineHeight: '1.6', whiteSpace: 'pre-wrap', margin: '0 0 16px' }}>
                {renderPostText(displayText)}
                {shouldTruncate && (
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsExpanded(!isExpanded);
                    }}
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      color: '#1d4ed8', 
                      fontWeight: 700, 
                      cursor: 'pointer', 
                      padding: '0 0 0 4px', 
                      fontSize: '15px',
                      display: 'inline-block',
                      fontFamily: 'inherit'
                    }}
                  >
                    {isExpanded ? ' show less' : ' see more'}
                  </button>
                )}
              </p>
            );
          })()}

          {post.imageUrl && <img src={post.imageUrl} alt="" style={{ width: '100%', borderRadius: '12px', marginBottom: '16px', maxHeight: '600px', objectFit: 'cover' }} />}
        </div>

        {/* Reaction summary + comment count */}
        {(totalReactions > 0 || commentCount > 0) && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 16px 8px', fontSize: '12px', color: 'rgba(0,0,0,0.6)' }}>
            <span style={{ cursor: totalReactions > 0 ? 'pointer' : 'default' }} onClick={() => totalReactions > 0 && setShowReactors({ reactions: post.reactions || {}, title: 'Post Reactions' })}>
              {reactionSummary.map(r => r.emoji).join('')} {totalReactions > 0 && totalReactions}
            </span>
            <span>{commentCount > 0 ? `${commentCount} comment${commentCount > 1 ? 's' : ''}` : ''}</span>
          </div>
        )}

        <div className="scicomm-post-actions-row">
          <div style={{ flex: 1, position: 'relative', userSelect: 'none', WebkitUserSelect: 'none' }}
            onMouseEnter={() => { clearTimeout(window.reactionLeaveTimer); setActiveReactionPicker(post.id); }}
            onMouseLeave={() => { window.reactionLeaveTimer = setTimeout(() => setActiveReactionPicker(null), 400); }}
            onTouchStart={() => { window.reactionTimer = setTimeout(() => setActiveReactionPicker(post.id), 200); }}
            onTouchEnd={() => clearTimeout(window.reactionTimer)}
            onTouchMove={() => clearTimeout(window.reactionTimer)}
            onContextMenu={(e) => { e.preventDefault(); setActiveReactionPicker(post.id); }}>
            <button className={`scicomm-post-btn ${myReaction ? 'liked' : ''}`} style={{ width: '100%', color: myReaction ? REACTIONS.find(r => r.key === myReaction)?.color || '#1d4ed8' : 'rgba(0,0,0,0.6)' }} onClick={() => handleReaction(post, myReaction || 'like')}>
              {myReaction ? <span className="emoji">{REACTIONS.find(r => r.key === myReaction)?.emoji}</span> : <ThumbsUp size={18} />} {myReaction ? REACTIONS.find(r => r.key === myReaction)?.label : 'Like'}
            </button>
            {activeReactionPicker === post.id && (
              <div className="scicomm-reacts-popup">
                {REACTIONS.map(r => (
                  <button key={r.key} onClick={() => { clearTimeout(window.reactionLeaveTimer); handleReaction(post, r.key); }} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', padding: '4px 6px', borderRadius: '50%', transition: 'transform 0.15s' }} onMouseEnter={e => { clearTimeout(window.reactionLeaveTimer); e.target.style.transform = 'scale(1.3)'; }} onMouseLeave={e => e.target.style.transform = 'scale(1)'}>
                    <span className="emoji">{r.emoji}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="scicomm-post-btn" style={{ flex: 1 }}><MessageSquare size={18} /> Comment</button>
          <button className="scicomm-post-btn" style={{ flex: 1 }}><Share2 size={18} /> Share</button>
        </div>

        <div className="scicomm-single-post-comments-container">
          <div className="scicomm-comment-input-row" style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center', position: 'relative' }}>
            {renderAvatar(getAuthor(user.id), 32)}
            <div className="scicomm-comment-capsule" onClick={e => { if (!['BUTTON', 'INPUT', 'LABEL', 'SPAN', 'SVG', 'PATH'].includes(e.target.tagName) && !e.target.closest('button') && !e.target.closest('label')) e.currentTarget.querySelector('textarea')?.focus(); }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <textarea className="scicomm-comment-textarea-field" dir="auto" placeholder="Write a comment..." value={commentText[post.id] || ''} 
                  onChange={e => {
                    setCommentText({...commentText, [post.id]: e.target.value});
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                  }} 
                  rows={1} />
              </div>
              <div className="scicomm-comment-tools">
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <button className="scicomm-comment-emoji-btn" onClick={() => setShowEmojiPicker(showEmojiPicker === post.id ? null : post.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}><Smile size={18} style={{ color: '#65676b' }} /></button>
                  {showEmojiPicker === post.id && (
                    <EmojiPicker
                      onSelect={(emoji) => setCommentText(prev => ({...prev, [post.id]: (prev[post.id]||'')+emoji}))}
                      onClose={() => setShowEmojiPicker(null)}
                      isDarkMode={isDarkMode}
                    />
                  )}
                </div>
                <label className="scicomm-comment-image-btn" style={{ cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Image size={18} style={{ color: '#65676b' }} /><input type="file" accept="image/*" onChange={e => setCommentImage(prev => ({...prev, [post.id]: e.target.files[0]}))} style={{ display: 'none' }} /></label>
              </div>
            </div>
            <button className="scicomm-comment-send-btn" style={{ padding: '8px 16px', flexShrink: 0, alignSelf: 'center', borderRadius: '24px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => handleAddComment(post)}><Send size={16} /></button>
          </div>

          {commentImage[post.id] && (
            <div style={{ fontSize: '11px', color: '#666', marginTop: '-8px', marginBottom: '12px', paddingLeft: '40px' }}>
              <span className="emoji">📎</span> {commentImage[post.id].name} <button onClick={() => setCommentImage(prev => ({...prev, [post.id]: null}))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '11px' }}>✕ Remove</button>
            </div>
          )}

          {renderCommentTree(post, post.comments || [], [])}
        </div>
      </div>

      {/* Reactors Modal */}
      {showReactors && (
        <div onClick={() => setShowReactors(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '12px', width: '100%', maxWidth: '400px', maxHeight: '70vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #e0dfdc' }}>
              <h3 style={{ margin: 0, fontSize: '16px' }}>{showReactors.title}</h3>
              <button onClick={() => setShowReactors(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#666' }}>✕</button>
            </div>
            <div style={{ overflowY: 'auto', padding: '8px 0' }}>
              {Object.entries(showReactors.reactions).map(([key, arr]) => {
                const rd = REACTIONS.find(r => r.key === key);
                return arr.map(uid => {
                  const person = getAuthor(uid);
                  return (
                    <div key={`${key}_${uid}`} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 20px' }}>
                      <div style={{ position: 'relative' }}>
                        {renderAvatar(person, 40)}
                        <span style={{ position: 'absolute', bottom: -2, right: -2, fontSize: '14px' }}>{rd?.emoji}</span>
                      </div>
                      <div style={{ fontWeight: 600 }}>{person?.name || 'Someone'}</div>
                    </div>
                  );
                });
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
