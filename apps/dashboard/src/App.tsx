import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OverviewPage } from './pages/OverviewPage';
import { EventsPage } from './pages/EventsPage';
import { AgentDetailPage } from './pages/AgentDetailPage';
import { SessionsListPage } from './pages/SessionsPage/SessionsListPage';
import { SessionDetailPage } from './pages/SessionsPage/SessionDetailPage';
import { AgentsPage } from './pages/AgentsPage';
import { SkillsPage } from './pages/SkillsPage';
import { UsersPage } from './pages/UsersPage';

export function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/agents" element={<AgentsPage />} />
            <Route path="/agents/:name" element={<AgentDetailPage />} />
            <Route path="/skills" element={<SkillsPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/sessions" element={<SessionsListPage />} />
            <Route path="/sessions/:traceId" element={<SessionDetailPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
