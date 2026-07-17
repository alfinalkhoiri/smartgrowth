import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, LogOut, Sprout } from 'lucide-react';
import { authApi } from '@/api/auth';

export function AppHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const isChildDashboard = location.pathname.startsWith('/child/');

  const handleLogout = () => {
    if (!window.confirm('Yakin ingin keluar?')) return;
    authApi.logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="sticky top-0 z-40 flex items-center justify-between gap-3 px-4 py-3 bg-white/90 backdrop-blur border-b border-primary-light shadow-sm">
      <span className="flex items-center gap-1.5 font-display font-semibold text-primary">
        <Sprout className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
        SmartGrowth
      </span>
      <div className="flex items-center gap-1">
        {isChildDashboard && (
          <Link
            to="/"
            className="flex items-center gap-1 min-h-[44px] px-3 rounded-lg text-sm text-gray-600 font-medium hover:bg-primary-light active:bg-primary-light"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Daftar Balita
          </Link>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-1 min-h-[44px] px-3 rounded-lg text-sm text-gray-600 font-medium hover:bg-red-50 hover:text-red-600 active:bg-red-50"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Keluar
        </button>
      </div>
    </div>
  );
}
