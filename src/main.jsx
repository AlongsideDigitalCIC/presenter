import { isTauri } from './utils/env.js';
import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

// Fonts
import '@fontsource/inter/400.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/900.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/700.css';
import '@fontsource/roboto/900.css';
import '@fontsource/open-sans/400.css';
import '@fontsource/open-sans/700.css';
import '@fontsource/open-sans/800.css';
import '@fontsource/montserrat/400.css';
import '@fontsource/montserrat/700.css';
import '@fontsource/montserrat/900.css';
import '@fontsource/lato/400.css';
import '@fontsource/lato/700.css';
import '@fontsource/lato/900.css';
import '@fontsource/merriweather/400.css';
import '@fontsource/merriweather/700.css';
import '@fontsource/merriweather/900.css';
import '@fontsource/lora/400.css';
import '@fontsource/lora/700.css';
import '@fontsource/playfair-display/400.css';
import '@fontsource/playfair-display/700.css';
import '@fontsource/playfair-display/900.css';
import '@fontsource/crimson-pro/400.css';
import '@fontsource/crimson-pro/700.css';
import '@fontsource/crimson-pro/900.css';
import '@fontsource/eb-garamond/400.css';
import '@fontsource/eb-garamond/700.css';
import '@fontsource/eb-garamond/800.css';

// Lazily load heavy application components so the landing page loads instantly
const App = lazy(() => import('./App.jsx'));
const ProjectorWindow = lazy(() => import('./components/ProjectorWindow.jsx'));
const LiveViewer = lazy(() => import('./components/LiveViewer.jsx'));

import ErrorBoundary from './components/ErrorBoundary.jsx';

// Hard Route Controller
const isProjector = window.location.search.includes('projector=true');
const isLiveView = window.location.search.includes('view=live') || window.location.search.includes('network=true');

const renderApp = () => {
  if (isProjector) return <ProjectorWindow />;
  if (isLiveView) return <LiveViewer />;
  return <App />;
};

// Global loading spinner for suspense fallback
const LoadingFallback = () => (
  <div className={`h-screen w-screen flex items-center justify-center ${isProjector || isLiveView ? 'bg-black' : 'bg-[#FAF6F0]'}`}>
    <div className="w-8 h-8 border-4 border-[#3D7B8C]/25 border-t-[#3D7B8C] rounded-full animate-spin"></div>
  </div>
);

// Force unregister service workers in Tauri to prevent stale assets
if (isTauri() && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for(let registration of registrations) {
      registration.unregister();
    }
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <Suspense fallback={<LoadingFallback />}>
        {renderApp()}
      </Suspense>
    </ErrorBoundary>
  </StrictMode>,
)


