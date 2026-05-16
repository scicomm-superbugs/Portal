import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import RegisterChemical from './pages/RegisterChemical';
import Scientists from './pages/Scientists';
import UsageTracking from './pages/UsageTracking';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import Devices from './pages/Devices';
import Equipment from './pages/Equipment';
import Tasks from './pages/Tasks';
import Chat from './pages/Chat';
import TeamSearch from './pages/TeamSearch';
import Portal from './pages/Portal';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';

import SciCommLayout from './scicomm/SciCommLayout';
import SciCommFeed from './scicomm/SciCommFeed';
import SciCommNetwork from './scicomm/SciCommNetwork';
import SciCommTasks from './scicomm/SciCommTasks';
import SciCommNotifications from './scicomm/SciCommNotifications';
import SciCommProfile from './scicomm/SciCommProfile';
import SciCommAdmin from './scicomm/SciCommAdmin';
import SciCommLeaderboard from './scicomm/SciCommLeaderboard';
import SciCommChat from './scicomm/SciCommChat';
import SciCommMeetings from './scicomm/SciCommMeetings';
import SciCommCalendar from './scicomm/SciCommCalendar';
import SciCommMemberProfile from './scicomm/SciCommMemberProfile';
import SciCommHub from './scicomm/SciCommHub';
import SciCommPost from './scicomm/SciCommPost';
import SciCommApply from './scicomm/SciCommApply';
import SciCommSinglePost from './scicomm/SciCommSinglePost';
import SciCommSettings from './scicomm/SciCommSettings';

import SciCommDownload from './scicomm/SciCommDownload';

// Read workspace once at module level (stable — only changes on Portal page redirect)
const isSciComm = localStorage.getItem('workspaceId') === 'aiuscicomm';

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/portal" element={<Portal />} />
          <Route path="/:workspace/login" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/:workspace/register" element={<Register />} />
          <Route path="/register" element={<Register />} />

          <Route element={<ProtectedRoute />}>
            {isSciComm ? (
              <Route path="/" element={<SciCommLayout />}>
                <Route index element={<SciCommFeed />} />
                <Route path="network" element={<SciCommNetwork />} />
                <Route path="apply" element={<SciCommApply />} />
                <Route path="download" element={<SciCommDownload />} />
                <Route element={<ProtectedRoute requireTeam={true} />}>
                  <Route path="tasks" element={<SciCommTasks />} />
                  <Route path="meetings" element={<SciCommMeetings />} />
                </Route>
                <Route path="notifications" element={<SciCommNotifications />} />
                <Route path="profile" element={<SciCommProfile />} />
                <Route path="settings" element={<SciCommSettings />} />
                <Route path="leaderboard" element={<SciCommLeaderboard />} />
                <Route path="chat" element={<SciCommChat />} />
                <Route path="calendar" element={<SciCommCalendar />} />
                <Route path="member/:memberId" element={<SciCommMemberProfile />} />
                <Route path="hub" element={<SciCommHub />} />
                <Route path="post" element={<SciCommPost />} />
                <Route path="view-post/:postId" element={<SciCommSinglePost />} />
                <Route element={<ProtectedRoute requireAdmin={true} />}>
                  <Route path="admin" element={<SciCommAdmin />} />
                </Route>
              </Route>
            ) : (
              <Route path="/" element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="tracking" element={<UsageTracking />} />
                <Route path="profile" element={<Profile />} />
                <Route path="tasks" element={<Tasks />} />
                <Route path="chat" element={<Chat />} />
                <Route path="team" element={<TeamSearch />} />
                <Route element={<ProtectedRoute requireAdmin={true} />}>
                  <Route path="chemicals" element={<RegisterChemical />} />
                  <Route path="devices" element={<Devices />} />
                  <Route path="equipment" element={<Equipment />} />
                  <Route path="scientists" element={<Scientists />} />
                </Route>
              </Route>
            )}
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
