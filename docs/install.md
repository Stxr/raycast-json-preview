# Install JSON Workbench without the Raycast Store

macOS 13 or later. The prebuilt app supports both Apple Silicon and Intel. No Node.js or Xcode is needed for the app and Raycast Script Command.

## Download and install the app

1. Download `JSON-Workbench-v0.1.0-macos-universal.dmg` from [GitHub Releases](https://github.com/Stxr/raycast-json-preview/releases).
2. Open the disk image and drag **JSON Workbench.app** to **Applications**. You can use your own `~/Applications` folder instead.
3. Open the app once from Applications. Paste JSON or use **Open** to load a file. The app also works independently of Raycast.

This release has an ad-hoc integrity signature and **is not signed with an Apple Developer ID or notarized by Apple**. macOS can block its first launch after downloading. If you trust this repository and have verified the download, try opening the app, then go to **System Settings → Privacy & Security → Open Anyway** and confirm. Follow [Apple's instructions](https://support.apple.com/en-us/102445). Keep Gatekeeper enabled.

## Add the Raycast command

1. Copy the disk image's **Raycast Scripts** folder to a permanent location, for example `~/Documents/JSON Workbench Scripts`. Keep `open-json-workbench.sh` and `icon.png` together. Do this before ejecting the disk image.
2. Open **Raycast Settings → Extensions → + → Add Script Directory**, then select the folder you copied. This is Raycast's [official Script Commands installation flow](https://github.com/raycast/script-commands#install-script-commands-from-this-repository).
3. Search **Open JSON Workbench** in Raycast. With no argument, it opens clipboard text or a copied local file. You can pass JSON text, an absolute file path, or a `file://` URL. A new editor window opens for each invocation.

The editor includes automatic formatting, copy, transforms, conversion, collapse / expand, and always-on-top. This Script Command uses the clipboard; selected-text input and the **Preview JSON** tree inside Raycast belong to the full extension below.

To upgrade, quit JSON Workbench and replace the app with the next release. Replace the scripts if the release notes request it. To uninstall, remove the app and script directory from Raycast.

## Install the full Raycast extension from source

For **Preview JSON**, selected-text input, and extension preferences, download `JSON-Workbench-v0.1.0-raycast-extension.zip`. It contains the full source and prebuilt universal helper. Install Node.js 22 or later, extract the ZIP into a permanent folder, and run:

```sh
cd /path/to/JSON-Workbench-v0.1.0-raycast-extension
npm ci
npm run dev
```

Wait for Raycast to import the extension, then search **Open JSON Editor** or **Preview JSON**. You can stop the development process with Ctrl+C after import; the extension stays installed. Keep the extracted folder available. No Swift compilation or Xcode is required unless you change the helper's source.

The `.rayext` import path is not supported in the public Raycast build tested for this release, so it is not the installation method for these downloads.

## Verify downloads

Download `SHA256SUMS.txt` beside the artifacts into the same folder, then run:

```sh
shasum -a 256 -c SHA256SUMS.txt
```

The DMG contains `BUILD.json` with the version, source commit, architectures, and signing status. The source ZIP includes `docs/native-build.json` with the helper's source and binary hashes. Intel compilation and architecture inspection are verified; runtime UI checks for this release were performed on Apple Silicon.

---

# 中文安装说明

需要 macOS 13+，支持 Apple Silicon 和 Intel。

1. 在 [GitHub Releases](https://github.com/Stxr/raycast-json-preview/releases) 下载 **macos-universal.dmg**。
2. 打开后，将 **JSON Workbench.app** 拖入 **Applications（应用程序）**，再打开一次。应用可以独立使用，无需 Node.js 或 Xcode。
3. 此版本未进行 Apple Developer ID 签名或公证。下载后首次启动可能被 macOS 拦截；确认来源及校验值后，先尝试打开，再到 **系统设置 → 隐私与安全性 → 仍要打开** 完成确认，详见上方 Apple 官方说明。
4. 把 DMG 里的 **Raycast Scripts** 文件夹复制到长期保留的位置，例如“文稿”目录；不要直接从 DMG 添加脚本。
5. 在 **Raycast 设置 → Extensions → + → Add Script Directory** 选择复制后的文件夹，即可搜索 **Open JSON Workbench**。默认读取剪贴板，也可填写 JSON 文本或文件绝对路径。

该安装方式包含完整编辑窗口：自动格式化复制、过滤时双栏、转换、折叠/展开、始终置顶。若还需要 Raycast 内部的 **Preview JSON** 树状预览和选中文本输入，请下载 **raycast-extension.zip**，安装 Node.js 22+，按上方命令执行 `npm ci` 和 `npm run dev`。源码包已包含编译好的窗口，无需 Xcode。

升级时退出应用并替换 `.app`；卸载时删除应用并在 Raycast 移除脚本目录。校验下载文件可使用上方 `shasum` 命令。
