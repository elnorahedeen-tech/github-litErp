/* 财务：财务业务中心、智多结算中心、现金/银行余额、转账、客户结余/对账/应收汇总、销账、一般收支、期末结账、会计日历
 * 资金科目余额直接维护在 ERP.data.accounts[].balance 上（另加 inc/dec 记录本期增减）；
 * 客户记账欠款 = customers[].debt，与本文件生成的「记账单」（AR）未销金额保持一致。
 * 额外数据：D.transfers（转账单）、D.writeOffs（销账单）在本文件内生成。 */
(function () {
  'use strict';
  const { h, grid, sidebar, split, dialog, field, input, select, check, btn, toast } = ERP.ui;
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
  /* 单号：前缀 + 年月日 + 门店(1) + 4 位流水，如 JS26092210001 */
  const nextNo = (prefix, list) => {
    const p = prefix + ymdNo(new Date()) + '1';
    return p + String(list.filter((x) => x.no.startsWith(p)).length + 1).padStart(4, '0');
  };
  const empCode = (name) => (D.employees.find((e) => e.name === name) || {}).code || '0000';

  /* 资金科目：现金(前台钱箱) + 银行存款下的各子科目 */
  const accts = () => D.accounts.filter((a) => a.balance != null);
  const acctShort = (a) => (a.type === '现金' ? '前台钱箱' : a.name);
  const acctLabel = (a) => (a ? (a.type === '现金' ? '现金>' : '银行存款>') + acctShort(a) : '');
  const acctBy = (s) => D.accounts.find((a) => a.balance != null && (a.code === s || a.name === s || acctLabel(a) === s));
  const acctOptions = () => accts().map((a) => [a.code, `${acctLabel(a)}（余额 ${F.money(a.balance)}）`]);
  // 本期增减：按截图预置减少额，增加额 = 余额 + 减少额（期初为 0）
  const preDec = { 1001: 28456, 1002002: 11255 };
  accts().forEach((a) => { a.opening = 0; a.dec = preDec[a.code] || 0; a.inc = r2(a.balance + a.dec); });
  /* 记账：金额正数入账、负数出账 */
  function post(a, amt) {
    if (!a || !amt) return;
    a.balance = r2(a.balance + amt);
    if (amt > 0) a.inc = r2(a.inc + amt); else a.dec = r2(a.dec - amt);
  }
  // 收款方式 → 默认资金科目
  const methodAcct = (m) => acctBy({ 现金: '1001', 现钞: '1001', 微信: '1002031', 在线付款码: '1002031', 支付宝: '1002030', 刷卡: '1002002', 转账: '1002002' }[m] || '');

  /* 记账单（应收）：每个有欠款的客户生成 1~3 张，未销金额合计 = customers.debt */
  const AR = [];
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
  const arOpen = (x) => r2(x.amount - x.cleared);

  /* 销账单（取自旧系统截图） */
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
    const pending = no === 'JS26052810001'; // 北京亚德鲁公司：未审核销账 123.12（对应 customers.writeOffPending）
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
  D.cashJournal.forEach((j) => { j.method = j.method || (j.account === '现金' ? '现钞' : '转账'); j.cust = j.cust || ''; j.billInfo = j.billInfo || ''; });

  /* 数据变化通知：各财务标签页监听 erp:finance-changed 刷新 */
  const changed = () => document.querySelectorAll('.docpage').forEach((p) => p.dispatchEvent(new Event('erp:finance-changed')));
  const onChanged = (el, fn) => el.addEventListener('erp:finance-changed', fn);
  const inRange = (d, r) => d >= r.from && d <= r.to;
  const custOptions = () => h('datalist', { id: 'fin-cust-list' }, D.customers.slice(1).map((c) => h('option', { value: `${c.code}/${c.name}` })));
  const custFromInput = (v) => { const code = String(v || '').split('/')[0].trim(); return D.customers.find((c) => c.code === code || c.name === v.trim()); };
  const card = (code) => D.cards.find((k) => k.custCode === code);
  const pendingOf = (code) => D.writeOffs.filter((w) => w.custCode === code && !w.audited);
  const lastOf = (list, key) => list.reduce((m, x) => (x[key] && (!m || x[key] > m) ? x[key] : m), null);
  const sum = (list, fn) => r2(list.reduce((s, x) => s + (Number(fn(x)) || 0), 0));
  const auditTag = (r) => (r.audited ? '✔' : '');

  /* ====================================================================
   * 财务业务中心：按 支付方式 / 现金 / 应收 / 预存 四栏汇总增(+)减(−)
   * ==================================================================== */
  // 汇总范围内的全部财务单据，返回 [{type, no, date, custName, method, account, amount, handler, audited, cols:{支付方式:±,…}}]
  function finEntries() {
    const E = [];
    const add = (o) => E.push(Object.assign({ custName: '', method: '', account: '', handler: '管理员', remark: '' }, o));
    D.settlements.forEach((s) => {
      const cols = s.method === '记账' ? { 应收: 1 } : s.method === '预存' ? { 预存: -1 } : { 支付方式: 1, 现金: 1 };
      add({ type: '结算单', no: s.no, date: s.date, custName: s.custName, method: s.method, account: acctLabel(methodAcct(s.method)), amount: s.amount, handler: s.handler, audited: s.audited, cols });
    });
    AR.forEach((x) => add({ type: '记账单', no: x.no, date: x.date, custName: x.custName, method: '记账', amount: x.amount, handler: x.handler, audited: true, cols: { 应收: 1 } }));
    D.prestores.forEach((p) => add({ type: '预存单', no: p.no, date: p.date, custName: p.custName, method: p.method, account: acctLabel(methodAcct(p.method)), amount: p.amount, handler: p.handler, audited: p.audited, cols: { 支付方式: 1, 现金: 1, 预存: 1 } }));
    D.writeOffs.forEach((w) => {
      add({ type: '销账单', no: w.no, date: w.date, custName: w.custName, method: w.method, account: w.account, amount: w.amount, handler: w.handler, audited: w.audited, cols: { 应收: -1 } });
      if (w.cash) add({ type: '销账收款', no: w.no, date: w.date, custName: w.custName, method: w.method, account: w.account, amount: w.cash, handler: w.handler, audited: w.audited, cols: { 支付方式: 1, 现金: 1 } });
    });
    D.cashJournal.forEach((j) => {
      const s = j.kind === '一般收入' ? 1 : -1;
      add({ type: j.kind, no: j.no, date: j.date, custName: j.cust, method: j.method, account: acctLabel(acctBy(j.account)), amount: j.amount, handler: j.handler, audited: j.audited, remark: j.type, cols: { 支付方式: s, 现金: s } });
    });
    D.transfers.forEach((t) => {
      add({ type: '转出', no: t.no, date: t.date, method: t.method, account: t.from, amount: t.amount, handler: t.handler, audited: t.audited, remark: t.remark, cols: { 现金: -1 } });
      add({ type: '转入', no: t.no, date: t.date, method: t.method, account: t.to, amount: t.amount, handler: t.handler, audited: t.audited, remark: t.remark, cols: { 现金: 1 } });
    });
    return E;
  }

  ERP.page('finCenter', {
    title: '财务业务中心',
    render(el) {
      const { side, main } = split(el);
      let fAcct = 'all', fMethod = 'all', g, onlyAudited, custKw;
      const dr = ERP.ui.dateRange({ preset: 'month', label: '单据审核时间', onChange: () => g && apply() });
      sidebar(side, [
        { title: '基本条件', body: [dr.el, btn('统计 (T)', () => { apply(); toast('统计完成'); }, 'block')] },
        { key: 'acct', title: '现金银行', closed: true, list: [{ label: '全部', value: 'all' }, ...accts().map((a) => ({ label: acctLabel(a), value: acctLabel(a), icon: a.type === '现金' ? '¥' : '▣' }))],
          value: 'all', onSelect: (v) => { fAcct = v; apply(); } },
        { title: '支付方式', closed: true, list: [{ label: '全部', value: 'all' }, ...['现钞', ...D.payMethods].map((m) => ({ label: m, value: m }))], value: 'all', onSelect: (v) => { fMethod = v; apply(); } },
        { title: '更多条件', closed: true, body: [
          field('客户', (custKw = input({ placeholder: '客户名称', oninput: () => apply() })), { lw: 40 }),
          (onlyAudited = check('只统计已审核单据', false, { onchange: () => apply() })),
        ] },
      ]);
      const cols = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 28px', padding: '6px 10px 10px', background: '#fff', border: '1px solid var(--line)', borderRadius: 'var(--radius)', flex: '0 0 auto' } });
      const caption = h('div.row', h('b', '单据明细'), h('span.muted#fin-cap', '（点击上方汇总行可筛选明细）'), h('span.grow'),
        btn('显示全部', () => { sel = null; apply(); }, 'sm'));
      main.append(cols, caption);
      let sel = null; // 当前选中的汇总行 {col, sign, type}
      g = grid(main, {
        groups: [
          { title: '基础', columns: [{ key: 'type', title: '单据类型', width: 90 }, { key: 'no', title: '单据编号', width: 140 }, { key: 'date', title: '业务日期', type: 'datetime' }] },
          { title: '客户', columns: [{ key: 'custName', title: '客户名称', width: 220 }] },
          { title: '资金', columns: [{ key: 'method', title: '支付方式', width: 80 }, { key: 'account', title: '资金科目', width: 200 }, { key: 'amount', title: '金额', type: 'money', sum: true }] },
          { title: '其他', columns: [{ key: 'handler', title: '经手', width: 80 }, { key: 'audited', title: '审核', type: 'check' }, { key: 'remark', title: '说明备注', width: 160 }] },
        ],
        rows: [], rowColor: (r) => (r.cols && Object.values(r.cols).some((s) => s < 0) ? 'green' : null),
        contextMenu: () => ERP.ui.stdMenu(() => g, [
          { label: '新建转账', action: () => ERP.open('transfer') }, { label: '新建一般收入', action: () => ERP.open('generalIncome') },
          { label: '新建一般支出', action: () => ERP.open('generalExpense') }, { label: '新建销账', action: () => ERP.open('writeOff') }], '财务单据'),
      });
      function apply() {
        const r = dr.value, kw = custKw.value.trim(), au = onlyAudited.querySelector('input').checked;
        const all = finEntries().filter((e) => inRange(e.date, r) && (fAcct === 'all' || e.account === fAcct) && (fMethod === 'all' || e.method === fMethod)
          && (!kw || e.custName.includes(kw)) && (!au || e.audited));
        cols.innerHTML = '';
        for (const col of ['支付方式', '现金', '应收', '预存']) {
          const lines = { 1: {}, '-1': {} };
          all.filter((e) => e.cols[col]).forEach((e) => {
            const s = e.cols[col], key = col === '支付方式' ? e.method || '其他' : e.type;
            const L = (lines[s][key] = lines[s][key] || { key, n: 0, amt: 0 });
            L.n++; L.amt = r2(L.amt + e.amount);
          });
          const sect = (s) => h('div', { style: { minHeight: '46px' } },
            h('div', { style: { color: s > 0 ? 'var(--red)' : 'var(--green)', fontWeight: 700, fontSize: '16px' } }, s > 0 ? '+' : '−'),
            Object.values(lines[s]).map((L) => h('div.row', {
              style: { cursor: 'pointer', padding: '1px 4px', borderRadius: '3px', background: sel && sel.col === col && sel.sign === s && sel.key === L.key ? 'var(--primary-2)' : null },
              onclick: () => { sel = { col, sign: s, key: L.key }; apply(); },
            }, h('span', { style: { width: '90px' } }, L.key), h('span.muted', `${L.n}单`), h('span.grow'), h('span.' + (s > 0 ? 'c-blue' : 'c-green'), { style: { fontFamily: 'var(--mono)' } }, F.money(s * L.amt)))));
          const net = r2(Object.values(lines[1]).reduce((t, L) => t + L.amt, 0) - Object.values(lines[-1]).reduce((t, L) => t + L.amt, 0));
          cols.appendChild(h('div',
            h('div', { style: { fontWeight: 700, padding: '6px 0 4px', borderBottom: '1px solid var(--line)' } }, col),
            sect(1), sect(-1),
            h('div', { style: { borderTop: '1px solid var(--line)', marginTop: '4px', paddingTop: '4px', textAlign: 'right', fontWeight: 700, fontSize: '16px', fontFamily: 'var(--mono)', color: net < 0 ? 'var(--green)' : 'var(--red)' } }, F.money(net))));
        }
        const rows = sel ? all.filter((e) => e.cols[sel.col] === sel.sign && (sel.col === '支付方式' ? (e.method || '其他') === sel.key : e.type === sel.key)) : all;
        caption.querySelector('#fin-cap').textContent = sel ? `（${sel.col} ${sel.sign > 0 ? '+' : '−'} ${sel.key}）` : '（点击上方汇总行可筛选明细）';
        g.setRows(rows.sort((a, b) => b.date - a.date));
      }
      apply();
      onChanged(el, apply);
    },
  });

  /* ====================================================================
   * 智多结算中心：按客户列出未结工单，勾选后批量收款 / 转记账
   * ==================================================================== */
  ERP.page('smartSettle', {
    title: '智多结算中心',
    render(el) {
      const { side, main } = split(el, { sideWidth: 250 });
      let fCust = 'all', fStatus = 'all', g;
      const unpaid = () => D.workOrders.filter((w) => w.unpaid > 0);
      const custList = () => {
        const m = {};
        unpaid().forEach((w) => { (m[w.custCode] = m[w.custCode] || { n: 0, amt: 0, name: w.custName }).n++; m[w.custCode].amt += w.unpaid; });
        return [{ label: '全部客户', value: 'all', count: unpaid().length }].concat(Object.entries(m).sort((a, b) => b[1].amt - a[1].amt)
          .map(([code, x]) => ({ label: `${code} ${x.name}`, value: code, count: x.n, icon: '◆', color: x.amt > 1000 ? 'red' : null })));
      };
      const dr = ERP.ui.dateRange({ preset: 'year', label: '工单登记时间', onChange: () => g && apply() });
      const sb = sidebar(side, [
        { title: '查询条件', body: [dr.el, btn('查询(F)', () => apply(), 'block')] },
        { title: '结算状态', list: [{ label: '全部', value: 'all' }, { label: '尚未结算', value: '尚未结算', icon: '▭' }, { label: '部分结算', value: '部分结算', icon: '◔' }],
          value: 'all', onSelect: (v) => { fStatus = v; apply(); } },
        { key: 'cust', title: '结算客户', list: custList(), value: 'all', onSelect: (v) => { fCust = v; apply(); } },
      ]);
      const info = h('span');
      main.append(h('div.row',
        h('b', '未结工作单'), info, h('span.grow'),
        btn('全选(A)', () => { g.rows.forEach((r) => { if (!g.checked.includes(r)) toggle(r); }); }, 'sm'),
        btn('取消勾选', () => { g.setRows(g.rows); stat(); }, 'sm'),
        btn('批量收款(S)', () => batch('现金收款'), 'sm primary'),
        btn('转记账(J)', () => batch('记账'), 'sm'),
        btn('收款码(M)', () => { const w = g.selected || g.checked[0]; w && biz.payCode ? biz.payCode(w) : toast('请先选择工单'); }, 'sm')));
      // 通过模拟点击复选框实现全选（grid 未提供 check API）
      const toggle = (r) => { const i = g.rows.indexOf(r); const cb = g.el.querySelectorAll('tbody tr')[i]?.querySelector('td.ctr input'); cb && cb.click(); };
      g = grid(main, {
        multi: true, onCheck: () => stat(),
        groups: [
          { title: '基础', columns: [{ key: 'no', title: '工单编号', width: 140 }, { key: 'created', title: '登记时间', type: 'short', width: 110 }, { key: 'custCode', title: '客户编号', width: 80 }, { key: 'custName', title: '客户名称', width: 220 }, { key: 'group', title: '客户分组', width: 110 }] },
          { title: '特征', columns: [{ key: 'task', title: '制作任务', width: 130 }, { key: 'req', title: '制作要求', width: 160 }] },
          { title: '金额', columns: [{ key: 'amount', title: '实收', type: 'money', sum: true }, { key: 'paid', title: '已结', type: 'money', sum: true, hideZero: true }, { key: 'unpaid', title: '未结', type: 'money', sum: true }] },
          { title: '状态', columns: [{ key: 'settleStatus', title: '结算状态', width: 80 }, { key: 'flow', title: '生产流程', width: 70, align: 'center' }] },
        ],
        rows: [], rowColor: (w) => D.flowColor(w.flow),
        onDblClick: (w) => biz.openOrder && biz.openOrder(w.no),
        contextMenu: (w) => ERP.ui.stdMenu(() => g, [
          { label: '打开工单', disabled: !w, action: () => biz.openOrder && biz.openOrder(w.no) },
          { label: '单张收款结算', disabled: !w || !biz.settle, action: () => biz.settle(w, () => { biz.notifyOrdersChanged && biz.notifyOrdersChanged(); changed(); }) },
          { label: '客户对账', disabled: !w, action: () => ERP.open('custStatement', { cust: w.custCode }) },
        ], '未结工单'),
      });
      function stat() {
        const c = g.checked;
        info.innerHTML = '';
        info.append(`共 ${g.rows.length} 单，未结 `, h('b.c-red', F.money(sum(g.rows, (w) => w.unpaid))), ` ；已勾选 ${c.length} 单，合计 `, h('b.c-blue', F.money(sum(c, (w) => w.unpaid))));
      }
      function apply() {
        const r = dr.value;
        g.setRows(unpaid().filter((w) => inRange(w.created, r) && (fCust === 'all' || w.custCode === fCust) && (fStatus === 'all' || w.settleStatus === fStatus)));
        stat();
      }
      function batch(mode) {
        const list = g.checked.length ? g.checked : g.selected ? [g.selected] : [];
        if (!list.length) return toast('请勾选要结算的工单');
        batchSettle(list, mode, () => { sb.cust.setList(custList()); apply(); biz.notifyOrdersChanged && biz.notifyOrdersChanged(); });
      }
      apply();
      onChanged(el, () => { sb.cust.setList(custList()); apply(); });
      el.addEventListener('erp:orders-changed', () => { sb.cust.setList(custList()); apply(); });
    },
  });

  /* 批量结算对话框 */
  function batchSettle(list, mode, done) {
    const total = sum(list, (w) => w.unpaid), custs = [...new Set(list.map((w) => w.custCode))];
    let m = mode;
    const acct = select(acctOptions()), method = select(['现钞', '微信', '支付宝', '刷卡', '转账']), remark = input();
    method.addEventListener('change', () => { const a = methodAcct(method.value); if (a) acct.value = a.code; });
    const modeBox = h('div.col');
    const right = h('div.fieldset');
    const renderMode = () => {
      modeBox.innerHTML = '';
      ['现金收款', '扫码收款', '记账', '预存扣款'].forEach((x) => modeBox.appendChild(h('button.btn' + (x === m ? '.primary' : ''), { onclick: () => { m = x; renderMode(); } }, x)));
      right.innerHTML = '';
      right.appendChild(h('legend', m));
      if (m === '现金收款' || m === '扫码收款') {
        if (m === '扫码收款') method.value = '微信';
        method.dispatchEvent(new Event('change'));
        right.append(field('入账科目', acct, { lw: 64 }), field('支付方式', method, { lw: 64 }));
      } else if (m === '记账') {
        right.append(h('div.note', '所选工单将转为客户记账（应收），计入各客户「记账未销」，以后通过「销账」收回。'));
      } else {
        right.append(h('div.kv', ...custs.flatMap((c) => { const k = card(c); return [h('b', D.customer(c).name), k ? `卡号 ${k.cardNo}，预存余额 ${F.money(k.balance)}` : h('span.c-red', '无预存卡')]; })));
      }
      right.append(field('说明备注', remark, { lw: 64 }));
    };
    renderMode();
    dialog({
      title: '智多结算 - 批量收款', width: 760, banner: '对勾选的多张工作单一次性完成结算',
      body: h('div.col',
        h('div.fieldset', h('legend', '结算信息'), h('div.row', { style: { justifyContent: 'space-between' } },
          h('span', '客户数：', h('b', custs.length)), h('span', '工单数：', h('b', list.length)),
          h('span', '此次结算：', h('b.c-red', { style: { fontSize: '22px' } }, F.money(total))))),
        h('div', { style: { display: 'grid', gridTemplateColumns: '160px 1fr', gap: '10px' } }, h('div.fieldset', h('legend', '结算方式'), modeBox), right)),
      buttons: [
        { label: '✔ 确定(S)', primary: true, action: (close) => {
          if (m === '预存扣款') {
            for (const c of custs) {
              const k = card(c), need = sum(list.filter((w) => w.custCode === c), (w) => w.unpaid);
              if (!k || k.balance < need) { toast(`${D.customer(c).name} 预存余额不足`); return false; }
            }
          }
          const a = acctBy(acct.value);
          list.forEach((w) => {
            const v = w.unpaid;
            const pm = m === '记账' ? '记账' : m === '预存扣款' ? '预存' : method.value === '现钞' ? '现金' : method.value;
            w.paid = r2(w.paid + v); w.unpaid = 0; w.settleStatus = '完成结算';
            D.settlements.unshift({ no: nextNo('JS', D.settlements), date: new Date(), custCode: w.custCode, custName: w.custName, handler: D.currentUser.name, method: pm,
              amount: v, discount: 0, wipe: 0, orderNo: w.no, audited: true, invoice: false, remark: remark.value });
            const c = D.customer(w.custCode);
            if (m === '记账') {
              c.debt = r2((c.debt || 0) + v);
              AR.push({ no: nextNo('JZ', AR), date: new Date(), custCode: w.custCode, custName: w.custName, orderNo: w.no, task: w.task, amount: v, cleared: 0, handler: D.currentUser.name, method: '记账' });
            } else if (m === '预存扣款') {
              const k = card(w.custCode); k.balance = r2(k.balance - v); k.totalOut = r2(k.totalOut + v); c.prestoreBalance = k.balance;
            } else post(a, v);
          });
          close(); toast(`已结算 ${list.length} 张工单，合计 ${F.money(total)}（${m}）`); changed(); done && done();
        } },
        { label: '✕ 关闭(C)' },
      ],
    });
  }

  /* ====================================================================
   * 现金余额 / 银行余额（科目余额对话框）
   * ==================================================================== */
  function balanceDialog(kind) {
    const bank = kind === '银行';
    const rows = () => accts().filter((a) => a.type === kind).map((a) => ({ a, code: a.code, name: acctShort(a), opening: a.opening, inc: a.inc, dec: a.dec, balance: a.balance }));
    let g;
    dialog({
      title: bank ? '银行科目余额' : '现金科目余额', width: bank ? 1000 : 860, height: 520,
      banner: `实时查询所有${kind}科目的本期收入、支出及当前余额`,
      body: (b) => {
        g = grid(b, {
          columns: [...(bank ? [{ key: 'code', title: '科目编号', width: 110 }] : []), { key: 'name', title: bank ? '银行科目' : '科目', width: bank ? 260 : 240 },
            { key: 'opening', title: '期初余额', type: 'money', sum: true, width: 110 }, { key: 'inc', title: '本期增加', type: 'money', sum: true, width: 110 },
            { key: 'dec', title: '本期减少', type: 'money', sum: true, width: 110 }, { key: 'balance', title: '当前余额', type: 'money', sum: true, width: 120 }],
          rows: rows(), footerLabel: false,
          onDblClick: (r) => ERP.open('transfer', { from: r.code }),
          contextMenu: (r) => ERP.ui.stdMenu(() => g, [
            { label: '转账(Z)', action: () => ERP.open('transfer', r ? { from: r.code } : {}) },
            { label: '收支记录', action: () => ERP.open('generalRecords') }, { label: '转账记录', action: () => ERP.open('transferRecords') }], kind + '科目余额'),
        });
      },
      leftButtons: [{ label: '转账(Z)', action: () => { ERP.open('transfer', g.selected ? { from: g.selected.code, onDone: () => g.setRows(rows()) } : { onDone: () => g.setRows(rows()) }); } }],
      buttons: [{ label: '✔ 刷新[S]', primary: true, action: () => { g.setRows(rows()); toast('已刷新'); } }, { label: '✕ 关闭(C)' }],
    });
  }
  ERP.page('cashBalance', { title: '现金余额', kind: 'dialog', render: () => balanceDialog('现金') });
  ERP.page('bankBalance', { title: '银行余额', kind: 'dialog', render: () => balanceDialog('银行') });

  /* ====================================================================
   * 转账：新建转账 + 转账记录
   * ==================================================================== */
  ERP.page('transfer', {
    title: '新建转账', kind: 'dialog',
    render(_, p = {}) {
      const no = nextNo('ZZ', D.transfers);
      const from = select(acctOptions(), { value: p.from || '1001' }), to = select(acctOptions(), { value: p.to || (p.from === '1002002' ? '1001' : '1002002') });
      const amt = input({ value: '0.00', style: { fontSize: '28px', height: '48px', textAlign: 'right', fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--mono)' } });
      const date = input({ type: 'date', value: F.date(now) }), method = select(['转账', '现钞', '微信', '支付宝', '刷卡']), fee = input({ value: '0.00', style: { textAlign: 'right' } });
      const inv = check('已收发票'), bill = input({ placeholder: '发票 / 回单号' }), handler = select(D.employees.map((e) => e.name), { value: D.currentUser.name }), remark = input();
      const hint = h('div.muted');
      const upd = () => { const a = acctBy(from.value), b = acctBy(to.value); hint.textContent = `转出后 ${acctLabel(a)} 余额：${F.money(a.balance - (+amt.value || 0) - (+fee.value || 0))}；转入后 ${acctLabel(b)} 余额：${F.money(b.balance + (+amt.value || 0))}`; };
      [from, to, amt, fee].forEach((x) => x.addEventListener('input', upd));
      upd();
      dialog({
        title: '新建转账', width: 680, banner: '在现金、银行科目之间划转资金（存现、取现、第三方平台提现等）',
        body: h('div.col',
          h('div.formgrid.c2', field('转账单号', input({ value: no, readOnly: true }), { lw: 64 }), field('业务日期', date, { lw: 64 })),
          h('div.fieldset', h('legend', '转账'), field('转出科目', from, { lw: 64 }), field('转入科目', to, { lw: 64 }), field('转账金额', amt, { lw: 64 }), hint),
          h('div.fieldset', h('legend', '更多'), h('div.formgrid.c2', field('支付方式', method, { lw: 64 }), field('手续费用', fee, { lw: 64 }), field('票据信息', bill, { lw: 64 }), h('div', inv))),
          h('div.formgrid.c2', field('经手', handler, { lw: 64 }), field('说明备注', remark, { lw: 64 }))),
        leftButtons: [{ label: '转账记录(R)', action: () => { ERP.open('transferRecords'); } }],
        buttons: [
          { label: '✔ 确定(S)', primary: true, action: (close) => {
            const a = acctBy(from.value), b = acctBy(to.value), v = r2(+amt.value || 0), f = r2(+fee.value || 0);
            if (a === b) return toast('转出科目与转入科目不能相同');
            if (v <= 0) return toast('请输入转账金额');
            if (v + f > a.balance) return toast(`${acctLabel(a)} 余额不足（${F.money(a.balance)}）`);
            post(a, -(v + f)); post(b, v);
            D.transfers.unshift({ no, date: new Date(date.value + 'T' + F.datetime(new Date()).slice(11)), from: acctLabel(a), to: acctLabel(b), amount: v, method: method.value, fee: f,
              invoice: inv.querySelector('input').checked, billInfo: bill.value, handler: handler.value, audited: false, auditTime: null, remark: remark.value });
            close(); toast(`转账成功：${acctShort(a)} → ${acctShort(b)} ${F.money(v)}`); changed(); p.onDone && p.onDone();
          } },
          { label: '✕ 关闭(C)' },
        ],
      });
    },
  });

  /* 通用记录列表的「审核/反审核、删除」菜单 */
  const recMenu = (getGrid, r, { audit, remove, extra = [], name }) => ERP.ui.stdMenu(getGrid, [
    ...extra,
    { label: r && r.audited ? '反审核(U)' : '审核(G)', shortcut: 'Ctrl+G', disabled: !r, action: () => { audit(r); changed(); toast(r.audited ? '已审核：单据不可再修改/删除' : '已反审核'); } },
    { label: '删除(D)', disabled: !r, action: () => r.audited ? toast('已审核单据不能删除，请先反审核') : ERP.ui.confirm(`确定删除单据 ${r.no}？`, () => { remove(r); changed(); toast('已删除：' + r.no); }) },
  ], name);
  const setAudit = (r) => { r.audited = !r.audited; r.auditTime = r.audited ? new Date() : null; };
  const featureList = () => [{ label: '全部', value: 'all' }, { label: '已审核', value: 'y', icon: '✔' }, { label: '未审核', value: 'n', icon: '□', color: 'red' }];
  const featureOk = (f, r) => f === 'all' || (f === 'y') === !!r.audited;
  const acctList = () => [{ label: '全部', value: 'all' }, ...accts().map((a) => ({ label: acctLabel(a), value: acctLabel(a) }))];

  ERP.page('transferRecords', {
    title: '转账记录',
    render(el) {
      const { side, main } = split(el);
      const f = { from: 'all', to: 'all', feat: 'all' };
      let g;
      const dr = ERP.ui.dateRange({ preset: 'year', onChange: () => g && apply() });
      sidebar(side, [
        { title: '基本条件', body: [dr.el, btn('查询(F)', () => apply(), 'block')] },
        { title: '转出科目', closed: true, list: acctList(), value: 'all', onSelect: (v) => { f.from = v; apply(); } },
        { title: '转入科目', closed: true, list: acctList(), value: 'all', onSelect: (v) => { f.to = v; apply(); } },
        { title: '单据特征', closed: true, list: featureList(), value: 'all', onSelect: (v) => { f.feat = v; apply(); } },
      ]);
      g = grid(main, {
        groups: [
          { title: '基础', columns: [{ key: 'no', title: '转账单号', width: 150 }, { key: 'date', title: '业务日期', type: 'date' }] },
          { title: '转账', columns: [{ key: 'from', title: '转出科目', width: 220 }, { key: 'to', title: '转入科目', width: 220 }, { key: 'amount', title: '转账金额', type: 'money', sum: true, width: 110 }] },
          { title: '更多', columns: [{ key: 'method', title: '支付方式', width: 90 }, { key: 'fee', title: '手续费用', type: 'money', sum: true }, { key: 'invoice', title: '已收发票', type: 'check', width: 80 }, { key: 'billInfo', title: '票据信息', width: 110 }] },
          { title: '其他', columns: [{ key: 'handler', title: '经手', width: 90 }, { key: 'audited', title: '审核', type: 'check', width: 70 }, { key: 'auditTime', title: '审核时间', type: 'datetime' }, { key: 'remark', title: '说明备注', width: 160 }] },
        ],
        rows: [], rowClass: (r) => (r.audited ? '' : 'bold'),
        contextMenu: (r) => recMenu(() => g, r, { name: '转账记录',
          extra: [{ label: '新建转账(N)', action: () => ERP.open('transfer') }, { label: '现金余额', action: () => ERP.open('cashBalance') }, { label: '银行余额', action: () => ERP.open('bankBalance') }, '-'],
          audit: setAudit,
          remove: (t) => { post(acctBy(t.from), t.amount + t.fee); post(acctBy(t.to), -t.amount); D.transfers.splice(D.transfers.indexOf(t), 1); } }),
      });
      function apply() {
        const r = dr.value;
        g.setRows(D.transfers.filter((t) => inRange(t.date, r) && (f.from === 'all' || t.from === f.from) && (f.to === 'all' || t.to === f.to) && featureOk(f.feat, t)));
      }
      apply();
      onChanged(el, apply);
    },
  });

  /* ====================================================================
   * 客户结余统计（报表窗口）：记账结余 / 预存结余
   * ==================================================================== */
  const woCols = () => ({ title: '销账', columns: [
    { key: 'pn', title: '未审销账单数', type: 'int', sum: true, hideZero: true, width: 100, render: (r) => (r.pn ? String(r.pn) : '') },
    { key: 'preal', title: '未审销账实结', type: 'money', sum: true, hideZero: true, width: 100 },
    { key: 'pwipe', title: '未审销账抹零', type: 'money', sum: true, hideZero: true, width: 100 },
    { key: 'pamt', title: '未审销账金额', type: 'money', sum: true, hideZero: true, width: 100 },
    { key: 'lastReg', title: '最后销账登记', type: 'date', width: 100 }, { key: 'lastAudit', title: '最后销账审核', type: 'date', width: 100 }] });
  const custCols = () => ({ title: '客户', columns: [{ key: 'code', title: '编号', width: 70 }, { key: 'name', title: '名称', width: 240 }, { key: 'groupName', title: '分组', width: 120 }] });
  // 一个客户的记账结余行（open = 记账未销）
  function arRow(c, open) {
    const p = pendingOf(c.code), all = D.writeOffs.filter((w) => w.custCode === c.code);
    const pamt = sum(p, (w) => w.amount);
    return { c, code: c.code, name: c.name, groupName: c.groupName, open, pendingAmt: pamt, bal: r2(open + pamt), pn: p.length, preal: sum(p, (w) => w.real), pwipe: sum(p, (w) => w.wipe), pamt,
      lastReg: lastOf(all, 'date'), lastAudit: lastOf(all, 'auditTime') || c.lastAudit, remark: c.remark };
  }
  ERP.page('custBalance', {
    title: '客户结余统计', kind: 'dialog',
    render() {
      let kw, grp = 'all', g1, g2;
      const match = (c) => c.code !== '000000' && (grp === 'all' || c.group === grp) && (!kw.value.trim() || c.name.includes(kw.value.trim()) || c.code.includes(kw.value.trim()));
      const stat = () => {
        g1 && g1.setRows(D.customers.filter((c) => match(c) && (c.debt > 0 || pendingOf(c.code).length)).map((c) => arRow(c, c.debt)));
        g2 && g2.setRows(D.cards.filter((k) => match(D.customer(k.custCode) || {})).map((k) => {
          const c = D.customer(k.custCode), ps = D.prestores.filter((p) => p.custCode === k.custCode);
          return { k, code: c.code, name: c.name, groupName: c.groupName, cardNo: k.cardNo, totalIn: k.totalIn, gift: sum(ps, (p) => p.gift), totalOut: k.totalOut, balance: k.balance, lastIn: lastOf(ps, 'date'), remark: c.remark };
        }));
      };
      ERP.ui.reportWindow({
        title: '客户结余统计-[报表]',
        banner: '基于已审核的结算单、预存、退款单，以及未审核的销账单，汇总统计客户的应收、预存结余数据。',
        side: (s) => sidebar(s, [
          { title: '查询条件', body: field('客户名称', (kw = input({ oninput: () => stat() })), { lw: 56 }) },
          { title: '客户分组', list: [{ label: '[全部]', value: 'all' }, ...D.groups.map((x) => ({ label: `${x.code} - ${x.name}`, value: x.code }))], value: 'all', onSelect: (v) => { grp = v; stat(); } },
        ]),
        render: (m) => ERP.ui.itabs(m, [
          { title: '记账结余', render: (p) => {
            g1 = grid(p, {
              groups: [custCols(), { title: '结余', columns: [{ key: 'open', title: '记账未销', type: 'money', sum: true, width: 100 }, { key: 'pendingAmt', title: '销账未审', type: 'money', sum: true, hideZero: true, width: 100 }, { key: 'bal', title: '记账结余', type: 'money', sum: true, width: 100 }] },
                woCols(), { title: '控制', columns: [{ key: 'remark', title: '对账备注', width: 140 }] }],
              rows: [], rowClass: (r) => (r.pn ? 'bold' : ''), footerLabel: false,
              onDblClick: (r) => ERP.open('custStatement', { cust: r.code }),
              contextMenu: (r) => ERP.ui.stdMenu(() => g1, [{ label: '客户对账', disabled: !r, action: () => ERP.open('custStatement', { cust: r.code }) },
                { label: '新建销账', disabled: !r, action: () => ERP.open('writeOff', { cust: r.code }) }], '记账结余'),
            });
            stat();
          } },
          { title: '预存结余', render: (p) => {
            g2 = grid(p, {
              groups: [custCols(), { title: '预存', columns: [{ key: 'cardNo', title: '预存卡号', width: 100 }, { key: 'totalIn', title: '累计储值', type: 'money', sum: true }, { key: 'gift', title: '累计赠送', type: 'money', sum: true },
                { key: 'totalOut', title: '累计消费', type: 'money', sum: true }, { key: 'balance', title: '预存结余', type: 'money', sum: true }] },
                { title: '控制', columns: [{ key: 'lastIn', title: '最后储值', type: 'date' }, { key: 'remark', title: '对账备注', width: 140 }] }],
              rows: [], footerLabel: false, contextMenu: () => ERP.ui.stdMenu(() => g2, [], '预存结余'),
            });
            stat();
          } },
        ]),
        onStat: () => { stat(); toast('统计完成'); },
        onExport: () => (g1 || g2).exportCsv('客户结余统计'),
      });
    },
  });

  /* ====================================================================
   * 应收汇总（报表窗口）
   * ==================================================================== */
  ERP.page('arSummary', {
    title: '应收汇总', kind: 'dialog',
    render() {
      let g, a, b, only;
      const stat = () => {
        const from = a.value, to = new Date(+b.value + 864e5 - 1000), within = (d) => d >= from && d <= to;
        const rows = D.customers.filter((c) => c.code !== '000000').map((c) => {
          const open = sum(AR.filter((x) => x.custCode === c.code && within(x.date)), arOpen);
          const r = arRow(c, open);
          const p = pendingOf(c.code).filter((w) => within(w.date));
          return Object.assign(r, { pendingAmt: sum(p, (w) => w.amount), bal: r2(open + sum(p, (w) => w.amount)), pn: p.length, preal: sum(p, (w) => w.real), pwipe: sum(p, (w) => w.wipe), pamt: sum(p, (w) => w.amount) });
        });
        g.setRows(only.querySelector('input').checked ? rows.filter((r) => r.bal > 0) : rows);
      };
      ERP.ui.reportWindow({
        title: '客户应收汇总-[报表]', banner: '统计在指定时间期限内，已审核的记账及临欠单据的已销、结余情况。', sideWidth: 290,
        side: (s) => {
          a = ERP.ui.ymd(new Date(now.getFullYear(), 0, 1)); b = ERP.ui.ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0));
          only = check('只显示有未结金额的', true, { onchange: () => stat() });
          sidebar(s, [{ title: '查询条件', body: [field('开始', a.el, { lw: 34 }), field('结束', b.el, { lw: 34 }), only] }]);
        },
        render: (m) => ERP.ui.itabs(m, [{ title: '应收记账', render: (p) => {
          g = grid(p, {
            groups: [custCols(), { title: '期间结余', columns: [{ key: 'open', title: '记账未销', type: 'money', sum: true, width: 100 }, { key: 'pendingAmt', title: '销账未审', type: 'money', sum: true, width: 100 }, { key: 'bal', title: '记账结余', type: 'money', sum: true, width: 100 }] },
              Object.assign(woCols(), { title: '期间销账' }), { title: '控制', columns: [{ key: 'remark', title: '对账备注', width: 140 }] }],
            rows: [], footerLabel: false,
            onDblClick: (r) => ERP.open('custStatement', { cust: r.code }),
            contextMenu: (r) => ERP.ui.stdMenu(() => g, [{ label: '客户对账', disabled: !r, action: () => ERP.open('custStatement', { cust: r.code }) },
              { label: '新建销账', disabled: !r, action: () => ERP.open('writeOff', { cust: r.code }) }], '应收汇总'),
          });
        } }]),
        onStat: () => { stat(); toast('统计完成'); },
        onExport: () => g.exportCsv('客户应收汇总'),
      });
      stat();
    },
  });

  /* ====================================================================
   * 客户对账（窗口）：结算单据 / 工作单据
   * ==================================================================== */
  ERP.page('custStatement', {
    title: '客户对账', kind: 'dialog',
    render(_, p = {}) {
      let cust = p.cust ? D.customer(p.cust) : null, g1, g2, scope = 'all', view = '单据记录';
      const ci = input({ list: 'fin-cust-list', placeholder: '输入客户编号 / 名称，回车或选择后自动查询', value: cust ? `${cust.code}/${cust.name}` : '', style: { background: '#f0f9ff' } });
      const from = input({ type: 'datetime-local', value: `${now.getFullYear()}-01-01T00:00:01` }), to = input({ type: 'datetime-local', value: F.date(now) + 'T23:59:59' });
      const info = h('div.row.muted');
      const radio = (name, v, cur, on) => h('label.chk', h('input', { type: 'radio', name, checked: v === cur, onchange: () => on(v) }), v);
      const refresh = () => {
        info.innerHTML = '';
        if (!cust) { g1 && g1.setRows([]); g2 && g2.setRows([]); info.append('请选择对账客户'); return; }
        const k = card(cust.code);
        info.append(h('span', '客户：', h('b', `${cust.code}/${cust.name}`)), h('span', '分组：' + cust.groupName), h('span', '联系人：' + (cust.contact || '-') + ' ' + (cust.phone || '')),
          h('span', '记账结余：', h('b.c-red', F.money(cust.debt))), h('span', '销账未审：', h('b.c-blue', F.money(sum(pendingOf(cust.code), (w) => w.amount)))),
          h('span', '预存余额：', h('b.c-green', F.money(k ? k.balance : 0))));
        const a = new Date(from.value), b = new Date(to.value);
        const docs = AR.filter((x) => x.custCode === cust.code).concat(D.settlements.filter((s) => s.custCode === cust.code && s.method !== '记账')
          .map((s) => ({ no: s.no, date: s.date, handler: s.handler, method: s.method, orderNo: s.orderNo, task: (D.workOrders.find((w) => w.no === s.orderNo) || {}).task || '', amount: s.amount, cleared: s.amount })));
        const rows = docs.filter((x) => x.date >= a && x.date <= b).map((x) => {
          const open = arOpen(x);
          return Object.assign({}, x, { uncleared: open, age: open > 0 ? Math.floor((now - x.date) / 864e5) + '天' : '' });
        }).filter((x) => scope === '全部的' || scope === 'all' || (scope === '未结清' ? x.uncleared > 0 : x.uncleared <= 0)).sort((x, y) => x.date - y.date);
        g1 && g1.setRows(view === '单据记录' ? rows : summarize(rows));
        g2 && g2.setRows(D.workOrders.filter((w) => w.custCode === cust.code && w.created >= a && w.created <= b
          && (scope === 'all' || scope === '全部的' || (scope === '未结清' ? w.unpaid > 0 : w.unpaid <= 0))));
      };
      // 明细汇总：按结算方式汇总
      const summarize = (rows) => Object.values(rows.reduce((m, x) => {
        const s = (m[x.method] = m[x.method] || { no: `【${x.method}】汇总`, method: x.method, amount: 0, cleared: 0, uncleared: 0, task: '' });
        s.amount = r2(s.amount + x.amount); s.cleared = r2(s.cleared + x.cleared); s.uncleared = r2(s.uncleared + x.uncleared); return m;
      }, {}));
      ci.addEventListener('change', () => { cust = custFromInput(ci.value) || null; if (!cust) toast('未找到客户'); refresh(); });
      [from, to].forEach((x) => x.addEventListener('change', refresh));
      dialog({
        title: '客户对账', maximized: true, width: 1200, height: 760, banner: '统计客户的财务状况信息，消费明细，打印、发送对账单',
        body: (b) => {
          b.append(custOptions(),
            h('div.fieldset', h('legend', '对账客户'), h('div.row', h('div.grow', ci), btn('🔍 查找', () => ci.dispatchEvent(new Event('change')), 'sm'), btn('读卡(D)', () => toast('请将 IC 卡放到读卡器（原型）'), 'sm')), info));
          const box = h('div.fieldset', { style: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } }, h('legend', '对账信息'));
          b.append(box);
          const bar = h('div.row', select(['登记时间', '业务日期', '审核时间'], { style: { width: '100px' } }), from, '-', to, h('span.grow'),
            ...['未结清', '已结清', '全部的'].map((v) => radio('cs-scope', v, '全部的', (x) => { scope = x; refresh(); })));
          box.append(bar);
          ERP.ui.itabs(box, [
            { title: '结算单据', render: (pn) => {
              g1 = grid(pn, {
                groups: [
                  { title: '基础', columns: [{ key: 'no', title: '结算单号', width: 150 }, { key: 'date', title: '结算日期', type: 'date' }, { key: 'handler', title: '结算经手', width: 90 }, { key: 'method', title: '结算方式', width: 90 }] },
                  { title: '工单', columns: [{ key: 'orderNo', title: '工作单号', width: 150 }, { key: 'task', title: '工单任务', width: 130 }] },
                  { title: '金额', columns: [{ key: 'amount', title: '结算金额', type: 'money', sum: true }, { key: 'cleared', title: '已清金额', type: 'money', sum: true }, { key: 'uncleared', title: '未清金额', type: 'money', sum: true }] },
                  { title: '其他', columns: [{ key: 'age', title: '欠款账龄', width: 80 }] },
                ],
                rows: [], footerLabel: false, rowColor: (r) => (r.uncleared > 0 ? 'red' : null),
                onDblClick: (r) => r.orderNo && biz.openOrder && D.workOrders.some((w) => w.no === r.orderNo) && biz.openOrder(r.orderNo),
                contextMenu: () => ERP.ui.stdMenu(() => g1, [{ label: '销账(J)', action: () => doWriteOff() }], '客户对账'),
              });
              refresh();
            } },
            { title: '工作单据', render: (pn) => {
              g2 = grid(pn, {
                groups: [{ title: '基础', columns: [{ key: 'no', title: '工单编号', width: 150 }, { key: 'created', title: '登记日期', type: 'date' }, { key: 'task', title: '制作任务', width: 130 }, { key: 'req', title: '制作要求', width: 200 }] },
                  { title: '金额', columns: [{ key: 'amount', title: '实收', type: 'money', sum: true }, { key: 'paid', title: '已结', type: 'money', sum: true }, { key: 'unpaid', title: '未结', type: 'money', sum: true }] },
                  { title: '状态', columns: [{ key: 'settleStatus', title: '结算状态', width: 90 }, { key: 'flow', title: '生产流程', width: 80 }] }],
                rows: [], footerLabel: false, rowColor: (w) => D.flowColor(w.flow), onDblClick: (w) => biz.openOrder && biz.openOrder(w.no),
                contextMenu: () => ERP.ui.stdMenu(() => g2, [], '客户工单'),
              });
              refresh();
            } },
          ]);
          box.append(h('div.row', ...['单据记录', '明细汇总', '明细记录'].map((v) => radio('cs-view', v, '单据记录', (x) => { view = x === '明细汇总' ? x : '单据记录'; refresh(); }))));
          b.append(h('div.row', h('span', { style: { whiteSpace: 'nowrap' } }, '打印时标注说明备注'), h('div.grow', input())));
        },
        leftButtons: [{ label: '导出(P)', action: () => { g1 && g1.exportCsv('客户对账'); } }, { label: '打印', action: () => { cust ? window.print() : toast('请先选择对账客户'); } }],
        buttons: [{ label: '销账(J)', action: () => doWriteOff() }, { label: '✔ 刷新[S]', primary: true, action: () => { refresh(); toast('已刷新'); } }, { label: '✕ 关闭(C)' }],
      });
      function doWriteOff() { if (!cust) return toast('请先选择对账客户'); openWriteOff(cust.code, refresh); }
    },
  });

  /* ====================================================================
   * 销账：新建销账 + 销账记录
   * ==================================================================== */
  ERP.page('writeOff', { title: '新建销账', kind: 'dialog', render: (_, p = {}) => openWriteOff(p.cust) });

  function openWriteOff(custCode, done) {
    let cust = custCode ? D.customer(custCode) : null, rows = [], g;
    const no = nextNo('JS', D.writeOffs);
    const ci = input({ list: 'fin-cust-list', placeholder: '输入客户编号 / 名称', value: cust ? `${cust.code}/${cust.name}` : '' });
    const info = h('span.muted');
    const ro = (v = '0.00') => input({ value: v, readOnly: true, style: { textAlign: 'right', fontFamily: 'var(--mono)' } });
    const num = () => input({ value: '0.00', style: { textAlign: 'right', fontFamily: 'var(--mono)' } });
    const E = { amount: ro(), wipe: num(), real: ro(), prestore: num(), cash: ro(), fee: num() };
    E.amount.style.color = 'var(--primary)'; E.amount.style.fontWeight = 700;
    const acct = select(acctOptions()), method = select(['现钞', '微信', '支付宝', '刷卡', '转账']), date = input({ type: 'date', value: F.date(now) });
    const custHandler = input(), bill = input(), inv = check('已开发票'), remark = input();
    method.addEventListener('change', () => { const a = methodAcct(method.value); if (a) acct.value = a.code; });
    const calc = () => {
      const amt = sum(rows, (r) => (r.pick ? r.thisAmt : 0)), real = r2(amt - (+E.wipe.value || 0)), cash = r2(real - (+E.prestore.value || 0));
      E.amount.value = F.money(amt); E.real.value = F.money(real); E.cash.value = F.money(cash);
      return { amt, real, cash };
    };
    [E.wipe, E.prestore].forEach((x) => x.addEventListener('input', calc));
    const load = () => {
      rows = cust ? AR.filter((x) => x.custCode === cust.code && arOpen(x) > 0).map((x) => ({ x, pick: false, no: x.no, date: x.date, orderNo: x.orderNo, task: x.task, amount: x.amount, cleared: x.cleared, open: arOpen(x), thisAmt: 0 })) : [];
      info.textContent = cust ? `记账结余：${F.money(cust.debt)}　销账未审：${F.money(sum(pendingOf(cust.code), (w) => w.amount))}　预存余额：${F.money((card(cust.code) || {}).balance || 0)}` : '请选择客户';
      g && g.setRows(rows); calc();
    };
    ci.addEventListener('change', () => { cust = custFromInput(ci.value) || null; if (!cust) toast('未找到客户'); load(); });
    const pickAll = (on) => { rows.forEach((r) => { r.pick = on; r.thisAmt = on ? r.open : 0; }); g.refresh(); calc(); };
    dialog({
      title: '新建销账', width: 1000, height: 720, banner: '收回客户记账（应收）款项，冲销对应的记账单据',
      body: (b) => {
        b.append(custOptions(),
          h('div.formgrid.c3', field('销账单号', input({ value: no, readOnly: true }), { lw: 60 }), field('业务日期', date, { lw: 60 }), field('经手', input({ value: D.currentUser.name, readOnly: true }), { lw: 60 })),
          h('div.fieldset', h('legend', '销账客户'), h('div.row', h('div.grow', ci), btn('读卡(D)', () => toast('请将 IC 卡放到读卡器（原型）'), 'sm')), info),
          h('div.row', h('b', '记账单据'), h('span.muted', '勾选要销账的单据，可修改「本次销账」金额'), h('span.grow'), btn('全部销账(A)', () => pickAll(true), 'sm'), btn('清除(X)', () => pickAll(false), 'sm')));
        g = grid(b, {
          columns: [{ key: 'pick', title: '销账', type: 'check', editable: true, width: 50, onChange: (r) => { r.thisAmt = r.pick ? r.open : 0; g.refresh(); calc(); } },
            { key: 'no', title: '记账单号', width: 150 }, { key: 'date', title: '业务日期', type: 'date' }, { key: 'orderNo', title: '工作单号', width: 150 }, { key: 'task', title: '工单任务', width: 110 },
            { key: 'amount', title: '记账金额', type: 'money', sum: true }, { key: 'cleared', title: '已销金额', type: 'money', sum: true }, { key: 'open', title: '未销金额', type: 'money', sum: true },
            { key: 'thisAmt', title: '本次销账', type: 'money', sum: true, editable: true, onChange: (r) => { r.thisAmt = Math.max(0, Math.min(r.open, r2(r.thisAmt))); r.pick = r.thisAmt > 0; g.refresh(); calc(); } }],
          rows: [], height: 230, footerLabel: false, emptyText: '该客户没有未销的记账单据',
        });
        b.append(h('div.fieldset', h('legend', '结算'), h('div.formgrid.c3',
          field('结算金额', E.amount, { lw: 60 }), field('抹零金额', E.wipe, { lw: 60 }), field('实结金额', E.real, { lw: 60 }),
          field('预存实结', E.prestore, { lw: 60 }), field('现金实结', E.cash, { lw: 60 }), field('现金科目', acct, { lw: 60 }),
          field('支付方式', method, { lw: 60 }), field('手续费用', E.fee, { lw: 60 }), field('客方经手', custHandler, { lw: 60 }))),
          h('div.formgrid.c3', field('票据信息', bill, { lw: 60 }), h('div', inv), h('div')), field('说明备注', remark, { lw: 60 }));
        load();
      },
      leftButtons: [{ label: '客户对账(R)', action: () => { cust ? ERP.open('custStatement', { cust: cust.code }) : toast('请先选择客户'); } }],
      buttons: [
        { label: '✔ 确定(S)', primary: true, action: (close) => {
          if (!cust) return toast('请选择销账客户');
          const { amt, real, cash } = calc(), pre = r2(+E.prestore.value || 0), fee = r2(+E.fee.value || 0), wipe = r2(+E.wipe.value || 0);
          if (amt <= 0) return toast('请勾选要销账的记账单据');
          if (real < 0 || cash < 0) return toast('抹零 / 预存金额不能超过结算金额');
          const k = card(cust.code);
          if (pre > 0 && (!k || k.balance < pre)) return toast('预存余额不足');
          const a = acctBy(acct.value), picked = rows.filter((r) => r.pick && r.thisAmt > 0);
          picked.forEach((r) => { r.x.cleared = r2(r.x.cleared + r.thisAmt); });
          cust.debt = r2(Math.max(0, cust.debt - amt)); cust.writeOffPending = r2((cust.writeOffPending || 0) + amt);
          if (pre > 0) { k.balance = r2(k.balance - pre); k.totalOut = r2(k.totalOut + pre); cust.prestoreBalance = k.balance; }
          post(a, r2(cash - fee));
          D.writeOffs.unshift({ no, date: new Date(date.value + 'T' + F.datetime(new Date()).slice(11)), custCode: cust.code, custName: cust.name, custHandler: custHandler.value, amount: amt, wipe, real, cash,
            account: cash ? acctLabel(a) : '', method: cash ? method.value : '', fee, prestore: pre, invoice: inv.querySelector('input').checked, billInfo: bill.value,
            handler: D.currentUser.name, audited: false, auditTime: null, remark: remark.value, allocs: picked.map((r) => ({ x: r.x, amt: r.thisAmt })) });
          close(); toast(`销账成功：${cust.name} ${F.money(amt)}（待审核）`); changed(); done && done();
        } },
        { label: '✕ 关闭(C)' },
      ],
    });
  }
  // 删除销账单：恢复记账单已销金额、客户欠款、资金科目
  function removeWriteOff(w) {
    const c = D.customer(w.custCode);
    w.allocs.forEach((x) => { x.x.cleared = r2(x.x.cleared - x.amt); });
    if (c) { c.debt = r2(c.debt + w.amount); if (!w.audited) c.writeOffPending = r2(Math.max(0, (c.writeOffPending || 0) - w.amount)); }
    if (w.prestore && card(w.custCode)) { const k = card(w.custCode); k.balance = r2(k.balance + w.prestore); k.totalOut = r2(k.totalOut - w.prestore); if (c) c.prestoreBalance = k.balance; }
    post(acctBy(w.account), -r2(w.cash - w.fee));
    D.writeOffs.splice(D.writeOffs.indexOf(w), 1);
  }
  function auditWriteOff(w) {
    setAudit(w);
    const c = D.customer(w.custCode);
    if (!c) return;
    c.writeOffPending = r2(Math.max(0, (c.writeOffPending || 0) + (w.audited ? -w.amount : w.amount)));
    if (w.audited) c.lastAudit = w.auditTime;
  }

  ERP.page('writeOffRecords', {
    title: '销账记录',
    render(el) {
      const { side, main } = split(el);
      const f = { acct: 'all', method: 'all', bill: 'all', feat: 'all' };
      let g, kw;
      const dr = ERP.ui.dateRange({ preset: 'year', onChange: () => g && apply() });
      sidebar(side, [
        { title: '基本条件', body: [dr.el, btn('查询(F)', () => apply(), 'block')] },
        { title: '入账科目', closed: true, list: acctList(), value: 'all', onSelect: (v) => { f.acct = v; apply(); } },
        { title: '支付方式', closed: true, list: [{ label: '全部', value: 'all' }, ...['现钞', '微信', '支付宝', '刷卡', '转账'].map((m) => ({ label: m, value: m }))], value: 'all', onSelect: (v) => { f.method = v; apply(); } },
        { title: '客户单位', closed: true, body: field('客户', (kw = input({ placeholder: '客户名称', oninput: () => apply() })), { lw: 34 }) },
        { title: '票据信息', closed: true, list: [{ label: '全部', value: 'all' }, { label: '已开发票', value: 'y' }, { label: '未开发票', value: 'n' }], value: 'all', onSelect: (v) => { f.bill = v; apply(); } },
        { title: '单据特征', closed: true, list: featureList(), value: 'all', onSelect: (v) => { f.feat = v; apply(); } },
      ]);
      g = grid(main, {
        groups: [
          { title: '基础', columns: [{ key: 'no', title: '销账单号', width: 150 }, { key: 'date', title: '业务日期', type: 'date' }] },
          { title: '客户', columns: [{ key: 'custName', title: '客户名称', width: 200 }, { key: 'custHandler', title: '客方经手', width: 90 }] },
          { title: '销账', columns: [{ key: 'amount', title: '结算金额', type: 'money', sum: true }, { key: 'wipe', title: '抹零金额', type: 'money', sum: true, hideZero: true }, { key: 'real', title: '实结金额', type: 'money', sum: true, hideZero: true }] },
          { title: '结算', columns: [{ key: 'cash', title: '现金实结', type: 'money', sum: true, hideZero: true }, { key: 'account', title: '现金科目', width: 200 }, { key: 'method', title: '支付方式', width: 80, align: 'center' },
            { key: 'fee', title: '手续费用', type: 'money', sum: true }, { key: 'prestore', title: '预存实结', type: 'money', sum: true, hideZero: true }] },
          { title: '更多', columns: [{ key: 'invoice', title: '已开发票', type: 'check', width: 70 }, { key: 'billInfo', title: '票据信息', width: 110 }, { key: 'handler', title: '经手', width: 70 },
            { key: 'audited', title: '审核', type: 'check', width: 50 }, { key: 'auditTime', title: '审核时间', type: 'datetime' }, { key: 'remark', title: '说明备注', width: 140 }] },
        ],
        rows: [], rowClass: (r) => (r.audited ? '' : 'bold'),
        contextMenu: (r) => recMenu(() => g, r, { name: '销账记录',
          extra: [{ label: '新建销账(N)', action: () => ERP.open('writeOff') }, { label: '客户对账', disabled: !r || !r.custCode, action: () => ERP.open('custStatement', { cust: r.custCode }) }, '-'],
          audit: auditWriteOff, remove: removeWriteOff }),
      });
      function apply() {
        const r = dr.value, k = kw.value.trim();
        g.setRows(D.writeOffs.filter((w) => inRange(w.date, r) && (f.acct === 'all' || w.account === f.acct) && (f.method === 'all' || w.method === f.method)
          && (!k || w.custName.includes(k)) && (f.bill === 'all' || (f.bill === 'y') === !!w.invoice) && featureOk(f.feat, w)));
      }
      apply();
      onChanged(el, apply);
    },
  });

  /* ====================================================================
   * 一般收入 / 一般支出 + 收支记录
   * ==================================================================== */
  function openJournal(kind) {
    const inc = kind === '一般收入';
    const list = D.cashJournal, no = nextNo(inc ? 'SR' : 'ZC', list);
    const type = select(inc ? D.incomeTypes : D.expenseTypes), acct = select(acctOptions(), { value: inc ? '1001' : '1001' });
    const method = select(['现钞', '微信', '支付宝', '刷卡', '转账']), date = input({ type: 'date', value: F.date(now) });
    const amt = input({ value: '0.00', style: { fontSize: '28px', height: '48px', textAlign: 'right', fontWeight: 700, color: inc ? 'var(--primary)' : 'var(--green)', fontFamily: 'var(--mono)' } });
    const cust = input({ list: 'fin-cust-list', placeholder: '可选，往来单位' }), handler = select(D.employees.map((e) => e.name), { value: D.currentUser.name });
    const inv = check(inc ? '已开发票' : '已收发票'), bill = input({ placeholder: '发票号 / 票据信息' }), remark = h('textarea.inp', { rows: 3 });
    method.addEventListener('change', () => { const a = methodAcct(method.value); if (a) acct.value = a.code; });
    dialog({
      title: inc ? '新建一般收入' : '新建一般支出', width: 680,
      banner: inc ? '登记经营项目之外的收入（废品、房租等），款项计入所选资金科目' : '登记房租、水电、工资、采购等日常支出，款项从所选资金科目中扣除',
      body: h('div.col', custOptions(),
        h('div.formgrid.c2', field('单据编号', input({ value: no, readOnly: true }), { lw: 64 }), field('业务日期', date, { lw: 64 })),
        h('div.fieldset', h('legend', inc ? '收入' : '支出'),
          h('div.formgrid.c2', field(inc ? '收入科目' : '成本科目', type, { lw: 64 }), field('支付方式', method, { lw: 64 })),
          field(inc ? '入账科目' : '出账科目', acct, { lw: 64 }), field('金额', amt, { lw: 64 })),
        h('div.fieldset', h('legend', '更多'), h('div.formgrid.c2', field('客户单位', cust, { lw: 64 }), field('经手', handler, { lw: 64 }), field('票据信息', bill, { lw: 64 }), h('div', inv)),
          field('说明备注', remark, { lw: 64 }))),
      leftButtons: [{ label: '收支记录(R)', action: () => { ERP.open('generalRecords'); } }],
      buttons: [
        { label: '✔ 确定(S)', primary: true, action: (close) => {
          const v = r2(+amt.value || 0), a = acctBy(acct.value);
          if (v <= 0) return toast('请输入金额');
          if (!inc && v > a.balance) return toast(`${acctLabel(a)} 余额不足（${F.money(a.balance)}）`);
          post(a, inc ? v : -v);
          list.unshift({ no, date: new Date(date.value + 'T' + F.datetime(new Date()).slice(11)), kind, type: type.value, account: a.name, method: method.value, amount: v,
            cust: cust.value, invoice: inv.querySelector('input').checked, billInfo: bill.value, handler: handler.value, audited: false, auditTime: null, remark: remark.value });
          close(); toast(`${kind}已登记：${no} ${F.money(v)}`); changed();
        } },
        { label: '✕ 关闭(C)' },
      ],
    });
  }
  ERP.page('generalIncome', { title: '一般收入', kind: 'dialog', render: () => openJournal('一般收入') });
  ERP.page('generalExpense', { title: '一般支出', kind: 'dialog', render: () => openJournal('一般支出') });

  ERP.page('generalRecords', {
    title: '收支记录',
    render(el, p = {}) {
      const { side, main } = split(el);
      const f = { kind: p.kind || 'all', acct: 'all', method: 'all', type: 'all', feat: 'all' };
      let g, kw;
      const dr = ERP.ui.dateRange({ preset: 'year', onChange: () => g && apply() });
      sidebar(side, [
        { title: '基本条件', body: [dr.el, btn('查询(F)', () => apply(), 'block')] },
        { title: '收支类型', list: [{ label: '全部', value: 'all' }, { label: '一般收入', value: '一般收入', icon: '+', color: 'red' }, { label: '一般支出', value: '一般支出', icon: '−', color: 'green' }], value: f.kind, onSelect: (v) => { f.kind = v; apply(); } },
        { title: '资金科目', closed: true, list: acctList(), value: 'all', onSelect: (v) => { f.acct = v; apply(); } },
        { title: '支付方式', closed: true, list: [{ label: '全部', value: 'all' }, ...['现钞', '微信', '支付宝', '刷卡', '转账'].map((m) => ({ label: m, value: m }))], value: 'all', onSelect: (v) => { f.method = v; apply(); } },
        { title: '收支科目', closed: true, list: [{ label: '全部', value: 'all' }, ...D.incomeTypes.concat(D.expenseTypes).map((t) => ({ label: t, value: t }))], value: 'all', onSelect: (v) => { f.type = v; apply(); } },
        { title: '客户单位', closed: true, body: field('客户', (kw = input({ oninput: () => apply() })), { lw: 34 }) },
        { title: '单据特征', closed: true, list: featureList(), value: 'all', onSelect: (v) => { f.feat = v; apply(); } },
      ]);
      g = grid(main, {
        groups: [
          { title: '基础', columns: [{ key: 'no', title: '单据编号', width: 130 }, { key: 'date', title: '业务日期', type: 'date' }, { key: 'kind', title: '收支类型', width: 80 }] },
          { title: '收支', columns: [{ key: 'type', title: '收支科目', width: 100 }, { key: 'acctLabel', title: '资金科目', width: 200 }, { key: 'method', title: '支付方式', width: 80 },
            { key: 'inAmt', title: '收入金额', type: 'money', sum: true, hideZero: true }, { key: 'outAmt', title: '支出金额', type: 'money', sum: true, hideZero: true }] },
          { title: '更多', columns: [{ key: 'cust', title: '客户单位', width: 160 }, { key: 'invoice', title: '发票', type: 'check', width: 50 }, { key: 'billInfo', title: '票据信息', width: 110 }] },
          { title: '其他', columns: [{ key: 'handler', title: '经手', width: 80 }, { key: 'audited', title: '审核', type: 'check', width: 50 }, { key: 'auditTime', title: '审核时间', type: 'datetime' }, { key: 'remark', title: '说明备注', width: 160 }] },
        ],
        rows: [], rowColor: (r) => (r.kind === '一般支出' ? 'green' : null), rowClass: (r) => (r.audited ? '' : 'bold'),
        contextMenu: (r) => recMenu(() => g, r, { name: '收支记录',
          extra: [{ label: '新建一般收入', action: () => ERP.open('generalIncome') }, { label: '新建一般支出', action: () => ERP.open('generalExpense') }, '-'],
          audit: setAudit,
          remove: (j) => { post(acctBy(j.account), j.kind === '一般收入' ? -j.amount : j.amount); D.cashJournal.splice(D.cashJournal.indexOf(j), 1); } }),
      });
      function apply() {
        const r = dr.value, k = kw.value.trim();
        D.cashJournal.forEach((j) => { j.acctLabel = acctLabel(acctBy(j.account)); j.inAmt = j.kind === '一般收入' ? j.amount : 0; j.outAmt = j.kind === '一般支出' ? j.amount : 0; });
        g.setRows(D.cashJournal.filter((j) => inRange(j.date, r) && (f.kind === 'all' || j.kind === f.kind) && (f.acct === 'all' || j.acctLabel === f.acct)
          && (f.method === 'all' || j.method === f.method) && (f.type === 'all' || j.type === f.type) && (!k || (j.cust || '').includes(k)) && featureOk(f.feat, j)));
      }
      apply();
      onChanged(el, apply);
    },
  });

  /* ====================================================================
   * 期末结账 / 会计日历
   * ==================================================================== */
  const periodName = (p) => `${p.slice(0, 4)}年${+p.slice(4)}月`;
  const nextPeriod = (p) => { const y = +p.slice(0, 4), m = +p.slice(4); return m === 12 ? `${y + 1}01` : `${y}${pad(m + 1)}`; };
  const closings = {}; // 本次会话中的结账记录 {period: {time, user}}
  const cal = { mode: '自然月', day: 25 };

  // 未审核的财务相关业务单据
  function unaudited() {
    const R = [];
    const add = (module, docName, x, date, handler) => {
      const c = empCode(handler || '管理员');
      R.push({ x, module, docName, no: x.no, date, hCode: c, hName: handler || '管理员', regTime: date, rCode: c, rName: handler || '管理员', uCode: c, uName: handler || '管理员', remark: x.remark || '' });
    };
    D.settlements.filter((s) => !s.audited).forEach((s) => add('销售', '结算单', s, s.date, s.handler));
    D.prestores.filter((s) => !s.audited).forEach((s) => add('销售', '预存单', s, s.date, s.handler));
    D.writeOffs.filter((s) => !s.audited).forEach((s) => add('销售', '销账单', s, s.date, s.handler));
    D.cashJournal.filter((s) => !s.audited).forEach((s) => add('财务', s.kind + '单', s, s.date, s.handler));
    D.transfers.filter((s) => !s.audited).forEach((s) => add('财务', '转账单', s, s.date, s.handler));
    return R.sort((a, b) => a.date - b.date);
  }

  ERP.page('periodClose', {
    title: '期末结账', kind: 'dialog',
    render() {
      let g;
      const end = input({ value: F.datetime(new Date()) });
      const auditOne = (r) => (r.module === '销售' && r.docName === '销账单' ? auditWriteOff(r.x) : setAudit(r.x));
      dialog({
        title: '期末结账', width: 1200, height: 720, banner: '存档本期财务数据，开辟新的财务月度',
        body: (b) => {
          b.append(h('div.fieldset', h('legend', '本期信息'), h('div.row',
            field('会计期间', input({ value: periodName(D.company.period), readOnly: true, style: { width: '120px' } }), { lw: 56 }),
            field('结束时间', end, { lw: 56 }), h('i.muted', '（格式：2008-08-08 20:00:00）'))));
          const box = h('div.fieldset', { style: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } }, h('legend', '尚未审核的财务相关的业务单据'));
          b.append(box);
          g = grid(box, {
            columns: [{ key: 'module', title: '模块', width: 60 }, { key: 'docName', title: '单据名称', width: 100 }, { key: 'no', title: '单据编号', width: 150 }, { key: 'date', title: '业务日期', type: 'date' },
              { key: 'hCode', title: '经手人员编号', width: 100 }, { key: 'hName', title: '经手人员姓名', width: 100 }, { key: 'regTime', title: '登记时间', type: 'date' },
              { key: 'rCode', title: '登记人员编号', width: 100 }, { key: 'rName', title: '登记人员姓名', width: 100 }, { key: 'uCode', title: '最后更新人员编号', width: 120 }, { key: 'uName', title: '最后更新人员姓名', width: 120 },
              { key: 'remark', title: '说明备注', width: 160 }],
            rows: unaudited(), rowColor: (r) => (r.module === '财务' ? 'blue' : null), emptyText: '没有未审核的单据，可以结账',
            contextMenu: (r) => ERP.ui.stdMenu(() => g, [
              { label: '审核此单(G)', disabled: !r, action: () => { auditOne(r); g.setRows(unaudited()); changed(); toast('已审核：' + r.no); } },
              { label: '全部审核(A)', action: () => auditAll() }], '未审核单据'),
          });
          b.append(h('div.fieldset', h('legend', '检查确认'), h('div', '确保会计期间内的财务相关的业务单据、记账凭证已经审核过账。无其它客户端连接服务器。')));
        },
        leftButtons: [{ label: '全部审核(A)', action: () => auditAll() }],
        buttons: [
          { label: '✔ 结账[S]', primary: true, action: (close) => {
            const n = unaudited().length;
            if (n) return toast(`尚有 ${n} 张财务相关单据未审核，不能结账`);
            if (isNaN(new Date(end.value.replace(' ', 'T')))) return toast('结束时间格式不正确');
            ERP.ui.confirm(`确定结束会计期间「${periodName(D.company.period)}」？结账后本期单据将不能再修改。`, () => {
              const old = D.company.period;
              closings[old] = { time: new Date(end.value.replace(' ', 'T')), user: D.currentUser.name };
              D.company.period = nextPeriod(old);
              ERP.setPeriod(D.company.period);
              close(); toast(`已结账：${periodName(old)}，当前会计期间 ${periodName(D.company.period)}`);
            }, '期末结账');
          } },
          { label: '✕ 关闭(C)' },
        ],
      });
      function auditAll() {
        const rows = unaudited();
        if (!rows.length) return toast('没有未审核的单据');
        ERP.ui.confirm(`确定审核全部 ${rows.length} 张单据？`, () => { rows.forEach(auditOne); g.setRows(unaudited()); changed(); toast(`已审核 ${rows.length} 张单据`); });
      }
    },
  });

  ERP.page('accountCalendar', {
    title: '会计日历', kind: 'dialog',
    render() {
      let g, year = +D.company.period.slice(0, 4);
      const ysel = select([2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027].map((y) => [y, y + '年']), { value: year, style: { width: '90px' } });
      const mode = select(['自然月', '固定结账日'], { value: cal.mode, style: { width: '110px' } });
      const day = select(Array.from({ length: 28 }, (_, i) => [i + 1, `每月 ${i + 1} 日`]), { value: cal.day, style: { width: '100px' }, disabled: cal.mode === '自然月' });
      const rows = () => Array.from({ length: 12 }, (_, i) => {
        const code = `${year}${pad(i + 1)}`, nat = cal.mode === '自然月';
        const start = nat ? new Date(year, i, 1) : new Date(year, i - 1, cal.day + 1), finish = nat ? new Date(year, i + 1, 0) : new Date(year, i, cal.day);
        const cur = D.company.period, st = code < cur ? '已结账' : code === cur ? '当前期间' : '未开始';
        const cl = closings[code] || (st === '已结账' ? { time: new Date(+finish + 864e5 + 9 * 36e5), user: '管理员' } : null);
        return { code, name: periodName(code), start, finish, days: Math.round((finish - start) / 864e5) + 1, st, closeTime: cl && cl.time, closeUser: cl ? cl.user : '' };
      });
      const regen = () => { year = +ysel.value; cal.mode = mode.value; cal.day = +day.value; day.disabled = cal.mode === '自然月'; g.setRows(rows()); };
      [ysel, mode, day].forEach((x) => x.addEventListener('change', regen));
      dialog({
        title: '会计日历', width: 920, height: 620, banner: '设置会计年度内各会计期间的起止日期，期末结账按此划分财务月度',
        body: (b) => {
          b.append(h('div.row', field('会计年度', ysel, { lw: 56 }), field('期间划分', mode, { lw: 56 }), field('结账日', day, { lw: 44 }), h('span.grow'),
            h('span.muted', '当前会计期间：', h('b.c-red', periodName(D.company.period)))));
          g = grid(b, {
            columns: [{ key: 'code', title: '会计期间', width: 90 }, { key: 'name', title: '期间名称', width: 100 }, { key: 'start', title: '开始日期', type: 'date' }, { key: 'finish', title: '结束日期', type: 'date' },
              { key: 'days', title: '天数', type: 'int', width: 60 }, { key: 'st', title: '状态', width: 80, align: 'center' }, { key: 'closeTime', title: '结账时间', type: 'datetime' }, { key: 'closeUser', title: '结账人', width: 80 }],
            rows: rows(), footer: false,
            rowColor: (r) => (r.st === '当前期间' ? 'red' : r.st === '已结账' ? 'gray' : null), rowClass: (r) => (r.st === '当前期间' ? 'bold' : ''),
            contextMenu: (r) => [{ label: '期末结账…', disabled: !r || r.st !== '当前期间', action: () => ERP.open('periodClose') }, '-', { label: '导出(E)', action: () => g.exportCsv('会计日历') }],
          });
          b.append(h('div.note', '提示：已结账的期间不可再调整起止日期；修改期间划分只影响尚未开始的会计期间。'));
        },
        leftButtons: [{ label: '生成(G)', action: () => { regen(); toast(`已生成 ${year} 年会计期间`); } }],
        buttons: [{ label: '✔ 保存(S)', primary: true, action: (close) => { regen(); close(); toast('会计日历已保存'); } }, { label: '✕ 关闭(C)' }],
      });
    },
  });
})();
