# UOS 20 国产机打包分析

## 系统环境

| 项目 | 值 |
|---|---|
| OS | UOS Desktop 20 Professional (Build 11418.104.100) |
| 内核 | Linux 4.19.0-amd64-desktop |
| 架构 | x86_64 |
| CPU | Hygon C86 3350 8核16线程 (海光) |
| glibc | 2.28 (Debian GLIBC 2.28.34-deepin1) |

## 现有系统库

| 库 | 版本 | Tauri v2 要求 | 状态 |
|---|---|---|---|
| libwebkit2gtk | 4.0 (2.38.6.0-deepin1) | 4.1 | 缺失 |
| libsoup | 2.4 (2.64.2.2-deepin1) | 3.0 | 缺失 |
| glibc | 2.28 | Bookworm 库需 2.36+ | 差一代 |

UOS 20 仓库不提供 `libwebkit2gtk-4.1-0` 和 `libsoup-3.0-0`，无法通过 `apt` 安装。

## Tauri v2 依赖链分析

webkit2gtk-4.1 在以下层级硬编码，无 feature flag 可切换：

```
tauri 2.8.2 → wry 0.53.1 → webkit2gtk 2.0.1 → soup3 0.5.0
                              ↑ 只支持 4.1        ↑ 只支持 libsoup3
```

## 降级可行性分析

### 降级到 webkit2gtk-4.0：不可行

Tauri v2 的 webkit2gtk-4.1 依赖贯穿 `webkit2gtk-rs`、`wry`、`tauri-runtime-wry` 三个 crate，无法通过配置切换。要改需 fork 并维护三个上游 crate。

### 降级到 Tauri v1：不可行

项目使用 11 个 Tauri v2 专属插件：

- `tauri-plugin-sql` v2
- `tauri-plugin-store` v2
- `tauri-plugin-http` v2
- `tauri-plugin-dialog` v2
- `tauri-plugin-fs` v2
- `tauri-plugin-updater` v2
- `tauri-plugin-opener` v2
- `tauri-plugin-upload` v2
- `tauri-plugin-log` v2
- `tauri-plugin-process` v2
- `tauri-plugin-os` v2

Tauri v1 的插件体系完全不同，降级等于重写整个应用。

## 可行方案

### 方案一：源码编译 webkit2gtk-4.1（一劳永逸）

在 UOS 上从源码编译 webkit2gtk-4.1，链接到当前 glibc 2.28。编译一次后所有 Tauri v2 应用可原生运行。

**前置条件：** 约 16GB 内存（或加 swap），2-4 小时编译时间。

```bash
# 安装编译依赖
sudo apt install -y build-essential cmake git python3 ruby \
  libgtk-3-dev libglib2.0-dev libpango1.0-dev libcairo2-dev \
  libharfbuzz-dev libfreetype6-dev libsecret-1-dev libnotify-dev \
  libxslt1-dev libsqlite3-dev libonig-dev libjpeg-dev libpng-dev \
  libwebp-dev libwpebackend-fdo-1.0-dev libwpe-1.0-dev \
  gperf ninja-build

# 下载源码
git clone --depth 1 --branch 2.44.3 https://github.com/WebKit/WebKit.git
cd WebKit

# 编译
mkdir build && cd build
cmake -DPORT=GTK -DCMAKE_BUILD_TYPE=Release \
  -DUSE_SOUP2=OFF -DUSE_LIBSECRET=OFF -DENABLE_MINIBROWSER=OFF \
  -DENABLE_DOCUMENTATION=OFF -DCMAKE_INSTALL_PREFIX=/usr/local \
  -GNinja ..
ninja -j$(nproc)
sudo ninja install
sudo ldconfig
```

**优点：** 编译一次，永久使用，构建和运行都不再需要 Docker。
**代价：** 首次编译耗时较长，需要足够内存。

### 方案二：Docker 编译 + 提取 .so 本地运行

Docker 仅用于编译，提取运行时 `.so` 文件后在 UOS 上用 `LD_LIBRARY_PATH` 直接运行。

**关键风险：** Docker 基于 Debian Bookworm (glibc 2.36)，提取的 `.so` 可能依赖高版本 glibc 符号。

**验证方法（在 Docker 编译完成后执行）：**

```bash
# 检查二进制依赖的 glibc 最低版本
docker run --rm tauri-builder:local bash -c \
  "objdump -T /app/src-tauri/target/release/chatless | grep GLIBC | sed 's/.*GLIBC_//' | sort -V | tail -5"
```

