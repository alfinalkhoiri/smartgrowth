import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import Dashboard from '@/pages/Dashboard';
import Skrining from '@/pages/Skrining';
import ChildrenList from '@/pages/ChildrenList';
import ChildDashboard from '@/pages/ChildDashboard';
import Riwayat from '@/pages/Riwayat';
import Edukasi from '@/pages/Edukasi';
import Jadwal from '@/pages/Jadwal';
import KodePosyandu from '@/pages/KodePosyandu';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import { authApi } from '@/api/auth';

function RequireAuth({ children }: { children: JSX.Element }) {
  if (!authApi.isAuthenticated()) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    // HashRouter (not BrowserRouter): combined with base: './' (required for
    // Capacitor, see vite.config.ts), a real browser navigation/reload on a
    // nested route like /child/:id would resolve the cached index.html's
    // relative asset paths against /child/ instead of /, 404ing every asset
    // when offline. Every route living under one '#' fragment sidesteps that
    // — verified with Playwright: reload while offline on /child/:id now
    // correctly re-renders from the Workbox precache.
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/skrining" element={<Skrining />} />
          <Route path="/balita" element={<ChildrenList />} />
          <Route path="/child/:childId" element={<ChildDashboard />} />
          <Route path="/riwayat" element={<Riwayat />} />
          <Route path="/edukasi" element={<Edukasi />} />
          <Route path="/jadwal" element={<Jadwal />} />
          <Route path="/admin/kode-posyandu" element={<KodePosyandu />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
