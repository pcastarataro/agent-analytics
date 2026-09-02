import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
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
import { LoginPage } from './pages/LoginPage';
import { SkillDetailPage } from './pages/SkillDetailPage';
import { DefinitionsPage } from './pages/DefinitionsPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { BranchesPage } from './pages/BranchesPage';
import { BranchDetailPage } from './pages/BranchDetailPage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              element={
                <RequireAuth>
                  <Layout />
                </RequireAuth>
              }
            >
              <Route path="/" element={<OverviewPage />} />
              <Route path="/events" element={<EventsPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/projects/:name" element={<ProjectDetailPage />} />
              <Route path="/branches" element={<BranchesPage />} />
              <Route path="/branches/:name" element={<BranchDetailPage />} />
              <Route path="/agents" element={<AgentsPage />} />
              <Route path="/agents/:name" element={<AgentDetailPage />} />
              <Route path="/skills" element={<SkillsPage />} />
              <Route path="/skills/:skillName" element={<SkillDetailPage />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/sessions" element={<SessionsListPage />} />
              <Route path="/sessions/:traceId" element={<SessionDetailPage />} />
              <Route path="/definitions" element={<DefinitionsPage />} />
              <Route path="/definitions/:hash" element={<DefinitionsPage />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
