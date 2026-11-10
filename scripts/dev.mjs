import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const children = [];
const apps = [
  ["landing", 5300, "/"],
  ["mackie-profx22v3", 5301, "/mackie-profx22v3/"],
  ["cinetreak-mixer-plus", 5302, "/cinetreak-mixer-plus/"],
  ["yamaha-stagepas400i", 5303, "/yamaha-stagepas400i/"],
  ["yamaha-mg10xu", 5304, "/yamaha-mg10xu/"],
  ["zoom-h6essential", 5305, "/zoom-h6essential/"],
];
let stopping = false;
const stop = () => {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
};
// The landing server proxies each simulator path. Direct Vite processes make
// Ctrl+C stop all servers reliably without leaving npm grandchildren.
for (const [app, port, base] of apps) {
  const cwd = join(root, "apps", app);
  const require = createRequire(join(cwd, "package.json"));
  const vite = join(
    dirname(require.resolve("vite/package.json")),
    "bin/vite.js",
  );
  const child = spawn(
    process.execPath,
    [vite, "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
    {
      cwd,
      stdio: "inherit",
      env: { ...process.env, VITE_BASE_PATH: base, VITE_SITE_BASE: "/" },
    },
  );
  children.push(child);
  child.on("exit", (code) => {
    if (!stopping) {
      process.exitCode = code || 1;
      stop();
    }
  });
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
