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
  ShieldAlert,
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
    `flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
      isActive ? 'bg-primary-light text-primary' : 'text-gray-600 hover:bg-primary-light hover:text-primary'
    }`;

  return (
    <div className="min-h-screen bg-primary-light/60 font-sans">
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-primary-light shadow-sm">
        <div className="flex items-center gap-2 px-4 py-3 max-w-6xl mx-auto">
          <button
            className="md:hidden flex items-center justify-center h-11 w-11 rounded-lg text-gray-600 hover:bg-primary-light"
            onClick={() => setOpen(!open)}
            aria-label={open ? 'Tutup menu' : 'Buka menu'}
          >
            {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
          <span className="flex items-center gap-1.5">
            <Sprout className="h-5 w-5 text-primary shrink-0" strokeWidth={2.25} aria-hidden="true" />
            <span className="leading-tight">
              <span className="block font-display font-semibold text-primary">SmartGrowth</span>
              <span className="hidden sm:block text-[11px] text-gray-400">Tele-Screening Stunting &middot; Posyandu</span>
            </span>
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
      <main className="max-w-6xl mx-auto">
        <Outlet />
      </main>
      <footer className="border-t border-primary-light bg-white mt-10">
        <div className="max-w-6xl mx-auto px-4 py-4 text-xs text-gray-500 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <p className="flex items-start gap-1.5 max-w-3xl">
            <ShieldAlert className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" aria-hidden="true" />
            <span>
              <span className="font-semibold text-gray-700">Disclaimer:</span> Aplikasi ini adalah alat skrining awal
              berbasis standar WHO dan AI sederhana. Tidak menggantikan diagnosis dokter atau ahli gizi. Selalu
              konsultasikan hasil ke tenaga kesehatan.
            </span>
          </p>
          <p className="shrink-0">&copy; {new Date().getFullYear()} SmartGrowth</p>
        </div>
      </footer>
    </div>
  );
}
