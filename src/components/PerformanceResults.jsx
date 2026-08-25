import React, { useState, useMemo } from 'react'
import TeamLogo from './TeamLogo.jsx'

const ACTIONS = [
  { key: 'firstBall', label: 'First Ball' },
  { key: 'servis', label: 'Servis' },
  { key: 'umpan', label: 'Umpan' },
  { key: 'smash', label: 'Smash' },
  { key: 'block', label: 'Block' },
  { key: 'bertahan', label: 'Bertahan' },
]
const MIN_ACTIONS_FOR_HIGHLIGHT = 3 // avoid crowning an MVP off 1 lucky attempt

const emptyStats = () => Object.fromEntries(ACTIONS.map(a => [a.key, { success: 0, fail: 0 }]))

// Combine one or more sub-matches into a single { playerId: {name, position, jerseyNumber, photo, actions, totalSuccess, totalFail, total, rate} } map
function buildPlayerMap(subMatches, side) {
  const map = {}
  subMatches.forEach(sm => {
    const roster = [...(sm[side]?.starters || []), ...(sm[side]?.substitutes || [])]
    roster.forEach(p => {
      if (!map[p.playerId]) {
        map[p.playerId] = { name: p.name, position: p.slotPosition || p.position, jerseyNumber: p.jerseyNumber, photo: p.photo, actions: emptyStats() }
      }
    })
    const statsForSide = sm.stats?.[side] || {}
    Object.entries(statsForSide).forEach(([playerId, playerStats]) => {
      if (!map[playerId]) return
      ACTIONS.forEach(a => {
        map[playerId].actions[a.key].success += playerStats[a.key]?.success || 0
        map[playerId].actions[a.key].fail += playerStats[a.key]?.fail || 0
      })
    })
  })
  Object.values(map).forEach(p => {
    let s = 0, f = 0
    ACTIONS.forEach(a => { s += p.actions[a.key].success; f += p.actions[a.key].fail })
    p.totalSuccess = s; p.totalFail = f; p.total = s + f
    p.rate = p.total > 0 ? s / p.total : null
  })
  return map
}

function teamActionTotals(playerMap) {
  const totals = emptyStats()
  Object.values(playerMap).forEach(p => {
    ACTIONS.forEach(a => {
      totals[a.key].success += p.actions[a.key].success
      totals[a.key].fail += p.actions[a.key].fail
    })
  })
  return totals
}

function positionWeakness(playerMap) {
  const byPos = {}
  Object.values(playerMap).forEach(p => {
    if (p.total === 0) return
    const pos = p.position || 'Unknown'
    if (!byPos[pos]) byPos[pos] = { success: 0, total: 0 }
    byPos[pos].success += p.totalSuccess
    byPos[pos].total += p.total
  })
  const entries = Object.entries(byPos).map(([pos, v]) => ({ pos, rate: v.total > 0 ? v.success / v.total : 0, total: v.total }))
  if (entries.length === 0) return null
  entries.sort((a, b) => a.rate - b.rate)
  return entries[0]
}

function ComparisonBar({ label, aPct, bPct, aLabel, bLabel }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, color: '#fff', fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ width: 34, fontSize: 10, color: 'var(--gold)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{aLabel}</span>
        <div style={{ flex: 1, height: 14, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${aPct ?? 0}%`, height: '100%', background: 'var(--gold)', borderRadius: 4, transition: 'width 0.3s' }} />
        </div>
        <span style={{ width: 40, fontSize: 11, color: '#fff', fontFamily: 'var(--font-mono)', textAlign: 'right', flexShrink: 0 }}>{aPct === null ? '—' : `${aPct}%`}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 34, fontSize: 10, color: '#4ade80', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{bLabel}</span>
        <div style={{ flex: 1, height: 14, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${bPct ?? 0}%`, height: '100%', background: '#4ade80', borderRadius: 4, transition: 'width 0.3s' }} />
        </div>
        <span style={{ width: 40, fontSize: 11, color: '#fff', fontFamily: 'var(--font-mono)', textAlign: 'right', flexShrink: 0 }}>{bPct === null ? '—' : `${bPct}%`}</span>
      </div>
    </div>
  )
}

