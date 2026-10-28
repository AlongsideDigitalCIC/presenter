import { Edit3, CheckCircle, Circle, Plus, Minus, Book, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { generateSlidesForChapter } from '../services/bibleService';
import { getFontFamilyCss } from '../utils/fonts';
import { AutoFitLyrics, AutoFitLiturgy } from './OutputScreen';

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
  onChangeLinesPerSlide,
  displaySettings = null,
  displayFont = 'Inter',
  ccliSettings = null
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

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col mb-6 border-b border-[#E4E1DA] pb-4 gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Dynamic "Add/Remove Selected" Button */}
          {isServiceItem ? (
            selectedIndices?.size > 0 && (
              <button
                onClick={() => {
                  if (onRemoveSelectedFromService) {
                     onRemoveSelectedFromService();
                  }
                }}
                className="flex items-center justify-center h-10 gap-2 px-6 py-2 bg-[#B91C1C] hover:bg-[#991B1B] text-white rounded-xl transition-colors font-bold text-xs uppercase tracking-widest shadow-sm cursor-pointer"
              >
                <Minus size={16} strokeWidth={3} />
                Remove Selected ({selectedIndices.size})
              </button>
            )
          ) : (
            <button
                onClick={onAddSelectedToService}
                disabled={item.isBibleBook && (!slides || slides.length === 0)}
                className="flex items-center justify-center h-10 gap-2 px-6 py-2 bg-[#7A502A] hover:bg-[#654121] text-white rounded-xl transition-colors font-bold text-xs uppercase tracking-widest shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
                 className="flex items-center gap-2 bg-[#FAF6F0] border border-[#E4E1DA] hover:bg-[#F0EBE1] rounded-xl px-4 h-10 text-[#1C355E] font-bold text-sm transition-colors cursor-pointer"
               >
                 <Book size={16} className="text-[#3D7B8C]" />
                 {item.reference?.replace(item.bookData?.book, '').trim() ? `Chapter ${item.reference.replace(item.bookData.book, '').trim()}` : 'Select Chapter...'}
                 <ChevronDown size={14} className={`text-[#526075] transition-transform ${isChapterMenuOpen ? 'rotate-180' : ''}`} />
               </button>

               {isChapterMenuOpen && (
                 <>
                   <div 
                     className="fixed inset-0 z-40" 
                     onClick={() => setIsChapterMenuOpen(false)} 
                   />
                   <div className="absolute top-full left-0 mt-2 bg-white border border-[#E4E1DA] rounded-2xl shadow-lg p-4 z-50 w-72 max-h-80 overflow-y-auto custom-scrollbar animate-in slide-in-from-top-2 fade-in duration-200">
                     <div className="text-xs font-bold text-[#526075] uppercase tracking-widest mb-3 px-1">Select Chapter</div>
                     <div className="grid grid-cols-5 gap-2">
                        {item.bookData.chapters.map(c => (
                           <button 
                             key={c.chapter}
                             onClick={() => {
                                const chapterNum = c.chapter;
                                const generated = generateSlidesForChapter(item.bookData, chapterNum, linesPerSlide || 1);
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
                             className={`aspect-square flex items-center justify-center rounded-xl font-bold text-sm transition-colors cursor-pointer ${
                               item.reference?.replace(item.bookData?.book, '').trim() === c.chapter.toString()
                                 ? 'bg-[#1C355E] text-white'
                                 : 'bg-[#FAF6F0] hover:bg-[#F0EBE1] text-[#1C355E]'
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

          {/* Lines / Verses per slide toggle */}
          {(isSong || item.type === 'liturgy' || item.type === 'bible') && item.rawText && onChangeLinesPerSlide && (
            <div className="flex items-center h-10 gap-1 bg-[#FAF6F0] border border-[#E4E1DA] rounded-xl overflow-hidden p-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#526075] px-2">
                {item.type === 'bible' ? 'Verses' : 'Lines'}
              </span>
              {[1, 2, 3, 4].map(n => (
                <button
                  key={n}
                  onClick={() => onChangeLinesPerSlide(n)}
                  className={`w-8 h-8 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
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

          {(isSong || item.type === 'liturgy') && onEdit && (
            <button
              onClick={() => onEdit(item)}
              className="flex items-center justify-center h-10 gap-2 px-4 py-2 bg-[#FAF6F0] hover:bg-[#F0EBE1] text-[#1C355E] rounded-xl border border-[#E4E1DA] transition-colors font-bold text-xs uppercase tracking-widest shadow-sm cursor-pointer"
            >
              <Edit3 size={14} className="text-[#3D7B8C]" />
              {isSong ? 'Edit Song' : 'Edit Liturgy'}
            </button>
          )}
        </div>

        <div className="flex flex-col">
          <h2 className="text-3xl font-extrabold text-[#1C355E] tracking-tight">{title}</h2>
          {subtitle && (
            <div className="text-sm font-bold text-[#526075] mt-2 uppercase tracking-widest leading-none">
              {subtitle}
            </div>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-32 pt-2 px-1">
        {item.isBibleBook && slides.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-[#526075]">
             <Book size={48} className="mb-4 text-[#3D7B8C]/60" />
             <p className="text-xl font-bold tracking-widest uppercase text-[#1C355E]">Select a Chapter</p>
             <p className="text-sm mt-2 font-medium text-[#526075]">Choose a chapter from the dropdown above to view verses.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-6 2xl:gap-x-8 gap-y-8 2xl:gap-y-10">
          {slides.map((slide, i) => {
            const isResponse = slide.type === 'response';
            const isActiveCard = i === activeIndex;
            const catBg = displaySettings?.backgrounds?.[item.type] || null;
            const cardBgColor = catBg?.bgColor || (item.type === 'bible' ? '#161d2f' : '#111111');
            const cardBgType = catBg?.bgType || 'color';
            const cardBgImage = catBg?.bgImageUrl || null;
            const cardBgVideo = catBg?.bgVideoUrl || null;
            const cardBgDim = catBg?.bgDim !== undefined ? catBg.bgDim : 0.3;
            const resolvedFont = getFontFamilyCss(displayFont);
            const activeTextScale = displaySettings?.textScale ?? 1;

            return (
              <div key={i} ref={el => tileRefs.current[i] = el} className="flex flex-col gap-2 group">
                {/* 16:9 True-to-Projector Card */}
                <div
                  onClick={() => onSelectIndex && onSelectIndex(i)}
                  className={`aspect-video rounded-2xl flex flex-col relative cursor-pointer border-2 transition-all duration-200 overflow-hidden ${
                    isActiveCard
                      ? isResponse
                        ? 'border-[#C4956A] ring-2 ring-[#C4956A]/35 z-10'
                        : 'border-[#3D7B8C] ring-2 ring-[#3D7B8C]/35 z-10'
                      : isResponse
                        ? 'border-amber-800/70 hover:border-[#C4956A]'
                        : 'border-[#262626] hover:border-[#3D7B8C]'
                  } ${selectedIndices.has(i) && !isActiveCard ? 'border-[#3D7B8C] ring-2 ring-[#3D7B8C]/25' : ''}`}
                  style={{ backgroundColor: cardBgColor }}
                >
                  {cardBgType === 'image' && cardBgImage && (
                    <div className="absolute inset-0 pointer-events-none">
                      <img src={cardBgImage} alt="" className="w-full h-full object-cover" />
                      {cardBgDim > 0 && <div className="absolute inset-0 bg-black" style={{ opacity: cardBgDim }} />}
                    </div>
                  )}
                  {cardBgType === 'video' && cardBgVideo && (
                    <div className="absolute inset-0 pointer-events-none">
                      <video src={cardBgVideo} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                      {cardBgDim > 0 && <div className="absolute inset-0 bg-black" style={{ opacity: cardBgDim }} />}
                    </div>
                  )}

                  <div className="absolute inset-0 pointer-events-none" style={{ containerType: 'size' }}>
                    {item.type === 'liturgy' ? (
                      <AutoFitLiturgy
                        lines={slide.content || []}
                        liturgyType={slide.type || 'speaker'}
                        alignment={slide.alignment || 'center'}
                        isLiveBroadcast={true}
                        fontFamily={resolvedFont}
                        fontName={displayFont}
                        textScale={activeTextScale}
                        linesPerSlide={linesPerSlide}
                      />
                    ) : (
                      <AutoFitLyrics
                        lines={slide.content || []}
                        subText={item.type === 'bible' ? slide.type : null}
                        isLiveBroadcast={true}
                        mediaType={item.type}
                        songMetadata={
                          isSong
                            ? {
                                title: item.title || '',
                                artist: item.artist || '',
                                ccli: item.ccli || '',
                                copyright: item.copyright || '',
                                isFirstSlide: i === 0,
                                isLastSlide: i === slides.length - 1
                              }
                            : null
                        }
                        ccliSettings={ccliSettings}
                        fontFamily={resolvedFont}
                        fontName={displayFont}
                        textScale={activeTextScale}
                        linesPerSlide={linesPerSlide}
                      />
                    )}
                  </div>

                  {/* Selection Indicator */}
                  <div 
                    onClick={(e) => { e.stopPropagation(); onToggleSelection(i); }}
                    className={`absolute top-3.5 right-3.5 z-30 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
                      selectedIndices.has(i) 
                        ? 'bg-[#3D7B8C] text-white shadow-sm' 
                        : 'bg-black/50 text-white/75 hover:bg-black/80 hover:text-white border border-white/20 opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    {selectedIndices.has(i) ? <CheckCircle size={20} /> : <Circle size={20} />}
                  </div>
                </div>

                {/* Label Row */}
                <div className="flex justify-between items-center px-3">
                  <div className={`text-[10px] font-bold uppercase tracking-[0.25em] transition-colors ${
                    isActiveCard || selectedIndices.has(i)
                      ? isResponse ? 'text-[#7A502A]' : 'text-[#3D7B8C]'
                      : isResponse ? 'text-[#7A502A]/80' : 'text-[#526075]'
                  }`}>
                    {isResponse ? '↩ ' : '› '}{slide.type}
                  </div>
                  <div className={`text-[10px] font-bold ${
                    isActiveCard || selectedIndices.has(i) ? 'text-[#1C355E]' : 'text-[#526075]'
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
