import React, { useState, useEffect } from 'react'
import { useApp } from '../App.jsx'
import { useNav } from './MainApp.jsx'
import { useEvents, useNomors, useTeams, useMatches } from '../hooks/useFirestore.js'

function calcSetResult(sets) {
  let hw = 0, aw = 0
  ;(sets || []).forEach(s => {
    const h = parseInt(s?.home) || 0, a = parseInt(s?.away) || 0
    if (!h && !a) return
    if (h > a) hw++; else if (a > h) aw++
  })
  return { homeSetWins: hw, awaySetWins: aw }
}

function calcStandings(teams, matches) {
  const tbl = {}
  teams.forEach(t => tbl[t.id] = { name: t.name, origin: t.origin || '', P: 0, W: 0, L: 0, SetW: 0, SetL: 0, Pts: 0 })
  matches.filter(m => m.status === 'done').forEach(m => {
    const h = tbl[m.homeId], a = tbl[m.awayId]
    if (!h || !a) return
    const { homeSetWins: hw, awaySetWins: aw } = calcSetResult(m.sets)
    h.P++; a.P++; h.SetW += hw; h.SetL += aw; a.SetW += aw; a.SetL += hw
    if (hw > aw) { h.W++; h.Pts += 3; a.L++ }
    else if (aw > hw) { a.W++; a.Pts += 3; h.L++ }
    else { h.Pts++; a.Pts++ }
  })
  return Object.values(tbl).sort((a, b) => b.Pts - a.Pts || (b.SetW - b.SetL) - (a.SetW - a.SetL))
}

function NomorDataLoader({ eventId, nomor, onData }) {
  const { teams } = useTeams(eventId, nomor.id)
  const { matches } = useMatches(eventId, nomor.id)
  useEffect(() => { onData(nomor.id, teams, matches) }, [teams, matches])
  return null
}

