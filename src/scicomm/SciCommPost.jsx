import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, useLiveCollection, uploadFile } from '../db';
import { Image, Video, FileText, Send, ArrowLeft, UserCircle } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { AVATARS, isSpamPost } from './scicommConstants';

export default function SciCommPost() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const scientists = useLiveCollection('scientists') || [];
  const postsRaw = useLiveCollection('scicomm_posts') || [];
  const currentUserData = scientists.find(s => String(s.id) === String(user.id));

  const [newPost, setNewPost] = useState('');
  const [postImage, setPostImage] = useState(null);
  const [postVideo, setPostVideo] = useState(null);
  const [postFile, setPostFile] = useState(null);
  const [showArticle, setShowArticle] = useState(false);
  const [articleTitle, setArticleTitle] = useState('');
  const [showPoll, setShowPoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState([{id:1, text:''}, {id:2, text:''}]);
  const [isPostingMedia, setIsPostingMedia] = useState(false);
  const [postError, setPostError] = useState('');

  // Mentions logic
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentions, setShowMentions] = useState(false);

  const mentionSuggestions = scientists.filter(s => 
    !mentionQuery || 
    s.name.toLowerCase().includes(mentionQuery.toLowerCase()) || 
    (s.username || '').toLowerCase().includes(mentionQuery.toLowerCase())
  ).slice(0, 5);

  const handleInputChange = (val) => {
    setNewPost(val);
    const atIdx = val.lastIndexOf('@');
    if (atIdx >= 0) {
      const afterAt = val.slice(atIdx + 1);
      if (!afterAt.includes(' ')) {
        setMentionQuery(afterAt);
        setShowMentions(true);
        return;
      }
    }
    setShowMentions(false);
  };

  const insertMention = (person) => {
    const atIdx = newPost.lastIndexOf('@');
    const prefix = newPost.slice(0, atIdx);
    const username = person.username || person.name.replace(/\s+/g, '');
    setNewPost(prefix + '@' + username + ' ');
    setShowMentions(false);
  };

  const renderAvatar = (person, size = 44) => {
    if (person?.avatar) return <img src={person.avatar} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />;
    const av = AVATARS.find(a => a.id === person?.avatarId);
    if (av) return <div style={{ width: size, height: size, borderRadius: '50%', background: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.45 }}>{av.svg}</div>;
    return <UserCircle size={size} />;
  };

  const handlePostSubmit = async (e) => {
    if (e) e.preventDefault();
    const content = newPost.trim();
    if (!content && !postImage && !postVideo && !postFile && !(showArticle && articleTitle.trim()) && !(showPoll && pollQuestion.trim())) return;

    const myRecentPosts = postsRaw.filter(p => String(p.authorId) === String(user.id)).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (content && isSpamPost(content, myRecentPosts)) {
      setPostError('⚠️ Please write more meaningful content (min 10 chars, no duplicates).');
      setTimeout(() => setPostError(''), 4000);
      return;
    }

    setIsPostingMedia(true);
    setPostError('');
    try {
      let imageUrl = null, videoUrl = null, fileUrl = null, fileName = null;
      if (postImage) imageUrl = await uploadFile(postImage, `posts/${user.id}_${Date.now()}_${postImage.name}`);
      if (postVideo) videoUrl = await uploadFile(postVideo, `posts/${user.id}_${Date.now()}_${postVideo.name}`);
      if (postFile) {
        fileUrl = await uploadFile(postFile, `posts/${user.id}_${Date.now()}_${postFile.name}`);
        fileName = postFile.name;
      }

      const postData = {
        content,
        authorId: user.id,
        authorName: user.name,
        createdAt: new Date().toISOString(),
        reactions: {},
        comments: [],
        ...(imageUrl ? { imageUrl } : {}),
        ...(videoUrl ? { videoUrl } : {}),
        ...(fileUrl ? { fileUrl, fileName } : {}),
        ...(showArticle && articleTitle.trim() ? { articleTitle: articleTitle.trim() } : {}),
      };

      if (showPoll && pollQuestion.trim() && pollOptions.filter(o => o.text.trim()).length >= 2) {
        postData.poll = {
          question: pollQuestion.trim(),
          options: pollOptions.filter(o => o.text.trim()).map(o => ({ id: o.id, text: o.text.trim() })),
          votes: {}
        };
      }

      const newPostId = await db.scicomm_posts.add(postData);
      
      // Mentions Notification
      const mentions = content.match(/@\w+/g) || [];
      mentions.forEach(mention => {
        const username = mention.slice(1).toLowerCase();
        const userMatch = scientists.find(s => (s.username || '').toLowerCase() === username || s.name.replace(/\s+/g, '').toLowerCase() === username);
        if (userMatch && String(userMatch.id) !== String(user.id)) {
          db.scicomm_notifications.add({
            userId: userMatch.id, type: 'mention',
            senderId: user.id,
            title: `${user.name} mentioned you in a post`,
            message: content.substring(0, 50) + '...',
            link: `/view-post/${newPostId}`, createdAt: new Date().toISOString(), read: false
          }).catch(() => {});
        }
      });

      navigate('/');
    } catch (err) {
      setPostError('Failed to post: ' + err.message);
    }
    setIsPostingMedia(false);
  };  return (
    <div className="scicomm-create-post-container">
      {/* Header */}
      <div className="scicomm-create-post-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
            <ArrowLeft size={24} className="icon" />
          </button>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Create Post</h2>
        </div>
        <button
          onClick={handlePostSubmit}
          disabled={isPostingMedia || (!newPost.trim() && !postImage && !postVideo && !postFile && !(showPoll && pollQuestion.trim()))}
          className="scicomm-create-post-submit"
        >
          {isPostingMedia ? 'Posting...' : 'Post'}
        </button>
      </div>

      <div className="scicomm-create-post-body">
        {/* User Info & Privacy */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          {renderAvatar(currentUserData, 44)}
          <div>
            <div className="scicomm-username">{user.name}</div>
          </div>
        </div>

        {/* Mention Dropdown */}
        {showMentions && mentionSuggestions.length > 0 && (
          <div style={{ position: 'absolute', top: '140px', left: '20px', right: '20px', background: 'white', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)', border: '1px solid #e2e8f0', zIndex: 100, maxHeight: '200px', overflowY: 'auto' }}>
            {mentionSuggestions.map(s => (
              <div key={s.id} onClick={() => insertMention(s)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }} onMouseOver={e => e.currentTarget.style.background='#f8fafc'} onMouseOut={e => e.currentTarget.style.background='white'}>
                {renderAvatar(s, 32)}
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>{s.name}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>@{s.username || s.name.replace(/\s+/g, '')}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Textarea */}
        <textarea dir="auto"
          placeholder="What's on your mind? (type @ to mention someone)"
          value={newPost}
          onChange={e => handleInputChange(e.target.value)}
          style={{
            width: '100%', minHeight: '120px', border: 'none', outline: 'none',
            fontSize: '18px', lineHeight: '1.3', resize: 'vertical',
            boxSizing: 'border-box', fontFamily: 'inherit'
          }}
          autoFocus
        />

        {postError && <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '8px', padding: '6px 10px', background: '#fee2e2', borderRadius: '8px' }}>{postError}</div>}

        {/* Media Preview */}
        {postImage && <div style={{ marginBottom: '8px', position: 'relative' }}><img src={URL.createObjectURL(postImage)} alt="" style={{ maxHeight: '200px', borderRadius: '8px', width: '100%', objectFit: 'cover' }} /><button onClick={() => setPostImage(null)} style={{ position: 'absolute', top: 4, right: 4, background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', fontSize: '16px' }}>×</button></div>}
        {postVideo && <div style={{ marginBottom: '8px', position: 'relative' }}><video src={URL.createObjectURL(postVideo)} style={{ maxHeight: '200px', borderRadius: '8px', width: '100%' }} controls /><button onClick={() => setPostVideo(null)} style={{ position: 'absolute', top: 4, right: 4, background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', fontSize: '16px' }}>×</button></div>}
        {postFile && <div style={{ marginBottom: '8px', padding: '10px', background: '#eef3f8', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>📎 {postFile.name}<button onClick={() => setPostFile(null)} style={{ position: 'absolute', top: 6, right: 6, background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', fontSize: '12px' }}>×</button></div>}



        {/* Poll Builder */}
        {showPoll && (
          <div style={{ marginBottom: '12px', border: '1px solid #ced0d4', borderRadius: '8px', padding: '12px' }}>
            <input type="text" placeholder="Ask a question..." value={pollQuestion} onChange={e => setPollQuestion(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #ced0d4', borderRadius: '4px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', marginBottom: '8px' }} />
            {pollOptions.map((opt, i) => (
              <div key={opt.id} style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                <input type="text" placeholder={`Option ${i+1}`} value={opt.text} onChange={e => {
                  const newOpts = [...pollOptions];
                  newOpts[i].text = e.target.value;
                  setPollOptions(newOpts);
                }} style={{ flex: 1, padding: '8px 10px', border: '1px solid #ced0d4', borderRadius: '4px', fontSize: '14px', outline: 'none' }} />
                {pollOptions.length > 2 && <button onClick={() => setPollOptions(pollOptions.filter(o => o.id !== opt.id))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '18px' }}>×</button>}
              </div>
            ))}
            {pollOptions.length < 5 && <button onClick={() => setPollOptions([...pollOptions, {id: Date.now(), text: ''}])} style={{ background: 'none', border: 'none', color: '#1b74e4', cursor: 'pointer', fontSize: '14px', fontWeight: 600, marginTop: '4px' }}>+ Add Option</button>}
          </div>
        )}
      </div>

        {/* Futuristic Options Panel */}
        <div className="scicomm-create-post-options">
          <label className="scicomm-create-post-card">
            <div style={{ width: '40px', height: '40px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Image size={24} color="#10b981" />
            </div>
            <span>Media</span>
            <input type="file" accept="image/*,video/*" onChange={e => { const f = e.target.files[0]; if(f && f.type.startsWith('video')) setPostVideo(f); else if (f) setPostImage(f); }} style={{ display: 'none' }} />
          </label>
          
          <div onClick={() => setShowPoll(!showPoll)} className="scicomm-create-post-card">
            <div style={{ width: '40px', height: '40px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '20px', lineHeight: 1 }}>📊</span>
            </div>
            <span>Poll</span>
          </div>

          <label className="scicomm-create-post-card">
            <div style={{ width: '40px', height: '40px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '20px', lineHeight: 1 }}>📎</span>
            </div>
            <span>File</span>
            <input type="file" onChange={e => setPostFile(e.target.files[0])} style={{ display: 'none' }} />
          </label>
        </div>
    </div>
  );
}
