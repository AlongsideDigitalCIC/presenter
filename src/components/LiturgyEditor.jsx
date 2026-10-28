import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Bold, Italic, Underline, List, ListOrdered, 
  Type, Save, Plus, Trash2, FileText, ChevronRight,
  MessageSquare, MessageCircle, Eye, Edit3, User, Users,
  AlignLeft, AlignCenter, AlignRight
} from 'lucide-react';
import { parseLiturgyMarkdown, buildLiturgyMarkdown } from '../utils/liturgyParser';
import ConfirmModal from './ConfirmModal';
import { getFontFamilyCss } from '../utils/fonts';
import { AutoFitLiturgy } from './OutputScreen';
import { parseLiturgyLineFormatting } from '../utils/slideLayout';

// ─── Toolbar Button ────────────────────────────────────────────────────────
function ToolbarBtn({ onClick, title, children, active, variant = 'default' }) {
  const base = 'p-2 px-2.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider select-none cursor-pointer';
  const variants = {
    default: active
      ? 'bg-[#1C355E] text-white'
      : 'text-[#526075] hover:text-[#1C355E] hover:bg-[#FAF6F0]',
    speaker: active
      ? 'bg-[#1C355E] text-white border border-[#1C355E]'
      : 'bg-[#FAF6F0] text-[#1C355E] hover:bg-[#F0EBE1] border border-[#E4E1DA]',
    response: active
      ? 'bg-[#7A502A] text-white border border-[#7A502A]'
      : 'bg-[#FFFBEB] text-[#92400E] hover:bg-amber-100/70 border border-amber-300',
    candidate: active
      ? 'bg-emerald-700 text-white border border-emerald-700'
      : 'bg-emerald-50 text-[#166534] hover:bg-emerald-100/70 border border-emerald-300',
    group: active
      ? 'bg-[#3D7B8C] text-white border border-[#3D7B8C]'
      : 'bg-[#EDF4F6] text-[#2F6473] hover:bg-[#3D7B8C]/15 border border-[#3D7B8C]/35',
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
function LiturgyPreviewSlide({
  slide,
  isActive,
  onClick,
  liturgyBg = null,
  fontFamily = 'Inter, sans-serif',
  fontName = 'Inter',
  textScale = 1,
  linesPerSlide = 2,
  aspect16x9 = false
}) {
  const isResponse = slide.type === 'response';
  const isCandidate = slide.type === 'candidate';
  const isGroup = slide.type === 'group';
  const textAlign = slide.alignment === 'left' ? 'text-left' : slide.alignment === 'right' ? 'text-right' : 'text-center';
  const itemsAlign = slide.alignment === 'left' ? 'items-start' : slide.alignment === 'right' ? 'items-end' : 'items-center';
  const bgColor = liturgyBg?.bgColor || '#111827';
  const bgType = liturgyBg?.bgType || 'color';
  const bgImage = liturgyBg?.bgImageUrl || null;
  const bgDim = liturgyBg?.bgDim !== undefined ? liturgyBg.bgDim : 0.3;

  if (aspect16x9) {
    return (
      <div className="flex flex-col gap-1.5">
        <div
          onClick={onClick}
          className={`aspect-video rounded-2xl relative overflow-hidden border-2 transition-colors ${
            isActive
              ? 'border-[#3D7B8C] ring-2 ring-[#3D7B8C]/30'
              : 'border-[#1F2937] hover:border-[#3D7B8C]'
          }`}
          style={{ backgroundColor: bgColor, containerType: 'size' }}
        >
          {bgType === 'image' && bgImage && (
            <div className="absolute inset-0 pointer-events-none">
              <img src={bgImage} alt="" className="w-full h-full object-cover" />
              {bgDim > 0 && <div className="absolute inset-0 bg-black" style={{ opacity: bgDim }} />}
            </div>
          )}
          <AutoFitLiturgy
            lines={slide.content || []}
            liturgyType={slide.type || 'speaker'}
            alignment={slide.alignment || 'center'}
            isLiveBroadcast={true}
            fontFamily={fontFamily}
            fontName={fontName}
            textScale={textScale}
            linesPerSlide={linesPerSlide}
          />
        </div>
        <div className="flex items-center justify-between px-2 text-[10px] font-bold uppercase tracking-widest text-[#526075]">
          <span className={isCandidate ? 'text-emerald-700' : isGroup ? 'text-[#3D7B8C]' : isResponse ? 'text-[#7A502A]' : 'text-[#1C355E]'}>
            {isCandidate ? '• Individual' : isGroup ? '👥 Group' : isResponse ? '↩ Response' : '› Speaker'}
            {slide.alignment !== 'center' && <span className="ml-1.5 opacity-70">({slide.alignment})</span>}
          </span>
          <span>Slide {slide.index}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`p-3.5 rounded-xl cursor-pointer transition-colors border relative overflow-hidden flex flex-col ${itemsAlign} ${
        isActive
          ? isCandidate
            ? 'border-emerald-400 ring-2 ring-emerald-400/25'
            : isGroup
            ? 'border-[#3D7B8C] ring-2 ring-[#3D7B8C]/30'
            : isResponse
            ? 'border-amber-400 ring-2 ring-amber-400/25'
            : 'border-white/60'
          : 'border-[#1F2937] hover:border-[#3D7B8C]'
      }`}
      style={{ backgroundColor: bgColor }}
    >
      {bgType === 'image' && bgImage && (
        <div className="absolute inset-0 pointer-events-none">
          <img src={bgImage} alt="" className="w-full h-full object-cover" />
          {bgDim > 0 && <div className="absolute inset-0 bg-black" style={{ opacity: bgDim }} />}
        </div>
      )}
      <div className={`relative z-10 text-[9px] font-bold uppercase tracking-widest mb-1.5 w-full ${textAlign} ${isCandidate ? 'text-emerald-300' : isGroup ? 'text-sky-300' : isResponse ? 'text-amber-300' : 'text-white/70'}`}>
        {isCandidate ? '• Individual' : isGroup ? '👥 Group' : isResponse ? '↩ Response' : '› Speaker'}
        {slide.alignment !== 'center' && <span className="ml-2 opacity-70">({slide.alignment})</span>}
      </div>
      {slide.content.map((line, i) => {
        const parsed = parseLiturgyLineFormatting(line);
        return (
          <div
            key={i}
            className={`relative z-10 text-xs font-medium leading-relaxed truncate w-full drop-shadow ${textAlign} ${isCandidate ? 'text-emerald-200' : isGroup ? 'text-sky-200' : isResponse ? 'text-amber-200' : 'text-white'}`}
            style={{ fontFamily }}
          >
            {parsed.tokens.map((tok, ti) => {
              if (tok.type === 'bold') return <strong key={ti} className="font-bold">{tok.value}</strong>;
              if (tok.type === 'italic') return <em key={ti} className="italic">{tok.value}</em>;
              if (tok.type === 'underline') return <span key={ti} className="underline">{tok.value}</span>;
              return <span key={ti}>{tok.value}</span>;
            })}
          </div>
        );
      })}
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
  displaySettings = null,
  displayFont = 'Inter',
  linesPerSlide = 2,
  onChangeLinesPerSlide = null
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

  // Parse preview slides using the active linesPerSlide setting
  const slides = parseLiturgyMarkdown(buildLiturgyMarkdown(title || 'Untitled', body), linesPerSlide || 2).slides;

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
        try { 
          await dir.removeEntry(initialFile.name); 
        } catch {
          // Old file may not exist yet if newly created
        }
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
      <div className="flex items-center gap-3 pb-4 border-b border-[#E4E1DA] flex-shrink-0">
        <div className="flex-1 min-w-0">
          <input
            type="text"
            placeholder="Liturgy Title..."
            value={title}
            onChange={(e) => { setTitle(e.target.value); setIsDirty(true); }}
            className="w-full bg-transparent text-[#1C355E] font-extrabold text-2xl tracking-tight outline-none placeholder:text-[#526075]/60 border-b border-transparent focus:border-[#3D7B8C] transition-colors pb-1"
          />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {onChangeLinesPerSlide && (
            <div className="flex items-center h-9 gap-0.5 bg-[#FAF6F0] border border-[#E4E1DA] rounded-xl overflow-hidden p-1">
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#526075] px-1.5">Lines</span>
              {[1, 2, 3, 4].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onChangeLinesPerSlide(n)}
                  className={`w-7 h-7 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                    linesPerSlide === n
                      ? 'bg-[#1C355E] text-white'
                      : 'text-[#526075] hover:text-[#1C355E] hover:bg-[#F0EBE1]'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => setShowPreview(v => !v)}
            className={`p-2 px-3 rounded-xl transition-colors text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 border shadow-sm cursor-pointer ${
              showPreview
                ? 'bg-[#1C355E] text-white border-[#1C355E]'
                : 'bg-[#FAF6F0] text-[#1C355E] border-[#E4E1DA] hover:bg-[#F0EBE1]'
            }`}
          >
            {showPreview ? <Edit3 size={14} /> : <Eye size={14} />}
            {showPreview ? 'Exit Preview' : 'Show Preview'}
          </button>
          {initialFile && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 rounded-xl transition-colors text-[#526075] hover:text-[#B91C1C] hover:bg-rose-50 border border-[#E4E1DA] cursor-pointer"
              title="Delete this file"
            >
              <Trash2 size={14} />
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving || !title.trim()}
            className="flex items-center gap-2 px-6 py-2 bg-[#7A502A] hover:bg-[#654121] disabled:opacity-40 text-white text-[10px] font-bold uppercase tracking-widest rounded-xl shadow-sm transition-colors cursor-pointer"
          >
            <Save size={14} />
            {isSaving ? 'Saving...' : isDirty ? 'Save Changes' : 'Saved'}
          </button>
        </div>
      </div>

      {/* ── Toolbar ──────────────────────────────────────────────── */}
      {!showPreview && (
        <div className="flex items-center gap-2 py-4 border-b border-[#E4E1DA] flex-shrink-0 flex-wrap">
          {/* Speaker / Response / Candidate */}
          <div className="flex items-center gap-1.5 pr-4 border-r border-[#E4E1DA]">
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
          <div className="flex items-center gap-1 pr-4 border-r border-[#E4E1DA]">
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
          <div className="flex items-center gap-1 pr-4 border-r border-[#E4E1DA]">
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
          <div className="flex items-center gap-1 pr-4 border-r border-[#E4E1DA]">
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
              className="flex-1 w-full bg-[#FAF6F0] border border-[#E4E1DA] rounded-2xl text-sm font-mono text-[#1C355E] p-6 outline-none resize-none focus:border-[#3D7B8C] transition-colors custom-scrollbar leading-relaxed placeholder:text-[#526075]/60"
              spellCheck={true}
            />
            <div className="text-[10px] text-[#526075] mt-3 px-1 font-bold uppercase tracking-widest flex items-center gap-3">
              <span className="text-[#1C355E]">Formatting Help:</span>
              <span>**Bold**</span>
              <span>*Italic*</span>
              <span><u>Underline</u></span>
              <span className="ml-auto text-[#526075]/80">Markdown supported</span>
            </div>
          </div>
        ) : (
          /* ── Preview ── */
          <div className="flex-1 h-full overflow-y-auto custom-scrollbar pr-4">
            {slides.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-[#526075]">
                <FileText size={64} className="text-[#3D7B8C]/40 mb-4" />
                <div className="text-[#1C355E] font-bold uppercase tracking-widest">Empty Liturgy</div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-10">
                {slides.map((slide, i) => (
                  <LiturgyPreviewSlide
                    key={i}
                    slide={slide}
                    isActive={false}
                    liturgyBg={displaySettings?.backgrounds?.liturgy}
                    fontFamily={getFontFamilyCss(displayFont)}
                    fontName={displayFont}
                    textScale={displaySettings?.textScale ?? 1}
                    linesPerSlide={linesPerSlide}
                    aspect16x9={true}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Slide Strip ── */}
        {!showPreview && slides.length > 0 && (
          <div className="w-56 flex-shrink-0 h-full overflow-y-auto custom-scrollbar border-l border-[#E4E1DA] pl-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#526075] mb-4 px-1 flex justify-between">
              <span>Timeline</span>
              <span>{slides.length} slides</span>
            </div>
            <div className="space-y-3 pb-12">
              {slides.map((slide, i) => (
                <LiturgyPreviewSlide
                  key={i}
                  slide={slide}
                  isActive={false}
                  liturgyBg={displaySettings?.backgrounds?.liturgy}
                  fontFamily={getFontFamilyCss(displayFont)}
                />
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
