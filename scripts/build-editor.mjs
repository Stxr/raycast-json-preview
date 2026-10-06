import { build } from "esbuild";
import { mkdir, copyFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const destination = join(root, "assets", "editor");
const app = join(root, "assets", "JSON Preview.app", "Contents");
await mkdir(destination, { recursive: true });
await mkdir(join(app, "MacOS"), { recursive: true });
await mkdir(join(app, "Resources"), { recursive: true });
await mkdir(join(app, "Resources/editor"), { recursive: true });
await build({
  entryPoints: [join(root, "editor/editor.ts")],
  outfile: join(destination, "editor.js"),
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "safari16",
  minify: true,
  legalComments: "eof",
});
for (const file of ["index.html", "editor.css"]) await copyFile(join(root, "editor", file), join(destination, file));
for (const file of ["index.html", "editor.css", "editor.js"])
  await copyFile(join(destination, file), join(app, "Resources/editor", file));
execFileSync(
  "xcrun",
  [
    "swiftc",
    "-O",
    join(root, "native/JSONEditor.swift"),
    "-o",
    join(app, "MacOS/JSONEditor"),
    "-framework",
    "Cocoa",
    "-framework",
    "WebKit",
  ],
  { stdio: "inherit" },
);
execFileSync("xcrun", ["swift", join(root, "native/Icon.swift"), join(root, "assets/extension-icon.png")], {
  stdio: "inherit",
});
await copyFile(join(root, "assets/extension-icon.png"), join(app, "Resources/icon.png"));
await writeFile(
  join(app, "Info.plist"),
  `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleExecutable</key><string>JSONEditor</string>
<key>CFBundleIdentifier</key><string>local.raycast.json-preview</string>
<key>CFBundleName</key><string>JSON Preview</string>
<key>CFBundleDisplayName</key><string>JSON Preview</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>0.1.0</string>
<key>CFBundleVersion</key><string>1</string>
<key>CFBundleIconFile</key><string>icon.png</string>
<key>NSHighResolutionCapable</key><true/>
<key>LSMinimumSystemVersion</key><string>13.0</string>
</dict></plist>\n`,
);
console.log("Built local editor assets and macOS launcher.");
