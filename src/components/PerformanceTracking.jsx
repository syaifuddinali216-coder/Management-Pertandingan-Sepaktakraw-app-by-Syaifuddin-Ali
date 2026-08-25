import React, { useState, useMemo } from 'react'
import { useApp } from '../App.jsx'
import TeamLogo from './TeamLogo.jsx'

const ACTIONS = [
  { key: 'firstBall', label: 'First Ball' },
  { key: 'servis', label: 'Servis' },
  { key: 'umpan', label: 'Umpan' },
  { key: 'smash', label: 'Smash' },
  { key: 'block', label: 'Block' },
  { key: 'bertahan', label: 'Bertahan' },
]

const emptyStats = () => Object.fromEntries(ACTIONS.map(a => [a.key, { success: 0, fail: 0 }]))

export default function PerformanceTracking({ match, updateMatch, onBack }) {
  const { showToast } = useApp()
  const [activeSub, setActiveSub] = useState(0)
  const [selected, setSelected] = useState(null) // { side, playerId }
  const [saving, setSaving] = useState(false)

  const subMatch = match.subMatches[activeSub]
  const allPlayers = (side) => [...(subMatch[side]?.starters || []), ...(subMatch[side]?.substitutes || [])]

  const getStats = (side, playerId) => subMatch.stats?.[side]?.[playerId] || emptyStats()

  const recordAction = async (actionKey, result) => {
    if (!selected) return showToast('Select a player first!')
    setSaving(true)
    const newSubMatches = match.subMatches.map((sm, i) => {
      if (i !== activeSub) return sm
      const stats = { ...(sm.stats || {}) }
      const sideStats = { ...(stats[selected.side] || {}) }
      const playerStats = { ...emptyStats(), ...(sideStats[selected.playerId] || {}) }
      playerStats[actionKey] = { ...playerStats[actionKey], [result]: (playerStats[actionKey][result] || 0) + 1 }
      sideStats[selected.playerId] = playerStats
      stats[selected.side] = sideStats
      return { ...sm, stats }
    })
    await updateMatch(match.id, { subMatches: newSubMatches, status: 'live' })
    setSaving(false)
  }

  const undoLast = async (actionKey, result) => {
    if (!selected) return
    const cur = getStats(selected.side, selected.playerId)[actionKey][result] || 0
    if (cur <= 0) return
    setSaving(true)
    const newSubMatches = match.subMatches.map((sm, i) => {
      if (i !== activeSub) return sm
      const stats = { ...(sm.stats || {}) }
      const sideStats = { ...(stats[selected.side] || {}) }
      const playerStats = { ...emptyStats(), ...(sideStats[selected.playerId] || {}) }
      playerStats[actionKey] = { ...playerStats[actionKey], [result]: cur - 1 }
      sideStats[selected.playerId] = playerStats
      stats[selected.side] = sideStats
      return { ...sm, stats }
    })
    await updateMatch(match.id, { subMatches: newSubMatches })
    setSaving(false)
  }

  const finishMatch = async () => {
    if (!confirm('Mark this analysis as completed? You can still view/edit stats later.')) return
    await updateMatch(match.id, { status: 'completed' })
    showToast('Match marked as completed!')
  }

  // Team-level live tally: sum success/fail per action across all players on a side, for the active sub-match
  const teamTally = (side) => {
    const totals = emptyStats()
    allPlayers(side).forEach(p => {
      const s = getStats(side, p.playerId)
      ACTIONS.forEach(a => {
        totals[a.key].success += s[a.key].success
        totals[a.key].fail += s[a.key].fail
      })
    })
    return totals
  }
  const tallyA = useMemo(() => teamTally('teamA'), [subMatch])
  const tallyB = useMemo(() => teamTally('teamB'), [subMatch])
  const pct = (s, f) => (s + f === 0 ? '—' : `${Math.round((s / (s + f)) * 100)}%`)

  return (
    <div>
      <button className="btn btn-ghost" style={{ marginBottom: 16, padding: '7px 14px', fontSize: 13 }} onClick={onBack}>← Back to List</button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="tag-line" style={{ marginBottom: 6 }}>{match.category}</div>
          <h1 style={{ fontSize: 28, color: 'var(--gold)' }}>{match.teamAName} vs {match.teamBName}</h1>
        </div>
        {match.status !== 'completed' && (
          <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={finishMatch}>✓ Mark as Completed</button>
        )}
        {match.status === 'completed' && <span className="badge" style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.4)' }}>✓ Completed</span>}
      </div>

      {match.subMatches.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {match.subMatches.map((sm, i) => (
            <button key={i} onClick={() => { setActiveSub(i); setSelected(null) }} style={{
              padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: activeSub === i ? 'var(--gold)' : 'rgba(255,255,255,0.08)',
              color: activeSub === i ? '#5a0812' : 'rgba(255,255,255,0.6)',
            }}>{sm.label}</button>
          ))}
        </div>
      )}

      {/* Player selector rows */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {['teamA', 'teamB'].map(side => (
          <div key={side} className="card" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <TeamLogo src={side === 'teamA' ? match.teamALogo : match.teamBLogo} name={side === 'teamA' ? match.teamAName : match.teamBName} size={24} />
              <h3 style={{ fontSize: 14, color: 'var(--gold)' }}>{side === 'teamA' ? match.teamAName : match.teamBName}</h3>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {allPlayers(side).map(p => {
                const isSelected = selected?.side === side && selected?.playerId === p.playerId
                const isSub = (subMatch[side]?.substitutes || []).some(s => s.playerId === p.playerId)
                return (
                  <div key={p.playerId} onClick={() => setSelected({ side, playerId: p.playerId })} style={{
                    cursor: 'pointer', textAlign: 'center', width: 68,
                  }}>
                    <div style={{
                      borderRadius: '50%', padding: 2,
                      border: isSelected ? '3px solid var(--gold)' : '3px solid transparent',
                      boxShadow: isSelected ? '0 0 12px rgba(255,215,0,0.6)' : 'none',
                    }}>
                      <TeamLogo src={p.photo} name={p.name} size={56} />
                    </div>
                    <div style={{ fontSize: 10, color: isSelected ? 'var(--gold)' : '#fff', fontWeight: isSelected ? 700 : 500, marginTop: 4, lineHeight: 1.2 }}>
                      {p.name.split(' ')[0]}
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{isSub ? 'SUB' : (p.slotPosition || p.position)}</div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Selected player + action panel */}
      <div className="card" style={{ padding: '18px 22px', marginBottom: 20, textAlign: 'center' }}>
        {selected ? (
          <div style={{ marginBottom: 14, fontSize: 13, color: 'var(--text-muted)' }}>
            Recording for: <strong style={{ color: 'var(--gold)' }}>
              {allPlayers(selected.side).find(p => p.playerId === selected.playerId)?.name}
            </strong> ({selected.side === 'teamA' ? match.teamAName : match.teamBName})
          </div>
        ) : (
          <div style={{ marginBottom: 14, fontSize: 13, color: 'var(--text-muted)' }}>Select a player above, then tap an action below.</div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          {ACTIONS.map(a => (
            <div key={a.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ flex: 1, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#fff' }}>{a.label}</span>
              <button className="btn btn-primary" style={{ padding: '8px 14px', fontSize: 12, background: '#4ade80', borderColor: '#4ade80', color: '#0a2e17' }}
                disabled={!selected || saving} onClick={() => recordAction(a.key, 'success')}>✓</button>
              <button className="btn btn-danger" style={{ padding: '8px 14px', fontSize: 12 }}
                disabled={!selected || saving} onClick={() => recordAction(a.key, 'fail')}>✗</button>
            </div>
          ))}
        </div>

        {selected && (
          <button className="btn btn-ghost" style={{ marginTop: 14, fontSize: 11, padding: '5px 12px' }} onClick={() => setSelected(null)}>Deselect player</button>
        )}
      </div>

      {/* Live team tally */}
      <div className="card" style={{ padding: '18px 22px' }}>
        <h3 style={{ fontSize: 15, color: 'var(--white)', marginBottom: 14 }}>Live Team Tally — {subMatch.label}</h3>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Action</th>
                <th style={{ color: 'var(--gold)' }}>{match.teamAName}</th>
                <th style={{ color: 'var(--gold)' }}>{match.teamBName}</th>
              </tr>
            </thead>
            <tbody>
              {ACTIONS.map(a => (
                <tr key={a.key}>
                  <td>{a.label}</td>
                  <td>{tallyA[a.key].success}✓ / {tallyA[a.key].fail}✗ ({pct(tallyA[a.key].success, tallyA[a.key].fail)})</td>
                  <td>{tallyB[a.key].success}✓ / {tallyB[a.key].fail}✗ ({pct(tallyB[a.key].success, tallyB[a.key].fail)})</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
