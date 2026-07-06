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

// Klasemen team event
function calcTeamStandings(teams, matches) {
  const tbl = {}
  teams.forEach(t => tbl[t.id] = { team: t, P: 0, W: 0, L: 0, SubW: 0, SubL: 0, Pts: 0 })

  matches.filter(m => m.status === 'done' && m.phase === 'group').forEach(m => {
    const h = tbl[m.homeId], a = tbl[m.awayId]
    if (!h || !a) return
    const { homeWins: hw, awayWins: aw } = calcTeamMatchResult(m.subMatches || [{}, {}, {}])
    h.P++; a.P++
    h.SubW += hw; h.SubL += aw
    a.SubW += aw; a.SubL += hw
    if (hw > aw) { h.W++; h.Pts += 3; a.L++ }
    else if (aw > hw) { a.W++; a.Pts += 3; h.L++ }
    else { h.Pts++; a.Pts++ }
  })

  return Object.values(tbl).sort((a, b) => {
    if (b.Pts !== a.Pts) return b.Pts - a.Pts
    return (b.SubW - b.SubL) - (a.SubW - a.SubL)
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
  // 3 sub-matches, each has 3 sets
  const [subSets, setSubSets] = useState([[{},{},{}],[{},{},{}],[{},{},{}]])
  const [matchDate, setMatchDate] = useState('')
  const [matchTime, setMatchTime] = useState('')
  const [savingMatch, setSavingMatch] = useState(false)

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

  // ── Score input ───────────────────────────────────────────
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

  const groupMatches = matches.filter(m => m.phase === 'group')
  const uniqueGroups = [...new Set(groupMatches.map(m => m.groupId))].map(gid => {
    const m = groupMatches.find(x => x.groupId === gid)
    return { id: gid, name: m?.groupName || gid, teamIds: [...new Set(groupMatches.filter(x => x.groupId === gid).flatMap(x => [x.homeId, x.awayId]))] }
  })

  const tabs = [
    { id: 'teams', label: '🏅 Tim Peserta' },
    { id: 'groups', label: '📊 Pool / Grup' },
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
                        <thead><tr><th>#</th><th>Tim</th><th>P</th><th>M</th><th>K</th><th>Regu+</th><th>Regu-</th><th>Pts</th></tr></thead>
                        <tbody>
                          {standings.map((row, i) => (
                            <tr key={row.team.id} style={{ background: i < 2 ? 'rgba(255,215,0,0.06)' : 'transparent' }}>
                              <td><span style={{ display: 'inline-block', width: 22, height: 22, lineHeight: '22px', textAlign: 'center', borderRadius: 4, fontSize: 11, fontWeight: 700, background: i < 2 ? '#FFD700' : 'rgba(255,255,255,0.1)', color: i < 2 ? '#1a0a2e' : 'rgba(255,255,255,0.5)' }}>{i + 1}</span></td>
                              <td style={{ fontWeight: i < 2 ? 700 : 500, color: i < 2 ? '#FFD700' : '#fff' }}>{row.team.name}</td>
                              <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{row.P}</td>
                              <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#4ade80', fontWeight: 600 }}>{row.W}</td>
                              <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#ff9999' }}>{row.L}</td>
                              <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{row.SubW}</td>
                              <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{row.SubL}</td>
                              <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: '#FFD700' }}>{row.Pts}</td>
                            </tr>
                          ))}
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
    </div>
  )
}
