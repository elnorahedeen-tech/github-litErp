# LiteERP × APB 接入契约

本文件区分“现有事实”“推荐接法”“待业务接线”。只约定 APB 仓库边界内的兼容要求，不授权修改其他项目。

## 1. 现有事实与分工

APB 中控使用 FastAPI＋Jinja2，外壳由 `platform/app/templates/base.html`、`admin_nav.html` 提供，主题由 `platform/app/static/admin.css` 提供。代理商路径可由 `partner_nav.html` 替代导航；不要复制导航判定到 ERP。

盒子本地后台在 `webadmin_ui.py`，虽然也有 204px 侧栏和 56px 顶栏，但其 `.body/.main` 采用不同滚动结构，主题变量为 `--red/--ink/--bg` 等。中控和盒端不是同一模板或会话，不能把中控 HTML 原封不动塞进盒端。

| 能力 | APB 宿主 | LiteERP 模块 |
|---|---|---|
| 顶栏、主导航、账号入口 | 负责 | 不重复绘制 |
| 当前登录、租户／代理商上下文 | 服务验证并提供约定范围 | 按已授权范围请求，不自行猜测 |
| ERP 子页面、字段、录入与台账 | 提供接入槽 | 负责，应用本样式与交互约定 |
| Flow、设备目录、打印回执 | APB 是事实源 | 查询／显示；动作经 APB 明确接口 |
| ERP 库存、客户、业务状态 | 不由样式定义 | LiteERP 后端定义；需双方核对关联 |
| 财务与账本 | 保留现有归属与审批 | ERP 不能替代现有 T2 商业账本或伪造入账 |

## 2. 首选：同一文档内的内容模块

建议命名空间 `/admin/liteerp/`、静态资源 `/static/liteerp/`；**这些只是建议，当前没有注册这些路由**。

加载顺序：

```html
<!-- 宿主已加载 /static/admin.css，不重复加载 -->
<link rel="stylesheet" href="/static/liteerp/tokens.css">
<link rel="stylesheet" href="/static/liteerp/apb-erp.css">
<main data-apb-erp>
  <!-- ERP 的内容，不含第二套 APB 侧栏和顶栏 -->
  <section class="apb-erp-panel">…</section>
  <div data-apb-erp-overlays></div>
</main>
```

- class 统一 `apb-erp-*`，数据属性 `data-apb-erp-*`，新增 ID 加模块／实例前缀。交付演示中的简短 ID 只存在于独立样例，正式组件应支持多实例。
- 所有选择器限定在 `[data-apb-erp]`，不写全局 `*`／`body`／`button`／`input`／`table`，不覆盖 `.panel/.button/.card` 等宿主通用类。
- 控件必须加 `.apb-erp-btn/.apb-erp-input` 等类，避免被宿主通用规则意外影响。示例只保证所列组件，不保证任意第三方 DOM 自动兼容。
- 弹层的 portal 容器放在 ERP 根内。原生 dialog 进入 top layer 后仍在 DOM 根内，token 正常继承；不要把 overlay 随意挂到 body。
- 框架全局 reset、Tailwind preflight、Ant/Element 全局覆盖应关闭或作用域化。不能仅给业务 CSS 加前缀，却保留组件库的全局 reset。
- 宿主 `admin.js` 对 document 的表单 submit 有全局监听。ERP 异步表单在自己的 submit handler 同步 `preventDefault()`，自行处理请求与 busy；不要伪造 `data-confirm` 绕回旧原生 confirm。SSR 正常表单则按宿主实际 CSRF／提交合同接线。
- 会话／CSRF／授权按已经确认的服务协议，不能从前端隐藏字段或 URL 推定。不要自行规定“所有 API 都接收某个 token”，本包不发凭证。
- 允许保留新的 ERP bundle；不把演示 `preview.js` 加入生产、不加载 `preview/host-reference.css` 或 `preview.css`。

## 3. iframe 与盒端变体

### iframe

当 LiteERP 必须由独立应用托管时采用。父页面负责 APB 外壳，子页面只提供内容，与 `?mode=embedded` 样例相同。iframe 内只加载本包 `assets/` 与 LiteERP 业务资源，不加载 APB 中控全局 CSS。

原始变量不能穿透 iframe，使用随包 tokens 回退值；如需要动态主题，双方另行约定受限主题 schema，不接收任意 CSS。固定只读配色时无需消息同步。

生产需由服务负责人决定同源反代或独立 origin、CSP `frame-ancestors`、父页 `frame-src`、Cookie SameSite／SSO／登出传播和 CSRF。**本包不建议为方便直接开放 `*`、关闭鉴权或把 token 放 URL/localStorage。** 同源且同权限页面也不应把同时允许脚本和同源的 sandbox 当安全边界；跨源能力要逐项定义。

