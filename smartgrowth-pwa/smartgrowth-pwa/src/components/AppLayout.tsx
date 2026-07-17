import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Baby,
  BookOpen,
  CalendarClock,
  FilePlus2,
  LayoutDashboard,
  LogOut,
  Menu,
  Sprout,
  X
} from 'lucide-react';
import { authApi } from '@/api/auth';

const nav = [
  { to: '/', label: 'Beranda', icon: LayoutDashboard, end: true },
  { to: '/skrining', label: 'Skrining Baru', icon: FilePlus2 },
  { to: '/balita', label: 'Data Balita', icon: Baby },
  { to: '/riwayat', label: 'Riwayat', icon: BarChart3 },
  { to: '/edukasi', label: 'Edukasi', icon: BookOpen },
  { to: '/jadwal', label: 'Jadwal Posyandu', icon: CalendarClock }
];

export function AppLayout() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    if (!window.confirm('Yakin ingin keluar?')) return;
    authApi.logout();
    navigate('/login', { replace: true });
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive ? 'bg-primary-light text-primary' : 'text-gray-600 hover:bg-primary-light hover:text-primary'
    }`;

  return (
    <div className="min-h-screen bg-primary-light/60 font-sans">
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-primary-light shadow-sm">
        <div className="flex items-center gap-3 px-4 py-3 max-w-5xl mx-auto">
          <button
            className="md:hidden flex items-center justify-center h-11 w-11 rounded-lg text-gray-600 hover:bg-primary-light"
            onClick={() => setOpen(!open)}
            aria-label={open ? 'Tutup menu' : 'Buka menu'}
          >
            {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
          <span className="flex items-center gap-1.5 font-display font-semibold text-primary">
            <Sprout className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
            SmartGrowth
          </span>
          <nav className="ml-auto hidden md:flex items-center gap-1">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={linkClass}>
                <n.icon className="h-4 w-4" aria-hidden="true" />
                {n.label}
              </NavLink>
            ))}
          </nav>
          <button
            onClick={handleLogout}
            className="hidden md:flex items-center gap-1.5 min-h-[44px] px-3 rounded-lg text-sm text-gray-600 font-medium hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Keluar
          </button>
        </div>
        {open && (
          <nav className="md:hidden border-t border-primary-light bg-white">
            <div className="px-2 py-2 flex flex-col gap-1">
              {nav.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end} className={linkClass} onClick={() => setOpen(false)}>
                  <n.icon className="h-4 w-4" aria-hidden="true" />
                  {n.label}
                </NavLink>
              ))}
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 text-left"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Keluar
              </button>
            </div>
          </nav>
        )}
      </div>
      <main className="max-w-5xl mx-auto">
        <Outlet />
      </main>
    </div>
  );
}
