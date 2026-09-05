# class-roll-call

> A classroom roll-call system. Supports multiple-group student selection, sound effect toggle, weighted random, pure random and sequential polling modes for classroom attendance and roll-call scenarios.

课堂点名系统（图图课堂点名系统）：Vite + React + TypeScript + Tailwind CSS，数据保存在浏览器 localStorage，无需后端。

## 本地开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build     # 类型检查 + 生产构建，产物输出到 dist/
npm run preview   # 本地预览构建产物
```

## 部署到 Cloudflare Pages

### 必须设置的构建配置

在 Cloudflare Pages 控制台进入项目，打开 **Settings → Build & deployments → Build configurations**，点 **Edit configurations**，按下表填写：

| 配置项 | 值 |
| --- | --- |
| Framework preset | `React (Vite)`（**不要选 VitePress**） |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | 留空（项目就在仓库根目录） |
| Node version | `20`（仓库已带 `.nvmrc`） |

Cloudflare 官方把 Vite + React 归在 `React (Vite)` 预设下；如果下拉列表当前滚动位置看不到它，请在预设列表中向上滚动或直接搜索 `React`。如果你的控制台确实没有 `React (Vite)`，再选择自定义/无预设，并手动把 **Build command** 改成 `npm run build`、把 **Build output directory** 改成 `dist`。无论哪种方式，都不能让它继续写入 `npx vitepress build`。

> **注意**：本项目是 Vite + React，不是 VitePress。选择 VitePress 会执行 `npx vitepress build`，
> 它的产物目录是 `.vitepress/dist`，不会生成本项目需要的 `dist`，于是会报：
> `Error: Output directory "dist" not found.`
>
> 构建命令无法写进 Wrangler 配置文件，只能在 Cloudflare 控制台设置。如果构建命令留空，
> Cloudflare 会跳过构建并按默认的 `public` 目录校验，同样会失败。

仓库中的 `wrangler.toml` 已声明 `pages_build_output_dir = "dist"`，负责指定最终上传目录；
控制台里的 Build command 仍必须填写 `npm run build`。

成功的日志应该包含：

```text
Executing user command: npm run build
✓ built in ...s
Validating asset output directory
```

并且不应再出现 `vitepress`。

### 修改后重新部署

配置保存后，进入 **Deployments** 标签页，对最新部署点 **Retry deployment**，
或直接向 `main` 分支推送代码触发自动构建。

## 技术要点

- 三种点名算法：加权随机 / 纯随机 / 顺序轮询
- 音效通过 Web Audio API 实时合成，不引入任何音频文件
- 统计图表使用 `React.lazy` 按需加载，首屏更轻
- 点名记录支持导出 CSV（带 BOM，Excel 打开中文不乱码）与 JSON 备份
