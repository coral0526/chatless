# Chatless

Tauri v2 桌面聊天应用，Next.js 15 (Turbopack) + React/TypeScript 前端，Rust 后端。

## 双平台环境

### Windows（开发机）
- 路径: `C:\Users\78399\Chatless`
- Node: `C:\Users\78399\.node-v22\node-v22.20.0-win-x64\node.exe`
- 编译: `pnpm tauri build --no-bundle`
- 调试: `pnpm tauri dev`

### Linux 国产机（UOS 20 Professional / Deepin）
- OS: UOS Desktop 20 Professional (eagle), kernel 4.19.0-amd64-desktop
- 桌面: Deepin, X11, DISPLAY=:0
- 服务器: `172.16.0.217`, user: `unnet`
- 桌面路径: `/home/unnet/Desktop/`（存在，可写）
- 代码路径: `/home/unnet/projects/Chatless`

**GTK/WebKit 版本（宿主机）:**
- GTK2: 2.24.32, GTK3: 3.24.5, 无 GTK4
- WebKit: **仅 webkit2gtk-4.0 (2.38.6)**，无 4.1
- libsoup: **仅 2.4**，无 3.0
- libssl: 1.1.1d
- libjavascriptcoregtk: 4.0-18
- **结论**: Tauri v2 需要 webkit2gtk-4.1 + libsoup3，宿主机都不满足 → 必须 Docker

**Docker 环境（tauri2-builder-cn）:**
- Docker: 18.09.1, overlay2, cgroupfs
- 容器内无 GTK，无 WebKit（仅作编译+运行二进制用）
- 运行必须 `--security-opt seccomp=unconfined`（Node.js worker thread 需要）
- 运行必须 `--network=host`（容器内路由才生效）
- 容器内无中文字体 → 每次运行需 `apt-get install fonts-noto-cjk`
- Cargo 缓存: `/home/unnet/cargo`
- Rustup: `/home/unnet/rustup`
- pnpm store: `/home/unnet/pnpm-store`

**网络拓扑:**
```
Chatless (172.16.0.217) → enp2s0 → 172.16.0.1 → 172.20.20.100:18789 (OpenClaw)
                              docker0: 172.20.0.1/16 (会拦截 172.20.20.100)
```
- 精确路由（`/etc/rc.local`）: `ip route add 172.20.20.100/32 via 172.16.0.1 dev enp2s0`
- hosts: `172.20.20.100 openclaw.un-net.com`

**字体（宿主机有但容器无）:**
- 国标宋体 (GB_ST_GB18030)
- Noto Serif CJK SC
- Source Han Serif SC（思源宋体）
- 容器每次运行安装 `fonts-noto-cjk`

**Node.js（宿主机）:**
- v24.14.0, 通过 nvm 安装: `/home/unnet/.nvm/versions/node/v24.14.0/bin/node`

编译命令:
```bash
sudo docker run --rm --network=host --security-opt seccomp=unconfined \
  -v /home/unnet/projects/Chatless:/app \
  -v /home/unnet/cargo:/root/.cargo \
  -v /home/unnet/rustup:/root/.rustup \
  -v /home/unnet/pnpm-store:/root/.local/share/pnpm/store \
  -w /app tauri2-builder-cn bash -c \
  "source /root/.cargo/env && pnpm install && pnpm tauri build --no-bundle"
```

运行命令:
```bash
sudo chmod +x /home/unnet/projects/Chatless/src-tauri/target/release/chatless && \
sudo docker run --rm --network=host --security-opt seccomp=unconfined \
  -v /tmp/.X11-unix:/tmp/.X11-unix -e DISPLAY=:0 \
  -v /home/unnet/projects/Chatless/src-tauri/target/release/chatless:/chatless \
  -v /home/unnet:/home/unnet \
  tauri2-builder-cn bash -c \
  "apt-get update -q && apt-get install -y -q fonts-noto-cjk && /chatless"
```

## 关键架构

- **LLM 接入**: `OpenAICompatibleProvider` → Rust SSE (`src-tauri/src/lib/sse.rs`) → `https://openclaw.un-net.com:18789/v1`
  - 自签证书: `danger_accept_invalid_certs(true)`
  - SSE 客户端: `http1_only()`, `no_gzip()`, `no_brotli()`
- **Token**: `131488639681e4fbf3ed51ff6f07b6ece03fd57e946`, 模型: `openclaw`
- **认证**: Entity Provider 的 token 和全局 KeyManager 是两个独立存储，默认 token 必须写入 KeyManager
- **流式输出**: 前端 `StreamingMarkdown` 用 rAF 打字机效果（40 chars/s），后端 Rust SSE 逐 token 推送
- **自动保存**: `AIMessageBlock.tsx` 扫描 markdown 代码块和 MCP `write_file` 工具调用，自动保存到 `download_directory`

## Docker/X11 兼容性注意

- **原生对话框不可用**: `@tauri-apps/plugin-dialog` 需要 GTK 文件对话框，Docker 容器内无 GTK → 必须提供手动输入降级方案
- **documentDir()**: Docker 以 root 运行时返回 `/root/Documents`，已修正为 `/home/unnet/Desktop/Chatless`
- **默认下载路径**: 代码中检测 `/root` 前缀并重定向到桌面
- **中文字体**: Docker 镜像需额外安装 `fonts-noto-cjk`
- **文件传输**: 从 Windows 传到 Linux UOS 用 ToDesk

## 关键文件

- `src/components/chat/AIMessageBlock.tsx` — AI 消息渲染、自动保存
- `src/components/chat/StreamingMarkdown.tsx` — 打字机效果
- `src/components/chat/CodeBlock.tsx` — 代码块显示 + 下载/复制/目录按钮
- `src/components/TauriApp.tsx` — 启动初始化、默认路径
- `src/components/settings/GeneralSettings.tsx` — 下载目录设置（含手动输入降级）
- `src/lib/chat/messageFsm.ts` — 消息段状态机、工具调用处理
- `src/lib/llm/providers/OpenAICompatibleProvider.ts` — LLM 流式调用
- `src/store/chatStore.ts` — Zustand 状态管理
- `src-tauri/src/lib/sse.rs` — Rust SSE 客户端
- `src/lib/chat/segments.ts` — 工具调用内容过滤
