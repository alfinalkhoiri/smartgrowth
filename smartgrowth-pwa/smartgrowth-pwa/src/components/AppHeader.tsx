import { useNavigate } from 'react-router-dom';
import { authApi } from '@/api/auth';

export function AppHeader() {
  const navigate = useNavigate();

  const handleLogout = () => {
    authApi.logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
      <span className="font-semibold text-teal-700">SmartGrowth</span>
      <button onClick={handleLogout} className="text-sm text-gray-500 font-medium">
        Keluar
      </button>
    </div>
  );
}
