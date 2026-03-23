import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, addDays, startOfWeek, isSameDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Plus, Calendar, ChevronLeft, ChevronRight, X, Check, Tag, Clock } from 'lucide-react'
import { getAll, put, remove, genId } from '../lib/db'

const CUSTOM_CATS_KEY = 'agenda_custom_categories'
const HOUR_HEIGHT = 64   // px per hour in timeline
const DAY_START = 6      // first visible hour
const DAY_END = 23       // last visible hour

const EVENT_TYPES = [
  { id: 'sport-push',  label: 'Push',    color: 'bg-orange-500', border: 'border-orange-400', textColor: 'text-orange-400', category: 'sport' },
  { id: 'sport-pull',  label: 'Pull',    color: 'bg-blue-500',   border: 'border-blue-400',   textColor: 'text-blue-400',   category: 'sport' },
  { id: 'sport-legs',  label: 'Legs',    color: 'bg-green-500',  border: 'border-green-400',  textColor: 'text-green-400',  category: 'sport' },
  { id: 'work',        label: 'Travail', color: 'bg-purple-500', border: 'border-purple-400', textColor: 'text-purple-400', category: 'work'  },
  { id: 'other',       label: 'Autre',   color: 'bg-slate-500',  border: 'border-slate-400',  textColor: 'text-slate-400',  category: 'other' },
]

const DURATION_PRESETS = [
  { label: '30 min', value: 30 },
  { label: '1h',     value: 60 },
  { label: '1h30',   value: 90 },
  { label: '2h',     value: 120 },
  { label: '3h',     value: 180 },
]

