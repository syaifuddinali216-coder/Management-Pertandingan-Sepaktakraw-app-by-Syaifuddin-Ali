import React, { useState } from 'react'
import { useTeams, useMatches } from '../hooks/useFirestore.js'
import { useApp } from '../App.jsx'

// Hitung pemenang set
const setWinner = (h, a) => {
  h = parseInt(h) || 0; a = parseInt(a) || 0
  if (h > a) return 'home'
  if (a > h) return 'away'
  return null
}

// Hitung hasil per sub-match (regu)
const calcSubResult = (sets) => {
  let hw = 0, aw = 0
  ;(sets || []).forEach(s => {
    if (s?.home === '' && s?.away === '') return
    const w = setWinner(s?.home, s?.away)
    if (w === 'home') hw++
    else if (w === 'away') aw++
  })
  return { homeSetWins: hw, awaySetWins: aw }
}

// Hitung pemenang team match (dari 3 sub-match)
const calcTeamMatchResult = (subMatches) => {
  let homeWins = 0, awayWins = 0
  subMatches.forEach(sub => {
    const { homeSetWins: hw, awaySetWins: aw } = calcSubResult(sub?.sets)
    if (hw > aw) homeWins++
    else if (aw > hw) awayWins++
  })
  return { homeWins, awayWins }
}

// Hitung total set & poin dari semua sub-match
const calcTeamTotals = (subMatches) => {
  let setW = 0, setL = 0, ptsW = 0, ptsL = 0
  ;(subMatches || []).forEach(sub => {
    ;(sub?.sets || []).forEach(s => {
      if (s?.home === '' && s?.away === '') return
      const h = parseInt(s?.home) || 0, a = parseInt(s?.away) || 0
      ptsW += h; ptsL += a
      if (h > a) setW++; else if (a > h) setL++
    })
  })
  return { setW, setL, ptsW, ptsL }
}

// Klasemen team event — lengkap dengan tiebreaker
function calcTeamStandings(teams, matches) {
  const tbl = {}
  teams.forEach(t => tbl[t.id] = { team: t, P: 0, W: 0, L: 0, SubW: 0, SubL: 0, SetW: 0, SetL: 0, PtsW: 0, PtsL: 0, Pts: 0 })

  matches.filter(m => m.status === 'done' && m.phase === 'group').forEach(m => {
    const h = tbl[m.homeId], a = tbl[m.awayId]
    if (!h || !a) return
    const { homeWins: hw, awayWins: aw } = calcTeamMatchResult(m.subMatches || [])

    // Hitung total set & poin dari semua regu
    const hTotals = calcTeamTotals(m.subMatches)
    h.P++; a.P++
    h.SubW += hw; h.SubL += aw
    a.SubW += aw; a.SubL += hw
    h.SetW += hTotals.setW; h.SetL += hTotals.setL
    a.SetW += hTotals.setL; a.SetL += hTotals.setW
    h.PtsW += hTotals.ptsW; h.PtsL += hTotals.ptsL
    a.PtsW += hTotals.ptsL; a.PtsL += hTotals.ptsW

    if (hw > aw) { h.W++; h.Pts += 3; a.L++ }
    else if (aw > hw) { a.W++; a.Pts += 3; h.L++ }
    else { h.Pts++; a.Pts++ }
  })

  return Object.values(tbl).sort((a, b) => {
    // 1. Poin kemenangan
    if (b.Pts !== a.Pts) return b.Pts - a.Pts
    // 2. Selisih regu
    const aRD = a.SubW - a.SubL, bRD = b.SubW - b.SubL
    if (bRD !== aRD) return bRD - aRD
    // 3. Selisih set
    const aSD = a.SetW - a.SetL, bSD = b.SetW - b.SetL
    if (bSD !== aSD) return bSD - aSD
    // 4. Selisih poin
    return (b.PtsW - b.PtsL) - (a.PtsW - a.PtsL)
  })
}

// Input skor untuk 1 sub-match (regu)
function SubMatchInput({ label, homeTeam, awayTeam, sets, onChange }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,215,0,0.2)', borderRadius: 10, padding: '14px 16px', marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: '#FFD700', fontFamily: 'var(--font-mono)', fontWeight: 700, marginBottom: 10, letterSpacing: 1 }}>
        {label}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 11 }}>
        <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{homeTeam}</span>
        <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{awayTeam}</span>
      </div>
      {[0, 1, 2].map(i => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto', gap: 6, alignItems: 'center', marginBottom: 6 }}>
          <input type="number" min="0" placeholder="0"
            value={sets[i]?.home ?? ''}
            onChange={e => { const s = [...sets]; s[i] = { ...s[i], home: e.target.value }; onChange(s) }}
            style={{ textAlign: 'center', fontSize: 16, fontFamily: 'var(--font-mono)', fontWeight: 700, padding: '6px' }} />
          <span style={{ color: 'rgba(255,215,0,0.5)', fontSize: 14, textAlign: 'center' }}>—</span>
          <input type="number" min="0" placeholder="0"
            value={sets[i]?.away ?? ''}
            onChange={e => { const s = [...sets]; s[i] = { ...s[i], away: e.target.value }; onChange(s) }}
            style={{ textAlign: 'center', fontSize: 16, fontFamily: 'var(--font-mono)', fontWeight: 700, padding: '6px' }} />
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)', minWidth: 30 }}>S{i+1}</span>
        </div>
      ))}
      {/* Show sub-match result */}
      {(() => {
        const { homeSetWins: hw, awaySetWins: aw } = calcSubResult(sets)
        const hasData = sets.some(s => s?.home !== '' && s?.home !== undefined)
        if (!hasData) return null
        return (
          <div style={{ fontSize: 11, color: hw > aw ? '#4ade80' : aw > hw ? '#ff9999' : 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)', marginTop: 4, textAlign: 'center' }}>
            Hasil set: {hw} — {aw} {hw > aw ? `(${homeTeam} menang)` : aw > hw ? `(${awayTeam} menang)` : '(Draw)'}
          </div>
        )
      })()}
    </div>
  )
}

