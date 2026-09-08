import React, { useState } from 'react'
import { useApp } from '../App.jsx'
import { useOfficials } from '../hooks/useFirestore.js'
import TeamLogo from '../components/TeamLogo.jsx'
import { compressImage } from '../utils/imageCompress.js'

const CATEGORIES = [
  { id: 'ito', icon: '🎖️', label: 'International Technical Official' },
  { id: 'istaf', icon: '🏵️', label: 'ISTAF Member' },
  { id: 'astaf', icon: '🏵️', label: 'ASTAF Member' },
  { id: 'referee', icon: '🟨', label: 'Referee' },
]
const LICENCE_OPTIONS = ['ISTAF REFEREE', 'ASTAF REFEREE', 'NATIONAL REFEREE']

const emptyForm = { name: '', origin: '', dob: '', email: '', position: '', licence: '', passportNumber: '', phone: '', photo: '' }

export default function Officials() {
  const { showToast } = useApp()
  const [category, setCategory] = useState(null)
  const { officials, loading, addOfficial, updateOfficial, deleteOfficial } = useOfficials(category)
  const catInfo = CATEGORIES.find(c => c.id === category)

  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  const openAdd = () => { setForm(emptyForm); setEditId(null); setShowModal(true) }
  const openEdit = (o) => {
    setForm({
      name: o.name || '', origin: o.origin || '', dob: o.dob || '', email: o.email || '',
      position: o.position || '', licence: o.licence || '', passportNumber: o.passportNumber || '',
      phone: o.phone || '', photo: o.photo || '',
    })
    setEditId(o.id); setShowModal(true)
  }

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    try {
      const dataUrl = await compressImage(file)
      setForm(f => ({ ...f, photo: dataUrl }))
    } catch (err) {
      showToast('Failed to upload photo: ' + err.message)
    }
    setUploadingPhoto(false)
    e.target.value = ''
  }

  const save = async () => {
    if (!form.name.trim()) return showToast('Name is required!')
    setSaving(true)
    if (editId) await updateOfficial(editId, form)
    else await addOfficial(form)
    setSaving(false)
    setShowModal(false)
    showToast(editId ? 'Updated!' : 'Added!')
  }

  const remove = async (id) => {
    if (!confirm('Delete this record?')) return
    await deleteOfficial(id)
  }

  // ── VIEW: Categories ──
  if (!category) {
    return (
      <div>
        <div style={{ marginBottom: 32 }}>
          <div className="tag-line" style={{ marginBottom: 8 }}>Federation Registry</div>
          <h1 style={{ fontSize: 48, color: 'var(--gold)' }}>OFFICIALS DIRECTORY</h1>
          <p style={{ fontSize: 13, marginTop: 8, color: 'var(--text-muted)' }}>Select a category to view or add records.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {CATEGORIES.map(c => (
            <div key={c.id} className="card" style={{ cursor: 'pointer', padding: '24px 22px' }} onClick={() => setCategory(c.id)}>
              <div style={{ fontSize: 30, marginBottom: 10 }}>{c.icon}</div>
              <h2 style={{ fontSize: 18, color: 'var(--white)' }}>{c.label}</h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>View records →</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── VIEW: List for selected category ──
  return (
    <div>
      <button className="btn btn-ghost" style={{ marginBottom: 20, padding: '7px 14px', fontSize: 13 }} onClick={() => setCategory(null)}>← Back to Categories</button>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="tag-line" style={{ marginBottom: 8 }}>Officials Directory</div>
          <h1 style={{ fontSize: 36, color: 'var(--gold)' }}>{catInfo.label}</h1>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add {catInfo.label}</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} /></div>
      ) : officials.length === 0 ? (
        <div className="card empty-state">
          <div style={{ fontSize: 48, marginBottom: 16 }}>{catInfo.icon}</div>
          <p>No records yet.</p>
          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={openAdd}>+ Add First Record</button>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Name</th>
                <th>Origin</th>
                {category === 'ito' && <th>Date of Birth</th>}
                {(category === 'istaf' || category === 'astaf') && <th>Position</th>}
                {category === 'referee' && <th>Licence</th>}
                <th>Passport No.</th>
                <th>Phone</th>
                {category === 'ito' && <th>Email</th>}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {officials.map(o => (
                <tr key={o.id}>
                  <td><TeamLogo src={o.photo} name={o.name} size={36} /></td>
                  <td style={{ fontWeight: 600, color: '#fff' }}>{o.name}</td>
                  <td>{o.origin || '—'}</td>
                  {category === 'ito' && <td>{o.dob || '—'}</td>}
                  {(category === 'istaf' || category === 'astaf') && <td>{o.position || '—'}</td>}
                  {category === 'referee' && <td>{o.licence || '—'}</td>}
                  <td>{o.passportNumber || '—'}</td>
                  <td>{o.phone || '—'}</td>
                  {category === 'ito' && <td>{o.email || '—'}</td>}
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => openEdit(o)}>Edit</button>
                      <button className="btn btn-danger" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => remove(o.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editId ? 'EDIT' : 'ADD'} — {catInfo.label.toUpperCase()}</h2>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <TeamLogo src={form.photo} name={form.name} size={56} />
              <div>
                <label className="btn btn-ghost" style={{ padding: '7px 14px', fontSize: 12, cursor: 'pointer', display: 'inline-block' }}>
                  {uploadingPhoto ? 'Uploading...' : form.photo ? 'Change Photo' : '+ Upload Photo'}
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploadingPhoto} style={{ display: 'none' }} />
                </label>
                {form.photo && (
                  <button className="btn btn-ghost" style={{ padding: '7px 12px', fontSize: 12, marginLeft: 8, color: '#ffaaaa' }} onClick={() => setForm({ ...form, photo: '' })}>Remove</button>
                )}
              </div>
            </div>

            <div className="form-group">
              <label>Name *</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Full name" autoFocus />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label>Origin / Country</label>
                <input value={form.origin} onChange={e => setForm({ ...form, origin: e.target.value })} placeholder="Country" />
              </div>

              {category === 'ito' && (
                <div className="form-group">
                  <label>Date of Birth</label>
                  <input type="date" value={form.dob} onChange={e => setForm({ ...form, dob: e.target.value })} />
                </div>
              )}

              {(category === 'istaf' || category === 'astaf') && (
                <div className="form-group">
                  <label>Position</label>
                  <input value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} placeholder="e.g. Vice President" />
                </div>
              )}

              {category === 'referee' && (
                <div className="form-group">
                  <label>Licence</label>
                  <select value={form.licence} onChange={e => setForm({ ...form, licence: e.target.value })}>
                    <option value="">— Select —</option>
                    {LICENCE_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label>Passport Number</label>
                <input value={form.passportNumber} onChange={e => setForm({ ...form, passportNumber: e.target.value })} placeholder="Passport no." />
              </div>
              <div className="form-group">
                <label>Phone Number</label>
                <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+62..." />
              </div>
            </div>

            {category === 'ito' && (
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />
              </div>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={save} disabled={saving || !form.name.trim()}>
                {saving ? <span className="spinner" /> : editId ? 'Update' : 'Add'}
              </button>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
