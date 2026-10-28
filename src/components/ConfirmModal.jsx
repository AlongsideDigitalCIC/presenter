import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmModal({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel, 
  confirmText = 'Confirm', 
  cancelText = 'Cancel',
  variant = 'danger' 
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-[#1C355E]/40 backdrop-blur-sm" 
        onClick={onCancel}
      />
      
      {/* Modal Card */}
      <div className="relative w-full max-w-md bg-white border border-[#E4E1DA] rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${
              variant === 'danger' ? 'bg-rose-50 text-[#B91C1C] border-rose-200' : 'bg-[#EDF4F6] text-[#3D7B8C] border-[#3D7B8C]/25'
            }`}>
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-[#1C355E] tracking-tight">{title}</h3>
              <p className="text-xs font-bold text-[#526075] uppercase tracking-widest mt-1">Action Required</p>
            </div>
          </div>
          
          <p className="text-[#526075] text-sm leading-relaxed font-medium mb-8">
            {message}
          </p>
          
          <div className="flex gap-3">
            <button 
              onClick={onCancel}
              className="flex-1 px-6 py-3.5 bg-[#FAF6F0] hover:bg-[#F0EBE1] text-[#1C355E] font-bold rounded-xl transition-colors border border-[#E4E1DA] cursor-pointer"
            >
              {cancelText}
            </button>
            <button 
              onClick={() => {
                onConfirm();
                onCancel(); // Close after confirming
              }}
              className={`flex-1 px-6 py-3.5 font-bold rounded-xl transition-colors shadow-sm cursor-pointer ${
                variant === 'danger' 
                  ? 'bg-[#B91C1C] hover:bg-[#991B1B] text-white' 
                  : 'bg-[#7A502A] hover:bg-[#654121] text-white'
              }`}
            >
              {confirmText}
            </button>
          </div>
        </div>
        
        <button 
          onClick={onCancel}
          className="absolute top-4 right-4 p-2 text-[#526075] hover:text-[#1C355E] hover:bg-[#FAF6F0] rounded-lg transition-colors cursor-pointer"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
}
