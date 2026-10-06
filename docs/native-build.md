# Native Helper Build Provenance

The extension includes `assets/JSON Workbench.app`. Its executable is built entirely from `native/JSONEditor.swift` and `native/LaunchInput.swift`, using Apple's Cocoa and WebKit frameworks. The embedded editor is bundled from `editor/` and `src/lib/` by esbuild using the committed npm lockfile. No helper is downloaded or fetched at runtime.

## Rebuild

On macOS with Xcode Command Line Tools and Node.js 22 or later:

```sh
npm ci
npm run build:editor
```

The script invokes `xcrun swiftc -O -target arm64-apple-macosx13.0` and `xcrun swiftc -O -target x86_64-apple-macosx13.0`, links Cocoa and WebKit, combines both executables with `xcrun lipo`, and applies an ad-hoc signature with `codesign --sign -`. This is not an Apple notarization claim.

`docs/native-build.json` records the version, compiler, SDK version, architectures, minimum macOS version, both Swift source SHA-256 hashes, and executable / JavaScript SHA-256 hashes. `docs/third-party-notices.txt` records the license texts of packages bundled into the editor and is included in the app. Binary bytes can vary with the compiler and SDK; reviewers can rebuild the complete helper from the included sources.

## Verify

```sh
lipo -archs 'assets/JSON Workbench.app/Contents/MacOS/JSONEditor'
codesign --verify --deep --strict 'assets/JSON Workbench.app'
shasum -a 256 native/JSONEditor.swift native/LaunchInput.swift 'assets/JSON Workbench.app/Contents/MacOS/JSONEditor'
npm run test:native
```

The standard `npm run build` packages committed assets and does not require a local Swift compilation. The helper has no network behavior. WKWebView loads bundled local files with a restrictive content security policy and a nonpersistent data store.

The generated `editor.js` contains the embedded QuickJS WASM byte data. Git treats it as binary to preserve those bytes and avoid diffing generated content; its sources remain in `editor/`, `src/lib/`, and the locked npm packages.

For standalone distribution, `--clipboard` reads text or a local file from the macOS pasteboard in the app process. `--input` accepts JSON text or an absolute local file path / file URL. Both enforce the same 8 MiB input bound. The positional HTML / temporary-handoff interface remains available to the full Raycast extension.
