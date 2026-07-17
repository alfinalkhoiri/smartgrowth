import { useEffect, useState, type FormEvent } from 'react';
import axios from 'axios';
import { Bell, CalendarClock, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { scheduleApi } from '@/api/schedule';
import { firstErrorMessage } from '@/api/errors';
import { authApi } from '@/api/auth';
import type { PosyanduSchedule } from '@/types';

const emptyForm = { scheduledAt: '', location: '', notes: '' };

export default function Jadwal() {
  const [schedules, setSchedules] = useState<PosyanduSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notifStatus, setNotifStatus] = useState<NotificationPermission | 'unsupported'>(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  );
  const canCreate = authApi.canCreate();
  const canEditDelete = authApi.canEditDelete();

  useEffect(() => {
    scheduleApi
      .listSchedules()
      .then((res) => setSchedules(res.data))
      .finally(() => setLoading(false));
  }, []);

  // Bukan push notification asli (butuh service worker + push subscription)
  // — cukup pengingat lokal sederhana kalau ada jadwal dalam 24 jam ke depan
  // saat halaman ini dibuka dan izin browser sudah diberikan.
  useEffect(() => {
    if (notifStatus !== 'granted' || schedules.length === 0) return;
    const now = Date.now();
    const soon = schedules.find((s) => {
      const diff = new Date(s.scheduledAt).getTime() - now;
      return diff > 0 && diff < 24 * 60 * 60 * 1000;
    });
    if (soon) {
      new Notification('Jadwal Posyandu Besok', {
        body: `${soon.location} — ${new Date(soon.scheduledAt).toLocaleString('id-ID', {
          dateStyle: 'medium',
          timeStyle: 'short'
        })}`
      });
    }
  }, [notifStatus, schedules]);

  const handleEnableNotifications = async () => {
    if (typeof Notification === 'undefined') return;
    const permission = await Notification.requestPermission();
    setNotifStatus(permission);
  };

  const startAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const startEdit = (schedule: PosyanduSchedule) => {
    setEditingId(schedule.id);
    setForm({
      scheduledAt: schedule.scheduledAt.slice(0, 16),
      location: schedule.location,
      notes: schedule.notes ?? ''
    });
    setShowForm(true);
  };

  const handleDelete = async (schedule: PosyanduSchedule) => {
    if (!window.confirm(`Hapus jadwal di ${schedule.location}?`)) return;
    try {
      await scheduleApi.deleteSchedule(schedule.id);
      setSchedules((prev) => prev.filter((s) => s.id !== schedule.id));
    } catch (err) {
      const message = axios.isAxiosError(err) ? firstErrorMessage(err.response?.data) : null;
      setError(message ?? 'Gagal menghapus jadwal.');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    const payload = {
      scheduledAt: new Date(form.scheduledAt).toISOString(),
      location: form.location,
      notes: form.notes
    };
    try {
      if (editingId) {
        const res = await scheduleApi.updateSchedule(editingId, payload);
        setSchedules((prev) => prev.map((s) => (s.id === editingId ? res.data : s)));
      } else {
        const res = await scheduleApi.createSchedule(payload);
        setSchedules((prev) => [...prev, res.data].sort((a, b) => (a.scheduledAt > b.scheduledAt ? 1 : -1)));
      }
      setForm(emptyForm);
      setEditingId(null);
      setShowForm(false);
    } catch (err) {
      const message = axios.isAxiosError(err) ? firstErrorMessage(err.response?.data) : null;
      setError(message ?? 'Gagal menyimpan jadwal. Periksa kembali data yang diisi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-display font-bold text-gray-900">Jadwal Posyandu</h1>
        {canCreate && (
          <button onClick={() => (showForm ? setShowForm(false) : startAdd())} className="btn-primary">
            {showForm ? (
              <>
                <X className="h-4 w-4" aria-hidden="true" />
                Batal
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Tambah
              </>
            )}
          </button>
        )}
      </div>

      {notifStatus !== 'unsupported' && notifStatus !== 'granted' && (
        <button onClick={handleEnableNotifications} className="btn-ghost">
          <Bell className="h-4 w-4" aria-hidden="true" />
          Aktifkan Notifikasi Pengingat
        </button>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2" role="alert">
          {error}
        </p>
      )}

      {showForm && (editingId ? canEditDelete : canCreate) && (
        <form onSubmit={handleSubmit} className="card p-4 space-y-3">
          <div>
            <label htmlFor="jadwal-scheduled-at" className="field-label">
              Tanggal &amp; Waktu
            </label>
            <input
              id="jadwal-scheduled-at"
              type="datetime-local"
              className="field-input"
              value={form.scheduledAt}
              onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
              required
            />
          </div>
          <div>
            <label htmlFor="jadwal-location" className="field-label">
              Lokasi
            </label>
            <input
              id="jadwal-location"
              className="field-input"
              placeholder="Mis. Posyandu Melati"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              required
            />
          </div>
          <div>
            <label htmlFor="jadwal-notes" className="field-label">
              Catatan (opsional)
            </label>
            <textarea
              id="jadwal-notes"
              className="field-input text-sm"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Menyimpan...
              </>
            ) : editingId ? (
              'Simpan Perubahan'
            ) : (
              'Simpan'
            )}
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 text-gray-400 text-sm py-10">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Memuat data...
        </div>
      ) : schedules.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
          <p className="text-sm text-gray-500">Tidak ada jadwal mendatang.</p>
        </div>
      ) : (
        <div className="card divide-y divide-gray-100">
          {schedules.map((schedule) => (
            <div key={schedule.id} className="flex items-center gap-3 p-4">
              <span className="flex items-center justify-center h-10 w-10 rounded-full bg-primary-light text-primary shrink-0">
                <CalendarClock className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900">{schedule.location}</p>
                <p className="text-sm text-gray-500">
                  {new Date(schedule.scheduledAt).toLocaleString('id-ID', {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  })}
                </p>
                {schedule.notes && <p className="text-xs text-gray-400 truncate">{schedule.notes}</p>}
              </div>
              {canEditDelete && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => startEdit(schedule)}
                    aria-label={`Edit jadwal ${schedule.location}`}
                    className="flex items-center justify-center h-11 w-11 rounded-lg text-primary hover:bg-primary-light"
                  >
                    <Pencil className="h-5 w-5" aria-hidden="true" />
                  </button>
                  <button
                    onClick={() => handleDelete(schedule)}
                    aria-label={`Hapus jadwal ${schedule.location}`}
                    className="flex items-center justify-center h-11 w-11 rounded-lg text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
