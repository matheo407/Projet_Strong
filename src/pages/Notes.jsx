import { useState, useEffect, useRef } from 'react'
import { Routes, Route, useNavigate, useParams } from 'react-router-dom'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Plus, ChevronLeft, ChevronRight, X, Share2, FileText,
  Bold, Italic, List, ListOrdered, Code, Heading1, Heading2,
  SquareCheck, Minus, Link2, Copy, Check,
  ChevronDown, PanelLeftClose, PanelLeftOpen, Network
} from 'lucide-react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { getAll, put, remove, genId, get } from '../lib/db'
import { supabase, isSupabaseEnabled } from '../lib/supabase'

// ─── Sidebar tree item (recursive) ───────────────────────────────────────────

function TreeItem({ note, allNotes, currentId, depth, onSelect }) {
  const children = allNotes
    .filter(n => n.parentId === note.id)
    .sort((a, b) => a.createdAt - b.createdAt)
  const [expanded, setExpanded] = useState(depth < 2)
  const isActive = note.id === currentId

  return (
    <div>
      <div
        className={`flex items-center gap-1 py-1.5 pr-1 rounded-lg cursor-pointer transition-colors ${
          isActive ? 'bg-primary-600/20 text-primary-300' : 'text-slate-300 active:bg-slate-800'
        }`}
        style={{ paddingLeft: depth * 10 + 6 }}
        onClick={() => onSelect(note.id)}
      >
        {children.length > 0 ? (
          <button
            onClick={e => { e.stopPropagation(); setExpanded(x => !x) }}
            className="p-0.5 flex-shrink-0 text-slate-500"
          >
            {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </button>
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}
        <FileText size={11} className="flex-shrink-0 text-slate-500" />
        <span className="text-xs truncate leading-tight">{note.title || 'Sans titre'}</span>
      </div>
      {expanded && children.map(child => (
        <TreeItem
          key={child.id}
          note={child}
          allNotes={allNotes}
          currentId={currentId}
          depth={depth + 1}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}

// ─── Inline sidebar panel ─────────────────────────────────────────────────────

function SidebarPanel({ notes, currentId, onSelect, onNewRoot, onClose }) {
  const roots = notes
    .filter(n => !n.parentId)
    .sort((a, b) => a.createdAt - b.createdAt)

  return (
    <div className="w-40 flex-shrink-0 border-r border-slate-800 bg-slate-900 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-2 py-2.5 border-b border-slate-800">
        <span className="text-xs font-semibold text-slate-400 truncate">Pages</span>
        <div className="flex items-center gap-1">
          <button onClick={onNewRoot} className="p-1 text-slate-400 active:text-white flex-shrink-0">
            <Plus size={14} />
          </button>
          <button onClick={onClose} className="p-1 text-slate-500 active:text-white flex-shrink-0">
            <X size={14} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-1 px-1">
        {roots.length === 0 && (
          <p className="text-xs text-slate-600 text-center py-6">Aucune page</p>
        )}
        {roots.map(note => (
          <TreeItem
            key={note.id}
            note={note}
            allNotes={notes}
            currentId={currentId}
            depth={0}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Graph view ───────────────────────────────────────────────────────────────

function computeLayout(notes, width, height) {
  if (notes.length === 0) return {}
  if (notes.length === 1) return { [notes[0].id]: { x: width / 2, y: height / 2 } }

  const K = 90
  const REPULSION = 6000
  const ITERATIONS = 120

  const pos = {}
  notes.forEach((n, i) => {
    const angle = (i / notes.length) * 2 * Math.PI
    const r = Math.min(width, height) * 0.28
    pos[n.id] = {
      x: width / 2 + r * Math.cos(angle) + (Math.random() - 0.5) * 20,
      y: height / 2 + r * Math.sin(angle) + (Math.random() - 0.5) * 20,
    }
  })

  const edges = notes
    .filter(n => n.parentId && pos[n.parentId])
    .map(n => [n.id, n.parentId])

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const forces = {}
    notes.forEach(n => { forces[n.id] = { fx: 0, fy: 0 } })

    // Repulsion between all pairs
    for (let i = 0; i < notes.length; i++) {
      for (let j = i + 1; j < notes.length; j++) {
        const a = notes[i], b = notes[j]
        const dx = pos[b.id].x - pos[a.id].x
        const dy = pos[b.id].y - pos[a.id].y
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1)
        const f = REPULSION / (dist * dist)
        forces[a.id].fx -= f * dx / dist
        forces[a.id].fy -= f * dy / dist
        forces[b.id].fx += f * dx / dist
        forces[b.id].fy += f * dy / dist
      }
    }

    // Spring attraction along edges
    edges.forEach(([aid, bid]) => {
      if (!pos[aid] || !pos[bid]) return
      const dx = pos[bid].x - pos[aid].x
      const dy = pos[bid].y - pos[aid].y
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1)
      const f = (dist - K) * 0.06
      forces[aid].fx += f * dx / dist
      forces[aid].fy += f * dy / dist
      forces[bid].fx -= f * dx / dist
      forces[bid].fy -= f * dy / dist
    })

    // Gravity toward center
    notes.forEach(n => {
      forces[n.id].fx += (width / 2 - pos[n.id].x) * 0.012
      forces[n.id].fy += (height / 2 - pos[n.id].y) * 0.012
    })

    const step = Math.max(0.1, 1 - iter / ITERATIONS) * 0.9
    notes.forEach(n => {
      pos[n.id].x += forces[n.id].fx * step
      pos[n.id].y += forces[n.id].fy * step
      pos[n.id].x = Math.max(40, Math.min(width - 40, pos[n.id].x))
      pos[n.id].y = Math.max(40, Math.min(height - 40, pos[n.id].y))
    })
  }

  return pos
}

function GraphView({ notes, currentId, onClose, onSelect }) {
  const containerRef = useRef(null)
  const [positions, setPositions] = useState(null)
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight - 130 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    const w = width || window.innerWidth
    const h = height || window.innerHeight - 130
    setSize({ w, h })
    setPositions(computeLayout(notes, w, h))
  }, [notes])

  const edges = notes.filter(n => n.parentId)

  return (
    <div className="fixed inset-0 bg-slate-950 z-[60] flex flex-col safe-top">
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-slate-800 flex-shrink-0">
        <div>
          <h2 className="font-bold text-white">Graphe des notes</h2>
          <p className="text-xs text-slate-500">{notes.length} page{notes.length > 1 ? 's' : ''}</p>
        </div>
        <button onClick={onClose} className="p-2 text-slate-400 active:text-white">
          <X size={22} />
        </button>
      </div>

      <div ref={containerRef} className="flex-1 overflow-hidden relative">
        {positions && (
          <svg width={size.w} height={size.h}>
            {/* Edges */}
            {edges.map(n => {
              const src = positions[n.id]
              const tgt = positions[n.parentId]
              if (!src || !tgt) return null
              return (
                <line
                  key={`${n.id}-${n.parentId}`}
                  x1={src.x} y1={src.y}
                  x2={tgt.x} y2={tgt.y}
                  stroke="#334155"
                  strokeWidth={1.5}
                />
              )
            })}

            {/* Nodes */}
            {notes.map(n => {
              const p = positions[n.id]
              if (!p) return null
              const isActive = n.id === currentId
              const hasParent = !!n.parentId
              const r = hasParent ? 5 : 7
              return (
                <g
                  key={n.id}
                  onClick={() => { onSelect(n.id); onClose() }}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Glow for active */}
                  {isActive && (
                    <circle cx={p.x} cy={p.y} r={r + 5} fill="#6366f1" opacity={0.25} />
                  )}
                  <circle
                    cx={p.x} cy={p.y} r={r}
                    fill={isActive ? '#6366f1' : hasParent ? '#64748b' : '#94a3b8'}
                    stroke={isActive ? '#818cf8' : 'none'}
                    strokeWidth={1.5}
                  />
                  <text
                    x={p.x} y={p.y + r + 13}
                    textAnchor="middle"
                    fontSize={10}
                    fill={isActive ? '#a5b4fc' : '#64748b'}
                  >
                    {(n.title || 'Sans titre').slice(0, 18)}
                  </text>
                </g>
              )
            })}
          </svg>
        )}

        {notes.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-600">
            <Network size={40} strokeWidth={1} className="mb-3" />
            <p className="text-sm">Aucune note à afficher</p>
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-slate-800 flex-shrink-0">
        <p className="text-xs text-slate-600 text-center">Appuie sur un nœud pour ouvrir la note · Les lignes représentent les sous-pages</p>
      </div>
    </div>
  )
}

// ─── Breadcrumb helper ────────────────────────────────────────────────────────

function buildBreadcrumb(noteId, notes) {
  const path = []
  let current = notes.find(n => n.id === noteId)
  while (current) {
    path.unshift(current)
    current = current.parentId ? notes.find(n => n.id === current.parentId) : null
  }
  return path
}

// ─── Sidebar toggle helpers ───────────────────────────────────────────────────

function getSidebarOpen() {
  return localStorage.getItem('notes_sidebar_open') !== 'false'
}

function setSidebarOpen(value) {
  localStorage.setItem('notes_sidebar_open', String(value))
}

// ─── Root notes list ──────────────────────────────────────────────────────────

function NotesList() {
  const [notes, setNotes] = useState([])
  const [showSidebar, setShowSidebar] = useState(getSidebarOpen)
  const [showGraph, setShowGraph] = useState(false)
  const navigate = useNavigate()

  useEffect(() => { loadNotes() }, [])

  async function loadNotes() {
    const all = await getAll('notes')
    setNotes(all.sort((a, b) => b.updatedAt - a.updatedAt))
  }

  async function createNote(parentId = null) {
    const note = {
      id: genId(), title: 'Nouvelle page', content: '',
      parentId, createdAt: Date.now(), updatedAt: Date.now(), sharedId: null,
    }
    await put('notes', note)
    navigate(`/notes/${note.id}`)
  }

  async function deleteNote(id, e) {
    e.stopPropagation()
    const all = await getAll('notes')
    const toDelete = [id]
    const findChildren = pid => {
      all.filter(n => n.parentId === pid).forEach(n => { toDelete.push(n.id); findChildren(n.id) })
    }
    findChildren(id)
    await Promise.all(toDelete.map(i => remove('notes', i)))
    setNotes(prev => prev.filter(n => !toDelete.includes(n.id)))
  }

  function toggleSidebar() {
    const next = !showSidebar
    setShowSidebar(next)
    setSidebarOpen(next)
  }

  const roots = notes.filter(n => !n.parentId)

  function preview(content) {
    try {
      const d = document.createElement('div')
      d.innerHTML = content
      return (d.textContent || '').slice(0, 70) || 'Vide'
    } catch { return 'Vide' }
  }

  function countChildren(id) {
    return notes.filter(n => n.parentId === id).length
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-950">
      {/* Header */}
      <div className="safe-top px-4 pt-4 pb-3 border-b border-slate-800 flex items-center gap-3">
        <button onClick={toggleSidebar} className="p-1.5 text-slate-400 active:text-white">
          {showSidebar ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">Notes</h1>
          <p className="text-xs text-slate-400">{roots.length} page{roots.length > 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowGraph(true)} className="p-1.5 text-slate-400 active:text-white" title="Graphe">
          <Network size={20} />
        </button>
      </div>

      {/* Sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        {showSidebar && (
          <SidebarPanel
            notes={notes}
            currentId={null}
            onSelect={id => navigate(`/notes/${id}`)}
            onNewRoot={() => createNote(null)}
            onClose={toggleSidebar}
          />
        )}

        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-2 relative">
          {roots.length === 0 && (
            <div className="flex flex-col items-center py-16 text-slate-600">
              <FileText size={40} strokeWidth={1} className="mb-3" />
              <p className="text-sm">Aucune page</p>
              <p className="text-xs mt-1">Appuie sur + pour créer ta première page</p>
            </div>
          )}
          {roots.map(note => (
            <button
              key={note.id}
              onClick={() => navigate(`/notes/${note.id}`)}
              className="w-full bg-slate-800 rounded-xl px-3 py-3 text-left flex items-start gap-2 active:bg-slate-700"
            >
              <FileText size={15} className="text-slate-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white truncate text-sm">{note.title || 'Sans titre'}</p>
                <p className="text-xs text-slate-500 mt-0.5 truncate">{preview(note.content)}</p>
                <p className="text-xs text-slate-600 mt-1 flex items-center gap-1">
                  {format(new Date(note.updatedAt), 'd MMM yyyy', { locale: fr })}
                  {countChildren(note.id) > 0 && (
                    <span>· {countChildren(note.id)} sous-page{countChildren(note.id) > 1 ? 's' : ''}</span>
                  )}
                </p>
              </div>
              <button onClick={e => deleteNote(note.id, e)} className="p-1 text-slate-600 active:text-red-400 mt-0.5 flex-shrink-0">
                <X size={15} />
              </button>
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => createNote(null)}
        className="fixed bottom-24 right-5 w-14 h-14 rounded-full bg-primary-600 flex items-center justify-center shadow-lg active:bg-primary-700 z-40"
      >
        <Plus size={26} className="text-white" />
      </button>

      {showGraph && (
        <GraphView
          notes={notes}
          currentId={null}
          onClose={() => setShowGraph(false)}
          onSelect={id => navigate(`/notes/${id}`)}
        />
      )}
    </div>
  )
}

// ─── Toolbar button ───────────────────────────────────────────────────────────

function ToolBtn({ onClick, active, children, title }) {
  return (
    <button
      onMouseDown={e => { e.preventDefault(); onClick() }}
      title={title}
      className={`p-2 rounded-lg flex-shrink-0 transition-colors ${
        active ? 'bg-primary-600 text-white' : 'text-slate-400 active:bg-slate-700'
      }`}
    >
      {children}
    </button>
  )
}

// ─── Editor toolbar ───────────────────────────────────────────────────────────

function Toolbar({ editor }) {
  if (!editor) return null
  return (
    <div className="flex gap-0.5 overflow-x-auto no-scrollbar px-2 py-1.5 border-b border-slate-800 bg-slate-900">
      <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Gras">
        <Bold size={16} />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italique">
        <Italic size={16} />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="H1">
        <Heading1 size={16} />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="H2">
        <Heading2 size={16} />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Liste">
        <List size={16} />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Liste numérotée">
        <ListOrdered size={16} />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')} title="Checklist">
        <SquareCheck size={16} />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Code">
        <Code size={16} />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Citation">
        <span className="text-sm font-bold leading-none">"</span>
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Séparateur">
        <Minus size={16} />
      </ToolBtn>
    </div>
  )
}

// ─── Note editor ──────────────────────────────────────────────────────────────

function NoteEditor({ noteId }) {
  const [note, setNote] = useState(null)
  const [allNotes, setAllNotes] = useState([])
  const [title, setTitle] = useState('')
  const [copied, setCopied] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const [sharing, setSharing] = useState(false)
  const [showSidebar, setShowSidebar] = useState(getSidebarOpen)
  const [showGraph, setShowGraph] = useState(false)
  const navigate = useNavigate()
  let saveTimer = null

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Commence à écrire...' }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    editorProps: { attributes: { class: 'text-slate-100 text-sm leading-relaxed' } },
    onUpdate: ({ editor }) => {
      clearTimeout(saveTimer)
      saveTimer = setTimeout(() => saveContent(editor.getHTML()), 800)
    }
  })

  useEffect(() => {
    loadNote()
    return () => clearTimeout(saveTimer)
  }, [noteId])

  async function loadNote() {
    const [n, all] = await Promise.all([get('notes', noteId), getAll('notes')])
    setAllNotes(all)
    if (n) {
      setNote(n)
      setTitle(n.title || '')
    }
  }

  useEffect(() => {
    if (editor && note) {
      editor.commands.setContent(note.content || '')
    }
  }, [editor, note?.id])

  async function saveContent(content) {
    const n = await get('notes', noteId)
    if (n) {
      const updated = { ...n, content, updatedAt: Date.now() }
      await put('notes', updated)
      setNote(updated)
    }
  }

  async function saveTitle(t) {
    const n = await get('notes', noteId)
    if (!n) return
    const updated = { ...n, title: t, updatedAt: Date.now() }
    await put('notes', updated)
    setNote(updated)
    setAllNotes(prev => prev.map(x => x.id === noteId ? updated : x))
  }

  async function createSubPage() {
    const child = {
      id: genId(), title: 'Nouvelle page', content: '',
      parentId: noteId, createdAt: Date.now(), updatedAt: Date.now(), sharedId: null,
    }
    await put('notes', child)
    setAllNotes(prev => [...prev, child])
    navigate(`/notes/${child.id}`)
  }

  async function deleteSubPage(id, e) {
    e.stopPropagation()
    const all = await getAll('notes')
    const toDelete = [id]
    const findChildren = pid => {
      all.filter(n => n.parentId === pid).forEach(n => { toDelete.push(n.id); findChildren(n.id) })
    }
    findChildren(id)
    await Promise.all(toDelete.map(i => remove('notes', i)))
    setAllNotes(prev => prev.filter(n => !toDelete.includes(n.id)))
  }

  function toMarkdown() {
    if (!editor) return ''
    return nodeMd(editor.getJSON())
  }

  function nodeMd(node) {
    if (!node) return ''
    if (node.type === 'doc') return (node.content || []).map(nodeMd).join('\n')
    if (node.type === 'paragraph') return (node.content || []).map(nodeMd).join('') + '\n'
    if (node.type === 'heading') return '#'.repeat(node.attrs?.level || 1) + ' ' + (node.content || []).map(nodeMd).join('') + '\n'
    if (node.type === 'text') {
      let t = node.text || ''
      if (node.marks) {
        const m = node.marks.map(x => x.type)
        if (m.includes('bold')) t = `**${t}**`
        if (m.includes('italic')) t = `*${t}*`
        if (m.includes('code')) t = `\`${t}\``
      }
      return t
    }
    if (node.type === 'bulletList') return (node.content || []).map(n => '- ' + (n.content || []).map(nodeMd).join('')).join('\n') + '\n'
    if (node.type === 'orderedList') return (node.content || []).map((n, i) => `${i + 1}. ` + (n.content || []).map(nodeMd).join('')).join('\n') + '\n'
    if (node.type === 'listItem') return (node.content || []).map(nodeMd).join('').trim()
    if (node.type === 'taskList') return (node.content || []).map(n => (n.attrs?.checked ? '- [x] ' : '- [ ] ') + (n.content || []).map(nodeMd).join('')).join('\n') + '\n'
    if (node.type === 'taskItem') return (node.content || []).map(nodeMd).join('').trim()
    if (node.type === 'blockquote') return '> ' + (node.content || []).map(nodeMd).join('').trim() + '\n'
    if (node.type === 'horizontalRule') return '---\n'
    return (node.content || []).map(nodeMd).join('')
  }

  async function copyMarkdown() {
    await navigator.clipboard.writeText(`# ${title}\n\n${toMarkdown()}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function shareNote() {
    setSharing(true)
    try {
      if (isSupabaseEnabled && supabase) {
        const sharedId = note.sharedId || genId()
        const { error } = await supabase.from('shared_notes').upsert({
          id: sharedId, title, content: editor.getHTML(),
          markdown: toMarkdown(), updated_at: new Date().toISOString(),
        })
        if (!error) {
          const url = `${window.location.origin}/notes/shared/${sharedId}`
          const updated = { ...note, sharedId }
          await put('notes', updated)
          setNote(updated)
          setShareUrl(url)
          setShowShare(true)
        }
      } else {
        await copyMarkdown()
      }
    } finally {
      setSharing(false)
    }
  }

  function toggleSidebar() {
    const next = !showSidebar
    setShowSidebar(next)
    setSidebarOpen(next)
  }

  if (!note) return <div className="flex items-center justify-center h-screen text-slate-400">Chargement...</div>

  const breadcrumb = buildBreadcrumb(noteId, allNotes)
  const parent = note.parentId ? allNotes.find(n => n.id === note.parentId) : null
  const subPages = allNotes.filter(n => n.parentId === noteId)

  return (
    <div className="flex flex-col min-h-screen bg-slate-950">
      {/* Header */}
      <div className="safe-top px-3 pt-4 pb-2 border-b border-slate-800 bg-slate-950">
        <div className="flex items-center gap-1.5 mb-2">
          <button onClick={toggleSidebar} className="p-1.5 text-slate-400 active:text-white flex-shrink-0">
            {showSidebar ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>
          <button
            onClick={() => parent ? navigate(`/notes/${parent.id}`) : navigate('/notes')}
            className="p-1.5 text-slate-400 active:text-white flex-shrink-0"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="flex-1 flex items-center gap-1 overflow-hidden text-xs text-slate-500 min-w-0">
            <button onClick={() => navigate('/notes')} className="shrink-0 hover:text-slate-300">Notes</button>
            {breadcrumb.slice(0, -1).map(p => (
              <span key={p.id} className="flex items-center gap-1 min-w-0 shrink-0">
                <ChevronRight size={10} />
                <button onClick={() => navigate(`/notes/${p.id}`)} className="truncate max-w-[50px] hover:text-slate-300">{p.title}</button>
              </span>
            ))}
          </div>

          <button onClick={() => setShowGraph(true)} className="p-1.5 text-slate-400 active:text-white flex-shrink-0" title="Graphe">
            <Network size={16} />
          </button>
          <button onClick={copyMarkdown} className="p-1.5 text-slate-400 active:text-primary-400 flex-shrink-0" title="Copier Markdown">
            {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
          </button>
          <button onClick={shareNote} disabled={sharing} className="p-1.5 text-slate-400 active:text-primary-400 flex-shrink-0" title="Partager">
            <Share2 size={16} className={sharing ? 'animate-pulse' : ''} />
          </button>
          <button
            onClick={async () => {
              if (!confirm('Supprimer cette page et ses sous-pages ?')) return
              const all = await import('../lib/db').then(m => m.getAll('notes'))
              const toDelete = [noteId]
              const findChildren = pid => { all.filter(n => n.parentId === pid).forEach(n => { toDelete.push(n.id); findChildren(n.id) }) }
              findChildren(noteId)
              await Promise.all(toDelete.map(i => import('../lib/db').then(m => m.remove('notes', i))))
              navigate(note.parentId ? `/notes/${note.parentId}` : '/notes')
            }}
            className="p-1.5 text-slate-600 active:text-red-400 flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onBlur={e => saveTitle(e.target.value)}
          className="w-full bg-transparent text-white font-bold text-xl outline-none placeholder-slate-600 px-1"
          placeholder="Titre..."
        />
        <p className="text-xs text-slate-600 px-1 mt-0.5">
          {format(new Date(note.updatedAt), 'd MMM yyyy · HH:mm', { locale: fr })}
        </p>
      </div>

      {/* Sidebar + editor */}
      <div className="flex flex-1 overflow-hidden">
        {showSidebar && (
          <SidebarPanel
            notes={allNotes}
            currentId={noteId}
            onSelect={id => navigate(`/notes/${id}`)}
            onNewRoot={async () => {
              const n = { id: genId(), title: 'Nouvelle page', content: '', parentId: null, createdAt: Date.now(), updatedAt: Date.now(), sharedId: null }
              await put('notes', n)
              navigate(`/notes/${n.id}`)
            }}
            onClose={toggleSidebar}
          />
        )}

        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Toolbar editor={editor} />

          <div className="flex-1 overflow-y-auto px-4 py-4 pb-24">
            <EditorContent editor={editor} />

            <div className="mt-8 pt-4 border-t border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
                  Sous-pages {subPages.length > 0 && `(${subPages.length})`}
                </p>
                <button
                  onClick={createSubPage}
                  className="flex items-center gap-1 text-xs text-primary-400 active:text-primary-300 py-1 px-2 rounded-lg active:bg-slate-800"
                >
                  <Plus size={13} /> Ajouter
                </button>
              </div>

              {subPages.length === 0 && (
                <button
                  onClick={createSubPage}
                  className="w-full border border-dashed border-slate-700 rounded-xl py-4 text-slate-600 text-sm flex items-center justify-center gap-2 active:border-primary-600 active:text-primary-400"
                >
                  <Plus size={15} /> Nouvelle sous-page
                </button>
              )}

              <div className="space-y-1.5">
                {subPages.map(sub => (
                  <button
                    key={sub.id}
                    onClick={() => navigate(`/notes/${sub.id}`)}
                    className="w-full bg-slate-800 rounded-xl px-3 py-2.5 text-left flex items-center gap-2 active:bg-slate-700"
                  >
                    <FileText size={14} className="text-slate-500 flex-shrink-0" />
                    <span className="flex-1 text-sm text-white truncate">{sub.title || 'Sans titre'}</span>
                    <button onClick={e => deleteSubPage(sub.id, e)} className="p-1 text-slate-600 active:text-red-400">
                      <X size={13} />
                    </button>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Share modal */}
      {showShare && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-end">
          <div className="w-full bg-slate-900 rounded-t-2xl p-5 pb-24">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Note partagée</h3>
              <button onClick={() => setShowShare(false)} className="text-slate-400"><X size={22} /></button>
            </div>
            <div className="bg-slate-800 rounded-xl px-3 py-3 flex items-center gap-2 mb-4">
              <Link2 size={14} className="text-slate-400 flex-shrink-0" />
              <p className="text-xs text-slate-300 flex-1 break-all">{shareUrl}</p>
            </div>
            <button
              onClick={async () => { await navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
              className="w-full bg-primary-600 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 active:bg-primary-700"
            >
              {copied ? <Check size={18} /> : <Copy size={18} />}
              {copied ? 'Copié !' : 'Copier le lien'}
            </button>
          </div>
        </div>
      )}

      {/* Graph modal */}
      {showGraph && (
        <GraphView
          notes={allNotes}
          currentId={noteId}
          onClose={() => setShowGraph(false)}
          onSelect={id => navigate(`/notes/${id}`)}
        />
      )}
    </div>
  )
}

// ─── Shared note viewer ───────────────────────────────────────────────────────

function SharedNoteViewer() {
  const { sharedId } = useParams()
  const [note, setNote] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!isSupabaseEnabled || !supabase) { setError(true); return }
    supabase.from('shared_notes').select('*').eq('id', sharedId).single()
      .then(({ data, error }) => { if (error || !data) setError(true); else setNote(data) })
  }, [sharedId])

  if (error) return (
    <div className="flex flex-col items-center justify-center h-screen text-slate-500 px-8 text-center">
      <FileText size={40} strokeWidth={1} className="mb-3" />
      <p className="font-medium">Note introuvable</p>
      <p className="text-sm mt-1">Le lien est invalide ou le partage n'est pas configuré.</p>
    </div>
  )
  if (!note) return <div className="flex items-center justify-center h-screen text-slate-400">Chargement...</div>

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 safe-top">
      <h1 className="text-2xl font-bold text-white mb-2">{note.title}</h1>
      <p className="text-xs text-slate-500 mb-6">
        Modifié le {format(new Date(note.updated_at), 'd MMM yyyy', { locale: fr })}
      </p>
      <div className="ProseMirror text-slate-200 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: note.content }} />
    </div>
  )
}

// ─── Router ───────────────────────────────────────────────────────────────────

function NoteEditorWrapper() {
  const { noteId } = useParams()
  return <NoteEditor noteId={noteId} />
}

export default function Notes() {
  return (
    <Routes>
      <Route path="/" element={<NotesList />} />
      <Route path="/:noteId" element={<NoteEditorWrapper />} />
      <Route path="/shared/:sharedId" element={<SharedNoteViewer />} />
    </Routes>
  )
}
