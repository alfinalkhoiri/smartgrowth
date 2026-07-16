import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import ChildrenList from '@/pages/ChildrenList';
import ChildDashboard from '@/pages/ChildDashboard';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import { AppHeader } from '@/components/AppHeader';
import { authApi } from '@/api/auth';

function RequireAuth({ children }: { children: JSX.Element }) {
  if (!authApi.isAuthenticated()) return <Navigate to="/login" replace />;
  return (
    <>
      <AppHeader />
      {children}
    </>
  );
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
      <div className="min-h-screen bg-primary-light/60 font-sans">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <ChildrenList />
              </RequireAuth>
            }
          />
          <Route
            path="/child/:childId"
            element={
              <RequireAuth>
                <ChildDashboard />
              </RequireAuth>
            }
          />
        </Routes>
      </div>
    </HashRouter>
  );
}
