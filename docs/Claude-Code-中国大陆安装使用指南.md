# Claude Code 中国大陆安装与使用指南（Mac 版）

面向 **macOS** 在中国大陆使用 Claude Code（命令行 + VS Code 扩展）的一步步方案。

---

## 一、在中国用会碰到什么

- **Anthropic 屏蔽中国 IP**：直连会 **403**，登录和 API 都会失败。
- **必须走代理**：用 Clash、V2Ray 等，并让终端和 VS Code 走代理。
- **Mac 特别注意**：从 **Dock 或 Finder 点开 VS Code** 不会带上你在终端里设的 `HTTPS_PROXY`，扩展照样 403。**必须从终端启动 VS Code**。

---

## 二、准备工作（Mac）

### 1. 安装 Node.js（18+，推荐 20 LTS）

- 官网：https://nodejs.org/  
- 国内慢可用：https://npmmirror.com/mirrors/node/  
- 安装后打开 **终端**，执行：

```bash
node -v   # 应显示 v18.x 或 v20.x
npm -v
```

### 2. 代理工具

- 用 **Clash**、V2Ray、Surge 等，保证已能科学上网。
- 记下 **HTTP 代理端口**：
  - **Clash**：打开 Clash → Settings → 看 **HTTP Port**（常见是 **7890**）
  - 其他工具在配置里找 HTTP 代理端口

### 3. 账号

- Claude 官网账号（要能打开 claude.ai，一般需浏览器也走代理），用于登录。

---

## 三、安装 Claude Code（Mac）

### 步骤 1：先让当前终端走代理

打开 **终端**，执行（**把 7890 改成你的 HTTP 代理端口**）：

```bash
export HTTPS_PROXY="http://127.0.0.1:7890"
export HTTP_PROXY="http://127.0.0.1:7890"
```

保持这个终端窗口不要关，后面安装和登录都用这个终端。

### 步骤 2：安装命令行版（CLI）

在**同一个终端**里执行：

```bash
curl -fsSL https://claude.ai/install.sh | bash
```

如果报错或超时，用 npm 安装（可先换国内镜像）：

```bash
npm config set registry https://registry.npmmirror.com
npm install -g @anthropic-ai/claude-code
```

验证：

```bash
claude --version
```

能看到版本号就说明装好了。

### 步骤 3：安装 VS Code 扩展（可选）

1. 先**从终端启动 VS Code**（见下面「四、配置代理」里的命令），这样扩展之后也会走代理。
2. 在 VS Code 里按 **`Cmd + Shift + X`** 打开扩展。
3. 搜索 **Claude Code**，安装官方扩展。
4. VS Code 需 **1.98.0** 及以上；装完若没看到，用「Developer: Reload Window」重载一下。

---

## 四、配置代理（Mac 必做）

### 1. 确认代理是否可用

在终端执行（**7890 改成你的端口**）：

```bash
curl -I --proxy http://127.0.0.1:7890 https://api.anthropic.com
```

看到 `HTTP/1.1 200 Connection established` 或后面不是 403，就说明代理正常。

### 2. 永久设置环境变量（zsh）

Mac 默认 shell 是 zsh，在终端执行（**7890 改成你的端口**）：

```bash
echo 'export HTTPS_PROXY="http://127.0.0.1:7890"' >> ~/.zshrc
echo 'export HTTP_PROXY="http://127.0.0.1:7890"' >> ~/.zshrc
source ~/.zshrc
```

以后每次新开终端都会自动带代理。

### 3. 可选：代理开关（不一直开代理时用）

在 `~/.zshrc` 里加上（**7890 改成你的端口**）：

```bash
# 终端代理开关
proxy_on() {
  export https_proxy=http://127.0.0.1:7890
  export http_proxy=http://127.0.0.1:7890
  export HTTPS_PROXY=http://127.0.0.1:7890
  export HTTP_PROXY=http://127.0.0.1:7890
  echo "✅ 代理已开启"
}

proxy_off() {
  unset https_proxy http_proxy HTTPS_PROXY HTTP_PROXY
  echo "🚫 代理已关闭"
}
```