- 输出 `2.28` 或更低 → 可行
- 输出 `2.33+` → 不可行，glibc 不兼容

**提取 .so 文件：**

```bash
# 从 Docker 容器提取所有依赖
docker run --rm -v /tmp/libs:/output tauri-builder:local bash -c "
  ldd /app/src-tauri/target/release/chatless | grep '=>' | awk '{print \$3}' | while read lib; do
    cp -v \"\$lib\" /output/
    ldd \"\$lib\" 2>/dev/null | grep '=>' | awk '{print \$3}' | while read dep; do
      cp -vn \"\$dep\" /output/ 2>/dev/null
    done
  done
"

# 组织目录
mkdir -p /home/unnet/chatless-bundle/lib
cp /tmp/libs/*.so* /home/unnet/chatless-bundle/lib/
cp src-tauri/target/release/chatless /home/unnet/chatless-bundle/
cp src-tauri/libonnxruntime.so /home/unnet/chatless-bundle/lib/

# 创建启动脚本
cat > /home/unnet/chatless-bundle/chatless.sh << 'EOF'
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
export LD_LIBRARY_PATH="$SCRIPT_DIR/lib:$LD_LIBRARY_PATH"
exec "$SCRIPT_DIR/chatless" "$@"
EOF
chmod +x /home/unnet/chatless-bundle/chatless.sh

# 测试
/home/unnet/chatless-bundle/chatless.sh
```

### 方案三：Docker 自建镜像编译 + 无感启动

自建 Docker 编译镜像（不依赖预构建的 `tauri2-builder-cn`），运行阶段通过桌面快捷方式透明启动 Docker。

**Dockerfile：**

```dockerfile
FROM debian:bookworm

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential cmake git pkg-config curl ca-certificates \
    libwebkit2gtk-4.1-dev libjavascriptcoregtk-4.1-dev \
    libsoup-3.0-dev libgtk-3-dev libglib2.0-dev \
    libssl-dev libsqlite3-dev libonig-dev \
    libpango1.0-dev libcairo2-dev libatk1.0-dev \
    libgdk-pixbuf-2.0-dev libxdo-dev \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g pnpm@9.15.4

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

WORKDIR /app
```

**编译：**

```bash
cd /home/unnet/projects/Chatless
sudo docker build -f Dockerfile.build -t tauri-builder:local .
sudo docker run --rm --network=host --security-opt seccomp=unconfined \
  -v /home/unnet/projects/Chatless:/app \
  -v /home/unnet/cargo:/root/.cargo/registry \
  -v /home/unnet/rustup:/root/.rustup \
  -w /app tauri-builder:local bash -c \
  "source /root/.cargo/env && pnpm install && pnpm tauri build --no-bundle"
```

**无感启动（桌面快捷方式）：**

```bash
# 创建启动脚本
sudo tee /usr/local/bin/chatless << 'EOF'
#!/bin/bash
docker start chatless-runtime 2>/dev/null || \
docker run -d --name chatless-runtime \
  --network=host \
  --security-opt seccomp=unconfined \
  -v /tmp/.X11-unix:/tmp/.X11-unix \
  -e DISPLAY=$DISPLAY \
  -v /home/unnet:/home/unnet \
  tauri-builder:local \
  /chatless
EOF
sudo chmod +x /usr/local/bin/chatless

# 创建桌面图标
cat > /home/unnet/Desktop/chatless.desktop << 'EOF'
[Desktop Entry]
Name=智能助手
Exec=/usr/local/bin/chatless
Icon=/home/unnet/projects/Chatless/public/icon.png
Type=Application
Categories=Office;
EOF
chmod +x /home/unnet/Desktop/chatless.desktop
```

## 方案对比

| | 方案一 源码编译 | 方案二 提取 .so | 方案三 Docker 无感启动 |
|---|---|---|---|
| 首次耗时 | 2-4 小时 | 取决于编译 | 构建镜像 ~15 分钟 |
| 运行时依赖 Docker | 否 | 否 | 是 |
| glibc 兼容风险 | 无（本地编译） | 有（需验证） | 无（容器隔离） |
| 后续维护 | 低 | 中（版本更新需重新提取） | 低 |
| 可靠性 | 最高 | 取决于 glibc 检查结果 | 高 |
| 用户体验 | 原生 | 原生 | 接近原生 |

## 建议优先级

1. 先跑 `objdump` 验证 glibc 版本依赖 → 若通过则方案二最优
2. 若 glibc 不兼容 → 方案一（源码编译 webkit2gtk-4.1）
3. 若编译环境不允许 → 方案三（Docker 无感启动兜底）
