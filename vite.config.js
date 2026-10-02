import { defineConfig, loadEnv } from 'vite' // Presenter V2 Deployment
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Simulates the Netlify function during local development
const netlifyFunctionProxy = (env) => {
  return {
    name: 'netlify-function-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const urlObj = new URL(req.url, `http://${req.headers.host}`);
        
        if (urlObj.pathname === '/.netlify/functions/youversion') {
           const apiKey = env.YOUVERSION_API_KEY;
           if (!apiKey) {
             res.statusCode = 500;
             res.end(JSON.stringify({ error: 'YOUVERSION_API_KEY is not configured in your local .env file.' }));
             return;
           }

           const endpoint = urlObj.searchParams.get('endpoint');
           urlObj.searchParams.delete('endpoint');
           const qs = urlObj.searchParams.toString();
           
           if (!endpoint) {
             res.statusCode = 400;
             res.end(JSON.stringify({ error: 'Missing endpoint query parameter' }));
             return;
           }
           
           const targetUrl = `https://api.youversion.com/v1${endpoint}${qs ? '?' + qs : ''}`;
           
           try {
             const result = await fetch(targetUrl, {
               headers: {
                 'X-YVP-App-Key': apiKey.trim(),
                 'Accept': 'application/json'
               }
             });
             const body = await result.text();
             res.statusCode = result.status;
             res.setHeader('Content-Type', 'application/json');
             res.setHeader('Access-Control-Allow-Origin', '*');
             res.end(body);
           } catch(e) {
             res.statusCode = 500;
             res.setHeader('Access-Control-Allow-Origin', '*');
             res.end(JSON.stringify({ error: e.message }));
           }
           return;
        }

        next();
      });
    }
  };
};

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const basePath = '/';
  return {
    base: basePath,
    server: {
      watch: {
        ignored: ['**/src-tauri/**']
      },
      host: true, // Expose to local network automatically
      port: 5178, // Bypassing Redly's cached port
    },
    plugins: [
      netlifyFunctionProxy(env),
      tailwindcss(),
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: ['favicon.svg', 'pwa-192x192.png', 'pwa-512x512.png', 'icons.svg'],
        manifest: {
          name: "Alongside Digital - Presenter",
          short_name: "Presenter",
          description: "Church Presentation Software",
          start_url: `${basePath}app`,
          scope: basePath,
          display: "standalone",
          background_color: "#0a0a0a",
          theme_color: "#0a0a0a",
          icons: [
            {
              src: "favicon.svg",
              sizes: "any",
              type: "image/svg+xml",
              purpose: "any maskable"
            },
            {
              src: "pwa-192x192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any maskable"
            },
            {
              src: "pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable"
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,mjs,css,html,ico,png,svg,json}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
                },
                cacheableResponse: {
                  statuses: [0, 200]
                },
              }
            }
          ]
        }
      })
    ],
  };
})
