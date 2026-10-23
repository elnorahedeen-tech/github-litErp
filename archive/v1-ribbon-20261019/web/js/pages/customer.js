/* 客户：客户资料管理（基础/全面）、新建机构/个人客户、客户资料窗口（含客户综合信息）、
 * 联络人员管理、分组价格管理、协议价格管理、客户合并、价格复制
 * 共享：ERP.biz.openCustomer(code) / custSummary(code) / customerPicker(onPick) / openContact / showAgreement(code)
 * 额外模拟数据（联络人员、协议价格、分组价格）在本文件生成，挂在 ERP.data.contacts / agreementPrices / groupPrices */
(function () {
  'use strict';
  const { h, grid, sidebar, split, dialog, field, input, select, check, btn, toast, itabs } = ERP.ui;
  const D = ERP.data, F = ERP.fmt;
  const biz = (ERP.biz = ERP.biz || {});

  // 本模块自己的伪随机（不影响 data.js 的种子序列）
  let seed = 7319;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const r2 = D.util.r2;
  // 按字符串取稳定的伪随机下标（补全客户扩展字段用）
  const hs = (s, n) => { let x = 7; for (const ch of String(s)) x = (x * 31 + ch.charCodeAt(0)) >>> 0; return x % n; };

  /* ---------- 选项 ---------- */
  const OPT = {
    level: ['未评估', 'A', 'B', 'C', 'D'],
    source: ['门店接待', '电话咨询', '老客户介绍', '互联网', '路过', '业务开发', '其他'],
    industry: ['未知', '政府机关', '教育', '建筑设计', '房地产', '制造业', '商贸', '金融', '医疗', '广告传媒', '个人'],
    districts: ['中关村', 'CBD', '天河', '南山', '岳麓', '光谷', '滨海', '解放碑', '政务区', '开发区'],
    orgType: ['公司', '政府机关', '事业单位', '学校', '社会团体', '个体工商户', '其他'],
    scale: ['未知', '1-10人', '11-50人', '51-200人', '201-500人', '500人以上'],
    contactType: ['未评估', '决策人', '经办人', '财务', '设计师', '采购'],
    gender: ['男', '女'],
    ageBand: ['', '20-30', '30-40', '40-50', '50以上'],
    settle: ['现结', '记账', '月结'],
  };
  const groupOpts = () => D.groups.map((g) => [g.code, `${g.code} - ${g.name}`]);
  const empOpts = () => [''].concat(D.employees.map((e) => e.name));

  /* ---------- 客户扩展字段补全（旧系统客户资料窗口中的全部字段） ---------- */
  function ensure(c) {
    if (c._ext) return c;
    const k = c.code, org = c.type === '机构';
    Object.assign(c, {
      _ext: true,
      short: c.short ?? (org && hs(k, 3) === 0 ? c.name.slice(0, 2) : ''),
      qq: c.qq ?? (hs(k + 'q', 4) === 0 ? String(10000000 + hs(k, 89999999)) : ''),
      wechat: c.wechat ?? '', fax: c.fax ?? '', email: c.email ?? (hs(k + 'm', 5) === 0 ? `info${k}@example.com` : ''),
      zip: c.zip ?? '', other: c.other ?? '', website: c.website ?? 'http://', intro: c.intro ?? '',
      district: c.district ?? `${(c.address || '').split('市')[0] || c.city || '北京'}>${OPT.districts[hs(k, OPT.districts.length)]}`,
      distance: c.distance ?? 1, relation: c.relation ?? '未评估', credit: c.credit ?? '未评估',
      source: c.source ?? OPT.source[hs(k + 's', OPT.source.length)], industry: c.industry ?? (org ? OPT.industry[hs(k, 9)] : '个人'),
      noOrderRemind: c.noOrderRemind ?? 0, orgType: c.orgType ?? '公司', scale: c.scale ?? '未知', company: c.company ?? '', hobby: c.hobby ?? '',
    });
    return c;
  }
  D.customers.forEach(ensure);
  const isBook = (c) => c.settleType !== '现结';                   // 记账客户
  const isPre = (c) => c.group >= '30' && c.group <= '60';          // 预存分组
  const custColor = (c) => ({ '20': 'red', '30': 'blue', '40': 'purple', '50': 'orange', '60': 'red', '75': 'blue' })[c.group];
  const nextCode = () => String(Math.max(...D.customers.map((c) => +c.code || 0)) + 5);
  biz.notifyCustomersChanged = () => document.querySelectorAll('.docpage').forEach((p) => p.dispatchEvent(new Event('erp:customers-changed')));

  /* ---------- 额外模拟数据：联络人员 ---------- */
  if (!D.contacts) {
    const sur = '王李张刘陈杨黄赵周吴徐孙马朱胡郭何林罗高'.split(''), given = ['伟', '芳', '娜', '敏', '静', '强', '磊', '洋', '艳', '勇', '军', '杰', '涛', '明', '超', '霞'];
    const titles = [['办公室', '主任'], ['行政部', '专员'], ['设计部', '设计师'], ['财务部', '会计'], ['工程部', '工程师'], ['采购部', '经理'], ['', '']];
    let id = 1;
    D.contacts = [];
    D.customers.filter((c) => c.code !== '000000').forEach((c) => {
      const n = c.type === '机构' ? 1 + Math.floor(rnd() * 3) : 1;
      for (let i = 0; i < n; i++) {
        const s = i === 0 && c.contact ? c.contact[0] : pick(sur), gender = pick(OPT.gender);
        const [dept, title] = c.type === '机构' ? pick(titles) : ['', ''];
        D.contacts.push({
          id: id++, custCode: c.code, type: pick(OPT.contactType), dept, title, name: s + pick(given) + (rnd() > 0.5 ? pick(given) : ''),
          call: s + (title === '经理' ? '经理' : gender === '男' ? '先生' : '女士'), gender, ageBand: pick(OPT.ageBand),
          mobile: i === 0 ? c.phone : rnd() > 0.3 ? '1' + pick(['3', '5', '8']) + String(Math.floor(rnd() * 1e9)).padStart(9, '0') : '',
          tel: rnd() > 0.7 ? '0' + (10 + Math.floor(rnd() * 80)) + '-' + (60000000 + Math.floor(rnd() * 3e7)) : '',
          email: rnd() > 0.6 ? `u${id}@mail.com` : '', qq: '', address: '', idCard: '', owner: c.owner, cloud: rnd() > 0.8 ? 'wx_' + (1000 + id) : '',
          created: c.created, intro: '', remark: '',
        });
      }
    });
  }
  const custOf = (code) => D.customer(code) || { name: '', groupName: '' };

  /* ---------- 额外模拟数据：协议价格、分组价格 ---------- */
  if (!D.agreementPrices) {
    let id = 1;
    D.agreementPrices = [];
    ['1220', '1060', '1055', '1350', '1010', '1240'].forEach((cc) => {
      const its = D.items.filter(() => rnd() > 0.82).slice(0, 8);
      its.forEach((it) => D.agreementPrices.push({ id: id++, custCode: cc, itemCode: it.code, price: r2(it.price * (0.6 + Math.floor(rnd() * 4) / 10)),
        owner: pick(['管理员', '总管', '']), start: new Date(2026, Math.floor(rnd() * 9), 1), desc: '', remark: rnd() > 0.7 ? '年度协议' : '' }));
    });
  }
  if (!D.groupPrices) {
    D.groupPrices = {};
    D.groups.forEach((g) => (D.groupPrices[g.code] = {}));
    D.items.forEach((it) => {
      if (['10', '12', '20'].includes(it.cat)) {
        D.groups.filter((g) => g.discount < 1).forEach((g) => (D.groupPrices[g.code][it.code] = r2(it.price * g.discount)));
        D.groupPrices['20'][it.code] = r2(it.price * 0.8);
      }
      if (['20', '21', '32'].includes(it.cat)) D.groupPrices['65'][it.code] = r2(it.price * 0.6);
    });
  }
  const itemOf = (code) => D.items.find((i) => i.code === code) || { name: '', unit: '', tier: '-', price: 0, cat: '' };

  /* ---------- 通用小部件 ---------- */
  // 与对象字段双向绑定的输入控件
  const bi = (o, k, attrs = {}) => input(Object.assign({ value: o[k] ?? '', oninput: (e) => (o[k] = attrs.type === 'number' ? Number(e.target.value) || 0 : e.target.value) }, attrs));
  const bs = (o, k, opts, attrs = {}) => select(opts, Object.assign({ value: o[k] ?? '', onchange: (e) => (o[k] = e.target.value) }, attrs));
  const bt = (o, k, rows = 3) => h('textarea.inp', { rows, value: o[k] ?? '', oninput: (e) => (o[k] = e.target.value) });
  const fs = (title, ...children) => h('div.fieldset', h('legend', title), ...children);
  // 窗口工具栏（与工作单窗口一致的功能区样式）：groups = [{title, items: [[label, color, action, disabled]]}]
  const CL = { gray: '#a8a29e', sky: '#38a3d6', red: '#e8424a', orange: '#f08a24', green: '#22a559', gold: '#e0a21a', blue: '#3b82f6', purple: '#8b5cf6' };
  const toolbar = (groups) => h('div.ribbon', { style: { minHeight: '64px', flex: '0 0 auto' } }, groups.map((g) =>
    h('div.rgroup', h('div.items', g.items.filter(Boolean).map(([label, color, action, disabled]) =>
      h('button.rbtn', { disabled, style: disabled ? { opacity: 0.4 } : null, onclick: action },
        h('span.ico', { style: { background: color, width: '28px', height: '28px', fontSize: '14px' } }, label[0]), h('span', label)))), h('div.gtitle', g.title))));
  const statusFoot = (text, ...right) => h('div.dlg-foot', h('span.muted', text), h('span.grow'), ...right);

  /* 客户选择框：「1220/北京格式快印公司  ✕ 📄 🔍」 */
  function custBox(code, onChange, { width } = {}) {
    let value = code || '';
    const show = () => { const c = D.customer(value); inp.value = c ? `${c.code}/${c.name}` : ''; };
    const set = (v) => { value = v || ''; show(); onChange && onChange(value); };
    const inp = input({ placeholder: '编号/名称 回车', style: { flex: 1, minWidth: 0 },
      onkeydown: (e) => {
        if (e.key !== 'Enter') return;
        const k = inp.value.trim(), exact = D.customer(k) || D.customers.find((c) => c.name === k);
        const hit = exact ? [exact] : D.customers.filter((c) => c.name.includes(k) || c.phone.includes(k));
        if (k && hit.length === 1) set(hit[0].code); else biz.customerPicker((c) => set(c.code), k);
      } });
    const ib = (t, title, fn) => h('button.btn.sm', { title, style: { padding: '0 5px' }, onclick: fn }, t);
    const el = h('div.row', { style: { gap: '2px', width } }, inp,
      ib('✕', '清除', () => set('')), ib('📄', '打开客户资料', () => value ? biz.openCustomer(value) : toast('请先选择客户')),
      ib('🔍', '选择客户', () => biz.customerPicker((c) => set(c.code), inp.value.includes('/') ? '' : inp.value.trim())));
    show();
    return { el, get value() { return value; }, set };
  }

  /* 客户选择器 */
  biz.customerPicker = function (onPick, keyword = '') {
    const dlg = dialog({
      title: '选择客户', width: 820, height: 520,
      body: (b) => {
        const kw = input({ value: keyword, placeholder: '客户编号 / 名称 / 电话 / 联系人，回车选中第一项' });
        b.appendChild(kw);
        const g = grid(b, { columns: [{ key: 'code', title: '编号', width: 70 }, { key: 'type', title: '类型', width: 50, align: 'center' }, { key: 'groupName', title: '分组', width: 150 },
          { key: 'name', title: '名称', width: 260 }, { key: 'contact', title: '代表', width: 80 }, { key: 'phone', title: '电话', width: 120 }],
          rows: [], footer: false, rowColor: custColor, onDblClick: (c) => { onPick(c); dlg.close(); } });
        const refresh = () => { const k = kw.value.trim(); g.setRows(D.customers.filter((c) => !k || c.code.includes(k) || c.name.includes(k) || c.phone.includes(k) || (c.contact || '').includes(k))); };
        kw.addEventListener('input', refresh);
        kw.addEventListener('keydown', (e) => { if (e.key === 'Enter' && g.rows[0]) { onPick(g.rows[0]); dlg.close(); } });
        refresh();
        setTimeout(() => kw.focus());
      },
      buttons: [{ label: '✔ 确定(S)', primary: true, action: (close) => { const g = dlg.body.querySelector('tr.sel'); if (!g) { toast('请选择一个客户'); return; } g.dispatchEvent(new MouseEvent('dblclick')); } }, { label: '✕ 关闭(C)' }],
    });
  };

  /* ==================== 客户资料管理（基础 / 全面） ==================== */
  const basicGroups = () => [
    { title: '基本信息', columns: [
      { key: 'code', title: '编号', width: 80 },
      { key: 'type', title: '类型', width: 56, align: 'center' },
      { key: 'groupName', title: '分组', width: 130, align: 'center' },
      { key: 'name', title: '名称', width: 240 },
      { key: 'short', title: '简称', width: 90 },
    ] },
    { title: '结算相关', columns: [
      { key: 'settleType', title: '结算', width: 60, align: 'center', render: (c) => (isBook(c) ? '记账' : '现收') },
      { key: 'book', title: '记账', width: 56, align: 'center', render: (c) => (isBook(c) ? '√' : '') },
      { key: 'pre', title: '预存', width: 56, align: 'center', render: (c) => (isPre(c) ? '√' : '') },
    ] },
    { title: '联系信息', columns: [
      { key: 'contact', title: '代表', width: 80 },
      { key: 'phone', title: '电话', width: 120 },
      { key: 'qq', title: 'QQ号', width: 100 },
      { key: 'wechat', title: '微信', width: 100 },
      { key: 'address', title: '地址', width: 200 },
      { key: 'district', title: '商圈', width: 110 },
    ] },
    { title: '其他', columns: [{ key: 'remark', title: '说明备注', width: 140 }] },
  ];
  const fullGroups = () => {
    const g = basicGroups();
    g[1].columns.push({ key: 'debt', title: '欠款', type: 'money', sum: true, hideZero: true }, { key: 'prestoreBalance', title: '预存余额', type: 'money', sum: true, hideZero: true },
      { key: 'writeOffPending', title: '待销账', type: 'money', sum: true, hideZero: true }, { key: 'creditLimit', title: '信用额度', type: 'money', hideZero: true });
    g[2].columns.push({ key: 'fax', title: '传真', width: 100 }, { key: 'email', title: '电子邮件', width: 160 }, { key: 'zip', title: '邮编', width: 70 });
    g.splice(3, 1,
      { title: '特征属性', columns: [{ key: 'created', title: '建交日期', type: 'date' }, { key: 'value', title: '价值评估', width: 76, align: 'center' }, { key: 'relation', title: '关系等级', width: 76, align: 'center' },
        { key: 'credit', title: '信誉等级', width: 76, align: 'center' }, { key: 'source', title: '客户来源', width: 90 }, { key: 'industry', title: '所属行业', width: 90 }] },
      { title: '开票信息', columns: [{ key: 'invoiceTitle', title: '开票抬头', width: 200 }, { key: 'taxNo', title: '税号', width: 150 }, { key: 'bank', title: '开户银行', width: 150 }] },
      { title: '管控', columns: [{ key: 'owner', title: '负责人员', width: 80 }, { key: 'lastAudit', title: '最近对账', type: 'date' }, { key: 'noOrderRemind', title: '无委托提醒', type: 'int', width: 86 }] },
      { title: '其他', columns: [{ key: 'remark', title: '说明备注', width: 140 }, { key: 'intro', title: '说明简介', width: 160 }] });
    return g;
  };

  /* 客户右键菜单 */
  biz.customerMenu = (getGrid, c) => [
    { label: '查看(K)', shortcut: 'Ctrl+K', disabled: !c, action: () => biz.openCustomer(c.code) },
    { label: '查看客户综合信息', disabled: !c, action: () => biz.custSummary(c.code) },
    '-',
    { label: '新建机构客户(N)', shortcut: 'Ctrl+N', action: () => biz.openCustomer(null, { type: '机构' }) },
    { label: '新建个人客户', action: () => biz.openCustomer(null, { type: '个人' }) },
    { label: '删除(D)', disabled: !c, action: () => deleteCustomer(c) },
    '-',
    { label: '联络人员', disabled: !c, action: () => biz.custContacts(c.code) },
    { label: '协议价格', disabled: !c, action: () => biz.showAgreement(c.code) },
    { label: '客户合并', disabled: !c, action: () => mergeDialog(c.code) },
    '-',
    { label: '导出(P)', shortcut: 'Ctrl+P', action: () => getGrid().exportCsv('客户资料') },
    { label: '刷新(R)', shortcut: 'Ctrl+R', action: () => { getGrid().refresh(); toast('已刷新'); } },
  ];

  function deleteCustomer(c) {
    if (c.code === '000000') return toast('散户为系统默认客户，不能删除');
    if (D.workOrders.some((w) => w.custCode === c.code) || D.settlements.some((s) => s.custCode === c.code))
      return toast('该客户已有业务单据，不能删除；可使用「客户合并」');
    ERP.ui.confirm(`确定删除客户「${c.code}/${c.name}」？`, () => {
      D.customers.splice(D.customers.indexOf(c), 1);
      D.contacts = D.contacts.filter((x) => x.custCode !== c.code);
      D.agreementPrices = D.agreementPrices.filter((x) => x.custCode !== c.code);
      biz.notifyCustomersChanged(); toast('客户已删除');
    });
  }

  function custManagePage(el, params, full) {
    const { side, main } = split(el, { sideWidth: 250 });
    const f = { cash: true, book: true, code: '', name: '', contact: '', remark: '', group: 'all', owner: 'all', attr: 'all', keyword: params.keyword || '' };
    const fi = (k) => input({ value: f[k], oninput: (e) => (f[k] = e.target.value.trim()), onkeydown: (e) => e.key === 'Enter' && apply() });
    const groupList = () => [{ label: '[全部]', value: 'all', count: D.customers.length }]
      .concat(D.groups.map((g) => ({ label: `${g.code} - ${g.name}`, value: g.code, count: D.customers.filter((c) => c.group === g.code).length || null })));
    const owners = [...new Set(D.customers.map((c) => c.owner).filter(Boolean))];
    const sb = sidebar(side, [
      { title: '基本条件', body: h('div',
        field('结算方式', h('div.row', check('现结', true, { onchange: (e) => { f.cash = e.target.checked; apply(); } }), check('记账', true, { onchange: (e) => { f.book = e.target.checked; apply(); } })), { lw: 60 }),
        field('客户编号', fi('code'), { lw: 60 }), field('客户名称', fi('name'), { lw: 60 }),
        field('联系信息', fi('contact'), { lw: 60 }), field('说明信息', fi('remark'), { lw: 60 }),
        btn('查询(F)', () => apply(), 'block')) },
      { key: 'group', title: '客户分组', list: groupList(), value: 'all', onSelect: (v) => { f.group = v; apply(); } },
      { title: '相关人员', closed: true, list: [{ label: '[全部]', value: 'all' }].concat(owners.map((o) => ({ label: o, value: o, icon: '👤' }))), value: 'all', onSelect: (v) => { f.owner = v; apply(); } },
      { title: '业务属性', closed: true, list: [{ label: '[全部]', value: 'all' }, { label: '机构客户', value: '机构' }, { label: '个人客户', value: '个人' },
        { label: '有欠款', value: 'debt', color: 'red' }, { label: '有预存余额', value: 'pre', color: 'blue' }, { label: '有待销账', value: 'wo', color: 'orange' }], value: 'all', onSelect: (v) => { f.attr = v; apply(); } },
    ]);
    // 快速查询栏传入的关键字（可清除）
    const kwBar = h('div.row');
    const renderKw = () => {
      kwBar.innerHTML = '';
      kwBar.style.display = f.keyword ? '' : 'none';
      if (f.keyword) kwBar.append(h('span.tag.red', `快速查询：${f.keyword}`), h('a', { href: 'javascript:void 0', onclick: () => { f.keyword = ''; renderKw(); apply(); } }, '清除'));
    };
    main.appendChild(kwBar);
    renderKw();
    const has = (v, k) => !k || String(v || '').includes(k);
    const apply = () => g.setRows(D.customers.filter((c) => {
      const kw = f.keyword;
      return ((f.cash && !isBook(c)) || (f.book && isBook(c))) && has(c.code, f.code) && has(c.name, f.name)
        && (!f.contact || [c.contact, c.phone, c.tel, c.qq, c.wechat, c.address, c.email].some((x) => has(x, f.contact) && x))
        && (!f.remark || has(c.remark, f.remark) || has(c.intro, f.remark))
        && (f.group === 'all' || c.group === f.group) && (f.owner === 'all' || c.owner === f.owner)
        && (f.attr === 'all' || c.type === f.attr || (f.attr === 'debt' && c.debt > 0) || (f.attr === 'pre' && c.prestoreBalance > 0) || (f.attr === 'wo' && c.writeOffPending > 0))
        && (!kw || [c.code, c.name, c.phone, c.address, c.contact, c.district].some((x) => has(x, kw) && x));
    }));
    const g = grid(main, {
      groups: full ? fullGroups() : basicGroups(), rows: [], rowColor: custColor,
      onDblClick: (c) => biz.openCustomer(c.code),
      contextMenu: (c) => biz.customerMenu(() => g, c),
    });
    apply();
    el.addEventListener('erp:customers-changed', () => { sb.group.setList(groupList()); apply(); });
  }
  ERP.page('custManage', { title: '客户资料管理（基础）', render: (el, p) => custManagePage(el, p, false) });
  ERP.page('custManageFull', { title: '客户资料管理（全面）', render: (el, p) => custManagePage(el, p, true) });

  /* ==================== 客户资料窗口（新建 / 查看 / 修改） ==================== */
  ERP.page('newOrgCustomer', { title: '新建机构客户', kind: 'dialog', render: () => biz.openCustomer(null, { type: '机构' }) });
  ERP.page('newPersonCustomer', { title: '新建个人客户', kind: 'dialog', render: () => biz.openCustomer(null, { type: '个人' }) });
  ERP.page('customerDetail', { title: '客户资料', kind: 'dialog', render: (_, p) => biz.openCustomer(p.code, { tab: +p.tab || 0 }) });

  const blankCustomer = (type) => ensure({
    code: '', name: '', group: '10', groupName: D.groupName('10'), type, contact: '', phone: '', tel: '', address: '', city: '北京', owner: D.currentUser.name,
    value: '未评估', debt: 0, writeOffPending: 0, prestoreBalance: 0, created: new Date(), lastAudit: null, remark: '', invoiceTitle: '', taxNo: '', bank: '',
    creditLimit: 0, settleType: '现结', district: '北京>中关村', source: '门店接待', industry: type === '个人' ? '个人' : '未知', short: '', qq: '', email: '',
  });

  biz.openCustomer = function (code, { type = '机构', tab = 0 } = {}) {
    const src = code ? D.customer(code) : null;
    if (code && !src) return toast('未找到客户 ' + code);
    const c = src ? Object.assign({}, ensure(src)) : blankCustomer(type);
    const org = c.type === '机构';
    const dlg = dialog({
      title: `客户资料-[${src ? `${c.code}/${c.name}` : '新建'}]`, width: 1200, height: 800, flush: true, buttons: null,
      body: (b) => {
        const reopen = (cc, t) => { dlg.close(); biz.openCustomer(cc, { type: c.type, tab: t }); };
        b.appendChild(toolbar([
          { title: '编辑', items: [['新建', CL.gray, () => reopen(null)], ['撤销', CL.gray, () => reopen(src && src.code), !src], ['刷新', CL.sky, () => reopen(src && src.code), !src],
            ['删除', CL.sky, () => { if (src) { dlg.close(); deleteCustomer(src); } }, !src]] },
          { title: '更多', items: [['控制信息', CL.gray, () => controlInfo(c)], org ? ['联络人员', CL.sky, () => (src ? biz.custContacts(src.code) : toast('请先保存客户资料'))] : null,
            ['协议价格', CL.sky, () => (src ? (dlg.close(), biz.showAgreement(src.code)) : toast('请先保存客户资料'))],
            ['价值分析', CL.gray, () => (src ? biz.custSummary(src.code) : toast('请先保存客户资料'))],
            ['对账分析', CL.gray, () => ERP.open('custStatement', { code: c.code })],
            ['自助绑定', CL.gray, () => toast('请客户微信扫码绑定，绑定后可自助下单 / 查询（原型）')]] },
          { title: '关键', items: [['保存', CL.gold, () => save()], ['打印', CL.gray, () => toast('打印客户资料（原型）')]] },
          { title: '其…', items: [['帮助', CL.sky, () => toast('客户编号保存时自动生成；分组决定默认价格与折扣')]] },
        ]));
        const formPane = (p) => {
          const left = h('div',
            fs('基本信息',
              h('div.formgrid.c3',
                field('客户编号', input({ value: c.code, readOnly: true, placeholder: '保存时自动生成' }), { lw: 60 }),
                field('客户名称', bi(c, 'name', { autofocus: true }), { lw: 60 }),
                field('简称', bi(c, 'short'), { lw: 40 }),
                field('客户分组', bs(c, 'group', groupOpts()), { lw: 60 }),
                field('联系代表', bi(c, 'contact'), { lw: 60 }),
                field('联系电话', bi(c, 'phone'), { lw: 60 })),
              field('常用地址', bt(c, 'address', 2), { lw: 60 }),
              h('div.formgrid.c3', field('取送距离', bi(c, 'distance', { type: 'number', step: '0.01', style: { textAlign: 'right' } }), { lw: 60 }))),
            fs('更多信息',
              h('div.formgrid.c3',
                field('城市商圈', bs(c, 'district', [...new Set([c.district, ...D.customers.map((x) => x.district)])]), { lw: 60 }),
                field('QQ号码', bi(c, 'qq'), { lw: 60 }), field('传真号码', bi(c, 'fax'), { lw: 60 }),
                field('电子邮件', bi(c, 'email'), { lw: 60, class: 'span2' }), field('邮政编码', bi(c, 'zip'), { lw: 60 }),
                field('其它方式', bi(c, 'other'), { lw: 60, class: 'span2' }), field('微信号码', bi(c, 'wechat'), { lw: 60 }),
                field('网站地址', bi(c, 'website'), { lw: 60, class: 'span-all' })),
              field('说明简介', bt(c, 'intro', 6), { lw: 60 }),
              field('说明备注', bi(c, 'remark'), { lw: 60 })));
          const right = h('div',
            fs('特征属性', h('div.formgrid.c2',
              field('建交日期', input({ type: 'date', value: F.date(c.created), onchange: (e) => (c.created = new Date(e.target.value)) }), { lw: 60 }),
              field('价值评估', bs(c, 'value', OPT.level), { lw: 60 }),
              field('关系等级', bs(c, 'relation', OPT.level), { lw: 60 }),
              field('信誉等级', bs(c, 'credit', OPT.level), { lw: 60 }),
              field('客户来源', bs(c, 'source', OPT.source), { lw: 60 }),
              field('所属行业', bs(c, 'industry', OPT.industry), { lw: 60 }),
              field('无委托提醒', bi(c, 'noOrderRemind', { type: 'number', style: { textAlign: 'right' }, title: '超过该天数无委托时在业务提醒中提示，0 为不提醒' }), { lw: 70 }))),
            org ? fs('机构信息', field('机构类型', bs(c, 'orgType', OPT.orgType), { lw: 60 }), field('人员规模', bs(c, 'scale', OPT.scale), { lw: 60 }))
              : fs('个人信息', field('所在单位', bi(c, 'company'), { lw: 60 }), field('个人爱好', bi(c, 'hobby'), { lw: 60 })),
            src ? fs('账务概况', h('div.kv', h('b', '欠款'), h('span.c-red', F.money(src.debt)), h('b', '预存余额'), h('span.c-blue', F.money(src.prestoreBalance)),
              h('b', '结算方式'), src.settleType, h('b', '负责人员'), src.owner || '-')) : null);
          p.appendChild(h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 400px', gap: '12px', alignItems: 'start' } }, left, right));
        };
        const body = h('div.dlg-body');
        b.appendChild(body);
        if (src) itabs(body, [{ title: '客户资料', render: formPane }, { title: '客户综合信息', render: (p) => renderSummary(p, src.code) }], { active: tab });
        else formPane(body);
        b.appendChild(statusFoot(src ? `查看中… 建交：${F.date(src.created)}` : '新建中…',
          btn('✔ 保存(S)', () => save(), 'primary'), btn('✕ 关闭(C)', () => dlg.close())));
      },
    });
    function save() {
      c.name = (c.name || '').trim();
      if (!c.name) return toast('请填写客户名称');
      if (D.customers.some((x) => x.name === c.name && x !== src)) return toast('已存在同名客户：' + c.name);
      c.groupName = D.groupName(c.group);
      c.city = (c.district || '').split('>')[0] || c.city;
      if (src) {
        Object.assign(src, c);
        D.workOrders.filter((w) => w.custCode === src.code).forEach((w) => { w.custName = src.name; w.group = src.groupName; });
        toast('客户资料已保存');
      } else {
        c.code = nextCode(); c.invoiceTitle = c.invoiceTitle || c.name;
        D.customers.push(c);
        toast(`已新建${c.type}客户：${c.code}/${c.name}`);
      }
      biz.notifyCustomersChanged();
      dlg.close();
      biz.openCustomer(c.code);
    }
  };

  /* 控制信息（结算方式、信用额度、开票信息） */
  function controlInfo(c) {
    const t = Object.assign({}, c);
    dialog({
      title: '控制信息', width: 560, banner: '设置客户的结算控制与开票信息',
      body: h('div',
        h('div.formgrid.c2', field('结算方式', bs(t, 'settleType', OPT.settle), { lw: 60 }), field('信用额度', bi(t, 'creditLimit', { type: 'number', style: { textAlign: 'right' } }), { lw: 60 }),
          field('负责人员', bs(t, 'owner', empOpts()), { lw: 60 })),
        fs('开票信息', field('开票抬头', bi(t, 'invoiceTitle'), { lw: 60 }), field('税号', bi(t, 'taxNo'), { lw: 60 }), field('开户银行', bi(t, 'bank'), { lw: 60 })),
        h('div.note', '「记账」「月结」客户可在工单结算时选择记账，欠款超出信用额度（0 为不限）时开单提示。')),
      buttons: [{ label: '✔ 确定(S)', primary: true, action: (close) => { Object.assign(c, t); close(); toast('已更新，保存客户资料后生效'); } }, { label: '✕ 关闭(C)' }],
    });
  }

  /* ---------- 客户综合信息：余额、最近工单、结算、联络人员、协议价格 ---------- */
  function renderSummary(p, code) {
    const c = D.customer(code);
    if (!c) return;
    const orders = D.workOrders.filter((w) => w.custCode === code);
    const sts = D.settlements.filter((s) => s.custCode === code);
    const sum = (a, k) => a.reduce((s, x) => s + (Number(x[k]) || 0), 0);
    const card = (k, v, cls) => h('div.card', h('div.k', k), h('div.v' + (cls ? '.' + cls : ''), v));
    p.append(
      h('div.row', { style: { alignItems: 'baseline' } }, h('b', { style: { fontSize: '16px' } }, `${c.code} / ${c.name}`), h('span.tag', c.type), h('span.tag.orange', c.groupName),
        h('span.muted', `代表：${c.contact || '-'}　电话：${c.phone || '-'}　地址：${c.address || '-'}`)),
      h('div.cards',
        card('欠款', F.money(c.debt), 'c-red'), card('预存余额', F.money(c.prestoreBalance), 'c-blue'), card('结余（预存-欠款）', F.money(c.prestoreBalance - c.debt), c.prestoreBalance - c.debt < 0 ? 'c-red' : 'c-green'),
        card('待销账', F.money(c.writeOffPending)), card(`工单数 / 实收`, `${orders.length} / ${F.money(sum(orders, 'amount'))}`), card('未结金额', F.money(sum(orders, 'unpaid')), 'c-orange'),
        card('累计结算', F.money(sum(sts, 'amount')), 'c-green')));
    const box = h('div.fill');
    p.appendChild(box);
    itabs(box, [
      { title: `最近工单(${orders.length})`, render: (q) => grid(q, {
        columns: [{ key: 'no', title: '工单编号', width: 130 }, { key: 'created', title: '委托时间', type: 'datetime' }, { key: 'task', title: '制作任务', width: 120 }, { key: 'req', title: '制作要求', width: 160 },
          { key: 'amount', title: '实收', type: 'money', sum: true }, { key: 'paid', title: '已结', type: 'money', sum: true }, { key: 'unpaid', title: '未结', type: 'money', sum: true },
          { key: 'settleStatus', title: '结算状态', width: 80 }, { key: 'flow', title: '生产流程', width: 70, align: 'center' }],
        rows: orders, rowColor: (w) => D.flowColor(w.flow), onDblClick: (w) => biz.openOrder && biz.openOrder(w.no) }) },
      { title: `结算记录(${sts.length})`, render: (q) => grid(q, {
        columns: [{ key: 'no', title: '结算单号', width: 130 }, { key: 'date', title: '日期', type: 'datetime' }, { key: 'method', title: '方式', width: 70 }, { key: 'amount', title: '金额', type: 'money', sum: true },
          { key: 'wipe', title: '抹零', type: 'money', sum: true, hideZero: true }, { key: 'orderNo', title: '工单', width: 130 }, { key: 'handler', title: '经手', width: 70 }, { key: 'audited', title: '审核', type: 'check' }],
        rows: sts }) },
      { title: '联络人员', render: (q) => contactsGrid(q, D.contacts.filter((x) => x.custCode === code), { height: null }) },
      { title: '协议价格', render: (q) => grid(q, {
        columns: [{ key: 'itemCode', title: '项目编号', width: 90 }, { key: 'itemName', title: '经营子项', width: 240 }, { key: 'unit', title: '单位', width: 50 },
          { key: 'listPrice', title: '标准单价', type: 'money4' }, { key: 'price', title: '协议价格', type: 'money4' }, { key: 'start', title: '开始日期', type: 'date' }, { key: 'remark', title: '说明备注', width: 140 }],
        rows: D.agreementPrices.filter((a) => a.custCode === code).map((a) => Object.assign({ itemName: itemOf(a.itemCode).name, unit: itemOf(a.itemCode).unit, listPrice: itemOf(a.itemCode).price }, a)), footer: false }) },
      { title: '预存卡', render: (q) => grid(q, {
        columns: [{ key: 'cardNo', title: '卡号', width: 100 }, { key: 'group', title: '卡类型', width: 160 }, { key: 'issueDate', title: '发卡日期', type: 'date' }, { key: 'totalIn', title: '累计储值', type: 'money', sum: true },
          { key: 'totalOut', title: '累计消费', type: 'money', sum: true }, { key: 'balance', title: '余额', type: 'money', sum: true }, { key: 'status', title: '状态', width: 60 }],
        rows: (D.cards || []).filter((k) => k.custCode === code) }) },
    ]);
  }
  biz.custSummary = function (code) {
    const c = D.customer(code);
    if (!c) return toast('未找到客户 ' + code);
    dialog({ title: `客户综合信息 - ${c.code}/${c.name}`, width: 1100, height: 700, body: (b) => renderSummary(b, code),
      leftButtons: [{ label: '客户资料(K)', action: (close) => { close(); biz.openCustomer(code); } }, { label: '协议价格', action: (close) => { close(); biz.showAgreement(code); } }],
      buttons: [{ label: '✕ 关闭(C)' }] });
  };

  /* ==================== 联络人员管理 ==================== */
  const contactColumns = () => [
    { title: '基本信息', columns: [
      { key: 'custName', title: '所属客户', width: 220, render: (x) => custOf(x.custCode).name },
      { key: 'type', title: '类型', width: 80 },
      { key: 'dept', title: '部门', width: 90 },
      { key: 'title', title: '职务', width: 90 },
      { key: 'name', title: '姓名', width: 80 },
      { key: 'call', title: '称呼', width: 80 },
    ] },
    { title: '联系信息', columns: [{ key: 'mobile', title: '手机', width: 120 }, { key: 'tel', title: '电话', width: 120 }] },
    { title: '沟通信息', columns: [{ key: 'owner', title: '负责人员', width: 80 }] },
    { title: '云端网络', columns: [{ key: 'cloud', title: '云端账号', width: 120 }] },
    { title: '其他信息', columns: [{ key: 'gender', title: '性别', width: 50, align: 'center' }, { key: 'idCard', title: 'ID卡序号', width: 160 }, { key: 'remark', title: '说明备注', width: 160 }] },
  ];
  const contactColor = (x) => ({ 决策人: 'red', 财务: 'green', 设计师: 'blue', 采购: 'orange' })[x.type];
  function contactsGrid(container, rows, { onChanged, height } = {}) {
    const g = grid(container, {
      groups: contactColumns(), rows, rowColor: contactColor, height,
      onDblClick: (x) => biz.openContact(x, null, onChanged || (() => g.refresh())),
      contextMenu: (x) => contactMenu(() => g, x, onChanged || (() => g.refresh())),
    });
    return g;
  }
  // 右键：查看(K) / 查看客户综合信息 / 新建(N) / 人员类型 / 导出(P) / 刷新(R) / 表格
  function contactMenu(getGrid, x, changed, presetCust) {
    return [
      { label: '查看(K)', disabled: !x, action: () => biz.openContact(x, null, changed) },
      { label: '查看客户综合信息', disabled: !x, action: () => biz.custSummary(x.custCode) },
      '-',
      { label: '新建(N)', shortcut: 'Ctrl+N', action: () => biz.openContact(null, presetCust || (x && x.custCode), changed) },
      '-',
      { label: '人员类型', disabled: !x, action: () => setContactType(x, changed) },
      '-',
      { label: '导出(P)', shortcut: 'Ctrl+P', action: () => getGrid().exportCsv('联络人员') },
      { label: '刷新(R)', shortcut: 'Ctrl+R', action: () => { changed(); toast('已刷新'); } },
      '-',
      { label: '表格 ▸', action: () => ERP.ui.contextMenu(innerWidth / 2, innerHeight / 3, [
        { label: '自动列宽', action: () => toast('已调整列宽（原型）') }, { label: '显示合计行', action: () => toast('表格设置（原型）') },
        { label: '恢复默认布局', action: () => toast('已恢复默认表格布局') }]) },
    ];
  }
  function setContactType(x, changed) {
    let v = x.type;
    dialog({ title: '人员类型', width: 320,
      body: h('div.col', OPT.contactType.map((t) => h('label.chk', h('input', { type: 'radio', name: 'ctype', checked: t === v, onchange: () => (v = t) }), t))),
      buttons: [{ label: '✔ 确定(S)', primary: true, action: (close) => { x.type = v; close(); changed(); toast(`已设置为「${v}」`); } }, { label: '✕ 关闭(C)' }] });
  }

  /* 联络人员窗口（新建 / 查看） */
  biz.openContact = function (x, custCode, changed) {
    const src = x;
    const t = src ? Object.assign({}, src) : { id: 0, custCode: custCode || '', type: '未评估', dept: '', title: '', name: '', call: '', gender: '男', ageBand: '', mobile: '', tel: '',
      email: '', qq: '', address: '', idCard: '', owner: '', cloud: '', created: new Date(), intro: '', remark: '' };
    const dlg = dialog({
      title: `联络人员-[${src ? src.name : '新建'}]`, width: 1080, height: 700, flush: true, buttons: null,
      body: (b) => {
        b.appendChild(toolbar([
          { title: '编辑', items: [['新建', CL.gray, () => { dlg.close(); biz.openContact(null, t.custCode, changed); }], ['撤销', CL.gray, () => { dlg.close(); biz.openContact(src, custCode, changed); }, !src],
            ['刷新', CL.gray, () => { dlg.close(); biz.openContact(src, custCode, changed); }, !src],
            ['删除', CL.sky, () => ERP.ui.confirm(`确定删除联络人员「${src.name}」？`, () => { D.contacts.splice(D.contacts.indexOf(src), 1); dlg.close(); changed && changed(); toast('已删除'); }), !src]] },
          { title: '更多', items: [['自助绑定', CL.gray, () => toast('请联络人员微信扫码绑定云端账号（原型）')]] },
          { title: '关键', items: [['保存', CL.gold, () => save()], ['打印', CL.gray, () => toast('打印（原型）')]] },
          { title: '其…', items: [['帮助', CL.sky, () => toast('所属客户必填；手机号用于云端自助下单登录')]] },
        ]));
        const cb = custBox(t.custCode, (v) => (t.custCode = v));
        const body = h('div.dlg-body');
        body.appendChild(h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 300px', gap: '12px', alignItems: 'start' } },
          h('div',
            fs('基本信息', field('所属客户', cb.el, { lw: 60 }),
              h('div', { style: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '6px 14px' } },
                field('人员姓名', bi(t, 'name'), { lw: 60 }), field('性别', bs(t, 'gender', OPT.gender), { lw: 30 }), field('年龄段', bs(t, 'ageBand', OPT.ageBand), { lw: 44 }))),
            fs('联系信息',
              h('div.formgrid.c2', field('移动电话', bi(t, 'mobile'), { lw: 60 }), field('电子邮件', bi(t, 'email'), { lw: 60 }),
                field('固定电话', bi(t, 'tel'), { lw: 60 }), field('QQ号码', bi(t, 'qq'), { lw: 60 })),
              field('人员地址', bi(t, 'address'), { lw: 60 }), field('ID卡序号', bi(t, 'idCard', { placeholder: '刷卡读取或手工输入' }), { lw: 60 }))),
          fs('工作信息',
            field('负责人员', bs(t, 'owner', empOpts()), { lw: 60 }), field('人员类型', bs(t, 'type', OPT.contactType), { lw: 60 }),
            field('所属部门', bi(t, 'dept'), { lw: 60 }), field('职位职务', bi(t, 'title'), { lw: 60 }), field('称谓称呼', bi(t, 'call'), { lw: 60 }),
            field('建交日期', input({ type: 'date', value: F.date(t.created), onchange: (e) => (t.created = new Date(e.target.value)) }), { lw: 60 }))),
        fs('说明信息', field('人员简介', bt(t, 'intro', 8), { lw: 60 }), field('说明备注', bi(t, 'remark'), { lw: 60 })));
        b.appendChild(body);
        b.appendChild(statusFoot(src ? '查看中…' : '新建中…', btn('✔ 保存(S)', () => save(), 'primary'), btn('✕ 关闭(C)', () => dlg.close())));
      },
    });
    function save() {
      if (!t.custCode) return toast('请选择所属客户');
      if (!t.name.trim()) return toast('请填写人员姓名');
      if (src) Object.assign(src, t);
      else { t.id = Math.max(0, ...D.contacts.map((c) => c.id)) + 1; D.contacts.unshift(t); }
      toast(src ? '联络人员已保存' : '已新建联络人员：' + t.name);
      dlg.close();
      changed && changed();
      biz.notifyCustomersChanged();
    }
  };

  /* 某客户的联络人员（客户资料窗口 → 联络人员） */
  biz.custContacts = function (code) {
    const c = D.customer(code);
    let g;
    const rows = () => D.contacts.filter((x) => x.custCode === code);
    const changed = () => g.setRows(rows());
    dialog({ title: `联络人员 - ${c.code}/${c.name}`, width: 1000, height: 480,
      body: (b) => {
        g = grid(b, { groups: contactColumns(), rows: rows(), rowColor: contactColor, onDblClick: (x) => biz.openContact(x, null, changed), contextMenu: (x) => contactMenu(() => g, x, changed, code) });
      },
      leftButtons: [{ label: '＋ 新建(N)', action: () => { biz.openContact(null, code, changed); return false; } }],
      buttons: [{ label: '✕ 关闭(C)' }] });
  };

  ERP.page('contacts', {
    title: '联络人员管理',
    render(el) {
      const { side, main } = split(el, { sideWidth: 250 });
      const f = { surname: 'all', owner: '', name: '', mobile: '', hasMobile: true, noMobile: true, tel: '', email: '', hasEmail: true, noEmail: true, remark: '', type: 'all', group: 'all', cust: '' };
      const has = (v, k) => !k || String(v || '').includes(k);
      const apply = () => g.setRows(D.contacts.filter((x) => {
        const c = custOf(x.custCode);
        return (f.surname === 'all' || x.name[0] === f.surname) && (!f.owner || x.owner === f.owner) && has(x.name, f.name) && has(x.mobile, f.mobile)
          && ((f.hasMobile && x.mobile) || (f.noMobile && !x.mobile)) && has(x.tel, f.tel) && has(x.email, f.email)
          && ((f.hasEmail && x.email) || (f.noEmail && !x.email)) && (has(x.remark, f.remark) || has(x.intro, f.remark))
          && (f.type === 'all' || x.type === f.type) && (f.group === 'all' || c.group === f.group) && (!f.cust || x.custCode === f.cust);
      }));
      const fi = (k) => input({ oninput: (e) => (f[k] = e.target.value.trim()), onkeydown: (e) => e.key === 'Enter' && apply() });
      const ck = (label, k) => check(label, f[k], { onchange: (e) => { f[k] = e.target.checked; apply(); } });
      const surnameList = () => {
        const cnt = {};
        D.contacts.forEach((x) => (cnt[x.name[0]] = (cnt[x.name[0]] || 0) + 1));
        return [{ label: '[全部]', value: 'all', count: D.contacts.length }].concat(Object.keys(cnt).sort((a, b) => a.localeCompare(b, 'zh')).map((s) => ({ label: s, value: s, count: cnt[s] })));
      };
      let sbS, sbC;
      itabs(side, [
        { title: '百家姓', render: (p) => { sbS = sidebar(p, [{ key: 's', title: '百家姓', list: surnameList(), value: 'all', onSelect: (v) => { f.surname = v; apply(); } }]); } },
        { title: '组合条件', render: (p) => {
          const custSel = custBox('', (v) => { f.cust = v; apply(); });
          sbC = sidebar(p, [
            { title: '基本条件', body: h('div',
              field('负责', select(empOpts(), { onchange: (e) => { f.owner = e.target.value; apply(); } }), { lw: 30 }),
              field('姓名', fi('name'), { lw: 30 }), field('手机', fi('mobile'), { lw: 30 }),
              field('', h('div.row', ck('有手机号', 'hasMobile'), ck('无', 'noMobile')), { lw: 30 }),
              field('电话', fi('tel'), { lw: 30 }), field('邮箱', fi('email'), { lw: 30 }),
              field('', h('div.row', ck('有邮箱地址', 'hasEmail'), ck('无', 'noEmail')), { lw: 30 }),
              field('说明', fi('remark'), { lw: 30 }),
              btn('查询(F)', () => apply(), 'block')) },
            { key: 'type', title: '人员类型', closed: true, list: [{ label: '[全部]', value: 'all' }].concat(OPT.contactType.map((t) => ({ label: t, value: t, color: contactColor({ type: t }) }))), value: 'all', onSelect: (v) => { f.type = v; apply(); } },
            { title: '客户分组', closed: true, list: [{ label: '[全部]', value: 'all' }].concat(D.groups.map((x) => ({ label: `${x.code} - ${x.name}`, value: x.code }))), value: 'all', onSelect: (v) => { f.group = v; apply(); } },
            { title: '所属客户', closed: true, body: custSel.el },
          ]);
        } },
      ], { active: 1 });
      const changed = () => { if (sbS) sbS.s.setList(surnameList()); apply(); };
      const g = grid(main, {
        groups: contactColumns(), rows: [], rowColor: contactColor,
        onDblClick: (x) => biz.openContact(x, null, changed),
        contextMenu: (x) => contactMenu(() => g, x, changed),
      });
      apply();
      el.addEventListener('erp:customers-changed', () => changed());
    },
  });

  /* ==================== 分组价格管理（客户分组的统一协议价格） ==================== */
  ERP.page('groupPrice', {
    title: '分组价格管理',
    render(el, params, ctx) {
      const { side, main } = split(el, { sideWidth: 240 });
      let cat = 'all', grp = 'all', kw = '', g;
      sidebar(side, [
        { title: '客户分组', list: [{ label: '[全部分组]', value: 'all' }].concat(D.groups.map((x) => ({ label: `${x.code}-${x.name}`, value: x.code,
          count: Object.keys(D.groupPrices[x.code] || {}).length || null }))), value: 'all', onSelect: (v) => { grp = v; build(); } },
        { title: '经营主项', list: [{ label: '[全部]', value: 'all' }].concat(D.itemCategories.map((c) => ({ label: `${c.code}-${c.name}`, value: c.code }))), value: 'all', onSelect: (v) => { cat = v; build(); } },
      ]);
      const kwIn = input({ placeholder: '项目编号 / 名称过滤', style: { width: '200px' }, oninput: (e) => { kw = e.target.value.trim(); build(); } });
      const info = h('span.muted');
      main.append(
        h('div.dlg-banner', '定义客户分组的统一协议价格：分组价格优先于标准单价，客户协议价格优先于分组价格；留空表示按分组折扣计算'),
        h('div.row', kwIn, btn('按分组折扣生成', () => genByDiscount(), 'sm'), btn('清除分组价格', () => clearGroup(), 'sm'), info));
      const box = h('div.fill');
      main.appendChild(box);
      main.appendChild(h('div.row', btn('导出(P)', () => g.exportCsv('分组价格'), 'sm'), h('span.grow'),
        btn('✔ 确定[S]', () => toast('分组价格已保存'), 'primary'), btn('✕ 关闭(C)', () => ctx.close())));
      const gs = () => (grp === 'all' ? D.groups : D.groups.filter((x) => x.code === grp));
      function build() {
        const rows = D.items.filter((i) => (cat === 'all' || i.cat === cat) && (!kw || i.code.includes(kw) || i.name.includes(kw))).map((i) => {
          const r = { code: i.code, catName: D.itemCatName(i.cat), name: i.name, unit: i.unit, tier: i.tier, price: i.price };
          gs().forEach((x) => {
            // 可编辑单元格直接显示原值，这里预先格式化为字符串（修改后 grid 会写回数字）
            const gp = D.groupPrices[x.code][i.code];
            r['g' + x.code] = gp != null ? F.money4(gp) : null;
            r['d' + x.code] = gp != null && i.price ? F.money(r2((gp / i.price) * 100)) : null;
          });
          return r;
        });
        const setP = (code, gc, v) => { if (v == null || v === '' || isNaN(v)) delete D.groupPrices[gc][code]; else D.groupPrices[gc][code] = v; };
        const priceCols = grp === 'all'
          ? gs().map((x) => ({ key: 'g' + x.code, title: `${x.code}-${x.name}`, type: 'money4', width: 150, editable: true, onChange: (r) => setP(r.code, x.code, r['g' + x.code]) }))
          : [{ key: 'g' + grp, title: '分组价格', type: 'money4', width: 120, editable: true, onChange: (r) => { setP(r.code, grp, r['g' + grp]); r['d' + grp] = r.price ? F.money(r2((r['g' + grp] / r.price) * 100)) : null; g.refresh(); } },
            { key: 'd' + grp, title: '折扣(%)', type: 'money', width: 90, editable: true, onChange: (r) => { const v = r2((r.price * r['d' + grp]) / 100); setP(r.code, grp, v); r['g' + grp] = F.money4(v); g.refresh(); } },
            { key: 'diff', title: '优惠', type: 'money4', render: (r) => (r['g' + grp] != null ? F.money4(r.price - r['g' + grp]) : '') }];
        box.innerHTML = '';
        g = grid(box, {
          groups: [
            { title: '经营项目', columns: [{ key: 'code', title: '项目编号', width: 90 }, { key: 'catName', title: '经营主项', width: 110 }, { key: 'name', title: '经营子项', width: 220 },
              { key: 'unit', title: '单位', width: 50 }, { key: 'tier', title: '定价量级', width: 76 }, { key: 'price', title: '标准单价', type: 'money4' }] },
            { title: grp === 'all' ? '分组价格' : `分组价格：${grp}-${D.groupName(grp)}（默认折扣 ${F.pct(D.groups.find((x) => x.code === grp).discount)}）`, columns: priceCols },
          ],
          rows, footer: false,
          contextMenu: (r) => [
            { label: '清除该行分组价格', disabled: !r, action: () => { gs().forEach((x) => delete D.groupPrices[x.code][r.code]); build(); } },
            '-', { label: '导出(P)', shortcut: 'Ctrl+P', action: () => g.exportCsv('分组价格') }, { label: '刷新(R)', shortcut: 'Ctrl+R', action: () => build() },
          ],
        });
        info.textContent = `共 ${rows.length} 个项目；双击单元格直接修改价格`;
      }
      function genByDiscount() {
        const list = gs().filter((x) => x.discount < 1);
        if (!list.length) return toast('所选分组没有设置折扣（折扣 = 100%）');
        ERP.ui.confirm(`按分组折扣为 ${list.map((x) => x.name).join('、')} 生成当前列表项目的分组价格？已有价格将被覆盖。`, () => {
          const items = D.items.filter((i) => (cat === 'all' || i.cat === cat));
          list.forEach((x) => items.forEach((i) => (D.groupPrices[x.code][i.code] = r2(i.price * x.discount))));
          build(); toast(`已生成 ${items.length * list.length} 条分组价格`);
        });
      }
      function clearGroup() {
        ERP.ui.confirm(`清除${grp === 'all' ? '全部分组' : '分组「' + D.groupName(grp) + '」'}在当前主项下的分组价格？`, () => {
          gs().forEach((x) => D.items.filter((i) => cat === 'all' || i.cat === cat).forEach((i) => delete D.groupPrices[x.code][i.code]));
          build(); toast('已清除');
        });
      }
      build();
    },
  });

  /* ==================== 协议价格管理 ==================== */
  biz.showAgreement = function (code) {
    ERP.open('agreementPrice', { code });
    document.querySelectorAll('.docpage').forEach((p) => p.dispatchEvent(new CustomEvent('erp:agreement-cust', { detail: code })));
  };
  const agreeRow = (a) => {
    const c = custOf(a.custCode), it = itemOf(a.itemCode);
    return { _ref: a, custCode: a.custCode, custName: c.name, groupName: c.groupName, itemCode: a.itemCode, catName: D.itemCatName(it.cat), itemName: it.name,
      unit: it.unit, tier: it.tier, price: F.money4(a.price), listPrice: it.price, start: a.start, owner: a.owner, remark: a.remark };
  };
  ERP.page('agreementPrice', {
    title: '协议价格管理',
    render(el, params) {
      const { side, main } = split(el, { sideWidth: 260 });
      const f = { item: '', owner: '', remark: '', cat: '', sub: '' };
      const fi = (k) => input({ oninput: (e) => (f[k] = e.target.value.trim()), onkeydown: (e) => e.key === 'Enter' && apply() });
      const cb = custBox(params.code || '', () => apply());
      sidebar(side, [{ title: '基本条件', body: h('div',
        field('项目编号', fi('item'), { lw: 60 }), field('协议客户', cb.el, { lw: 60 }),
        field('负责人员', select(empOpts(), { onchange: (e) => { f.owner = e.target.value; apply(); } }), { lw: 60 }),
        field('说明备注', fi('remark'), { lw: 60 }), field('经营主项', fi('cat'), { lw: 60 }), field('经营子项', fi('sub'), { lw: 60 }),
        h('div', { style: { height: '10px' } }), btn('查询(F)', () => apply(), 'block')) },
      { title: '协议客户', closed: true, list: [...new Set(D.agreementPrices.map((a) => a.custCode))].map((cc) => ({ label: `${cc}/${custOf(cc).name}`, value: cc,
        count: D.agreementPrices.filter((a) => a.custCode === cc).length })), onSelect: (v) => cb.set(v) }]);
      const has = (v, k) => !k || String(v || '').includes(k);
      const apply = () => g.setRows(D.agreementPrices.filter((a) => !cb.value || a.custCode === cb.value).map(agreeRow)
        .filter((r) => has(r.itemCode, f.item) && (!f.owner || r.owner === f.owner) && has(r.remark, f.remark) && has(r.catName, f.cat) && has(r.itemName, f.sub)));
      const changed = () => apply();
      main.appendChild(h('div.row', btn('＋ 新建(N)', () => agreementDialog(null, cb.value, changed), 'sm primary'), btn('价格复制', () => priceCopyDialog(cb.value), 'sm'),
        h('span.muted', '协议价格：客户专属单价，开单时优先使用；双击「协议价格」单元格可直接修改')));
      const g = grid(main, {
        groups: [
          { title: '客户', columns: [{ key: 'custCode', title: '客户编号', width: 80 }, { key: 'custName', title: '客户名称', width: 220 }, { key: 'groupName', title: '客户分组', width: 120 }] },
          { title: '项目', columns: [{ key: 'itemCode', title: '项目编号', width: 90 }, { key: 'catName', title: '经营主项', width: 110 }, { key: 'itemName', title: '经营子项', width: 200 },
            { key: 'unit', title: '子项单位', width: 76 }, { key: 'tier', title: '定价量级', width: 76 }] },
          { title: '价格', columns: [{ key: 'price', title: '协议价格', type: 'money4', editable: true, onChange: (r) => { r._ref.price = r.price; toast(`协议价格已修改为 ${F.money4(r.price)}`); } },
            { key: 'listPrice', title: '销售单价', type: 'money4' }] },
          { title: '管控', columns: [{ key: 'start', title: '开始日期', type: 'date' }] },
          { title: '其他', columns: [{ key: 'remark', title: '说明备注', width: 180 }] },
        ],
        rows: [], footer: false, rowColor: (r) => (Number(r.price) < r.listPrice ? null : 'red'),
        onDblClick: (r) => agreementDialog(r._ref, null, changed),
        contextMenu: (r) => [
          { label: '查看(K)', shortcut: 'Ctrl+K', disabled: !r, action: () => agreementDialog(r._ref, null, changed) },
          { label: '查看客户综合信息', disabled: !r, action: () => biz.custSummary(r.custCode) },
          '-',
          { label: '新建(N)', shortcut: 'Ctrl+N', action: () => agreementDialog(null, (r && r.custCode) || cb.value, changed) },
          { label: '删除(D)', disabled: !r, action: () => ERP.ui.confirm(`删除「${r.custName}」的协议价格「${r.itemName}」？`, () => { D.agreementPrices.splice(D.agreementPrices.indexOf(r._ref), 1); apply(); toast('已删除'); }) },
          '-',
          { label: '导出(P)', shortcut: 'Ctrl+P', action: () => g.exportCsv('协议价格') },
          { label: '刷新(R)', shortcut: 'Ctrl+R', action: () => { apply(); toast('已刷新'); } },
        ],
      });
      apply();
      el.addEventListener('erp:agreement-cust', (e) => cb.set(e.detail));
      el.addEventListener('erp:customers-changed', () => apply());
    },
  });

  /* 协议价格窗口（新建 / 查看） */
  function agreementDialog(a, custCode, changed) {
    const t = a ? Object.assign({}, a) : { custCode: custCode || '', itemCode: '', price: 0, owner: '', start: new Date(), desc: '', remark: '' };
    let itemIn, tierIn, listIn, priceIn;
    const showItem = () => { const it = itemOf(t.itemCode); itemIn.value = t.itemCode ? `${t.itemCode} - ${D.itemCatName(it.cat)} > ${it.name}（${it.unit}）` : ''; tierIn.value = it.tier; listIn.value = F.money4(it.price); };
    const dlg = dialog({
      title: `协议价格-[${a ? '查看' : '新建'}]`, width: 1000, height: 640, flush: true, buttons: null,
      body: (b) => {
        b.appendChild(toolbar([
          { title: '编辑', items: [['新建', CL.gray, () => { dlg.close(); agreementDialog(null, t.custCode, changed); }], ['撤销', CL.gray, () => { dlg.close(); agreementDialog(a, custCode, changed); }, !a],
            ['刷新', CL.gray, () => { dlg.close(); agreementDialog(a, custCode, changed); }, !a],
            ['删除', CL.sky, () => ERP.ui.confirm('删除该协议价格？', () => { D.agreementPrices.splice(D.agreementPrices.indexOf(a), 1); dlg.close(); changed(); toast('已删除'); }), !a]] },
          { title: '关键', items: [['保存', CL.gold, () => save()], ['打印', CL.gray, () => toast('打印（原型）')]] },
          { title: '其…', items: [['帮助', CL.sky, () => toast('同一客户同一项目只能有一条协议价格')]] },
        ]));
        const cb = custBox(t.custCode, (v) => (t.custCode = v));
        itemIn = input({ readOnly: true }); tierIn = input({ readOnly: true }); listIn = input({ readOnly: true, style: { textAlign: 'right', width: '160px' } });
        priceIn = input({ value: F.money4(t.price), style: { textAlign: 'right', width: '160px' }, oninput: (e) => (t.price = Number(e.target.value) || 0) });
        const pickItem = () => biz.itemPicker((it) => { t.itemCode = it.code; showItem(); if (!a) { t.price = it.price; priceIn.value = F.money4(it.price); } });
        const body = h('div.dlg-body');
        body.append(
          h('div', { style: { display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: '6px 14px' } },
            field('协议客户', cb.el, { lw: 60 }), field('负责人员', bs(t, 'owner', empOpts()), { lw: 60 }),
            field('开始日期', input({ type: 'date', value: F.date(t.start), onchange: (e) => (t.start = new Date(e.target.value)) }), { lw: 60 })),
          h('hr', { style: { border: 0, borderTop: '1px solid var(--line-2)', width: '100%' } }),
          h('div', { style: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '6px 14px' } },
            field('经营项目', h('div.row', itemIn, btn('…', pickItem, 'sm')), { lw: 60 }), field('定价量级', tierIn, { lw: 60 })),
          h('div.row', field('标准单价', listIn, { lw: 60 }), h('span.grow'), h('a', { href: 'javascript:void 0', onclick: pickItem }, '选择经营项目')),
          h('hr', { style: { border: 0, borderTop: '1px solid var(--line-2)', width: '100%' } }),
          field('协议价格', priceIn, { lw: 60 }),
          field('协议说明', bt(t, 'desc', 8), { lw: 60 }),
          field('说明备注', bi(t, 'remark'), { lw: 60 }));
        b.appendChild(body);
        b.appendChild(statusFoot(a ? '查看中…' : '新建中…', btn('✔ 保存(S)', () => save(), 'primary'), btn('✕ 关闭(C)', () => dlg.close())));
        showItem();
      },
    });
    function save() {
      if (!t.custCode) return toast('请选择协议客户');
      if (!t.itemCode) return toast('请选择经营项目');
      const dup = D.agreementPrices.find((x) => x.custCode === t.custCode && x.itemCode === t.itemCode && x !== a);
      if (dup) return toast('该客户已存在此项目的协议价格');
      if (a) Object.assign(a, t);
      else D.agreementPrices.unshift(Object.assign(t, { id: Math.max(0, ...D.agreementPrices.map((x) => x.id)) + 1 }));
      dlg.close(); changed && changed(); toast('协议价格已保存');
    }
  }

  /* ==================== 客户合并 ==================== */
  function mergeDialog(fromCode) {
    const from = custBox(fromCode || ''), to = custBox('');
    dialog({
      title: '客户资料合并', width: 680, banner: '将来源客户合并至目标客户，合并成功后，源客户将不复存在',
      body: h('div',
        field('来源客户', from.el, { lw: 60 }), field('目标客户', to.el, { lw: 60 }),
        h('ol.c-red', { style: { margin: '6px 0 0 60px', paddingLeft: '18px', lineHeight: 1.7 } },
          h('li', '合并后，来源客户的单据、关系都归目标客户所有。'), h('li', '来源客户资料的档案记录将被删除。'), h('li', '该操作不可逆转，请慎重执行。'))),
      buttons: [
        { label: '?', action: () => { toast('常用于合并重复建档的客户'); return false; } },
        { label: '✔ 确定(S)', primary: true, action: (close) => {
          const a = D.customer(from.value), b = D.customer(to.value);
          if (!a || !b) return toast('请选择来源客户和目标客户');
          if (a === b) return toast('来源客户与目标客户不能相同');
          if (a.code === '000000') return toast('散户不能作为来源客户');
          ERP.ui.confirm(`确定将「${a.code}/${a.name}」合并至「${b.code}/${b.name}」？该操作不可逆转！`, () => {
            const mv = (list) => (list || []).forEach((x) => { if (x.custCode === a.code) { x.custCode = b.code; if ('custName' in x) x.custName = b.name; } });
            [D.workOrders, D.settlements, D.cards, D.prestores, D.contacts].forEach(mv);
            D.workOrders.filter((w) => w.custCode === b.code).forEach((w) => (w.group = b.groupName));
            D.agreementPrices.filter((x) => x.custCode === a.code).forEach((x) => {
              if (D.agreementPrices.some((y) => y.custCode === b.code && y.itemCode === x.itemCode)) D.agreementPrices.splice(D.agreementPrices.indexOf(x), 1);
              else x.custCode = b.code;
            });
            b.debt = r2(b.debt + a.debt); b.prestoreBalance = r2(b.prestoreBalance + a.prestoreBalance); b.writeOffPending = r2(b.writeOffPending + a.writeOffPending);
            D.customers.splice(D.customers.indexOf(a), 1);
            close();
            biz.notifyCustomersChanged();
            if (biz.notifyOrdersChanged) biz.notifyOrdersChanged();
            toast(`合并完成：${a.name} → ${b.name}`);
          });
        } },
        { label: '✕ 关闭(C)' },
      ],
    });
  }
  ERP.page('custMerge', { title: '客户合并', kind: 'dialog', render: () => mergeDialog() });

  /* ==================== 价格复制（客户间协议价格复制） ==================== */
  function priceCopyDialog(fromCode) {
    let tab = 0, gA, gC;
    const overwrite = check('自动覆盖已经存在的协议价格', true);
    const rowsA = () => D.agreementPrices.filter((a) => a.custCode === from.value).map((a) => Object.assign(agreeRow(a), { pick: true }));
    const rowsC = () => [...new Set(rowsA().map((r) => itemOf(r.itemCode).cat))].map((cat) => ({ cat, name: `${cat}-${D.itemCatName(cat)}`, pick: true,
      count: D.agreementPrices.filter((a) => a.custCode === from.value && itemOf(a.itemCode).cat === cat).length }));
    const reload = () => { gA && gA.setRows(rowsA()); gC && gC.setRows(rowsC()); };
    const from = custBox(fromCode || '', reload), to = custBox('');
    const cur = () => (tab === 0 ? gA : gC);
    const setAll = (fn) => { const g = cur(); if (!g) return; g.rows.forEach((r) => (r.pick = fn(r.pick))); g.refresh(); };
    dialog({
      title: '客户间协议价格复制', width: 900, height: 640, banner: '设定来源和目标客户，复制指定到目标客户名下',
      body: (b) => {
        b.append(field('来源客户', from.el, { lw: 60 }), field('目标客户', to.el, { lw: 60 }));
        const box = h('div.fill', { style: { marginLeft: '66px' } });
        b.appendChild(box);
        itabs(box, [
          { title: '协议价格', render: (p) => { gA = grid(p, { columns: [{ key: 'pick', title: '复制', type: 'check', editable: true, width: 50 }, { key: 'itemCode', title: '项目编号', width: 90 },
            { key: 'catName', title: '经营主项', width: 110 }, { key: 'itemName', title: '经营子项', width: 220 }, { key: 'unit', title: '单位', width: 50 },
            { key: 'listPrice', title: '销售单价', type: 'money4' }, { key: 'price', title: '协议价格', type: 'money4' }], rows: rowsA(), footer: false, emptyText: '请先选择来源客户' }); } },
          { title: '经营主项', render: (p) => { gC = grid(p, { columns: [{ key: 'pick', title: '复制', type: 'check', editable: true, width: 50 }, { key: 'name', title: '经营主项', width: 260 },
            { key: 'count', title: '协议价格条数', type: 'int', width: 110 }], rows: rowsC(), footer: false, emptyText: '请先选择来源客户' }); } },
        ], { onChange: (i) => (tab = i) });
        b.appendChild(h('div', { style: { marginLeft: '66px' } }, overwrite));
      },
      leftButtons: [
        { label: '全选', action: () => { setAll(() => true); return false; } },
        { label: '反选', action: () => { setAll((v) => !v); return false; } },
        { label: '清除', action: () => { setAll(() => false); return false; } },
      ],
      buttons: [
        { label: '?', action: () => { toast('「协议价格」页按项目复制；「经营主项」页按主项整批复制'); return false; } },
        { label: '✔ 确定(S)', primary: true, action: (close) => {
          if (!from.value || !to.value) return toast('请选择来源客户和目标客户');
          if (from.value === to.value) return toast('来源客户与目标客户不能相同');
          const ow = overwrite.querySelector('input').checked;
          const src = tab === 0 ? gA.rows.filter((r) => r.pick).map((r) => r._ref)
            : D.agreementPrices.filter((a) => a.custCode === from.value && gC.rows.some((r) => r.pick && r.cat === itemOf(a.itemCode).cat));
          if (!src.length) return toast('请勾选要复制的价格');
          let add = 0, upd = 0, skip = 0, id = Math.max(0, ...D.agreementPrices.map((x) => x.id));
          src.forEach((a) => {
            const ex = D.agreementPrices.find((x) => x.custCode === to.value && x.itemCode === a.itemCode);
            if (ex) { if (ow) { ex.price = a.price; ex.start = new Date(); upd++; } else skip++; }
            else { D.agreementPrices.push(Object.assign({}, a, { id: ++id, custCode: to.value, start: new Date() })); add++; }
          });
          close();
          document.querySelectorAll('.docpage').forEach((p) => p.dispatchEvent(new Event('erp:customers-changed')));
          toast(`复制完成：新增 ${add} 条，覆盖 ${upd} 条` + (skip ? `，跳过 ${skip} 条` : ''));
        } },
        { label: '✕ 关闭(C)' },
      ],
    });
  }
  ERP.page('priceCopy', { title: '价格复制', kind: 'dialog', render: () => priceCopyDialog() });
})();
