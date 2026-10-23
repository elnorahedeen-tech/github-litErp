/* 报表：报表中心、业务提醒、各类汇总 / 排行报表
 * 报表窗口统一用 ERP.ui.reportWindow：左侧「基本条件 / 汇总依据 / 客户分组」，右侧「数据表格 / 数据图表」，
 * 点「统计[S]」按条件从 ERP.data（workOrders / settlements / customers / cards / cashJournal / miscIncomes）重新汇总。
 * 说明：模拟数据没有单独的「审核时间」，工作单一律以登记时间代替。 */
(function () {
  'use strict';
  const { h, grid, sidebar, split, dialog, field, input, select, check, btn, toast, itabs, ymd } = ERP.ui;
  const D = ERP.data, F = ERP.fmt, r2 = D.util.r2;

  /* ---------- 报表目录（报表中心与各报表窗口共用标题 / 横幅说明） ---------- */
  const CATALOG = [
    { cat: '基础', items: [
      { id: 'rptIncomeExpense', title: '营业收支汇总表', icon: '收', banner: '汇总指定时间内审核的各项财务相关的收入、支出类单据的金额信息。【收支核算规则可自行配置】' },
      { id: 'rptOrderSettle', title: '工单结算汇总表', win: '工单结算信息汇总表', icon: '结', banner: '汇总计算工作单的标售、实售、实收及抹零等金额信息，并汇总相应的结算信息。【考察工作单的审核时间在指定期间范围内的数据。(生产成本=基础成本+用料成本+设备成本)】' },
      { id: 'rptItems', title: '经营项目汇总表', win: '工单经营项目汇总表', icon: '项', banner: '汇总统计在指定时间范围内审核的“工作单”的制作明细所选定的经营项目信息。【考察工作单的审核时间在指定期间范围内的数据。】' },
    ] },
    { cat: '客户类', items: [
      { id: 'rptCustValue', title: '客户价值分析表', win: '客户价值分析', icon: '值', banner: '以工作的“审核时间”为基础，汇总选定客户12个月以来的消费数据，以供进行价格分析。' },
      { id: 'rptCustNew', title: '客户新增汇总表', icon: '新', banner: '汇总在指定时间范围内新增的客户数量并统计各类业务特征名下的新增客户数量。【以客户资料的建交时间为准，建交时间默认等于创建时间。】' },
      { id: 'rptCardSummary', title: '会员办卡汇总表', win: '客户办卡汇总表', icon: '卡', banner: '汇总计算客户办理会员卡片的相关数据信息。【考察会员卡片发行时间在指定期间范围内的数据。】' },
      { id: 'rptCustRevenueRank', title: '客户工单实收排行表', icon: '收', banner: '对指定时间内审核的工作单，按照下单客户汇总工单实收金额，并以实收金额排序。' },
      { id: 'rptCustAvgRank', title: '客户工单均价排行表', icon: '均', banner: '对指定时间内审核的工作单，按照下单客户汇总工单数量及实收总额计算出每单均价，并以此均价对比排行。' },
      { id: 'rptCustCountRank', title: '客户工单数量排行表', icon: '数', banner: '对指定时间内审核的工作单，按照下单客户汇总工单数量，并以工单数量对比排行。' },
    ] },
  ];
  const INFO = Object.fromEntries(CATALOG.flatMap((c) => c.items).map((x) => [x.id, x]));

  /* ---------- 公共计算 ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  const DAY = 864e5;
  // 模拟数据工单集中在 2026-08 ~ 10，默认统计区间取这三个月
  const DEF_FROM = new Date(2026, 7, 1), DEF_TO = new Date(2026, 9, 31);
  const sum = (arr, fn) => r2(arr.reduce((s, x) => s + (Number(fn(x)) || 0), 0));
  const div = (a, b) => (b ? a / b : 0);
  const inRange = (d, from, to) => d && +d >= +from && +d < +to + DAY;
  const empCount = () => D.employees.filter((e) => !e.left).length || 1; // 人均 = 金额 / 在职员工数
  const listAmount = (w) => sum(w.lines, (l) => l.listPrice * l.qty * (l.copies || 1)); // 标售金额
  const district = (c) => (/市(.+?区)/.exec(c.address || '') || [])[1] || '(未设置)';    // 城市商圈：取地址中的区
  const pct = (v, d = 2) => (Number(v) * 100).toFixed(d) + '%';
  const chartColors = ['#e8424a', '#78716c', '#c2410c', '#1d4ed8'];

  /* 期间键：日报 20261012 / 月报 202610 / 年 2026 / 自定 20261001-20261031 */
  function periodKey(d, st) {
    const y = d.getFullYear(), m = pad(d.getMonth() + 1), dd = pad(d.getDate());
    if (st.mode === 'month') return `${y}${m}`;
    if (st.mode === 'year') return `${y}`;
    if (st.mode === 'custom') { const k = (x) => F.date(x).replace(/-/g, ''); return `${k(st.from)}-${k(st.to)}`; }
    return `${y}${m}${dd}`;
  }
  /* 按 key 汇总：init(item) 创建行，add(row, item) 累加 */
  function rollup(items, keyFn, init, add) {
    const m = new Map();
    for (const it of items) {
      const k = keyFn(it);
      if (!m.has(k)) m.set(k, init(it));
      add(m.get(k), it);
    }
    return [...m.values()];
  }
  const byKeys = (...keys) => (a, b) => { for (const k of keys) { const x = String(a[k] ?? ''), y = String(b[k] ?? ''); if (x !== y) return x < y ? -1 : 1; } return 0; };

  /* 工单的「汇总依据」取值 */
  const orderBasis = (w, basis) => ({
    委托客户: w.custName, 客户分组: w.group, 工单类型: w.orderType || '(未设置)', 经手人员: w.handler || w.receptionist,
  }[basis] || '');
  /* 期间内的工单（可选：仅已审核） */
  const ordersIn = (st) => D.workOrders.filter((w) => inRange(w.created, st.from, st.to) && (!st.auditedOnly || w.audited));

  /* ---------- 左侧条件面板构件 ---------- */
  /* 日报/月报/年/自定 + 开始/结束 */
  function periodBody(st) {
    const name = 'pm' + Math.random().toString(36).slice(2);
    const a = ymd(st.from), b = ymd(st.to);
    st.read = () => { st.from = a.value; st.to = b.value; };
    const radios = h('div.row', { style: { gap: '8px', border: '1px solid var(--line)', borderRadius: '4px', padding: '4px 8px', background: '#fff', marginBottom: '6px' } },
      [['day', '日报'], ['month', '月报'], ['year', '年'], ['custom', '自定']].map(([v, t]) =>
        h('label.chk', h('input', { type: 'radio', name, checked: st.mode === v, onchange: () => (st.mode = v) }), t)));
    return [radios, field('开始', a.el, { lw: 30 }), field('结束', b.el, { lw: 30 })];
  }
  /* 排行表：开始/结束、行数、含散户数据、建交开始/结束 */
  function rankBody(st) {
    const a = ymd(st.from), b = ymd(st.to);
    const rows = input({ value: 100, style: { width: '70px', textAlign: 'right' } });
    const retail = check('含散户数据', true);
    const j1 = input({ type: 'date' }), j2 = input({ type: 'date' });
    st.read = () => {
      Object.assign(st, { from: a.value, to: b.value, limit: Math.max(1, +rows.value || 100), retail: retail.querySelector('input').checked,
        joinFrom: j1.value ? new Date(j1.value + 'T00:00') : null, joinTo: j2.value ? new Date(j2.value + 'T00:00') : null });
    };
    return [field('开始', a.el, { lw: 30 }), field('结束', b.el, { lw: 30 }), field('行数', rows, { lw: 30 }), h('div', { style: { margin: '2px 0 6px' } }, retail),
      field('建交开始', j1), field('建交结束', j2)];
  }
  /* 客户分组：复选（默认全选） */
  function groupBody(st) {
    st.groups = new Set(D.groups.map((g) => g.code));
    const boxes = D.groups.map((g) => check(`${g.code}-${g.name}`, true, { onchange: (e) => (e.target.checked ? st.groups.add(g.code) : st.groups.delete(g.code)) }));
    const all = check('全选', true, { onchange: (e) => boxes.forEach((b, i) => { b.querySelector('input').checked = e.target.checked; e.target.checked ? st.groups.add(D.groups[i].code) : st.groups.delete(D.groups[i].code); }) });
    return h('div.col', { style: { gap: '3px' } }, all, h('div', { style: { borderTop: '1px solid var(--line)' } }), boxes);
  }
  const basisPanel = (st, list) => ({ title: '汇总依据', list: list.map((v) => ({ label: v, value: v })), value: st.basis, onSelect: (v) => (st.basis = v) });
  /* 更多条件（工单类报表） */
  const moreBody = (st) => h('div.col',
    check('仅统计已审核的工作单', !!st.auditedOnly, { onchange: (e) => (st.auditedOnly = e.target.checked) }),
    field('工单类型', select(D.orderTypes.map((x) => [x, x || '(全部)']), { onchange: (e) => (st.orderType = e.target.value) })),
    h('div.muted', { style: { fontSize: '12px' } }, '审核时间以工单登记时间代替（原型）'));

  /* ---------- 通用报表窗口 ----------
   * def: {id, side(sideEl, st), columns(st)->groups, compute(st)->rows, chart(rows, st)->{labels, series, type},
   *       noChart, extraLeft, onDblClick, st:初始状态} */
  function openReport(def) {
    const info = INFO[def.id];
    const st = Object.assign({ mode: 'day', basis: '无', from: DEF_FROM, to: DEF_TO }, def.st);
    let g, gridPane, chartPane;
    const stat = () => {
      st.read && st.read();
      const rows = def.compute(st);
      gridPane.innerHTML = '';
      g = grid(gridPane, { groups: def.columns(st), rows, contextMenu: ERP.ui.stdMenu(() => g, [], info.title), onDblClick: def.onDblClick, emptyText: '指定条件下没有数据' });
      drawChart();
      return rows;
    };
    const drawChart = () => {
      if (!chartPane || !def.chart) return;
      chartPane.innerHTML = '';
      const c = def.chart(g.rows, st);
      if (!c.labels.length) return chartPane.appendChild(h('div.muted', { style: { padding: '20px' } }, '没有可显示的数据'));
      c.series.forEach((s, i) => (s.color = s.color || chartColors[i]));
      chartPane.appendChild(h('div.row', { style: { gap: '14px', fontSize: '12px' } }, c.series.map((s) => h('span.row', { style: { gap: '4px' } },
        h('i', { style: { width: '10px', height: '10px', background: s.color, borderRadius: '2px', display: 'inline-block' } }), s.name))));
      ERP.ui.chart(chartPane, Object.assign({ height: 380 }, c));
    };
    ERP.ui.reportWindow({
      title: info.win || info.title, sideWidth: 270,
      banner: def.banner || info.banner,
      side: (s) => def.side(s, st),
      render: (m) => itabs(m, [
        { title: '数据表格', render: (p) => (gridPane = p) },
        ...(def.noChart ? [] : [{ title: '数据图表', render: (p) => { chartPane = p; drawChart(); } }]),
      ]),
      onStat: () => { const rows = stat(); toast(`统计完成，共 ${rows.length} 行`); },
      onExport: () => g.exportCsv(info.title),
      extraLeft: def.extraLeft,
    });
    stat();
  }
  /* 期间类报表的图表：按期间汇总 series 指定列 */
  const periodChart = (cols, type = 'bar') => (rows) => {
    const keys = [...new Set(rows.map((r) => r.period))];
    return { type, labels: keys, series: cols.map(([k, name]) => ({ name, values: keys.map((p) => sum(rows.filter((r) => r.period === p), (r) => r[k])) })) };
  };
  /* 汇总依据不为「无」时在 基础 分组中插入一列 */
  const basisCol = (st) => (st.basis !== '无' ? [{ key: 'basis', title: st.basis, width: 180 }] : []);

  /* ======================= 营业收支汇总表 ======================= */
  ERP.page('rptIncomeExpense', {
    title: '营业收支汇总表', kind: 'dialog',
    render() {
      // 收支核算规则：结算方式 → 收入栏目
      const RULE = { 现金: 'cash', 刷卡: 'cash', 转账: 'cash', 记账: 'credit', 预存: 'prestore', 微信: 'scan', 支付宝: 'scan', 在线付款码: 'scan' };
      openReport({
        id: 'rptIncomeExpense',
        banner: h('div.row', h('span.grow', INFO.rptIncomeExpense.banner),
          h('span', { style: { color: 'var(--pink)', fontWeight: 400 } }, '【特别鸣谢：成都景印公司提供此报表设计思路。】')),
        side: (s, st) => sidebar(s, [{ title: '基本条件', body: periodBody(st) }, basisPanel(st, ['无'])]),
        columns: () => [
          { title: '基础', columns: [{ key: 'period', title: '日期时间', width: 110 }, { key: 'income', title: '收入小计', type: 'money', sum: true }, { key: 'expense', title: '支出小计', type: 'money', sum: true }] },
          { title: '收入', columns: [
            { key: 'misc', title: '小额零收', type: 'money', sum: true, hideZero: true }, { key: 'cash', title: '现收结算', type: 'money', sum: true, hideZero: true },
            { key: 'credit', title: '记账结算', type: 'money', sum: true, hideZero: true }, { key: 'prestore', title: '扣预结算', type: 'money', sum: true, hideZero: true },
            { key: 'scan', title: '扫码结算', type: 'money', sum: true, hideZero: true }, { key: 'cloud', title: '云端结算', type: 'money', sum: true, hideZero: true },
            { key: 'genIn', title: '一般收入', type: 'money', sum: true, hideZero: true }] },
          { title: '支出', columns: [{ key: 'genOut', title: '一般支出', type: 'money', sum: true, hideZero: true }] },
          { title: '利润', columns: [{ key: 'profit', title: '利润小计', type: 'money', sum: true }, { key: 'perCap', title: '人均收入', type: 'money', sum: true },
            { key: 'rate', title: '利润率', width: 80, render: (r) => (r.income ? pct(div(r.profit, r.income), 0) : '') }] },
        ],
        compute(st) {
          // 把各类单据统一成 {date, col, amount, out}
          const docs = [
            ...D.miscIncomes.map((x) => ({ date: x.date, col: 'misc', amount: x.amount })),
            ...D.settlements.filter((x) => x.audited).map((x) => ({ date: x.date, col: RULE[x.method] || 'cash', amount: r2(x.amount - (x.wipe || 0)) })),
            ...D.cashJournal.filter((x) => x.audited).map((x) => ({ date: x.date, col: x.kind === '一般收入' ? 'genIn' : 'genOut', amount: x.amount, out: x.kind !== '一般收入' })),
          ].filter((x) => inRange(x.date, st.from, st.to));
          const n = empCount();
          return rollup(docs, (x) => periodKey(x.date, st),
            (x) => ({ period: periodKey(x.date, st), income: 0, expense: 0, misc: 0, cash: 0, credit: 0, prestore: 0, scan: 0, cloud: 0, genIn: 0, genOut: 0 }),
            (r, x) => { r[x.col] = r2(r[x.col] + x.amount); if (x.out) r.expense = r2(r.expense + x.amount); else r.income = r2(r.income + x.amount); })
            .map((r) => Object.assign(r, { profit: r2(r.income - r.expense), perCap: r2((r.income - r.expense) / n) })).sort(byKeys('period'));
        },
        chart: periodChart([['income', '收入小计'], ['expense', '支出小计'], ['profit', '利润小计']]),
        extraLeft: [{ label: '算法定义', action: () => {
          dialog({ title: '收支核算规则（算法定义）', width: 520, body: grid(h('div.col', { style: { height: '300px' } }), {
            columns: [{ key: 'src', title: '单据来源', width: 140 }, { key: 'cond', title: '条件', width: 180 }, { key: 'col', title: '计入栏目', width: 120 }],
            footer: false, rows: [
              { src: '零散收入', cond: '全部', col: '小额零收' },
              ...Object.entries(RULE).map(([m, c]) => ({ src: '结算单（已审核）', cond: '结算方式 = ' + m, col: { cash: '现收结算', credit: '记账结算', prestore: '扣预结算', scan: '扫码结算' }[c] })),
              { src: '一般收支（已审核）', cond: '一般收入', col: '一般收入' }, { src: '一般收支（已审核）', cond: '一般支出', col: '一般支出' },
            ] }).el.parentNode });
          return false;
        } }],
      });
    },
  });

  /* ======================= 工单结算汇总表 ======================= */
  ERP.page('rptOrderSettle', {
    title: '工单结算汇总表', kind: 'dialog',
    render() {
      openReport({
        id: 'rptOrderSettle',
        side: (s, st) => sidebar(s, [{ title: '基本条件', body: periodBody(st) }, basisPanel(st, ['无', '委托客户', '客户分组', '工单类型', '经手人员']),
          { title: '更多条件', closed: true, body: moreBody(st) }]),
        columns: (st) => [
          { title: '基础', columns: [{ key: 'period', title: '日期时间', width: 110 }, ...basisCol(st), { key: 'count', title: '工单数量', type: 'int', sum: true }] },
          { title: '金额', columns: [{ key: 'list', title: '标售金额', type: 'money', sum: true }, { key: 'sale', title: '实售金额', type: 'money', sum: true },
            { key: 'wipe', title: '抹零金额', type: 'money', sum: true, hideZero: true }, { key: 'net', title: '实收金额', type: 'money', sum: true }, { key: 'paid', title: '回款金额', type: 'money', sum: true }] },
          { title: '结算', columns: [{ key: 'cash', title: '现金结算', type: 'money', sum: true, hideZero: true }, { key: 'credit', title: '记账结算', type: 'money', sum: true, hideZero: true },
            { key: 'prestore', title: '扣预结算', type: 'money', sum: true, hideZero: true }] },
          { title: '发票', columns: [{ key: 'invAmt', title: '发票金额', type: 'money', sum: true, hideZero: true }, { key: 'invCnt', title: '发票数量', type: 'int', sum: true, render: (r) => r.invCnt || '' }] },
          { title: '统计', columns: [{ key: 'avg', title: '实收均价', type: 'money' }, { key: 'disc', title: '实收折扣', type: 'money' }, { key: 'perCap', title: '人均产值', type: 'money', sum: true },
            { key: 'payRate', title: '回款比例', width: 90, align: 'right', render: (r) => (r.net ? pct(div(r.paid, r.net)) : '') }] },
          // 截图中「回款比例」右侧还有滚动区域，按横幅公式补充成本列（模拟：成本按实售的固定比例估算）
          { title: '成本', columns: [{ key: 'cost', title: '生产成本', type: 'money', sum: true }, { key: 'margin', title: '毛利金额', type: 'money', sum: true }] },
        ],
        compute(st) {
          const sts = {};
          D.settlements.forEach((s) => s.orderNo && (sts[s.orderNo] = sts[s.orderNo] || []).push(s));
          const n = empCount();
          const orders = ordersIn(st).filter((w) => !st.orderType || w.orderType === st.orderType);
          return rollup(orders, (w) => periodKey(w.created, st) + '|' + orderBasis(w, st.basis),
            (w) => ({ period: periodKey(w.created, st), basis: orderBasis(w, st.basis), count: 0, list: 0, sale: 0, wipe: 0, net: 0, paid: 0, cash: 0, credit: 0, prestore: 0, invAmt: 0, invCnt: 0 }),
            (r, w) => {
              const ss = sts[w.no] || [], wipe = sum(ss, (s) => s.wipe);
              r.count++; r.list = r2(r.list + listAmount(w)); r.sale = r2(r.sale + w.amount); r.wipe = r2(r.wipe + wipe);
              r.net = r2(r.net + w.amount - wipe); r.paid = r2(r.paid + w.paid);
              ss.forEach((s) => { const k = s.method === '记账' ? 'credit' : s.method === '预存' ? 'prestore' : 'cash'; r[k] = r2(r[k] + s.amount); if (s.invoice) { r.invAmt = r2(r.invAmt + s.amount); r.invCnt++; } });
            })
            .map((r) => Object.assign(r, { avg: r2(div(r.net, r.count)), disc: r2(div(r.net, r.list) * 10), perCap: r2(r.net / n), cost: r2(r.sale * 0.42), margin: r2(r.sale * 0.58) }))
            .sort(byKeys('period', 'basis'));
        },
        chart: periodChart([['list', '标售金额'], ['net', '实收金额'], ['paid', '回款金额']]),
      });
    },
  });

  /* ======================= 经营项目汇总表 ======================= */
  ERP.page('rptItems', {
    title: '经营项目汇总表', kind: 'dialog',
    render() {
      openReport({
        id: 'rptItems', st: { itemMode: 'cat', filter: '' },
        side: (s, st) => {
          const kw = input({ oninput: (e) => (st.filter = e.target.value.trim()) });
          const nm = 'im' + Math.random().toString(36).slice(2);
          sidebar(s, [{ title: '基本条件', body: periodBody(st) }, basisPanel(st, ['无', '客户分组', '委托客户', '工单类型', '经手人员']),
            { title: '项目名称', body: h('div.col', { style: { gap: '4px', background: '#fff', border: '1px solid var(--line)', borderRadius: '4px', padding: '6px 8px' } },
              h('label.chk', h('input', { type: 'radio', name: nm, checked: true, onchange: () => (st.itemMode = 'cat') }), '主项名称'),
              h('label.chk', h('input', { type: 'radio', name: nm, onchange: () => (st.itemMode = 'sub') }), '主项名称>子项名称')) }]);
          s.appendChild(h('div', { style: { margin: '2px 2px 8px' } }, field('项目过滤', kw)));
          sidebar(s, [{ title: '更多条件', closed: true, body: moreBody(st) }]);
        },
        columns: (st) => [
          { title: '基础', columns: [{ key: 'period', title: '日期时间', width: 110 }, ...basisCol(st), { key: 'item', title: '项目名称', width: 260 },
            { key: 'qty', title: '项目数量', type: 'money', sum: true, render: (r) => F.money(r.qty, 3) }] },
          { title: '金额', columns: [{ key: 'list', title: '标售金额', type: 'money', sum: true }, { key: 'sale', title: '实售金额', type: 'money', sum: true },
            { key: 'avg', title: '实售均价', type: 'money' }, { key: 'disc', title: '实售折扣', type: 'money' }] },
        ],
        compute(st) {
          const lines = ordersIn(st).filter((w) => !st.orderType || w.orderType === st.orderType)
            .flatMap((w) => w.lines.map((l) => ({ w, l, item: st.itemMode === 'sub' ? `${l.catName}>${l.name}` : l.catName })))
            .filter((x) => !st.filter || x.item.includes(st.filter) || x.l.code.includes(st.filter));
          return rollup(lines, (x) => [periodKey(x.w.created, st), orderBasis(x.w, st.basis), x.item].join('|'),
            (x) => ({ period: periodKey(x.w.created, st), basis: orderBasis(x.w, st.basis), item: x.item, qty: 0, list: 0, sale: 0 }),
            (r, { l }) => { const q = l.qty * (l.copies || 1); r.qty += q; r.list = r2(r.list + l.listPrice * q); r.sale = r2(r.sale + l.amount); })
            .map((r) => Object.assign(r, { avg: r2(div(r.sale, r.qty)), disc: r2(div(r.sale, r.list) * 10) }))
            .sort(byKeys('period', 'basis', 'item'));
        },
        chart: (rows) => {
          // 按项目汇总实售金额（取前 12 项）
          const m = rollup(rows, (r) => r.item, (r) => ({ item: r.item, sale: 0, list: 0 }), (a, r) => { a.sale = r2(a.sale + r.sale); a.list = r2(a.list + r.list); })
            .sort((a, b) => b.sale - a.sale).slice(0, 12);
          return { type: 'bar', labels: m.map((x) => x.item.slice(0, 10)), series: [{ name: '实售金额', values: m.map((x) => x.sale) }, { name: '标售金额', values: m.map((x) => x.list) }] };
        },
        extraLeft: [{ label: '高级', action: () => { toast('高级统计选项（原型）'); return false; } }],
      });
    },
  });

  /* ======================= 客户新增汇总表 ======================= */
  const custBasis = (c, basis) => ({ 客户分组: c.groupName, 所属城市: c.city, 城市商圈: district(c) }[basis] || '');
  ERP.page('rptCustNew', {
    title: '客户新增汇总表', kind: 'dialog',
    render() {
      openReport({
        id: 'rptCustNew', st: { mode: 'year', from: new Date(2026, 0, 1), to: new Date(2026, 11, 31) }, // 模拟客户建交时间分散，默认按年统计
        side: (s, st) => sidebar(s, [{ title: '基本条件', body: periodBody(st) }, basisPanel(st, ['无', '客户分组', '所属城市', '城市商圈'])]),
        columns: () => [
          { title: '基础', columns: [{ key: 'period', title: '日期时间', width: 110 }, { key: 'basis', title: '汇总依据', width: 180 }, { key: 'count', title: '新增客户', type: 'int', sum: true }] },
          { title: '客户类型', columns: [{ key: 'person', title: '个人客户', type: 'int', sum: true }, { key: 'org', title: '机构客户', type: 'int', sum: true }] },
          { title: '业务特征', columns: [{ key: 'credit', title: '允许记账', type: 'int', sum: true }] },
          { title: '其他信息', columns: [{ key: 'contact', title: '联络人员', type: 'int', sum: true }] },
        ],
        compute: (st) => rollup(D.customers.filter((c) => c.code !== '000000' && inRange(c.created, st.from, st.to)),
          (c) => periodKey(c.created, st) + '|' + custBasis(c, st.basis),
          (c) => ({ period: periodKey(c.created, st), basis: custBasis(c, st.basis), count: 0, person: 0, org: 0, credit: 0, contact: 0 }),
          (r, c) => { r.count++; c.type === '个人' ? r.person++ : r.org++; if (c.settleType !== '现结') r.credit++; if (c.contact) r.contact++; })
          .sort(byKeys('period', 'basis')),
        chart: periodChart([['count', '新增客户'], ['person', '个人客户'], ['org', '机构客户']]),
      });
    },
  });

  /* ======================= 会员办卡汇总表 ======================= */
  ERP.page('rptCardSummary', {
    title: '会员办卡汇总表', kind: 'dialog',
    render() {
      const cardBasis = (k, basis) => { const c = D.customer(k.custCode) || {}; return { 发卡员工: k.issuer, 所属城市: c.city, 城市商圈: district(c) }[basis] || ''; };
      openReport({
        id: 'rptCardSummary', st: { mode: 'year', from: new Date(2026, 0, 1), to: new Date(2026, 11, 31) },
        side: (s, st) => sidebar(s, [{ title: '基本条件', body: periodBody(st) }, basisPanel(st, ['无', '发卡员工', '所属城市', '城市商圈'])]),
        columns: () => [
          { title: '基础', columns: [{ key: 'period', title: '日期时间', width: 110 }, { key: 'basis', title: '汇总依据', width: 180 }, { key: 'group', title: '卡片分组', width: 200 }] },
          { title: '汇总', columns: [{ key: 'count', title: '卡片数量', type: 'int', sum: true }] },
        ],
        compute: (st) => rollup(D.cards.filter((k) => inRange(k.issueDate, st.from, st.to)),
          (k) => [periodKey(k.issueDate, st), cardBasis(k, st.basis), k.group].join('|'),
          (k) => ({ period: periodKey(k.issueDate, st), basis: cardBasis(k, st.basis), group: k.group, count: 0 }),
          (r) => r.count++).sort(byKeys('period', 'basis', 'group')),
        chart: periodChart([['count', '卡片数量']]),
      });
    },
  });

  /* ======================= 客户排行（实收 / 均价 / 数量） ======================= */
  const custCols = [{ key: 'code', title: '客户编号', width: 80 }, { key: 'name', title: '客户名称', width: 260 }, { key: 'type', title: '客户类型', width: 80 }, { key: 'groupName', title: '客户分组', width: 130 }];
  /* 按客户汇总期间内工单：{cust, count, net, list} */
  function rankRows(st) {
    return rollup(ordersIn(st).filter((w) => {
      const c = D.customer(w.custCode);
      return c && (st.retail || c.code !== '000000') && st.groups.has(c.group)
        && (!st.joinFrom || c.created >= st.joinFrom) && (!st.joinTo || c.created < +st.joinTo + DAY);
    }), (w) => w.custCode, (w) => {
      const c = D.customer(w.custCode);
      return { code: c.code, name: c.name, type: c.type, groupName: c.groupName, created: c.created, value: c.value, phone: c.phone, count: 0, net: 0, list: 0 };
    }, (r, w) => { r.count++; r.net = r2(r.net + w.amount); r.list = r2(r.list + listAmount(w)); });
  }
  const rankSide = (s, st) => sidebar(s, [{ title: '基本条件', body: rankBody(st) }, { title: '客户分组', closed: true, body: groupBody(st) }]);
  const rankChart = (key, name) => (rows) => {
    const top = rows.slice(0, 15);
    return { type: 'bar', labels: top.map((r) => r.name.slice(0, 6)), series: [{ name, values: top.map((r) => r[key]) }] };
  };
  const openCust = (r) => ERP.pages.custManage ? ERP.open('custManage', { keyword: r.code }) : toast('客户资料：' + r.name);

  ERP.page('rptCustRevenueRank', {
    title: '客户工单实收排行表', kind: 'dialog',
    render: () => openReport({
      id: 'rptCustRevenueRank', side: rankSide, onDblClick: openCust,
      columns: () => [
        { title: '基础', columns: custCols },
        { title: '排行', columns: [{ key: 'net', title: '工单实收', type: 'money', sum: true }, { key: 'list', title: '工单标售', type: 'money', sum: true },
          { key: 'disc', title: '优惠折扣', width: 90, render: (r) => pct(r.disc) }] },
        { title: '其他', columns: [{ key: 'created', title: '建交时间', type: 'date' }, { key: 'value', title: '价值', width: 90 }, { key: 'phone', title: '电话', width: 120 }] },
      ],
      compute: (st) => rankRows(st).map((r) => Object.assign(r, { disc: r.list ? 1 - div(r.net, r.list) : 0 })).sort((a, b) => b.net - a.net).slice(0, st.limit),
      chart: rankChart('net', '工单实收'),
    }),
  });
  ERP.page('rptCustAvgRank', {
    title: '客户工单均价排行表', kind: 'dialog',
    render: () => openReport({
      id: 'rptCustAvgRank', side: rankSide, onDblClick: openCust, noChart: true, // 原系统此表只有「数据表格」页
      columns: () => [
        { title: '基础', columns: custCols },
        { title: '排行', columns: [{ key: 'avg', title: '实收均价', type: 'money' }, { key: 'net', title: '实收总价', type: 'money', sum: true }] },
        { title: '其他', columns: [{ key: 'value', title: '价值', width: 110 }, { key: 'phone', title: '电话', width: 120 }] },
      ],
      compute: (st) => rankRows(st).map((r) => Object.assign(r, { avg: r2(div(r.net, r.count)) })).sort((a, b) => b.avg - a.avg).slice(0, st.limit),
    }),
  });
  ERP.page('rptCustCountRank', {
    title: '客户工单数量排行表', kind: 'dialog',
    render: () => openReport({
      id: 'rptCustCountRank', side: rankSide, onDblClick: openCust,
      columns: () => [
        { title: '基础', columns: custCols },
        { title: '排行', columns: [{ key: 'count', title: '工单数量', type: 'int', sum: true }, { key: 'net', title: '工单实收', type: 'money', sum: true }] },
        { title: '其他', columns: [{ key: 'value', title: '价值', width: 110 }, { key: 'phone', title: '电话', width: 120 }] },
      ],
      compute: (st) => rankRows(st).sort((a, b) => b.count - a.count || b.net - a.net).slice(0, st.limit),
      chart: rankChart('count', '工单数量'),
    }),
  });

  /* ======================= 客户价值分析表 ======================= */
  ERP.page('rptCustValue', {
    title: '客户价值分析表', kind: 'dialog',
    render(_, params = {}) {
      const info = INFO.rptCustValue;
      // 默认分析工单最多的非散户客户
      const top = rollup(D.workOrders.filter((w) => w.custCode !== '000000'), (w) => w.custCode, (w) => ({ code: w.custCode, n: 0 }), (r) => r.n++).sort((a, b) => b.n - a.n)[0];
      let cust = D.customer(params.cust) || D.customer(top && top.code);
      const now = new Date(D.company.server.replace(' ', 'T'));
      const since = new Date(now.getFullYear(), now.getMonth() - 11, 1); // 12 个月以来
      const custInp = input({ readOnly: true, style: { cursor: 'pointer' } });
      const tabs = [];
      // 工时为模拟值：委托工时按明细行数估算，实际工时按生产进度折算，生产耗时 = 实际工时 × 1.3
      const hours = (w) => { const plan = w.lines.length * 1.5, act = plan * (w.flow === '完工' ? 0.9 : w.flow === '排队' ? 0 : 0.5); return { plan, act, cost: act * 1.3 }; };
      const orderRow = (init) => Object.assign({ count: 0, list: 0, disc: 0, sale: 0, wipe: 0, net: 0, plan: 0, act: 0, cost: 0 }, init);
      const addOrder = (r, w) => {
        const wipe = sum(D.settlements.filter((s) => s.orderNo === w.no), (s) => s.wipe), t = hours(w), lst = listAmount(w);
        r.count++; r.list = r2(r.list + lst); r.sale = r2(r.sale + w.amount); r.disc = r2(r.list - r.sale); r.wipe = r2(r.wipe + wipe);
        r.net = r2(r.net + w.amount - wipe); r.avg = r2(div(r.net, r.count)); r.plan = r2(r.plan + t.plan); r.act = r2(r.act + t.act); r.cost = r2(r.cost + t.cost);
      };
      const orders = () => D.workOrders.filter((w) => cust && w.custCode === cust.code);
      const saleCols = (title) => [
        { key: 'period', title, width: 100 }, { key: 'count', title: '单数', type: 'int', sum: true, render: (r) => r.count || '' },
        ...[['list', '标售'], ['disc', '优惠'], ['sale', '实售'], ['wipe', '抹零'], ['net', '实收'], ['avg', '均收'], ['plan', '委托工时'], ['act', '实际工时'], ['cost', '生产耗时']]
          .map(([key, t]) => ({ key, title: t, type: 'money', sum: key !== 'avg', hideZero: true }))];
      const views = [
        { title: '销售汇总（月份）', cols: saleCols('审核时间'), rows() {
          // 列出 12 个月（无数据的月份也显示，便于图表连续）
          const ms = Array.from({ length: 12 }, (_, i) => { const d = new Date(since.getFullYear(), since.getMonth() + i, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; });
          const m = Object.fromEntries(ms.map((p) => [p, orderRow({ period: p, avg: 0 })]));
          orders().filter((w) => w.created >= since).forEach((w) => { const p = F.date(w.created).slice(0, 7); m[p] && addOrder(m[p], w); });
          return ms.map((p) => m[p]);
        }, chart: (rows) => ({ type: 'bar', labels: rows.map((r) => r.period.slice(2)), series: [{ name: '实收', values: rows.map((r) => r.net) }, { name: '标售', values: rows.map((r) => r.list) }] }) },
        { title: '销售汇总（年度）', cols: saleCols('审核年度'), rows: () => rollup(orders(), (w) => w.created.getFullYear(), (w) => orderRow({ period: String(w.created.getFullYear()) }), addOrder).sort(byKeys('period')),
          chart: (rows) => ({ type: 'bar', labels: rows.map((r) => r.period), series: [{ name: '实收', values: rows.map((r) => r.net) }, { name: '标售', values: rows.map((r) => r.list) }] }) },
        { title: '经营项目', cols: [
          { key: 'cat', title: '主项名称', width: 140 }, { key: 'name', title: '子项名称', width: 240 }, { key: 'count', title: '单数', type: 'int', sum: true },
          { key: 'qty', title: '数量', type: 'int', sum: true }, { key: 'list', title: '标售', type: 'money', sum: true }, { key: 'disc', title: '优惠', type: 'money', sum: true },
          { key: 'sale', title: '实售', type: 'money', sum: true }, { key: 'avg', title: '实售均价', type: 'money4' }, { key: 'share', title: '实售占比', width: 90, align: 'right', render: (r) => pct(r.share) }],
        rows() {
          const os = orders().filter((w) => w.created >= since);
          const rows = rollup(os.flatMap((w) => w.lines.map((l) => ({ w, l }))), ({ l }) => l.code, ({ l }) => ({ cat: l.catName, name: l.name, orders: new Set(), qty: 0, list: 0, sale: 0 }),
            (r, { w, l }) => { const q = l.qty * (l.copies || 1); r.orders.add(w.no); r.qty += q; r.list = r2(r.list + l.listPrice * q); r.sale = r2(r.sale + l.amount); });
          const total = sum(rows, (r) => r.sale);
          return rows.map((r) => Object.assign(r, { count: r.orders.size, disc: r2(r.list - r.sale), avg: div(r.sale, r.qty), share: div(r.sale, total) })).sort((a, b) => b.sale - a.sale);
        }, chart: (rows) => ({ type: 'bar', labels: rows.slice(0, 12).map((r) => r.name.slice(0, 8)), series: [{ name: '实售', values: rows.slice(0, 12).map((r) => r.sale) }] }) },
      ];
      const refresh = () => {
        custInp.value = cust ? `${cust.code} / ${cust.name} / ${cust.groupName}` : '';
        tabs.forEach((t) => t.draw && t.draw());
      };
      const pickCust = () => dialog({ title: '选择分析客户', width: 720, height: 480, flush: true, body: (b, close) => {
        const kw = input({ placeholder: '输入客户编号 / 名称 / 电话过滤' });
        b.appendChild(h('div', { style: { padding: '8px' } }, kw));
        const box = h('div.fill', { style: { padding: '0 8px 8px' } });
        b.appendChild(box);
        const g = grid(box, { columns: [{ key: 'code', title: '编号', width: 80 }, { key: 'name', title: '名称', width: 300 }, { key: 'groupName', title: '分组', width: 160 }, { key: 'phone', title: '手机', width: 120 }],
          rows: D.customers, footer: false, onDblClick: (c) => { cust = c; refresh(); close(); } });
        kw.addEventListener('input', () => { const k = kw.value.trim(); g.setRows(D.customers.filter((c) => !k || c.code.includes(k) || c.name.includes(k) || c.phone.includes(k))); });
        setTimeout(() => kw.focus());
      }, buttons: [{ label: '关闭(C)' }] });
      custInp.addEventListener('click', pickCust);

      dialog({
        title: info.win, banner: info.banner, maximized: true, width: 1200, height: 720,
        body: (b) => {
          b.appendChild(h('div.row', h('label', '分析客户'), h('div.grow', custInp), btn('🔍', pickCust, 'sm')));
          const box = h('div.fill');
          b.appendChild(box);
          itabs(box, views.map((v, i) => ({ title: v.title, render: (pane) => {
            const gbox = h('div.col', { style: { flex: '0 0 300px', minHeight: 0 } }), cbox = h('div', { style: { flex: '1', minHeight: 0, overflow: 'auto' } });
            pane.append(gbox, cbox);
            let g;
            tabs[i] = { draw() {
              const rows = v.rows();
              gbox.innerHTML = ''; cbox.innerHTML = '';
              g = grid(gbox, { columns: v.cols, rows, contextMenu: ERP.ui.stdMenu(() => g, [], info.title) });
              const c = v.chart(rows);
              c.series.forEach((s, j) => (s.color = chartColors[j]));
              ERP.ui.chart(cbox, Object.assign({ height: 300 }, c));
            } };
            tabs[i].draw();
          } })));
          refresh();
        },
        leftButtons: [{ label: '打印', action: () => { toast('已发送到打印机（原型）'); return false; } }],
        buttons: [{ label: '✕ 关闭(C)' }],
      });
    },
  });

  /* ======================= 业务提醒 ======================= */
  ERP.page('bizAlert', {
    title: '业务提醒',
    render(el) {
      const cfg = { grace: 3, credit: 2000, low: 1000 }; // 交付宽限天数（未设交付时间时：下单 + N 天）、默认信用额度、预存预警线
      const now = new Date(D.company.server.replace(' ', 'T'));
      const due = (w) => w.due || new Date(+w.created + cfg.grace * DAY);
      const orderCols = (extra) => [
        { title: '基础', columns: [{ key: 'no', title: '工单编号', width: 140 }, { key: 'group', title: '客户分组', width: 110 }, { key: 'custName', title: '客户名称', width: 220 }, { key: 'task', title: '制作任务', width: 120 }] },
        { title: '金额', columns: [{ key: 'amount', title: '实收', type: 'money', sum: true }, { key: 'paid', title: '已结', type: 'money', sum: true, hideZero: true }, { key: 'unpaid', title: '未结', type: 'money', sum: true }] },
        { title: '生产', columns: [{ key: 'flow', title: '生产流程', width: 80, align: 'center' }, { key: 'handler', title: '当前处理', width: 90 }, { key: 'created', title: '下单时间', type: 'short', width: 110 }, ...extra] },
      ];
      const ALERTS = [
        { key: 'overdue', label: '交付超期工单', icon: '⏰', color: 'red', note: `未完工且已过交付时间的工单（未设置交付时间的按下单后 ${cfg.grace} 天计）。`,
          rows: () => D.workOrders.filter((w) => w.flow !== '完工' && due(w) < now).map((w) => Object.assign(Object.create(w), { dueAt: due(w), overDays: Math.floor((now - due(w)) / DAY) }))
            .sort((a, b) => b.overDays - a.overDays),
          cols: () => orderCols([{ key: 'dueAt', title: '交付时间', type: 'short', width: 110 }, { key: 'overDays', title: '超期天数', type: 'int', class: () => 'c-red' }]), order: true },
        { key: 'unsettled', label: '未结算工单', icon: '¥', color: 'orange', note: '尚未结算或部分结算的工单。',
          rows: () => D.workOrders.filter((w) => w.unpaid > 0), cols: () => orderCols([{ key: 'settleStatus', title: '结算状态', width: 90 }]), order: true },
        { key: 'debt', label: '客户欠款超限', icon: '⚠', color: 'red', note: `欠款金额超过信用额度的客户（未设置信用额度的按 ${cfg.credit} 元计）。`,
          rows: () => D.customers.filter((c) => c.debt > (c.creditLimit || cfg.credit)).map((c) => Object.assign(Object.create(c), { limit: c.creditLimit || cfg.credit, over: r2(c.debt - (c.creditLimit || cfg.credit)) }))
            .sort((a, b) => b.over - a.over),
          cols: () => [{ title: '客户', columns: [{ key: 'code', title: '客户编号', width: 80 }, { key: 'name', title: '客户名称', width: 240 }, { key: 'groupName', title: '客户分组', width: 140 }, { key: 'contact', title: '联系人', width: 80 }, { key: 'phone', title: '电话', width: 120 }] },
            { title: '欠款', columns: [{ key: 'debt', title: '欠款金额', type: 'money', sum: true }, { key: 'limit', title: '信用额度', type: 'money' }, { key: 'over', title: '超限金额', type: 'money', sum: true, class: () => 'c-red' }, { key: 'settleType', title: '结算方式', width: 80 }] }] },
        { key: 'low', label: '预存余额不足', icon: '▤', color: 'orange', note: `会员卡余额低于 ${cfg.low} 元的预存客户。`,
          rows: () => D.cards.filter((k) => k.balance < cfg.low).sort((a, b) => a.balance - b.balance),
          cols: () => [{ title: '卡片', columns: [{ key: 'cardNo', title: '卡号', width: 100 }, { key: 'custCode', title: '客户编号', width: 80 }, { key: 'custName', title: '客户名称', width: 240 }, { key: 'group', title: '客户分组', width: 180 }] },
            { title: '金额', columns: [{ key: 'balance', title: '卡内余额', type: 'money', sum: true, class: () => 'c-red' }, { key: 'totalIn', title: '累计储值', type: 'money', sum: true }, { key: 'totalOut', title: '累计消费', type: 'money', sum: true }] },
            { title: '其他', columns: [{ key: 'issueDate', title: '发卡日期', type: 'date' }, { key: 'status', title: '状态', width: 60 }] }] },
        { key: 'unaudited', label: '未审核单据', icon: '✎', color: 'blue', note: '尚未审核的工作单、结算单与一般收支单据。',
          rows: () => [
            ...D.workOrders.filter((w) => !w.audited).map((w) => ({ type: '工作单', no: w.no, date: w.created, who: w.custName, amount: w.amount, handler: w.receptionist, ref: w })),
            ...D.settlements.filter((s) => !s.audited).map((s) => ({ type: '结算单', no: s.no, date: s.date, who: s.custName, amount: s.amount, handler: s.handler })),
            ...D.cashJournal.filter((x) => !x.audited).map((x) => ({ type: x.kind, no: x.no, date: x.date, who: x.type + ' / ' + x.account, amount: x.amount, handler: x.handler })),
          ].sort((a, b) => b.date - a.date),
          cols: () => [{ title: '单据', columns: [{ key: 'type', title: '单据类型', width: 90 }, { key: 'no', title: '单据编号', width: 140 }, { key: 'date', title: '登记时间', type: 'datetime' }] },
            { title: '内容', columns: [{ key: 'who', title: '客户 / 摘要', width: 260 }, { key: 'amount', title: '金额', type: 'money', sum: true }, { key: 'handler', title: '经手人', width: 90 }] }] },
      ];
      let cur = ALERTS[0], g;
      const { side, main } = split(el);
      const listItems = () => ALERTS.map((a) => ({ label: a.label, value: a.key, icon: a.icon, color: a.color, count: a.rows().length }));
      const sb = sidebar(side, [
        { key: 'alerts', title: '提醒类型', list: listItems(), value: cur.key, onSelect: (v) => show(ALERTS.find((a) => a.key === v)) },
        { title: '提醒设置', body: h('div.col',
          field('交付宽限', input({ type: 'number', value: cfg.grace, onchange: (e) => { cfg.grace = +e.target.value || 0; reload(); } }), { lw: 64 }),
          field('信用额度', input({ type: 'number', value: cfg.credit, onchange: (e) => { cfg.credit = +e.target.value || 0; reload(); } }), { lw: 64 }),
          field('预存预警', input({ type: 'number', value: cfg.low, onchange: (e) => { cfg.low = +e.target.value || 0; reload(); } }), { lw: 64 }),
          h('div.muted', { style: { fontSize: '12px' } }, '天数 / 元；修改后立即重新计算')) },
      ]);
      const cards = h('div.cards', { style: { gridTemplateColumns: 'repeat(5, minmax(150px, 1fr))' } });
      const head = h('div.row');
      const box = h('div.fill');
      main.append(cards, head, box);
      function renderCards() {
        cards.innerHTML = '';
        ALERTS.forEach((a) => cards.appendChild(h('div.card', {
          style: { cursor: 'pointer', borderColor: a === cur ? 'var(--primary)' : null, background: a === cur ? 'var(--primary-3)' : null },
          onclick: () => show(a),
        }, h('div.k', a.icon + ' ' + a.label), h('div.v.c-' + a.color, a.rows().length))));
      }
      function show(a) {
        cur = a;
        renderCards();
        head.innerHTML = '';
        head.append(h('b', a.label), h('span.muted', a.note), h('span.grow'), btn('刷新(R)', reload, 'sm'));
        box.innerHTML = '';
        g = grid(box, { groups: a.cols(), rows: a.rows(), emptyText: '没有需要提醒的记录',
          rowColor: a.order ? ERP.biz && ERP.biz.orderRowColor : null,
          onDblClick: (r) => { const no = a.order ? r.no : r.ref && r.ref.no; if (no && ERP.biz) ERP.biz.openOrder(no); },
          contextMenu: (r) => a.order && r && ERP.biz ? ERP.biz.orderMenu(() => g, r) : ERP.ui.stdMenu(() => g, [], a.label) });
      }
      function reload() { sb.alerts.setList(listItems()); show(cur); }
      el.addEventListener('erp:orders-changed', reload);
      show(cur);
    },
  });

  /* ======================= 报表中心 ======================= */
  ERP.page('reportCenter', {
    title: '报表中心',
    render(el) {
      const wrap = h('div', { style: { height: '100%', overflow: 'auto', padding: '14px 18px' } });
      el.appendChild(wrap);
      const now = new Date(D.company.server.replace(' ', 'T'));
      const m0 = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthOrders = D.workOrders.filter((w) => w.created >= m0);
      const kpi = [
        ['本月工单', monthOrders.length + ' 单'],
        ['本月实售', '¥ ' + F.money(sum(monthOrders, (w) => w.amount))],
        ['未结金额', '¥ ' + F.money(sum(D.workOrders, (w) => w.unpaid))],
        ['今年新增客户', D.customers.filter((c) => c.created.getFullYear() === now.getFullYear() && c.created <= now).length + ' 个'],
        ['会员卡余额', '¥ ' + F.money(sum(D.cards, (k) => k.balance))],
      ];
      wrap.appendChild(h('div.cards', { style: { gridTemplateColumns: 'repeat(5, minmax(160px, 1fr))', marginBottom: '16px' } },
        kpi.map(([k, v]) => h('div.card', h('div.k', k), h('div.v', v)))));
      const card = (it) => h('div.card', {
        style: { cursor: 'pointer', display: 'flex', gap: '12px', alignItems: 'flex-start', transition: 'border-color .15s' },
        onmouseenter: (e) => (e.currentTarget.style.borderColor = 'var(--primary)'),
        onmouseleave: (e) => (e.currentTarget.style.borderColor = ''),
        onclick: () => ERP.open(it.id),
      }, h('span', { style: { flex: '0 0 36px', height: '36px', borderRadius: '8px', background: it.color || 'var(--primary)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700 } }, it.icon),
      h('div', { style: { minWidth: 0 } }, h('div', { style: { fontWeight: 700, marginBottom: '4px' } }, it.title),
        h('div.muted', { style: { fontSize: '12px', lineHeight: 1.5 } }, it.banner)));
      const section = (title, items) => [
        h('div.row', { style: { margin: '6px 0 8px', borderLeft: '4px solid var(--primary)', paddingLeft: '8px' } }, h('b', title), h('span.muted', `（${items.length}）`)),
        h('div.cards', { style: { gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', marginBottom: '16px' } }, items.map(card)),
      ];
      CATALOG.forEach((c) => ERP.ui.append(wrap, section(c.cat + '报表', c.items)));
      const alertCount = D.workOrders.filter((w) => w.unpaid > 0).length;
      ERP.ui.append(wrap, section('提醒', [{ id: 'bizAlert', title: '业务提醒', icon: '!', color: 'var(--orange)',
        banner: `交付超期工单、未结算工单（当前 ${alertCount} 单）、客户欠款超限、预存余额不足、未审核单据等业务提醒。` }]));
    },
  });
})();
