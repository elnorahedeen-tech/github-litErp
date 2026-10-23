/* 前台（续）：工单记录（全面/基础）、云端业务中心、结算记录（现金收款/基础）、
 * 卡片发行、IC 卡片资料管理、预存储值 / 预存退款 / 预存记录、营业日报表、零收 / 零收记录
 * 依赖 pages/frontdesk.js 中的 ERP.biz（openOrder / orderMenu / itemPicker / notifyOrdersChanged） */
(function () {
  'use strict';
  const { h, grid, sidebar, split, dialog, field, input, select, check, btn, toast } = ERP.ui;
  const D = ERP.data, F = ERP.fmt, r2 = D.util.r2;
  const biz = (ERP.biz = ERP.biz || {});
  const pad = (n, l = 2) => String(n).padStart(l, '0');

  /* ---------- 通用小工具 ---------- */
  // 入账科目（与收款结算对话框一致）
  const ACCOUNTS = ['现金>前台钱箱', '现金>备用金', ...D.accounts.filter((a) => a.parent).map((a) => '银行存款>' + a.name)];
  const PAYWAYS = ['现钞', '微信', '支付宝', '刷卡', '转账', '支票', '汇款', '其他'];
  const acctOf = (method) => ({ 现金: '现金>前台钱箱', 现钞: '现金>前台钱箱', 微信: '银行存款>微信', 支付宝: '银行存款>支付宝',
    刷卡: '银行存款>一般账户（XX银行）', 转账: '银行存款>一般账户（XX银行）', 在线付款码: '银行存款>微信' }[method] || '');
  // 单据编号：前缀 + yyMMdd + 10 + 序号（与旧系统 LS26091410001 一致）
  const docNo = (prefix, list) => {
    const n = new Date();
    const day = `${String(n.getFullYear()).slice(2)}${pad(n.getMonth() + 1)}${pad(n.getDate())}`;
    const cnt = list.filter((x) => String(x.no).startsWith(prefix + day)).length;
    return `${prefix}${day}10${pad(cnt + 1, 3)}`;
  };
  const inRange = (d, r) => { const t = +new Date(d); return (isNaN(r.from) || t >= r.from) && (isNaN(r.to) || t <= r.to); };
  // 日期面板切到「自定义」并填入起止（模拟数据跨度大时用）
  const wideRange = (dr, from = '2020-01-01T00:00:00') => {
    const [a, b] = dr.el.querySelectorAll('input[type=datetime-local]');
    [...dr.el.querySelectorAll('input[type=radio]')].find((r) => r.value === 'custom').checked = true;
    a.readOnly = b.readOnly = false;
    a.value = from; b.value = F.date(new Date()) + 'T23:59:59';
  };
  // 左侧「基本条件」面板：日期 + 额外字段 + 查询按钮
  const basePanel = (dr, apply, extra = []) => ({ title: '基本条件', body: [dr.el, ...extra, h('div', { style: { height: '6px' } }), btn('查询(F)', apply, 'block')] });
  // 复选框组：items = [label | {label, color, checked}]，返回 {el, values()}
  const checks = (items, onChange, cols = 1) => {
    const boxes = items.map((it) => {
      const o = typeof it === 'string' ? { label: it } : it;
      const c = check(o.label, o.checked !== false, { onchange: () => onChange && onChange() });
      if (o.color) c.classList.add('c-' + o.color);
      c.dataset.v = o.value || o.label;
      return c;
    });
    const el = h('div', { style: { display: 'grid', gridTemplateColumns: `repeat(${cols}, auto)`, gap: '6px 12px', justifyContent: 'start', padding: '2px 4px' } }, boxes);
    return { el, values: () => boxes.filter((b) => b.firstChild.checked).map((b) => b.dataset.v) };
  };
  // 状态行：「过期状态 ☑已过期 ☑未过」
  const stateRow = (label, a, b, onChange) => {
    const c = checks([a, b], onChange, 2);
    return { el: field(label, c.el, { lw: 56 }), has: (v) => c.values().includes(v) };
  };
  // 简单列表面板（带「全部」）
  const listPanel = (title, values, onSelect, closed = true) => ({ title, closed, value: 'all',
    list: [{ label: '全部', value: 'all' }, ...values.map((v) => ({ label: v, value: v, icon: '·' }))], onSelect });
  // 数据变化广播：除工单外的单据（卡片 / 预存 / 零收）变化后通知已打开的列表刷新
  const notify = () => document.querySelectorAll('.docpage').forEach((p) => p.dispatchEvent(new Event('erp:fm-changed')));
  const onChanged = (el, fn) => { el.addEventListener('erp:fm-changed', fn); el.addEventListener('erp:orders-changed', fn); };
  const yes = (v) => (v ? '是' : '');

  /* ---------- 补全共享数据中本模块需要的字段（只补缺，不覆盖） ---------- */
  D.cards.forEach((k, i) => {
    const c = D.customer(k.custCode) || {};
    Object.assign(k, Object.assign({ cardType: i % 3 === 2 ? '实体卡片' : '电子卡片', holder: c.contact || '', locked: false, lost: false, expire: null,
      idType: '身份证', idNo: '', applicant: c.contact || '', applicantPhone: c.phone || '' }, k));
  });
  D.prestores.forEach((p) => Object.assign(p, Object.assign({ real: r2(p.amount - p.gift), groupBefore: (D.customer(p.custCode) || {}).groupName || '',
    account: acctOf(p.method), fee: 0, invoice: false, ticket: '' }, p)));
  const miscCat = { 复印: ['11', '复印 A4 黑白', '张', 0.3], 打印: ['12', '黑白打印 A4 单面', '张', 0.5], 扫描: ['80', '排版', '页', 1], 证件照: ['60', '证件照', '版', 25], 装订: ['15', '骑马钉', '本', 3] };
  D.miscIncomes.forEach((m) => {
    const [cat, name, unit] = miscCat[m.item] || ['11', m.item, '张'];
    Object.assign(m, Object.assign({ custName: '零收散户', cat, catName: D.itemCatName(cat), itemName: name, unit, price: r2(m.amount / (m.qty || 1)),
      account: acctOf(m.method), fee: 0, invoice: false, ticket: '', source: m.method === '微信' ? '云端交易（微信）' : '手动登记创建', audited: true }, m));
  });
  D.settlements.forEach((s) => Object.assign(s, Object.assign({ custHandler: '', fee: 0, ticket: '', returned: 0 }, s)));

  /* ======================================================================
   * 工单记录（全面 / 基础）
   * ==================================================================== */
  // 工单派生字段：标售、抹零、实收、结算方式、业务日期
  const decorateOrder = (w) => {
    w.listAmount = r2((w.lines || []).reduce((s, l) => s + l.listPrice * l.qty * (l.copies || 1), 0)) || w.amount;
    w.wipe = w.wipe || 0;
    w.realAmount = r2(w.amount - w.wipe);
    w.payMethod = [...new Set(D.settlements.filter((s) => s.orderNo === w.no).map((s) => s.method))].join(',');
    w.auditText = w.audited ? '已审核' : '';
    return w;
  };

  function orderRecords(el, full) {
    const { side, main } = split(el);
    let g;
    const f = { type: 'all' };
    const task = select(D.tasks.map((t) => [t, t || '（全部）'])), delivery = select(D.deliveryTypes.map((t) => [t, t || '（全部）']));
    const flows = checks(D.flows.map((x) => ({ label: x.name, color: x.color })), () => apply(), 2);
    const settle = checks(['0元空单', '尚未结算', '部分结算', '完成结算'], () => apply(), 2);
    const custGroup = select([['', '（全部）'], ...D.groups.map((x) => [x.name, x.name])]), custKw = input({ placeholder: '编号 / 名称 / 电话' });
    const audit = checks(['已审核', '未审核'], () => apply(), 2), keepFile = check('保留文件');
    const receptionist = select(['', ...D.employees.map((e) => e.name)]);
    const dr = ERP.ui.dateRange({ preset: 'year', onChange: () => g && apply() });
    function apply() {
      const r = dr.value, k = custKw.value.trim(), fl = flows.values(), st = settle.values(), au = audit.values();
      g.setRows(D.workOrders.filter((w) => inRange(w.created, r)
        && (f.type === 'all' || (w.orderType || '（无）') === f.type)
        && (!task.value || w.task === task.value) && (!delivery.value || w.delivery === delivery.value) && fl.includes(w.flow)
        && st.includes(w.settleStatus)
        && (!custGroup.value || w.group === custGroup.value) && (!k || w.custCode.includes(k) || w.custName.includes(k) || (w.phone || '').includes(k))
        && au.includes(w.audited ? '已审核' : '未审核') && (!receptionist.value || w.receptionist === receptionist.value)).map(decorateOrder));
    }
    sidebar(side, [
      basePanel(dr, () => apply()),
      { title: '工单类型', closed: true, value: 'all', list: [{ label: '全部', value: 'all' }, ...D.orderTypes.map((t) => ({ label: t || '（无）', value: t || '（无）', icon: '·' }))],
        onSelect: (v) => { f.type = v; apply(); } },
      { title: '基础特征', closed: true, body: [field('制作任务', task, { lw: 56 }), field('取送要求', delivery, { lw: 56 }), field('生产流程', flows.el, { lw: 56 })] },
      { title: '结算特征', closed: true, body: settle.el },
      { title: '客户信息', closed: true, body: [field('客户分组', custGroup, { lw: 56 }), field('客户', custKw, { lw: 56 })] },
      { title: '单据特征', closed: true, body: [field('审核状态', audit.el, { lw: 56 }), field('接待人员', receptionist, { lw: 56 }), keepFile] },
    ]);
    [task, delivery, custGroup, receptionist].forEach((x) => x.addEventListener('change', apply));
    custKw.addEventListener('keydown', (e) => e.key === 'Enter' && apply());

    const base = full
      ? [{ key: 'no', title: '工作单号', width: 140 }, { key: 'created', title: '业务日期', type: 'date' }, { key: 'custName', title: '客户名称', width: 220 }, { key: 'group', title: '客户分组', width: 110 }]
      : [{ key: 'created', title: '业务日期', type: 'date' }, { key: 'custName', title: '客户名称', width: 220 }, { key: 'group', title: '客户分组', width: 110 }];
    const money = [
      ...(full ? [{ key: 'listAmount', title: '标售', type: 'money', sum: true }] : []),
      { key: 'amount', title: '实售', type: 'money', sum: true }, { key: 'wipe', title: '抹零', type: 'money', sum: true, hideZero: true },
      { key: 'realAmount', title: '实收', type: 'money', sum: true }, { key: 'paid', title: '已结', type: 'money', sum: true },
      { key: 'unpaid', title: '未结', type: 'money', sum: true }, { key: 'payMethod', title: '结算方式', width: 100 }];
    const groups = [
      { title: '基础', columns: base },
      { title: '制作', columns: [{ key: 'task', title: '任务', width: 140 }, { key: 'contact', title: '联络人员', width: 80 }, { key: 'phone', title: '联系电话', width: 110 }, { key: 'address', title: '联系地址', width: 180 }] },
      { title: '金额', columns: money },
    ];
    if (full) groups.push(
      { title: '生产', columns: [{ key: 'flow', title: '生产流程', width: 70, align: 'center' }, { key: 'handler', title: '当前处理', width: 80 }, { key: 'due', title: '交付时间', type: 'short', width: 100 },
        { key: 'delivery', title: '取送要求', width: 80 }, { key: 'orderType', title: '工单类型', width: 80 }] },
      { title: '更多', columns: [{ key: 'req', title: '制作要求', width: 200 }, { key: 'settleStatus', title: '结算状态', width: 80 }, { key: 'receptionist', title: '接待人员', width: 80 },
        { key: 'auditText', title: '审核', width: 60, align: 'center' }, { key: 'remark', title: '备注', width: 140 }] });
    g = grid(main, {
      groups, rows: [], rowColor: biz.orderRowColor,
      onDblClick: (w) => biz.openOrder(w.no),
      contextMenu: (w) => biz.orderMenu(() => g, w),
    });
    apply();
    onChanged(el, apply);
  }
  ERP.page('orderRecords', { title: '工单记录（全面）', render: (el) => orderRecords(el, true) });
  ERP.page('orderRecordsBasic', { title: '工单记录（基础）', render: (el) => orderRecords(el, false) });

  /* ======================================================================
   * 云端业务中心 — 客户在微信小程序 / 公众号 / 网页商城提交的在线订单，
   * 前台受理后生成工作单（在线已付款项同时生成结算单）
   * ==================================================================== */
  const cloudSeed = [
    ['YD26101910006', '微信小程序', '1065', '上海新科技公司', '赵经理', '13812345678', '彩色宣传单 A4 双面 200 张，铜版纸 157g', '快递', '上海市浦东新区张江路 88 号', [['102004', 200]], '已付款', '待受理', 0],
    ['YD26101910005', '微信公众号', '', '林女士', '林女士', '15900001111', '证件照 2 版，蓝底', '自取', '', [['600001', 2]], '已付款', '待受理', 1],
    ['YD26101910004', '网页商城', '1260', '武汉大学', '周老师', '13700002222', '论文胶装 5 本，黑白双面', '送货', '武汉大学文理学部 3 号楼', [['120002', 300], ['150001', 5]], '未付款', '待受理', 2],
    ['YD26101810003', '微信小程序', '1305', '深圳心智公司', '陈先生', '18600003333', '易拉宝 2 个 + 户外写真 6㎡', '同城跑腿', '深圳市南山区科技园', [['500002', 2], ['250001', 6]], '已付款', '已受理', 26],
    ['YD26101710002', '微信公众号', '', '王同学', '王同学', '13511112222', '复印 A4 黑白 50 张', '自取', '', [['110001', 50]], '未付款', '已拒绝', 50],
    ['YD26101610001', '网页商城', '1180', '天津工业大学', '刘工', '13322223333', 'A0 图纸 黑白 30 张，折叠装订', '快递', '天津市西青区宾水西道 399 号', [['200001', 30], ['210002', 2]], '已付款', '已受理', 75],
  ];
  const cloudOrders = cloudSeed.map(([no, source, custCode, custName, contact, phone, req, delivery, address, items, payState, status, hoursAgo], i) => {
    const lines = items.map(([code, qty]) => {
      const it = D.items.find((x) => x.code === code) || D.items[i];
      return { code: it.code, cat: it.cat, catName: D.itemCatName(it.cat), name: it.name, unit: it.unit, listPrice: it.price, price: it.price, discount: 10, qty, copies: 1, amount: r2(it.price * qty), remark: '' };
    });
    const amount = r2(lines.reduce((s, l) => s + l.amount, 0));
    const created = new Date(Date.now() - hoursAgo * 36e5);
    return { no, source, custCode, custName, contact, phone, req, delivery, address, lines, amount, onlinePaid: payState === '已付款' ? amount : 0, payState,
      created, expect: new Date(+created + 2 * 864e5), status, handler: status === '待受理' ? '' : '管理员', handled: status === '待受理' ? null : new Date(+created + 36e5),
      orderNo: status === '已受理' ? 'GD' + no.slice(2) : '', reason: status === '已拒绝' ? '超出营业范围' : '' };
  });
  const cloudColor = (c) => ({ 待受理: 'orange', 已受理: 'green', 已拒绝: 'gray' }[c.status]);

  // 受理：生成工作单（匹配老客户，否则记为散户），已付款项生成结算单
  function acceptCloud(c, done) {
    const cust = (c.custCode && D.customer(c.custCode)) || D.customers.find((x) => x.phone && x.phone === c.phone) || D.customer('000000');
    const n = new Date();
    const no = `GD${String(n.getFullYear()).slice(2)}${pad(n.getMonth() + 1)}${pad(n.getDate())}${pad(D.workOrders.length + 1, 5)}`;
    const paid = c.onlinePaid;
    D.workOrders.unshift({ no, custCode: cust.code, custName: cust.code === '000000' ? cust.name : cust.name, group: cust.groupName, contact: c.contact, phone: c.phone, address: c.address,
      task: '', req: `【云端${c.source}】${c.req}`, delivery: c.delivery, orderType: '', amount: c.amount, paid, unpaid: r2(c.amount - paid),
      settleStatus: !c.amount ? '0元空单' : paid >= c.amount ? '完成结算' : paid ? '部分结算' : '尚未结算',
      flow: '排队', handler: '', created: n, due: c.expect, receptionist: D.currentUser.name, keepFile: false, audited: false, file: '', remark: '云端订单 ' + c.no,
      lines: c.lines.map((l) => Object.assign({}, l)) });
    if (paid) D.settlements.unshift({ no: 'JS' + Date.now().toString().slice(-9), date: n, custCode: cust.code, custName: cust.name, handler: D.currentUser.name, method: '在线付款码',
      amount: paid, discount: 0, wipe: 0, orderNo: no, audited: true, invoice: false, remark: '云端交易', custHandler: c.contact, fee: r2(paid * 0.006), ticket: '', returned: 0, cloud: true });
    Object.assign(c, { status: '已受理', handler: D.currentUser.name, handled: n, orderNo: no });
    biz.notifyOrdersChanged();
    toast(`已受理，生成工作单：${no}`);
    done && done();
  }
  function rejectCloud(c, done) {
    const reason = select(['超出营业范围', '文件有误，请重新上传', '工期无法满足', '客户取消', '其他'], { style: { width: '100%' } });
    const memo = input({ placeholder: '补充说明（将推送给客户）' });
    dialog({ title: '拒绝云端订单', width: 420, banner: `拒绝订单 ${c.no}，已付款项将原路退回`,
      body: h('div.col', field('拒绝原因', reason, { lw: 64 }), field('补充说明', memo, { lw: 64 })),
      buttons: [{ label: '✔ 确定(S)', primary: true, action: (close) => {
        Object.assign(c, { status: '已拒绝', handler: D.currentUser.name, handled: new Date(), reason: reason.value + (memo.value ? '：' + memo.value : '') });
        if (c.onlinePaid) c.payState = '已退款';
        close(); toast('已拒绝，并推送通知给客户（原型）'); done && done();
      } }, { label: '✕ 关闭(C)' }] });
  }

  ERP.page('cloudCenter', {
    title: '云端业务中心',
    render(el) {
      const { side, main } = split(el);
      let g, lg, fStatus = '待受理', fSource = 'all';
      const dr = ERP.ui.dateRange({ preset: 'last30', label: '订单提交时间', onChange: () => g && apply() });
      const cnt = (s) => cloudOrders.filter((c) => s === 'all' || c.status === s).length;
      const statusList = () => [{ label: '全部', value: 'all', count: cnt('all') },
        { label: '待受理', value: '待受理', icon: '◷', color: 'orange', count: cnt('待受理') },
        { label: '已受理', value: '已受理', icon: '✔', color: 'green', count: cnt('已受理') },
        { label: '已拒绝', value: '已拒绝', icon: '✕', color: 'gray', count: cnt('已拒绝') }];
      const sb = sidebar(side, [
        { key: 'status', title: '受理状态', list: statusList(), value: fStatus, onSelect: (v) => { fStatus = v; apply(); } },
        listPanel('订单来源', ['微信小程序', '微信公众号', '网页商城'], (v) => { fSource = v; apply(); }, false),
        Object.assign(basePanel(dr, () => apply()), { closed: true }),
      ]);
      function apply() {
        g.setRows(cloudOrders.filter((c) => (fStatus === 'all' || c.status === fStatus) && (fSource === 'all' || c.source === fSource) && inRange(c.created, dr.value)));
        sb.status.setList(statusList());
        lg.setRows([]);
      }
      const act = (fn) => () => { const c = g.selected; if (!c) return toast('请先选择一张云端订单'); fn(c); };
      const accept = act((c) => (c.status !== '待受理' ? toast('该订单已' + c.status) : ERP.ui.confirm(`受理云端订单 ${c.no}，并生成工作单？`, () => acceptCloud(c, apply))));
      const reject = act((c) => (c.status !== '待受理' ? toast('该订单已' + c.status) : rejectCloud(c, apply)));
      const openWo = act((c) => (c.orderNo && D.workOrders.some((w) => w.no === c.orderNo) ? biz.openOrder(c.orderNo) : toast('该订单尚未生成工作单')));
      main.append(h('div.row', { style: { padding: '6px 8px', borderBottom: '1px solid var(--line)' } },
        btn('✔ 受理(A)', accept, 'sm primary'), btn('✕ 拒绝(R)', reject, 'sm'), btn('查看工单(K)', openWo, 'sm'), btn('刷新(F5)', () => { apply(); toast('已同步云端订单'); }, 'sm'),
        h('span.grow'), h('span.muted', '客户通过微信小程序 / 公众号 / 网页商城下单，受理后自动生成工作单'), btn('云端设置', () => toast('云端店铺设置（原型）'), 'sm')));
      const top = h('div.col.fill', { style: { minHeight: 0 } });
      main.append(top);
      g = grid(top, {
        groups: [
          { title: '基础', columns: [{ key: 'no', title: '云端单号', width: 130 }, { key: 'created', title: '提交时间', type: 'short', width: 100 }, { key: 'source', title: '订单来源', width: 90 },
            { key: 'custName', title: '客户名称', width: 160 }, { key: 'contact', title: '联系人', width: 70 }, { key: 'phone', title: '联系电话', width: 110 }] },
          { title: '订单', columns: [{ key: 'req', title: '制作要求', width: 240 }, { key: 'delivery', title: '取送方式', width: 70 }, { key: 'address', title: '收货地址', width: 180 }, { key: 'expect', title: '期望交付', type: 'short', width: 100 }] },
          { title: '金额', columns: [{ key: 'amount', title: '订单金额', type: 'money', sum: true }, { key: 'onlinePaid', title: '在线已付', type: 'money', sum: true }, { key: 'payState', title: '付款状态', width: 70 }] },
          { title: '受理', columns: [{ key: 'status', title: '受理状态', width: 70, align: 'center' }, { key: 'handler', title: '受理人', width: 70 }, { key: 'handled', title: '受理时间', type: 'short', width: 100 },
            { key: 'orderNo', title: '工单编号', width: 130 }, { key: 'reason', title: '拒绝原因', width: 140 }] },
        ],
        rows: [], rowColor: cloudColor,
        onSelect: (c) => lg.setRows(c.lines),
        onDblClick: (c) => (c.status === '待受理' ? accept() : openWo()),
        contextMenu: (c) => ERP.ui.stdMenu(() => g, [
          { label: '受理并生成工单(A)', disabled: !c || c.status !== '待受理', action: accept },
          { label: '拒绝订单(R)', disabled: !c || c.status !== '待受理', action: reject },
          { label: '查看工单', disabled: !c || !c.orderNo, action: openWo },
          '-',
          { label: '联系客户', disabled: !c, action: () => toast(`拨打 ${c.phone}（原型）`) },
          { label: '下载客户文件', disabled: !c, action: () => toast('下载客户上传的文件（原型）') },
        ], '云端订单'),
      });
      main.append(h('div.row', { style: { padding: '4px 8px', background: 'var(--panel, #fafafa)', borderTop: '1px solid var(--line)' } }, h('b', '订单明细'), h('span.muted', '（选中上方订单查看）')));
      lg = grid(main, {
        groups: [
          { title: '经营项目', columns: [{ key: 'code', title: '编号', width: 90 }, { key: 'catName', title: '主项', width: 120 }, { key: 'name', title: '子项', width: 240 }, { key: 'unit', title: '单位', width: 50 }] },
          { title: '价格', columns: [{ key: 'price', title: '单价', type: 'money4' }, { key: 'qty', title: '数量', type: 'int', width: 70 }, { key: 'amount', title: '金额', type: 'money', sum: true }] },
        ],
        rows: [], height: 170, emptyText: '请选择云端订单',
      });
      apply();
    },
  });

  /* ======================================================================
   * 结算记录（现金收款 / 基础）
   * ==================================================================== */
  const settleKind = (s) => (s.cloud ? '云端交易' : { 记账: '应收记账', 预存: '扣减预存', 抹零: '优惠抵扣', 在线付款码: '扫码收款' }[s.method] || '现金收款');
  const settleColor = (s) => ({ 应收记账: 'red', 扣减预存: 'blue', 优惠抵扣: 'green', 云端交易: 'green' }[settleKind(s)]);
  const decorateSettle = (s) => {
    const c = D.customer(s.custCode) || {}, w = D.workOrders.find((x) => x.no === s.orderNo);
    return Object.assign(s, { kind: settleKind(s), group: c.groupName || '', account: s.account || acctOf(s.method), payWay: s.method === '现金' ? '现钞' : s.method,
      returned: settleKind(s) === '现金收款' || settleKind(s) === '扫码收款' ? s.amount : 0, balanceInfo: c.prestoreBalance ? `预存余额 ${F.money(c.prestoreBalance)}` : '',
      invoiceText: yes(s.invoice), auditText: s.audited ? '已审核' : '', orderType: w ? w.orderType : '', net: r2(s.amount - (s.fee || 0)) });
  };
  const settleMenu = (getGrid, s, refresh) => ERP.ui.stdMenu(getGrid, [
    { label: '打开工单', disabled: !s || !s.orderNo, action: () => biz.openOrder(s.orderNo) },
    { label: s && s.audited ? '反审核' : '审核', shortcut: 'Ctrl+G', disabled: !s, action: () => { s.audited = !s.audited; refresh(); toast(s.audited ? '已审核' : '已反审核'); } },
    { label: '标记已开发票', disabled: !s, checked: s && s.invoice, action: () => { s.invoice = !s.invoice; refresh(); } },
    { label: '删除结算单', disabled: !s || s.audited, action: () => ERP.ui.confirm(`确定删除结算单 ${s.no}？关联工单的已结金额将同步扣回。`, () => {
      const w = D.workOrders.find((x) => x.no === s.orderNo);
      if (w) { w.paid = r2(w.paid - s.amount); w.unpaid = r2(w.amount - w.paid); w.settleStatus = w.paid <= 0 ? (w.amount ? '尚未结算' : '0元空单') : '部分结算'; }
      D.settlements.splice(D.settlements.indexOf(s), 1); biz.notifyOrdersChanged(); toast('已删除');
    }) },
    '-',
    { label: '打印收据', disabled: !s, action: () => toast('打印收据（原型）') },
  ], '结算记录');

  function settleRecords(el, cashOnly) {
    const { side, main } = split(el);
    let g, fAcct = 'all', fWay = 'all';
    const dr = ERP.ui.dateRange({ preset: 'year', onChange: () => g && apply() });
    const kinds = checks([{ label: '现金收款' }, { label: '应收记账', color: 'red' }, { label: '扣减预存', color: 'blue' }, { label: '优惠抵扣', color: 'green' },
      { label: '扫码收款' }, { label: '云端交易', color: 'green' }], () => apply());
    const custKw = input({ placeholder: '客户编号 / 名称' }), custGroup = select([['', '（全部）'], ...D.groups.map((x) => [x.name, x.name])]);
    const inv = checks(['已开发票', '未开发票'], () => apply(), 2), ticketKw = input({ placeholder: '票据信息' });
    const audit = checks(['已审核', '未审核'], () => apply(), 2), handler = select(['', ...D.employees.map((e) => e.name)]);
    function apply() {
      const k = custKw.value.trim(), ks = cashOnly ? ['现金收款', '扫码收款', '云端交易'] : kinds.values(), iv = inv.values(), au = audit.values(), t = ticketKw.value.trim();
      g.setRows(D.settlements.map(decorateSettle).filter((s) => inRange(s.date, dr.value) && ks.includes(s.kind)
        && (fAcct === 'all' || s.account === fAcct) && (fWay === 'all' || s.payWay === fWay)
        && (!k || s.custCode.includes(k) || s.custName.includes(k)) && (!custGroup.value || s.group === custGroup.value)
        && iv.includes(s.invoice ? '已开发票' : '未开发票') && (!t || (s.ticket || '').includes(t))
        && au.includes(s.audited ? '已审核' : '未审核') && (!handler.value || s.handler === handler.value)));
    }
    sidebar(side, [
      basePanel(dr, () => apply()),
      cashOnly ? listPanel('入账科目', ACCOUNTS, (v) => { fAcct = v; apply(); }, false) : { title: '结算方式', body: kinds.el },
      ...(cashOnly ? [listPanel('支付方式', ['现钞', '微信', '支付宝', '刷卡', '转账', '在线付款码'], (v) => { fWay = v; apply(); })] : []),
      { title: '客户单位', closed: true, body: [field('客户', custKw, { lw: 40 }), field('分组', custGroup, { lw: 40 })] },
      { title: '票据信息', closed: true, body: [inv.el, field('票据', ticketKw, { lw: 40 })] },
      { title: '单据特征', closed: true, body: [field('审核状态', audit.el, { lw: 56 }), field('经手人员', handler, { lw: 56 })] },
    ]);
    [custGroup, handler].forEach((x) => x.addEventListener('change', apply));
    [custKw, ticketKw].forEach((x) => x.addEventListener('keydown', (e) => e.key === 'Enter' && apply()));
    const groups = cashOnly ? [
      { title: '基础', columns: [{ key: 'no', title: '结算单号', width: 140 }, { key: 'date', title: '业务日期', type: 'date' }, { key: 'custName', title: '客户名称', width: 220 }, { key: 'group', title: '客户分组', width: 110 }, { key: 'custHandler', title: '客方经手', width: 80 }] },
      { title: '收款', columns: [{ key: 'amount', title: '收款金额', type: 'money', sum: true }, { key: 'account', title: '入账科目', width: 190 }, { key: 'payWay', title: '支付方式', width: 80 },
        { key: 'fee', title: '手续费用', type: 'money', sum: true, hideZero: true }, { key: 'net', title: '实际到账', type: 'money', sum: true }] },
      { title: '相关', columns: [{ key: 'orderNo', title: '工单编号', width: 140 }, { key: 'orderType', title: '工单类型', width: 80 }, { key: 'invoiceText', title: '已开发票', width: 70, align: 'center' }, { key: 'ticket', title: '票据信息', width: 100 }] },
      { title: '更多', columns: [{ key: 'handler', title: '经手人', width: 70 }, { key: 'auditText', title: '审核', width: 60, align: 'center' }, { key: 'remark', title: '备注', width: 140 }] },
    ] : [
      { title: '基础', columns: [{ key: 'no', title: '结算单号', width: 140 }, { key: 'date', title: '业务日期', type: 'date' }, { key: 'custName', title: '客户名称', width: 220 }, { key: 'group', title: '客户分组', width: 110 }, { key: 'custHandler', title: '客方经手', width: 80 }] },
      { title: '结算', columns: [{ key: 'kind', title: '结算方式', width: 80 }, { key: 'amount', title: '结算金额', type: 'money', sum: true }, { key: 'returned', title: '回款金额', type: 'money', sum: true }] },
      { title: '扩展', columns: [{ key: 'account', title: '结算科目', width: 190 }, { key: 'payWay', title: '支付方式', width: 80 }, { key: 'fee', title: '手续费用', type: 'money', sum: true, hideZero: true }, { key: 'balanceInfo', title: '结余信息', width: 140 }] },
      { title: '更多', columns: [{ key: 'invoiceText', title: '已开发票', width: 70, align: 'center' }, { key: 'ticket', title: '票据信息', width: 100 }, { key: 'orderNo', title: '工单编号', width: 140 },
        { key: 'handler', title: '经手人', width: 70 }, { key: 'auditText', title: '审核', width: 60, align: 'center' }, { key: 'remark', title: '备注', width: 140 }] },
    ];
    g = grid(main, { groups, rows: [], rowColor: settleColor, rowClass: (s) => (s.audited ? '' : 'bold'),
      onDblClick: (s) => (s.orderNo ? biz.openOrder(s.orderNo) : toast('该结算单无关联工单')),
      contextMenu: (s) => settleMenu(() => g, s, () => g.refresh()) });
    apply();
    onChanged(el, apply);
  }
  ERP.page('settleRecords', { title: '结算记录（现金收款）', render: (el) => settleRecords(el, true) });
  ERP.page('settleRecordsBasic', { title: '结算记录（基础）', render: (el) => settleRecords(el, false) });

  /* ======================================================================
   * 选择器：客户 / 会员卡
   * ==================================================================== */
  function pickFrom(title, columns, rows, match, onPick) {
    const dlg = dialog({ title, width: 760, height: 480, flush: true, body: (b) => {
      const kw = input({ placeholder: '输入编号 / 名称 / 电话过滤，回车选中第一项' });
      b.appendChild(h('div', { style: { padding: '8px', borderBottom: '1px solid var(--line)' } }, kw));
      const box = h('div.col.fill', { style: { padding: '6px', minHeight: 0 } });
      b.appendChild(box);
      const g = grid(box, { columns, rows, footer: false, onDblClick: (r) => { onPick(r); dlg.close(); } });
      kw.addEventListener('input', () => { const k = kw.value.trim(); g.setRows(rows.filter((r) => !k || match(r, k))); });
      kw.addEventListener('keydown', (e) => { if (e.key === 'Enter' && g.rows[0]) { onPick(g.rows[0]); dlg.close(); } });
      setTimeout(() => kw.focus());
    }, buttons: [{ label: '✔ 选定(S)', primary: true, action: (close) => { const g = dlg.body.querySelector('tr.sel'); if (!g) return toast('请选择一行'); g.dispatchEvent(new MouseEvent('dblclick')); } }, { label: '✕ 关闭(C)' }] });
  }
  const custPicker = (onPick) => pickFrom('选择客户',
    [{ key: 'code', title: '编号', width: 70 }, { key: 'type', title: '类型', width: 50 }, { key: 'name', title: '客户名称', width: 260 }, { key: 'groupName', title: '客户分组', width: 160 }, { key: 'phone', title: '手机', width: 110 }],
    D.customers.slice(1), (c, k) => c.code.includes(k) || c.name.includes(k) || (c.phone || '').includes(k), onPick);
  const cardPicker = (onPick) => pickFrom('选择会员卡',
    [{ key: 'cardNo', title: '卡片序号', width: 100 }, { key: 'custName', title: '客户名称', width: 240 }, { key: 'group', title: '客户分组', width: 150 }, { key: 'holder', title: '持卡人员', width: 70 }, { key: 'balance', title: '预存余额', type: 'money' }],
    D.cards.filter((k) => k.status !== '注销'), (c, k) => c.cardNo.includes(k) || c.custName.includes(k) || c.custCode.includes(k), onPick);

  /* ======================================================================
   * 卡片发行（会员卡发行）
   * ==================================================================== */
  ERP.page('cardIssue', {
    title: '卡片发行', kind: 'dialog',
    render() {
      const groups = D.groups.filter((x) => x.prestore);
      const st = { type: '电子卡片', bind: 'old', cust: null };
      const sec = (t) => h('div', { style: { fontWeight: 700, margin: '8px 0 4px', borderBottom: '1px solid var(--line)', paddingBottom: '3px' } }, t);
      const note = (t) => h('span.muted', t);
      const radio = (name, label, checked, onchange) => h('label.chk', h('input', { type: 'radio', name, checked, onchange }), label);
      const readIn = input({ value: '电子卡片无需读卡', readOnly: true });
      const group = select([['', ''], ...groups.map((x) => [x.code, x.name])], { style: { width: '220px' } });
      const nextNo = () => 'IC' + String(880001 + D.cards.length);
      const cardNo = input({ value: nextNo(), readOnly: true, style: { width: '160px' } });
      const expire = input({ type: 'date', style: { width: '160px' } });
      const idType = select(['身份证', '护照', '驾驶证', '军官证', '港澳通行证', '其他'], { style: { width: '160px' } });
      const idNo = input(), applicant = input({ style: { width: '140px' } }), applicantPhone = input({ style: { width: '220px' } });
      const pwd = input({ type: 'password', style: { width: '160px' } }), pwd2 = input({ type: 'password', style: { width: '160px' }, placeholder: '再次输入确认' });
      const issuer = select(D.employees.map((e) => e.name), { value: D.currentUser.name, style: { width: '160px' } });
      const custIn = input({ readOnly: true, placeholder: '点击右侧 🔍 选择客户' });
      const holder = select([''], { style: { width: '160px' } });
      const orgName = input({ placeholder: '机构名称' }), orgContact = input({ placeholder: '联系人' });
      const perName = input({ placeholder: '个人姓名' }), perPhone = input({ placeholder: '手机号码' });
      const setType = (t) => {
        st.type = t;
        readIn.value = t === '电子卡片' ? '电子卡片无需读卡' : ''; readIn.readOnly = t === '电子卡片';
        cardNo.readOnly = t === '电子卡片'; cardNo.value = t === '电子卡片' ? nextNo() : '';
      };
      const pickCust = () => custPicker((c) => {
        st.cust = c; custIn.value = `${c.code}/${c.name}`;
        holder.innerHTML = ''; [c.contact, '其他人员'].filter(Boolean).forEach((x) => holder.appendChild(h('option', x)));
        const gg = groups.find((x) => x.code === c.group); if (gg) group.value = gg.code;
        if (!applicant.value) applicant.value = c.contact || ''; if (!applicantPhone.value) applicantPhone.value = c.phone || '';
      });
      const bindBox = (key, label, ...fields) => h('div', radio('cbind', label, key === st.bind, () => { st.bind = key; }), h('div', { style: { paddingLeft: '24px' } }, fields));
      dialog({
        title: '会员卡发行', width: 1000, banner: '登记发行新的IC卡或绑定到已有客户、联络人资料或改写卡信息',
        body: h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' } },
          h('div',
            sec('1、卡片类型'), h('div.row', { style: { paddingLeft: '40px' } }, radio('ctype', '电子卡片', true, () => setType('电子卡片')), radio('ctype', '实体卡片', false, () => setType('实体卡片'))),
            sec('2、读取卡片'), h('div.row', readIn, btn('读卡(1)', () => (st.type === '电子卡片' ? toast('电子卡片无需读卡') : (cardNo.value = 'IC' + (990000 + D.cards.length), readIn.value = '已读取：' + cardNo.value, toast('读卡成功（原型）'))), 'sm')),
            sec('3、必填信息'),
            field(h('span.c-red', '客户分组'), group, { lw: 96 }),
            field('卡片序号', h('div.row', cardNo, note('（电子卡片由系统分配序号）')), { lw: 96 }),
            field('有效期至', h('div.row', expire, note('（为空代表永久有效）')), { lw: 96 }),
            field('证件名称', idType, { lw: 96 }), field('证件号码', idNo, { lw: 96 }),
            field('办卡人员姓名', applicant, { lw: 96 }), field('办卡人员电话', applicantPhone, { lw: 96 }),
            sec('4、密码设置'),
            field(h('span.c-red', '消费密码'), h('div.row', pwd, note('（输入后，敲回车再确认）')), { lw: 96 }),
            field('', pwd2, { lw: 96 })),
          h('div',
            sec('5、可选信息'), field('发行人员', issuer, { lw: 70 }),
            sec('6、持卡信息'),
            bindBox('old', '绑定至已有的客户资料',
              field('所属客户', h('div.row', custIn, btn('🔍', pickCust, 'sm')), { lw: 64 }), field('持卡人员', holder, { lw: 64 })),
            h('div', { style: { height: '10px' } }),
            bindBox('org', '绑定至新建的机构客户', h('div.formgrid.c2', orgName, orgContact)),
            h('div', { style: { height: '10px' } }),
            bindBox('per', '绑定至新建的个人客户', h('div.formgrid.c2', perName, perPhone)))),
        leftButtons: [{ label: '?', action: () => { toast('电子卡片无需读卡器；实体卡片请先放到读卡器上再点「读卡」'); return false; } }],
        buttons: [
          { label: '✔ 确定(S)', primary: true, action: (close) => {
            if (!group.value) return toast('请选择客户分组（决定卡片等级与折扣）');
            if (!cardNo.value) return toast('实体卡片请先读卡');
            if (D.cards.some((k) => k.cardNo === cardNo.value)) return toast('卡片序号已存在');
            if (!pwd.value || pwd.value !== pwd2.value) return toast('消费密码为空或两次输入不一致');
            let cust = st.cust;
            if (st.bind === 'old' && !cust) return toast('请选择所属客户');
            if (st.bind !== 'old') {
              const nm = st.bind === 'org' ? orgName.value.trim() : perName.value.trim();
              if (!nm) return toast('请填写新建客户名称');
              cust = { code: String(1400 + D.customers.length), name: nm, type: st.bind === 'org' ? '机构' : '个人', contact: st.bind === 'org' ? orgContact.value : nm,
                phone: st.bind === 'org' ? '' : perPhone.value, tel: '', address: '', debt: 0, prestoreBalance: 0, created: new Date(), remark: '' };
              D.customers.push(cust);
            }
            cust.group = group.value; cust.groupName = D.groupName(group.value);
            D.cards.push({ cardNo: cardNo.value, custCode: cust.code, custName: cust.name, group: cust.groupName, issueDate: new Date(), issuer: issuer.value,
              balance: cust.prestoreBalance || 0, totalIn: cust.prestoreBalance || 0, totalOut: 0, status: '正常', password: true, remark: '',
              cardType: st.type, holder: holder.value || cust.contact || cust.name, locked: false, lost: false, expire: expire.value ? new Date(expire.value) : null,
              idType: idType.value, idNo: idNo.value, applicant: applicant.value, applicantPhone: applicantPhone.value });
            notify(); close();
            toast(`发卡成功：${cardNo.value} → ${cust.name}`);
          } },
          { label: '✕ 关闭(C)' },
        ],
      });
    },
  });

  /* ======================================================================
   * IC 卡片资料管理
   * ==================================================================== */
  ERP.page('cardInfo', {
    title: 'IC卡片资料管理',
    render(el) {
      const { side, main } = split(el);
      let g, fGroup = 'all';
      const dr = ERP.ui.dateRange({ preset: 'month', label: '卡片发行时间', onChange: () => g && apply() });
      const kNo = input(), kId = input(), issuer = select(['', ...D.employees.map((e) => e.name)]);
      const exp = stateRow('过期状态', '已过期', '未过', () => apply()), lock = stateRow('锁定状态', '已锁定', '未锁', () => apply()), lost = stateRow('挂失状态', '已挂失', '未挂', () => apply());
      const custKw = input({ placeholder: '客户编号 / 名称' });
      const now = new Date();
      function apply() {
        const a = kNo.value.trim(), b = kId.value.trim(), k = custKw.value.trim();
        g.setRows(D.cards.filter((c) => inRange(c.issueDate, dr.value) && (!a || c.cardNo.includes(a)) && (!b || (c.idNo || '').includes(b)) && (!issuer.value || c.issuer === issuer.value)
          && exp.has(c.expire && c.expire < now ? '已过期' : '未过') && lock.has(c.locked ? '已锁定' : '未锁') && lost.has(c.lost ? '已挂失' : '未挂')
          && (fGroup === 'all' || c.group === fGroup) && (!k || c.custCode.includes(k) || c.custName.includes(k)))
          .map((c) => Object.assign(c, { pwdText: c.password ? '******' : '', lockText: c.locked ? '锁定' : '', lostText: c.lost ? '挂失' : '' })));
      }
      sidebar(side, [
        basePanel(dr, () => apply(), [field('卡片序号', kNo, { lw: 56 }), field('证件号码', kId, { lw: 56 }), field('发行人员', issuer, { lw: 56 }), exp.el, lock.el, lost.el]),
        listPanel('客户分组', D.groups.filter((x) => x.prestore).map((x) => x.name), (v) => { fGroup = v; apply(); }),
        { title: '所属客户', closed: true, body: custKw },
      ]);
      wideRange(dr);
      [kNo, kId, custKw].forEach((x) => x.addEventListener('keydown', (e) => e.key === 'Enter' && apply()));
      const upd = (c, patch, msg) => { Object.assign(c, patch); apply(); toast(msg); };
      g = grid(main, {
        groups: [
          { title: '客户', columns: [{ key: 'custCode', title: '客户编号', width: 80 }, { key: 'custName', title: '客户名称', width: 220 }, { key: 'group', title: '客户分组', width: 150 }] },
          { title: '卡片', columns: [{ key: 'cardNo', title: '卡片序号', width: 100 }, { key: 'cardType', title: '卡片类型', width: 80 }, { key: 'holder', title: '持卡人员', width: 80 },
            { key: 'pwdText', title: '密码', width: 70 }, { key: 'lockText', title: '锁定', width: 50, align: 'center' }, { key: 'lostText', title: '挂失', width: 50, align: 'center' }] },
          { title: '手续', columns: [{ key: 'applicant', title: '办卡人姓名', width: 80 }, { key: 'applicantPhone', title: '办卡人电话', width: 110 }, { key: 'idType', title: '证件名称', width: 70 },
            { key: 'idNo', title: '证件号码', width: 160 }, { key: 'expire', title: '失效日期', type: 'date' }, { key: 'issueDate', title: '发行日期', type: 'date' }, { key: 'issuer', title: '发行人员', width: 70 }] },
          { title: '余额', columns: [{ key: 'balance', title: '预存余额', type: 'money', sum: true }, { key: 'totalIn', title: '累计储值', type: 'money', sum: true }, { key: 'totalOut', title: '累计消费', type: 'money', sum: true }] },
          { title: '更多', columns: [{ key: 'status', title: '状态', width: 50 }, { key: 'remark', title: '备注', width: 140 }] },
        ],
        rows: [], rowColor: (c) => (c.status === '注销' ? 'gray' : c.lost ? 'red' : c.locked ? 'orange' : null),
        onDblClick: (c) => ERP.open('prestore', { cardNo: c.cardNo }),
        contextMenu: (c) => ERP.ui.stdMenu(() => g, [
          { label: '发行新卡(N)', action: () => ERP.open('cardIssue') },
          '-',
          { label: '预存储值', disabled: !c, action: () => ERP.open('prestore', { cardNo: c.cardNo }) },
          { label: '预存退款', disabled: !c, action: () => ERP.open('prestoreRefund', { cardNo: c.cardNo }) },
          '-',
          { label: c && c.locked ? '解除锁定' : '锁定卡片', disabled: !c, action: () => upd(c, { locked: !c.locked }, c.locked ? '已解锁' : '已锁定') },
          { label: c && c.lost ? '解除挂失' : '挂失卡片', disabled: !c, action: () => upd(c, { lost: !c.lost }, c.lost ? '已解除挂失' : '已挂失，该卡暂停使用') },
          { label: '重置消费密码', disabled: !c, action: () => { const p = prompt('输入新的消费密码：'); if (p) upd(c, { password: true }, '密码已重置'); } },
          { label: '补卡 / 换卡', disabled: !c, action: () => toast('请将新卡放到读卡器（原型）') },
          { label: '注销卡片', disabled: !c || c.balance > 0, action: () => ERP.ui.confirm(`注销卡片 ${c.cardNo}？`, () => upd(c, { status: '注销' }, '已注销')) },
        ], 'IC卡片资料'),
      });
      apply();
      onChanged(el, apply);
    },
  });

  /* ======================================================================
   * 预存储值 / 预存退款（对话框）
   * ==================================================================== */
  function prestoreDialog(refund, params) {
    let card = params.cardNo ? D.cards.find((k) => k.cardNo === params.cardNo) : null;
    const big = { fontSize: '30px', height: '50px', textAlign: 'right', fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--mono)' };
    const info = { no: input({ readOnly: true }), name: input({ readOnly: true }), group: input({ readOnly: true }), holder: input({ readOnly: true }), bal: input({ readOnly: true, style: { textAlign: 'right', color: 'var(--blue)', fontWeight: 700 } }) };
    const real = input({ value: '', style: big, placeholder: '0.00' });
    const gift = input({ value: '0.00', style: { textAlign: 'right' } }), total = input({ readOnly: true, style: { textAlign: 'right', fontWeight: 700 } });
    const after = input({ readOnly: true, style: { textAlign: 'right', fontWeight: 700 } });
    const newGroup = select([['', '（不变）'], ...D.groups.filter((x) => x.prestore).map((x) => [x.code, x.name])]);
    const acct = select(ACCOUNTS), way = select(PAYWAYS), fee = input({ value: '0.00', style: { textAlign: 'right' } });
    const invoice = check('已开发票', false), ticket = input(), memo = input(), pwd = input({ type: 'password', placeholder: '持卡人消费密码' });
    const reason = select(['客户要求退款', '卡片注销', '多存退回', '其他']);
    const show = () => {
      info.no.value = card ? card.cardNo : ''; info.name.value = card ? `${card.custCode}/${card.custName}` : ''; info.group.value = card ? card.group : '';
      info.holder.value = card ? card.holder : ''; info.bal.value = card ? F.money(card.balance) : '';
      if (refund && card && !real.value) real.value = F.money(card.balance);
      calc();
    };
    // 预存金额 = 实收 + 赠送；退款 = 退款金额 + 扣回赠送
    function calc() {
      const t = r2((Number(real.value) || 0) + (Number(gift.value) || 0));
      total.value = F.money(t);
      after.value = card ? F.money(r2(card.balance + (refund ? -t : t))) : '';
    }
    // 预存赠送：满 1000 送 200 / 满 5000 送 500（示例规则，可修改）
    const autoGift = () => { if (refund) return; const v = Number(real.value) || 0; gift.value = F.money(v >= 5000 ? r2(v * 0.1) : v >= 1000 ? r2(v * 0.2) : 0); calc(); };
    real.addEventListener('input', () => { autoGift(); calc(); });
    gift.addEventListener('input', calc);
    const choose = () => cardPicker((k) => { card = k; real.value = ''; show(); });
    const title = refund ? '预存退款' : '预存储值';
    dialog({
      title, width: 820,
      banner: refund ? '退还会员卡内的预存余额，退款将从选定的资金科目支出' : '为会员卡客户预存（充值）款项，可同时赠送金额并调整客户分组（卡片等级）',
      body: h('div.col',
        h('div.fieldset', h('legend', '会员卡'),
          h('div.row', btn('读卡(D)', () => (D.cards[0] ? ((card = D.cards[0]), show(), toast('读卡成功（原型）')) : toast('无卡片')), 'sm'), btn('选择会员卡(F)', choose, 'sm primary'),
            h('span.muted', '先读卡或选择会员卡，再输入金额')),
          h('div.formgrid.c3', field('卡片序号', info.no, { lw: 60 }), field('持卡客户', info.name, { lw: 60 }), field('客户分组', info.group, { lw: 60 }),
            field('持卡人员', info.holder, { lw: 60 }), field(h('span.c-blue', '当前余额'), info.bal, { lw: 60 }), refund ? field('消费密码', pwd, { lw: 60 }) : h('span'))),
        h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' } },
          h('div.fieldset', h('legend', refund ? '退款金额' : '预存金额'),
            field(refund ? '退款金额' : '实收金额', real, { lw: 64 }),
            field(refund ? '扣回赠送' : '赠送金额', gift, { lw: 64 }),
            field(refund ? '合计扣减' : '预存合计', total, { lw: 64 }),
            field(refund ? '退后余额' : '存后余额', after, { lw: 64 })),
          h('div.fieldset', h('legend', refund ? '出账信息' : '入账信息'),
            field(refund ? '出账科目' : '入账科目', acct, { lw: 64 }), field('支付方式', way, { lw: 64 }), field('手续费用', fee, { lw: 64 }),
            refund ? field('退款原因', reason, { lw: 64 }) : field('调整分组', newGroup, { lw: 64 }),
            field('票据信息', h('div.row', ticket, invoice), { lw: 64 }))),
        field('详细说明', memo, { lw: 64 })),
      leftButtons: [{ label: refund ? '预存记录' : '预存记录(R)', action: () => { ERP.open('prestoreRecords'); return false; } }],
      buttons: [
        { label: '✔ 确定(S)', primary: true, action: (close) => {
          if (!card) return toast('请先读卡或选择会员卡');
          if (card.lost || card.locked) return toast('该卡已挂失或锁定，不能办理');
          const v = r2(Number(real.value) || 0), gv = r2(Number(gift.value) || 0), t = r2(v + gv);
          if (v <= 0) return toast(`请输入${refund ? '退款' : '实收'}金额`);
          if (refund && t > card.balance) return toast('退款金额超过卡内余额');
          if (refund && !pwd.value) return toast('请输入消费密码');
          const cust = D.customer(card.custCode);
          const before = card.group;
          card.balance = r2(card.balance + (refund ? -t : t));
          if (refund) card.totalOut = r2(card.totalOut + t); else card.totalIn = r2(card.totalIn + t);
          if (cust) cust.prestoreBalance = card.balance;
          if (!refund && newGroup.value) { card.group = D.groupName(newGroup.value); if (cust) { cust.group = newGroup.value; cust.groupName = card.group; } }
          const sign = refund ? -1 : 1;
          D.prestores.unshift({ no: docNo(refund ? 'YT' : 'YC', D.prestores), date: new Date(), custCode: card.custCode, custName: card.custName, cardNo: card.cardNo,
            type: refund ? '退款' : '储值', amount: sign * t, real: sign * v, gift: sign * gv, groupBefore: before, account: acct.value, method: way.value,
            fee: Number(fee.value) || 0, invoice: invoice.firstChild.checked, ticket: ticket.value, handler: D.currentUser.name, audited: true,
            remark: refund ? reason.value + (memo.value ? '；' + memo.value : '') : memo.value });
          notify(); close();
          toast(`${title}成功：${card.custName} ${refund ? '-' : '+'}${F.money(t)}，余额 ${F.money(card.balance)}`);
        } },
        { label: '✕ 关闭(C)' },
      ],
    });
    show();
  }
  ERP.page('prestore', { title: '预存储值', kind: 'dialog', render: (_, p) => prestoreDialog(false, p) });
  ERP.page('prestoreRefund', { title: '预存退款', kind: 'dialog', render: (_, p) => prestoreDialog(true, p) });

  /* ---------- 预存记录 ---------- */
  ERP.page('prestoreRecords', {
    title: '预存记录',
    render(el) {
      const { side, main } = split(el);
      let g, fAcct = 'all', fWay = 'all';
      const dr = ERP.ui.dateRange({ preset: 'last30', onChange: () => g && apply() });
      const custKw = input({ placeholder: '客户编号 / 名称 / 卡号' });
      const inv = checks(['已开发票', '未开发票'], () => apply(), 2), ticketKw = input({ placeholder: '票据信息' });
      const types = checks(['储值', '退款'], () => apply(), 2), audit = checks(['已审核', '未审核'], () => apply(), 2);
      function apply() {
        const k = custKw.value.trim(), t = ticketKw.value.trim(), iv = inv.values(), ty = types.values(), au = audit.values();
        g.setRows(D.prestores.filter((p) => inRange(p.date, dr.value) && (fAcct === 'all' || p.account === fAcct) && (fWay === 'all' || p.method === fWay)
          && (!k || p.custCode.includes(k) || p.custName.includes(k) || (p.cardNo || '').includes(k)) && iv.includes(p.invoice ? '已开发票' : '未开发票')
          && (!t || (p.ticket || '').includes(t)) && ty.includes(p.type) && au.includes(p.audited ? '已审核' : '未审核'))
          .map((p) => Object.assign(p, { invoiceText: yes(p.invoice), auditText: p.audited ? '已审核' : '' })));
      }
      sidebar(side, [
        basePanel(dr, () => apply()),
        listPanel('入账科目', ACCOUNTS, (v) => { fAcct = v; apply(); }),
        listPanel('支付方式', ['现金', ...PAYWAYS], (v) => { fWay = v; apply(); }),
        { title: '客户单位', closed: true, body: custKw },
        { title: '票据信息', closed: true, body: [inv.el, field('票据', ticketKw, { lw: 40 })] },
        { title: '单据特征', closed: true, body: [field('业务类型', types.el, { lw: 56 }), field('审核状态', audit.el, { lw: 56 })] },
      ]);
      wideRange(dr);
      [custKw, ticketKw].forEach((x) => x.addEventListener('keydown', (e) => e.key === 'Enter' && apply()));
      g = grid(main, {
        groups: [
          { title: '基础', columns: [{ key: 'no', title: '预存单号', width: 130 }, { key: 'date', title: '业务日期', type: 'date' }, { key: 'custName', title: '客户名称', width: 220 }, { key: 'groupBefore', title: '预存前分组', width: 140 }] },
          { title: '预存', columns: [{ key: 'amount', title: '预存金额', type: 'money', sum: true }, { key: 'real', title: '实收金额', type: 'money', sum: true }, { key: 'gift', title: '赠送金额', type: 'money', sum: true },
            { key: 'account', title: '入账科目', width: 180 }, { key: 'method', title: '支付方式', width: 70 }, { key: 'fee', title: '手续费用', type: 'money', sum: true, hideZero: true },
            { key: 'invoiceText', title: '已开发票', width: 70, align: 'center' }, { key: 'ticket', title: '票据信息', width: 100 }, { key: 'remark', title: '详细说明', width: 180 }] },
          { title: '更多', columns: [{ key: 'cardNo', title: '卡片序号', width: 90 }, { key: 'type', title: '业务类型', width: 70, align: 'center' }, { key: 'handler', title: '经手人', width: 70 }, { key: 'auditText', title: '审核', width: 60, align: 'center' }] },
        ],
        rows: [], rowColor: (p) => (p.type === '退款' ? 'red' : null),
        contextMenu: (p) => ERP.ui.stdMenu(() => g, [
          { label: '预存储值', action: () => ERP.open('prestore', p ? { cardNo: p.cardNo } : {}) },
          { label: '预存退款', action: () => ERP.open('prestoreRefund', p ? { cardNo: p.cardNo } : {}) },
          '-',
          { label: p && p.audited ? '反审核' : '审核', disabled: !p, action: () => { p.audited = !p.audited; apply(); toast(p.audited ? '已审核' : '已反审核'); } },
          { label: '删除', disabled: !p || p.audited, action: () => ERP.ui.confirm(`删除预存单 ${p.no}？卡内余额将同步冲回。`, () => {
            const k = D.cards.find((c) => c.cardNo === p.cardNo);
            if (k) { k.balance = r2(k.balance - p.amount); const c = D.customer(k.custCode); if (c) c.prestoreBalance = k.balance; }
            D.prestores.splice(D.prestores.indexOf(p), 1); notify(); toast('已删除');
          }) },
          { label: '打印预存凭证', disabled: !p, action: () => toast('打印预存凭证（原型）') },
        ], '预存记录'),
      });
      apply();
      onChanged(el, apply);
    },
  });

  /* ======================================================================
   * 营业日报表（报表窗口）
   * ==================================================================== */
  const CASH_METHODS = ['现金', '现钞', '微信', '支付宝', '刷卡', '转账', '支票', '汇款', '在线付款码', '其他'];
  // 汇总各类财务单据为统一流水：{no, bizType, doc, party, income, expense, account, method, orderNo, orderType, invoice, ticket, date, cash, bucket}
  function ledger() {
    const rows = [];
    D.settlements.forEach((s) => {
      const w = D.workOrders.find((x) => x.no === s.orderNo);
      const bucket = s.method === '记账' ? '应收' : s.method === '预存' ? '预存' : '现金';
      rows.push({ no: s.no, bizType: '结算单', doc: s.orderNo ? '工单结算' : '往来结算', party: s.custName, income: bucket === '现金' ? s.amount : 0, expense: 0, amount: s.amount,
        account: bucket === '现金' ? acctOf(s.method) : bucket === '应收' ? '应收账款' : '预收账款', method: s.method === '现金' ? '现钞' : s.method,
        orderNo: s.orderNo, orderType: w ? w.orderType : '', invoice: yes(s.invoice), ticket: s.ticket || '', date: s.date, auditor: s.audited ? s.handler : '', handler: s.handler, cash: bucket === '现金', bucket });
    });
    D.prestores.forEach((p) => rows.push({ no: p.no, bizType: p.type === '退款' ? '预存退款' : '预存单', doc: '会员卡 ' + (p.cardNo || ''), party: p.custName,
      income: p.real > 0 ? p.real : 0, expense: p.real < 0 ? -p.real : 0, amount: p.real, account: p.account, method: p.method === '现金' ? '现钞' : p.method,
      orderNo: '', orderType: '', invoice: yes(p.invoice), ticket: p.ticket || '', date: p.date, handler: p.handler, cash: true, bucket: '预存', gift: p.gift }));
    D.miscIncomes.forEach((m) => rows.push({ no: m.no, bizType: '零收单', doc: m.itemName || m.item, party: m.custName || '零收散户', income: m.amount, expense: 0, amount: m.amount,
      account: m.account, method: m.method === '现金' ? '现钞' : m.method, orderNo: '', orderType: '', invoice: yes(m.invoice), ticket: m.ticket || '', date: m.date, handler: m.handler, cash: true, bucket: '现金' }));
    D.cashJournal.forEach((j) => rows.push({ no: j.no, bizType: j.kind, doc: j.type, party: '', income: j.kind === '一般收入' ? j.amount : 0, expense: j.kind === '一般支出' ? j.amount : 0,
      amount: j.kind === '一般收入' ? j.amount : -j.amount, account: j.account.includes('现金') ? '现金>前台钱箱' : '银行存款>' + j.account, method: '转账', orderNo: '', orderType: '',
      invoice: '', ticket: '', date: j.date, handler: j.handler, cash: true, bucket: '现金' }));
    return rows;
  }

  ERP.page('dailyReport', {
    title: '营业日报表', kind: 'dialog',
    render() {
      let dr, handler, auditor, acctTree, fWay = '[全部]', inv, sumBox, gCash, gOther, tabs;
      const ways = ['[全部]', '现钞', '支票', '刷卡', '汇款', '微信', '支付宝', '其他'];
      const filtered = () => {
        const r = dr.value, accts = acctTree.values(), iv = inv.values();
        return ledger().filter((x) => inRange(x.date, r) && (!handler.value || x.handler === handler.value) && (!auditor.value || x.auditor === auditor.value)
          && (fWay === '[全部]' || x.method === fWay || (fWay === '汇款' && x.method === '转账') || (fWay === '其他' && !ways.includes(x.method)))
          && (!x.cash || !x.account.includes('>') || accts.some((a) => x.account.endsWith(a)))
          && iv.includes(x.invoice ? '有票' : '无票'));
      };
      // 顶部汇总：支付方式 / 现金 / 应收 / 预存 四栏，每栏 ＋ 增加、－ 减少、合计
      function summary(rows) {
        sumBox.innerHTML = '';
        const col = (title, plus, minus) => {
          const line = (cls, [k, n, v]) => h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 50px 100px', fontSize: '12px', padding: '1px 0 1px 16px' } },
            h('span', k), h('span.muted', n + '单'), h('span.num.' + cls, { style: { textAlign: 'right', fontFamily: 'var(--mono)' } }, F.money(v)));
          const tp = plus.reduce((s, x) => s + x[2], 0), tm = minus.reduce((s, x) => s + x[2], 0), tot = r2(tp - tm);
          return h('div', { style: { padding: '0 14px', borderRight: '1px dashed var(--line)' } },
            h('div', { style: { fontWeight: 700, borderBottom: '1px solid var(--line)', paddingBottom: '4px', marginBottom: '4px' } }, title),
            h('div.c-red', { style: { fontWeight: 700 } }, '＋'), plus.map((x) => line('c-red', x)),
            h('div.c-green', { style: { fontWeight: 700, marginTop: '6px' } }, '－'), minus.map((x) => line('c-green', [x[0], x[1], -x[2]])),
            h('div', { style: { borderTop: '1px solid var(--line)', marginTop: '6px', paddingTop: '4px', textAlign: 'right', fontSize: '16px', fontWeight: 700 }, class: tot < 0 ? 'c-green' : 'c-red' }, F.money(tot)));
        };
        const agg = (list, keyFn, valFn) => {
          const m = new Map();
          list.forEach((x) => { const k = keyFn(x), v = valFn(x); if (!v) return; const o = m.get(k) || [k, 0, 0]; o[1]++; o[2] = r2(o[2] + v); m.set(k, o); });
          return [...m.values()];
        };
        const cash = rows.filter((x) => x.cash);
        const cashAcct = cash.filter((x) => x.account.startsWith('现金'));
        sumBox.append(h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', padding: '10px 0' } },
          col('支付方式', agg(cash, (x) => x.method, (x) => x.income), agg(cash, (x) => x.method, (x) => x.expense)),
          col('现金', agg(cashAcct, (x) => x.bizType, (x) => x.income), agg(cashAcct, (x) => x.bizType, (x) => x.expense)),
          col('应收', agg(rows.filter((x) => x.bucket === '应收'), (x) => x.bizType, (x) => x.amount), []),
          col('预存', agg(rows.filter((x) => x.bizType === '预存单'), () => '预存单', (x) => x.amount + (x.gift || 0)),
            agg(rows.filter((x) => (x.bizType === '结算单' && x.bucket === '预存') || x.bizType === '预存退款'), (x) => x.bizType, (x) => Math.abs(x.amount) + Math.abs(x.gift || 0)))));
      }
      const stat = () => { const rows = filtered(); summary(rows); gCash.setRows(rows.filter((x) => x.cash)); gOther.setRows(rows.filter((x) => !x.cash)); };
      const cols = () => [
        { title: '基础', columns: [{ key: 'no', title: '单据编号', width: 130 }, { key: 'bizType', title: '业务类型', width: 80 }, { key: 'doc', title: '业务单据', width: 140 }, { key: 'party', title: '往来单位', width: 200 }] },
        { title: '金额', columns: [{ key: 'income', title: '收入金额', type: 'money', sum: true, hideZero: true }, { key: 'expense', title: '支出金额', type: 'money', sum: true, hideZero: true },
          { key: 'account', title: '会计科目', width: 180 }, { key: 'method', title: '支付方式', width: 80 }] },
        { title: '相关', columns: [{ key: 'orderNo', title: '工单编号', width: 130 }, { key: 'orderType', title: '工单类型', width: 70 }, { key: 'invoice', title: '相关发票', width: 70, align: 'center' },
          { key: 'ticket', title: '票据信息', width: 90 }, { key: 'date', title: '业务日期', type: 'date' }] },
      ];
      const gridOpts = (name) => ({ groups: cols(), rows: [], rowColor: (x) => (x.expense ? 'green' : null), contextMenu: () => ERP.ui.stdMenu(() => (name === 'c' ? gCash : gOther), [], '营业日报'),
        onDblClick: (x) => (x.orderNo ? biz.openOrder(x.orderNo) : null) });
      ERP.ui.reportWindow({
        title: '营业日报表-[报表]', banner: '汇总计算各类财务相关单据在指定时间范围内的数据。', sideWidth: 250,
        side(s) {
          dr = ERP.ui.dateRange({ preset: 'month', label: '单据审核时间', onChange: () => gCash && stat() });
          handler = select(['', ...D.employees.map((e) => e.name)], { onchange: () => stat() });
          auditor = select(['', ...D.employees.map((e) => e.name)], { onchange: () => stat() });
          // 现金银行：两级树（复选）
          const leaves = [['现金', ['前台钱箱', '备用金']], ['银行存款', D.accounts.filter((a) => a.parent).map((a) => a.name)]];
          const boxes = [];
          const tree = h('div', { style: { border: '1px solid var(--line)', borderRadius: '4px', padding: '4px 6px', maxHeight: '180px', overflow: 'auto', background: '#fff' } },
            leaves.map(([p, kids]) => {
              const kidBoxes = kids.map((k) => { const c = check(k, true, { onchange: () => stat() }); c.dataset.v = k; boxes.push(c); return c; });
              const parent = check(p, true, { onchange: (e) => { kidBoxes.forEach((c) => (c.firstChild.checked = e.target.checked)); stat(); } });
              return h('div', h('div', '▾ ', parent), h('div.col', { style: { paddingLeft: '22px', gap: '2px' } }, kidBoxes));
            }));
          acctTree = { values: () => boxes.filter((b) => b.firstChild.checked).map((b) => b.dataset.v) };
          inv = checks(['有票', '无票'], () => stat(), 2);
          sidebar(s, [
            { title: '查询条件', body: [dr.el, field('经手人员', handler, { lw: 56 }), field('审核人员', auditor, { lw: 56 })] },
            { title: '现金银行', body: tree },
            { title: '支付方式', value: '[全部]', list: ways.map((w) => ({ label: w, value: w })), onSelect: (v) => { fWay = v; stat(); } },
            { title: '更多条件', body: field('发票状态', inv.el, { lw: 56 }) },
          ]);
        },
        render(m) {
          sumBox = h('div', { style: { flex: '0 0 auto', borderBottom: '1px solid var(--line)', overflow: 'auto', maxHeight: '45%' } });
          m.append(sumBox);
          const box = h('div.col.fill', { style: { minHeight: 0 } });
          m.append(box);
          tabs = ERP.ui.itabs(box, [
            { title: '现金相关', render: (p) => { gCash = grid(p, gridOpts('c')); } },
            { title: '非现金的', render: (p) => { gOther = grid(p, gridOpts('o')); } },
          ]);
          tabs.select(1); tabs.select(0);
          stat();
        },
        onStat: () => { stat(); toast('统计完成'); },
        onExport: () => (tabs.root.querySelector('.itab-pane.active') === tabs.panes[0] ? gCash : gOther).exportCsv('营业日报表'),
        extraLeft: [
          { label: '打印-现金相关', action: () => { toast('打印现金相关明细（原型）'); return false; } },
          { label: '打印-全部记录', action: () => { toast('打印全部记录（原型）'); return false; } },
          { label: '打印-不带明细', action: () => { toast('打印汇总（原型）'); return false; } },
        ],
      });
    },
  });

  /* ======================================================================
   * 零收（对话框）/ 零收记录
   * ==================================================================== */
  ERP.page('miscIncome', {
    title: '零收', kind: 'dialog',
    render() {
      const st = { item: null };
      const num = (v) => input({ value: v, style: { textAlign: 'right', fontFamily: 'var(--mono)' } });
      const cust = input({ value: '零收散户' });
      const catIn = input({ readOnly: true, placeholder: '经营主项' }), itemIn = input({ readOnly: true, placeholder: '点击「选择项目」' }), unit = input({ readOnly: true, style: { width: '60px' } });
      const price = num('0.000'), qty = num('1');
      const amount = input({ value: '0.00', style: { fontSize: '30px', height: '50px', textAlign: 'right', fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--mono)' } });
      const acct = select(ACCOUNTS), way = select(PAYWAYS), fee = num('0.00');
      const invoice = check('已开发票', false), ticket = input(), memo = input();
      way.addEventListener('change', () => { const a = acctOf(way.value); if (a) acct.value = a; });
      const calc = () => { amount.value = F.money(r2((Number(price.value) || 0) * (Number(qty.value) || 0))); };
      [price, qty].forEach((x) => x.addEventListener('input', calc));
      const pick = () => biz.itemPicker((it) => {
        st.item = it; catIn.value = D.itemCatName(it.cat); itemIn.value = it.name; unit.value = it.unit; price.value = it.price.toFixed(3); calc(); qty.focus(); qty.select();
      });
      const reset = () => { st.item = null; [catIn, itemIn, unit, ticket, memo].forEach((x) => (x.value = '')); price.value = '0.000'; qty.value = '1'; amount.value = '0.00'; invoice.firstChild.checked = false; };
      const save = () => {
        const v = r2(Number(amount.value) || 0);
        if (!st.item) { toast('请选择经营项目'); return false; }
        if (v <= 0) { toast('零收金额必须大于 0'); return false; }
        const no = docNo('LS', D.miscIncomes);
        D.miscIncomes.unshift({ no, date: new Date(), custName: cust.value || '零收散户', item: st.item.name, itemName: st.item.name, cat: st.item.cat, catName: D.itemCatName(st.item.cat),
          unit: st.item.unit, price: Number(price.value) || 0, qty: Number(qty.value) || 0, amount: v, account: acct.value, method: way.value, fee: Number(fee.value) || 0,
          invoice: invoice.firstChild.checked, ticket: ticket.value, remark: memo.value, handler: D.currentUser.name, source: '手动登记创建', audited: true });
        notify();
        toast(`零收已登记：${no}  ¥${F.money(v)}`);
        return true;
      };
      dialog({
        title: '零收', width: 760, banner: '登记无需开工作单的零散收入（如复印、打印、扫描），直接收款入账',
        body: h('div.col',
          h('div.fieldset', h('legend', '基础'), h('div.formgrid.c2',
            field('客户名称', cust, { lw: 64 }), field('业务日期', input({ value: F.date(new Date()), readOnly: true }), { lw: 64 }))),
          h('div.fieldset', h('legend', '项目'),
            h('div.row', field('经营主项', catIn, { lw: 64, class: 'grow' }), btn('选择项目(I)', pick, 'sm primary')),
            field('经营子项', h('div.row', itemIn, unit), { lw: 64 }),
            h('div.formgrid.c2', field('单价', price, { lw: 64 }), field('数量', qty, { lw: 64 }))),
          h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' } },
            h('div.fieldset', h('legend', '金额'), field('零收金额', amount, { lw: 64 })),
            h('div.fieldset', h('legend', '入账'), field('入账科目', acct, { lw: 64 }), field('支付方式', way, { lw: 64 }), field('手续费用', fee, { lw: 64 }))),
          h('div.formgrid.c2', field('票据信息', h('div.row', ticket, invoice), { lw: 64 }), field('说明备注', memo, { lw: 64 }))),
        leftButtons: [
          { label: '找零计算器(L)', action: () => { const got = prompt('客户付款金额：', amount.value); if (got) toast(`找零：${F.money(got - amount.value)}`); return false; } },
          { label: '零收记录(R)', action: () => { ERP.open('miscIncomeRecords'); return false; } },
        ],
        buttons: [
          { label: '保存并新增(N)', action: () => { if (save()) reset(); return false; } },
          { label: '✔ 确定(S)', primary: true, action: (close) => { if (save()) close(); } },
          { label: '✕ 关闭(C)' },
        ],
      });
    },
  });

  ERP.page('miscIncomeRecords', {
    title: '零收记录',
    render(el) {
      const { side, main } = split(el);
      let g, fAcct = 'all', fWay = 'all';
      const dr = ERP.ui.dateRange({ preset: 'year', onChange: () => g && apply() });
      const src = checks(['手动登记创建', '云端交易（支付宝）', '云端交易（微信）'], () => apply());
      const inv = checks(['已开发票', '未开发票'], () => apply(), 2), ticketKw = input({ placeholder: '票据信息' });
      const audit = checks(['已审核', '未审核'], () => apply(), 2), handler = select(['', ...D.employees.map((e) => e.name)], { onchange: () => apply() });
      function apply() {
        const s = src.values(), iv = inv.values(), t = ticketKw.value.trim(), au = audit.values();
        g.setRows(D.miscIncomes.filter((m) => inRange(m.date, dr.value) && s.includes(m.source) && (fAcct === 'all' || m.account === fAcct) && (fWay === 'all' || m.method === fWay)
          && iv.includes(m.invoice ? '已开发票' : '未开发票') && (!t || (m.ticket || '').includes(t)) && au.includes(m.audited ? '已审核' : '未审核')
          && (!handler.value || m.handler === handler.value))
          .map((m) => Object.assign(m, { payWay: m.method === '现金' ? '现钞' : m.method, priceText: Number(m.price).toFixed(3), invoiceText: yes(m.invoice) })));
      }
      sidebar(side, [
        basePanel(dr, () => apply()),
        { title: '创建方式', body: src.el },
        listPanel('入账科目', ACCOUNTS, (v) => { fAcct = v; apply(); }),
        listPanel('支付方式', ['现金', ...PAYWAYS], (v) => { fWay = v; apply(); }),
        { title: '票据信息', closed: true, body: [inv.el, field('票据', ticketKw, { lw: 40 })] },
        { title: '单据特征', closed: true, body: [field('审核状态', audit.el, { lw: 56 }), field('经手人员', handler, { lw: 56 })] },
      ]);
      ticketKw.addEventListener('keydown', (e) => e.key === 'Enter' && apply());
      g = grid(main, {
        groups: [
          { title: '基础', columns: [{ key: 'no', title: '零收单号', width: 130 }, { key: 'date', title: '业务日期', type: 'date' }, { key: 'custName', title: '客户名称', width: 160 }] },
          { title: '项目', columns: [{ key: 'catName', title: '经营主项', width: 110 }, { key: 'itemName', title: '经营子项', width: 200 }, { key: 'unit', title: '单位', width: 50 },
            { key: 'priceText', title: '单价', width: 80, align: 'right' }, { key: 'qty', title: '数量', type: 'money' }] },
          { title: '金额', columns: [{ key: 'amount', title: '零收金额', type: 'money', sum: true }, { key: 'account', title: '入账科目', width: 180 }, { key: 'payWay', title: '支付方式', width: 70, align: 'center' },
            { key: 'fee', title: '手续费用', type: 'money', sum: true, hideZero: true }, { key: 'invoiceText', title: '已开发票', width: 70, align: 'center' }, { key: 'ticket', title: '票据信息', width: 100 }] },
          { title: '更多', columns: [{ key: 'source', title: '创建方式', width: 130 }, { key: 'handler', title: '经手人', width: 70 }, { key: 'remark', title: '说明备注', width: 140 }] },
        ],
        rows: [], rowClass: (m) => (m.audited ? '' : 'bold'), rowColor: (m) => (m.source !== '手动登记创建' ? 'green' : null),
        contextMenu: (m) => ERP.ui.stdMenu(() => g, [
          { label: '新增零收(N)', action: () => ERP.open('miscIncome') },
          { label: m && m.audited ? '反审核' : '审核', disabled: !m, action: () => { m.audited = !m.audited; apply(); toast(m.audited ? '已审核' : '已反审核'); } },
          { label: '删除', disabled: !m || m.audited, action: () => ERP.ui.confirm(`删除零收单 ${m.no}？`, () => { D.miscIncomes.splice(D.miscIncomes.indexOf(m), 1); notify(); toast('已删除'); }) },
          { label: '打印小票', disabled: !m, action: () => toast('打印零收小票（原型）') },
        ], '零收记录'),
      });
      apply();
      onChanged(el, apply);
    },
  });
})();
