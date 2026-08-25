import React, { useState, useEffect, useMemo } from 'react'
import { useApp } from '../App.jsx'
import { useEvents, useTeamDataTeams, usePerformanceMatches } from '../hooks/useFirestore.js'
import TeamLogo from '../components/TeamLogo.jsx'
import PerformanceTracking from '../components/PerformanceTracking.jsx'
import PerformanceResults from '../components/PerformanceResults.jsx'

const CATEGORIES = [
  { id: 'Men Regu', icon: '🥎' }, { id: 'Women Regu', icon: '🥎' },
  { id: 'Men Quadrant', icon: '🔷' }, { id: 'Women Quadrant', icon: '🔷' },
  { id: 'Men Double', icon: '👬' }, { id: 'Women Double', icon: '👭' },
  { id: 'Men Team Regu', icon: '⭐' }, { id: 'Women Team Regu', icon: '⭐' },
  { id: 'Men Team Double', icon: '✨' }, { id: 'Women Team Double', icon: '✨' },
]

function getLineupSlots(category) {
  if (category.includes('Quadrant')) return { starterPositions: ['Tekong', 'Feeder', 'Killer 1', 'Killer 2'], subCount: 2 }
  if (category.includes('Double')) return { starterPositions: ['Feeder', 'Killer'], subCount: 1 }
  return { starterPositions: ['Tekong', 'Feeder', 'Killer'], subCount: 2 } // Regu, Team Regu
}
const isTeamCategory = (category) => category.includes('Team')
const getSubMatchLabels = (category) => isTeamCategory(category) ? ['Match 1', 'Match 2', 'Match 3'] : [category]

const emptySideLineup = (starterPositions) => ({
  starters: Object.fromEntries(starterPositions.map(p => [p, ''])),
  substitutes: [],
})

