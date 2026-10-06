import Cocoa
import WebKit

final class EditorDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate {
    private var window: NSWindow!
    private var webView: WKWebView!
    private var initialText = ""
    private var initialIndent = 2
    private var dirty = false
    private let maxBytes = 8 * 1024 * 1024

    func applicationDidFinishLaunching(_ notification: Notification) {
        let menu = NSMenu()
        let appMenuItem = NSMenuItem()
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "Quit JSON Preview", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appMenuItem.submenu = appMenu
        menu.addItem(appMenuItem)
        let editMenuItem = NSMenuItem()
        let editMenu = NSMenu(title: "Edit")
        for (title, action, key) in [("Undo", "undo:", "z"), ("Cut", "cut:", "x"), ("Copy", "copy:", "c"), ("Paste", "paste:", "v"), ("Select All", "selectAll:", "a")] {
            editMenu.addItem(withTitle: title, action: Selector(action), keyEquivalent: key)
        }
        editMenuItem.submenu = editMenu
        menu.addItem(editMenuItem)
        NSApp.mainMenu = menu

        if CommandLine.arguments.count > 2 {
            let request = URL(fileURLWithPath: CommandLine.arguments[2])
            if let data = try? Data(contentsOf: request),
               let payload = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                initialText = payload["text"] as? String ?? ""
                initialIndent = payload["indent"] as? Int == 4 ? 4 : 2
            }
            // The input handoff is transient; do not leave clipboard contents on disk.
            try? FileManager.default.removeItem(at: request)
        }
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .nonPersistent()
        config.userContentController.add(self, name: "native")
        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1180, height: 800), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "JSON Preview"
        window.minSize = NSSize(width: 680, height: 460)
        window.contentView = webView
        window.delegate = self
        window.level = UserDefaults.standard.bool(forKey: "alwaysOnTop") ? .floating : .normal
        window.center()
        window.makeKeyAndOrderFront(nil)
        let html = CommandLine.arguments.count > 1
            ? URL(fileURLWithPath: CommandLine.arguments[1])
            : Bundle.main.resourceURL!.appendingPathComponent("editor/index.html")
        webView.loadFileURL(html, allowingReadAccessTo: html.deletingLastPathComponent())
        NSApp.activate(ignoringOtherApps: true)
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        decisionHandler(navigationAction.request.url?.isFileURL == true ? .allow : .cancel)
    }

    private func emit(_ object: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: object), let text = String(data: data, encoding: .utf8) else { return }
        webView.evaluateJavaScript("window.receiveNative(\(text))", completionHandler: nil)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, let body = message.body as? [String: Any], let action = body["action"] as? String else { return }
        switch action {
        case "ready":
            emit(["action": "load", "text": initialText, "name": "剪贴板 / 选中文本", "indent": initialIndent])
            emit(["action": "pin", "value": window.level == .floating])
            initialText = ""
        case "pin":
            let pinned = body["value"] as? Bool ?? false
            window.level = pinned ? .floating : .normal
            UserDefaults.standard.set(pinned, forKey: "alwaysOnTop")
            emit(["action": "pin", "value": pinned])
        case "dirty":
            dirty = body["value"] as? Bool ?? true
            window.isDocumentEdited = dirty
        case "paste":
            let text = NSPasteboard.general.string(forType: .string) ?? ""
            if text.utf8.count > maxBytes { emit(["action": "error", "message": "剪贴板内容超过 8 MiB。"]) }
            else { emit(["action": "paste", "text": text, "name": "剪贴板"]) }
        case "copy":
            NSPasteboard.general.clearContents()
            NSPasteboard.general.setString(body["text"] as? String ?? "", forType: .string)
            emit(["action": "notice", "message": "已复制结果"])
        case "open":
            let panel = NSOpenPanel()
            panel.canChooseDirectories = false
            panel.allowsMultipleSelection = false
            panel.beginSheetModal(for: window) { [weak self] response in
                guard response == .OK, let url = panel.url, let self else { return }
                do {
                    let attributes = try FileManager.default.attributesOfItem(atPath: url.path)
                    guard (attributes[.size] as? Int ?? 0) <= self.maxBytes else { throw NSError(domain: "JSONPreview", code: 1, userInfo: [NSLocalizedDescriptionKey: "文件超过 8 MiB。"] ) }
                    let data = try Data(contentsOf: url)
                    guard data.count <= self.maxBytes, let text = String(data: data, encoding: .utf8) else { throw NSError(domain: "JSONPreview", code: 2, userInfo: [NSLocalizedDescriptionKey: "请选择 UTF-8 文本文件。"] ) }
                    self.emit(["action": "open", "text": text, "name": url.lastPathComponent])
                } catch { self.emit(["action": "error", "message": error.localizedDescription]) }
            }
        case "save":
            let panel = NSSavePanel()
            panel.nameFieldStringValue = body["filename"] as? String ?? "result.json"
            let text = body["text"] as? String ?? ""
            panel.beginSheetModal(for: window) { [weak self] response in
                guard response == .OK, let url = panel.url, let self else { return }
                do {
                    try text.write(to: url, atomically: true, encoding: .utf8)
                    self.emit(["action": "notice", "message": "已保存 \(url.lastPathComponent)"])
                } catch { self.emit(["action": "error", "message": error.localizedDescription]) }
            }
        default: break
        }
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = NSAlert()
        alert.messageText = message
        alert.addButton(withTitle: "替换")
        alert.addButton(withTitle: "取消")
        alert.beginSheetModal(for: window) { response in completionHandler(response == .alertFirstButtonReturn) }
    }

    func windowShouldClose(_ sender: NSWindow) -> Bool {
        guard dirty else { return true }
        let alert = NSAlert()
        alert.messageText = "关闭编辑窗口？"
        alert.informativeText = "当前输入有改动。可先取消关闭，再通过“保存结果”导出。"
        alert.addButton(withTitle: "取消")
        alert.addButton(withTitle: "关闭")
        let close = alert.runModal() == .alertSecondButtonReturn
        if close { dirty = false }
        return close
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        return windowShouldClose(window) ? .terminateNow : .terminateCancel
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.regular)
let delegate = EditorDelegate()
app.delegate = delegate
app.run()
