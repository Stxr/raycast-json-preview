import variant from "@jitl/quickjs-singlefile-browser-release-sync";
import { newQuickJSWASMModuleFromVariant } from "quickjs-emscripten-core";
import { parse } from "lossless-json";
import { formatJson, hasUnsafeNumbers, JsonValue, MAX_INPUT_BYTES } from "./json";

let modulePromise: ReturnType<typeof newQuickJSWASMModuleFromVariant> | undefined;

export async function transform(value: JsonValue, expression: string, timeoutMs = 800): Promise<JsonValue> {
  const text = expression.trim();
  if (!text || text === "this") return value;
  if (text.length > 10_000) throw new Error("表达式超过 10,000 字符。");
  if (hasUnsafeNumbers(value))
    throw new Error("输入含 JavaScript Number 无法精确表示的数字。预览仍保留原数值；请先将这些字段改为字符串再过滤。");
  modulePromise ??= newQuickJSWASMModuleFromVariant(variant);
  const engine = await modulePromise;
  const runtime = engine.newRuntime();
  runtime.setMemoryLimit(64 * 1024 * 1024);
  runtime.setMaxStackSize(1024 * 1024);
  const deadline = Date.now() + timeoutMs;
  runtime.setInterruptHandler(() => Date.now() > deadline);
  const context = runtime.newContext();
  // Accept both complete expressions and the uTools-style suffix following its fixed `this` label.
  const bracketPath = /^\[\s*(?:\d+|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*\](?:[.[]|$)/.test(text);
  const body = text.startsWith(";") ? text.slice(1).trim() : text.startsWith(".") || bracketPath ? `this${text}` : text;
  try {
    const data = context.newString(formatJson(value, 0));
    context.setProp(context.global, "__input", data);
    data.dispose();
    const code = `(() => {
      const input = JSON.parse(__input);
      const result = (function () { "use strict"; return (${body}\n); }).call(input);
      if (result === undefined) throw new Error("表达式返回 undefined，请返回有效的 JSON 值。");
      if (result && typeof result.then === "function") throw new Error("仅支持同步表达式。");
      return JSON.stringify(result, function (key, v) {
        if (typeof v === "number" && !Number.isFinite(v)) throw new Error("结果包含 NaN 或 Infinity。");
        if (typeof v === "undefined" || typeof v === "function" || typeof v === "symbol" || typeof v === "bigint") throw new Error("结果包含无法表示为 JSON 的值。");
        return v;
      });
    })()`;
    const result = context.evalCode(code);
    if (result.error) {
      const error = context.dump(result.error) as { message?: string };
      result.error.dispose();
      throw new Error(
        error?.message === "interrupted"
          ? "表达式执行超时，请缩小数据或简化表达式。"
          : error?.message || "表达式执行失败。",
      );
    }
    let output: string;
    try {
      output = context.getString(result.value);
    } finally {
      result.value.dispose();
    }
    if (new TextEncoder().encode(output).length > MAX_INPUT_BYTES) throw new Error("表达式结果超过 8 MiB。");
    return parse(output) as JsonValue;
  } finally {
    context.dispose();
    runtime.dispose();
  }
}
