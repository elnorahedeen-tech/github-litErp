# LiteERP 静态原型 — 开发约定

纯静态 HTML/CSS/JS，**无任何依赖、无构建步骤**。直接双击 `index.html` 或用任意静态服务器（nginx）托管即可。

## 目录

```
web/
  index.html            外壳，按顺序加载下列脚本
  css/erp.css           全局样式（颜色全部在 :root 变量中，品牌红 #e8424a）
  js/core.js            框架：页面注册、多文档标签、组件（ERP.ui.*）
  js/data.js            共享模拟数据（ERP.data.*）
  js/shell.js           功能区（Ribbon）配置 + 快速查询栏 + 状态栏
  js/pages/*.js         各模块页面，每个文件只通过 ERP.page(...) 注册页面
```

## 页面注册

```js
ERP.page('custManage', {
  title: '客户资料管理（基础）',
  kind: 'tab',                 // 'tab' = 在多文档标签中打开；'dialog' = 弹窗（render 内自行调用 ERP.ui.dialog）
  render(el, params, ctx) {}   // el 为标签页容器（dialog 时为 null）
});
ERP.open('custManage', { keyword: '北京' });
```

功能区按钮 id 与页面 id 一一对应（见 `js/shell.js` 中 `ERP.ribbon`）。下拉菜单项也对应各自的页面 id。

## 组件速查（ERP.ui）

| 组件 | 用法 |
|---|---|
| `h(tag, attrs, ...children)` | 创建元素，tag 支持 `'div.cls#id'`，attrs 支持 `onclick`/`style` 对象/`class` |
| `split(el, {sideWidth})` | 左侧筛选栏 + 右侧主体，返回 `{side, main}` |
| `sidebar(side, panels)` | 可折叠面板。`{title, list:[{label,value,count,color,icon}], value, onSelect}` 或 `{title, body: Node, closed}` |
| `grid(container, opts)` | 数据表格：分组表头 `groups:[{title, columns}]`，列 `{key,title,width,type:'money'/'money4'/'int'/'check'/'date'/'datetime'/'short',sum,footer(rows)(合计行自定义值，如均价),render,editable,hideZero}`；`rowColor(row)` 返回 `'red'/'green'/'blue'/'pink'/'orange'/'gray'`；`rowClass`；`onDblClick`；`contextMenu(row)=>items`；`multi` 复选列；返回 `{setRows, refresh, rows, selected, checked, setChecked(rows), checkAll(on), exportCsv}` |
| `stdMenu(()=>grid, extraItems, name)` | 标准右键菜单（导出/刷新） |
| `dialog({title, banner, width, height, body, buttons, leftButtons, flush, maximized})` | 模态窗口。`body` 可为 Node 或 `(bodyEl, close)=>{}`。按钮 `{label, primary, action(close)}`，无 action 时点击即关闭；有 action 时需自行 `close()` |
| `reportWindow({title, banner, side(sideEl), render(mainEl), onStat})` | 报表窗口（左条件 + 右表格，底部 导出/统计/关闭） |
| `itabs(container, [{title, render(pane)}])` | 内部页签（懒渲染） |
| `dateRange({preset, onChange})` | 「单据登记时间 今天/昨天/前天/本月/上月/30天以来/今年以来/自定义」面板，`.el` 放入侧栏，`.value` 取 `{from,to}` |
| `ymd(date)` | 报表用 年/月/日 三个下拉，`.el` / `.value` |
| `field(label, control, {lw})` | 标签 + 控件一行；`input(attrs)`、`select(options, attrs)`、`check(label, checked)`、`btn(label, onclick, 'sm primary')` |
| `chart(container, {labels, series:[{name, values}], type:'line'/'bar'})` | 简单 SVG 图表 |
| `contextMenu(x, y, items)` / `toast(msg)` / `confirm(msg, onOk)` | 杂项 |
| `ERP.setPeriod('202108')` | 更新状态栏会计期间（期末结账） |

已打开的标签页再次以带参数方式 `ERP.open(id, params)` 打开时，会用新参数重新渲染。

CSS 工具类：`.row .col .grow .fill .muted .formgrid.c2/.c3/.c4 .fieldset(+legend) .cards/.card .kv .tag(.red/.green/.orange/.gray) .note .c-red/.c-green/...`

## 共享业务函数（ERP.biz，定义于 pages/frontdesk.js）

- `ERP.biz.openOrder(no)` 打开工作单窗口
- `ERP.biz.orderColumns()` / `orderRowColor` / `orderMenu(getGrid, row)` 工单列表列定义、按流程着色、右键菜单
- `ERP.biz.itemPicker(onPick)` 经营项目选择器
- `ERP.biz.settle(order, done)` 收款结算；`ERP.biz.flowTransfer(order, done)` 流程转单；`ERP.biz.payCode(order)` 收款码
- `ERP.biz.notifyOrdersChanged()` 工单数据变化后通知各列表刷新

## 数据（ERP.data）

`customers, groups, employees, roles, depts, flows, itemCategories, items, payMethods, accounts, incomeTypes, expenseTypes, deliveryTypes, orderTypes, tasks, workOrders(含 lines), settlements, cards, prestores, miscIncomes, cashJournal`，辅助：`customer(code)`、`groupName(code)`、`flowColor(name)`、`itemCatName(code)`、`util.{rnd,pick,r2}`。
模块需要额外的模拟数据时，在自己的页面文件内生成（不要改 data.js），例如 `const contacts = ...`。

## 风格约定

- 保留旧版的布局与字段（左侧筛选、分组表头、底部合计行、右键菜单、报表顶部说明横幅），但视觉用新的红色主题。
- 文案全部中文，字段名称与旧版一致。
- 页面中的操作（新建/保存/审核/删除）在内存数据上真实生效，并 `toast` 提示；无法在前端模拟的功能（读卡、打印、推送）用 `toast('…（原型）')`。
- 截图预览：`tools/shot.sh '<页面id>[?参数=值]' out.png [宽 高]`
