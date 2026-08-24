import React, { useState, useEffect, useRef } from 'react'
import { useApp } from '../App.jsx'
import { useScoreboard } from '../hooks/useFirestore.js'
import TeamLogo from '../components/TeamLogo.jsx'
import { compressImage } from '../utils/imageCompress.js'

const TIMER_PRESETS = [
  { label: 'Time Out', seconds: 60 },
  { label: 'Jeda Antar Set', seconds: 120 },
  { label: 'Jeda Antar Game', seconds: 300 },
]

function formatTime(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export default function ScoreboardControl() {
  const { showToast } = useApp()
  const { data, loading, save } = useScoreboard()
  const [uploadingLogo, setUploadingLogo] = useState(null) // 'A' | 'B' | null
  const [customMinutes, setCustomMinutes] = useState('')
  const [customSeconds, setCustomSeconds] = useState('')
  const [tick, setTick] = useState(0)

  // Local ticking clock for smooth countdown display while timer is running
  useEffect(() => {
    if (!data.timerRunning) return
    const iv = setInterval(() => setTick(t => t + 1), 250)
    return () => clearInterval(iv)
  }, [data.timerRunning])

  const remainingSeconds = data.timerRunning
    ? Math.max(0, (data.timerEndAt - Date.now()) / 1000)
    : data.timerRemaining

  // Auto-stop locally when it hits zero (server state settles next save)
  useEffect(() => {
    if (data.timerRunning && data.timerEndAt && Date.now() >= data.timerEndAt) {
      save({ timerRunning: false, timerRemaining: 0 })
    }
  }, [tick]) // eslint-disable-line

  const handleLogoUpload = async (team, e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingLogo(team)
    try {
      const dataUrl = await compressImage(file)
      await save(team === 'A' ? { teamALogo: dataUrl } : { teamBLogo: dataUrl })
    } catch (err) {
      showToast('Gagal upload logo: ' + err.message)
    }
    setUploadingLogo(null)
    e.target.value = ''
  }

  const changeScore = (team, delta) => {
    const sets = data.sets.map((s, i) => i !== data.currentSet ? s : {
      ...s, [team]: Math.max(0, s[team] + delta)
    })
    save({ sets })
  }

  const nextSet = () => {
    if (data.currentSet >= 2) return showToast('Sudah di set terakhir (Set 3)!')
    save({ currentSet: data.currentSet + 1 })
  }

  const prevSet = () => {
    if (data.currentSet <= 0) return
    save({ currentSet: data.currentSet - 1 })
  }

  const resetScore = () => {
    if (!confirm('Reset semua skor & set ke 0? Nama tim & logo tidak berubah.')) return
    save({
      sets: [{ a: 0, b: 0 }, { a: 0, b: 0 }, { a: 0, b: 0 }],
      currentSet: 0,
      timerRunning: false, timerEndAt: null, timerRemaining: 0, timerLabel: '',
    })
    showToast('Skor direset!')
  }

  const startTimer = (seconds, label) => {
    if (!seconds || seconds <= 0) return showToast('Durasi timer tidak valid!')
    save({ timerRunning: true, timerEndAt: Date.now() + seconds * 1000, timerRemaining: seconds, timerLabel: label })
  }

  const pauseTimer = () => {
    save({ timerRunning: false, timerRemaining: remainingSeconds })
  }

  const resumeTimer = () => {
    if (remainingSeconds <= 0) return
    save({ timerRunning: true, timerEndAt: Date.now() + remainingSeconds * 1000 })
  }

  const resetTimer = () => {
    save({ timerRunning: false, timerEndAt: null, timerRemaining: 0, timerLabel: '' })
  }

  const openDisplay = () => {
    const url = window.location.origin + window.location.pathname + '?display=scoreboard'
    window.open(url, '_blank', 'noopener')
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} /></div>
  }

  const activeSet = data.sets[data.currentSet]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="tag-line" style={{ marginBottom: 8 }}>Live Match Control</div>
          <h1 style={{ fontSize: 42, color: 'var(--gold)' }}>SCOREBOARD</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={openDisplay}>📺 Buka Tampilan TV</button>
          <button className="btn btn-danger" style={{ padding: '10px 16px', fontSize: 13 }} onClick={resetScore}>🔄 Reset Score</button>
        </div>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 24 }}>
        Klik "Buka Tampilan TV" untuk membuka tab baru — geser tab itu ke layar TV (extend display), lalu tekan F11 untuk full-screen. Semua perubahan di panel ini akan langsung muncul di TV secara real-time.
      </p>

      {/* Team cards side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 16, marginBottom: 24, alignItems: 'stretch' }}>
        {['A', 'B'].map(team => {
          const name = team === 'A' ? data.teamAName : data.teamBName
          const logo = team === 'A' ? data.teamALogo : data.teamBLogo
          return (
            <div key={team} className="card" style={{ padding: '20px', textAlign: 'center' }}>
              <TeamLogo src={logo} name={name} size={64} />
              <div style={{ marginTop: 10 }}>
                <label className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 11, cursor: 'pointer', display: 'inline-block' }}>
                  {uploadingLogo === team ? 'Uploading...' : logo ? 'Change Logo' : '+ Upload Logo'}
                  <input type="file" accept="image/*" onChange={e => handleLogoUpload(team, e)} disabled={uploadingLogo === team} style={{ display: 'none' }} />
                </label>
              </div>
              <input
                value={name}
                onChange={e => save(team === 'A' ? { teamAName: e.target.value.toUpperCase() } : { teamBName: e.target.value.toUpperCase() })}
                style={{ marginTop: 14, textAlign: 'center', fontWeight: 700, fontSize: 16 }}
                placeholder={`TEAM ${team}`}
              />
              <div style={{ fontSize: 56, fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--gold)', margin: '16px 0' }}>
                {activeSet[team.toLowerCase()]}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <button className="btn btn-danger" style={{ padding: '10px 18px', fontSize: 18, fontWeight: 700 }} onClick={() => changeScore(team.toLowerCase(), -1)}>−</button>
                <button className="btn btn-primary" style={{ padding: '10px 22px', fontSize: 18, fontWeight: 700 }} onClick={() => changeScore(team.toLowerCase(), 1)}>+1</button>
              </div>
            </div>
          )
        })}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, minWidth: 90 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>VS</div>
        </div>
      </div>

      {/* Set navigation + history */}
      <div className="card" style={{ padding: '18px 22px', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontSize: 16, color: 'var(--white)' }}>Set {data.currentSet + 1} / 3</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: 12 }} onClick={prevSet} disabled={data.currentSet === 0}>← Set Sebelumnya</button>
            <button className="btn btn-primary" style={{ padding: '6px 14px', fontSize: 12 }} onClick={nextSet} disabled={data.currentSet === 2}>Set Berikutnya →</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {data.sets.map((s, i) => (
            <div key={i} style={{
              padding: '10px 14px', borderRadius: 8, textAlign: 'center',
              background: i === data.currentSet ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.04)',
              border: `1.5px solid ${i === data.currentSet ? 'var(--gold)' : 'rgba(255,255,255,0.1)'}`,
            }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>SET {i + 1}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', fontFamily: 'var(--font-mono)' }}>{s.a} — {s.b}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Timer */}
      <div className="card" style={{ padding: '18px 22px' }}>
        <h2 style={{ fontSize: 16, color: 'var(--white)', marginBottom: 14 }}>⏱️ Timer (Time Out / Jeda)</h2>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 44, fontFamily: 'var(--font-mono)', fontWeight: 800, color: remainingSeconds <= 10 && data.timerRunning ? '#ff5050' : '#4ade80' }}>
            {formatTime(remainingSeconds)}
          </div>
          {data.timerLabel && <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginTop: 4 }}>{data.timerLabel}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 14 }}>
          {TIMER_PRESETS.map(p => (
            <button key={p.label} className="btn btn-ghost" style={{ fontSize: 12, padding: '8px 14px' }} onClick={() => startTimer(p.seconds, p.label)}>
              {p.label} ({Math.round(p.seconds / 60)} mnt)
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
          <input type="number" min="0" placeholder="Menit" value={customMinutes} onChange={e => setCustomMinutes(e.target.value)} style={{ width: 80, textAlign: 'center' }} />
          <span style={{ color: 'var(--text-muted)' }}>:</span>
          <input type="number" min="0" max="59" placeholder="Detik" value={customSeconds} onChange={e => setCustomSeconds(e.target.value)} style={{ width: 80, textAlign: 'center' }} />
          <button className="btn btn-primary" style={{ fontSize: 12, padding: '8px 16px' }} onClick={() => startTimer((parseInt(customMinutes) || 0) * 60 + (parseInt(customSeconds) || 0), 'Custom')}>
            Mulai Custom
          </button>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          {data.timerRunning ? (
            <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={pauseTimer}>⏸ Pause</button>
          ) : (
            <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={resumeTimer} disabled={remainingSeconds <= 0}>▶ Resume</button>
          )}
          <button className="btn btn-danger" style={{ fontSize: 13 }} onClick={resetTimer}>⏹ Reset Timer</button>
        </div>
      </div>
    </div>
  )
}
