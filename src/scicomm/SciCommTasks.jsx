import { useState } from 'react';
import { useLiveCollection, db, uploadFile } from '../db';
import { useAuth } from '../context/AuthContext';
import { Briefcase, CheckCircle, Clock, AlertCircle, FileText, Upload, Link as LinkIcon } from 'lucide-react';

export default function SciCommTasks() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin' || user.role === 'master';
  const tasksData = useLiveCollection('tasks') || [];
  const scientists = useLiveCollection('scientists') || [];

  const myTasks = isAdmin ? tasksData : tasksData.filter(t => String(t.assignedTo) === String(user.id));
  const pendingTasks = myTasks.filter(t => t.status !== 'Completed' && t.status !== 'Approved');
  const reviewTasks = myTasks.filter(t => t.status === 'Review');
  const completedTasks = myTasks.filter(t => t.status === 'Completed' || t.status === 'Approved');
  const now = new Date();

  const [activeTask, setActiveTask] = useState(null);
  const [submissionType, setSubmissionType] = useState('link'); // link, file, text
  const [submissionValue, setSubmissionValue] = useState('');
  const [submissionFile, setSubmissionFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleStatusChange = async (id, newStatus) => {
    await db.tasks.update(id, { status: newStatus });
  };

  const handleSubmission = async (e, taskId) => {
    e.preventDefault();
    setIsUploading(true);
    let finalUrl = submissionValue;

    if (submissionType === 'file' && submissionFile) {
      try {
        finalUrl = await uploadFile(submissionFile, `task_submissions/${taskId}_${Date.now()}_${submissionFile.name}`);
      } catch (err) {
        alert("File upload failed.");
        setIsUploading(false);
        return;
      }
    }

    await db.tasks.update(taskId, {
      status: 'Review',
      submissionType,
      submissionValue: finalUrl,
      submittedAt: new Date().toISOString()
    });

    const task = tasksData.find(t => t.id === taskId);
    if (task && task.assignedBy) {
      await db.scicomm_notifications.add({
        userId: task.assignedBy,
        type: 'task_submitted',
        senderId: user.id,
        title: `${user.name.split(' ')[0]} submitted a task for review`,
        message: task.title,
        link: '/tasks',
        createdAt: new Date().toISOString(),
        read: false
      });
    }
    
    setIsUploading(false);
    setActiveTask(null);
    setSubmissionValue('');
    setSubmissionFile(null);
  };

  const [evalPoints, setEvalPoints] = useState({});
  const [evalNote, setEvalNote] = useState({});

  const handleApproveTask = async (taskId) => {
    const points = parseInt(evalPoints[taskId]) || 25;
    await db.tasks.update(taskId, { status: 'Approved', approvedAt: new Date().toISOString(), awardedPoints: points, evalNote: evalNote[taskId] || '' });
    const task = tasksData.find(t => t.id === taskId);
    if (task) {
      await db.scicomm_notifications.add({
        userId: task.assignedTo,
        type: 'task_approved',
        senderId: user.id,
        title: `Your task was approved!`,
        message: `${task.title} (+${points} pts)`,
        link: '/tasks',
        createdAt: new Date().toISOString(),
        read: false
      });
    }
  };

  const handleRejectTask = async (taskId) => {
    await db.tasks.update(taskId, { status: 'In Progress', submissionValue: null, submittedAt: null });
    const task = tasksData.find(t => t.id === taskId);
    if (task) {
      await db.scicomm_notifications.add({
        userId: task.assignedTo,
        type: 'task_rejected',
        senderId: user.id,
        title: `Your task requires revisions`,
        message: task.title,
        link: '/tasks',
        createdAt: new Date().toISOString(),
        read: false
      });
    }
  };

  const handleDelete = async (id) => { if (window.confirm("Delete?")) await db.tasks.delete(id); };
  const getAssignee = (id) => scientists.find(s => String(s.id) === String(id))?.name || 'Unknown';

  const getPriorityStyle = (p) => {
    if (p === 'Urgent') return { bg: '#fee2e2', color: '#991b1b', icon: '🔴' };
    if (p === 'High') return { bg: '#ffedd5', color: '#9a3412', icon: '🟠' };
    if (p === 'Medium') return { bg: '#fef3c7', color: '#92400e', icon: '🟡' };
    return { bg: '#eff6ff', color: '#1e3a8a', icon: '🟢' };
  };

  const getStatusBadge = (status) => {
    if (status === 'Review') return <span style={{ background: '#fef08a', color: '#854d0e', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600 }}>Needs Review</span>;
    if (status === 'In Progress') return <span style={{ background: '#bfdbfe', color: '#1e3a8a', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600 }}>In Progress</span>;
    if (status === 'Approved' || status === 'Completed') return <span style={{ background: '#bbf7d0', color: '#92400e', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600 }}>Approved</span>;
    return <span style={{ background: '#e2e8f0', color: '#475569', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600 }}>Pending</span>;
  };

  return (
    <div className="scicomm-feed-layout">
      <div className="scicomm-sidebar-left hide-on-mobile">
        <div className="scicomm-card scicomm-card-padding">
          <h3 style={{ margin: '0 0 12px', fontSize: '16px' }}><Briefcase size={16} color="#1d4ed8" /> {isAdmin ? 'All Tasks' : 'My Tasks'}</h3>
          <div style={{ fontSize: '13px', color: 'rgba(0,0,0,0.6)', lineHeight: '2' }}>
            <div>Active: <strong style={{ color: '#f59e0b' }}>{pendingTasks.length}</strong></div>
            {isAdmin && <div>To Review: <strong style={{ color: '#8b5cf6' }}>{reviewTasks.length}</strong></div>}
            <div>Approved: <strong style={{ color: '#1d4ed8' }}>{completedTasks.length}</strong></div>
          </div>
        </div>
      </div>

      <div className="scicomm-feed-main">
        <div className="scicomm-card scicomm-card-padding">
          <h2 style={{ margin: '0 0 16px', fontSize: '20px' }}>📋 Task Workflow</h2>
          
          {isAdmin && reviewTasks.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '15px', margin: '0 0 10px', color: '#8b5cf6' }}><CheckCircle size={16} /> Needs Admin Review ({reviewTasks.length})</h3>
              {reviewTasks.map(t => (
                <div key={t.id} style={{ padding: '14px', marginBottom: '6px', borderRadius: '8px', border: '1px solid #c4b5fd', background: '#f3f0ff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <h4 style={{ margin: 0, fontSize: '15px' }}>{t.title}</h4>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#6d28d9' }}>{getAssignee(t.assignedTo)}</span>
                  </div>
                  <div style={{ background: 'white', padding: '10px', borderRadius: '6px', fontSize: '13px', border: '1px solid #ddd' }}>
                    <strong>Submission:</strong>{' '}
                    {t.submissionType === 'link' || t.submissionType === 'file' ? (
                      <a href={t.submissionValue} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>Open Attachment/Link</a>
                    ) : (
                      <span>{t.submissionValue}</span>
                    )}
                  </div>
                  {/* Evaluation Section */}
                  <div style={{ marginTop: '10px', padding: '10px', background: '#eff6ff', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e3a8a', marginBottom: '6px' }}>⭐ Task Evaluation</div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '6px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 600 }}>Points:</label>
                      <select value={evalPoints[t.id] || '25'} onChange={e => setEvalPoints(p => ({...p, [t.id]: e.target.value}))} style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #bfdbfe', fontSize: '13px', fontWeight: 600 }}>
                        <option value="5">5 — Poor</option>
                        <option value="10">10 — Below Average</option>
                        <option value="15">15 — Average</option>
                        <option value="20">20 — Good</option>
                        <option value="25">25 — Very Good</option>
                        <option value="30">30 — Excellent</option>
                        <option value="40">40 — Outstanding</option>
                        <option value="50">50 — Exceptional</option>
                      </select>
                    </div>
                    <input type="text" placeholder="Evaluation note (optional)..." value={evalNote[t.id] || ''} onChange={e => setEvalNote(p => ({...p, [t.id]: e.target.value}))} style={{ width: '100%', padding: '6px 10px', border: '1px solid #bfdbfe', borderRadius: '6px', fontSize: '12px', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button className="scicomm-btn-primary" onClick={() => handleApproveTask(t.id)}>✅ Approve ({evalPoints[t.id] || 25} pts)</button>
                    <button className="scicomm-btn-secondary" onClick={() => handleRejectTask(t.id)} style={{ color: '#ef4444', borderColor: '#ef4444' }}>Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {pendingTasks.length === 0 && (isAdmin ? reviewTasks.length === 0 : true) && completedTasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
              <p>{isAdmin ? 'No tasks. Assign some from Admin Dashboard.' : 'No tasks. Great job!'}</p>
            </div>
          ) : (
            <>
              {pendingTasks.length > 0 && (
                <>
                  <h3 style={{ fontSize: '15px', margin: '0 0 10px', color: '#f59e0b' }}><Clock size={16} /> Active ({pendingTasks.length})</h3>
                  {pendingTasks.map(t => {
                    const ps = getPriorityStyle(t.priority);
                    const overdue = t.dueDate && new Date(t.dueDate) < now;
                    return (
                      <div key={t.id} style={{ display: 'flex', gap: '12px', padding: '14px', marginBottom: '6px', borderRadius: '8px', border: overdue ? '1px solid #fca5a5' : '1px solid #e0dfdc', background: overdue ? '#fff5f5' : 'white' }}>
                        <div style={{ width: '40px', height: '40px', background: ps.bg, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>{ps.icon}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                            <h4 style={{ margin: 0, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px' }}>{t.title} {getStatusBadge(t.status)}</h4>
                            <span style={{ background: ps.bg, color: ps.color, padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600 }}>{t.priority || 'Medium'}</span>
                          </div>
                          {isAdmin && <div style={{ fontSize: '12px', color: '#1d4ed8', fontWeight: 600 }}>→ {getAssignee(t.assignedTo)}</div>}
                          {t.description && <p style={{ margin: '4px 0', fontSize: '13px', color: 'rgba(0,0,0,0.6)' }}>{t.description}</p>}
                          <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.5)', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            <span>📅 {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'TBD'}</span>
                            {overdue && <span style={{ color: '#ef4444', fontWeight: 600 }}>⚠ Overdue</span>}
                          </div>
                          
                          <div style={{ marginTop: '12px', padding: '10px', background: '#f9fafb', borderRadius: '8px', border: '1px dashed #ccc' }}>
                            {(!t.status || t.status === 'Pending') && (
                              <button className="scicomm-btn-primary" onClick={() => handleStatusChange(t.id, 'In Progress')}>Start Task</button>
                            )}
                            
                            {t.status === 'In Progress' && (
                              activeTask === t.id ? (
                                <form onSubmit={(e) => handleSubmission(e, t.id)} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  <div style={{ fontSize: '13px', fontWeight: 600 }}>Submit Work:</div>
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    <label style={{ fontSize: '12px' }}><input type="radio" checked={submissionType==='link'} onChange={()=>setSubmissionType('link')} /> Link</label>
                                    <label style={{ fontSize: '12px' }}><input type="radio" checked={submissionType==='file'} onChange={()=>setSubmissionType('file')} /> File Upload</label>
                                    <label style={{ fontSize: '12px' }}><input type="radio" checked={submissionType==='text'} onChange={()=>setSubmissionType('text')} /> Text Entry</label>
                                  </div>
                                  
                                  {submissionType === 'link' && <input type="url" placeholder="Paste URL..." value={submissionValue} onChange={e=>setSubmissionValue(e.target.value)} required style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} />}
                                  {submissionType === 'text' && <textarea placeholder="Describe completion..." value={submissionValue} onChange={e=>setSubmissionValue(e.target.value)} required rows={2} style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} />}
                                  {submissionType === 'file' && <input type="file" onChange={e=>setSubmissionFile(e.target.files[0])} required style={{ fontSize: '13px' }} />}
                                  
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    <button type="submit" className="scicomm-btn-primary" disabled={isUploading}>{isUploading ? 'Uploading...' : 'Submit for Review'}</button>
                                    <button type="button" className="scicomm-btn-secondary" onClick={() => setActiveTask(null)}>Cancel</button>
                                  </div>
                                </form>
                              ) : (
                                <button className="scicomm-btn-primary" style={{ background: '#2563eb' }} onClick={() => setActiveTask(t.id)}>Submit Task</button>
                              )
                            )}

                            {!isAdmin && t.status === 'Review' && (
                              <div style={{ fontSize: '13px', color: '#854d0e' }}>Awaiting Admin Approval</div>
                            )}
                          </div>
                          
                          {isAdmin && (
                            <div style={{ marginTop: '8px' }}>
                              <button style={{ padding: '4px 14px', fontSize: '12px', border: '1px solid #e0dfdc', borderRadius: '24px', background: 'transparent', cursor: 'pointer', color: '#ef4444' }} onClick={() => handleDelete(t.id)}>Delete Task</button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
              {completedTasks.length > 0 && (
                <>
                  <h3 style={{ fontSize: '15px', margin: '20px 0 10px', color: '#1d4ed8' }}><CheckCircle size={16} /> Approved & Completed ({completedTasks.length})</h3>
                  {completedTasks.slice(0, 8).map(t => (
                    <div key={t.id} style={{ display: 'flex', gap: '10px', padding: '8px 12px', borderRadius: '6px', background: '#f9fafb', marginBottom: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span>✅</span>
                      <span style={{ fontSize: '13px', flex: 1 }}>{t.title}</span>
                      {t.awardedPoints && <span style={{ background: '#dbeafe', color: '#1e3a8a', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700 }}>+{t.awardedPoints} pts</span>}
                      {t.evalNote && <span style={{ fontSize: '11px', color: 'rgba(0,0,0,0.4)', fontStyle: 'italic' }}>"{t.evalNote}"</span>}
                      {isAdmin && <span style={{ fontSize: '11px', color: 'rgba(0,0,0,0.4)' }}>→ {getAssignee(t.assignedTo)}</span>}
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
