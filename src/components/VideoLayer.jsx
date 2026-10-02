export default function VideoLayer({ url, thumbnailOnly = false }) {
  // Utility to determine if URL is youtube, vimeo, or local mp4
  const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
  const isVimeo = url.includes('vimeo.com');

  if (thumbnailOnly) {
     return (
       <div className="w-full h-full bg-white border border-[#3D7B8C]/10 rounded-lg flex items-center justify-center relative overflow-hidden">
          <span className="text-xs text-neutral-400 font-bold uppercase tracking-wider">Video Embedded</span>
       </div>
     );
  }

  if (isYouTube) {
    // Extract ID
    const rawId = url.split('v=')[1] || url.split('youtu.be/')[1];
    const videoId = rawId?.split('&')[0];
    // rel=0 prevents related videos, modestbranding hides youtube logo, playsinline avoids full-screen on mobile
    const embedUrl = `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1&autoplay=1`;
    return (
      <iframe
        className="w-full h-full"
        src={embedUrl}
        frameBorder="0"
        allow="autoplay; encrypted-media"
        allowFullScreen
      ></iframe>
    );
  }

  if (isVimeo) {
    const videoId = url.split('vimeo.com/')[1];
    const embedUrl = `https://player.vimeo.com/video/${videoId}?autoplay=1&api=1&title=0&byline=0&portrait=0`;
    return (
      <iframe
        className="w-full h-full"
        src={embedUrl}
        frameBorder="0"
        allow="autoplay; fullscreen"
        allowFullScreen
      ></iframe>
    );
  }

  // Fallback for direct MP4
  return (
    <video 
      src={url} 
      className="w-full h-full object-contain" 
      autoPlay 
      controls={false}
    />
  );
}
