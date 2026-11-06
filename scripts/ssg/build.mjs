// Static encyclopedia pages (SEO): bundles scripts/ssg/main.ts with Vite (it imports the app's
// data modules and dictionaries) and runs it over the finished `dist/`.
//
//   node scripts/ssg/build.mjs                    every page, every language, into dist/
//   node scripts/ssg/build.mjs --langs en,tr --limit 200 --out /tmp/yeis-ssg
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const bundleDir = path.join(root, 'node_modules/.ssg');

await build({
  root,
  configFile: false,
  logLevel: 'warn',
  define: { __BUILD_ID__: JSON.stringify(process.env.BUILD_ID ?? 'ssg') },
  assetsInclude: ['**/*.glsl'],
  build: {
    ssr: path.join(root, 'scripts/ssg/main.ts'),
    outDir: bundleDir,
    emptyOutDir: true,
    target: 'node22',
    minify: false,
    rollupOptions: { output: { entryFileNames: 'main.mjs' } },
  },
});

const { generate } = await import(pathToFileURL(path.join(bundleDir, 'main.mjs')).href);
await generate({ root, args: process.argv.slice(2), buildId: process.env.BUILD_ID ?? Date.now().toString(36) });
