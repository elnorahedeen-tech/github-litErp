/* 前台（续）：工单记录（全面/基础）、云端业务中心（+订单详情）、结算记录（现金收款/基础）、
 * 预存储值 / 预存退款（表单页）、预存记录、会员卡资料（+卡片详情）、卡片发行（表单页）、
 * 营业日报表（报表页）、零收（表单页）/ 零收记录。
 * 字段与业务逻辑取自 archive/v1-ribbon-20261019/.../frontdesk-more.js；界面按 v2 约定改写：
 * 左侧筛选栏 → 工具栏筛选；右键菜单 → “操作”列；弹窗式单据 → 表单页。
 * 依赖 pages/frontdesk.js 中的 ERP.biz（settle / flowTransfer / itemPicker / nextOrderNo / recalcOrder / auditBadge 等）。 */
(function () {
  'use strict';
  const { h, btn, link, linkBtn, badge, notice, kv, panel, field, input, money, dateInput, textarea, select, dialog, confirm, toast } = ERP.ui;
  const D = ERP.data, F = ERP.fmt, r2 = D.util.r2;
  const biz = (ERP.biz = ERP.biz || {});
  const pad = (n, l = 2) => String(n).padStart(l, '0');

  /* ---------- 通用小工具 ---------- */
  // 入账科目（与收款结算一致）与支付方式
  const ACCOUNTS = ['现金>前台钱箱', '现金>备用金', ...D.accounts.filter((a) => a.parent).map((a) => '银行存款>' + a.name)];
  const PAYWAYS = ['现钞', '微信', '支付宝', '刷卡', '转账', '支票', '汇款', '其他'];
  const acctOf = (method) => ({ 现金: '现金>前台钱箱', 现钞: '现金>前台钱箱', 微信: '银行存款>微信', 支付宝: '银行存款>支付宝',
    刷卡: '银行存款>一般账户（XX银行）', 转账: '银行存款>一般账户（XX银行）', 在线付款码: '银行存款>微信' }[method] || '');
  // 单据编号：前缀 + yyMMdd + 10 + 3 位序号（与旧系统 LS26091410001 一致）
  const docNo = (prefix, list) => {
    const n = new Date();
    const day = `${String(n.getFullYear()).slice(2)}${pad(n.getMonth() + 1)}${pad(n.getDate())}`;
    return biz.nextSerial(list, `${prefix}${day}10`, 3);
  };
  const num = (v) => Number(String(v ?? '').replace(/,/g, '')) || 0;
  const yesNo = (v) => (v ? '是' : '否');
  const optMoney = (v) => (v ? F.money(v) : '—'); // 手续费、抹零等可选金额：0 显示“—”
  const empOptions = () => D.employees.map((e) => e.name);
  const groupOptions = () => D.groups.map((g) => g.name);
  const prestoreGroups = () => D.groups.filter((g) => g.prestore);
  const auditFilter = { key: 'audit', type: 'select', label: '审核状态', options: ['已审核', '未审核'], match: (r, v) => (r.audited ? '已审核' : '未审核') === v };
  const invoiceFilter = { key: 'inv', type: 'select', label: '发票', options: ['已开发票', '未开发票'], match: (r, v) => (r.invoice ? '已开发票' : '未开发票') === v };
  const custLink = (code, name) => (code && code !== '000000' ? link(name, 'customerDetail', { code }, { ariaLabel: `查看客户 ${name}` }) : name || '未提供');
  const orderLink = (no) => (no && biz.order(no) ? link(no, 'orderDetail', { no }, { ariaLabel: `查看工单 ${no}` }) : no || '—');
  // 当前地址里的筛选参数（切换全面/基础视图时保留，页码除外）
  const hashParams = () => { const p = ERP.params(); delete p.page; return p; };
  // 分组表头：sets = [{title, columns}] → {columns, groups}
  // 未指定宽度的列不换行（短文本、编号、日期），长文本列给 width 允许换行
  const grouped = (sets) => ({ columns: sets.flatMap((s) => s.columns.map((c) => (c.width ? c : { nowrap: true, ...c }))), groups: sets.map((s) => ({ title: s.title, span: s.columns.length })) });
  // 列表工具栏里的日期范围：core 给的 flex-basis 320px 放不下“预设 + 两个日期”，同行时会压住后一个筛选，这里放宽基准让它自行换行
  const roomyDates = (api) => { api.el.querySelectorAll('.apb-erp-toolbar > .apb-erp-field').forEach((f) => { if (f.style.flex.startsWith('2 1 320px')) f.style.flex = '2 1 540px'; }); return api; };
  // 审核 / 反审核（行操作共用）
  const toggleAudit = async (doc, label, done) => {
    if (!(await confirm(doc.audited ? `反审核${label} ${doc.no}？反审核后可以删除。` : `审核${label} ${doc.no}？审核后不能删除。`, { okLabel: doc.audited ? '反审核' : '审核' }))) return;
    await ERP.api.write(() => { doc.audited = !doc.audited; });
    toast(doc.audited ? `${label} ${doc.no} 已审核。` : `${label} ${doc.no} 已反审核。`);
    done && done();
  };
  const exportCols = (cols) => cols.map((c) => ({ ...c, render: null }));

  /* ---------- 补全共享数据中本模块需要的字段（只补缺，不覆盖） ---------- */
  D.cards.forEach((k, i) => {
    const c = D.customer(k.custCode) || {};
    Object.assign(k, Object.assign({ cardType: i % 3 === 2 ? '实体卡片' : '电子卡片', holder: c.contact || '', locked: false, lost: false, expire: null,
      idType: '身份证', idNo: '', applicant: c.contact || '', applicantPhone: c.phone || '' }, k));
  });
  D.prestores.forEach((p) => Object.assign(p, Object.assign({ real: r2(p.amount - p.gift), groupBefore: (D.customer(p.custCode) || {}).groupName || '',
    account: acctOf(p.method), fee: 0, invoice: false, ticket: '' }, p)));
  const miscCat = { 复印: ['11', '复印 A4 黑白', '张'], 打印: ['12', '黑白打印 A4 单面', '张'], 扫描: ['80', '排版', '页'], 证件照: ['60', '证件照', '版'], 装订: ['15', '骑马钉', '本'] };
  D.miscIncomes.forEach((m) => {
    const [cat, name, unit] = miscCat[m.item] || ['11', m.item, '张'];
    Object.assign(m, Object.assign({ custName: '零收散户', cat, catName: D.itemCatName(cat), itemName: name, unit, price: r2(m.amount / (m.qty || 1)),
      account: acctOf(m.method), fee: 0, invoice: false, ticket: '', source: m.method === '微信' ? '云端交易（微信）' : '手动登记创建', audited: true }, m));
  });
  D.settlements.forEach((s) => Object.assign(s, Object.assign({ custHandler: '', fee: 0, ticket: '' }, s)));

  /* ======================================================================
   * 工单记录（全面 / 基础）：同一台账，两套列。行数据为工单的派生副本，_w 指向原工单。
   * ==================================================================== */
  const orderRow = (w) => ({
    ...w, _w: w,
    listAmount: r2((w.lines || []).reduce((s, l) => s + l.listPrice * l.qty * (l.copies || 1), 0)) || w.amount,
    wipe: w.wipe || 0, realAmount: r2(w.amount - (w.wipe || 0)),
    payMethod: [...new Set(D.settlements.filter((s) => s.orderNo === w.no).map((s) => s.method))].join('、'),
  });
  function orderRecordCols(full) {
    const sets = [
      { title: '基础', columns: [
        { key: 'no', title: '工作单号', type: 'mono', width: 150, render: (w) => link(w.no, 'orderDetail', { no: w.no }, { ariaLabel: `查看工单 ${w.no}` }) },
        { key: 'created', title: '业务日期', type: 'date', nowrap: true },
        { key: 'custName', title: '客户 / 分组', width: 200, render: (w) => custLink(w.custCode, w.custName), sub: (w) => w.group },
      ] },
      { title: '制作', columns: [
        { key: 'task', title: '任务', render: (w) => w.task || '—' },
        { key: 'contact', title: '联络人员 / 电话', width: 120, render: (w) => w.contact || '未提供', sub: (w) => w.phone },
        { key: 'address', title: '联系地址', width: 160, render: (w) => w.address || '—' },
      ] },
      { title: '金额', columns: [
        ...(full ? [{ key: 'listAmount', title: '标售（元）', type: 'money', sum: true }] : []),
        { key: 'amount', title: '实售（元）', type: 'money', sum: true },
        { key: 'wipe', title: '抹零（元）', type: 'money', sum: true, render: (w) => optMoney(w.wipe) },
        { key: 'realAmount', title: '实收（元）', type: 'money', sum: true },
        { key: 'paid', title: '已结（元）', type: 'money', sum: true },
        { key: 'unpaid', title: '未结（元）', type: 'money', sum: true },
        { key: 'payMethod', title: '结算方式', render: (w) => w.payMethod || '—' },
      ] },
    ];
    if (full) sets.push(
      { title: '生产', columns: [
        { key: 'flow', title: '生产流程', render: (w) => h('span', biz.flowBadge(w), w.handler ? h('span.apb-erp-muted', w.handler) : null) },
        { key: 'due', title: '交付日期', type: 'date', render: (w) => (w.due ? F.date(w.due) : '未约定') },
        { key: 'delivery', title: '取送要求', render: (w) => w.delivery || '—' },
        { key: 'orderType', title: '工单类型', render: (w) => w.orderType || '—' },
      ] },
      { title: '更多', columns: [
        { key: 'req', title: '制作要求', width: 180, render: (w) => w.req || '—' },
        { key: 'settleStatus', title: '结算状态', render: biz.settleBadge },
        { key: 'receptionist', title: '接待人员' },
        { key: 'audited', title: '审核', render: (w) => biz.auditBadge(w.audited) },
        { key: 'remark', title: '备注', width: 140, render: (w) => w.remark || '—' },
      ] });
    return grouped(sets);
  }
  function orderRecords(el, params, ctx, full) {
    ctx.setActions([
      btn(full ? '切换到基础列' : '切换到全面列', () => ERP.go(full ? 'orderRecordsBasic' : 'orderRecords', hashParams())),
      link('新建工单', 'newOrder', null, { button: true, variant: 'primary' }),
    ]);
    const { columns, groups } = orderRecordCols(full);
    const list = roomyDates(ERP.ui.list(el, {
      title: full ? '工单记录 · 全面' : '工单记录 · 基础', params, columns, groups, idKey: 'no',
      note: full ? '全部列：基础、制作、金额、生产、更多 · 按委托时间倒序' : '常用列：基础、制作、金额 · 按委托时间倒序',
      load: () => D.workOrders.map(orderRow),
      sort: (a, b) => b.created - a.created,
      filters: [
        { key: 'q', type: 'search', label: '搜索', placeholder: '工单号 / 客户编号、名称、电话 / 制作要求', keys: ['no', 'custCode', 'custName', 'phone', 'req'] },
        { key: 'created', type: 'daterange', label: '业务日期', field: 'created' },
        { key: 'settle', type: 'select', label: '结算状态', options: ['0元空单', '尚未结算', '部分结算', '完成结算'], match: (w, v) => w.settleStatus === v },
        { key: 'flow', type: 'select', label: '生产流程', options: D.flows.map((f) => f.name) },
        { key: 'orderType', type: 'select', label: '工单类型', options: [...D.orderTypes.filter(Boolean), ['（无）', '（未指定）']], match: (w, v) => (w.orderType || '（无）') === v },
        { key: 'task', type: 'select', label: '制作任务', options: D.tasks.filter(Boolean) },
        { key: 'delivery', type: 'select', label: '取送要求', options: D.deliveryTypes.filter(Boolean) },
        { key: 'group', type: 'select', label: '客户分组', options: groupOptions() },
        auditFilter,
        { key: 'receptionist', type: 'select', label: '接待人员', options: empOptions() },
      ],
      rowActions: (r) => [
        link('详情', 'orderDetail', { no: r.no }, { ariaLabel: `查看工单 ${r.no} 详情` }),
        r.unpaid > 0 ? linkBtn('收款', () => biz.settle(r._w, () => list.reload()), { ariaLabel: `为工单 ${r.no} 收款` }) : null,
        linkBtn('转单', () => biz.flowTransfer(r._w, () => list.reload()), { ariaLabel: `工单 ${r.no} 流程转单` }),
      ],
      selectable: true,
      batch: [{ label: '导出所选', onClick: (rows) => ERP.ui.exportCsv(full ? '工单记录-全面' : '工单记录-基础', exportCols(columns), rows) }],
      emptyTitle: '尚无工单', emptyText: '新建工单后会显示在这里。', emptyAction: link('新建工单', 'newOrder', null, { button: true, variant: 'primary' }),
    }));
    return list;
  }
  ERP.page('orderRecords', {
    module: 'front', title: '工单记录', desc: '全部工作单的查询台账；可切换全面列（含生产、更多）或基础列。',
    render: (el, params, ctx) => orderRecords(el, params, ctx, true),
  });
  ERP.page('orderRecordsBasic', {
    module: 'front', title: '工单记录（基础）', nav: false, parent: 'orderRecords', desc: '常用列视图：基础、制作、金额。',
    render: (el, params, ctx) => orderRecords(el, params, ctx, false),
  });

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
  const cloudOrders = (D.cloudOrders = D.cloudOrders || cloudSeed.map(([no, source, custCode, custName, contact, phone, req, delivery, address, items, payState, status, hoursAgo], i) => {
    const lines = items.map(([code, qty]) => {
      const it = D.items.find((x) => x.code === code) || D.items[i];
      return { code: it.code, cat: it.cat, catName: D.itemCatName(it.cat), name: it.name, unit: it.unit, listPrice: it.price, price: it.price, discount: 10, qty, copies: 1, amount: r2(it.price * qty), remark: '' };
    });
    const amount = r2(lines.reduce((s, l) => s + l.amount, 0));
    const created = new Date(Date.now() - hoursAgo * 36e5);
    return { no, source, custCode, custName, contact, phone, req, delivery, address, lines, amount, onlinePaid: payState === '已付款' ? amount : 0, payState,
      created, expect: new Date(+created + 2 * 864e5), status, handler: status === '待受理' ? '' : '管理员', handled: status === '待受理' ? null : new Date(+created + 36e5),
      orderNo: status === '已受理' ? 'GD' + no.slice(2) : '', reason: status === '已拒绝' ? '超出营业范围' : '' };
  }));
  const cloudStatusBadge = (c) => badge(c.status, { 待受理: 'warning', 已受理: 'success' }[c.status]);
  const payStateBadge = (c) => badge(c.payState, { 已付款: 'success', 未付款: 'warning' }[c.payState]);

  // 受理：生成工作单（匹配老客户，否则记为散户），已付款项生成结算单
  async function acceptCloud(c, done) {
    if (!(await confirm(`受理云端订单 ${c.no}，并生成工作单？`, { okLabel: '受理', detail: c.onlinePaid ? `在线已付 ${F.money(c.onlinePaid)} 元，将同时登记结算单。` : '订单未付款，生成的工单为“尚未结算”。' }))) return;
    const no = await ERP.api.write(() => {
      const cust = (c.custCode && D.customer(c.custCode)) || D.customers.find((x) => x.phone && x.phone === c.phone) || D.customer('000000');
      const n = new Date(), paid = c.onlinePaid, no = biz.nextOrderNo(n);
      const w = { no, custCode: cust.code, custName: cust.name, group: cust.groupName, contact: c.contact, phone: c.phone, address: c.address,
        task: '', req: `【云端${c.source}】${c.req}`, delivery: c.delivery, orderType: '', paid, flow: '排队', handler: '', created: n, due: c.expect,
        receptionist: D.currentUser.name, keepFile: false, audited: false, file: '', remark: '云端订单 ' + c.no, lines: c.lines.map((l) => ({ ...l })) };
      biz.recalcOrder(w);
      D.workOrders.unshift(w);
      if (paid) D.settlements.unshift({ no: 'JS' + Date.now().toString().slice(-9), date: n, custCode: cust.code, custName: cust.name, handler: D.currentUser.name, method: '在线付款码',
        amount: paid, discount: 0, wipe: 0, orderNo: no, audited: true, invoice: false, remark: '云端交易', custHandler: c.contact, fee: r2(paid * 0.006), ticket: '', cloud: true });
      Object.assign(c, { status: '已受理', handler: D.currentUser.name, handled: n, orderNo: no });
      return no;
    });
    toast(`已受理云端订单 ${c.no}，生成工作单 ${no}。`);
    done && done();
  }
  function rejectCloud(c, done) {
    const reason = select(['超出营业范围', '文件有误，请重新上传', '工期无法满足', '客户取消', '其他']);
    const memo = input({ maxlength: 200, placeholder: '将推送给客户' });
    dialog({
      title: '拒绝云端订单', kicker: `${c.no} · ${c.custName}`,
      body: [c.onlinePaid ? notice('warning', `该订单在线已付 ${F.money(c.onlinePaid)} 元，拒绝后原路退回。`) : null,
        h('div.apb-erp-formgrid', field({ label: '拒绝原因', control: reason }), field({ label: '补充说明', control: memo }))],
      actions: [
        { label: '取消' },
        { label: '确认拒绝', variant: 'danger', onClick: (close) => ERP.api.write(() => {
          Object.assign(c, { status: '已拒绝', handler: D.currentUser.name, handled: new Date(), reason: reason.value + (memo.value.trim() ? '：' + memo.value.trim() : '') });
          if (c.onlinePaid) c.payState = '已退款';
          close(); toast(`已拒绝 ${c.no}，并通知客户（演示）。`); done && done();
        }) },
      ],
    });
  }

  ERP.page('cloudCenter', {
    module: 'front', title: '云端业务中心', desc: '客户通过微信小程序、公众号、网页商城提交的订单；受理后自动生成工作单。',
    render(el, params, ctx) {
      ctx.setActions([btn('同步云端订单', () => { list.reload(); toast('已同步云端订单（演示）。'); })]);
      const pending = cloudOrders.filter((c) => c.status === '待受理').length;
      if (pending) el.appendChild(notice('warning', `有 ${pending} 张云端订单待受理。`, ' ', link('只看待受理', 'cloudCenter', { status: '待受理' })));
      const list = roomyDates(ERP.ui.list(el, {
        title: '云端订单', note: '待受理在前，其余按提交时间倒序 · 北京时间', params, idKey: 'no',
        load: () => cloudOrders,
        sort: (a, b) => (b.status === '待受理') - (a.status === '待受理') || b.created - a.created,
        filters: [
          { key: 'q', type: 'search', label: '搜索', placeholder: '云端单号 / 客户 / 联系人 / 电话 / 要求', keys: ['no', 'custName', 'contact', 'phone', 'req', 'orderNo'] },
          { key: 'status', type: 'select', label: '受理状态', options: ['待受理', '已受理', '已拒绝'] },
          { key: 'source', type: 'select', label: '订单来源', options: ['微信小程序', '微信公众号', '网页商城'] },
          { key: 'payState', type: 'select', label: '付款状态', options: ['已付款', '未付款', '已退款'] },
          { key: 'created', type: 'daterange', label: '提交日期', field: 'created' },
        ],
        ...grouped([
          { title: '基础', columns: [
            { key: 'no', title: '云端单号 / 来源', type: 'mono', width: 150, render: (c) => link(c.no, 'cloudOrderDetail', { no: c.no }, { ariaLabel: `查看云端订单 ${c.no}` }), sub: (c) => c.source },
            { key: 'created', title: '提交时间', type: 'time', nowrap: true },
            { key: 'custName', title: '客户 / 联系人', width: 160, render: (c) => custLink(c.custCode, c.custName), sub: (c) => [c.contact, c.phone].filter(Boolean).join(' · ') },
          ] },
          { title: '订单', columns: [
            { key: 'req', title: '制作要求', width: 220 },
            { key: 'delivery', title: '取送方式 / 地址', width: 160, render: (c) => c.delivery || '未指定', sub: (c) => c.address },
            { key: 'expect', title: '期望交付', type: 'date', nowrap: true },
          ] },
          { title: '金额', columns: [
            { key: 'amount', title: '订单金额（元）', type: 'money', sum: true },
            { key: 'onlinePaid', title: '在线已付（元）', type: 'money', sum: true },
            { key: 'payState', title: '付款状态', render: payStateBadge },
          ] },
          { title: '受理', columns: [
            { key: 'status', title: '受理状态', render: cloudStatusBadge },
            { key: 'handler', title: '受理人 / 时间', render: (c) => c.handler || '—', sub: (c) => (c.handled ? F.time(c.handled) : '') },
            { key: 'orderNo', title: '工单编号', type: 'mono', render: (c) => orderLink(c.orderNo) },
            { key: 'reason', title: '拒绝原因', width: 140, render: (c) => c.reason || '—' },
          ] },
        ]),
        rowActions: (c) => [
          link('详情', 'cloudOrderDetail', { no: c.no }, { ariaLabel: `查看云端订单 ${c.no} 详情` }),
          c.status === '待受理' ? linkBtn('受理', () => acceptCloud(c, () => ERP.reload()), { ariaLabel: `受理云端订单 ${c.no}` }) : null,
          c.status === '待受理' ? linkBtn('拒绝', () => rejectCloud(c, () => ERP.reload()), { variant: 'danger', ariaLabel: `拒绝云端订单 ${c.no}` }) : null,
        ],
        emptyTitle: '尚无云端订单', emptyText: '客户在小程序、公众号或网页商城下单后会显示在这里。',
      }));
    },
  });

  ERP.page('cloudOrderDetail', {
    module: 'front', title: '云端订单详情', nav: false, parent: 'cloudCenter', smokeParams: { no: 'YD26101910006' },
    render(el, params, ctx) {
      const c = cloudOrders.find((x) => x.no === params.no);
      if (!c) return el.appendChild(h('section.apb-erp-panel', ERP.ui.empty({ title: `找不到云端订单 ${params.no || ''}`, text: '可能已被删除，或链接有误。', action: link('返回云端业务中心', 'cloudCenter', null, { button: true }) })));
      ctx.setTitle(`云端订单 ${c.no}`);
      ctx.setActions([
        c.status === '待受理' ? btn('受理并生成工单', () => acceptCloud(c, () => ERP.reload()), { variant: 'primary' }) : null,
        c.status === '待受理' ? btn('拒绝订单', () => rejectCloud(c, () => ERP.reload())) : null,
        c.orderNo && biz.order(c.orderNo) ? link('查看工单', 'orderDetail', { no: c.orderNo }, { button: true }) : null,
        btn('联系客户', () => toast(`拨打 ${c.phone}（演示）。`)),
        btn('下载客户文件', () => toast('下载客户上传的文件（演示）。')),
      ]);
      if (c.status === '已拒绝') el.appendChild(notice('info', `该订单已拒绝：${c.reason || '未填写原因'}。`));
      const p1 = panel({ title: '订单资料', note: `${c.source} · 提交于 ${F.stamp(c.created)}` });
      p1.body.appendChild(kv([
        ['云端单号', h('span.apb-erp-mono', c.no)], ['订单来源', c.source],
        ['客户', c.custCode ? custLink(c.custCode, `${c.custCode} ${c.custName}`) : `${c.custName}（未匹配客户资料）`], ['联系人 / 电话', [c.contact, c.phone].filter(Boolean).join(' · ')],
        ['取送方式', c.delivery || '未指定'], ['收货地址', c.address],
        ['期望交付', c.expect ? F.date(c.expect) : '未约定'], ['制作要求', c.req],
      ]));
      el.appendChild(p1.el);
      const p2 = panel({ title: '付款与受理' });
      p2.body.appendChild(kv([
        ['订单金额（元）', h('span.apb-erp-mono', F.money(c.amount))], ['在线已付（元）', h('span.apb-erp-mono', F.money(c.onlinePaid))],
        ['付款状态', payStateBadge(c)], ['受理状态', cloudStatusBadge(c)],
        ['受理人', c.handler || '未受理'], ['受理时间', c.handled ? F.stamp(c.handled) : '未受理'],
        ['工单编号', c.orderNo ? orderLink(c.orderNo) : '尚未生成'], ['拒绝原因', c.reason || (c.status === '已拒绝' ? '未填写' : '—')],
      ]));
      el.appendChild(p2.el);
      const p3 = panel({ title: '订单明细', note: `${c.lines.length} 项`, flush: true });
      ERP.ui.table(p3.body, {
        caption: '云端订单明细', rows: c.lines,
        columns: [{ key: 'code', title: '编号', type: 'mono' }, { key: 'catName', title: '主项' }, { key: 'name', title: '子项' }, { key: 'unit', title: '单位' },
          { key: 'price', title: '单价（元）', type: 'money' }, { key: 'qty', title: '数量', type: 'num' }, { key: 'amount', title: '金额（元）', type: 'money', sum: true }],
        empty: { title: '没有明细' },
      });
      el.appendChild(p3.el);
    },
  });

  /* ======================================================================
   * 结算记录（现金收款 / 基础）
   * ==================================================================== */
  const KINDS = ['现金收款', '应收记账', '扣减预存', '优惠抵扣', '扫码收款', '云端交易'];
  const CASH_KINDS = ['现金收款', '扫码收款', '云端交易'];
  const settleKind = (s) => (s.cloud ? '云端交易' : { 记账: '应收记账', 预存: '扣减预存', 抹零: '优惠抵扣', 在线付款码: '扫码收款' }[s.method] || '现金收款');
  const settleRow = (s) => {
    const c = D.customer(s.custCode) || {}, w = biz.order(s.orderNo), kind = settleKind(s);
    return { ...s, _s: s, kind, group: c.groupName || '', account: s.account || acctOf(s.method), payWay: s.method === '现金' ? '现钞' : s.method,
      returned: CASH_KINDS.includes(kind) ? s.amount : 0, balanceInfo: c.prestoreBalance ? `预存余额 ${F.money(c.prestoreBalance)} 元` : '',
      orderType: w ? w.orderType : '', net: r2(s.amount - (s.fee || 0)) };
  };
  // 删除结算单：关联工单的已结金额同步扣回
  async function deleteSettle(s, done) {
    if (!(await confirm(`删除结算单 ${s.no}？`, { okLabel: '删除', danger: true, detail: `金额 ${F.money(s.amount)} 元。${s.orderNo ? `关联工单 ${s.orderNo} 的已结金额将同步扣回；` : ''}记账、预存扣款与资金科目一并冲回。删除后不能恢复。` }))) return;
    // 统一冲回：工单已结、记账单与欠款、会员卡、资金科目（见 finance.js reverseSettlement）
    try { await ERP.api.write(() => biz.fin.reverseSettlement(s)); }
    catch (err) { return ERP.root.querySelector('#lerp-body').prepend(notice('danger', `未删除：${err.message}。`)); }
    toast(`结算单 ${s.no} 已删除，相关金额已冲回。`); done && done();
  }
  function settleRecords(el, params, ctx, cashOnly) {
    ctx.setActions([btn(cashOnly ? '切换到基础视图' : '切换到现金收款视图', () => ERP.go(cashOnly ? 'settleRecordsBasic' : 'settleRecords', hashParams()))]);
    const base = { title: '基础', columns: [
      { key: 'no', title: '结算单号', type: 'mono', width: 140 },
      { key: 'date', title: '业务日期', type: 'date', nowrap: true },
      { key: 'custName', title: '客户 / 分组', width: 200, render: (s) => custLink(s.custCode, s.custName), sub: (s) => s.group },
      { key: 'custHandler', title: '客方经手', render: (s) => s.custHandler || '—' },
    ] };
    const kindCol = { key: 'kind', title: '结算方式', render: (s) => badge(s.kind, s.kind === '应收记账' ? 'warning' : undefined) };
    const more = [
      { key: 'invoice', title: '已开发票', render: (s) => yesNo(s.invoice) },
      { key: 'ticket', title: '票据信息', render: (s) => s.ticket || '—' },
      { key: 'orderNo', title: '工单编号', type: 'mono', render: (s) => orderLink(s.orderNo) },
    ];
    const tail = [{ key: 'handler', title: '经手人' }, { key: 'audited', title: '审核', render: (s) => biz.auditBadge(s.audited) }, { key: 'remark', title: '备注', width: 140, render: (s) => s.remark || '—' }];
    const { columns, groups } = grouped(cashOnly ? [
      base,
      { title: '收款', columns: [kindCol, { key: 'amount', title: '收款金额（元）', type: 'money', sum: true }, { key: 'account', title: '入账科目', width: 170 }, { key: 'payWay', title: '支付方式' },
        { key: 'fee', title: '手续费用（元）', type: 'money', sum: true, render: (s) => optMoney(s.fee) }, { key: 'net', title: '实际到账（元）', type: 'money', sum: true }] },
      { title: '相关', columns: [more[2], { key: 'orderType', title: '工单类型', render: (s) => s.orderType || '—' }, more[0], more[1]] },
      { title: '更多', columns: tail },
    ] : [
      base,
      { title: '结算', columns: [kindCol, { key: 'amount', title: '结算金额（元）', type: 'money', sum: true }, { key: 'returned', title: '回款金额（元）', type: 'money', sum: true }] },
      { title: '扩展', columns: [{ key: 'account', title: '结算科目', width: 170 }, { key: 'payWay', title: '支付方式' },
        { key: 'fee', title: '手续费用（元）', type: 'money', sum: true, render: (s) => optMoney(s.fee) }, { key: 'balanceInfo', title: '结余信息', width: 150, render: (s) => s.balanceInfo || '—' }] },
      { title: '更多', columns: [...more, ...tail] },
    ]);
    const list = roomyDates(ERP.ui.list(el, {
      title: cashOnly ? '结算记录 · 现金收款' : '结算记录 · 基础', params, columns, groups, idKey: 'no',
      note: cashOnly ? '仅现金收款、扫码收款、云端交易（实际到账）· 按业务日期倒序' : '全部结算方式（含应收记账、扣减预存、优惠抵扣）· 按业务日期倒序',
      load: () => D.settlements.map(settleRow).filter((s) => !cashOnly || CASH_KINDS.includes(s.kind)),
      sort: (a, b) => b.date - a.date,
      filters: [
        { key: 'q', type: 'search', label: '搜索', placeholder: '结算单号 / 客户编号、名称 / 工单号 / 票据', keys: ['no', 'custCode', 'custName', 'orderNo', 'ticket', 'remark'] },
        { key: 'date', type: 'daterange', label: '业务日期', field: 'date' },
        { key: 'kind', type: 'select', label: '结算方式', options: cashOnly ? CASH_KINDS : KINDS },
        cashOnly ? { key: 'account', type: 'select', label: '入账科目', options: ACCOUNTS } : null,
        { key: 'payWay', type: 'select', label: '支付方式', options: ['现钞', '微信', '支付宝', '刷卡', '转账', '在线付款码', ...(cashOnly ? [] : ['记账', '预存', '抹零'])] },
        { key: 'group', type: 'select', label: '客户分组', options: groupOptions() },
        invoiceFilter, auditFilter,
        { key: 'handler', type: 'select', label: '经手人员', options: empOptions() },
      ].filter(Boolean),
      rowActions: (r) => [
        r.orderNo && biz.order(r.orderNo) ? link('工单', 'orderDetail', { no: r.orderNo }, { ariaLabel: `查看结算单 ${r.no} 的工单` }) : null,
        linkBtn(r.audited ? '反审核' : '审核', () => toggleAudit(r._s, '结算单', () => list.reload()), { ariaLabel: `${r.audited ? '反审核' : '审核'}结算单 ${r.no}` }),
        linkBtn(r.invoice ? '取消开票' : '标记开票', () => ERP.api.write(() => { r._s.invoice = !r._s.invoice; }).then(() => { toast(`结算单 ${r.no} 已${r._s.invoice ? '标记为已开发票' : '取消开票标记'}。`); list.reload(); }), { ariaLabel: `结算单 ${r.no} 发票标记` }),
        linkBtn('收据', () => toast(`打印结算单 ${r.no} 收据（演示）。`), { ariaLabel: `打印结算单 ${r.no} 收据` }),
        r.audited ? null : linkBtn('删除', () => deleteSettle(r._s, () => list.reload()), { variant: 'danger', ariaLabel: `删除结算单 ${r.no}` }),
      ],
      selectable: true,
      batch: [
        { label: '导出所选', onClick: (rows) => ERP.ui.exportCsv(cashOnly ? '结算记录-现金收款' : '结算记录-基础', exportCols(columns), rows) },
        { label: '审核所选', onClick: (rows) => ERP.api.write(() => { rows.forEach((r) => (r._s.audited = true)); toast(`已审核 ${rows.length} 张结算单。`); list.reload(); }) },
      ],
      emptyTitle: '尚无结算记录', emptyText: '在工单上收款结算后会显示在这里。', emptyAction: link('去前台业务中心', 'frontdesk', null, { button: true }),
    }));
  }
  ERP.page('settleRecords', {
    module: 'front', title: '结算记录（现金收款）', navTitle: '结算记录', desc: '实际到账的收款单；切换到基础视图可查看全部结算方式。',
    render: (el, params, ctx) => settleRecords(el, params, ctx, true),
  });
  ERP.page('settleRecordsBasic', {
    module: 'front', title: '结算记录（基础）', nav: false, parent: 'settleRecords', desc: '全部结算方式，含应收记账、扣减预存与优惠抵扣。',
    render: (el, params, ctx) => settleRecords(el, params, ctx, false),
  });

  /* ======================================================================
   * 会员卡：状态、预存储值 / 预存退款（表单页）
   * ==================================================================== */
  const card = (no) => D.cards.find((k) => k.cardNo === no);
  const cardState = (k) => (k.status === '注销' ? '已注销' : k.lost ? '已挂失' : k.locked ? '已锁定' : k.expire && k.expire < new Date() ? '已过期' : '正常');
  const cardBadge = (k) => { const s = cardState(k); return badge(s, { 正常: 'success', 已锁定: 'warning', 已挂失: 'danger', 已过期: 'danger' }[s]); };
  const cardUsable = (k) => cardState(k) === '正常';
  const syncCust = (k) => { const c = D.customer(k.custCode); if (c) c.prestoreBalance = k.balance; };
  // 预存赠送：满 5000 送 10%，满 1000 送 20%（示例规则，旧系统同款）
  const autoGift = (v) => (v >= 5000 ? r2(v * 0.1) : v >= 1000 ? r2(v * 0.2) : 0);

  function prestorePage(refund) {
    const title = refund ? '预存退款' : '预存储值';
    return {
      module: 'front', title, nav: !refund, parent: refund ? 'prestoreRecords' : undefined, smokeParams: { cardNo: 'IC880001' },
      desc: refund ? '退还会员卡内的预存余额，退款从选定的资金科目支出。' : '为会员卡客户预存（充值），可同时赠送金额并调整客户分组（卡片等级）。',
      render(el, params, ctx) {
        ctx.setActions([link(refund ? '去预存储值' : '预存退款', refund ? 'prestore' : 'prestoreRefund', params.cardNo ? { cardNo: params.cardNo } : null, { button: true }), link('预存记录', 'prestoreRecords', null, { button: true })]);
        let k = params.cardNo ? card(params.cardNo) : null;
        if (params.cardNo && !k) el.appendChild(notice('warning', `找不到会员卡 ${params.cardNo}，请在下面重新选择。`));
        const cards = D.cards.filter((x) => x.status !== '注销');
        const cardSel = select([['', '请选择会员卡'], ...cards.map((x) => [x.cardNo, `${x.cardNo} · ${x.custName}（余额 ${F.money(x.balance)} 元）`])], { name: 'cardNo', value: k ? k.cardNo : '' });
        cardSel._validate = (v) => { const c = card(v); return c && !cardUsable(c) ? `该卡${cardState(c)}，不能办理${title}。请先在卡片详情中处理。` : null; };
        const info = h('div');
        const real = money({ name: 'real', placeholder: '0.00' }), gift = money({ name: 'gift', value: '0.00' }), fee = money({ name: 'fee', value: '0.00' });
        [real, gift, fee].forEach((x) => (x.dataset.validate = 'money'));
        real._validate = (v) => {
          if (num(v) <= 0) return `${refund ? '退款' : '实收'}金额需大于 0。`;
          if (refund && k && r2(num(v) + num(gift.value)) > k.balance) return `合计扣减不能超过卡内余额 ${F.money(k.balance)} 元。`;
          return null;
        };
        gift._validate = (v) => (num(v) < 0 ? '赠送金额不能为负数。' : null);
        let giftTouched = false;
        gift.addEventListener('input', () => { giftTouched = true; calc(); });
        real.addEventListener('input', () => { if (!refund && !giftTouched) gift.value = autoGift(num(real.value)).toFixed(2); calc(); });
        const totalEl = h('span', '0.00'), afterEl = h('span', '—');
        function calc() {
          const t = r2(num(real.value) + num(gift.value));
          totalEl.textContent = F.money(t);
          afterEl.textContent = k ? F.money(r2(k.balance + (refund ? -t : t))) : '先选择会员卡';
        }
        function show() {
          info.replaceChildren(k ? kv([
            ['持卡客户', custLink(k.custCode, `${k.custCode} ${k.custName}`)], ['客户分组', k.group],
            ['持卡人员', k.holder || '未提供'], ['卡片状态', cardBadge(k)],
            ['当前余额（元）', h('strong.apb-erp-mono', F.money(k.balance))], ['卡片类型', k.cardType],
          ]) : h('p.apb-erp-muted', '选择会员卡后显示持卡客户与当前余额。'));
          if (refund && k && !real.value) real.value = k.balance.toFixed(2);
          calc();
        }
        cardSel.addEventListener('change', () => { k = card(cardSel.value); if (refund) real.value = ''; show(); });
        const acct = select(ACCOUNTS, { name: 'account' }), way = select(PAYWAYS, { name: 'method' });
        way.addEventListener('change', () => { const a = acctOf(way.value); if (a) acct.value = a; });
        const pwd = input({ type: 'password', name: 'pwd', autocomplete: 'off' });
        const form = ERP.ui.form({
          ctx, submitLabel: refund ? '确认退款' : '确认储值',
          cancel: { href: ERP.href('prestoreRecords'), label: '返回预存记录' },
          moreActions: btn('读卡（演示）', () => {
            const c = cards.find(cardUsable);
            if (!c) return toast('没有可用的会员卡。');
            cardSel.value = c.cardNo; cardSel.dispatchEvent(new Event('change', { bubbles: true })); toast(`读卡成功：${c.cardNo}（演示）。`);
          }),
          sections: [
            { title: '会员卡', fields: [
              field({ label: '会员卡', control: cardSel, required: true, error: '请选择会员卡。', help: '可点页尾“读卡”自动选择；已挂失、锁定、过期的卡不能办理。', span: 'all' }),
              refund ? field({ label: '消费密码', control: pwd, required: true, error: '请持卡人输入消费密码。', help: '原型不校验密码内容。' }) : null,
            ].filter(Boolean), content: info },
            { title: refund ? '退款金额' : '预存金额', fields: [
              field({ label: refund ? '退款金额（元）' : '实收金额（元）', control: real, required: true, help: refund ? '默认带出全部余额，可修改。' : '赠送金额按“满 1000 送 20%，满 5000 送 10%”自动带出，可修改。' }),
              field({ label: refund ? '扣回赠送（元）' : '赠送金额（元）', control: gift }),
            ], content: ERP.ui.summary([[refund ? '合计扣减（元）' : '预存合计（元）', totalEl], [refund ? '退后余额（元）' : '存后余额（元）', afterEl]]) },
            { title: refund ? '出账信息' : '入账信息', cols: 3, fields: [
              field({ label: refund ? '出账科目' : '入账科目', control: acct }), field({ label: '支付方式', control: way, help: '选择后自动带出对应科目。' }),
              field({ label: '手续费用（元）', control: fee }),
              refund ? field({ label: '退款原因', control: select(['客户要求退款', '卡片注销', '多存退回', '其他'], { name: 'reason' }) })
                : field({ label: '调整分组', control: select([['', '（不变）'], ...prestoreGroups().map((g) => [g.code, g.name])], { name: 'newGroup' }), help: '决定卡片等级与折扣。' }),
              field({ label: '票据信息', control: input({ name: 'ticket', maxlength: 60 }) }),
              h('div.lerp-checks', { style: { alignSelf: 'end' } }, ERP.ui.checkbox('已开发票', false, { name: 'invoice' })),
            ] },
            { title: '备注', fields: [field({ label: '详细说明', control: textarea({ name: 'remark', maxlength: 200 }), help: '最多 200 个字符。', span: 'all' })] },
          ],
          onSubmit: async (v) => {
            const amt = r2(num(v.real)), g = r2(num(v.gift)), t = r2(amt + g);
            if (refund && !(await confirm(`从会员卡 ${k.cardNo} 退款 ${F.money(amt)} 元？`, { okLabel: '确认退款', detail: `合计扣减 ${F.money(t)} 元，退后余额 ${F.money(r2(k.balance - t))} 元。` }))) return;
            const no = await ERP.api.write(() => {
              const before = k.group, sign = refund ? -1 : 1;
              k.balance = r2(k.balance + sign * t);
              if (refund) k.totalOut = r2(k.totalOut + t); else k.totalIn = r2(k.totalIn + t);
              syncCust(k);
              if (!refund && v.newGroup) {
                k.group = D.groupName(v.newGroup);
                const c = D.customer(k.custCode); if (c) { c.group = v.newGroup; c.groupName = k.group; }
              }
              const no = docNo(refund ? 'YT' : 'YC', D.prestores);
              D.prestores.unshift({ no, date: new Date(), custCode: k.custCode, custName: k.custName, cardNo: k.cardNo, type: refund ? '退款' : '储值',
                amount: sign * t, real: sign * amt, gift: sign * g, groupBefore: before, account: v.account, method: v.method, fee: num(v.fee),
                invoice: !!v.invoice, ticket: v.ticket || '', handler: D.currentUser.name, audited: true,
                remark: refund ? v.reason + (v.remark ? '；' + v.remark : '') : v.remark || '' });
              return no;
            });
            form.markClean();
            toast(`${title}成功：${k.custName} ${refund ? '−' : '+'}${F.money(t)} 元，余额 ${F.money(k.balance)} 元（单号 ${no}）。`);
            ERP.go('cardDetail', { cardNo: k.cardNo });
          },
        });
        el.appendChild(panel({ title: refund ? '退款单' : '储值单' }).el).querySelector('.apb-erp-panelbody').appendChild(form);
        show();
      },
    };
  }
  ERP.page('prestore', prestorePage(false));
  ERP.page('prestoreRefund', prestorePage(true));

  /* ---------- 预存记录 ---------- */
  async function deletePrestore(p, done) {
    if (!(await confirm(`删除预存单 ${p.no}？`, { okLabel: '删除', danger: true, detail: `卡 ${p.cardNo} 的余额将同步冲回 ${F.money(-p.amount)} 元。删除后不能恢复。` }))) return;
    await ERP.api.write(() => {
      const k = card(p.cardNo);
      if (k) { k.balance = r2(k.balance - p.amount); if (p.amount > 0) k.totalIn = r2(k.totalIn - p.amount); else k.totalOut = r2(k.totalOut + p.amount); syncCust(k); }
      D.prestores.splice(D.prestores.indexOf(p), 1);
    });
    toast(`预存单 ${p.no} 已删除。`); done && done();
  }
  const prestoreColumns = () => grouped([
    { title: '基础', columns: [
      { key: 'no', title: '预存单号', type: 'mono', width: 140 },
      { key: 'date', title: '业务日期', type: 'date', nowrap: true },
      { key: 'custName', title: '客户 / 预存前分组', width: 200, render: (p) => custLink(p.custCode, p.custName), sub: (p) => p.groupBefore },
    ] },
    { title: '预存', columns: [
      { key: 'type', title: '业务类型', render: (p) => badge(p.type, p.type === '退款' ? 'warning' : undefined) },
      { key: 'amount', title: '预存金额（元）', type: 'money', sum: true },
      { key: 'real', title: '实收金额（元）', type: 'money', sum: true },
      { key: 'gift', title: '赠送金额（元）', type: 'money', sum: true },
      { key: 'account', title: '入账科目', width: 170 },
      { key: 'method', title: '支付方式' },
      { key: 'fee', title: '手续费用（元）', type: 'money', sum: true, render: (p) => optMoney(p.fee) },
      { key: 'invoice', title: '已开发票', render: (p) => yesNo(p.invoice) },
      { key: 'ticket', title: '票据信息', render: (p) => p.ticket || '—' },
      { key: 'remark', title: '详细说明', width: 160, render: (p) => p.remark || '—' },
    ] },
    { title: '更多', columns: [
      { key: 'cardNo', title: '卡片序号', type: 'mono', render: (p) => (card(p.cardNo) ? link(p.cardNo, 'cardDetail', { cardNo: p.cardNo }, { ariaLabel: `查看会员卡 ${p.cardNo}` }) : p.cardNo || '—') },
      { key: 'handler', title: '经手人' },
      { key: 'audited', title: '审核', render: (p) => biz.auditBadge(p.audited) },
    ] },
  ]);
  ERP.page('prestoreRecords', {
    module: 'front', title: '预存记录', desc: '会员卡储值与退款单据；退款金额以负数记录。',
    render(el, params, ctx) {
      ctx.setActions([link('预存退款', 'prestoreRefund', null, { button: true }), link('预存储值', 'prestore', null, { button: true, variant: 'primary' })]);
      const { columns, groups } = prestoreColumns();
      const list = roomyDates(ERP.ui.list(el, {
        title: '预存单', note: '按业务日期倒序', params, columns, groups, idKey: 'no',
        load: () => D.prestores,
        sort: (a, b) => b.date - a.date,
        filters: [
          { key: 'q', type: 'search', label: '搜索', placeholder: '预存单号 / 客户编号、名称 / 卡号 / 票据', keys: ['no', 'custCode', 'custName', 'cardNo', 'ticket', 'remark'] },
          { key: 'date', type: 'daterange', label: '业务日期', field: 'date' },
          { key: 'type', type: 'select', label: '业务类型', options: ['储值', '退款'] },
          { key: 'account', type: 'select', label: '入账科目', options: ACCOUNTS },
          { key: 'method', type: 'select', label: '支付方式', options: ['现金', ...PAYWAYS] },
          invoiceFilter, auditFilter,
        ],
        rowActions: (p) => [
          card(p.cardNo) ? link('卡片', 'cardDetail', { cardNo: p.cardNo }, { ariaLabel: `查看预存单 ${p.no} 的会员卡` }) : null,
          linkBtn(p.audited ? '反审核' : '审核', () => toggleAudit(p, '预存单', () => list.reload()), { ariaLabel: `${p.audited ? '反审核' : '审核'}预存单 ${p.no}` }),
          linkBtn('凭证', () => toast(`打印预存单 ${p.no} 凭证（演示）。`), { ariaLabel: `打印预存单 ${p.no} 凭证` }),
          p.audited ? null : linkBtn('删除', () => deletePrestore(p, () => list.reload()), { variant: 'danger', ariaLabel: `删除预存单 ${p.no}` }),
        ],
        selectable: true,
        batch: [{ label: '导出所选', onClick: (rows) => ERP.ui.exportCsv('预存记录', exportCols(columns), rows) }],
        emptyTitle: '尚无预存记录', emptyText: '为会员卡储值后会显示在这里。', emptyAction: link('预存储值', 'prestore', null, { button: true, variant: 'primary' }),
      }));
    },
  });

  /* ---------- 会员卡资料（IC 卡片资料管理） ---------- */
  ERP.page('cardInfo', {
    module: 'front', title: '会员卡资料', desc: 'IC 卡与电子卡的发行、持卡、余额资料；点卡号办理锁定、挂失、注销等。',
    render(el, params, ctx) {
      ctx.setActions([link('发行新卡', 'cardIssue', null, { button: true, variant: 'primary' })]);
      roomyDates(ERP.ui.list(el, {
        title: '会员卡', note: '按发行日期倒序', params, idKey: 'cardNo',
        load: () => D.cards,
        sort: (a, b) => b.issueDate - a.issueDate,
        filters: [
          { key: 'q', type: 'search', label: '搜索', placeholder: '卡片序号 / 客户编号、名称 / 持卡人 / 证件号码', keys: ['cardNo', 'custCode', 'custName', 'holder', 'idNo', 'applicant'] },
          { key: 'group', type: 'select', label: '客户分组', options: prestoreGroups().map((g) => g.name) },
          { key: 'state', type: 'select', label: '卡片状态', options: ['正常', '已锁定', '已挂失', '已过期', '已注销'], match: (k, v) => cardState(k) === v },
          { key: 'cardType', type: 'select', label: '卡片类型', options: ['电子卡片', '实体卡片'] },
          { key: 'issuer', type: 'select', label: '发行人员', options: empOptions() },
          { key: 'issueDate', type: 'daterange', label: '发行日期', field: 'issueDate' },
        ],
        ...grouped([
          { title: '卡片', columns: [
            { key: 'cardNo', title: '卡片序号 / 类型', type: 'mono', render: (k) => link(k.cardNo, 'cardDetail', { cardNo: k.cardNo }, { ariaLabel: `查看会员卡 ${k.cardNo}` }), sub: (k) => k.cardType },
            { key: 'state', title: '状态', render: cardBadge },
            { key: 'custName', title: '客户 / 分组', width: 200, render: (k) => custLink(k.custCode, `${k.custCode} ${k.custName}`), sub: (k) => k.group },
            { key: 'holder', title: '持卡人员', render: (k) => k.holder || '未提供' },
          ] },
          { title: '手续', columns: [
            { key: 'applicant', title: '办卡人 / 电话', render: (k) => k.applicant || '未提供', sub: (k) => k.applicantPhone },
            { key: 'idNo', title: '证件', render: (k) => (k.idNo ? `${k.idType} ${k.idNo}` : '未提供') },
            { key: 'expire', title: '失效日期', type: 'date', render: (k) => (k.expire ? F.date(k.expire) : '永久有效') },
            { key: 'issueDate', title: '发行日期 / 人员', type: 'date', sub: (k) => k.issuer },
          ] },
          { title: '余额', columns: [
            { key: 'balance', title: '预存余额（元）', type: 'money', sum: true },
            { key: 'totalIn', title: '累计储值（元）', type: 'money', sum: true },
            { key: 'totalOut', title: '累计消费（元）', type: 'money', sum: true },
          ] },
        ]),
        rowActions: (k) => [
          link('详情', 'cardDetail', { cardNo: k.cardNo }, { ariaLabel: `查看会员卡 ${k.cardNo} 详情` }),
          cardUsable(k) ? link('储值', 'prestore', { cardNo: k.cardNo }, { ariaLabel: `为会员卡 ${k.cardNo} 储值` }) : null,
          cardUsable(k) && k.balance > 0 ? link('退款', 'prestoreRefund', { cardNo: k.cardNo }, { ariaLabel: `会员卡 ${k.cardNo} 退款` }) : null,
        ],
        emptyTitle: '尚无会员卡', emptyText: '发行会员卡后会显示在这里。', emptyAction: link('发行新卡', 'cardIssue', null, { button: true, variant: 'primary' }),
      }));
    },
  });

  /* ---------- 会员卡详情 ---------- */
  function resetPwd(k, done) {
    const p1 = input({ type: 'password', autocomplete: 'new-password' }), p2 = input({ type: 'password', autocomplete: 'new-password' });
    const err = notice('danger', ''); err.hidden = true;
    dialog({
      title: '重置消费密码', kicker: `会员卡 ${k.cardNo} · ${k.custName}`,
      body: [err, h('div.apb-erp-formgrid', field({ label: '新密码', control: p1, help: '至少 4 位。' }), field({ label: '确认新密码', control: p2 }))],
      actions: [
        { label: '取消' },
        { label: '确认重置', variant: 'primary', onClick: (close) => {
          const msg = p1.value.length < 4 ? '新密码至少 4 位，请重新输入。' : p1.value !== p2.value ? '两次输入的密码不一致，请重新输入。' : null;
          if (msg) { err.textContent = msg; err.hidden = false; p1.focus(); return; }
          return ERP.api.write(() => { k.password = true; close(); toast(`会员卡 ${k.cardNo} 的消费密码已重置。`); done && done(); });
        } },
      ],
    });
  }
  ERP.page('cardDetail', {
    module: 'front', title: '会员卡详情', nav: false, parent: 'cardInfo', smokeParams: { cardNo: 'IC880001' },
    render(el, params, ctx) {
      const k = card(params.cardNo);
      if (!k) return el.appendChild(h('section.apb-erp-panel', ERP.ui.empty({ title: `找不到会员卡 ${params.cardNo || ''}`, text: '可能卡号有误。', action: link('返回会员卡资料', 'cardInfo', null, { button: true }) })));
      ctx.setTitle(`会员卡 ${k.cardNo}`);
      const rerender = () => ERP.reload();
      // 锁定 / 挂失切换：verb 为动作（锁定、解除锁定…），开启时先确认
      const flip = async (key, verb, ask) => {
        if (ask && !(await confirm(ask, { okLabel: verb }))) return;
        await ERP.api.write(() => { k[key] = !k[key]; });
        toast(`会员卡 ${k.cardNo} 已${verb}${key === 'lost' && k.lost ? '，暂停使用' : ''}。`); rerender();
      };
      const closed = k.status === '注销';
      ctx.setActions(closed ? [] : [
        cardUsable(k) ? link('预存储值', 'prestore', { cardNo: k.cardNo }, { button: true, variant: 'primary' }) : null,
        cardUsable(k) && k.balance > 0 ? link('预存退款', 'prestoreRefund', { cardNo: k.cardNo }, { button: true }) : null,
        btn(k.locked ? '解除锁定' : '锁定卡片', () => flip('locked', k.locked ? '解除锁定' : '锁定', k.locked ? null : `锁定会员卡 ${k.cardNo}？锁定后不能储值、退款和消费。`)),
        btn(k.lost ? '解除挂失' : '挂失卡片', () => flip('lost', k.lost ? '解除挂失' : '挂失', k.lost ? null : `挂失会员卡 ${k.cardNo}？挂失后该卡暂停使用。`)),
        btn('重置消费密码', () => resetPwd(k, rerender)),
        btn('补卡 / 换卡', () => toast('请将新卡放到读卡器上（演示）。')),
      ]);
      if (closed) el.appendChild(notice('info', '该卡已注销：资料只读。'));
      else if (!cardUsable(k)) el.appendChild(notice('warning', `该卡${cardState(k)}，暂不能储值、退款和消费。`));
      const p1 = panel({ title: '卡片资料' });
      p1.body.appendChild(kv([
        ['卡片序号', h('span.apb-erp-mono', k.cardNo)], ['卡片状态', cardBadge(k)],
        ['卡片类型', k.cardType], ['消费密码', k.password ? '已设置' : '未设置'],
        ['所属客户', custLink(k.custCode, `${k.custCode} ${k.custName}`)], ['客户分组', k.group],
        ['持卡人员', k.holder], ['失效日期', k.expire ? F.date(k.expire) : '永久有效'],
        ['办卡人 / 电话', [k.applicant, k.applicantPhone].filter(Boolean).join(' · ')], ['证件', k.idNo ? `${k.idType} ${k.idNo}` : '未提供'],
        ['发行日期', F.date(k.issueDate)], ['发行人员', k.issuer],
        ['备注', k.remark],
      ]));
      el.appendChild(p1.el);
      const p2 = panel({ title: '余额' });
      p2.body.appendChild(ERP.ui.summary([['预存余额（元）', F.money(k.balance)], ['累计储值（元）', F.money(k.totalIn)], ['累计消费（元）', F.money(k.totalOut)]]));
      el.appendChild(p2.el);
      const rows = D.prestores.filter((p) => p.cardNo === k.cardNo).sort((a, b) => b.date - a.date);
      const p3 = panel({ title: '预存记录', note: `${rows.length} 条`, flush: true, actions: link('全部预存记录', 'prestoreRecords', { q: k.cardNo }) });
      ERP.ui.table(p3.body, {
        caption: '本卡预存记录', rows,
        columns: [{ key: 'no', title: '预存单号', type: 'mono' }, { key: 'date', title: '业务日期', type: 'date' }, { key: 'type', title: '业务类型' },
          { key: 'real', title: '实收（元）', type: 'money', sum: true }, { key: 'gift', title: '赠送（元）', type: 'money', sum: true }, { key: 'amount', title: '预存金额（元）', type: 'money', sum: true },
          { key: 'method', title: '支付方式' }, { key: 'handler', title: '经手人' }],
        empty: { title: '尚无预存记录', text: '点“预存储值”为本卡充值。' },
      });
      el.appendChild(p3.el);
      if (!closed) el.appendChild(h('div.apb-erp-row', btn('注销卡片', async () => {
        if (k.balance > 0) return el.prepend(notice('danger', `不能注销：卡内仍有余额 ${F.money(k.balance)} 元。请先办理预存退款，再注销。`));
        if (!(await confirm(`注销会员卡 ${k.cardNo}？`, { okLabel: '注销', danger: true, detail: '注销后该卡不能再使用，资料保留只读。' }))) return;
        await ERP.api.write(() => { k.status = '注销'; });
        toast(`会员卡 ${k.cardNo} 已注销。`); rerender();
      }, { variant: 'danger' })));
    },
  });

  /* ---------- 卡片发行（表单页） ---------- */
  ERP.page('cardIssue', {
    module: 'front', title: '卡片发行', nav: false, parent: 'cardInfo', desc: '登记发行新的会员卡，绑定到已有客户，或同时新建机构 / 个人客户。',
    render(el, params, ctx) {
      const groups = prestoreGroups();
      const nextNo = () => 'IC' + String(880001 + D.cards.length);
      let type = '电子卡片', bind = 'old';
      // 卡片
      const cardNo = input({ name: 'cardNo', value: nextNo(), readOnly: true, class: 'apb-erp-mono' });
      cardNo._validate = (v) => (D.cards.some((x) => x.cardNo === v) ? '卡片序号已存在，请换一张卡或重新读卡。' : null);
      const readState = h('span.apb-erp-muted', '电子卡片由系统分配序号，无需读卡。');
      const readBtn = btn('读卡', () => { cardNo.value = 'IC' + (990000 + D.cards.length); readState.textContent = `已读取：${cardNo.value}（演示）`; cardNo.dispatchEvent(new Event('input', { bubbles: true })); toast('读卡成功（演示）。'); });
      readBtn.hidden = true;
      const setType = (t) => {
        type = t;
        const phys = t === '实体卡片';
        cardNo.readOnly = !phys; cardNo.value = phys ? '' : nextNo(); readBtn.hidden = !phys;
        readState.textContent = phys ? '请把卡片放到读卡器上，点“读卡”，或手工输入卡面序号。' : '电子卡片由系统分配序号，无需读卡。';
      };
      const group = select([['', '请选择'], ...groups.map((g) => [g.code, g.name])], { name: 'group' });
      const expire = dateInput({ name: 'expire' }); expire.dataset.validate = 'date';
      // 持卡
      const custSel = select([['', '请选择客户'], ...D.customers.filter((c) => c.code !== '000000').map((c) => [c.code, `${c.code} ${c.name}（${c.groupName}）`])], { name: 'custCode' });
      const holder = select([['', '（同客户联系人）']], { name: 'holder' });
      const orgName = input({ name: 'orgName', maxlength: 100 }), orgContact = input({ name: 'orgContact', maxlength: 40 });
      const perName = input({ name: 'perName', maxlength: 40 }), perPhone = input({ name: 'perPhone', inputmode: 'tel' });
      perPhone.dataset.validate = 'phone';
      const applicant = input({ name: 'applicant', maxlength: 40 }), applicantPhone = input({ name: 'applicantPhone', inputmode: 'tel' });
      applicantPhone.dataset.validate = 'phone';
      custSel.addEventListener('change', () => {
        const c = D.customer(custSel.value);
        holder.replaceChildren(...[['', '（同客户联系人）'], ...[c && c.contact, '其他人员'].filter(Boolean).map((x) => [x, x])].map(([v, t]) => h('option', { value: v }, t)));
        if (!c) return;
        if (groups.some((g) => g.code === c.group)) group.value = c.group;
        if (!applicant.value) applicant.value = c.contact || '';
        if (!applicantPhone.value) applicantPhone.value = c.phone || '';
      });
      const fOld = [field({ label: '所属客户（必填）', control: custSel, error: '请选择所属客户。' }), field({ label: '持卡人员', control: holder })];
      const fOrg = [field({ label: '机构名称（必填）', control: orgName, help: '将新建机构客户。' }), field({ label: '联系人', control: orgContact })];
      const fPer = [field({ label: '个人姓名（必填）', control: perName, help: '将新建个人客户。' }), field({ label: '手机', control: perPhone })];
      const syncBind = () => {
        fOld.forEach((f) => (f.hidden = bind !== 'old')); fOrg.forEach((f) => (f.hidden = bind !== 'org')); fPer.forEach((f) => (f.hidden = bind !== 'per'));
        custSel.dataset.required = bind === 'old' ? 'true' : ''; orgName.dataset.required = bind === 'org' ? 'true' : ''; perName.dataset.required = bind === 'per' ? 'true' : '';
      };
      // 密码
      const pwd = input({ type: 'password', name: 'pwd', autocomplete: 'new-password' }), pwd2 = input({ type: 'password', name: 'pwd2', autocomplete: 'new-password' });
      pwd._validate = (v) => (v && v.length < 4 ? '消费密码至少 4 位。' : null);
      pwd2._validate = (v) => (v !== pwd.value ? '两次输入的密码不一致。' : null);
      const form = ERP.ui.form({
        ctx, wide: true, submitLabel: '确认发卡',
        cancel: { href: ERP.href('cardInfo'), label: '返回会员卡资料' },
        sections: [
          { title: '卡片', cols: 3, content: null, fields: [
            h('div.apb-erp-field.lerp-spanall', h('span', { style: { fontWeight: 600 } }, '卡片类型'),
              ERP.ui.radios('cardType', [['电子卡片', '电子卡片'], ['实体卡片', '实体卡片（IC 卡）']], type, (v) => { setType(v); form.dispatchEvent(new Event('input')); })),
            field({ label: '卡片序号', control: cardNo, required: true, error: '请读卡或填写卡片序号。' }),
            h('div.apb-erp-field', { style: { alignSelf: 'end' } }, h('div.apb-erp-row', readBtn, readState)),
            h('div'),
            field({ label: '客户分组', control: group, required: true, error: '请选择客户分组（决定卡片等级与折扣）。', help: '决定卡片等级与折扣。' }),
            field({ label: '有效期至', control: expire, help: '例如 2027-12-31；不填表示永久有效。' }),
            field({ label: '发行人员', control: select(empOptions(), { name: 'issuer', value: D.currentUser.name }) }),
          ] },
          { title: '持卡信息', content: [
            ERP.ui.radios('bind', [['old', '绑定已有客户'], ['org', '新建机构客户'], ['per', '新建个人客户']], bind, (v) => { bind = v; syncBind(); }),
            h('div.apb-erp-formgrid', fOld, fOrg, fPer),
          ] },
          { title: '办卡手续', cols: 3, fields: [
            field({ label: '办卡人姓名', control: applicant }), field({ label: '办卡人电话', control: applicantPhone }), h('div'),
            field({ label: '证件名称', control: select(['身份证', '护照', '驾驶证', '军官证', '港澳通行证', '其他'], { name: 'idType' }) }),
            field({ label: '证件号码', control: input({ name: 'idNo', maxlength: 30, class: 'apb-erp-mono' }) }),
          ] },
          { title: '消费密码', fields: [
            field({ label: '消费密码', control: pwd, required: true, help: '至少 4 位；持卡消费、退款时使用。' }),
            field({ label: '确认密码', control: pwd2, required: true, error: '请再次输入消费密码。' }),
          ] },
          { title: '备注', fields: [field({ label: '说明备注', control: input({ name: 'remark', maxlength: 200 }), span: 'all' })] },
        ],
        onSubmit: (v) => ERP.api.write(() => {
          let cust;
          if (bind === 'old') cust = D.customer(v.custCode);
          else {
            const org = bind === 'org', nm = (org ? v.orgName : v.perName).trim();
            cust = { code: biz.nextCustCode(), name: nm, type: org ? '机构' : '个人', contact: org ? v.orgContact : nm, phone: org ? '' : v.perPhone,
              tel: '', address: '', debt: 0, prestoreBalance: 0, created: new Date(), remark: '' };
            D.customers.push(cust);
          }
          cust.group = v.group; cust.groupName = D.groupName(v.group);
          const k = { cardNo: v.cardNo.trim(), custCode: cust.code, custName: cust.name, group: cust.groupName, issueDate: new Date(), issuer: v.issuer,
            balance: 0, totalIn: 0, totalOut: 0,  // 新卡余额为 0，储值走“预存储值” status: '正常', password: true, remark: v.remark || '',
            cardType: type, holder: v.holder || cust.contact || cust.name, locked: false, lost: false, expire: v.expire ? ERP.parseDate(v.expire) : null,
            idType: v.idType, idNo: v.idNo, applicant: v.applicant, applicantPhone: v.applicantPhone };
          D.cards.push(k);
          form.markClean();
          toast(`发卡成功：${k.cardNo} → ${cust.name}${bind === 'old' ? '' : `（新建客户 ${cust.code}）`}。`);
          ERP.go('cardDetail', { cardNo: k.cardNo });
        }),
      });
      el.appendChild(panel({ title: '新会员卡' }).el).querySelector('.apb-erp-panelbody').appendChild(form);
      syncBind();
    },
  });

  /* ======================================================================
   * 营业日报表（报表页）：汇总各类财务单据（结算、预存、零收、一般收支）
   * ==================================================================== */
  // 统一流水：{no, bizType, doc, party, income, expense, amount, account, method, orderNo, orderType, invoice, ticket, date, auditor, handler, cash, bucket, gift}
  function ledger() {
    const rows = [];
    D.settlements.forEach((s) => {
      const w = biz.order(s.orderNo);
      const bucket = s.method === '记账' ? '应收' : s.method === '预存' ? '预存' : '现金';
      rows.push({ no: s.no, bizType: '结算单', doc: s.orderNo ? '工单结算' : '往来结算', party: s.custName, income: bucket === '现金' ? s.amount : 0, expense: 0, amount: s.amount,
        account: bucket === '现金' ? s.account || acctOf(s.method) || '现金>前台钱箱' : bucket === '应收' ? '应收账款' : '预收账款', method: s.method === '现金' ? '现钞' : s.method,
        orderNo: s.orderNo, orderType: w ? w.orderType : '', invoice: !!s.invoice, ticket: s.ticket || '', date: s.date, auditor: s.audited ? s.handler : '', handler: s.handler, cash: bucket === '现金', bucket });
    });
    D.prestores.forEach((p) => rows.push({ no: p.no, bizType: p.type === '退款' ? '预存退款' : '预存单', doc: '会员卡 ' + (p.cardNo || ''), party: p.custName,
      income: p.real > 0 ? p.real : 0, expense: p.real < 0 ? -p.real : 0, amount: p.real, account: p.account || acctOf(p.method), method: p.method === '现金' ? '现钞' : p.method,
      orderNo: '', orderType: '', invoice: !!p.invoice, ticket: p.ticket || '', date: p.date, auditor: p.audited ? p.handler : '', handler: p.handler, cash: true, bucket: '预存', gift: p.gift }));
    D.miscIncomes.forEach((m) => rows.push({ no: m.no, bizType: '零收单', doc: m.itemName || m.item, party: m.custName || '零收散户', income: m.amount, expense: 0, amount: m.amount,
      account: m.account, method: m.method === '现金' ? '现钞' : m.method, orderNo: '', orderType: '', invoice: !!m.invoice, ticket: m.ticket || '', date: m.date,
      auditor: m.audited ? m.handler : '', handler: m.handler, cash: true, bucket: '现金' }));
    D.cashJournal.forEach((j) => rows.push({ no: j.no, bizType: j.kind, doc: j.type, party: '', income: j.kind === '一般收入' ? j.amount : 0, expense: j.kind === '一般支出' ? j.amount : 0,
      amount: j.kind === '一般收入' ? j.amount : -j.amount, account: j.account.includes('现金') ? '现金>前台钱箱' : '银行存款>' + j.account, method: '转账', orderNo: '', orderType: '',
      invoice: false, ticket: '', date: j.date, auditor: j.audited ? j.handler : '', handler: j.handler, cash: true, bucket: '现金' }));
    return rows;
  }
  const REPORT_WAYS = ['现钞', '支票', '刷卡', '汇款', '微信', '支付宝', '其他'];
  // 分类汇总：返回 [{item, count, value}]（value 为 0 的单据不计）
  const agg = (list, keyFn, valFn) => {
    const m = new Map();
    list.forEach((x) => { const v = valFn(x); if (!v) return; const k = keyFn(x); const o = m.get(k) || { item: k, count: 0, value: 0 }; o.count++; o.value = r2(o.value + v); m.set(k, o); });
    return [...m.values()];
  };
  const ledgerCols = () => grouped([
    { title: '基础', columns: [
      { key: 'no', title: '单据编号', type: 'mono' }, { key: 'bizType', title: '业务类型' }, { key: 'doc', title: '业务单据' }, { key: 'party', title: '往来单位', render: (x) => x.party || '—' },
    ] },
    { title: '金额', columns: [
      { key: 'income', title: '收入金额（元）', type: 'money', sum: true, render: (x) => optMoney(x.income) },
      { key: 'expense', title: '支出金额（元）', type: 'money', sum: true, render: (x) => optMoney(x.expense) },
      { key: 'account', title: '会计科目' }, { key: 'method', title: '支付方式' },
    ] },
    { title: '相关', columns: [
      { key: 'orderNo', title: '工单编号', type: 'mono', render: (x) => orderLink(x.orderNo) }, { key: 'orderType', title: '工单类型', render: (x) => x.orderType || '—' },
      { key: 'invoice', title: '相关发票', render: (x) => yesNo(x.invoice) }, { key: 'ticket', title: '票据信息', render: (x) => x.ticket || '—' },
      { key: 'date', title: '业务日期', type: 'date' },
    ] },
  ]);

  ERP.page('dailyReport', {
    module: 'front', title: '营业日报表', navTitle: '营业日报', desc: '汇总结算、预存、零收、一般收支等财务单据在指定时间范围内的数据。',
    render(el, params, ctx) {
      // 条件（写入地址，可分享、刷新保留）
      const preset = params.p || 'month';
      const [a0, b0] = preset === 'custom' ? [params.from || '', params.to || ''] : ERP.ui.presetRange(preset);
      const presetSel = select(ERP.ui.datePresets.filter(([v]) => v !== 'all'), { value: preset, style: { width: 'auto', flex: '0 0 auto' } });
      const from = dateInput({ value: a0, 'aria-label': '开始日期' }), to = dateInput({ value: b0, 'aria-label': '结束日期' });
      const dateErr = h('span.apb-erp-error', { hidden: true }, '请填写有效日期，例如 2026-10-21；开始日期不能晚于结束日期。');
      presetSel.addEventListener('change', () => { if (presetSel.value !== 'custom') { const [a, b] = ERP.ui.presetRange(presetSel.value); from.value = a; to.value = b; run(); } });
      [from, to].forEach((x) => x.addEventListener('change', () => { presetSel.value = 'custom'; }));
      const handler = select([['', '全部'], ...empOptions()], { value: params.handler || '' });
      const auditor = select([['', '全部'], ...empOptions()], { value: params.auditor || '' });
      const way = select([['', '全部'], ...REPORT_WAYS], { value: params.way || '' });
      const acct = select([['', '全部现金银行科目'], ...ACCOUNTS], { value: params.acct || '' });
      const inv = select([['', '全部'], ['有票', '有票'], ['无票', '无票']], { value: params.inv || '' });
      [handler, auditor, way, acct, inv].forEach((x) => x.addEventListener('change', () => run()));
      const bar = h('form.apb-erp-toolbar', { novalidate: true, onsubmit: (e) => { e.preventDefault(); run(); } },
        h('div.apb-erp-field', { style: { flex: '2 1 520px' } }, h('label', { for: presetSel.id = ERP.ui.uid('f') }, '业务日期'),
          h('div.apb-erp-row', presetSel, h('span.apb-erp-row', { style: { flexWrap: 'nowrap', flex: '1 1 300px' } }, from, h('span', '至'), to)), dateErr),
        field({ label: '经手人员', control: handler }), field({ label: '审核人员', control: auditor }), field({ label: '支付方式', control: way }),
        field({ label: '现金银行', control: acct }), Object.assign(field({ label: '发票状态', control: inv }), { style: 'flex: 0 1 200px' }),
        btn('统计', null, { type: 'submit', variant: 'primary' }));
      const cond = panel({ title: '统计条件', flush: true });
      cond.body.appendChild(bar);
      el.appendChild(cond.el);
      const meta = h('span', { role: 'status', 'aria-live': 'polite' });
      const sumHost = h('div'), detailHost = h('div');
      const pSum = panel({ title: '汇总', note: meta });
      pSum.body.append(sumHost);
      el.appendChild(pSum.el);
      let tab = 0, cash = [], other = [];
      const { columns, groups } = ledgerCols();
      const pDet = panel({ title: '明细', flush: true, actions: [
        btn('导出当前页签', () => ERP.ui.exportCsv(tab === 0 ? '营业日报-现金相关' : '营业日报-非现金', exportCols(columns), tab === 0 ? cash : other)),
        btn('打印', () => window.print()),
      ] });
      pDet.body.append(detailHost);
      el.appendChild(pDet.el);

      function filtered(a, b) {
        return ledger().filter((x) => {
          const t = new Date(x.date);
          return (!a || t >= a) && (!b || t <= b) && (!handler.value || x.handler === handler.value) && (!auditor.value || x.auditor === auditor.value)
            && (!way.value || x.method === way.value || (way.value === '汇款' && x.method === '转账') || (way.value === '其他' && !REPORT_WAYS.includes(x.method) && x.method !== '转账'))
            && (!acct.value || !x.account.includes('>') || x.account === acct.value)
            && (!inv.value || (inv.value === '有票') === !!x.invoice);
        }).sort((p, q) => q.date - p.date);
      }
      // 汇总四栏：支付方式 / 现金 / 应收 / 预存，每栏“增加”“减少”分行，合计 = 增加 − 减少
      function sumTable(host, title, plus, minus) {
        const rows = [...plus.map((x) => ({ ...x, dir: '增加' })), ...minus.map((x) => ({ ...x, dir: '减少', value: -x.value }))];
        const p = panel({ title, flush: true });
        ERP.ui.table(p.body, {
          caption: `${title}汇总`, compact: true, rows, footLabel: '合计',
          columns: [{ key: 'dir', title: '方向', render: (x) => h('span', { style: { whiteSpace: 'nowrap' } }, x.dir) }, { key: 'item', title: '项目', render: (x) => h('span', { style: { whiteSpace: 'nowrap' } }, x.item) }, { key: 'count', title: '单数', type: 'num', sum: true }, { key: 'value', title: '金额（元）', type: 'money', sum: true }],
          empty: { title: '无发生额', text: '所选范围内没有相关单据。' },
        });
        host.appendChild(p.el);
        return r2(rows.reduce((s, x) => s + x.value, 0));
      }
      function run() {
        const okDates = [from, to].every((x) => !x.value.trim() || ERP.validDate(x.value.trim()));
        const a = ERP.parseDate(from.value.trim()), b = ERP.parseDate(to.value.trim(), true);
        const bad = !okDates || (a && b && a > b);
        dateErr.hidden = !bad;
        [from, to].forEach((x) => x.setAttribute('aria-invalid', String(!!bad && (!x.value.trim() || !ERP.validDate(x.value.trim()) || x === from))));
        if (bad) { from.focus(); return; }
        const q = { p: presetSel.value === 'month' ? null : presetSel.value, from: presetSel.value === 'custom' ? from.value.trim() : null, to: presetSel.value === 'custom' ? to.value.trim() : null,
          handler: handler.value, auditor: auditor.value, way: way.value, acct: acct.value, inv: inv.value };
        ERP.setParams(q);
        const rows = filtered(a, b);
        cash = rows.filter((x) => x.cash); other = rows.filter((x) => !x.cash);
        const range = `${from.value.trim() || '最早'} 至 ${to.value.trim() || '今天'}`;
        meta.textContent = `单位：元 · 时间范围：${range}（按业务日期）· 数据截至：${F.stamp(new Date())} · 共 ${rows.length} 张单据`;
        // 汇总
        const cashAcct = cash.filter((x) => x.account.startsWith('现金'));
        const grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: 'var(--apb-erp-space-4)' } });
        const tWay = sumTable(grid, '支付方式', agg(cash, (x) => x.method, (x) => x.income), agg(cash, (x) => x.method, (x) => x.expense));
        const tCash = sumTable(grid, '现金', agg(cashAcct, (x) => x.bizType, (x) => x.income), agg(cashAcct, (x) => x.bizType, (x) => x.expense));
        const tAr = sumTable(grid, '应收', agg(rows.filter((x) => x.bucket === '应收'), (x) => x.bizType, (x) => x.amount), []);
        const tPre = sumTable(grid, '预存', agg(rows.filter((x) => x.bizType === '预存单'), () => '预存单（含赠送）', (x) => x.amount + (x.gift || 0)),
          agg(rows.filter((x) => (x.bizType === '结算单' && x.bucket === '预存') || x.bizType === '预存退款'), (x) => (x.bizType === '结算单' ? '扣减预存（结算）' : '预存退款'), (x) => Math.abs(x.amount) + Math.abs(x.gift || 0)));
        sumHost.replaceChildren(ERP.ui.summary([['收款净额（元）', F.money(tWay)], ['现金净额（元）', F.money(tCash)], ['新增应收（元）', F.money(tAr)], ['预存净增（元）', F.money(tPre)]]), h('div', { style: { height: 'var(--apb-erp-space-4)' } }), grid);
        // 明细：现金相关 / 非现金的
        detailHost.replaceChildren();
        const table = (pane, list, empty) => ERP.ui.table(pane, { caption: '营业日报明细', rows: list, columns, groups, empty: { title: empty, text: '调整日期范围或条件后点“统计”。' } });
        ERP.ui.tabs(detailHost, [
          { title: `现金相关（${cash.length}）`, render: (pane) => table(pane, cash, '没有现金相关单据') },
          { title: `非现金的（${other.length}）`, render: (pane) => table(pane, other, '没有非现金单据') },
        ], { active: tab, onChange: (i) => (tab = i) });
      }
      run();
    },
  });

  /* ======================================================================
   * 零收（表单页）/ 零收记录
   * ==================================================================== */
  ERP.page('miscIncome', {
    module: 'front', title: '零收', desc: '登记无需开工作单的零散收入（复印、打印、扫描等），直接收款入账。',
    render(el, params, ctx) {
      ctx.setActions([btn('找零计算器', () => changeCalc(num(amount.value))), link('零收记录', 'miscIncomeRecords', null, { button: true })]);
      let item = null, again = false;
      const itemIn = input({ name: 'itemName', readOnly: true, placeholder: '点“选择项目”' });
      const catOut = h('span.apb-erp-muted', '尚未选择经营项目');
      const price = money({ name: 'price', value: '0.000' }), qty = input({ name: 'qty', value: '1', inputmode: 'decimal', class: 'lerp-amount' });
      price._validate = (v) => (!/^\d+(\.\d{1,3})?$/.test(v.replace(/,/g, '')) ? '请填写单价，最多三位小数，例如 0.500。' : null);
      qty._validate = (v) => (!(num(v) > 0) ? '数量需大于 0。' : null);
      const amount = money({ name: 'amount', value: '0.00' });
      amount.dataset.validate = 'money';
      amount._validate = (v) => (num(v) <= 0 ? '零收金额需大于 0。' : null);
      const calc = () => { amount.value = r2(num(price.value) * num(qty.value)).toFixed(2); };
      [price, qty].forEach((x) => x.addEventListener('input', calc));
      const acct = select(ACCOUNTS, { name: 'account' }), way = select(PAYWAYS, { name: 'method' });
      way.addEventListener('change', () => { const a = acctOf(way.value); if (a) acct.value = a; });
      const date = dateInput({ name: 'date', value: F.date(new Date()) }); date.dataset.validate = 'date';
      const fee = money({ name: 'fee', value: '0.00' }); fee.dataset.validate = 'money';
      const pick = () => biz.itemPicker((it) => {
        item = it; itemIn.value = it.name; catOut.textContent = `${D.itemCatName(it.cat)} · 单位：${it.unit} · 标价 ${F.money(it.price)} 元`;
        price.value = it.price.toFixed(3); calc(); form.dispatchEvent(new Event('input'));
      });
      const form = ERP.ui.form({
        ctx, submitLabel: '保存零收',
        cancel: { href: ERP.href('miscIncomeRecords'), label: '返回零收记录' },
        moreActions: btn('保存并新增', () => { again = true; form.requestSubmit(); }),
        sections: [
          { title: '基础', fields: [
            field({ label: '客户名称', control: input({ name: 'custName', value: '零收散户', maxlength: 100 }) }),
            field({ label: '业务日期', control: date, required: true, help: '例如 2026-10-21。' }),
          ] },
          // 先选项目再填单价、数量：按钮放在字段之前
          { title: '项目', content: [h('div.apb-erp-row', btn('选择项目', pick), catOut), h('div.apb-erp-formgrid',
            field({ label: '经营子项', control: itemIn, required: true, error: '请点“选择项目”选择经营项目。', span: 'all' }),
            field({ label: '单价（元）', control: price, required: true, help: '最多三位小数。' }),
            field({ label: '数量', control: qty, required: true }))] },
          { title: '金额与入账', cols: 3, fields: [
            field({ label: '零收金额（元）', control: amount, required: true, help: '按单价 × 数量自动计算，可修改。' }),
            field({ label: '支付方式', control: way, help: '选择后自动带出入账科目。' }), field({ label: '入账科目', control: acct }),
            field({ label: '手续费用（元）', control: fee }),
            field({ label: '票据信息', control: input({ name: 'ticket', maxlength: 60 }) }),
            h('div.lerp-checks', { style: { alignSelf: 'end' } }, ERP.ui.checkbox('已开发票', false, { name: 'invoice' })),
          ] },
          { title: '备注', fields: [field({ label: '说明备注', control: input({ name: 'remark', maxlength: 200 }), span: 'all' })] },
        ],
        onSubmit: (v) => ERP.api.write(() => {
          const no = docNo('LS', D.miscIncomes), amt = r2(num(v.amount));
          D.miscIncomes.unshift({ no, date: ERP.parseDate(v.date) || new Date(), custName: v.custName.trim() || '零收散户', item: item.name, itemName: item.name, cat: item.cat, catName: D.itemCatName(item.cat),
            unit: item.unit, price: num(v.price), qty: num(v.qty), amount: amt, account: v.account, method: v.method, fee: num(v.fee),
            invoice: !!v.invoice, ticket: v.ticket || '', remark: v.remark || '', handler: D.currentUser.name, source: '手动登记创建', audited: true });
          form.markClean();
          toast(`零收已登记：${no}，${F.money(amt)} 元。`);
          if (again) ERP.reload(); else ERP.go('miscIncomeRecords', { q: no });
        }),
      });
      // 主按钮提交时不是“保存并新增”
      form.querySelector('button[type=submit]').addEventListener('click', () => (again = false));
      el.appendChild(panel({ title: '零收单' }).el).querySelector('.apb-erp-panelbody').appendChild(form);
    },
  });
  // 找零计算器（短操作对话框）
  function changeCalc(due) {
    const got = money({ value: due ? due.toFixed(2) : '' });
    const out = h('strong.lerp-big#lerp-change-out', { 'aria-live': 'polite' }, '0.00');
    const upd = () => { const c = r2(num(got.value) - due); out.textContent = c < 0 ? `还差 ${F.money(-c)}` : F.money(c); };
    got.addEventListener('input', upd);
    dialog({
      title: '找零计算器', kicker: `应收 ${F.money(due)} 元`,
      body: [field({ label: '客户付款（元）', control: got }), kv([['应收（元）', h('span.apb-erp-mono', F.money(due))], ['找零（元）', out]])],
      actions: [{ label: '关闭', variant: 'primary' }],
    });
    upd(); got.focus(); got.select();
  }

  ERP.page('miscIncomeRecords', {
    module: 'front', title: '零收记录', desc: '零散收入单据，含手动登记与云端交易自动创建。',
    render(el, params, ctx) {
      ctx.setActions([link('登记零收', 'miscIncome', null, { button: true, variant: 'primary' })]);
      const { columns, groups } = grouped([
        { title: '基础', columns: [
          { key: 'no', title: '零收单号', type: 'mono', width: 140 }, { key: 'date', title: '业务日期', type: 'date', nowrap: true }, { key: 'custName', title: '客户名称' },
        ] },
        { title: '项目', columns: [
          { key: 'itemName', title: '经营项目', width: 160, sub: (m) => m.catName }, { key: 'unit', title: '单位' },
          { key: 'price', title: '单价（元）', align: 'right', render: (m) => h('span.apb-erp-mono', Number(m.price).toFixed(3)) }, { key: 'qty', title: '数量', type: 'num', sum: true },
        ] },
        { title: '金额', columns: [
          { key: 'amount', title: '零收金额（元）', type: 'money', sum: true }, { key: 'account', title: '入账科目', width: 170 },
          { key: 'payWay', title: '支付方式', render: (m) => (m.method === '现金' ? '现钞' : m.method) },
          { key: 'fee', title: '手续费用（元）', type: 'money', sum: true, render: (m) => optMoney(m.fee) },
          { key: 'invoice', title: '已开发票', render: (m) => yesNo(m.invoice) }, { key: 'ticket', title: '票据信息', render: (m) => m.ticket || '—' },
        ] },
        { title: '更多', columns: [
          { key: 'source', title: '创建方式' }, { key: 'handler', title: '经手人' }, { key: 'audited', title: '审核', render: (m) => biz.auditBadge(m.audited) },
          { key: 'remark', title: '说明备注', width: 140, render: (m) => m.remark || '—' },
        ] },
      ]);
      const list = roomyDates(ERP.ui.list(el, {
        title: '零收单', note: '按业务日期倒序', params, columns, groups, idKey: 'no',
        load: () => D.miscIncomes,
        sort: (a, b) => b.date - a.date,
        filters: [
          { key: 'q', type: 'search', label: '搜索', placeholder: '零收单号 / 项目 / 客户 / 票据', keys: ['no', 'itemName', 'item', 'custName', 'ticket', 'remark'] },
          { key: 'date', type: 'daterange', label: '业务日期', field: 'date' },
          { key: 'source', type: 'select', label: '创建方式', options: ['手动登记创建', '云端交易（支付宝）', '云端交易（微信）'] },
          { key: 'account', type: 'select', label: '入账科目', options: ACCOUNTS },
          { key: 'method', type: 'select', label: '支付方式', options: ['现金', ...PAYWAYS] },
          invoiceFilter, auditFilter,
          { key: 'handler', type: 'select', label: '经手人员', options: empOptions() },
        ],
        rowActions: (m) => [
          linkBtn(m.audited ? '反审核' : '审核', () => toggleAudit(m, '零收单', () => list.reload()), { ariaLabel: `${m.audited ? '反审核' : '审核'}零收单 ${m.no}` }),
          linkBtn('小票', () => toast(`打印零收单 ${m.no} 小票（演示）。`), { ariaLabel: `打印零收单 ${m.no} 小票` }),
          m.audited ? null : linkBtn('删除', async () => {
            if (!(await confirm(`删除零收单 ${m.no}？`, { okLabel: '删除', danger: true, detail: `金额 ${F.money(m.amount)} 元。删除后不能恢复。` }))) return;
            await ERP.api.write(() => D.miscIncomes.splice(D.miscIncomes.indexOf(m), 1));
            toast(`零收单 ${m.no} 已删除。`); list.reload();
          }, { variant: 'danger', ariaLabel: `删除零收单 ${m.no}` }),
        ],
        selectable: true,
        batch: [{ label: '导出所选', onClick: (rows) => ERP.ui.exportCsv('零收记录', exportCols(columns), rows) }],
        emptyTitle: '尚无零收记录', emptyText: '登记零收后会显示在这里。', emptyAction: link('登记零收', 'miscIncome', null, { button: true, variant: 'primary' }),
      }));
    },
  });
})();
