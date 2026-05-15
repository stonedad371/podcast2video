# podcast.cab · 播客视频生成器

[**podcast.cab**](https://podcast.cab) 出品。把播客音频和 SRT 字幕做成可直接发布到抖音 / 小红书 / 视频号 / B 站的 9:16 短视频。自动生成封面、章节卡、金句、进度条。

## 三步开始用

### 1. 安装 Docker Desktop（只需一次）

去 https://www.docker.com/products/docker-desktop 下载安装包，装完打开 Docker，等状态栏鲸鱼图标变成"绿色 Running"。

### 2. 下载本项目

```bash
git clone git@github.com:stonedad371/podcast2video.git
cd podcast2video
```

或者直接下载 ZIP 解压。

### 3. 双击启动

- **Mac**：双击 `start.command`
- **Windows**：双击 `start.bat`（待添加）
- **命令行**：`docker compose up -d --build`

浏览器自动打开 http://localhost:3010，开干。

## 第一次使用：配置 API Key

首页会让你填一个 API key：

| Key | 干啥 | 哪里申请 |
|---|---|---|
| MiniMax API | 自动切章节 / 挑金句 / 生成 9:16 封面图 | https://platform.minimaxi.com/subscribe/token-plan?code=6Vt5rNAbqe&source=link |

不填也能用——只是要手动加章节、自己准备封面图。

Key 存在 `./data/config/`，不会进 Docker 镜像也不会上传 GitHub。

## 工作流

1. 拖入 mp3 + srt
2. 等几秒，自动算字幕漂移、切章节、挑金句、生封面
3. 浏览器里实时预览
4. 点「🎬 开始生成」，等 3-5 分钟
5. 下载 9:16 mp4，直接传抖音 / 小红书 / 视频号

## 系统要求

- macOS / Linux / Windows
- 8 GB 以上内存（Chromium 渲染要点资源）
- 5 GB 硬盘空间（Docker 镜像 + 渲染缓存）

## 关闭服务

```bash
docker compose down
```

或在 Docker Desktop 里点停止。

## 功能

- [x] Next.js Web UI + 拖拽上传
- [x] Dockerfile + docker-compose（一键启动）
- [x] 上传音频 + SRT，自动算字幕漂移
- [x] MiniMax 自动切章节 + 挑金句
- [x] MiniMax 生 9:16 封面图
- [x] @remotion/player 浏览器实时预览
- [x] Remotion 渲染 9:16 mp4（Chromium + ffmpeg）
- [x] 配置面板（API Key 本地管理，权限 600）
- [ ] Windows 双击启动脚本（`start.bat`）
- [ ] 横版 16:9 输出

## 许可

MIT
