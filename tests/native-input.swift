import Foundation

@main
enum NativeInputTests {
    static func main() throws {
        let temporary = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: temporary, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: temporary) }
        func expect(_ result: Bool) { precondition(result) }
        func rejects(_ operation: () throws -> Void) {
            do { try operation(); fatalError("Expected invalid input to be rejected") } catch {}
        }

        expect(try LaunchInput.parse([]) == .empty)
        expect(try LaunchInput.parse(["--clipboard"]) == .clipboard)
        let json = "{\"name\":\"中文\",\"id\":9007199254740993}"
        expect(try LaunchInput.parse(["--input", json]) == .input(json))
        let html = temporary.appendingPathComponent("index.html")
        let request = temporary.appendingPathComponent("handoff.json")
        expect(try LaunchInput.parse([html.path, request.path]) == .handoff(html: html, request: request))
        rejects { _ = try LaunchInput.parse(["--input"]) }
        rejects { _ = try LaunchInput.parse(["--unknown", "/tmp/do-not-delete"]) }
        rejects { _ = try LaunchInput.parse(["--clipboard", "extra"]) }

        let file = temporary.appendingPathComponent("中文 with spaces.json")
        try json.write(to: file, atomically: true, encoding: .utf8)
        expect(try LaunchInput.input(file.path).text == json)
        expect(try LaunchInput.input(file.absoluteString).text == json)
        expect(try LaunchInput.input(json).text == json)
        expect(try LaunchInput.input("/* note */ {id: 1}").text == "/* note */ {id: 1}")
        expect(try LaunchInput.input("// note\n{id: 1}").text == "// note\n{id: 1}")
        expect(try LaunchInput.readFile(file) == json)
        rejects { _ = try LaunchInput.input(temporary.appendingPathComponent("missing.json").path) }
        rejects { _ = try LaunchInput.input("file://example.com/private.json") }
        rejects { _ = try LaunchInput.readFile(temporary) }

        let invalid = temporary.appendingPathComponent("invalid.json")
        try Data([0xff, 0xfe]).write(to: invalid)
        rejects { _ = try LaunchInput.readFile(invalid) }
        let boundary = String(repeating: "a", count: LaunchInput.maxBytes)
        expect(try LaunchInput.checkedText(boundary) == boundary)
        rejects { _ = try LaunchInput.checkedText(boundary + "a") }
        rejects { _ = try LaunchInput.checkedText(String(repeating: "中", count: LaunchInput.maxBytes / 3 + 1)) }
        let oversized = temporary.appendingPathComponent("oversized.json")
        try Data((boundary + "a").utf8).write(to: oversized)
        rejects { _ = try LaunchInput.readFile(oversized) }
        print("Native launch inputs passed: legacy handoff, clipboard, JSON, file URLs, UTF-8 and 8 MiB bounds.")
    }
}
