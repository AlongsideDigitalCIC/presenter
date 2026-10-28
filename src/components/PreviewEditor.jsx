import { 
  Edit3, CheckCircle, Circle, Plus, Minus, Book, ChevronDown, 
  Edit2, GripVertical, X, RotateCcw, Check, Sparkles, AlertCircle, ArrowLeft, ArrowRight 
} from 'lucide-react';
import { useEffect, useRef, useState, useMemo } from 'react';
import { generateSlidesForChapter } from '../services/bibleService';
import { getFontFamilyCss } from '../utils/fonts';
import { AutoFitLyrics, AutoFitLiturgy } from './OutputScreen';
import { parseSongMarkdown, patchSlideInRawText } from '../utils/songParser';

function getSectionBadgeStyle(secName) {
  const s = (secName || '').toLowerCase();
  if (s.startsWith('verse')) {
    return 'bg-[#1C355E] text-white border-[#1C355E]';
  }
  if (s.startsWith('chorus')) {
    return 'bg-[#3D7B8C] text-white border-[#3D7B8C]';
  }
  if (s.startsWith('bridge')) {
    return 'bg-[#5B4A82] text-white border-[#5B4A82]';
  }
  if (s.includes('pre-chorus') || s.includes('prechorus')) {
    return 'bg-[#7A502A] text-white border-[#7A502A]';
  }
  if (s.startsWith('tag') || s.startsWith('ending') || s.startsWith('outro')) {
    return 'bg-[#7A3E4D] text-white border-[#7A3E4D]';
  }
  return 'bg-[#334155] text-white border-[#334155]';
}

