import logoUrl from '../assets/logo.png';
export default function Logo({ className = "h-8 w-auto object-contain", textClassName = "text-2xl font-bold tracking-tight text-[#1C355E]", showText = true }) {
  return (
    <div className="flex items-center gap-3">
      <img src={logoUrl} alt="Logo" className={className} />
      {showText && (
        <span className={textClassName}>
          Presenter
        </span>
      )}
    </div>
  );
}