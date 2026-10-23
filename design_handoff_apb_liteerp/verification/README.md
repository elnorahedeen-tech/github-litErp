# 样式交付验证 · 2026-10-20

状态：样式规范和离线样例可交付。测试对象只在本机 loopback 静态服务中运行，无生产／门店／LiteERP 接口访问。此报告不代表 ERP 已集成、上线或实纸通过。

## 已验证

- `python3 tools/build_tokens.py --check`：运行时 APB CSS 的导出值、源 SHA-256 和预览参考样式一致。仅在 APB checkout 内执行此命令。
- `node --check preview/preview.js`：通过。
- `python3 tools/verify_preview.py`：通过，13 组场景（见 [browser.json](browser.json)），Chromium 145.0.7632.6；Python Playwright 为本轮环境已有依赖。
- 1440×1000、1024×768、760×640、390×844、720×500；没有整页意外横向溢出，长表单保存可达。
- 本地搜索 composition／300ms、清除与无匹配恢复、select 键盘、复选框半选与翻页清空、URL 刷新、详情、PDF 五框与缺失部件状态。
- 弹框 Tab 循环、Escape／关闭按钮、返回焦点；表单首错聚焦、日期／闰年、保留备注、busy 宽高不变、新编辑不被先前保存误清除、保持编辑／放弃修改。
- 宿主按钮、输入框、表格加载 ERP CSS 前后 computed style 一致；无 JS 异常、无外部请求、无 POST／其他变更请求。
- 内容区模式、reduced-motion、forced-colors 渲染检查。所有截图人工查看；表单双列字段顶部对齐已修正。

初轮发现原生 dialog 的 Tab 可转到浏览器地址栏；样例增加首末可聚焦项循环后复测通过。初轮记录在 APB 私有检查点 `.git/apb-checkpoints/liteerp-ui-20261020/` 保留，不混作最终成功证据。

## 静态检查与人工复核

`npx --yes --package @google/design.md designmd lint DESIGN.md` 使用工具 v0.4.0：0 错误、1 warning。提示 `controlBorder` 未被前置组件表引用；实际使用路径为 extension-tokens.json → tokens.css → apb-erp.css 的输入边框，前置组件 schema 没有 border 子字段。不是缺失样式，映射见 tokens.json。

技能扫描实际命令：

```text
python3 <frontend-design-premium>/scripts/audit_project.py design_handoff_apb_liteerp --mode strict --output design_handoff_apb_liteerp/verification/static-audit.json
```

完整范围扫描留下 7 条 `affordance.actionless-button`（原始退出码 1），不能称为 strict 全绿。工具仅识别 HTML 的内联 click／submit，不能识别独立 JS 的 `addEventListener`。7 个控件实际都绑定并经过浏览器操作，逐项对应见 [static-review.json](static-review.json)。未为消除工具提示添加内联脚本、缩小检查范围或改扫描器。首次误把单文件路径传入只支持目录的 sourceRoots，结果不作为证据；已改为 assets／preview／examples 完整目录复扫。

## 截图

- [桌面订单台账](desktop.png)
- [订单详情与 Flow / metadata](detail.png)
- [表单错误与保留输入](form-error.png)
- [390px 窄屏](mobile.png)
- [状态组件和内容区模式](states.png)

## 仍需在正式集成中验收

Safari／Firefox、真实触屏和屏幕阅读器未验证；720×500 是收缩视口检查，不冒充操作系统 200% 缩放。iframe 跨域通信／SSO、盒端真实外壳、权限、CSRF、后端分页和异步旧响应、ERP CRUD、库存、财务、打印与 rerun 均未接入。独立样例的成功／异常状态说明不能代替业务测试。

生产 CSS 可采用 `assets/`；不得把 `preview/` 中的假数据、参考宿主 CSS 或 JS 当成业务实现。
