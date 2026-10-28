import { useEffect, useRef, useState, useMemo } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { getYoutubeEmbedUrl } from '../utils/media';
import { getFontFamilyCss } from '../utils/fonts';
import { computeSlideTypography, tokenizeBibleLine, parseLiturgyLineFormatting } from '../utils/slideLayout';

function bindAutoPlayMutedVideo(el) {
  if (!el) return;
  el.defaultMuted = true;
  el.muted = true;
  if (el.paused) {
    el.play().catch(() => {});
  }
}

export function AutoFitLyrics({
  lines,
  subText,
  isMaster = false,
  isLiveBroadcast = false,
  mediaType = 'song',
  songMetadata = null,
  ccliSettings = null,
  fontFamily = 'Inter, sans-serif',
  fontName = 'Inter',
  textScale = 1,
  linesPerSlide = 0
}) {
  const isHighImpact = isMaster || isLiveBroadcast;

  const ccliLegalText = useMemo(() => {
    if (mediaType !== 'song' || !songMetadata) return null;

    const mode = ccliSettings?.displayMode || 'first_slide';
    if (mode === 'off') return null;

    const isFirst = !!songMetadata.isFirstSlide;
    const isLast = !!songMetadata.isLastSlide;

    let shouldShow = false;
    if (mode === 'first_slide') shouldShow = isFirst;
    else if (mode === 'last_slide') shouldShow = isLast;
    else if (mode === 'both') shouldShow = isFirst || isLast;
    else if (mode === 'all') shouldShow = true;

    if (!shouldShow) return null;

    const parts = [];
    if (songMetadata.title && songMetadata.title !== 'Unknown Song') {
      parts.push(songMetadata.title);
    }
    if (songMetadata.artist) {
      parts.push(songMetadata.artist);
    }
    if (songMetadata.copyright) {
      parts.push(songMetadata.copyright);
    }
    if (songMetadata.ccli) {
      const cleanCcli = songMetadata.ccli.toString().replace(/^ccli\s*#?\s*/i, '').trim();
      if (cleanCcli) parts.push(`CCLI Song # ${cleanCcli}`);
    }
    if (ccliSettings?.licenseNumber) {
      const cleanLic = ccliSettings.licenseNumber.toString().replace(/^ccli\s*(?:license)?\s*#?\s*/i, '').trim();
      if (cleanLic) parts.push(`CCLI License # ${cleanLic}`);
    }

    if (parts.length === 0) return null;
    return parts.join(' | ');
  }, [mediaType, songMetadata, ccliSettings]);

  const hasSubText = Boolean(subText && mediaType === 'bible');
  const hasCcliFooter = Boolean(ccliLegalText);

  const typography = computeSlideTypography({
    lines,
    mediaType,
    fontName,
    textScale,
    linesPerSlide,
    hasSubText,
    hasCcliFooter,
    isCompact: !isHighImpact
  });

  const ccliPosition = ccliSettings?.position || 'bottom-left';

  return (
    <div className={`absolute inset-0 flex flex-col items-center justify-center overflow-hidden ${typography.paddingClass}`}>
      <div
        className={`font-bold text-white text-center antialiased w-full text-balance whitespace-pre-wrap ${
          mediaType === 'bible' && lines.length > 1 ? 'flex flex-col gap-[0.25em]' : 'flex flex-col gap-[0.12em]'
        }`}
        style={{
          fontFamily,
          fontSize: typography.fontSize,
          lineHeight: typography.lineHeight,
          wordBreak: 'break-word',
          textShadow: '0 2px 5px rgba(0, 0, 0, 0.96), 0 4px 18px rgba(0, 0, 0, 0.9), 0 8px 40px rgba(0, 0, 0, 0.75)'
        }}
      >
        {lines.map((line, i) => {
          if (mediaType === 'bible') {
            const tokens = tokenizeBibleLine(line);
            return (
              <div key={i}>
                {tokens.map((tok, ti) =>
                  tok.type === 'verse' ? (
                    <sup
                      key={ti}
                      className="text-[0.58em] font-extrabold text-amber-300/95 mr-[0.28em] tracking-normal select-none align-super"
                    >
                      {tok.value}
                    </sup>
                  ) : (
                    <span key={ti}>{tok.value}</span>
                  )
                )}
              </div>
            );
          }
          return <div key={i}>{line}</div>;
        })}
      </div>
      {hasSubText && (
        <div
          className="absolute bottom-[5%] left-[6%] right-[6%] text-center font-bold text-white/90 tracking-[0.16em] uppercase truncate"
          style={{
            fontFamily,
            fontSize: typography.subTextFontSize,
            textShadow: '0 2px 6px rgba(0, 0, 0, 0.96), 0 4px 20px rgba(0, 0, 0, 0.9)'
          }}
        >
          {subText}
        </div>
      )}
      {ccliLegalText && (
        <div
          className={`absolute bottom-[2.5%] left-[3%] right-[3%] z-30 pointer-events-none flex ${
            ccliPosition === 'bottom-center'
              ? 'justify-center text-center'
              : ccliPosition === 'bottom-right'
              ? 'justify-end text-right'
              : 'justify-start text-left'
          }`}
        >
          <div
            className="px-[1cqw] py-[0.5cqh] font-sans font-medium text-white/80 tracking-wider max-w-[78%] leading-snug"
            style={{
              fontSize: isHighImpact ? typography.ccliFontSize : '9px',
              textShadow: '0 2px 6px rgba(0, 0, 0, 0.96), 0 3px 12px rgba(0, 0, 0, 0.85)'
            }}
          >
            {ccliLegalText}
          </div>
        </div>
      )}
    </div>
  );
}

// Liturgy-aware scaler — white for speaker, warm gold for response, sky for group, mint for individual
export function AutoFitLiturgy({
  lines,
  liturgyType = 'speaker',
  alignment = 'center',
  isMaster = false,
  isLiveBroadcast = false,
  fontFamily = 'Inter, sans-serif',
  fontName = 'Inter',
  textScale = 1,
  linesPerSlide = 0
}) {
  const isHighImpact = isMaster || isLiveBroadcast;

  const isResponse = liturgyType === 'response';
  const isCandidate = liturgyType === 'candidate';
  const isGroup = liturgyType === 'group';

  const textAlign = alignment === 'left' ? 'text-left' : alignment === 'right' ? 'text-right' : 'text-center';
  const flexAlign = alignment === 'left' ? 'items-start' : alignment === 'right' ? 'items-end' : 'items-center';

  const typography = computeSlideTypography({
    lines,
    mediaType: 'liturgy',
    fontName,
    textScale,
    linesPerSlide,
    isCompact: !isHighImpact
  });

  return (
    <div className={`absolute inset-0 flex flex-col ${flexAlign} justify-center overflow-hidden ${typography.paddingClass}`}>
      <div
        className={`font-bold ${textAlign} antialiased w-full text-balance whitespace-pre-wrap flex flex-col gap-[0.16em]`}
        style={{
          fontFamily,
          fontSize: typography.fontSize,
          lineHeight: typography.lineHeight,
          wordBreak: 'break-word',
          color: isCandidate ? '#86efac' : isGroup ? '#7dd3fc' : isResponse ? '#fde047' : '#ffffff',
          textShadow: isCandidate
            ? '0 2px 5px rgba(0, 0, 0, 0.96), 0 4px 18px rgba(0, 0, 0, 0.9), 0 0 40px rgba(74, 222, 128, 0.28)'
            : isGroup
            ? '0 2px 5px rgba(0, 0, 0, 0.96), 0 4px 18px rgba(0, 0, 0, 0.9), 0 0 40px rgba(56, 189, 248, 0.28)'
            : isResponse
            ? '0 2px 5px rgba(0, 0, 0, 0.96), 0 4px 18px rgba(0, 0, 0, 0.9), 0 0 40px rgba(250, 204, 21, 0.28)'
            : '0 2px 5px rgba(0, 0, 0, 0.96), 0 4px 18px rgba(0, 0, 0, 0.9), 0 8px 40px rgba(0, 0, 0, 0.75)'
        }}
      >
        {lines.map((line, i) => {
          const parsed = parseLiturgyLineFormatting(line);
          return (
            <div
              key={i}
              className={
                parsed.headingLevel === 1
                  ? 'text-[1.12em] font-black tracking-wide uppercase mb-[0.1em]'
                  : parsed.headingLevel === 2
                  ? 'text-[1.05em] font-extrabold tracking-wide mb-[0.06em]'
                  : undefined
              }
            >
              {parsed.tokens.map((tok, ti) => {
                if (tok.type === 'bold') return <strong key={ti} className="font-black">{tok.value}</strong>;
                if (tok.type === 'italic') return <em key={ti} className="italic">{tok.value}</em>;
                if (tok.type === 'underline') return <span key={ti} className="underline underline-offset-4">{tok.value}</span>;
                return <span key={ti}>{tok.value}</span>;
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SlideTransitionContainer({
  contentKey,
  transitionEnabled = true,
  transitionType = 'crossfade',
  duration = 400,
  children
}) {
  const [transitionState, setTransitionState] = useState(() => ({
    currentKey: contentKey,
    currentElement: children,
    exiting: null,
    animating: false,
    runId: 0
  }));

  if (contentKey !== transitionState.currentKey) {
    const shouldAnimate = Boolean(transitionEnabled && transitionType && transitionType !== 'cut');
    setTransitionState({
      currentKey: contentKey,
      currentElement: children,
      exiting: shouldAnimate
        ? {
            key: transitionState.currentKey,
            element: transitionState.currentElement
          }
        : null,
      animating: shouldAnimate,
      runId: transitionState.runId + 1
    });
  } else if (children !== transitionState.currentElement) {
    setTransitionState(prev => ({
      ...prev,
      currentElement: children
    }));
  }

  const effectiveDuration =
    transitionType === 'fade_through'
      ? Math.max(420, Math.round(duration * 1.35))
      : duration;

  useEffect(() => {
    if (!transitionState.animating) return;
    const timer = setTimeout(() => {
      setTransitionState(prev => ({
        ...prev,
        exiting: null,
        animating: false
      }));
    }, effectiveDuration + 35);
    return () => clearTimeout(timer);
  }, [transitionState.animating, transitionState.runId, effectiveDuration]);

  const getIncomingAnimation = () => {
    switch (transitionType) {
      case 'fade_through':
        return `transitionFadeThroughIn ${effectiveDuration}ms linear both`;
      case 'slide_left':
        return `transitionSlideLeftIn ${effectiveDuration}ms cubic-bezier(0.25, 1, 0.5, 1) both`;
      case 'float_up':
        return `transitionFloatUpIn ${effectiveDuration}ms cubic-bezier(0.25, 1, 0.5, 1) both`;
      case 'crossfade':
      default:
        return `transitionCrossfadeIn ${effectiveDuration}ms cubic-bezier(0.37, 0, 0.63, 1) both`;
    }
  };

  const getOutgoingAnimation = () => {
    switch (transitionType) {
      case 'fade_through':
        return `transitionFadeThroughOut ${effectiveDuration}ms linear both`;
      case 'slide_left':
        return `transitionSlideLeftOut ${effectiveDuration}ms cubic-bezier(0.25, 1, 0.5, 1) both`;
      case 'float_up':
        return `transitionFloatUpOut ${effectiveDuration}ms cubic-bezier(0.25, 1, 0.5, 1) both`;
      case 'crossfade':
      default:
        return `transitionCrossfadeOut ${effectiveDuration}ms cubic-bezier(0.37, 0, 0.63, 1) both`;
    }
  };

  const isActivelyAnimating =
    transitionState.animating &&
    transitionEnabled &&
    transitionType !== 'cut' &&
    Boolean(transitionState.exiting);

  const layers = isActivelyAnimating
    ? [
        { key: transitionState.exiting.key, element: transitionState.exiting.element, phase: 'out' },
        { key: transitionState.currentKey, element: children, phase: 'in' }
      ]
    : [
        { key: transitionState.currentKey, element: children, phase: 'idle' }
      ];

  return (
    <div className="relative z-10 w-full h-full overflow-hidden pointer-events-none">
      {layers.map(layer => (
        <div
          key={layer.key}
          className="absolute inset-0 pointer-events-none will-change-[transform,opacity]"
          style={{
            transform: 'translate3d(0, 0, 0)',
            backfaceVisibility: 'hidden',
            WebkitFontSmoothing: 'antialiased',
            animation:
              layer.phase === 'in'
                ? getIncomingAnimation()
                : layer.phase === 'out'
                ? getOutgoingAnimation()
                : undefined
          }}
          aria-hidden={layer.phase === 'out' ? 'true' : undefined}
        >
          {layer.element}
        </div>
      ))}
    </div>
  );
}

// Announcement Banner Overlay
export function AnnouncementOverlay({ announcement, settings }) {
  if (!announcement?.active || !announcement?.text?.trim()) return null;

  const rawPos = settings?.position || 'bottom'; // 'bottom' | 'top' | 'center' (legacy 'floating' -> 'center')
  const position = rawPos === 'floating' ? 'center' : rawPos;
  const bgColor = settings?.bgColor || '#1C355E';
  const textColor = settings?.textColor || '#FFFFFF';
  const bgOpacity = settings?.bgOpacity !== undefined ? settings.bgOpacity : 0.95;
  const fontSize = settings?.fontSize || 'medium'; // 'small' | 'medium' | 'large'
  const bannerStyle = settings?.bannerStyle || 'full-width'; // 'full-width' | 'rounded-pill'
  const isPill = bannerStyle === 'rounded-pill';

  // Support both new slider `textSize` float (0.7 - 2.0) and legacy `fontSize` string
  let textScale = 1.0;
  if (typeof settings?.textSize === 'number' && !isNaN(settings.textSize)) {
    textScale = settings.textSize;
  } else if (fontSize === 'small') {
    textScale = 0.8;
  } else if (fontSize === 'large') {
    textScale = 1.35;
  }

  // Convert hex + opacity to rgba for crisp background rendering without fading text
  const getRgba = (hex, alpha) => {
    let c = (hex || '#1C355E').replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    if (isNaN(num)) return `rgba(28, 53, 94, ${alpha})`;
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const bgRgba = getRgba(bgColor, bgOpacity);

  // Position classes using @container units so settings preview, live preview, and projector match 1:1
  let posClass = '';
  if (position === 'top') {
    posClass = isPill
      ? 'top-[4.5cqh] left-0 right-0 flex justify-center px-[4cqw]'
      : 'top-0 left-0 right-0';
  } else if (position === 'center') {
    posClass = isPill
      ? 'top-1/2 -translate-y-1/2 left-0 right-0 flex justify-center px-[4cqw]'
      : 'top-1/2 -translate-y-1/2 left-0 right-0';
  } else {
    posClass = isPill
      ? 'bottom-[4.5cqh] left-0 right-0 flex justify-center px-[4cqw]'
      : 'bottom-0 left-0 right-0';
  }

  const textFontSize = `${(4.2 * textScale).toFixed(2)}cqh`;
  const badgeFontSize = `${Math.max(1.6, 1.95 * Math.min(1.3, Math.max(0.85, textScale))).toFixed(2)}cqh`;

  return (
    <div
      className={`absolute z-50 pointer-events-none transition-all duration-300 ${posClass}`}
    >
      <div
        className={`shadow-2xl flex items-center justify-center gap-[1.4cqw] text-center backdrop-blur-md transition-all duration-300 ${
          isPill
            ? 'rounded-full px-[3.5cqw] py-[1.9cqh] max-w-[92%] border-2 border-white/25'
            : `w-full px-[4cqw] py-[2.3cqh] ${
                position === 'top'
                  ? 'border-b border-white/20'
                  : position === 'bottom'
                  ? 'border-t border-white/20'
                  : 'border-y border-white/20'
              }`
        }`}
        style={{
          backgroundColor: bgRgba,
          color: textColor || '#FFFFFF',
          fontFamily: settings?.fontFamily || 'Inter, sans-serif'
        }}
      >
        <span
          className="text-white font-black tracking-widest uppercase rounded-full bg-white/20 border border-white/35 flex-shrink-0 shadow-sm leading-none"
          style={{
            fontSize: badgeFontSize,
            padding: `${0.55 * Math.min(1.2, textScale)}cqh ${1.1 * Math.min(1.2, textScale)}cqw`,
            fontFamily: 'inherit'
          }}
        >
          Notice
        </span>
        <span
          className="font-bold tracking-wide text-balance break-words leading-snug drop-shadow-md text-white max-w-[85cqw]"
          style={{ fontSize: textFontSize, fontFamily: 'inherit' }}
        >
          {announcement.text}
        </span>
      </div>
    </div>
  );
}

// Pre-Service Countdown Timer Overlay
export function CountdownOverlay({ countdown, settings, countdownBg = null }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!countdown?.active) return;

    const calculate = () => {
      if (!countdown.running) {
        setRemaining(countdown.remainingSeconds || 0);
        return;
      }
      if (!countdown.targetTimeMs) {
        setRemaining(0);
        return;
      }
      const diff = Math.max(0, Math.ceil((countdown.targetTimeMs - Date.now()) / 1000));
      setRemaining(diff);
    };

    calculate();
    const interval = setInterval(calculate, 250);
    return () => clearInterval(interval);
  }, [countdown]);

  if (!countdown?.active) return null;

  const position = settings?.position || 'center'; // 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  const textColor = settings?.textColor || '#FFFFFF';
  const bgColor = settings?.bgColor || '#1C355E';
  const bgOpacity = settings?.bgOpacity !== undefined ? settings.bgOpacity : 0.85;
  const styleMode = settings?.style || 'boxed'; // 'boxed' | 'clean' | 'minimal'
  const activeTitle = countdown.title !== undefined ? countdown.title : (settings?.defaultTitle ?? 'Service starts in');
  const endMessage = countdown.endMessage || settings?.endMessage || 'Welcome! Service starting shortly';
  
  // Dedicated Header Text Scale and Timer Digits Scale
  const headerScale = typeof settings?.headerTextSize === 'number' && !isNaN(settings.headerTextSize)
    ? settings.headerTextSize
    : (typeof settings?.textSize === 'number' && !isNaN(settings.textSize) ? settings.textSize * 1.15 : 1.4);

  const digitsScale = typeof settings?.digitsSize === 'number' && !isNaN(settings.digitsSize)
    ? settings.digitsSize
    : (typeof settings?.textSize === 'number' && !isNaN(settings.textSize) ? settings.textSize * 0.8 : 1.0);

  const isCenter = position === 'center';

  const screenBgType = countdownBg?.bgType || 'none'; // 'none' | 'color' | 'image' | 'video'
  const screenBgColor = countdownBg?.bgColor || '#0B132B';
  const screenBgImageUrl = countdownBg?.bgImageUrl || null;
  const screenBgVideoUrl = countdownBg?.bgVideoUrl || null;
  const screenBgDim = countdownBg?.bgDim !== undefined ? countdownBg.bgDim : 0.3;
  const screenBgLoop = countdownBg?.bgVideoLoop ?? true;

  const formatCountdown = (secs) => {
    const hours = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    if (hours > 0) {
      return `${hours}:${mm}:${ss}`;
    }
    return `${mm}:${ss}`;
  };

  const isFinished = countdown.running && remaining === 0;

  // Convert hex + opacity
  const getRgba = (hex, alpha) => {
    let c = (hex || '#1C355E').replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    if (isNaN(num)) return `rgba(28, 53, 94, ${alpha})`;
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const bgRgba = getRgba(bgColor, bgOpacity);

  let posClass = 'inset-0 flex items-center justify-center p-[4cqw]';
  if (position === 'bottom-right') posClass = 'bottom-[4.5cqh] right-[3.5cqw]';
  else if (position === 'bottom-left') posClass = 'bottom-[4.5cqh] left-[3.5cqw]';
  else if (position === 'top-right') posClass = 'top-[4.5cqh] right-[3.5cqw]';
  else if (position === 'top-left') posClass = 'top-[4.5cqh] left-[3.5cqw]';

  let cardShapeClass = '';
  if (styleMode === 'boxed') {
    cardShapeClass = isCenter
      ? 'px-[5cqw] py-[3.5cqh] rounded-[2.6cqh] border-2 border-white/25 shadow-2xl max-w-[90cqw]'
      : 'px-[2.8cqw] py-[1.8cqh] rounded-[2cqh] border-2 border-white/25 shadow-2xl max-w-[50cqw]';
  } else if (styleMode === 'clean') {
    cardShapeClass = isCenter
      ? 'px-[6.5cqw] py-[2.8cqh] rounded-full border border-white/15 shadow-2xl max-w-[90cqw]'
      : 'px-[3.4cqw] py-[1.5cqh] rounded-full border border-white/15 shadow-2xl max-w-[50cqw]';
  } else {
    // 'minimal'
    cardShapeClass = 'p-[1cqw] max-w-[90cqw]';
  }

  return (
    <div className="absolute inset-0 z-40 pointer-events-none overflow-hidden">
      {/* Optional Full-Screen Countdown Background (Colour / Image / Video) */}
      {screenBgType === 'color' && (
        <div
          className="absolute inset-0 transition-colors duration-300"
          style={{ backgroundColor: screenBgColor }}
        />
      )}
      {screenBgType === 'image' && screenBgImageUrl && (
        <div className="absolute inset-0">
          <img src={screenBgImageUrl} alt="" className="w-full h-full object-cover" />
          {screenBgDim > 0 && (
            <div className="absolute inset-0 bg-black" style={{ opacity: screenBgDim }} />
          )}
        </div>
      )}
      {screenBgType === 'video' && screenBgVideoUrl && (
        <div className="absolute inset-0">
          <video
            ref={bindAutoPlayMutedVideo}
            key={screenBgVideoUrl}
            src={screenBgVideoUrl}
            autoPlay
            loop={screenBgLoop}
            muted
            playsInline
            onLoadedData={e => {
              e.target.muted = true;
              e.target.play().catch(() => {});
            }}
            onCanPlay={e => {
              e.target.muted = true;
              e.target.play().catch(() => {});
            }}
            className="w-full h-full object-cover"
          />
          {screenBgDim > 0 && (
            <div className="absolute inset-0 bg-black" style={{ opacity: screenBgDim }} />
          )}
        </div>
      )}

      {/* Positioned Timer Card / Pill / Minimal Text */}
      <div className={`absolute transition-all duration-300 ${posClass}`}>
        <div
          className={`flex flex-col items-center justify-center text-center transition-all duration-300 ${cardShapeClass}`}
          style={{
            backgroundColor: styleMode === 'minimal' ? 'transparent' : bgRgba,
            color: textColor || '#FFFFFF',
            fontFamily: settings?.fontFamily || 'Inter, sans-serif',
            backdropFilter: styleMode === 'boxed' ? 'blur(16px)' : styleMode === 'clean' ? 'blur(8px)' : 'none'
          }}
        >
          {isFinished ? (
            <div className="animate-pulse px-[2cqw] max-w-[85cqw]">
              <span
                className="font-black tracking-wide drop-shadow-[0_4px_24px_rgba(0,0,0,0.85)] text-balance leading-snug block text-white text-center"
                style={{ fontSize: `${(isCenter ? 5.2 : 3.4) * headerScale}cqh`, fontFamily: 'inherit' }}
              >
                {endMessage}
              </span>
            </div>
          ) : (
            <>
              {activeTitle && (
                <span
                  className="uppercase font-black tracking-[0.14em] drop-shadow-md text-white/95 leading-snug text-center max-w-[85cqw] text-balance break-words px-[2cqw]"
                  style={{ fontSize: `${(isCenter ? 3.8 : 2.4) * headerScale}cqh`, fontFamily: 'inherit' }}
                >
                  {activeTitle}
                </span>
              )}
              {styleMode === 'boxed' && activeTitle && (
                <div className="w-[50%] h-[1.5px] bg-white/25 my-[1.4cqh]" />
              )}
              {styleMode !== 'boxed' && activeTitle && (
                <div className="h-[0.8cqh]" />
              )}
              <div
                className="font-black tracking-tight drop-shadow-[0_4px_32px_rgba(0,0,0,0.9)] tabular-nums leading-none text-white text-center"
                style={{ fontSize: `${(isCenter ? 12.5 : 6.5) * digitsScale}cqh`, fontFamily: 'inherit' }}
              >
                {formatCountdown(remaining)}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// isProjector: this instance is running on the dedicated projector screen, so it MUST go to standby if !isLive
export default function OutputScreen({ payload, isMaster = false, isProjector = false, isLiveBroadcast = false, muteAudio = false, onStatusUpdate = null, remoteCommand = null }) {
    const videoRef = useRef(null);
    const stickyAudioRef = useRef(null);
    const iframeRef = useRef(null);
    const [hasInteracted, setHasInteracted] = useState(isMaster);
    const [prevMaster, setPrevMaster] = useState(isMaster);
    if (isMaster !== prevMaster) {
       setPrevMaster(isMaster);
       if (isMaster) setHasInteracted(true);
    }

    // Network Viewers (payload.isNetworkViewer) MUST be kept muted permanently to ensure continuous mobile silent autoplay.
    const isMuted = muteAudio || !isMaster;

    const hasInteractedRef = useRef(false);
    useEffect(() => { hasInteractedRef.current = hasInteracted; }, [hasInteracted]);

    // Tracking for Master & Followers
    const followerTimeRef = useRef(0);
    const followerDurationRef = useRef(0);
    const followerPausedRef = useRef(payload?.isPaused ?? true);
    const isMutingReports = useRef(false);
    const isVimeoReady = useRef(false);
    const pendingPlayCommandRef = useRef(false);
    const lastSeekTsRef = useRef(0);

    // 1. URL/Mute Engine
    const activeMediaUrl = payload?.activeMediaUrl;
    const isYouTube = payload?.isYouTube;
    const isVimeo = payload?.isVimeo;
    const itemAutoPlay = payload?.itemAutoPlay;
    const isLive = payload?.isLive;
    const isPaused = payload?.isPaused;

    const iframeSrc = useMemo(() => {
       if (!activeMediaUrl) return '';
       let url = activeMediaUrl;
       if (isYouTube) url = getYoutubeEmbedUrl(url);
       try {
         const urlObj = new URL(url);
         if (!['http:', 'https:'].includes(urlObj.protocol)) return '';
         if (isYouTube) urlObj.searchParams.set('enablejsapi', '1');
         if (isVimeo) {
            urlObj.searchParams.set('api', '1');
            urlObj.searchParams.set('player_id', 'presenter-vimeo');
         }
         urlObj.searchParams.set('controls', '0');
         urlObj.searchParams.set('disablekb', '1');
         urlObj.searchParams.set('fs', '0');
         urlObj.searchParams.set('modestbranding', '1');
         urlObj.searchParams.set('playsinline', '1');
         urlObj.searchParams.set('autopause', '0');
         urlObj.searchParams.set('iv_load_policy', '3');
         urlObj.searchParams.set('origin', window.location.origin);
         
         if (isYouTube) {
            urlObj.searchParams.set('mute', isMaster && !muteAudio ? '0' : '1');
         }
         if (isVimeo) {
            urlObj.searchParams.set('muted', isMaster && !muteAudio ? '0' : '1');
         }

         // For master (projector/preview): respect the item's autoPlay setting, but only if Live is enabled.
         // For followers (network view): autoplay only if the master is actively playing.
         if (!isMaster) {
            if (!isLive || isPaused) urlObj.searchParams.delete('autoplay');
            else urlObj.searchParams.set('autoplay', '1');
         } else {
            if (itemAutoPlay && isLive) urlObj.searchParams.set('autoplay', '1');
            else urlObj.searchParams.delete('autoplay');
         }

         return urlObj.toString();
       } catch {
         return '';
       }
    }, [activeMediaUrl, isMaster, muteAudio, isYouTube, isVimeo, itemAutoPlay, isLive, isPaused]);

    // Sticky Audio Playback Logic
    useEffect(() => {
       if (stickyAudioRef.current && payload?.stickyAudioUrl) {
          const a = stickyAudioRef.current;
          if (isMaster && !muteAudio) {
             a.muted = false;
             a.volume = 1;
          } else {
             a.muted = true;
          }
          a.play().catch(() => {});
       } else if (stickyAudioRef.current) {
          stickyAudioRef.current.pause();
       }
    }, [payload?.stickyAudioUrl, isMaster, muteAudio]);

    // 2. Command Helpers
    const sendIframeCommand = (cmd, args = []) => {
       if (!iframeRef.current) return;
       iframeRef.current.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: cmd, args }), 'https://www.youtube.com');
    };

    const sendVimeoCommand = (method, value = "") => {
       if (!iframeRef.current?.contentWindow) return;
       iframeRef.current.contentWindow.postMessage(JSON.stringify({ method, value }), 'https://player.vimeo.com');
    };

    // executeUnmute: removes the forced-mute that browsers apply at startup.
    const executeUnmute = () => {
       if (muteAudio || !isMaster) return; // Only master can unmute
       
       if (payload?.isYouTube) {
          sendIframeCommand('mute');
          setTimeout(() => {
             sendIframeCommand('unMute');
             sendIframeCommand('setVolume', [100]);
             sendIframeCommand('setOption', ['captions', 'track', {}]);
             sendIframeCommand('unloadModule', ['captions']);
             sendIframeCommand('unloadModule', ['cc']);
          }, 100);
       } else if (payload?.isVimeo) {
          sendVimeoCommand('setMuted', false);
          sendVimeoCommand('setVolume', 1);
          setTimeout(() => {
             sendVimeoCommand('setMuted', false);
             sendVimeoCommand('setVolume', 1);
             
             let jumpTime = payload?.currentTime || 0.1;
             if (payload?.currentTimeTs && !payload?.isPaused) {
                 jumpTime += ((Date.now() - payload.currentTimeTs) / 1000);
             }
             sendVimeoCommand('seekTo', jumpTime);
             
             if (!payload?.isPaused) sendVimeoCommand('play');
          }, 500);
       } else if (videoRef.current) {
          // Local video/audio: unmute programmatically
          videoRef.current.muted = false;
          videoRef.current.volume = 1;
          
          if (payload?.currentTime) {
             let jumpTime = payload.currentTime;
             if (payload.currentTimeTs && !payload.isPaused) {
                 jumpTime += ((Date.now() - payload.currentTimeTs) / 1000);
             }
             videoRef.current.currentTime = jumpTime;
          }

          if (!payload?.isPaused) {
              videoRef.current.play().catch(() => {});
          }
       }

       if (stickyAudioRef.current && payload?.stickyAudioUrl) {
          stickyAudioRef.current.muted = false;
          stickyAudioRef.current.volume = 1;
          stickyAudioRef.current.play().catch(() => {});
       }
    };

    useEffect(() => { 
       if (hasInteracted && isMaster) executeUnmute(); 
    }, [hasInteracted, isMaster, payload?.activeMediaUrl]);

    // 3. YouTube & Vimeo Status Polling (Master only)
    const handleStatusUpdate = (status) => {
        if (onStatusUpdate) onStatusUpdate(status);
        if (isProjector) {
            const bc = new BroadcastChannel('presenter-projector-hub');
            bc.postMessage({ type: 'status', itemId: payload?.itemId, ...status });
            bc.close();
        }
    };
    
    const statusHandlerRef = useRef(handleStatusUpdate);
    useEffect(() => {
       statusHandlerRef.current = handleStatusUpdate;
    }, [onStatusUpdate, isProjector, payload?.itemId]);

    useEffect(() => {
       if (!payload?.activeMediaUrl) return;
       
       // Reset state for new media
       followerPausedRef.current = payload.isPaused ?? true;
       followerTimeRef.current = payload.currentTime ?? 0;
       isVimeoReady.current = false;

       if (!payload.isYouTube && !payload.isVimeo) return;

       pendingPlayCommandRef.current = false;
       let isYouTubeListening = false;
       let lastStatusTs = 0;
       let lastPaused = null;

       const handleMessage = (event) => {
          try {
             if (payload.isYouTube) {
                if (event.origin !== "https://www.youtube.com") return;
                const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
                const info = data.info || data.data;
                if ((data.event === 'infoDelivery' || data.event === 'initialDelivery' || data.event === 'onStateChange') && info) {
                   if (!isYouTubeListening) {
                      sendIframeCommand('setOption', ['captions', 'track', {}]);
                      sendIframeCommand('unloadModule', ['captions']);
                      sendIframeCommand('unloadModule', ['cc']);
                   }
                    if (!isYouTubeListening && (data.event === 'initialDelivery' || data.event === 'infoDelivery')) {
                       if (hasInteractedRef.current && isMaster && !muteAudio) {
                           sendIframeCommand('unMute');
                           sendIframeCommand('setVolume', [100]);
                       }
                       // If we're booting up and the payload says we should be playing, jumpstart!
                       if (payload && !payload.isPaused) {
                           let jumpTime = payload.currentTime;
                           if (payload.currentTimeTs) {
                               jumpTime += ((Date.now() - payload.currentTimeTs) / 1000);
                           }
                           // If we are a follower, add 0.6s to compensate for buffering so we land in sync.
                           sendIframeCommand('seekTo', [jumpTime + (isMaster ? 0 : 0.6), true]);
                           sendIframeCommand('playVideo');
                       }
                    }
                   isYouTubeListening = true;

                   const time = info.currentTime ?? followerTimeRef.current;
                   const duration = info.duration ?? followerDurationRef.current;
                   const paused = info.playerState !== undefined ? (info.playerState !== 1 && info.playerState !== 3) : followerPausedRef.current;
                   followerPausedRef.current = paused;
                   
                   if (info.playerState === 1) {
                       sendIframeCommand('setOption', ['captions', 'track', {}]);
                       sendIframeCommand('unloadModule', ['captions']);
                       sendIframeCommand('unloadModule', ['cc']);
                   }
                   
                   // Force unmute when transitioning to play if it's the master and we have a pending play command
                   if (info.playerState === 1 && pendingPlayCommandRef.current && isMaster && !muteAudio && !isMutingReports.current) {
                       sendIframeCommand('unMute');
                       sendIframeCommand('setVolume', [100]);
                       pendingPlayCommandRef.current = false;
                   }

                   if (duration > 0) {
                      const now = Date.now();
                      if (now - lastStatusTs > 500 || paused !== lastPaused) {
                          lastStatusTs = now;
                          lastPaused = paused;
                          if (isMaster && !isMutingReports.current) statusHandlerRef.current?.({ time, duration, paused, ts: now });
                      }
                      followerTimeRef.current = time;
                      followerDurationRef.current = duration;
                   }
                }
             } else if (payload.isVimeo) {
                if (event.origin !== "https://player.vimeo.com") return;
                const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
                const eventName = data.event || data.method;

                if (eventName === 'ready') {
                   isVimeoReady.current = true;
                   sendVimeoCommand('addEventListener', 'play');
                   sendVimeoCommand('addEventListener', 'pause');
                   sendVimeoCommand('addEventListener', 'finish');
                   sendVimeoCommand('addEventListener', 'timeupdate');
                   
                   if (hasInteractedRef.current && isMaster && !muteAudio) {
                      sendVimeoCommand('setMuted', false);
                      sendVimeoCommand('setVolume', 1);
                   }
                   
                   if (!followerPausedRef.current || pendingPlayCommandRef.current) {
                      sendVimeoCommand('play');
                      if (isMaster && !muteAudio) {
                         sendVimeoCommand('setMuted', false);
                         sendVimeoCommand('setVolume', 1);
                      }
                      pendingPlayCommandRef.current = false;
                   }
                }
                if (eventName === 'timeupdate' && data.data) {
                   const time = data.data.seconds;
                   const duration = data.data.duration;
                   
                   const now = Date.now();
                   if (now - lastStatusTs > 500) {
                      lastStatusTs = now;
                      if (isMaster && !isMutingReports.current) statusHandlerRef.current?.({ time, duration, paused: followerPausedRef.current, ts: now });
                   }
                   followerTimeRef.current = time;
                   followerDurationRef.current = duration;
                } else if (eventName === 'play') {
                   if (isMaster && !isMutingReports.current) statusHandlerRef.current?.({ paused: false, ts: Date.now() });
                   followerPausedRef.current = false;
                } else if (eventName === 'pause') {
                   if (isMaster && !isMutingReports.current) statusHandlerRef.current?.({ paused: true, ts: Date.now() });
                   followerPausedRef.current = true;
                } else if (eventName === 'finish') {
                   if (isMaster && !isMutingReports.current) statusHandlerRef.current?.({ paused: true, time: followerDurationRef.current, ts: Date.now() });
                   followerPausedRef.current = true;
                } else if (data.method === 'getCurrentTime') {
                   if (isMaster && !isMutingReports.current) statusHandlerRef.current?.({ time: data.value, ts: Date.now() });
                   followerTimeRef.current = data.value;
                } else if (data.method === 'getDuration') {
                   if (isMaster && !isMutingReports.current) statusHandlerRef.current?.({ duration: data.value, ts: Date.now() });
                   followerDurationRef.current = data.value;
                }
             }
          } catch {
             /* ignore non-JSON messages */
          }
       };

       window.addEventListener('message', handleMessage);

       const poll = setInterval(() => {
          if (!iframeRef.current?.contentWindow) return;
          if (payload.isVimeo) {
             sendVimeoCommand('getCurrentTime');
             sendVimeoCommand('getDuration');
             if (!isVimeoReady.current) {
               sendVimeoCommand('addEventListener', 'play');
               sendVimeoCommand('addEventListener', 'pause');
               sendVimeoCommand('addEventListener', 'finish');
               sendVimeoCommand('addEventListener', 'timeupdate');
             }
          }
       }, 500);

       return () => {
          window.removeEventListener('message', handleMessage);
          clearInterval(poll);
       };
    }, [isMaster, payload?.activeMediaUrl, payload?.isYouTube, payload?.isVimeo]);

    // 4. Remote Command Relay (play/pause/seek/volume from dashboard controls)
    useEffect(() => {
       if (!remoteCommand) return;
       const { command, value } = remoteCommand;
       isMutingReports.current = true;

       if (command === 'play') pendingPlayCommandRef.current = true;
       if (command === 'pause') pendingPlayCommandRef.current = false;

       // Any play command triggers play naturally. forceUnmute is handled by interaction listeners.
       if (isMaster && command === 'pause') {
           followerPausedRef.current = true;
           statusHandlerRef.current?.({ paused: true, ts: Date.now() });
       }
       if (payload?.isYouTube) {
          if (command === 'play') {
             if (value !== undefined) sendIframeCommand('seekTo', [value, true]);
             sendIframeCommand('playVideo');
             // The actual unMute will fire when onStateChange reports playerState = 1
          }
          if (command === 'pause') {
             if (value !== undefined) sendIframeCommand('seekTo', [value, true]);
             sendIframeCommand('pauseVideo');
          }
          if (command === 'seek') {
             sendIframeCommand('seekTo', [value, true]);
             if (followerPausedRef.current) setTimeout(() => sendIframeCommand('pauseVideo'), 300);
          }
          if (command === 'volume') {
             if (!isMaster) return; // Never unmute followers
             sendIframeCommand('unMute');
             sendIframeCommand('setVolume', [value * 100]);
          }
       }

       if (payload?.isVimeo) {
          if (command === 'play') {
             if (value !== undefined) sendVimeoCommand('seekTo', value);
             sendVimeoCommand('play');
             if (isMaster && !muteAudio) {
                sendVimeoCommand('setMuted', false);
                sendVimeoCommand('setVolume', 1);
             }
          }
          if (command === 'pause') {
             if (value !== undefined) sendVimeoCommand('seekTo', value);
             sendVimeoCommand('pause');
          }
          if (command === 'seek') {
             sendVimeoCommand('seekTo', value);
             if (followerPausedRef.current) setTimeout(() => sendVimeoCommand('pause'), 300);
          }
          if (command === 'volume') {
             if (!isMaster) return; // Never unmute followers
             sendVimeoCommand('setMuted', value === 0);
             sendVimeoCommand('setVolume', value);
          }
       }

       if (videoRef.current && !payload?.isYouTube && !payload?.isVimeo) {
          const v = videoRef.current;
          if (command === 'play') { 
              if (value !== undefined) v.currentTime = value;
              if (isMaster && !muteAudio) { 
                 v.muted = false; 
                 v.volume = 1; 
              } else {
                 v.muted = true;
                 v.volume = 0;
              }
              v.play().catch(() => {}); 
          }
          if (command === 'pause') {
              if (value !== undefined) v.currentTime = value;
              v.pause();
          }
          if (command === 'seek') v.currentTime = value;
          if (command === 'volume') { if (isMaster) { v.volume = value; v.muted = (value === 0); } }
          if (command === 'loop') v.loop = value;
       }
       const timer = setTimeout(() => { isMutingReports.current = false; }, 500);
       return () => clearTimeout(timer);
    }, [remoteCommand, isMaster, payload?.isYouTube, payload?.isVimeo]);

    // 5. Follower Passive Sync (network/projector followers)
    useEffect(() => {
       if (isMaster || !payload) return;
       const { currentTime, isPaused, currentTimeTs } = payload;
       let targetTime = currentTime;
       if (!isPaused) {
           targetTime += ((Date.now() - (currentTimeTs || Date.now())) / 1000);
       }

       if (payload.isYouTube || payload.isVimeo) {
          const rawDiff = followerTimeRef.current - targetTime;
          const absDiff = Math.abs(rawDiff);
          
          const hardSeekThreshold = 0.4;
          
          if (!isPaused && absDiff > hardSeekThreshold) {
             if (Date.now() - lastSeekTsRef.current >= 3000) {
                 lastSeekTsRef.current = Date.now();
                 // Add 0.3s to YouTube seeks to compensate for buffering time, so it lands in sync!
                 if (payload.isYouTube) sendIframeCommand('seekTo', [targetTime + 0.3, true]);
                 else sendVimeoCommand('seekTo', targetTime);
                 followerTimeRef.current = targetTime;
             }
          } else if (!isPaused) {
             if (payload.isVimeo) {
                let rate = 1;
                if (rawDiff > 0.1) rate = 0.95;
                else if (rawDiff < -0.1) rate = 1.05;
                sendVimeoCommand('setPlaybackRate', rate);
             }
          } else if (isPaused) {
             // Removed because seeking while paused causes glitching.
          }

          if (isPaused && !followerPausedRef.current) {
             if (payload.isYouTube) sendIframeCommand('pauseVideo');
             else sendVimeoCommand('pause');
             followerPausedRef.current = true;
          } else if (!isPaused && followerPausedRef.current) {
             if (payload.isYouTube) sendIframeCommand('playVideo');
             else sendVimeoCommand('play');
             followerPausedRef.current = false;
          }
       }
       if (videoRef.current) {
          const v = videoRef.current;
          const rawDiff = v.currentTime - targetTime;
          
          if (!isPaused && Math.abs(rawDiff) > 0.5) {
             if (v.readyState >= 1) {
                try { v.currentTime = targetTime; } catch {
                   /* ignore seek race */
                }
             }
             v.playbackRate = 1;
          } else if (!isPaused) {
             if (rawDiff > 0.05) v.playbackRate = 0.95;
             else if (rawDiff < -0.05) v.playbackRate = 1.05;
             else v.playbackRate = 1;
          }

          if (isPaused && !v.paused) {
             v.pause();
             v.playbackRate = 1;
          } else if (!isPaused && v.paused) {
             v.play().catch(() => {});
          }
       }
    }, [payload?.currentTime, payload?.isPaused, isMaster]);

    const forceStandby = (isProjector || payload?.isNetworkViewer) && !payload?.isLive;

    const hasMedia = payload?.activeMediaUrl || (payload?.activeSlide && payload?.activeSlide.length > 0);
    const isStandby = !payload || forceStandby || (!hasMedia && !payload?.isBlackScreen && !payload?.isShowLogo);

    const isTextCategory = !isStandby && (
       payload?.mediaType === 'song' ||
       payload?.mediaType === 'bible' ||
       payload?.mediaType === 'liturgy'
    );

    const activeBg = isTextCategory
       ? (payload?.backgrounds?.[payload.mediaType] || {
            bgType: payload?.bgType || 'color',
            bgColor: payload?.bgColor || '#000000',
            bgImageUrl: payload?.bgImageUrl,
            bgVideoUrl: payload?.bgVideoUrl,
            bgDim: payload?.bgDim !== undefined ? payload.bgDim : 0.3,
            bgVideoLoop: payload?.bgVideoLoop ?? true,
         })
       : {
            bgType: 'color',
            bgColor: '#000000',
            bgImageUrl: null,
            bgVideoUrl: null,
            bgDim: 0,
            bgVideoLoop: true,
         };

    const resolvedFontFamily = useMemo(() => {
       return getFontFamilyCss(payload?.displayFont);
    }, [payload?.displayFont]);

    const renderBackgroundMedia = () => {
       const bgType = activeBg.bgType || 'color';
       const bgImageUrl = activeBg.bgImageUrl;
       const bgVideoUrl = activeBg.bgVideoUrl;
       const bgDim = activeBg.bgDim !== undefined ? activeBg.bgDim : 0.3;
       const bgVideoLoop = activeBg.bgVideoLoop ?? true;

       if (bgType === 'image' && bgImageUrl) {
          return (
             <div
                key={`bg-img-${bgImageUrl}`}
                className="absolute inset-0 pointer-events-none overflow-hidden z-0"
                style={{ animation: 'transitionCrossfadeIn 500ms cubic-bezier(0.37, 0, 0.63, 1) both' }}
             >
                <img 
                   src={bgImageUrl} 
                   alt="" 
                   className="w-full h-full object-cover"
                />
                {bgDim > 0 && (
                   <div 
                      className="absolute inset-0 bg-black transition-opacity duration-300 pointer-events-none" 
                      style={{ opacity: bgDim }}
                   />
                )}
             </div>
          );
       }

       if (bgType === 'video' && bgVideoUrl) {
          return (
             <div
                key={`bg-vid-${bgVideoUrl}`}
                className="absolute inset-0 pointer-events-none overflow-hidden z-0"
                style={{ animation: 'transitionCrossfadeIn 500ms cubic-bezier(0.37, 0, 0.63, 1) both' }}
             >
                <video
                   ref={bindAutoPlayMutedVideo}
                   key={bgVideoUrl}
                   src={bgVideoUrl}
                   autoPlay
                   loop={bgVideoLoop}
                   muted
                   playsInline
                   onError={e => {
                      console.warn("Background video playback failed for URL:", bgVideoUrl, e);
                   }}
                   onLoadedData={e => {
                      e.target.muted = true;
                      e.target.play().catch(() => {});
                   }}
                   onCanPlay={e => {
                      e.target.muted = true;
                      e.target.play().catch(() => {});
                   }}
                   className="w-full h-full object-cover pointer-events-none"
                />
                {bgDim > 0 && (
                   <div 
                      className="absolute inset-0 bg-black transition-opacity duration-300 pointer-events-none" 
                      style={{ opacity: bgDim }}
                   />
                )}
             </div>
          );
       }

       return null;
    };

    const renderContent = () => {
        if (isStandby) {
           return (
             <div 
               className="flex flex-col items-center justify-center text-center w-full h-full bg-gradient-to-b from-neutral-950 to-black relative overflow-hidden font-sans"
               style={{ containerType: 'size', fontFamily: 'Inter, sans-serif' }}
             >
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150cqw] h-[150cqw] bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.05)_0,transparent_40%)] animate-[spin_60s_linear_infinite] pointer-events-none"></div>
                
                {/* Connection Status Badge */}
                <div className="absolute top-[4cqh] right-[4cqw] flex items-center gap-[1cqw] bg-white/5 border border-white/10 px-[2cqw] py-[1cqh] rounded-full backdrop-blur-md z-20">
                   <div className="w-[1cqw] h-[1cqw] max-w-2 max-h-2 rounded-full bg-green-500 animate-pulse"></div>
                   <span className="text-white/70 text-[min(1.5cqw,2cqh)] font-bold tracking-widest uppercase truncate max-w-[40cqw]">Connected to {payload?.churchName || "Server"}</span>
                </div>

                {/* Presenter Logo/Watermark */}
                <div className="absolute bottom-[4cqh] flex flex-col items-center opacity-30 z-20">
                   <span className="text-[min(2cqw,3cqh)] font-black tracking-[0.4em] text-white uppercase drop-shadow-lg">Presenter</span>
                   <span className="text-[min(1cqw,1.5cqh)] font-bold tracking-widest text-white/70 uppercase mt-1">Presentation System</span>
                </div>

                <div className="relative z-10 flex flex-col items-center w-[85%]">
                    <h1 className="text-[min(10cqw,15cqh)] font-black tracking-[0.15em] text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 uppercase drop-shadow-2xl leading-[1.1] text-balance text-center">
                       {payload?.churchName || "STANDBY"}
                    </h1>
                    {payload?.churchName && (
                        <div className="flex flex-col items-center mt-[4cqh]">
                            <div className="h-[2px] w-[12cqw] bg-blue-500/40 rounded-full mb-[3cqh]"></div>
                            <span className="text-white/50 text-[min(2cqw,3cqh)] font-bold tracking-[0.3em] uppercase text-center">Ready for broadcast</span>
                        </div>
                    )}
                </div>
             </div>
           );
        }

        if (payload.isBlackScreen) return <div className="absolute inset-0 bg-black z-40" />;

        if (payload.isShowLogo && payload.logoUrl) {
            return (
              <div className="absolute inset-0 bg-black z-30 flex items-center justify-center">
                 <img src={payload.logoUrl} className="w-full h-full object-contain animate-in zoom-in-95" />
              </div>
            );
        }



        const transitionEnabled = payload?.transitionEnabled ?? true;
        const transitionType = payload?.transitionType || 'crossfade';
        const transitionDuration = payload?.transitionDuration || 400;
        const slideContentKey = payload?.itemId
          ? `${payload.itemId}_${payload?.slideIndex ?? 0}_${payload?.mediaType || ''}_${payload?.activeMediaUrl || ''}`
          : `${payload?.slideIndex ?? 0}_${payload?.mediaType || ''}_${(payload?.activeSlide || []).join('~')}_${payload?.activeMediaUrl || ''}`;

        return (
           <div 
             className="w-full h-full relative overflow-hidden transition-colors duration-500"
             style={{ backgroundColor: activeBg.bgColor || '#000000' }}
           >
              {/* Background media layer (image/video loop with dimming) */}
              {renderBackgroundMedia()}
              {payload.mediaType === 'video' && payload.activeMediaUrl && (
                 (payload.isYouTube || payload.isVimeo) ? (
                    <div className={`w-full h-full relative ${(isMaster && hasInteracted) || !isMaster ? 'pointer-events-none' : ''}`}>
                      <iframe
                        ref={iframeRef}
                        id={payload.isVimeo ? "presenter-vimeo" : undefined}
                        src={iframeSrc}
                        onLoad={(e) => {
                           if (payload.isYouTube) {
                              e.target.contentWindow?.postMessage(JSON.stringify({ event: 'listening' }), '*');
                           }
                        }}
                        className="w-full h-full scale-[1.01] origin-center"
                        style={{ clipPath: 'inset(1% 1% 1% 1%)' }}
                        frameBorder="0"
                        allow="autoplay; fullscreen; encrypted-media"
                      />
                    </div>
                 ) : (
                    <video
                      ref={videoRef}
                      key={payload.activeMediaUrl}
                      src={payload.activeMediaUrl}
                      autoPlay={isMaster ? (payload.itemAutoPlay && payload.isLive) : (!payload?.isPaused && payload?.isLive)}
                      muted={isMuted ? true : undefined}
                      loop={payload.itemLoop ?? true}
                      className={`w-full h-full object-cover ${(isMaster && hasInteracted) || !isMaster ? 'pointer-events-none' : ''}`}
                      onLoadedMetadata={(e) => {
                          if (isMaster) {
                             // Ensure local video has audio (browser may have blocked it)
                             if (!muteAudio) { e.target.muted = false; e.target.volume = 1; }
                             if (!isMutingReports.current) statusHandlerRef.current?.({
                                duration: e.target.duration,
                                time: e.target.currentTime,
                                paused: e.target.paused,
                                ts: Date.now()
                             });
                          } else {
                             // FOLLOWERS/PROJECTOR MUST BE STRICTLY MUTED
                             e.target.muted = true;
                             e.target.volume = 0;
                          }
                          
                          if (!isMaster && payload) {
                            // Follower mid-playback synchronization initialization
                            const target = payload.currentTime + (payload.isPaused ? 0 : ((Date.now() - (payload.currentTimeTs || Date.now())) / 1000));
                            e.target.currentTime = target;
                            if (!payload.isPaused) e.target.play().catch(() => {});
                         }
                      }}
                      onTimeUpdate={(e) => {
                         if (isMaster) {
                            const now = Date.now();
                            if (!videoRef.current._lastReport || now - videoRef.current._lastReport > 250) {
                               videoRef.current._lastReport = now;
                               if (!isMutingReports.current) statusHandlerRef.current?.({
                                  time: e.target.currentTime,
                                  duration: e.target.duration,
                                  paused: e.target.paused,
                                  ts: now
                               });
                            }
                         }
                      }}
                      onPlay={() => isMaster && !isMutingReports.current && statusHandlerRef.current?.({ paused: false, ts: Date.now() })}
                      onPause={() => isMaster && !isMutingReports.current && statusHandlerRef.current?.({ paused: true, ts: Date.now() })}
                    />
                 )
              )}
              {payload.mediaType === 'audio' && payload.activeMediaUrl && (
                  <audio
                    ref={videoRef}
                    key={payload.activeMediaUrl}
                    src={payload.activeMediaUrl}
                    autoPlay={isMaster ? payload.itemAutoPlay : (!payload?.isPaused && payload?.isLive)}
                    muted={isMuted ? true : undefined}
                    loop={payload.itemLoop ?? false}
                    className="hidden"
                      onLoadedMetadata={(e) => {
                         if (isMaster) {
                            if (!muteAudio) { e.target.muted = false; e.target.volume = 1; }
                            statusHandlerRef.current?.({
                               duration: e.target.duration,
                               time: e.target.currentTime,
                               paused: e.target.paused,
                               ts: Date.now()
                            });
                         } else {
                            e.target.muted = true;
                            e.target.volume = 0;
                         }
                         
                         if (!isMaster && payload) {
                          const target = payload.currentTime + (payload.isPaused ? 0 : ((Date.now() - (payload.currentTimeTs || Date.now())) / 1000));
                          e.target.currentTime = target;
                          if (!payload.isPaused) e.target.play().catch(() => {});
                       }
                    }}
                    onTimeUpdate={(e) => {
                       if (isMaster) {
                          const now = Date.now();
                          if (!videoRef.current._lastReport || now - videoRef.current._lastReport > 250) {
                             videoRef.current._lastReport = now;
                             if (!isMutingReports.current) statusHandlerRef.current?.({
                                time: e.target.currentTime,
                                duration: e.target.duration,
                                paused: e.target.paused,
                                ts: now
                             });
                          }
                       }
                    }}
                    onPlay={() => isMaster && !isMutingReports.current && statusHandlerRef.current?.({ paused: false, ts: Date.now() })}
                    onPause={() => isMaster && !isMutingReports.current && statusHandlerRef.current?.({ paused: true, ts: Date.now() })}
                  />
              )}

              {/* Persistent Audio Layer */}
              {payload.stickyAudioUrl && (
                  <audio 
                    ref={stickyAudioRef}
                    src={payload.stickyAudioUrl} 
                    autoPlay={true} 
                    muted={isMuted || muteAudio} 
                    onEnded={() => {
                        if (isMaster) {
                           const bc = new BroadcastChannel('presenter-projector-hub');
                           bc.postMessage({ type: 'sticky-audio-ended' });
                           bc.close();
                        }
                    }}
                    className="hidden" 
                  />
              )}

              {/* Slide Content with Transitions (Lyrics / Bible / Liturgy / Slide Deck Images) */}
              <SlideTransitionContainer
                contentKey={slideContentKey}
                transitionEnabled={transitionEnabled}
                transitionType={transitionType}
                duration={transitionDuration}
              >
                {(payload.mediaType === 'image' || payload.mediaType === 'slide_deck') && payload.activeMediaUrl && (
                   <img src={payload.activeMediaUrl} className="w-full h-full object-contain pointer-events-none" />
                )}
                {(payload.mediaType === 'song' || payload.mediaType === 'bible') && payload.activeSlide && payload.activeSlide.length > 0 && (
                   <AutoFitLyrics 
                     lines={payload.activeSlide} 
                     subText={payload.slideSubText} 
                     isMaster={isMaster} 
                     isLiveBroadcast={isLiveBroadcast} 
                     mediaType={payload.mediaType} 
                     songMetadata={payload.songMetadata} 
                     ccliSettings={payload.ccliSettings}
                     fontFamily={resolvedFontFamily}
                     fontName={payload.displayFont || 'Inter'}
                     textScale={payload.textScale ?? 1}
                     linesPerSlide={payload.linesPerSlide || 0}
                   />
                )}
                {payload.mediaType === 'liturgy' && payload.activeSlide && payload.activeSlide.length > 0 && (
                   <AutoFitLiturgy
                     lines={payload.activeSlide}
                     liturgyType={payload.liturgyType || 'speaker'}
                     alignment={payload.liturgyAlignment || 'center'}
                     isMaster={isMaster}
                     isLiveBroadcast={isLiveBroadcast}
                     fontFamily={resolvedFontFamily}
                     fontName={payload.displayFont || 'Inter'}
                     textScale={payload.textScale ?? 1}
                     linesPerSlide={payload.linesPerSlide || 0}
                   />
                )}
              </SlideTransitionContainer>


           </div>
        );
    };

    return (
      <div 
        className="w-full h-full overflow-hidden relative transition-colors duration-500" 
        onClick={() => setHasInteracted(true)}
        style={{ 
          containerType: 'size',
          fontFamily: resolvedFontFamily,
          backgroundColor: activeBg.bgColor || '#000000'
        }}
      >
         {renderContent()}
         {(!isProjector || payload?.isLive) && !payload?.isBlackScreen && (
           <>
             <AnnouncementOverlay 
               announcement={payload?.announcement} 
               settings={{
                 ...(payload?.overlaySettings?.announcement || {}),
                 fontFamily: resolvedFontFamily
               }} 
             />
             <CountdownOverlay 
               countdown={payload?.countdown} 
               settings={{
                 ...(payload?.overlaySettings?.countdown || {}),
                 fontFamily: resolvedFontFamily
               }} 
               countdownBg={payload?.backgrounds?.countdown}
             />
           </>
         )}
      </div>
    );
}
