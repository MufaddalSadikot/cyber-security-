import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DemoWorkspace from './pages/DemoWorkspace';
import PrivacyInspector from './pages/PrivacyInspector';
import ContextCompilerPage from './pages/ContextCompilerPage';
import ActionPolicyPage from './pages/ActionPolicyPage';
import AgentTasks from './pages/AgentTasks';
import Benchmarks from './pages/Benchmarks';
import AuditLog from './pages/AuditLog';
import ExtensionPage from './pages/ExtensionPage';
import { Spinner } from './components/ui';

function Protected({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="min-h-screen grid place-items-center">
        <Spinner />
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/app" element={<Protected><Dashboard /></Protected>} />
      <Route path="/app/demo" element={<Protected><DemoWorkspace /></Protected>} />
      <Route path="/app/privacy" element={<Protected><PrivacyInspector /></Protected>} />
      <Route path="/app/compiler" element={<Protected><ContextCompilerPage /></Protected>} />
      <Route path="/app/policy" element={<Protected><ActionPolicyPage /></Protected>} />
      <Route path="/app/tasks" element={<Protected><AgentTasks /></Protected>} />
      <Route path="/app/benchmarks" element={<Protected><Benchmarks /></Protected>} />
      <Route path="/app/audit" element={<Protected><AuditLog /></Protected>} />
      <Route path="/app/extension" element={<Protected><ExtensionPage /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
