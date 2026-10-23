# LiteERP

旧版 Windows「印特图文快印管理」的 Web 化工作目录。

| 目录 | 内容 |
|---|---|
| `src/` 及根目录 `package.json`、`vite.config.ts` 等 | Vue 3 + Vite + TypeScript 前端工程（Element Plus、Pinia），页面分前台、客户、财务、生产、报表、系统六个模块，路由见 `src/router/index.ts`。`npm install` 后 `npm run dev` 启动（端口 5173，`/api` 代理到 `vite.config.ts` 里的后端地址），`npm run build` 打包 |
| `v2/` | **当前版本**：按 APB 样式交付包重做的 ERP 内容模块原型。打开 `v2/index.html`；只看内容区用 `v2/index.html?mode=embedded` |
| `design_handoff_apb_liteerp/` | APB 样式交付包 v1.0（设计规范、token、CSS、样例） |
| `archive/v1-ribbon-20261019/` | 存档：第一版（仿旧版功能区 + 多标签，红色主题），含当时的打包文件 |
| `dist/` | v2 打包文件（zip / tar.gz） |
| `sample/` | 旧版截图 |

v2 的说明：`v2/docs/使用手册.md`（使用手册）、`v2/README.md`（部署）、`v2/DEV-GUIDE.md`（代码约定）、`v2/docs/技术方案建议.md`（技术选型）。
