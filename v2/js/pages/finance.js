/* 财务：财务业务中心、智多结算中心、现金/银行余额、转账（表单页 + 记录）、客户结余 / 对账 / 应收汇总、
 * 销账（表单页 + 记录）、一般收入 / 支出（表单页）+ 收支记录、期末结账、会计日历。
 * 字段与计算沿用旧版 archive/v1-ribbon-20261019/web/js/pages/finance.js；界面按 v2 约定：
 * 工具栏筛选、分页台账、“操作”列、表单页、短对话框；金额类写入先确认。
 * 资金科目余额维护在 ERP.data.accounts[].balance（另加 opening / inc / dec 记录本期增减）；
 * 客户记账欠款 = customers[].debt，与本文件生成的记账单（D.arBills）未销金额一致。
 * 本文件补充的数据：D.arBills（记账单）、D.writeOffs（销账单）、D.transfers（转账单）。
 * 所有写入只改内存（演示），页面上明确标注；不生成记账凭证。 */
(function () {
  'use strict';
  const { h, btn, link, linkBtn, badge, notice, kv, panel, field, input, money, dateInput, textarea, select, dialog, confirm, toast } = ERP.ui;
  const D = ERP.data, F = ERP.fmt, r2 = D.util.r2;
  const biz = (ERP.biz = ERP.biz || {});

  /* ---------- 本文件的模拟数据（独立种子，不影响 data.js 的随机序列） ---------- */
  let seed = 7310;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const pad = (n) => String(n).padStart(2, '0');
  const now = new Date();
  const daysAgo = (n, hh = 10) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - n, hh, Math.floor(rnd() * 60));
  const ymdNo = (d) => `${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  /* 单号：前缀 + 年月日 + 门店(1) + 4 位流水，如 ZZ26101910001 */
  const nextNo = (prefix, list) => {
    return biz.nextSerial(list, prefix + ymdNo(new Date()) + '1', 4);
  };
  const sum = (list, fn) => r2(list.reduce((s, x) => s + (Number(fn(x)) || 0), 0));
  const num = (v) => r2(Number(String(v ?? '').replace(/,/g, '')) || 0);
  const yuan = (v) => `${F.money(v)} 元`;
  const lastOf = (list, key) => list.reduce((m, x) => (x[key] && (!m || x[key] > m) ? x[key] : m), null);
  const empCode = (name) => (D.employees.find((e) => e.name === name) || {}).code || '未知';
  // 表单里的 YYYY-MM-DD 业务日期 + 当前时刻
  const withNow = (ymd) => { const t = new Date(); return new Date(`${ymd}T${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}`); };
  const PAY = ['现钞', '微信', '支付宝', '刷卡', '转账'];

  /* 资金科目：现金（前台钱箱）+ 银行存款下的各子科目 */
  const accts = () => D.accounts.filter((a) => a.balance != null);
  const acctShort = (a) => (a.type === '现金' ? '前台钱箱' : a.name);
  const acctLabel = (a) => (a ? (a.type === '现金' ? '现金>' : '银行存款>') + acctShort(a) : '');
  const acctBy = (s) => D.accounts.find((a) => a.balance != null && (a.code === s || a.name === s || acctLabel(a) === s));
  const acctOptions = () => accts().map((a) => [a.code, `${acctLabel(a)}（余额 ${F.money(a.balance)} 元）`]);
  // 本期增减：按旧系统截图预置减少额，增加额 = 余额 + 减少额（期初为 0，演示值）
  const preDec = { 1001: 28456, 1002002: 11255 };
  accts().forEach((a) => { if (a.opening == null) { a.opening = 0; a.dec = preDec[a.code] || 0; a.inc = r2(a.balance + a.dec); } });
  /* 记入资金科目：金额正数入账、负数出账；unpost 原样冲回（删除单据时用） */
  function post(a, amt) {
    if (!a || !amt) return;
    a.balance = r2(a.balance + amt);
    if (amt > 0) a.inc = r2(a.inc + amt); else a.dec = r2(a.dec - amt);
  }
  function unpost(a, amt) {
    if (!a || !amt) return;
    a.balance = r2(a.balance - amt);
    if (amt > 0) a.inc = r2(a.inc - amt); else a.dec = r2(a.dec + amt);
  }
  // 支付方式 → 默认资金科目
  const methodAcct = (m) => acctBy({ 现金: '1001', 现钞: '1001', 微信: '1002031', 在线付款码: '1002031', 支付宝: '1002030', 刷卡: '1002002', 转账: '1002002' }[m] || '');

  /* 记账单（应收）：每个有欠款的客户 1~3 张，未销金额合计 = customers.debt */
  const AR = (D.arBills = D.arBills || []);
  if (!AR.length) {
    D.customers.filter((c) => c.debt > 0).forEach((c) => {
      const n = 1 + Math.floor(rnd() * 3);
      let left = c.debt;
      for (let i = 0; i < n; i++) {
        const part = i === n - 1 ? r2(left) : r2(left * (0.3 + rnd() * 0.4));
        left = r2(left - part);
        const cleared = rnd() > 0.7 ? r2(rnd() * 200) : 0;
        const date = new Date(2026, Math.floor(rnd() * 9), 1 + Math.floor(rnd() * 27), 9 + Math.floor(rnd() * 8));
        AR.push({ no: 'JZ' + ymdNo(date) + '1' + String(1 + Math.floor(rnd() * 99)).padStart(4, '0'), date, custCode: c.code, custName: c.name,
          orderNo: 'GD' + ymdNo(date) + '1' + String(1 + Math.floor(rnd() * 99)).padStart(4, '0'), task: pick(D.tasks.filter(Boolean)),
          amount: r2(part + cleared), cleared, handler: pick(['管理员', '前台', '总管']), method: '记账' });
      }
    });
    AR.sort((a, b) => a.date - b.date);
  }
  const arOpen = (x) => r2(x.amount - x.cleared);

  /* 销账单（取自旧系统截图）；北京亚德鲁公司 JS26052810001 未审核，对应 customers.writeOffPending = 123.12 */
  const custByName = (n) => D.customers.find((c) => c.name === n) || { code: '', name: n };
  const BANK = '银行存款>一般账户（XX银行）', CASH = '现金>前台钱箱';
  D.writeOffs = D.writeOffs || [
    ['JS26092210001', '2026-09-22', '北京印特印科技公司', 2213.4, 0, BANK, '4146465'], ['JS26081410006', '2026-08-14', '旭东洗浴', 8, 8],
    ['JS26081410005', '2026-08-14', '商务局', 5247.7, 5247.7], ['JS26081310004', '2026-08-13', '旭东洗浴', 3, 3],
    ['JS26081310003', '2026-08-13', '旭东洗浴', 372, 0, CASH, ''], ['JS26081310002', '2026-08-13', '旭东洗浴', 6, 6],
    ['JS26081310001', '2026-08-13', '旭东洗浴', 30, 30], ['JS26071810002', '2026-07-18', '宁波告诉集团', 1288.2, 0.2, BANK, '7897979'],
    ['JS26071010001', '2026-07-10', '李莹', 229, 229], ['JS26053010002', '2026-05-30', '临时', 12, 0, BANK, '1233'],
    ['JS26052810001', '2026-05-28', '北京亚德鲁公司', 123.12, 0.12, CASH, '432432'], ['JS26022810004', '2026-02-28', '天津工业大学', 2332.7, 32.7, BANK, '465464'],
    ['JS26022610003', '2026-02-26', '格式广告', 1710, 0, BANK, '15121212520'], ['JS26022510002', '2026-02-25', '文雅', 1142.02, 642.02, CASH, ''],
    ['JS26022510001', '2026-02-25', '文雅', 1000, 0, BANK, '4654646'], ['JS26012110001', '2026-01-21', '合肥建鑫图文有限公司', 2000, 0, CASH, '2323323'],
  ].map(([no, d, name, amount, wipe, account, bill]) => {
    const c = custByName(name), real = r2(amount - wipe), date = new Date(d + 'T10:00');
    const pending = no === 'JS26052810001';
    return { no, date, custCode: c.code, custName: name, custHandler: '', amount, wipe, real, cash: real, account: real ? account : '', method: real ? '现钞' : '',
      fee: 0, prestore: 0, invoice: !!bill, billInfo: bill || '', handler: '小管', audited: !pending, auditTime: pending ? null : new Date(+date + 36e5), remark: '', allocs: [] };
  });

  /* 转账单 */
  D.transfers = D.transfers || [
    [40, '1002031', '1002002', 20000, '微信提现至基本户'], [25, '1001', '1002010', 5000, '营业款存现'],
    [12, '1002030', '1002002', 3000, '支付宝提现'], [3, '1002002', '1001', 2000, '备用金'],
  ].map(([ago, f, t, amount, remark], i) => {
    const date = daysAgo(ago);
    return { no: 'ZZ' + ymdNo(date) + '1' + String(i + 1).padStart(4, '0'), date, from: acctLabel(acctBy(f)), to: acctLabel(acctBy(t)), amount,
      method: f === '1001' || t === '1001' ? '现钞' : '转账', fee: 0, invoice: false, billInfo: '', handler: '管理员', audited: i > 0, auditTime: i > 0 ? new Date(+date + 72e5) : null, remark };
  });

  /* 一般收支补充字段 */
  D.cashJournal.forEach((j) => { j.method = j.method || (j.account === '现金' ? '现钞' : '转账'); j.cust = j.cust || ''; j.billInfo = j.billInfo || ''; j.invoice = !!j.invoice; });

  /* ---------- 共用：状态、报表口径、确认与行操作 ---------- */
  const card = (code) => D.cards.find((k) => k.custCode === code);
  const pendingOf = (code) => D.writeOffs.filter((w) => w.custCode === code && !w.audited);
  // 财务单据未审核会阻止期末结账，用 warning（待处理）
  const auditBadge = (r) => badge(r.audited ? '已审核' : '未审核', r.audited ? 'success' : 'warning');
  const setAudit = (r) => { r.audited = !r.audited; r.auditTime = r.audited ? new Date() : null; };
  // 当前地址参数（list 在 onDraw 之前已把筛选写入地址）
  const hashParams = () => ERP.params();
  const rangeOf = (p, key, preset) => { const pr = p[key + 'P'] || preset; return pr === 'custom' ? [p[key + 'From'] || '', p[key + 'To'] || ''] : ERP.ui.presetRange(pr); };
  const rangeText = ([a, b]) => (!a && !b ? '全部日期' : `${a || '最早'} 至 ${b || '至今'}`);
  const reportNote = (range) => `单位：元 · 时间范围：${rangeText(range)} · 数据截至 ${F.stamp(new Date())}`;
  const demoNotice = (what) => notice('info', `演示原型：${what}只写入本页内存数据，刷新页面即恢复；不生成记账凭证。正式版以财务服务的回执为准。`);
  const acctFilter = (key, label, prop = key) => ({ key, type: 'select', label, options: accts().map(acctLabel), match: (r, v) => r[prop] === v });
  const auditFilter = () => ({ key: 'audit', type: 'select', label: '审核', options: [['y', '已审核'], ['n', '未审核']], match: (r, v) => (v === 'y') === !!r.audited });
  const empOptions = () => D.employees.filter((e) => !e.left).map((e) => e.name);
  // 表单 onSubmit 在用户取消确认时返回提示文字；core 会把表单标为“已保存”，这里补回未保存状态以保留离开保护
  // 网格子项默认 min-width:auto，内含宽表时会撑破页面；宽表容器需允许收缩（横向滚动留在表格内）
  const shrink = (node) => { node.style.minWidth = '0'; return node; };
  const keepDirty = (form) => setTimeout(() => form.dispatchEvent(new Event('change')), 0);

  /* 审核 / 反审核（行操作）：确认 → 写入 → 刷新 */
  const auditLink = (r, what, done, toggle = setAudit) => linkBtn(r.audited ? '反审核' : '审核', async () => {
    const ok = await confirm(r.audited ? `反审核${what} ${r.no}？` : `审核${what} ${r.no}？`, { okLabel: r.audited ? '反审核' : '审核',
      detail: r.audited ? '反审核后可以删除；期末结账前需要重新审核。' : '审核后不能删除；期末结账要求本期单据全部审核。' });
    if (!ok) return;
    await ERP.api.write(() => toggle(r));
    toast(`${what} ${r.no} ${r.audited ? '已审核' : '已反审核'}。`);
    done();
  }, { ariaLabel: `${r.audited ? '反审核' : '审核'}${what} ${r.no}` });
  /* 删除（只限未审核）：确认 → 冲回金额 → 刷新 */
  const deleteLink = (r, what, remove, done) => (r.audited ? null : linkBtn('删除', async () => {
    if (!(await confirm(`删除${what} ${r.no}？`, { okLabel: '删除', danger: true, detail: '删除后不能恢复；相关科目余额、客户欠款按原金额冲回（演示：只改内存数据）。' }))) return;
    await ERP.api.write(() => remove(r));
    toast(`${what} ${r.no} 已删除，相关金额已冲回。`);
    done();
  }, { variant: 'danger', ariaLabel: `删除${what} ${r.no}` }));

  /* ====================================================================
   * 财务业务中心：按 支付方式 / 现金 / 应收 / 预存 四栏汇总增（+）减（−）
   * ==================================================================== */
  // 全部财务单据，cols 记录该单据对四栏的影响方向 {支付方式:±1, …}
  function finEntries() {
    const E = [];
    const add = (o) => E.push(Object.assign({ custCode: '', custName: '', method: '', account: '', handler: '管理员', remark: '' }, o));
    D.settlements.forEach((s) => {
      // 记账结算由同时生成的记账单计入应收，结算单本身不再重复计入
      const cols = s.method === '记账' ? {} : s.method === '预存' ? { 预存: -1 } : { 支付方式: 1, 现金: 1 };
      add({ type: '结算单', no: s.no, date: s.date, custCode: s.custCode, custName: s.custName, method: s.method, account: acctLabel(methodAcct(s.method)), amount: s.amount, handler: s.handler, audited: s.audited, orderNo: s.orderNo, remark: s.remark, cols });
    });
    AR.forEach((x) => add({ type: '记账单', no: x.no, date: x.date, custCode: x.custCode, custName: x.custName, method: '记账', amount: x.amount, handler: x.handler, audited: true, cols: { 应收: 1 } }));
    // 预存：实收计入支付方式/现金；赠送只增加预存余额，不算收款
    D.prestores.forEach((p) => {
      const real = p.real != null ? p.real : p.amount, gift = r2(p.amount - real);
      add({ type: '预存单', no: p.no, date: p.date, custCode: p.custCode, custName: p.custName, method: p.method, account: acctLabel(methodAcct(p.method)), amount: real, handler: p.handler, audited: p.audited, cols: { 支付方式: 1, 现金: 1, 预存: 1 } });
      if (gift > 0) add({ type: '预存赠送', no: p.no, date: p.date, custCode: p.custCode, custName: p.custName, method: '赠送', amount: gift, handler: p.handler, audited: p.audited, cols: { 预存: 1 } });
    });
    D.writeOffs.forEach((w) => {
      add({ type: '销账单', no: w.no, date: w.date, custCode: w.custCode, custName: w.custName, method: w.method, account: w.account, amount: w.amount, handler: w.handler, audited: w.audited, remark: w.remark, cols: { 应收: -1 } });
      if (w.cash) add({ type: '销账收款', no: w.no, date: w.date, custCode: w.custCode, custName: w.custName, method: w.method, account: w.account, amount: w.cash, handler: w.handler, audited: w.audited, remark: w.remark, cols: { 支付方式: 1, 现金: 1 } });
    });
    D.cashJournal.forEach((j) => {
      const s = j.kind === '一般收入' ? 1 : -1;
      add({ type: j.kind, no: j.no, date: j.date, custName: j.cust, method: j.method, account: acctLabel(acctBy(j.account)), amount: j.amount, handler: j.handler, audited: j.audited, remark: [j.type, j.remark].filter(Boolean).join(' · '), cols: { 支付方式: s, 现金: s } });
    });
    D.transfers.forEach((t) => {
      add({ type: '转出', no: t.no, date: t.date, method: t.method, account: t.from, amount: r2(t.amount + t.fee), handler: t.handler, audited: t.audited, remark: t.remark, cols: { 现金: -1 } });
      add({ type: '转入', no: t.no, date: t.date, method: t.method, account: t.to, amount: t.amount, handler: t.handler, audited: t.audited, remark: t.remark, cols: { 现金: 1 } });
    });
    return E;
  }
  const SUM_COLS = ['支付方式', '现金', '应收', '预存'];
  const entryKey = (e, col) => (col === '支付方式' ? e.method || '其他' : e.type);
  const pickVal = (col, s, key) => `${col}|${s}|${key}`;
  const pickLabel = (v) => { const [col, s, key] = v.split('|'); return `${col} ${+s > 0 ? '+' : '−'} ${key}`; };
  const pickMatch = (e, v) => { const [col, s, key] = v.split('|'); return e.cols[col] === +s && entryKey(e, col) === key; };
  // 明细行 → 来源单据所在页面
  const entryLink = (e) => {
    const al = { ariaLabel: `查看 ${e.type} ${e.no} 的来源` };
    if (e.type === '结算单' && e.orderNo && biz.order && biz.order(e.orderNo)) return link('工单', 'orderDetail', { no: e.orderNo }, al);
    if (e.type === '销账单' || e.type === '销账收款') return link('销账记录', 'writeOffRecords', { q: e.no }, al);
    if (e.type === '一般收入' || e.type === '一般支出') return link('收支记录', 'generalRecords', { q: e.no }, al);
    if (e.type === '转出' || e.type === '转入') return link('转账记录', 'transferRecords', { q: e.no }, al);
    return e.custCode && e.custCode !== '000000' ? link('对账', 'custStatement', { cust: e.custCode }, { ariaLabel: `客户对账：${e.custName}` }) : null;
  };

  ERP.page('finCenter', {
    module: 'fin', title: '财务业务中心', desc: '按支付方式、现金、应收、预存四栏汇总财务单据的增减；点汇总项可只看对应明细。',
    render(el, params, ctx) {
      ctx.setActions([
        link('新建转账', 'transfer', null, { button: true }), link('一般收入', 'generalIncome', null, { button: true }),
        link('一般支出', 'generalExpense', null, { button: true }), link('新建销账', 'writeOff', null, { button: true }),
      ]);
      const all = finEntries();
      const noteEl = h('span');
      const sp = panel({ title: '收支汇总', note: noteEl });
      const cols = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--apb-erp-space-4)' } });
      sp.body.appendChild(cols);
      el.appendChild(sp.el);
      let base = [], pickSel = null;
      const setPick = (v) => { if (pickSel) { pickSel.value = v; pickSel.dispatchEvent(new Event('change')); } };
      const drawSummary = (rows) => {
        const p = hashParams(), cur = p.pick || '';
        noteEl.textContent = `${reportNote(rangeOf(p, 'date', 'month'))} · 按单据业务日期统计，含未审核单据（可在下方“审核”筛选）。`;
        cols.replaceChildren(...SUM_COLS.map((col) => {
          const lines = {};
          rows.filter((e) => e.cols[col]).forEach((e) => {
            const s = e.cols[col], key = entryKey(e, col), v = pickVal(col, s, key);
            const L = (lines[v] = lines[v] || { v, sign: s, key, n: 0, amt: 0 });
            L.n++; L.amt = r2(L.amt + e.amount);
          });
          const box = h('div', h('h3', col));
          ERP.ui.table(box, {
            caption: `${col}汇总`, compact: true, footLabel: '净额', rows: Object.values(lines).sort((a, b) => b.sign - a.sign || b.amt - a.amt),
            columns: [
              { key: 'key', title: '项目', render: (L) => h('span', `${L.sign > 0 ? '+' : '−'} `, L.v === cur
                ? [h('strong', L.key), ' ', badge('已筛选', 'info'), ' ', linkBtn('取消', () => setPick(''), { ariaLabel: '取消汇总项筛选' })]
                : linkBtn(L.key, () => setPick(L.v), { ariaLabel: `只看${col}${L.sign > 0 ? '增加' : '减少'}：${L.key}` })) },
              { key: 'n', title: '单数', type: 'num' },
              { key: 'amt', title: '金额（元）', type: 'money', render: (L) => F.money(L.sign * L.amt), sum: (rs) => sum(rs, (L) => L.sign * L.amt) },
            ],
            empty: { title: '无单据', text: '当前条件下没有影响此栏的单据。' },
          });
          return box;
        }));
      };
      const pickOptions = [...new Set(all.flatMap((e) => SUM_COLS.filter((c) => e.cols[c]).map((c) => pickVal(c, e.cols[c], entryKey(e, c)))))]
        .sort((a, b) => SUM_COLS.indexOf(a.split('|')[0]) - SUM_COLS.indexOf(b.split('|')[0]) || b.split('|')[1] - a.split('|')[1]).map((v) => [v, pickLabel(v)]);
      const list = ERP.ui.list(el, {
        title: '单据明细', note: '一张转账单拆为“转出”“转入”两行（转出含手续费）；销账单的现金实结另列为“销账收款”。', params,
        load: () => all,
        sort: (a, b) => b.date - a.date,
        filters: [
          { key: 'q', type: 'search', label: '搜索', placeholder: '单据编号 / 客户 / 备注', keys: ['no', 'custName', 'remark'] },
          acctFilter('acct', '资金科目', 'account'),
          { key: 'method', type: 'select', label: '支付方式', options: [...new Set(['现钞', ...D.payMethods])] },
          auditFilter(),
          { key: 'date', type: 'daterange', label: '业务日期', field: 'date', preset: 'month' },
          // 汇总项必须放最后：list 按顺序短路求值，走到这里的行已通过其他全部条件——借此收集“汇总用”的行（不受汇总项本身影响）
          { key: 'pick', type: 'select', label: '汇总项', options: pickOptions, match: (e, v) => { base.push(e); return pickMatch(e, v); } },
        ],
        columns: [
          { key: 'type', title: '单据类型', width: 110, render: (e) => e.type, sub: (e) => Object.entries(e.cols).map(([c, s]) => `${c}${s > 0 ? '+' : '−'}`).join(' · ') },
          { key: 'no', title: '单据编号', type: 'mono', nowrap: true },
          { key: 'date', title: '业务时间', type: 'time', nowrap: true },
          { key: 'custName', title: '客户', width: 180, render: (e) => e.custName || '—' },
          { key: 'method', title: '支付方式', render: (e) => e.method || '—' },
          { key: 'account', title: '资金科目', width: 180, render: (e) => e.account || '—' },
          { key: 'amount', title: '金额（元）', type: 'money' },
          { key: 'handler', title: '经手', nowrap: true },
          { key: 'audited', title: '审核', render: auditBadge },
          { key: 'remark', title: '说明备注', render: (e) => e.remark || '—' },
        ],
        rowActions: (e) => [entryLink(e)],
        onDraw: (rows) => { drawSummary(base.length ? base : rows); base = []; },
        emptyTitle: '尚无财务单据', emptyText: '收款、销账、转账、一般收支登记后会显示在这里。',
      });
      pickSel = [...list.el.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value.includes('|')));
    },
  });

  /* ====================================================================
   * 智多结算中心：未结工单，勾选当前页后批量收款 / 转记账
   * ==================================================================== */
  /* 工单结算（全部收款入口共用：前台收款对话框、智多结算批量收款/转记账）
   * mode：'收款'（记入资金科目 a）| '记账'（生成记账单、增加客户欠款）| '预存扣款'（扣会员卡余额）
   * 结算单记录 acctCode / arNo / cardNo，删除时由 reverseSettlement 原样冲回。返回结算单。 */
  function settleAmount(w, v, { mode = '收款', a, method, remark = '', invoice = false } = {}) {
    v = r2(v);
    if (!(v > 0) || v > r2(w.amount - w.paid)) throw new Error(`收款金额需大于 0 且不超过未结金额 ${F.money(w.amount - w.paid)} 元`);
    const c = D.customer(w.custCode);
    const k = mode === '预存扣款' ? card(w.custCode) : null;
    if (mode === '预存扣款' && (!k || k.balance < v)) throw new Error(k ? `会员卡 ${k.cardNo} 余额 ${F.money(k.balance)} 元不足` : '该客户没有会员卡，不能预存扣款');
    if (mode === '收款' && !a) throw new Error('请选择入账科目');
    const pm = mode === '记账' ? '记账' : mode === '预存扣款' ? '预存' : method === '现钞' ? '现金' : method;
    const st = { no: nextNo('JS', D.settlements.concat(D.writeOffs)), date: new Date(), custCode: w.custCode, custName: w.custName, handler: D.currentUser.name,
      method: pm, amount: v, discount: 0, wipe: 0, orderNo: w.no, audited: true, invoice, remark };
    if (mode === '记账') {
      c.debt = r2((c.debt || 0) + v);
      const bill = { no: nextNo('JZ', AR), date: new Date(), custCode: w.custCode, custName: w.custName, orderNo: w.no, task: w.task, amount: v, cleared: 0, handler: D.currentUser.name, method: '记账' };
      AR.push(bill); st.arNo = bill.no;
    } else if (mode === '预存扣款') {
      k.balance = r2(k.balance - v); k.totalOut = r2(k.totalOut + v); c.prestoreBalance = k.balance; st.cardNo = k.cardNo;
    } else { post(a, v); st.acctCode = a.code; }
    w.paid = r2(w.paid + v); w.updated = new Date();
    biz.recalcOrder(w);
    D.settlements.unshift(st);
    return st;
  }
  // 冲回结算单的全部影响（工单已结、记账单与欠款、会员卡、资金科目）。已部分销账的记账单不能冲回。
  function reverseSettlement(st) {
    if (st.arNo) {
      const bill = AR.find((x) => x.no === st.arNo);
      if (bill && bill.cleared > 0) throw new Error(`记账单 ${bill.no} 已销账 ${F.money(bill.cleared)} 元，请先删除相关销账单`);
      if (bill) AR.splice(AR.indexOf(bill), 1);
      const c = D.customer(st.custCode); if (c) c.debt = r2((c.debt || 0) - st.amount);
    }
    if (st.cardNo) {
      const k = D.cards.find((x) => x.cardNo === st.cardNo);
      if (k) { k.balance = r2(k.balance + st.amount); k.totalOut = r2(k.totalOut - st.amount); const c = D.customer(k.custCode); if (c) c.prestoreBalance = k.balance; }
    }
    if (st.acctCode) unpost(acctBy(st.acctCode), st.amount);
    const w = biz.order(st.orderNo);
    if (w) { w.paid = r2(w.paid - st.amount); w.updated = new Date(); biz.recalcOrder(w); }
    D.settlements.splice(D.settlements.indexOf(st), 1);
  }
  // 智多结算：按未结金额全额结算
  const settleOne = (w, mode, a, method, remark) => settleAmount(w, w.unpaid, { mode: mode === '记账' ? '记账' : mode === '预存扣款' ? '预存扣款' : '收款', a, method, remark });

  /* 批量收款（对话框）：现金收款 / 扫码收款 / 预存扣款；对话框本身列出金额并以“确认收款”提交 */
  function batchCollect(list, done) {
    const total = sum(list, (w) => w.unpaid), custs = [...new Set(list.map((w) => w.custCode))];
    let mode = '现金收款', form;
    const acct = select(acctOptions(), { name: 'account', value: '1001' });
    const method = select(PAY, { name: 'method' });
    method.addEventListener('change', () => { const a = methodAcct(method.value); if (a) acct.value = a.code; });
    const fAcct = field({ label: '入账科目', control: acct }), fMethod = field({ label: '支付方式', control: method });
    const need = (code) => sum(list.filter((w) => w.custCode === code), (w) => w.unpaid);
    const cardBox = h('div.lerp-spanall', kv(custs.map((code) => {
      const c = D.customer(code), k = card(code), n = need(code);
      return [`${code} ${c.name}`, k ? h('span', `卡号 ${k.cardNo} · 预存余额 ${yuan(k.balance)} · 本次扣 ${yuan(n)} `, k.balance < n ? badge('余额不足', 'danger') : badge('足额', 'success')) : badge('无预存卡', 'danger')];
    })));
    const sync = () => {
      const pre = mode === '预存扣款';
      fAcct.hidden = fMethod.hidden = pre; cardBox.hidden = !pre;
      if (mode === '扫码收款') { method.value = '微信'; method.dispatchEvent(new Event('change')); }
    };
    const dlg = dialog({
      title: '批量收款', kicker: `智多结算 · 已选 ${list.length} 张工单（仅当前页）`, wide: true,
      body: (b) => {
        b.appendChild(kv([['客户数', String(custs.length)], ['工单数', String(list.length)], ['此次结算（元）', h('strong.lerp-big.apb-erp-mono', F.money(total))], ['结算后状态', '所选工单全部“完成结算”']]));
        b.appendChild(demoNotice('确认收款后，工单已结金额、结算单与资金科目余额'));
        form = ERP.ui.form({
          submitLabel: `确认收款 ${F.money(total)} 元`,
          sections: [{ fields: [
            h('fieldset.lerp-fieldset.lerp-spanall', h('legend', '结算方式'),
              ERP.ui.radios('batch-mode', ['现金收款', '扫码收款', '预存扣款'], mode, (v) => { mode = v; sync(); })),
            fAcct, fMethod, cardBox,
            field({ label: '说明备注', control: input({ name: 'remark', maxlength: 200 }), span: 'all' }),
          ] }],
          moreActions: btn('取消', () => dlg.close()),
          onSubmit: (v) => {
            if (mode === '预存扣款') {
              const bad = custs.filter((code) => !card(code) || card(code).balance < need(code));
              if (bad.length) return Promise.reject(new Error(`${bad.map((c) => D.customer(c).name).join('、')} 无预存卡或预存余额不足，请改用现金收款，或取消勾选这些客户的工单`));
            }
            return ERP.api.write(() => {
              const a = acctBy(v.account);
              list.forEach((w) => settleOne(w, mode, a, v.method, v.remark));
              dlg.close();
              toast(`已结算 ${list.length} 张工单，合计 ${yuan(total)}（${mode}${mode === '预存扣款' ? '' : ' → ' + acctLabel(a)}）。`);
              done();
            });
          },
        });
        b.appendChild(form);
        sync();
      },
    });
  }
  /* 转记账：确认后所选工单转为客户应收 */
  async function toCredit(list, done) {
    const total = sum(list, (w) => w.unpaid), custs = new Set(list.map((w) => w.custCode));
    const ok = await confirm(`将所选 ${list.length} 张工单（${custs.size} 个客户）未结 ${yuan(total)} 转为客户记账？`, {
      title: '确认转记账', okLabel: '转记账',
      detail: '转记账后工单视为“完成结算”，金额计入各客户的“记账未销”，以后通过“新建销账”收回。演示：只修改本页内存数据。' });
    if (!ok) return;
    await ERP.api.write(() => list.forEach((w) => settleOne(w, '记账')));
    toast(`已转记账 ${list.length} 张工单，合计 ${yuan(total)}。`);
    done();
  }

  ERP.page('smartSettle', {
    module: 'fin', title: '智多结算中心', desc: '尚未结清的工作单。勾选当前页工单后批量收款或转记账；单张收款点行内“收款”。',
    render(el, params) {
      const custs = {};
      D.workOrders.filter((w) => w.unpaid > 0).forEach((w) => { const c = (custs[w.custCode] = custs[w.custCode] || { n: 0, amt: 0, name: w.custName }); c.n++; c.amt = r2(c.amt + w.unpaid); });
      const done = () => ERP.reload();
      ERP.ui.list(el, {
        title: '未结工作单', note: '按登记时间倒序 · 金额单位：元 · 批量操作只作用于当前页勾选的工单', params, idKey: 'no',
        load: () => D.workOrders.filter((w) => w.unpaid > 0),
        sort: (a, b) => b.created - a.created,
        filters: [
          { key: 'q', type: 'search', label: '搜索', placeholder: '工单号 / 客户 / 制作要求', keys: ['no', 'custCode', 'custName', 'req', 'task'] },
          { key: 'cust', type: 'select', label: '结算客户', options: Object.entries(custs).sort((a, b) => b[1].amt - a[1].amt).map(([code, c]) => [code, `${code} ${c.name}（${c.n} 单）`]), match: (w, v) => w.custCode === v },
          { key: 'settle', type: 'select', label: '结算状态', options: ['尚未结算', '部分结算'], match: (w, v) => w.settleStatus === v },
          { key: 'created', type: 'daterange', label: '登记日期', field: 'created', preset: 'year' },
        ],
        columns: [
          { key: 'no', title: '工单 / 客户', type: 'mono', nowrap: true, width: 220, render: (w) => link(w.no, 'orderDetail', { no: w.no }, { ariaLabel: `查看工单 ${w.no}` }), sub: (w) => `${w.custCode} ${w.custName} · ${w.group}` },
          { key: 'task', title: '制作任务 / 要求', width: 160, render: (w) => w.task || '—', sub: (w) => w.req },
          { key: 'amount', title: '实收（元）', type: 'money', sum: true },
          { key: 'paid', title: '已结（元）', type: 'money', sum: true },
          { key: 'unpaid', title: '未结（元）', type: 'money', sum: true },
          { key: 'settleStatus', title: '结算状态', render: biz.settleBadge || ((w) => w.settleStatus) },
          { key: 'flow', title: '生产流程', render: biz.flowBadge || ((w) => w.flow) },
          { key: 'created', title: '登记时间', type: 'time', nowrap: true },
        ],
        rowActions: (w) => [
          biz.settle ? linkBtn('收款', () => biz.settle(w, done), { ariaLabel: `为工单 ${w.no} 收款` }) : null,
          w.custCode !== '000000' ? link('对账', 'custStatement', { cust: w.custCode }, { ariaLabel: `客户对账：${w.custName}` }) : null,
        ],
        selectable: true,
        batch: [
          { label: '批量收款', variant: 'primary', onClick: (rows) => batchCollect(rows, done) },
          { label: '转记账', onClick: (rows) => toCredit(rows, done) },
        ],
        emptyTitle: '没有未结工作单', emptyText: '所有工作单都已结清。新工单收款前会显示在这里。',
      });
    },
  });

  /* ====================================================================
   * 现金余额 / 银行余额
   * ==================================================================== */
  const periodName = (p) => `${p.slice(0, 4)}年${+p.slice(4)}月`;
  function balancePage(kind) {
    const bank = kind === '银行';
    return {
      module: 'fin', title: bank ? '银行余额' : '现金余额', desc: `${kind}科目的期初余额、本期增加、本期减少与当前余额。`,
      render(el, params, ctx) {
        ctx.setActions([link('新建转账', 'transfer', null, { button: true, variant: 'primary' }), link('转账记录', 'transferRecords', null, { button: true }), link('收支记录', 'generalRecords', null, { button: true })]);
        const p = panel({ title: bank ? '银行科目余额' : '现金科目余额', note: `会计期间 ${periodName(D.company.period)} · 单位：元 · 数据截至 ${F.stamp(new Date())}`, flush: true });
        ERP.ui.table(p.body, {
          caption: `${kind}科目余额`, rows: accts().filter((a) => a.type === kind), footLabel: '合计',
          columns: [
            { key: 'code', title: '科目编号', type: 'mono', nowrap: true },
            { key: 'name', title: bank ? '银行科目' : '科目', render: acctLabel },
            { key: 'opening', title: '期初余额（元）', type: 'money', sum: true },
            { key: 'inc', title: '本期增加（元）', type: 'money', sum: true },
            { key: 'dec', title: '本期减少（元）', type: 'money', sum: true },
            { key: 'balance', title: '当前余额（元）', type: 'money', sum: true, render: (a) => (a.balance < 0 ? h('span', F.money(a.balance), ' ', badge('负余额', 'danger')) : F.money(a.balance)) },
          ],
          rowActions: (a) => [link('转出', 'transfer', { from: a.code }, { ariaLabel: `从 ${acctLabel(a)} 转出` }), link('转入', 'transfer', { to: a.code }, { ariaLabel: `转入 ${acctLabel(a)}` })],
        });
        el.appendChild(p.el);
        el.appendChild(notice('info', '期初余额为演示值 0。本期增加 / 减少包含收款、销账现金实结、一般收支与转账；本页的变动只在内存中，刷新即恢复。'));
      },
    };
  }
  ERP.page('cashBalance', balancePage('现金'));
  ERP.page('bankBalance', balancePage('银行'));

  /* ====================================================================
   * 新建转账（表单页）+ 转账记录
   * ==================================================================== */
  ERP.page('transfer', {
    module: 'fin', title: '新建转账', nav: false, parent: 'transferRecords', desc: '在现金、银行科目之间划转资金（存现、取现、第三方平台提现等）。',
    render(el, params, ctx) {
      const no = nextNo('ZZ', D.transfers);
      const fromCode = acctBy(params.from || '') ? params.from : params.to === '1001' ? '1002002' : '1001';
      const from = select(acctOptions(), { name: 'from', value: fromCode });
      const to = select(acctOptions(), { name: 'to', value: acctBy(params.to || '') ? params.to : fromCode === '1002002' ? '1001' : '1002002' });
      const amt = money({ name: 'amount', placeholder: '0.00' });
      const fee = money({ name: 'fee', value: '0.00' });
      const date = dateInput({ name: 'date', value: F.date(new Date()) });
      amt.dataset.validate = fee.dataset.validate = 'money';
      date.dataset.validate = 'date';
      to._validate = (v) => (v === from.value ? '转入科目不能与转出科目相同，请另选一个科目。' : null);
      amt._validate = (v) => { const n = num(v), a = acctBy(from.value); return n <= 0 ? '转账金额需大于 0。' : r2(n + num(fee.value)) > a.balance ? `超过转出科目余额 ${yuan(a.balance)}（含手续费），请调整金额或换一个转出科目。` : null; };
      fee._validate = (v) => (num(v) < 0 ? '手续费不能为负数。' : null);
      const hint = h('p.apb-erp-muted', { 'aria-live': 'polite' });
      const upd = () => {
        const a = acctBy(from.value), b = acctBy(to.value), v = num(amt.value), f = num(fee.value);
        hint.textContent = a === b ? '转出、转入科目相同。' : `转出后「${acctLabel(a)}」余额 ${yuan(a.balance - v - f)}；转入后「${acctLabel(b)}」余额 ${yuan(b.balance + v)}。`;
      };
      [from, to, amt, fee].forEach((x) => { x.addEventListener('input', upd); x.addEventListener('change', upd); });
      upd();
      const form = ERP.ui.form({
        ctx, submitLabel: '确认转账', cancel: { href: ERP.href('transferRecords'), label: '返回转账记录' },
        sections: [
          { title: '基本资料', cols: 3, fields: [
            field({ label: '转账单号', control: input({ value: no, readOnly: true }), help: '保存时按当天流水生成。' }),
            field({ label: '业务日期', control: date, required: true, help: '例如 2026-10-21。' }),
            field({ label: '经手', control: select(empOptions(), { name: 'handler', value: D.currentUser.name }) }),
          ] },
          { title: '转账', fields: [
            field({ label: '转出科目', control: from, required: true }), field({ label: '转入科目', control: to, required: true }),
            field({ label: '转账金额（元）', control: amt, required: true }), field({ label: '手续费用（元）', control: fee, help: '从转出科目一并扣除。' }),
          ], content: hint },
          { title: '票据', fields: [
            field({ label: '支付方式', control: select(['转账', ...PAY.filter((m) => m !== '转账')], { name: 'method' }) }),
            field({ label: '票据信息', control: input({ name: 'billInfo', maxlength: 60, placeholder: '发票 / 回单号' }) }),
            h('div.lerp-checks.lerp-spanall', ERP.ui.checkbox('已收发票', false, { name: 'invoice' })),
          ] },
          { title: '备注', fields: [field({ label: '说明备注', control: textarea({ name: 'remark', maxlength: 200, rows: 3 }), help: '最多 200 个字符。', span: 'all' })] },
        ],
        onSubmit: async (v) => {
          const a = acctBy(v.from), b = acctBy(v.to), n = num(v.amount), f = num(v.fee);
          const ok = await confirm(`从「${acctLabel(a)}」转出 ${yuan(n)} 到「${acctLabel(b)}」？`, { title: '确认转账', okLabel: '确认转账',
            detail: `${f ? `另从转出科目扣手续费 ${yuan(f)}。` : ''}转账单保存为“未审核”，期末结账前需审核。演示：只修改本页内存中的科目余额。` });
          if (!ok) { keepDirty(form); return '已取消，转账未保存；填写内容保留。'; }
          return ERP.api.write(() => {
            post(a, -r2(n + f)); post(b, n);
            D.transfers.unshift({ no, date: withNow(v.date), from: acctLabel(a), to: acctLabel(b), amount: n, method: v.method, fee: f, invoice: !!v.invoice,
              billInfo: v.billInfo, handler: v.handler, audited: false, auditTime: null, remark: v.remark });
            form.markClean();
            toast(`已转账 ${yuan(n)}：${acctShort(a)} → ${acctShort(b)}（单号 ${no}，待审核）。`);
            ERP.go('transferRecords', { q: no });
          });
        },
      });
      el.appendChild(demoNotice('确认转账后，两个科目的余额与转账单'));
      const p = panel({ title: '转账单' });
      p.body.appendChild(form);
      el.appendChild(p.el);
    },
  });

  function removeTransfer(t) {
    unpost(acctBy(t.from), -r2(t.amount + t.fee)); unpost(acctBy(t.to), t.amount);
    D.transfers.splice(D.transfers.indexOf(t), 1);
  }
  ERP.page('transferRecords', {
    module: 'fin', title: '转账记录', desc: '现金、银行科目之间的转账单。未审核的可以删除，删除时冲回两个科目的余额。',
    render(el, params, ctx) {
      ctx.setActions([link('新建转账', 'transfer', null, { button: true, variant: 'primary' }), link('现金余额', 'cashBalance', null, { button: true }), link('银行余额', 'bankBalance', null, { button: true })]);
      const list = ERP.ui.list(el, {
        title: '转账单', note: '已审核的转账单不能删除，需先反审核。金额单位：元', params,
        load: () => D.transfers, sort: (a, b) => b.date - a.date,
        filters: [
          { key: 'q', type: 'search', label: '搜索', placeholder: '转账单号 / 票据 / 备注', keys: ['no', 'billInfo', 'remark'] },
          acctFilter('from', '转出科目'), acctFilter('to', '转入科目'), auditFilter(),
          { key: 'date', type: 'daterange', label: '业务日期', field: 'date', preset: 'year' },
        ],
        columns: [
          { key: 'no', title: '转账单号', type: 'mono', nowrap: true },
          { key: 'date', title: '业务日期', type: 'date', nowrap: true },
          { key: 'from', title: '转出科目', width: 170 }, { key: 'to', title: '转入科目', width: 170 },
          { key: 'amount', title: '转账金额（元）', type: 'money', sum: true },
          { key: 'fee', title: '手续费（元）', type: 'money', sum: true },
          { key: 'method', title: '支付方式' },
          { key: 'invoice', title: '票据', render: (t) => (t.invoice ? '已收发票' : '未收发票'), sub: (t) => t.billInfo },
          { key: 'handler', title: '经手', nowrap: true },
          { key: 'audited', title: '审核', render: auditBadge, sub: (t) => (t.auditTime ? F.time(t.auditTime) : '') },
          { key: 'remark', title: '说明备注', render: (t) => t.remark || '—' },
        ],
        rowActions: (t) => [auditLink(t, '转账单', () => list.reload()), deleteLink(t, '转账单', removeTransfer, () => list.reload())],
        emptyTitle: '尚无转账单', emptyText: '在现金、银行科目之间划转资金后会显示在这里。', emptyAction: link('新建转账', 'transfer', null, { button: true, variant: 'primary' }),
      });
    },
  });

  /* ====================================================================
   * 客户结余（记账结余 / 预存结余）、应收汇总
   * ==================================================================== */
  // 客户记账结余行：open = 记账未销；pend = 计入的未审核销账单
  function arRow(c, open, pend) {
    const all = D.writeOffs.filter((w) => w.custCode === c.code), pendingAmt = sum(pend, (w) => w.amount);
    return { code: c.code, name: c.name, group: c.group, groupName: c.groupName, open, pendingAmt, bal: r2(open + pendingAmt), pn: pend.length,
      preal: sum(pend, (w) => w.real), pwipe: sum(pend, (w) => w.wipe), lastReg: lastOf(all, 'date'), lastAudit: lastOf(all, 'auditTime') || c.lastAudit, remark: c.remark };
  }
  const custCol = () => ({ key: 'name', title: '名称', width: 200, render: (r) => link(r.name, 'customerDetail', { code: r.code }, { ariaLabel: `查看客户 ${r.name}` }) });
  const arColumns = () => [
    { key: 'code', title: '编号', type: 'mono', nowrap: true }, custCol(), { key: 'groupName', title: '分组', width: 120 },
    { key: 'open', title: '记账未销（元）', type: 'money', sum: true },
    { key: 'pendingAmt', title: '销账未审（元）', type: 'money', sum: true },
    { key: 'bal', title: '记账结余（元）', type: 'money', sum: true },
    { key: 'pn', title: '单数', type: 'num', sum: true },
    { key: 'preal', title: '实结（元）', type: 'money', sum: true },
    { key: 'pwipe', title: '抹零（元）', type: 'money', sum: true },
    { key: 'lastReg', title: '最后登记', render: (r) => (r.lastReg ? F.date(r.lastReg) : '无记录'), nowrap: true },
    { key: 'lastAudit', title: '最后审核', render: (r) => (r.lastAudit ? F.date(r.lastAudit) : '无记录'), nowrap: true },
    { key: 'remark', title: '对账备注', render: (r) => r.remark || '—' },
  ];
  const arGroups = (t1, t2) => [{ title: '客户', span: 3 }, { title: t1, span: 3 }, { title: t2, span: 5 }, { title: '控制', span: 1 }];
  const arActions = (r) => [link('对账', 'custStatement', { cust: r.code }, { ariaLabel: `客户对账：${r.name}` }), r.open > 0 ? link('销账', 'writeOff', { cust: r.code }, { ariaLabel: `为 ${r.name} 新建销账` }) : null];
  const custFilters = () => [
    { key: 'q', type: 'search', label: '搜索客户', placeholder: '客户编号 / 名称', keys: ['code', 'name'] },
    { key: 'group', type: 'select', label: '客户分组', options: D.groups.map((g) => [g.code, `${g.code} ${g.name}`]), match: (r, v) => r.group === v },
  ];

  ERP.page('custBalance', {
    module: 'fin', title: '客户结余', desc: '基于已审核的结算单、预存单，以及未审核的销账单，汇总客户的应收（记账）与预存结余。',
    render(el, params, ctx) {
      ctx.setActions([link('应收汇总', 'arSummary', null, { button: true }), link('销账记录', 'writeOffRecords', null, { button: true })]);
      const views = ['ar', 'pre'], view = params.view === 'pre' ? 'pre' : 'ar';
      // 两个页签各有一张分页台账；只渲染当前页签，切换页签 = 改地址 view 参数（避免两张台账争用地址里的筛选参数）
      ERP.ui.tabs(el, [
        { title: '记账结余', render: (pane) => view === 'ar' && ERP.ui.list(shrink(pane), {
          title: '记账结余', note: `${reportNote(['', ''])} · 结余 = 记账未销 + 销账未审`, params, keepParams: { view: 'ar' },
          load: () => D.customers.filter((c) => c.code !== '000000' && (c.debt > 0 || pendingOf(c.code).length)).map((c) => arRow(c, c.debt, pendingOf(c.code))),
          sort: (a, b) => a.code.localeCompare(b.code),
          filters: custFilters(), groups: arGroups('结余', '未审销账'), columns: arColumns(), rowActions: arActions,
          emptyTitle: '没有记账结余', emptyText: '客户转记账（赊账）后会显示在这里。',
        }) },
        { title: '预存结余', render: (pane) => view === 'pre' && ERP.ui.list(shrink(pane), {
          title: '预存结余', note: reportNote(['', '']), params, keepParams: { view: 'pre' },
          load: () => D.cards.map((k) => {
            const c = D.customer(k.custCode), ps = D.prestores.filter((p) => p.custCode === k.custCode);
            return { code: c.code, name: c.name, group: c.group, groupName: c.groupName, cardNo: k.cardNo, totalIn: k.totalIn, gift: sum(ps, (p) => p.gift), totalOut: k.totalOut, balance: k.balance, lastIn: lastOf(ps, 'date'), remark: c.remark };
          }),
          sort: (a, b) => a.code.localeCompare(b.code),
          filters: custFilters(),
          groups: [{ title: '客户', span: 3 }, { title: '预存', span: 5 }, { title: '控制', span: 2 }],
          columns: [
            { key: 'code', title: '编号', type: 'mono', nowrap: true }, custCol(), { key: 'groupName', title: '分组', width: 120 },
            { key: 'cardNo', title: '预存卡号', type: 'mono', nowrap: true },
            { key: 'totalIn', title: '累计储值（元）', type: 'money', sum: true }, { key: 'gift', title: '累计赠送（元）', type: 'money', sum: true },
            { key: 'totalOut', title: '累计消费（元）', type: 'money', sum: true }, { key: 'balance', title: '预存结余（元）', type: 'money', sum: true },
            { key: 'lastIn', title: '最后储值', render: (r) => (r.lastIn ? F.date(r.lastIn) : '无记录'), nowrap: true },
            { key: 'remark', title: '对账备注', render: (r) => r.remark || '—' },
          ],
          rowActions: (r) => [link('对账', 'custStatement', { cust: r.code }, { ariaLabel: `客户对账：${r.name}` })],
          emptyTitle: '没有预存客户', emptyText: '客户办理预存卡后会显示在这里。',
        }) },
      ], { active: views.indexOf(view), onChange: (i) => { if (views[i] !== view) ERP.go('custBalance', { view: views[i] }); } });
    },
  });

  ERP.page('arSummary', {
    module: 'fin', title: '应收汇总', desc: '统计指定期间内记账单据的未销金额，以及期间内未审核的销账单。',
    render(el, params, ctx) {
      ctx.setActions([link('客户结余', 'custBalance', null, { button: true }), btn('导出', () => ERP.ui.exportCsv('客户应收汇总', arColumns().map((c) => ({ ...c, render: null })), list.rows))]);
      const y = now.getFullYear(), m = now.getMonth();
      const from = ERP.validDate(params.from || '') ? params.from : F.date(new Date(y, 0, 1));
      const to = ERP.validDate(params.to || '') ? params.to : F.date(new Date(y, m + 1, 0));
      const showAll = params.all === '1';
      // 统计期间是页面参数（汇总口径），客户关键词 / 分组是台账筛选
      const fi = dateInput({ value: from }), ti = dateInput({ value: to });
      const ff = field({ label: '开始日期', control: fi, error: '请填写有效日期，例如 2026-01-01。' }), tf = field({ label: '结束日期', control: ti, error: '请填写有效日期，例如 2026-10-31。' });
      const allBox = ERP.ui.checkbox('包括没有结余的客户', showAll);
      const pp = panel({ title: '统计期间', flush: true });
      pp.body.appendChild(h('form.apb-erp-toolbar', { novalidate: true, onsubmit: (e) => {
        e.preventDefault();
        const a = fi.value.trim(), b = ti.value.trim();
        const errs = [[fi, ff, !ERP.validDate(a) && '请填写有效日期，例如 2026-01-01。'], [ti, tf, !ERP.validDate(b) ? '请填写有效日期，例如 2026-10-31。' : ERP.validDate(a) && b < a && '结束日期不能早于开始日期。']];
        errs.forEach(([c, f, msg]) => { f._err.hidden = !msg; if (msg) f._err.textContent = msg; c.setAttribute('aria-invalid', String(!!msg)); });
        const bad = errs.find(([, , msg]) => msg);
        if (bad) return bad[0].focus();
        const q = hashParams();
        delete q.page;
        ERP.go('arSummary', Object.assign(q, { from: a, to: b, all: allBox.querySelector('input').checked ? '1' : '' }));
      } }, ff, tf, h('div.apb-erp-field', h('span', { 'aria-hidden': 'true' }, ' '), allBox), btn('统计', null, { type: 'submit', variant: 'primary' })));
      el.appendChild(pp.el);
      const a = ERP.parseDate(from), b = ERP.parseDate(to, true), within = (d) => d >= a && d <= b;
      const list = ERP.ui.list(el, {
        title: '应收记账', note: `${reportNote([from, to])} · 期间结余 = 期间记账未销 + 期间未审销账`, params, keepParams: { from, to, all: showAll ? '1' : '' },
        load: () => D.customers.filter((c) => c.code !== '000000')
          .map((c) => arRow(c, sum(AR.filter((x) => x.custCode === c.code && within(x.date)), arOpen), pendingOf(c.code).filter((w) => within(w.date))))
          .filter((r) => showAll || r.bal > 0),
        sort: (x, z) => x.code.localeCompare(z.code),
        filters: custFilters(), groups: arGroups('期间结余', '期间未审销账'), columns: arColumns(), rowActions: arActions,
        emptyTitle: '期间内没有应收', emptyText: '可以调整统计期间，或勾选“包括没有结余的客户”。',
      });
    },
  });

  /* ====================================================================
   * 客户对账：结算单据 / 工作单据（params.cust）
   * ==================================================================== */
  ERP.page('custStatement', {
    module: 'fin', title: '客户对账', desc: '客户的结算单据与工作单据，可打印对账单或直接销账。', smokeParams: { cust: '1070' },
    render(el, params, ctx) {
      const cust = params.cust ? D.customer(params.cust) : null;
      const pick = select([['', '请选择客户'], ...D.customers.filter((c) => c.code !== '000000').map((c) => [c.code, `${c.code} ${c.name}`])], { value: cust ? cust.code : '' });
      const pf = field({ label: '对账客户', control: pick, error: '请选择对账客户。' });
      const pp = panel({ title: '选择客户', flush: true });
      pp.body.appendChild(h('form.apb-erp-toolbar', { novalidate: true, onsubmit: (e) => {
        e.preventDefault();
        pf._err.hidden = !!pick.value; pick.setAttribute('aria-invalid', String(!pick.value));
        if (!pick.value) return pick.focus();
        ERP.go('custStatement', { cust: pick.value });
      } }, pf, btn('查询', null, { type: 'submit' })));
      el.appendChild(pp.el);
      if (params.cust && !cust) return el.appendChild(notice('danger', `找不到客户 ${params.cust}，可能已被删除。请在上方重新选择客户。`));
      if (!cust) return el.appendChild(h('section.apb-erp-panel', ERP.ui.empty({ title: '请选择对账客户', text: '选择客户后显示其结算单据、工作单据与结余。也可以从“客户结余”“智多结算中心”的“对账”进入。' })));
      ctx.setTitle(`客户对账 · ${cust.name}`);
      const k = card(cust.code);
      const reportLine = h('p.apb-erp-muted', { style: { marginTop: 'var(--apb-erp-space-3)' } });
      const ip = panel({ title: '客户与结余' });
      ip.body.append(kv([
        ['客户', h('span', link(`${cust.code} ${cust.name}`, 'customerDetail', { code: cust.code }), ` · ${cust.groupName}`)],
        ['联系人 / 电话', [cust.contact, cust.phone].filter(Boolean).join(' · ') || '未提供'],
        ['记账结余（元）', h('strong.apb-erp-mono', F.money(cust.debt))],
        ['销账未审（元）', h('span.apb-erp-mono', F.money(sum(pendingOf(cust.code), (w) => w.amount)))],
        ['预存余额（元）', k ? h('span.apb-erp-mono', `${F.money(k.balance)}（卡号 ${k.cardNo}）`) : '无预存卡'],
        ['结算方式', cust.settleType || '未提供'],
      ]), reportLine);
      el.appendChild(ip.el);
      const tabs = ['docs', 'orders'], tab = params.tab === 'orders' ? 'orders' : 'docs';
      let active = null;
      const docCols = [
        { key: 'no', title: '结算单号', type: 'mono', nowrap: true },
        { key: 'date', title: '结算日期', type: 'date', nowrap: true },
        { key: 'handler', title: '经手', nowrap: true },
        { key: 'method', title: '结算方式' },
        { key: 'orderNo', title: '工作单号', type: 'mono', nowrap: true, render: (r) => (r.orderNo && biz.order && biz.order(r.orderNo) ? link(r.orderNo, 'orderDetail', { no: r.orderNo }) : r.orderNo || '—') },
        { key: 'task', title: '工单任务', render: (r) => r.task || '—' },
        { key: 'amount', title: '结算金额（元）', type: 'money', sum: true },
        { key: 'cleared', title: '已清金额（元）', type: 'money', sum: true },
        { key: 'uncleared', title: '未清金额（元）', type: 'money', sum: true },
        { key: 'age', title: '欠款账龄', render: (r) => (r.uncleared > 0 ? badge(`${r.age} 天`, r.age > 90 ? 'danger' : 'warning') : '—') },
      ];
      const orderCols = [
        { key: 'no', title: '工单编号', type: 'mono', nowrap: true, render: (w) => link(w.no, 'orderDetail', { no: w.no }, { ariaLabel: `查看工单 ${w.no}` }) },
        { key: 'created', title: '登记日期', type: 'date', nowrap: true },
        { key: 'task', title: '制作任务 / 要求', render: (w) => w.task || '—', sub: (w) => w.req },
        { key: 'amount', title: '实收（元）', type: 'money', sum: true },
        { key: 'paid', title: '已结（元）', type: 'money', sum: true },
        { key: 'unpaid', title: '未结（元）', type: 'money', sum: true },
        { key: 'settleStatus', title: '结算状态', render: biz.settleBadge || ((w) => w.settleStatus) },
        { key: 'flow', title: '生产流程', render: biz.flowBadge || ((w) => w.flow) },
      ];
      ctx.setActions([
        cust.debt > 0 ? link('新建销账', 'writeOff', { cust: cust.code }, { button: true, variant: 'primary' }) : null,
        btn('打印对账单', () => window.print()),
        btn('导出当前页签', () => active && ERP.ui.exportCsv(`客户对账-${cust.name}`, (tab === 'docs' ? docCols : orderCols).map((c) => ({ ...c, render: null })), active.rows)),
      ]);
      const scopeFilter = (isOpen) => ({ key: 'scope', type: 'select', label: '结清状态', options: [['open', '未结清'], ['closed', '已结清']], match: (r, v) => (v === 'open') === isOpen(r) });
      ERP.ui.tabs(el, [
        { title: '结算单据', render: (pane) => {
          if (tab !== 'docs') return;
          shrink(pane);
          const rows = AR.filter((x) => x.custCode === cust.code).map((x) => ({ no: x.no, date: x.date, handler: x.handler, method: '记账', orderNo: x.orderNo, task: x.task, amount: x.amount, cleared: x.cleared, uncleared: arOpen(x) }))
            .concat(D.settlements.filter((s) => s.custCode === cust.code && s.method !== '记账').map((s) => ({ no: s.no, date: s.date, handler: s.handler, method: s.method, orderNo: s.orderNo,
              task: ((biz.order && biz.order(s.orderNo)) || {}).task || '', amount: s.amount, cleared: s.amount, uncleared: 0 })));
          rows.forEach((r) => { r.age = Math.max(0, Math.floor((now - r.date) / 864e5)); });
          const byMethod = panel({ title: '按结算方式汇总', note: '随上方筛选变化 · 单位：元', flush: true });
          active = ERP.ui.list(pane, {
            title: '结算单据', note: '记账单的未清金额通过“新建销账”收回；账龄超过 90 天标为超期。', params, keepParams: { cust: cust.code },
            load: () => rows, sort: (a, b) => a.date - b.date,
            filters: [
              { key: 'date', type: 'daterange', label: '结算日期', field: 'date', preset: 'year' },
              scopeFilter((r) => r.uncleared > 0),
              { key: 'method', type: 'select', label: '结算方式', options: [...new Set(rows.map((r) => r.method))] },
            ],
            columns: docCols,
            onDraw: (rs) => {
              reportLine.textContent = reportNote(rangeOf(hashParams(), 'date', 'year'));
              const m = {};
              rs.forEach((r) => { const s = (m[r.method] = m[r.method] || { method: r.method, n: 0, amount: 0, cleared: 0, uncleared: 0 }); s.n++; s.amount = r2(s.amount + r.amount); s.cleared = r2(s.cleared + r.cleared); s.uncleared = r2(s.uncleared + r.uncleared); });
              byMethod.body.replaceChildren();
              ERP.ui.table(byMethod.body, { caption: '按结算方式汇总', rows: Object.values(m), columns: [{ key: 'method', title: '结算方式' }, { key: 'n', title: '单数', type: 'num', sum: true },
                { key: 'amount', title: '结算金额（元）', type: 'money', sum: true }, { key: 'cleared', title: '已清金额（元）', type: 'money', sum: true }, { key: 'uncleared', title: '未清金额（元）', type: 'money', sum: true }],
                empty: { title: '没有单据', text: '当前筛选下没有结算单据。' } });
            },
            emptyTitle: '该客户没有结算单据', emptyText: '收款或转记账后会显示在这里。',
          });
          pane.appendChild(byMethod.el);
        } },
        { title: '工作单据', render: (pane) => {
          if (tab !== 'orders') return;
          shrink(pane);
          active = ERP.ui.list(pane, {
            title: '工作单据', note: '该客户的全部工作单', params, keepParams: { cust: cust.code, tab: 'orders' },
            load: () => D.workOrders.filter((w) => w.custCode === cust.code), sort: (a, b) => b.created - a.created,
            filters: [{ key: 'date', type: 'daterange', label: '登记日期', field: 'created', preset: 'year' }, scopeFilter((w) => w.unpaid > 0)],
            columns: orderCols,
            onDraw: () => { reportLine.textContent = reportNote(rangeOf(hashParams(), 'date', 'year')); },
            emptyTitle: '该客户没有工作单', emptyText: '在前台为该客户新建工单后会显示在这里。',
          });
        } },
      ], { active: tabs.indexOf(tab), onChange: (i) => { if (tabs[i] !== tab) ERP.go('custStatement', { cust: cust.code, tab: tabs[i] === 'docs' ? '' : tabs[i] }); } });
    },
  });

  /* ====================================================================
   * 新建销账（表单页，params.cust）+ 销账记录
   * ==================================================================== */
  ERP.page('writeOff', {
    module: 'fin', title: '新建销账', nav: false, parent: 'writeOffRecords', desc: '收回客户记账（应收）款项，冲销对应的记账单据。', smokeParams: { cust: '1070' },
    render(el, params, ctx) {
      const cust = params.cust ? D.customer(params.cust) : null;
      const owing = D.customers.filter((c) => AR.some((x) => x.custCode === c.code && arOpen(x) > 0));
      if (!cust) {
        // 先选客户（独立于表单，不触发离开保护）
        const pick = select([['', '请选择客户'], ...owing.map((c) => [c.code, `${c.code} ${c.name}（记账结余 ${F.money(c.debt)} 元）`])]);
        const pf = field({ label: '销账客户', control: pick, help: '只列出有未销记账单据的客户。', error: '请选择销账客户。' });
        const pp = panel({ title: '选择销账客户', flush: true });
        pp.body.appendChild(h('form.apb-erp-toolbar', { novalidate: true, onsubmit: (e) => {
          e.preventDefault();
          pf._err.hidden = !!pick.value; pick.setAttribute('aria-invalid', String(!pick.value));
          if (!pick.value) return pick.focus();
          ERP.go('writeOff', { cust: pick.value });
        } }, pf, btn('下一步', null, { type: 'submit', variant: 'primary' })));
        if (params.cust) el.appendChild(notice('danger', `找不到客户 ${params.cust}，请重新选择。`));
        el.appendChild(pp.el);
        return;
      }
      ctx.setTitle(`新建销账 · ${cust.name}`);
      const no = nextNo('JS', D.settlements.concat(D.writeOffs));
      const k = card(cust.code);
      const ip = panel({ title: '销账客户', actions: [link('更换客户', 'writeOff', null, { button: true }), link('客户对账', 'custStatement', { cust: cust.code }, { button: true })] });
      ip.body.appendChild(kv([
        ['客户', `${cust.code} ${cust.name} · ${cust.groupName}`],
        ['记账结余（元）', h('strong.apb-erp-mono', F.money(cust.debt))],
        ['销账未审（元）', h('span.apb-erp-mono', F.money(sum(pendingOf(cust.code), (w) => w.amount)))],
        ['预存余额（元）', k ? h('span.apb-erp-mono', `${F.money(k.balance)}（卡号 ${k.cardNo}）`) : '无预存卡'],
      ]));
      el.appendChild(ip.el);
      const rows = AR.filter((x) => x.custCode === cust.code && arOpen(x) > 0).map((x) => ({ x, no: x.no, date: x.date, orderNo: x.orderNo, task: x.task, amount: x.amount, cleared: x.cleared, open: arOpen(x), thisAmt: 0 }));
      if (!rows.length) return el.appendChild(h('section.apb-erp-panel', ERP.ui.empty({ title: '该客户没有未销的记账单据', text: '无需销账。可以返回客户对账查看明细。', action: link('客户对账', 'custStatement', { cust: cust.code }, { button: true }) })));
      // 结算区：只读计算字段 + 可填的抹零 / 预存 / 手续费
      const ro = (name) => money({ name, value: '0.00', readOnly: true });
      const E = { amount: ro('amount'), real: ro('real'), cash: ro('cash'), wipe: money({ name: 'wipe', value: '0.00' }), prestore: money({ name: 'prestore', value: '0.00' }), fee: money({ name: 'fee', value: '0.00' }) };
      [E.wipe, E.prestore, E.fee].forEach((x) => (x.dataset.validate = 'money'));
      const calc = () => {
        const amt = sum(rows, (r) => r.thisAmt), real = r2(amt - num(E.wipe.value)), cash = r2(real - num(E.prestore.value));
        E.amount.value = F.money(amt); E.real.value = F.money(real); E.cash.value = F.money(cash);
        return { amt, real, cash };
      };
      E.amount._validate = () => (calc().amt <= 0 ? '请在“记账单据”表中勾选要销账的单据。' : null);
      E.wipe._validate = (v) => (num(v) < 0 ? '抹零金额不能为负数。' : num(v) > calc().amt ? '抹零金额不能超过结算金额。' : null);
      E.prestore._validate = (v) => { const n = num(v); return n < 0 ? '预存实结不能为负数。' : n > 0 && !k ? '该客户没有预存卡，请填 0。' : k && n > k.balance ? `超过预存余额 ${yuan(k.balance)}。` : n > calc().real ? '预存实结不能超过实结金额。' : null; };
      E.fee._validate = (v) => (num(v) < 0 ? '手续费不能为负数。' : num(v) > calc().cash ? '手续费不能超过现金实结。' : null);
      [E.wipe, E.prestore].forEach((x) => x.addEventListener('input', calc));
      const acct = select(acctOptions(), { name: 'account', value: '1001' }), method = select(PAY, { name: 'method' });
      method.addEventListener('change', () => { const a = methodAcct(method.value); if (a) acct.value = a.code; });
      const date = dateInput({ name: 'date', value: F.date(new Date()) });
      date.dataset.validate = 'date';
      // 记账单据：勾选 = 全额销账；也可只改“本次销账”金额部分销账
      const refs = new Map();
      const setRow = (r, v) => { r.thisAmt = r2(Math.max(0, Math.min(r.open, v))); const ref = refs.get(r); ref.cb.checked = r.thisAmt > 0; ref.inp.value = r.thisAmt.toFixed(2); calc(); };
      const billBox = h('div', { style: { minWidth: 0 } });
      ERP.ui.table(billBox, {
        caption: '未销记账单据', rows,
        columns: [
          { key: 'pick', title: '销账', render: (r) => { const cb = h('input.apb-erp-checkbox', { type: 'checkbox', 'aria-label': `销账 ${r.no}`, onchange: () => setRow(r, cb.checked ? r.open : 0) }); refs.set(r, Object.assign(refs.get(r) || {}, { cb })); return cb; } },
          { key: 'no', title: '记账单号', type: 'mono', nowrap: true }, { key: 'date', title: '业务日期', type: 'date' },
          { key: 'orderNo', title: '工作单号', type: 'mono', nowrap: true }, { key: 'task', title: '工单任务', render: (r) => r.task || '—' },
          { key: 'amount', title: '记账金额（元）', type: 'money', sum: true }, { key: 'cleared', title: '已销金额（元）', type: 'money', sum: true }, { key: 'open', title: '未销金额（元）', type: 'money', sum: true },
          { key: 'thisAmt', title: '本次销账（元）', align: 'right', render: (r) => { const inp = money({ value: '0.00', class: 'lerp-cell', style: { width: '110px' }, 'aria-label': `${r.no} 本次销账金额` }); inp.addEventListener('change', () => setRow(r, num(inp.value))); refs.set(r, Object.assign(refs.get(r) || {}, { inp })); return inp; } },
        ],
      });
      const form = ERP.ui.form({
        ctx, wide: true, submitLabel: '确认销账', cancel: { href: ERP.href('writeOffRecords'), label: '返回销账记录' },
        sections: [
          { title: '基本资料', cols: 3, fields: [
            field({ label: '销账单号', control: input({ value: no, readOnly: true }), help: '保存时按当天流水生成。' }),
            field({ label: '业务日期', control: date, required: true, help: '例如 2026-10-21。' }),
            field({ label: '客方经手', control: input({ name: 'custHandler', maxlength: 40 }) }),
          ] },
          { title: '记账单据', note: '勾选 = 按未销金额全额销账；也可以直接改“本次销账”金额做部分销账。', content: [
            h('div.apb-erp-row', btn('全部销账', () => { rows.forEach((r) => setRow(r, r.open)); form.dispatchEvent(new Event('change')); }), btn('清除', () => { rows.forEach((r) => setRow(r, 0)); })), billBox] },
          { title: '结算', cols: 3, fields: [
            field({ label: '结算金额（元）', control: E.amount, help: '= 本次销账合计' }), field({ label: '抹零金额（元）', control: E.wipe }), field({ label: '实结金额（元）', control: E.real, help: '= 结算金额 − 抹零' }),
            field({ label: '预存实结（元）', control: E.prestore, help: k ? `从预存卡扣，余额 ${F.money(k.balance)} 元。` : '该客户没有预存卡。' }),
            field({ label: '现金实结（元）', control: E.cash, help: '= 实结金额 − 预存实结' }), field({ label: '手续费用（元）', control: E.fee, help: '刷卡等手续费，从现金实结中扣除。' }),
            field({ label: '现金科目', control: acct }), field({ label: '支付方式', control: method }),
            field({ label: '票据信息', control: input({ name: 'billInfo', maxlength: 60 }) }),
            h('div.lerp-checks.lerp-spanall', ERP.ui.checkbox('已开发票', false, { name: 'invoice' })),
          ] },
          { title: '备注', fields: [field({ label: '说明备注', control: textarea({ name: 'remark', maxlength: 200, rows: 3 }), help: '最多 200 个字符。', span: 'all' })] },
        ],
        onSubmit: async (v) => {
          const { amt, real, cash } = calc(), pre = num(v.prestore), fee = num(v.fee), wipe = num(v.wipe), a = acctBy(v.account);
          const picked = rows.filter((r) => r.thisAmt > 0);
          const ok = await confirm(`为「${cust.name}」销账 ${yuan(amt)}？`, { title: '确认销账', okLabel: '确认销账',
            detail: `冲销 ${picked.length} 张记账单；实结 ${yuan(real)}${wipe ? `（抹零 ${yuan(wipe)}）` : ''}，其中预存 ${yuan(pre)}、现金 ${yuan(cash)} 计入「${acctLabel(a)}」${fee ? `（扣手续费 ${yuan(fee)}）` : ''}。销账单保存为“未审核”。演示：只修改本页内存数据。` });
          if (!ok) { keepDirty(form); return '已取消，销账未保存；填写内容保留。'; }
          return ERP.api.write(() => {
            picked.forEach((r) => { r.x.cleared = r2(r.x.cleared + r.thisAmt); });
            cust.debt = r2(Math.max(0, cust.debt - amt)); cust.writeOffPending = r2((cust.writeOffPending || 0) + amt);
            if (pre > 0) { k.balance = r2(k.balance - pre); k.totalOut = r2(k.totalOut + pre); cust.prestoreBalance = k.balance; }
            post(a, r2(cash - fee));
            D.writeOffs.unshift({ no, date: withNow(v.date), custCode: cust.code, custName: cust.name, custHandler: v.custHandler, amount: amt, wipe, real, cash,
              account: cash ? acctLabel(a) : '', method: cash ? v.method : '', fee, prestore: pre, invoice: !!v.invoice, billInfo: v.billInfo,
              handler: D.currentUser.name, audited: false, auditTime: null, remark: v.remark, allocs: picked.map((r) => ({ x: r.x, amt: r.thisAmt })) });
            form.markClean();
            toast(`已为 ${cust.name} 销账 ${yuan(amt)}（单号 ${no}，待审核）。`);
            ERP.go('writeOffRecords', { q: no });
          });
        },
      });
      el.appendChild(demoNotice('确认销账后，记账单已销金额、客户欠款、预存余额与资金科目余额'));
      const fp = panel({ title: '销账单' });
      fp.body.appendChild(form);
      el.appendChild(fp.el);
    },
  });

  // 删除销账单：恢复记账单已销金额、客户欠款、预存余额与资金科目
  function removeWriteOff(w) {
    const c = D.customer(w.custCode);
    w.allocs.forEach((x) => { x.x.cleared = r2(x.x.cleared - x.amt); });
    if (c && w.custCode) { c.debt = r2(c.debt + w.amount); if (!w.audited) c.writeOffPending = r2(Math.max(0, (c.writeOffPending || 0) - w.amount)); }
    const k = w.prestore && card(w.custCode);
    if (k) { k.balance = r2(k.balance + w.prestore); k.totalOut = r2(k.totalOut - w.prestore); if (c) c.prestoreBalance = k.balance; }
    unpost(acctBy(w.account), r2(w.cash - w.fee));
    D.writeOffs.splice(D.writeOffs.indexOf(w), 1);
  }
  function auditWriteOff(w) {
    setAudit(w);
    const c = w.custCode && D.customer(w.custCode);
    if (!c) return;
    c.writeOffPending = r2(Math.max(0, (c.writeOffPending || 0) + (w.audited ? -w.amount : w.amount)));
    if (w.audited) c.lastAudit = w.auditTime;
  }

  ERP.page('writeOffRecords', {
    module: 'fin', title: '销账记录', desc: '收回客户记账款项的销账单。未审核的销账单计入客户“销账未审”，可以删除。',
    render(el, params, ctx) {
      ctx.setActions([link('新建销账', 'writeOff', null, { button: true, variant: 'primary' }), link('客户结余', 'custBalance', null, { button: true })]);
      const list = ERP.ui.list(el, {
        title: '销账单', note: '已审核的销账单不能删除，需先反审核。金额单位：元', params,
        load: () => D.writeOffs, sort: (a, b) => b.date - a.date,
        filters: [
          { key: 'q', type: 'search', label: '搜索', placeholder: '销账单号 / 客户 / 票据', keys: ['no', 'custName', 'billInfo', 'remark'] },
          acctFilter('acct', '入账科目', 'account'),
          { key: 'method', type: 'select', label: '支付方式', options: PAY },
          { key: 'bill', type: 'select', label: '发票', options: [['y', '已开发票'], ['n', '未开发票']], match: (w, v) => (v === 'y') === !!w.invoice },
          auditFilter(),
          { key: 'date', type: 'daterange', label: '业务日期', field: 'date', preset: 'year' },
        ],
        groups: [{ title: '基础', span: 2 }, { title: '客户', span: 1 }, { title: '销账', span: 3 }, { title: '结算', span: 4 }, { title: '更多', span: 4 }],
        columns: [
          { key: 'no', title: '销账单号', type: 'mono', nowrap: true },
          { key: 'date', title: '业务日期', type: 'date', nowrap: true },
          { key: 'custName', title: '客户 / 客方经手', width: 180, render: (w) => (w.custCode ? link(w.custName, 'custStatement', { cust: w.custCode }, { ariaLabel: `客户对账：${w.custName}` }) : w.custName), sub: (w) => w.custHandler },
          { key: 'amount', title: '结算金额（元）', type: 'money', sum: true },
          { key: 'wipe', title: '抹零（元）', type: 'money', sum: true },
          { key: 'real', title: '实结（元）', type: 'money', sum: true },
          { key: 'cash', title: '现金实结（元）', type: 'money', sum: true },
          { key: 'account', title: '现金科目 / 支付方式', width: 170, render: (w) => w.account || '—', sub: (w) => w.method },
          { key: 'fee', title: '手续费（元）', type: 'money', sum: true },
          { key: 'prestore', title: '预存实结（元）', type: 'money', sum: true },
          { key: 'invoice', title: '票据', render: (w) => (w.invoice ? '已开发票' : '未开发票'), sub: (w) => w.billInfo },
          { key: 'handler', title: '经手', nowrap: true },
          { key: 'audited', title: '审核', render: auditBadge, sub: (w) => (w.auditTime ? F.time(w.auditTime) : '') },
          { key: 'remark', title: '说明备注', render: (w) => w.remark || '—' },
        ],
        rowActions: (w) => [auditLink(w, '销账单', () => list.reload(), auditWriteOff), deleteLink(w, '销账单', removeWriteOff, () => list.reload())],
        emptyTitle: '尚无销账单', emptyText: '收回客户记账款项后会显示在这里。', emptyAction: link('新建销账', 'writeOff', null, { button: true, variant: 'primary' }),
      });
    },
  });

  /* ====================================================================
   * 一般收入 / 一般支出（表单页）+ 收支记录
   * ==================================================================== */
  function journalPage(kind) {
    const inc = kind === '一般收入';
    return {
      module: 'fin', title: inc ? '新建一般收入' : '新建一般支出', nav: false, parent: 'generalRecords',
      desc: inc ? '登记经营项目之外的收入（废品、房租等），款项计入所选资金科目。' : '登记房租、水电、工资、采购等日常支出，款项从所选资金科目扣除。',
      render(el, params, ctx) {
        const no = nextNo(inc ? 'SR' : 'ZC', D.cashJournal);
        const acct = select(acctOptions(), { name: 'account', value: '1001' }), method = select(PAY, { name: 'method' });
        method.addEventListener('change', () => { const a = methodAcct(method.value); if (a) acct.value = a.code; });
        const amt = money({ name: 'amount', placeholder: '0.00' });
        amt.dataset.validate = 'money';
        amt._validate = (v) => { const n = num(v), a = acctBy(acct.value); return n <= 0 ? '金额需大于 0。' : !inc && n > a.balance ? `超过出账科目余额 ${yuan(a.balance)}，请调整金额或换一个科目。` : null; };
        const date = dateInput({ name: 'date', value: F.date(new Date()) });
        date.dataset.validate = 'date';
        const custList = h('datalist', { id: 'fin-cust-list' }, D.customers.slice(1).map((c) => h('option', { value: c.name })));
        const form = ERP.ui.form({
          ctx, submitLabel: inc ? '确认收入' : '确认支出', cancel: { href: ERP.href('generalRecords'), label: '返回收支记录' },
          sections: [
            { title: '基本资料', cols: 3, fields: [
              field({ label: '单据编号', control: input({ value: no, readOnly: true }), help: '保存时按当天流水生成。' }),
              field({ label: '业务日期', control: date, required: true, help: '例如 2026-10-21。' }),
              field({ label: '经手', control: select(empOptions(), { name: 'handler', value: D.currentUser.name }) }),
            ] },
            { title: inc ? '收入' : '支出', fields: [
              field({ label: inc ? '收入科目' : '成本科目', control: select(inc ? D.incomeTypes : D.expenseTypes, { name: 'type' }), required: true }),
              field({ label: '金额（元）', control: amt, required: true }),
              field({ label: '支付方式', control: method }),
              field({ label: inc ? '入账科目' : '出账科目', control: acct, required: true, help: '随支付方式自动带出，可修改。' }),
            ] },
            { title: '往来与票据', fields: [
              field({ label: '客户单位', control: input({ name: 'cust', list: 'fin-cust-list', maxlength: 100, placeholder: '可选，往来单位' }) }),
              field({ label: '票据信息', control: input({ name: 'billInfo', maxlength: 60, placeholder: '发票号 / 票据信息' }) }),
              h('div.lerp-checks.lerp-spanall', ERP.ui.checkbox(inc ? '已开发票' : '已收发票', false, { name: 'invoice' })),
            ] },
            { title: '备注', fields: [field({ label: '说明备注', control: textarea({ name: 'remark', maxlength: 200, rows: 3 }), help: '最多 200 个字符。', span: 'all' })] },
          ],
          extra: custList,
          onSubmit: async (v) => {
            const n = num(v.amount), a = acctBy(v.account);
            const ok = await confirm(`${inc ? '登记收入' : '登记支出'} ${yuan(n)}（${v.type}）？`, { title: inc ? '确认一般收入' : '确认一般支出', okLabel: inc ? '确认收入' : '确认支出',
              detail: `款项${inc ? '计入' : '从'}「${acctLabel(a)}」${inc ? '' : '扣除'}，单据保存为“未审核”。演示：只修改本页内存中的科目余额。` });
            if (!ok) { keepDirty(form); return '已取消，单据未保存；填写内容保留。'; }
            return ERP.api.write(() => {
              post(a, inc ? n : -n);
              D.cashJournal.unshift({ no, date: withNow(v.date), kind, type: v.type, account: a.name, method: v.method, amount: n, cust: v.cust.trim(), invoice: !!v.invoice,
                billInfo: v.billInfo, handler: v.handler, audited: false, auditTime: null, remark: v.remark });
              form.markClean();
              toast(`${kind}已登记：${no} ${yuan(n)}（待审核）。`);
              ERP.go('generalRecords', { q: no });
            });
          },
        });
        el.appendChild(demoNotice(`确认${inc ? '收入' : '支出'}后，资金科目余额与收支单`));
        const p = panel({ title: inc ? '一般收入单' : '一般支出单' });
        p.body.appendChild(form);
        el.appendChild(p.el);
      },
    };
  }
  ERP.page('generalIncome', journalPage('一般收入'));
  ERP.page('generalExpense', journalPage('一般支出'));

  function removeJournal(j) {
    unpost(acctBy(j.account), j.kind === '一般收入' ? j.amount : -j.amount);
    D.cashJournal.splice(D.cashJournal.indexOf(j), 1);
  }
  ERP.page('generalRecords', {
    module: 'fin', title: '收支记录', desc: '一般收入、一般支出单据。未审核的可以删除，删除时冲回资金科目余额。',
    render(el, params, ctx) {
      ctx.setActions([link('新建一般收入', 'generalIncome', null, { button: true, variant: 'primary' }), link('新建一般支出', 'generalExpense', null, { button: true })]);
      const list = ERP.ui.list(el, {
        title: '收支单', note: '已审核的单据不能删除，需先反审核。金额单位：元', params,
        load: () => D.cashJournal.map((j) => Object.assign(j, { acctLabel: acctLabel(acctBy(j.account)), inAmt: j.kind === '一般收入' ? j.amount : 0, outAmt: j.kind === '一般支出' ? j.amount : 0 })),
        sort: (a, b) => b.date - a.date,
        filters: [
          { key: 'q', type: 'search', label: '搜索', placeholder: '单据编号 / 客户单位 / 备注', keys: ['no', 'cust', 'billInfo', 'remark'] },
          { key: 'kind', type: 'select', label: '收支类型', options: ['一般收入', '一般支出'] },
          acctFilter('acct', '资金科目', 'acctLabel'),
          { key: 'type', type: 'select', label: '收支科目', options: D.incomeTypes.concat(D.expenseTypes) },
          { key: 'method', type: 'select', label: '支付方式', options: PAY },
          auditFilter(),
          { key: 'date', type: 'daterange', label: '业务日期', field: 'date', preset: 'year' },
        ],
        columns: [
          { key: 'no', title: '单据编号', type: 'mono', nowrap: true },
          { key: 'date', title: '业务日期', type: 'date', nowrap: true },
          { key: 'kind', title: '收支类型 / 科目', render: (j) => j.kind, sub: (j) => j.type },
          { key: 'acctLabel', title: '资金科目 / 支付方式', width: 170, sub: (j) => j.method },
          { key: 'inAmt', title: '收入金额（元）', type: 'money', sum: true },
          { key: 'outAmt', title: '支出金额（元）', type: 'money', sum: true },
          { key: 'cust', title: '客户单位', render: (j) => j.cust || '—' },
          { key: 'invoice', title: '票据', render: (j) => (j.invoice ? '有发票' : '无发票'), sub: (j) => j.billInfo },
          { key: 'handler', title: '经手', nowrap: true },
          { key: 'audited', title: '审核', render: auditBadge, sub: (j) => (j.auditTime ? F.time(j.auditTime) : '') },
          { key: 'remark', title: '说明备注', render: (j) => j.remark || '—' },
        ],
        rowActions: (j) => [auditLink(j, j.kind + '单', () => list.reload()), deleteLink(j, j.kind + '单', removeJournal, () => list.reload())],
        emptyTitle: '尚无收支单据', emptyText: '登记一般收入或一般支出后会显示在这里。', emptyAction: link('新建一般收入', 'generalIncome', null, { button: true, variant: 'primary' }),
      });
    },
  });

  /* ====================================================================
   * 期末结账 / 会计日历
   * ==================================================================== */
  const nextPeriod = (p) => { const y = +p.slice(0, 4), m = +p.slice(4); return m === 12 ? `${y + 1}01` : `${y}${pad(m + 1)}`; };
  const closings = {}; // 本次会话中的结账记录 {期间: {time, user}}
  const cal = { mode: '自然月', day: 25 };
  // 某会计年度的 12 个期间（自然月，或“固定结账日”：上月结账日次日 ~ 本月结账日）
  function periodRows(year, mode = cal.mode, day = cal.day) {
    return Array.from({ length: 12 }, (_, i) => {
      const code = `${year}${pad(i + 1)}`, nat = mode === '自然月';
      const start = nat ? new Date(year, i, 1) : new Date(year, i - 1, day + 1), finish = nat ? new Date(year, i + 1, 0) : new Date(year, i, day);
      const cur = D.company.period, st = code < cur ? '已结账' : code === cur ? '当前期间' : '未开始';
      return { code, name: periodName(code), start, finish, days: Math.round((finish - start) / 864e5) + 1, st, close: closings[code] || null };
    });
  }
  const periodTone = (st) => ({ 已结账: 'success', 当前期间: 'info' }[st]);

  // 尚未审核的财务相关单据（结账前必须全部审核）
  function unaudited() {
    const R = [];
    const add = (module, docName, x, page, audit = setAudit) => R.push({ x, module, docName, no: x.no, date: x.date, hName: x.handler || '未知', hCode: empCode(x.handler), remark: x.remark || '', page, audit });
    D.settlements.filter((s) => !s.audited).forEach((s) => add('销售', '结算单', s, s.orderNo && biz.order && biz.order(s.orderNo) ? ['orderDetail', { no: s.orderNo }] : null));
    D.prestores.filter((s) => !s.audited).forEach((s) => add('销售', '预存单', s, null));
    D.writeOffs.filter((s) => !s.audited).forEach((s) => add('销售', '销账单', s, ['writeOffRecords', { q: s.no }], auditWriteOff));
    D.cashJournal.filter((s) => !s.audited).forEach((s) => add('财务', s.kind + '单', s, ['generalRecords', { q: s.no }]));
    D.transfers.filter((s) => !s.audited).forEach((s) => add('财务', '转账单', s, ['transferRecords', { q: s.no }]));
    return R.sort((a, b) => a.date - b.date);
  }

  ERP.page('periodClose', {
    module: 'fin', title: '期末结账', desc: '存档本期财务数据，开辟新的会计期间。结账前需审核本期全部财务相关单据。',
    render(el, params, ctx) {
      ctx.setActions([link('会计日历', 'accountCalendar', null, { button: true })]);
      const cur = D.company.period, nxt = nextPeriod(cur);
      const curRow = periodRows(+cur.slice(0, 4)).find((r) => r.code === cur);
      const pend = unaudited(), neg = accts().filter((a) => a.balance < 0);
      // 检查清单：每项状态文字可见
      const cp = panel({ title: '结账检查', note: `会计期间 ${periodName(cur)}（${F.date(curRow.start)} 至 ${F.date(curRow.finish)}） · 检查时间 ${F.stamp(new Date())}` });
      const item = (title, b, text) => h('li', { style: { display: 'flex', gap: 'var(--apb-erp-space-3)', alignItems: 'baseline', padding: 'var(--apb-erp-space-2) 0', borderBottom: '1px solid var(--apb-erp-line)' } },
        h('span', { style: { minWidth: '108px' } }, b), h('span', h('strong', title), h('span.apb-erp-muted', { style: { display: 'block' } }, text)));
      cp.body.appendChild(h('ul', { style: { listStyle: 'none', margin: 0, padding: 0 } },
        item('财务相关业务单据已审核', pend.length ? badge(`${pend.length} 张未审核`, 'warning') : badge('已全部审核', 'success'),
          pend.length ? '结算单、预存单、销账单、一般收支单、转账单需全部审核；可在下方逐张或批量审核。' : '本期没有未审核的财务相关单据。'),
        item('资金科目没有负余额', neg.length ? badge(`${neg.length} 个负余额`, 'danger') : badge('通过', 'success'),
          neg.length ? `负余额科目：${neg.map(acctLabel).join('、')}。请先核对转账与收支单据。` : '现金、银行科目余额均不小于 0。'),
        item('记账凭证已过账', badge('不适用'), '本原型不生成记账凭证；正式版由财务服务检查凭证过账状态。'),
        item('没有其他客户端在录入本期单据', badge('需人工确认', 'warning'), '前端无法检测其他客户端连接，请在下方结账表单中勾选确认。')));
      el.appendChild(cp.el);
      // 未审核单据
      ERP.ui.list(el, {
        title: '尚未审核的财务相关单据', note: '审核后单据不能删除；如单据有误，请到对应记录页处理后再审核。', params, idKey: 'no',
        load: () => unaudited(), sort: (a, b) => a.date - b.date,
        filters: [{ key: 'module', type: 'select', label: '模块', options: ['销售', '财务'] }, { key: 'docName', type: 'select', label: '单据名称', options: [...new Set(pend.map((r) => r.docName))] }],
        columns: [
          { key: 'module', title: '模块' }, { key: 'docName', title: '单据名称' },
          { key: 'no', title: '单据编号', type: 'mono', nowrap: true, render: (r) => (r.page ? link(r.no, r.page[0], r.page[1], { ariaLabel: `查看单据 ${r.no}` }) : r.no) },
          { key: 'date', title: '业务日期', type: 'date', nowrap: true },
          { key: 'hName', title: '经手人员', sub: (r) => `编号 ${r.hCode}` },
          { key: 'remark', title: '说明备注', render: (r) => r.remark || '—' },
        ],
        rowActions: (r) => [linkBtn('审核', async () => {
          if (!(await confirm(`审核${r.docName} ${r.no}？`, { okLabel: '审核', detail: '审核后不能删除。' }))) return;
          await ERP.api.write(() => r.audit(r.x));
          toast(`${r.docName} ${r.no} 已审核。`); ERP.reload();
        }, { ariaLabel: `审核${r.docName} ${r.no}` })],
        selectable: true,
        batch: [{ label: '审核所选', onClick: async (rows) => {
          if (!(await confirm(`审核所选 ${rows.length} 张单据？`, { okLabel: '审核', detail: '只审核当前页勾选的单据；审核后不能删除。' }))) return;
          await ERP.api.write(() => rows.forEach((r) => r.audit(r.x)));
          toast(`已审核 ${rows.length} 张单据。`); ERP.reload();
        } }],
        emptyTitle: '没有未审核的单据', emptyText: '本期财务相关单据已全部审核，可以结账。',
      });
      // 结账表单
      const end = dateInput({ name: 'end', value: F.date(curRow.finish) });
      end.dataset.validate = 'date';
      const ack = h('input.apb-erp-checkbox', { type: 'checkbox', name: 'ack' });
      ack._validate = () => (ack.checked ? null : '请确认没有其他客户端正在录入本期单据。');
      const block = h('div');
      const form = ERP.ui.form({
        submitLabel: `结账 ${periodName(cur)}`,
        sections: [{ fields: [
          field({ label: '当前会计期间', control: input({ value: `${periodName(cur)}（${cur}）`, readOnly: true }) }),
          field({ label: '结束日期', control: end, required: true, help: '本期最后一天，按北京时间 23:59:59 截止。' }),
          field({ label: '已确认没有其他客户端正在录入本期单据', control: ack, span: 'all' }),
        ] }],
        onSubmit: async () => {
          const n = unaudited().length;
          if (n) {
            block.replaceChildren(notice('danger', `不能结账：尚有 ${n} 张财务相关单据未审核。请在上方“尚未审核的财务相关单据”中审核后再结账。`));
            block.firstChild.tabIndex = -1; block.firstChild.focus();
            return null;
          }
          block.replaceChildren();
          const ok = await confirm(`结束会计期间「${periodName(cur)}」？`, { title: '确认期末结账', okLabel: '结账', danger: true,
            detail: `结账后本期单据不能再修改，当前会计期间变为「${periodName(nxt)}」。演示：只修改内存中的会计期间，刷新即恢复。` });
          if (!ok) return '已取消，未结账。';
          return ERP.api.write(() => {
            closings[cur] = { time: new Date(), end: form.querySelector('[name=end]').value.trim(), user: D.currentUser.name };
            if (typeof ERP.setPeriod === 'function') ERP.setPeriod(nxt); else D.company.period = nxt;
            toast(`已结账 ${periodName(cur)}，当前会计期间 ${periodName(nxt)}。`);
            ERP.reload();
          });
        },
      });
      const fp = panel({ title: '结账', note: '结账会关闭当前会计期间；本期单据此后不能修改。' });
      fp.body.append(block, form);
      el.appendChild(fp.el);
    },
  });

  ERP.page('accountCalendar', {
    module: 'fin', title: '会计日历', desc: '设置会计年度内各期间的起止日期；期末结账按此划分财务月度。',
    render(el, params, ctx) {
      ctx.setActions([link('期末结账', 'periodClose', null, { button: true })]);
      const year = /^\d{4}$/.test(params.year || '') ? +params.year : +D.company.period.slice(0, 4);
      const mode = params.mode === '固定结账日' ? '固定结账日' : params.mode === '自然月' ? '自然月' : cal.mode;
      const day = Math.min(28, Math.max(1, +params.day || cal.day));
      const unsaved = mode !== cal.mode || (mode === '固定结账日' && day !== cal.day);
      const ysel = select(Array.from({ length: 10 }, (_, i) => [2019 + i, `${2019 + i} 年`]), { value: year });
      const msel = select(['自然月', '固定结账日'], { value: mode });
      const dsel = select(Array.from({ length: 28 }, (_, i) => [i + 1, `每月 ${i + 1} 日`]), { value: day, disabled: mode === '自然月' });
      msel.addEventListener('change', () => { dsel.disabled = msel.value === '自然月'; });
      const tp = panel({ title: '期间设置', flush: true });
      tp.body.appendChild(h('form.apb-erp-toolbar', { novalidate: true, onsubmit: (e) => { e.preventDefault(); ERP.go('accountCalendar', { year: ysel.value, mode: msel.value, day: msel.value === '自然月' ? '' : dsel.value }); } },
        field({ label: '会计年度', control: ysel }), field({ label: '期间划分', control: msel }), field({ label: '结账日', control: dsel, help: '仅“固定结账日”使用。' }), btn('生成预览', null, { type: 'submit' })));
      el.appendChild(tp.el);
      if (unsaved) el.appendChild(notice('warning', `正在预览“${mode}${mode === '固定结账日' ? `（每月 ${day} 日）` : ''}”的期间划分，尚未保存。`, ' ',
        btn('保存会计日历', async (e) => {
          const b = e.currentTarget;
          if (!(await confirm('保存新的期间划分？', { okLabel: '保存', detail: '只影响尚未开始的会计期间；已结账期间的起止日期不变。演示：只保存在本次会话。' }))) return;
          await ERP.ui.busy(b, ERP.api.write(() => { cal.mode = mode; cal.day = day; }));
          toast('会计日历已保存。'); ERP.go('accountCalendar', { year });
        }, { variant: 'primary' })));
      const p = panel({ title: `${year} 年会计期间`, note: `当前会计期间 ${periodName(D.company.period)} · 期间划分：${mode}${mode === '固定结账日' ? `（每月 ${day} 日）` : ''}`, flush: true });
      ERP.ui.table(p.body, {
        caption: `${year} 年会计期间`, rows: periodRows(year, mode, day),
        columns: [
          { key: 'code', title: '会计期间', type: 'mono', nowrap: true }, { key: 'name', title: '期间名称' },
          { key: 'start', title: '开始日期', type: 'date' }, { key: 'finish', title: '结束日期', type: 'date' },
          { key: 'days', title: '天数', type: 'num' },
          { key: 'st', title: '状态', render: (r) => badge(r.st, periodTone(r.st)) },
          { key: 'close', title: '结账时间 / 结账人', render: (r) => (r.close ? `${F.stamp(r.close.time)} · ${r.close.user}` : r.st === '已结账' ? '历史期间，未记录' : '—') },
        ],
        rowActions: (r) => [r.st === '当前期间' ? link('期末结账', 'periodClose', null, { ariaLabel: `期末结账 ${r.name}` }) : null],
      });
      el.appendChild(p.el);
      el.appendChild(notice('info', '已结账的期间不可再调整起止日期；修改期间划分只影响尚未开始的会计期间。'));
    },
  });

  /* 供其他模块复用（客户详情等） */
  biz.fin = { accts, acctLabel, acctBy, acctOptions, methodAcct, post, unpost, arOpen, pendingOf, settleAmount, reverseSettlement };
})();