export default function PreviewEditor({ 
  item, 
  onUpdateItem,
  onSaveMasterSongText = null,
  isLive = false,
  liveItem = null,
  liveSlideIndex = 0,
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
  const [draggedArrIdx, setDraggedArrIdx] = useState(null);
  const [isArrangementModalOpen, setIsArrangementModalOpen] = useState(false);

  // Quick-Fix Modal State
  const [quickEditSlide, setQuickEditSlide] = useState(null); // { index, slide }
  const [quickEditText, setQuickEditText] = useState('');
  const [saveToMaster, setSaveToMaster] = useState(true);
  const [toastMessage, setToastMessage] = useState(null);

  // Auto-scroll the active tile into view on keyboard navigation
  useEffect(() => {
    if (tileRefs.current[activeIndex]) {
      tileRefs.current[activeIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeIndex]);

  const isSong = item?.type === 'song';

  // Ensure rawText is always available (reconstructing from slides if ever missing)
  const effectiveRawText = useMemo(() => {
    if (item?.rawText && typeof item.rawText === 'string' && item.rawText.trim().length > 0) {
      return item.rawText;
    }
    const currentSlides = item?.slides || [];
    if (currentSlides.length > 0) {
      let md = item?.title ? `---\ntitle: ${item.title}\n---\n\n` : '';
      let lastType = null;
      currentSlides.forEach(s => {
        if (s.type !== lastType) {
          md += `\n[${s.type}]\n`;
          lastType = s.type;
        }
        md += (s.content || []).join('\n') + '\n';
      });
      return md.trim();
    }
    return '';
  }, [item?.rawText, item?.title, item?.slides]);

  // Compute parsed song info
  const parsedSongInfo = useMemo(() => {
    if (!isSong || !effectiveRawText) return null;
    return parseSongMarkdown(effectiveRawText, linesPerSlide, item.arrangement || null);
  }, [isSong, effectiveRawText, linesPerSlide, item.arrangement]);

  // Master bank of ALL unique sections originally in the song.
  // This NEVER shrinks when a section is removed from the active arrangement, so the user can always add it back!
  const allAvailableSections = useMemo(() => {
    const fromParsed = parsedSongInfo?.uniqueSections || [];
    const fromSlides = Array.from(new Set((item?.slides || []).map(s => s.type).filter(Boolean)));
    const fromArr = Array.isArray(item?.arrangement) ? item.arrangement : [];
    const fromItemUnique = Array.isArray(item?.uniqueSections) ? item.uniqueSections : [];
    const fromNatural = Array.isArray(item?.naturalOrder) ? item.naturalOrder : [];
    const merged = Array.from(new Set([...fromParsed, ...fromItemUnique, ...fromNatural, ...fromSlides, ...fromArr]));
    return merged.length > 0 ? merged : ['Verse 1', 'Chorus'];
  }, [parsedSongInfo, item?.slides, item?.arrangement, item?.uniqueSections, item?.naturalOrder]);

  const naturalOrder = useMemo(() => {
    if (parsedSongInfo?.naturalOrder?.length > 0) return parsedSongInfo.naturalOrder;
    if (Array.isArray(item?.naturalOrder) && item.naturalOrder.length > 0) return item.naturalOrder;
    return allAvailableSections;
  }, [parsedSongInfo, item?.naturalOrder, allAvailableSections]);

  const currentArrangement = useMemo(() => {
    if (Array.isArray(item?.arrangement) && item.arrangement.length > 0) {
      return item.arrangement;
    }
    return naturalOrder;
  }, [item?.arrangement, naturalOrder]);

  const isArrangementModified = Boolean(
    Array.isArray(item?.arrangement) &&
    (item.arrangement.length !== naturalOrder.length ||
     item.arrangement.some((sec, idx) => sec !== naturalOrder[idx]))
  );

  if (!item) return null;

  const slides = item.slides || [];
  const title = item.title || item.reference || 'Untitled';
  const subtitle = item.artist
    ? `${item.artist}${item.ccli ? ` | CCLI #${item.ccli}` : ''}`
    : (item.translation || '');

  // ----------------------------------------------------
  // Arrangement Handlers (Per-Service, Zero Disk Alteration)
  // ----------------------------------------------------
  const handleUpdateArrangement = (newArrangement) => {
    if (!onUpdateItem) return;
    const reParsed = parseSongMarkdown(effectiveRawText, linesPerSlide, newArrangement);
    onUpdateItem({
      ...item,
      arrangement: newArrangement,
      slides: reParsed.slides,
      uniqueSections: allAvailableSections,
      naturalOrder: naturalOrder,
      rawText: effectiveRawText
    });
  };

  const handleMoveArrangement = (index, delta) => {
    const targetIdx = index + delta;
    if (targetIdx < 0 || targetIdx >= currentArrangement.length) return;
    const next = [...currentArrangement];
    const [moved] = next.splice(index, 1);
    next.splice(targetIdx, 0, moved);
    handleUpdateArrangement(next);
  };

  const handleRemoveArrangement = (index) => {
    if (currentArrangement.length <= 1) return;
    const next = currentArrangement.filter((_, idx) => idx !== index);
    handleUpdateArrangement(next);
  };

  const handleAddArrangementSection = (secName) => {
    const next = [...currentArrangement, secName];
    handleUpdateArrangement(next);
  };

  const handleResetArrangement = () => {
    handleUpdateArrangement(naturalOrder);
  };

  const handleArrangementDragStart = (e, index) => {
    setDraggedArrIdx(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleArrangementDragOver = (e, targetIdx) => {
    e.preventDefault();
    if (draggedArrIdx === null || draggedArrIdx === targetIdx) return;
    const next = [...currentArrangement];
    const itemToMove = next.splice(draggedArrIdx, 1)[0];
    next.splice(targetIdx, 0, itemToMove);
    setDraggedArrIdx(targetIdx);
    handleUpdateArrangement(next);
  };

  const handleArrangementDrop = (e) => {
    e.preventDefault();
    setDraggedArrIdx(null);
  };

  // ----------------------------------------------------
  // Quick-Fix Slide Handlers
  // ----------------------------------------------------
  const openQuickFix = (slideIndex) => {
    const targetSlide = slides[slideIndex];
    if (!targetSlide) return;
    setQuickEditSlide({ index: slideIndex, slide: targetSlide });
    setQuickEditText((targetSlide.content || []).join('\n'));
    setSaveToMaster(true);
  };

  const handleSaveQuickFix = async () => {
    if (!quickEditSlide || !onUpdateItem) return;
    const newLines = quickEditText
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);

    if (newLines.length === 0) {
      alert("A slide cannot be empty. Please enter at least one line of text.");
      return;
    }

    const slideIdx = quickEditSlide.index;
    const oldSlide = quickEditSlide.slide;
    const updatedSlides = slides.map((s, idx) => {
      if (idx === slideIdx) {
        return { ...s, content: newLines };
      }
      return s;
    });

    let updatedRawText = effectiveRawText;
    const isCurrentlyLive = Boolean(isLive && liveItem?.id === item.id && liveSlideIndex === slideIdx);

    if (saveToMaster && isSong && item.filename && effectiveRawText) {
      updatedRawText = patchSlideInRawText(effectiveRawText, oldSlide.content, newLines, oldSlide.type);
      if (onSaveMasterSongText) {
        await onSaveMasterSongText(item.filename, updatedRawText);
      }
      // Re-parse with updated rawText so repeated sections (like choruses) stay in sync
      const reParsed = parseSongMarkdown(updatedRawText, linesPerSlide, currentArrangement);
      if (reParsed.slides && reParsed.slides.length > 0) {
        for (let i = 0; i < updatedSlides.length; i++) {
          if (reParsed.slides[i]) {
            updatedSlides[i] = reParsed.slides[i];
          }
        }
      }
    }

    onUpdateItem({
      ...item,
      slides: updatedSlides,
      rawText: updatedRawText || effectiveRawText
    });

    setToastMessage(
      isCurrentlyLive
        ? 'Live slide updated seamlessly on screen'
        : saveToMaster && item.filename
        ? 'Slide updated & saved to master song in library'
        : 'Slide updated for this service'
    );
    setTimeout(() => setToastMessage(null), 3500);

    setQuickEditSlide(null);
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300 relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1C355E] text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-bold border border-[#3D7B8C]/50 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <CheckCircle size={16} className="text-emerald-400 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col mb-4 border-b border-[#E4E1DA] pb-4 gap-4">
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

          {/* Flow Arrangement button next to Edit Song */}
          {isSong && allAvailableSections.length > 0 && (
            <button
              type="button"
              onClick={() => setIsArrangementModalOpen(true)}
              className={`flex items-center justify-center h-10 gap-2 px-4 py-2 rounded-xl border transition-colors font-bold text-xs uppercase tracking-widest shadow-sm cursor-pointer ${
                isArrangementModified
                  ? 'bg-[#EDF4F6] hover:bg-[#DDEBF0] text-[#2F6473] border-[#3D7B8C]'
                  : 'bg-[#FAF6F0] hover:bg-[#F0EBE1] text-[#1C355E] border-[#E4E1DA]'
              }`}
              title="Customise song sequence for this service (e.g. V1 → C → V2 → C → B → C)"
            >
              <Sparkles size={14} className="text-[#3D7B8C]" />
              <span>Flow Arrangement</span>
              {isArrangementModified && (
                <span className="w-2 h-2 rounded-full bg-[#3D7B8C]" />
              )}
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
              <div key={i} ref={el => { tileRefs.current[i] = el; }} className="flex flex-col gap-2 group">
                {/* 16:9 True-to-Projector Card */}
                <div
                  onClick={() => onSelectIndex && onSelectIndex(i)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    openQuickFix(i);
                  }}
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

                {/* Label Row with Quick-Fix Button */}
                <div className="flex justify-between items-center px-3">
                  <div className={`text-[10px] font-bold uppercase tracking-[0.25em] transition-colors ${
                    isActiveCard || selectedIndices.has(i)
                      ? isResponse ? 'text-[#7A502A]' : 'text-[#3D7B8C]'
                      : isResponse ? 'text-[#7A502A]/80' : 'text-[#526075]'
                  }`}>
                    {isResponse ? '↩ ' : '› '}{slide.type}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Quick-Fix Button: Click does NOT activate/send slide live */}
                    <button
                      type="button"
                      title="Quick-edit slide lyrics (without jumping live)"
                      onClick={(e) => {
                        e.stopPropagation();
                        openQuickFix(i);
                      }}
                      className="px-2 py-0.5 rounded-lg bg-white/80 hover:bg-white text-[#526075] hover:text-[#1C355E] border border-[#E4E1DA] transition flex items-center gap-1 text-[10px] font-bold shadow-xs cursor-pointer"
                    >
                      <Edit2 size={10} className="text-[#3D7B8C]" />
                      <span>Quick Fix</span>
                    </button>

                    <div className={`text-[10px] font-bold ${
                      isActiveCard || selectedIndices.has(i) ? 'text-[#1C355E]' : 'text-[#526075]'
                    }`}>
                      SLIDE {i + 1}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>

      {/* Feature A: Quick-Fix Slide Modal */}
      {quickEditSlide !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-[#E4E1DA] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-[#FAF6F0] border-b border-[#E4E1DA] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#EDF4F6] rounded-xl text-[#3D7B8C]">
                  <Edit2 size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[#1C355E]">
                    Quick-Fix Slide {quickEditSlide.index + 1}
                  </h3>
                  <p className="text-[11px] font-bold text-[#526075] uppercase tracking-wider">
                    Section: [{quickEditSlide.slide.type}]
                  </p>
                </div>
              </div>

              {/* Live vs Wings status indicator */}
              {isLive && liveItem?.id === item.id && liveSlideIndex === quickEditSlide.index ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 text-red-800 border border-red-200 text-[10px] font-black uppercase tracking-wider animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-red-600" />
                  Live on Screen
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold uppercase tracking-wider">
                  In The Wings (Not Live)
                </span>
              )}
            </div>

            {/* Modal Body */}
            <div className="p-5 flex flex-col gap-4">
              {isLive && liveItem?.id === item.id && liveSlideIndex === quickEditSlide.index && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2">
                  <AlertCircle size={15} className="text-amber-700 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>Active Live Slide:</strong> Saving will seamlessly patch the live projector screen with zero interruption or blackout.
                  </span>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-[#1C355E] uppercase tracking-widest flex items-center justify-between">
                  <span>Slide Lyrics</span>
                  <span className="text-[#526075] font-normal lowercase">line breaks match output</span>
                </label>
                <textarea
                  autoFocus
                  rows={Math.max(3, (quickEditSlide.slide.content || []).length + 1)}
                  value={quickEditText}
                  onChange={e => setQuickEditText(e.target.value)}
                  onKeyDown={e => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                      e.preventDefault();
                      handleSaveQuickFix();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      setQuickEditSlide(null);
                    }
                  }}
                  placeholder="Enter slide lyrics..."
                  className="w-full bg-[#FAF6F0] border border-[#E4E1DA] focus:border-[#3D7B8C] rounded-xl p-3.5 text-sm font-medium text-[#1C355E] leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-[#3D7B8C]/20"
                />
              </div>

              {/* Master Song Update Checkbox */}
              {isSong && item.filename && (
                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[#FAF6F0] border border-[#E4E1DA] cursor-pointer hover:bg-[#F0EBE1] transition">
                  <input
                    type="checkbox"
                    checked={saveToMaster}
                    onChange={e => setSaveToMaster(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-[#3D7B8C] rounded cursor-pointer"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-[#1C355E]">
                      Also save fix to master song in library
                    </span>
                    <span className="text-[10px] text-[#526075]">
                      Permanently fixes this spelling error in <span className="font-mono font-bold">{item.filename}</span> for all future services.
                    </span>
                  </div>
                </label>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 bg-[#FAF6F0] border-t border-[#E4E1DA] flex items-center justify-between">
              <span className="text-[10px] text-[#526075] font-medium hidden sm:inline">
                Tip: Press <kbd className="px-1.5 py-0.5 bg-white border border-[#E4E1DA] rounded text-[9px] font-mono font-bold">Ctrl+Enter</kbd> to save
              </span>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setQuickEditSlide(null)}
                  className="px-4 py-2 bg-white hover:bg-[#F0EBE1] text-[#526075] border border-[#E4E1DA] rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveQuickFix}
                  className="px-5 py-2 bg-[#1C355E] hover:bg-[#152847] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  <Check size={14} />
                  {isLive && liveItem?.id === item.id && liveSlideIndex === quickEditSlide.index ? 'Update Live Screen' : 'Save Slide'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feature B: Song Flow Arrangement Modal */}
      {isArrangementModalOpen && isSong && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsArrangementModalOpen(false)}
        >
          <div 
            className="bg-white border border-[#E4E1DA] rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 bg-[#FAF6F0] border-b border-[#E4E1DA] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#EDF4F6] rounded-xl text-[#3D7B8C]">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#1C355E]">
                    Song Flow Arrangement
                  </h3>
                  <p className="text-xs font-semibold text-[#526075]">
                    Sequence sections for "{title}"
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isArrangementModified && (
                  <button
                    type="button"
                    onClick={handleResetArrangement}
                    className="text-xs font-bold text-[#526075] hover:text-[#B91C1C] flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-white border border-transparent hover:border-[#E4E1DA] transition cursor-pointer"
                    title="Reset sequence to song's original order"
                  >
                    <RotateCcw size={12} /> Reset to Default
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsArrangementModalOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-[#F0EBE1] text-[#526075] hover:text-[#1C355E] transition cursor-pointer"
                  title="Close modal"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 flex flex-col gap-5 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {/* Active Sequence */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#1C355E]">
                    Active Sequence ({currentArrangement.length} parts)
                  </span>
                  <span className="text-[11px] text-[#526075]">
                    Drag or use arrows to reorder
                  </span>
                </div>

                <div className="p-3 bg-[#FAF6F0] border border-[#E4E1DA] rounded-xl flex flex-wrap items-center gap-2 min-h-[64px]">
                  {currentArrangement.map((secName, arrIdx) => {
                    const isSel = slides[activeIndex]?.arrangementIndex === arrIdx;
                    const colorClass = getSectionBadgeStyle(secName);

                    return (
                      <div
                        key={`${secName}-${arrIdx}`}
                        draggable
                        onDragStart={e => handleArrangementDragStart(e, arrIdx)}
                        onDragOver={e => handleArrangementDragOver(e, arrIdx)}
                        onDrop={e => handleArrangementDrop(e, arrIdx)}
                        className={`group flex items-center gap-1.5 pl-2.5 pr-1.5 py-1.5 rounded-xl text-xs font-bold shadow-xs transition-all select-none border cursor-grab active:cursor-grabbing ${colorClass} ${
                          isSel ? 'ring-2 ring-offset-1 ring-[#3D7B8C] scale-105 z-10' : ''
                        }`}
                      >
                        <GripVertical size={12} className="opacity-40 group-hover:opacity-80 -ml-1 cursor-grab" />
                        <span className="tracking-tight whitespace-nowrap">{secName}</span>

                        {/* Left / Right arrow nudges */}
                        <div className="flex items-center gap-0.5 ml-1">
                          {arrIdx > 0 && (
                            <button
                              type="button"
                              title="Move section left"
                              onClick={(e) => { e.stopPropagation(); handleMoveArrangement(arrIdx, -1); }}
                              className="w-4 h-4 rounded flex items-center justify-center hover:bg-black/20 text-current opacity-70 hover:opacity-100"
                            >
                              <ArrowLeft size={10} />
                            </button>
                          )}
                          {arrIdx < currentArrangement.length - 1 && (
                            <button
                              type="button"
                              title="Move section right"
                              onClick={(e) => { e.stopPropagation(); handleMoveArrangement(arrIdx, 1); }}
                              className="w-4 h-4 rounded flex items-center justify-center hover:bg-black/20 text-current opacity-70 hover:opacity-100"
                            >
                              <ArrowRight size={10} />
                            </button>
                          )}
                        </div>

                        {/* Remove Chip */}
                        {currentArrangement.length > 1 && (
                          <button
                            type="button"
                            title={`Remove this ${secName} from flow`}
                            onClick={(e) => { e.stopPropagation(); handleRemoveArrangement(arrIdx); }}
                            className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-black/25 text-current opacity-60 hover:opacity-100 transition cursor-pointer ml-0.5"
                          >
                            <X size={11} strokeWidth={2.5} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Add Sections from Bank */}
              <div className="flex flex-col gap-2 pt-2 border-t border-[#E4E1DA]">
                <span className="text-xs font-bold uppercase tracking-wider text-[#1C355E]">
                  + Add Section to Flow
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  {allAvailableSections.map(secName => (
                    <button
                      key={secName}
                      type="button"
                      onClick={() => handleAddArrangementSection(secName)}
                      className="px-3 py-1.5 rounded-xl bg-[#FAF6F0] hover:bg-[#EDF4F6] text-[#1C355E] hover:text-[#2F6473] border border-[#E4E1DA] hover:border-[#3D7B8C] text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                      title={`Add ${secName} to song flow`}
                    >
                      <Plus size={13} className="text-[#3D7B8C]" />
                      <span>{secName}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-[#526075]">
                  Click any section to append it to the arrangement (e.g. repeat a Chorus or restore a removed verse).
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 bg-[#FAF6F0] border-t border-[#E4E1DA] flex items-center justify-between">
              <div className="text-xs font-medium text-[#526075]">
                {isArrangementModified ? (
                  <span className="text-[#2F6473] font-bold">Custom arrangement active</span>
                ) : (
                  <span>Default song order</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsArrangementModalOpen(false)}
                className="px-6 py-2 bg-[#1C355E] hover:bg-[#152847] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition shadow-sm cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
