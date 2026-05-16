import { useLiveCollection, db, firestore, getCollectionName, uploadFile } from '../db';
import { UserPlus, Download, Upload, Smartphone, Monitor, Apple, Terminal } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Trash2, UserX, UserCheck, Shield, Plus, AlertTriangle, Calendar, CheckCircle, Clock, Award, BarChart3, Image, Link2, Database, History } from 'lucide-react';
import { AVATARS, calculateScore, getUnlockedTags, REACTIONS } from './scicommConstants';
import SciCommMeetings from './SciCommMeetings';
import * as XLSX from 'xlsx';

export default function SciCommAdmin() {
  const { user } = useAuth();
  const scientists = useLiveCollection('scientists') || [];
  const posts = useLiveCollection('scicomm_posts') || [];
  const tasksData = useLiveCollection('tasks') || [];
  const warningsData = useLiveCollection('scicomm_warnings') || [];
  const meetingsData = useLiveCollection('scicomm_meetings') || [];
  const connectionsData = useLiveCollection('scicomm_connections') || [];
  const chatRooms = useLiveCollection('scicomm_chat_rooms') || [];
  const applicationsData = useLiveCollection('scicomm_applications') || [];
  const pendingApps = applicationsData.filter(a => a.status === 'pending');
  const completedApps = applicationsData.filter(a => a.status === 'approved' || a.status === 'rejected').sort((a, b) => new Date(b.reviewedAt || b.createdAt) - new Date(a.reviewedAt || a.createdAt));
  const chatMessages = useLiveCollection('scicomm_chat_messages') || [];
  const storiesData = useLiveCollection('scicomm_stories') || [];
  const activeStories = storiesData.filter(s => new Date(s.expiresAt) > new Date());
  const downloadsData = useLiveCollection('scicomm_app_downloads') || [];
  const isMaster = user.role === 'master';

  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'pending';
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t) setActiveTab(t);
  }, [searchParams]);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', assignedTo: '', dueDate: '', priority: 'Medium' });
  const [warningForm, setWarningForm] = useState({ userId: '', message: '', note: '' });
  const [msg, setMsg] = useState('');
  const [rejectPrompt, setRejectPrompt] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [uploadProgress, setUploadProgress] = useState({}); // { platformId: progress }

  const pendingAccounts = scientists.filter(s => s.accountStatus === 'pending');
  const activeAccounts = scientists.filter(s => s.accountStatus !== 'pending');

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  // Handlers
  const handleApprove = async (id) => { await db.scientists.update(id, { accountStatus: 'active' }); flash('Account approved!'); };
  const handleReject = async (id) => { if (window.confirm("Reject?")) await db.scientists.delete(id); };
  const handlePromote = async (id, newRole) => { await db.scientists.update(id, { role: newRole }); flash('Role updated!'); };
  const handleDemote = async (id) => { await db.scientists.update(id, { role: 'scientist' }); flash('Demoted to Visitor.'); };
  const handleRemoveUser = async (id) => { if (window.confirm("Remove?")) await db.scientists.delete(id); };
  const handleRemovePost = async (id) => { if (window.confirm("Delete post?")) await db.scicomm_posts.delete(id); };
  const handleRemoveStory = async (id) => { if (window.confirm("Delete story?")) await db.scicomm_stories.delete(id); };

  const handleAssignTask = async (e) => {
    e.preventDefault();
    if (!taskForm.title || !taskForm.assignedTo || !taskForm.dueDate) return;
    await db.tasks.add({ ...taskForm, status: 'Pending', assignedBy: user.id, assignedByName: user.name, createdAt: new Date().toISOString() });
    setTaskForm({ title: '', description: '', assignedTo: '', dueDate: '', priority: 'Medium' });
    flash('Task assigned!');
  };

  const handleSendWarning = async (e) => {
    e.preventDefault();
    if (!warningForm.userId || !warningForm.message) return;
    const target = scientists.find(s => String(s.id) === String(warningForm.userId));
    const existingWarnings = warningsData.filter(w => String(w.userId) === String(warningForm.userId) && w.status !== 'removed');
    if (existingWarnings.length >= 3) { flash('User already has 3 warnings (suspended).'); return; }
    await db.scicomm_warnings.add({
      userId: warningForm.userId, userName: target?.name || '', message: warningForm.message, note: warningForm.note,
      issuedBy: user.name, issuedAt: new Date().toISOString(), status: 'active',
      warningNumber: existingWarnings.length + 1, appeal: null, appealStatus: null
    });
    setWarningForm({ userId: '', message: '', note: '' });
    flash(`Warning ${existingWarnings.length + 1}/3 issued!`);
  };

  const handleReviewAppeal = async (warningId, decision) => {
    if (decision === 'accept') {
      await db.scicomm_warnings.update(warningId, { status: 'removed', appealStatus: 'accepted' });
      flash('Warning removed!');
    } else {
      await db.scicomm_warnings.update(warningId, { appealStatus: 'rejected' });
      flash('Appeal rejected.');
    }
  };

  const handleApproveApplication = async (app) => {
    await db.scientists.update(app.userId, { role: 'scicomm' });
    await db.scicomm_applications.update(app.id, { status: 'approved', reviewedAt: new Date().toISOString() });
    flash(`Approved! User promoted to SciComm Team.`);
  };

  const handleRejectApplication = (app) => {
    setRejectPrompt(app);
    setRejectReason('');
  };

  const confirmRejectApplication = async () => {
    if (!rejectPrompt) return;
    await db.scicomm_applications.update(rejectPrompt.id, { status: 'rejected', comment: rejectReason, reviewedAt: new Date().toISOString() });
    flash('Application rejected.');
    setRejectPrompt(null);
  };

  const tabs = [
    { id: 'pending', label: `Pending (${pendingAccounts.length})`, icon: <Clock size={14} /> },
    { id: 'applications', label: `Applications (${pendingApps.length})`, icon: <UserPlus size={14} /> },
    { id: 'users', label: 'Users', icon: <Shield size={14} /> },
    { id: 'tasks', label: 'Tasks', icon: <Calendar size={14} /> },
    { id: 'warnings', label: 'Warnings', icon: <AlertTriangle size={14} /> },
    { id: 'meetings', label: 'Meetings', icon: <Link2 size={14} /> },
    { id: 'posts', label: 'Posts', icon: <Trash2 size={14} /> },
    { id: 'stories', label: 'Stories', icon: <Image size={14} /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={14} /> },
    { id: 'activity', label: 'Activity', icon: <History size={14} /> },
    { id: 'downloads', label: 'Downloads', icon: <Smartphone size={14} /> },
    { id: 'data', label: 'Data', icon: <Database size={14} /> },
  ];

  const fileInputRef = useRef(null);

  const handleResetAllPoints = async () => {
    if (!window.confirm('Reset ALL member points to 0? This clears awardedPoints from every task.')) return;
    for (const t of tasksData) {
      if (t.awardedPoints) await db.tasks.update(t.id, { awardedPoints: 0 });
    }
    flash('All points reset to 0.');
  };

  const handleClearMemberTasks = async (memberId, memberName) => {
    if (!window.confirm(`Delete all tasks for ${memberName}?`)) return;
    const memberTasks = tasksData.filter(t => String(t.assignedTo) === String(memberId));
    for (const t of memberTasks) await db.tasks.delete(t.id);
    flash(`Cleared ${memberTasks.length} tasks for ${memberName}.`);
  };

  const handleClearMemberMeetings = async (memberId, memberName) => {
    if (!window.confirm(`Remove ${memberName} from all meeting attendance records?`)) return;
    for (const m of meetingsData) {
      if ((m.attendees || []).includes(memberId)) {
        const updated = (m.attendees || []).filter(a => a !== memberId);
        await db.scicomm_meetings.update(m.id, { attendees: updated });
      }
    }
    flash(`Cleared meeting records for ${memberName}.`);
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    // Users sheet
    const usersRows = scientists.map(s => ({
      ID: s.id, Username: s.username, Name: s.name, Department: s.department || '',
      Role: s.role || 'scientist', Status: s.accountStatus || 'active',
      Email: s.email || '', Bio: s.bio || '', EmployeeID: s.employeeId || '',
      PasswordHash: s.passwordHash || ''
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(usersRows), 'Users');
    // Tasks sheet
    const taskRows = tasksData.map(t => ({
      ID: t.id, Title: t.title, Description: t.description || '',
      AssignedTo: t.assignedTo, AssigneeName: scientists.find(s => String(s.id) === String(t.assignedTo))?.name || '',
      Status: t.status, Priority: t.priority || 'Medium',
      DueDate: t.dueDate || '', AwardedPoints: t.awardedPoints || 0,
      EvalNote: t.evalNote || '', CreatedAt: t.createdAt || ''
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(taskRows), 'Tasks');
    // Meetings sheet
    const meetingRows = meetingsData.map(m => ({
      ID: m.id, Title: m.title, Date: m.date, Time: m.time || '',
      Link: m.link || '', Location: m.location || '',
      Attendees: (m.attendees || []).map(aid => scientists.find(s => String(s.id) === String(aid))?.name || aid).join(', '),
      CreatedAt: m.createdAt || ''
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(meetingRows), 'Meetings');
    // Applications sheet
    const appRows = applicationsData.map(a => ({
      ID: a.id, UserID: a.userId,
      UserName: scientists.find(s => String(s.id) === String(a.userId))?.name || '',
      Status: a.status, CreatedAt: a.createdAt || '', ReviewedAt: a.reviewedAt || ''
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(appRows), 'Applications');
    XLSX.writeFile(wb, `SciComm_Export_${new Date().toISOString().slice(0,10)}.xlsx`);
    flash('Data exported to Excel!');
  };

  const handleImportExcel = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!window.confirm('Import data from Excel? This will ADD new records. Existing records are NOT overwritten.')) {
      e.target.value = '';
      return;
    }
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    let imported = 0;
    // Import Users
    if (wb.SheetNames.includes('Users')) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets['Users']);
      for (const r of rows) {
        if (r.Username && r.Name) {
          const exists = await db.scientists.where('username').equals(r.Username).first();
          if (!exists) {
            await db.scientists.add({ username: r.Username, name: r.Name, department: r.Department || '', role: r.Role || 'scientist', accountStatus: r.Status || 'active', email: r.Email || '', bio: r.Bio || '', employeeId: r.EmployeeID || '', passwordHash: r.PasswordHash || '' });
            imported++;
          }
        }
      }
    }
    // Import Tasks
    if (wb.SheetNames.includes('Tasks')) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets['Tasks']);
      for (const r of rows) {
        if (r.Title) {
          await db.tasks.add({ title: r.Title, description: r.Description || '', assignedTo: r.AssignedTo || '', status: r.Status || 'Pending', priority: r.Priority || 'Medium', dueDate: r.DueDate || '', awardedPoints: r.AwardedPoints || 0, evalNote: r.EvalNote || '', createdAt: r.CreatedAt || new Date().toISOString() });
          imported++;
        }
      }
    }
    flash(`Imported ${imported} records from Excel.`);
    e.target.value = '';
  };

  const handleBackfillNotifications = async () => {
    if (!window.confirm('Backfill notifications? This will delete all existing general notifications and regenerate them with correct names. This is a heavy operation.')) return;
    
    let added = 0;
    try {
      flash('Clearing old feed notifications...');
      const notifsSnap = await import('firebase/firestore').then(m => m.getDocs(m.collection(firestore, getCollectionName('scicomm_notifications'))));
      for (const docSnap of notifsSnap.docs) {
        const type = docSnap.data().type;
        if (['reaction', 'comment', 'mention', 'reply', 'new_post'].includes(type)) {
          await db.scicomm_notifications.delete(docSnap.id);
        }
      }
      flash('Old notifications cleared. Generating new ones...');

      const getName = (id) => {
        const s = scientists.find(x => String(x.id) === String(id));
        return s ? s.name.split(' ')[0] : 'Someone';
      };

      // 1. Backfill Post Reactions & Comments
      for (const p of posts) {
        // Post Reactions
        if (p.reactions) {
          for (const [rKey, uIds] of Object.entries(p.reactions)) {
            for (const uid of uIds) {
              if (String(uid) !== String(p.authorId)) {
                await db.scicomm_notifications.add({
                  userId: p.authorId, type: 'reaction', senderId: uid,
                  title: `${getName(uid)} reacted to your post`,
                  message: p.content?.substring(0, 50) || 'Media post',
                  link: `/view-post/${p.id}`, createdAt: p.createdAt || new Date().toISOString(), read: false
                });
                added++;
              }
            }
          }
        }
        
        // Post Comments
        const processComments = async (comments, parentAuthorId, postId) => {
          if (!comments) return;
          for (const c of comments) {
            if (String(c.authorId) !== String(parentAuthorId)) {
               await db.scicomm_notifications.add({
                 userId: parentAuthorId, type: 'comment', senderId: c.authorId,
                 title: `${getName(c.authorId)} commented on your post`,
                 message: c.text?.substring(0, 50) || 'Media comment',
                 link: `/view-post/${postId}`, createdAt: c.createdAt || new Date().toISOString(), read: false
               });
               added++;
            }
            if (c.reactions) {
              for (const [rKey, uIds] of Object.entries(c.reactions)) {
                for (const uid of uIds) {
                  if (String(uid) !== String(c.authorId)) {
                    await db.scicomm_notifications.add({
                      userId: c.authorId, type: 'reaction', senderId: uid,
                      title: `${getName(uid)} reacted to your comment`,
                      message: c.text?.substring(0, 50) || 'Media',
                      link: `/view-post/${postId}`, createdAt: c.createdAt || new Date().toISOString(), read: false
                    });
                    added++;
                  }
                }
              }
            }
            // Mentions in comments
            const mentions = c.text?.match(/@\w+/g) || [];
            for (const mention of mentions) {
              const username = mention.slice(1).toLowerCase();
              const userMatch = scientists.find(s => (s.username || '').toLowerCase() === username || s.name.replace(/\s+/g, '').toLowerCase() === username);
              if (userMatch && String(userMatch.id) !== String(c.authorId)) {
                await db.scicomm_notifications.add({
                  userId: userMatch.id, type: 'mention', senderId: c.authorId,
                  title: `${getName(c.authorId)} mentioned you`,
                  message: c.text?.substring(0, 50) || '...',
                  link: `/view-post/${postId}`, createdAt: c.createdAt || new Date().toISOString(), read: false
                });
                added++;
              }
            }
            if (c.replies) await processComments(c.replies, c.authorId, postId);
          }
        };
        await processComments(p.comments, p.authorId, p.id);
      }

      // 2. Chat Mentions & Group Additions (Approximate)
      for (const m of chatMessages) {
        const mentions = m.content?.match(/@\w+/g) || [];
        for (const mention of mentions) {
          if (mention.toLowerCase() === '@all') {
            const room = chatRooms.find(r => r.id === m.roomId);
            if (room && room.isGroup) {
               for (const memberId of room.members) {
                 if (String(memberId) !== String(m.senderId)) {
                    await db.scicomm_notifications.add({
                      userId: memberId, type: 'mention', senderId: m.senderId,
                      title: `${getName(m.senderId)} mentioned @all in chat`,
                      message: m.content?.substring(0, 50) || '...',
                      link: '/chat', createdAt: m.createdAt || new Date().toISOString(), read: false
                    });
                    added++;
                 }
               }
            }
          } else {
            const username = mention.slice(1).toLowerCase();
            const userMatch = scientists.find(s => (s.username || '').toLowerCase() === username || s.name.replace(/\s+/g, '').toLowerCase() === username);
            if (userMatch && String(userMatch.id) !== String(m.senderId)) {
              await db.scicomm_notifications.add({
                userId: userMatch.id, type: 'mention', senderId: m.senderId,
                title: `${getName(m.senderId)} mentioned you in chat`,
                message: m.content?.substring(0, 50) || '...',
                link: '/chat', createdAt: m.createdAt || new Date().toISOString(), read: false
              });
              added++;
            }
          }
        }
      }
      flash(`Successfully backfilled ${added} correct notifications!`);
    } catch (e) {
      console.error(e);
      flash("Error during backfill. See console.");
    }
  };

  // Analytics data
  const getAnalytics = (member) => {
    const completedTasks = tasksData.filter(t => String(t.assignedTo) === String(member.id) && (t.status === 'Completed' || t.status === 'Approved')).length;
    const taskPoints = tasksData.filter(t => String(t.assignedTo) === String(member.id) && (t.status === 'Completed' || t.status === 'Approved')).reduce((s, t) => s + (t.awardedPoints || 0), 0);
    const pendingTasks = tasksData.filter(t => String(t.assignedTo) === String(member.id) && t.status !== 'Completed' && t.status !== 'Approved').length;
    const meetingsAttended = meetingsData.filter(m => (m.attendees || []).includes(member.id)).length;
    const postCount = posts.filter(p => String(p.authorId) === String(member.id)).length;
    const warnings = warningsData.filter(w => String(w.userId) === String(member.id) && w.status !== 'removed').length;
    const score = calculateScore({ taskPoints, meetingsAttended, role: member.role });
    return { completedTasks, taskPoints, pendingTasks, meetingsAttended, postCount, warnings, score };
  };

  return (
    <div style={{ maxWidth: '950px', margin: '0 auto' }}>
      {msg && <div style={{ background: '#fef3c7', color: '#92400e', padding: '12px 16px', borderRadius: '8px', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>✅ {msg}</div>}

      <div className="scicomm-card scicomm-card-padding">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: '22px' }}>🛡️ Admin Dashboard</h2>
            <p style={{ margin: 0, color: 'rgba(0,0,0,0.6)', fontSize: '13px' }}>Manage team, tasks, warnings, banners, and analytics.</p>
          </div>
          {isMaster && (
            <button onClick={async () => {
              if (window.confirm("⚠️ DANGER: Are you sure you want to FACTORY RESET the entire platform? This will delete all posts, tasks, warnings, messages, and users EXCEPT the Master account. This cannot be undone!")) {
                if (window.prompt("Type 'CONFIRM' to factory reset") === 'CONFIRM') {
                  // Delete non-master users
                  for (const x of scientists) { if (x.role !== 'master') await db.scientists.delete(x.id); }
                  // Delete from each collection using loaded data
                  for (const t of tasksData) await db.tasks.delete(t.id);
                  for (const p of posts) await db.scicomm_posts.delete(p.id);
                  for (const w of warningsData) await db.scicomm_warnings.delete(w.id);
                  for (const m of meetingsData) await db.scicomm_meetings.delete(m.id);
                  for (const b of bannersData) await db.scicomm_banners.delete(b.id);
                  for (const c of connectionsData) await db.scicomm_connections.delete(c.id);
                  for (const r of recognitionsData) await db.scicomm_recognitions.delete(r.id);
                  for (const cr of chatRooms) await db.scicomm_chat_rooms.delete(cr.id);
                  for (const cm of chatMessages) await db.scicomm_chat_messages.delete(cm.id);
                  flash("Factory reset complete.");
                  setTimeout(() => window.location.reload(), 1000);
                }
              }
            }} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
              ⚠️ Factory Reset
            </button>
          )}
        </div>
      </div>

      <div className="scicomm-card" style={{ display: 'flex', flexWrap: 'wrap', overflow: 'hidden' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            flex: '1 1 auto', minWidth: '80px', padding: '10px 6px', border: 'none', background: activeTab === t.id ? '#1d4ed8' : 'transparent',
            color: activeTab === t.id ? 'white' : 'rgba(0,0,0,0.6)', fontWeight: 600, cursor: 'pointer', fontSize: '12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', transition: 'all 0.2s'
          }}>{t.icon} {t.label}</button>
        ))}
      </div>

      {/* PENDING */}
      {activeTab === 'pending' && (
        <div className="scicomm-card scicomm-card-padding">
          <h3 style={{ margin: '0 0 12px', fontSize: '18px' }}>🕐 Pending Approvals</h3>
          {pendingAccounts.length === 0 ? <p style={{ color: '#666', textAlign: 'center', padding: '24px' }}>No pending accounts.</p> : pendingAccounts.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #eef3f8', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{s.name}</div>
                <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.5)' }}>@{s.username} • {s.email || '-'} • {s.department || '-'}</div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="scicomm-btn-primary" style={{ padding: '6px 14px', fontSize: '12px' }} onClick={() => handleApprove(s.id)}><UserCheck size={14} /> Approve</button>
                <button style={{ padding: '6px 14px', fontSize: '12px', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '24px', cursor: 'pointer' }} onClick={() => handleReject(s.id)}><UserX size={14} /> Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* USERS - Intelligence Panel */}
      {activeTab === 'users' && (
        <div className="scicomm-card scicomm-card-padding">
          <h3 style={{ margin: '0 0 12px', fontSize: '18px' }}>👥 Member Management ({activeAccounts.length})</h3>
          {activeAccounts.map(s => {
            const analytics = getAnalytics(s);
            const memberWarnings = warningsData.filter(w => String(w.userId) === String(s.id) && w.status !== 'removed');
            return (
              <div key={s.id} style={{ padding: '14px', borderBottom: '1px solid #eef3f8', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#eef3f8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>
                      {s.avatar ? <img src={s.avatar} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} /> : '👤'}
                    </div>
                    <div>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{s.name} <span style={{ background: s.role === 'master' ? 'linear-gradient(135deg, #fbbf24, #f59e0b)' : s.role === 'admin' ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)' : s.role === 'scicomm' ? 'linear-gradient(135deg, #ef4444, #dc2626)' : '#e2e8f0', color: s.role === 'scientist' ? '#475569' : 'white', padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 700, marginLeft: '4px' }}>{s.role === 'master' ? '👑 Master' : s.role === 'admin' ? '🛡️ Admin' : s.role === 'scicomm' ? '🔬 SciComm' : '👤 Visitor'}</span></div>
                      <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.5)' }}>@{s.username} • {s.email || 'No email'} • {s.department || 'No department'}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    {s.role !== 'master' && (
                      <>
                        {isMaster && (
                          <select value={s.role} onChange={e => handlePromote(s.id, e.target.value)} style={{ padding: '4px 8px', fontSize: '11px', border: '1px solid #e0dfdc', borderRadius: '8px', cursor: 'pointer', background: 'white' }}>
                            <option value="scientist">👤 Visitor</option>
                            <option value="scicomm">🔬 SciComm Team</option>
                            <option value="admin">🛡️ Admin</option>
                          </select>
                        )}
                        {!isMaster && s.role === 'scientist' && <button onClick={() => handlePromote(s.id, 'scicomm')} className="scicomm-btn-secondary" style={{ padding: '4px 10px', fontSize: '11px' }}>Promote to SciComm</button>}
                        <button onClick={async () => {
                          const bcrypt = (await import('bcryptjs')).default;
                          const newPass = window.prompt('Enter new password for ' + s.name);
                          if (newPass && newPass.length >= 4) {
                            const salt = await bcrypt.genSalt(4);
                            const hash = await bcrypt.hash(newPass, salt);
                            await db.scientists.update(s.id, { passwordHash: hash });
                            flash('Password reset for ' + s.name);
                          }
                        }} style={{ padding: '4px 10px', fontSize: '11px', border: '1px solid #f59e0b', borderRadius: '24px', background: '#fef3c7', cursor: 'pointer', color: '#92400e' }}>Reset Password</button>
                        {(isMaster || s.role !== 'admin') && <button onClick={() => handleRemoveUser(s.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><UserX size={16} /></button>}
                      </>
                    )}
                  </div>
                </div>
                {/* Stats Row */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[
                    { label: 'Score', val: analytics.score === Infinity ? '∞' : analytics.score, color: '#1d4ed8' },
                    { label: 'Posts', val: analytics.postCount, color: '#3b82f6' },
                    { label: 'Tasks Done', val: analytics.completedTasks, color: '#f59e0b' },
                    { label: 'Pending', val: analytics.pendingTasks, color: '#8b5cf6' },
                    { label: 'Warnings', val: memberWarnings.length, color: memberWarnings.length > 0 ? '#ef4444' : '#1d4ed8' },
                    { label: 'Connections', val: analytics.connectionCount, color: '#06b6d4' },
                  ].map((stat, i) => (
                    <div key={i} style={{ background: '#f9fafb', borderRadius: '6px', padding: '6px 10px', textAlign: 'center', minWidth: '60px', flex: '1 1 auto' }}>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: stat.color }}>{stat.val}</div>
                      <div style={{ fontSize: '10px', color: 'rgba(0,0,0,0.5)' }}>{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TASKS */}
      {activeTab === 'tasks' && (
        <div className="scicomm-card scicomm-card-padding">
          <h3 style={{ margin: '0 0 12px', fontSize: '18px' }}>📋 Assign Task</h3>
          <form onSubmit={handleAssignTask} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
            <input type="text" placeholder="Task Title" value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} required style={{ padding: '10px 14px', border: '1px solid #e0dfdc', borderRadius: '8px', fontSize: '14px' }} />
            <textarea placeholder="Description..." value={taskForm.description} onChange={e => setTaskForm({ ...taskForm, description: e.target.value })} rows={2} style={{ padding: '10px 14px', border: '1px solid #e0dfdc', borderRadius: '8px', fontSize: '14px', resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <select value={taskForm.assignedTo} onChange={e => setTaskForm({ ...taskForm, assignedTo: e.target.value })} required style={{ flex: 1, padding: '10px 14px', border: '1px solid #e0dfdc', borderRadius: '8px', fontSize: '14px' }}>
                <option value="">Select member...</option>
                {activeAccounts.filter(s => s.role !== 'master').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input type="date" value={taskForm.dueDate} onChange={e => setTaskForm({ ...taskForm, dueDate: e.target.value })} required style={{ flex: 1, padding: '10px 14px', border: '1px solid #e0dfdc', borderRadius: '8px', fontSize: '14px' }} />
              <select value={taskForm.priority} onChange={e => setTaskForm({ ...taskForm, priority: e.target.value })} style={{ flex: 1, padding: '10px 14px', border: '1px solid #e0dfdc', borderRadius: '8px', fontSize: '14px' }}>
                <option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option><option value="Urgent">🔴 Urgent</option>
              </select>
            </div>
            <button type="submit" className="scicomm-btn-primary" style={{ padding: '10px' }}>Assign Task</button>
          </form>
        </div>
      )}

      {/* WARNINGS */}
      {activeTab === 'warnings' && (
        <div className="scicomm-card scicomm-card-padding">
          <h3 style={{ margin: '0 0 12px', fontSize: '18px' }}>⚠️ Warning System (3-Strike)</h3>
          <form onSubmit={handleSendWarning} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
            <select value={warningForm.userId} onChange={e => setWarningForm({ ...warningForm, userId: e.target.value })} required style={{ padding: '10px 14px', border: '1px solid #e0dfdc', borderRadius: '8px', fontSize: '14px' }}>
              <option value="">Select member...</option>
              {activeAccounts.filter(s => s.role !== 'master').map(s => {
                const wCount = warningsData.filter(w => String(w.userId) === String(s.id) && w.status !== 'removed').length;
                return <option key={s.id} value={s.id}>{s.name} ({wCount}/3 warnings)</option>;
              })}
            </select>
            <textarea placeholder="Warning reason..." value={warningForm.message} onChange={e => setWarningForm({ ...warningForm, message: e.target.value })} required rows={2} style={{ padding: '10px 14px', border: '1px solid #e0dfdc', borderRadius: '8px', fontSize: '14px' }} />
            <textarea placeholder="Disciplinary note (optional)..." value={warningForm.note} onChange={e => setWarningForm({ ...warningForm, note: e.target.value })} rows={1} style={{ padding: '10px 14px', border: '1px solid #e0dfdc', borderRadius: '8px', fontSize: '14px' }} />
            <button type="submit" style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '24px', padding: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>⚠️ Issue Warning</button>
          </form>

          <h4 style={{ margin: '0 0 8px', fontSize: '16px' }}>Appeals to Review</h4>
          {warningsData.filter(w => w.appeal && w.appealStatus === 'pending').length === 0 ? <p style={{ color: '#666', fontSize: '13px' }}>No pending appeals.</p> : (
            warningsData.filter(w => w.appeal && w.appealStatus === 'pending').map(w => (
              <div key={w.id} style={{ padding: '12px', background: '#fffbeb', borderRadius: '8px', marginBottom: '8px', border: '1px solid #fde68a' }}>
                <div style={{ fontWeight: 600, fontSize: '14px' }}>{w.userName} — Warning {w.warningNumber}</div>
                <p style={{ margin: '4px 0', fontSize: '13px', color: 'rgba(0,0,0,0.7)' }}>Reason: {w.message}</p>
                <p style={{ margin: '4px 0', fontSize: '13px', color: '#0a66c2' }}>Appeal: {w.appeal}</p>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button className="scicomm-btn-primary" style={{ padding: '4px 12px', fontSize: '12px' }} onClick={() => handleReviewAppeal(w.id, 'accept')}>✅ Accept (Remove Warning)</button>
                  <button style={{ padding: '4px 12px', fontSize: '12px', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '24px', cursor: 'pointer' }} onClick={() => handleReviewAppeal(w.id, 'reject')}>❌ Reject</button>
                </div>
              </div>
            ))
          )}

          <h4 style={{ margin: '16px 0 8px', fontSize: '16px' }}>All Warnings</h4>
          {warningsData.length === 0 ? <p style={{ color: '#666', fontSize: '13px' }}>No warnings.</p> : warningsData.sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime()).map(w => (
            <div key={w.id} style={{ padding: '8px 0', borderBottom: '1px solid #eef3f8', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span><strong>{w.userName}</strong> — {w.message.substring(0, 50)}</span>
                <span style={{ background: w.status === 'removed' ? '#fef3c7' : '#fee2e2', padding: '2px 8px', borderRadius: '8px', fontSize: '11px' }}>{w.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MEETINGS */}
      {activeTab === 'meetings' && (
        <SciCommMeetings />
      )}

      {/* POSTS */}
      {activeTab === 'posts' && (
        <div className="scicomm-card scicomm-card-padding">
          <h3 style={{ margin: '0 0 12px', fontSize: '18px' }}>📝 Content Moderation ({posts.length})</h3>
          {posts.length === 0 ? <p style={{ color: '#666' }}>No posts.</p> : posts.map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #eef3f8' }}>
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: '13px' }}>{p.authorName}</strong>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'rgba(0,0,0,0.6)' }}>{p.content.substring(0, 80)}{p.content.length > 80 ? '...' : ''}</p>
              </div>
              <button onClick={() => handleRemovePost(p.id)} style={{ background: '#fee2e2', border: 'none', color: '#991b1b', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', flexShrink: 0 }}><Trash2 size={12} /> Remove</button>
            </div>
          ))}
        </div>
      )}

      {/* STORIES */}
      {activeTab === 'stories' && (
        <div className="scicomm-card scicomm-card-padding">
          <h3 style={{ margin: '0 0 12px', fontSize: '18px' }}>📖 Stories Management ({activeStories.length})</h3>
          {activeStories.length === 0 ? <p style={{ color: '#666', textAlign: 'center', padding: '24px' }}>No active stories.</p> : activeStories.map(s => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #eef3f8' }}>
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: '13px' }}>{s.authorName}</strong>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'rgba(0,0,0,0.6)' }}>{s.content || 'Media only'}</p>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Expires: {new Date(s.expiresAt).toLocaleString()}</div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {s.mediaUrl && (
                  s.mediaType === 'video' ? (
                    <video src={s.mediaUrl} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
                  ) : (
                    <img src={s.mediaUrl} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
                  )
                )}
                <button onClick={() => handleRemoveStory(s.id)} style={{ background: '#fee2e2', border: 'none', color: '#991b1b', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', flexShrink: 0 }}><Trash2 size={12} /> Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ANALYTICS */}
      {activeTab === 'analytics' && (
        <div className="scicomm-card scicomm-card-padding">
          <h3 style={{ margin: '0 0 12px', fontSize: '18px' }}>📊 Member Analytics</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '600px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e0dfdc', textAlign: 'left' }}>
                  <th style={{ padding: '8px 4px' }}>Member</th>
                  <th style={{ padding: '8px 4px' }}>Score</th>
                  <th style={{ padding: '8px 4px' }}>Posts</th>
                  <th style={{ padding: '8px 4px' }}>Reactions</th>
                  <th style={{ padding: '8px 4px' }}>Tasks ✅</th>
                  <th style={{ padding: '8px 4px' }}>Tasks ⏳</th>
                  <th style={{ padding: '8px 4px' }}>Meetings</th>
                  <th style={{ padding: '8px 4px' }}>⚠️</th>
                </tr>
              </thead>
              <tbody>
                {activeAccounts.filter(s => s.role !== 'master').map(s => {
                  const a = getAnalytics(s);
                  return (
                    <tr key={s.id} style={{ borderBottom: '1px solid #eef3f8' }}>
                      <td style={{ padding: '8px 4px', fontWeight: 600 }}>{s.name}</td>
                      <td style={{ padding: '8px 4px', fontWeight: 700, color: '#1d4ed8' }}>{a.score}</td>
                      <td style={{ padding: '8px 4px' }}>{a.postCount}</td>
                      <td style={{ padding: '8px 4px' }}>{a.likesReceived}</td>
                      <td style={{ padding: '8px 4px', color: '#1d4ed8' }}>{a.completedTasks}</td>
                      <td style={{ padding: '8px 4px', color: '#f59e0b' }}>{a.pendingTasks}</td>
                      <td style={{ padding: '8px 4px' }}>{a.meetingsAttended}</td>
                      <td style={{ padding: '8px 4px', color: a.warnings >= 3 ? '#ef4444' : a.warnings > 0 ? '#f59e0b' : '#1d4ed8', fontWeight: 600 }}>{a.warnings}/3</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* APPLICATIONS */}
      {activeTab === 'applications' && (
        <div className="scicomm-card scicomm-card-padding">
          <h3 style={{ margin: '0 0 12px', fontSize: '18px' }}>📝 SciComm Team Applications</h3>
          {pendingApps.length === 0 ? (
            <p style={{ color: '#666', textAlign: 'center', padding: '24px' }}>No pending applications.</p>
          ) : pendingApps.map(app => {
            const applicant = scientists.find(s => String(s.id) === String(app.userId));
            if (!applicant) return null;
            return (
              <div key={app.id} style={{ display: 'flex', gap: '12px', padding: '14px', marginBottom: '8px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ flexShrink: 0 }}>
                  {applicant.avatar ? <img src={applicant.avatar} alt="" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#eef3f8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>👤</div>}
                </div>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '2px' }}>{applicant.name}</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>{applicant.department || 'No department'} · @{applicant.username}</div>
                  {applicant.bio && <div style={{ fontSize: '12px', color: '#475569', marginBottom: '4px', fontStyle: 'italic' }}>"{applicant.bio}"</div>}
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>Applied: {new Date(app.createdAt).toLocaleDateString()}</div>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  <button onClick={() => handleApproveApplication(app)} className="scicomm-btn-primary" style={{ padding: '6px 14px', fontSize: '12px' }}>✅ Approve</button>
                  <button onClick={() => handleRejectApplication(app)} className="scicomm-btn-secondary" style={{ padding: '6px 14px', fontSize: '12px', color: '#ef4444', borderColor: '#fca5a5' }}>❌ Reject</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ACTIVITY */}
      {activeTab === 'activity' && (
        <div className="scicomm-card scicomm-card-padding">
          <h3 style={{ margin: '0 0 12px', fontSize: '18px' }}>🕒 Application Activity</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {completedApps.map(app => {
              const u = scientists.find(s => String(s.id) === String(app.userId));
              if (!u) return null;
              return (
                <div key={app.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: '#f8fafc', padding: '16px', borderRadius: '12px', borderLeft: `4px solid ${app.status === 'approved' ? '#22c55e' : '#ef4444'}` }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '15px' }}>{u.name}</div>
                    <div style={{ color: 'rgba(0,0,0,0.6)', fontSize: '13px', margin: '4px 0' }}>
                      <strong>Status:</strong> {app.status === 'approved' ? '✅ Approved' : '❌ Rejected'}
                    </div>
                    {app.comment && (
                      <div style={{ fontSize: '13px', background: 'rgba(255,255,255,0.6)', padding: '6px 10px', borderRadius: '8px', fontStyle: 'italic', marginTop: '6px', color: '#475569', display: 'inline-block' }}>
                        "{app.comment}"
                      </div>
                    )}
                  </div>
                  <div style={{ color: 'rgba(0,0,0,0.4)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                    {app.reviewedAt ? new Date(app.reviewedAt).toLocaleDateString() : ''}
                  </div>
                </div>
              );
            })}
          </div>
          {completedApps.length === 0 && <p style={{ color: 'rgba(0,0,0,0.5)', fontStyle: 'italic', margin: 0 }}>No recent application activity.</p>}
        </div>
      )}

      {/* DATA MANAGEMENT */}
      {activeTab === 'data' && (
        <div className="scicomm-card scicomm-card-padding">
          <h3 style={{ margin: '0 0 16px', fontSize: '18px' }}>🗄️ Data Management</h3>
          
          {/* Export / Import */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
            <button onClick={handleExportExcel} className="scicomm-btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px' }}>
              <Download size={16} /> Export All Data to Excel
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="scicomm-btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px' }}>
              <Upload size={16} /> Import from Excel
            </button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleImportExcel} style={{ display: 'none' }} />
          </div>

          {/* System Tools */}
          <div style={{ padding: '16px', background: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0', marginBottom: '24px' }}>
            <h4 style={{ margin: '0 0 8px', fontSize: '15px', color: '#166534' }}>🔧 System Maintenance</h4>
            <p style={{ fontSize: '13px', color: '#14532d', margin: '0 0 12px' }}>Generate missed notifications for all past posts, comments, reactions, and chat mentions.</p>
            <button onClick={handleBackfillNotifications} style={{ background: '#16a34a', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>Generate Past Notifications</button>
          </div>

          {/* Reset Points */}
          <div style={{ padding: '16px', background: '#fef2f2', borderRadius: '10px', border: '1px solid #fca5a5', marginBottom: '24px' }}>
            <h4 style={{ margin: '0 0 8px', fontSize: '15px', color: '#991b1b' }}>⚠️ Reset All Points</h4>
            <p style={{ fontSize: '13px', color: '#7f1d1d', margin: '0 0 12px' }}>This will set awardedPoints to 0 on every task, resetting all member scores to zero.</p>
            <button onClick={handleResetAllPoints} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>Reset All Points to 0</button>
          </div>

          {/* Per-member clear */}
          <h4 style={{ margin: '0 0 12px', fontSize: '15px' }}>🧹 Clear Records per Member</h4>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {activeAccounts.filter(s => s.role !== 'master' || isMaster).map(s => {
              const memberTaskCount = tasksData.filter(t => String(t.assignedTo) === String(s.id)).length;
              const memberMeetingCount = meetingsData.filter(m => (m.attendees || []).includes(s.id)).length;
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 8px', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, fontSize: '14px', flex: 1, minWidth: '120px' }}>{s.name}</span>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>{memberTaskCount} tasks · {memberMeetingCount} meetings</span>
                  <button onClick={() => handleClearMemberTasks(s.id, s.name)} disabled={memberTaskCount === 0} style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '6px', border: '1px solid #fca5a5', background: memberTaskCount > 0 ? '#fee2e2' : '#f9fafb', color: memberTaskCount > 0 ? '#991b1b' : '#ccc', cursor: memberTaskCount > 0 ? 'pointer' : 'default', fontWeight: 600 }}>Clear Tasks</button>
                  <button onClick={() => handleClearMemberMeetings(s.id, s.name)} disabled={memberMeetingCount === 0} style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '6px', border: '1px solid #bfdbfe', background: memberMeetingCount > 0 ? '#dbeafe' : '#f9fafb', color: memberMeetingCount > 0 ? '#1e3a8a' : '#ccc', cursor: memberMeetingCount > 0 ? 'pointer' : 'default', fontWeight: 600 }}>Clear Meetings</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DOWNLOADS */}
      {activeTab === 'downloads' && (
        <div className="scicomm-card scicomm-card-padding">
          <h3 style={{ margin: '0 0 16px', fontSize: '18px' }}>📲 App Download Management</h3>
          <div style={{ background: '#f0f7ff', border: '1px solid #cce3ff', borderRadius: '12px', padding: '16px', marginBottom: '24px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ color: '#0077b5', background: 'white', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Info size={20} />
            </div>
            <div>
              <h4 style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 700, color: '#0077b5' }}>GitHub Hosting Mode Active</h4>
              <p style={{ margin: 0, fontSize: '12px', color: '#475569', lineHeight: '1.5' }}>
                To update applications faster, place your installer files (APK, EXE, etc.) in the <code>public/downloads/</code> folder of the project. 
                I will automatically detect them and push them to GitHub. This bypasses slow Firebase uploads and makes downloads faster for users.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            {[
              { id: 'android', name: 'Android (.apk)', icon: <img src="./android-v2.png" alt="Android" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />, local: './downloads/ThePortal.apk' },
              { id: 'windows', name: 'Windows (.exe)', icon: <Monitor color="#00a4ef" />, local: './downloads/ThePortal.exe' },
              { id: 'ios', name: 'iOS', icon: <Apple color="#000000" /> },
              { id: 'mac', name: 'MacOS', icon: <Apple color="#000000" /> },
              { id: 'linux', name: 'Linux', icon: <Terminal color="#333" /> },
            ].map(platform => {
              return (
                <div key={platform.id} className="scicomm-card" style={{ padding: '20px', position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ width: '40px', height: '40px', background: '#f1f5f9', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {platform.icon}
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>{platform.name}</h4>
                      <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>
                        {platform.local ? 'Hosted on GitHub' : 'Coming Soon'}
                      </p>
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px', marginBottom: '16px', minHeight: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {platform.local ? (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a', marginBottom: '4px' }}>File Ready</div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>{platform.local}</div>
                      </div>
                    ) : (
                      <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>No file linked yet</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {rejectPrompt && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.2s' }}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '24px', width: '90%', maxWidth: '400px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '22px', fontWeight: 900, color: '#0f172a' }}>Reject Application</h3>
            <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: '14px', lineHeight: '1.5' }}>
              Please provide a reason for rejecting this application (optional). This will be shown to the applicant.
            </p>
            <textarea 
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="E.g., Please update your bio to include your scientific background..."
              style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '14px', minHeight: '80px', resize: 'vertical', outline: 'none', marginBottom: '24px' }}
            />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setRejectPrompt(null)} style={{ flex: 1, padding: '12px', borderRadius: '16px', background: '#f1f5f9', border: 'none', fontWeight: 800, color: '#64748b', fontSize: '15px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={confirmRejectApplication} style={{ flex: 1, padding: '12px', borderRadius: '16px', background: '#ef4444', border: 'none', fontWeight: 800, color: 'white', fontSize: '15px', cursor: 'pointer' }}>Reject</button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>
    </div>
  );
}
