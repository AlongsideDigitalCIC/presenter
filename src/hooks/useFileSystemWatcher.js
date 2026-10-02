import { useEffect, useState } from 'react';

/**
 * A hook that returns a monotonically increasing integer (`trigger`)
 * whenever the library directory changes. It utilizes the modern
 * FileSystemObserver API if available, or falls back to basic polling.
 */
export function useFileSystemWatcher(libraryHandle) {
  const [trigger, setTrigger] = useState(0);

  useEffect(() => {
    if (!libraryHandle) return;

    let observer;
    let interval;

    const setupObserver = async () => {
      try {
        if ('FileSystemObserver' in window) {
          observer = new window.FileSystemObserver((records) => {
            // Something changed (file added, modified, deleted)
            setTrigger(t => t + 1);
          });
          await observer.observe(libraryHandle, { recursive: true });
          console.log("FileSystemObserver attached to Presenter Library.");
        } else {
          // Fallback recursive polling logic
          // A simple timer that prompts the consumer to check for updates.
          interval = setInterval(() => {
            setTrigger(t => t + 1);
          }, 5000);
          console.log("FileSystemObserver not found. Using polling fallback (5s).");
        }
      } catch (err) {
         console.warn("Watcher initialization failed, falling back to polling", err);
         interval = setInterval(() => setTrigger(t => t + 1), 5000);
      }
    };

    setupObserver();

    return () => {
      if (observer) observer.disconnect();
      if (interval) clearInterval(interval);
    };
  }, [libraryHandle]);

  const refresh = () => setTrigger(t => t + 1);

  return [trigger, refresh];
}
