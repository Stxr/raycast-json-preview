#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
test_dir="$(mktemp -d "${TMPDIR:-/tmp}/json-workbench-test.XXXXXX")"
trap 'rm -rf "$test_dir"' EXIT
xcrun swiftc native/LaunchInput.swift tests/native-input.swift -o "$test_dir/native-input-tests"
"$test_dir/native-input-tests"
