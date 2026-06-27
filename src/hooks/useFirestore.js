import { useState, useEffect } from 'react'
import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc,
  serverTimestamp, query, orderBy, setDoc
} from 'firebase/firestore'
import { db } from '../firebase.js'
import { useApp } from '../App.jsx'

// ── Events (turnamen/project) ──────────────────────────────
export function useEvents() {
  const { user } = useApp()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const q = query(collection(db, 'users', user.uid, 'events'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, snap => {
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [user])

  const addEvent = (data) => addDoc(collection(db, 'users', user.uid, 'events'), { ...data, createdAt: serverTimestamp() })
  const updateEvent = (id, data) => updateDoc(doc(db, 'users', user.uid, 'events', id), data)
  const deleteEvent = (id) => deleteDoc(doc(db, 'users', user.uid, 'events', id))

  return { events, loading, addEvent, updateEvent, deleteEvent }
}

// ── Nomor pertandingan dalam 1 event ─────────────────────
export function useNomors(eventId) {
  const { user } = useApp()
  const [nomors, setNomors] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !eventId) return
    const q = query(collection(db, 'users', user.uid, 'events', eventId, 'nomors'), orderBy('createdAt', 'asc'))
    const unsub = onSnapshot(q, snap => {
      setNomors(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [user, eventId])

  const base = () => collection(db, 'users', user.uid, 'events', eventId, 'nomors')
  const addNomor = (data) => addDoc(base(), { ...data, createdAt: serverTimestamp() })
  const updateNomor = (id, data) => updateDoc(doc(db, 'users', user.uid, 'events', eventId, 'nomors', id), data)
  const deleteNomor = (id) => deleteDoc(doc(db, 'users', user.uid, 'events', eventId, 'nomors', id))

  return { nomors, loading, addNomor, updateNomor, deleteNomor }
}

// ── Tim dalam 1 nomor ─────────────────────────────────────
export function useTeams(eventId, nomorId) {
  const { user } = useApp()
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !eventId || !nomorId) return
    const q = query(collection(db, 'users', user.uid, 'events', eventId, 'nomors', nomorId, 'teams'), orderBy('createdAt', 'asc'))
    const unsub = onSnapshot(q, snap => {
      setTeams(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [user, eventId, nomorId])

  const base = () => collection(db, 'users', user.uid, 'events', eventId, 'nomors', nomorId, 'teams')
  const addTeam = (data) => addDoc(base(), { ...data, createdAt: serverTimestamp() })
  const updateTeam = (id, data) => updateDoc(doc(db, 'users', user.uid, 'events', eventId, 'nomors', nomorId, 'teams', id), data)
  const deleteTeam = (id) => deleteDoc(doc(db, 'users', user.uid, 'events', eventId, 'nomors', nomorId, 'teams', id))

  return { teams, loading, addTeam, updateTeam, deleteTeam }
}

// ── Match dalam 1 nomor ───────────────────────────────────
export function useMatches(eventId, nomorId) {
  const { user } = useApp()
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !eventId || !nomorId) return
    const q = query(collection(db, 'users', user.uid, 'events', eventId, 'nomors', nomorId, 'matches'), orderBy('createdAt', 'asc'))
    const unsub = onSnapshot(q, snap => {
      setMatches(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [user, eventId, nomorId])

  const base = () => collection(db, 'users', user.uid, 'events', eventId, 'nomors', nomorId, 'matches')
  const addMatch = (data) => addDoc(base(), { ...data, createdAt: serverTimestamp() })
  const updateMatch = (id, data) => updateDoc(doc(db, 'users', user.uid, 'events', eventId, 'nomors', nomorId, 'matches', id), data)
  const deleteMatch = (id) => deleteDoc(doc(db, 'users', user.uid, 'events', eventId, 'nomors', nomorId, 'matches', id))
  const setMatch = (id, data) => setDoc(doc(db, 'users', user.uid, 'events', eventId, 'nomors', nomorId, 'matches', id), data)

  return { matches, loading, addMatch, updateMatch, deleteMatch, setMatch }
}
