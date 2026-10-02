import { Edit3, CheckCircle, Circle, Plus, Minus, Book, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { generateSlidesForChapter } from '../services/bibleService';

/**
 * UniformTile: renders slide text at a fixed 18px font size for perfect continuity.
 */
function UniformTile({ lines }) {
  return (
    <div className="flex-1 w-full flex items-center justify-center overflow-hidden px-4 py-2">
      <div
        className="font-black text-[#1C355E] text-center leading-tight tracking-tight drop-shadow-2xl w-full"
        style={{ fontSize: '18px', whiteSpace: 'pre-wrap' }}
      >
        {lines.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
    </div>
  );
}

export default function PreviewEditor({ 
  item, 
  onUpdateItem,
  activeIndex, 
  selectedIndices = new Set(),
  isServiceItem = false,
  onToggleSelection,
  onSelectIndex, 
  onEdit, 
  onAddSelectedToService,
  onRemoveSelectedFromService,
  linesPerSlide = 2, 
  onChangeLinesPerSlide 
}) {
  const tileRefs = useRef([]);
  const [isChapterMenuOpen, setIsChapterMenuOpen] = useState(false);

  // Auto-scroll the active tile into view on keyboard navigation
  useEffect(() => {
    if (tileRefs.current[activeIndex]) {
      tileRefs.current[activeIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeIndex]);

  if (!item) return null;

  const slides = item.slides || [];
  const title = item.title || item.reference || 'Untitled';
  const subtitle = item.artist
    ? `${item.artist}${item.ccli ? ` | CCLI #${item.ccli}` : ''}`
    : (item.translation || '');
  const isSong = item.type === 'song';

  const handleAddSelected = () => {
    onAddSelectedToService();
  };

  const handleRemoveSelected = () => {
    onRemoveSelectedFromService();
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col mb-6 border-b border-[#3D7B8C]/10/50 pb-4 gap-4">
        <div className="flex items-center gap-3">
          {/* Dynamic "Add/Remove Selected" Button */}
          {isServiceItem ? (
            selectedIndices?.size > 0 && (
              <button
                onClick={() => {
                  if (onRemoveSelectedFromService) {
                     onRemoveSelectedFromService();
                  }
                }}
                className="flex items-center justify-center h-10 gap-2 px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl transition-all font-black text-xs uppercase tracking-widest shadow-lg shadow-red-900/20 active:scale-95"
              >
                <Minus size={16} strokeWidth={3} />
                Remove Selected ({selectedIndices.size})
              </button>
            )
          ) : (
            <button
                onClick={onAddSelectedToService}
                disabled={item.isBibleBook && (!slides || slides.length === 0)}
                className="flex items-center justify-center h-10 gap-2 px-6 py-2 bg-[#3D7B8C] hover:bg-[#3D7B8C]/90 text-white rounded-xl transition-all font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-900/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
              <Plus size={16} strokeWidth={3} />
              {selectedIndices?.size > 0 
                ? (item.type === 'bible' ? `Add Verses (${selectedIndices.size})` : `Add Selected (${selectedIndices.size})`) 
                : (item.type === 'bible' ? 'Add Chapter to Service' : 'Add To Service')}
            </button>
          )}

          {/* Chapter Selector for Full Bible Books */}
          {item.isBibleBook && item.bookData?.chapters && (
            <div className="relative">
               <button 
                 onClick={() => setIsChapterMenuOpen(!isChapterMenuOpen)}
                 className="flex items-center gap-2 bg-white border border-[#3D7B8C]/10 hover:bg-[#F7F7F7] rounded-xl px-4 h-10 text-[#1C355E] font-bold text-sm transition-all"
               >
                 <Book size={16} className="text-neutral-400" />
                 {item.reference?.replace(item.bookData?.book, '').trim() ? `Chapter ${item.reference.replace(item.bookData.book, '').trim()}` : 'Select Chapter...'}
                 <ChevronDown size={14} className={`text-neutral-400 transition-transform ${isChapterMenuOpen ? 'rotate-180' : ''}`} />
               </button>

               {isChapterMenuOpen && (
                 <>
                   <div 
                     className="fixed inset-0 z-40" 
                     onClick={() => setIsChapterMenuOpen(false)} 
                   />
                   <div className="absolute top-full left-0 mt-2 bg-white border border-[#3D7B8C]/20 rounded-2xl shadow-2xl p-4 z-50 w-72 max-h-80 overflow-y-auto custom-scrollbar animate-in slide-in-from-top-2 fade-in duration-200">
                     <div className="text-xs font-black text-neutral-400 uppercase tracking-widest mb-3 px-1">Select Chapter</div>
                     <div className="grid grid-cols-5 gap-2">
                        {item.bookData.chapters.map(c => (
                           <button 
                             key={c.chapter}
                             onClick={() => {
                                const chapterNum = c.chapter;
                                const generated = generateSlidesForChapter(item.bookData, chapterNum, 1);
                                if (onUpdateItem) {
                                   onUpdateItem({
                                      ...item,
                                      slides: generated.slides,
                                      rawText: generated.rawText,
                                      reference: generated.reference
                                   });
                                }
                                setIsChapterMenuOpen(false);
                             }}
                             className={`aspect-square flex items-center justify-center rounded-xl font-black text-sm transition-all ${
                               item.reference?.replace(item.bookData?.book, '').trim() === c.chapter.toString()
                                 ? 'bg-[#3D7B8C] text-white shadow-lg shadow-blue-900/30'
                                 : 'bg-[#F7F7F7] hover:bg-neutral-200 text-neutral-700 hover:text-[#1C355E]'
                             }`}
                           >
                              {c.chapter}
                           </button>
                        ))}
                     </div>
                   </div>
                 </>
               )}
            </div>
          )}

          {/* Lines per slide toggle */}
          {(isSong || item.type === 'liturgy') && onChangeLinesPerSlide && (
            <div className="flex items-center h-10 gap-1 bg-white border border-[#3D7B8C]/10 rounded-xl overflow-hidden p-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400 px-2">Lines</span>
              {[1, 2, 3, 4].map(n => (
                <button
                  key={n}
                  onClick={() => onChangeLinesPerSlide(n)}
                  className={`w-8 h-8 text-xs font-black rounded-lg transition-all ${
                    linesPerSlide === n
                      ? 'bg-[#3D7B8C] text-white shadow-[0_0_10px_rgba(59,130,246,0.4)]'
                      : 'text-neutral-400 hover:text-[#1C355E] hover:bg-neutral-200'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          )}

          {(isSong || item.type === 'liturgy') && onEdit && (
            <button
              onClick={() => onEdit(item)}
              className="flex items-center justify-center h-10 gap-2 px-4 py-2 bg-[#F7F7F7] hover:bg-neutral-200 text-neutral-700 hover:text-[#1C355E] rounded-xl border border-[#3D7B8C]/20/50 transition-all font-bold text-xs uppercase tracking-widest shadow-lg transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <Edit3 size={14} className="text-[#3D7B8C]" />
              {isSong ? 'Edit Song' : 'Edit Liturgy'}
            </button>
          )}
        </div>

        <div className="flex flex-col">
          <h2 className="text-3xl font-extrabold text-[#1C355E] tracking-tight">{title}</h2>
          {subtitle && (
            <div className="text-sm font-bold text-neutral-400 mt-2 uppercase tracking-widest leading-none">
              {subtitle}
            </div>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-32 pt-2 px-1">
        {item.isBibleBook && slides.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-neutral-400">
             <Book size={48} className="mb-4 opacity-50" />
             <p className="text-xl font-bold tracking-widest uppercase text-neutral-400">Select a Chapter</p>
             <p className="text-sm mt-2 font-medium opacity-75">Choose a chapter from the dropdown above to view verses.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-8 gap-y-12">
          {slides.map((slide, i) => {
            const isResponse = slide.type === 'response';
            const isActiveCard = i === activeIndex;
                      let sizeCqh = item.type === 'bible' ? 6.5 : 8.5;
                      let sizeCqw = item.type === 'bible' ? 4.5 : 5;

                      return (
              <div key={i} ref={el => tileRefs.current[i] = el} className="flex flex-col gap-2 group">
                {/* Card */}
                <div
                  onClick={() => onSelectIndex && onSelectIndex(i)}
                  className={`@container aspect-video rounded-3xl flex flex-col relative cursor-pointer border-2 transition-all duration-300 overflow-hidden ${
                    isActiveCard
                      ? isResponse
                        ? 'bg-[#111111] border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.3)] scale-[1.02] transform z-10'
                        : 'bg-[#111111] border-[#3D7B8C] shadow-[0_0_20px_rgba(61,123,140,0.5)] scale-[1.02] transform z-10'
                      : isResponse
                        ? 'bg-[#111111] border-amber-900/60 hover:border-amber-700/80 hover:scale-[1.01] transform'
                        : 'bg-[#111111] border-[#3D7B8C]/20 hover:border-[#3D7B8C]/50 hover:scale-[1.01] transform'
                  } ${selectedIndices.has(i) ? 'border-[#3D7B8C]/50' : ''}`}
                >
                  <div className={`flex-1 w-full flex flex-col ${
                    slide.alignment === 'left' ? 'items-start' : slide.alignment === 'right' ? 'items-end' : 'items-center'
                  } justify-center overflow-hidden px-6 py-2`}>
                    <div
                      className={`font-black ${
                        slide.alignment === 'left' ? 'text-left' : slide.alignment === 'right' ? 'text-right' : 'text-center'
                      } leading-tight tracking-tight drop-shadow-2xl w-full pr-1`}
                      style={{
                        fontSize: `min(${sizeCqh}cqh, ${sizeCqw}cqw)`,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        color: isResponse ? '#fcd34d' : '#ffffff',
                      }}
                    >
                      {slide.content?.map((line, li) => (
                        <div key={li}>{line}</div>
                      ))}
                    </div>
                    {item.type === 'bible' && slide.type && (
                      <div className="absolute bottom-[6%] w-full text-center font-semibold text-[#1C355E]/60 tracking-[0.2em] uppercase drop-shadow-2xl" style={{ fontSize: `min(${sizeCqh * 0.4}cqh, ${sizeCqw * 0.4}cqw)` }}>
                        {slide.type}
                      </div>
                    )}
                  </div>

                  {/* Selection Indicator */}
                  <div 
                    onClick={(e) => { e.stopPropagation(); onToggleSelection(i); }}
                    className={`absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                      selectedIndices.has(i) 
                        ? 'bg-[#3D7B8C] text-white scale-110 shadow-lg' 
                        : 'bg-white/40 text-[#1C355E]/40 hover:bg-white/60 hover:text-[#1C355E] opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    {selectedIndices.has(i) ? <CheckCircle size={20} /> : <Circle size={20} />}
                  </div>
                </div>

                {/* Label Row */}
                <div className="flex justify-between items-center px-4">
                  <div className={`text-[10px] font-black uppercase tracking-[0.3em] transition-colors ${
                    isActiveCard || selectedIndices.has(i)
                      ? isResponse ? 'text-amber-400' : 'text-[#3D7B8C]'
                      : isResponse ? 'text-amber-600/60' : 'text-neutral-400'
                  }`}>
                    {isResponse ? '↩ ' : '› '}{slide.type}
                  </div>
                  <div className={`text-[10px] font-black ${
                    isActiveCard || selectedIndices.has(i) ? 'text-[#3D7B8C]/80' : 'text-neutral-700'
                  }`}>
                    SLIDE {i + 1}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>
    </div>
  );
}
