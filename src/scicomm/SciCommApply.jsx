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
    <div className="scicomm-apply-card">
      <h1 className="scicomm-apply-title">Join the Science Communication Team</h1>
      
      <div className="scicomm-apply-instructions">
        <h2 className="scicomm-apply-instructions-title">Instructions</h2>
        <p className="scicomm-apply-instructions-text">
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
        <div className="scicomm-status-block scicomm-status-block-pending">
          <Clock size={40} style={{ marginBottom: '12px' }} />
          <h3>Application Under Review</h3>
          <p>We have received your application. The admins are reviewing your profile and eligibility. You will be notified once a decision is made.</p>
        </div>
      )}

      {myApplication && myApplication.status === 'approved' && isTeam && (
        <div className="scicomm-status-block scicomm-status-block-approved">
          <CheckCircle size={40} style={{ marginBottom: '12px' }} />
          <h3>Application Approved!</h3>
          <p>Welcome to the team! You now have access to all workspace tools.</p>
        </div>
      )}

      {myApplication && myApplication.status === 'approved' && !isTeam && (
        <div style={{ textAlign: 'center' }}>
          <div className="scicomm-status-block scicomm-status-block-rejected">
            <XCircle size={40} style={{ marginBottom: '12px' }} />
            <h3>Profile Downgraded</h3>
            <p>Your profile has been downgraded by admins. You no longer have team access. Update your profile and try again.</p>
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
          <div className="scicomm-status-block scicomm-status-block-rejected">
            <XCircle size={40} style={{ marginBottom: '12px' }} />
            <h3>Application Not Approved</h3>
            <p>Thank you for your interest. Unfortunately, you do not meet the criteria at this time. You can update your profile and try again later.</p>
            {myApplication.comment && (
              <div className="scicomm-feedback-box">
                <strong>Admin Feedback:</strong>
                {myApplication.comment}
              </div>
            )}
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
