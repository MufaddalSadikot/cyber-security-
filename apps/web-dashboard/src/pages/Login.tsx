import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { IconArrow, IconShield } from '../components/icons';
import { Spinner } from '../components/ui';

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('demo@pvcc.demo');
  const [password, setPassword] = useState('demo123');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, name || email.split('@')[0], password);
      navigate('/app');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid-bg grid place-items-center px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2.5 justify-center mb-8">
          <div className="grid place-items-center h-10 w-10 rounded-lg bg-brand/15 text-brand">
            <IconShield width={22} height={22} />
          </div>
          <div>
            <div className="font-bold text-slate-100">Privacy-Aware Visual Context Compiler</div>
            <div className="text-[10px] text-muted">SIH26171 · ISRO / Department of Space</div>
          </div>
        </Link>

        <div className="card p-6">
          <div className="flex gap-2 mb-6 p-1 bg-bg-soft rounded-lg">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 rounded-md py-2 text-sm font-semibold capitalize transition-colors ${
                  mode === m ? 'bg-brand text-white' : 'text-muted hover:text-slate-200'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="label block mb-1.5">Full name</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
              </div>
            )}
            <div>
              <label className="label block mb-1.5">Email</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label block mb-1.5">Password</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">{error}</div>}

            <button className="btn-primary w-full !py-2.5" disabled={busy}>
              {busy ? <Spinner /> : <>{mode === 'login' ? 'Sign in' : 'Create account'} <IconArrow /></>}
            </button>
          </form>

          <div className="mt-5 text-xs text-muted text-center">
            Demo: <span className="mono text-slate-300">admin@pvcc.demo / admin123</span>
            <br />
            <span className="mono text-slate-300">demo@pvcc.demo / demo123</span>
          </div>
        </div>
      </div>
    </div>
  );
}
