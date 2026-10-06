import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const run = (command, args, options = {}) => execFileSync(command, args, { cwd: root, ...options });
const { version } = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error("Expected an X.Y.Z release version.");
if (run("git", ["status", "--porcelain", "--untracked-files=no"], { encoding: "utf8" }).trim()) {
  throw new Error("Commit the validated sources and app before packaging a release.");
}
const commit = run("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const committedVersion = JSON.parse(run("git", ["show", "HEAD:package.json"], { encoding: "utf8" })).version;
if (committedVersion !== version) throw new Error("Working version differs from the release commit.");
const output = join(root, "release", `v${version}`);
await mkdir(output, { recursive: true });
const staging = await mkdtemp(join(tmpdir(), "json-workbench-release-"));
const dmgName = `JSON-Workbench-v${version}-macos-universal.dmg`;
const sourceName = `JSON-Workbench-v${version}-raycast-extension.zip`;
for (const filename of [dmgName, sourceName, "SHA256SUMS.txt"]) {
  try {
    await readFile(join(output, filename));
    throw new Error(`Refusing to overwrite ${filename}.`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
try {
  const source = join(staging, `JSON-Workbench-v${version}-raycast-extension`);
  await mkdir(source);
  run("tar", ["-xf", "-", "-C", source], { input: run("git", ["archive", "--format=tar", "HEAD"]) });
  const app = join(source, "assets", "JSON Workbench.app");
  run("codesign", ["--verify", "--deep", "--strict", app]);
  const architectures = run("lipo", ["-archs", join(app, "Contents/MacOS/JSONEditor")], { encoding: "utf8" }).trim();
  if (!architectures.includes("arm64") || !architectures.includes("x86_64"))
    throw new Error("Expected a universal app.");
  const appVersion = run(
    "/usr/libexec/PlistBuddy",
    ["-c", "Print :CFBundleShortVersionString", join(app, "Contents/Info.plist")],
    { encoding: "utf8" },
  ).trim();
  if (appVersion !== version) throw new Error("Rebuild the app to match the release version.");
  const image = join(staging, "image");
  await mkdir(image);
  run("ditto", [app, join(image, "JSON Workbench.app")]);
  await cp(join(source, "raycast-scripts"), join(image, "Raycast Scripts"), { recursive: true });
  await cp(join(source, "docs/install.md"), join(image, "INSTALL.md"));
  await cp(join(source, "LICENSE"), join(image, "LICENSE"));
  await cp(join(source, "docs/third-party-notices.txt"), join(image, "THIRD-PARTY-NOTICES.txt"));
  await symlink("/Applications", join(image, "Applications"));
  const provenance = {
    version,
    tag: `v${version}`,
    commit,
    architectures: ["arm64", "x86_64"],
    minimumMacOS: "13.0",
    signing: "ad-hoc; not Apple notarized",
  };
  await writeFile(join(image, "BUILD.json"), JSON.stringify(provenance, null, 2) + "\n");
  run(
    "hdiutil",
    ["create", "-srcfolder", image, "-volname", `JSON Workbench ${version}`, "-format", "UDZO", join(output, dmgName)],
    { stdio: "inherit" },
  );
  run("ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", source, join(output, sourceName)]);
  const checksums = [];
  for (const filename of [dmgName, sourceName]) {
    checksums.push(
      `${createHash("sha256")
        .update(await readFile(join(output, filename)))
        .digest("hex")}  ${filename}`,
    );
  }
  await writeFile(join(output, "SHA256SUMS.txt"), checksums.join("\n") + "\n");
  console.log(`Packaged v${version} from ${commit}: ${output}`);
} finally {
  await rm(staging, { recursive: true, force: true });
}
