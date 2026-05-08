import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLiveCollection, db } from '../db';
import { Send, FileText, CheckCircle, XCircle, Clock } from 'lucide-react';

export default function SciCommApply() {
  const { user } = useAuth();
  const applications = useLiveCollection('scicomm_applications') || [];
  const scientists = useLiveCollection('scientists') || [];
  const [applying, setApplying] = useState(false);

  const me = scientists.find(s => String(s.id) === String(user.id));
  const myApplication = applications.find(a => String(a.userId) === String(user.id));

  const handleApply = async () => {
    setApplying(true);
    try {
      await db.scicomm_applications.add({
        userId: user.id,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.error(err);
    }
    setApplying(false);
  };

  const handleReapply = async () => {
    setApplying(true);
    try {
      if (myApplication) {
        await db.scicomm_applications.delete(myApplication.id);
      }
      await db.scicomm_applications.add({
        userId: user.id,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.error(err);
    }
    setApplying(false);
  };

  const isTeam = user.role === 'scicomm' || user.role === 'admin' || user.role === 'master';

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '24px', background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', marginBottom: '16px' }}>Join the Science Communication Team</h1>
      
      <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b', marginBottom: '8px' }}>Instructions</h2>
        <p style={{ fontSize: '14px', color: '#475569', lineHeight: '1.6' }}>
          To join the Science Communication Team, you need to share your experience and scientific background. 
          Make sure your profile is updated with your bio, experience, and any relevant links (like a CV or portfolio).
          Our admins will review your profile to determine eligibility.
        </p>
      </div>

      {!myApplication && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#64748b', marginBottom: '16px', fontSize: '14px' }}>Ready to share your passion for science?</p>
          <button 
            onClick={handleApply} 
            disabled={applying} 
            className="scicomm-btn-primary" 
            style={{ width: '100%', justifyContent: 'center', gap: '8px', padding: '12px' }}
          >
            <Send size={18} /> {applying ? 'Submitting...' : 'Apply Now'}
          </button>
        </div>
      )}

      {myApplication && myApplication.status === 'pending' && (
        <div style={{ textAlign: 'center', padding: '20px', background: '#fef3c7', borderRadius: '8px', color: '#b45309' }}>
          <Clock size={40} style={{ marginBottom: '12px' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>Application Under Review</h3>
          <p style={{ fontSize: '14px' }}>We have received your application. The admins are reviewing your profile and eligibility. You will be notified once a decision is made.</p>
        </div>
      )}

      {myApplication && myApplication.status === 'approved' && isTeam && (
        <div style={{ textAlign: 'center', padding: '20px', background: '#dcfce7', borderRadius: '8px', color: '#15803d' }}>
          <CheckCircle size={40} style={{ marginBottom: '12px' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>Application Approved!</h3>
          <p style={{ fontSize: '14px' }}>Welcome to the team! You now have access to all workspace tools.</p>
        </div>
      )}

      {myApplication && myApplication.status === 'approved' && !isTeam && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ padding: '20px', background: '#fee2e2', borderRadius: '8px', color: '#b91c1c', marginBottom: '16px' }}>
            <XCircle size={40} style={{ marginBottom: '12px' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>Profile Downgraded</h3>
            <p style={{ fontSize: '14px' }}>Your profile has been downgraded by admins. You no longer have team access. Update your profile and try again.</p>
          </div>
          <button 
            onClick={handleReapply} 
            disabled={applying} 
            className="scicomm-btn-primary" 
            style={{ width: '100%', justifyContent: 'center', gap: '8px', padding: '12px', marginBottom: '24px' }}
          >
            <Send size={18} /> {applying ? 'Submitting...' : 'Re-apply Now'}
          </button>
        </div>
      )}

      {myApplication && myApplication.status === 'rejected' && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ padding: '20px', background: '#fee2e2', borderRadius: '8px', color: '#b91c1c', marginBottom: '16px' }}>
            <XCircle size={40} style={{ marginBottom: '12px' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>Application Not Approved</h3>
            <p style={{ fontSize: '14px' }}>Thank you for your interest. Unfortunately, you do not meet the criteria at this time. You can update your profile and try again later.</p>
          </div>
          <button 
            onClick={handleReapply} 
            disabled={applying} 
            className="scicomm-btn-primary" 
            style={{ width: '100%', justifyContent: 'center', gap: '8px', padding: '12px' }}
          >
            <Send size={18} /> {applying ? 'Submitting...' : 'Re-apply Now'}
          </button>
        </div>
      )}
    </div>
  );
}
