import { useState, useEffect, useRef } from 'react'
import { Routes, Route, useNavigate, useParams } from 'react-router-dom'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Plus, ChevronLeft, Play, Pause, RotateCcw, Check, X,
  ChevronDown, ChevronUp, Dumbbell, Clock, TrendingUp,
  BookmarkPlus, Trash2, Search, Star, Pencil, RotateCw
} from 'lucide-react'
import { getAll, put, remove, genId, get } from '../lib/db'
import { EXERCISES, ALL_EXERCISES, TYPE_LABELS, TYPE_COLORS } from '../data/exercises'

// ─── Exercise picker modal ────────────────────────────────────────────────────

function ExercisePicker({ sessionType, onSelect, onClose }) {
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState(sessionType)

  const filtered = ALL_EXERCISES.filter(e => {
    const matchTab = tab === 'all' || e.type === tab
    const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase())
    return matchTab && matchSearch
  })

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-end">
      <div className="w-full bg-slate-900 rounded-t-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-slate-800 flex-shrink-0">
          <h3 className="font-semibold text-white">Choisir un exercice</h3>
          <button onClick={onClose} className="p-1 text-slate-400"><X size={22} /></button>
        </div>

        {/* Search */}
        <div className="px-4 py-2 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-2 bg-slate-800 rounded-xl px-3 py-2">
            <Search size={15} className="text-slate-500" />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="flex-1 bg-transparent text-white text-sm outline-none placeholder-slate-500"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-4 py-2 gap-2 border-b border-slate-800 flex-shrink-0 overflow-x-auto no-scrollbar">
          {[['all', 'Tous'], ['push', 'Push'], ['pull', 'Pull'], ['legs', 'Legs']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-3 py-1 rounded-full text-xs font-medium flex-shrink-0 transition-colors ${
                tab === key ? 'bg-primary-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Exercise list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.map(ex => (
            <button
              key={ex.name}
              onClick={() => onSelect(ex.name)}
              className="w-full px-4 py-3 text-left flex items-center gap-3 active:bg-slate-800 border-b border-slate-800/50"
            >
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${TYPE_COLORS[ex.type]}`}>
                {TYPE_LABELS[ex.type]}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{ex.name}</p>
                <p className="text-xs text-slate-500 truncate">{ex.muscles}</p>
              </div>
            </button>
          ))}
          {/* Custom name option */}
          {search.trim() && !filtered.find(e => e.name.toLowerCase() === search.toLowerCase()) && (
            <button
              onClick={() => onSelect(search.trim())}
              className="w-full px-4 py-3 text-left flex items-center gap-3 active:bg-slate-800"
            >
              <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 bg-slate-700 text-slate-300">Custom</span>
              <p className="text-sm text-primary-400">Ajouter « {search.trim()} »</p>
            </button>
          )}
          {filtered.length === 0 && !search && (
            <p className="text-center text-slate-600 py-8 text-sm">Aucun exercice</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Template picker modal ────────────────────────────────────────────────────

function TemplatePicker({ sessionType, onSelect, onClose }) {
  const [templates, setTemplates] = useState([])

  useEffect(() => {
    getAll('workoutTemplates').then(all =>
      setTemplates(all.filter(t => t.type === sessionType))
    )
  }, [sessionType])

  if (templates.length === 0) return null

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-end">
      <div className="w-full bg-slate-900 rounded-t-2xl max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-slate-800 flex-shrink-0">
          <h3 className="font-semibold text-white">Charger un modèle</h3>
          <button onClick={onClose}><X size={22} className="text-slate-400" /></button>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {templates.map(t => (
            <button
              key={t.id}
              onClick={() => onSelect(t)}
              className="w-full px-4 py-3 text-left flex items-center gap-3 active:bg-slate-800 border-b border-slate-800/50"
            >
              <Star size={15} className="text-yellow-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{t.name}</p>
                <p className="text-xs text-slate-500">{t.exercises.length} exercice{t.exercises.length > 1 ? 's' : ''}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Workout home ─────────────────────────────────────────────────────────────

function WorkoutHome() {
  const [sessions, setSessions] = useState([])
  const [templates, setTemplates] = useState([])
  const [showTemplatePicker, setShowTemplatePicker] = useState(null) // sessionType
  const navigate = useNavigate()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [s, t] = await Promise.all([getAll('workoutSessions'), getAll('workoutTemplates')])
    setSessions(s.sort((a, b) => b.date.localeCompare(a.date)))
    setTemplates(t)
  }

  async function startSession(type, template = null) {
    const id = genId()
    const exercises = template
      ? template.exercises.map(ex => ({
          id: genId(),
          name: ex.name,
          sets: Array.from({ length: ex.sets }, () => ({ id: genId(), reps: ex.reps || 10, weight: ex.weight || 0 }))
        }))
      : []
    const session = {
      id, type,
      date: format(new Date(), 'yyyy-MM-dd'),
      startedAt: Date.now(),
      finishedAt: null,
      exercises,
    }
    await put('workoutSessions', session)
    navigate(`/workout/session/${id}`)
  }

  async function deleteSession(id, e) {
    e.stopPropagation()
    await remove('workoutSessions', id)
    setSessions(prev => prev.filter(s => s.id !== id))
  }

  async function deleteTemplate(id, e) {
    e.stopPropagation()
    await remove('workoutTemplates', id)
    setTemplates(prev => prev.filter(t => t.id !== id))
  }

  const typeButtonColors = {
    push: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
    pull: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    legs: 'bg-green-500/20 text-green-400 border border-green-500/30',
  }
  const typeBadgeColors = {
    push: 'bg-orange-500/20 text-orange-400',
    pull: 'bg-blue-500/20 text-blue-400',
    legs: 'bg-green-500/20 text-green-400',
  }

  function hasTemplates(type) {
    return templates.some(t => t.type === type)
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-950">
      <div className="safe-top px-4 pt-4 pb-3 border-b border-slate-800">
        <h1 className="text-xl font-bold text-white">Sport</h1>
      </div>

      {/* Start session */}
      <div className="px-4 py-4 border-b border-slate-800">
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Nouvelle séance</p>
        <div className="grid grid-cols-3 gap-3">
          {['push', 'pull', 'legs'].map(type => (
            <div key={type} className="flex flex-col gap-1.5">
              <button
                onClick={() => {
                  if (hasTemplates(type)) setShowTemplatePicker(type)
                  else startSession(type)
                }}
                className={`py-4 rounded-xl font-bold text-lg transition-opacity active:opacity-70 ${typeButtonColors[type]}`}
              >
                {TYPE_LABELS[type]}
              </button>
              {hasTemplates(type) && (
                <button
                  onClick={() => startSession(type)}
                  className="text-xs text-slate-600 active:text-slate-400 py-0.5"
                >
                  Sans modèle
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Templates */}
      {templates.length > 0 && (
        <div className="px-4 py-4 border-b border-slate-800">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Modèles enregistrés</p>
          <div className="space-y-2">
            {templates.map(t => (
              <div key={t.id} className="bg-slate-800 rounded-xl flex items-center overflow-hidden">
                <button
                  onClick={() => startSession(t.type, t)}
                  className="flex-1 px-4 py-3 text-left flex items-center gap-3 active:bg-slate-700"
                >
                  <Star size={14} className="text-yellow-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{t.name}</p>
                    <p className="text-xs text-slate-500">
                      <span className={`font-medium ${TYPE_COLORS[t.type]?.split(' ')[0]}`}>{TYPE_LABELS[t.type]}</span>
                      {' · '}{t.exercises.length} exercice{t.exercises.length > 1 ? 's' : ''}
                    </p>
                  </div>
                </button>
                <button onClick={e => deleteTemplate(t.id, e)} className="px-3 py-3 text-slate-600 active:text-red-400">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Historique</p>
        {sessions.length === 0 && (
          <div className="flex flex-col items-center py-12 text-slate-600">
            <Dumbbell size={36} strokeWidth={1} className="mb-2" />
            <p className="text-sm">Aucune séance pour l'instant</p>
          </div>
        )}
        <div className="space-y-2">
          {sessions.map(s => (
            <div key={s.id} className="bg-slate-800 rounded-xl flex items-center overflow-hidden">
              <button
                onClick={() => navigate(`/workout/session/${s.id}`)}
                className="flex-1 px-4 py-3 text-left flex items-center gap-3 active:bg-slate-700"
              >
                <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${typeBadgeColors[s.type]}`}>
                  {TYPE_LABELS[s.type]}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">
                    {format(new Date(s.date), 'EEEE d MMMM', { locale: fr })}
                  </p>
                  <p className="text-xs text-slate-400">
                    {s.exercises.length} exercice{s.exercises.length > 1 ? 's' : ''}
                    {s.finishedAt && ` · ${Math.round((s.finishedAt - s.startedAt) / 60000)} min`}
                  </p>
                </div>
                {!s.finishedAt && <span className="text-xs text-primary-400 font-medium">En cours</span>}
              </button>
              {s.finishedAt && (
                <button onClick={e => deleteSession(s.id, e)} className="px-3 py-3 text-slate-600 active:text-red-400">
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Template picker */}
      {showTemplatePicker && (
        <TemplatePicker
          sessionType={showTemplatePicker}
          onSelect={t => { setShowTemplatePicker(null); startSession(t.type, t) }}
          onClose={() => setShowTemplatePicker(null)}
        />
      )}
    </div>
  )
}

// ─── Rest Timer (controlled) ──────────────────────────────────────────────────

function RestTimer({ selected, remaining, running, onSetSelected, onStart, onTogglePause, onReset, onClose }) {
  const PRESETS = [60, 90, 120, 180]
  const progress = remaining !== null ? remaining / selected : 1
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const finished = remaining === 0

  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-6">
      <div className="bg-slate-900 rounded-2xl p-6 w-full max-w-sm">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-lg font-semibold">Repos</h3>
          <button onClick={onClose} className="text-slate-400"><X size={22} /></button>
        </div>
        <div className="flex justify-center mb-5">
          <div className="relative w-32 h-32 flex items-center justify-center">
            <svg className="absolute inset-0 -rotate-90" width="128" height="128">
              <circle cx="64" cy="64" r={radius} fill="none" stroke="#1e293b" strokeWidth="8" />
              <circle cx="64" cy="64" r={radius} fill="none"
                stroke={finished ? '#22c55e' : '#0ea5e9'} strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - progress)}
                strokeLinecap="round" className="transition-all duration-1000" />
            </svg>
            <span className={`text-3xl font-mono font-bold z-10 ${finished ? 'text-green-400' : 'text-white'}`}>
              {remaining !== null
                ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`
                : `${Math.floor(selected / 60)}:${String(selected % 60).padStart(2, '0')}`}
            </span>
          </div>
        </div>
        <div className="flex gap-2 justify-center mb-5">
          {PRESETS.map(p => (
            <button key={p} onClick={() => { onSetSelected(p); onReset() }}
              className={`px-3 py-1.5 rounded-full text-sm font-medium ${selected === p ? 'bg-primary-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
              {p < 60 ? `${p}s` : `${p / 60}min`}
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          {remaining === null ? (
            <button onClick={onStart} className="flex-1 bg-primary-600 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 active:bg-primary-700">
              <Play size={18} /> Démarrer
            </button>
          ) : (
            <>
              <button onClick={onTogglePause} className="flex-1 bg-primary-600 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 active:bg-primary-700">
                {running ? <Pause size={18} /> : <Play size={18} />}
                {running ? 'Pause' : 'Reprendre'}
              </button>
              <button onClick={onReset} className="bg-slate-700 px-4 py-3 rounded-xl active:bg-slate-600">
                <RotateCcw size={18} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Save as template modal ───────────────────────────────────────────────────

function SaveTemplateModal({ session, onSave, onClose }) {
  const [name, setName] = useState(`${TYPE_LABELS[session.type]} — modèle`)

  async function save() {
    if (!name.trim()) return
    const template = {
      id: genId(),
      name: name.trim(),
      type: session.type,
      exercises: session.exercises.map(ex => ({
        name: ex.name,
        sets: ex.sets.length,
        reps: ex.sets[0]?.reps || 10,
        weight: ex.sets[0]?.weight || 0,
      }))
    }
    await put('workoutTemplates', template)
    onSave()
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-end">
      <div className="w-full bg-slate-900 rounded-t-2xl p-5 pb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Enregistrer comme modèle</h3>
          <button onClick={onClose}><X size={22} className="text-slate-400" /></button>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          {session.exercises.length} exercice{session.exercises.length > 1 ? 's' : ''} · {session.exercises.reduce((a, e) => a + e.sets.length, 0)} séries au total
        </p>
        <input
          autoFocus
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && save()}
          className="w-full bg-slate-800 rounded-xl px-3 py-3 text-white outline-none focus:ring-2 focus:ring-primary-500 mb-4"
        />
        <button onClick={save} className="w-full bg-yellow-600 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 active:bg-yellow-700">
          <Star size={18} /> Sauvegarder le modèle
        </button>
      </div>
    </div>
  )
}

// ─── Exercise card ────────────────────────────────────────────────────────────

function ExerciseCard({ exercise, previousExercise, onAddSet, onUpdateSet, onRemoveSet, onRemoveExercise, readOnly }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="bg-slate-800 rounded-2xl overflow-hidden">
      <div className="flex items-center px-4 py-3 gap-2">
        <button onClick={() => setCollapsed(c => !c)} className="flex-1 flex items-center gap-2 text-left">
          <span className="font-semibold text-white text-sm">{exercise.name}</span>
          <span className="text-xs text-slate-500">{exercise.sets.length} série{exercise.sets.length > 1 ? 's' : ''}</span>
          {collapsed ? <ChevronDown size={15} className="text-slate-500 ml-auto" /> : <ChevronUp size={15} className="text-slate-500 ml-auto" />}
        </button>
        {!readOnly && (
          <button onClick={onRemoveExercise} className="p-1 text-slate-600 active:text-red-400">
            <X size={15} />
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="px-4 pb-3">
          {previousExercise && previousExercise.sets.length > 0 && (
            <div className="mb-3 bg-slate-700/50 rounded-lg px-3 py-2">
              <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><TrendingUp size={11} /> Dernière fois</p>
              <div className="flex flex-wrap gap-2">
                {previousExercise.sets.map((s, i) => (
                  <span key={i} className="text-xs text-slate-300 bg-slate-700 px-2 py-0.5 rounded">
                    {s.weight > 0 ? `${s.weight}kg × ` : ''}{s.reps} reps
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2 mb-3">
            <div className="grid grid-cols-12 gap-2 text-xs text-slate-500 px-1 mb-1">
              <span className="col-span-1">#</span>
              <span className="col-span-4 text-center">Poids</span>
              <span className="col-span-4 text-center">Reps</span>
              <span className="col-span-3" />
            </div>
            {exercise.sets.map((set, i) => (
              <div key={set.id} className="grid grid-cols-12 gap-2 items-center">
                <span className="col-span-1 text-sm text-slate-500 font-medium">{i + 1}</span>
                <div className="col-span-4">
                  <input type="number" inputMode="decimal" value={set.weight}
                    onChange={e => onUpdateSet(set.id, 'weight', parseFloat(e.target.value) || 0)}
                    disabled={readOnly}
                    className="w-full bg-slate-700 rounded-lg px-2 py-2 text-white text-sm text-center outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-60" />
                </div>
                <div className="col-span-4">
                  <input type="number" inputMode="numeric" value={set.reps}
                    onChange={e => onUpdateSet(set.id, 'reps', parseInt(e.target.value) || 0)}
                    disabled={readOnly}
                    className="w-full bg-slate-700 rounded-lg px-2 py-2 text-white text-sm text-center outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-60" />
                </div>
                <div className="col-span-3 flex justify-end">
                  {!readOnly && (
                    <button onClick={() => onRemoveSet(set.id)} className="p-1 text-slate-600 active:text-red-400">
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {!readOnly && (
            <button onClick={onAddSet}
              className="w-full bg-slate-700 rounded-lg py-2 text-sm text-slate-400 flex items-center justify-center gap-1.5 active:bg-slate-600">
              <Plus size={15} /> Ajouter une série
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Active session ───────────────────────────────────────────────────────────

function WorkoutSession({ sessionId }) {
  const [session, setSession] = useState(null)
  const [showTimer, setShowTimer] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [previousSession, setPreviousSession] = useState(null)
  const [templateSaved, setTemplateSaved] = useState(false)
  const [editMode, setEditMode] = useState(false)
  // Timer state lifted up so it persists when modal is closed
  const [timerSelected, setTimerSelected] = useState(90)
  const [timerRemaining, setTimerRemaining] = useState(null)
  const [timerRunning, setTimerRunning] = useState(false)
  const timerRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (timerRunning && timerRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimerRemaining(r => {
          if (r <= 1) {
            clearInterval(timerRef.current)
            setTimerRunning(false)
            if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 300])
            return 0
          }
          return r - 1
        })
      }, 1000)
    }
    return () => clearInterval(timerRef.current)
  }, [timerRunning])

  function timerStart() { setTimerRemaining(timerSelected); setTimerRunning(true) }
  function timerTogglePause() { setTimerRunning(r => !r) }
  function timerReset() { clearInterval(timerRef.current); setTimerRunning(false); setTimerRemaining(null) }

  useEffect(() => { loadSession() }, [sessionId])

  async function loadSession() {
    const s = await get('workoutSessions', sessionId)
    if (s) {
      setSession(s)
      const all = await getAll('workoutSessions')
      const prev = all.filter(x => x.type === s.type && x.id !== s.id && x.finishedAt)
                      .sort((a, b) => b.date.localeCompare(a.date))[0]
      setPreviousSession(prev || null)
    }
  }

  async function saveSession(updated) {
    await put('workoutSessions', updated)
    setSession(updated)
  }

  function addExercise(name) {
    const updated = {
      ...session,
      exercises: [...session.exercises, { id: genId(), name, sets: [] }]
    }
    saveSession(updated)
    setShowPicker(false)
  }

  function removeExercise(exId) {
    saveSession({ ...session, exercises: session.exercises.filter(e => e.id !== exId) })
  }

  function addSet(exId) {
    const updated = {
      ...session,
      exercises: session.exercises.map(ex => {
        if (ex.id !== exId) return ex
        const last = ex.sets[ex.sets.length - 1]
        return { ...ex, sets: [...ex.sets, { id: genId(), reps: last?.reps || 10, weight: last?.weight || 0 }] }
      })
    }
    saveSession(updated)
  }

  function updateSet(exId, setId, field, value) {
    saveSession({
      ...session,
      exercises: session.exercises.map(ex =>
        ex.id !== exId ? ex : { ...ex, sets: ex.sets.map(s => s.id === setId ? { ...s, [field]: value } : s) }
      )
    })
  }

  function removeSet(exId, setId) {
    saveSession({
      ...session,
      exercises: session.exercises.map(ex =>
        ex.id !== exId ? ex : { ...ex, sets: ex.sets.filter(s => s.id !== setId) }
      )
    })
  }

  async function finishSession() {
    await saveSession({ ...session, finishedAt: Date.now() })
    navigate('/workout')
  }

  async function resumeSession() {
    await saveSession({ ...session, finishedAt: null })
    setEditMode(false)
  }

  function getPreviousExercise(name) {
    if (!previousSession) return null
    return previousSession.exercises.find(e => e.name.toLowerCase() === name.toLowerCase())
  }

  const typeColors = { push: 'text-orange-400', pull: 'text-blue-400', legs: 'text-green-400' }
  const duration = session
    ? session.finishedAt
      ? Math.round((session.finishedAt - session.startedAt) / 60000)
      : Math.round((Date.now() - session.startedAt) / 60000)
    : 0

  if (!session) return <div className="flex items-center justify-center h-screen text-slate-400">Chargement...</div>

  return (
    <div className="flex flex-col min-h-screen bg-slate-950">
      {/* Header */}
      <div className="safe-top px-4 pt-4 pb-3 border-b border-slate-800 bg-slate-950">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/workout')} className="text-slate-400 active:text-white">
            <ChevronLeft size={24} />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className={`text-lg font-bold ${typeColors[session.type]}`}>{TYPE_LABELS[session.type]}</span>
              <span className="text-slate-400 text-sm">·</span>
              <span className="text-sm text-slate-400">{format(new Date(session.date), 'd MMM', { locale: fr })}</span>
              {!session.finishedAt && (
                <span className="text-xs text-primary-400 flex items-center gap-1 ml-1">
                  <Clock size={12} /> {duration} min
                </span>
              )}
            </div>
            {previousSession && (
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <TrendingUp size={11} />
                Dernière : {format(new Date(previousSession.date), 'd MMM', { locale: fr })}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {session.finishedAt && !editMode && (
              <>
                <button
                  onClick={() => setEditMode(true)}
                  className="bg-slate-800 p-2 rounded-lg text-slate-300 active:bg-slate-700"
                  title="Modifier"
                >
                  <Pencil size={18} />
                </button>
                <button
                  onClick={resumeSession}
                  className="bg-slate-800 p-2 rounded-lg text-primary-400 active:bg-slate-700"
                  title="Reprendre"
                >
                  <RotateCw size={18} />
                </button>
              </>
            )}
            {editMode && (
              <button
                onClick={() => setEditMode(false)}
                className="bg-primary-600 px-3 py-1.5 rounded-lg text-white text-xs font-semibold active:bg-primary-700"
              >
                Terminer
              </button>
            )}
            {!session.finishedAt && (
              <button onClick={() => setShowTimer(true)} className="bg-slate-800 p-2 rounded-lg text-slate-300 active:bg-slate-700">
                <Clock size={20} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Exercises */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {session.exercises.map(ex => (
          <ExerciseCard
            key={ex.id}
            exercise={ex}
            previousExercise={getPreviousExercise(ex.name)}
            onAddSet={() => addSet(ex.id)}
            onUpdateSet={(setId, field, val) => updateSet(ex.id, setId, field, val)}
            onRemoveSet={setId => removeSet(ex.id, setId)}
            onRemoveExercise={() => removeExercise(ex.id)}
            readOnly={!!session.finishedAt && !editMode}
          />
        ))}

        {(!session.finishedAt || editMode) && (
          <button
            onClick={() => setShowPicker(true)}
            className="w-full border-2 border-dashed border-slate-700 rounded-xl py-4 text-slate-500 flex items-center justify-center gap-2 active:border-primary-600 active:text-primary-400"
          >
            <Plus size={18} /> Ajouter un exercice
          </button>
        )}
      </div>

      {/* Footer — active session */}
      {!session.finishedAt && (
        <div className="px-4 pt-3 pb-24 border-t border-slate-800 bg-slate-950 space-y-2">
          {session.exercises.length > 0 && !templateSaved && (
            <button
              onClick={() => setShowSaveTemplate(true)}
              className="w-full border border-slate-700 text-slate-400 font-medium py-2.5 rounded-xl flex items-center justify-center gap-2 active:bg-slate-800 text-sm"
            >
              <BookmarkPlus size={16} /> Enregistrer comme modèle
            </button>
          )}
          {templateSaved && (
            <p className="text-center text-xs text-yellow-400 flex items-center justify-center gap-1">
              <Star size={12} /> Modèle sauvegardé
            </p>
          )}
          <button
            onClick={finishSession}
            className="w-full bg-green-600 text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 active:bg-green-700"
          >
            <Check size={20} /> Terminer la séance
          </button>
        </div>
      )}

      {/* Footer — edit mode on finished session */}
      {session.finishedAt && editMode && (
        <div className="px-4 pt-3 pb-24 border-t border-slate-800 bg-slate-950 space-y-2">
          <button
            onClick={resumeSession}
            className="w-full border border-primary-600 text-primary-400 font-medium py-2.5 rounded-xl flex items-center justify-center gap-2 active:bg-slate-800 text-sm"
          >
            <RotateCw size={16} /> Reprendre la séance (rouvrir)
          </button>
          <button
            onClick={() => setEditMode(false)}
            className="w-full bg-slate-700 text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 active:bg-slate-600"
          >
            <Check size={20} /> Sauvegarder les modifications
          </button>
        </div>
      )}

      {/* Floating timer chip — visible while editing sets */}
      {timerRemaining !== null && !showTimer && (
        <button
          onClick={() => setShowTimer(true)}
          className={`fixed top-20 right-4 z-50 rounded-full px-4 py-2 flex items-center gap-2 shadow-lg transition-colors ${
            timerRemaining === 0
              ? 'bg-green-600 active:bg-green-700'
              : timerRunning
              ? 'bg-primary-600 active:bg-primary-700'
              : 'bg-slate-700 active:bg-slate-600'
          }`}
        >
          <Clock size={14} className="text-white" />
          <span className="font-mono font-bold text-sm text-white">
            {timerRemaining === 0
              ? 'Terminé !'
              : `${Math.floor(timerRemaining / 60)}:${String(timerRemaining % 60).padStart(2, '0')}`}
          </span>
        </button>
      )}

      {showTimer && (
        <RestTimer
          selected={timerSelected}
          remaining={timerRemaining}
          running={timerRunning}
          onSetSelected={setTimerSelected}
          onStart={timerStart}
          onTogglePause={timerTogglePause}
          onReset={timerReset}
          onClose={() => setShowTimer(false)}
        />
      )}
      {showPicker && <ExercisePicker sessionType={session.type} onSelect={addExercise} onClose={() => setShowPicker(false)} />}
      {showSaveTemplate && (
        <SaveTemplateModal
          session={session}
          onSave={() => { setShowSaveTemplate(false); setTemplateSaved(true) }}
          onClose={() => setShowSaveTemplate(false)}
        />
      )}
    </div>
  )
}

// ─── Router ───────────────────────────────────────────────────────────────────

function WorkoutSessionWrapper() {
  const { id } = useParams()
  return <WorkoutSession sessionId={id} />
}

export default function Workout() {
  return (
    <Routes>
      <Route path="/" element={<WorkoutHome />} />
      <Route path="/session/:id" element={<WorkoutSessionWrapper />} />
    </Routes>
  )
}
