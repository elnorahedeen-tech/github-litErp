# APB LiteERP 接入交互约定

2026-10-20；范围是 `design_handoff_apb_liteerp/` 交付规范及样例。真实 ERP 路由、权限、状态机和数据接口尚未接线。现有 APB 页面不因本文件自动完成迁移。

## Product context / Business-context sources

中文印刷业务后台；桌面优先、窄屏可读可操作；北京时间、公历；可访问性目标 WCAG 2.2 AA。证据为本轮浏览器样例测试，不宣称全产品或跨浏览器认证。

| Domain / scope | Authoritative source | Source type | Reviewed date |
|---|---|---|---|
| 宿主壳与视觉 | platform/app/templates/base.html、admin_nav.html；platform/app/static/admin.css | 运行时代码 | 2026-10-20 |
| 同类台账 | platform/app/templates/payments_ledger.html | 已有页面 | 2026-10-20 |
| 权限与用户 | docs/平台用户与权限管理手册.md | 维护手册 | 2026-10-20 |
| LiteERP 能力边界 | docs/盒子License-全功能年费与拼版自动授权-SOP.md | 维护手册 | 2026-10-20 |
| Flow 生产与日志 | docs/APB-Flow低代码流程-产品技术与实施手册.md；docs/Flow-作业调试树与重新运行-2026-10-19.md | 维护手册 | 2026-10-20 |
| ERP 数据生命周期、库存、财务写入 | LiteERP 负责人提供接口合同，APB 负责人确认接点 | 本次不实现、不推定 | 待接线 |

LiteERP 是可选业务能力，不能使所有 APB 订单先依赖 ERP 配置。现有权限与财务审批仍由对应服务执行，前端不重新定义。

## Visual contract

见 [DESIGN.md](DESIGN.md)。运行时 admin.css 是主源；交付包 export 脚本及 source_sha256 防止漂移；扩展值集中到 extension-tokens.json。只提供 light，保留 forced-colors 和 reduced-motion。

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Table Selection | LiteERP 表格选择控制器 | 本约定；preview/preview.js 样例 | 仅当前页，跨筛选或分页清除 | 浏览器半选、分页与筛选 |
| Select/Listbox | 原生 select | assets/apb-erp.css；宿主表单约定 | native，系统管理弹层 | 键盘选择与触发器截图 |
| Date | 日期文本字段 | preview/preview.js 的格式校验示例 | typed，YYYY-MM-DD 日期值 | 无效日期与闰年校验 |
| Form | LiteERP 自有表单控制器 | 本约定；preview/preview.js 演示 | create/edit，实际后端需实现 | 首错、保留、忙碌、离开保护 |
| Scrollbar | ERP 作用域样式 | assets/apb-erp.css | 文档纵向、表格横向 | computed style、窄屏滚动 |
| Toast | 每个 ERP 根一个状态区域 | role=status，复杂错误留面板 | 信息／成功；错误不自动消失 | 浏览器 aria 与反馈 |
| CRUD | LiteERP 路由和接口控制器 | 本约定；INTEGRATION.md | 常规保存回列表；明确行内编辑留原处 | 本次仅演示校验，无真实 CRUD |

上表路径前缀为 `design_handoff_apb_liteerp/`。这些 owner 是接入职责，不把演示 JS 当成生产组件库。样式 CSS 可复用，表单／请求／路由逻辑由 LiteERP 实现。

## Component behavior

按钮具备 default/hover/focus/active/disabled/busy；焦点可见。禁用含解释，`aria-disabled` 本身不拦截点击，业务控制器必须阻止动作。忙碌占位固定，防重复提交；链接保持导航语义。字段错误紧邻且由 `aria-describedby` 关联；只读可复制，禁用用于真正不可操作的条件。

## Dataset navigation

- 生产台账采用后端分页，默认建议 20 条，可选 20/50/100；真实接口若用 cursor，则用前后页或加载更多，不伪造总页数。样例是完整 6 条内存数据、每页 4 条，仅方便观察。
- 已提交关键词、筛选、排序、页码应留在 URL；涉及敏感关键词时按隐私合同改用会话状态，不直接复制个人信息进可分享链接。
- 输入即时更新；中文 composition 期间不发搜索，结束后 300ms 防抖；清除按钮立即取消待执行任务、回第一页、恢复焦点。
- 生产请求通过 AbortController＋请求序号防止旧结果覆盖新结果；旧请求也不能清除新请求的 busy。样例纯本地，无请求竞态实现。
- 只选当前页；标题复选框三态；筛选、排序、分页、列表数据身份变化均清空选择并提示。不得悄悄变成“全部订单”。批量操作实际支持后再添加。
- 区分首次无数据、无匹配、加载、刷新中旧数据、读取失败、无权限和结果未知。分页禁用边界保持尺寸，行操作失败留在行内。
- 列表→详情→返回恢复筛选、页码和触发位置；刷新或深链到详情必须能回所属列表。真实路由由服务接线，样例使用 hash 演示。

