export default function Logo({
  className = "h-9 w-auto object-contain",
  textClassName = "text-[22px] font-extrabold tracking-tight leading-none",
  showText = true
}) {
  return (
    <div
      className="flex items-center gap-3.5 select-none"
      style={{ fontFamily: "'Outfit', sans-serif" }}
    >
      <img
        src="/favicon.png"
        alt="Alongside Digital Presenter"
        className={className}
      />
      {showText && (
        <span className={`${textClassName} presenter-wordmark py-0.5`}>
          Presenter
        </span>
      )}
    </div>
  );
}
