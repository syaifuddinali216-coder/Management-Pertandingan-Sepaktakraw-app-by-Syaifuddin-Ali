import React, { useState, useEffect } from 'react'
import { useTeams, useMatches } from '../hooks/useFirestore.js'
import { useApp } from '../App.jsx'

const validSetScore = (a, b) => {
  a = parseInt(a) || 0; b = parseInt(b) || 0
  if (a > 17 || b > 17) return false
  if (a === 15 && b <= 13) return true
  if (b === 15 && a <= 13) return true
  if (a === 16 && b === 15) return true
  if (b === 16 && a === 15) return true
  if (a === 17 && b === 16) return true
  if (b === 17 && a === 16) return true
  return false
}

const setWinner = (h, a) => {
  h = parseInt(h) || 0; a = parseInt(a) || 0
  if (h > a) return 'home'
  if (a > h) return 'away'
  return null
}

const calcSetResult = (sets) => {
  let hw = 0, aw = 0
  ;(sets || []).forEach(s => {
    if (!s || (s.home === '' && s.away === '')) return
    const w = setWinner(s.home, s.away)
    if (w === 'home') hw++
    else if (w === 'away') aw++
  })
  return { homeSetWins: hw, awaySetWins: aw }
}

function SetScoreInput({ sets, onChange, homeLabel, awayLabel }) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, marginBottom: 8 }}>
        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--green-accent)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>{homeLabel}</div>
        <div />
        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--green-accent)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>{awayLabel}</div>
      </div>
      {[0, 1, 2].map(i => (
        <div key={i} style={{ marginBottom: 12 }}>
          <label style={{ marginBottom: 6, textAlign: 'center', display: 'block' }}>Set {i + 1} {i === 2 ? '(Jika Diperlukan)' : ''}</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center' }}>
            <input type="number" min="0" max="17" placeholder="0"
              value={sets[i]?.home ?? ''}
              onChange={e => { const s = [...sets]; s[i] = { ...s[i], home: e.target.value }; onChange(s) }}
              style={{ textAlign: 'center', fontSize: 22, fontFamily: 'var(--font-mono)', fontWeight: 700 }} />
            <span style={{ color: 'var(--gray-600)', textAlign: 'center', fontWeight: 700, fontSize: 18 }}>—</span>
            <input type="number" min="0" max="17" placeholder="0"
              value={sets[i]?.away ?? ''}
              onChange={e => { const s = [...sets]; s[i] = { ...s[i], away: e.target.value }; onChange(s) }}
              style={{ textAlign: 'center', fontSize: 22, fontFamily: 'var(--font-mono)', fontWeight: 700 }} />
          </div>
          {sets[i]?.home !== undefined && sets[i]?.away !== undefined && sets[i].home !== '' && sets[i].away !== '' && (
            <p style={{ fontSize: 11, color: validSetScore(sets[i].home, sets[i].away) ? 'var(--green-accent)' : 'var(--red-card)', marginTop: 4, fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
              {validSetScore(sets[i].home, sets[i].away) ? '✓ Skor valid' : '⚠ Skor tidak valid (maks 15, deuce 16-17)'}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

function calcStandings(teams, matches) {
  const tbl = {}
  teams.forEach(t => tbl[t.id] = { team: t, P: 0, W: 0, L: 0, SetW: 0, SetL: 0, Pts: 0 })
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

// ── KNOCKOUT COMPONENT ─────────────────────────────────────
function KnockoutTab({ teams, matches, addMatch, updateMatch, deleteMatch, showToast }) {
  const [showSetup, setShowSetup] = useState(false)
  const [selectedTeams, setSelectedTeams] = useState([])
  const [showScoreModal, setShowScoreModal] = useState(false)
  const [editMatch, setEditMatch] = useState(null)
  const [sets, setSets] = useState([{}, {}, {}])
  const [matchDate, setMatchDate] = useState('')
  const [matchTime, setMatchTime] = useState('')
  const [saving, setSaving] = useState(false)

  const koMatches = matches.filter(m => m.phase === 'knockout')
  const getTeamName = (id) => { if (!id) return 'TBD'; return teams.find(t => t.id === id)?.name || 'TBD' }

  // Build suggested teams from group standings
  const getSuggested = () => {
    const groupMatches = matches.filter(m => m.phase === 'group')
    const grpIds = [...new Set(groupMatches.map(m => m.groupId))]
    const suggestions = []
    grpIds.forEach(gid => {
      const grpTeamIds = [...new Set(groupMatches.filter(m => m.groupId === gid).flatMap(m => [m.homeId, m.awayId]))]
      const grpTeams = teams.filter(t => grpTeamIds.includes(t.id))
      const grpMatches = groupMatches.filter(m => m.groupId === gid)
      const standings = calcStandings(grpTeams, grpMatches)
      const gName = groupMatches.find(m => m.groupId === gid)?.groupName || gid
      standings.forEach((row, i) => suggestions.push({ team: row.team, label: `${gName} #${i + 1}`, pos: i }))
    })
    return suggestions
  }

  const setupKnockout = async () => {
    if (selectedTeams.length < 2) return showToast('Pilih minimal 2 tim!')
    const n = selectedTeams.length
    const pow2 = [2, 4, 8, 16].find(p => p >= n) || 16
    const teamList = [...selectedTeams]
    while (teamList.length < pow2) teamList.push(null)

    const rounds = Math.log2(pow2)
    const roundNames = { 1: 'Final', 2: 'Semifinal', 3: 'Perempat Final', 4: 'Babak 16 Besar' }

    // Delete old ko matches
    for (const m of koMatches) await deleteMatch(m.id)

    const allNew = []
    for (let r = rounds; r >= 1; r--) {
      const pairCount = Math.pow(2, r - 1)
      for (let i = 0; i < pairCount; i++) {
        const isFirstRound = r === rounds
        await addMatch({
          phase: 'knockout', round: r,
          roundName: roundNames[r] || `Babak ${r}`,
          position: i,
          homeId: isFirstRound ? (teamList[i * 2]?.id || null) : null,
          awayId: isFirstRound ? (teamList[i * 2 + 1]?.id || null) : null,
          sets: [{}, {}, {}], status: 'pending',
          date: '', time: '', winnerId: null,
        })
      }
    }
    setShowSetup(false)
    showToast('Bracket knockout berhasil dibuat!')
  }

  const openScore = (match) => {
    if (!match.homeId || !match.awayId) return showToast('Tunggu hasil babak sebelumnya!')
    setEditMatch(match)
    setSets(match.sets?.length ? match.sets : [{}, {}, {}])
    setMatchDate(match.date || '')
    setMatchTime(match.time || '')
    setShowScoreModal(true)
  }

  const saveScore = async () => {
    const { homeSetWins: hw, awaySetWins: aw } = calcSetResult(sets)
    if (hw === aw) return showToast('Tidak boleh seri di knockout!')
    const winnerId = hw > aw ? editMatch.homeId : editMatch.awayId
    setSaving(true)

    await updateMatch(editMatch.id, {
      sets, date: matchDate, time: matchTime,
      status: 'done', homeSetWins: hw, awaySetWins: aw, winnerId
    })

    // Advance winner to next round
    const nextRound = editMatch.round - 1
    if (nextRound >= 1) {
      const nextPos = Math.floor(editMatch.position / 2)
      const isHome = editMatch.position % 2 === 0
      const nextMatch = koMatches.find(m => m.round === nextRound && m.position === nextPos)
      if (nextMatch) {
        await updateMatch(nextMatch.id, isHome ? { homeId: winnerId } : { awayId: winnerId })
      }
    }
    setSaving(false)
    setShowScoreModal(false)
    showToast('Skor knockout tersimpan!')
  }

  const rounds = [...new Set(koMatches.map(m => m.round))].sort((a, b) => b - a)
  const champion = koMatches.find(m => m.round === 1 && m.status === 'done')?.winnerId
  const suggested = getSuggested()

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: 'var(--gray-600)' }}>
          {koMatches.length === 0 ? 'Bracket belum dibuat.' : `${koMatches.filter(m => m.status === 'done').length}/${koMatches.length} match selesai`}
        </div>
        <button className="btn btn-primary" style={{ padding: '8px 16px', fontSize: 13 }} onClick={() => { setSelectedTeams(suggested.filter(s => s.pos < 2).map(s => s.team)); setShowSetup(true) }}>
          {koMatches.length > 0 ? '🔄 Reset Bracket' : '🏆 Setup Bracket'}
        </button>
      </div>

      {/* Juara display */}
      {champion && (() => {
        const final = koMatches.find(m => m.round === 1 && m.status === 'done')
        const runnerUp = final ? (final.winnerId === final.homeId ? final.awayId : final.homeId) : null
        const semis = koMatches.filter(m => m.round === 2 && m.status === 'done')
        const juara3 = semis.map(m => m.winnerId === m.homeId ? m.awayId : m.homeId)
        return (
          <div style={{ background: 'linear-gradient(135deg, #8b0e1e, #c0152a)', border: '2px solid #FFD700', borderRadius: 14, padding: '20px 24px', marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#FFD700', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14, fontWeight: 700 }}>🏆 Hasil Akhir Turnamen</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              {[
                { medal: '🥇', label: 'JUARA I', id: champion, bg: '#FFD700', border: '#FFD700', textColor: '#5a0812' },
                { medal: '🥈', label: 'JUARA II', id: runnerUp, bg: '#FFD700', border: '#FFD700', textColor: '#5a0812' },
                ...juara3.map(id => ({ medal: '🥉', label: 'JUARA III', id, bg: '#FFD700', border: '#FFD700', textColor: '#5a0812' })),
              ].filter(j => j.id).map((j, i) => (
                <div key={i} style={{ background: j.bg, border: `2px solid ${j.border}`, borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 24 }}>{j.medal}</span>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: j.textColor, fontFamily: 'var(--font-mono)', letterSpacing: 1, opacity: 0.7 }}>{j.label}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: j.textColor, marginTop: 2 }}>{getTeamName(j.id)}</div>
                  </div>
                </div>
              ))}
            </div>
            {semis.length < 2 && juara3.length < 2 && (
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>* Juara III bersama akan muncul setelah kedua semifinal selesai</p>
            )}
          </div>
        )
      })()}

      {koMatches.length === 0 ? (
        <div className="card empty-state">
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏆</div>
          <p>Bracket knockout belum dibuat.</p>
          <p style={{ fontSize: 13, marginTop: 8 }}>Klik "Setup Bracket" untuk memulai fase knockout.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', paddingBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', minWidth: 'max-content', position: 'relative' }}>
            {rounds.map((round, ri) => {
              const rMatches = koMatches.filter(m => m.round === round)
              const rName = rMatches[0]?.roundName || `Babak ${round}`
              const matchH = 72 // match card height
              const matchGap = 16
              const totalRounds = rounds.length
              const spacing = Math.pow(2, ri) * (matchH + matchGap)

              return (
                <div key={round} style={{ display: 'flex', alignItems: 'flex-start', marginRight: 0 }}>
                  <div style={{ width: 220 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--green-accent)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10, textAlign: 'center', fontWeight: 700 }}>{rName}</div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {rMatches.map((match, mi) => {
                        const { homeSetWins: hw, awaySetWins: aw } = calcSetResult(match.sets)
                        const marginTop = mi === 0 ? Math.pow(2, ri) * matchH / 2 - matchH / 2 : Math.pow(2, ri + 1) * (matchH + matchGap) / 2 - matchH / 2
                        return (
                          <div key={match.id} style={{ marginBottom: matchGap, marginTop: mi === 0 ? `${Math.pow(2, ri) * (matchH/2 + matchGap/2) - matchH/2}px` : `${Math.pow(2, ri + 1) * (matchH + matchGap) - matchH - matchGap}px` }}>
                            <div
                              onClick={() => openScore(match)}
                              style={{
                                background: 'var(--bg-card)', border: `1.5px solid ${match.status === 'done' ? 'var(--green-accent)' : 'var(--border)'}`,
                                borderRadius: 10, overflow: 'hidden',
                                cursor: match.homeId && match.awayId ? 'pointer' : 'default',
                                transition: 'all 0.15s', boxShadow: 'var(--shadow)',
                              }}
                              onMouseEnter={e => { if (match.homeId && match.awayId) { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(196,127,0,0.2)' } }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = match.status === 'done' ? 'var(--green-accent)' : 'var(--border)'; e.currentTarget.style.boxShadow = 'var(--shadow)' }}
                            >
                              {[
                                { id: match.homeId, score: hw, isWin: match.winnerId === match.homeId },
                                { id: match.awayId, score: aw, isWin: match.winnerId === match.awayId }
                              ].map((side, si) => (
                                <div key={si} style={{
                                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                  padding: '9px 12px',
                                  background: side.isWin ? 'rgba(26,107,58,0.07)' : 'transparent',
                                  borderBottom: si === 0 ? '1px solid var(--gray-200)' : 'none',
                                }}>
                                  <span style={{ fontSize: 12, fontWeight: side.isWin ? 700 : 400, color: side.isWin ? 'var(--green-field)' : side.id ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                    {side.isWin && '✓ '}{getTeamName(side.id)}
                                  </span>
                                  {match.status === 'done' && (
                                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: side.isWin ? 'var(--green-field)' : 'var(--text-muted)', fontSize: 13, background: side.isWin ? 'rgba(26,107,58,0.1)' : 'var(--gray-100)', padding: '2px 8px', borderRadius: 4 }}>{side.score}</span>
                                  )}
                                </div>
                              ))}
                              {match.date && <div style={{ padding: '3px 12px', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', background: 'var(--gray-100)', borderTop: '1px solid var(--border)' }}>{new Date(match.date).toLocaleDateString('id-ID')} {match.time}</div>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  {/* Connector lines SVG */}
                  {ri < rounds.length - 1 && (() => {
                    const nextRound = rounds[ri + 1]
                    const nextMatches = koMatches.filter(m => m.round === nextRound)
                    const h = rMatches.length * (matchH + matchGap)
                    return (
                      <svg width="40" height={Math.max(h, nextMatches.length * (matchH + matchGap) * 2)} style={{ flexShrink: 0, overflow: 'visible', marginTop: `${Math.pow(2, ri) * (matchH/2 + matchGap/2) - matchH/2}px` }}>
                        {rMatches.map((match, mi) => {
                          const yTop = mi * (Math.pow(2, ri + 1) * (matchH + matchGap)) + matchH / 2
                          const yBottom = yTop + Math.pow(2, ri) * (matchH + matchGap)
                          const yMid = (yTop + yBottom) / 2
                          return (
                            <g key={match.id}>
                              <line x1="0" y1={yTop} x2="20" y2={yTop} stroke="var(--green-accent)" strokeWidth="1.5" />
                              <line x1="20" y1={yTop} x2="20" y2={yBottom} stroke="var(--green-accent)" strokeWidth="1.5" />
                              <line x1="0" y1={yBottom} x2="20" y2={yBottom} stroke="var(--green-accent)" strokeWidth="1.5" />
                              <line x1="20" y1={yMid} x2="40" y2={yMid} stroke="var(--green-accent)" strokeWidth="1.5" />
                            </g>
                          )
                        })}
                      </svg>
                    )
                  })()}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Setup Modal */}
      {showSetup && (
        <div className="modal-overlay" onClick={() => setShowSetup(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <h2>SETUP BRACKET KNOCKOUT</h2>
            <p style={{ color: 'var(--gray-600)', marginBottom: 16, fontSize: 14 }}>Pilih tim yang lolos ke fase knockout:</p>
            {suggested.length > 0 && (
              <div style={{ background: 'rgba(82,183,136,0.08)', border: '1px solid rgba(82,183,136,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: 'var(--green-accent)' }}>
                ✓ Otomatis dipilih: Juara & Runner-up setiap pool dari hasil klasemen
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto', marginBottom: 16 }}>
              {teams.map(team => {
                const isSelected = selectedTeams.some(t => t.id === team.id)
                const sug = suggested.find(s => s.team.id === team.id)
                return (
                  <div key={team.id} onClick={() => setSelectedTeams(prev => prev.some(t => t.id === team.id) ? prev.filter(t => t.id !== team.id) : [...prev, team])}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${isSelected ? 'var(--gold)' : 'rgba(64,145,108,0.2)'}`, background: isSelected ? 'rgba(244,160,28,0.08)' : 'rgba(255,255,255,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${isSelected ? 'var(--gold)' : 'var(--gray-600)'}`, background: isSelected ? 'var(--gold)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--dark)', fontWeight: 700 }}>{isSelected && '✓'}</div>
                      <span style={{ fontSize: 13, fontWeight: isSelected ? 600 : 400 }}>{team.name}</span>
                    </div>
                    {sug && <span style={{ fontSize: 11, color: sug.pos === 0 ? 'var(--gold)' : 'var(--green-accent)', fontFamily: 'var(--font-mono)' }}>{sug.label}</span>}
                  </div>
                )
              })}
            </div>
            <p style={{ fontSize: 12, color: 'var(--gray-600)', marginBottom: 16 }}>{selectedTeams.length} tim dipilih</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={setupKnockout}>Buat Bracket</button>
              <button className="btn btn-ghost" onClick={() => setShowSetup(false)}>Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* Score Modal */}
      {showScoreModal && editMatch && (
        <div className="modal-overlay" onClick={() => setShowScoreModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>INPUT SKOR — {editMatch.roundName?.toUpperCase()}</h2>
            <p style={{ fontSize: 11, color: 'var(--red-card)', marginBottom: 16, fontFamily: 'var(--font-mono)' }}>⚠ Tidak boleh seri. Pemenang otomatis maju ke babak berikutnya.</p>
            <SetScoreInput sets={sets} onChange={setSets} homeLabel={getTeamName(editMatch.homeId)} awayLabel={getTeamName(editMatch.awayId)} />
            {sets.some(s => s?.home !== '' && s?.home !== undefined) && (
              <div style={{ padding: '10px 14px', background: 'rgba(244,160,28,0.08)', borderRadius: 8, marginBottom: 14, fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                Hasil Set: {calcSetResult(sets).homeSetWins} — {calcSetResult(sets).awaySetWins}
                {calcSetResult(sets).homeSetWins !== calcSetResult(sets).awaySetWins && (
                  <span style={{ color: 'var(--gold)', marginLeft: 8 }}>Menang: {calcSetResult(sets).homeSetWins > calcSetResult(sets).awaySetWins ? getTeamName(editMatch.homeId) : getTeamName(editMatch.awayId)}</span>
                )}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              <div className="form-group" style={{ marginBottom: 0 }}><label>Tanggal</label><input type="date" value={matchDate} onChange={e => setMatchDate(e.target.value)} /></div>
              <div className="form-group" style={{ marginBottom: 0 }}><label>Waktu</label><input type="time" value={matchTime} onChange={e => setMatchTime(e.target.value)} /></div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveScore} disabled={saving}>{saving ? <span className="spinner" /> : 'Simpan & Lanjutkan'}</button>
              <button className="btn btn-ghost" onClick={() => setShowScoreModal(false)}>Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── MAIN COMPONENT ─────────────────────────────────────────
export default function NomorDetail({ eventId, nomor, event, onBack }) {
  const { showToast } = useApp()
  const { teams, addTeam, updateTeam, deleteTeam } = useTeams(eventId, nomor?.id)
  const { matches, addMatch, updateMatch, deleteMatch } = useMatches(eventId, nomor?.id)

  const [tab, setTab] = useState('teams')
  const [showTeamModal, setShowTeamModal] = useState(false)
  const [editTeamId, setEditTeamId] = useState(null)
  const [teamForm, setTeamForm] = useState({ name: '', origin: '', coach: '', captain: '', athletes: '', officials: '', code: '' })
  const [savingTeam, setSavingTeam] = useState(false)
  const [groups, setGroups] = useState([])
  const [showGroupSetup, setShowGroupSetup] = useState(false)
  const [numGroups, setNumGroups] = useState(2)
  const [showScoreModal, setShowScoreModal] = useState(false)
  const [editMatch, setEditMatch] = useState(null)
  const [sets, setSets] = useState([{}, {}, {}])
  const [matchDate, setMatchDate] = useState('')
  const [matchTime, setMatchTime] = useState('')
  const [savingMatch, setSavingMatch] = useState(false)

  const getTeamName = (id) => teams.find(t => t.id === id)?.name || 'TBD'

  const openAddTeam = () => { setTeamForm({ name: '', origin: '', coach: '', captain: '', athletes: '', officials: '', code: '' }); setEditTeamId(null); setShowTeamModal(true) }
  const openEditTeam = (t) => { setTeamForm({ name: t.name, origin: t.origin || '', coach: t.coach || '', captain: t.captain || '', athletes: t.athletes || '', officials: t.officials || '', code: t.code || '' }); setEditTeamId(t.id); setShowTeamModal(true) }

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

  const setupGroups = async () => {
    if (teams.length < 2) return showToast('Minimal 2 tim!')

    // Cek apakah ada tim dengan kode yang mengandung huruf pool (A, B, C, ...)
    // Contoh: "RPA A1" → pool A, "RPA B2" → pool B, "C3" → pool C
    const extractPoolLetter = (code) => {
      if (!code) return null
      // Cari huruf kapital tunggal yang diikuti angka, contoh: A1, B2, C3
      // atau format seperti "RPA A1" → ambil huruf sebelum angka terakhir
      const match = code.toUpperCase().match(/\b([A-Z])\d+$/)
      if (match) return match[1]
      // Format alternatif: huruf kapital yang berdiri sendiri sebelum angka
      const match2 = code.toUpperCase().match(/([A-Z])\s*\d+/)
      if (match2) return match2[1]
      return null
    }

    const teamsWithPoolCode = teams.filter(t => extractPoolLetter(t.code))

    if (teamsWithPoolCode.length >= 2) {
      // Mode otomatis berdasarkan kode
      const poolMap = {} // { 'A': [team, team], 'B': [team] }
      teams.forEach(t => {
        const letter = extractPoolLetter(t.code)
        if (letter) {
          if (!poolMap[letter]) poolMap[letter] = []
          poolMap[letter].push(t)
        }
      })

      const poolLetters = Object.keys(poolMap).sort()
      if (poolLetters.length === 0) return showToast('Tidak ada kode pool yang valid!')

      const grps = poolLetters.map((letter, i) => ({
        id: `g${i}`,
        name: `Pool ${letter}`,
        teamIds: poolMap[letter].map(t => t.id),
      }))
      setGroups(grps)

      // Hapus match grup lama
      const existingGroupMatches = matches.filter(m => m.phase === 'group')
      for (const m of existingGroupMatches) await deleteMatch(m.id)

      // Buat match baru per pool
      for (const grp of grps) {
        const tids = grp.teamIds
        for (let i = 0; i < tids.length; i++)
          for (let j = i + 1; j < tids.length; j++)
            await addMatch({ groupId: grp.id, groupName: grp.name, homeId: tids[i], awayId: tids[j], sets: [{}, {}, {}], status: 'pending', phase: 'group', winnerId: null, date: '', time: '' })
      }

      setShowGroupSetup(false)
      showToast(`✅ ${poolLetters.length} pool dibuat otomatis dari kode tim!`)
      setTab('groups')

    } else {
      // Mode manual / acak seperti sebelumnya
      const shuffled = [...teams].sort(() => Math.random() - 0.5)
      const grps = Array.from({ length: numGroups }, (_, i) => ({
        id: `g${i}`, name: `Pool ${String.fromCharCode(65 + i)}`, teamIds: []
      }))
      shuffled.forEach((t, i) => grps[i % numGroups].teamIds.push(t.id))
      setGroups(grps)

      const existingGroupMatches = matches.filter(m => m.phase === 'group')
      for (const m of existingGroupMatches) await deleteMatch(m.id)
      for (const grp of grps) {
        const tids = grp.teamIds
        for (let i = 0; i < tids.length; i++)
          for (let j = i + 1; j < tids.length; j++)
            await addMatch({ groupId: grp.id, groupName: grp.name, homeId: tids[i], awayId: tids[j], sets: [{}, {}, {}], status: 'pending', phase: 'group', winnerId: null, date: '', time: '' })
      }
      setShowGroupSetup(false)
      showToast(`${numGroups} pool berhasil dibuat!`)
      setTab('groups')
    }
  }

  const openScore = (match) => {
    setEditMatch(match); setSets(match.sets?.length ? match.sets : [{}, {}, {}])
    setMatchDate(match.date || ''); setMatchTime(match.time || ''); setShowScoreModal(true)
  }

  const saveScore = async () => {
    const { homeSetWins: hw, awaySetWins: aw } = calcSetResult(sets)
    const winnerId = hw > aw ? editMatch.homeId : aw > hw ? editMatch.awayId : null
    setSavingMatch(true)
    await updateMatch(editMatch.id, { sets, date: matchDate, time: matchTime, status: 'done', homeSetWins: hw, awaySetWins: aw, winnerId })
    setSavingMatch(false); setShowScoreModal(false); showToast('Skor tersimpan!')
  }

  const groupMatches = matches.filter(m => m.phase === 'group')
  const uniqueGroups = groups.length > 0 ? groups : [...new Set(groupMatches.map(m => m.groupId))].map(gid => {
    const m = groupMatches.find(x => x.groupId === gid)
    return { id: gid, name: m?.groupName || gid, teamIds: [...new Set(groupMatches.filter(x => x.groupId === gid).flatMap(x => [x.homeId, x.awayId]))] }
  })

  const tabs = [
    { id: 'teams', label: '🏅 Tim & Atlet' },
    { id: 'groups', label: '📊 Pool / Grup' },
    { id: 'knockout', label: '🏆 Knockout' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontSize: 13, color: 'var(--text-muted)' }}>
        <span style={{ cursor: 'pointer', color: 'var(--green-field)', fontWeight: 600 }} onClick={onBack}>← {event?.name}</span>
        <span>›</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{nomor?.name}</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
        <div>
          <div className="tag-line" style={{ marginBottom: 6 }}>Nomor Pertandingan</div>
          <h1 style={{ fontSize: 38, color: 'var(--green-field)' }}>{nomor?.name?.toUpperCase()}</h1>
        </div>
        {tab === 'teams' && <button className="btn btn-primary" onClick={openAddTeam}>+ Tambah Tim</button>}
        {tab === 'groups' && <button className="btn btn-primary" onClick={() => setShowGroupSetup(true)}>⚙️ Setup Pool</button>}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--gray-200)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '9px 18px', border: 'none', borderRadius: 8, cursor: 'pointer',
            fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, transition: 'all 0.2s',
            background: tab === t.id ? 'var(--green-field)' : 'transparent',
            color: tab === t.id ? '#fff' : 'var(--text-muted)',
          }}>{t.label}</button>
        ))}
      </div>

      {/* TEAMS TAB */}
      {tab === 'teams' && (
        teams.length === 0 ? (
          <div className="card empty-state"><div style={{ fontSize: 40 }}>🏅</div><p style={{ marginTop: 12 }}>Belum ada tim terdaftar.</p><button className="btn btn-primary" style={{ marginTop: 16 }} onClick={openAddTeam}>+ Tambah Tim Pertama</button></div>
        ) : (
          <div className="card">
            <div style={{ marginBottom: 14, fontSize: 12, color: 'var(--gray-600)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 1 }}>{teams.length} kontingen terdaftar</div>
            <table>
              <thead><tr><th>#</th><th>Kode</th><th>Nama Tim</th><th>Asal</th><th>Pelatih</th><th>Kapten</th><th>Aksi</th></tr></thead>
              <tbody>
                {teams.map((t, i) => (
                  <tr key={t.id}>
                    <td><span style={{ fontFamily: 'var(--font-mono)', color: '#FFD700', fontWeight: 700 }}>{String(i + 1).padStart(2, '0')}</span></td>
                    <td>
                      {t.code
                        ? <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, background: 'rgba(255,215,0,0.15)', color: '#FFD700', padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(255,215,0,0.4)', fontSize: 13 }}>{t.code}</span>
                        : <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>—</span>
                      }
                    </td>
                    <td style={{ fontWeight: 600, color: '#fff' }}>{t.name}</td>
                    <td style={{ color: 'rgba(255,255,255,0.6)' }}>{t.origin || '—'}</td>
                    <td style={{ color: 'rgba(255,255,255,0.6)' }}>{t.coach || '—'}</td>
                    <td style={{ color: 'rgba(255,255,255,0.6)' }}>{t.captain || '—'}</td>
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
          <div className="card empty-state"><div style={{ fontSize: 40 }}>📊</div><p style={{ marginTop: 12 }}>Pool belum dibuat.</p>{teams.length >= 2 ? <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowGroupSetup(true)}>⚙️ Setup Pool</button> : <p style={{ fontSize: 13, marginTop: 8 }}>Tambahkan minimal 2 tim terlebih dahulu.</p>}</div>
        ) : (
          <div>
            {uniqueGroups.map(grp => {
              const grpTeams = teams.filter(t => grp.teamIds.includes(t.id))
              const grpMatches = groupMatches.filter(m => m.groupId === grp.id)
              const standings = calcStandings(grpTeams, grpMatches)
              return (
                <div key={grp.id} style={{ marginBottom: 28 }}>
                  <div style={{ fontSize: 22, fontFamily: 'var(--font-display)', color: '#FFD700', marginBottom: 14, padding: '10px 18px', background: 'rgba(0,0,0,0.2)', borderRadius: 8, borderLeft: '4px solid #FFD700', display: 'inline-block', letterSpacing: 1 }}>{grp.name}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                    <div className="card">
                      <div className="tag-line" style={{ marginBottom: 12, fontSize: 10 }}>Klasemen</div>
                      <table>
                        <thead><tr><th>#</th><th>Tim</th><th>P</th><th>M</th><th>K</th><th>Set+</th><th>Set-</th><th>Pts</th></tr></thead>
                        <tbody>
                          {standings.map((row, i) => (
                            <tr key={row.team.id} style={{ background: i < 2 ? 'rgba(255,215,0,0.08)' : 'transparent' }}>
                              <td><span style={{ display: 'inline-block', width: 22, height: 22, lineHeight: '22px', textAlign: 'center', borderRadius: 4, fontSize: 11, fontWeight: 700, background: i < 2 ? '#FFD700' : 'rgba(255,255,255,0.15)', color: i < 2 ? '#5a0812' : 'rgba(255,255,255,0.6)' }}>{i + 1}</span></td>
                              <td style={{ fontWeight: i < 2 ? 700 : 500, color: i < 2 ? '#FFD700' : '#fff' }}>{row.team.name}</td>
                              <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>{row.P}</td>
                              <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#4ade80', fontWeight: 600 }}>{row.W}</td>
                              <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#ffaaaa' }}>{row.L}</td>
                              <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>{row.SetW}</td>
                              <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>{row.SetL}</td>
                              <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: '#FFD700' }}>{row.Pts}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="card">
                      <div className="tag-line" style={{ marginBottom: 12, fontSize: 10 }}>Jadwal & Hasil</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {grpMatches.map(match => {
                          const { homeSetWins: hw, awaySetWins: aw } = calcSetResult(match.sets || [])
                          return (
                            <div key={match.id} style={{ display: 'flex', alignItems: 'center', padding: '9px 11px', borderRadius: 8, background: match.status === 'done' ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.05)', border: `1.5px solid ${match.status === 'done' ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.2)'}`, gap: 6 }}>
                              <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#fff' }}>{getTeamName(match.homeId)}</div>
                              <div style={{ textAlign: 'center', minWidth: 60 }}>
                                {match.status === 'done' ? <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#FFD700', fontSize: 14 }}>{hw} — {aw}</span> : <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>vs</span>}
                              </div>
                              <div style={{ flex: 1, fontSize: 12, fontWeight: 600, textAlign: 'right', color: '#fff' }}>{getTeamName(match.awayId)}</div>
                              <button className="btn btn-ghost" style={{ padding: '3px 9px', fontSize: 11, marginLeft: 4 }} onClick={() => openScore(match)}>{match.status === 'done' ? 'Edit' : 'Input'}</button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
            <div style={{ marginTop: 16, padding: '14px 18px', background: 'rgba(244,160,28,0.08)', border: '1px solid rgba(244,160,28,0.3)', borderRadius: 10, fontSize: 13, color: 'var(--gold)' }}>
              💡 Setelah semua hasil pool selesai diinput → klik tab <strong>🏆 Knockout</strong> untuk setup bracket fase gugur!
            </div>
          </div>
        )
      )}

      {/* KNOCKOUT TAB */}
      {tab === 'knockout' && (
        <KnockoutTab teams={teams} matches={matches} addMatch={addMatch} updateMatch={updateMatch} deleteMatch={deleteMatch} showToast={showToast} />
      )}

      {/* TEAM MODAL */}
      {showTeamModal && (
        <div className="modal-overlay" onClick={() => setShowTeamModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <h2>{editTeamId ? 'EDIT TIM' : 'TAMBAH TIM'}</h2>

            {/* Kode Tim - prominent at top */}
            <div style={{ background: 'rgba(255,215,0,0.1)', border: '1.5px solid rgba(255,215,0,0.4)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ color: '#FFD700' }}>🏷️ Kode Tim (untuk integrasi jadwal)</label>
                <input
                  value={teamForm.code || ''}
                  onChange={e => setTeamForm({ ...teamForm, code: e.target.value.toUpperCase() })}
                  placeholder="Contoh: A1, B2, C3 ..."
                  style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 16, letterSpacing: 2 }}
                />
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>
                  Kode ini harus sama dengan kode di jadwal pertandingan. Jadwal akan otomatis tampilkan nama tim ini.
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-group" style={{ marginBottom: 0 }}><label>Nama Tim *</label><input value={teamForm.name} onChange={e => setTeamForm({ ...teamForm, name: e.target.value })} placeholder="Nama tim" autoFocus /></div>
              <div className="form-group" style={{ marginBottom: 0 }}><label>Asal Daerah</label><input value={teamForm.origin} onChange={e => setTeamForm({ ...teamForm, origin: e.target.value })} placeholder="Provinsi/Kabupaten" /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
              <div className="form-group" style={{ marginBottom: 0 }}><label>Pelatih</label><input value={teamForm.coach} onChange={e => setTeamForm({ ...teamForm, coach: e.target.value })} placeholder="Nama pelatih" /></div>
              <div className="form-group" style={{ marginBottom: 0 }}><label>Kapten</label><input value={teamForm.captain} onChange={e => setTeamForm({ ...teamForm, captain: e.target.value })} placeholder="Nama kapten" /></div>
            </div>
            <div className="form-group" style={{ marginTop: 14 }}><label>Daftar Atlet</label><textarea rows={3} value={teamForm.athletes} onChange={e => setTeamForm({ ...teamForm, athletes: e.target.value })} placeholder="Pisahkan dengan koma" /></div>
            <div className="form-group"><label>Manager & Official</label><textarea rows={2} value={teamForm.officials} onChange={e => setTeamForm({ ...teamForm, officials: e.target.value })} placeholder="Manager: ..., Official: ..." /></div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveTeam} disabled={savingTeam}>{savingTeam ? <span className="spinner" /> : editTeamId ? 'Update' : 'Tambah Tim'}</button>
              <button className="btn btn-ghost" onClick={() => setShowTeamModal(false)}>Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* GROUP SETUP MODAL */}
      {showGroupSetup && (() => {
        const extractPoolLetter = (code) => {
          if (!code) return null
          const match = code.toUpperCase().match(/\b([A-Z])\d+$/)
          if (match) return match[1]
          const match2 = code.toUpperCase().match(/([A-Z])\s*\d+/)
          if (match2) return match2[1]
          return null
        }
        const teamsWithCode = teams.filter(t => extractPoolLetter(t.code))
        const poolMap = {}
        teamsWithCode.forEach(t => {
          const l = extractPoolLetter(t.code)
          if (!poolMap[l]) poolMap[l] = []
          poolMap[l].push(t)
        })
        const poolLetters = Object.keys(poolMap).sort()
        const autoMode = teamsWithCode.length >= 2

        return (
          <div className="modal-overlay" onClick={() => setShowGroupSetup(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <h2>SETUP POOL</h2>

              {autoMode ? (
                <div>
                  <div style={{ background: 'rgba(74,222,128,0.1)', border: '1.5px solid rgba(74,222,128,0.4)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                    <div style={{ fontSize: 13, color: '#4ade80', fontWeight: 700, marginBottom: 8 }}>✅ Mode Otomatis Terdeteksi!</div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 10 }}>
                      Sistem mendeteksi kode pool dari {teamsWithCode.length} tim. Pool akan dibuat otomatis:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {poolLetters.map(letter => (
                        <div key={letter} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(255,215,0,0.1)', borderRadius: 8 }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#FFD700', minWidth: 60 }}>Pool {letter}</span>
                          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{poolMap[letter].map(t => t.code).join(', ')}</span>
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginLeft: 'auto' }}>{poolMap[letter].length} tim</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 16 }}>
                    Tim yang tidak punya kode pool tidak akan masuk ke pool manapun.
                  </p>
                </div>
              ) : (
                <div>
                  <div style={{ background: 'rgba(255,165,0,0.1)', border: '1px solid rgba(255,165,0,0.3)', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
                    <div style={{ fontSize: 13, color: 'orange', fontWeight: 600, marginBottom: 4 }}>⚠️ Mode Manual</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                      Tim tidak memiliki kode pool (A1, B2, C3, dst). Tim akan dibagi secara acak. Untuk pembagian otomatis, tambahkan kode pada setiap tim di tab Tim & Atlet.
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Jumlah Pool (1 - 16)</label>
                    <select value={numGroups} onChange={e => setNumGroups(parseInt(e.target.value))}>
                      {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16].filter(n => n <= teams.length).map(n => <option key={n} value={n}>{n} Pool</option>)}
                    </select>
                  </div>
                  <div style={{ padding: '10px 14px', background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)', borderRadius: 8, marginBottom: 16 }}>
                    <div style={{ fontSize: 12, color: '#FFD700' }}>~{Math.floor(teams.length / numGroups)} tim per pool</div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={setupGroups}>
                  {autoMode ? `⚡ Buat ${poolLetters.length} Pool Otomatis` : 'Buat Pool'}
                </button>
                <button className="btn btn-ghost" onClick={() => setShowGroupSetup(false)}>Batal</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* GROUP SCORE MODAL */}
      {showScoreModal && editMatch && (
        <div className="modal-overlay" onClick={() => setShowScoreModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>INPUT SKOR PER SET</h2>
            <SetScoreInput sets={sets} onChange={setSets} homeLabel={getTeamName(editMatch.homeId)} awayLabel={getTeamName(editMatch.awayId)} />
            {sets.some(s => s?.home !== '' && s?.home !== undefined) && (
              <div style={{ padding: '10px 14px', background: 'rgba(244,160,28,0.08)', borderRadius: 8, marginBottom: 14, fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                Hasil Set: {calcSetResult(sets).homeSetWins} — {calcSetResult(sets).awaySetWins}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
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
