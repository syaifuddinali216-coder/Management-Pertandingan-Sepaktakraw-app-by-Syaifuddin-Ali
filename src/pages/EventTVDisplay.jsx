import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useEvents, useNomors, useTeams, useMatches } from '../hooks/useFirestore.js'
import { TEAM_EVENT_NOMORS } from './EventDetail.jsx'
import TeamLogo from '../components/TeamLogo.jsx'
import istafLogo from '../istaf-logo.png'

// ── Loads teams + matches for one nomor, reports back to the parent ──
function NomorDataLoader({ eventId, nomorId, onData }) {
  const { teams } = useTeams(eventId, nomorId)
  const { matches } = useMatches(eventId, nomorId)
  useEffect(() => { onData(nomorId, teams, matches) }, [teams, matches]) // eslint-disable-line
  return null
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
    if (w === 'home') hw++; else if (w === 'away') aw++
  })
  return { hw, aw }
}
const formatSetScores = (sets) => (sets || [])
  .filter(s => s && s.home !== '' && s.home !== undefined && s.away !== '' && s.away !== undefined)
  .map(s => `${s.home}-${s.away}`)
  .join(', ')
const calcTeamMatchResult = (subMatches) => {
  let hw = 0, aw = 0
  ;(subMatches || []).forEach(sm => {
    const { hw: shw, aw: saw } = calcSetResult(sm.sets)
    if (shw > saw) hw++; else if (saw > shw) aw++
  })
  return { hw, aw }
}

// ── Standings — regular nomor (Regu/Quadrant/Double): same columns as NomorDetail.jsx ──
function calcStandings(teams, matches) {
  const tbl = {}
  teams.forEach(t => tbl[t.id] = { team: t, P: 0, W: 0, L: 0, SetW: 0, SetL: 0, PtsScored: 0, PtsConceded: 0, Pts: 0 })
  matches.filter(m => m.status === 'done' && m.phase === 'group').forEach(m => {
    const h = tbl[m.homeId], a = tbl[m.awayId]
    if (!h || !a) return
    const { hw, aw } = calcSetResult(m.sets)
    let hPts = 0, aPts = 0
    ;(m.sets || []).forEach(s => {
      if (s?.home !== undefined && s?.away !== undefined && (s.home !== '' || s.away !== '')) {
        hPts += parseInt(s.home) || 0; aPts += parseInt(s.away) || 0
      }
    })
    h.P++; a.P++
    h.SetW += hw; h.SetL += aw; a.SetW += aw; a.SetL += hw
    h.PtsScored += hPts; h.PtsConceded += aPts; a.PtsScored += aPts; a.PtsConceded += hPts
    if (hw > aw) { h.W++; h.Pts += 3; a.L++ }
    else if (aw > hw) { a.W++; a.Pts += 3; h.L++ }
    else { h.Pts++; a.Pts++ }
  })
  return Object.values(tbl).sort((x, y) =>
    y.Pts - x.Pts || (y.SetW - y.SetL) - (x.SetW - x.SetL) || (y.PtsScored - y.PtsConceded) - (x.PtsScored - x.PtsConceded)
  )
}

// ── Standings — team nomor (Team Regu/Team Double): same columns as TeamNomorDetail.jsx ──
function calcTeamStandings(teams, matches) {
  const tbl = {}
  teams.forEach(t => tbl[t.id] = { team: t, P: 0, W: 0, L: 0, SubW: 0, SubL: 0, SetW: 0, SetL: 0, Pts: 0 })
  matches.filter(m => m.status === 'done' && m.phase === 'group').forEach(m => {
    const h = tbl[m.homeId], a = tbl[m.awayId]
    if (!h || !a) return
    const { hw, aw } = calcTeamMatchResult(m.subMatches || [])
    let hSetW = 0, hSetL = 0
    ;(m.subMatches || []).forEach(sm => { const r = calcSetResult(sm.sets); hSetW += r.hw; hSetL += r.aw })
    h.P++; a.P++
    h.SubW += hw; h.SubL += aw; a.SubW += aw; a.SubL += hw
    h.SetW += hSetW; h.SetL += hSetL; a.SetW += hSetL; a.SetL += hSetW
    if (hw > aw) { h.W++; h.Pts += 3; a.L++ }
    else if (aw > hw) { a.W++; a.Pts += 3; h.L++ }
    else { h.Pts++; a.Pts++ }
  })
  return Object.values(tbl).sort((x, y) =>
    y.Pts - x.Pts || (y.SubW - y.SubL) - (x.SubW - x.SubL) || (y.SetW - y.SetL) - (x.SetW - x.SetL)
  )
}

