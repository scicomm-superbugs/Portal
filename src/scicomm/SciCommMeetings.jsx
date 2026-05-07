import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLiveCollection, db } from '../db';
import { Calendar, Clock, Link2, Users, CheckCircle, UserCircle } from 'lucide-react';
import { AVATARS, timeAgo } from './scicommConstants';

export default function SciCommMeetings() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin' || user.role === 'master';
  const scientists = useLiveCollection('scientists') || [];
  const meetings = useLiveCollection('scicomm_meetings') || [];
  const [tab, setTab] = useState('upcoming');
  const [form, setForm] = useState({ title: '', description: '', date: '', time: '', link: '', selectedMembers: [] });
  const [msg, setMsg] = useState('');

  const activeMembers = scientists.filter(s => s.accountStatus !== 'pending');
  const now = new Date();

  // Admin sees all, normal user sees only what they're invited to
  const visibleMeetings = isAdmin ? meetings : meetings.filter(m => (m.members || []).includes(user.id) || m.allMembers);
  const myMeetings = meetings.filter(m => (m.members || []).includes(user.id) || m.allMembers);

  const upcomingMeetings = visibleMeetings.filter(m => new Date(m.date + 'T' + (m.time || '23:59')) > now).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const pastMeetings = visibleMeetings.filter(m => new Date(m.date + 'T' + (m.time || '23:59')) <= now).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const renderAvatar = (member, size = 28) => {
    if (!member) return null;
    if (member.avatar) return <img src={member.avatar} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />;
    const av = AVATARS.find(a => a.id === member.avatarId);
    if (av) return <div style={{ width: size, height: size, borderRadius: '50%', background: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.45 }}>{av.emoji}</div>;
    return <div style={{ width: size, height: size, borderRadius: '50%', background: '#eef3f8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><UserCircle size={size * 0.5} color="#666" /></div>;
  };

  const handleSchedule = async (e) => {
    e.preventDefault();
    if (!form.title || !form.date) return;
    const members = form.selectedMembers.length === 0 ? activeMembers.map(s => s.id) : form.selectedMembers;
    await db.scicomm_meetings.add({
      title: form.title,
      description: form.description,
      date: form.date,
      time: form.time,
      link: form.link,
      members,
      allMembers: form.selectedMembers.length === 0,
      createdBy: user.name,
      createdAt: new Date().toISOString(),
      attendees: []
    });
    setForm({ title: '', description: '', date: '', time: '', link: '', selectedMembers: [] });
    setMsg('Meeting scheduled!');
    setTimeout(() => setMsg(''), 3000);
    // Push notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('📅 New Meeting Scheduled', { body: form.title, icon: './aiu_scicomm_logo.png' });
    }
  };

  const handleConfirmAttendance = async (meetingId) => {
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting) return;
    const attendees = meeting.attendees || [];
    if (attendees.includes(user.id)) return;
    await db.scicomm_meetings.update(meetingId, { attendees: [...attendees, user.id] });
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete this meeting?")) {
      await db.scicomm_meetings.delete(id);
    }
  };

  const toggleMember = (id) => {
    setForm(f => ({
      ...f,
      selectedMembers: f.selectedMembers.includes(id) ? f.selectedMembers.filter(x => x !== id) : [...f.selectedMembers, id]
    }));
  };

  const renderMeeting = (m) => {
    const isPast = new Date(m.date + 'T' + (m.time || '23:59')) <= now;
    const iAmAttending = (m.attendees || []).includes(user.id);
    const iAmInvited = (m.members || []).includes(user.id) || m.allMembers;
    return (
      <div key={m.id} style={{ padding: '16px', borderBottom: '1px solid #eef3f8' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: '16px' }}>{m.title}</h3>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '13px', color: 'rgba(0,0,0,0.6)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={14} /> {new Date(m.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
              {m.time && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={14} /> {m.time}</span>}
              <span>By {m.createdBy}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ background: isPast ? '#f3f2ef' : '#eff6ff', color: isPast ? '#666' : '#1e3a8a', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}>{isPast ? 'Past' : 'Upcoming'}</span>
            <span style={{ background: '#eef3f8', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}>{(m.attendees || []).length} confirmed</span>
          </div>
        </div>
        {m.description && <p style={{ margin: '8px 0', fontSize: '14px', color: 'rgba(0,0,0,0.7)' }}>{m.description}</p>}
        <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
          {m.link && <a href={m.link} target="_blank" rel="noopener noreferrer" className="scicomm-btn-primary" style={{ textDecoration: 'none', padding: '6px 16px', fontSize: '13px' }}><Link2 size={14} /> Join Meeting</a>}
          {isAdmin && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>Mark Attendance:</span>
              <select onChange={(e) => {
                const userId = e.target.value;
                if (!userId) return;
                const att = m.attendees || [];
                if (!att.includes(userId)) {
                  db.scicomm_meetings.update(m.id, { attendees: [...att, userId] });
                }
                e.target.value = "";
              }} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px' }}>
                <option value="">Select Member...</option>
                {activeMembers.map(s => <option key={s.id} value={s.id}>{s.name} {(m.attendees||[]).includes(s.id)? '✅' : ''}</option>)}
              </select>
            </div>
          )}
          {isAdmin && <button onClick={() => handleDelete(m.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '13px', marginLeft: 'auto' }}>Delete</button>}
        </div>
      </div>
    );
  };

  return (
    <div className="scicomm-feed-layout">
      <div className="scicomm-sidebar-left hide-on-mobile">
        <div className="scicomm-card scicomm-card-padding">
          <h3 style={{ margin: '0 0 12px', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><Calendar size={18} color="#1d4ed8" /> Meetings</h3>
          <div style={{ fontSize: '13px', color: 'rgba(0,0,0,0.6)', lineHeight: '2' }}>
            <div>Upcoming: <strong style={{ color: '#1d4ed8' }}>{upcomingMeetings.length}</strong></div>
            <div>My meetings: <strong>{myMeetings.length}</strong></div>
            <div>Past: <strong>{pastMeetings.length}</strong></div>
          </div>
        </div>
      </div>

      <div className="scicomm-feed-main">
        {msg && <div style={{ background: '#fef3c7', color: '#92400e', padding: '12px 16px', borderRadius: '8px', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>✅ {msg}</div>}

        {/* Schedule (Admin) */}
        {isAdmin && (
          <div className="scicomm-card scicomm-card-padding" style={{ marginBottom: '8px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '18px' }}>📅 Schedule Meeting</h3>
            <form onSubmit={handleSchedule} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input type="text" placeholder="Meeting Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required style={{ padding: '10px 14px', border: '1px solid #e0dfdc', borderRadius: '8px', fontSize: '14px' }} />
              <textarea placeholder="Description (optional)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} style={{ padding: '10px 14px', border: '1px solid #e0dfdc', borderRadius: '8px', fontSize: '14px', resize: 'vertical' }} />
              <div style={{ display: 'flex', gap: '10px' }}>
                <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required style={{ flex: 1, padding: '10px 14px', border: '1px solid #e0dfdc', borderRadius: '8px', fontSize: '14px' }} />
                <input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} style={{ flex: 1, padding: '10px 14px', border: '1px solid #e0dfdc', borderRadius: '8px', fontSize: '14px' }} />
              </div>
              <input type="url" placeholder="Meeting Link (Zoom, Teams, etc.)" value={form.link} onChange={e => setForm({ ...form, link: e.target.value })} style={{ padding: '10px 14px', border: '1px solid #e0dfdc', borderRadius: '8px', fontSize: '14px' }} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Invite: <span style={{ fontWeight: 400, color: 'rgba(0,0,0,0.5)' }}>(empty = all members)</span></div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {activeMembers.filter(s => s.role !== 'master').map(s => (
                    <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer', padding: '4px 8px', borderRadius: '16px', background: form.selectedMembers.includes(s.id) ? '#eff6ff' : '#f3f2ef', border: form.selectedMembers.includes(s.id) ? '1px solid #1d4ed8' : '1px solid transparent' }}>
                      <input type="checkbox" checked={form.selectedMembers.includes(s.id)} onChange={() => toggleMember(s.id)} style={{ display: 'none' }} />
                      {s.name}
                    </label>
                  ))}
                </div>
              </div>
              <button type="submit" className="scicomm-btn-primary" style={{ padding: '10px', fontSize: '15px' }}>📅 Schedule Meeting</button>
            </form>
          </div>
        )}

        {/* Tabs */}
        <div className="scicomm-card" style={{ display: 'flex', overflow: 'hidden', marginBottom: '8px' }}>
          {[{ id: 'upcoming', label: 'Upcoming' }, { id: 'past', label: 'Past' }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, padding: '12px', border: 'none', background: tab === t.id ? '#1d4ed8' : 'transparent',
              color: tab === t.id ? 'white' : 'rgba(0,0,0,0.6)', fontWeight: 600, cursor: 'pointer', fontSize: '14px'
            }}>{t.label}</button>
          ))}
        </div>

        <div className="scicomm-card">
          {(tab === 'upcoming' ? upcomingMeetings : pastMeetings).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>📅</div>
              <p>No {tab} meetings.</p>
            </div>
          ) : (tab === 'upcoming' ? upcomingMeetings : pastMeetings).map(renderMeeting)}
        </div>
      </div>
    </div>
  );
}
