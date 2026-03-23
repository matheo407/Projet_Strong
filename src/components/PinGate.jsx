import { useState, useEffect, useCallback } from 'react'
import { Lock, Delete, AlertCircle } from 'lucide-react'

const PIN_LENGTH = 6
const PIN_KEY = 'app_pin_hash'
const LOCK_TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes en arrière-plan

async function hashPin(pin) {
  const data = new TextEncoder().encode(pin)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ─── Numeric keypad ───────────────────────────────────────────────────────────

function Keypad({ onDigit, onDelete }) {
  const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del']
  return (
    <div className="grid grid-cols-3 gap-3 w-64">
      {keys.map((k, i) => {
        if (k === null) return <div key={i} />
        if (k === 'del') return (
          <button
            key="del"
            onPointerDown={e => { e.preventDefault(); onDelete() }}
            className="h-16 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-300 active:bg-slate-700 active:scale-95 transition-transform"
          >
            <Delete size={22} />
          </button>
        )
        return (
          <button
            key={k}
            onPointerDown={e => { e.preventDefault(); onDigit(String(k)) }}
            className="h-16 rounded-2xl bg-slate-800 flex items-center justify-center text-white text-2xl font-light active:bg-slate-700 active:scale-95 transition-transform"
          >
            {k}
          </button>
        )
      })}
    </div>
  )
}

// ─── PIN dots ─────────────────────────────────────────────────────────────────

function PinDots({ length, filled, error }) {
  return (
    <div className="flex gap-4 my-8">
      {Array.from({ length }).map((_, i) => (
        <div
          key={i}
          className={`w-4 h-4 rounded-full transition-all duration-150 ${
            error
              ? 'bg-red-500 scale-110'
              : i < filled
              ? 'bg-primary-400 scale-110'
              : 'bg-slate-700'
          }`}
        />
      ))}
    </div>
  )
}

// ─── Main PinGate ─────────────────────────────────────────────────────────────

export default function PinGate({ children }) {
  const [mode, setMode] = useState('loading') // loading | setup | confirm | locked | unlocked
  const [digits, setDigits] = useState('')
  const [confirmDigits, setConfirmDigits] = useState('')
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)
  const [hiddenAt, setHiddenAt] = useState(null)

  // Check on mount
  useEffect(() => {
    const hash = localStorage.getItem(PIN_KEY)
    if (!hash) {
      setMode('setup')
    } else {
      setMode('locked')
    }
  }, [])

  // Auto-lock on visibility change
  useEffect(() => {
    function onVisibilityChange() {
      if (document.hidden) {
        setHiddenAt(Date.now())
      } else {
        if (hiddenAt && Date.now() - hiddenAt > LOCK_TIMEOUT_MS) {
          setMode('locked')
          setDigits('')
        }
        setHiddenAt(null)
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [hiddenAt])

  function triggerError(msg) {
    setError(msg)
    setShake(true)
    setTimeout(() => { setShake(false); setDigits(''); setError('') }, 700)
  }

  const handleDigit = useCallback((d) => {
    if (mode === 'setup') {
      setDigits(prev => {
        const next = (prev + d).slice(0, PIN_LENGTH)
        if (next.length === PIN_LENGTH) {
          setConfirmDigits('')
          setTimeout(() => setMode('confirm'), 150)
        }
        return next
      })
    } else if (mode === 'confirm') {
      setConfirmDigits(prev => {
        const next = (prev + d).slice(0, PIN_LENGTH)
        if (next.length === PIN_LENGTH) {
          setTimeout(async () => {
            if (next !== digits) {
              setMode('setup')
              setDigits('')
              setConfirmDigits('')
              triggerError('Les PIN ne correspondent pas')
            } else {
              const hash = await hashPin(next)
              localStorage.setItem(PIN_KEY, hash)
              setMode('unlocked')
            }
          }, 150)
        }
        return next
      })
    } else if (mode === 'locked') {
      setDigits(prev => {
        const next = (prev + d).slice(0, PIN_LENGTH)
        if (next.length === PIN_LENGTH) {
          setTimeout(async () => {
            const hash = await hashPin(next)
            const stored = localStorage.getItem(PIN_KEY)
            if (hash === stored) {
              setMode('unlocked')
              setDigits('')
            } else {
              triggerError('PIN incorrect')
            }
          }, 150)
        }
        return next
      })
    }
  }, [mode, digits])

  const handleDelete = useCallback(() => {
    if (mode === 'confirm') {
      setConfirmDigits(prev => prev.slice(0, -1))
    } else {
      setDigits(prev => prev.slice(0, -1))
    }
  }, [mode])

  async function resetPin() {
    if (!confirm('Réinitialiser le PIN ? Toutes tes données locales seront effacées.')) return
    // Clear IndexedDB
    const dbs = await indexedDB.databases()
    await Promise.all(dbs.map(db => new Promise((res, rej) => {
      const req = indexedDB.deleteDatabase(db.name)
      req.onsuccess = res
      req.onerror = rej
    })))
    localStorage.clear()
    setDigits('')
    setConfirmDigits('')
    setMode('setup')
  }

  if (mode === 'loading') return null
  if (mode === 'unlocked') return children

  const currentDigits = mode === 'confirm' ? confirmDigits : digits

  const titles = {
    setup: 'Crée ton PIN',
    confirm: 'Confirme ton PIN',
    locked: 'Déverrouille l\'app',
  }

  const subtitles = {
    setup: 'Choisis un code à 6 chiffres',
    confirm: 'Entre à nouveau ton PIN',
    locked: 'Entre ton code pour accéder',
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center safe-top safe-bottom px-6">
      <div className={`flex flex-col items-center transition-all ${shake ? 'animate-shake' : ''}`}>
        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-primary-600/20 flex items-center justify-center mb-6">
          <Lock size={28} className="text-primary-400" />
        </div>

        <h1 className="text-2xl font-bold text-white">{titles[mode]}</h1>
        <p className="text-sm text-slate-400 mt-1 mb-2 text-center">{subtitles[mode]}</p>

        {/* Error message */}
        {error && (
          <div className="flex items-center gap-1.5 text-red-400 text-sm mt-1">
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}

        <PinDots length={PIN_LENGTH} filled={currentDigits.length} error={shake} />

        <Keypad onDigit={handleDigit} onDelete={handleDelete} />

        {/* Reset option (only on locked screen) */}
        {mode === 'locked' && (
          <button
            onClick={resetPin}
            className="mt-8 text-xs text-slate-600 active:text-red-400 underline underline-offset-2"
          >
            PIN oublié — réinitialiser l'app
          </button>
        )}
      </div>
    </div>
  )
}
