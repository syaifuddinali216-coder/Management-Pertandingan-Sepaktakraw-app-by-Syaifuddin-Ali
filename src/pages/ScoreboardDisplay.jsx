import React, { useEffect, useState } from 'react'
import { useScoreboard } from '../hooks/useFirestore.js'
import TeamLogo from '../components/TeamLogo.jsx'
import { CHALLENGE_TYPES } from '../utils/challengeTypes.js'

function formatTime(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export default function ScoreboardDisplay() {
  const { data, loading } = useScoreboard()
  const [, forceTick] = useState(0)

  useEffect(() => {
    // Reflect the court name (and event title if set) in the browser tab
    // title, so it's easy to tell tabs apart when multiple courts are
    // running side by side.
    const courtLabel = data.courtName?.trim()
    document.title = courtLabel
      ? `${courtLabel} — Live Scoreboard`
      : 'Live Scoreboard — Sepaktakraw GMS'
  }, [data.courtName])

  useEffect(() => {
    if (!data.timerRunning) return
    const iv = setInterval(() => forceTick(t => t + 1), 250)
    return () => clearInterval(iv)
  }, [data.timerRunning])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0515', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" style={{ width: 40, height: 40, borderWidth: 4 }} />
      </div>
    )
  }

  const remainingSeconds = data.timerRunning
    ? Math.max(0, (data.timerEndAt - Date.now()) / 1000)
    : data.timerRemaining

  const activeSet = data.sets[data.currentSet]
  const timerLow = data.timerRunning && remainingSeconds <= 10

  // ── Challenge: dedicated full-screen layout, not squeezed into the ──
  // regular scoreboard box, so both the type label and the verdict can
  // be as large and dramatic as possible on the TV. Multi-word labels
  // (CHALLENGE LINE, NOT OVER, etc.) are stacked one word per line so
  // each word can be sized much bigger than a single-line layout allows.
  if (data.challengeType) {
    const opt = data.challengeResult
      ? CHALLENGE_TYPES[data.challengeType].options.find(o => o.value === data.challengeResult)
      : null
    const typeWords = CHALLENGE_TYPES[data.challengeType].label.split(' ') // always 2 words: "CHALLENGE" + type
    const resultFontSize = '16vw'

    return (
      <div style={{
        minHeight: '100vh', width: '100vw', background: 'radial-gradient(ellipse at center, #1a0a2e 0%, #0a0515 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-body)', overflow: 'hidden', padding: '2vh 2vw', boxSizing: 'border-box',
      }}>
        <div style={{
          width: '94vw', minHeight: '86vh', border: '5px solid #FFD700', borderRadius: 26,
          background: 'rgba(0,0,0,0.35)', boxShadow: '0 0 90px rgba(255,215,0,0.2)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '2vh 2vw', boxSizing: 'border-box',
        }}>
          {data.eventTitle && (
            <div style={{
              display: 'inline-block', marginBottom: '3vh', padding: '1.2vh 2.6vw',
              border: '2px solid rgba(255,215,0,0.5)', borderRadius: 14,
              background: 'rgba(255,215,0,0.07)',
            }}>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: '2.3vw', color: '#fff',
                letterSpacing: 2, textTransform: 'uppercase',
                textShadow: '0 0 20px rgba(255,215,0,0.4)',
              }}>
                {data.eventTitle}
              </span>
            </div>
          )}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
            {!opt ? (
              typeWords.map((w, i) => (
                <div key={i} style={{
                  fontFamily: 'var(--font-display)', fontSize: '16vw', color: '#FFD700',
                  letterSpacing: 2, textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.05,
                  textShadow: '0 0 50px rgba(255,215,0,0.8), 0 0 110px rgba(255,215,0,0.5)',
                  animation: 'sbPulse 1.4s infinite',
                }}>
                  {w}
                </div>
              ))
            ) : (
              <div style={{
                fontFamily: 'var(--font-display)', fontSize: resultFontSize, color: opt.color,
                letterSpacing: 2, textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.05,
                textShadow: `0 0 60px ${opt.color}, 0 0 130px ${opt.color}`,
              }}>
                {opt.label}
              </div>
            )}
          </div>
        </div>
        <style>{`
          @keyframes sbPulse { 0%,100% { opacity: 1 } 50% { opacity: 0.5 } }
          body { margin: 0; }
        `}</style>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh', width: '100vw', background: 'radial-gradient(ellipse at center, #1a0a2e 0%, #0a0515 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-body)', overflow: 'hidden', padding: '3vh 3vw', boxSizing: 'border-box',
    }}>
      <div style={{ width: '94vw', border: '4px solid #FFD700', borderRadius: 22, background: 'rgba(0,0,0,0.35)', boxShadow: '0 0 60px rgba(255,215,0,0.15)', padding: '3.5vh 3.2vw', boxSizing: 'border-box' }}>

        {/* Event title banner — same bordered badge style as the Challenge screen */}
        {data.eventTitle && (
          <div style={{ textAlign: 'center', marginBottom: '3vh' }}>
            <div style={{
              display: 'inline-block', padding: '1.2vh 2.6vw',
              border: '2px solid rgba(255,215,0,0.5)', borderRadius: 14,
              background: 'rgba(255,215,0,0.07)',
            }}>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: '2.9vw', color: '#fff',
                letterSpacing: 2, textTransform: 'uppercase',
                textShadow: '0 0 20px rgba(255,215,0,0.4)',
              }}>
                {data.eventTitle}
              </span>
            </div>
          </div>
        )}

        {/* Set indicator */}
        <div style={{ textAlign: 'center', marginBottom: '2.4vh' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '2.3vw', letterSpacing: 4, color: '#FFD700', fontWeight: 700, textTransform: 'uppercase' }}>
            ● LIVE &nbsp;·&nbsp; SET {data.currentSet + 1} / 3
          </span>
        </div>

        {/* Main scoreboard row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '2vw' }}>

          {/* Team A */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2vh' }}>
              <TeamLogo src={data.teamALogo} name={data.teamAName} size={185} />
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '4.4vw', color: '#fff', letterSpacing: 2, marginBottom: '1.3vh', textShadow: '0 0 20px rgba(255,255,255,0.3)' }}>
              {data.teamAName || 'TEAM A'}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13vw', fontWeight: 800, color: '#FFD700', lineHeight: 1, textShadow: '0 0 30px rgba(255,215,0,0.5)' }}>
              {activeSet.a}
            </div>
          </div>

          {/* Center: sets summary + timer */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2.4vh', minWidth: '17vw' }}>
            {data.sets.map((s, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '1vw',
                fontFamily: 'var(--font-mono)', fontSize: i === data.currentSet ? '2vw' : '1.5vw',
                color: i === data.currentSet ? '#FFD700' : 'rgba(255,255,255,0.45)',
                fontWeight: i === data.currentSet ? 800 : 500,
              }}>
                <span style={{ letterSpacing: 1 }}>SET {i + 1}:</span>
                <span>{i < data.currentSet || (i === data.currentSet && (s.a > 0 || s.b > 0)) ? `${s.a} - ${s.b}` : '—'}</span>
              </div>
            ))}
            <div style={{
              marginTop: '1vh', fontFamily: 'var(--font-mono)', fontSize: '3.6vw', fontWeight: 800,
              color: timerLow ? '#ff3b3b' : '#4ade80',
              textShadow: timerLow ? '0 0 20px rgba(255,59,59,0.6)' : '0 0 20px rgba(74,222,128,0.5)',
              animation: timerLow ? 'sbPulse 1s infinite' : 'none',
            }}>
              {formatTime(remainingSeconds)}
            </div>
            {data.timerLabel && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.3vw', color: 'rgba(255,255,255,0.5)', letterSpacing: 2, textTransform: 'uppercase', marginTop: '-1.2vh' }}>
                {data.timerLabel}
              </div>
            )}
          </div>

          {/* Team B */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2vh' }}>
              <TeamLogo src={data.teamBLogo} name={data.teamBName} size={185} />
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '4.4vw', color: '#fff', letterSpacing: 2, marginBottom: '1.3vh', textShadow: '0 0 20px rgba(255,255,255,0.3)' }}>
              {data.teamBName || 'TEAM B'}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13vw', fontWeight: 800, color: '#FFD700', lineHeight: 1, textShadow: '0 0 30px rgba(255,215,0,0.5)' }}>
              {activeSet.b}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes sbPulse { 0%,100% { opacity: 1 } 50% { opacity: 0.4 } }
        body { margin: 0; }
      `}</style>
    </div>
  )
}
