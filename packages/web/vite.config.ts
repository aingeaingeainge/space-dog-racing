import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';

/**
 * Phase J: which build a report was played on — the tag, or the tag plus commits and hash, from git at
 * build time, never hard-coded. Cloudflare Pages may build from a clone without tags, which `--always`
 * covers with the hash; with no git at all, Pages' own commit variable, and then "unknown".
 */
function buildName(): string {
  try {
    return execSync('git describe --tags --always --dirty', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    const sha = process.env.CF_PAGES_COMMIT_SHA;
    return sha ? sha.slice(0, 7) : 'unknown';
  }
}

export default defineConfig({
  plugins: [react()],
  define: { __SDR_BUILD__: JSON.stringify(buildName()) },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Art is never inlined into the JS bundle. Vite's default is to fold anything under 4 kB
    // into a data: URL, which would have swallowed most of the placeholder set and, later, any
    // small icon or tile — the bundle is what every player downloads before they see anything,
    // and images are meant to arrive lazily and per planet (design/ASSET_LIST.md).
    assetsInlineLimit: 0,
  },
});
