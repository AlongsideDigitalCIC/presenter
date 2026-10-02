import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Bold, Italic, Underline, List, ListOrdered, 
  Type, Save, Plus, Trash2, FileText, ChevronRight,
  MessageSquare, MessageCircle, Eye, Edit3, User, Users,
  AlignLeft, AlignCenter, AlignRight
} from 'lucide-react';
import { parseLiturgyMarkdown, buildLiturgyMarkdown } from '../utils/liturgyParser';
import ConfirmModal from './ConfirmModal';

// ─── Toolbar Button ────────────────────────────────────────────────────────
function ToolbarBtn({ onClick, title, children, active, variant = 'default' }) {
  const base = 'p-2 rounded-lg transition-all flex items-center justify-center gap-1.5 text-xs font-black uppercase tracking-wider select-none';
  const variants = {
    default: active
      ? 'bg-neutral-200 text-[#1C355E] shadow-inner'
      : 'text-neutral-400 hover:text-[#1C355E] hover:bg-[#F7F7F7]',
    speaker: active
      ? 'bg-white/20 text-[#1C355E] shadow-inner border border-white/30'
      : 'text-[#1C355E]/60 hover:text-[#1C355E] hover:bg-[#F7F7F7]/10 border border-black/10',
    response: active
      ? 'bg-amber-500/30 text-amber-300 shadow-inner border border-amber-500/40'
      : 'text-amber-500/60 hover:text-amber-300 hover:bg-amber-500/10 border border-amber-500/10',
    candidate: active
      ? 'bg-green-500/30 text-green-300 shadow-inner border border-green-500/40'
      : 'text-green-500/60 hover:text-green-300 hover:bg-green-500/10 border border-green-500/10',
    group: active
      ? 'bg-[#3D7B8C]/30 text-blue-300 shadow-inner border border-[#3D7B8C]/40'
      : 'text-[#3D7B8C]/60 hover:text-blue-300 hover:bg-[#3D7B8C]/10 border border-[#3D7B8C]/10',
  };
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className={`${base} ${variants[variant]}`}
    >
      {children}
    </button>
  );
}

// ─── Mini Preview of a Liturgy Slide ──────────────────────────────────────
function LiturgyPreviewSlide({ slide, isActive, onClick }) {
  const isResponse = slide.type === 'response';
  const isCandidate = slide.type === 'candidate';
  const isGroup = slide.type === 'group';
  const textAlign = slide.alignment === 'left' ? 'text-left' : slide.alignment === 'right' ? 'text-right' : 'text-center';
  const itemsAlign = slide.alignment === 'left' ? 'items-start' : slide.alignment === 'right' ? 'items-end' : 'items-center';

  return (
    <div
      onClick={onClick}
      className={`p-3 rounded-xl cursor-pointer transition-all border flex flex-col ${itemsAlign} ${
        isActive
          ? isCandidate
            ? 'bg-green-950/40 border-green-500/50 shadow-[inset_0_0_12px_rgba(74,222,128,0.1)]'
            : isGroup
            ? 'bg-blue-950/40 border-[#3D7B8C]/50 shadow-[inset_0_0_12px_rgba(59,130,246,0.1)]'
            : isResponse
            ? 'bg-amber-950/40 border-amber-500/50 shadow-[inset_0_0_12px_rgba(245,158,11,0.1)]'
            : 'bg-neutral-200/70 border-neutral-500/50'
          : 'bg-white/60 border-[#3D7B8C]/10/60 hover:border-[#3D7B8C]/20'
      }`}
    >
      <div className={`text-[9px] font-black uppercase tracking-widest mb-1.5 w-full ${textAlign} ${isCandidate ? 'text-green-400' : isGroup ? 'text-[#3D7B8C]' : isResponse ? 'text-amber-400' : 'text-neutral-400'}`}>
        {isCandidate ? '• Individual' : isGroup ? '👥 Group' : isResponse ? '↩ Response' : '› Speaker'}
        {slide.alignment !== 'center' && <span className="ml-2 opacity-50">({slide.alignment})</span>}
      </div>
      {slide.content.map((line, i) => (
        <div
          key={i}
          className={`text-xs font-medium leading-relaxed truncate w-full ${textAlign} ${isCandidate ? 'text-green-200/80' : isGroup ? 'text-blue-200/80' : isResponse ? 'text-amber-200/80' : 'text-neutral-700'}`}
        >
          {line}
        </div>
      ))}
    </div>
  );
}

