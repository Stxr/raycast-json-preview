import Foundation

enum LaunchMode: Equatable {
    case empty
    case clipboard
    case input(String)
    case handoff(html: URL, request: URL?)
}

enum LaunchInput {
    static let maxBytes = 8 * 1024 * 1024

    static func parse(_ arguments: [String]) throws -> LaunchMode {
        if arguments.isEmpty { return .empty }
        if arguments == ["--clipboard"] { return .clipboard }
        if arguments.count == 2 && arguments[0] == "--input" { return .input(arguments[1]) }
        if arguments.count <= 2 && !arguments[0].hasPrefix("--") {
            return .handoff(html: URL(fileURLWithPath: arguments[0]), request: arguments.count == 2 ? URL(fileURLWithPath: arguments[1]) : nil)
        }
        throw failure("Use --clipboard or --input followed by JSON text or an absolute file path.")
    }

    static func checkedText(_ text: String) throws -> String {
        guard text.utf8.count <= maxBytes else { throw failure("Input exceeds 8 MiB.") }
        return text
    }

    static func readFile(_ url: URL) throws -> String {
        guard url.isFileURL else { throw failure("Choose a local file.") }
        let values = try url.resourceValues(forKeys: [.fileSizeKey, .isRegularFileKey])
        guard values.isRegularFile == true else { throw failure("Choose a regular UTF-8 text file.") }
        guard (values.fileSize ?? 0) <= maxBytes else { throw failure("The file exceeds 8 MiB.") }
        let data = try Data(contentsOf: url, options: .mappedIfSafe)
        guard data.count <= maxBytes else { throw failure("The file exceeds 8 MiB.") }
        guard let text = String(data: data, encoding: .utf8) else { throw failure("Choose a UTF-8 text file.") }
        return text
    }

    static func input(_ value: String) throws -> (text: String, name: String) {
        if value.hasPrefix("file://") {
            guard let url = URL(string: value), url.isFileURL, url.host == nil || url.host == "" || url.host == "localhost" else { throw failure("Choose a local file URL.") }
            return (try readFile(url), url.lastPathComponent)
        }
        if (value.hasPrefix("/") && !value.hasPrefix("/*") && !value.hasPrefix("//")) || value.hasPrefix("~/") {
            let url = URL(fileURLWithPath: (value as NSString).expandingTildeInPath)
            return (try readFile(url), url.lastPathComponent)
        }
        return (try checkedText(value), "Command Input")
    }

    private static func failure(_ message: String) -> NSError {
        NSError(domain: "JSONWorkbench", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
    }
}
