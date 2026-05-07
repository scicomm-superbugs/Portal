import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
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

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/portal" element={<Portal />} />
        <Route path="/:workspace/login" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/:workspace/register" element={<Register />} />
        <Route path="/register" element={<Register />} />
        
        <Route element={<ProtectedRoute />}>
          {localStorage.getItem('workspaceId') === 'aiuscicomm' ? (
            <Route path="/" element={<SciCommLayout />}>
              <Route index element={<SciCommFeed />} />
              <Route path="network" element={<SciCommNetwork />} />
              <Route path="tasks" element={<SciCommTasks />} />
              <Route path="notifications" element={<SciCommNotifications />} />
              <Route path="profile" element={<SciCommProfile />} />
              <Route path="leaderboard" element={<SciCommLeaderboard />} />
              <Route path="chat" element={<SciCommChat />} />
              <Route path="meetings" element={<SciCommMeetings />} />
              <Route path="calendar" element={<SciCommCalendar />} />
              <Route path="member/:memberId" element={<SciCommMemberProfile />} />
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
              
              {/* Admin/Master only routes */}
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
  );
}

export default App;
