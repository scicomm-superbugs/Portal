import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ requireAdmin = false }) {
  const { user } = useAuth();
  const workspaceId = localStorage.getItem('workspaceId');

  if (!workspaceId) {
    return <Navigate to="/portal" replace />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && user.role !== 'admin' && user.role !== 'master') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
