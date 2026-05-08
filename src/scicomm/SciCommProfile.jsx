import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { db, useLiveCollection, uploadFile } from '../db';
import bcrypt from 'bcryptjs';
import { Camera, Edit2, Award, Pin, AlertTriangle, UserCircle, X, Settings, Briefcase, FileText, CheckCircle, GraduationCap, Upload, Lock } from 'lucide-react';
import { AVATARS, AUTO_TAGS, calculateScore, getUnlockedTags, timeAgo, getUserLevel } from './scicommConstants';

export default function SciCommProfile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const scientists = useLiveCollection('scientists') || [];
  const me = scientists.find(s => String(s.id) === String(user.id));
  const postsData = useLiveCollection('scicomm_posts') || [];
  const tasksData = useLiveCollection('tasks') || [];
  const warningsData = useLiveCollection('scicomm_warnings') || [];
  const connectionsData = useLiveCollection('scicomm_connections') || [];
  const meetingsData = useLiveCollection('scicomm_meetings') || [];

  const [activeTab, setActiveTab] = useState('overview'); // overview | portfolio | settings
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showWarnings, setShowWarnings] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [appealText, setAppealText] = useState('');
  const [appealTarget, setAppealTarget] = useState(null);
  
  // Settings Form
  const [settingsForm, setSettingsForm] = useState({ name: '', bio: '', department: '', email: '', privacyProfile: 'public', privacyNetwork: 'public', notificationsEmail: true });
  const [msg, setMsg] = useState('');
  const [passwordForm, setPasswordForm] = useState({ current: '', newPass: '', confirm: '' });
  const [passwordMsg, setPasswordMsg] = useState('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isUploadingCV, setIsUploadingCV] = useState(false);

  // Portfolio Form
  const [portfolioData, setPortfolioData] = useState({ 
    cvLink: '', 
    certifications: [], 
    courses: [], 
    speaking: [], 
    projects: [] 
  });
  const [newItem, setNewItem] = useState({ type: '', title: '', date: '', link: '' });

  useEffect(() => { 
    if (me) {
      setSettingsForm({ 
        name: me.name || user.name, 
        bio: me.bio || '', 
        department: me.department || '', 
        email: me.email || '',
        privacyProfile: me.privacyProfile || 'public',
        privacyNetwork: me.privacyNetwork || 'public',
        notificationsEmail: me.notificationsEmail ?? true
      });
      setPortfolioData({
        cvLink: me.cvLink || '',
        certifications: me.certifications || [],
        courses: me.courses || [],
        speaking: me.speaking || [],
        projects: me.projects || []
      });
    }
  }, [me?.id]);

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  try {
  // Score calculation
  const myPosts = postsData.filter(p => String(p.authorId) === String(user.id));
  const myLikesReceived = myPosts.reduce((acc, p) => {
    const reactions = p.reactions || {};
    const count = Object.values(reactions).reduce((sum, users) => sum + (users?.length || 0), 0);
    return acc + count;
  }, 0);
  const myTaskPoints = tasksData.filter(t => String(t.assignedTo) === String(user.id) && (t.status === 'Completed' || t.status === 'Approved')).reduce((s, t) => s + (t.awardedPoints || 0), 0);
  const myCompletedTasks = tasksData.filter(t => String(t.assignedTo) === String(user.id) && (t.status === 'Completed' || t.status === 'Approved')).length;
  const myAttended = meetingsData.filter(m => (m.attendees || []).includes(user.id)).length;
  const myScore = calculateScore({ taskPoints: myTaskPoints, meetingsAttended: myAttended, role: user.role });
  const myLevel = getUserLevel(myScore);
  const unlockedTags = getUnlockedTags(myScore);
  const pinnedTags = (me?.pinnedTags || []).filter(t => AUTO_TAGS.some(a => a.tag === t) || t === '👑 SciComm MasterMind');
  const pinnedPosts = me?.pinnedPosts || [];
  const myConnections = connectionsData.filter(c => c.status === 'accepted' && (String(c.fromId) === String(user.id) || String(c.toId) === String(user.id))).length;

  // Warnings
  const activeWarnings = warningsData.filter(w => String(w.userId) === String(user.id) && w.status !== 'removed');
  const isSuspended = activeWarnings.length >= 3;

  // Portfolio Readiness Calculation
  const calculateReadiness = () => {
    let score = 0;
    if (portfolioData.cvLink) score += 20;
    if (portfolioData.certifications.length > 0) score += 20;
    if (portfolioData.courses.length > 0) score += 20;
    if (portfolioData.speaking.length > 0) score += 20;
    if (portfolioData.projects.length > 0) score += 20;
    return score;
  };

  const renderAvatar = (size = 120) => {
    if (me?.avatar) return <img src={me.avatar} alt="" style={{ width: size, height: size, borderRadius: '50%', border: '4px solid white', objectFit: 'cover' }} />;
    const av = AVATARS.find(a => a.id === me?.avatarId);
    if (av) return <div style={{ width: size, height: size, borderRadius: '50%', border: '4px solid white', background: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.45 }}>{av.svg}</div>;
    return <div style={{ width: size, height: size, borderRadius: '50%', border: '4px solid white', background: '#eef3f8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><UserCircle size={size * 0.5} color="#666" /></div>;
  };

  const handleAvatarSelect = async (avatarId) => {
    await db.scientists.update(user.id, { avatarId, avatar: null });
    setShowAvatarPicker(false);
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingPhoto(true);
    try {
      const url = await uploadFile(file, `avatars/${user.id}_${Date.now()}`);
      await db.scientists.update(user.id, { avatar: url, avatarId: null });
    } catch (err) { alert('Upload failed: ' + err.message); }
    setIsUploadingPhoto(false);
    setShowAvatarPicker(false);
  };

  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingCover(true);
    try {
      const url = await uploadFile(file, `covers/${user.id}_${Date.now()}`);
      await db.scientists.update(user.id, { coverPhoto: url });
      flash('Cover photo updated!');
    } catch (err) { alert('Upload failed: ' + err.message); }
    setIsUploadingCover(false);
  };

  const handleCVUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingCV(true);
    try {
      const url = await uploadFile(file, `cvs/${user.id}_${Date.now()}_${file.name}`);
      await db.scientists.update(user.id, { cvFileUrl: url, cvFileName: file.name });
      setPortfolioData(prev => ({ ...prev, cvLink: url }));
      flash('CV uploaded successfully!');
    } catch (err) { alert('Upload failed: ' + err.message); }
    setIsUploadingCV(false);
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordMsg('');
    if (passwordForm.newPass !== passwordForm.confirm) { setPasswordMsg('❌ Passwords do not match'); return; }
    if (passwordForm.newPass.length < 4) { setPasswordMsg('❌ Password too short (min 4)'); return; }
    try {
      const valid = await bcrypt.compare(passwordForm.current, me?.passwordHash || '');
      if (!valid) { setPasswordMsg('❌ Current password is incorrect'); return; }
      const salt = await bcrypt.genSalt(4);
      const hash = await bcrypt.hash(passwordForm.newPass, salt);
      await db.scientists.update(user.id, { passwordHash: hash });
      setPasswordMsg('✅ Password changed successfully!');
      setPasswordForm({ current: '', newPass: '', confirm: '' });
    } catch (err) { setPasswordMsg('❌ Error: ' + err.message); }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    await db.scientists.update(user.id, settingsForm);
    flash('Settings updated successfully!');
  };

  const handleSavePortfolio = async (e) => {
    e.preventDefault();
    await db.scientists.update(user.id, portfolioData);
    flash('Portfolio updated successfully!');
  };

  const handleAddPortfolioItem = () => {
    if (!newItem.type || !newItem.title) return;
    const type = newItem.type;
    const updatedList = [...portfolioData[type], { title: newItem.title, date: newItem.date, link: newItem.link, id: Date.now() }];
    setPortfolioData(prev => ({ ...prev, [type]: updatedList }));
    setNewItem({ type: '', title: '', date: '', link: '' });
  };

  const handleRemovePortfolioItem = (type, id) => {
    const updatedList = portfolioData[type].filter(item => item.id !== id);
    setPortfolioData(prev => ({ ...prev, [type]: updatedList }));
  };

  const handlePinTag = async (tag) => {
    let newPinned = [...pinnedTags];
    if (newPinned.includes(tag)) newPinned = newPinned.filter(t => t !== tag);
    else if (user.role === 'master' || newPinned.length < 5) newPinned.push(tag);
    else { alert('Max 5 pinned tags!'); return; }
    await db.scientists.update(user.id, { pinnedTags: newPinned });
  };

  const handlePinPost = async (postId) => {
    let newPinned = [...pinnedPosts];
    if (newPinned.includes(postId)) newPinned = newPinned.filter(id => id !== postId);
    else if (newPinned.length < 5) newPinned.push(postId);
    else { alert('Max 5 pinned posts!'); return; }
    await db.scientists.update(user.id, { pinnedPosts: newPinned });
  };

  const handleAppeal = async (warningId) => {
    if (!appealText.trim()) return;
    await db.scicomm_warnings.update(warningId, { appeal: appealText, appealDate: new Date().toISOString(), appealStatus: 'pending' });
    setAppealText('');
    setAppealTarget(null);
  };

  // Suspension countdown
  const suspensionEnd = isSuspended ? (() => {
    const latest = activeWarnings.sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime())[0];
    return new Date(new Date(latest.issuedAt).getTime() + 365 * 24 * 60 * 60 * 1000);
  })() : null;

  if (!me) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px', animation: 'spin 1s linear infinite' }}>🔬</div>
        <p style={{ color: '#64748b', fontSize: '14px' }}>Loading profile...</p>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '40px' }}>
      {msg && <div style={{ background: '#fef3c7', color: '#92400e', padding: '12px 16px', borderRadius: '8px', marginBottom: '12px', fontSize: '14px', fontWeight: 600 }}>✅ {msg}</div>}

      {/* Suspension Banner */}
      {isSuspended && (
        <div style={{ background: 'linear-gradient(135deg, #dc2626, #991b1b)', color: 'white', padding: '16px 20px', borderRadius: '8px', marginBottom: '8px', textAlign: 'center' }}>
          <AlertTriangle size={24} style={{ marginBottom: '8px' }} />
          <h3 style={{ margin: '0 0 4px' }}>⛔ Account Suspended</h3>
          <p style={{ margin: 0, fontSize: '14px' }}>You have 3 active warnings. Task assignments and leaderboard participation are disabled.</p>
          {suspensionEnd && <p style={{ margin: '8px 0 0', fontSize: '12px' }}>Suspension until: {suspensionEnd.toLocaleDateString()}</p>}
        </div>
      )}

      {/* Profile Header */}
      <div className="scicomm-card" style={{ overflow: 'hidden' }}>
        <div style={{ width: '100%', aspectRatio: '4 / 1', background: me?.coverPhoto ? `url(${me.coverPhoto}) center/cover` : 'linear-gradient(135deg, #1d4ed8 0%, #0f172a 50%, #020617 100%)', position: 'relative' }}>
          <label style={{ position: 'absolute', bottom: 10, right: 10, background: 'rgba(0,0,0,0.5)', color: 'white', borderRadius: '20px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Camera size={14} /> {isUploadingCover ? 'Uploading...' : 'Edit Cover'}
            <input type="file" accept="image/*" onChange={handleCoverUpload} style={{ display: 'none' }} />
          </label>
        </div>
        <div style={{ padding: '0 24px 24px' }}>
          <div style={{ position: 'relative', width: '120px', marginTop: '-60px', marginBottom: '12px' }}>
            {renderAvatar(120)}
            <button onClick={() => setShowAvatarPicker(true)} style={{ position: 'absolute', bottom: '6px', right: '6px', background: '#fff', borderRadius: '50%', padding: '6px', cursor: 'pointer', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
              <Camera size={16} color="#333" />
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <h1 style={{ margin: '0', fontSize: '26px', fontWeight: 800, color: '#0f172a' }}>
                  {me?.name || user.name}
                  {user.role === 'master' && <span title="SciComm Master" style={{ marginLeft: '8px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', fontSize: '11px', padding: '3px 8px', borderRadius: '12px', fontWeight: 700, verticalAlign: 'middle', boxShadow: '0 2px 6px rgba(245,158,11,0.4)' }}>👑 Master</span>}
                  {user.role === 'admin' && <span title="Platform Admin" style={{ marginLeft: '8px', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: 'white', fontSize: '11px', padding: '3px 8px', borderRadius: '12px', fontWeight: 700, verticalAlign: 'middle', boxShadow: '0 2px 6px rgba(59,130,246,0.4)' }}>🛡️ Admin</span>}
                  {user.role === 'scicomm' && <span title="SciComm Team" style={{ marginLeft: '8px', background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: 'white', fontSize: '11px', padding: '3px 8px', borderRadius: '12px', fontWeight: 700, verticalAlign: 'middle', boxShadow: '0 2px 6px rgba(239,68,68,0.4)' }}>🔬 SciComm</span>}
                </h1>
                <span style={{ background: myLevel.bg, color: myLevel.color, padding: '4px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 800, border: `1px solid ${myLevel.color}40`, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                  Lv. {myLevel.level}{myLevel.title ? ' ' + myLevel.title : ''}
                </span>
              </div>
              <p style={{ margin: '6px 0 16px', fontSize: '16px', fontWeight: 600, color: '#1d4ed8' }}>{me?.department || 'Science Communicator'}</p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => navigate('/member/' + user.id)} style={{ background: '#eef3f8', border: 'none', borderRadius: '24px', padding: '8px 16px', cursor: 'pointer', fontSize: '13px', fontWeight: 700, color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                <UserCircle size={16} /> Preview Profile
              </button>
              {user.role !== 'master' && (
                <button onClick={() => setShowWarnings(true)} style={{ background: activeWarnings.length > 0 ? '#fee2e2' : '#f1f5f9', border: 'none', borderRadius: '24px', padding: '8px 16px', cursor: 'pointer', fontSize: '13px', fontWeight: 700, color: activeWarnings.length > 0 ? '#991b1b' : '#64748b', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                  <AlertTriangle size={16} /> {activeWarnings.length}/3 Warnings
                </button>
              )}
            </div>
          </div>
              
          {/* Graphical Bio Block */}
          <div style={{ background: '#f8fafc', padding: '16px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
            <p style={{ margin: 0, fontSize: '15px', lineHeight: '1.7', color: '#334155' }}>{me?.bio || 'Passionate about science communication.'}</p>
          </div>

          {/* Pinned Tags inside Header */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '14px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pinned Tags</h3>
              <button onClick={() => setShowTagManager(true)} style={{ background: 'none', border: 'none', color: '#1d4ed8', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Manage</button>
            </div>
            {pinnedTags.length > 0 ? (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {pinnedTags.map((t, i) => {
                  const isMasterTag = t === '👑 SciComm MasterMind';
                  return <span key={i} style={{ background: isMasterTag ? 'linear-gradient(135deg, #fef3c7, #fde68a)' : 'linear-gradient(135deg, #eff6ff, #dbeafe)', color: isMasterTag ? '#b45309' : '#1e3a8a', padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 700, border: isMasterTag ? '1px solid #fde047' : '1px solid #bfdbfe', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>{t}</span>;
                })}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', fontStyle: 'italic' }}>No tags pinned yet. Click Manage to add some!</p>
            )}
          </div>

          {/* Graphical Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '12px', padding: '16px', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', marginBottom: '16px' }}>
            {[
              { label: 'Score', value: myScore === Infinity ? 'Infinity' : myScore, color: myScore === Infinity ? '#b45309' : '#1d4ed8', icon: '✨' },
              { label: 'Posts', value: myPosts.length, color: '#3b82f6', icon: '📝' },
              { label: 'Reactions', value: myLikesReceived, color: '#ef4444', icon: '❤️' },
              { label: 'Tasks Done', value: myCompletedTasks, color: '#f59e0b', icon: '✅' },
              { label: 'Connections', value: myConnections, color: '#8b5cf6', icon: '👥' },
              { label: 'Tags', value: unlockedTags.length, color: '#ec4899', icon: '🏷️' },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px' }}>
                <div style={{ fontSize: '20px', marginBottom: '4px' }}>{s.icon}</div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {myLevel.next && (
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>
                <span>{myScore} pts</span>
                <span>{myLevel.next.threshold} pts</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${myLevel.progress}%`, height: '100%', background: `linear-gradient(90deg, ${myLevel.color}, ${myLevel.next.color})`, borderRadius: '4px', transition: 'width 0.5s ease' }} />
              </div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginTop: '8px', textAlign: 'center' }}>
                Next Level: <span style={{ color: myLevel.next.color }}>{myLevel.next.title}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', background: 'white', padding: '8px', borderRadius: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        {[
          { id: 'overview', label: 'Overview', icon: <UserCircle size={18} /> },
          { id: 'portfolio', label: 'CV & Portfolio', icon: <Briefcase size={18} /> },
          { id: 'settings', label: 'Settings', icon: <Settings size={18} /> }
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            flex: 1, padding: '12px 16px', border: 'none', background: activeTab === t.id ? '#1d4ed8' : 'transparent',
            color: activeTab === t.id ? 'white' : '#64748b', fontWeight: 700, borderRadius: '12px', cursor: 'pointer', fontSize: '15px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s', boxShadow: activeTab === t.id ? '0 4px 12px rgba(29, 78, 216, 0.3)' : 'none'
          }}>{t.icon} {t.label}</button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <>

          <div className="scicomm-card scicomm-card-padding" style={{ marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h2 style={{ fontSize: '18px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><Award size={20} color="#1d4ed8" /> Tag Progression</h2>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>{unlockedTags.length}/{AUTO_TAGS.length} unlocked</span>
            </div>
            {(() => {
              const nextTag = AUTO_TAGS.find(t => t.threshold > myScore);
              if (!nextTag) return (
                <div style={{ padding: '12px', background: '#fef3c7', borderRadius: '8px', border: '1px solid #fde68a', color: '#b45309', fontWeight: 600, fontSize: '13px' }}>
                  🎉 You have unlocked all available Mystery Tags!
                </div>
              );
              const prevThreshold = AUTO_TAGS.filter(t => t.threshold <= myScore).pop()?.threshold || 0;
              const progress = Math.min(100, ((myScore - prevThreshold) / (nextTag.threshold - prevThreshold)) * 100);
              return (
                <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>🔒 Next Mystery Tag: {nextTag.threshold} pts needed</div>
                  <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, #1d4ed8, #1e3a8a)', borderRadius: '4px', transition: 'width 0.5s' }}></div>
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginTop: '6px', textAlign: 'right' }}>{myScore}/{nextTag.threshold} pts ({Math.round(progress)}%)</div>
                </div>
              );
            })()}
          </div>
          <div className="scicomm-card scicomm-card-padding">
            <h2 style={{ fontSize: '18px', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}><Pin size={20} color="#1d4ed8" /> Pinned Highlights (max 5)</h2>
            {myPosts.length === 0 ? <p style={{ color: '#666', fontSize: '14px' }}>No posts yet.</p> : (
              myPosts.slice(0, 10).map(p => {
                const isPinned = pinnedPosts.includes(p.id);
                return (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #eef3f8' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: '0 0 4px', fontSize: '14px' }}>{p.content.substring(0, 100)}{p.content.length > 100 ? '...' : ''}</p>
                      <div style={{ fontSize: '11px', color: 'rgba(0,0,0,0.4)' }}>👍 {Object.values(p.reactions || {}).reduce((s, a) => s + a.length, 0)} • 💬 {(p.comments || []).length} • {timeAgo(p.createdAt)}</div>
                    </div>
                    <button onClick={() => handlePinPost(p.id)} style={{ background: isPinned ? '#1d4ed8' : '#f3f2ef', color: isPinned ? 'white' : '#666', border: 'none', borderRadius: '16px', padding: '4px 12px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>
                      {isPinned ? '📌 Pinned' : 'Pin'}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* PORTFOLIO TAB */}
      {activeTab === 'portfolio' && (
        <div className="scicomm-card scicomm-card-padding">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '20px', margin: 0 }}>Professional Portfolio</h2>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#1d4ed8' }}>{calculateReadiness()}%</div>
              <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.5)' }}>Readiness Score</div>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div style={{ width: '100%', height: '8px', background: '#eef3f8', borderRadius: '4px', marginBottom: '24px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${calculateReadiness()}%`, background: 'linear-gradient(90deg, #fbbf24, #1d4ed8)', transition: 'width 0.5s' }}></div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '16px', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: '6px' }}><FileText size={16} color="#3b82f6" /> CV / Resume</h3>
            <div style={{ border: '2px dashed #ccc', padding: '20px', borderRadius: '8px', textAlign: 'center', cursor: 'pointer', background: '#f9fafb', marginBottom: '8px' }} onClick={() => document.getElementById('cv-upload-input').click()}>
              <Upload size={24} color="#666" style={{ marginBottom: '8px' }} />
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#333' }}>{isUploadingCV ? 'Uploading...' : (me?.cvFileName || 'Upload CV/Resume')}</div>
              <div style={{ fontSize: '12px', color: '#999' }}>PDF, DOC, DOCX</div>
              <input id="cv-upload-input" type="file" accept=".pdf,.doc,.docx" onChange={handleCVUpload} style={{ display: 'none' }} />
            </div>
            {(me?.cvFileUrl || portfolioData.cvLink) && (
              <a href={me?.cvFileUrl || portfolioData.cvLink} download={me?.cvFileName || "CV_Resume.pdf"} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'center', width: '100%', padding: '12px', background: 'linear-gradient(135deg, #1d4ed8, #1e3a8a)', color: 'white', borderRadius: '8px', fontWeight: 700, fontSize: '15px', boxShadow: '0 4px 12px rgba(29, 78, 216, 0.3)', transition: 'all 0.2s', boxSizing: 'border-box' }}>
                <FileText size={20} /> Download / View CV
              </a>
            )}
          </div>

          {/* Builder */}
          <div style={{ background: '#f9fafb', padding: '16px', borderRadius: '8px', marginBottom: '24px', border: '1px solid #eef3f8' }}>
            <h3 style={{ fontSize: '16px', margin: '0 0 12px' }}>Add to Portfolio</h3>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
              <select value={newItem.type} onChange={e => setNewItem({...newItem, type: e.target.value})} style={{ padding: '8px', border: '1px solid #e0dfdc', borderRadius: '8px', flex: 1, minWidth: '150px' }}>
                <option value="">Select Category...</option>
                <option value="certifications">Certifications</option>
                <option value="courses">Completed Courses</option>
                <option value="speaking">Public Speaking / Events</option>
                <option value="projects">Media / Content Projects</option>
              </select>
              <input type="date" value={newItem.date} onChange={e => setNewItem({...newItem, date: e.target.value})} style={{ padding: '8px', border: '1px solid #e0dfdc', borderRadius: '8px' }} />
            </div>
            <input type="text" placeholder="Title (e.g. Science Communication Workshop)" value={newItem.title} onChange={e => setNewItem({...newItem, title: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #e0dfdc', borderRadius: '8px', marginBottom: '8px', boxSizing: 'border-box' }} />
            <input type="url" placeholder="Link / Verification URL (optional)" value={newItem.link} onChange={e => setNewItem({...newItem, link: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #e0dfdc', borderRadius: '8px', marginBottom: '8px', boxSizing: 'border-box' }} />
            <button className="scicomm-btn-secondary" onClick={handleAddPortfolioItem} style={{ width: '100%', justifyContent: 'center' }}>+ Add Item</button>
          </div>

          {/* Lists */}
          {[
            { key: 'certifications', title: 'Certifications', icon: <Award size={16} /> },
            { key: 'courses', title: 'Completed Courses', icon: <GraduationCap size={16} /> },
            { key: 'speaking', title: 'Public Speaking', icon: <UserCircle size={16} /> },
            { key: 'projects', title: 'Projects', icon: <Briefcase size={16} /> }
          ].map(sec => (
            portfolioData[sec.key].length > 0 && (
              <div key={sec.key} style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '15px', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: '6px' }}>{sec.icon} {sec.title}</h4>
                {portfolioData[sec.key].map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'white', border: '1px solid #e0dfdc', borderRadius: '8px', marginBottom: '6px' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>{item.title}</div>
                      <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.5)' }}>{item.date ? new Date(item.date).toLocaleDateString() : 'No date'} {item.link && <span>• <a href={item.link} target="_blank" rel="noreferrer" style={{color:'#1d4ed8'}}>Link</a></span>}</div>
                    </div>
                    <button onClick={() => handleRemovePortfolioItem(sec.key, item.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={16}/></button>
                  </div>
                ))}
              </div>
            )
          ))}
          <button className="scicomm-btn-primary" onClick={handleSavePortfolio} style={{ width: '100%', justifyContent: 'center', marginTop: '12px' }}>Save All Portfolio Changes</button>
        </div>
      )}

      {/* SETTINGS TAB */}
      {activeTab === 'settings' && (
        <div className="scicomm-card scicomm-card-padding">
          <h2 style={{ fontSize: '20px', margin: '0 0 20px' }}>⚙️ Account Settings</h2>
          <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Full Name</label>
              <input type="text" value={settingsForm.name} onChange={e => setSettingsForm({ ...settingsForm, name: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '1px solid #e0dfdc', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Email Address</label>
              <input type="email" value={settingsForm.email} onChange={e => setSettingsForm({ ...settingsForm, email: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '1px solid #e0dfdc', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Role / Department</label>
              <input type="text" value={settingsForm.department} onChange={e => setSettingsForm({ ...settingsForm, department: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '1px solid #e0dfdc', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Bio / About</label>
              <textarea value={settingsForm.bio} onChange={e => setSettingsForm({ ...settingsForm, bio: e.target.value })} rows={3} style={{ width: '100%', padding: '10px 14px', border: '1px solid #e0dfdc', borderRadius: '8px', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>

            <div style={{ borderTop: '1px solid #eef3f8', paddingTop: '16px', marginTop: '8px' }}>
              <h3 style={{ fontSize: '16px', margin: '0 0 12px' }}>Privacy & Notifications</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={settingsForm.privacyProfile === 'public'} onChange={e => setSettingsForm({...settingsForm, privacyProfile: e.target.checked ? 'public' : 'private'})} />
                  Make profile public to university members
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={settingsForm.notificationsEmail} onChange={e => setSettingsForm({...settingsForm, notificationsEmail: e.target.checked})} />
                  Receive email summaries
                </label>
              </div>
            </div>

            <button type="submit" className="scicomm-btn-primary" style={{ padding: '12px', fontSize: '15px', justifyContent: 'center', marginTop: '12px' }}>Save Changes</button>
          </form>

          <div style={{ borderTop: '1px solid #eef3f8', paddingTop: '20px', marginTop: '20px' }}>
            <h3 style={{ fontSize: '16px', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '6px' }}><Lock size={16} /> Change Password</h3>
            {passwordMsg && <div style={{ padding: '8px 12px', borderRadius: '8px', marginBottom: '12px', fontSize: '13px', fontWeight: 600, background: passwordMsg.startsWith('✅') ? '#fef3c7' : '#fee2e2', color: passwordMsg.startsWith('✅') ? '#92400e' : '#991b1b' }}>{passwordMsg}</div>}
            <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input type="password" placeholder="Current Password" value={passwordForm.current} onChange={e => setPasswordForm({...passwordForm, current: e.target.value})} required style={{ padding: '10px 14px', border: '1px solid #e0dfdc', borderRadius: '8px', fontSize: '14px' }} />
              <input type="password" placeholder="New Password" value={passwordForm.newPass} onChange={e => setPasswordForm({...passwordForm, newPass: e.target.value})} required style={{ padding: '10px 14px', border: '1px solid #e0dfdc', borderRadius: '8px', fontSize: '14px' }} />
              <input type="password" placeholder="Confirm New Password" value={passwordForm.confirm} onChange={e => setPasswordForm({...passwordForm, confirm: e.target.value})} required style={{ padding: '10px 14px', border: '1px solid #e0dfdc', borderRadius: '8px', fontSize: '14px' }} />
              <button type="submit" className="scicomm-btn-primary" style={{ padding: '10px', justifyContent: 'center' }}>Update Password</button>
            </form>
          </div>
        </div>
      )}

      {/* Avatar Picker Modal */}
      {showAvatarPicker && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'white', padding: '24px', borderRadius: '12px', width: '100%', maxWidth: '500px', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px' }}>Choose your Avatar</h3>
              <button onClick={() => setShowAvatarPicker(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} color="#666" /></button>
            </div>

            {/* Custom Photo Upload */}
            <div style={{ border: '2px dashed #1d4ed8', padding: '20px', borderRadius: '12px', textAlign: 'center', cursor: 'pointer', background: '#eff6ff', marginBottom: '20px' }} onClick={() => document.getElementById('profile-photo-upload').click()}>
              <Camera size={28} color="#1d4ed8" style={{ marginBottom: '8px' }} />
              <div style={{ fontWeight: 600, color: '#1e3a8a' }}>{isUploadingPhoto ? 'Uploading...' : 'Upload Custom Photo'}</div>
              <div style={{ fontSize: '12px', color: '#1e3a8a' }}>JPG, PNG (from your device)</div>
              <input id="profile-photo-upload" type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
            </div>

            {/* Preset Avatars */}
            <h4 style={{ margin: '0 0 12px', fontSize: '14px', color: '#666' }}>Or choose a preset:</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '12px' }}>
              {AVATARS.map(av => (
                <button key={av.id} onClick={() => handleAvatarSelect(av.id)} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '12px 4px', border: me?.avatarId === av.id ? '2px solid #1d4ed8' : '2px solid transparent',
                  borderRadius: '12px', background: me?.avatarId === av.id ? '#eff6ff' : '#f3f2ef', cursor: 'pointer', transition: 'all 0.2s'
                }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' }}>{av.svg}</div>
                  <span style={{ fontSize: '10px', color: 'rgba(0,0,0,0.6)', textAlign: 'center' }}>{av.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tag Manager Modal */}
      {showTagManager && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '12px', width: '100%', maxWidth: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #eef3f8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '18px' }}>Manage Achievement Tags</h3>
              <button onClick={() => setShowTagManager(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} color="#666" /></button>
            </div>
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#666' }}>
                Select up to {user.role === 'master' ? 'an unlimited number of' : '5'} tags to display on your profile and leaderboard entry.
              </p>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {unlockedTags.map((t, i) => {
                  const isPinned = pinnedTags.includes(t);
                  return (
                    <button key={i} onClick={() => handlePinTag(t)} style={{ background: isPinned ? 'linear-gradient(135deg, #1d4ed8, #1e3a8a)' : '#f3f2ef', color: isPinned ? 'white' : '#333', padding: '6px 14px', borderRadius: '16px', fontSize: '13px', fontWeight: 600, border: isPinned ? 'none' : '1px solid #e0dfdc', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {isPinned && <Pin size={12} />} {t}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Warning Panel Modal */}
      {showWarnings && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={() => setShowWarnings(false)}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '24px', maxWidth: '500px', width: '100%', maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '20px' }}>⚠️ Warning Panel ({activeWarnings.length}/3)</h2>
              <button onClick={() => setShowWarnings(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              {[1, 2, 3].map(n => (
                <div key={n} style={{ flex: 1, textAlign: 'center', padding: '12px', borderRadius: '8px', background: n <= activeWarnings.length ? (n === 3 ? '#fee2e2' : '#fef3c7') : '#f3f2ef', border: n <= activeWarnings.length ? (n === 3 ? '2px solid #ef4444' : '2px solid #f59e0b') : '2px solid transparent' }}>
                  <div style={{ fontSize: '24px' }}>{n <= activeWarnings.length ? '⚠️' : '✅'}</div>
                  <div style={{ fontSize: '12px', fontWeight: 600 }}>Warning {n}</div>
                </div>
              ))}
            </div>
            {activeWarnings.length === 0 ? (
              <p style={{ color: '#666', textAlign: 'center' }}>No active warnings. Keep up the great work! 🎉</p>
            ) : (
              activeWarnings.map((w, i) => (
                <div key={w.id} style={{ padding: '16px', background: '#fff5f5', borderRadius: '8px', marginBottom: '8px', border: '1px solid #fecaca' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <strong style={{ fontSize: '14px' }}>Warning {i + 1}{i === 2 ? ' (Final)' : ''}</strong>
                    <span style={{ fontSize: '12px', color: 'rgba(0,0,0,0.5)' }}>{new Date(w.issuedAt).toLocaleDateString()}</span>
                  </div>
                  <p style={{ margin: '4px 0', fontSize: '14px' }}>{w.message}</p>
                  <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.5)', marginBottom: '8px' }}>Issued by: {w.issuedBy}</div>
                  {w.appeal ? (
                    <div style={{ background: '#f3f2ef', padding: '8px 12px', borderRadius: '8px', fontSize: '13px' }}>
                      <strong>Your Appeal:</strong> {w.appeal}
                      <div style={{ marginTop: '4px', fontWeight: 600, color: w.appealStatus === 'accepted' ? '#1d4ed8' : w.appealStatus === 'rejected' ? '#ef4444' : '#f59e0b' }}>Status: {w.appealStatus || 'Pending'}</div>
                    </div>
                  ) : (
                    appealTarget === w.id ? (
                      <div>
                        <textarea value={appealText} onChange={e => setAppealText(e.target.value)} placeholder="Write your explanation/excuse..." rows={2} style={{ width: '100%', padding: '8px', border: '1px solid #e0dfdc', borderRadius: '8px', fontSize: '13px', resize: 'vertical', boxSizing: 'border-box' }} />
                        <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                          <button className="scicomm-btn-primary" style={{ fontSize: '12px', padding: '4px 12px' }} onClick={() => handleAppeal(w.id)}>Submit Appeal</button>
                          <button className="scicomm-btn-secondary" style={{ fontSize: '12px', padding: '4px 12px' }} onClick={() => setAppealTarget(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button className="scicomm-btn-secondary" style={{ fontSize: '12px', padding: '4px 12px' }} onClick={() => setAppealTarget(w.id)}>Submit Excuse / Appeal</button>
                    )
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
  } catch (e) {
    return <div style={{ padding: '20px', color: 'red', background: 'white', margin: '20px', borderRadius: '8px', border: '1px solid #fecaca' }}><h2>⚠️ Error Loading Profile</h2><p>{e.message}</p></div>;
  }
}
