import { CheckCircle, Circle, Plus, Minus } from 'lucide-react';

export default function ImageArrayViewer({ images, currentIndex, onSelectIndex, item, isServiceItem, onAddSelectedToService, onRemoveSelectedFromService, selectedIndices, onToggleSelection }) {
  if (!images || images.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-white border border-[#3D7B8C]/10 rounded-2xl">
        <span className="text-neutral-400 font-bold uppercase tracking-widest text-sm">No Images Found</span>
      </div>
    );
  }

  const title = item?.title || 'Slide Deck';

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col mb-6 border-b border-[#3D7B8C]/10/50 pb-4 gap-4">
        <div className="flex items-center gap-3">
            {isServiceItem ? (
              selectedIndices?.size > 0 && (
                <button
                  onClick={onRemoveSelectedFromService}
                  className="flex items-center justify-center h-10 gap-2 px-6 py-2 bg-red-600 hover:bg-red-500 text-[#1C355E] rounded-xl transition-all font-black text-xs uppercase tracking-widest shadow-lg shadow-red-900/20 active:scale-95"
                >
                  <Minus size={16} strokeWidth={3} />
                  Remove Selected ({selectedIndices.size})
                </button>
              )
            ) : (
              <button
                onClick={onAddSelectedToService}
                className="flex items-center justify-center h-10 gap-2 px-6 py-2 bg-[#3D7B8C] hover:bg-[#3D7B8C] text-white rounded-xl transition-all font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-900/20 active:scale-95"
              >
                <Plus size={16} strokeWidth={3} />
                {selectedIndices?.size > 0 ? `Add Selected (${selectedIndices.size})` : 'Add To Service'}
              </button>
            )}
        </div>

        <div className="flex flex-col">
          <h2 className="text-3xl font-extrabold text-[#1C355E] tracking-tight">{title}</h2>
          <div className="text-sm font-bold text-neutral-400 mt-2 uppercase tracking-widest leading-none">
            {images.length} Image{images.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-32 pt-2 px-1">
        <div className="grid grid-cols-2 gap-x-8 gap-y-12">
          {images.map((img, i) => {
            const isActiveCard = i === currentIndex;
            return (
              <div key={i} className="flex flex-col gap-2 group">
                {/* Card */}
                <div
                  onClick={() => onSelectIndex && onSelectIndex(i)}
                  className={`aspect-video rounded-3xl flex flex-col relative cursor-pointer border-2 transition-all duration-300 overflow-hidden ${
                    isActiveCard
                        ? 'bg-[#3D7B8C]/10 border-[#3D7B8C] shadow-[0_0_40px_rgba(61,123,140,0.3)] scale-[1.02] transform z-10'
                        : 'bg-white/40 border-[#3D7B8C]/10 hover:border-[#3D7B8C]/20 hover:scale-[1.01] transform'
                  }`}
                >
                  <img src={img.url} className="w-full h-full object-contain bg-[#F7F7F7]" alt={`Slide ${i+1}`} />

                  {/* Selection Indicator */}
                  <div 
                    onClick={(e) => { e.stopPropagation(); onToggleSelection && onToggleSelection(i); }}
                    className={`absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                      selectedIndices?.has(i) 
                        ? 'bg-[#3D7B8C] text-white scale-110 shadow-lg border-[#3D7B8C]' 
                        : 'border-2 border-neutral-600 text-transparent hover:border-neutral-500'
                    }`}
                  >
                    {selectedIndices?.has(i) ? <CheckCircle size={20} /> : <Circle size={20} />}
                  </div>
                </div>

                {/* Label Row */}
                <div className="flex justify-between items-center px-4">
                  <div className={`text-[10px] font-black uppercase tracking-[0.3em] transition-colors ${
                    isActiveCard ? 'text-[#3D7B8C]' : 'text-neutral-400'
                  }`}>
                    › IMAGE
                  </div>
                  <div className={`text-[10px] font-black ${
                    isActiveCard ? 'text-[#3D7B8C]/80' : 'text-neutral-700'
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
