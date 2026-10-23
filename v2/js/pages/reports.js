/* 报表：报表中心（目录）、业务提醒、各类汇总 / 排行报表
 * 每张报表是普通路由页面（不再是弹出窗口）：
 *   「查询条件」面板：统计周期 / 开始 / 结束 / 汇总依据 / 行数 / 含散户 / 客户分组 …，点“统计”按条件重新汇总；条件写入地址，刷新、返回可恢复。
 *   「统计结果」面板：页头写明 单位 · 时间范围 · 数据截至；页签 数据表格（分组表头 + 合计行）/ 数据图表（线型、图例区分系列）；导出 CSV。
 * 字段与汇总逻辑沿用 v1（archive/v1-ribbon-20261019/web/js/pages/reports.js）。
 * 说明：模拟数据没有单独的「审核时间」，工作单一律以登记时间代替。 */
(function () {
  'use strict';
  const { h, btn, link, badge, notice, panel, field, input, dateInput, select, checkbox, toast } = ERP.ui;
  const D = ERP.data, F = ERP.fmt, r2 = D.util.r2;

  /* ---------- 报表目录（报表中心卡片、各报表页说明共用；说明文字取自原系统横幅） ---------- */
  const CATALOG = [
    { cat: '基础报表', items: [
      { id: 'rptIncomeExpense', title: '营业收支汇总表', nav: '收支汇总', banner: '汇总指定时间内审核的各项财务相关的收入、支出类单据的金额信息。【收支核算规则可自行配置】' },
      { id: 'rptOrderSettle', title: '工单结算汇总表', nav: '工单结算', banner: '汇总计算工作单的标售、实售、实收及抹零等金额信息，并汇总相应的结算信息。【考察工作单的审核时间在指定期间范围内的数据。(生产成本=基础成本+用料成本+设备成本)】' },
      { id: 'rptItems', title: '经营项目汇总表', nav: '经营项目', banner: '汇总统计在指定时间范围内审核的“工作单”的制作明细所选定的经营项目信息。【考察工作单的审核时间在指定期间范围内的数据。】' },
    ] },
    { cat: '客户类报表', items: [
      { id: 'rptCustValue', title: '客户价值分析表', nav: '客户价值', banner: '以工作的“审核时间”为基础，汇总选定客户12个月以来的消费数据，以供进行价格分析。' },
      { id: 'rptCustNew', title: '客户新增汇总表', nav: '客户新增', banner: '汇总在指定时间范围内新增的客户数量并统计各类业务特征名下的新增客户数量。【以客户资料的建交时间为准，建交时间默认等于创建时间。】' },
      { id: 'rptCardSummary', title: '会员办卡汇总表', nav: '办卡汇总', banner: '汇总计算客户办理会员卡片的相关数据信息。【考察会员卡片发行时间在指定期间范围内的数据。】' },
      { id: 'rptCustRevenueRank', title: '客户工单实收排行表', nav: '实收排行', banner: '对指定时间内审核的工作单，按照下单客户汇总工单实收金额，并以实收金额排序。' },
      { id: 'rptCustAvgRank', title: '客户工单均价排行表', nav: '均价排行', banner: '对指定时间内审核的工作单，按照下单客户汇总工单数量及实收总额计算出每单均价，并以此均价对比排行。' },
      { id: 'rptCustCountRank', title: '客户工单数量排行表', nav: '数量排行', banner: '对指定时间内审核的工作单，按照下单客户汇总工单数量，并以工单数量对比排行。' },
    ] },
  ];
  const INFO = Object.fromEntries(CATALOG.flatMap((c) => c.items).map((x) => [x.id, x]));

  /* ---------- 公共计算 ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  const DAY = 864e5;
  // 默认统计区间需包含模拟数据：工单集中在 2026-08 ~ 10；客户建交、会员发卡最早到 2023 年
  const ORDER_RANGE = ['2026-08-01', '2026-10-31'];
  const CUST_RANGE = ['2023-01-01', '2026-12-31'];
  // 业务“今天”取模拟服务器时间（12 个月窗口、超期天数据此计算）
  const bizNow = () => new Date(D.company.server.replace(' ', 'T'));
  const sum = (arr, fn) => r2(arr.reduce((s, x) => s + (Number(fn(x)) || 0), 0));
  const div = (a, b) => (b ? a / b : 0);
  const pctOf = (a, b) => (b ? F.pct(a / b) : '—'); // 分母为 0 时不适用，显示“—”
  const inRange = (d, st) => { const a = ERP.parseDate(st.from), b = ERP.parseDate(st.to, true); return !!d && d >= a && d <= b; };
  const empCount = () => D.employees.filter((e) => !e.left).length || 1; // 人均 = 金额 / 在职员工数
  const listAmount = (w) => sum(w.lines, (l) => l.listPrice * l.qty * (l.copies || 1)); // 标售金额
  const district = (c) => (/市(.+?区)/.exec(c.address || '') || [])[1] || '（未设置）'; // 城市商圈：取地址中的区
  const allGroups = () => D.groups.map((g) => g.code);

  /* 统计周期：日报 2026-10-12 / 月报 2026-10 / 年报 2026 / 自定（整个区间一行） */
  const MODES = [['day', '日报'], ['month', '月报'], ['year', '年报'], ['custom', '自定']];
  const modeName = (m) => (MODES.find((x) => x[0] === m) || [])[1] || '';
  function periodKey(d, st) {
    const s = F.date(d);
    if (st.mode === 'month') return s.slice(0, 7);
    if (st.mode === 'year') return s.slice(0, 4);
    if (st.mode === 'custom') return `${st.from} 至 ${st.to}`;
    return s;
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
  const orderBasis = (w, basis) => ({ 委托客户: w.custName, 客户分组: w.group, 工单类型: w.orderType || '（未设置）', 经手人员: w.handler || w.receptionist }[basis] || '');
  /* 期间内的工单（可选：仅已审核、工单类型） */
  const ordersIn = (st) => D.workOrders.filter((w) => inRange(w.created, st) && (!st.audited || w.audited) && (!st.otype || w.orderType === st.otype));

  /* ---------- 列定义辅助：金额列表头写“（元）”；均值、比例列的合计行按总量重新计算 ---------- */
  const mCol = (key, title, extra) => Object.assign({ key, title: title + '（元）', type: 'money', sum: true }, extra);
  const nCol = (key, title, extra) => Object.assign({ key, title, type: 'num', sum: true }, extra);
  const tot = (k) => (rows) => sum(rows, (r) => r[k]);
  const avgOf = (a, b) => (rows) => r2(div(tot(a)(rows), tot(b)(rows)));              // 合计行：Σa / Σb
  const discOf = (a, b) => (rows) => r2(div(tot(a)(rows), tot(b)(rows)) * 10);        // 折扣（几折）
  const pctSum = (a, b) => (rows) => pctOf(tot(a)(rows), tot(b)(rows));               // 比例
  const flat = (gs) => gs.flatMap((g) => g.columns);
  const spans = (gs) => gs.map((g) => ({ title: g.title, span: g.columns.length }));
  // CSV 合计行：与表格合计行同一算法
  const totalRow = (cols, rows) => Object.fromEntries(cols.map((c, i) => [c.key, c.sum ? (typeof c.sum === 'function' ? c.sum(rows) : tot(c.key)(rows)) : i === 0 ? '合计' : '']));
  const basisCol = (st) => (st.basis !== '无' ? [{ key: 'basis', title: st.basis }] : []);
  // ui.table 不处理 nowrap：日期、编号、电话等短值用不换行的 span 包一层（导出 CSV 时去掉 render，取原值）
  const nw = (cols) => cols.map((c) => (c.nowrap && !c.render ? { ...c, render: (r) => h('span', { style: { whiteSpace: 'nowrap' } }, c.type === 'date' ? F.date(r[c.key]) : r[c.key] ?? '') } : c));

  /* 图表：多系列柱图时，图例符号补上与柱子相同的填充（core 的柱图图例只有“■”文字）；线图靠线型区分 */
  const FILLS = ['var(--apb-erp-primary)', 'var(--apb-erp-ink)', 'var(--apb-erp-muted)', 'var(--apb-erp-control-border)'];
  function drawChart(pane, c, note) {
    const el = ERP.ui.chart(pane, Object.assign({ height: 320 }, c));
    if (c.type === 'bar' && c.series.length > 1) {
      el.querySelectorAll('.lerp-legend > span').forEach((s, i) => s.replaceChildren(h('span', { 'aria-hidden': 'true', style: { color: FILLS[i % 4] } }, '■'), s.textContent.replace(/^■/, '')));
    }
    if (note) pane.appendChild(h('p.apb-erp-muted', { style: { padding: '0 16px 16px' } }, note));
    return el;
  }
  // 期间类报表的图表：按期间汇总指定列。两个以上期间用折线（线型区分），只有一个期间时用柱图
  const periodChart = (cols, unit = '元') => (rows) => {
    const keys = [...new Set(rows.map((r) => r.period))].sort();
    return { type: keys.length > 1 ? 'line' : 'bar', unit, labels: keys,
      series: cols.map(([k, name]) => ({ name, values: keys.map((p) => sum(rows.filter((r) => r.period === p), (r) => r[k])) })),
      note: `横轴：统计期间；纵轴：${unit === '元' ? '金额（元）' : `数量（${unit}）`}。精确数值见“数据表格”。` };
  };

  /* ---------- 查询状态：地址参数 ⇄ 条件 ---------- */
  function readState(def, P) {
    const ok = (v, list) => (list.includes(v) ? v : null);
    return {
      mode: ok(P.mode, MODES.map((m) => m[0])) || def.mode || 'day',
      from: P.from ?? def.range[0], to: P.to ?? def.range[1],
      basis: def.basis && ok(P.basis, def.basis) ? P.basis : '无',
      limit: P.limit ?? '100', retail: P.retail !== '0', jf: P.jf || '', jt: P.jt || '',
      groups: new Set(P.groups ? P.groups.split(',') : allGroups()),
      audited: P.audited === '1', otype: P.otype || '', imode: P.imode === 'sub' ? 'sub' : 'cat', q: P.q || '',
      tab: P.tab === '1' ? 1 : 0,
    };
  }
  function toParams(def, st) {
    const p = {};
    if (def.period && st.mode !== (def.mode || 'day')) p.mode = st.mode;
    if (st.from !== def.range[0]) p.from = st.from;
    if (st.to !== def.range[1]) p.to = st.to;
    if (st.basis !== '无') p.basis = st.basis;
    if (def.rank) {
      if (String(st.limit) !== '100') p.limit = st.limit;
      if (!st.retail) p.retail = '0';
      if (st.jf) p.jf = st.jf;
      if (st.jt) p.jt = st.jt;
      if (st.groups.size < D.groups.length) p.groups = [...st.groups].join(',');
    }
    if (def.more) { if (st.audited) p.audited = '1'; if (st.otype) p.otype = st.otype; }
    if (def.items) { if (st.imode === 'sub') p.imode = 'sub'; if (st.q) p.q = st.q; }
    if (st.tab) p.tab = '1';
    return p;
  }

  /* 字段错误：显示在字段下方，并标 aria-invalid */
  function setErr(fld, msg) {
    fld._err.hidden = !msg;
    if (msg) fld._err.textContent = msg;
    fld._control.setAttribute('aria-invalid', String(!!msg));
    return msg ? fld._control : null;
  }
  const dateMsg = (v, required) => (!v ? (required ? '请填写日期，例如 2026-10-21。' : null) : ERP.validDate(v) ? null : '请填写有效日期，例如 2026-10-21。');
  const fieldset = (legend, ...content) => h('fieldset.lerp-fieldset', { style: { flex: '1 1 100%' } },
    h('legend', legend), ...content);

  /* ---------- 查询条件表单 ----------
   * def.period 统计周期；def.basis 汇总依据选项；def.rank 行数 / 含散户 / 建交日期 / 客户分组；def.more 仅已审核 / 工单类型；def.items 项目名称 / 项目过滤 */
  function conditions(def, st, onStat) {
    const errBox = notice('danger', '尚未统计：请检查下面标出的条件；已填内容保留。');
    errBox.hidden = true; errBox.style.flex = '1 1 100%';
    const submit = btn('统计', null, { type: 'submit', variant: 'primary', busySlot: true });
    const form = h('form.apb-erp-toolbar', { novalidate: true, 'aria-label': '查询条件' }, errBox);
    const readers = [], checks = [];
    const add = (...n) => ERP.ui.append(form, n);

    if (def.period) {
      const mode = select(MODES, { value: st.mode });
      add(field({ label: '统计周期', control: mode }));
      readers.push(() => (st.mode = mode.value));
    }
    const from = dateInput({ value: st.from }), to = dateInput({ value: st.to });
    from.dataset.validate = to.dataset.validate = 'date';
    const fFrom = field({ label: '开始日期', control: from }), fTo = field({ label: '结束日期', control: to });
    add(fFrom, fTo);
    checks.push(() => setErr(fFrom, dateMsg(from.value.trim(), true)), () => {
      const a = from.value.trim(), b = to.value.trim();
      return setErr(fTo, dateMsg(b, true) || (ERP.validDate(a) && b < a ? '结束日期不能早于开始日期。' : null));
    });
    readers.push(() => { st.from = from.value.trim(); st.to = to.value.trim(); });

    if (def.basis) {
      const basis = select(def.basis, { value: st.basis });
      add(field({ label: '汇总依据', control: basis }));
      readers.push(() => (st.basis = basis.value));
    }
    if (def.more) {
      const otype = select(D.orderTypes.map((x) => [x, x || '全部类型']), { value: st.otype });
      const aud = checkbox('仅统计已审核的工作单', st.audited);
      add(field({ label: '工单类型', control: otype }), h('div.lerp-checks', { style: { flex: '1 1 200px', minHeight: '40px', alignItems: 'center' } }, aud));
      readers.push(() => { st.otype = otype.value; st.audited = aud.querySelector('input').checked; });
    }
    if (def.items) {
      const q = input({ type: 'search', value: st.q, placeholder: '项目编号或名称' });
      add(field({ label: '项目过滤', control: q }));
      add(fieldset('项目名称', ERP.ui.radios(ERP.ui.uid('imode'), [['cat', '主项名称'], ['sub', '主项名称 > 子项名称']], st.imode, (v) => (st.imode = v))));
      readers.push(() => (st.q = q.value.trim()));
    }
    if (def.rank) {
      const limit = input({ value: st.limit, inputmode: 'numeric', class: 'lerp-amount' });
      const fLimit = field({ label: '行数', control: limit, error: '请填写 1–9999 的整数。' });
      const jf = dateInput({ value: st.jf }), jt = dateInput({ value: st.jt });
      const fJf = field({ label: '建交开始', control: jf }), fJt = field({ label: '建交结束', control: jt });
      const retail = checkbox('含散户数据', st.retail);
      add(fLimit, fJf, fJt, h('div.lerp-checks', { style: { flex: '1 1 140px', minHeight: '40px', alignItems: 'center' } }, retail));
      checks.push(() => setErr(fLimit, /^\d{1,4}$/.test(limit.value.trim()) && +limit.value > 0 ? null : '请填写 1–9999 的整数。'),
        () => setErr(fJf, dateMsg(jf.value.trim())), () => setErr(fJt, dateMsg(jt.value.trim())));
      // 客户分组：多选，带“全选”（三态）
      const boxes = D.groups.map((g) => checkbox(`${g.code} ${g.name}`, st.groups.has(g.code), { value: g.code }).querySelector('input'));
      const all = checkbox('全选', false).querySelector('input');
      const syncAll = () => { const n = boxes.filter((b) => b.checked).length; all.checked = n === boxes.length; all.indeterminate = n > 0 && n < boxes.length; };
      all.addEventListener('change', () => boxes.forEach((b) => (b.checked = all.checked)));
      boxes.forEach((b) => b.addEventListener('change', syncAll));
      syncAll();
      const gErr = h('span.apb-erp-error', { hidden: true }, '请至少选择一个客户分组。');
      add(fieldset('客户分组', h('div.lerp-checks', all.parentNode, boxes.map((b) => b.parentNode)), gErr));
      checks.push(() => { const bad = !boxes.some((b) => b.checked); gErr.hidden = !bad; return bad ? all : null; });
      readers.push(() => Object.assign(st, { limit: limit.value.trim(), retail: retail.querySelector('input').checked, jf: jf.value.trim(), jt: jt.value.trim(),
        groups: new Set(boxes.filter((b) => b.checked).map((b) => b.value)) }));
    }
    add(h('div.apb-erp-field', { style: { flex: '0 0 auto' } }, submit));

    const validate = () => { const bad = checks.map((c) => c()).filter(Boolean); errBox.hidden = !bad.length; return bad; };
    const read = () => readers.forEach((r) => r());
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const bad = validate();
      if (bad.length) return bad[0].focus();
      read();
      onStat(true, submit);
    });
    return { el: form, validate, read };
  }

  /* ---------- 通用报表页 ----------
   * def: { id, period, mode, range, basis:[…], rank, more, items, unit, condNote, columns(st)->[{title, columns}], compute(st)->rows, chart(rows, st)->{type, labels, series, unit, note}, rowActions, after(el) } */
  function reportPage(def) {
    const info = INFO[def.id];
    ERP.page(def.id, {
      module: 'rpt', title: info.title, navTitle: info.nav, desc: info.banner,
      render(el, P) {
        const st = readState(def, P);
        let rows = [], cols = [], seq = 0;
        const save = () => ERP.setParams(toParams(def, st));
        const cond = conditions(def, st, run);
        const q = panel({ title: '查询条件', note: def.condNote || '修改条件后点“统计”重新汇总；条件保存在地址中，刷新或返回可恢复。', flush: true });
        q.body.appendChild(cond.el);
        el.appendChild(q.el);

        const meta = h('span', '尚未统计');
        const status = h('p.apb-erp-muted', { role: 'status', 'aria-live': 'polite' });
        const exportBtn = btn('导出 CSV', () => ERP.ui.exportCsv(info.title, cols.map((c) => ({ ...c, render: null })), rows.concat([totalRow(cols, rows)])), { disabled: true });
        const res = panel({ title: '统计结果', note: meta, actions: [exportBtn], flush: true });
        el.appendChild(res.el);
        const tabs = ERP.ui.tabs(res.body, [{ title: '数据表格' }, { title: '数据图表' }], { active: st.tab, onChange: (i) => { st.tab = i; save(); } });
        res.body.appendChild(h('div.apb-erp-footer', status, h('p.apb-erp-muted', '宽表可左右滚动查看全部列')));
        if (def.after) def.after(el);

        async function run(manual, button) {
          const my = ++seq;
          save();
          exportBtn.disabled = true;
          tabs.panes.forEach((p) => p.replaceChildren(ERP.ui.loading('正在统计…')));
          status.textContent = '';
          try {
            const work = ERP.api.read(() => def.compute(st));
            const out = await (button ? ERP.ui.busy(button, work) : work);
            if (my !== seq) return; // 旧结果作废
            rows = out;
          } catch (err) {
            if (my !== seq) return;
            tabs.panes.forEach((p) => p.replaceChildren(h('div.apb-erp-empty', h('h3', '统计失败'),
              h('p.apb-erp-muted', `查询条件已保留，可以稍后重试。错误编号：${err.code || 'LERP-READ'}。`), btn('重试', () => run(true)))));
            meta.textContent = `统计失败 · 时间范围：${st.from} 至 ${st.to}`;
            return;
          }
          const gs = def.columns(st);
          cols = flat(gs);
          meta.textContent = `单位：${def.unit || '元（数量、比例列除外）'} · 时间范围：${st.from} 至 ${st.to}${def.period ? `（${modeName(st.mode)}）` : ''} · 数据截至 ${F.stamp(new Date())}`;
          const empty = { title: '指定条件下没有数据', text: '可以放宽时间范围、调整汇总依据或客户分组后再统计。' };
          tabs.panes[0].replaceChildren();
          ERP.ui.table(tabs.panes[0], { caption: info.title, columns: nw(cols), groups: spans(gs), rows, footLabel: `合计（${rows.length} 行）`, rowActions: def.rowActions, empty });
          tabs.panes[1].replaceChildren();
          if (rows.length) { const c = def.chart(rows, st); drawChart(tabs.panes[1], c, c.note); }
          else tabs.panes[1].appendChild(ERP.ui.empty(empty));
          status.textContent = `共 ${rows.length} 行。`;
          exportBtn.disabled = !rows.length;
          if (manual) toast(`统计完成，共 ${rows.length} 行。`);
        }
        // 首次进入：按地址中的条件直接统计；地址里的条件无效时先标出错误
        if (cond.validate().length) {
          meta.textContent = '尚未统计：查询条件有误';
          tabs.panes.forEach((p) => p.replaceChildren(ERP.ui.empty({ title: '尚未统计', text: '请先修正上方标出的查询条件，再点“统计”。' })));
        } else { cond.read(); run(false); }
      },
    });
  }

  /* ======================= 报表中心（目录） ======================= */
  ERP.page('reportCenter', {
    module: 'rpt', title: '报表中心', desc: '选择报表进入查询。报表按查询条件即时汇总；审核时间以工单登记时间代替（原型）。',
    render(el) {
      const card = (id, title, text) => h('a', { href: ERP.href(id), style: { alignContent: 'start' } }, h('strong', title), h('span.apb-erp-muted', text));
      CATALOG.forEach((c) => {
        const p = panel({ title: c.cat, note: `${c.items.length} 张报表` });
        p.body.appendChild(h('div.lerp-cards', c.items.map((it) => card(it.id, it.title, it.banner))));
        el.appendChild(p.el);
      });
      // 提醒：显示当前待处理数量（按默认阈值），属于有意义的业务数字
      const defs = alertDefs(ALERT_DEFAULT);
      const n = (k) => defs.find((a) => a.key === k).rows().length;
      const p = panel({ title: '提醒', note: `按默认阈值计算 · 数据截至 ${F.stamp(new Date())}` });
      p.body.appendChild(h('div.lerp-cards', card('bizAlert', '业务提醒',
        `交付超期工单 ${n('overdue')} 单、未结算工单 ${n('unsettled')} 单、客户欠款超限 ${n('debt')} 个、预存余额不足 ${n('low')} 张、未审核单据 ${n('unaudited')} 张。`)));
      el.appendChild(p.el);
    },
  });

  /* ======================= 业务提醒 ======================= */
  const ALERT_DEFAULT = { grace: '3', credit: '2000', low: '1000' }; // 交付宽限天数（未设交付时间时：下单 + N 天）、默认信用额度、预存预警线
  function alertDefs(cfg) {
    const biz = ERP.biz || {};
    const now = bizNow(), grace = +cfg.grace, credit = +cfg.credit, low = +cfg.low;
    const due = (w) => w.due || new Date(+w.created + grace * DAY);
    const orderLink = (w) => link(w.no, 'orderDetail', { no: w.no }, { ariaLabel: `查看工单 ${w.no}` });
    const orderCols = (extra) => [
      { key: 'no', title: '工单 / 客户', type: 'mono', render: orderLink, sub: (w) => `${w.custName} · ${w.group}` },
      { key: 'task', title: '制作任务', render: (w) => w.task || '未指定' },
      { key: 'amount', title: '实收（元）', type: 'money', sum: true }, { key: 'paid', title: '已结（元）', type: 'money', sum: true }, { key: 'unpaid', title: '未结（元）', type: 'money', sum: true },
      { key: 'flow', title: '生产流程', render: (w) => h('span', biz.flowBadge ? biz.flowBadge(w) : w.flow, w.handler ? h('span.apb-erp-muted', w.handler) : null) },
      { key: 'created', title: '委托时间', type: 'time', nowrap: true }, ...extra];
    const orderActions = (w) => [link('详情', 'orderDetail', { no: w.no }, { ariaLabel: `查看工单 ${w.no} 详情` }), link('客户', 'customerDetail', { code: w.custCode }, { ariaLabel: `查看客户 ${w.custName}` })];
    const custActions = (c) => [link('客户资料', 'customerDetail', { code: c.code }, { ariaLabel: `查看客户 ${c.name} 资料` })];
    return [
      { key: 'overdue', label: '交付超期工单', note: `未完工且已过交付日期的工单（未设置交付日期的按下单后 ${grace} 天计），超期天数按 ${F.date(now)} 计算。`,
        rows: () => D.workOrders.filter((w) => w.flow !== '完工' && due(w) < now).map((w) => ({ ...w, dueAt: due(w), overDays: Math.floor((now - due(w)) / DAY) })).sort((a, b) => b.overDays - a.overDays),
        cols: () => orderCols([{ key: 'dueAt', title: '交付日期', type: 'date', nowrap: true, sub: (w) => (w.due ? null : '按宽限推算') }, { key: 'overDays', title: '超期', render: (w) => badge(`超期 ${w.overDays} 天`, 'danger') }]),
        actions: orderActions },
      { key: 'unsettled', label: '未结算工单', note: '尚未结算或部分结算的工单。',
        rows: () => D.workOrders.filter((w) => w.unpaid > 0).sort((a, b) => b.unpaid - a.unpaid),
        cols: () => orderCols([{ key: 'settleStatus', title: '结算状态', render: (w) => (biz.settleBadge ? biz.settleBadge(w) : w.settleStatus) }]), actions: orderActions },
      { key: 'debt', label: '客户欠款超限', note: `欠款金额超过信用额度的客户（未设置信用额度的按 ${F.money(credit)} 元计）。`,
        rows: () => D.customers.filter((c) => c.debt > (c.creditLimit || credit)).map((c) => ({ ...c, limit: c.creditLimit || credit, over: r2(c.debt - (c.creditLimit || credit)) })).sort((a, b) => b.over - a.over),
        cols: () => [{ key: 'code', title: '客户', type: 'mono', render: (c) => link(`${c.code} ${c.name}`, 'customerDetail', { code: c.code }), sub: (c) => c.groupName },
          { key: 'contact', title: '联系人 / 电话', render: (c) => c.contact || '未提供', sub: (c) => c.phone },
          { key: 'debt', title: '欠款金额（元）', type: 'money', sum: true }, { key: 'limit', title: '信用额度（元）', type: 'money' },
          { key: 'over', title: '超限金额（元）', type: 'money', sum: true }, { key: 'settleType', title: '结算方式', render: (c) => h('span', c.settleType, ' ', badge('欠款超限', 'warning')) }],
        actions: custActions },
      { key: 'low', label: '预存余额不足', note: `会员卡余额低于 ${F.money(low)} 元的预存客户。`,
        rows: () => D.cards.filter((k) => k.balance < low).sort((a, b) => a.balance - b.balance),
        cols: () => [{ key: 'cardNo', title: '卡号', type: 'mono', nowrap: true }, { key: 'custName', title: '客户', render: (k) => link(`${k.custCode} ${k.custName}`, 'customerDetail', { code: k.custCode }), sub: (k) => k.group },
          { key: 'balance', title: '卡内余额（元）', type: 'money', sum: true }, { key: 'totalIn', title: '累计储值（元）', type: 'money', sum: true }, { key: 'totalOut', title: '累计消费（元）', type: 'money', sum: true },
          { key: 'issueDate', title: '发卡日期', type: 'date', nowrap: true }, { key: 'status', title: '状态', render: (k) => badge('余额不足', 'warning') }],
        actions: (k) => [link('客户资料', 'customerDetail', { code: k.custCode }, { ariaLabel: `查看客户 ${k.custName} 资料` })] },
      { key: 'unaudited', label: '未审核单据', note: '尚未审核的工作单、结算单与一般收支单据。',
        rows: () => [
          ...D.workOrders.filter((w) => !w.audited).map((w) => ({ type: '工作单', no: w.no, date: w.created, who: w.custName, amount: w.amount, handler: w.receptionist, order: true, custCode: w.custCode })),
          ...D.settlements.filter((s) => !s.audited).map((s) => ({ type: '结算单', no: s.no, date: s.date, who: s.custName, amount: s.amount, handler: s.handler, custCode: s.custCode })),
          ...D.cashJournal.filter((x) => !x.audited).map((x) => ({ type: x.kind, no: x.no, date: x.date, who: `${x.type} / ${x.account}`, amount: x.amount, handler: x.handler })),
        ].sort((a, b) => b.date - a.date),
        cols: () => [{ key: 'type', title: '单据类型', render: (r) => badge(r.type) }, { key: 'no', title: '单据编号', type: 'mono', render: (r) => (r.order ? link(r.no, 'orderDetail', { no: r.no }) : r.no) },
          { key: 'date', title: '登记时间', type: 'time', nowrap: true }, { key: 'who', title: '客户 / 摘要' }, { key: 'amount', title: '金额（元）', type: 'money', sum: true }, { key: 'handler', title: '经手人' }],
        actions: (r) => [r.order ? link('详情', 'orderDetail', { no: r.no }, { ariaLabel: `查看工单 ${r.no}` }) : null,
          r.custCode && r.custCode !== '000000' ? link('客户', 'customerDetail', { code: r.custCode }, { ariaLabel: `查看客户 ${r.who}` }) : null].filter(Boolean) },
    ];
  }

  ERP.page('bizAlert', {
    module: 'rpt', title: '业务提醒', desc: '交付超期、未结算、欠款超限、预存余额不足、未审核单据。选择提醒类型查看明细；阈值可调整。',
    render(el, P) {
      const cfg = { grace: P.grace || ALERT_DEFAULT.grace, credit: P.credit || ALERT_DEFAULT.credit, low: P.low || ALERT_DEFAULT.low };
      const bad = (k) => !/^\d{1,7}(\.\d{1,2})?$/.test(cfg[k]);
      ['grace', 'credit', 'low'].forEach((k) => bad(k) && (cfg[k] = ALERT_DEFAULT[k])); // 地址里的无效阈值恢复默认
      let defs = alertDefs(cfg);
      let cur = defs.find((a) => a.key === P.type) || defs[0];

      // 提醒类型（带数量）+ 阈值设置
      const typeSel = select([], { 'aria-describedby': null });
      const fillTypes = () => { typeSel.replaceChildren(...defs.map((a) => h('option', { value: a.key }, `${a.label}（${a.rows().length}）`))); typeSel.value = cur.key; };
      fillTypes();
      typeSel.addEventListener('change', () => { cur = defs.find((a) => a.key === typeSel.value); show({}); });
      const grace = input({ value: cfg.grace, inputmode: 'numeric', class: 'lerp-amount' }), credit = input({ value: cfg.credit, inputmode: 'decimal', class: 'lerp-amount' }), low = input({ value: cfg.low, inputmode: 'decimal', class: 'lerp-amount' });
      const fGrace = field({ label: '交付宽限（天）', control: grace }), fCredit = field({ label: '默认信用额度（元）', control: credit }), fLow = field({ label: '预存预警线（元）', control: low });
      const apply = btn('应用阈值', null, { type: 'submit' });
      const form = h('form.apb-erp-toolbar', { novalidate: true, 'aria-label': '提醒类型与阈值' },
        field({ label: '提醒类型', control: typeSel }), fGrace, fCredit, fLow, h('div.apb-erp-field', { style: { flex: '0 0 auto' } }, apply));
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const errs = [setErr(fGrace, /^\d{1,3}$/.test(grace.value.trim()) ? null : '请填写 0–999 的整数天数。'),
          setErr(fCredit, /^\d{1,7}(\.\d{1,2})?$/.test(credit.value.trim()) ? null : '请填写金额，最多两位小数，例如 2000.00。'),
          setErr(fLow, /^\d{1,7}(\.\d{1,2})?$/.test(low.value.trim()) ? null : '请填写金额，最多两位小数，例如 1000.00。')].filter(Boolean);
        if (errs.length) return errs[0].focus();
        Object.assign(cfg, { grace: grace.value.trim(), credit: credit.value.trim(), low: low.value.trim() });
        defs = alertDefs(cfg);
        cur = defs.find((a) => a.key === cur.key);
        fillTypes();
        show({});
        toast('提醒阈值已应用，数量已重新计算。');
      });
      const p = panel({ title: '提醒类型与阈值', note: '切换提醒类型立即生效；修改阈值后点“应用阈值”。阈值仅对本次查看有效（保存在地址中），正式版在系统设置中维护。', flush: true });
      p.body.appendChild(form);
      el.appendChild(p.el);
      const holder = h('div');
      el.appendChild(holder);

      function show(params) {
        const keep = { type: cur.key };
        ['grace', 'credit', 'low'].forEach((k) => cfg[k] !== ALERT_DEFAULT[k] && (keep[k] = cfg[k]));
        holder.replaceChildren();
        ERP.ui.list(holder, {
          title: cur.label, note: `${cur.note} 数据截至 ${F.stamp(new Date())}`, params, keepParams: keep,
          load: () => cur.rows(),
          filters: [{ key: 'q', type: 'search', label: '搜索', placeholder: '编号 / 客户名称', keys: ['no', 'custName', 'name', 'code', 'cardNo', 'who'] }],
          columns: cur.cols(), rowActions: cur.actions,
          emptyTitle: `没有${cur.label}`, emptyText: '当前没有需要处理的记录。可以调整阈值后再看。',
        });
      }
      show(P);
    },
  });

  /* 期间行：日期时间列 */
  const periodCol = { key: 'period', title: '日期时间', nowrap: true };

  /* ======================= 营业收支汇总表 ======================= */
  // 收支核算规则：结算方式 → 收入栏目
  const RULE = { 现金: 'cash', 刷卡: 'cash', 转账: 'cash', 记账: 'credit', 预存: 'prestore', 微信: 'scan', 支付宝: 'scan', 在线付款码: 'scan' };
  const RULE_COL = { cash: '现收结算', credit: '记账结算', prestore: '扣预结算', scan: '扫码结算', cloud: '云端结算' };
  reportPage({
    id: 'rptIncomeExpense', period: true, range: ORDER_RANGE,
    condNote: '统计已审核的结算单、一般收支，以及全部小额零收。条件保存在地址中，刷新或返回可恢复。',
    columns: () => [
      { title: '基础', columns: [periodCol, mCol('income', '收入小计'), mCol('expense', '支出小计')] },
      { title: '收入', columns: [mCol('misc', '小额零收'), mCol('cash', '现收结算'), mCol('credit', '记账结算'), mCol('prestore', '扣预结算'), mCol('scan', '扫码结算'), mCol('cloud', '云端结算'), mCol('genIn', '一般收入')] },
      { title: '支出', columns: [mCol('genOut', '一般支出')] },
      { title: '利润', columns: [mCol('profit', '利润小计'), mCol('perCap', '人均收入'), { key: 'rate', title: '利润率', align: 'right', sum: pctSum('profit', 'income') }] },
    ],
    compute(st) {
      // 把各类单据统一成 {date, col, amount, out}
      const docs = [
        ...D.miscIncomes.map((x) => ({ date: x.date, col: 'misc', amount: x.amount })),
        ...D.settlements.filter((x) => x.audited).map((x) => ({ date: x.date, col: x.cloud ? 'cloud' : RULE[x.method] || 'cash',  /* 云端订单的在线付款单列“云端结算” */ amount: r2(x.amount - (x.wipe || 0)) })),
        ...D.cashJournal.filter((x) => x.audited).map((x) => ({ date: x.date, col: x.kind === '一般收入' ? 'genIn' : 'genOut', amount: x.amount, out: x.kind !== '一般收入' })),
      ].filter((x) => inRange(x.date, st));
      const n = empCount();
      return rollup(docs, (x) => periodKey(x.date, st),
        (x) => ({ period: periodKey(x.date, st), income: 0, expense: 0, misc: 0, cash: 0, credit: 0, prestore: 0, scan: 0, cloud: 0, genIn: 0, genOut: 0 }),
        (r, x) => { r[x.col] = r2(r[x.col] + x.amount); if (x.out) r.expense = r2(r.expense + x.amount); else r.income = r2(r.income + x.amount); })
        .map((r) => Object.assign(r, { profit: r2(r.income - r.expense), perCap: r2((r.income - r.expense) / n), rate: pctOf(r.income - r.expense, r.income) }))
        .sort(byKeys('period'));
    },
    // 利润可能为负，图表只画收入、支出两条线（利润 = 两线之差，见数据表格）
    chart: periodChart([['income', '收入小计'], ['expense', '支出小计']]),
    after(el) {
      const p = panel({ title: '收支核算规则', note: '各类单据计入哪个栏目。规则配置在正式版的系统设置中维护；特别鸣谢：成都景印公司提供此报表设计思路。', flush: true });
      ERP.ui.table(p.body, {
        caption: '收支核算规则', compact: true, columns: [{ key: 'src', title: '单据来源' }, { key: 'cond', title: '条件' }, { key: 'col', title: '计入栏目' }],
        rows: [
          { src: '小额零收', cond: '全部', col: '小额零收' },
          ...Object.entries(RULE).map(([m, c]) => ({ src: '结算单（已审核）', cond: `结算方式 = ${m}`, col: RULE_COL[c] })),
          { src: '结算单（已审核）', cond: '云端订单的在线付款（优先于结算方式）', col: RULE_COL.cloud },
          { src: '结算单（已审核）', cond: '其他结算方式', col: '现收结算' },
          { src: '一般收支（已审核）', cond: '一般收入', col: '一般收入' }, { src: '一般收支（已审核）', cond: '一般支出', col: '一般支出（计入支出小计）' },
          { src: '—', cond: '人均收入 = 利润小计 ÷ 在职员工数', col: '利润' },
        ],
      });
      el.appendChild(p.el);
    },
  });

  /* ======================= 工单结算汇总表 ======================= */
  reportPage({
    id: 'rptOrderSettle', period: true, range: ORDER_RANGE, more: true, basis: ['无', '委托客户', '客户分组', '工单类型', '经手人员'],
    condNote: '审核时间以工单登记时间代替（原型）。生产成本为估算值（实售 × 42%）。',
    columns: (st) => [
      { title: '基础', columns: [periodCol, ...basisCol(st), nCol('count', '工单数量')] },
      { title: '金额', columns: [mCol('list', '标售金额'), mCol('sale', '实售金额'), mCol('wipe', '抹零金额'), mCol('net', '实收金额'), mCol('paid', '回款金额')] },
      { title: '结算', columns: [mCol('cash', '现金结算'), mCol('credit', '记账结算'), mCol('prestore', '扣预结算')] },
      { title: '发票', columns: [mCol('invAmt', '发票金额'), nCol('invCnt', '发票数量')] },
      { title: '统计', columns: [mCol('avg', '实收均价', { sum: avgOf('net', 'count') }), nCol('disc', '实收折扣（折）', { digits: 2, sum: discOf('net', 'list') }),
        mCol('perCap', '人均产值'), { key: 'payRate', title: '回款比例', align: 'right', sum: pctSum('paid', 'net') }] },
      { title: '成本', columns: [mCol('cost', '生产成本（估算）'), mCol('margin', '毛利金额（估算）')] },
    ],
    compute(st) {
      const sts = {};
      D.settlements.forEach((s) => s.orderNo && (sts[s.orderNo] = sts[s.orderNo] || []).push(s));
      const n = empCount();
      return rollup(ordersIn(st), (w) => periodKey(w.created, st) + '|' + orderBasis(w, st.basis),
        (w) => ({ period: periodKey(w.created, st), basis: orderBasis(w, st.basis), count: 0, list: 0, sale: 0, wipe: 0, net: 0, paid: 0, cash: 0, credit: 0, prestore: 0, invAmt: 0, invCnt: 0 }),
        (r, w) => {
          const ss = sts[w.no] || [], wipe = sum(ss, (s) => s.wipe);
          r.count++; r.list = r2(r.list + listAmount(w)); r.sale = r2(r.sale + w.amount); r.wipe = r2(r.wipe + wipe);
          r.net = r2(r.net + w.amount - wipe); r.paid = r2(r.paid + w.paid);
          ss.forEach((s) => { const k = s.method === '记账' ? 'credit' : s.method === '预存' ? 'prestore' : 'cash'; r[k] = r2(r[k] + s.amount); if (s.invoice) { r.invAmt = r2(r.invAmt + s.amount); r.invCnt++; } });
        })
        .map((r) => Object.assign(r, { avg: r2(div(r.net, r.count)), disc: r2(div(r.net, r.list) * 10), perCap: r2(r.net / n), payRate: pctOf(r.paid, r.net), cost: r2(r.sale * 0.42), margin: r2(r.sale * 0.58) }))
        .sort(byKeys('period', 'basis'));
    },
    chart: periodChart([['list', '标售金额'], ['net', '实收金额'], ['paid', '回款金额']]),
  });

  /* ======================= 经营项目汇总表 ======================= */
  reportPage({
    id: 'rptItems', period: true, range: ORDER_RANGE, more: true, items: true, basis: ['无', '客户分组', '委托客户', '工单类型', '经手人员'],
    condNote: '按工作单明细汇总；审核时间以工单登记时间代替（原型）。',
    columns: (st) => [
      { title: '基础', columns: [periodCol, ...basisCol(st), { key: 'item', title: '项目名称' }, nCol('qty', '项目数量')] },
      { title: '金额', columns: [mCol('list', '标售金额'), mCol('sale', '实售金额'), mCol('avg', '实售均价', { sum: avgOf('sale', 'qty') }), nCol('disc', '实售折扣（折）', { digits: 2, sum: discOf('sale', 'list') })] },
    ],
    compute(st) {
      const lines = ordersIn(st)
        .flatMap((w) => w.lines.map((l) => ({ w, l, item: st.imode === 'sub' ? `${l.catName} > ${l.name}` : l.catName })))
        .filter((x) => !st.q || x.item.includes(st.q) || x.l.name.includes(st.q) || x.l.code.includes(st.q));
      return rollup(lines, (x) => [periodKey(x.w.created, st), orderBasis(x.w, st.basis), x.item].join('|'),
        (x) => ({ period: periodKey(x.w.created, st), basis: orderBasis(x.w, st.basis), item: x.item, qty: 0, list: 0, sale: 0 }),
        (r, { l }) => { const q = l.qty * (l.copies || 1); r.qty += q; r.list = r2(r.list + l.listPrice * q); r.sale = r2(r.sale + l.amount); })
        .map((r) => Object.assign(r, { avg: r2(div(r.sale, r.qty)), disc: r2(div(r.sale, r.list) * 10) }))
        .sort(byKeys('period', 'basis', 'item'));
    },
    // 按项目汇总实售金额，取前 12 项（类别比较用柱图，单系列）
    chart(rows) {
      const m = rollup(rows, (r) => r.item, (r) => ({ item: r.item, sale: 0 }), (a, r) => { a.sale = r2(a.sale + r.sale); }).sort((a, b) => b.sale - a.sale).slice(0, 12);
      return { type: 'bar', unit: '元', labels: m.map((x) => x.item.slice(0, 8)), series: [{ name: '实售金额', values: m.map((x) => x.sale) }],
        note: `按项目汇总实售金额，显示前 ${m.length} 项；项目名称过长时截取前 8 个字，完整名称见“数据表格”。` };
    },
  });

  /* ======================= 客户价值分析表 ======================= */
  // 默认分析工单最多的非散户客户
  const topCustomer = () => (rollup(D.workOrders.filter((w) => w.custCode !== '000000'), (w) => w.custCode, (w) => ({ code: w.custCode, n: 0 }), (r) => r.n++).sort((a, b) => b.n - a.n)[0] || {}).code;
  ERP.page('rptCustValue', {
    module: 'rpt', title: INFO.rptCustValue.title, navTitle: INFO.rptCustValue.nav, desc: INFO.rptCustValue.banner,
    render(el, P) {
      const info = INFO.rptCustValue;
      const now = bizNow();
      const since = new Date(now.getFullYear(), now.getMonth() - 11, 1); // 12 个月以来（含本月）
      const asked = P.cust && D.customer(P.cust);
      let cust = asked || D.customer(topCustomer());
      let tab = Math.min(2, Math.max(0, +P.tab || 0));
      if (P.cust && !asked) el.appendChild(notice('warning', `找不到客户 ${P.cust}，已改为分析 ${cust.code} ${cust.name}。可以在下方重新选择。`));

      // 工时为模拟值：委托工时按明细行数估算，实际工时按生产进度折算，生产耗时 = 实际工时 × 1.3
      const hours = (w) => { const plan = w.lines.length * 1.5, act = plan * (w.flow === '完工' ? 0.9 : w.flow === '排队' ? 0 : 0.5); return { plan, act, cost: act * 1.3 }; };
      const orderRow = (init) => Object.assign({ count: 0, list: 0, disc: 0, sale: 0, wipe: 0, net: 0, avg: 0, plan: 0, act: 0, cost: 0 }, init);
      const addOrder = (r, w) => {
        const wipe = sum(D.settlements.filter((s) => s.orderNo === w.no), (s) => s.wipe), t = hours(w);
        r.count++; r.list = r2(r.list + listAmount(w)); r.sale = r2(r.sale + w.amount); r.disc = r2(r.list - r.sale); r.wipe = r2(r.wipe + wipe);
        r.net = r2(r.net + w.amount - wipe); r.avg = r2(div(r.net, r.count)); r.plan = r2(r.plan + t.plan); r.act = r2(r.act + t.act); r.cost = r2(r.cost + t.cost);
      };
      const orders = () => D.workOrders.filter((w) => w.custCode === cust.code);
      const saleCols = (title) => [{ title: '期间', columns: [{ key: 'period', title, nowrap: true }, nCol('count', '单数')] },
        { title: '金额', columns: [mCol('list', '标售'), mCol('disc', '优惠'), mCol('sale', '实售'), mCol('wipe', '抹零'), mCol('net', '实收'), mCol('avg', '均收', { sum: avgOf('net', 'count') })] },
        { title: '工时（估算）', columns: [nCol('plan', '委托工时（小时）', { digits: 1 }), nCol('act', '实际工时（小时）', { digits: 1 }), nCol('cost', '生产耗时（小时）', { digits: 1 })] }];
      const lineNote = '横轴：月份；纵轴：金额（元）。实线为实收，虚线为标售。';
      const views = [
        { title: '销售汇总（月份）', range: `${F.date(since)} 至 ${F.date(now)}（近 12 个月）`, cols: saleCols('审核月份'), rows() {
          // 列出 12 个月（无数据的月份也显示，便于图表连续）
          const ms = Array.from({ length: 12 }, (_, i) => { const d = new Date(since.getFullYear(), since.getMonth() + i, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; });
          const m = Object.fromEntries(ms.map((p) => [p, orderRow({ period: p })]));
          orders().filter((w) => w.created >= since).forEach((w) => { const p = F.date(w.created).slice(0, 7); m[p] && addOrder(m[p], w); });
          return ms.map((p) => m[p]);
        }, chart: (rows) => ({ type: 'line', unit: '元', labels: rows.map((r) => r.period), series: [{ name: '实收', values: rows.map((r) => r.net) }, { name: '标售', values: rows.map((r) => r.list) }], note: lineNote }) },
        { title: '销售汇总（年度）', range: '全部年度', cols: saleCols('审核年度'), rows: () => rollup(orders(), (w) => w.created.getFullYear(), (w) => orderRow({ period: String(w.created.getFullYear()) }), addOrder).sort(byKeys('period')),
          chart: (rows) => ({ type: 'bar', unit: '元', labels: rows.map((r) => r.period), series: [{ name: '实收', values: rows.map((r) => r.net) }, { name: '标售', values: rows.map((r) => r.list) }], note: '横轴：年度；纵轴：金额（元）。' }) },
        { title: '经营项目', range: `${F.date(since)} 至 ${F.date(now)}（近 12 个月）`, cols: [
          { title: '项目', columns: [{ key: 'cat', title: '主项名称' }, { key: 'name', title: '子项名称' }, nCol('count', '单数', { sum: (rows) => new Set(rows.flatMap((r) => [...r.orders])).size }), nCol('qty', '数量')] },
          { title: '金额', columns: [mCol('list', '标售'), mCol('disc', '优惠'), mCol('sale', '实售'), mCol('avg', '实售均价', { sum: avgOf('sale', 'qty') }), { key: 'share', title: '实售占比', align: 'right', sum: (rows) => (rows.length ? '100.0%' : '—') }] }],
        rows() {
          const os = orders().filter((w) => w.created >= since);
          const rows = rollup(os.flatMap((w) => w.lines.map((l) => ({ w, l }))), ({ l }) => l.code, ({ l }) => ({ cat: l.catName, name: l.name, orders: new Set(), qty: 0, list: 0, sale: 0 }),
            (r, { w, l }) => { const q = l.qty * (l.copies || 1); r.orders.add(w.no); r.qty += q; r.list = r2(r.list + l.listPrice * q); r.sale = r2(r.sale + l.amount); });
          const total = sum(rows, (r) => r.sale);
          return rows.map((r) => Object.assign(r, { count: r.orders.size, disc: r2(r.list - r.sale), avg: r2(div(r.sale, r.qty)), share: pctOf(r.sale, total) })).sort((a, b) => b.sale - a.sale);
        }, chart: (rows) => ({ type: 'bar', unit: '元', labels: rows.slice(0, 12).map((r) => r.name.slice(0, 8)), series: [{ name: '实售', values: rows.slice(0, 12).map((r) => r.sale) }], note: '按实售金额显示前 12 个子项；名称截取前 8 个字。' }) },
      ];

      // 查询条件：分析客户
      const custSel = select(D.customers.filter((c) => c.code !== '000000').map((c) => [c.code, `${c.code} ${c.name}（${c.groupName}）`]), { value: cust.code });
      const submit = btn('统计', null, { type: 'submit', variant: 'primary', busySlot: true });
      const form = h('form.apb-erp-toolbar', { novalidate: true, 'aria-label': '查询条件', onsubmit: (e) => { e.preventDefault(); cust = D.customer(custSel.value); run(true, submit); } },
        h('div.apb-erp-field', { style: { flex: '2 1 360px' } }, h('label', { for: custSel.id = ERP.ui.uid('f') }, '分析客户'), custSel),
        h('div.apb-erp-field', { style: { flex: '0 0 auto' } }, submit));
      const q = panel({ title: '查询条件', note: '选择客户后点“统计”。审核时间以工单登记时间代替（原型）。', flush: true });
      q.body.appendChild(form);
      el.appendChild(q.el);

      const meta = h('span');
      const status = h('p.apb-erp-muted', { role: 'status', 'aria-live': 'polite' });
      let data = [];
      const exportBtn = btn('导出 CSV', () => { const v = views[tab], cols = flat(v.cols); ERP.ui.exportCsv(`${info.title}-${cust.code}-${v.title}`, cols, data[tab].concat([totalRow(cols, data[tab])])); });
      const res = panel({ title: '统计结果', note: meta, actions: [exportBtn], flush: true });
      el.appendChild(res.el);
      const setMeta = () => {
        meta.textContent = `客户：${cust.code} ${cust.name}（${cust.groupName}） · 单位：元（工时：小时） · 时间范围：${views[tab].range} · 数据截至 ${F.stamp(new Date())}`;
      };
      const save = () => ERP.setParams(Object.assign({ cust: cust.code }, tab ? { tab } : {}));
      const tabs = ERP.ui.tabs(res.body, views.map((v) => ({ title: v.title })), { active: tab, onChange: (i) => { tab = i; save(); if (data.length) setMeta(); } });
      res.body.appendChild(h('div.apb-erp-footer', status, h('p.apb-erp-muted', '工时为原型估算值：委托工时 = 明细行数 × 1.5 小时；实际工时按生产进度折算；生产耗时 = 实际工时 × 1.3。')));

      let seq = 0;
      async function run(manual, button) {
        const my = ++seq;
        save();
        tabs.panes.forEach((p) => p.replaceChildren(ERP.ui.loading('正在统计…')));
        exportBtn.disabled = true;
        try {
          const work = ERP.api.read(() => views.map((v) => v.rows()));
          const out = await (button ? ERP.ui.busy(button, work) : work);
          if (my !== seq) return;
          data = out;
        } catch (err) {
          if (my !== seq) return;
          tabs.panes.forEach((p) => p.replaceChildren(h('div.apb-erp-empty', h('h3', '统计失败'), h('p.apb-erp-muted', `查询条件已保留，可以稍后重试。错误编号：${err.code || 'LERP-READ'}。`), btn('重试', () => run(true)))));
          return;
        }
        setMeta();
        views.forEach((v, i) => {
          const pane = tabs.panes[i], rows = data[i];
          pane.replaceChildren();
          ERP.ui.table(pane, { caption: `${info.title} — ${v.title}`, columns: nw(flat(v.cols)), groups: spans(v.cols), rows, footLabel: `合计（${rows.length} 行）`,
            empty: { title: '该客户在此期间没有工作单', text: '可以换一个客户，或查看“销售汇总（年度）”。' } });
          if (rows.some((r) => r.count)) drawChart(pane, v.chart(rows), v.chart(rows).note);
        });
        status.textContent = `${cust.name}：近 12 个月 ${sum(data[0], (r) => r.count)} 张工单，实收 ${F.money(sum(data[0], (r) => r.net))} 元。`;
        exportBtn.disabled = false;
        if (manual) toast(`已统计 ${cust.name} 的消费数据。`);
      }
      run(false);
    },
  });

  /* ======================= 客户新增汇总表 ======================= */
  const custBasis = (c, basis) => ({ 客户分组: c.groupName, 所属城市: c.city, 城市商圈: district(c) }[basis] || '');
  reportPage({
    id: 'rptCustNew', period: true, mode: 'year', range: CUST_RANGE, basis: ['无', '客户分组', '所属城市', '城市商圈'], unit: '个（客户数）',
    condNote: '以客户资料的建交时间为准（不含散户）。模拟客户建交时间分散在 2023–2026 年，默认按年报统计。',
    columns: (st) => [
      { title: '基础', columns: [periodCol, ...basisCol(st), nCol('count', '新增客户')] },
      { title: '客户类型', columns: [nCol('person', '个人客户'), nCol('org', '机构客户')] },
      { title: '业务特征', columns: [nCol('credit', '允许记账')] },
      { title: '其他信息', columns: [nCol('contact', '联络人员')] },
    ],
    compute: (st) => rollup(D.customers.filter((c) => c.code !== '000000' && inRange(c.created, st)),
      (c) => periodKey(c.created, st) + '|' + custBasis(c, st.basis),
      (c) => ({ period: periodKey(c.created, st), basis: custBasis(c, st.basis), count: 0, person: 0, org: 0, credit: 0, contact: 0 }),
      (r, c) => { r.count++; c.type === '个人' ? r.person++ : r.org++; if (c.settleType !== '现结') r.credit++; if (c.contact) r.contact++; })
      .sort(byKeys('period', 'basis')),
    chart: periodChart([['count', '新增客户'], ['person', '个人客户'], ['org', '机构客户']], '个'),
  });

  /* ======================= 会员办卡汇总表 ======================= */
  const cardBasis = (k, basis) => { const c = D.customer(k.custCode) || {}; return { 发卡员工: k.issuer, 所属城市: c.city, 城市商圈: district(c) }[basis] || ''; };
  reportPage({
    id: 'rptCardSummary', period: true, mode: 'year', range: CUST_RANGE, basis: ['无', '发卡员工', '所属城市', '城市商圈'], unit: '张（卡片数）',
    condNote: '以会员卡发行时间为准。模拟数据的发卡时间分散在 2023–2026 年，默认按年报统计。',
    columns: (st) => [
      { title: '基础', columns: [periodCol, ...basisCol(st), { key: 'group', title: '卡片分组' }] },
      { title: '汇总', columns: [nCol('count', '卡片数量')] },
    ],
    compute: (st) => rollup(D.cards.filter((k) => inRange(k.issueDate, st)),
      (k) => [periodKey(k.issueDate, st), cardBasis(k, st.basis), k.group].join('|'),
      (k) => ({ period: periodKey(k.issueDate, st), basis: cardBasis(k, st.basis), group: k.group, count: 0 }),
      (r) => r.count++).sort(byKeys('period', 'basis', 'group')),
    chart: periodChart([['count', '卡片数量']], '张'),
  });

  /* ======================= 客户排行（实收 / 均价 / 数量） ======================= */
  const custCols = [{ key: 'code', title: '客户编号', type: 'mono', nowrap: true }, { key: 'name', title: '客户名称' }, { key: 'type', title: '客户类型', nowrap: true }, { key: 'groupName', title: '客户分组' }];
  /* 按客户汇总期间内工单：{客户资料, count, net, list} */
  function rankRows(st) {
    const a = ERP.parseDate(st.jf), b = ERP.parseDate(st.jt, true);
    return rollup(ordersIn(st).filter((w) => {
      const c = D.customer(w.custCode);
      return c && (st.retail || c.code !== '000000') && st.groups.has(c.group) && (!a || c.created >= a) && (!b || c.created <= b);
    }), (w) => w.custCode, (w) => {
      const c = D.customer(w.custCode);
      return { code: c.code, name: c.name, type: c.type, groupName: c.groupName, created: c.created, value: c.value, phone: c.phone || '未提供', count: 0, net: 0, list: 0 };
    }, (r, w) => { r.count++; r.net = r2(r.net + w.amount); r.list = r2(r.list + listAmount(w)); });
  }
  const rankChart = (key, name, unit) => (rows) => {
    const top = rows.slice(0, 15);
    return { type: 'bar', unit, labels: top.map((r) => r.name.slice(0, 6)), series: [{ name, values: top.map((r) => r[key]) }],
      note: `按排行顺序显示前 ${top.length} 名；客户名称截取前 6 个字，完整名称见“数据表格”。` };
  };
  const rankActions = (r) => (r.code === '000000' ? [h('span.apb-erp-muted', '散户')] : [link('客户资料', 'customerDetail', { code: r.code }, { ariaLabel: `查看客户 ${r.name} 资料` })]);
  const rankDef = (id, extra) => reportPage(Object.assign({
    id, range: ORDER_RANGE, rank: true, rowActions: rankActions,
    condNote: '按下单客户汇总期间内的工作单；审核时间以工单登记时间代替（原型）。建交日期不填表示不限。',
  }, extra));

  rankDef('rptCustRevenueRank', {
    columns: () => [
      { title: '基础', columns: custCols },
      { title: '排行', columns: [mCol('net', '工单实收'), mCol('list', '工单标售'), { key: 'disc', title: '优惠比例', align: 'right', sum: (rows) => pctOf(tot('list')(rows) - tot('net')(rows), tot('list')(rows)) }] },
      { title: '其他', columns: [{ key: 'created', title: '建交日期', type: 'date', nowrap: true }, { key: 'value', title: '价值', nowrap: true }, { key: 'phone', title: '电话', type: 'mono', nowrap: true }] },
    ],
    compute: (st) => rankRows(st).map((r) => Object.assign(r, { disc: pctOf(r.list - r.net, r.list) })).sort((a, b) => b.net - a.net).slice(0, +st.limit),
    chart: rankChart('net', '工单实收', '元'),
  });
  rankDef('rptCustAvgRank', {
    columns: () => [
      { title: '基础', columns: custCols },
      { title: '排行', columns: [mCol('avg', '实收均价', { sum: avgOf('net', 'count') }), mCol('net', '实收总价'), nCol('count', '工单数量')] },
      { title: '其他', columns: [{ key: 'value', title: '价值', nowrap: true }, { key: 'phone', title: '电话', type: 'mono', nowrap: true }] },
    ],
    compute: (st) => rankRows(st).map((r) => Object.assign(r, { avg: r2(div(r.net, r.count)) })).sort((a, b) => b.avg - a.avg).slice(0, +st.limit),
    chart: rankChart('avg', '实收均价', '元'),
  });
  rankDef('rptCustCountRank', {
    unit: '单（工单数量）；金额：元',
    columns: () => [
      { title: '基础', columns: custCols },
      { title: '排行', columns: [nCol('count', '工单数量'), mCol('net', '工单实收')] },
      { title: '其他', columns: [{ key: 'value', title: '价值', nowrap: true }, { key: 'phone', title: '电话', type: 'mono', nowrap: true }] },
    ],
    compute: (st) => rankRows(st).sort((a, b) => b.count - a.count || b.net - a.net).slice(0, +st.limit),
    chart: rankChart('count', '工单数量', '单'),
  });

})();
