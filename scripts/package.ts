import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const dist = join(root, "dist");
const release = join(root, "release");
const manifest = JSON.parse(await readFile(join(dist, "manifest.json"), "utf8")) as {
  version: string;
};
const archive = join(release, `steam-currency-converter-${manifest.version}.zip`);
const files = (await readdir(dist)).sort();

await mkdir(release, { recursive: true });
await rm(archive, { force: true });

const zip = Bun.spawn(["zip", "-X", "-q", "-r", archive, ...files], {
  cwd: dist,
  stderr: "inherit",
});
if ((await zip.exited) !== 0) {
  throw new Error("Could not create the Chrome Web Store package");
}

console.log(`Packaged ${archive}`);
