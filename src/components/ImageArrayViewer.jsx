import { CheckCircle, Circle, Plus, Minus } from 'lucide-react';

export default function ImageArrayViewer({ images, currentIndex, onSelectIndex, item, isServiceItem, onAddSelectedToService, onRemoveSelectedFromService, selectedIndices, onToggleSelection }) {
  if (!images || images.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#FAF6F0] border border-[#E4E1DA] rounded-2xl">
        <span className="text-[#526075] font-bold uppercase tracking-widest text-sm">No Images Found</span>
      </div>
    );
  }

  const title = item?.title || 'Slide Deck';

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col mb-6 border-b border-[#E4E1DA] pb-4 gap-4">
        {(!isServiceItem || selectedIndices?.size > 0) && (
          <div className="flex items-center gap-3">
            {isServiceItem ? (
              <button
                onClick={onRemoveSelectedFromService}
                className="flex items-center justify-center h-10 gap-2 px-6 py-2 bg-[#B91C1C] hover:bg-[#991B1B] text-white rounded-xl transition-colors font-bold text-xs uppercase tracking-widest shadow-sm cursor-pointer"
              >
                <Minus size={16} strokeWidth={3} />
                Remove Selected ({selectedIndices.size})
              </button>
            ) : (
              <button
                onClick={onAddSelectedToService}
                className="flex items-center justify-center h-10 gap-2 px-6 py-2 bg-[#7A502A] hover:bg-[#654121] text-white rounded-xl transition-colors font-bold text-xs uppercase tracking-widest shadow-sm cursor-pointer"
              >
                <Plus size={16} strokeWidth={3} />
                {selectedIndices?.size > 0 ? `Add Selected (${selectedIndices.size})` : 'Add To Service'}
              </button>
            )}
          </div>
        )}

        <div className="flex flex-col">
          <h2 className="text-3xl font-extrabold text-[#1C355E] tracking-tight">{title}</h2>
          <div className="text-sm font-bold text-[#526075] mt-2 uppercase tracking-widest leading-none">
            {images.length} Image{images.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-32 pt-2 px-1">
        <div className="grid grid-cols-2 gap-x-8 gap-y-10">
          {images.map((img, i) => {
            const isActiveCard = i === currentIndex;
            return (
              <div key={i} className="flex flex-col gap-2 group">
                {/* Card */}
                <div
                  onClick={() => onSelectIndex && onSelectIndex(i)}
                  className={`aspect-video rounded-2xl flex flex-col relative cursor-pointer border-2 transition-all duration-200 overflow-hidden ${
                    isActiveCard
                        ? 'bg-[#EDF4F6] border-[#3D7B8C] ring-2 ring-[#3D7B8C]/35 z-10'
                        : 'bg-[#FAF6F0] border-[#E4E1DA] hover:border-[#3D7B8C]'
                  }`}
                >
                  <img src={img.url} className="w-full h-full object-contain bg-[#FAF6F0]" alt={`Slide ${i+1}`} />

                  {/* Selection Indicator */}
                  <div 
                    onClick={(e) => { e.stopPropagation(); onToggleSelection && onToggleSelection(i); }}
                    className={`absolute top-3.5 right-3.5 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
                      selectedIndices?.has(i) 
                        ? 'bg-[#3D7B8C] text-white shadow-sm' 
                        : 'bg-white/85 text-[#526075] hover:bg-white hover:text-[#1C355E] border border-[#E4E1DA] opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    {selectedIndices?.has(i) ? <CheckCircle size={20} /> : <Circle size={20} />}
                  </div>
                </div>

                {/* Label Row */}
                <div className="flex justify-between items-center px-3">
                  <div className={`text-[10px] font-bold uppercase tracking-[0.25em] transition-colors ${
                    isActiveCard ? 'text-[#3D7B8C]' : 'text-[#526075]'
                  }`}>
                    › IMAGE
                  </div>
                  <div className={`text-[10px] font-bold ${
                    isActiveCard ? 'text-[#1C355E]' : 'text-[#526075]'
                  }`}>
                    SLIDE {i + 1}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
