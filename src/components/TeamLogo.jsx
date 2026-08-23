import React from 'react'

// Small circular team logo. Falls back to the team's initial letter on a
// gold badge if no logo has been uploaded yet, so layouts never break.
export default function TeamLogo({ src, name, size = 26 }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?'
  const style = {
    width: size, height: size, borderRadius: '50%', flexShrink: 0,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', border: '1.5px solid rgba(255,215,0,0.5)',
    background: 'rgba(255,215,0,0.12)',
  }
  if (src) {
    return (
      <span style={style}>
        <img src={src} alt={name || 'Team logo'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </span>
    )
  }
  return (
    <span style={{ ...style, fontSize: Math.max(10, size * 0.42), fontWeight: 800, color: '#FFD700', fontFamily: 'var(--font-mono)' }}>
      {initial}
    </span>
  )
}
