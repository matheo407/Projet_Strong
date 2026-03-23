import { useState, useEffect } from 'react'
import { format, subDays, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend, CartesianGrid
} from 'recharts'
import { getAll } from '../lib/db'
import { Dumbbell, Laptop, TrendingUp, Clock, CheckSquare, BarChart2 } from 'lucide-react'

const WORKOUT_COLORS = { push: '#f97316', pull: '#3b82f6', legs: '#22c55e' }
const PIE_COLORS = ['#f97316', '#3b82f6', '#22c55e']

export default function Stats() {
  const [workoutSessions, setWorkoutSessions] = useState([])
  const [workSessions, setWorkSessions] = useState([])
  const [tab, setTab] = useState('sport')

  useEffect(() => {
    Promise.all([getAll('workoutSessions'), getAll('workSessions')]).then(([w, ws]) => {
      setWorkoutSessions(w.filter(s => s.finishedAt))
      setWorkSessions(ws.filter(s => s.finishedAt))
    })
  }, [])

  // ─── Sport stats ──────────────────────────────────────────────────────────────
  const totalSessions = workoutSessions.length
  const totalWorkoutTime = workoutSessions.reduce((acc, s) =>
    acc + Math.round((s.finishedAt - s.startedAt) / 60000), 0)

  // Sessions par type
  const typeCounts = { push: 0, pull: 0, legs: 0 }
  workoutSessions.forEach(s => { if (typeCounts[s.type] !== undefined) typeCounts[s.type]++ })
  const pieData = Object.entries(typeCounts).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1), value
  })).filter(d => d.value > 0)

  // Séances par semaine (dernières 8 semaines)
  const weeklyData = []
  for (let i = 7; i >= 0; i--) {
    const weekStart = subDays(new Date(), i * 7 + 6)
    const weekEnd = subDays(new Date(), i * 7)
    const label = format(weekStart, 'd MMM', { locale: fr })
    const push = workoutSessions.filter(s => s.type === 'push' && parseISO(s.date) >= weekStart && parseISO(s.date) <= weekEnd).length
    const pull = workoutSessions.filter(s => s.type === 'pull' && parseISO(s.date) >= weekStart && parseISO(s.date) <= weekEnd).length
    const legs = workoutSessions.filter(s => s.type === 'legs' && parseISO(s.date) >= weekStart && parseISO(s.date) <= weekEnd).length
    weeklyData.push({ label, push, pull, legs })
  }

  // Volume par séance (last 10)
  const volumeData = workoutSessions
    .slice(-10)
    .map(s => {
      const volume = s.exercises.reduce((acc, ex) =>
        acc + ex.sets.reduce((a, set) => a + (set.weight || 0) * (set.reps || 0), 0), 0)
      return {
        label: format(parseISO(s.date), 'd/M'),
        volume,
        type: s.type
      }
    })

  // ─── Work stats ───────────────────────────────────────────────────────────────
  const totalWorkTime = workSessions.reduce((acc, s) => acc + (s.elapsedSeconds || 0), 0)
  const totalTasksDone = workSessions.reduce((acc, s) => acc + s.tasks.filter(t => t.done).length, 0)

  // Work time per day (last 14 days)
  const workDailyData = []
  for (let i = 13; i >= 0; i--) {
    const date = format(subDays(new Date(), i), 'yyyy-MM-dd')
    const dayLabel = format(subDays(new Date(), i), 'd MMM', { locale: fr })
    const mins = workSessions
      .filter(s => s.date === date)
      .reduce((acc, s) => acc + Math.round((s.elapsedSeconds || 0) / 60), 0)
    workDailyData.push({ label: dayLabel, mins })
  }

  // Tasks per session
  const taskData = workSessions.slice(-10).map(s => ({
    label: format(parseISO(s.date), 'd/M'),
    done: s.tasks.filter(t => t.done).length,
    total: s.tasks.length
  }))

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs">
        <p className="text-slate-400 mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }}>{p.name}: {p.value}</p>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-950">
      <div className="safe-top px-4 pt-4 pb-3 border-b border-slate-800">
        <h1 className="text-xl font-bold text-white">Statistiques</h1>
      </div>

      {/* Tab selector */}
      <div className="flex px-4 py-3 gap-3 border-b border-slate-800">
        <button
          onClick={() => setTab('sport')}
          className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-colors ${
            tab === 'sport' ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-400'
          }`}
        >
          Sport
        </button>
        <button
          onClick={() => setTab('work')}
          className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-colors ${
            tab === 'work' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400'
          }`}
        >
          Travail
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {tab === 'sport' ? (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard icon={<Dumbbell size={16} />} value={totalSessions} label="Séances" color="text-orange-400" />
              <StatCard icon={<Clock size={16} />} value={`${Math.round(totalWorkoutTime / 60)}h`} label="Total" color="text-blue-400" />
              <StatCard icon={<TrendingUp size={16} />} value={workoutSessions.filter(s => {
                const d = new Date(); const w = new Date(d - 7*24*3600*1000)
                return parseISO(s.date) >= w
              }).length} label="Cette sem." color="text-green-400" />
            </div>

            {/* Type distribution pie */}
            {pieData.length > 0 && (
              <div className="bg-slate-800 rounded-2xl p-4">
                <h3 className="text-sm font-semibold text-white mb-3">Répartition des séances</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" label={({ name, percent }) => `${name} ${Math.round(percent*100)}%`} labelLine={false}>
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Weekly sessions bar chart */}
            <div className="bg-slate-800 rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Séances par semaine</h3>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={weeklyData} barSize={10}>
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="push" name="Push" fill={WORKOUT_COLORS.push} radius={[3,3,0,0]} />
                  <Bar dataKey="pull" name="Pull" fill={WORKOUT_COLORS.pull} radius={[3,3,0,0]} />
                  <Bar dataKey="legs" name="Legs" fill={WORKOUT_COLORS.legs} radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex gap-3 mt-2 justify-center">
                {['push','pull','legs'].map(t => (
                  <div key={t} className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full" style={{ background: WORKOUT_COLORS[t] }} />
                    <span className="text-xs text-slate-400 capitalize">{t}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Volume line chart */}
            {volumeData.length > 1 && (
              <div className="bg-slate-800 rounded-2xl p-4">
                <h3 className="text-sm font-semibold text-white mb-3">Volume soulevé (kg·reps)</h3>
                <ResponsiveContainer width="100%" height={150}>
                  <LineChart data={volumeData}>
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="volume" name="Volume" stroke="#0ea5e9" strokeWidth={2} dot={{ fill: '#0ea5e9', r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {workoutSessions.length === 0 && (
              <div className="flex flex-col items-center py-12 text-slate-600">
                <BarChart2 size={36} strokeWidth={1} className="mb-2" />
                <p className="text-sm">Complète des séances pour voir les stats</p>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Work KPIs */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard icon={<Laptop size={16} />} value={workSessions.length} label="Séances" color="text-purple-400" />
              <StatCard icon={<Clock size={16} />} value={`${Math.round(totalWorkTime / 3600)}h`} label="Total" color="text-blue-400" />
              <StatCard icon={<CheckSquare size={16} />} value={totalTasksDone} label="Tâches" color="text-green-400" />
            </div>

            {/* Work time per day */}
            <div className="bg-slate-800 rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Temps de travail (min/jour)</h3>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={workDailyData} barSize={12}>
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} interval={2} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="mins" name="Minutes" fill="#a855f7" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Tasks per session */}
            {taskData.length > 0 && (
              <div className="bg-slate-800 rounded-2xl p-4">
                <h3 className="text-sm font-semibold text-white mb-3">Tâches par séance</h3>
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={taskData} barSize={14}>
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="total" name="Total" fill="#475569" radius={[3,3,0,0]} />
                    <Bar dataKey="done" name="Faites" fill="#22c55e" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex gap-3 mt-2 justify-center">
                  <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-slate-500" /><span className="text-xs text-slate-400">Total</span></div>
                  <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500" /><span className="text-xs text-slate-400">Faites</span></div>
                </div>
              </div>
            )}

            {workSessions.length === 0 && (
              <div className="flex flex-col items-center py-12 text-slate-600">
                <BarChart2 size={36} strokeWidth={1} className="mb-2" />
                <p className="text-sm">Complète des séances pour voir les stats</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon, value, label, color }) {
  return (
    <div className="bg-slate-800 rounded-xl p-3 text-center">
      <div className={`flex justify-center mb-1 ${color}`}>{icon}</div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  )
}
