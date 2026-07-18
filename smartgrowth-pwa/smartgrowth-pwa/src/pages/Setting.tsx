import { Link } from 'react-router-dom';
import { ChevronRight, KeyRound, Settings as SettingsIcon, Users } from 'lucide-react';
import { authApi } from '@/api/auth';

const items = [
  {
    to: '/admin/setting/users',
    label: 'List User',
    description: 'Lihat seluruh akun yang terdaftar beserta perannya.',
    icon: Users
  },
  {
    to: '/admin/setting/kode-posyandu',
    label: 'Kode Posyandu',
    description: 'Kode/QR yang dibutuhkan untuk mendaftar sebagai Kader/Nakes.',
    icon: KeyRound
  }
];

export default function Setting() {
  if (!authApi.isAdmin()) {
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <p className="text-sm text-gray-500">Halaman ini khusus untuk peran Admin.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <div>
        <h1 className="flex items-center gap-2 font-display font-extrabold text-2xl text-gray-900">
          <SettingsIcon className="h-6 w-6 text-primary" aria-hidden="true" />
          Setting
        </h1>
        <p className="text-sm text-gray-500">Pengaturan khusus untuk peran Admin.</p>
      </div>

      <div className="card divide-y divide-gray-100">
        {items.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex items-center gap-3 p-4 hover:bg-primary-light/40 transition-colors"
          >
            <span className="flex items-center justify-center h-10 w-10 rounded-full bg-primary-light text-primary shrink-0">
              <item.icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="flex-1 min-w-0">
              <p className="font-medium text-gray-900">{item.label}</p>
              <p className="text-sm text-gray-500">{item.description}</p>
            </span>
            <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" aria-hidden="true" />
          </Link>
        ))}
      </div>
    </div>
  );
}
