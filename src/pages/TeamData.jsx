import React, { useState } from 'react'
import { useTeamDataTeams } from '../hooks/useFirestore.js'

// Fixed list of match categories for the Team Data master database.
// Independent from the NOMOR_OPTIONS used inside Event > Nomor.
const CATEGORIES = [
  { id: 'Men Regu', icon: '🥎' },
  { id: 'Women Regu', icon: '🥎' },
  { id: 'Men Quadrant', icon: '🔷' },
  { id: 'Women Quadrant', icon: '🔷' },
  { id: 'Men Double', icon: '👬' },
  { id: 'Women Double', icon: '👭' },
  { id: 'Men Team Regu', icon: '⭐' },
  { id: 'Women Team Regu', icon: '⭐' },
]

const POSITION_SUGGESTIONS = ['Tekong', 'Left Apit', 'Right Apit', 'Feeder', 'Substitute']

const emptyTeamForm = { name: '', code: '', manager: '', headCoach: '', assistantCoach: '' }
const emptyPlayerForm = { name: '', position: '', jerseyNumber: '' }

export default function TeamData() {
  const [view, setView] = useState('categories') // categories | teams | roster
  const [category, setCategory] = useState(null)
  const [selectedTeamId, setSelectedTeamId] = useState(null)

  const { teams, loading, addTeamData, updateTeamData, deleteTeamData } = useTeamDataTeams(category)
  const selectedTeam = teams.find(t => t.id === selectedTeamId) || null

  // ── Team modal (add/edit team basic info) ──
  const [showTeamModal, setShowTeamModal] = useState(false)
  const [teamEditId, setTeamEditId] = useState(null)
  const [teamForm, setTeamForm] = useState(emptyTeamForm)
  const [savingTeam, setSavingTeam] = useState(false)

  const openAddTeam = () => { setTeamForm(emptyTeamForm); setTeamEditId(null); setShowTeamModal(true) }
  const openEditTeam = (t) => {
    setTeamForm({ name: t.name, code: t.code || '', manager: t.manager || '', headCoach: t.headCoach || '', assistantCoach: t.assistantCoach || '' })
    setTeamEditId(t.id); setShowTeamModal(true)
  }
  const saveTeam = async () => {
    if (!teamForm.name.trim()) return
    setSavingTeam(true)
    if (teamEditId) await updateTeamData(teamEditId, teamForm)
    else await addTeamData({ ...teamForm, category, players: [] })
    setSavingTeam(false)
    setShowTeamModal(false)
  }
  const removeTeam = async (id) => {
    if (!confirm('Delete this team and its entire roster?')) return
    if (selectedTeamId === id) { setView('teams'); setSelectedTeamId(null) }
    await deleteTeamData(id)
  }

  // ── Player modal (add/edit player inside a team's roster) ──
  const [showPlayerModal, setShowPlayerModal] = useState(false)
  const [playerEditId, setPlayerEditId] = useState(null)
  const [playerForm, setPlayerForm] = useState(emptyPlayerForm)
  const [savingPlayer, setSavingPlayer] = useState(false)

  const openAddPlayer = () => { setPlayerForm(emptyPlayerForm); setPlayerEditId(null); setShowPlayerModal(true) }
  const openEditPlayer = (p) => { setPlayerForm({ name: p.name, position: p.position || '', jerseyNumber: p.jerseyNumber || '' }); setPlayerEditId(p.id); setShowPlayerModal(true) }

  const savePlayer = async () => {
    if (!playerForm.name.trim() || !selectedTeam) return
    setSavingPlayer(true)
    const players = selectedTeam.players || []
    let updated
    if (playerEditId) {
      updated = players.map(p => p.id === playerEditId ? { ...p, ...playerForm } : p)
    } else {
      const newPlayer = { id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, ...playerForm }
      updated = [...players, newPlayer]
    }
    await updateTeamData(selectedTeam.id, { players: updated })
    setSavingPlayer(false)
    setShowPlayerModal(false)
  }

  const removePlayer = async (playerId) => {
    if (!selectedTeam) return
    if (!confirm('Remove this player from the roster?')) return
    const updated = (selectedTeam.players || []).filter(p => p.id !== playerId)
    await updateTeamData(selectedTeam.id, { players: updated })
  }

  const openTeam = (t) => { setSelectedTeamId(t.id); setView('roster') }

  // ── VIEW: Categories ──
  if (view === 'categories') {
    return (
      <div>
        <div style={{ marginBottom: 32 }}>
          <div className="tag-line" style={{ marginBottom: 8 }}>Master Database</div>
          <h1 style={{ fontSize: 48, color: 'var(--gold)' }}>TEAM DATA</h1>
          <p style={{ fontSize: 13, marginTop: 8, color: 'var(--gray-600)' }}>Select a match category to view or input teams and their full roster (players, manager, coach, assistant coach).</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {CATEGORIES.map(c => (
            <div key={c.id} className="card" style={{ cursor: 'pointer', padding: '24px 22px' }}
              onClick={() => { setCategory(c.id); setView('teams') }}>
              <div style={{ fontSize: 30, marginBottom: 10 }}>{c.icon}</div>
              <h2 style={{ fontSize: 18, color: 'var(--white)' }}>{c.id}</h2>
              <p style={{ fontSize: 12, color: 'var(--gray-600)', marginTop: 6 }}>View teams &amp; roster →</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── VIEW: Teams list for selected category ──
  if (view === 'teams') {
    return (
      <div>
        <button className="btn btn-ghost" style={{ marginBottom: 20, padding: '7px 14px', fontSize: 13 }} onClick={() => { setView('categories'); setCategory(null) }}>← Back to Categories</button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32 }}>
          <div>
            <div className="tag-line" style={{ marginBottom: 8 }}>Team Data</div>
            <h1 style={{ fontSize: 40, color: 'var(--gold)' }}>{category}</h1>
          </div>
          <button className="btn btn-primary" onClick={openAddTeam}>+ Add Team</button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} /></div>
        ) : teams.length === 0 ? (
          <div className="card empty-state">
            <div style={{ fontSize: 48, marginBottom: 16 }}>👥</div>
            <p>No teams yet in {category}.</p>
            <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={openAddTeam}>+ Add First Team</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {teams.map(t => (
              <div key={t.id} className="card" style={{ padding: '20px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                  <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => openTeam(t)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                      <h2 style={{ fontSize: 20, color: 'var(--white)' }}>{t.name}</h2>
                      {t.code && <span className="badge badge-gray">{t.code}</span>}
                      <span className="badge badge-gold">{(t.players || []).length} Players</span>
                    </div>
                    <div style={{ display: 'flex', gap: 20, fontSize: 13, color: 'var(--gray-600)' }}>
                      {t.manager && <span>🧑‍💼 Manager: {t.manager}</span>}
                      {t.headCoach && <span>🎽 Head Coach: {t.headCoach}</span>}
                      {t.assistantCoach && <span>🎽 Asst. Coach: {t.assistantCoach}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button className="btn btn-primary" style={{ padding: '7px 16px', fontSize: 13 }} onClick={() => openTeam(t)}>Open Roster</button>
                    <button className="btn btn-ghost" style={{ padding: '7px 14px', fontSize: 13 }} onClick={() => openEditTeam(t)}>Edit</button>
                    <button className="btn btn-danger" style={{ padding: '7px 14px', fontSize: 13 }} onClick={() => removeTeam(t.id)}>Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {showTeamModal && (
          <div className="modal-overlay" onClick={() => setShowTeamModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <h2>{teamEditId ? 'EDIT TEAM' : 'NEW TEAM'}</h2>
              <div className="form-group">
                <label>Team Name *</label>
                <input value={teamForm.name} onChange={e => setTeamForm({ ...teamForm, name: e.target.value })} placeholder="e.g. Jakarta Selection" autoFocus />
              </div>
              <div className="form-group">
                <label>Team Code (optional)</label>
                <input value={teamForm.code} onChange={e => setTeamForm({ ...teamForm, code: e.target.value })} placeholder="e.g. JKT" />
              </div>
              <div className="form-group">
                <label>Manager</label>
                <input value={teamForm.manager} onChange={e => setTeamForm({ ...teamForm, manager: e.target.value })} placeholder="Manager name" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label>Head Coach</label>
                  <input value={teamForm.headCoach} onChange={e => setTeamForm({ ...teamForm, headCoach: e.target.value })} placeholder="Head coach name" />
                </div>
                <div className="form-group">
                  <label>Assistant Coach</label>
                  <input value={teamForm.assistantCoach} onChange={e => setTeamForm({ ...teamForm, assistantCoach: e.target.value })} placeholder="Assistant coach name" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveTeam} disabled={savingTeam || !teamForm.name.trim()}>
                  {savingTeam ? <span className="spinner" /> : teamEditId ? 'Update Team' : 'Create Team'}
                </button>
                <button className="btn btn-ghost" onClick={() => setShowTeamModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── VIEW: Roster for a selected team ──
  if (view === 'roster') {
    if (!selectedTeam) {
      return (
        <div>
          <button className="btn btn-ghost" style={{ marginBottom: 20, padding: '7px 14px', fontSize: 13 }} onClick={() => setView('teams')}>← Back to Teams</button>
          <div className="card empty-state"><p>Team not found.</p></div>
        </div>
      )
    }
    const players = selectedTeam.players || []
    return (
      <div>
        <button className="btn btn-ghost" style={{ marginBottom: 20, padding: '7px 14px', fontSize: 13 }} onClick={() => { setView('teams'); setSelectedTeamId(null) }}>← Back to {category}</button>

        <div className="card" style={{ padding: '24px 26px', marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
            <div>
              <div className="tag-line" style={{ marginBottom: 6 }}>{category}</div>
              <h1 style={{ fontSize: 32, color: 'var(--gold)' }}>{selectedTeam.name}</h1>
              {selectedTeam.code && <span className="badge badge-gray" style={{ marginTop: 8, display: 'inline-block' }}>{selectedTeam.code}</span>}
            </div>
            <button className="btn btn-ghost" style={{ padding: '7px 14px', fontSize: 13 }} onClick={() => openEditTeam(selectedTeam)}>Edit Team Info</button>
          </div>
          <div style={{ display: 'flex', gap: 28, fontSize: 13, color: 'var(--gray-600)', marginTop: 16, flexWrap: 'wrap' }}>
            <span>🧑‍💼 <strong style={{ color: '#fff' }}>Manager:</strong> {selectedTeam.manager || '—'}</span>
            <span>🎽 <strong style={{ color: '#fff' }}>Head Coach:</strong> {selectedTeam.headCoach || '—'}</span>
            <span>🎽 <strong style={{ color: '#fff' }}>Assistant Coach:</strong> {selectedTeam.assistantCoach || '—'}</span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 20, color: 'var(--white)' }}>Player Roster ({players.length})</h2>
          <button className="btn btn-primary" onClick={openAddPlayer}>+ Add Player</button>
        </div>

        {players.length === 0 ? (
          <div className="card empty-state">
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏐</div>
            <p>No players added yet.</p>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={openAddPlayer}>+ Add First Player</button>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table>
              <thead><tr><th>#</th><th>Jersey No.</th><th>Player Name</th><th>Position</th><th>Actions</th></tr></thead>
              <tbody>
                {players.map((p, i) => (
                  <tr key={p.id}>
                    <td>{i + 1}</td>
                    <td>{p.jerseyNumber || '—'}</td>
                    <td>{p.name}</td>
                    <td>{p.position || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => openEditPlayer(p)}>Edit</button>
                        <button className="btn btn-danger" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => removePlayer(p.id)}>Remove</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showTeamModal && (
          <div className="modal-overlay" onClick={() => setShowTeamModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <h2>EDIT TEAM</h2>
              <div className="form-group">
                <label>Team Name *</label>
                <input value={teamForm.name} onChange={e => setTeamForm({ ...teamForm, name: e.target.value })} autoFocus />
              </div>
              <div className="form-group">
                <label>Team Code (optional)</label>
                <input value={teamForm.code} onChange={e => setTeamForm({ ...teamForm, code: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Manager</label>
                <input value={teamForm.manager} onChange={e => setTeamForm({ ...teamForm, manager: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label>Head Coach</label>
                  <input value={teamForm.headCoach} onChange={e => setTeamForm({ ...teamForm, headCoach: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Assistant Coach</label>
                  <input value={teamForm.assistantCoach} onChange={e => setTeamForm({ ...teamForm, assistantCoach: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveTeam} disabled={savingTeam || !teamForm.name.trim()}>
                  {savingTeam ? <span className="spinner" /> : 'Update Team'}
                </button>
                <button className="btn btn-ghost" onClick={() => setShowTeamModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {showPlayerModal && (
          <div className="modal-overlay" onClick={() => setShowPlayerModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <h2>{playerEditId ? 'EDIT PLAYER' : 'ADD PLAYER'}</h2>
              <div className="form-group">
                <label>Player Name *</label>
                <input value={playerForm.name} onChange={e => setPlayerForm({ ...playerForm, name: e.target.value })} placeholder="Full name" autoFocus />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label>Position</label>
                  <input list="position-suggestions" value={playerForm.position} onChange={e => setPlayerForm({ ...playerForm, position: e.target.value })} placeholder="e.g. Tekong" />
                  <datalist id="position-suggestions">
                    {POSITION_SUGGESTIONS.map(p => <option key={p} value={p} />)}
                  </datalist>
                </div>
                <div className="form-group">
                  <label>Jersey Number</label>
                  <input value={playerForm.jerseyNumber} onChange={e => setPlayerForm({ ...playerForm, jerseyNumber: e.target.value })} placeholder="e.g. 7" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={savePlayer} disabled={savingPlayer || !playerForm.name.trim()}>
                  {savingPlayer ? <span className="spinner" /> : playerEditId ? 'Update Player' : 'Add Player'}
                </button>
                <button className="btn btn-ghost" onClick={() => setShowPlayerModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return null
}
