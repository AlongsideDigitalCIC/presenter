import { GripVertical, Trash2, Save, Upload, Eraser, PlayCircle, CheckCircle, RotateCcw } from 'lucide-react';
import { useState } from 'react';

function ServiceFlowHeader({ onClear, onResetPlayed, onLoad, onSave }) {
  return (
    <div className="flex flex-col gap-3 mb-4 px-1">
      <h2 className="text-[10px] font-bold text-[#526075] uppercase tracking-widest leading-none block">Service Flow</h2>
      <div className="grid grid-cols-4 gap-1.5">
         <button 
           onClick={onClear}
           title="Clear Service"
           className="p-2 flex flex-col items-center justify-center gap-1.5 bg-white hover:bg-[#F0EBE1] text-[#526075] hover:text-[#B91C1C] border border-[#E4E1DA] rounded-lg transition-colors text-[8px] font-bold uppercase tracking-widest text-center shadow-sm cursor-pointer"
         >
           <Eraser size={14} /> Clear
         </button>
         <button 
           onClick={onResetPlayed}
           title="Reset All Statuses"
           className="p-2 flex flex-col items-center justify-center gap-1.5 bg-white hover:bg-[#F0EBE1] text-[#526075] hover:text-[#1C355E] border border-[#E4E1DA] rounded-lg transition-colors text-[8px] font-bold uppercase tracking-widest text-center shadow-sm cursor-pointer"
         >
           <RotateCcw size={14} /> Reset
         </button>
         <button 
           onClick={onLoad}
           title="Load Service"
           className="p-2 flex flex-col items-center justify-center gap-1.5 bg-white hover:bg-[#F0EBE1] text-[#526075] hover:text-[#3D7B8C] border border-[#E4E1DA] rounded-lg transition-colors text-[8px] font-bold uppercase tracking-widest text-center shadow-sm cursor-pointer"
         >
           <Upload size={14} /> Load
         </button>
         <button 
           onClick={onSave}
           title="Save Service"
           className="p-2 flex flex-col items-center justify-center gap-1.5 bg-white hover:bg-[#F0EBE1] text-[#526075] hover:text-emerald-700 border border-[#E4E1DA] rounded-lg transition-colors text-[8px] font-bold uppercase tracking-widest text-center shadow-sm cursor-pointer"
         >
           <Save size={14} /> Save
         </button>
      </div>
    </div>
  );
}

export default function ServiceFlow({ 
    items, onReorder, onSelect, onRemove, onUpdate, onSave, onLoad, onClear, 
    liveItemId, playedItems, onResetPlayed, onResetItemPlayed 
}) {
  const [draggedIdx, setDraggedIdx] = useState(null);

  const handleDragStart = (e, index) => {
    setDraggedIdx(index);
    // Allow move effect
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, targetIdx) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIdx) return;
    
    const newItems = [...items];
    const item = newItems.splice(draggedIdx, 1)[0];
    newItems.splice(targetIdx, 0, item);
    
    setDraggedIdx(targetIdx);
    onReorder(newItems);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
  };

  if (!items || items.length === 0) {
    return (
      <div className="flex flex-col h-full mt-2 w-full">
        <ServiceFlowHeader onClear={onClear} onResetPlayed={onResetPlayed} onLoad={onLoad} onSave={onSave} />
        <div className="text-sm font-medium text-[#526075] p-6 text-center bg-white rounded-2xl border border-[#E4E1DA] border-dashed leading-relaxed">
          Your service is currently empty.<br/><br/>Browse your library tabs above to find and add items, or import an existing service.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full mt-2">
      <ServiceFlowHeader onClear={onClear} onResetPlayed={onResetPlayed} onLoad={onLoad} onSave={onSave} />
      <div className="flex-1 overflow-y-auto space-y-2 px-1 pb-4">
        {items.map((item, index) => {
          const isPlaying = liveItemId === item.id;
          const isPlayed = !isPlaying && playedItems?.has(item.id);
          
          return (
          <div 
            key={item.id || index}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            onClick={() => onSelect(item)}
            className={`p-3.5 rounded-xl flex items-center gap-3 cursor-grab active:cursor-grabbing group border transition-colors shadow-sm ${
              isPlaying ? 'border-emerald-600/40 bg-emerald-50' : 'border-[#E4E1DA] hover:border-[#3D7B8C] bg-white hover:bg-[#F0EBE1]/60'
            } ${
              isPlayed ? 'opacity-60' : 'opacity-100'
            } ${
              draggedIdx === index ? 'opacity-30 scale-95' : 'scale-100'
            }`}
          >
            <GripVertical size={18} className="text-[#526075] group-hover:text-[#3D7B8C] transition-colors" />
            <div className="min-w-0 flex-1">
              <div className={`font-bold text-sm truncate flex items-center gap-2 ${isPlaying ? 'text-emerald-800' : 'text-[#1C355E]'}`}>
                 {item.title || item.reference || 'Untitled Item'}
                 {isPlayed && <CheckCircle size={14} className="text-[#526075] ml-1" />}
              </div>
              <div className="flex items-center gap-3 mt-1">
                 <div className={`text-[10px] font-bold uppercase tracking-widest leading-none ${isPlaying ? 'text-emerald-700' : 'text-[#526075]'}`}>{item.type || 'Media'}</div>

                  {/* The sticky audio play button was removed per user request */}
                 
                 {(item.type === 'video' || item.type === 'slide_deck') && (
                    <button
                       onClick={(e) => {
                          e.stopPropagation();
                          onUpdate(index, { ...item, autoPlay: !item.autoPlay });
                       }}
                       className={`flex items-center gap-1 min-w-max px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest transition-colors cursor-pointer ${
                          item.autoPlay 
                             ? 'bg-[#3D7B8C] text-white border border-[#3D7B8C]' 
                             : 'bg-[#FAF6F0] text-[#526075] border border-[#E4E1DA] hover:text-[#1C355E]'
                       }`}
                       title="Auto Play when pushed Live"
                    >
                       <PlayCircle size={10} className={item.autoPlay ? 'text-white' : 'text-[#526075]'} /> Auto Play
                    </button>
                 )}
              </div>
            </div>
            
            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
               {isPlayed && (
                 <button 
                   onClick={(e) => {
                     e.stopPropagation();
                     if (onResetItemPlayed) onResetItemPlayed(item.id);
                   }}
                   className="p-2 hover:bg-[#F0EBE1] hover:text-[#1C355E] text-[#526075] rounded-lg transition-colors mr-1 cursor-pointer"
                   title="Reset Status"
                 >
                   <RotateCcw size={16} />
                 </button>
               )}
               <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(index);
                  }}
                  className="p-2 hover:bg-rose-50 hover:text-[#B91C1C] text-[#526075] rounded-lg transition-colors cursor-pointer"
                  title="Remove from Service"
               >
                 <Trash2 size={16} />
               </button>
            </div>
          </div>
        )})}
      </div>
    </div>
  );
}
