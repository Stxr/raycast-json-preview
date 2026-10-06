import { readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { MAX_INPUT_BYTES } from "./json";

export async function readInput(input: string): Promise<{ text: string; label: string }> {
  const trimmed = input.trim();
  const path = trimmed.startsWith("~/") ? `${homedir()}/${trimmed.slice(2)}` : trimmed;
  if (!path.startsWith("/") || path.includes("\n")) return { text: input, label: "文本" };
  const info = await stat(path).catch(() => null);
  if (!info) throw new Error("文件不存在，请检查路径；也可直接粘贴 JSON 内容。");
  if (!info.isFile()) throw new Error("请选择文件，而不是文件夹。");
  if (info.size > MAX_INPUT_BYTES) throw new Error("文件超过 8 MiB，请拆分后预览。");
  const buffer = await readFile(path);
  if (buffer.length > MAX_INPUT_BYTES) throw new Error("文件超过 8 MiB，请拆分后预览。");
  return { text: buffer.toString("utf8"), label: path.split("/").at(-1) ?? "文件" };
}