function getEventType(id) {
  return EVENT_TYPES.find(t => t.id === id) || EVENT_TYPES[4]
}
function loadCustomCats() {
  try { return JSON.parse(localStorage.getItem(CUSTOM_CATS_KEY) || '[]') } catch { return [] }
}
function saveCustomCats(cats) {
  localStorage.setItem(CUSTOM_CATS_KEY, JSON.stringify(cats))
}
function formatDuration(min) {
  if (!min) return ''
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h${m}`
}
function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

// ─── Timeline for one day ─────────────────────────────────────────────────────

function DayTimeline({ date, events, onEventTap, onDeleteEvent, onAddAtHour, isToday }) {
  const hours = Array.from({ length: DAY_END - DAY_START }, (_, i) => i + DAY_START)
  const now = new Date()
  const currentTop = isToday
    ? ((now.getHours() - DAY_START) * 60 + now.getMinutes()) / 60 * HOUR_HEIGHT
    : null

  function getEventStyle(ev) {
    const startMin = timeToMinutes(ev.time) - DAY_START * 60
    const duration = ev.duration || 60
    return {
      top: Math.max(0, (startMin / 60) * HOUR_HEIGHT),
      height: Math.max((duration / 60) * HOUR_HEIGHT, 28),
    }
  }

  // Group overlapping events
  function layoutEvents(evs) {
    const sorted = [...evs].sort((a, b) => a.time.localeCompare(b.time))
    const columns = []
    const result = []
    for (const ev of sorted) {
      const start = timeToMinutes(ev.time)
      const end = start + (ev.duration || 60)
      let placed = false
      for (let c = 0; c < columns.length; c++) {
        if (columns[c] <= start) {
          columns[c] = end
          result.push({ ev, col: c, totalCols: columns.length })
          placed = true
          break
        }
      }
      if (!placed) {
        columns.push(end)
        result.push({ ev, col: columns.length - 1, totalCols: columns.length })
      }
    }
    // Second pass: fix totalCols
    for (const item of result) {
      let maxCol = item.col
      const start = timeToMinutes(item.ev.time)
      const end = start + (item.ev.duration || 60)
      for (const other of result) {
        const os = timeToMinutes(other.ev.time)
        const oe = os + (other.ev.duration || 60)
        if (os < end && oe > start) maxCol = Math.max(maxCol, other.col)
      }
      item.totalCols = maxCol + 1
    }
    return result
  }

  const laid = layoutEvents(events)

  return (
    <div className="relative flex" style={{ height: (DAY_END - DAY_START) * HOUR_HEIGHT }}>
      {/* Hour labels */}
      <div className="w-11 flex-shrink-0">
        {hours.map(h => (
          <div key={h} style={{ height: HOUR_HEIGHT }} className="flex items-start justify-end pr-2 pt-1">
            <span className="text-xs text-slate-600 tabular-nums">{h}h</span>
          </div>
        ))}
      </div>

      {/* Grid + events */}
      <div className="flex-1 relative border-l border-slate-800">
        {/* Hour lines */}
        {hours.map(h => (
          <div key={h} style={{ height: HOUR_HEIGHT }}
            className="border-b border-slate-800/60 active:bg-slate-800/30 cursor-pointer"
            onClick={() => onAddAtHour(h)} />
        ))}

        {/* Half-hour lines */}
        {hours.map(h => (
          <div key={`half-${h}`} className="absolute left-0 right-0 border-b border-slate-800/30"
            style={{ top: (h - DAY_START) * HOUR_HEIGHT + HOUR_HEIGHT / 2 }} />
        ))}

        {/* Current time */}
        {currentTop !== null && currentTop >= 0 && currentTop <= (DAY_END - DAY_START) * HOUR_HEIGHT && (
          <div className="absolute left-0 right-0 flex items-center z-20 pointer-events-none"
            style={{ top: currentTop }}>
            <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 -ml-1" />
            <div className="flex-1 h-px bg-red-500" />
          </div>
        )}

        {/* Events */}
        {laid.map(({ ev, col, totalCols }) => {
          const t = getEventType(ev.type)
          const style = getEventStyle(ev)
          const width = `calc(${100 / totalCols}% - 4px)`
          const left = `calc(${(col / totalCols) * 100}% + 2px)`
          return (
            <div
              key={ev.id}
              className={`absolute rounded-lg px-2 py-1 cursor-pointer border-l-2 ${t.color}/80 ${t.border} overflow-hidden group`}
              style={{ top: style.top + 1, height: style.height - 2, width, left }}
              onClick={() => onEventTap(ev)}
            >
              <p className="text-white text-xs font-semibold leading-tight truncate">{ev.title}</p>
              <p className="text-white/70 text-xs truncate">
                {ev.time}{ev.duration ? ` · ${formatDuration(ev.duration)}` : ''}
              </p>
              <button
                onClick={e => { e.stopPropagation(); onDeleteEvent(ev.id) }}
                className="absolute top-0.5 right-0.5 opacity-0 group-active:opacity-100 p-0.5 text-white/60"
              >
                <X size={11} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Agenda page ─────────────────────────────────────────────────────────

export default function Agenda() {
  const [today] = useState(new Date())
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [selectedDay, setSelectedDay] = useState(new Date())
  const [events, setEvents] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ type: 'sport-push', title: '', time: '08:00', duration: 60, note: '', customCategory: '' })
  const [customCats, setCustomCats] = useState(loadCustomCats)
  const [newCatInput, setNewCatInput] = useState('')
  const [customDuration, setCustomDuration] = useState('')
  const [useCustomDuration, setUseCustomDuration] = useState(false)
  const timelineRef = useRef(null)
  const navigate = useNavigate()

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  useEffect(() => { loadEvents() }, [])

  // Auto-scroll timeline to current hour on mount
  useEffect(() => {
    if (timelineRef.current) {
      const offset = Math.max(0, (new Date().getHours() - DAY_START - 1) * HOUR_HEIGHT)
      timelineRef.current.scrollTop = offset
    }
  }, [selectedDay])

  async function loadEvents() {
    const all = await getAll('events')
    setEvents(all)
  }

  function openAdd(date, hour = null) {
    setSelectedDay(date)
    const h = hour !== null ? hour : new Date().getHours()
    const hStr = String(Math.min(h, 22)).padStart(2, '0')
    setForm({ type: 'sport-push', title: '', time: `${hStr}:00`, duration: 60, note: '', customCategory: '' })
    setNewCatInput('')
    setUseCustomDuration(false)
    setCustomDuration('')
    setShowModal(true)
  }

  async function addEvent() {
    if (!form.title.trim()) return
    const finalCat = form.type === 'other'
      ? (newCatInput.trim() || form.customCategory || 'Autre')
      : ''
    if (form.type === 'other' && newCatInput.trim() && !customCats.includes(newCatInput.trim())) {
      const updated = [newCatInput.trim(), ...customCats].slice(0, 20)
      setCustomCats(updated)
      saveCustomCats(updated)
    }
    const finalDuration = useCustomDuration
      ? (parseInt(customDuration) || 60)
      : form.duration
    const ev = {
      id: genId(),
      type: form.type,
      title: form.title,
      time: form.time,
      duration: finalDuration,
      note: form.note,
      customCategory: finalCat,
      date: format(selectedDay, 'yyyy-MM-dd'),
    }
    await put('events', ev)
    setEvents(prev => [...prev, ev])
    setShowModal(false)
  }

  async function deleteEvent(id) {
    await remove('events', id)
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  function handleEventTap(ev) {
    const t = getEventType(ev.type)
    if (t.category === 'sport') navigate(`/workout?date=${ev.date}&type=${ev.type.replace('sport-', '')}`)
    else if (t.category === 'work') navigate(`/work?date=${ev.date}`)
  }

  const eventsForDay = (date) =>
    events.filter(e => e.date === format(date, 'yyyy-MM-dd'))

  // Navigate to prev/next week keeping selected day
  function prevWeek() {
    setWeekStart(d => addDays(d, -7))
    setSelectedDay(d => addDays(d, -7))
  }
  function nextWeek() {
    setWeekStart(d => addDays(d, 7))
    setSelectedDay(d => addDays(d, 7))
  }

  return (
    <div className="flex flex-col h-screen bg-slate-950">
      {/* Header */}
      <div className="safe-top px-4 pt-4 pb-2 bg-slate-950 border-b border-slate-800 flex-shrink-0">
        <h1 className="text-xl font-bold text-white">Agenda</h1>
        <p className="text-xs text-slate-400">{format(today, 'EEEE d MMMM yyyy', { locale: fr })}</p>
      </div>

      {/* Week navigation */}
      <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <button onClick={prevWeek} className="p-1 text-slate-400 active:text-white">
            <ChevronLeft size={20} />
          </button>
          <span className="text-xs font-medium text-slate-300">
            {format(weekStart, 'd MMM', { locale: fr })} – {format(addDays(weekStart, 6), 'd MMM yyyy', { locale: fr })}
          </span>
          <button onClick={nextWeek} className="p-1 text-slate-400 active:text-white">
            <ChevronRight size={20} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map(day => {
            const isToday = isSameDay(day, today)
            const isSelected = isSameDay(day, selectedDay)
            const hasEvents = eventsForDay(day).length > 0
            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDay(day)}
                className={`flex flex-col items-center py-1.5 rounded-lg transition-colors ${
                  isSelected ? 'bg-primary-600' : isToday ? 'bg-slate-700' : 'active:bg-slate-800'
                }`}
              >
                <span className="text-xs text-slate-400">{format(day, 'EEE', { locale: fr })}</span>
                <span className={`text-sm font-semibold ${isSelected || isToday ? 'text-white' : 'text-slate-200'}`}>
                  {format(day, 'd')}
                </span>
                {hasEvents && <div className={`w-1.5 h-1.5 rounded-full mt-0.5 ${isSelected ? 'bg-white/60' : 'bg-primary-400'}`} />}
              </button>
            )
          })}
        </div>
      </div>

      {/* Day label */}
      <div className="px-4 py-1.5 bg-slate-950 border-b border-slate-800 flex-shrink-0 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400">
          {isSameDay(selectedDay, today) ? "Aujourd'hui" : format(selectedDay, 'EEEE d MMMM', { locale: fr })}
        </span>
        <span className="text-xs text-slate-600">
          {eventsForDay(selectedDay).length} événement{eventsForDay(selectedDay).length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Timeline */}
      <div ref={timelineRef} className="flex-1 overflow-y-auto bg-slate-950">
        <DayTimeline
          date={selectedDay}
          events={eventsForDay(selectedDay)}
          onEventTap={handleEventTap}
          onDeleteEvent={deleteEvent}
          onAddAtHour={h => openAdd(selectedDay, h)}
          isToday={isSameDay(selectedDay, today)}
        />
      </div>

      {/* FAB */}
      <button
        onClick={() => openAdd(selectedDay)}
        className="fixed bottom-24 right-5 w-14 h-14 rounded-full bg-primary-600 flex items-center justify-center shadow-lg active:bg-primary-700 z-40"
      >
        <Plus size={26} className="text-white" />
      </button>

      {/* Add event modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-end">
          <div className="w-full bg-slate-900 rounded-t-2xl flex flex-col" style={{ maxHeight: 'calc(100vh - 80px)' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-800 flex-shrink-0">
              <h2 className="text-base font-semibold">
                {format(selectedDay, 'EEEE d MMMM', { locale: fr })}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 text-slate-400"><X size={22} /></button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 px-5 py-3 space-y-4">
              {/* Type */}
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Type</label>
                <div className="flex gap-2 flex-wrap">
                  {EVENT_TYPES.map(t => (
                    <button key={t.id}
                      onClick={() => setForm(f => ({ ...f, type: t.id }))}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        form.type === t.id ? t.color + ' text-white' : 'bg-slate-800 text-slate-400'
                      }`}
                    >{t.label}</button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Titre</label>
                <input type="text" value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="ex: Séance Push"
                  className="w-full bg-slate-800 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-primary-500" />
              </div>

              {/* Time + Duration */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-slate-400 mb-1.5 block flex items-center gap-1"><Clock size={11} /> Début</label>
                  <input type="time" value={form.time}
                    onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                    className="w-full bg-slate-800 rounded-xl px-3 py-2.5 text-white outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-slate-400 mb-1.5 block">Durée</label>
                  <select
                    value={useCustomDuration ? 'custom' : form.duration}
                    onChange={e => {
                      if (e.target.value === 'custom') { setUseCustomDuration(true) }
                      else { setUseCustomDuration(false); setForm(f => ({ ...f, duration: parseInt(e.target.value) })) }
                    }}
                    className="w-full bg-slate-800 rounded-xl px-3 py-2.5 text-white outline-none focus:ring-2 focus:ring-primary-500 appearance-none"
                  >
                    {DURATION_PRESETS.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                    <option value="custom">Autre…</option>
                  </select>
                </div>
              </div>

              {/* Custom duration input */}
              {useCustomDuration && (
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">Durée en minutes</label>
                  <input type="number" inputMode="numeric" value={customDuration}
                    onChange={e => setCustomDuration(e.target.value)}
                    placeholder="ex: 75"
                    className="w-full bg-slate-800 rounded-xl px-3 py-2.5 text-white outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              )}

              {/* Custom category */}
              {form.type === 'other' && (
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block flex items-center gap-1"><Tag size={11} /> Catégorie</label>
                  {customCats.length > 0 && (
                    <div className="flex gap-2 flex-wrap mb-2">
                      {customCats.map(cat => (
                        <button key={cat}
                          onClick={() => { setForm(f => ({ ...f, customCategory: cat })); setNewCatInput('') }}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                            form.customCategory === cat && !newCatInput ? 'bg-slate-500 text-white' : 'bg-slate-800 text-slate-400'
                          }`}
                        >{cat}</button>
                      ))}
                    </div>
                  )}
                  <input type="text" value={newCatInput}
                    onChange={e => { setNewCatInput(e.target.value); setForm(f => ({ ...f, customCategory: '' })) }}
                    placeholder="Nouvelle catégorie..."
                    className="w-full bg-slate-800 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-slate-500" />
                </div>
              )}

              {/* Note */}
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Note (optionnel)</label>
                <input type="text" value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="Remarque..."
                  className="w-full bg-slate-800 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
            </div>

            {/* Fixed confirm — toujours visible */}
            <div className="px-5 pt-3 pb-6 border-t border-slate-800 flex-shrink-0 bg-slate-900">
              <button onClick={addEvent}
                className="w-full bg-primary-600 text-white font-semibold py-3.5 rounded-xl active:bg-primary-700 flex items-center justify-center gap-2">
                <Check size={18} /> Ajouter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
