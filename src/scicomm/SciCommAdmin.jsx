import { useLiveCollection, db } from '../db';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';
import { Trash2, UserX, UserCheck, Shield, Plus, AlertTriangle, Calendar, CheckCircle, Clock, Award, BarChart3, Image, Link2 } from 'lucide-react';
import { AVATARS, calculateScore, getUnlockedTags, REACTIONS } from './scicommConstants';
import SciCommMeetings from './SciCommMeetings';

export default function SciCommAdmin() {
  const { user } = useAuth();
  const scientists = useLiveCollection('scientists') || [];
  const posts = useLiveCollection('scicomm_posts') || [];
  const tasksData = useLiveCollection('tasks') || [];
  const warningsData = useLiveCollection('scicomm_warnings') || [];
  const meetingsData = useLiveCollection('scicomm_meetings') || [];
  const connectionsData = useLiveCollection('scicomm_connections') || [];
  const chatRooms = useLiveCollection('scicomm_chat_rooms') || [];
  const chatMessages = useLiveCollection('scicomm_chat_messages') || [];
  const isMaster = user.role === 'master';

  const [activeTab, setActiveTab] = useState('pending');
  const [taskForm, setTaskForm] = useState({ title: '', description: '', assignedTo: '', dueDate: '', priority: 'Medium' });
  const [warningForm, setWarningForm] = useState({ userId: '', message: '', note: '' });
  const [msg, setMsg] = useState('');

  const pendingAccounts = scientists.filter(s => s.accountStatus === 'pending');
  const activeAccounts = scientists.filter(s => s.accountStatus !== 'pending');

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  // Handlers
  const handleApprove = async (id) => { await db.scientists.update(id, { accountStatus: 'active' }); flash('Account approved!'); };
  const handleReject = async (id) => { if (window.confirm("Reject?")) await db.scientists.delete(id); };
  const handlePromote = async (id) => { await db.scientists.update(id, { role: 'admin' }); flash('Promoted!'); };
  const handleDemote = async (id) => { await db.scientists.update(id, { role: 'scientist' }); };
  const handleRemoveUser = async (id) => { if (window.confirm("Remove?")) await db.scientists.delete(id); };
  const handleRemovePost = async (id) => { if (window.confirm("Delete post?")) await db.scicomm_posts.delete(id); };

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

  const tabs = [
    { id: 'pending', label: `Pending (${pendingAccounts.length})`, icon: <Clock size={14} /> },
    { id: 'users', label: 'Users', icon: <Shield size={14} /> },
    { id: 'tasks', label: 'Tasks', icon: <Calendar size={14} /> },
    { id: 'warnings', label: 'Warnings', icon: <AlertTriangle size={14} /> },
    { id: 'meetings', label: 'Meetings', icon: <Link2 size={14} /> },
    { id: 'posts', label: 'Posts', icon: <Trash2 size={14} /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={14} /> },
  ];

  // Analytics data
  const getAnalytics = (member) => {
    const likesReceived = posts.filter(p => String(p.authorId) === String(member.id)).reduce((s, p) => s + Object.values(p.reactions || {}).reduce((ss, arr) => ss + arr.length, 0), 0);
    const completedTasks = tasksData.filter(t => String(t.assignedTo) === String(member.id) && t.status === 'Completed').length;
    const pendingTasks = tasksData.filter(t => String(t.assignedTo) === String(member.id) && t.status !== 'Completed').length;
    const connectionCount = connectionsData.filter(c => c.status === 'accepted' && (String(c.fromId) === String(member.id) || String(c.toId) === String(member.id))).length;
    const meetingsAttended = meetingsData.filter(m => (m.attendees || []).includes(member.id)).length;
    const postCount = posts.filter(p => String(p.authorId) === String(member.id)).length;
    const warnings = warningsData.filter(w => String(w.userId) === String(member.id) && w.status !== 'removed').length;
    const score = calculateScore({ completedTasks, likesReceived, connectionCount, meetingsAttended, tagsCount: (member.pinnedTags || []).length });
    return { likesReceived, completedTasks, pendingTasks, connectionCount, meetingsAttended, postCount, warnings, score };
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
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>{s.name} <span style={{ background: s.role === 'master' ? '#fef08a' : s.role === 'admin' ? '#bbf7d0' : '#eef3f8', padding: '2px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: 600, marginLeft: '4px' }}>{s.role}</span></div>
                      <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.5)' }}>@{s.username} • {s.email || 'No email'} • {s.department || 'No department'}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    {s.role !== 'master' && (
                      <>
                        {s.role === 'scientist' ? <button onClick={() => handlePromote(s.id)} className="scicomm-btn-secondary" style={{ padding: '4px 10px', fontSize: '11px' }}>Promote</button> : isMaster && <button onClick={() => handleDemote(s.id)} style={{ padding: '4px 10px', fontSize: '11px', border: '1px solid #e0dfdc', borderRadius: '24px', background: 'transparent', cursor: 'pointer' }}>Demote</button>}
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
                        <button onClick={() => handleRemoveUser(s.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><UserX size={16} /></button>
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
    </div>
  );
}
