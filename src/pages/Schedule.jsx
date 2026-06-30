import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useNav } from './MainApp.jsx'
import { useApp } from '../App.jsx'
import { useEvents, useNomors, useSchedule, useCourtAssignments, useTeams, useMatches } from '../hooks/useFirestore.js'

const DURATION_OPTIONS = [30, 35, 40, 45, 50, 60]
const DAY_OPTIONS = [1,2,3,4,5,6,7,8,9,10]

const ROUND_LABELS = {
  group: 'Pool',
  1: 'Final', 2: 'Semifinal', 3: 'Perempat Final', 4: 'Babak 16 Besar',
}

function timeToMinutes(t) {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
function minutesToTime(mins) {
  const h = Math.floor(mins / 60) % 24
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function generateDaySlots(config, courtCount) {
  const { startTime, endTime, duration, ishomaStart, ishomaEnd } = config
  const slots = []
  let cur = timeToMinutes(startTime)
  const end = timeToMinutes(endTime)
  const ishStart = ishomaStart ? timeToMinutes(ishomaStart) : null
  const ishEnd = ishomaEnd ? timeToMinutes(ishomaEnd) : null
  let order = 0
  while (cur + duration <= end) {
    if (ishStart !== null && cur >= ishStart && cur < ishEnd) { cur = ishEnd; continue }
    if (ishStart !== null && cur < ishStart && cur + duration > ishStart) { cur = ishEnd; continue }
    const courts = []
    for (let c = 0; c < courtCount; c++) courts.push({ court: c + 1, matchKey: null })
    slots.push({ time: minutesToTime(cur), endTime: minutesToTime(cur + duration), courts, order: order++ })
    cur += duration
  }
  return slots
}

// ── NomorMatchLoader: load teams & matches for one nomor ──
function NomorMatchLoader({ eventId, nomorId, onData }) {
  const { teams } = useTeams(eventId, nomorId)
  const { matches } = useMatches(eventId, nomorId)
  useEffect(() => { onData(nomorId, teams, matches) }, [teams, matches])
  return null
}

// ── Auto-generate schedule assignment ─────────────────────
function autoGenerate(schedule, courtAssignments, allNomorData, nomors) {
  const { numDays, numCourts } = schedule
  const newAssign = {}

  // Build match list per nomor
  const matchQueue = {} // nomorId -> [{matchKey, homeTeam, awayTeam, phase, round}]
  nomors.forEach(nomor => {
    const nd = allNomorData[nomor.id] || {}
    const matches = nd.matches || []
    const teams = nd.teams || []
    const getTeamName = id => teams.find(t => t.id === id)?.name || '?'
    matchQueue[nomor.id] = matches
      .filter(m => m.status !== 'done')
      .map(m => ({
        matchKey: m.id,
        nomorId: nomor.id,
        nomorName: nomor.name,
        homeId: m.homeId,
        awayId: m.awayId,
        homeName: getTeamName(m.homeId),
        awayName: getTeamName(m.awayId),
        phase: m.phase || 'group',
        round: m.round || null,
        label: `${getTeamName(m.homeId)} vs ${getTeamName(m.awayId)}`,
      }))
      .filter(m => m.homeId && m.awayId)
  })

  // Assign matches to slots per day
  for (let day = 1; day <= numDays; day++) {
    const dayKey = `day${day}`
    const courtMap = courtAssignments?.[dayKey] || {}
    const slots = generateDaySlots(schedule, numCourts)
    const daySlots = slots.map(s => ({ ...s, courts: s.courts.map(c => ({ ...c })) }))
    newAssign[dayKey] = { slots: daySlots, courts: courtMap }

    // Fill slots: for each slot, for each court, assign a pending match of that nomor
    const usedMatchIds = new Set()
    daySlots.forEach(slot => {
      slot.courts.forEach(courtSlot => {
        const nomorId = courtMap[`court${courtSlot.court}`]
        if (!nomorId || !matchQueue[nomorId]) return
        const pending = matchQueue[nomorId].find(m => !usedMatchIds.has(m.matchKey))
        if (pending) {
          courtSlot.matchKey = pending.matchKey
          courtSlot.nomorId = nomorId
          courtSlot.homeName = pending.homeName
          courtSlot.awayName = pending.awayName
          courtSlot.nomorName = pending.nomorName
          usedMatchIds.add(pending.matchKey)
        }
      })
    })
  }
  return newAssign
}

export default function Schedule({ eventId }) {
  const { showToast } = useApp()
  const { navigate } = useNav()
  const { events } = useEvents()
  const { nomors } = useNomors(eventId)
  const { schedule, saveSchedule } = useSchedule(eventId)
  const { assignments, saveAssignments } = useCourtAssignments(eventId)
  const [allNomorData, setAllNomorData] = useState({})

  const event = events.find(e => e.id === eventId)

  const [showSetup, setShowSetup] = useState(false)
  const [setupForm, setSetupForm] = useState({
    numDays: 2, numDaysCustom: '',
    numCourts: 2,
    startTime: '08:00', endTime: '20:00',
    duration: 60, durationCustom: '',
    useIshoma: true, ishomaStart: '12:00', ishomaEnd: '13:00',
  })

  const [activeDay, setActiveDay] = useState(1)
  const [editSlot, setEditSlot] = useState(null) // {dayKey, slotIdx, courtIdx}
  const [editForm, setEditForm] = useState({ nomorId: '', matchKey: '', homeName: '', awayName: '', note: '' })
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)

  const handleNomorData = useCallback((nomorId, teams, matches) => {
    setAllNomorData(prev => ({ ...prev, [nomorId]: { teams, matches } }))
  }, [])

  const openSetup = () => {
    if (schedule) setSetupForm(f => ({ ...f, ...schedule }))
    setShowSetup(true)
  }

  const handleSaveSetup = async () => {
    const numDays = setupForm.numDays === 'custom' ? parseInt(setupForm.numDaysCustom) : setupForm.numDays
    const duration = setupForm.duration === 'custom' ? parseInt(setupForm.durationCustom) : setupForm.duration
    if (!numDays || numDays < 1) return showToast('Jumlah hari tidak valid!')
    if (!duration || duration < 10) return showToast('Durasi pertandingan tidak valid!')
    const config = {
      numDays, numCourts: setupForm.numCourts,
      startTime: setupForm.startTime, endTime: setupForm.endTime, duration,
      ishomaStart: setupForm.useIshoma ? setupForm.ishomaStart : null,
      ishomaEnd: setupForm.useIshoma ? setupForm.ishomaEnd : null,
    }
    setSaving(true)
    await saveSchedule(config)
    setSaving(false)
    setShowSetup(false)
    showToast('Pengaturan jadwal tersimpan!')
  }

  const handleAutoGenerate = async () => {
    if (!schedule) return showToast('Setup jadwal dulu!')
    const dayKey = `day${activeDay}`
    const courtMap = assignments?.[dayKey]?.courts || {}
    const hasCourtMap = Object.keys(courtMap).length > 0
    if (!hasCourtMap) return showToast('Atur lapangan dulu sebelum auto-generate!')
    setGenerating(true)
    const newAssign = autoGenerate(schedule, { ...Object.fromEntries(
      Array.from({length: schedule.numDays}, (_, i) => [`day${i+1}`, assignments?.[`day${i+1}`]?.courts || {}])
    )}, allNomorData, nomors)
    // Merge with existing (preserve other days)
    const merged = { ...assignments }
    Object.keys(newAssign).forEach(dk => { merged[dk] = newAssign[dk] })
    await saveAssignments(merged)
    setGenerating(false)
    showToast('Jadwal berhasil di-generate otomatis!')
  }

  const handleResetDay = async () => {
    if (!confirm(`Reset jadwal Hari ${activeDay}? Semua pengisian akan dihapus.`)) return
    const dayKey = `day${activeDay}`
    const courtMap = assignments?.[dayKey]?.courts || {}
    const slots = generateDaySlots(schedule, schedule.numCourts).map(s => ({
      ...s, courts: s.courts.map(c => ({ ...c, matchKey: null, nomorId: null, homeName: null, awayName: null, nomorName: null }))
    }))
    await saveAssignments({ ...assignments, [dayKey]: { slots, courts: courtMap } })
    showToast(`Jadwal Hari ${activeDay} direset!`)
  }

  const handleResetAll = async () => {
    if (!confirm('Reset SEMUA jadwal? Semua hari akan dikosongkan.')) return
    await saveAssignments({})
    showToast('Semua jadwal direset!')
  }

  // Court assignment for active day
  const dayKey = `day${activeDay}`
  const dayData = assignments?.[dayKey] || {}
  const courtMap = dayData.courts || {}
  const slots = useMemo(() => {
    if (!schedule) return []
    if (dayData.slots?.length) return dayData.slots
    return generateDaySlots(schedule, schedule.numCourts).map(s => ({
      ...s, courts: s.courts.map(c => ({ ...c, matchKey: null }))
    }))
  }, [schedule, dayData.slots])

  const [showCourtSetup, setShowCourtSetup] = useState(false)
  const [courtForm, setCourtForm] = useState({})

  const openCourtSetup = () => {
    setCourtForm({ ...courtMap })
    setShowCourtSetup(true)
  }

  const saveCourtSetup = async () => {
    const updated = { ...assignments, [dayKey]: { ...dayData, courts: courtForm } }
    await saveAssignments(updated)
    setShowCourtSetup(false)
    showToast('Pengaturan lapangan tersimpan!')
  }

  const openEditSlot = (slotIdx, courtIdx) => {
    const slot = slots[slotIdx]
    const courtData = slot?.courts?.[courtIdx] || {}
    setEditSlot({ slotIdx, courtIdx })
    setEditForm({
      nomorId: courtData.nomorId || '',
      matchKey: courtData.matchKey || '',
      homeName: courtData.homeName || '',
      awayName: courtData.awayName || '',
      note: courtData.note || '',
    })
  }

  const saveEditSlot = async () => {
    if (!editSlot) return
    const { slotIdx, courtIdx } = editSlot
    const newSlots = slots.map((s, si) => si !== slotIdx ? s : {
      ...s, courts: s.courts.map((c, ci) => ci !== courtIdx ? c : {
        ...c,
        matchKey: editForm.matchKey || null,
        nomorId: editForm.nomorId || null,
        homeName: editForm.homeName || null,
        awayName: editForm.awayName || null,
        nomorName: nomors.find(n => n.id === editForm.nomorId)?.name || null,
        note: editForm.note || null,
      })
    })
    setSaving(true)
    await saveAssignments({ ...assignments, [dayKey]: { ...dayData, slots: newSlots } })
    setSaving(false)
    setEditSlot(null)
    showToast('Slot berhasil diupdate!')
  }

  const clearSlot = async (slotIdx, courtIdx) => {
    const newSlots = slots.map((s, si) => si !== slotIdx ? s : {
      ...s, courts: s.courts.map((c, ci) => ci !== courtIdx ? c : {
        ...c, matchKey: null, nomorId: null, homeName: null, awayName: null, nomorName: null, note: null,
      })
    })
    await saveAssignments({ ...assignments, [dayKey]: { ...dayData, slots: newSlots } })
    showToast('Slot dikosongkan!')
  }

  const exportExcel = async () => {
    if (!schedule || !assignments) return showToast('Belum ada jadwal!')
    showToast('Membuat Excel jadwal...')
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()
      const RED = 'C0152A', GOLD = 'FFD700', WHITE = 'FFFFFF'
      const sHeader = { font: { bold: true, sz: 11, color: { rgb: WHITE } }, fill: { fgColor: { rgb: RED }, patternType: 'solid' }, alignment: { horizontal: 'center' }, border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } } }
      const sTitle = { font: { bold: true, sz: 14, color: { rgb: WHITE } }, fill: { fgColor: { rgb: RED }, patternType: 'solid' }, alignment: { horizontal: 'center' } }
      const sTime = { font: { bold: true, sz: 10, color: { rgb: RED } }, fill: { fgColor: { rgb: GOLD }, patternType: 'solid' }, alignment: { horizontal: 'center' }, border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } } }
      const sData = { font: { sz: 10 }, alignment: { horizontal: 'center', wrapText: true }, border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } } }
      const sDataAlt = { ...sData, fill: { fgColor: { rgb: 'FFF5F5' }, patternType: 'solid' } }
      const setS = (ws, ref, style) => { if (!ws[ref]) ws[ref] = { v: '', t: 's' }; ws[ref].s = style }
      const COLS = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q']

      for (let day = 1; day <= schedule.numDays; day++) {
        const dk = `day${day}`
        const dd = assignments?.[dk] || {}
        const cm = dd.courts || {}
        const daySlots = dd.slots?.length ? dd.slots : generateDaySlots(schedule, schedule.numCourts)
        const nc = schedule.numCourts

        const aoa = []
        aoa.push([`JADWAL PERTANDINGAN — ${event?.name || ''} — HARI ${day}`, ...Array(nc).fill('')])
        aoa.push([`Tanggal: ${event?.date ? new Date(event.date).toLocaleDateString('id-ID', {weekday:'long', day:'numeric', month:'long', year:'numeric'}) : `Hari ${day}`}`, ...Array(nc).fill('')])
        aoa.push(['', ...Array(nc).fill('')])
        const headerRow = ['Waktu']
        for (let c = 1; c <= nc; c++) {
          const nId = cm[`court${c}`]
          const nName = nomors.find(n => n.id === nId)?.name || `Court ${c}`
          headerRow.push(`Court ${c}\n${nName}`)
        }
        aoa.push(headerRow)

        daySlots.forEach(slot => {
          const row = [`${slot.time}\n${slot.endTime}`]
          ;(slot.courts || []).forEach(ct => {
            if (ct.homeName && ct.awayName) {
              row.push(`${ct.nomorName || ''}\n${ct.homeName}\nvs\n${ct.awayName}${ct.note ? `\n(${ct.note})` : ''}`)
            } else {
              row.push(ct.note || '')
            }
          })
          aoa.push(row)
        })

        const ws = XLSX.utils.aoa_to_sheet(aoa)
        ws['!cols'] = [{ wch: 14 }, ...Array(nc).fill({ wch: 28 })]
        ws['!rows'] = [{ hpt: 24 }, { hpt: 18 }, { hpt: 8 }, { hpt: 40 }, ...daySlots.map(() => ({ hpt: 60 }))]
        const allCols = COLS.slice(0, nc + 1)
        setS(ws, `A1`, sTitle); allCols.slice(1).forEach(c => setS(ws, `${c}1`, sTitle))
        setS(ws, `A2`, sTitle); allCols.slice(1).forEach(c => setS(ws, `${c}2`, sTitle))
        setS(ws, `A4`, sHeader); allCols.slice(1).forEach(c => setS(ws, `${c}4`, sHeader))
        daySlots.forEach((_, i) => {
          const r = i + 5
          setS(ws, `A${r}`, sTime)
          allCols.slice(1).forEach(c => setS(ws, `${c}${r}`, i % 2 === 0 ? sData : sDataAlt))
        })
        ws['!merges'] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: nc } },
          { s: { r: 1, c: 0 }, e: { r: 1, c: nc } },
        ]
        XLSX.utils.book_append_sheet(wb, ws, `Hari ${day}`)
      }
      XLSX.writeFile(wb, `Jadwal_${event?.name?.replace(/\s+/g, '_') || 'Turnamen'}_${new Date().toISOString().slice(0,10)}.xlsx`)
      showToast('✅ Excel jadwal berhasil didownload!')
    } catch(e) {
      console.error(e)
      showToast('❌ Gagal export Excel')
    }
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
      {nomors.map(n => <NomorMatchLoader key={n.id} eventId={eventId} nomorId={n.id} onData={handleNomorData} />)}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="tag-line" style={{ marginBottom: 8 }}>Penjadwalan</div>
          <h1 style={{ fontSize: 38, color: '#FFD700' }}>JADWAL PERTANDINGAN</h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 4 }}>Event: <strong style={{ color: '#fff' }}>{event.name}</strong></p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={openSetup}>⚙️ {schedule ? 'Edit Setup' : 'Setup Jadwal'}</button>
          {schedule && <button className="btn btn-ghost" onClick={exportExcel}>📊 Export Excel</button>}
          {schedule && assignments && Object.keys(assignments).length > 0 && (
            <button className="btn btn-danger" style={{ padding: '10px 14px', fontSize: 13 }} onClick={handleResetAll}>🗑️ Reset Semua</button>
          )}
        </div>
      </div>

      {!schedule ? (
        <div className="card empty-state">
          <div style={{ fontSize: 40, marginBottom: 16 }}>📅</div>
          <p>Jadwal belum diatur.</p>
          <p style={{ fontSize: 13, marginTop: 8 }}>Klik "Setup Jadwal" untuk mengatur hari, lapangan, dan waktu.</p>
          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={openSetup}>⚙️ Setup Jadwal Sekarang</button>
        </div>
      ) : (
        <div>
          {/* Info cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Jumlah Hari', value: schedule.numDays, icon: '📅' },
              { label: 'Jumlah Court', value: schedule.numCourts, icon: '🏟️' },
              { label: 'Durasi Match', value: `${schedule.duration} mnt`, icon: '⏱️' },
              { label: 'Jam Main', value: `${schedule.startTime}–${schedule.endTime}`, icon: '🕐' },
            ].map((s, i) => (
              <div key={i} className="card" style={{ padding: '14px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, marginBottom: 4 }}>{s.icon}</div>
                <div style={{ fontSize: 20, fontFamily: 'var(--font-display)', color: '#FFD700' }}>{s.value}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

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

          {/* Action bar for this day */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={openCourtSetup}>🏟️ Atur Lapangan</button>
            <button className="btn btn-secondary" style={{ fontSize: 13 }} onClick={handleAutoGenerate} disabled={generating}>
              {generating ? <span className="spinner" /> : '⚡ Auto-Generate Hari Ini'}
            </button>
            <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={handleResetDay}>🔄 Reset Hari Ini</button>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginLeft: 'auto' }}>
              Klik sel jadwal untuk edit manual
            </span>
          </div>

          {/* Court header summary */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${schedule.numCourts}, 1fr)`, gap: 8, marginBottom: 16, marginLeft: 100 }}>
            {Array.from({ length: schedule.numCourts }, (_, i) => i + 1).map(c => {
              const nId = courtMap[`court${c}`]
              const nomor = nomors.find(n => n.id === nId)
              return (
                <div key={c} style={{ padding: '10px 12px', background: nomor ? 'rgba(255,215,0,0.12)' : 'rgba(255,255,255,0.05)', border: `1.5px solid ${nomor ? 'rgba(255,215,0,0.4)' : 'rgba(255,255,255,0.15)'}`, borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)', marginBottom: 3 }}>COURT {c}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: nomor ? '#FFD700' : 'rgba(255,255,255,0.35)' }}>{nomor ? nomor.name : 'Belum diatur'}</div>
                </div>
              )
            })}
          </div>

          {/* Schedule grid */}
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: schedule.numCourts * 200 + 100 }}>
              {slots.map((slot, si) => (
                <div key={si} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'stretch' }}>
                  {/* Time column */}
                  <div style={{ width: 92, flexShrink: 0, background: 'rgba(255,215,0,0.12)', border: '1px solid rgba(255,215,0,0.3)', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px 4px' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#FFD700', fontSize: 15 }}>{slot.time}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{slot.endTime}</div>
                  </div>
                  {/* Court cells */}
                  {(slot.courts || []).map((ct, ci) => {
                    const hasMatch = ct.homeName && ct.awayName
                    return (
                      <div key={ci}
                        onClick={() => openEditSlot(si, ci)}
                        style={{
                          flex: 1, minWidth: 180, padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                          background: hasMatch ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.04)',
                          border: `1.5px solid ${hasMatch ? 'rgba(74,222,128,0.35)' : 'rgba(255,255,255,0.12)'}`,
                          transition: 'all 0.15s', minHeight: 72,
                          display: 'flex', flexDirection: 'column', justifyContent: 'center',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#FFD700'; e.currentTarget.style.background = 'rgba(255,215,0,0.08)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = hasMatch ? 'rgba(74,222,128,0.35)' : 'rgba(255,255,255,0.12)'; e.currentTarget.style.background = hasMatch ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.04)' }}
                      >
                        {hasMatch ? (
                          <>
                            <div style={{ fontSize: 10, color: '#4ade80', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{ct.nomorName || ''}</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{ct.homeName}</div>
                            <div style={{ fontSize: 11, color: 'rgba(255,215,0,0.7)', marginBottom: 2 }}>vs</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{ct.awayName}</div>
                            {ct.note && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{ct.note}</div>}
                          </>
                        ) : (
                          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', textAlign: 'center' }}>+ Klik untuk isi</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── SETUP MODAL ── */}
      {showSetup && (
        <div className="modal-overlay" onClick={() => setShowSetup(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <h2>SETUP JADWAL</h2>
            <div className="form-group">
              <label>Jumlah Hari Event</label>
              <select value={setupForm.numDays} onChange={e => setSetupForm({ ...setupForm, numDays: e.target.value === 'custom' ? 'custom' : parseInt(e.target.value) })}>
                {DAY_OPTIONS.map(n => <option key={n} value={n}>{n} Hari</option>)}
                <option value="custom">Lainnya (custom)...</option>
              </select>
              {setupForm.numDays === 'custom' && <input type="number" min="1" placeholder="Jumlah hari" value={setupForm.numDaysCustom} onChange={e => setSetupForm({ ...setupForm, numDaysCustom: e.target.value })} style={{ marginTop: 8 }} />}
            </div>
            <div className="form-group">
              <label>Jumlah Lapangan / Court</label>
              <input type="number" min="1" max="20" value={setupForm.numCourts} onChange={e => setSetupForm({ ...setupForm, numCourts: parseInt(e.target.value) || 1 })} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-group"><label>Jam Mulai</label><input type="time" value={setupForm.startTime} onChange={e => setSetupForm({ ...setupForm, startTime: e.target.value })} /></div>
              <div className="form-group"><label>Jam Selesai</label><input type="time" value={setupForm.endTime} onChange={e => setSetupForm({ ...setupForm, endTime: e.target.value })} /></div>
            </div>
            <div className="form-group">
              <label>Durasi per Pertandingan</label>
              <select value={setupForm.duration} onChange={e => setSetupForm({ ...setupForm, duration: e.target.value === 'custom' ? 'custom' : parseInt(e.target.value) })}>
                {DURATION_OPTIONS.map(d => <option key={d} value={d}>{d} menit</option>)}
                <option value="custom">Lainnya (custom)...</option>
              </select>
              {setupForm.duration === 'custom' && <input type="number" min="10" placeholder="Durasi dalam menit" value={setupForm.durationCustom} onChange={e => setSetupForm({ ...setupForm, durationCustom: e.target.value })} style={{ marginTop: 8 }} />}
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={setupForm.useIshoma} onChange={e => setSetupForm({ ...setupForm, useIshoma: e.target.checked })} style={{ width: 'auto' }} />
                Gunakan Jeda ISHOMA
              </label>
            </div>
            {setupForm.useIshoma && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group"><label>ISHOMA Mulai</label><input type="time" value={setupForm.ishomaStart} onChange={e => setSetupForm({ ...setupForm, ishomaStart: e.target.value })} /></div>
                <div className="form-group"><label>ISHOMA Selesai</label><input type="time" value={setupForm.ishomaEnd} onChange={e => setSetupForm({ ...setupForm, ishomaEnd: e.target.value })} /></div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSaveSetup} disabled={saving}>{saving ? <span className="spinner" /> : 'Simpan Setup'}</button>
              <button className="btn btn-ghost" onClick={() => setShowSetup(false)}>Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* ── COURT SETUP MODAL ── */}
      {showCourtSetup && (
        <div className="modal-overlay" onClick={() => setShowCourtSetup(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>ATUR LAPANGAN — HARI {activeDay}</h2>
            <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 20, fontSize: 14 }}>Pilih nomor pertandingan untuk setiap court di hari ini.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {Array.from({ length: schedule?.numCourts || 0 }, (_, i) => i + 1).map(c => (
                <div key={c} className="form-group" style={{ marginBottom: 0 }}>
                  <label>Court {c}</label>
                  <select value={courtForm[`court${c}`] || ''} onChange={e => setCourtForm({ ...courtForm, [`court${c}`]: e.target.value })}>
                    <option value="">— Belum dipilih —</option>
                    {nomors.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveCourtSetup}>Simpan</button>
              <button className="btn btn-ghost" onClick={() => setShowCourtSetup(false)}>Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT SLOT MODAL ── */}
      {editSlot !== null && (
        <div className="modal-overlay" onClick={() => setEditSlot(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <h2>EDIT SLOT JADWAL</h2>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 20 }}>
              Hari {activeDay} · {slots[editSlot.slotIdx]?.time} · Court {editSlot.courtIdx + 1}
            </p>
            <div className="form-group">
              <label>Nomor Pertandingan</label>
              <select value={editForm.nomorId} onChange={e => {
                const nId = e.target.value
                setEditForm({ ...editForm, nomorId: nId, matchKey: '', homeName: '', awayName: '' })
              }}>
                <option value="">— Pilih nomor —</option>
                {nomors.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
              </select>
            </div>

            {editForm.nomorId && (() => {
              const nd = allNomorData[editForm.nomorId] || {}
              const matches = (nd.matches || []).filter(m => m.homeId && m.awayId)
              const teams = nd.teams || []
              const getTeamName = id => teams.find(t => t.id === id)?.name || id
              return (
                <div className="form-group">
                  <label>Pilih Pertandingan</label>
                  <select value={editForm.matchKey} onChange={e => {
                    const mId = e.target.value
                    const match = matches.find(m => m.id === mId)
                    setEditForm({
                      ...editForm, matchKey: mId,
                      homeName: match ? getTeamName(match.homeId) : '',
                      awayName: match ? getTeamName(match.awayId) : '',
                    })
                  }}>
                    <option value="">— Pilih pertandingan —</option>
                    {matches.map(m => (
                      <option key={m.id} value={m.id}>
                        {getTeamName(m.homeId)} vs {getTeamName(m.awayId)} ({m.phase === 'group' ? (m.groupName || 'Grup') : (ROUND_LABELS[m.round] || `Babak ${m.round}`)})
                        {m.status === 'done' ? ' ✓' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )
            })()}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Tim A (Home)</label>
                <input value={editForm.homeName} onChange={e => setEditForm({ ...editForm, homeName: e.target.value })} placeholder="Nama tim A" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Tim B (Away)</label>
                <input value={editForm.awayName} onChange={e => setEditForm({ ...editForm, awayName: e.target.value })} placeholder="Nama tim B" />
              </div>
            </div>
            <div className="form-group" style={{ marginTop: 14 }}>
              <label>Catatan (opsional)</label>
              <input value={editForm.note} onChange={e => setEditForm({ ...editForm, note: e.target.value })} placeholder="Contoh: Match penting, dll" />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveEditSlot} disabled={saving}>
                {saving ? <span className="spinner" /> : 'Simpan'}
              </button>
              <button className="btn btn-danger" style={{ padding: '10px 14px' }} onClick={() => { clearSlot(editSlot.slotIdx, editSlot.courtIdx); setEditSlot(null) }}>Kosongkan</button>
              <button className="btn btn-ghost" onClick={() => setEditSlot(null)}>Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