然后执行 `source ~/.zshrc`。以后需要时在终端输入 `proxy_on`，不用时输入 `proxy_off`。

### 4. 使用 VS Code 时：必须从终端启动（重要）

- **不要**点 Dock 或 Finder 里的 VS Code 图标。
- **要**在终端里执行：

```bash
cd ~/你的项目目录    # 可选，打开想用的目录
open -a "Visual Studio Code" .
```

这样 VS Code 会继承终端的 `HTTPS_PROXY`，Claude Code 扩展才能连上 Anthropic。

可设别名，以后输入 `vscode` 就从当前目录打开：

```bash
echo 'alias vscode="open -a \"Visual Studio Code\" ."' >> ~/.zshrc
source ~/.zshrc
# 之后在项目目录下执行：
vscode
```

---

## 五、登录与使用（Mac）

### 命令行（CLI）

若之前登录失败过，先登出再登入（**确保终端已设好代理**）：

```bash
claude /logout
claude /login
```

按提示在浏览器里完成 OAuth（浏览器也要能访问境外，或走系统/Clash 代理）。登录成功后：

```bash
claude
```

即可对话；在项目目录下执行会结合当前代码。

### VS Code 扩展

1. 用 **`open -a "Visual Studio Code" .`** 从终端打开 VS Code。
2. 打开 Claude Code 侧边栏/面板，按提示登录。
3. 之后在编辑器里正常用 Claude 聊天、写代码即可。

### 常用命令（CLI）

| 命令 | 说明 |
|------|------|
| `claude` | 进入对话 |
| `claude /login` | 登录 |
| `claude /logout` | 登出 |
| `claude /init` | 生成项目规范文件 |
| 对话里用 `@file` / `@dir` | 引用文件/目录 |

---

## 六、可选：国内中转 API（免直连 Anthropic）

若你有**第三方中转服务**（提供 Anthropic 兼容 API），可配置成走中转，不直连 Anthropic：

1. 拿到该服务的 **API Key** 和 **Base URL**。
2. 创建或编辑 `~/.claude/settings.json`：

```json
{
  "env": {
    "ANTHROPIC_API_KEY": "你的中转服务API密钥",
    "ANTHROPIC_BASE_URL": "https://中转服务商提供的域名"
  }
}
```

3. 具体变量名和地址以服务商文档为准。  
注意：VS Code 扩展的 OAuth 登录多数仍走官方，扩展要正常用通常还是需要代理。

---

## 七、Mac 常见问题

| 现象 | 处理 |
|------|------|
| 403 / OAuth error / Unable to connect | 终端里设好 `HTTPS_PROXY` 并确认代理可用；VS Code **必须**用 `open -a "Visual Studio Code" .` 从终端启动。 |
| `command not found: claude` | 把 npm 全局 bin 加到 PATH，或执行 `npx claude`。 |
| 终端里 `claude` 能用，扩展仍 403 | 不要从 Dock 点 VS Code，一定从终端执行 `open -a "Visual Studio Code" .` 再开扩展。 |
| 用 Remote SSH 连 Linux | 在**远程机器**上也设 `HTTPS_PROXY`（指向你 Mac 上代理的局域网 IP:端口），Clash 需勾选 **Allow LAN**。 |

---

## 八、Mac 版步骤小结

1. 安装 Node.js 18+，记下代理的 HTTP 端口（如 7890）。
2. 在 `~/.zshrc` 里加上 `HTTPS_PROXY`、`HTTP_PROXY`，执行 `source ~/.zshrc`。
3. 在同一终端里安装：`curl -fsSL https://claude.ai/install.sh \| bash` 或 `npm install -g @anthropic-ai/claude-code`。
4. 安装 VS Code 的 Claude Code 扩展（从终端启动 VS Code 后再装/用）。
5. 执行 `claude /logout` 再 `claude /login` 完成登录。
6. 以后用 VS Code 时都在终端执行 `open -a "Visual Studio Code" .` 再使用 Claude Code 扩展。

按以上顺序在 Mac 上操作即可在中国大陆正常使用 Claude Code。
