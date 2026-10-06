import {
  Action,
  ActionPanel,
  Detail,
  Form,
  getPreferenceValues,
  Icon,
  LaunchProps,
  List,
  showToast,
  Toast,
  useNavigation,
  Keyboard,
} from "@raycast/api";
import { useEffect, useState } from "react";
import {
  childPath,
  codeMarkdown,
  Document,
  formatJson,
  isContainer,
  JsonValue,
  kind,
  PAGE_SIZE,
  parseInput,
  summary,
  toTypeScript,
  toXml,
  toYaml,
} from "./lib/json";
import { readInput } from "./lib/input";
import { initialInput, launchEditor } from "./lib/launch-editor";
import { transform } from "./lib/query";

function ValueActions({ value, path, input }: { value: JsonValue; path: string; input: string }) {
  const { push } = useNavigation();
  const indent = Number(getPreferenceValues<{ indent?: string }>().indent ?? "2");
  const formatted = formatJson(value, indent);
  return (
    <ActionPanel>
      {isContainer(value) && (
        <Action
          title="展开节点"
          icon={Icon.List}
          onAction={() => push(<Browser value={value} path={path} input={input} />)}
        />
      )}
      <Action
        title="完整预览"
        icon={Icon.Eye}
        onAction={() =>
          push(
            <Detail
              navigationTitle={path}
              markdown={codeMarkdown(formatted)}
              actions={
                <ActionPanel>
                  <Action.CopyToClipboard title="复制 JSON" content={formatted} />
                </ActionPanel>
              }
            />,
          )
        }
      />
      <Action.CopyToClipboard title="复制 JSON" content={formatted} shortcut={{ modifiers: ["cmd"], key: "c" }} />
      <Action.CopyToClipboard title="复制压缩 JSON" content={formatJson(value, 0)} />
      <Action.CopyToClipboard title="复制路径" content={path} />
      <Action
        title="在双栏编辑器中打开"
        icon={Icon.Window}
        onAction={() => launchEditor(input)}
        shortcut={Keyboard.Shortcut.Common.Open}
      />
      <Action
        title="JavaScript 过滤"
        icon={Icon.Code}
        onAction={() => push(<QueryForm value={value} input={input} />)}
        shortcut={{ modifiers: ["cmd"], key: "f" }}
      />
      <ActionPanel.Section title="格式转换">
        <Action.CopyToClipboard title="复制转义 JSON" content={JSON.stringify(formatJson(value, 0))} />
        <Action.CopyToClipboard title="复制 TypeScript 类型" content={toTypeScript(value)} />
        <Action
          title="复制 YAML"
          onAction={async () => {
            try {
              const { Clipboard } = await import("@raycast/api");
              await Clipboard.copy(toYaml(value));
            } catch (error) {
              await failure(error);
            }
          }}
        />
        <Action
          title="复制 XML"
          onAction={async () => {
            try {
              const { Clipboard } = await import("@raycast/api");
              await Clipboard.copy(toXml(value));
            } catch (error) {
              await failure(error);
            }
          }}
        />
      </ActionPanel.Section>
    </ActionPanel>
  );
}

async function failure(error: unknown) {
  await showToast({
    style: Toast.Style.Failure,
    title: "操作失败",
    message: error instanceof Error ? error.message : String(error),
  });
}

function Browser({ value, path = "this", input }: { value: JsonValue; path?: string; input: string }) {
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState("");
  const entries = isContainer(value) ? Object.entries(value) : [];
  const filtered = query
    ? entries.filter(([key, child]) =>
        `${key} ${summary(child)}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
      )
    : entries;
  const shown = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  return (
    <List
      navigationTitle={path}
      isShowingDetail
      filtering={false}
      searchBarPlaceholder="搜索当前层字段或值…"
      onSearchTextChange={(text) => {
        setQuery(text);
        setPage(0);
      }}
    >
      <List.Section title={`${kind(value)} · ${summary(value)}`}>
        <List.Item
          title="完整 JSON"
          icon={Icon.Code}
          detail={<List.Item.Detail markdown={codeMarkdown(formatJson(value))} />}
          actions={<ValueActions value={value} path={path} input={input} />}
        />
      </List.Section>
      <List.Section title={`${filtered.length} 项 · 第 ${page + 1}/${pages} 页`}>
        {shown.map(([key, child]) => (
          <List.Item
            key={key}
            title={key}
            subtitle={summary(child)}
            icon={isContainer(child) ? Icon.List : Icon.Text}
            accessories={[{ text: kind(child) }]}
            detail={<List.Item.Detail markdown={codeMarkdown(formatJson(child))} />}
            actions={<ValueActions value={child} path={childPath(path, key, value)} input={input} />}
          />
        ))}
        {page > 0 && (
          <List.Item
            title="上一页"
            icon={Icon.ArrowLeft}
            actions={
              <ActionPanel>
                <Action title="上一页" onAction={() => setPage(page - 1)} />
              </ActionPanel>
            }
          />
        )}
        {page + 1 < pages && (
          <List.Item
            title="下一页"
            icon={Icon.ArrowRight}
            actions={
              <ActionPanel>
                <Action title="下一页" onAction={() => setPage(page + 1)} />
              </ActionPanel>
            }
          />
        )}
      </List.Section>
    </List>
  );
}

function QueryForm({ value, input }: { value: JsonValue; input: string }) {
  const { push } = useNavigation();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  return (
    <Form
      isLoading={loading}
      navigationTitle="JavaScript 过滤"
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="执行并预览"
            onSubmit={async (values: { expression: string }) => {
              setLoading(true);
              try {
                const result = await transform(value, values.expression);
                setError(undefined);
                push(<Browser value={result} input={input} />);
              } catch (error) {
                setError(error instanceof Error ? error.message : String(error));
              } finally {
                setLoading(false);
              }
            }}
          />
        </ActionPanel>
      }
    >
      <Form.Description text="this 指向当前节点。示例：Object.values(this).map(x => x.map(y => y.name))。支持前置分号和 .map(...) 形式。" />
      <Form.TextArea id="expression" title="表达式" defaultValue="this" error={error} />
    </Form>
  );
}

export default function Command(props: LaunchProps<{ arguments: { input?: string } }>) {
  const [source, setSource] = useState("");
  const [document, setDocument] = useState<Document>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    void initialInput(props.arguments.input)
      .then((text) => {
        if (!mounted) return;
        setSource(text);
        if (text.trim()) {
          try {
            setDocument(parseInput(text));
          } catch (error) {
            setError(error instanceof Error ? error.message : String(error));
          }
        }
      })
      .catch((error) => {
        if (mounted) setError(error.message);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);
  if (document) return <Browser value={document.value} input={document.source} />;
  return (
    <Form
      navigationTitle="JSON Preview"
      isLoading={loading}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="预览 JSON"
            onSubmit={async () => {
              try {
                const input = await readInput(source);
                setDocument(parseInput(input.text));
                setError(undefined);
              } catch (error) {
                setError(error instanceof Error ? error.message : String(error));
              }
            }}
          />
        </ActionPanel>
      }
    >
      <Form.TextArea
        id="source"
        title="输入"
        placeholder="粘贴 JSON、YAML、XML、URL 参数，或输入文件的绝对路径"
        value={source}
        onChange={setSource}
        error={error}
      />
    </Form>
  );
}