## Flow ledger

| 操作 | 等待 | 成功 | 失败与焦点 |
|---|---|---|---|
| 常规创建／编辑 | 保留值，锁定重复提交 | 服务确认后返回所属列表，定位新／更新记录，通知成功；过滤后不可见需说明 | 字段错误或摘要，首错聚焦；服务器错保留内容 |
| 行内修改 | 原行保留，按钮忙碌 | 留原行，提示已保存 | 原行重试，不覆盖新版本 |
| 搜索／分页 | 保留表头与容器，显示读取中 | 更新当前结果，播报数量 | 保留条件、显示重试，不显示成空列表 |
| 查看详情 | 请求状态明确 | 标题和面包屑更新 | 不从旧订单复用内容；错误面板可返回 |
| 取消／返回 | 有脏数据才拦截 | 回原列表和触发位置 | 自有对话框“继续编辑／放弃修改”；浏览器关页仅 beforeunload |
| 打印／重跑／库存／财务写入 | 以服务协议为准 | 回执定义成功，长任务显示操作编号 | 超时可能已受理时先查回执；不盲目重试 |

## Navigation and responsive behavior

APB 管理顶栏、主导航、账户菜单、只读／维护横幅；ERP 提供内容子导航。真实页面标题为“页面名 — LiteERP · AutoPrintBot”。403、404、服务错误分别说明，保留允许访问的返回路径；不泄露资源详情。

760px 以下表单双列变单列，控件至少 44px；宽表保留列关系和显式横向滚动。长名称换行，标识符可复制；不依赖鼠标悬停看到全值。当前页单一纵向滚动所有者，不能继承表格的固定高度。弹框内允许独立滚动，聚焦内容不可被宿主顶栏遮住。

## Overlays and feedback

默认自有样式的原生 `<dialog>.showModal()`：有标题、明确关闭，Escape 关闭，背景 inert，焦点圈定且关闭后回触发器；放弃修改优先聚焦“继续编辑”。弹层必须留在 `[data-apb-erp]` 下；框架 portal 挂到该容器的 overlay 子节点，不能丢掉 token 和作用域。

金额、权限、删除、打印类动作的后果必须来自后端合同。本包没有这些可执行操作；不替 ERP 决定可恢复期限或撤销语义。成功通知使用单一 polite 区域，生产若采用 toast 建议 5 秒且悬停／聚焦暂停计时；关键错误常驻，不能只显示 toast。无必要 tooltip；完整说明直接显示。

## Async and resilience / Validation

- 默认等服务器确认后显示成功；后端负责幂等、版本、权限，前端锁按钮只是补充。
- 不自动离线排队写入，不将个人资料写到 localStorage。草稿恢复策略待业务定义。
- 断网或超时保留输入，显示最近确认时间；未知结果先查状态。409 显示冲突、保留本地输入、允许重读对比；不静默覆盖。401 走宿主确认的重新认证；403 停止操作并刷新能力。
- `novalidate`；提交时全表校验，出错后可在修改／失焦时复检。服务器字段错误映射原字段，无字段错误放摘要；未知错误给脱敏请求编号。首个错误聚焦，不弹浏览器原生警告框。
- 日期只验证公历日期，存 `YYYY-MM-DD`；绝对事件时刻由后端返回带时区值，显示 Asia/Shanghai。样例无真实库存、税务或金额校验。
- 保存中的值如被再次修改，前一次回执不能把新编辑标成已保存。请求离开页面后取消／丢弃；弹框失败仍保留上下文。

## Permission and data ownership

永远以服务端校验为准。无查看权限不取数据；动作已知但当前条件不足时禁用并解释。平台 admin 不能被前端推定拥有全部 ERP 财务权限；代理商／租户边界在每次查询和操作验证。

ERP 订单、APB 作业、部件、execution 与设备 asset ID 分开。金额、生产状态、设备参数的归属见 INTEGRATION.md；不修改 APB Flow 条件／出口验收，不把 ERP 保存接成打印成功。

## Migration status

本轮只提供 adapter-ready 的交付包。旧中控 admin.js 存在原生 confirm、原生表单校验等历史实现，不复制到新模块、不在本次全站改写。LiteERP 正式接线由其开发组实现；APB 中控导航注册与后端授权须独立落地和验收。

## Verification

命令、浏览器版本、截图和实际覆盖范围见交付包 [verification/README.md](verification/README.md)。对照 sibling 为 payments_ledger.html / admin.css。样例验证包括桌面／390px／短屏、IME、选择、详情、表单失败、重复保存、脏数据离开、CSS 外溢；静态扫描与人工复核分别记录。不将样例测试称为 ERP 业务集成、实纸或全产品无障碍验收。

---
本文件由 `tools/sync_docs.py` 从 APB 根目录 `UX-CONTRACT.md` 导出；修订请改主源后重新导出。
