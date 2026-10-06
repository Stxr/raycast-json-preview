# 验证记录

日期：2026-10-06。平台：macOS，当前主机架构构建。

- 19 项自动测试通过，覆盖格式转换、数字精度、截图表达式、点号/方括号路径、运行时隔离、无限循环中断和恢复。
- TypeScript、ESLint 和 Prettier 检查通过，Swift 窗口与两条 Raycast 命令构建成功。
- ego-browser 验证表达式、YAML、超时恢复与大整数精度门槛。
- 实际 macOS WKWebView 窗口成功执行截图表达式。从 Raycast 搜索传入示例文件路径，确认安装目录中的窗口载入完整数据。
- 原生复制的 JSON 与完整示例相同，验证后恢复原剪贴板；原生保存面板导出的 JSON 读回一致。
- 通过 Computer Use 实测 uTools 1.7.1：无过滤单面板，有过滤双栏，清空过滤恢复单面板。只读检查安装后的 ASAR 配置与 Monaco 自动格式化选项。
- 更新版从 Raycast 实际启动后，确认无条件单面板、自动格式化载入与对应工具栏。
- “折叠”“展开”文字按钮与“始终置顶”开关已在更新版真实窗口显示，Swift `.floating` / `.normal` 切换与偏好保存完成构建检查。Computer Use 点击时连续报告窗口被用户更改，因此未完成置顶切换和跨应用覆盖的实机核验；不把开关显示当作置顶效果已验收。

原始 UPXS 尚未直接解密。安装后 ASAR 可读不证明两者逐字节对应。原生树形浏览未逐项完成桌面导航验收。当前为本地扩展；商店发布须替换 `txr` 为有效 Raycast 作者账号，并运行 `npm run lint:store`。

验证结果不等同于用户最终验收。

## 商店提交版验证

- Raycast 作者账号从当前 Account 设置核对为 `tang_xiangrun`；商店 `ray lint`、全部源码 lint、类型检查、19 项测试与 distribution build 通过。
- Swift 程序构建为 macOS 13+ 的 arm64 / x86_64 通用程序，`lipo -archs` 与 `codesign --verify --deep --strict` 通过。Intel 二进制已编译，未在真实 Intel Mac 上运行。
- 工程导入 Raycast 后，将已验证的 distribution 输出用于桌面测试，公开 `demo.json` 成功载入，单面板自动格式化与表达式双栏已确认。
- 置顶实机核验完成：开关开启时系统窗口层级为 3；重启窗口后开关保持开启；关闭开关后层级恢复 0。测试结束恢复默认关闭。
- `media/` 中的截图来自同一套已打包编辑器 UI 的浏览器视口，仅使用公开示例；不是完整原生窗口或 Raycast 外框截图。
- 发布版使用 US English 界面和 README，并保留中文说明。原始 UPXS 未直接解密的边界不变。
