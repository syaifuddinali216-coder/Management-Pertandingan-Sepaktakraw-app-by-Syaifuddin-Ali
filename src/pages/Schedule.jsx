import React, { useState, useEffect, useMemo } from 'react'
import { useNav } from './MainApp.jsx'
import { useApp } from '../App.jsx'
import { useEvents, useNomors, useSchedule, useScheduleSlots, useCourtAssignments, useTeams, useMatches } from '../hooks/useFirestore.js'

const DURATION_OPTIONS = [30, 35, 40, 45, 50, 60]
const DAY_OPTIONS = [1,2,3,4,5,6,7,8,9,10]

const ROUND_LABELS = {
  group: 'Fase Grup',
  4: 'Babak 16 Besar',
  3: 'Perempat Final',
  2: 'Semifinal',
  1: 'Final',
}

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
function minutesToTime(mins) {
  const h = Math.floor(mins / 60) % 24
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// Generate time slots for one day given config
function generateDaySlots(config, courtCount) {
  const { startTime, endTime, duration, ishomaStart, ishomaEnd, knockoutBreaks } = config
  const slots = []
  let cur = timeToMinutes(startTime)
  const end = timeToMinutes(endTime)
  const ishStart = ishomaStart ? timeToMinutes(ishomaStart) : null
  const ishEnd = ishomaEnd ? timeToMinutes(ishomaEnd) : null

  let order = 0
  while (cur + duration <= end) {
    // Skip into/through ISHOMA
    if (ishStart !== null && cur >= ishStart && cur < ishEnd) {
      cur = ishEnd
      continue
    }
    if (ishStart !== null && cur < ishStart && cur + duration > ishStart) {
      cur = ishEnd
      continue
    }
    const rowCourts = []
    for (let c = 0; c < courtCount; c++) {
      rowCourts.push({ court: c + 1, matchId: null, nomorId: null })
    }
    slots.push({ time: minutesToTime(cur), endTime: minutesToTime(cur + duration), courts: rowCourts, order: order++ })
    cur += duration
  }
  return slots
}

export default function Schedule({ eventId }) {
  const { showToast } = useApp()
  const { navigate } = useNav()
  const { events } = useEvents()
  const { nomors } = useNomors(eventId)
  const { schedule, saveSchedule } = useSchedule(eventId)
  const { assignments, saveAssignments } = useCourtAssignments(eventId)

  const event = events.find(e => e.id === eventId)

  const [showSetup, setShowSetup] = useState(false)
  const [setupForm, setSetupForm] = useState({
    numDays: 2,
    numDaysCustom: '',
    numCourts: 3,
    startTime: '08:00',
    endTime: '20:00',
    duration: 60,
    durationCustom: '',
    useIshoma: true,
    ishomaStart: '12:00',
    ishomaEnd: '13:00',
    breakPFtoSF: 60,
    breakSFtoFinal: 60,
  })

  const openSetup = () => {
    if (schedule) setSetupForm({ ...setupForm, ...schedule })
    setShowSetup(true)
  }

  const handleGenerateSchedule = async () => {
    const numDays = setupForm.numDays === 'custom' ? parseInt(setupForm.numDaysCustom) : setupForm.numDays
    const duration = setupForm.duration === 'custom' ? parseInt(setupForm.durationCustom) : setupForm.duration

    if (!numDays || numDays < 1) return showToast('Jumlah hari tidak valid!')
    if (!duration || duration < 10) return showToast('Durasi pertandingan tidak valid!')

    const config = {
      numDays, numCourts: setupForm.numCourts,
      startTime: setupForm.startTime, endTime: setupForm.endTime,
      duration,
      ishomaStart: setupForm.useIshoma ? setupForm.ishomaStart : null,
      ishomaEnd: setupForm.useIshoma ? setupForm.ishomaEnd : null,
      breakPFtoSF: setupForm.breakPFtoSF,
      breakSFtoFinal: setupForm.breakSFtoFinal,
    }

    await saveSchedule(config)
    setShowSetup(false)
    showToast('Jadwal berhasil dibuat! Lanjut atur lapangan per hari.')
  }

  if (!eventId || !event) {
    return (
      <div>
        <div style={{ marginBottom: 32 }}>
          <div className="tag-line" style={{ marginBottom: 8 }}>Penjadwalan</div>
          <h1 style={{ fontSize: 48, color: '#FFD700' }}>JADWAL PERTANDINGAN</h1>
        </div>
        <div className="card empty-state">
          <div style={{ fontSize: 40, marginBottom: 16 }}>📅</div>
          <p>Pilih event terlebih dahulu dari Daftar Event.</p>
          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => navigate('events')}>→ Ke Daftar Event</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <div className="tag-line" style={{ marginBottom: 8 }}>Penjadwalan</div>
          <h1 style={{ fontSize: 42, color: '#FFD700' }}>JADWAL PERTANDINGAN</h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 4 }}>Event: <strong style={{ color: '#fff' }}>{event.name}</strong></p>
        </div>
        <button className="btn btn-primary" onClick={openSetup}>
          {schedule ? '⚙️ Edit Pengaturan' : '⚙️ Setup Jadwal'}
        </button>
      </div>

      {!schedule ? (
        <div className="card empty-state">
          <div style={{ fontSize: 40, marginBottom: 16 }}>📅</div>
          <p>Jadwal belum diatur.</p>
          <p style={{ fontSize: 13, marginTop: 8 }}>Klik "Setup Jadwal" untuk mengatur hari, lapangan, dan waktu pertandingan.</p>
          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={openSetup}>⚙️ Setup Jadwal Sekarang</button>
        </div>
      ) : (
        <ScheduleBoard eventId={eventId} schedule={schedule} nomors={nomors} assignments={assignments} saveAssignments={saveAssignments} showToast={showToast} />
      )}

      {/* SETUP MODAL */}
      {showSetup && (
        <div className="modal-overlay" onClick={() => setShowSetup(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <h2>SETUP JADWAL</h2>

            <div className="form-group">
              <label>Jumlah Hari Event</label>
              <select value={setupForm.numDays} onChange={e => setSetupForm({ ...setupForm, numDays: e.target.value === 'custom' ? 'custom' : parseInt(e.target.value) })}>
                {DAY_OPTIONS.map(n => <option key={n} value={n}>{n} Hari</option>)}
                <option value="custom">Custom...</option>
              </select>
              {setupForm.numDays === 'custom' && (
                <input type="number" min="1" placeholder="Jumlah hari" value={setupForm.numDaysCustom} onChange={e => setSetupForm({ ...setupForm, numDaysCustom: e.target.value })} style={{ marginTop: 8 }} />
              )}
            </div>

            <div className="form-group">
              <label>Jumlah Lapangan / Court</label>
              <input type="number" min="1" max="20" value={setupForm.numCourts} onChange={e => setSetupForm({ ...setupForm, numCourts: parseInt(e.target.value) || 1 })} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-group">
                <label>Jam Mulai (per hari)</label>
                <input type="time" value={setupForm.startTime} onChange={e => setSetupForm({ ...setupForm, startTime: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Jam Selesai (per hari)</label>
                <input type="time" value={setupForm.endTime} onChange={e => setSetupForm({ ...setupForm, endTime: e.target.value })} />
              </div>
            </div>

            <div className="form-group">
              <label>Durasi per Pertandingan</label>
              <select value={setupForm.duration} onChange={e => setSetupForm({ ...setupForm, duration: e.target.value === 'custom' ? 'custom' : parseInt(e.target.value) })}>
                {DURATION_OPTIONS.map(d => <option key={d} value={d}>{d} menit</option>)}
                <option value="custom">Custom...</option>
              </select>
              {setupForm.duration === 'custom' && (
                <input type="number" min="10" placeholder="Durasi dalam menit" value={setupForm.durationCustom} onChange={e => setSetupForm({ ...setupForm, durationCustom: e.target.value })} style={{ marginTop: 8 }} />
              )}
            </div>

            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={setupForm.useIshoma} onChange={e => setSetupForm({ ...setupForm, useIshoma: e.target.checked })} style={{ width: 'auto' }} />
                Gunakan Jeda ISHOMA
              </label>
            </div>

            {setupForm.useIshoma && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group">
                  <label>ISHOMA Mulai</label>
                  <input type="time" value={setupForm.ishomaStart} onChange={e => setSetupForm({ ...setupForm, ishomaStart: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>ISHOMA Selesai</label>
                  <input type="time" value={setupForm.ishomaEnd} onChange={e => setSetupForm({ ...setupForm, ishomaEnd: e.target.value })} />
                </div>
              </div>
            )}

            <div style={{ padding: '14px 16px', background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.3)', borderRadius: 8, marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: '#FFD700', fontWeight: 700, marginBottom: 10 }}>⏸️ Jeda Istirahat Antar Babak Knockout</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Perempat Final → Semifinal</label>
                  <select value={setupForm.breakPFtoSF} onChange={e => setSetupForm({ ...setupForm, breakPFtoSF: parseInt(e.target.value) })}>
                    {[0, 15, 30, 45, 60, 90, 120].map(m => <option key={m} value={m}>{m === 0 ? 'Tanpa jeda' : `${m} menit`}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Semifinal → Final</label>
                  <select value={setupForm.breakSFtoFinal} onChange={e => setSetupForm({ ...setupForm, breakSFtoFinal: parseInt(e.target.value) })}>
                    {[0, 15, 30, 45, 60, 90, 120].map(m => <option key={m} value={m}>{m === 0 ? 'Tanpa jeda' : `${m} menit`}</option>)}
                  </select>
                </div>
              </div>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 10 }}>
                Tim yang baru selesai main harus istirahat dulu sebelum boleh dijadwalkan main lagi.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleGenerateSchedule}>
                {schedule ? 'Simpan & Generate Ulang' : 'Generate Jadwal'}
              </button>
              <button className="btn btn-ghost" onClick={() => setShowSetup(false)}>Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── ScheduleBoard: tampilan & assignment per hari ──────────
function ScheduleBoard({ eventId, schedule, nomors, assignments, saveAssignments, showToast }) {
  const [activeDay, setActiveDay] = useState(1)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [dayAssignment, setDayAssignment] = useState({})

  const dayKey = `day${activeDay}`
  const courtCount = schedule.numCourts

  const daySlots = useMemo(() => generateDaySlots(schedule, courtCount), [schedule, courtCount])

  const openAssign = () => {
    setDayAssignment(assignments?.[dayKey] || {})
    setShowAssignModal(true)
  }

  const saveAssign = async () => {
    await saveAssignments({ ...assignments, [dayKey]: dayAssignment })
    setShowAssignModal(false)
    showToast(`Lapangan hari ${activeDay} berhasil diatur!`)
  }

  const getNomorForCourt = (courtNum) => {
    const id = assignments?.[dayKey]?.[`court${courtNum}`]
    return nomors.find(n => n.id === id)
  }

  return (
    <div>
      {/* Day tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 4, width: 'fit-content', overflowX: 'auto' }}>
        {Array.from({ length: schedule.numDays }, (_, i) => i + 1).map(d => (
          <button key={d} onClick={() => setActiveDay(d)} style={{
            padding: '9px 18px', border: 'none', borderRadius: 8, cursor: 'pointer',
            fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap',
            background: activeDay === d ? '#FFD700' : 'transparent',
            color: activeDay === d ? '#5a0812' : 'rgba(255,255,255,0.6)',
          }}>Hari {d}</button>
        ))}
      </div>

      {/* Court assignment summary */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div className="tag-line" style={{ fontSize: 11 }}>Lapangan Hari Ke-{activeDay}</div>
          <button className="btn btn-primary" style={{ padding: '7px 16px', fontSize: 13 }} onClick={openAssign}>⚙️ Atur Lapangan</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${courtCount}, 1fr)`, gap: 10 }}>
          {Array.from({ length: courtCount }, (_, i) => i + 1).map(c => {
            const nomor = getNomorForCourt(c)
            return (
              <div key={c} style={{ padding: '12px 14px', background: nomor ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.05)', border: `1.5px solid ${nomor ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.15)'}`, borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>COURT {c}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: nomor ? '#4ade80' : 'rgba(255,255,255,0.4)' }}>{nomor ? nomor.name : 'Belum diatur'}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Schedule grid for the day */}
      <div className="card" style={{ overflowX: 'auto' }}>
        <div className="tag-line" style={{ marginBottom: 14, fontSize: 11 }}>Slot Waktu Hari Ke-{activeDay}</div>
        <table style={{ minWidth: courtCount * 220 }}>
          <thead>
            <tr>
              <th style={{ width: 100 }}>Waktu</th>
              {Array.from({ length: courtCount }, (_, i) => i + 1).map(c => (
                <th key={c}>Court {c} {getNomorForCourt(c) ? `— ${getNomorForCourt(c).name}` : ''}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {daySlots.map((slot, si) => (
              <tr key={si}>
                <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#FFD700' }}>{slot.time}</td>
                {slot.courts.map((sc, ci) => {
                  const nomor = getNomorForCourt(sc.court)
                  return (
                    <td key={ci} style={{ padding: 6 }}>
                      <div style={{
                        padding: '10px 12px', borderRadius: 6,
                        background: nomor ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
                        border: '1px dashed rgba(255,255,255,0.2)',
                        minHeight: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, color: 'rgba(255,255,255,0.4)', cursor: nomor ? 'pointer' : 'not-allowed',
                      }}>
                        {nomor ? '+ Pilih match' : 'Lapangan belum diatur'}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 14 }}>
          💡 Fitur pengisian match per slot sedang dikembangkan — saat ini kamu bisa lihat struktur slot dan atur lapangan per hari dulu.
        </p>
      </div>

      {/* Assign Court Modal */}
      {showAssignModal && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>ATUR LAPANGAN — HARI {activeDay}</h2>
            <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 20, fontSize: 14 }}>Pilih nomor pertandingan untuk setiap court di hari ini.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {Array.from({ length: courtCount }, (_, i) => i + 1).map(c => (
                <div key={c} className="form-group" style={{ marginBottom: 0 }}>
                  <label>Court {c}</label>
                  <select value={dayAssignment[`court${c}`] || ''} onChange={e => setDayAssignment({ ...dayAssignment, [`court${c}`]: e.target.value })}>
                    <option value="">— Belum dipilih —</option>
                    {nomors.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveAssign}>Simpan</button>
              <button className="btn btn-ghost" onClick={() => setShowAssignModal(false)}>Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
