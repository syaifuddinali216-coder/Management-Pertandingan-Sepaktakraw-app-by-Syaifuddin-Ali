import React, { useState } from 'react'
import { useNav } from './MainApp.jsx'
import { useEvents } from '../hooks/useFirestore.js'

export default function Events() {
  const { navigate } = useNav()
  const { events, loading, addEvent, updateEvent, deleteEvent } = useEvents()
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ name: '', location: '', date: '', organizer: '', description: '', status: 'persiapan' })
  const [saving, setSaving] = useState(false)

  const openAdd = () => { setForm({ name: '', location: '', date: '', organizer: '', description: '', status: 'persiapan' }); setEditId(null); setShowModal(true) }
  const openEdit = (ev) => { setForm({ name: ev.name, location: ev.location || '', date: ev.date || '', organizer: ev.organizer || '', description: ev.description || '', status: ev.status || 'persiapan' }); setEditId(ev.id); setShowModal(true) }

  const save = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    if (editId) await updateEvent(editId, form)
    else await addEvent(form)
    setSaving(false)
    setShowModal(false)
  }

  const remove = async (id) => {
    if (!confirm('Hapus event ini? Semua data di dalamnya akan ikut terhapus.')) return
    await deleteEvent(id)
  }

  const statusLabel = { persiapan: 'Persiapan', berlangsung: 'Berlangsung', selesai: 'Selesai' }
  const statusBadge = { persiapan: 'badge-gray', berlangsung: 'badge-green', selesai: 'badge-gold' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32 }}>
        <div>
          <div className="tag-line" style={{ marginBottom: 8 }}>Manajemen</div>
          <h1 style={{ fontSize: 48, color: 'var(--gold)' }}>DAFTAR EVENT</h1>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Buat Event Baru</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} /></div>
      ) : events.length === 0 ? (
        <div className="card empty-state">
          <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
          <p>Belum ada event turnamen.</p>
          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={openAdd}>+ Buat Event Pertama</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {events.map(ev => (
            <div key={ev.id} className="card" style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => navigate('event-detail', ev.id)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <h2 style={{ fontSize: 22, color: 'var(--white)', letterSpacing: 0.5 }}>{ev.name}</h2>
                    <span className={`badge ${statusBadge[ev.status] || 'badge-gray'}`}>{statusLabel[ev.status] || ev.status}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 20, fontSize: 13, color: 'var(--gray-600)' }}>
                    {ev.location && <span>📍 {ev.location}</span>}
                    {ev.date && <span>📅 {new Date(ev.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>}
                    {ev.organizer && <span>🏛️ {ev.organizer}</span>}
                  </div>
                  {ev.description && <p style={{ fontSize: 13, color: 'var(--gray-600)', marginTop: 8, lineHeight: 1.5 }}>{ev.description}</p>}
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button className="btn btn-primary" style={{ padding: '7px 16px', fontSize: 13 }} onClick={() => navigate('event-detail', ev.id)}>Buka</button>
                  <button className="btn btn-ghost" style={{ padding: '7px 14px', fontSize: 13 }} onClick={() => openEdit(ev)}>Edit</button>
                  <button className="btn btn-danger" style={{ padding: '7px 14px', fontSize: 13 }} onClick={() => remove(ev.id)}>Hapus</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editId ? 'EDIT EVENT' : 'BUAT EVENT BARU'}</h2>
            <div className="form-group">
              <label>Nama Turnamen / Event *</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Contoh: Kejuaraan Sepak Takraw Nasional 2025" autoFocus />
            </div>
            <div className="form-group">
              <label>Penyelenggara / Organisasi</label>
              <input value={form.organizer} onChange={e => setForm({ ...form, organizer: e.target.value })} placeholder="Contoh: PSTI DKI Jakarta" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label>Lokasi</label>
                <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="GOR Senayan, Jakarta" />
              </div>
              <div className="form-group">
                <label>Tanggal Mulai</label>
                <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label>Deskripsi (opsional)</label>
              <textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Keterangan tambahan tentang event..." />
            </div>
            <div className="form-group">
              <label>Status Event</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="persiapan">Persiapan</option>
                <option value="berlangsung">Berlangsung</option>
                <option value="selesai">Selesai</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={save} disabled={saving || !form.name.trim()}>
                {saving ? <span className="spinner" /> : editId ? 'Update Event' : 'Buat Event'}
              </button>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