如使用 `postMessage`，固定目标 origin，检查 `event.origin`＋`event.source`＋消息 schema；仅传必要的主题／导航／尺寸消息，不传管理会话。导航仅接受明确路由白名单。iframe 高度设边界、节流，避免 resize 循环；要么父文档纵向滚动，要么固定内容框由子文档滚动，不能两者都无限自增。

### 盒子本地后台

只交付内容组件，不复制中控外壳，不用中控登录态。盒端已有内容 scroller 时 ERP 自然长高并由该 scroller 管理；禁止新的全屏固定祖先。颜色使用本包回退值，已与主要 APB 品牌色一致；盒端如覆盖 `--apb-erp-*`，须在根声明并做 token 对照，不更名盒端全局 `--red`。

盒端可能断网，读取失败／陈旧结果必须显式；ERP 断线不能阻止 APB 原有非 ERP 订单的处理。具体部署包、资源缓存与认证由盒端接口方案确定。本轮仅对内容样例作样式检查，未接盒端现场。

## 4. 关联和状态必须保持真实

| 字段／结果 | 要求 |
|---|---|
| ERP order ID | ERP 身份，不覆盖 APB job ID |
| APB job / part / execution ID | 使用接口原值；每个部件、每次执行独立，不仅订单层状态 |
| Box asset ID | `Bot_…` 资产标识，不用可变 ERP POD 或显示名替代 |
| 设备与纸张 | 按 APB 目录、权限和运行时结果，不在 ERP 临时补默认设备 |
| ERP 保存成功 | 只证明业务保存成功，不证明 APB 受理、Flow 通过或打印成功 |
| 生产完成 | 显示 APB 已确认的状态和时间，不按前端等待时长猜测 |
| 无日志／无回执 | 未记录／未知，不能渲染成全绿 |
| 预览 | 使用 APB 授权文件／预览接口，显示稿件阶段与身份，失败保留原因 |
| rerun | 显式动作；APB 决定可用条件、最新 Flow 版本及已提交部件保护 |

本包 Flow 树只是视觉例子，真实树应消费 APB 的实际证据；未执行、未命中、后续未评估与失败不能合并成一个灰点。生产出口仍约束订单意图；ERP 不重新实现另一套 Flow 判定。

## 5. 接线前由双方确认的接口清单

样式开发可立即进行；以下决定实际集成，不由样式方案擅自填空：

1. 实际入口：中控同文档／iframe／盒端；静态路径、路由和刷新深链行为。
2. 登录与权限：主体、租户／代理商、可见订单范围、只读状态、能力字段、401/403、CSRF、会话过期。
3. 数据合同：ID 关联、ERP／APB 状态字典、时间时区、金额单位、分页或 cursor、排序、搜索敏感字段策略。
4. 写入合同：可用动作、幂等键、乐观版本／冲突、操作状态查询、超时未知结果；特别是打印、库存、财务。
5. 日志／文件：有权限的预览与下载地址、脱敏字段、原稿／处理稿标识、保留与过期行为。
6. 发布与回退：独立资源版本、宿主适配版本、故障时撤掉 ERP 入口仍保持原 APB 运行；数据迁移由业务组提供可审查方案。

不需要把全部答案反复问用户；由两个开发组依据现有服务整理可核对接口，分歧再提交明确选项。本次尚未发送跨组消息。

## 6. 接入验收清单

- [ ] 只有一套 APB 顶栏／主导航／账户入口，租户／代理商导航正确。
- [ ] 1440、1024、760、390px；短屏、200% 缩放；中文长名称；表单操作可达，页面无意外横向溢出。
- [ ] 组件样式仅影响 ERP 根，加载前后宿主按钮、表格、链接、页面外边距不变；第三方 portal 不丢主题。
- [ ] 鼠标、键盘、触屏；焦点、Escape、返回焦点、复选框半选、dialog 背景 inert。
- [ ] IME 不提前请求；清除即时；快速查询旧响应不覆盖；分页／返回／刷新保留状态。
- [ ] 首次为空、无匹配、失败、只读、无权限、会话过期、断网、冲突、未知结果逐项验收。
- [ ] 表单错误保留输入；保存防重复；成功依据服务器确认；脏数据离开有保护。
- [ ] 状态／金额／数量／五框 metadata／部件执行均按真实服务事实，不从样例复制推断。
- [ ] 实际授权、CSRF、租户隔离、幂等与回退测试另附报告；前端截图不替代这些验收。

本轮已做部分样式／样例验证，实际覆盖以 verification 为准；此列表是正式接线的验收目标，未勾选不等于样式包尚未交付。
