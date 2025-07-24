import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { build } from "esbuild";

// electronディレクトリ内のTypeScriptファイルを再帰的に取得
function getEntryPoints(dir) {
  const entries = {};

  function scanDir(currentDir, relativePath = "") {
    const items = readdirSync(currentDir);

    for (const item of items) {
      const fullPath = join(currentDir, item);
      const stats = statSync(fullPath);

      if (stats.isDirectory()) {
        scanDir(fullPath, relativePath ? `${relativePath}/${item}` : item);
      } else if (
        item.endsWith(".ts") &&
        !item.endsWith(".d.ts") &&
        item !== "preload.ts"
      ) {
        const entryName = relativePath
          ? `${relativePath}/${item.replace(".ts", "")}`
          : item.replace(".ts", "");
        entries[entryName] = fullPath;
      }
    }
  }

  scanDir(dir);
  return entries;
}

const entryPoints = getEntryPoints("./electron");

// 通常のElectronファイルをビルド
await build({
  entryPoints,
  bundle: true,
  platform: "node",
  target: "node18",
  format: "esm",
  outdir: "./build/electron",
  external: ["electron", "sqlite3", "win-protect"],
  sourcemap: true,
  minify: false,
  define: {
    __dirname: "import.meta.dirname",
    __filename: "import.meta.filename",
  },
  banner: {
    js: `
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
`,
  },
  loader: {
    ".node": "copy",
  },
});

// preload.tsをCommonJSとして別途ビルド
await build({
  entryPoints: {
    preload: "./electron/preload.ts",
  },
  bundle: true,
  platform: "node",
  target: "node18",
  format: "cjs",
  outdir: "./build/electron",
  external: ["electron"],
  sourcemap: true,
  minify: false,
});

console.log("✅ Electron build completed");
