import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Loader2, Users } from 'lucide-react';
import { authApi, type Role, type UserListEntry } from '@/api/auth';
import { firstErrorMessage } from '@/api/errors';

const roleLabels: Record<Role, string> = {
  admin: 'Admin',
  kader_nakes: 'Kader/Nakes',
  orangtua: 'Orang Tua'
};

const roleBadgeStyles: Record<Role, string> = {
  admin: 'bg-purple-100 text-purple-700',
  kader_nakes: 'bg-primary-light text-primary',
  orangtua: 'bg-amber-100 text-amber-700'
};

export default function UserList() {
  const isAdmin = authApi.isAdmin();
  const [users, setUsers] = useState<UserListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    authApi
      .listUsers()
      .then((res) => setUsers(res.data))
      .catch((err) => {
        const message = axios.isAxiosError(err) ? firstErrorMessage(err.response?.data) : null;
        setError(message ?? 'Gagal memuat daftar user.');
      })
      .finally(() => setLoading(false));
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <p className="text-sm text-gray-500">Halaman ini khusus untuk peran Admin.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto">
      <div>
        <Link to="/admin/setting" className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary mb-1">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Setting
        </Link>
        <h1 className="flex items-center gap-2 font-display font-extrabold text-2xl text-gray-900">
          <Users className="h-6 w-6 text-primary" aria-hidden="true" />
          List User
        </h1>
        <p className="text-sm text-gray-500">Seluruh akun yang terdaftar di SmartGrowth.</p>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 text-gray-400 text-sm py-10">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Memuat...
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
          <p className="text-sm text-gray-500">Belum ada user terdaftar.</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Username</th>
                <th className="px-4 py-3 font-medium">Peran</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">No. HP</th>
                <th className="px-4 py-3 font-medium">Terdaftar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3 font-medium text-gray-900">{u.username}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${roleBadgeStyles[u.role]}`}>
                      {u.isSuperuser ? 'Admin' : roleLabels[u.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{u.email || '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{u.phoneNumber || '-'}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(u.dateJoined).toLocaleDateString('id-ID', { dateStyle: 'medium' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
