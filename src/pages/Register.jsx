import { useState, useEffect } from 'react';
import { useNavigate, Link, Navigate, useParams } from 'react-router-dom';
import { db } from '../db';
import bcrypt from 'bcryptjs';
import { useAuth } from '../context/AuthContext';
import { Building2 } from 'lucide-react';

export default function Register() {
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    department: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { workspace } = useParams();

  const mappedWorkspace = (workspace === 'aiu' || workspace === 'Alamein International University' || workspace === 'alamein') ? 'alamein' : (workspace === 'aiuscicomm' ? 'aiuscicomm' : workspace);

  if (mappedWorkspace && (mappedWorkspace === 'alamein' || mappedWorkspace === 'aiuscicomm')) {
    localStorage.setItem('workspaceId', mappedWorkspace);
  }

  const workspaceId = localStorage.getItem('workspaceId') || 'alamein';

  useEffect(() => {
    document.title = workspaceId === 'alamein' ? 'Alamein International University' : 'AIU SciComm Team';
  }, [workspaceId]);

  // If already logged in, redirect
  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsRegistering(true);

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setIsRegistering(false);
      return;
    }
    
    // Check if username exists
    const existing = await db.scientists.where('username').equals(formData.username).first();
    if (existing) {
      setError('Username already exists');
      setIsRegistering(false);
      return;
    }

    try {
      const salt = await bcrypt.genSalt(4);
      const hash = await bcrypt.hash(formData.password, salt);

      const generatedId = 'EMP-' + Math.floor(1000 + Math.random() * 9000);

      await db.scientists.add({
        username: formData.username,
        passwordHash: hash,
        name: formData.name,
        email: formData.email || '',
        department: formData.department,
        role: 'scientist',
        accountStatus: 'pending', // Requires admin approval
        employeeId: generatedId,
        profileViews: 0
      });

      setSuccess('Registration submitted! An administrator must approve your account before you can log in.');
      setFormData({ name: '', username: '', email: '', password: '', confirmPassword: '', department: '' });
      setIsRegistering(false);
    } catch (err) {
      setError('Registration failed: ' + err.message);
      setIsRegistering(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100dvh - 150px)', padding: '2rem 1rem' }}>
      <div className="card" style={{ maxWidth: '420px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          {workspaceId === 'alamein' ? (
            <>
              <img src="./alamein_logo_2.png" alt="Alamein University" style={{ height: '50px', marginBottom: '1rem', objectFit: 'contain' }} onError={e => e.target.style.display='none'}/>
              <h2>🎓 Faculty Registration</h2>
              <p style={{ color: 'var(--text-muted)' }}>Create a new account</p>
            </>
          ) : workspaceId === 'aiuscicomm' ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.5rem' }}>
              <img src="./aiu_scicomm_logo.png" alt="AIU SciComm" style={{ height: '50px', marginBottom: '1rem', objectFit: 'contain' }} onError={e => e.target.style.display='none'}/>
              <h2 style={{ fontSize: '1.5rem', color: '#10b981', marginBottom: '0.25rem', textAlign: 'center' }}>AIU SciComm Team</h2>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Apply for Science Communication Team</div>
            </div>
          ) : null}
        </div>

        {error && (
          <div style={{ backgroundColor: '#FED7D7', color: '#822727', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem' }}>
            ❌ {error}
          </div>
        )}
        
        {success && (
          <div style={{ backgroundColor: '#C6F6D5', color: '#22543D', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem' }}>
            ✅ {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input type="text" className="form-control" name="name" required value={formData.name} onChange={handleChange} placeholder="e.g. John Smith" />
          </div>

          <div className="form-group">
            <label className="form-label">Username</label>
            <input type="text" className="form-control" name="username" required value={formData.username} onChange={handleChange} placeholder="e.g. jsmith" />
          </div>

          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" className="form-control" name="email" value={formData.email} onChange={handleChange} placeholder="e.g. john@lab.edu" />
          </div>
          
          <div className="form-group">
            <label className="form-label">Department \ Lab (Optional)</label>
            <input type="text" className="form-control" name="department" value={formData.department} onChange={handleChange} placeholder="e.g. Biochemistry" />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input type="password" className="form-control" name="password" required value={formData.password} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <input type="password" className="form-control" name="confirmPassword" required value={formData.confirmPassword} onChange={handleChange} />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginBottom: '1rem' }} disabled={isRegistering}>
            {isRegistering ? 'Registering...' : '🚀 Create Account'}
          </button>
        </form>
        
        <div style={{ textAlign: 'center', fontSize: '0.875rem' }}>
          Already have an account? <Link to="/login" style={{ fontWeight: 600 }}>Login</Link>
        </div>
      </div>
    </div>
  );
}
