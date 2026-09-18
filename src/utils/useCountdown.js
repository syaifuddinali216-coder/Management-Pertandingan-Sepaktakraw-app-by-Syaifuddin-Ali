import { useEffect, useRef, useState } from 'react'

// Countdown that is immune to clock differences between devices.
//
// The old approach stored an absolute end timestamp (Date.now() + duration)
// and every screen computed `endAt - Date.now()`. If the control laptop and
// the TV laptop had different system clocks (even by a few minutes, let
// alone days), the TV showed a wildly wrong number.
//
// Instead we store only a session id + a duration. Each device anchors that
// session to its OWN Date.now() the first time it sees it, then counts down
// locally. Every screen therefore shows the same duration, regardless of
// whose clock is set to what.
export function useCountdown(data) {
  const [, forceTick] = useState(0)
  const anchorRef = useRef({ session: null, startedAt: 0 })

  const running = !!data.timerRunning
  // Fall back to timerRemaining so a document written before timerDuration
  // existed (or one that lost the field) still counts down instead of
  // freezing at 00:00.
  const duration = Number(data.timerDuration) || Number(data.timerRemaining) || 0
  // Fall back to a duration-based key so a running timer without an explicit
  // session id still gets anchored rather than being stuck at zero.
  const session = data.timerSession || (running ? `legacy_${duration}_${data.timerLabel || ''}` : null)

  if (running && session && anchorRef.current.session !== session) {
    anchorRef.current = { session, startedAt: Date.now() }
  }
  if (!running && anchorRef.current.session !== null) {
    anchorRef.current = { session: null, startedAt: 0 }
  }

  useEffect(() => {
    if (!running) return
    const iv = setInterval(() => forceTick(t => t + 1), 250)
    return () => clearInterval(iv)
  }, [running])

  if (!running) return Math.max(0, Number(data.timerRemaining) || 0)
  if (!anchorRef.current.startedAt) return duration

  const elapsed = (Date.now() - anchorRef.current.startedAt) / 1000
  // Clamped to the chosen duration so a corrupt/legacy value can never
  // produce an absurd readout like "4904:26".
  return Math.max(0, Math.min(duration, duration - elapsed))
}

export function formatTime(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export const newTimerSession = () => `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
