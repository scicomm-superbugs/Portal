import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link, Navigate, useParams } from 'react-router-dom';
import { Lock, User, Building2 } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  const { login, loginWithGoogle, user } = useAuth();
  const navigate = useNavigate();
  const { workspace } = useParams();

  const mappedWorkspace = (workspace === 'aiu' || workspace === 'Alamein International University' || workspace === 'alamein') ? 'alamein' : (workspace === 'aiuscicomm' ? 'aiuscicomm' : workspace);

  if (mappedWorkspace && (mappedWorkspace === 'alamein' || mappedWorkspace === 'aiuscicomm')) {
    localStorage.setItem('workspaceId', mappedWorkspace);
  }

  const workspaceId = localStorage.getItem('workspaceId');
  
  useEffect(() => {
    document.title = workspaceId === 'alamein' ? 'Alamein International University' : 'AIU SciComm Team';
  }, [workspaceId]);

  if (!workspaceId) {
    return <Navigate to="/portal" replace />;
  }

  // If already logged in, redirect
  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoggingIn(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setIsLoggingIn(true);
    try {
      await loginWithGoogle();
      navigate('/');
    } catch (err) {
      if (err.message.includes('auth/operation-not-allowed')) {
        setError("Firebase Error: Google Sign-In is currently disabled in your Firebase Authentication settings. You must enable it in the Firebase Console.");
      } else if (err.message.includes('auth/api-key-not-valid') || err.message.includes('API key not valid')) {
        setError("Firebase Error: The API Key is restricted or invalid. If you just created it, please wait 5 minutes for Google Cloud to propagate the new key.");
      } else if (err.message.includes('auth/unauthorized-domain')) {
        setError(`Firebase Error: The domain '${window.location.hostname}' is not authorized. Please go to Firebase Console -> Authentication -> Settings -> Authorized domains and add it.`);
      } else {
        setError(err.message);
      }
      setIsLoggingIn(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100dvh - 150px)', padding: '1rem' }}>
      <div className="card" style={{ maxWidth: '400px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          {workspaceId === 'alamein' ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.5rem' }}>
              <img src="./alamein_logo_2.png" alt="Alamein University" style={{ height: '80px', marginBottom: '1rem', objectFit: 'contain' }} onError={e => e.target.style.display='none'}/>
              <h2 style={{ fontSize: '1.5rem', color: '#805AD5', marginBottom: '0.25rem', textAlign: 'center' }}>Alamein International University</h2>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Faculty of Science</div>
            </div>
          ) : workspaceId === 'aiuscicomm' ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.5rem' }}>
              <img src="./aiu_scicomm_light.png" alt="AIU SciComm" style={{ height: '80px', marginBottom: '1rem', objectFit: 'contain' }} onError={e => e.target.style.display='none'}/>
              <h2 style={{ fontSize: '1.5rem', color: '#1d4ed8', marginBottom: '0.25rem', textAlign: 'center' }}>AIU SciComm Team</h2>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Science Communication Team</div>
            </div>
          ) : null}
        </div>

        {error && (
          <div style={{ 
            backgroundColor: error.includes('pending approval') ? '#dcfce7' : '#FED7D7', 
            color: error.includes('pending approval') ? '#14532d' : '#822727', 
            padding: '0.75rem', 
            borderRadius: '8px', 
            marginBottom: '1rem', 
            fontSize: '0.875rem' 
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username or Email</label>
            <div style={{ position: 'relative' }}>
              <User size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                className="form-control" 
                style={{ paddingLeft: '2.5rem' }}
                placeholder="Enter your username or email"
                required
                value={username}
                onChange={e => setUsername(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="password" 
                className="form-control" 
                style={{ paddingLeft: '2.5rem' }}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginBottom: '1rem' }} disabled={isLoggingIn}>
            {isLoggingIn ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', margin: '1rem 0' }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }}></div>
          <span style={{ padding: '0 10px', color: '#94a3b8', fontSize: '12px', fontWeight: 600 }}>OR</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }}></div>
        </div>

        <button 
          onClick={handleGoogleLogin} 
          disabled={isLoggingIn}
          style={{ 
            width: '100%', 
            padding: '10px', 
            background: 'white', 
            border: '1px solid #cbd5e1', 
            borderRadius: '8px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: '10px', 
            cursor: 'pointer', 
            fontWeight: 600, 
            color: '#334155',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
            marginBottom: '1.5rem',
            transition: 'background 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
          onMouseLeave={e => e.currentTarget.style.background = 'white'}
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style={{ width: 18, height: 18 }} />
          Sign in with Google
        </button>
        
        <div style={{ textAlign: 'center', fontSize: '0.875rem' }}>
          Don't have an account? <Link to="/register" style={{ fontWeight: 600 }}>Register</Link>
        </div>
        
        <div style={{ textAlign: 'center', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
          <button onClick={() => { localStorage.removeItem('workspaceId'); window.location.href = '#/portal'; }} className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <Building2 size={16} /> Back to Hub Selection
          </button>
        </div>
      </div>
    </div>
  );
}
