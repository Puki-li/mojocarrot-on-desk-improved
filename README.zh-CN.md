<p align="center">
  <img src="assets/tray-icon.png" width="128" alt="Mojocarrot on Desk">
</p>
<h1 align="center">Mojocarrot on Desk</h1>
<p align="center">
  <a href="README.md">English</a>
</p>
<p align="center">
  <a href="https://github.com/Puki-li/mojocarrot-on-desk-improved/actions/workflows/test.yml"><img src="https://github.com/Puki-li/mojocarrot-on-desk-improved/actions/workflows/test.yml/badge.svg" alt="Test"></a>
  <img src="https://img.shields.io/badge/version-1.0.2-2ea44f" alt="Version 1.0.2">
</p>

一个能实时感知 AI 编程助手工作状态的桌面宠物。项目基于公开仓库 [rullerzhou-afk/clawd-on-desk](https://github.com/rullerzhou-afk/clawd-on-desk) 改造而来，保留原项目的多 Agent 运行机制，同时把屏幕上的主角色替换为 **给 WMLS 们的 Mojocarrot**，并在 v1.0.0 中加入统一活跃状态、Codex 额度与更准确的会话识别。

> 支持 Windows 11、macOS 和 Ubuntu/Linux。需要 Node.js。支持 **Claude Code**、**Codex CLI**、**Copilot CLI**、**Gemini CLI** 与 **Cursor Agent**。

## 功能特性

### v1.0.2 重点更新
- **Agent 归属更准确** — 独立或镜像 hook 不再让 Claude Code、Gemini、Cursor、Copilot 错报成另一个工具的活动
- **Codex 额度更稳定** — 主周额度与模型专属额度隔离，较慢的历史扫描也不会覆盖更新的实时用量
- **历史任务可恢复** — Codex 任务从原创建日期目录继续执行时仍可发现，包括 Mojocarrot 启动前已静默一段时间的长任务
- **长任务完成更可靠** — 存活心跳不再压过稍晚落盘的完成事件，本地与远程监控都会持续刷新真实活跃会话
- **恢复与投递更安全** — 不可读日志不会造成主进程空转，异常 JSONL 会被跳过，hook 端口回退只会完成一次

### v1.0.1 重点更新
- **Codex 启动状态稳定** — 合并日志首批事件，桌宠和状态栏不再快速经历 Idle、思考中与工作中等过渡状态
- **完成状态更可靠** — 使用日志原始时间，延迟到达的历史事件无法覆盖较新的本轮完成状态
- **大日志快速恢复** — 通过事件循环分片快速追平大型 rollout，同时避免回放历史活动和额度提醒
- **状态栏首帧防闪** — 收到首份真实快照并完成尺寸计算后再显示状态栏

### v1.0.0 重点更新
- **统一活跃中心** — 常驻状态条集中展示 Codex、Claude Code、Cursor、Copilot 与 Gemini，点击即可打开活跃会话面板
- **Codex 周额度** — 直接查看剩余比例，以及本地日期、周几、时间和重置说明
- **更准确的工具归属** — 合并重复的 Claude 兼容事件，忽略 Codex 子 Agent rollout，避免历史日志回放和过早完成
- **长任务稳定性** — 增量读取日志并发送心跳，长时间 Codex 任务不会误空闲，也不会阻塞 Electron 主进程
- **更安全的本地 Hook** — 增加本地鉴权、限流、超时处理、私有令牌权限和安全的免打扰权限回退

### Mojocarrot 角色分支
- **给 WMLS 们的 Mojocarrot** — 将默认主角色替换为 Mojocarrot，同时保留原项目的多 Agent、权限气泡、极简模式和会话状态机
- **基于原版重新编排动画** — 很多场景仍参考原版 Clawd 的母版节奏，但表情、道具、前景特效、点击反应和 mini 模式都已经按 Mojocarrot 重新设计
- **分层角色资源** — Mojocarrot 使用身体、叶子、眼睛、嘴巴、睡姿等拆分资源，而不是单张扁平贴图，便于做眼球追踪、睡眠过渡和场景化脸部处理
- **原项目 credit** — 当前分支沿用了原版 `clawd-on-desk` 的运行时架构、hook 模型和桌宠工作流，这里主要改的是 Mojocarrot 角色资源、动画节奏和对外展示

### 多 Agent 支持
- **Claude Code** — 通过 command hook + HTTP 权限 hook 完整集成
- **Codex CLI** — 自动轮询 JSONL 日志（`~/.codex/sessions/`），无需配置
- **Copilot CLI** — 通过 `~/.copilot/hooks/hooks.json` 配置 command hook
- **Gemini CLI** — 通过 `~/.gemini/settings.json` 配置 command hook（Mojocarrot 启动时自动注册，或执行 `npm run install:gemini-hooks`）
- **Cursor Agent** — [Cursor IDE hooks](https://cursor.com/docs/agent/hooks)，配置在 `~/.cursor/hooks.json`（Mojocarrot 启动时自动注册，或执行 `npm run install:cursor-hooks`）
- **多 Agent 共存** — 多个 Agent 可同时运行，Mojocarrot 独立追踪每个会话

### 动画与交互
- **实时状态感知** — 通过 Agent hook 和日志轮询自动驱动动画
- **角色化动画状态** — 待机、思考、打字、建造、杂耍、指挥、报错、开心、通知、扫地、搬运、睡觉，以及对应的 mini 模式与点击反应，均已调整为 Mojocarrot 版本
- **眼球追踪** — 待机状态下 Mojocarrot 跟随鼠标，身体微倾，影子拉伸
- **睡眠序列** — 60 秒无活动 → 打哈欠 → 打盹 → 倒下 → 睡觉；移动鼠标触发惊醒弹起动画
- **点击反应** — 脸部双击触发张望或 annoyed，快速四击随机触发水果小队、惊跳或变身
- **任意状态拖拽** — 随时抓起 Mojocarrot（Pointer Capture 防止快甩丢失），松手恢复当前动画
- **极简模式** — 拖到右边缘或右键"极简模式"；Mojocarrot 藏在屏幕边缘，悬停探头，通知/完成有迷你动画，抛物线跳跃过渡

### 权限审批气泡
- **桌面端权限审批** — Claude Code 请求工具权限时，Mojocarrot 弹出浮动卡片，无需切回终端
- **允许 / 拒绝 / 建议** — 一键批准、拒绝，或应用权限规则（如"始终允许 Read"）
- **堆叠布局** — 多个权限请求从屏幕右下角向上堆叠
- **自动关闭** — 如果你先在终端回答了，气泡自动消失

### 会话智能
- **多会话追踪** — Codex、Claude Code、Cursor、Copilot 与 Gemini 的多个会话独立追踪，并解析到最高优先级状态
- **常驻活跃状态条** — 始终显示 `Idle`、`DND` 或当前主导 Agent；存在其他活跃会话时追加 `+N`，点击后打开活跃会话面板
- **活跃会话面板** — 集中查看各 Agent 会话；本轮完成记录保留 5 分钟，同一工具和项目的重复完成记录自动合并
- **Codex 周额度** — 在活跃会话面板重点显示周额度剩余百分比，并标注本地日期、周几、时间和重置说明
- **重要状态卡** — 等待输入、报错、完成，以及 Codex 周额度剩余 20%/10% 时按优先级只展示一张提醒卡
- **子代理感知** — 1 个子代理杂耍，2 个以上指挥
- **终端聚焦** — 右键 Mojocarrot → 会话菜单，一键跳转到对应会话的终端窗口；通知/注意状态自动聚焦相关终端
- **进程存活检测** — 检测已崩溃/退出的 Claude Code 进程，10 秒内清理孤儿会话
- **启动恢复** — 如果 Mojocarrot on Desk 在 Claude Code 运行期间重启，会保持清醒等待 hook，而不是直接睡觉

### 系统
- **点击穿透** — 透明区域的点击直接穿透到下方窗口，只有角色本体可交互
- **位置记忆** — 重启后 Mojocarrot 回到上次的位置（包括极简模式）
- **单实例锁** — 防止重复启动
- **自动启动** — Claude Code 的 SessionStart hook 可在 Mojocarrot on Desk 未运行时自动拉起
- **免打扰模式** — 右键或托盘菜单进入休眠，静默桌宠动画、权限气泡和额度提醒；权限请求不会被自动允许或拒绝，仍在对应 Agent 终端处理
- **系统托盘** — 调大小（S/M/L）、免打扰、语言切换、开机自启、检查更新
- **国际化** — 支持英文和中文界面，右键菜单或托盘切换
- **自动更新** — 检查 GitHub release；Windows 退出时安装 NSIS 更新包，macOS 打开 release 页面，Linux 需手动下载
- **本地服务鉴权** — 状态和权限请求使用仅当前用户可读的本地令牌，异常、过量和超时请求会被安全拒绝

## 状态映射

> 下面这张表以当前 Mojocarrot 分支的实际行为为准，预览 GIF 也已经基于当前 Mojocarrot 资产重新生成，并统一改为透明背景，便于嵌入文档或页面。

| Claude Code 事件 | Mojocarrot 状态 | 动画 | |
|---|---|---|---|
| 无活动 | 待机 | 眼球跟踪 | <img src="assets/gif/clawd-idle-follow.gif" width="200"> |
| 无活动（随机） | 待机 | 看书 | <img src="assets/gif/clawd-idle-reading.gif" width="200"> |
| 无活动（随机） | 待机 | 侦探巡逻 | <img src="assets/gif/clawd-working-debugger.gif" width="200"> |
| UserPromptSubmit | 思考 | 思考泡泡 | <img src="assets/gif/clawd-working-thinking.gif" width="200"> |
| PreToolUse / PostToolUse | 工作（打字） | 打字 | <img src="assets/gif/clawd-working-typing.gif" width="200"> |
| PreToolUse（3+ 会话） | 工作（建造） | 建造 | <img src="assets/gif/clawd-working-building.gif" width="200"> |
| SubagentStart（1 个） | 杂耍 | 杂耍 | <img src="assets/gif/clawd-working-juggling.gif" width="200"> |
| SubagentStart（2+） | 指挥 | `ultrathink` 风格的高频调度态 | <img src="assets/gif/clawd-working-conducting.gif" width="200"> |
| PostToolUseFailure / StopFailure | 报错 | ERROR + 冒烟 | <img src="assets/gif/clawd-error.gif" width="200"> |
| Stop / PostCompact | 注意 | 开心蹦跳 | <img src="assets/gif/clawd-happy.gif" width="200"> |
| PermissionRequest / Notification | 通知 | 惊叹跳跃 | <img src="assets/gif/clawd-notification.gif" width="200"> |
| PreCompact | 扫地 | 扫帚清扫 | <img src="assets/gif/clawd-working-sweeping.gif" width="200"> |
| WorktreeCreate | 搬运 | 前景水果小队跑过 | <img src="assets/gif/clawd-working-carrying.gif" width="200"> |
| 60 秒无事件 | 睡觉 | 睡眠序列 | <img src="assets/gif/clawd-sleeping.gif" width="200"> |

### 极简模式

将 Mojocarrot 拖到屏幕右边缘（或右键 →"极简模式"）进入。Mojocarrot 藏在屏幕边缘只露出半身，鼠标悬停时探出来。

| 触发 | 极简反应 | |
|---|---|---|
| 默认 | 呼吸 + 眨眼 + 眼球追踪 | <img src="assets/gif/clawd-mini-idle.gif" width="120"> |
| 鼠标悬停 | 从屏幕边缘探出来 | <img src="assets/gif/clawd-mini-peek.gif" width="120"> |
| 通知 / 权限请求 | 感叹号弹出 + >< 挤眼 | <img src="assets/gif/clawd-mini-alert.gif" width="120"> |
| 任务完成 | 烟花棒庆祝 | <img src="assets/gif/clawd-mini-happy.gif" width="120"> |
| Peek 时点击 | 退出极简模式（抛物线跳回） | |

### 点击反应

当前 Mojocarrot 的点击反应逻辑如下：

| 触发方式 | 反应 | 预览 |
|---|---|---|
| 点击脸的左半边 | `react-left` 左侧张望 | <img src="assets/gif/clawd-react-left.gif" width="140"> |
| 点击脸的右半边 | `react-right` 右侧张望 | <img src="assets/gif/clawd-react-right.gif" width="140"> |
| 连续点击 | `react-annoyed` panic 风格 annoyed 反应 | <img src="assets/gif/clawd-react-annoyed.gif" width="140"> |
| 快速四击 | `react-double` 水果小队跑过 | <img src="assets/gif/clawd-react-double.gif" width="140"> |
| 快速四击 | `react-double-jump` 惊跳 | <img src="assets/gif/clawd-react-double-jump.gif" width="140"> |
| 快速四击 | `react-wizard` 青苹果变身 | <img src="assets/gif/clawd-react-wizard.gif" width="140"> |
| 拖拽桌宠 | `react-drag` 整体摇晃 | <img src="assets/gif/clawd-react-drag.gif" width="140"> |

## 快速开始

```bash
# 克隆仓库
git clone https://github.com/Puki-li/mojocarrot-on-desk-improved.git
cd mojocarrot-on-desk-improved

# 安装依赖
npm install

# 启动 Mojocarrot on Desk
npm start
```

现在这个仓库已经可以按一个独立的 Mojocarrot 项目直接安装和运行，不需要先安装上游 `clawd-on-desk` 再覆盖资源。

### Agent 配置

**Claude Code** — 启动时自动注册核心 command hook 与 HTTP 权限 hook；仅在明确检测到兼容版本时注册版本相关 hook。

**Codex CLI** — 开箱即用。Mojocarrot 在启动时异步恢复一次 `~/.codex/sessions/` 本地日志，之后约每 1.5 秒增量检查新记录。活跃状态和周额度均来自本地日志，不需要 OpenAI 凭证。

**Gemini CLI** — 启动时自动注册，也可执行 `npm run install:gemini-hooks` 手动安装。

**Cursor Agent** — 启动时自动注册，也可执行 `npm run install:cursor-hooks` 手动安装。

**Copilot CLI** — 需要手动创建 `~/.copilot/hooks/hooks.json`，当前权限支持情况见下方“已知限制”。

### 远程 SSH 模式（Claude Code & Codex CLI）

<img src="assets/screenshot-remote-ssh.png" width="560" alt="远程 SSH — 来自树莓派的权限气泡">

Mojocarrot on Desk 支持通过 SSH 反向端口转发感知远程服务器上的 AI Agent 状态。Hook 事件和权限请求通过 SSH 隧道传回本地桌面端，无需修改桌宠本体代码。

**一键部署：**

```bash
bash scripts/remote-deploy.sh user@远程主机
```

脚本会将 hook 文件复制到远程服务器，以远程模式注册 Claude Code hooks，并打印 SSH 配置指引。

**SSH 配置**（添加到本地 `~/.ssh/config`）：

```
Host my-server
    HostName 远程主机
    User user
    RemoteForward 127.0.0.1:23333 127.0.0.1:23333
    ServerAliveInterval 30
    ServerAliveCountMax 3
```

**工作原理：**
- **Claude Code** — 远程 hook 将状态 POST 到 `localhost:23333`，SSH 隧道转发回本地 Mojocarrot on Desk。权限气泡也能正常弹出——HTTP 往返通过隧道完成。
- **Codex CLI** — 独立的日志监控脚本（`codex-remote-monitor.js`）在远程轮询 JSONL 文件，通过同一隧道 POST 状态变化。在远程启动：`node ~/.claude/hooks/codex-remote-monitor.js --port 23333`

远程 hook 以 `CLAWD_REMOTE` 模式运行，跳过 PID 采集（远程 PID 在本地无意义）。远程会话不支持终端聚焦。

状态与权限 POST 均需要鉴权。远程使用时，请在可信远程终端中，将本机 `~/.clawd/auth-token` 的值配置为 `CLAWD_AUTH_TOKEN`，再注册 hooks 或启动 Codex monitor。部署脚本不会打印或自动复制该令牌。

> 感谢 [@Magic-Bytes](https://github.com/Magic-Bytes) 提出 SSH 隧道方案（[#9](https://github.com/rullerzhou-afk/clawd-on-desk/issues/9)）。

### macOS 说明

- **源码运行**（`npm start`）：Intel 和 Apple Silicon 均可直接使用。
- **DMG 安装包**：未签名 Apple 开发者证书，macOS Gatekeeper 会拦截。解决方法：
  - 右键点击应用 → **打开** → 在弹窗中点击 **打开**，或
  - 在终端运行 `xattr -cr /Applications/Mojocarrot\ on\ Desk.app`

### Linux 说明

- **源码运行**（`npm start`）：自动传入 `--no-sandbox` 参数，跳过 chrome-sandbox SUID 校验。
- **安装包**：AppImage 和 `.deb` 可从 [GitHub Releases](https://github.com/Puki-li/mojocarrot-on-desk-improved/releases) 下载。deb 安装后应用图标会出现在 GNOME 应用菜单。
- **终端聚焦**：依赖 `wmctrl` 或 `xdotool`（有一个就行）。安装：`sudo apt install wmctrl` 或 `sudo apt install xdotool`。
- **自动更新**：Linux 暂不支持自动更新，请从 GitHub Releases 手动下载新版本。

## 已知限制

| 限制 | 说明 |
|------|------|
| **Codex CLI：无法跳转终端** | Codex 通过 JSONL 日志轮询，日志中不含终端 PID，点击桌宠无法跳转到 Codex 终端。Claude Code 和 Copilot CLI 正常。 |
| **Codex CLI：Windows hooks 禁用** | Codex 在 Windows 上硬编码禁用了 hooks，因此走日志轮询，延迟约 1.5 秒（hook 方式几乎无延迟）。 |
| **Copilot CLI：需手动配置 hooks** | Copilot 需要手动创建 `~/.copilot/hooks/hooks.json`。Claude Code 和 Codex 开箱即用。 |
| **Copilot CLI：无权限气泡** | Copilot 的 `preToolUse` 只支持拒绝，无法做完整的允许/拒绝审批流。权限气泡仅支持 Claude Code。 |
| **macOS/Linux 自动更新** | macOS 无 Apple 代码签名，Linux 不支持自动更新，均需从 GitHub Releases 手动下载。 |
| **Electron 窗口行为仍需手动测试** | 单元测试已覆盖 agent、日志轮询和状态机关键行为；透明窗口、托盘、跨平台聚焦等系统集成仍需手动验证。 |

## 致谢

本项目基于公开仓库 [rullerzhou-afk/clawd-on-desk](https://github.com/rullerzhou-afk/clawd-on-desk) 改造而来。原项目的概念、主体实现和社区积累，完整 credit 归属于原作者及其贡献者。

Mojocarrot 角色及相关品牌形象归属于 [STAYREAL](https://tw.istayreal.com/)。本仓库是面向 WMLS 社群的非官方、非商业化 fan project，与 STAYREAL 不存在隶属、背书或官方合作关系。

## 许可证

本仓库中的代码继续沿用上游 `clawd-on-desk` 的 MIT 许可证。

与 Mojocarrot 相关的角色权利、商标与品牌资产仍归 STAYREAL 所有，不因 MIT 许可证而转移；本项目仅作为非商业化 fan project 分享。
