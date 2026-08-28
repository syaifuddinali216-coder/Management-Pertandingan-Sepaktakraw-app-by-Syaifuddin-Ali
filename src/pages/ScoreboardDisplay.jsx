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

  return (
    <div style={{
      minHeight: '100vh', width: '100vw', background: 'radial-gradient(ellipse at center, #1a0a2e 0%, #0a0515 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-body)', overflow: 'hidden', padding: '3vh 3vw', boxSizing: 'border-box',
    }}>
      <div style={{ width: '100%', maxWidth: 1650, border: '4px solid #FFD700', borderRadius: 22, background: 'rgba(0,0,0,0.35)', boxShadow: '0 0 60px rgba(255,215,0,0.15)', padding: '3.5vh 3.2vw' }}>

        {/* Event title banner */}
        {data.eventTitle && (
          <div style={{
            textAlign: 'center', marginBottom: '2.5vh', paddingBottom: '2vh',
            borderBottom: '2px solid rgba(255,215,0,0.3)',
          }}>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: '2.9vw', color: '#fff',
              letterSpacing: 3, textTransform: 'uppercase', lineHeight: 1.15,
              textShadow: '0 0 25px rgba(255,215,0,0.5), 0 2px 8px rgba(0,0,0,0.6)',
              background: 'linear-gradient(180deg, #ffffff 0%, #FFE855 60%, #FFD700 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              {data.eventTitle}
            </div>
          </div>
        )}

        {data.challengeType ? (
          /* Challenge overlay — replaces the score row while a challenge is active */
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '34vh' }}>
            {!data.challengeResult ? (
              <div style={{
                fontFamily: 'var(--font-display)', fontSize: '7vw', color: '#FFD700',
                letterSpacing: 4, textTransform: 'uppercase', textAlign: 'center',
                textShadow: '0 0 40px rgba(255,215,0,0.7), 0 0 90px rgba(255,215,0,0.4)',
              }}>
                {CHALLENGE_TYPES[data.challengeType].label}
              </div>
            ) : (() => {
              const opt = CHALLENGE_TYPES[data.challengeType].options.find(o => o.value === data.challengeResult)
              return (
                <div style={{
                  fontFamily: 'var(--font-display)', fontSize: '10vw', color: opt?.color || '#fff',
                  letterSpacing: 4, textTransform: 'uppercase', textAlign: 'center',
                  textShadow: `0 0 50px ${opt?.color}, 0 0 100px ${opt?.color}`,
                }}>
                  {opt?.label}
                </div>
              )
            })()}
          </div>
        ) : (
          <>
            {/* Set indicator */}
            <div style={{ textAlign: 'center', marginBottom: '2.2vh' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '2vw', letterSpacing: 4, color: '#FFD700', fontWeight: 700, textTransform: 'uppercase' }}>
                ● LIVE &nbsp;·&nbsp; SET {data.currentSet + 1} / 3
              </span>
            </div>

            {/* Main scoreboard row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '2vw' }}>

          {/* Team A */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.8vh' }}>
              <TeamLogo src={data.teamALogo} name={data.teamAName} size={155} />
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '3.9vw', color: '#fff', letterSpacing: 2, marginBottom: '1.2vh', textShadow: '0 0 20px rgba(255,255,255,0.3)' }}>
              {data.teamAName || 'TEAM A'}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11.5vw', fontWeight: 800, color: '#FFD700', lineHeight: 1, textShadow: '0 0 30px rgba(255,215,0,0.5)' }}>
              {activeSet.a}
            </div>
          </div>

          {/* Center: sets summary + timer */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2.2vh', minWidth: '16vw' }}>
            {data.sets.map((s, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '0.9vw',
                fontFamily: 'var(--font-mono)', fontSize: i === data.currentSet ? '1.7vw' : '1.25vw',
                color: i === data.currentSet ? '#FFD700' : 'rgba(255,255,255,0.45)',
                fontWeight: i === data.currentSet ? 800 : 500,
              }}>
                <span style={{ letterSpacing: 1 }}>SET {i + 1}:</span>
                <span>{i < data.currentSet || (i === data.currentSet && (s.a > 0 || s.b > 0)) ? `${s.a} - ${s.b}` : '—'}</span>
              </div>
            ))}
            <div style={{
              marginTop: '1vh', fontFamily: 'var(--font-mono)', fontSize: '3.1vw', fontWeight: 800,
              color: timerLow ? '#ff3b3b' : '#4ade80',
              textShadow: timerLow ? '0 0 20px rgba(255,59,59,0.6)' : '0 0 20px rgba(74,222,128,0.5)',
              animation: timerLow ? 'sbPulse 1s infinite' : 'none',
            }}>
              {formatTime(remainingSeconds)}
            </div>
            {data.timerLabel && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1vw', color: 'rgba(255,255,255,0.5)', letterSpacing: 2, textTransform: 'uppercase', marginTop: '-1.2vh' }}>
                {data.timerLabel}
              </div>
            )}
          </div>

          {/* Team B */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.8vh' }}>
              <TeamLogo src={data.teamBLogo} name={data.teamBName} size={155} />
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '3.9vw', color: '#fff', letterSpacing: 2, marginBottom: '1.2vh', textShadow: '0 0 20px rgba(255,255,255,0.3)' }}>
              {data.teamBName || 'TEAM B'}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11.5vw', fontWeight: 800, color: '#FFD700', lineHeight: 1, textShadow: '0 0 30px rgba(255,215,0,0.5)' }}>
              {activeSet.b}
            </div>
          </div>
        </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes sbPulse { 0%,100% { opacity: 1 } 50% { opacity: 0.4 } }
        body { margin: 0; }
      `}</style>
    </div>
  )
}
