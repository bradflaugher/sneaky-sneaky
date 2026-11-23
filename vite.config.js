import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

function buildStamp() {
  try {
    const sha = execSync('git rev-parse --short=8 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    if (sha) return `${sha}-${Math.floor(Date.now() / 1000).toString(36)}`;
  } catch {
    // Fallback when git metadata is unavailable.
  }
  return Date.now().toString(36);
}

function cacheBustHtml() {
  const ver = buildStamp();
  return {
    name: 'cache-bust-html',
    transformIndexHtml(html) {
      return html
        .replace('</head>', `  <meta name="build-version" content="${ver}" />\n  </head>`)
        .replace(
          /(href|src)="(\.\/(?:assets\/[^"]+\.(?:js|css)|favicon\.svg|site\.webmanifest))"/g,
          `$1="$2?v=${ver}"`,
        );
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [cacheBustHtml()],
  build: {
    target: 'es2022',
    outDir: 'dist',
    chunkSizeWarningLimit: 1200,
  },
  server: { host: true },
});
