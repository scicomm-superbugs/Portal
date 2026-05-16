import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ requireAdmin = false, requireTeam = false }) {
  const { user, loading } = useAuth();
  const workspaceId = localStorage.getItem('workspaceId');

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100dvh', background: '#f8fafc' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="loader" style={{ marginBottom: '1rem' }}></div>
          <div style={{ color: '#64748b', fontWeight: 600 }}>Verifying Access...</div>
        </div>
      </div>
    );
  }

  if (!workspaceId) {
    return <Navigate to="/portal" replace />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && user.role !== 'admin' && user.role !== 'master') {
    return <Navigate to="/" replace />;
  }

  if (requireTeam && user.role !== 'scicomm' && user.role !== 'admin' && user.role !== 'master') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
