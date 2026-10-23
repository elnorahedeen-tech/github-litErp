---
version: alpha
name: "AutoPrintBot · LiteERP integration"
description: "延续 APB 红色操作、深色顶栏与暖灰工作台的 ERP 接入规范"
colors:
  primary: "#d41920"
  primaryHover: "#b1151b"
  ink: "#1c1917"
  text: "#292524"
  muted: "#78716c"
  background: "#fafaf9"
  surface: "#ffffff"
  line: "#e7e5e4"
  success: "#166534"
  successBackground: "#e9f5ee"
  warning: "#92400e"
  warningBackground: "#fef3e2"
  danger: "#991b1b"
  dangerBackground: "#fee9e9"
  controlBorder: "#8c817a"
  info: "#0369a1"
  infoBackground: "#e6f4fa"
typography:
  sans:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", Helvetica, Arial, sans-serif'
  mono:
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
rounded:
  DEFAULT: "7px"
  sm: "7px"
  md: "8px"
  lg: "12px"
spacing:
  section-gap: "24px"
  page-max: "1480px"
components:
  button:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
  button-hover:
    backgroundColor: "{colors.primaryHover}"
    textColor: "{colors.surface}"
  input:
    textColor: "{colors.text}"
  table:
    textColor: "{colors.muted}"
  panel:
    textColor: "{colors.ink}"
    backgroundColor: "{colors.surface}"
  canvas:
    backgroundColor: "{colors.background}"
  divider:
    backgroundColor: "{colors.line}"
  dialog:
    backgroundColor: "{colors.surface}"
  status-success:
    textColor: "{colors.success}"
    backgroundColor: "{colors.successBackground}"
  status-warning:
    textColor: "{colors.warning}"
    backgroundColor: "{colors.warningBackground}"
  status-danger:
    textColor: "{colors.danger}"
    backgroundColor: "{colors.dangerBackground}"
  status-info:
    textColor: "{colors.info}"
    backgroundColor: "{colors.infoBackground}"
---

# APB 视觉基线与 LiteERP 接入

核对日期：2026-10-20。适用范围：APB 中控现有视觉基线及本次 LiteERP 样式交付包；不是全站改版，也不代表旧页面已经满足全部新交互规范。

## Overview

以印刷门店的“订单台账＋生产工单”为参考：单号、客户、金额、部件与执行结果可对照阅读，异常原因就近展开。面向中文业务人员、财务和运维人员的高频桌面工作台；中文市场证据来自本仓库订单、收款和权限手册及用户明确提出的门店集成需求。

- 产品后台风格；`zh-CN`，北京时间，中文动作词；英文用于不可翻译的标识符和 PDF 元数据。
- 品牌特征由现有 IC 标识、炭黑顶栏、APB 红色主动作和暖灰台面承担。ERP 不再增加第二套品牌顶栏。
- 数据与错误说明优先；不用大面积营销插画、玻璃背景、大圆角装饰卡片或动画数字。
- 现有运行时为主源（Model B）：admin.css（APB 仓库 `platform/app/static/admin.css`）。本文件前置值是审查快照，不是第二套主题配置。
- 扩展值只在 [extension-tokens.json](extension-tokens.json) 维护；[导出脚本](tools/build_tokens.py) 生成 JSON 和作用域 CSS。`--apb-erp-*` 优先引用宿主 `--apb-*`，无宿主时使用同次导出的回退值。
- 每次宿主样式更新运行 `python3 design_handoff_apb_liteerp/tools/build_tokens.py --check`；变更须复核本文件、导出物和截图，不手工改生成文件。

## Colors

沿用前置配色。白色容器、暖灰背景、细灰边框；红色表示主操作或当前导航，不能仅凭红色判定错误。成功、暂停、失败、处理中使用语义色与明确文字。表单边框扩展为 `#8c817a`，焦点使用 `#b1151b` 的 2px 外轮廓，增强控件识别；这项仅作用于 ERP 内容。

只提供浅色主题；不根据操作系统自动生成未经核对的深色主题。强制高对比模式交回系统颜色。ERP 图表如新增，须使用标签和线型区分系列，禁止用成功／错误色表示无语义分类。

## Typography

字体栈取运行时 CSS，不下载网络字体。正文 14px / 1.6；页面标题 22px / 1.35；分区 16px；表格 13px；说明与表头 12px。长中文名称与异常说明可换行，金额右对齐、使用等宽数字，技术编号使用等宽字体。金额固定两位小数、显示币种；未知值显示“未知”或“未提供”，不能显示成 0。

## Layout

中控宿主侧栏 204px、顶栏 56px、内容最大宽度 1480px、外边距 24px；小于等于 760px 时宿主侧栏 70px、内容边距 16px。ERP 只占内容槽，不另加侧栏位移。字段与容器间距用 4/8/12/16/24/32px；表格沿用 11px × 13px 单元格内边距。

表单最大 760px，宽屏双列、窄屏单列。文档承担纵向滚动，宽表格局部横向滚动并显示提示。禁止为表格把整个页面锁定为 100vh＋overflow:hidden。小屏主要控件最小 44px，桌面默认控件 38px；全值与操作必须可访问。

## Elevation & Depth

正常容器以边框区分，不堆叠投影。只有对话框使用轻阴影与遮罩；原生 `<dialog>.showModal()` 的顶层管理焦点和背景不可交互。宿主 z-index 50/60/70 的顶栏、侧栏、只读提示不由 ERP 改写。

## Shapes

输入／按钮 7px 圆角，面板／对话框 12px；状态标签可用胶囊形。不要把所有单元格都变成圆角卡片。宿主品牌标识保持原样，不另画近似 logo。

## Components

- 一处决策区域一个主按钮；次操作白底描边。忙碌保留按钮尺寸和文字，附加载标记与 `aria-busy`；禁用有文字原因。
- 普通链接可识别；路由导航标记 `aria-current`。数据使用语义 table、列头、标题与独立详情链接；行点击不吞掉复选框操作。
- 原生 select 的弹出层由系统负责；日期样例采用显式 `YYYY-MM-DD` 文本输入。若需要可搜索选择器或日期日历，由 LiteERP 复用其维护的无障碍组件，按本包 token 适配后另行验收。
- 表单统一 `novalidate`、可点击 label、字段关联错误、错误摘要、首个错误聚焦、保留输入。旧中控的原生校验弹泡不是新模块的参考行为。
- 成功轻提示使用同一 `role=status`；需处理的问题常驻相应字段、面板或页面。状态始终含文字，不能用颜色和圆点代替。
- 详细交互、数据状态、路由和恢复见 [UX-CONTRACT.md](UX-CONTRACT.md)。

## Motion and content

普通颜色过渡 120ms；仅真实等待有进度提示，不做页面进场动画。`prefers-reduced-motion` 关闭动画，忙碌文字保留。称“保存资料”“查看详情”“已暂停”；原因说明发生了什么及下一步，不暴露堆栈、访问令牌或把请求超时写成操作必然失败。

## Dos and Don'ts

复用宿主、内容内隔离、保留原始生产回执、可追溯每个部件。不得全局覆写 body/button/input/table，不加第二套登录／退出入口，不把 ERP 状态覆盖为 APB 状态，不将样例数据或脚本用于生产。对应生产代码未在本次修改。

---
本文件由 `tools/sync_docs.py` 从 APB 根目录 `DESIGN.md` 导出；修订请改主源后重新导出。
