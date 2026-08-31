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
const calcTeamMatchResult = (subMatches) => {
  let hw = 0, aw = 0
  ;(subMatches || []).forEach(sm => {
    const { hw: shw, aw: saw } = calcSetResult(sm.sets)
    if (shw > saw) hw++; else if (saw > shw) aw++
  })
  return { hw, aw }
}

// Simplified standings (Pts → Set/Sub diff). Good enough for a TV
// slideshow — exact ISTAF tiebreaker rules stay in the live pages.
function calcStandings(teams, matches, isTeam) {
  const tbl = {}
  teams.forEach(t => tbl[t.id] = { team: t, P: 0, W: 0, L: 0, diffW: 0, diffL: 0, Pts: 0 })
  matches.filter(m => m.status === 'done' && m.phase === 'group').forEach(m => {
    const h = tbl[m.homeId], a = tbl[m.awayId]
    if (!h || !a) return
    const { hw, aw } = isTeam ? calcTeamMatchResult(m.subMatches || []) : calcSetResult(m.sets)
    h.P++; a.P++
    h.diffW += hw; h.diffL += aw
    a.diffW += aw; a.diffL += hw
    if (hw > aw) { h.W++; h.Pts += 3; a.L++ }
    else if (aw > hw) { a.W++; a.Pts += 3; h.L++ }
    else { h.Pts++; a.Pts++ }
  })
  return Object.values(tbl).sort((x, y) => y.Pts - x.Pts || (y.diffW - y.diffL) - (x.diffW - x.diffL))
}