function PlayerTable({ title, teamName, playerMap, color }) {
  const rows = Object.values(playerMap).sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1))
  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <h3 style={{ fontSize: 15, color, marginBottom: 12 }}>{title} — {teamName}</h3>
      {rows.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No player data yet.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th></th><th>#</th><th>Player</th><th>Position</th><th>Actions</th><th>Success Rate</th></tr></thead>
            <tbody>
              {rows.map(p => (
                <tr key={p.name + p.jerseyNumber}>
                  <td><TeamLogo src={p.photo} name={p.name} size={26} /></td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{p.jerseyNumber || '—'}</td>
                  <td style={{ fontWeight: 600, color: '#fff' }}>{p.name}</td>
                  <td>{p.position || '—'}</td>
                  <td>{p.total}</td>
                  <td style={{ color: p.rate === null ? 'var(--text-muted)' : p.rate >= 0.6 ? '#4ade80' : p.rate >= 0.4 ? 'var(--gold)' : '#ff6b6b', fontWeight: 700 }}>
                    {p.rate === null ? '—' : `${Math.round(p.rate * 100)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function HighlightCard({ icon, title, playerMap, teamName, best }) {
  const eligible = Object.values(playerMap).filter(p => p.total >= MIN_ACTIONS_FOR_HIGHLIGHT)
  if (eligible.length === 0) return (
    <div className="card" style={{ padding: '16px 18px' }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{icon} {title} — {teamName}</div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Not enough data yet (min {MIN_ACTIONS_FOR_HIGHLIGHT} actions).</p>
    </div>
  )
  const sorted = [...eligible].sort((a, b) => best ? (b.rate - a.rate) : (a.rate - b.rate))
  const p = sorted[0]
  return (
    <div className="card" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <TeamLogo src={p.photo} name={p.name} size={44} />
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>{icon} {title} — {teamName}</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: best ? '#4ade80' : '#ff6b6b' }}>{p.name}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.position} · {Math.round(p.rate * 100)}% success ({p.total} actions)</div>
      </div>
    </div>
  )
}

export default function PerformanceResults({ match, onBack }) {
  const hasMultiSub = match.subMatches.length > 1
  const [scope, setScope] = useState(hasMultiSub ? 'all' : 0) // 'all' or sub-match index

  const scopedSubMatches = useMemo(() => {
    if (scope === 'all') return match.subMatches
    return [match.subMatches[scope]]
  }, [scope, match.subMatches])

  const playerMapA = useMemo(() => buildPlayerMap(scopedSubMatches, 'teamA'), [scopedSubMatches])
  const playerMapB = useMemo(() => buildPlayerMap(scopedSubMatches, 'teamB'), [scopedSubMatches])
  const totalsA = useMemo(() => teamActionTotals(playerMapA), [playerMapA])
  const totalsB = useMemo(() => teamActionTotals(playerMapB), [playerMapB])
  const weakA = useMemo(() => positionWeakness(playerMapA), [playerMapA])
  const weakB = useMemo(() => positionWeakness(playerMapB), [playerMapB])

  const pct = (s, f) => (s + f === 0 ? null : Math.round((s / (s + f)) * 100))

  return (
    <div>
      <button className="btn btn-ghost" style={{ marginBottom: 16, padding: '7px 14px', fontSize: 13 }} onClick={onBack}>← Back to List</button>

      <div style={{ marginBottom: 20 }}>
        <div className="tag-line" style={{ marginBottom: 6 }}>{match.category} · Analysis Results</div>
        <h1 style={{ fontSize: 30, color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <TeamLogo src={match.teamALogo} name={match.teamAName} size={32} /> {match.teamAName}
          <span style={{ fontSize: 18, color: 'var(--text-muted)' }}>vs</span>
          <TeamLogo src={match.teamBLogo} name={match.teamBName} size={32} /> {match.teamBName}
        </h1>
      </div>

      {hasMultiSub && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          <button onClick={() => setScope('all')} style={{
            padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: scope === 'all' ? 'var(--gold)' : 'rgba(255,255,255,0.08)',
            color: scope === 'all' ? '#5a0812' : 'rgba(255,255,255,0.6)',
          }}>Overall (All 3)</button>
          {match.subMatches.map((sm, i) => (
            <button key={i} onClick={() => setScope(i)} style={{
              padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: scope === i ? 'var(--gold)' : 'rgba(255,255,255,0.08)',
              color: scope === i ? '#5a0812' : 'rgba(255,255,255,0.6)',
            }}>{sm.label}</button>
          ))}
        </div>
      )}

      {/* Team comparison chart */}
      <div className="card" style={{ padding: '20px 22px', marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, color: '#fff', marginBottom: 16 }}>📊 Team Comparison</h2>
        {ACTIONS.map(a => (
          <ComparisonBar
            key={a.key}
            label={a.label}
            aLabel={match.teamAName?.slice(0, 4).toUpperCase()}
            bLabel={match.teamBName?.slice(0, 4).toUpperCase()}
            aPct={pct(totalsA[a.key].success, totalsA[a.key].fail)}
            bPct={pct(totalsB[a.key].success, totalsB[a.key].fail)}
          />
        ))}
      </div>

      {/* Auto highlights */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginBottom: 20 }}>
        <HighlightCard icon="🏆" title="Best Player" teamName={match.teamAName} playerMap={playerMapA} best />
        <HighlightCard icon="🏆" title="Best Player" teamName={match.teamBName} playerMap={playerMapB} best />
        <HighlightCard icon="⚠️" title="Needs Improvement" teamName={match.teamAName} playerMap={playerMapA} best={false} />
        <HighlightCard icon="⚠️" title="Needs Improvement" teamName={match.teamBName} playerMap={playerMapB} best={false} />
      </div>

      {/* Position weakness */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
        <div className="card" style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginBottom: 6 }}>📍 Weakest Position — {match.teamAName}</div>
          {weakA ? (
            <div style={{ fontSize: 15, color: '#ff6b6b', fontWeight: 700 }}>{weakA.pos} <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>({Math.round(weakA.rate * 100)}% success, {weakA.total} actions)</span></div>
          ) : <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Not enough data yet.</p>}
        </div>
        <div className="card" style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginBottom: 6 }}>📍 Weakest Position — {match.teamBName}</div>
          {weakB ? (
            <div style={{ fontSize: 15, color: '#ff6b6b', fontWeight: 700 }}>{weakB.pos} <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>({Math.round(weakB.rate * 100)}% success, {weakB.total} actions)</span></div>
          ) : <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Not enough data yet.</p>}
        </div>
      </div>

      {/* Per-player tables */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <PlayerTable title="Player Stats" teamName={match.teamAName} playerMap={playerMapA} color="var(--gold)" />
        <PlayerTable title="Player Stats" teamName={match.teamBName} playerMap={playerMapB} color="#4ade80" />
      </div>
    </div>
  )
}