const ROUND_LABELS = { 1: 'Final', 2: 'Semifinal', 3: 'Quarterfinal', 4: 'Round of 16', 5: 'Round of 32', 6: 'Round of 64' }

function Stat({ label, value, color }) {
  return (
    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1vw', color: color || 'rgba(255,255,255,0.8)', textAlign: 'center', padding: '1vh 0.5vw' }}>{value}</td>
  )
}

export default function EventTVDisplay({ eventId }) {
  const { events } = useEvents()
  const event = events.find(e => e.id === eventId)
  const { nomors } = useNomors(eventId)
  const [nomorData, setNomorData] = useState({})
  const [slideIndex, setSlideIndex] = useState(0)

  const handleData = useCallback((nomorId, teams, matches) => {
    setNomorData(prev => ({ ...prev, [nomorId]: { teams, matches } }))
  }, [])

  const durationMs = (event?.tvDisplayDuration || 10) * 1000

  const slides = useMemo(() => {
    const list = []
    nomors.forEach(nomor => {
      const nd = nomorData[nomor.id]
      if (!nd || !nd.teams?.length) return
      const isTeam = TEAM_EVENT_NOMORS.includes(nomor.name)
      const { teams, matches } = nd

      // Group standings + results — paired together, one pair per group
      const groupMatchesAll = matches.filter(m => m.phase === 'group')
      const groupIds = [...new Set(groupMatchesAll.map(m => m.groupId).filter(Boolean))]
      groupIds.forEach(gid => {
        const gMatches = groupMatchesAll.filter(m => m.groupId === gid)
        const gName = gMatches[0]?.groupName || gid
        const teamIds = new Set(gMatches.flatMap(m => [m.homeId, m.awayId]))
        const gTeams = teams.filter(t => teamIds.has(t.id))
        if (gTeams.length === 0) return

        const standings = isTeam ? calcTeamStandings(gTeams, gMatches) : calcStandings(gTeams, gMatches)
        list.push({ type: 'standings', nomorName: nomor.name, groupName: gName, standings, isTeam })

        const doneInGroup = gMatches.filter(m => m.status === 'done')
        const chunkSize = isTeam ? 2 : 4
        for (let i = 0; i < doneInGroup.length; i += chunkSize) {
          list.push({ type: 'results', nomorName: nomor.name, groupName: gName, matches: doneInGroup.slice(i, i + chunkSize), teams, isTeam })
        }
      })

      // Knockout bracket results
      const koMatches = matches.filter(m => m.phase === 'knockout')
      const doneKo = koMatches.filter(m => m.status === 'done')
      if (doneKo.length > 0) {
        list.push({ type: 'bracket', nomorName: nomor.name, matches: doneKo, teams, isTeam })
      }

      // Champion — shown last, once the nomor has a determined winner
      const champion = koMatches.find(m => m.round === 1 && m.status === 'done')?.winnerId
      if (champion) {
        const final = koMatches.find(m => m.round === 1 && m.status === 'done')
        const runnerUp = final ? (final.winnerId === final.homeId ? final.awayId : final.homeId) : null
        const semis = koMatches.filter(m => m.round === 2 && m.status === 'done')
        const thirdPlace = semis.map(m => m.winnerId === m.homeId ? m.awayId : m.homeId)
        list.push({ type: 'champion', nomorName: nomor.name, teams, champion, runnerUp, thirdPlace })
      }
    })
    return list
  }, [nomors, nomorData])

  useEffect(() => {
    if (slides.length === 0) return
    setSlideIndex(i => (i >= slides.length ? 0 : i))
    const iv = setInterval(() => setSlideIndex(i => (i + 1) % slides.length), durationMs)
    return () => clearInterval(iv)
  }, [slides.length, durationMs])

  useEffect(() => {
    document.title = event ? `${event.name} — TV Display` : 'Event TV Display'
  }, [event])

  const teamName = (teams, id) => teams.find(t => t.id === id)?.name || 'TBD'
  const teamLogo = (teams, id) => teams.find(t => t.id === id)?.logo || ''

  if (!event) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0515', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" style={{ width: 40, height: 40, borderWidth: 4 }} />
      </div>
    )
  }

  const slide = slides[slideIndex] || null

  return (
    <div style={{
      minHeight: '100vh', width: '100vw', background: 'radial-gradient(ellipse at center, #1a0a2e 0%, #0a0515 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
      fontFamily: 'var(--font-body)', overflow: 'hidden', padding: '2.5vh 2.5vw', boxSizing: 'border-box',
    }}>
      {nomors.map(n => <NomorDataLoader key={n.id} eventId={eventId} nomorId={n.id} onData={handleData} />)}

      {/* Header */}
      <div style={{ width: '100%', textAlign: 'center', marginBottom: '2vh' }}>
        <img src={istafLogo} alt="ISTAF" style={{ height: '5vh', display: 'block', marginLeft: 'auto', marginRight: 'auto', marginBottom: '1vh' }} />
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.2vw', color: '#FFD700', letterSpacing: 2, textTransform: 'uppercase', textShadow: '0 0 20px rgba(255,215,0,0.5)' }}>
          {event.name}
        </div>
      </div>

      {/* Slide content */}
      <div style={{ flex: 1, width: '100%', maxWidth: 1650, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {!slide ? (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '2vw', fontFamily: 'var(--font-display)' }}>
            WAITING FOR MATCH DATA...
          </div>

        ) : slide.type === 'champion' ? (
          <div style={{ border: '3px solid #FFD700', borderRadius: 20, background: 'linear-gradient(135deg, #8b0e1e, #c0152a)', padding: '3vh 3vw' }}>
            <div style={{ textAlign: 'center', marginBottom: '2.5vh' }}>
              <div style={{ fontSize: '1.2vw', color: '#FFD700', fontFamily: 'var(--font-mono)', letterSpacing: 2, textTransform: 'uppercase' }}>{slide.nomorName}</div>
              <div style={{ fontSize: '2.6vw', color: '#fff', fontFamily: 'var(--font-display)', letterSpacing: 2 }}>🏆 FINAL RESULTS</div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.2vw', justifyContent: 'center' }}>
              {[
                { medal: '🥇', label: 'GOLD MEDAL', id: slide.champion },
                { medal: '🥈', label: 'SILVER MEDAL', id: slide.runnerUp },
                ...slide.thirdPlace.map(id => ({ medal: '🥉', label: 'BRONZE MEDAL', id })),
              ].filter(j => j.id).map((j, i) => (
                <div key={i} style={{ background: '#FFD700', border: '2px solid #B8860B', borderRadius: 14, padding: '1.6vh 1.8vw', display: 'flex', alignItems: 'center', gap: '1vw', minWidth: '20vw' }}>
                  <span style={{ fontSize: '2.2vw' }}>{j.medal}</span>
                  <TeamLogo src={teamLogo(slide.teams, j.id)} name={teamName(slide.teams, j.id)} size={56} />
                  <div>
                    <div style={{ fontSize: '0.9vw', fontWeight: 700, color: '#5a0812', fontFamily: 'var(--font-mono)', letterSpacing: 1 }}>{j.label}</div>
                    <div style={{ fontSize: '1.6vw', fontWeight: 700, color: '#1a0a2e' }}>{teamName(slide.teams, j.id)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        ) : slide.type === 'standings' ? (
          <div style={{ border: '3px solid #FFD700', borderRadius: 20, background: 'rgba(0,0,0,0.35)', padding: '3vh 3vw' }}>
            <div style={{ textAlign: 'center', marginBottom: '2.5vh' }}>
              <div style={{ fontSize: '1.2vw', color: '#FFD700', fontFamily: 'var(--font-mono)', letterSpacing: 2, textTransform: 'uppercase' }}>{slide.nomorName}</div>
              <div style={{ fontSize: '2.4vw', color: '#fff', fontFamily: 'var(--font-display)', letterSpacing: 2 }}>STANDINGS — {slide.groupName}</div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid rgba(255,215,0,0.4)' }}>
                  {(slide.isTeam
                    ? ['#', 'Team', 'P', 'M', 'K', 'Regu+', 'Regu-', 'ΔR', 'Set+', 'Set-', 'ΔS', 'Pts']
                    : ['#', 'Team', 'P', 'M', 'K', 'S+', 'S-', 'ΔS', 'P+', 'P-', 'ΔP', 'Pts']
                  ).map(h => (
                    <th key={h} style={{ fontSize: '0.85vw', color: '#FFD700', fontFamily: 'var(--font-mono)', padding: '1vh 0.4vw', textAlign: h === 'Team' ? 'left' : 'center' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slide.standings.map((row, i) => {
                  const isTeam = slide.isTeam
                  const diff1 = isTeam ? row.SubW - row.SubL : row.SetW - row.SetL
                  const diff2 = isTeam ? row.SetW - row.SetL : row.PtsScored - row.PtsConceded
                  return (
                    <tr key={row.team.id} style={{ background: i < 2 ? 'rgba(255,215,0,0.08)' : 'transparent' }}>
                      <td style={{ fontSize: '1.2vw', color: i < 2 ? '#FFD700' : '#fff', fontWeight: 700, padding: '1vh 0.4vw', textAlign: 'center' }}>{i + 1}</td>
                      <td style={{ padding: '1vh 0.4vw' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6vw' }}>
                          <TeamLogo src={row.team.logo} name={row.team.name} size={32} />
                          <span style={{ fontSize: '1.3vw', color: '#fff', fontWeight: i < 2 ? 700 : 500, whiteSpace: 'nowrap' }}>{row.team.name}</span>
                        </div>
                      </td>
                      <Stat value={row.P} />
                      <Stat value={row.W} color="#4ade80" />
                      <Stat value={row.L} color="#ff9999" />
                      <Stat value={isTeam ? row.SubW : row.SetW} />
                      <Stat value={isTeam ? row.SubL : row.SetL} />
                      <Stat value={diff1 > 0 ? `+${diff1}` : diff1} color={diff1 > 0 ? '#4ade80' : diff1 < 0 ? '#ff9999' : undefined} />
                      <Stat value={isTeam ? row.SetW : row.PtsScored} />
                      <Stat value={isTeam ? row.SetL : row.PtsConceded} />
                      <Stat value={diff2 > 0 ? `+${diff2}` : diff2} color={diff2 > 0 ? '#4ade80' : diff2 < 0 ? '#ff9999' : undefined} />
                      <td style={{ fontSize: '1.4vw', color: '#FFD700', fontWeight: 700, textAlign: 'center' }}>{row.Pts}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

        ) : slide.type === 'results' ? (
          <div style={{ border: '3px solid #FFD700', borderRadius: 20, background: 'rgba(0,0,0,0.35)', padding: '3vh 3vw' }}>
            <div style={{ textAlign: 'center', marginBottom: '2.5vh' }}>
              <div style={{ fontSize: '1.2vw', color: '#FFD700', fontFamily: 'var(--font-mono)', letterSpacing: 2, textTransform: 'uppercase' }}>{slide.nomorName}</div>
              <div style={{ fontSize: '2.4vw', color: '#fff', fontFamily: 'var(--font-display)', letterSpacing: 2 }}>MATCH RESULTS — {slide.groupName}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.6vh' }}>
              {slide.matches.map(m => {
                if (!slide.isTeam) {
                  const { hw, aw } = calcSetResult(m.sets)
                  const setLine = formatSetScores(m.sets)
                  return (
                    <div key={m.id} style={{ padding: '1.3vh 1.6vw', background: 'rgba(255,255,255,0.05)', borderRadius: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.7vw', flex: 1, justifyContent: 'flex-end' }}>
                          <span style={{ fontSize: '1.5vw', color: hw > aw ? '#FFD700' : '#fff', fontWeight: hw > aw ? 700 : 500 }}>{teamName(slide.teams, m.homeId)}</span>
                          <TeamLogo src={teamLogo(slide.teams, m.homeId)} name={teamName(slide.teams, m.homeId)} size={36} />
                        </div>
                        <div style={{ fontSize: '1.8vw', color: '#FFD700', fontFamily: 'var(--font-mono)', fontWeight: 800, padding: '0 1.5vw' }}>{hw} — {aw}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.7vw', flex: 1 }}>
                          <TeamLogo src={teamLogo(slide.teams, m.awayId)} name={teamName(slide.teams, m.awayId)} size={36} />
                          <span style={{ fontSize: '1.5vw', color: aw > hw ? '#FFD700' : '#fff', fontWeight: aw > hw ? 700 : 500 }}>{teamName(slide.teams, m.awayId)}</span>
                        </div>
                      </div>
                      {setLine && <div style={{ textAlign: 'center', fontSize: '1vw', color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)', marginTop: '0.6vh' }}>{setLine}</div>}
                    </div>
                  )
                }
                // Team-type: aggregate + per sub-match breakdown with set scores
                const { hw, aw } = calcTeamMatchResult(m.subMatches || [])
                return (
                  <div key={m.id} style={{ padding: '1.3vh 1.6vw', background: 'rgba(255,255,255,0.05)', borderRadius: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.2vw', marginBottom: '1.2vh' }}>
                      <span style={{ fontSize: '1.5vw', color: hw > aw ? '#FFD700' : '#fff', fontWeight: hw > aw ? 700 : 500 }}>{teamName(slide.teams, m.homeId)}</span>
                      <span style={{ fontSize: '1.8vw', color: '#FFD700', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>{hw} — {aw}</span>
                      <span style={{ fontSize: '1.5vw', color: aw > hw ? '#FFD700' : '#fff', fontWeight: aw > hw ? 700 : 500 }}>{teamName(slide.teams, m.awayId)}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6vh' }}>
                      {(m.subMatches || []).map((sm, si) => {
                        const sr = calcSetResult(sm.sets)
                        const setLine = formatSetScores(sm.sets)
                        return (
                          <div key={si} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.8vw', fontFamily: 'var(--font-mono)' }}>
                            <span style={{ fontSize: '1vw', color: 'rgba(255,255,255,0.6)', width: '11vw', textAlign: 'right' }}>{teamName(slide.teams, m.homeId)} {si + 1}</span>
                            <span style={{ fontSize: '1.1vw', color: sr.hw > sr.aw ? '#4ade80' : '#ff9999', fontWeight: 700 }}>{sr.hw}-{sr.aw}</span>
                            <span style={{ fontSize: '0.85vw', color: 'rgba(255,255,255,0.4)' }}>{setLine}</span>
                            <span style={{ fontSize: '1vw', color: 'rgba(255,255,255,0.6)', width: '11vw', textAlign: 'left' }}>{teamName(slide.teams, m.awayId)} {si + 1}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

        ) : slide.type === 'bracket' ? (
          <div style={{ border: '3px solid #FFD700', borderRadius: 20, background: 'rgba(0,0,0,0.35)', padding: '3vh 3vw' }}>
            <div style={{ textAlign: 'center', marginBottom: '2.5vh' }}>
              <div style={{ fontSize: '1.2vw', color: '#FFD700', fontFamily: 'var(--font-mono)', letterSpacing: 2, textTransform: 'uppercase' }}>{slide.nomorName}</div>
              <div style={{ fontSize: '2.4vw', color: '#fff', fontFamily: 'var(--font-display)', letterSpacing: 2 }}>KNOCKOUT RESULTS</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.4vh' }}>
              {[...slide.matches].sort((a, b) => (b.round || 0) - (a.round || 0)).slice(0, 6).map(m => {
                const { hw, aw } = slide.isTeam ? calcTeamMatchResult(m.subMatches || []) : calcSetResult(m.sets)
                return (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '1.5vw', padding: '1.2vh 1.5vw', background: 'rgba(255,255,255,0.05)', borderRadius: 12 }}>
                    <div style={{ fontSize: '1vw', color: '#FFD700', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', width: '9vw', flexShrink: 0 }}>{ROUND_LABELS[m.round] || `Round ${m.round}`}</div>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6vw' }}>
                        <TeamLogo src={teamLogo(slide.teams, m.homeId)} name={teamName(slide.teams, m.homeId)} size={30} />
                        <span style={{ fontSize: '1.3vw', color: hw > aw ? '#FFD700' : '#fff', fontWeight: hw > aw ? 700 : 500 }}>{teamName(slide.teams, m.homeId)}</span>
                      </div>
                      <div style={{ fontSize: '1.5vw', color: '#FFD700', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>{hw} — {aw}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6vw' }}>
                        <span style={{ fontSize: '1.3vw', color: aw > hw ? '#FFD700' : '#fff', fontWeight: aw > hw ? 700 : 500 }}>{teamName(slide.teams, m.awayId)}</span>
                        <TeamLogo src={teamLogo(slide.teams, m.awayId)} name={teamName(slide.teams, m.awayId)} size={30} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>

      {/* Slide progress dots */}
      {slides.length > 1 && (
        <div style={{ display: 'flex', gap: '0.6vw', marginTop: '2vh' }}>
          {slides.map((_, i) => (
            <div key={i} style={{
              width: i === slideIndex ? '2.2vw' : '0.7vw', height: '0.7vw', borderRadius: 999,
              background: i === slideIndex ? '#FFD700' : 'rgba(255,255,255,0.25)', transition: 'all 0.3s',
            }} />
          ))}
        </div>
      )}

      <style>{`body { margin: 0; }`}</style>
    </div>
  )
}
