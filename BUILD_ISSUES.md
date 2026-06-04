# Chatless 打包问题总结

## 环境

### 开发机（Windows）
- 路径: `C:\Users\78399\Chatless`
- 编译: `pnpm tauri build --no-bundle`
- 调试: `pnpm tauri dev`

### 服务器（UOS 20 / Deepin）
- IP: `172.16.0.217`, user: `unnet`
- 代码: `/home/unnet/projects/Chatless`
- OS: UOS Desktop 20 Professional (eagle), kernel 4.19.0-amd64-desktop
- 桌面: Deepin, X11, DISPLAY=:0
- **必须用 Docker 编译和运行**（宿主机缺少 webkit2gtk-4.1 + libsoup3）

## 宿主机环境限制

```
GTK2: 2.24.32, GTK3: 3.24.5, 无 GTK4
WebKit: 仅 webkit2gtk-4.0 (2.38.6)，无 4.1
libsoup: 仅 2.4，无 3.0
```
Tauri v2 需要 webkit2gtk-4.1 + libsoup3，宿主机不满足 → **必须 Docker**

## Docker 编译

```bash
sudo docker run --rm --network=host --security-opt seccomp=unconfined \
  -v /home/unnet/projects/Chatless:/app \
  -v /home/unnet/cargo:/root/.cargo \
  -v /home/unnet/rustup:/root/.rustup \
  -v /home/unnet/pnpm-store:/root/.local/share/pnpm/store \
  -w /app tauri2-builder-cn bash -c \
  "source /root/.cargo/env && pnpm install && pnpm tauri build --no-bundle"
```

### 编译挂载说明
| 挂载 | 作用 |
|------|------|
| `/home/unnet/projects/Chatless:/app` | 源码 |
| `/home/unnet/cargo:/root/.cargo` | Cargo 缓存（必须持久，否则每次重新下载依赖） |
| `/home/unnet/rustup:/root/.rustup` | Rust 工具链 |
| `/home/unnet/pnpm-store` | pnpm 包缓存 |

### 关键参数
- `--network=host` — 容器内路由才生效（否则 172.20.20.100 访问不了）
- `--security-opt seccomp=unconfined` — Node.js worker thread 需要
- `--no-bundle` — 测试用，不下载 AppImage 依赖

## Docker 运行

```bash
sudo chmod +x /home/unnet/projects/Chatless/src-tauri/target/release/chatless && \
sudo docker run --rm --network=host --security-opt seccomp=unconfined \
  -v /tmp/.X11-unix:/tmp/.X11-unix -e DISPLAY=:0 \
  -v /home/unnet/projects/Chatless/src-tauri/target/release/chatless:/chatless \
  -v /home/unnet:/home/unnet \
  -v /home/unnet/chatless-data:/root/.local/share/com.kamjin.chatless \
  tauri2-builder-cn bash -c \
  "apt-get update -q && apt-get install -y -q fonts-noto-cjk && /chatless"
```

### 运行挂载说明
| 挂载 | 作用 |
|------|------|
| `/tmp/.X11-unix` + `DISPLAY=:0` | X11 显示 |
| `/home/unnet/.../chatless:/chatless` | 编译好的二进制 |
| `/home/unnet:/home/unnet` | 整个 home 目录（模型文件、数据等） |
| `/home/unnet/chatless-data:/root/.local/share/com.kamjin.chatless` | **appData 持久化**（容器内 root 用户的数据目录） |

### 运行注意
- 容器内无中文字体 → 每次运行 `apt-get install fonts-noto-cjk`
- 容器内无 GTK → 原生文件对话框不可用（CodeBlock 已改用 `@tauri-apps/plugin-dialog`）
- Docker 以 root 运行，`appDataDir()` 返回 `/root/.local/share/com.kamjin.chatless/`

## 网络拓扑

```
Chatless (172.16.0.217) → enp2s0 → 172.16.0.1 → 172.20.20.100:18789 (OpenClaw)
                              docker0: 172.20.0.1/16 (会拦截 172.20.20.100)
```
- 精确路由: `ip route add 172.20.20.100/32 via 172.16.0.1 dev enp2s0`
- hosts: `172.20.20.100 openclaw.un-net.com`

## 数据持久化问题

### appData 目录
- 容器内: `/root/.local/share/com.kamjin.chatless/`
- 容器重启即消失 → 必须挂载 `-v /home/unnet/chatless-data:/root/.local/share/com.kamjin.chatless`

### 需要持久化的文件
- `model-downloads.json` — 模型下载注册表，没有它应用不认已下载的模型
- 嵌入模型: `/home/unnet/models/all-minilm-l6-v2/` (通过 `-v /home/unnet:/home/unnet` 挂载)
- 知识库数据库等

### model-downloads.json 内容
```json
{
  "onnx-downloaded-models": [
    "all-minilm-l6-v2"
  ]
}
```

## pretauri 脚本问题

`pnpm tauri dev/build` 会先执行 pretauri 脚本：
1. `generate:settings-index` — 生成 settingsIndex.ts
2. `update:app-info` — 从 `tauri.conf.json` 读取 productName 覆盖 `app-info.ts`
3. `icons:index` — 生成图标索引

已修改 `scripts/update-app-info.js` 不再覆盖 name 字段（关于页显示"智能助手"）。

## 编译产物

编译后二进制在: `src-tauri/target/release/chatless`

## 后续打包要做的事

1. 解决 `--no-bundle` 去掉后的 AppImage 依赖下载问题
2. 考虑是否做 deb/rpm 打包
3. 服务端自启动脚本（Docker 命令太长了）
