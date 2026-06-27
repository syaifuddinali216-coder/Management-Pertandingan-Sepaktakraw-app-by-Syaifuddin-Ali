import React, { useState } from 'react'
import { useNav } from './MainApp.jsx'
import { useEvents, useNomors } from '../hooks/useFirestore.js'
import NomorDetail from '../components/NomorDetail.jsx'

const NOMOR_OPTIONS = [
  'Regu Putra', 'Regu Putri',
  'Double Putra', 'Double Putri',
  'Quadrant Putra', 'Quadrant Putri',
]

export default function EventDetail({ eventId }) {
  const { navigate } = useNav()
  const { events } = useEvents()
  const { nomors, loading, addNomor, updateNomor, deleteNomor } = useNomors(eventId)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [activeNomorId, setActiveNomorId] = useState(null)
  const [form, setForm] = useState({ name: 'Regu Putra', customName: '', format: 'grup-knockout', pembukaan: '', penutupan: '' })
  const [saving, setSaving] = useState(false)

  const event = events.find(e => e.id === eventId)

  const openAdd = () => {
    setForm({ name: 'Regu Putra', customName: '', format: 'grup-knockout', pembukaan: '', penutupan: '' })
    setEditId(null); setShowModal(true)
  }
  const openEdit = (n) => {
    setForm({ name: n.name, customName: '', format: n.format || 'grup-knockout', pembukaan: n.pembukaan || '', penutupan: n.penutupan || '' })
    setEditId(n.id); setShowModal(true)
  }

  const save = async () => {
    setSaving(true)
    const data = { ...form, name: form.name === 'Lainnya' ? form.customName : form.name }
    if (editId) await updateNomor(editId, data)
    else await addNomor(data)
    setSaving(false); setShowModal(false)
  }

  const remove = async (id) => {
    if (!confirm('Hapus nomor pertandingan ini?')) return
    if (activeNomorId === id) setActiveNomorId(null)
    await deleteNomor(id)
  }

  if (activeNomorId) {
    const nomor = nomors.find(n => n.id === activeNomorId)
    return (
      <NomorDetail
        eventId={eventId}
        nomor={nomor}
        event={event}
        onBack={() => setActiveNomorId(null)}
      />
    )
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, fontSize: 13, color: 'var(--gray-600)' }}>
        <span style={{ cursor: 'pointer', color: 'var(--green-accent)' }} onClick={() => navigate('events')}>Daftar Event</span>
        <span>›</span>
        <span style={{ color: 'var(--white)' }}>{event?.name || 'Event'}</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32 }}>
        <div>
          <div className="tag-line" style={{ marginBottom: 8 }}>Event</div>
          <h1 style={{ fontSize: 36, color: 'var(--gold)', lineHeight: 1.1 }}>{event?.name?.toUpperCase() || 'EVENT'}</h1>
          {event?.location && <p style={{ color: 'var(--gray-600)', fontSize: 13, marginTop: 4 }}>📍 {event.location} {event.date && `· ${new Date(event.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`}</p>}
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Tambah Nomor</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} /></div>
      ) : nomors.length === 0 ? (
        <div className="card empty-state">
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏸</div>
          <p>Belum ada nomor pertandingan.</p>
          <p style={{ fontSize: 13, marginTop: 8 }}>Tambahkan nomor seperti Regu Putra, Double Putri, dll.</p>
          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={openAdd}>+ Tambah Nomor Pertandingan</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {nomors.map((nomor, i) => (
            <div key={nomor.id} className="card" style={{ cursor: 'pointer', transition: 'border-color 0.15s', position: 'relative' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--gold)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(64,145,108,0.2)'}
            >
              <div onClick={() => setActiveNomorId(nomor.id)}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--green-accent)', letterSpacing: 2, marginBottom: 10 }}>
                  NOMOR {String(i + 1).padStart(2, '0')}
                </div>
                <h2 style={{ fontSize: 26, color: 'var(--white)', marginBottom: 12, letterSpacing: 0.5 }}>{nomor.name.toUpperCase()}</h2>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  <span className="badge badge-gray">{nomor.format === 'grup-knockout' ? 'Grup + Knockout' : nomor.format === 'knockout' ? 'Knockout' : 'Round Robin'}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '8px', fontSize: 13 }} onClick={() => setActiveNomorId(nomor.id)}>Kelola</button>
                <button className="btn btn-ghost" style={{ padding: '8px 12px', fontSize: 13 }} onClick={() => openEdit(nomor)}>✏️</button>
                <button className="btn btn-danger" style={{ padding: '8px 12px', fontSize: 13 }} onClick={() => remove(nomor.id)}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editId ? 'EDIT NOMOR' : 'TAMBAH NOMOR'}</h2>
            <div className="form-group">
              <label>Nomor Pertandingan</label>
              <select value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}>
                {NOMOR_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
                <option value="Lainnya">Lainnya (custom)</option>
              </select>
            </div>
            {form.name === 'Lainnya' && (
              <div className="form-group">
                <label>Nama Custom</label>
                <input value={form.customName} onChange={e => setForm({ ...form, customName: e.target.value })} placeholder="Masukkan nama nomor pertandingan" />
              </div>
            )}
            <div className="form-group">
              <label>Format Pertandingan</label>
              <select value={form.format} onChange={e => setForm({ ...form, format: e.target.value })}>
                <option value="grup-knockout">Grup + Knockout</option>
                <option value="knockout">Knockout Langsung</option>
                <option value="round-robin">Round Robin</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={save} disabled={saving}>
                {saving ? <span className="spinner" /> : editId ? 'Update' : 'Tambah'}
              </button>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
