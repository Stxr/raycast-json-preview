import { build } from "esbuild";
import { mkdir, copyFile, writeFile, mkdtemp, rm, readdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const root = fileURLToPath(new URL("..", import.meta.url));
const { version } = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error("Set a semantic release version in package.json.");
const app = join(root, "assets", "JSON Workbench.app", "Contents");
const destination = join(app, "Resources", "editor");
await mkdir(destination, { recursive: true });
await mkdir(join(app, "MacOS"), { recursive: true });
await mkdir(join(app, "Resources"), { recursive: true });
await mkdir(join(app, "Resources/editor"), { recursive: true });
const bundled = await build({
  entryPoints: [join(root, "editor/editor.ts")],
  outfile: join(destination, "editor.js"),
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "safari16",
  minify: true,
  legalComments: "eof",
  metafile: true,
});
const bundledPackages = new Set();
for (const path of Object.keys(bundled.metafile.inputs)) {
  const match = path.match(/node_modules\/((?:@[^/]+\/)?[^/]+)\//);
  if (match) bundledPackages.add(match[1]);
}
const notices = ["Third-party software bundled in the JSON Workbench editor.\n"];
for (const name of [...bundledPackages].sort()) {
  const directory = join(root, "node_modules", name);
  const metadata = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
  const licenses = (await readdir(directory)).filter((file) => /^(license|copying)(\.|$)/i.test(file));
  notices.push(`${name} ${metadata.version} (${metadata.license ?? "see license"})\n`);
  if (!licenses.length) {
    if (name === "@nodable/entities" && metadata.version === "3.1.0") {
      notices.push(await readFile(join(root, "docs/licenses/nodable-entities-MIT.txt"), "utf8"));
      continue;
    }
    throw new Error(`Missing license text for bundled package: ${name}`);
  }
  for (const license of licenses) notices.push(await readFile(join(directory, license), "utf8"));
}
await writeFile(join(root, "docs/third-party-notices.txt"), notices.join("\n\n").trimEnd() + "\n");
await copyFile(join(root, "docs/third-party-notices.txt"), join(app, "Resources/THIRD-PARTY-NOTICES.txt"));
await copyFile(join(root, "LICENSE"), join(app, "Resources/LICENSE"));
for (const file of ["index.html", "editor.css"]) await copyFile(join(root, "editor", file), join(destination, file));
const temporary = await mkdtemp(join(tmpdir(), "json-preview-build-"));
try {
  const binaries = ["arm64", "x86_64"].map((architecture) => join(temporary, architecture));
  for (const [index, architecture] of ["arm64", "x86_64"].entries()) {
    execFileSync(
      "xcrun",
      [
        "swiftc",
        "-O",
        "-target",
        `${architecture}-apple-macosx13.0`,
        join(root, "native/JSONEditor.swift"),
        join(root, "native/LaunchInput.swift"),
        "-o",
        binaries[index],
        "-framework",
        "Cocoa",
        "-framework",
        "WebKit",
      ],
      { stdio: "inherit" },
    );
  }
  execFileSync("xcrun", ["lipo", "-create", ...binaries, "-output", join(app, "MacOS/JSONEditor")]);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
execFileSync("xcrun", ["swift", join(root, "native/Icon.swift"), join(root, "assets/extension-icon.png")], {
  stdio: "inherit",
});
await copyFile(join(root, "assets/extension-icon.png"), join(app, "Resources/icon.png"));
await copyFile(join(root, "assets/extension-icon.png"), join(root, "raycast-scripts/icon.png"));
await writeFile(
  join(app, "Info.plist"),
  `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleExecutable</key><string>JSONEditor</string>
<key>CFBundleIdentifier</key><string>local.raycast.json-preview</string>
<key>CFBundleName</key><string>JSON Workbench</string>
<key>CFBundleDisplayName</key><string>JSON Workbench</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>${version}</string>
<key>CFBundleVersion</key><string>${version}</string>
<key>CFBundleIconFile</key><string>icon.png</string>
<key>NSHighResolutionCapable</key><true/>
<key>LSMinimumSystemVersion</key><string>13.0</string>
</dict></plist>\n`,
);
execFileSync("codesign", ["--force", "--sign", "-", app.replace(/\/Contents$/, "")], { stdio: "inherit" });
const hash = async (path) =>
  createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
await writeFile(
  join(root, "docs/native-build.json"),
  JSON.stringify(
    {
      source: "native/JSONEditor.swift",
      sourceSha256: await hash(join(root, "native/JSONEditor.swift")),
      launchInputSource: "native/LaunchInput.swift",
      launchInputSourceSha256: await hash(join(root, "native/LaunchInput.swift")),
      version,
      executableSha256: await hash(join(app, "MacOS/JSONEditor")),
      editorSha256: await hash(join(destination, "editor.js")),
      architectures: ["arm64", "x86_64"],
      minimumMacOS: "13.0",
      sdk: execFileSync("xcrun", ["--show-sdk-version"], { encoding: "utf8" }).trim(),
      compiler: execFileSync("xcrun", ["swiftc", "--version"], { encoding: "utf8" }).split("\n")[0],
      signing: "ad-hoc",
      rebuild: "npm ci && npm run build:editor",
    },
    null,
    2,
  ) + "\n",
);
console.log("Built local editor assets and universal macOS launcher (arm64 + x86_64).");