// ─── Main LiturgyEditor ───────────────────────────────────────────────────
export default function LiturgyEditor({ 
  libraryHandle, 
  initialFile = null,    // { name, handle } — null = new file
  onSaved,
  onDeleted,
  onRefresh,
}) {
  const [title, setTitle]     = useState('');
  const [body, setBody]       = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const textareaRef = useRef(null);

  // Load file if editing
  useEffect(() => {
    if (initialFile) {
      const load = async () => {
        try {
          const file = await initialFile.handle.getFile();
          const text = await file.text();
          const parsed = parseLiturgyMarkdown(text);
          setTitle(parsed.metadata.title || initialFile.name.replace('.md', ''));
          // Rebuild body (strip frontmatter)
          const bodyOnly = text.replace(/^---\n[\s\S]*?\n---\n*/m, '').trim();
          setBody(bodyOnly);
        } catch (err) {
          console.error('Failed to load liturgy file', err);
        }
      };
      load();
    } else {
      setTitle('');
      setBody('');
    }
    setIsDirty(false);
  }, [initialFile]);

  // Use a temporary parser for preview with a reasonable default linesPerSlide
  const slides = parseLiturgyMarkdown(buildLiturgyMarkdown(title || 'Untitled', body), 2).slides;

  // ── Text Insertion Helpers ──────────────────────────────────────────────
  const insertAtCursor = useCallback((before, after = '', defaultText = '') => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = ta.value.slice(start, end) || defaultText;
    const newVal = ta.value.slice(0, start) + before + selected + after + ta.value.slice(end);
    setBody(newVal);
    setIsDirty(true);
    // Restore cursor
    requestAnimationFrame(() => {
      ta.focus();
      const newCursorPos = start + before.length + selected.length + after.length;
      ta.setSelectionRange(newCursorPos, newCursorPos);
    });
  }, []);

  const insertLineTag = useCallback((tag) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const lineStart = ta.value.lastIndexOf('\n', start - 1) + 1;
    const insert = `${tag}\n`;
    const newVal = ta.value.slice(0, lineStart) + insert + ta.value.slice(lineStart);
    setBody(newVal);
    setIsDirty(true);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = lineStart + insert.length;
      ta.setSelectionRange(pos, pos);
    });
  }, []);

  const insertListItem = useCallback((prefix) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const before = ta.value.slice(0, start);
    const needsNewline = before.length > 0 && !before.endsWith('\n');
    const insert = (needsNewline ? '\n' : '') + prefix + ' ';
    const newVal = ta.value.slice(0, start) + insert + ta.value.slice(start);
    setBody(newVal);
    setIsDirty(true);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + insert.length;
      ta.setSelectionRange(pos, pos);
    });
  }, []);

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!libraryHandle) return;
    const safeTitle = (title || 'Untitled').trim();
    const filename = safeTitle.replace(/[^a-z0-9\s\-_]/gi, '').replace(/\s+/g, '_') + '.md';
    try {
      setIsSaving(true);
      const dir = await libraryHandle.getDirectoryHandle('Liturgy', { create: true });
      
      // If renaming, remove old file
      if (initialFile && initialFile.name !== filename) {
        try { await dir.removeEntry(initialFile.name); } catch {}
      }

      const fileHandle = await dir.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(buildLiturgyMarkdown(safeTitle, body));
      await writable.close();
      setIsDirty(false);
      if (onSaved) onSaved({ name: filename, handle: fileHandle });
      if (onRefresh) onRefresh();
    } catch (err) {
      alert('Save failed: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!libraryHandle || !initialFile) return;
    try {
      const dir = await libraryHandle.getDirectoryHandle('Liturgy', { create: false });
      await dir.removeEntry(initialFile.name);
      setShowDeleteConfirm(false);
      if (onDeleted) onDeleted(initialFile.name);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert('Delete failed: ' + err.message);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full gap-0 overflow-hidden animate-in fade-in duration-300">

      {/* ── Top Bar ────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 pb-4 border-b border-[#3D7B8C]/10/60 flex-shrink-0">
        <div className="flex-1 min-w-0">
          <input
            type="text"
            placeholder="Liturgy Title..."
            value={title}
            onChange={(e) => { setTitle(e.target.value); setIsDirty(true); }}
            className="w-full bg-transparent text-[#1C355E] font-extrabold text-2xl tracking-tight outline-none placeholder-neutral-700 border-b border-transparent focus:border-[#3D7B8C]/10 transition pb-1"
          />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setShowPreview(v => !v)}
            className={`p-2 px-3 rounded-xl transition text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border shadow-lg ${
              showPreview
                ? 'bg-[#3D7B8C]/30 text-blue-300 border-[#3D7B8C]/40'
                : 'bg-white/60 text-neutral-400 border-[#3D7B8C]/10 hover:bg-[#F7F7F7] hover:text-[#1C355E]'
            }`}
          >
            {showPreview ? <Edit3 size={14} /> : <Eye size={14} />}
            {showPreview ? 'Exit Preview' : 'Show Preview'}
          </button>
          {initialFile && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 rounded-xl transition text-neutral-400 hover:text-[#C4956A] hover:bg-red-500/10 border border-[#3D7B8C]/10"
              title="Delete this file"
            >
              <Trash2 size={14} />
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving || !title.trim()}
            className="flex items-center gap-2 px-6 py-2 bg-[#3D7B8C] hover:bg-[#3D7B8C] disabled:opacity-40 text-white text-[10px] font-black uppercase tracking-widest rounded-xl border border-blue-400/20 shadow-xl transition active:scale-95"
          >
            <Save size={14} />
            {isSaving ? 'Saving...' : isDirty ? 'Save Changes' : 'Saved'}
          </button>
        </div>
      </div>

      {/* ── Toolbar ──────────────────────────────────────────────── */}
      {!showPreview && (
        <div className="flex items-center gap-2 py-4 border-b border-[#3D7B8C]/10/40 flex-shrink-0 flex-wrap">
          {/* Speaker / Response / Candidate */}
          <div className="flex items-center gap-1.5 pr-4 border-r border-[#3D7B8C]/10">
            <ToolbarBtn
              onClick={() => insertLineTag('[/speaker]')}
              title="Speaker Block"
              variant="speaker"
            >
              <MessageSquare size={14} />
              <span>Speaker</span>
            </ToolbarBtn>
            <ToolbarBtn
              onClick={() => insertLineTag('[/response]')}
              title="All Response Block"
              variant="response"
            >
              <MessageCircle size={14} />
              <span>Response</span>
            </ToolbarBtn>
            <ToolbarBtn
              onClick={() => insertLineTag('[/candidate]')}
              title="Individual / Special Response Block"
              variant="candidate"
            >
              <User size={14} />
              <span>Individual</span>
            </ToolbarBtn>
            <ToolbarBtn
              onClick={() => insertLineTag('[/group]')}
              title="Group Response Block"
              variant="group"
            >
              <Users size={14} />
              <span>Group</span>
            </ToolbarBtn>
          </div>

          {/* Alignment */}
          <div className="flex items-center gap-1 pr-4 border-r border-[#3D7B8C]/10">
            <ToolbarBtn onClick={() => insertLineTag('[/speaker:left]')} title="Align Left">
              <AlignLeft size={14} />
            </ToolbarBtn>
            <ToolbarBtn onClick={() => insertLineTag('[/speaker:center]')} title="Align Center">
              <AlignCenter size={14} />
            </ToolbarBtn>
            <ToolbarBtn onClick={() => insertLineTag('[/speaker:right]')} title="Align Right">
              <AlignRight size={14} />
            </ToolbarBtn>
          </div>

          {/* Formatting */}
          <div className="flex items-center gap-1 pr-4 border-r border-[#3D7B8C]/10">
            <ToolbarBtn onClick={() => insertAtCursor('**', '**', 'bold text')} title="Bold">
              <Bold size={14} />
            </ToolbarBtn>
            <ToolbarBtn onClick={() => insertAtCursor('*', '*', 'italic text')} title="Italic">
              <Italic size={14} />
            </ToolbarBtn>
            <ToolbarBtn onClick={() => insertAtCursor('<u>', '</u>', 'underlined text')} title="Underline">
              <Underline size={14} />
            </ToolbarBtn>
          </div>

          {/* Headers */}
          <div className="flex items-center gap-1 pr-4 border-r border-[#3D7B8C]/10">
            <ToolbarBtn onClick={() => insertAtCursor('# ', '', 'Heading 1')} title="Heading 1">
              <Type size={14} /><span className="text-[10px]">H1</span>
            </ToolbarBtn>
            <ToolbarBtn onClick={() => insertAtCursor('## ', '', 'Heading 2')} title="Heading 2">
              <span className="text-[10px]">H2</span>
            </ToolbarBtn>
          </div>

          {/* Lists */}
          <div className="flex items-center gap-1">
            <ToolbarBtn onClick={() => insertListItem('-')} title="Bullet List">
              <List size={14} />
            </ToolbarBtn>
            <ToolbarBtn onClick={() => insertListItem('1.')} title="Numbered List">
              <ListOrdered size={14} />
            </ToolbarBtn>
          </div>
        </div>
      )}

      {/* ── Editor / Preview Pane ──────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex gap-6 pt-6">
        {!showPreview ? (
          /* ── Raw Editor ── */
          <div className="flex-1 h-full flex flex-col">
            <textarea
              ref={textareaRef}
              value={body}
              onChange={(e) => { setBody(e.target.value); setIsDirty(true); }}
              placeholder={`Type your liturgy here...\n\nUse the toolbar to add block markers with alignment.\n\nExample:\n[/speaker:left]\nThis text will be white and left-aligned.\n\n[/response:right]\nThis text will be yellow and right-aligned.\n\n[/candidate:center]\nThis text will be green.`}
              className="flex-1 w-full bg-white/40 border border-[#3D7B8C]/10/50 rounded-2xl text-sm font-mono text-neutral-700 p-6 outline-none resize-none focus:border-[#3D7B8C]/20 transition custom-scrollbar leading-relaxed placeholder-neutral-800 shadow-inner"
              spellCheck={true}
            />
            <div className="text-[10px] text-neutral-600 mt-3 px-1 font-bold uppercase tracking-widest flex items-center gap-3">
              <span className="text-[#1C355E]/20">Formatting Help:</span>
              <span>**Bold**</span>
              <span>*Italic*</span>
              <span><u>Underline</u></span>
              <span className="ml-auto opacity-50">Markdown supported</span>
            </div>
          </div>
        ) : (
          /* ── Preview ── */
          <div className="flex-1 h-full overflow-y-auto custom-scrollbar pr-4">
            {slides.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full opacity-20">
                <FileText size={64} className="text-neutral-400 mb-4" />
                <div className="text-neutral-400 font-black uppercase tracking-widest">Empty Liturgy</div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {slides.map((slide, i) => (
                  <LiturgyPreviewSlide key={i} slide={slide} isActive={false} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Slide Strip ── */}
        {!showPreview && slides.length > 0 && (
          <div className="w-56 flex-shrink-0 h-full overflow-y-auto custom-scrollbar border-l border-[#3D7B8C]/10/30 pl-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-neutral-700 mb-4 px-1 flex justify-between">
              <span>Timeline</span>
              <span>{slides.length} slides</span>
            </div>
            <div className="space-y-4 pb-12">
              {slides.map((slide, i) => (
                <LiturgyPreviewSlide key={i} slide={slide} isActive={false} />
              ))}
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete Liturgy File?"
        message={`This will permanently remove "${initialFile?.name?.replace('.md', '')}". This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        confirmText="Permanently Delete"
      />
    </div>
  );
}
