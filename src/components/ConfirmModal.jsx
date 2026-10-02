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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-white/60 backdrop-blur-md" 
        onClick={onCancel}
      />
      
      {/* Modal Card */}
      <div className="relative w-full max-w-md bg-white border border-[#3D7B8C]/10 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        <div className="p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
              variant === 'danger' ? 'bg-red-500/10 text-red-600' : 'bg-[#3D7B8C]/20 text-[#3D7B8C]'
            }`}>
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-[#1C355E] tracking-tight">{title}</h3>
              <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mt-1">Action Required</p>
            </div>
          </div>
          
          <p className="text-neutral-700 text-sm leading-relaxed font-medium mb-8">
            {message}
          </p>
          
          <div className="flex gap-3">
            <button 
              onClick={onCancel}
              className="flex-1 px-6 py-4 bg-[#F7F7F7] hover:bg-neutral-200 text-neutral-700 font-bold rounded-2xl transition-all border border-[#3D7B8C]/20/50 hover:text-[#1C355E]"
            >
              {cancelText}
            </button>
            <button 
              onClick={() => {
                onConfirm();
                onCancel(); // Close after confirming
              }}
              className={`flex-1 px-6 py-4 font-bold rounded-2xl transition-all shadow-lg active:scale-95 ${
                variant === 'danger' 
                  ? 'bg-red-700 hover:bg-red-600 text-white shadow-red-900/20' 
                  : 'bg-[#3D7B8C] hover:bg-[#3D7B8C] text-white shadow-blue-900/20'
              }`}
            >
              {confirmText}
            </button>
          </div>
        </div>
        
        <button 
          onClick={onCancel}
          className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-[#1C355E] transition-colors"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
}
