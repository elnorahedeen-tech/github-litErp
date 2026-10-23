# LiteERP v2 — 开发约定（APB 接入样式）

v2 按 `design_handoff_apb_liteerp/`（APB 样式交付包 v1.0）实现：**ERP 是 APB 中控里的内容模块，只绘制 `[data-apb-erp]` 内容区**。纯静态、无依赖、无构建。旧版（Windows 风格功能区 + 多标签）存档在 `archive/v1-ribbon-20261019/`，字段与业务逻辑可以从那里参考。

## 目录

```
v2/
  index.html                 入口。header/nav 仅为预览用 APB 外壳；?mode=embedded 只显示内容区
  host-preview/              预览外壳样式（来自交付包，正式接入不加载）
  assets/tokens.css          交付包原样拷贝 —— 不要修改
  assets/apb-erp.css         交付包原样拷贝 —— 不要修改
  assets/liteerp.css         LiteERP 扩展组件（.lerp-*），全部限定在 [data-apb-erp] 内，只用 --apb-erp-* token
  js/core.js                 路由 + 组件（ERP.ui.*）
  js/data.js                 模拟数据（ERP.data）
  js/pages/*.js              各模块页面
  js/smoke.js / js/e2e.js    测试脚本（仅 ?smoke=1 / ?e2e=1 生效）
  tools/shot.sh|smoke.sh|e2e.sh
```

## 必须遵守（来自交付包 DESIGN.md / UX-CONTRACT.md）

