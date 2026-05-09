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
  AlertCircle
} from 'lucide-react';
import { AVATARS, timeAgo, REACTIONS } from './scicommConstants';

const EMOJI_LIST = ['👍', '❤️', '👏', '🤗', '💡', '🔥', '🧠', '😮', '😂', '😢'];

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
  const [activeCommentMenu, setActiveCommentMenu] = useState(null);
  const [editingComment, setEditingComment] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(null);
  const [showReactors, setShowReactors] = useState(null);

  const post = postsRaw.find(p => p.id === postId);
  const isAdmin = user.role === 'admin' || user.role === 'master';

  const getAuthor = (id) => scientists.find(s => String(s.id) === String(id));

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
    return <div style={{ width: size, height: size, borderRadius: '50%', background: '#eef3f8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><UserCircle size={size * 0.6} color="#666" /></div>;
  };

  const renderPostText = (text) => {
    if (!text) return null;
    const parts = text.split(/(#\w+|@\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('#')) return <span key={i} style={{ color: '#0a66c2', fontWeight: 600 }}>{part}</span>;
      if (part.startsWith('@')) {
        const username = part.slice(1).toLowerCase();
        const mentioned = scientists.find(s => (s.username || '').toLowerCase() === username || s.name.replace(/\s+/g, '').toLowerCase() === username);
        if (mentioned) return <Link key={i} to={`/member/${mentioned.id}`} style={{ color: '#0a66c2', fontWeight: 600, textDecoration: 'none' }}>{part}</Link>;
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
      
      const notifiedIds = new Set();
      if (String(post.authorId) !== String(user.id)) {
        notifiedIds.add(String(post.authorId));
        db.scicomm_notifications.add({
          userId: post.authorId, type: isReply ? 'reply' : 'comment', senderId: user.id,
          title: `${user.name} ${isReply ? 'replied to a comment' : 'commented'} on your post`,
          message: text?.substring(0, 60), link: `/view-post/${post.id}`, createdAt: new Date().toISOString(), read: false
        }).catch(() => {});
      }
      if (isReply && String(targetAuthorId) !== String(user.id) && !notifiedIds.has(String(targetAuthorId))) {
        db.scicomm_notifications.add({
          userId: targetAuthorId, type: 'reply', senderId: user.id,
          title: `${user.name} replied to your comment`,
          message: text?.substring(0, 60), link: `/view-post/${post.id}`, createdAt: new Date().toISOString(), read: false
        }).catch(() => {});
      }
    } catch (err) { console.error(err); }
  };

  const handleReactionOnComment = async (post, path, reactionKey) => {
    const comments = JSON.parse(JSON.stringify(post.comments || []));
    let target = comments;
    for (let i = 0; i < path.length; i++) {
      target = target[path[i]];
      if (i < path.length - 1) target = target.replies;
    }
    const reactions = target.reactions || {};
    const users = reactions[reactionKey] || [];
    if (users.includes(user.id)) {
      reactions[reactionKey] = users.filter(id => id !== user.id);
      if (reactions[reactionKey].length === 0) delete reactions[reactionKey];
    } else {
      for (const k in reactions) {
        reactions[k] = reactions[k].filter(id => id !== user.id);
        if (reactions[k].length === 0) delete reactions[k];
      }
      if (!reactions[reactionKey]) reactions[reactionKey] = [];
      reactions[reactionKey].push(user.id);
      if (String(target.authorId) !== String(user.id)) {
        const rd = REACTIONS.find(r => r.key === reactionKey);
        db.scicomm_notifications.add({
          userId: target.authorId, type: 'reaction', senderId: user.id,
          title: `${user.name} reacted ${rd?.emoji || ''} to your comment`,
          message: target.text?.substring(0, 50), link: `/view-post/${post.id}`, createdAt: new Date().toISOString(), read: false
        }).catch(() => {});
      }
    }
    target.reactions = reactions;
    await db.scicomm_posts.update(post.id, { comments });
  };

  const handleDeleteComment = async (post, path) => {
    if (!window.confirm('Delete this comment?')) return;
    const comments = JSON.parse(JSON.stringify(post.comments || []));
    let target = comments;
    let parent = null;
    let idx = -1;
    for (let i = 0; i < path.length; i++) {
      idx = path[i];
      if (i < path.length - 1) {
        parent = target[idx];
        target = parent.replies;
      }
    }
    target.splice(idx, 1);
    await db.scicomm_posts.update(post.id, { comments });
  };

  const handleSaveEditComment = async (post) => {
    const comments = JSON.parse(JSON.stringify(post.comments || []));
    let target = comments;
    for (let i = 0; i < editingComment.path.length; i++) {
      target = target[editingComment.path[i]];
      if (i < editingComment.path.length - 1) target = target.replies;
    }
    target.text = editingComment.text;
    await db.scicomm_posts.update(post.id, { comments });
    setEditingComment(null);
  };

  const CommentNode = ({ post, comments, path = [] }) => {
    return comments.map((c, i) => {
      const currentPath = [...path, i];
      const isReplying = replyTo?.postId === post.id && JSON.stringify(replyTo?.path) === JSON.stringify(currentPath);
      const replyKey = `reply_${post.id}_${currentPath.join('_')}`;
      const cReactions = c.reactions || {};
      const myReaction = Object.entries(cReactions).find(([, arr]) => arr.includes(user.id))?.[0];
      const cAuthor = getAuthor(c.authorId);
      
      return (
        <div key={i} style={{ marginBottom: path.length === 0 ? '12px' : '8px', marginTop: path.length > 0 ? '8px' : '0', paddingLeft: path.length > 0 ? '12px' : '0', borderLeft: path.length > 0 ? '2px solid #e2e8f0' : 'none', position: 'relative' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Link to={`/member/${c.authorId}`}>{renderAvatar(cAuthor, path.length === 0 ? 32 : 24)}</Link>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ background: path.length === 0 ? '#f1f5f9' : '#f8fafc', borderRadius: '0 12px 12px 12px', padding: '8px 12px', display: 'inline-block', maxWidth: '100%' }}>
                <Link to={`/member/${c.authorId}`} style={{ textDecoration: 'none', color: 'inherit' }}><strong style={{ fontSize: '13px' }}>{c.authorName}</strong></Link>
                {editingComment?.path && JSON.stringify(editingComment.path) === JSON.stringify(currentPath) ? (
                  <div style={{ marginTop: '4px' }}>
                    <textarea value={editingComment.text} onChange={e => setEditingComment({...editingComment, text: e.target.value})} style={{ width: '100%', minHeight: '40px', padding: '6px', border: '1px solid #1d4ed8', borderRadius: '4px', fontSize: '13px' }} />
                    <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                      <button onClick={() => handleSaveEditComment(post)} className="scicomm-btn-primary" style={{ padding: '2px 8px', fontSize: '11px' }}>Save</button>
                      <button onClick={() => setEditingComment(null)} className="scicomm-btn-secondary" style={{ padding: '2px 8px', fontSize: '11px' }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <p style={{ margin: '2px 0 0', fontSize: '13px', whiteSpace: 'pre-wrap' }}>{renderPostText(c.text)}</p>
                )}
                {c.imageUrl && <img src={c.imageUrl} alt="" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '6px', marginTop: '6px' }} />}
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px', paddingLeft: '4px' }}>
                <span style={{ fontSize: '11px', color: '#64748b' }}>{timeAgo(c.createdAt)}</span>
                {['like', 'love', 'fire'].map(rk => {
                  const rd = REACTIONS.find(r => r.key === rk);
                  const isActive = myReaction === rk;
                  return (
                    <button key={rk} onClick={() => handleReactionOnComment(post, currentPath, rk)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: isActive ? 700 : 500, color: isActive ? rd.color : '#64748b', display: 'flex', alignItems: 'center', gap: '2px' }}>
                      {rd.emoji} {(cReactions[rk]?.length || 0) > 0 && <span>{cReactions[rk].length}</span>}
                    </button>
                  );
                })}
                <button onClick={() => setReplyTo(isReplying ? null : { postId: post.id, path: currentPath, authorName: c.authorName })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 600, color: isReplying ? '#1d4ed8' : '#64748b' }}>Reply</button>
                
                <div style={{ position: 'relative' }}>
                  <button onClick={() => setActiveCommentMenu(activeCommentMenu === `${currentPath.join('_')}` ? null : `${currentPath.join('_')}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><MoreHorizontal size={14} /></button>
                  {activeCommentMenu === `${currentPath.join('_')}` && (
                    <div style={{ position: 'absolute', left: '100%', top: 0, background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '4px 0', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 60, minWidth: '100px', marginLeft: '4px' }}>
                      {String(c.authorId) === String(user.id) && <button onClick={() => { setEditingComment({ path: currentPath, text: c.text }); setActiveCommentMenu(null); }} style={{ display: 'block', width: '100%', padding: '6px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '12px', textAlign: 'left' }}>Edit</button>}
                      {(String(c.authorId) === String(user.id) || isAdmin) && <button onClick={() => handleDeleteComment(post, currentPath)} style={{ display: 'block', width: '100%', padding: '6px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '12px', textAlign: 'left', color: '#ef4444' }}>Delete</button>}
                    </div>
                  )}
                </div>
              </div>
              
              {c.replies?.length > 0 && <CommentNode post={post} comments={c.replies} path={currentPath} />}
              
              {isReplying && (
                <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <textarea placeholder={`Reply to ${c.authorName}...`} value={commentText[replyKey] || ''} onChange={e => setCommentText({...commentText, [replyKey]: e.target.value})} style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: '16px', padding: '6px 12px', fontSize: '12px', outline: 'none', resize: 'none' }} rows={1} autoFocus />
                  <button className="scicomm-btn-primary" style={{ padding: '4px 12px', fontSize: '11px', borderRadius: '16px' }} onClick={() => handleAddComment(post)}>Reply</button>
                  <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={16} /></button>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Link to={`/member/${post.authorId}`} style={{ textDecoration: 'none', color: 'inherit' }}><h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>{post.authorName}</h4></Link>
                {author?.role === 'master' && <span style={{ background: '#f59e0b', color: 'white', padding: '1px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: 700 }}>👑 Master</span>}
              </div>
              <div style={{ color: '#64748b', fontSize: '13px' }}>{author?.department || 'Member'}</div>
              <div style={{ color: '#94a3b8', fontSize: '12px' }}>{timeAgo(post.createdAt)} • 🌐{post.recognized && ' ⭐ Master Recognized'}</div>
            </div>
            {(isAdmin || String(post.authorId) === String(user.id)) && (
              <div style={{ position: 'relative' }}>
                <button onClick={() => setActiveReactionPicker(activeReactionPicker === 'menu' ? null : 'menu')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><MoreHorizontal size={20} /></button>
                {activeReactionPicker === 'menu' && (
                  <div style={{ position: 'absolute', right: 0, top: '100%', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '8px 0', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 100, minWidth: '160px' }}>
                    <button onClick={() => handleDeletePost(post.id)} style={{ display: 'block', width: '100%', padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', textAlign: 'left', color: '#ef4444', fontWeight: 600 }}>🗑️ Delete Post</button>
                  </div>
                )}
              </div>
            )}
          </div>

          <p style={{ fontSize: '16px', lineHeight: '1.6', whiteSpace: 'pre-wrap', margin: '0 0 16px', unicodeBidi: 'plaintext', direction: /[\u0600-\u06FF]/.test(post.content || '') ? 'rtl' : 'ltr', textAlign: /[\u0600-\u06FF]/.test(post.content || '') ? 'right' : 'left' }}>{renderPostText(post.content)}</p>

          {post.imageUrl && <img src={post.imageUrl} alt="" style={{ width: '100%', borderRadius: '12px', marginBottom: '16px', maxHeight: '600px', objectFit: 'cover' }} />}
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
              <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', background: 'white', borderRadius: '30px', padding: '6px 12px', display: 'flex', gap: '10px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)', border: '1px solid #e2e8f0', zIndex: 100 }}>
                {REACTIONS.map(r => (
                  <button key={r.key} onClick={() => handleReaction(post, r.key)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>{r.emoji}</button>
                ))}
              </div>
            )}
          </div>
          <button className="scicomm-post-btn" style={{ flex: 1 }}><MessageSquare size={18} /> Comment</button>
          <button className="scicomm-post-btn" style={{ flex: 1 }}><Share2 size={18} /> Share</button>
        </div>

        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '0 0 16px 16px' }}>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            {renderAvatar(getAuthor(user.id), 36)}
            <div style={{ flex: 1, position: 'relative' }}>
              <textarea placeholder="Write a comment..." value={commentText[post.id] || ''} onChange={e => setCommentText({...commentText, [post.id]: e.target.value})} style={{ width: '100%', padding: '10px 16px', borderRadius: '20px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '14px', resize: 'none' }} rows={1} />
              <button onClick={() => handleAddComment(post)} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#1d4ed8', cursor: 'pointer' }}><Send size={18} /></button>
            </div>
          </div>

          <CommentNode post={post} comments={post.comments || []} path={[]} />
        </div>
      </div>
    </div>
  );
}
