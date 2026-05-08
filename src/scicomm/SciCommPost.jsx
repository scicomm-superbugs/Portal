import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, useLiveCollection, uploadFile } from '../db';
import { Image, Video, FileText, Send, ArrowLeft, UserCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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

      await db.scicomm_posts.add(postData);
      navigate('/');
    } catch (err) {
      setPostError('Failed to post: ' + err.message);
    }
    setIsPostingMedia(false);
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', background: 'white', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #ced0d4' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
            <ArrowLeft size={24} color="#050505" />
          </button>
          <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 600, color: '#050505' }}>Create post</h2>
        </div>
        <button
          onClick={handlePostSubmit}
          disabled={isPostingMedia || (!newPost.trim() && !postImage && !postVideo && !postFile && !(showArticle && articleTitle.trim()) && !(showPoll && pollQuestion.trim()))}
          style={{ 
            padding: '6px 16px', borderRadius: '4px', fontSize: '14px', fontWeight: 600, border: 'none', cursor: 'pointer',
            background: (!newPost.trim() && !postImage && !postVideo && !postFile && !(showArticle && articleTitle.trim()) && !(showPoll && pollQuestion.trim())) ? '#e4e6eb' : '#1b74e4', 
            color: (!newPost.trim() && !postImage && !postVideo && !postFile && !(showArticle && articleTitle.trim()) && !(showPoll && pollQuestion.trim())) ? '#bcc0c4' : 'white'
          }}
        >
          {isPostingMedia ? 'Posting...' : 'Post'}
        </button>
      </div>

      <div style={{ padding: '16px', flex: 1 }}>
        {/* User Info & Privacy */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          {renderAvatar(currentUserData, 44)}
          <div>
            <div style={{ fontWeight: 600, fontSize: '15px', color: '#050505' }}>{user.name}</div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#e4e6eb', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: '#050505' }}>🌎 Public ▼</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#e4e6eb', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: '#050505' }}>✨ AI label off ▼</span>
            </div>
          </div>
        </div>

        {/* Textarea */}
        <textarea
          placeholder="What's on your mind?"
          value={newPost}
          onChange={e => setNewPost(e.target.value)}
          style={{
            width: '100%', minHeight: '120px', border: 'none', outline: 'none',
            fontSize: '22px', lineHeight: '1.3', resize: 'vertical',
            boxSizing: 'border-box', fontFamily: 'inherit', color: '#050505'
          }}
          autoFocus
        />

        {postError && <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '8px', padding: '6px 10px', background: '#fee2e2', borderRadius: '8px' }}>{postError}</div>}

        {/* Media Preview */}
        {postImage && <div style={{ marginBottom: '8px', position: 'relative' }}><img src={URL.createObjectURL(postImage)} alt="" style={{ maxHeight: '200px', borderRadius: '8px', width: '100%', objectFit: 'cover' }} /><button onClick={() => setPostImage(null)} style={{ position: 'absolute', top: 4, right: 4, background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', fontSize: '16px' }}>×</button></div>}
        {postVideo && <div style={{ marginBottom: '8px', position: 'relative' }}><video src={URL.createObjectURL(postVideo)} style={{ maxHeight: '200px', borderRadius: '8px', width: '100%' }} controls /><button onClick={() => setPostVideo(null)} style={{ position: 'absolute', top: 4, right: 4, background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', fontSize: '16px' }}>×</button></div>}
        {postFile && <div style={{ marginBottom: '8px', padding: '10px', background: '#eef3f8', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>📎 {postFile.name}<button onClick={() => setPostFile(null)} style={{ position: 'absolute', top: 6, right: 6, background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', fontSize: '12px' }}>×</button></div>}

        {/* Article Title */}
        {showArticle && (
          <div style={{ marginBottom: '12px', borderLeft: '3px solid #e7a33e', paddingLeft: '12px' }}>
            <input type="text" placeholder="Article Title (Optional)..." value={articleTitle} onChange={e => setArticleTitle(e.target.value)} style={{ width: '100%', padding: '4px 0', border: 'none', fontSize: '16px', fontWeight: 600, outline: 'none', boxSizing: 'border-box', color: '#050505', background: 'transparent' }} />
          </div>
        )}

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

      {/* Options List */}
      <div style={{ borderTop: '1px solid #ced0d4', background: 'white' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderBottom: '1px solid #e4e6eb', cursor: 'pointer' }}>
          <Image size={24} color="#45bd62" /> <span style={{ fontSize: '16px', color: '#050505', fontWeight: 500 }}>Photo/video</span>
          <input type="file" accept="image/*,video/*" onChange={e => { const f = e.target.files[0]; if(f && f.type.startsWith('video')) setPostVideo(f); else if (f) setPostImage(f); }} style={{ display: 'none' }} />
        </label>
        
        <div onClick={() => setShowArticle(!showArticle)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderBottom: '1px solid #e4e6eb', cursor: 'pointer' }}>
          <FileText size={24} color="#1877f2" /> <span style={{ fontSize: '16px', color: '#050505', fontWeight: 500 }}>Write Article</span>
        </div>

        <div onClick={() => setShowPoll(!showPoll)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderBottom: '1px solid #e4e6eb', cursor: 'pointer' }}>
          <span style={{ fontSize: '24px', lineHeight: 1 }}>📊</span> <span style={{ fontSize: '16px', color: '#050505', fontWeight: 500 }}>Create Poll</span>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderBottom: '1px solid #e4e6eb', cursor: 'pointer' }}>
          <span style={{ fontSize: '24px', lineHeight: 1 }}>📎</span> <span style={{ fontSize: '16px', color: '#050505', fontWeight: 500 }}>Attach File</span>
          <input type="file" onChange={e => setPostFile(e.target.files[0])} style={{ display: 'none' }} />
        </label>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderBottom: '1px solid #e4e6eb', cursor: 'pointer' }}>
          <span style={{ fontSize: '24px', lineHeight: 1 }}>😀</span> <span style={{ fontSize: '16px', color: '#050505', fontWeight: 500 }}>Feeling/activity</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', cursor: 'pointer' }}>
          <span style={{ fontSize: '24px', lineHeight: 1 }}>📍</span> <span style={{ fontSize: '16px', color: '#050505', fontWeight: 500 }}>Check in</span>
        </div>
      </div>
    </div>
  );
}