const ROUND_LABELS = { 1: 'Final', 2: 'Semifinal', 3: 'Quarterfinal', 4: 'Round of 16', 5: 'Round of 32', 6: 'Round of 64' }

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

  // Build the flat list of slides from whatever data currently exists.
  const slides = useMemo(() => {
    const list = []
    nomors.forEach(nomor => {
      const nd = nomorData[nomor.id]
      if (!nd || !nd.teams?.length) return
      const isTeam = TEAM_EVENT_NOMORS.includes(nomor.name)
      const { teams, matches } = nd

      // Group standings — one slide per group
      const groupMatches = matches.filter(m => m.phase === 'group')
      const groupIds = [...new Set(groupMatches.map(m => m.groupId).filter(Boolean))]
      groupIds.forEach(gid => {
        const gMatches = groupMatches.filter(m => m.groupId === gid)
        const gName = gMatches[0]?.groupName || gid
        const teamIds = new Set(gMatches.flatMap(m => [m.homeId, m.awayId]))
        const gTeams = teams.filter(t => teamIds.has(t.id))
        if (gTeams.length === 0) return
        list.push({ type: 'standings', nomorName: nomor.name, groupName: gName, standings: calcStandings(gTeams, gMatches, isTeam) })
      })

      // Recent results
      const doneMatches = matches.filter(m => m.status === 'done' && m.phase === 'group')
      if (doneMatches.length > 0) {
        list.push({ type: 'results', nomorName: nomor.name, matches: doneMatches, teams, isTeam })
      }

      // Knockout bracket results
      const koMatches = matches.filter(m => m.phase === 'knockout' && m.status === 'done')
      if (koMatches.length > 0) {
        list.push({ type: 'bracket', nomorName: nomor.name, matches: koMatches, teams, isTeam })
      }
    })
    return list
  }, [nomors, nomorData])

  // Auto-rotate
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
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.4vw', color: '#FFD700', letterSpacing: 2, textTransform: 'uppercase', textShadow: '0 0 20px rgba(255,215,0,0.5)' }}>
          {event.name}
        </div>
      </div>

      {/* Slide content */}
      <div style={{ flex: 1, width: '100%', maxWidth: 1500, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {!slide ? (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '2vw', fontFamily: 'var(--font-display)' }}>
            WAITING FOR MATCH DATA...
          </div>
        ) : slide.type === 'standings' ? (
          <div style={{ border: '3px solid #FFD700', borderRadius: 20, background: 'rgba(0,0,0,0.35)', padding: '3vh 3vw' }}>
            <div style={{ textAlign: 'center', marginBottom: '2.5vh' }}>
              <div style={{ fontSize: '1.3vw', color: '#FFD700', fontFamily: 'var(--font-mono)', letterSpacing: 2, textTransform: 'uppercase' }}>{slide.nomorName}</div>
              <div style={{ fontSize: '2.6vw', color: '#fff', fontFamily: 'var(--font-display)', letterSpacing: 2 }}>STANDINGS — {slide.groupName}</div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid rgba(255,215,0,0.4)' }}>
                  {['#', 'Team', 'P', 'W', 'L', 'Pts'].map(h => (
                    <th key={h} style={{ fontSize: '1.1vw', color: '#FFD700', fontFamily: 'var(--font-mono)', padding: '1vh 0.6vw', textAlign: h === 'Team' ? 'left' : 'center' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slide.standings.map((row, i) => (
                  <tr key={row.team.id} style={{ background: i < 2 ? 'rgba(255,215,0,0.08)' : 'transparent' }}>
                    <td style={{ fontSize: '1.5vw', color: i < 2 ? '#FFD700' : '#fff', fontWeight: 700, padding: '1.2vh 0.6vw', textAlign: 'center' }}>{i + 1}</td>
                    <td style={{ padding: '1.2vh 0.6vw' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8vw' }}>
                        <TeamLogo src={row.team.logo} name={row.team.name} size={40} />
                        <span style={{ fontSize: '1.6vw', color: '#fff', fontWeight: i < 2 ? 700 : 500 }}>{row.team.name}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: '1.4vw', color: '#fff', textAlign: 'center' }}>{row.P}</td>
                    <td style={{ fontSize: '1.4vw', color: '#4ade80', textAlign: 'center' }}>{row.W}</td>
                    <td style={{ fontSize: '1.4vw', color: '#ff6b6b', textAlign: 'center' }}>{row.L}</td>
                    <td style={{ fontSize: '1.6vw', color: '#FFD700', fontWeight: 700, textAlign: 'center' }}>{row.Pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : slide.type === 'results' ? (
          <div style={{ border: '3px solid #FFD700', borderRadius: 20, background: 'rgba(0,0,0,0.35)', padding: '3vh 3vw' }}>
            <div style={{ textAlign: 'center', marginBottom: '2.5vh' }}>
              <div style={{ fontSize: '1.3vw', color: '#FFD700', fontFamily: 'var(--font-mono)', letterSpacing: 2, textTransform: 'uppercase' }}>{slide.nomorName}</div>
              <div style={{ fontSize: '2.6vw', color: '#fff', fontFamily: 'var(--font-display)', letterSpacing: 2 }}>MATCH RESULTS</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.4vh' }}>
              {slide.matches.slice(0, 6).map(m => {
                const { hw, aw } = slide.isTeam ? calcTeamMatchResult(m.subMatches || []) : calcSetResult(m.sets)
                return (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.2vh 1.5vw', background: 'rgba(255,255,255,0.05)', borderRadius: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8vw', flex: 1, justifyContent: 'flex-end' }}>
                      <span style={{ fontSize: '1.5vw', color: hw > aw ? '#FFD700' : '#fff', fontWeight: hw > aw ? 700 : 500 }}>{teamName(slide.teams, m.homeId)}</span>
                      <TeamLogo src={teamLogo(slide.teams, m.homeId)} name={teamName(slide.teams, m.homeId)} size={36} />
                    </div>
                    <div style={{ fontSize: '1.8vw', color: '#FFD700', fontFamily: 'var(--font-mono)', fontWeight: 800, padding: '0 1.5vw' }}>{hw} — {aw}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8vw', flex: 1 }}>
                      <TeamLogo src={teamLogo(slide.teams, m.awayId)} name={teamName(slide.teams, m.awayId)} size={36} />
                      <span style={{ fontSize: '1.5vw', color: aw > hw ? '#FFD700' : '#fff', fontWeight: aw > hw ? 700 : 500 }}>{teamName(slide.teams, m.awayId)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : slide.type === 'bracket' ? (
          <div style={{ border: '3px solid #FFD700', borderRadius: 20, background: 'rgba(0,0,0,0.35)', padding: '3vh 3vw' }}>
            <div style={{ textAlign: 'center', marginBottom: '2.5vh' }}>
              <div style={{ fontSize: '1.3vw', color: '#FFD700', fontFamily: 'var(--font-mono)', letterSpacing: 2, textTransform: 'uppercase' }}>{slide.nomorName}</div>
              <div style={{ fontSize: '2.6vw', color: '#fff', fontFamily: 'var(--font-display)', letterSpacing: 2 }}>KNOCKOUT RESULTS</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.4vh' }}>
              {slide.matches.sort((a, b) => (b.round || 0) - (a.round || 0)).slice(0, 6).map(m => {
                const { hw, aw } = slide.isTeam ? calcTeamMatchResult(m.subMatches || []) : calcSetResult(m.sets)
                return (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '1.5vw', padding: '1.2vh 1.5vw', background: 'rgba(255,255,255,0.05)', borderRadius: 12 }}>
                    <div style={{ fontSize: '1.1vw', color: '#FFD700', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', width: '9vw', flexShrink: 0 }}>{ROUND_LABELS[m.round] || `Round ${m.round}`}</div>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.7vw' }}>
                        <TeamLogo src={teamLogo(slide.teams, m.homeId)} name={teamName(slide.teams, m.homeId)} size={32} />
                        <span style={{ fontSize: '1.4vw', color: hw > aw ? '#FFD700' : '#fff', fontWeight: hw > aw ? 700 : 500 }}>{teamName(slide.teams, m.homeId)}</span>
                      </div>
                      <div style={{ fontSize: '1.6vw', color: '#FFD700', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>{hw} — {aw}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.7vw' }}>
                        <span style={{ fontSize: '1.4vw', color: aw > hw ? '#FFD700' : '#fff', fontWeight: aw > hw ? 700 : 500 }}>{teamName(slide.teams, m.awayId)}</span>
                        <TeamLogo src={teamLogo(slide.teams, m.awayId)} name={teamName(slide.teams, m.awayId)} size={32} />
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
