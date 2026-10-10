import { cp, mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const outdir = join(root, "dist");
const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as {
  version: string;
};
const manifest = JSON.parse(await readFile(join(root, "public/manifest.json"), "utf8")) as {
  version: string;
};
if (packageJson.version !== manifest.version) {
  throw new Error(
    `Version mismatch: package.json is ${packageJson.version}, manifest.json is ${manifest.version}`,
  );
}
await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });
const result = await Bun.build({
  entrypoints: ["src/background.ts", "src/content.ts", "src/options.ts"].map((path) =>
    join(root, path),
  ),
  outdir,
  target: "browser",
  format: "iife",
  minify: true,
});
if (!result.success) {
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}
await cp(join(root, "public"), outdir, { recursive: true });
console.log(`Built ${outdir}`);
