import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Settings, Shield, Bell, User, Key, Link as LinkIcon, CheckCircle, AlertCircle } from 'lucide-react';
import { useLiveCollection } from '../db';
import { db } from '../db';

export default function SciCommSettings() {
  const { user, linkGoogleAccount } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  const scientists = useLiveCollection('scientists');
  const me = scientists?.find(s => String(s.id) === String(user?.id));

  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const { changePassword } = useAuth();

  useEffect(() => {
    if (me) {
      if (!editName) setEditName(me.name || '');
      if (!editUsername) setEditUsername(me.username || '');
    }
  }, [me]);

  const handleSaveProfile = async () => {
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      if (!editName.trim() || !editUsername.trim()) {
        throw new Error("Name and username cannot be empty.");
      }
      
      // Check if username is taken
      if (editUsername !== me.username) {
        const existing = await db.scientists.where('username').equals(editUsername).first();
        if (existing) throw new Error("Username is already taken.");
      }

      await db.scientists.update(user.id, {
        name: editName.trim(),
        username: editUsername.trim()
      });
      setSuccessMsg("Profile updated successfully!");
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      if (newPassword !== confirmPassword) {
        throw new Error("New passwords do not match.");
      }
      if (newPassword.length < 6) {
        throw new Error("Password must be at least 6 characters.");
      }
      await changePassword(oldPassword, newPassword);
      setSuccessMsg("Password changed successfully!");
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to change password.');
    } finally {
      setSaving(false);
    }
  };

  const handleLinkGoogle = async () => {
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await linkGoogleAccount();
      setSuccessMsg('Google account successfully linked!');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to link account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <Settings size={28} color="#3b82f6" />
        <h1 style={{ margin: 0, fontSize: '24px', color: '#1e293b' }}>Settings</h1>
      </div>

      {successMsg && (
        <div style={{ background: '#dcfce7', color: '#166534', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
          <CheckCircle size={18} /> {successMsg}
        </div>
      )}

      {errorMsg && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
          <AlertCircle size={18} /> {errorMsg}
        </div>
      )}

      <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: '24px' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '12px', background: '#f8fafc' }}>
          <User size={20} color="#64748b" />
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#334155' }}>Account Information</h2>
        </div>
        <div style={{ padding: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>Name</label>
              <input 
                type="text" 
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>Username</label>
              <input 
                type="text" 
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>Role</label>
              <div style={{ fontSize: '15px', color: '#0f172a', fontWeight: 500, padding: '10px 12px', background: '#f1f5f9', borderRadius: '8px' }}>{me?.role || user?.role}</div>
            </div>
          </div>
          <button 
            onClick={handleSaveProfile} 
            disabled={saving}
            className="scicomm-btn-primary"
            style={{ padding: '8px 16px', fontSize: '14px' }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: '24px' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '12px', background: '#f8fafc' }}>
          <Key size={20} color="#64748b" />
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#334155' }}>Change Password</h2>
        </div>
        <div style={{ padding: '24px' }}>
          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '400px' }}>
            {me?.passwordHash && (
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>Current Password</label>
                <input 
                  type="password" 
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px' }}
                />
              </div>
            )}
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>New Password</label>
              <input 
                type="password" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>Confirm New Password</label>
              <input 
                type="password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px' }}
              />
            </div>
            <button 
              type="submit"
              disabled={saving}
              className="scicomm-btn-primary"
              style={{ padding: '10px 16px', fontSize: '14px', alignSelf: 'flex-start', marginTop: '8px' }}
            >
              {saving ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '12px', background: '#f8fafc' }}>
          <LinkIcon size={20} color="#64748b" />
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#334155' }}>Connected Accounts</h2>
        </div>
        <div style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h3 style={{ margin: '0 0 4px', fontSize: '15px', color: '#0f172a' }}>Google Account</h3>
              {me?.email ? (
                <p style={{ margin: 0, fontSize: '13px', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle size={14} /> Linked as {me.email}
                </p>
              ) : (
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                  Not connected. Link your Google account to enable Drive uploads and Google Sign-In.
                </p>
              )}
            </div>
            
            <button 
              onClick={handleLinkGoogle} 
              disabled={loading}
              className="btn btn-secondary" 
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style={{ width: '18px' }} />
              {loading ? 'Linking...' : (me?.email ? 'Change Google Account' : 'Link Google Account')}
            </button>
          </div>
        </div>
      </div>
      
    </div>
  );
}
