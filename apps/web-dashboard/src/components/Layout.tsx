import { NavLink, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import clsx from 'clsx';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';
import {
  IconChart,
  IconDashboard,
  IconEye,
  IconGavel,
  IconLayers,
  IconList,
  IconLogout,
  IconMoon,
  IconPlay,
  IconPuzzle,
  IconShield,
  IconSun,
  IconTasks,
} from './icons';

const nav = [
  { to: '/app', label: 'Dashboard', icon: IconDashboard, end: true },
  { to: '/app/demo', label: 'Demo Workspace', icon: IconPlay },
  { to: '/app/privacy', label: 'Privacy Inspector', icon: IconEye },
  { to: '/app/compiler', label: 'Context Compiler', icon: IconLayers },
  { to: '/app/policy', label: 'Action Policy', icon: IconGavel },
  { to: '/app/tasks', label: 'Agent Tasks', icon: IconTasks },
  { to: '/app/benchmarks', label: 'Evaluation', icon: IconChart },
  { to: '/app/audit', label: 'Audit Log', icon: IconList },
  { to: '/app/extension', label: 'Extension', icon: IconPuzzle },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-line bg-bg-soft">
        <div className="p-5 border-b border-line">
          <div className="flex items-center gap-2.5">
            <div className="grid place-items-center h-9 w-9 rounded-lg bg-brand/15 text-brand">
              <IconShield />
            </div>
            <div>
              <div className="font-bold text-sm leading-tight text-slate-100">PVCC</div>
              <div className="text-[10px] text-muted leading-tight">SIH26171 · ISRO</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand/15 text-brand-soft'
                    : 'text-muted hover:bg-bg-hover hover:text-slate-200',
                )
              }
            >
              <n.icon />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-line space-y-2">
          <div className="flex items-center gap-2 px-2">
            <div className="grid place-items-center h-8 w-8 rounded-full bg-brand/20 text-brand-soft text-xs font-bold">
              {user?.name?.[0] ?? '?'}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold truncate text-slate-200">{user?.name}</div>
              <div className="text-[10px] text-muted truncate">
                {user?.role === 'admin' ? 'Administrator' : 'Demo User'}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost flex-1 !py-1.5" onClick={toggle}>
              {theme === 'dark' ? <IconSun /> : <IconMoon />}
            </button>
            <button
              className="btn-ghost flex-1 !py-1.5"
              onClick={() => {
                logout();
                navigate('/login');
              }}
            >
              <IconLogout />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center justify-between border-b border-line bg-bg-soft px-4 py-3">
          <div className="flex items-center gap-2 text-brand">
            <IconShield />
            <span className="font-bold text-sm text-slate-100">PVCC</span>
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost !p-2" onClick={toggle}>
              {theme === 'dark' ? <IconSun /> : <IconMoon />}
            </button>
            <button
              className="btn-ghost !p-2"
              onClick={() => {
                logout();
                navigate('/login');
              }}
            >
              <IconLogout />
            </button>
          </div>
        </header>

        {/* Mobile nav (scrollable pills) */}
        <div className="lg:hidden overflow-x-auto border-b border-line bg-bg-soft px-3 py-2">
          <div className="flex gap-2 w-max">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap',
                    isActive ? 'bg-brand/15 text-brand-soft' : 'text-muted bg-bg-card',
                  )
                }
              >
                <n.icon width={14} height={14} />
                {n.label}
              </NavLink>
            ))}
          </div>
        </div>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-[1500px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