- 不画顶栏、侧栏、登录；不写全局样式（body/button/input/table/*）；新样式只能加到 `assets/liteerp.css` 且以 `[data-apb-erp]` 开头、只用 token。
- 页面自然纵向滚动；宽表在 `.apb-erp-tablewrap` 内横向滚动。禁止 100vh + overflow:hidden。
- 列表：标题、筛选（工具栏，不用左侧筛选栏）、结果数、语义表格、分页（默认 20，可选 20/50/100）。筛选与页码写入地址。不加无意义统计卡片。
- 选择只限当前页；筛选/翻页清空选择并提示。行操作放“操作”列（链接或 `linkBtn`），不再使用右键菜单。
- 详情：独立路由页面（`nav:false` + `parent`），`kv` 展示资料，缺失显示“未提供/未知”，不显示成 0。
- 创建/编辑：独立表单页（`ERP.ui.form`），基本资料 → 业务资料 → 备注；尾部保存/返回。必填写“（必填）”，`novalidate`、错误摘要、首错聚焦、保留输入、忙碌防重、离开保护（传 `ctx`）。
- 对话框：只用于短操作（收款、转单、确认、选择器），`ERP.ui.dialog`（原生 dialog，Escape、焦点归还）。删除/金额类操作先 `ERP.ui.confirm`。
- 状态用 `badge(文字, tone)`：success（完成）/ warning（待处理、暂停、欠款）/ danger（失败、超期）/ info（处理中）/ 中性。颜色只辅助，文字必须可见。红色主按钮每个操作区最多一个。
- 金额：`type:'money'`（千分位两位小数、等宽右对齐），表头写“（元）”。日期 `YYYY-MM-DD`（`ui.dateInput` + `dataset.validate='date'`），时刻 `ERP.fmt.stamp()` 带“（北京时间）”。编号用 `type:'mono'`。
- 成功：`ui.toast()`（单一 role=status，5 秒）。需要处理的错误：`ui.notice('danger', 原因 + 下一步)` 常驻，不能只给 toast。
- 区分：首次为空（emptyTitle/emptyText/emptyAction）、筛选无结果（自动）、读取中（自动）、读取失败（自动，`?demo=fail` 可演示）。
- 报表：显式写单位、时间范围、数据截至时间（`ERP.fmt.stamp(new Date())`）。图表 `ui.chart` 用线型/图例区分系列。

## 页面注册与路由

```js
ERP.page('custManage', {
  module: 'cust',            // front | prod | fin | cust | rpt | sys
  title: '客户资料', desc: '一句话说明', navTitle: '客户资料（可选，二级导航显示名）',
  nav: true,                 // false：不出现在二级导航（详情/编辑页）
  parent: 'custManage',      // 详情/表单页的所属列表（面包屑、返回）
  smokeParams: { code: '1070' }, // 需要参数的页面供冒烟测试使用
  render(el, params, ctx) {  // ctx.setActions([...]) 页头按钮；ctx.setTitle(t)；ctx.guard(fn) 离开保护（form 传 ctx 自动处理）
  },
});
ERP.href('orderDetail', { no })  // → '#/orderDetail?no=…'
ERP.go(id, params); ERP.reload();
```

各模块首页（`ERP.modules[].home`）：前台 frontdesk、生产 prodCenter、财务 finCenter、客户 custManage、报表 reportCenter、系统 employees。二级导航顺序 = 注册顺序。

## 组件速查（ERP.ui）

| 组件 | 说明 |
|---|---|
| `h(tag, attrs, ...children)` | 建元素；`'div.cls#id'`；`onclick`；`style` 对象；`aria-*` |
| `list(el, {title, note, actions, params, load, sort, filters, columns, groups, rowActions, selectable, batch, emptyTitle, emptyText, emptyAction, idKey, keepParams})` | 台账列表（工具栏筛选 + 表格 + 合计行 + 分页 + 选择 + 空/失败状态）。filters：`{key, type:'search'|'select'|'daterange', label, options, keys, match(row,v), field, preset}`。columns：`{key, title, type:'money'|'num'|'date'|'time'|'mono', sum, render(row), sub(row), align, nowrap}`。返回 `{reload(), rows, all}` |
| `table(el, {columns, rows, groups, caption, rowActions, empty, compact})` | 不分页的表（明细、报表结果） |
| `form({sections:[{title, note, cols:2|3, fields:[field…], content}], submitLabel, onSubmit(values)->Promise, cancel:{href,label}, moreActions, wide, ctx, extra})` | 表单。onSubmit 用 `ERP.api.write(() => …)` 模拟保存 |
| `field({label, control, help, required, span:2|'all', error})` | 字段（label/帮助/错误关联）。控件：`input`、`money`、`dateInput`、`textarea`、`select(options, attrs)`、`checkbox(label, checked, attrs)`、`radios(name, options, value, onchange)` |
| `dialog({title, kicker, body, actions:[{label, variant, onClick(close)->Promise}], wide})` / `confirm(msg, {okLabel, danger, detail})->Promise<bool>` | 对话框 |
| `panel({title, note, actions, flush})` → `{el, body}` | 面板；表格放 `flush:true` 的面板 |
| `kv([[k, v]…])`、`summary([[k, v]…])`、`badge(text, tone)`、`notice(tone, …)`、`empty({title, text, action})`、`loading()` | 展示 |
| `btn(label, onClick, {variant:'primary'|'danger'})`、`link(label, pageId, params, {button, variant})`、`linkBtn(label, onClick)` | 动作 |
| `tabs(el, [{title, render(pane)}])` | 面板内页签 |
| `presetRange(p)`、`chart(el, {labels, series:[{name, values}], type:'line'|'bar', unit})`、`exportCsv(name, columns, rows)`、`toast(msg)`、`busy(btn, promise)` | 其他 |
| `ERP.api.read(fn)` / `ERP.api.write(fn)` | 模拟异步读写 |
| `ERP.fmt.money/num/date/time/stamp/pct`、`ERP.validDate`、`ERP.parseDate(s, end)` | 格式 |

## 共享业务函数（ERP.biz，定义于 pages/frontdesk.js）

`order(no)`、`orderColumns()`、`flowTone/settleTone`、`flowBadge/settleBadge/auditBadge`、`nextOrderNo()`、`recalcOrder(w)`、`itemPicker(onPick)`、`settle(w, done)`、`payCode(w)`、`flowTransfer(w, done)`。客户详情页 id 为 `customerDetail`（参数 `code`）。

## 测试

```bash
tools/smoke.sh                      # 依次打开全部页面，列出报错
tools/e2e.sh                        # 核心流程交互测试
tools/shot.sh 'orderDetail?no=GD26082210047' out.png 1440 1400   # 截图
tools/shot.sh frontdesk out.png 390 900                          # 窄屏
```