export default function PerformanceAnalysis() {
  const { showToast } = useApp()
  const { events, loading: eventsLoading } = useEvents()

  const [view, setView] = useState('events') // events | list | setup
  const [eventId, setEventId] = useState(null)
  const selectedEvent = events.find(e => e.id === eventId) || null

  const { matches, loading: matchesLoading, addMatch, updateMatch, deleteMatch } = usePerformanceMatches(eventId)
  const [trackingMatchId, setTrackingMatchId] = useState(null)
  const trackingMatch = matches.find(m => m.id === trackingMatchId) || null
  const [resultsMatchId, setResultsMatchId] = useState(null)
  const resultsMatch = matches.find(m => m.id === resultsMatchId) || null

  // ── Setup wizard state ──
  const [step, setStep] = useState('category') // category | teams | lineup
  const [category, setCategory] = useState(null)
  const [teamAId, setTeamAId] = useState(null)
  const [teamBId, setTeamBId] = useState(null)
  const [activeSub, setActiveSub] = useState(0)
  const [lineup, setLineup] = useState({}) // { [subIdx]: { teamA: {...}, teamB: {...} } }
  const [saving, setSaving] = useState(false)

  const { teams: categoryTeams, loading: teamsLoading } = useTeamDataTeams(eventId, category)
  const teamA = categoryTeams.find(t => t.id === teamAId) || null
  const teamB = categoryTeams.find(t => t.id === teamBId) || null

  const slots = category ? getLineupSlots(category) : null
  const subLabels = category ? getSubMatchLabels(category) : []

  const resetWizard = () => {
    setStep('category'); setCategory(null); setTeamAId(null); setTeamBId(null); setActiveSub(0); setLineup({})
  }

  const openNewSetup = () => { resetWizard(); setView('setup') }

  const chooseCategory = (c) => { setCategory(c); setTeamAId(null); setTeamBId(null); setStep('teams') }

  const proceedToLineup = () => {
    if (!teamAId || !teamBId) return showToast('Select both Team A and Team B first!')
    if (teamAId === teamBId) return showToast('Team A and Team B must be different!')
    const init = {}
    subLabels.forEach((_, i) => {
      init[i] = {
        teamA: emptySideLineup(slots.starterPositions),
        teamB: emptySideLineup(slots.starterPositions),
      }
    })
    // Auto-fill default starters by matching roster position, best-effort
    subLabels.forEach((_, i) => {
      ;['teamA', 'teamB'].forEach(side => {
        const team = side === 'teamA' ? teamA : teamB
        const used = new Set()
        slots.starterPositions.forEach(pos => {
          const match = (team?.players || []).find(p => p.position === pos && !used.has(p.id))
          if (match) { init[i][side].starters[pos] = match.id; used.add(match.id) }
        })
      })
    })
    setLineup(init)
    setActiveSub(0)
    setStep('lineup')
  }

  const setStarter = (side, position, playerId) => {
    setLineup(prev => ({
      ...prev,
      [activeSub]: {
        ...prev[activeSub],
        [side]: { ...prev[activeSub][side], starters: { ...prev[activeSub][side].starters, [position]: playerId } },
      },
    }))
  }

  const toggleSubstitute = (side, playerId) => {
    setLineup(prev => {
      const cur = prev[activeSub][side]
      const already = cur.substitutes.includes(playerId)
      let next
      if (already) next = cur.substitutes.filter(id => id !== playerId)
      else {
        if (cur.substitutes.length >= slots.subCount) { showToast(`Max ${slots.subCount} substitute(s) for this category!`); return prev }
        next = [...cur.substitutes, playerId]
      }
      return { ...prev, [activeSub]: { ...prev[activeSub], [side]: { ...cur, substitutes: next } } }
    })
  }

  const saveSetup = async () => {
    // Validate every starter slot filled for every sub-match
    for (let i = 0; i < subLabels.length; i++) {
      for (const side of ['teamA', 'teamB']) {
        const starters = lineup[i][side].starters
        if (Object.values(starters).some(v => !v)) {
          return showToast(`Please fill all starter positions for ${subLabels[i]} (${side === 'teamA' ? teamA?.name : teamB?.name})!`)
        }
      }
    }
    setSaving(true)
    const playerLookup = (team, id) => (team?.players || []).find(p => p.id === id)
    const subMatches = subLabels.map((label, i) => {
      const build = (side, team) => ({
        starters: Object.entries(lineup[i][side].starters).map(([position, pid]) => {
          const p = playerLookup(team, pid)
          return { slotPosition: position, playerId: pid, name: p?.name || '', position: p?.position || position, jerseyNumber: p?.jerseyNumber || '', photo: p?.photo || '' }
        }),
        substitutes: lineup[i][side].substitutes.map(pid => {
          const p = playerLookup(team, pid)
          return { playerId: pid, name: p?.name || '', position: p?.position || '', jerseyNumber: p?.jerseyNumber || '', photo: p?.photo || '' }
        }),
      })
      return { label, teamA: build('teamA', teamA), teamB: build('teamB', teamB) }
    })

    await addMatch({
      category,
      teamAId, teamAName: teamA?.name || '', teamALogo: teamA?.logo || '',
      teamBId, teamBName: teamB?.name || '', teamBLogo: teamB?.logo || '',
      subMatches,
    })
    setSaving(false)
    showToast('Analysis setup saved!')
    resetWizard()
    setView('list')
  }

  const removeMatch = async (id) => {
    if (!confirm('Delete this analysis setup? This cannot be undone.')) return
    await deleteMatch(id)
  }

  // ── VIEW: Events ──
  if (view === 'events') {
    return (
      <div>
        <div style={{ marginBottom: 32 }}>
          <div className="tag-line" style={{ marginBottom: 8 }}>Athlete Performance</div>
          <h1 style={{ fontSize: 48, color: 'var(--gold)' }}>PERFORMANCE ANALYSIS</h1>
          <p style={{ fontSize: 13, marginTop: 8, color: 'var(--text-muted)' }}>Select an event to view or create match analyses.</p>
        </div>
        {eventsLoading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} /></div>
        ) : events.length === 0 ? (
          <div className="card empty-state">
            <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
            <p>No events yet. Create an event first from the Events menu.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {events.map(e => (
              <div key={e.id} className="card" style={{ cursor: 'pointer', padding: '20px 22px' }}
                onClick={() => { setEventId(e.id); setView('list') }}>
                <h2 style={{ fontSize: 18, color: 'var(--white)', marginBottom: 6 }}>{e.name}</h2>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{e.location} {e.date && `· ${new Date(e.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`}</p>
                <p style={{ fontSize: 12, color: 'var(--gold)', marginTop: 10 }}>View analyses →</p>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── VIEW: List of analyses for this event ──
  if (view === 'list' && trackingMatch) {
    return (
      <PerformanceTracking
        match={trackingMatch}
        updateMatch={updateMatch}
        onBack={() => setTrackingMatchId(null)}
      />
    )
  }

  if (view === 'list' && resultsMatch) {
    return (
      <PerformanceResults
        match={resultsMatch}
        onBack={() => setResultsMatchId(null)}
      />
    )
  }

  if (view === 'list') {
    return (
      <div>
        <button className="btn btn-ghost" style={{ marginBottom: 20, padding: '7px 14px', fontSize: 13 }} onClick={() => { setView('events'); setEventId(null) }}>← Back to Events</button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="tag-line" style={{ marginBottom: 8 }}>{selectedEvent?.name}</div>
            <h1 style={{ fontSize: 40, color: 'var(--gold)' }}>PERFORMANCE ANALYSIS</h1>
          </div>
          <button className="btn btn-primary" onClick={openNewSetup}>+ New Analysis</button>
        </div>

        {matchesLoading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} /></div>
        ) : matches.length === 0 ? (
          <div className="card empty-state">
            <div style={{ fontSize: 48, marginBottom: 16 }}>📈</div>
            <p>No match analyses yet for this event.</p>
            <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={openNewSetup}>+ Create First Analysis</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {matches.map(m => (
              <div key={m.id} className="card" style={{ padding: '18px 22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--gold)', fontFamily: 'var(--font-mono)', letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' }}>{m.category}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 17, fontWeight: 700, color: '#fff' }}>
                      <TeamLogo src={m.teamALogo} name={m.teamAName} size={26} /> {m.teamAName}
                      <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 13 }}>vs</span>
                      <TeamLogo src={m.teamBLogo} name={m.teamBName} size={26} /> {m.teamBName}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{m.subMatches?.length || 0} sub-match(es) · Status: {m.status}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary" style={{ padding: '7px 16px', fontSize: 13 }} onClick={() => setTrackingMatchId(m.id)}>▶ Open Analysis</button>
                    <button className="btn btn-ghost" style={{ padding: '7px 16px', fontSize: 13 }} onClick={() => setResultsMatchId(m.id)}>📊 Results</button>
                    <button className="btn btn-danger" style={{ padding: '7px 14px', fontSize: 13 }} onClick={() => removeMatch(m.id)}>Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── VIEW: Setup wizard ──
  if (view === 'setup') {
    return (
      <div>
        <button className="btn btn-ghost" style={{ marginBottom: 20, padding: '7px 14px', fontSize: 13 }} onClick={() => { setView('list'); resetWizard() }}>← Cancel & Back to List</button>

        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
          {['category', 'teams', 'lineup'].map((s, i) => (
            <div key={s} style={{
              flex: 1, padding: '8px 4px', textAlign: 'center', borderRadius: 8, fontSize: 11, fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700,
              background: step === s ? 'var(--gold)' : 'rgba(255,255,255,0.06)',
              color: step === s ? '#5a0812' : 'rgba(255,255,255,0.4)',
            }}>{i + 1}. {s}</div>
          ))}
        </div>

        {/* STEP 1: Category */}
        {step === 'category' && (
          <div>
            <h2 style={{ fontSize: 22, color: 'var(--white)', marginBottom: 16 }}>Select Match Category</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
              {CATEGORIES.map(c => (
                <div key={c.id} className="card" style={{ cursor: 'pointer', padding: '20px' }} onClick={() => chooseCategory(c.id)}>
                  <div style={{ fontSize: 26, marginBottom: 8 }}>{c.icon}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{c.id}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 2: Teams */}
        {step === 'teams' && (
          <div>
            <button className="btn btn-ghost" style={{ marginBottom: 16, padding: '6px 12px', fontSize: 12 }} onClick={() => setStep('category')}>← Change Category</button>
            <h2 style={{ fontSize: 22, color: 'var(--white)', marginBottom: 4 }}>Select Team A &amp; Team B</h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Category: <strong style={{ color: 'var(--gold)' }}>{category}</strong></p>

            {teamsLoading ? (
              <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></div>
            ) : categoryTeams.length < 2 ? (
              <div className="card empty-state">
                <p>Need at least 2 teams in Team Data for "{category}" to set up an analysis.</p>
                <p style={{ fontSize: 12, marginTop: 8 }}>Go to Team Data → this event → {category}, and add teams with rosters first.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div>
                  <div className="tag-line" style={{ marginBottom: 10 }}>Team A</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {categoryTeams.filter(t => t.id !== teamBId).map(t => (
                      <div key={t.id} className="card" style={{
                        cursor: 'pointer', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
                        border: teamAId === t.id ? '2px solid var(--gold)' : undefined,
                      }} onClick={() => setTeamAId(t.id)}>
                        <TeamLogo src={t.logo} name={t.name} size={30} />
                        <div>
                          <div style={{ fontWeight: 700, color: '#fff' }}>{t.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{(t.players || []).length} players in roster</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="tag-line" style={{ marginBottom: 10 }}>Team B</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {categoryTeams.filter(t => t.id !== teamAId).map(t => (
                      <div key={t.id} className="card" style={{
                        cursor: 'pointer', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
                        border: teamBId === t.id ? '2px solid var(--gold)' : undefined,
                      }} onClick={() => setTeamBId(t.id)}>
                        <TeamLogo src={t.logo} name={t.name} size={30} />
                        <div>
                          <div style={{ fontWeight: 700, color: '#fff' }}>{t.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{(t.players || []).length} players in roster</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <button className="btn btn-primary" style={{ marginTop: 24 }} onClick={proceedToLineup} disabled={!teamAId || !teamBId}>
              Continue to Lineup →
            </button>
          </div>
        )}

        {/* STEP 3: Lineup */}
        {step === 'lineup' && lineup[activeSub] && (
          <div>
            <button className="btn btn-ghost" style={{ marginBottom: 16, padding: '6px 12px', fontSize: 12 }} onClick={() => setStep('teams')}>← Change Teams</button>

            {subLabels.length > 1 && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                {subLabels.map((label, i) => (
                  <button key={i} onClick={() => setActiveSub(i)} style={{
                    padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    background: activeSub === i ? 'var(--gold)' : 'rgba(255,255,255,0.08)',
                    color: activeSub === i ? '#5a0812' : 'rgba(255,255,255,0.6)',
                  }}>{label}</button>
                ))}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              {['teamA', 'teamB'].map(side => {
                const team = side === 'teamA' ? teamA : teamB
                const cur = lineup[activeSub][side]
                const usedIds = new Set([...Object.values(cur.starters).filter(Boolean), ...cur.substitutes])
                return (
                  <div key={side} className="card" style={{ padding: '18px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                      <TeamLogo src={team?.logo} name={team?.name} size={30} />
                      <h3 style={{ fontSize: 16, color: 'var(--gold)' }}>{team?.name}</h3>
                    </div>

                    <div className="tag-line" style={{ marginBottom: 10, fontSize: 10 }}>Starting Lineup</div>
                    {slots.starterPositions.map(pos => (
                      <div key={pos} className="form-group" style={{ marginBottom: 10 }}>
                        <label style={{ fontSize: 12 }}>{pos}</label>
                        <select value={cur.starters[pos]} onChange={e => setStarter(side, pos, e.target.value)}>
                          <option value="">— Select player —</option>
                          {(team?.players || []).map(p => (
                            <option key={p.id} value={p.id} disabled={usedIds.has(p.id) && cur.starters[pos] !== p.id}>
                              {p.name} {p.jerseyNumber ? `(#${p.jerseyNumber})` : ''} {p.position ? `· ${p.position}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}

                    <div className="tag-line" style={{ margin: '16px 0 10px', fontSize: 10 }}>Substitutes (max {slots.subCount})</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {(team?.players || []).filter(p => !Object.values(cur.starters).includes(p.id)).map(p => (
                        <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#fff', cursor: 'pointer' }}>
                          <input type="checkbox" style={{ width: 'auto' }} checked={cur.substitutes.includes(p.id)} onChange={() => toggleSubstitute(side, p.id)} />
                          <TeamLogo src={p.photo} name={p.name} size={22} />
                          {p.name} {p.jerseyNumber ? `(#${p.jerseyNumber})` : ''}
                        </label>
                      ))}
                      {(team?.players || []).filter(p => !Object.values(cur.starters).includes(p.id)).length === 0 && (
                        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No other players available in roster.</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <button className="btn btn-primary" style={{ marginTop: 24 }} onClick={saveSetup} disabled={saving}>
              {saving ? <span className="spinner" /> : '✓ Save Analysis Setup'}
            </button>
          </div>
        )}
      </div>
    )
  }

  return null
}
