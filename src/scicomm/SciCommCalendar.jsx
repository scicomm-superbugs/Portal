import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveCollection, db } from '../db';
import { useAuth } from '../context/AuthContext';
import { ChevronLeft, ChevronRight, Plus, User as UserIcon, X, Calendar as CalIcon } from 'lucide-react';
import SciCommVerificationBadge from './SciCommVerificationBadge';

export default function SciCommCalendar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user.role === 'admin' || user.role === 'master';
  
  const tasksData = useLiveCollection('tasks') || [];
  const meetingsData = useLiveCollection('scicomm_meetings') || [];
  const warningsData = useLiveCollection('scicomm_warnings') || [];
  const scientists = useLiveCollection('scientists') || [];
  
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [selectedUserId, setSelectedUserId] = useState(user.id);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({ date: '', title: '', type: 'personal', startTime: '', endTime: '' });
  const [selectedDay, setSelectedDay] = useState(null);
  const [viewMode, setViewMode] = useState('month'); // month | week | day

  const targetUser = scientists.find(s => String(s.id) === String(selectedUserId));
  const now = new Date();

  const userTasks = tasksData.filter(t => String(t.assignedTo) === String(selectedUserId));
  const userMeetings = meetingsData.filter(m => (m.attendees || []).includes(selectedUserId) || m.allMembers);
  const userWarnings = warningsData.filter(w => String(w.userId) === String(selectedUserId));
  const userPersonalEvents = targetUser?.personalEvents || [];

  const getDaysInMonth = (m, y) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (m, y) => new Date(y, m, 1).getDay();
  const daysInMonth = getDaysInMonth(calMonth, calYear);
  const firstDay = getFirstDayOfMonth(calMonth, calYear);
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const getEventsForDate = (day) => {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const tasks = userTasks.filter(t => t.dueDate === dateStr);
    const meetings = userMeetings.filter(m => m.date === dateStr);
    const warnings = userWarnings.filter(w => w.issuedAt?.startsWith(dateStr));
    const personal = userPersonalEvents.filter(e => e.date === dateStr);
    return { tasks, meetings, warnings, personal, dateStr };
  };

  const handleAddPersonalEvent = async (e) => {
    e.preventDefault();
    if (!newEvent.date || !newEvent.title) return;
    const updatedEvents = [...(targetUser?.personalEvents || []), { ...newEvent, id: Date.now() }];
    await db.scientists.update(selectedUserId, { personalEvents: updatedEvents });
    setShowAddEvent(false);
    setNewEvent({ date: '', title: '', type: 'personal', startTime: '', endTime: '' });
  };

  const handleDeletePersonalEvent = async (eventId) => {
    const updatedEvents = (targetUser?.personalEvents || []).filter(e => e.id !== eventId);
    await db.scientists.update(selectedUserId, { personalEvents: updatedEvents });
  };

  const prevMonth = () => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); };
  const nextMonth = () => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); };

  const dayAgenda = selectedDay ? getEventsForDate(selectedDay) : null;

  return (
    <div className="scicomm-card scicomm-card-padding" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      
      {isAdmin && (
        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', background: '#eef3f8', padding: '10px', borderRadius: '8px', flexWrap: 'wrap' }}>
          <UserIcon size={16} />
          <strong style={{ fontSize: '13px' }}>Viewing:</strong>
          <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc', flex: 1, minWidth: '150px' }}>
            <option value={user.id}>My Calendar</option>
            {scientists.filter(s => String(s.id) !== String(user.id) && s.accountStatus === 'active').map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.department || 'Member'})</option>
            ))}
          </select>
          {targetUser && (
            <SciCommVerificationBadge role={targetUser.role} size={16} style={{ marginLeft: '4px' }} />
          )}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={prevMonth} style={{ background: 'none', border: '1px solid #e0dfdc', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronLeft size={16} /></button>
          <h2 style={{ margin: 0, fontSize: '20px' }}>{monthNames[calMonth]} {calYear}</h2>
          <button onClick={nextMonth} style={{ background: 'none', border: '1px solid #e0dfdc', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronRight size={16} /></button>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button className="scicomm-btn-primary" onClick={() => setShowAddEvent(true)} style={{ padding: '6px 12px', fontSize: '13px' }}><Plus size={14} /> Add Event</button>
        </div>
      </div>

      {showAddEvent && (
        <form onSubmit={handleAddPersonalEvent} style={{ background: '#f9fafb', padding: '16px', borderRadius: '8px', marginBottom: '16px', border: '1px solid #e0dfdc' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '15px' }}>Add Personal Event / Unavailable Time</h3>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input type="date" value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} required style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
            <input type="text" placeholder="Event Title (e.g., Lecture, Exam)" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} required style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', flex: 1, minWidth: '150px' }} />
            <input type="time" value={newEvent.startTime} onChange={e => setNewEvent({...newEvent, startTime: e.target.value})} placeholder="Start" style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
            <input type="time" value={newEvent.endTime} onChange={e => setNewEvent({...newEvent, endTime: e.target.value})} placeholder="End" style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
            <button type="submit" className="scicomm-btn-primary">Save</button>
            <button type="button" className="scicomm-btn-secondary" onClick={() => setShowAddEvent(false)}>Cancel</button>
          </div>
          <p style={{ fontSize: '11px', color: '#666', margin: '6px 0 0' }}>This event will be visible to Admins to avoid scheduling conflicts.</p>
        </form>
      )}

      {/* Calendar Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: '12px', fontWeight: 600, color: 'rgba(0,0,0,0.5)', padding: '8px 0' }}>{d}</div>
        ))}
        {Array.from({ length: firstDay }).map((_, i) => <div key={'e' + i}></div>)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const ev = getEventsForDate(day);
          const isToday = day === now.getDate() && calMonth === now.getMonth() && calYear === now.getFullYear();
          const isSelected = selectedDay === day;
          const hasEvents = ev.tasks.length + ev.meetings.length + ev.personal.length + ev.warnings.length > 0;
          return (
            <div key={day} onClick={() => setSelectedDay(isSelected ? null : day)} style={{ minHeight: '70px', border: isSelected ? '2px solid #1d4ed8' : '1px solid #eef3f8', borderRadius: '4px', padding: '4px', background: isToday ? '#eff6ff' : isSelected ? '#f0fdf4' : 'white', cursor: 'pointer', position: 'relative', transition: 'all 0.15s' }}>
              <div style={{ fontSize: '12px', fontWeight: isToday ? 700 : 400, color: isToday ? '#1d4ed8' : 'rgba(0,0,0,0.7)', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                <span>{day}</span>
                {hasEvents && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1d4ed8', display: 'inline-block' }}></span>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {ev.tasks.slice(0, 2).map((t, j) => (
                  <div key={'t'+j} style={{ fontSize: '9px', background: t.status === 'Completed' || t.status === 'Approved' ? '#fef3c7' : '#fef3c7', padding: '1px 4px', borderRadius: '3px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', color: '#333' }}>
                    📋 {t.title}
                  </div>
                ))}
                {ev.meetings.slice(0, 1).map((m, j) => (
                  <div key={'m'+j} style={{ fontSize: '9px', background: '#dbeafe', padding: '1px 4px', borderRadius: '3px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', color: '#1e3a8a' }}>
                    📅 {m.title}
                  </div>
                ))}
                {ev.personal.slice(0, 1).map((p, j) => (
                  <div key={'p'+j} style={{ fontSize: '9px', background: '#f3f4f6', padding: '1px 4px', borderRadius: '3px', color: '#4b5563', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    📌 {p.title}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Day Agenda Detail Panel */}
      {selectedDay && dayAgenda && (
        <div style={{ marginTop: '16px', background: '#f9fafb', border: '1px solid #e0dfdc', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CalIcon size={18} color="#1d4ed8" />
              {monthNames[calMonth]} {selectedDay}, {calYear}
            </h3>
            <button onClick={() => setSelectedDay(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
          </div>

          {dayAgenda.tasks.length === 0 && dayAgenda.meetings.length === 0 && dayAgenda.personal.length === 0 && dayAgenda.warnings.length === 0 ? (
            <p style={{ color: '#666', textAlign: 'center', padding: '20px' }}>No events scheduled for this day.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {dayAgenda.tasks.map(t => (
                <div key={t.id} onClick={() => navigate('/tasks')} style={{ display: 'flex', gap: '10px', padding: '12px', background: 'white', borderRadius: '8px', border: '1px solid #e0dfdc', cursor: 'pointer', transition: 'box-shadow 0.15s' }} onMouseOver={e => e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)'} onMouseOut={e => e.currentTarget.style.boxShadow='none'}>
                  <div style={{ width: 40, height: 40, borderRadius: '8px', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>📋</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{t.title}</div>
                    <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.5)' }}>Status: {t.status || 'Pending'} • Priority: {t.priority || 'Medium'}{t.dueTime ? ` • Due: ${t.dueTime}` : ''}</div>
                    {t.description && <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.6)', marginTop: '4px' }}>{t.description}</div>}
                  </div>
                  <div style={{ fontSize: '11px', color: '#1d4ed8', fontWeight: 600, alignSelf: 'center' }}>View →</div>
                </div>
              ))}
              {dayAgenda.meetings.map(m => (
                <div key={m.id} onClick={() => navigate('/meetings')} style={{ display: 'flex', gap: '10px', padding: '12px', background: 'white', borderRadius: '8px', border: '1px solid #dbeafe', cursor: 'pointer', transition: 'box-shadow 0.15s' }} onMouseOver={e => e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)'} onMouseOut={e => e.currentTarget.style.boxShadow='none'}>
                  <div style={{ width: 40, height: 40, borderRadius: '8px', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>📅</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{m.title}</div>
                    <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.5)' }}>Time: {m.time || 'TBD'} • Location: {m.location || 'TBD'}</div>
                  </div>
                  <div style={{ fontSize: '11px', color: '#1d4ed8', fontWeight: 600, alignSelf: 'center' }}>View →</div>
                </div>
              ))}
              {dayAgenda.personal.map(p => (
                <div key={p.id} style={{ display: 'flex', gap: '10px', padding: '12px', background: 'white', borderRadius: '8px', border: '1px dashed #9ca3af' }}>
                  <div style={{ width: 40, height: 40, borderRadius: '8px', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>📌</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{p.title}</div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>{p.startTime ? `${p.startTime}${p.endTime ? ' - ' + p.endTime : ''}` : 'All day'} • Personal / Unavailable</div>
                  </div>
                  {String(selectedUserId) === String(user.id) && (
                    <button onClick={() => handleDeletePersonalEvent(p.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '18px' }}>×</button>
                  )}
                </div>
              ))}
              {dayAgenda.warnings.map(w => (
                <div key={w.id} style={{ display: 'flex', gap: '10px', padding: '12px', background: '#fee2e2', borderRadius: '8px', border: '1px solid #fca5a5' }}>
                  <div style={{ width: 40, height: 40, borderRadius: '8px', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>⚠️</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: '#991b1b' }}>Warning Issued</div>
                    <div style={{ fontSize: '12px', color: '#991b1b' }}>{w.message}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
