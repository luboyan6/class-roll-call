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
| Framework preset | `Vite` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | 留空（项目就在仓库根目录） |
| Node version | `20`（仓库已带 `.nvmrc`） |

> **注意**：构建命令无法写进配置文件，只能在控制台设置。如果留空，Cloudflare 会跳过构建，
> 随后报 `Error: Output directory "public" not found.`，因为 `dist` 从未生成。

仓库中的 `wrangler.toml` 已声明 `pages_build_output_dir = "dist"`，即使控制台的
输出目录仍是默认值，Cloudflare 也会优先采用配置文件里的值。

### 修改后重新部署

配置保存后，进入 **Deployments** 标签页，对最新部署点 **Retry deployment**，
或直接向 `main` 分支推送代码触发自动构建。

## 技术要点

- 三种点名算法：加权随机 / 纯随机 / 顺序轮询
- 音效通过 Web Audio API 实时合成，不引入任何音频文件
- 统计图表使用 `React.lazy` 按需加载，首屏更轻
- 点名记录支持导出 CSV（带 BOM，Excel 打开中文不乱码）与 JSON 备份
