/* 生产：生产业务中心、制作明细记录
 * 复用前台的工作单窗口 / 流程转单（ERP.biz.openOrder / flowTransfer），列表按生产流程着色。 */
(function () {
  'use strict';
  const { h, grid, sidebar, split, contextMenu, toast } = ERP.ui;
  const D = ERP.data, F = ERP.fmt;
  const biz = (ERP.biz = ERP.biz || {});

  // 背景色模式用到的行底色（框架只提供前景色 c-*，此处补充少量样式）
  if (!document.getElementById('prod-style')) {
    document.head.appendChild(h('style#prod-style', `
      .grid tbody tr.pbg-red td { background: #fef2f2; } .grid tbody tr.pbg-blue td { background: #eff6ff; }
      .grid tbody tr.pbg-pink td { background: #fdf2f8; } .grid tbody tr.pbg-green td { background: #f0fdf4; }
      .grid tbody tr.pbg-orange td { background: #fff7ed; }`));
  }

  const DAY = 864e5;
  const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  /* 距离交付（天）：未设置交付时间为 0，已超期为负数 */
  const daysToDue = (w) => (w.due ? Math.round((dayStart(new Date(w.due)) - dayStart(new Date())) / DAY) : 0);
  const isMine = (w) => (w.handler || '').split(',').includes(D.currentUser.name);
  const isDone = (w) => w.flow === (D.flows[D.flows.length - 1] || {}).name;

  /* 表格 ▸ 子菜单（框架的右键菜单不支持级联，这里在同一位置再弹出一层） */
  const tableMenu = (getGrid, x, y) => contextMenu(x + 160, y, [
    { label: '列宽自适应', action: () => toast('列宽已自适应（原型）') },
    { label: '恢复默认布局', action: () => toast('已恢复默认表格布局') },
    { label: '冻结前三列', action: () => toast('已冻结列（原型）') },
    '-',
    { label: '显示合计行', action: () => toast('合计行（原型）') },
    { label: '保存表格布局', action: () => toast('表格布局已保存') },
  ]);

  /* ---------- 生产业务中心 ---------- */
  ERP.page('prodCenter', {
    title: '生产业务中心',
    render(el) {
      const { side, main } = split(el);
      let fFeat = 'all', fFlow = 'all', fWarn = null, fg = true, bg = true, lastXY = [0, 0];
      const cnt = (fn) => D.workOrders.filter(fn).length;

      /* 筛选条件：生产特征 × 生产流程 × 交付预警 */
      const featOk = (w) => fFeat === 'all' ? !isDone(w) : fFeat === 'mine' ? isMine(w) : !w.handler && !isDone(w);
      const warnOk = (w) => {
        if (!fWarn) return true;
        const d = daysToDue(w);
        if (fWarn === 'none') return !w.due;
        if (!w.due || isDone(w)) return false;
        return fWarn === 'over' ? new Date(w.due) < new Date() : fWarn === 'today' ? d === 0 : fWarn === 'tomorrow' ? d === 1 : d >= 2 && d <= 3;
      };
      const apply = () => g.setRows(D.workOrders.filter((w) => (fFlow === 'all' ? featOk(w) : w.flow === fFlow) && warnOk(w)));

      const featList = () => [
        { label: '全部', value: 'all', count: cnt((w) => !isDone(w)) },
        { label: '我处理的', value: 'mine', color: 'red', count: cnt(isMine) },
        { label: '无人处理', value: 'nobody', color: 'blue', count: cnt((w) => !w.handler && !isDone(w)) },
      ];
      const flowList = () => [{ label: '全部', value: 'all', count: D.workOrders.length }]
        .concat(D.flows.map((f) => ({ label: f.name, value: f.name, icon: '➜', color: f.color, count: cnt((w) => w.flow === f.name) || null })));
      const warnList = () => [
        { label: '全部', value: null },
        { label: '已超期', value: 'over', icon: '⚠', color: 'red', count: cnt((w) => w.due && !isDone(w) && new Date(w.due) < new Date()) },
        { label: '今天交付', value: 'today', icon: '◷', color: 'orange', count: cnt((w) => w.due && !isDone(w) && daysToDue(w) === 0) },
        { label: '明天交付', value: 'tomorrow', icon: '◷', color: 'blue', count: cnt((w) => w.due && !isDone(w) && daysToDue(w) === 1) },
        { label: '2~3 天内', value: 'soon', icon: '◷', count: cnt((w) => w.due && !isDone(w) && daysToDue(w) >= 2 && daysToDue(w) <= 3) },
        { label: '未设交付时间', value: 'none', icon: '□', color: 'gray', count: cnt((w) => !w.due) },
      ];
      // 选「生产特征」时清除「生产流程」筛选，反之亦然（与旧版一致：两组互斥）
      const sb = sidebar(side, [
        { key: 'feat', title: '生产特征', list: featList(), value: 'all', onSelect: (v) => { fFeat = v; fFlow = 'all'; sb.flow.setList(flowList()); apply(); } },
        { key: 'flow', title: '生产流程', list: flowList(), value: null, onSelect: (v) => { fFlow = v; apply(); } },
        { key: 'warn', title: '交付预警', closed: true, list: warnList(), value: null, onSelect: (v) => { fWarn = v; apply(); } },
      ]);
      const refreshSide = () => { sb.feat.setList(featList()); sb.flow.setList(flowList()); sb.warn.setList(warnList()); };

      const menu = (w) => [
        { label: '打开工单', shortcut: 'Ctrl+K', disabled: !w, action: () => biz.openOrder(w.no) },
        '-',
        { label: '我来处理 (W)', disabled: !w, action: () => { w.handler = D.currentUser.name; refreshAll(); toast('已接手：' + w.no); } },
        { label: '流程转单 (L)', shortcut: 'Ctrl+L', disabled: !w, action: () => biz.flowTransfer(w, refreshAll) },
        '-',
        { label: '前景颜色', checked: fg, action: () => { fg = !fg; g.refresh(); } },
        { label: '背景颜色', checked: bg, action: () => { bg = !bg; g.refresh(); } },
        '-',
        { label: '导出(E)', action: () => g.exportCsv('生产业务中心') },
        { label: '刷新(R)', shortcut: 'Ctrl+R', action: () => { g.refresh(); toast('已刷新'); } },
        { label: '刷新全部', action: () => { refreshAll(); toast('已刷新全部'); } },
        '-',
        { label: '表格 ▸', action: () => tableMenu(() => g, lastXY[0], lastXY[1]) },
      ];

      const g = grid(main, {
        groups: [
          { title: '基础', columns: [
            { key: 'no', title: '工单编号', width: 140 },
            { key: 'group', title: '客户分组', width: 110 },
            { key: 'custName', title: '客户名称', width: 240 },
          ] },
          { title: '生产', columns: [
            { key: 'flow', title: '生产流程', width: 80, align: 'center' },
            { key: 'handler', title: '当前处理', width: 90 },
            { key: 'orderType', title: '工单类型', width: 80 },
            { key: 'task', title: '制作任务', width: 150 },
            { key: 'req', title: '制作要求', width: 220 },
            { key: 'delivery', title: '取送要求', width: 90 },
            { key: 'created', title: '委托时间', type: 'short', width: 100 },
            { key: 'due', title: '交付时间', type: 'short', width: 100 },
            { key: 'dist', title: '距离交付', width: 80, align: 'right', render: (w) => String(daysToDue(w)),
              class: (w) => (w.due && daysToDue(w) < 0 && !isDone(w) ? 'c-red' : '') },
            { key: 'receptionist', title: '接待人员', width: 90 },
            { key: 'keepFile', title: '保留文件', type: 'check', editable: true, onChange: (w) => toast(`${w.no}：${w.keepFile ? '保留' : '不保留'}客户文件`) },
          ] },
        ],
        rows: [], footer: false,
        rowColor: (w) => (fg ? biz.orderRowColor(w) : null),
        rowClass: (w) => (bg ? 'pbg-' + biz.orderRowColor(w) : ''),
        onDblClick: (w) => biz.openOrder(w.no),
        contextMenu: menu,
      });
      g.el.addEventListener('contextmenu', (e) => { lastXY = [e.clientX, e.clientY]; }, true);
      function refreshAll() { refreshSide(); apply(); }
      apply();

      // 快捷键：仅在本标签页激活时生效
      const onKey = (e) => {
        if (!el.isConnected) return document.removeEventListener('keydown', onKey);
        if (!el.classList.contains('active') || !e.ctrlKey || document.querySelector('.overlay')) return;
        const k = e.key.toLowerCase(), w = g.selected;
        if (k === 'k') { e.preventDefault(); w ? biz.openOrder(w.no) : toast('请先选择工单'); }
        if (k === 'l') { e.preventDefault(); w ? biz.flowTransfer(w, refreshAll) : toast('请先选择工单'); }
        if (k === 'r') { e.preventDefault(); refreshAll(); toast('已刷新'); }
      };
      document.addEventListener('keydown', onKey);
      el.addEventListener('erp:orders-changed', refreshAll);
    },
  });

  /* ---------- 制作明细记录（工单明细行级） ---------- */
  ERP.page('prodDetail', {
    title: '制作明细记录',
    render(el) {
      const { side, main } = split(el);
      let fFlow = 'all', fCat = 'all', kw = '', g = null;
      // 展开为明细行：每行带上所属工单的生产信息
      const allLines = () => D.workOrders.flatMap((w) => w.lines.map((l, i) => ({
        line: l, order: w, no: w.no, seq: i + 1, created: w.created, custName: w.custName, group: w.group,
        flow: w.flow, handler: w.handler, task: w.task, req: w.req, receptionist: w.receptionist,
        code: l.code, catName: l.catName, cat: l.cat, name: l.name, unit: l.unit, price: l.price, copies: l.copies || 1, qty: l.qty,
        total: (l.copies || 1) * l.qty, amount: l.amount, remark: l.remark,
      })));
      const dr = ERP.ui.dateRange({ preset: 'year', label: '委托时间', onChange: () => g && apply() });
      const search = ERP.ui.input({ placeholder: '工单编号 / 客户 / 项目名称', oninput: (e) => { kw = e.target.value.trim(); apply(); } });
      const cnt = (fn) => allLines().filter(fn).length;
      sidebar(side, [
        { title: '委托时间', body: dr.el },
        { title: '快速查找', body: search },
        { key: 'flow', title: '生产流程', list: [{ label: '全部', value: 'all', count: cnt(() => true) }]
          .concat(D.flows.map((f) => ({ label: f.name, value: f.name, icon: '➜', color: f.color, count: cnt((r) => r.flow === f.name) || null }))),
          value: 'all', onSelect: (v) => { fFlow = v; apply(); } },
        { key: 'cat', title: '经营主项', closed: true, list: [{ label: '全部', value: 'all' }]
          .concat(D.itemCategories.map((c) => ({ label: `${c.code}-${c.name}`, value: c.code, count: cnt((r) => r.cat === c.code) || null }))),
          value: 'all', onSelect: (v) => { fCat = v; apply(); } },
      ]);
      g = grid(main, {
        groups: [
          { title: '工单', columns: [
            { key: 'no', title: '工单编号', width: 140 },
            { key: 'seq', title: '行号', type: 'int', width: 50 },
            { key: 'created', title: '委托时间', type: 'short', width: 100 },
            { key: 'custName', title: '客户名称', width: 200 },
          ] },
          { title: '经营项目', columns: [
            { key: 'code', title: '编号', width: 80 },
            { key: 'catName', title: '主项', width: 110 },
            { key: 'name', title: '子项', width: 220 },
            { key: 'unit', title: '单位', width: 50 },
          ] },
          { title: '数量', columns: [
            { key: 'price', title: '实价', type: 'money4' },
            { key: 'copies', title: '份数', type: 'int', width: 60, sum: true },
            { key: 'qty', title: '每份数量', type: 'int', width: 80, sum: true },
            { key: 'total', title: '制作总数', type: 'int', width: 80, sum: true },
            { key: 'amount', title: '金额', type: 'money', sum: true },
          ] },
          { title: '生产', columns: [
            { key: 'flow', title: '生产流程', width: 80, align: 'center' },
            { key: 'handler', title: '当前处理', width: 90 },
            { key: 'task', title: '制作任务', width: 140 },
            { key: 'req', title: '制作要求', width: 180 },
            { key: 'receptionist', title: '接待人员', width: 80 },
            { key: 'remark', title: '说明', width: 140 },
          ] },
        ],
        rows: [], rowColor: (r) => D.flowColor(r.flow),
        onDblClick: (r) => biz.openOrder(r.no),
        contextMenu: (r) => [
          { label: '打开工单', shortcut: 'Ctrl+K', disabled: !r, action: () => biz.openOrder(r.no) },
          { label: '流程转单 (L)', shortcut: 'Ctrl+L', disabled: !r, action: () => biz.flowTransfer(r.order, apply) },
          '-',
          { label: '导出(E)', action: () => g.exportCsv('制作明细记录') },
          { label: '刷新(R)', shortcut: 'Ctrl+R', action: () => { apply(); toast('已刷新'); } },
        ],
      });
      function apply() {
        const { from, to } = dr.value;
        g.setRows(allLines().filter((r) => r.created >= from && r.created <= to && (fFlow === 'all' || r.flow === fFlow)
          && (fCat === 'all' || r.cat === fCat) && (!kw || r.no.includes(kw) || r.custName.includes(kw) || r.name.includes(kw))));
      }
      apply();
      el.addEventListener('erp:orders-changed', apply);
    },
  });
})();
