import { cp, mkdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = join(root, "dist");
const base = `${(process.env.SITE_BASE_PATH || "/simulators/").replace(/\/+$/, "")}/`;
const apps = [
  ["landing", "@practicedesk/landing", ""],
  ["mackie-profx22v3", "mackie-profx22-simulator", "mackie-profx22v3/"],
  ["cinetreak-mixer-plus", "mixer-plus-simulator", "cinetreak-mixer-plus/"],
  ["yamaha-stagepas400i", "stagepas400i-simulator", "yamaha-stagepas400i/"],
  ["yamaha-mg10xu", "mg10xu-simulator", "yamaha-mg10xu/"],
];
if (!process.env.npm_execpath) throw new Error("Run this with npm run build.");
if (dirname(output) !== root.replace(/[\\/]$/, ""))
  throw new Error("Build output must stay inside the repository.");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
// Each app owns its compiler and Vite version; only the final static files are combined.
for (const [directory, workspace, path] of apps) {
  const result = spawnSync(
    process.execPath,
    [process.env.npm_execpath, "run", "build", "--workspace", workspace],
    {
      cwd: root,
      stdio: "inherit",
      env: {
        ...process.env,
        VITE_SITE_BASE: base,
        VITE_BASE_PATH: `${base}${path}`,
      },
    },
  );
  if (result.status !== 0) process.exit(result.status || 1);
  await cp(join(root, "apps", directory, "dist"), join(output, path), {
    recursive: true,
  });
}
await cp(join(root, "skill"), join(output, "skill"), { recursive: true });
console.log(`Built practicedesk at ${base}`);