export default function Reports({ eventId: initialEventId }) {
  const { showToast } = useApp()
  const { navigate } = useNav()
  const { events } = useEvents()
  const [selectedEventId, setSelectedEventId] = useState(initialEventId || null)
  const [generating, setGenerating] = useState(false)
  const [nomorData, setNomorData] = useState({})

  const eventId = selectedEventId
  const { nomors } = useNomors(eventId)
  const event = events.find(e => e.id === eventId)

  const handleNomorData = (nomorId, teams, matches) => {
    setNomorData(prev => ({ ...prev, [nomorId]: { teams, matches } }))
  }

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'

  const generateExcel = async () => {
    if (!event) return
    setGenerating(true)
    showToast('Membuat file Excel...')
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()

      // Header style helper (we'll use cell comments for styling hints)
      const headerStyle = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1A6B3A' } }, alignment: { horizontal: 'center' } }
      const subHeaderStyle = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '2D8A5F' } }, alignment: { horizontal: 'center' } }
      const goldStyle = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: 'C47F00' } }, alignment: { horizontal: 'center' } }

      const styleCell = (ws, ref, style) => {
        if (!ws[ref]) ws[ref] = { v: '', t: 's' }
        ws[ref].s = style
      }

      nomors.forEach((nomor, ni) => {
        const nd = nomorData[nomor.id] || {}
        const teams = nd.teams || []
        const matches = nd.matches || []
        const groupMatches = matches.filter(m => m.phase === 'group')
        const koMatches = matches.filter(m => m.phase === 'knockout' && m.status === 'done')

        const getTeam = (id) => teams.find(t => t.id === id)
        const getTeamName = (id) => getTeam(id)?.name || '—'

        // ── SHEET 1: PEMBAGIAN POOL ──────────────────────
        const grpIds = [...new Set(groupMatches.map(m => m.groupId))]
        const poolRows = [
          [`PEMBAGIAN POOL — ${nomor.name.toUpperCase()}`],
          [`Event: ${event.name}`],
          [],
        ]
        grpIds.forEach(gid => {
          const gName = groupMatches.find(m => m.groupId === gid)?.groupName || gid
          const tids = [...new Set(groupMatches.filter(m => m.groupId === gid).flatMap(m => [m.homeId, m.awayId]))]
          poolRows.push([gName])
          poolRows.push(['No', 'Nama Tim / Kontingen', 'Asal Daerah'])
          tids.forEach((tid, i) => {
            const t = getTeam(tid)
            poolRows.push([i + 1, t?.name || '—', t?.origin || '—'])
          })
          poolRows.push([])
        })
        const wsPool = XLSX.utils.aoa_to_sheet(poolRows)
        wsPool['!cols'] = [{ wch: 6 }, { wch: 35 }, { wch: 25 }]
        XLSX.utils.book_append_sheet(wb, wsPool, `${ni + 1}.${nomor.name.slice(0, 15)} Pool`)

        // ── SHEET 2: HASIL PERTANDINGAN ──────────────────
        const hasilRows = [
          [`HASIL PERTANDINGAN — ${nomor.name.toUpperCase()}`],
          [`Event: ${event.name}`],
          [],
        ]

        // Group results with standings
        grpIds.forEach(gid => {
          const gName = groupMatches.find(m => m.groupId === gid)?.groupName || gid
          const tids = [...new Set(groupMatches.filter(m => m.groupId === gid).flatMap(m => [m.homeId, m.awayId]))]
          const grpTeams = teams.filter(t => tids.includes(t.id))
          const grpMatches = groupMatches.filter(m => m.groupId === gid)
          const standings = calcStandings(grpTeams, grpMatches)

          hasilRows.push([`KLASEMEN ${gName}`])
          hasilRows.push(['#', 'Tim', 'P', 'M', 'K', 'Set+', 'Set-', 'Poin'])
          standings.forEach((r, i) => hasilRows.push([i + 1, r.name, r.P, r.W, r.L, r.SetW, r.SetL, r.Pts]))
          hasilRows.push([])

          hasilRows.push([`HASIL PERTANDINGAN ${gName}`])
          hasilRows.push(['Tim A', 'Set 1', 'Set 2', 'Set 3', 'Hasil Set', 'Tim B', 'Pemenang', 'Tanggal'])
          grpMatches.filter(m => m.status === 'done').forEach(m => {
            const s = m.sets || []
            const { homeSetWins: hw, awaySetWins: aw } = calcSetResult(s)
            const s1 = s[0]?.home !== undefined ? `${s[0].home||0}-${s[0].away||0}` : '—'
            const s2 = s[1]?.home !== undefined ? `${s[1].home||0}-${s[1].away||0}` : '—'
            const s3 = s[2]?.home !== undefined ? `${s[2].home||0}-${s[2].away||0}` : '—'
            hasilRows.push([getTeamName(m.homeId), s1, s2, s3, `${hw}-${aw}`, getTeamName(m.awayId), getTeamName(m.winnerId), m.date ? fmtDate(m.date) : '—'])
          })
          hasilRows.push([])
        })

        // Knockout results
        if (koMatches.length > 0) {
          hasilRows.push(['HASIL KNOCKOUT'])
          const rounds = [...new Set(koMatches.map(m => m.round))].sort((a, b) => b - a)
          rounds.forEach(r => {
            const rMatches = koMatches.filter(m => m.round === r)
            const rName = rMatches[0]?.roundName || `Babak ${r}`
            hasilRows.push([rName])
            hasilRows.push(['Tim A', 'Set 1', 'Set 2', 'Set 3', 'Hasil Set', 'Tim B', 'Pemenang', 'Tanggal'])
            rMatches.forEach(m => {
              const s = m.sets || []
              const { homeSetWins: hw, awaySetWins: aw } = calcSetResult(s)
              const s1 = s[0]?.home !== undefined ? `${s[0].home||0}-${s[0].away||0}` : '—'
              const s2 = s[1]?.home !== undefined ? `${s[1].home||0}-${s[1].away||0}` : '—'
              const s3 = s[2]?.home !== undefined ? `${s[2].home||0}-${s[2].away||0}` : '—'
              hasilRows.push([getTeamName(m.homeId), s1, s2, s3, `${hw}-${aw}`, getTeamName(m.awayId), getTeamName(m.winnerId), m.date ? fmtDate(m.date) : '—'])
            })
            hasilRows.push([])
          })
        }

        const wsHasil = XLSX.utils.aoa_to_sheet(hasilRows)
        wsHasil['!cols'] = [{ wch: 28 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 28 }, { wch: 28 }, { wch: 20 }]
        XLSX.utils.book_append_sheet(wb, wsHasil, `${ni + 1}.${nomor.name.slice(0, 15)} Hasil`)

        // ── SHEET 3: DAFTAR PEMENANG ─────────────────────
        const koFinal = koMatches.find(m => m.round === 1)
        let juara1 = '—', juara2 = '—', juara3a = '—', juara3b = '—'
        if (koFinal) {
          juara1 = getTeamName(koFinal.winnerId)
          juara2 = getTeamName(koFinal.winnerId === koFinal.homeId ? koFinal.awayId : koFinal.homeId)
          // Semifinal losers = juara 3 bersama
          const semis = koMatches.filter(m => m.round === 2 && m.status === 'done')
          const losers = semis.map(m => getTeamName(m.winnerId === m.homeId ? m.awayId : m.homeId))
          juara3a = losers[0] || '—'
          juara3b = losers[1] || '—'
        } else {
          // Fall back to group standings
          const allGroupTeams = teams
          const allGroupMatches = groupMatches.filter(m => m.status === 'done')
          if (allGroupMatches.length > 0) {
            const s = calcStandings(allGroupTeams, allGroupMatches)
            juara1 = s[0]?.name || '—'; juara2 = s[1]?.name || '—'
            juara3a = s[2]?.name || '—'; juara3b = s[3]?.name || '—'
          }
        }

        const pemenangRows = [
          [`DAFTAR PEMENANG — ${nomor.name.toUpperCase()}`],
          [`Event: ${event.name}`],
          [],
          ['🏆 JUARA I', juara1],
          ['🥈 JUARA II', juara2],
          ['🥉 JUARA III', juara3a],
          ['🥉 JUARA III', juara3b],
        ]
        const wsPemenang = XLSX.utils.aoa_to_sheet(pemenangRows)
        wsPemenang['!cols'] = [{ wch: 18 }, { wch: 40 }]
        XLSX.utils.book_append_sheet(wb, wsPemenang, `${ni + 1}.${nomor.name.slice(0, 15)} Pemenang`)

        // ── SHEET 4: DAFTAR PESERTA ──────────────────────
        const pesertaRows = [
          [`DAFTAR PESERTA — ${nomor.name.toUpperCase()}`],
          [`Event: ${event.name}`],
          [],
          ['No', 'Nama Tim', 'Asal Daerah', 'Pelatih', 'Kapten', 'Nama Atlet', 'Manager & Official'],
        ]
        teams.forEach((t, i) => {
          pesertaRows.push([i + 1, t.name, t.origin || '—', t.coach || '—', t.captain || '—', t.athletes || '—', t.officials || '—'])
        })
        const wsPeserta = XLSX.utils.aoa_to_sheet(pesertaRows)
        wsPeserta['!cols'] = [{ wch: 5 }, { wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 40 }, { wch: 30 }]
        XLSX.utils.book_append_sheet(wb, wsPeserta, `${ni + 1}.${nomor.name.slice(0, 15)} Peserta`)
      })

      // Write and download
      const filename = `Rekap_${event.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`
      XLSX.writeFile(wb, filename)
      showToast(`✅ Excel berhasil didownload!`)
    } catch (err) {
      console.error(err)
      showToast('❌ Gagal membuat Excel. Coba lagi.')
    }
    setGenerating(false)
  }

  // Event picker
  if (!eventId || !event) {
    return (
      <div>
        <div style={{ marginBottom: 32 }}>
          <div className="tag-line" style={{ marginBottom: 8 }}>Generate</div>
          <h1 style={{ fontSize: 48, color: 'var(--green-field)' }}>REKAP HASIL</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>Pilih event untuk membuat rekap hasil pertandingan.</p>
        </div>
        {events.length === 0 ? (
          <div className="card empty-state">
            <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
            <p>Belum ada event. Buat event terlebih dahulu.</p>
            <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => navigate('events')}>→ Ke Daftar Event</button>
          </div>
        ) : (
          <div className="card">
            <h2 style={{ fontSize: 22, color: 'var(--green-field)', marginBottom: 16 }}>PILIH EVENT</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {events.map(ev => (
                <div key={ev.id} onClick={() => { setSelectedEventId(ev.id); setNomorData({}) }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'var(--gray-100)', border: '1.5px solid var(--border)', borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--green-accent)'; e.currentTarget.style.background = 'rgba(26,107,58,0.05)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--gray-100)' }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, color: 'var(--text-primary)' }}>{ev.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {ev.location && `📍 ${ev.location}`}{ev.date && ` · 📅 ${fmtDate(ev.date)}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className={`badge ${ev.status === 'selesai' ? 'badge-gold' : ev.status === 'berlangsung' ? 'badge-green' : 'badge-gray'}`}>
                      {ev.status === 'selesai' ? 'Selesai' : ev.status === 'berlangsung' ? 'Berlangsung' : 'Persiapan'}
                    </span>
                    <button className="btn btn-primary" style={{ padding: '7px 16px', fontSize: 13 }}>📊 Rekap</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  const totalTeams = Object.values(nomorData).reduce((s, d) => s + (d.teams?.length || 0), 0)
  const totalMatches = Object.values(nomorData).reduce((s, d) => s + (d.matches?.filter(m => m.status === 'done').length || 0), 0)

  return (
    <div>
      {nomors.map(n => <NomorDataLoader key={n.id} eventId={eventId} nomor={n} onData={handleNomorData} />)}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <div className="tag-line" style={{ marginBottom: 8 }}>Rekap Hasil Pertandingan</div>
          <h1 style={{ fontSize: 42, color: 'var(--green-field)' }}>REKAP HASIL</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>Event: <strong style={{ color: 'var(--text-primary)' }}>{event.name}</strong></p>
        </div>
        <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={() => { setSelectedEventId(null); setNomorData({}) }}>← Ganti Event</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Nomor Pertandingan', value: nomors.length, icon: '🏸' },
          { label: 'Total Kontingen', value: totalTeams, icon: '🏅' },
          { label: 'Match Selesai', value: totalMatches, icon: '✅' },
        ].map((s, i) => (
          <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px' }}>
            <span style={{ fontSize: 24 }}>{s.icon}</span>
            <div>
              <div style={{ fontSize: 28, fontFamily: 'var(--font-display)', color: 'var(--green-field)' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 1 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Isi Excel */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, color: 'var(--green-field)', marginBottom: 16 }}>ISI FILE EXCEL</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>1 file Excel · {nomors.length} nomor pertandingan · masing-masing 4 sheet</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {nomors.map((n, ni) => (
            <div key={n.id}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green-field)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                Nomor {ni + 1}: {n.name}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 8 }}>
                {[
                  { icon: '📊', label: 'Pembagian Pool' },
                  { icon: '⚔️', label: 'Hasil Pertandingan' },
                  { icon: '🏆', label: 'Daftar Pemenang' },
                  { icon: '👥', label: 'Daftar Peserta' },
                ].map((sheet, si) => (
                  <div key={si} style={{ padding: '10px 12px', background: 'var(--gray-100)', border: '1px solid var(--border)', borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 18, marginBottom: 4 }}>{sheet.icon}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>{sheet.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>Sheet {si + 1}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '16px', fontSize: 16, letterSpacing: 1 }}
        onClick={generateExcel} disabled={generating}>
        {generating ? <><span className="spinner" style={{ marginRight: 8 }} />Membuat Excel...</> : '📊 Download Rekap Excel'}
      </button>
    </div>
  )
}
