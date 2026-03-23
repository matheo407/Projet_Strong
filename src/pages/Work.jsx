import { useState, useEffect, useRef } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Plus, ChevronLeft, Check, X, Clock, Play, Pause, Square, Laptop, TrendingUp } from 'lucide-react'
import { getAll, put, remove, genId, get } from '../lib/db'
import { useParams } from 'react-router-dom'

// ─── Session list ─────────────────────────────────────────────────────────────

function WorkHome() {
  const [sessions, setSessions] = useState([])
  const navigate = useNavigate()

  useEffect(() => { loadSessions() }, [])

  async function loadSessions() {
    const all = await getAll('workSessions')
    setSessions(all.sort((a, b) => b.date.localeCompare(a.date)))
  }

  async function deleteSession(id, e) {
    e.stopPropagation()
    await remove('workSessions', id)
    setSessions(prev => prev.filter(s => s.id !== id))
  }

  async function startSession() {
    const id = genId()
    const session = {
      id,
      date: format(new Date(), 'yyyy-MM-dd'),
      startedAt: Date.now(),
      finishedAt: null,
      tasks: [],
      platform: 'TryHackMe',
      notes: '',
      elapsedSeconds: 0,
    }
    await put('workSessions', session)
    navigate(`/work/session/${id}`)
  }

  const totalTasks = sessions.reduce((acc, s) => acc + s.tasks.filter(t => t.done).length, 0)
  const totalTime = sessions.reduce((acc, s) => acc + (s.elapsedSeconds || 0), 0)

  return (
    <div className="flex flex-col min-h-screen bg-slate-950">
      <div className="safe-top px-4 pt-4 pb-3 border-b border-slate-800">
        <h1 className="text-xl font-bold text-white">Travail</h1>
        <p className="text-xs text-slate-400 mt-0.5">TryHackMe & cybersécurité</p>
      </div>

      {/* Stats summary */}
      <div className="px-4 py-4 border-b border-slate-800 grid grid-cols-3 gap-3">
        <div className="bg-slate-800 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-primary-400">{sessions.length}</p>
          <p className="text-xs text-slate-500">Séances</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-green-400">{totalTasks}</p>
          <p className="text-xs text-slate-500">Tâches</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-purple-400">{Math.round(totalTime / 3600)}h</p>
          <p className="text-xs text-slate-500">Total</p>
        </div>
      </div>

      {/* Start */}
      <div className="px-4 py-4 border-b border-slate-800">
        <button
          onClick={startSession}
          className="w-full bg-purple-600 text-white font-semibold py-4 rounded-xl flex items-center justify-center gap-2 active:bg-purple-700"
        >
          <Play size={20} /> Nouvelle séance
        </button>
      </div>

      {/* History */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Historique</p>
        {sessions.length === 0 && (
          <div className="flex flex-col items-center py-12 text-slate-600">
            <Laptop size={36} strokeWidth={1} className="mb-2" />
            <p className="text-sm">Aucune séance de travail</p>
          </div>
        )}
        <div className="space-y-2">
          {sessions.map(s => {
            const done = s.tasks.filter(t => t.done).length
            const total = s.tasks.length
            const mins = Math.round((s.elapsedSeconds || 0) / 60)
            return (
              <div key={s.id} className="bg-slate-800 rounded-xl flex items-center overflow-hidden">
                <button
                  onClick={() => navigate(`/work/session/${s.id}`)}
                  className="flex-1 px-4 py-3 text-left flex items-center gap-3 active:bg-slate-700"
                >
                  <div className="w-2.5 h-2.5 rounded-full bg-purple-500 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">
                      {format(new Date(s.date), 'EEEE d MMMM', { locale: fr })}
                    </p>
                    <p className="text-xs text-slate-400">
                      {done}/{total} tâches · {mins} min
                    </p>
                  </div>
                  {!s.finishedAt && (
                    <span className="text-xs text-primary-400 font-medium">En cours</span>
                  )}
                </button>
                {s.finishedAt && (
                  <button onClick={e => deleteSession(s.id, e)} className="px-3 py-3 text-slate-600 active:text-red-400">
                    <X size={16} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Active work session ───────────────────────────────────────────────────────

function WorkSession({ sessionId }) {
  const [session, setSession] = useState(null)
  const [showAddTask, setShowAddTask] = useState(false)
  const [newTask, setNewTask] = useState('')
  const [running, setRunning] = useState(false)
  const intervalRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    loadSession()
  }, [sessionId])

  useEffect(() => {
    if (session && !session.finishedAt) {
      setRunning(true)
    }
  }, [session?.id])

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSession(s => {
          if (!s) return s
          const updated = { ...s, elapsedSeconds: (s.elapsedSeconds || 0) + 1 }
          put('workSessions', updated)
          return updated
        })
      }, 1000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [running])

  async function loadSession() {
    const s = await get('workSessions', sessionId)
    if (s) setSession(s)
  }

  async function saveSession(updated) {
    await put('workSessions', updated)
    setSession(updated)
  }

  function addTask() {
    if (!newTask.trim()) return
    const updated = {
      ...session,
      tasks: [...session.tasks, { id: genId(), label: newTask.trim(), done: false }]
    }
    saveSession(updated)
    setNewTask('')
    setShowAddTask(false)
  }

  function toggleTask(taskId) {
    const updated = {
      ...session,
      tasks: session.tasks.map(t => t.id === taskId ? { ...t, done: !t.done } : t)
    }
    saveSession(updated)
  }

  function removeTask(taskId) {
    const updated = {
      ...session,
      tasks: session.tasks.filter(t => t.id !== taskId)
    }
    saveSession(updated)
  }

  async function finishSession() {
    setRunning(false)
    const updated = { ...session, finishedAt: Date.now() }
    await saveSession(updated)
    navigate('/work')
  }

  function formatTime(secs) {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  if (!session) return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-slate-400">Chargement...</div>
    </div>
  )

  const done = session.tasks.filter(t => t.done).length
  const total = session.tasks.length
  const progress = total > 0 ? done / total : 0

  return (
    <div className="flex flex-col min-h-screen bg-slate-950">
      {/* Header */}
      <div className="safe-top px-4 pt-4 pb-3 border-b border-slate-800 bg-slate-950">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/work')} className="text-slate-400 active:text-white">
            <ChevronLeft size={24} />
          </button>
          <div className="flex-1">
            <h2 className="font-bold text-white">
              Séance — {format(new Date(session.date), 'd MMM', { locale: fr })}
            </h2>
            <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
              <Clock size={11} />
              {formatTime(session.elapsedSeconds || 0)}
              {!session.finishedAt && running && <span className="text-primary-400 ml-1">● Live</span>}
            </p>
          </div>
          {!session.finishedAt && (
            <button
              onClick={() => setRunning(r => !r)}
              className="bg-slate-800 p-2 rounded-lg text-slate-300 active:bg-slate-700"
            >
              {running ? <Pause size={18} /> : <Play size={18} />}
            </button>
          )}
        </div>

        {/* Progress bar */}
        {total > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>{done}/{total} tâches complétées</span>
              <span>{Math.round(progress * 100)}%</span>
            </div>
            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 rounded-full transition-all duration-300"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Tasks */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {session.tasks.map(task => (
          <div
            key={task.id}
            className={`flex items-center gap-3 rounded-xl px-3 py-3 transition-colors ${
              task.done ? 'bg-slate-800/50' : 'bg-slate-800'
            }`}
          >
            <button
              onClick={() => !session.finishedAt && toggleTask(task.id)}
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                task.done ? 'bg-purple-600 border-purple-600' : 'border-slate-600'
              }`}
            >
              {task.done && <Check size={13} className="text-white" />}
            </button>
            <span className={`flex-1 text-sm ${task.done ? 'line-through text-slate-500' : 'text-white'}`}>
              {task.label}
            </span>
            {!session.finishedAt && (
              <button onClick={() => removeTask(task.id)} className="p-1 text-slate-600 active:text-red-400">
                <X size={14} />
              </button>
            )}
          </div>
        ))}

        {!session.finishedAt && (
          <button
            onClick={() => setShowAddTask(true)}
            className="w-full border-2 border-dashed border-slate-700 rounded-xl py-3.5 text-slate-500 flex items-center justify-center gap-2 active:border-purple-600 active:text-purple-400 text-sm"
          >
            <Plus size={16} /> Ajouter une tâche
          </button>
        )}

        {session.tasks.length === 0 && !showAddTask && (
          <div className="flex flex-col items-center py-8 text-slate-600">
            <p className="text-sm">Ajoute tes tâches pour cette séance</p>
          </div>
        )}
      </div>

      {/* Footer */}
      {!session.finishedAt && (
        <div className="px-4 pt-3 pb-24 border-t border-slate-800 bg-slate-950">
          <button
            onClick={finishSession}
            className="w-full bg-green-600 text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 active:bg-green-700"
          >
            <Square size={18} /> Terminer la séance
          </button>
        </div>
      )}

      {/* Add task modal */}
      {showAddTask && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-end">
          <div className="w-full bg-slate-900 rounded-t-2xl p-5 pb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Nouvelle tâche</h3>
              <button onClick={() => setShowAddTask(false)} className="text-slate-400"><X size={22} /></button>
            </div>
            <input
              autoFocus
              type="text"
              value={newTask}
              onChange={e => setNewTask(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTask()}
              placeholder="ex: Finir le room Linux Fundamentals..."
              className="w-full bg-slate-800 rounded-xl px-3 py-3 text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-purple-500 mb-4"
            />
            <button
              onClick={addTask}
              className="w-full bg-purple-600 text-white font-semibold py-3 rounded-xl active:bg-purple-700"
            >
              Ajouter
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Work() {
  return (
    <Routes>
      <Route path="/" element={<WorkHome />} />
      <Route path="/session/:id" element={<WorkSessionWrapper />} />
    </Routes>
  )
}

function WorkSessionWrapper() {
  const { id } = useParams()
  return <WorkSession sessionId={id} />
}