export default function TeamNomorDetail({ eventId, nomor, event, onBack }) {
  const { showToast } = useApp()
  const { teams, addTeam, updateTeam, deleteTeam } = useTeams(eventId, nomor?.id)
  const { matches, addMatch, updateMatch, deleteMatch } = useMatches(eventId, nomor?.id)

  const [tab, setTab] = useState('teams')
  const [showTeamModal, setShowTeamModal] = useState(false)
  const [editTeamId, setEditTeamId] = useState(null)
  const [teamForm, setTeamForm] = useState({ name: '', origin: '', coach: '', code: '' })
  const [savingTeam, setSavingTeam] = useState(false)

  const [showGroupSetup, setShowGroupSetup] = useState(false)
  const [numGroups, setNumGroups] = useState(2)

  const [showScoreModal, setShowScoreModal] = useState(false)
  const [editMatch, setEditMatch] = useState(null)
  const [subSets, setSubSets] = useState([[{},{},{}],[{},{},{}],[{},{},{}]])
  const [matchDate, setMatchDate] = useState('')
  const [matchTime, setMatchTime] = useState('')
  const [savingMatch, setSavingMatch] = useState(false)

  // Knockout state
  const [showKoSetup, setShowKoSetup] = useState(false)
  const [selectedKoTeams, setSelectedKoTeams] = useState([])
  const [koSubSets, setKoSubSets] = useState([[{},{},{}],[{},{},{}],[{},{},{}]])
  const [koEditMatch, setKoEditMatch] = useState(null)
  const [showKoScoreModal, setShowKoScoreModal] = useState(false)

  const getTeamName = (id) => teams.find(t => t.id === id)?.name || 'TBD'

  // Sub-team names: "Jakarta 1", "Jakarta 2", "Jakarta 3"
  const getSubName = (teamId, sub) => `${getTeamName(teamId)} ${sub}`

  // ── Team CRUD ─────────────────────────────────────────────
  const openAddTeam = () => { setTeamForm({ name: '', origin: '', coach: '', code: '' }); setEditTeamId(null); setShowTeamModal(true) }
  const openEditTeam = (t) => { setTeamForm({ name: t.name, origin: t.origin || '', coach: t.coach || '', code: t.code || '' }); setEditTeamId(t.id); setShowTeamModal(true) }

  const saveTeam = async () => {
    if (!teamForm.name.trim()) return showToast('Nama tim wajib!')
    setSavingTeam(true)
    if (editTeamId) await updateTeam(editTeamId, teamForm)
    else await addTeam(teamForm)
    setSavingTeam(false); setShowTeamModal(false)
    showToast(editTeamId ? 'Tim diupdate!' : 'Tim ditambahkan!')
  }

  const removeTeam = async (id) => {
    if (!confirm('Hapus tim ini?')) return
    await deleteTeam(id); showToast('Tim dihapus.')
  }

  // ── Group Setup ───────────────────────────────────────────
  const setupGroups = async () => {
    if (teams.length < 2) return showToast('Minimal 2 tim!')
    const extractPoolLetter = (code) => {
      if (!code) return null
      const match = code.toUpperCase().match(/\b([A-Z])\d+$/)
      if (match) return match[1]
      const match2 = code.toUpperCase().match(/([A-Z])\s*\d+/)
      if (match2) return match2[1]
      return null
    }
    const teamsWithCode = teams.filter(t => extractPoolLetter(t.code))
    let grps = []

    if (teamsWithCode.length >= 2) {
      const poolMap = {}
      teams.forEach(t => {
        const l = extractPoolLetter(t.code)
        if (l) { if (!poolMap[l]) poolMap[l] = []; poolMap[l].push(t) }
      })
      grps = Object.keys(poolMap).sort().map((letter, i) => ({ id: `g${i}`, name: `Pool ${letter}`, teamIds: poolMap[letter].map(t => t.id) }))
    } else {
      const shuffled = [...teams].sort(() => Math.random() - 0.5)
      grps = Array.from({ length: numGroups }, (_, i) => ({ id: `g${i}`, name: `Pool ${String.fromCharCode(65 + i)}`, teamIds: [] }))
      shuffled.forEach((t, i) => grps[i % numGroups].teamIds.push(t.id))
    }

    // Delete old group matches
    for (const m of matches.filter(m => m.phase === 'group')) await deleteMatch(m.id)

    // Create team event matches (each match has 3 sub-matches)
    for (const grp of grps) {
      const tids = grp.teamIds
      for (let i = 0; i < tids.length; i++) {
        for (let j = i + 1; j < tids.length; j++) {
          await addMatch({
            groupId: grp.id, groupName: grp.name,
            homeId: tids[i], awayId: tids[j],
            phase: 'group', status: 'pending',
            isTeamEvent: true,
            subMatches: [
              { label: 'Regu 1', sets: [{},{},{}] },
              { label: 'Regu 2', sets: [{},{},{}] },
              { label: 'Regu 3', sets: [{},{},{}] },
            ],
            date: '', time: '', winnerId: null,
          })
        }
      }
    }
    setShowGroupSetup(false)
    showToast(`Pool berhasil dibuat!`)
    setTab('groups')
  }

  // ── Score input (grup) ────────────────────────────────────
  const openScore = (match) => {
    setEditMatch(match)
    setSubSets((match.subMatches || [{sets:[{},{},{}]},{sets:[{},{},{}]},{sets:[{},{},{}]}]).map(s => s.sets || [{},{},{}]))
    setMatchDate(match.date || '')
    setMatchTime(match.time || '')
    setShowScoreModal(true)
  }

  const saveScore = async () => {
    const subMatches = [
      { label: 'Regu 1', sets: subSets[0] },
      { label: 'Regu 2', sets: subSets[1] },
      { label: 'Regu 3', sets: subSets[2] },
    ]
    const { homeWins: hw, awayWins: aw } = calcTeamMatchResult(subMatches)
    const winnerId = hw > aw ? editMatch.homeId : aw > hw ? editMatch.awayId : null
    setSavingMatch(true)
    await updateMatch(editMatch.id, { subMatches, date: matchDate, time: matchTime, status: 'done', homeTeamWins: hw, awayTeamWins: aw, winnerId })
    setSavingMatch(false); setShowScoreModal(false)
    showToast('Skor tersimpan!')
  }

  const koMatches = matches.filter(m => m.phase === 'knockout')
  const koRounds = [...new Set(koMatches.map(m => m.round))].sort((a,b) => b-a)
  const koChampion = koMatches.find(m => m.round === 1 && m.status === 'done')?.winnerId
  const CARD_W = 200

  const groupMatches = matches.filter(m => m.phase === 'group')

  const uniqueGroups = [...new Set(groupMatches.map(m => m.groupId))].map(gid => {
    const m = groupMatches.find(x => x.groupId === gid)
    return { id: gid, name: m?.groupName || gid, teamIds: [...new Set(groupMatches.filter(x => x.groupId === gid).flatMap(x => [x.homeId, x.awayId]))] }
  })

  const getSuggestedKoTeams = () => {
    const suggestions = []
    uniqueGroups.forEach(grp => {
      const grpTeams = teams.filter(t => grp.teamIds.includes(t.id))
      const grpMatchesForGrp = groupMatches.filter(m => m.groupId === grp.id)
      const standings = calcTeamStandings(grpTeams, grpMatchesForGrp)
      standings.slice(0, 2).forEach((row, i) => suggestions.push({ team: row.team, label: `${grp.name} #${i+1}`, pos: i }))
    })
    return suggestions
  }

  const setupKnockout = async () => {
    if (selectedKoTeams.length < 2) return showToast('Pilih minimal 2 tim!')
    const n = selectedKoTeams.length
    const pow2 = [2,4,8,16,32,64].find(p => p >= n) || 64
    const teamList = [...selectedKoTeams]
    while (teamList.length < pow2) teamList.push(null)
    const rounds = Math.log2(pow2)
    const roundNames = { 1:'Final', 2:'Semifinal', 3:'Perempat Final', 4:'Babak 16 Besar', 5:'Babak 32 Besar', 6:'Babak 64 Besar' }
    for (const m of koMatches) await deleteMatch(m.id)
    for (let r = rounds; r >= 1; r--) {
      const pairCount = Math.pow(2, r-1)
      for (let i = 0; i < pairCount; i++) {
        const isFirst = r === rounds
        await addMatch({
          phase: 'knockout', round: r,
          roundName: roundNames[r] || `Babak ${r}`,
          position: i,
          homeId: isFirst ? (teamList[i*2]?.id || null) : null,
          awayId: isFirst ? (teamList[i*2+1]?.id || null) : null,
          isTeamEvent: true,
          subMatches: [
            { label: 'Regu 1', sets: [{},{},{}] },
            { label: 'Regu 2', sets: [{},{},{}] },
            { label: 'Regu 3', sets: [{},{},{}] },
          ],
          status: 'pending', date: '', time: '', winnerId: null,
        })
      }
    }
    setShowKoSetup(false)
    showToast('Bracket knockout berhasil dibuat!')
  }

  const openKoScore = (match) => {
    if (!match.homeId || !match.awayId) return showToast('Tunggu hasil babak sebelumnya!')
    setKoEditMatch(match)
    setKoSubSets((match.subMatches || [{sets:[{},{},{}]},{sets:[{},{},{}]},{sets:[{},{},{}]}]).map(s => s.sets || [{},{},{}]))
    setMatchDate(match.date || '')
    setMatchTime(match.time || '')
    setShowKoScoreModal(true)
  }

  const saveKoScore = async () => {
    const subMatches = [
      { label: 'Regu 1', sets: koSubSets[0] },
      { label: 'Regu 2', sets: koSubSets[1] },
      { label: 'Regu 3', sets: koSubSets[2] },
    ]
    const { homeWins: hw, awayWins: aw } = calcTeamMatchResult(subMatches)
    if (hw === aw) return showToast('Tidak boleh seri di knockout! Lanjutkan regu ke-3.')
    const winnerId = hw > aw ? koEditMatch.homeId : koEditMatch.awayId
    setSavingMatch(true)
    await updateMatch(koEditMatch.id, { subMatches, date: matchDate, time: matchTime, status: 'done', homeTeamWins: hw, awayTeamWins: aw, winnerId })
    const nextRound = koEditMatch.round - 1
    if (nextRound >= 1) {
      const nextPos = Math.floor(koEditMatch.position / 2)
      const isHome = koEditMatch.position % 2 === 0
      const nextMatch = koMatches.find(m => m.round === nextRound && m.position === nextPos)
      if (nextMatch) await updateMatch(nextMatch.id, isHome ? { homeId: winnerId } : { awayId: winnerId })
    }
    setSavingMatch(false)
    setShowKoScoreModal(false)
    showToast(koEditMatch.round === 1 ? '🏆 Selesai! Juara telah ditentukan.' : 'Skor knockout tersimpan!')
  }

  const tabs = [
    { id: 'teams', label: '🏅 Tim Peserta' },
    { id: 'groups', label: '📊 Pool / Grup' },
    { id: 'knockout', label: '🏆 Knockout' },
  ]

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
        <span style={{ cursor: 'pointer', color: '#FFD700', fontWeight: 600 }} onClick={onBack}>← {event?.name}</span>
        <span>›</span>
        <span style={{ color: '#fff' }}>{nomor?.name}</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div className="tag-line">Team Event</div>
            <span className="badge badge-gold">⭐ Format Khusus</span>
          </div>
          <h1 style={{ fontSize: 36, color: '#FFD700' }}>{nomor?.name?.toUpperCase()}</h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
            Setiap match = 3 pertandingan regu (Tim A1 vs B1, A2 vs B2, A3 vs B3)
          </p>
        </div>
        {tab === 'teams' && <button className="btn btn-primary" onClick={openAddTeam}>+ Tambah Tim</button>}
        {tab === 'groups' && <button className="btn btn-primary" onClick={() => setShowGroupSetup(true)}>⚙️ Setup Pool</button>}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '9px 18px', border: 'none', borderRadius: 8, cursor: 'pointer',
            fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, transition: 'all 0.2s',
            background: tab === t.id ? 'linear-gradient(135deg, #FFD700, #B8860B)' : 'transparent',
            color: tab === t.id ? '#1a0a2e' : 'rgba(255,255,255,0.6)',
          }}>{t.label}</button>
        ))}
      </div>

      {/* TEAMS TAB */}
      {tab === 'teams' && (
        teams.length === 0 ? (
          <div className="card empty-state">
            <div style={{ fontSize: 40 }}>🏅</div>
            <p style={{ marginTop: 12 }}>Belum ada tim terdaftar.</p>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={openAddTeam}>+ Tambah Tim Pertama</button>
          </div>
        ) : (
          <div className="card">
            <div style={{ marginBottom: 14, fontSize: 12, color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 1 }}>{teams.length} tim terdaftar</div>
            <table>
              <thead><tr><th>#</th><th>Kode</th><th>Nama Tim</th><th>Asal</th><th>Pelatih</th><th>Sub-Tim</th><th>Aksi</th></tr></thead>
              <tbody>
                {teams.map((t, i) => (
                  <tr key={t.id}>
                    <td><span style={{ fontFamily: 'var(--font-mono)', color: '#FFD700', fontWeight: 700 }}>{String(i + 1).padStart(2, '0')}</span></td>
                    <td>{t.code ? <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, background: 'rgba(255,215,0,0.15)', color: '#FFD700', padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(255,215,0,0.3)', fontSize: 12 }}>{t.code}</span> : <span style={{ color: 'rgba(255,255,255,0.2)' }}>—</span>}</td>
                    <td style={{ fontWeight: 600, color: '#fff' }}>{t.name}</td>
                    <td style={{ color: 'rgba(255,255,255,0.6)' }}>{t.origin || '—'}</td>
                    <td style={{ color: 'rgba(255,255,255,0.6)' }}>{t.coach || '—'}</td>
                    <td style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)' }}>{t.name} 1, {t.name} 2, {t.name} 3</td>
                    <td><div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => openEditTeam(t)}>Edit</button>
                      <button className="btn btn-danger" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => removeTeam(t.id)}>Hapus</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* GROUPS TAB */}
      {tab === 'groups' && (
        uniqueGroups.length === 0 ? (
          <div className="card empty-state">
            <div style={{ fontSize: 40 }}>📊</div>
            <p style={{ marginTop: 12 }}>Pool belum dibuat.</p>
            {teams.length >= 2
              ? <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowGroupSetup(true)}>⚙️ Setup Pool</button>
              : <p style={{ fontSize: 13, marginTop: 8 }}>Tambahkan minimal 2 tim terlebih dahulu.</p>}
          </div>
        ) : (
          <div>
            {uniqueGroups.map(grp => {
              const grpTeams = teams.filter(t => grp.teamIds.includes(t.id))
              const grpMatches = groupMatches.filter(m => m.groupId === grp.id)
              const standings = calcTeamStandings(grpTeams, grpMatches)
              return (
                <div key={grp.id} style={{ marginBottom: 28 }}>
                  <div style={{ fontSize: 22, fontFamily: 'var(--font-display)', color: '#FFD700', marginBottom: 14, padding: '10px 18px', background: 'rgba(255,215,0,0.08)', borderRadius: 8, borderLeft: '4px solid #FFD700', display: 'inline-block', letterSpacing: 1 }}>{grp.name}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                    {/* Klasemen */}
                    <div className="card">
                      <div className="tag-line" style={{ marginBottom: 12, fontSize: 10 }}>Klasemen</div>
                      <table>
                        <thead><tr><th>#</th><th>Tim</th><th>P</th><th>M</th><th>K</th><th>Regu+</th><th>Regu-</th><th>ΔR</th><th>Set+</th><th>Set-</th><th>ΔS</th><th>Pts</th></tr></thead>
                        <tbody>
                          {standings.map((row, i) => {
                            const rd = row.SubW - row.SubL
                            const sd = row.SetW - row.SetL
                            return (
                              <tr key={row.team.id} style={{ background: i < 2 ? 'rgba(255,215,0,0.06)' : 'transparent' }}>
                                <td><span style={{ display: 'inline-block', width: 22, height: 22, lineHeight: '22px', textAlign: 'center', borderRadius: 4, fontSize: 11, fontWeight: 700, background: i < 2 ? '#FFD700' : 'rgba(255,255,255,0.1)', color: i < 2 ? '#1a0a2e' : 'rgba(255,255,255,0.5)' }}>{i + 1}</span></td>
                                <td style={{ fontWeight: i < 2 ? 700 : 500, color: i < 2 ? '#FFD700' : '#fff', whiteSpace: 'nowrap' }}>{row.team.name}</td>
                                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>{row.P}</td>
                                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#4ade80', fontWeight: 600, textAlign: 'center' }}>{row.W}</td>
                                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#ff9999', textAlign: 'center' }}>{row.L}</td>
                                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>{row.SubW}</td>
                                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>{row.SubL}</td>
                                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: rd > 0 ? '#4ade80' : rd < 0 ? '#ff9999' : 'rgba(255,255,255,0.4)', textAlign: 'center' }}>{rd > 0 ? `+${rd}` : rd}</td>
                                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>{row.SetW}</td>
                                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>{row.SetL}</td>
                                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: sd > 0 ? '#4ade80' : sd < 0 ? '#ff9999' : 'rgba(255,255,255,0.4)', textAlign: 'center' }}>{sd > 0 ? `+${sd}` : sd}</td>
                                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: '#FFD700', textAlign: 'center' }}>{row.Pts}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    {/* Matches */}
                    <div className="card">
                      <div className="tag-line" style={{ marginBottom: 12, fontSize: 10 }}>Jadwal & Hasil</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {grpMatches.map(match => {
                          const { homeWins: hw, awayWins: aw } = calcTeamMatchResult(match.subMatches || [])
                          return (
                            <div key={match.id} style={{ padding: '10px 12px', borderRadius: 8, background: match.status === 'done' ? 'rgba(74,222,128,0.08)' : 'rgba(255,255,255,0.04)', border: `1.5px solid ${match.status === 'done' ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.12)'}` }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: match.status === 'done' ? 6 : 0 }}>
                                <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#fff' }}>{getTeamName(match.homeId)}</div>
                                <div style={{ textAlign: 'center', minWidth: 60 }}>
                                  {match.status === 'done'
                                    ? <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#FFD700', fontSize: 14 }}>{hw} — {aw}</span>
                                    : <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>vs</span>}
                                </div>
                                <div style={{ flex: 1, fontSize: 12, fontWeight: 600, textAlign: 'right', color: '#fff' }}>{getTeamName(match.awayId)}</div>
                                <button className="btn btn-ghost" style={{ padding: '3px 9px', fontSize: 11, marginLeft: 4 }} onClick={() => openScore(match)}>{match.status === 'done' ? 'Edit' : 'Input'}</button>
                              </div>
                              {/* Show sub-match detail if done */}
                              {match.status === 'done' && (match.subMatches || []).map((sub, si) => {
                                const { homeSetWins: shw, awaySetWins: saw } = calcSubResult(sub.sets)
                                return (
                                  <div key={si} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.5)', paddingLeft: 8, fontFamily: 'var(--font-mono)' }}>
                                    <span>{getSubName(match.homeId, si+1)}</span>
                                    <span style={{ color: shw > saw ? '#4ade80' : saw > shw ? '#ff9999' : 'rgba(255,255,255,0.4)' }}>{shw}-{saw}</span>
                                    <span>{getSubName(match.awayId, si+1)}</span>
                                  </div>
                                )
                              })}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* KNOCKOUT TAB */}
      {tab === 'knockout' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
              {koMatches.length === 0 ? 'Bracket belum dibuat.' : `${koMatches.filter(m => m.status === 'done').length}/${koMatches.length} match selesai`}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={() => { setSelectedKoTeams(getSuggestedKoTeams().map(s => s.team)); setShowKoSetup(true) }}>
                {koMatches.length > 0 ? '🔄 Reset Bracket' : '🏆 Setup Bracket'}
              </button>
            </div>
          </div>

          {/* Champion display */}
          {koChampion && (() => {
            const final = koMatches.find(m => m.round === 1 && m.status === 'done')
            const runnerUp = final ? (final.winnerId === final.homeId ? final.awayId : final.homeId) : null
            const semis = koMatches.filter(m => m.round === 2 && m.status === 'done')
            const juara3 = semis.map(m => m.winnerId === m.homeId ? m.awayId : m.homeId)
            return (
              <div style={{ background: 'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,215,0,0.05))', border: '2px solid #FFD700', borderRadius: 14, padding: '16px 20px', marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#FFD700', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12, fontWeight: 700 }}>🏆 Hasil Akhir</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 10 }}>
                  {[
                    { medal: '🥇', label: 'JUARA I', id: koChampion },
                    { medal: '🥈', label: 'JUARA II', id: runnerUp },
                    ...juara3.map(id => ({ medal: '🥉', label: 'JUARA III', id })),
                  ].filter(j => j.id).map((j, i) => (
                    <div key={i} style={{ background: '#FFD700', border: '2px solid #B8860B', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 22 }}>{j.medal}</span>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#5a0812', fontFamily: 'var(--font-mono)', letterSpacing: 1 }}>{j.label}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#1a0a2e' }}>{getTeamName(j.id)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {koMatches.length === 0 ? (
            <div className="card empty-state">
              <div style={{ fontSize: 40, marginBottom: 12 }}>🏆</div>
              <p>Bracket knockout belum dibuat.</p>
              <p style={{ fontSize: 13, marginTop: 8 }}>Klik "Setup Bracket" untuk memulai fase gugur.</p>
            </div>
          ) : (() => {
            // Bracket rendering
            const CARD_H = 64, ROUND_GAP = 60
            const matchPos = {}
            koRounds.forEach((round, ri) => {
              const rMatches = koMatches.filter(m => m.round === round).sort((a,b) => a.position - b.position)
              const x = ri * (CARD_W + ROUND_GAP)
              rMatches.forEach((match, mi) => {
                let y
                if (ri === 0) {
                  y = mi * (CARD_H + 16)
                } else {
                  const prevRound = koRounds[ri-1]
                  const f1 = koMatches.find(m => m.round === prevRound && m.position === mi*2)
                  const f2 = koMatches.find(m => m.round === prevRound && m.position === mi*2+1)
                  const y1 = f1 ? (matchPos[f1.id]?.cy ?? 0) : 0
                  const y2 = f2 ? (matchPos[f2.id]?.cy ?? 0) : y1 + CARD_H + 16
                  y = (y1 + y2) / 2 - CARD_H / 2
                }
                matchPos[match.id] = { x, y, cx: x + CARD_W/2, cy: y + CARD_H/2 }
              })
            })
            const totalW = koRounds.length * (CARD_W + ROUND_GAP) - ROUND_GAP + 20
            const totalH = Math.max(...Object.values(matchPos).map(p => p.y + CARD_H)) + 48
            const LINE = '#FFD700'

            return (
              <div style={{ overflowX: 'auto', paddingBottom: 16 }}>
                <div style={{ position: 'relative', width: totalW, height: totalH }}>
                  <svg width={totalW} height={totalH} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
                    {koRounds.map((round, ri) => {
                      if (ri === koRounds.length - 1) return null
                      const rMatches = koMatches.filter(m => m.round === round).sort((a,b) => a.position - b.position)
                      return rMatches.map((match, mi) => {
                        const pos = matchPos[match.id]; if (!pos) return null
                        const x1 = pos.x + CARD_W, y1 = pos.cy
                        const xMid = pos.x + CARD_W + ROUND_GAP/2
                        const isPair1 = mi % 2 === 0
                        const paired = rMatches[isPair1 ? mi+1 : mi-1]
                        const pairedPos = paired ? matchPos[paired.id] : null
                        const nextRound = koRounds[ri+1]
                        const nextMatch = koMatches.find(m => m.round === nextRound && m.position === Math.floor(mi/2))
                        const nextPos = nextMatch ? matchPos[nextMatch.id] : null
                        const yMid = nextPos ? nextPos.cy : (pairedPos ? (y1 + pairedPos.cy)/2 : y1)
                        return (
                          <g key={match.id}>
                            <line x1={x1} y1={y1} x2={xMid} y2={y1} stroke={LINE} strokeWidth={2} />
                            {isPair1 && pairedPos && <>
                              <line x1={xMid} y1={y1} x2={xMid} y2={pairedPos.cy} stroke={LINE} strokeWidth={2} />
                              {nextPos && <line x1={xMid} y1={yMid} x2={nextPos.x} y2={yMid} stroke={LINE} strokeWidth={2} />}
                              <line x1={x1} y1={pairedPos.cy} x2={xMid} y2={pairedPos.cy} stroke={LINE} strokeWidth={2} />
                            </>}
                          </g>
                        )
                      })
                    })}
                  </svg>

                  {/* Round labels */}
                  {koRounds.map((round, ri) => {
                    const rName = koMatches.find(m => m.round === round)?.roundName || `Babak ${round}`
                    return <div key={`lbl-${round}`} style={{ position: 'absolute', top: 0, left: ri*(CARD_W+ROUND_GAP), width: CARD_W, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 10, color: '#FFD700', textTransform: 'uppercase', letterSpacing: 2, fontWeight: 700 }}>{rName}</div>
                  })}

                  {/* Match cards */}
                  {koRounds.map(round => {
                    const rMatches = koMatches.filter(m => m.round === round).sort((a,b) => a.position - b.position)
                    return rMatches.map(match => {
                      const pos = matchPos[match.id]; if (!pos) return null
                      const { homeWins: hw, awayWins: aw } = calcTeamMatchResult(match.subMatches || [])
                      const hasTeams = match.homeId && match.awayId
                      const TOP = 20
                      return (
                        <div key={match.id} onClick={() => openKoScore(match)}
                          style={{ position: 'absolute', left: pos.x, top: pos.y + TOP, width: CARD_W, height: CARD_H, background: match.status === 'done' ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.07)', border: `2px solid ${match.status === 'done' ? '#FFD700' : 'rgba(255,255,255,0.2)'}`, borderRadius: 8, overflow: 'hidden', cursor: hasTeams ? 'pointer' : 'default', transition: 'all 0.15s' }}
                          onMouseEnter={e => { if (hasTeams) { e.currentTarget.style.borderColor = '#FFD700'; e.currentTarget.style.background = 'rgba(255,215,0,0.12)' } }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = match.status === 'done' ? '#FFD700' : 'rgba(255,255,255,0.2)'; e.currentTarget.style.background = match.status === 'done' ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.07)' }}
                        >
                          {[
                            { id: match.homeId, score: hw, isWin: match.winnerId === match.homeId },
                            { id: match.awayId, score: aw, isWin: match.winnerId === match.awayId },
                          ].map((side, si) => (
                            <div key={si} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 10px', height: CARD_H/2, background: side.isWin ? 'rgba(255,215,0,0.15)' : 'transparent', borderBottom: si === 0 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
                              <span style={{ fontSize: 11, fontWeight: side.isWin ? 700 : 400, color: side.isWin ? '#FFD700' : side.id ? '#fff' : 'rgba(255,255,255,0.3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>
                                {side.isWin && '✓ '}{getTeamName(side.id)}
                              </span>
                              {match.status === 'done' && (
                                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, color: side.isWin ? '#FFD700' : 'rgba(255,255,255,0.4)', background: side.isWin ? 'rgba(255,215,0,0.2)' : 'rgba(255,255,255,0.08)', padding: '1px 7px', borderRadius: 4 }}>{side.score}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )
                    })
                  })}
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* TEAM MODAL */}
      {showTeamModal && (
        <div className="modal-overlay" onClick={() => setShowTeamModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editTeamId ? 'EDIT TIM' : 'TAMBAH TIM'}</h2>
            <div style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.25)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
              ⭐ Sub-tim otomatis: <strong style={{ color: '#FFD700' }}>[Nama Tim] 1</strong>, <strong style={{ color: '#FFD700' }}>[Nama Tim] 2</strong>, <strong style={{ color: '#FFD700' }}>[Nama Tim] 3</strong>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-group" style={{ marginBottom: 0 }}><label>Nama Tim *</label><input value={teamForm.name} onChange={e => setTeamForm({ ...teamForm, name: e.target.value })} placeholder="Contoh: Jakarta" autoFocus /></div>
              <div className="form-group" style={{ marginBottom: 0 }}><label>🏷️ Kode Tim</label><input value={teamForm.code} onChange={e => setTeamForm({ ...teamForm, code: e.target.value.toUpperCase() })} placeholder="A1, B2..." style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
              <div className="form-group" style={{ marginBottom: 0 }}><label>Asal Daerah</label><input value={teamForm.origin} onChange={e => setTeamForm({ ...teamForm, origin: e.target.value })} placeholder="Provinsi/Kota" /></div>
              <div className="form-group" style={{ marginBottom: 0 }}><label>Pelatih</label><input value={teamForm.coach} onChange={e => setTeamForm({ ...teamForm, coach: e.target.value })} placeholder="Nama pelatih" /></div>
            </div>
            {teamForm.name && (
              <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(255,215,0,0.06)', borderRadius: 8, fontSize: 12 }}>
                <div style={{ color: '#FFD700', fontWeight: 600, marginBottom: 4 }}>Preview Sub-Tim:</div>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--font-mono)' }}>
                  {teamForm.name} 1 &nbsp;·&nbsp; {teamForm.name} 2 &nbsp;·&nbsp; {teamForm.name} 3
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveTeam} disabled={savingTeam}>{savingTeam ? <span className="spinner" /> : editTeamId ? 'Update Tim' : 'Tambah Tim'}</button>
              <button className="btn btn-ghost" onClick={() => setShowTeamModal(false)}>Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* GROUP SETUP MODAL */}
      {showGroupSetup && (
        <div className="modal-overlay" onClick={() => setShowGroupSetup(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>SETUP POOL</h2>
            <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 20, fontSize: 14 }}>{teams.length} tim akan dibagi ke dalam pool.</p>
            <div className="form-group">
              <label>Jumlah Pool</label>
              <select value={numGroups} onChange={e => setNumGroups(parseInt(e.target.value))}>
                {[1,2,3,4,5,6,7,8].filter(n => n <= teams.length).map(n => <option key={n} value={n}>{n} Pool</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={setupGroups}>Buat Pool</button>
              <button className="btn btn-ghost" onClick={() => setShowGroupSetup(false)}>Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* SCORE MODAL — 3 sub-matches */}
      {showScoreModal && editMatch && (
        <div className="modal-overlay" onClick={() => setShowScoreModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 580 }}>
            <h2>INPUT SKOR TEAM EVENT</h2>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(255,215,0,0.08)', borderRadius: 8, marginBottom: 16 }}>
              <span style={{ fontWeight: 700, color: '#FFD700', fontSize: 15 }}>{getTeamName(editMatch.homeId)}</span>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>vs</span>
              <span style={{ fontWeight: 700, color: '#FFD700', fontSize: 15 }}>{getTeamName(editMatch.awayId)}</span>
            </div>

            {/* 3 sub-matches */}
            {[0, 1, 2].map(si => (
              <SubMatchInput
                key={si}
                label={`REGU ${si + 1}`}
                homeTeam={getSubName(editMatch.homeId, si + 1)}
                awayTeam={getSubName(editMatch.awayId, si + 1)}
                sets={subSets[si]}
                onChange={newSets => {
                  const updated = [...subSets]
                  updated[si] = newSets
                  setSubSets(updated)
                }}
              />
            ))}

            {/* Summary */}
            {(() => {
              const subMatches = [
                { sets: subSets[0] }, { sets: subSets[1] }, { sets: subSets[2] }
              ]
              const { homeWins: hw, awayWins: aw } = calcTeamMatchResult(subMatches)
              const hasData = subSets.some(s => s.some(x => x?.home !== '' && x?.home !== undefined))
              if (!hasData) return null
              return (
                <div style={{ padding: '12px 16px', background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.3)', borderRadius: 8, marginBottom: 14, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>HASIL TIM</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 18, color: '#FFD700' }}>
                    {getTeamName(editMatch.homeId)} {hw} — {aw} {getTeamName(editMatch.awayId)}
                  </div>
                  {hw !== aw && (
                    <div style={{ fontSize: 12, color: '#4ade80', marginTop: 4 }}>
                      Pemenang: {hw > aw ? getTeamName(editMatch.homeId) : getTeamName(editMatch.awayId)}
                    </div>
                  )}
                </div>
              )
            })()}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div className="form-group" style={{ marginBottom: 0 }}><label>Tanggal</label><input type="date" value={matchDate} onChange={e => setMatchDate(e.target.value)} /></div>
              <div className="form-group" style={{ marginBottom: 0 }}><label>Waktu</label><input type="time" value={matchTime} onChange={e => setMatchTime(e.target.value)} /></div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveScore} disabled={savingMatch}>{savingMatch ? <span className="spinner" /> : 'Simpan Skor'}</button>
              <button className="btn btn-ghost" onClick={() => setShowScoreModal(false)}>Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* KO SETUP MODAL */}
      {showKoSetup && (
        <div className="modal-overlay" onClick={() => setShowKoSetup(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <h2>SETUP BRACKET KNOCKOUT</h2>
            <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 16, fontSize: 14 }}>Pilih tim yang lolos ke fase knockout:</p>
            {getSuggestedKoTeams().length > 0 && (
              <div style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#4ade80' }}>
                ✓ Otomatis dipilih: Juara & Runner-up setiap pool
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto', marginBottom: 16 }}>
              {teams.map(team => {
                const isSelected = selectedKoTeams.some(t => t.id === team.id)
                const sug = getSuggestedKoTeams().find(s => s.team.id === team.id)
                return (
                  <div key={team.id}
                    onClick={() => setSelectedKoTeams(prev => prev.some(t => t.id === team.id) ? prev.filter(t => t.id !== team.id) : [...prev, team])}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${isSelected ? '#FFD700' : 'rgba(255,255,255,0.15)'}`, background: isSelected ? 'rgba(255,215,0,0.08)' : 'rgba(255,255,255,0.03)' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${isSelected ? '#FFD700' : 'rgba(255,255,255,0.3)'}`, background: isSelected ? '#FFD700' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#1a0a2e', fontWeight: 700 }}>{isSelected && '✓'}</div>
                      <span style={{ fontSize: 13, fontWeight: isSelected ? 600 : 400, color: isSelected ? '#FFD700' : '#fff' }}>{team.name}</span>
                    </div>
                    {sug && <span style={{ fontSize: 11, color: '#4ade80', fontFamily: 'var(--font-mono)' }}>{sug.label}</span>}
                  </div>
                )
              })}
            </div>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 16 }}>{selectedKoTeams.length} tim dipilih</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={setupKnockout}>Buat Bracket</button>
              <button className="btn btn-ghost" onClick={() => setShowKoSetup(false)}>Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* KO SCORE MODAL */}
      {showKoScoreModal && koEditMatch && (
        <div className="modal-overlay" onClick={() => setShowKoScoreModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 580 }}>
            <h2>INPUT SKOR — {koEditMatch.roundName?.toUpperCase()}</h2>
            <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)', borderRadius: 8, padding: '8px 14px', marginBottom: 16, fontSize: 12, color: '#ff9999' }}>
              ⚠ Knockout: menang 2 regu sudah cukup untuk lolos. Tidak perlu isi semua regu jika sudah ada pemenang.
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(255,215,0,0.08)', borderRadius: 8, marginBottom: 16 }}>
              <span style={{ fontWeight: 700, color: '#FFD700', fontSize: 15 }}>{getTeamName(koEditMatch.homeId)}</span>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>vs</span>
              <span style={{ fontWeight: 700, color: '#FFD700', fontSize: 15 }}>{getTeamName(koEditMatch.awayId)}</span>
            </div>

            {[0, 1, 2].map(si => (
              <SubMatchInput
                key={si}
                label={`REGU ${si + 1}`}
                homeTeam={getSubName(koEditMatch.homeId, si + 1)}
                awayTeam={getSubName(koEditMatch.awayId, si + 1)}
                sets={koSubSets[si]}
                onChange={newSets => {
                  const updated = [...koSubSets]
                  updated[si] = newSets
                  setKoSubSets(updated)
                }}
              />
            ))}

            {/* Live summary */}
            {(() => {
              const subs = [{ sets: koSubSets[0] }, { sets: koSubSets[1] }, { sets: koSubSets[2] }]
              const { homeWins: hw, awayWins: aw } = calcTeamMatchResult(subs)
              const hasData = koSubSets.some(s => s.some(x => x?.home !== '' && x?.home !== undefined))
              if (!hasData) return null
              return (
                <div style={{ padding: '12px 16px', background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.3)', borderRadius: 8, marginBottom: 14, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>HASIL TIM</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 18, color: '#FFD700' }}>
                    {getTeamName(koEditMatch.homeId)} {hw} — {aw} {getTeamName(koEditMatch.awayId)}
                  </div>
                  {hw !== aw && (
                    <div style={{ fontSize: 12, color: '#4ade80', marginTop: 4 }}>
                      Pemenang: {hw > aw ? getTeamName(koEditMatch.homeId) : getTeamName(koEditMatch.awayId)} → maju ke babak berikutnya
                    </div>
                  )}
                </div>
              )
            })()}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div className="form-group" style={{ marginBottom: 0 }}><label>Tanggal</label><input type="date" value={matchDate} onChange={e => setMatchDate(e.target.value)} /></div>
              <div className="form-group" style={{ marginBottom: 0 }}><label>Waktu</label><input type="time" value={matchTime} onChange={e => setMatchTime(e.target.value)} /></div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveKoScore} disabled={savingMatch}>{savingMatch ? <span className="spinner" /> : 'Simpan & Lanjutkan'}</button>
              <button className="btn btn-ghost" onClick={() => setShowKoScoreModal(false)}>Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
