import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { Calendar, Dumbbell, Laptop, BarChart2, FileText } from 'lucide-react'
import Agenda from './pages/Agenda'
import Workout from './pages/Workout'
import Work from './pages/Work'
import Stats from './pages/Stats'
import Notes from './pages/Notes'
import PinGate from './components/PinGate'

const tabs = [
  { to: '/', icon: Calendar, label: 'Agenda' },
  { to: '/workout', icon: Dumbbell, label: 'Sport' },
  { to: '/work', icon: Laptop, label: 'Travail' },
  { to: '/stats', icon: BarChart2, label: 'Stats' },
  { to: '/notes', icon: FileText, label: 'Notes' },
]

function BottomNav() {
  const location = useLocation()
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 safe-bottom z-50">
      <div className="flex">
        {tabs.map(({ to, icon: Icon, label }) => {
          const active = to === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(to)
          return (
            <NavLink
              key={to}
              to={to}
              className={`flex-1 flex flex-col items-center py-2 gap-0.5 text-xs transition-colors ${
                active ? 'text-primary-400' : 'text-slate-500'
              }`}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
              <span className={active ? 'font-medium' : ''}>{label}</span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <PinGate>
        <div className="min-h-screen pb-20">
          <Routes>
            <Route path="/" element={<Agenda />} />
            <Route path="/workout/*" element={<Workout />} />
            <Route path="/work/*" element={<Work />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/notes/*" element={<Notes />} />
          </Routes>
          <BottomNav />
        </div>
      </PinGate>
    </BrowserRouter>
  )
}
