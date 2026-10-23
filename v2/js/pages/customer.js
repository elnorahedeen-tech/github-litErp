/* 客户：客户资料（基础/全面列视图）、客户详情（综合信息）、新建/编辑客户（表单页）、
 * 联络人员（列表 + 表单页）、分组价格、协议价格、客户合并（表单页）、价格复制（表单页）。
 * 共享：ERP.biz.openCustomer(code)、customer(code)、priceFor(custCode, itemCode)、custBadges(c)
 * 额外模拟数据（联络人员、协议价格、分组价格）在本文件生成，挂在 ERP.data.contacts / agreementPrices / groupPrices。 */
(function () {
  'use strict';
  const { h, btn, link, linkBtn, badge, notice, kv, panel, field, input, money, dateInput, textarea, select, dialog, confirm, toast } = ERP.ui;
  const D = ERP.data, F = ERP.fmt, r2 = D.util.r2;
  const biz = (ERP.biz = ERP.biz || {});

  // 本模块自己的伪随机（不影响 data.js 的种子序列）
  let seed = 7319;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
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
  const groupOpts = () => D.groups.map((g) => [g.code, `${g.code} ${g.name}`]);
  const empOpts = () => [['', '（未指定）'], ...D.employees.map((e) => [e.name, e.name])];
  const catOpts = () => D.itemCategories.map((c) => [c.code, `${c.code} ${c.name}`]);
  // 客户下拉：编号 名称（分组）
  const custOpts = (filter) => D.customers.filter(filter || (() => true)).map((c) => [c.code, `${c.code} ${c.name}（${c.groupName || '未分组'}）`]);

  /* ---------- 客户扩展字段补全（旧系统客户资料窗口中的全部字段）。其他模块新建的客户也在读取时补全 ---------- */
  function ensure(c) {
    if (c._ext) return c;
    const k = c.code, org = c.type !== '个人';
    Object.assign(c, {
      _ext: true,
      short: c.short ?? (org && hs(k, 3) === 0 ? c.name.slice(0, 2) : ''),
      qq: c.qq ?? (hs(k + 'q', 4) === 0 ? String(10000000 + hs(k, 89999999)) : ''),
      wechat: c.wechat ?? '', fax: c.fax ?? '', email: c.email ?? (hs(k + 'm', 5) === 0 ? `info${k}@example.com` : ''),
      zip: c.zip ?? '', other: c.other ?? '', website: c.website ?? '', intro: c.intro ?? '', tel: c.tel ?? '',
      district: c.district ?? `${(c.address || '').split('市')[0] || c.city || '北京'}>${OPT.districts[hs(k, OPT.districts.length)]}`,
      distance: c.distance ?? 1, relation: c.relation ?? '未评估', credit: c.credit ?? '未评估', value: c.value ?? '未评估',
      source: c.source ?? OPT.source[hs(k + 's', OPT.source.length)], industry: c.industry ?? (org ? OPT.industry[hs(k, 9)] : '个人'),
      noOrderRemind: c.noOrderRemind ?? 0, orgType: c.orgType ?? '公司', scale: c.scale ?? '未知', company: c.company ?? '', hobby: c.hobby ?? '',
      // 新客户的账务数字确实为 0（不是未知）
      debt: c.debt ?? 0, prestoreBalance: c.prestoreBalance ?? 0, writeOffPending: c.writeOffPending ?? 0, creditLimit: c.creditLimit ?? 0,
      settleType: c.settleType ?? '现结', owner: c.owner ?? '', remark: c.remark ?? '', invoiceTitle: c.invoiceTitle ?? c.name, taxNo: c.taxNo ?? '', bank: c.bank ?? '',
      lastAudit: c.lastAudit ?? null, address: c.address ?? '', contact: c.contact ?? '', phone: c.phone ?? '',
    });
    return c;
  }
  D.customers.forEach(ensure);
  const allCustomers = () => D.customers.map(ensure);
  const isBook = (c) => c.settleType !== '现结';                   // 记账客户（记账 / 月结）
  const isPre = (c) => c.group >= '30' && c.group <= '60';          // 预存分组
  const nextCode = () => biz.nextCustCode();
  const custOf = (code) => D.customer(code) || { code, name: '（已删除客户）', groupName: '' };
  const itemOf = (code) => D.items.find((i) => i.code === code) || { code, name: '（已停用项目）', unit: '', tier: '-', price: 0, cat: '' };
  // 有任何业务记录或未结欠款的客户不能删除（只能合并）
  const hasRecords = (code) => [D.workOrders, D.settlements, D.cards, D.prestores, D.arBills, D.writeOffs].some((list) => (list || []).some((x) => x.custCode === code))
    || !!(D.customer(code) || {}).debt;
  const today = () => ERP.parseDate(F.date(new Date()));

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

  /* ---------- 额外模拟数据：协议价格（客户专属）、分组价格（分组统一） ---------- */
  if (!D.agreementPrices) {
    let id = 1;
    D.agreementPrices = [];
    ['1220', '1060', '1055', '1350', '1010', '1240', '1070'].forEach((cc) => {
      D.items.filter(() => rnd() > 0.82).slice(0, 8).forEach((it) => D.agreementPrices.push({ id: id++, custCode: cc, itemCode: it.code, price: r2(it.price * (0.6 + Math.floor(rnd() * 4) / 10)),
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
  const gp = (g) => (D.groupPrices[g] = D.groupPrices[g] || {});
  const nextAgreementId = () => Math.max(0, ...D.agreementPrices.map((x) => x.id)) + 1;

  /* ---------- 共享业务函数 ---------- */
  biz.customer = (code) => (D.customer(code) ? ensure(D.customer(code)) : null);
  biz.openCustomer = (code) => ERP.go('customerDetail', { code });
  // 客户开单价格：协议价格 > 分组价格 > 标准单价 × 分组折扣
  biz.priceFor = (custCode, itemCode) => {
    const c = D.customer(custCode), it = itemOf(itemCode);
    const a = D.agreementPrices.find((x) => x.custCode === custCode && x.itemCode === itemCode);
    if (a) return { price: a.price, source: '协议价格' };
    if (c && gp(c.group)[itemCode] != null) return { price: gp(c.group)[itemCode], source: '分组价格' };
    const g = c && D.groups.find((x) => x.code === c.group);
    return g && g.discount < 1 ? { price: r2(it.price * g.discount), source: '分组折扣' } : { price: it.price, source: '标准单价' };
  };
  // 状态标签：类型（中性）、结算方式（记账为 info）、欠款（warning）
  biz.custBadges = (c) => h('span', { style: { whiteSpace: 'nowrap' } },
    [badge(isBook(c) ? c.settleType : '现结', isBook(c) ? 'info' : undefined), isPre(c) ? badge('预存') : null, c.debt > 0 ? badge('有欠款', 'warning') : null]
      .filter(Boolean).flatMap((b, i) => (i ? [' ', b] : [b])));

  /* 删除客户：有业务单据的客户不能删除，引导使用客户合并 */
  async function deleteCustomer(c, msgSlot, after) {
    const show = (...m) => { msgSlot.hidden = false; msgSlot.replaceChildren(notice('danger', ...m)); msgSlot.querySelector('.apb-erp-notice').focus?.(); };
    if (c.code === '000000') return show('不能删除：散户（000000）为系统默认客户。');
    if (hasRecords(c.code)) return show(`不能删除客户 ${c.code} ${c.name}：已有工单、结算或预存卡记录。重复建档的客户请使用 `, link('客户合并', 'custMerge', { from: c.code }), ' 把记录并入正确的客户。');
    if (!(await confirm(`删除客户 ${c.code} ${c.name}？`, { okLabel: '删除客户', danger: true, detail: '同时删除其联络人员和协议价格。删除后不能恢复。' }))) return;
    await ERP.api.write(() => {
      D.customers.splice(D.customers.indexOf(c), 1);
      D.contacts = D.contacts.filter((x) => x.custCode !== c.code);
      D.agreementPrices = D.agreementPrices.filter((x) => x.custCode !== c.code);
    });
    toast(`客户 ${c.code} ${c.name} 已删除。`);
    after && after();
  }
  const msgSlot = () => h('div', { hidden: true });
  // ui.form 在 onSubmit 结束后总会视为“已保存”；取消确认或未通过检查时恢复离开保护
  const keepDirty = (form) => setTimeout(() => form.dispatchEvent(new Event('input')));

  /* ==================== 客户资料（基础 / 全面） ==================== */
  // 列按分组定义；全面视图在基础视图上追加账务、联系、特征、开票、管控列
  const basicDefs = () => [
    { title: '基本信息', columns: [
      { key: 'code', title: '编号', type: 'mono', nowrap: true, render: (c) => link(c.code, 'customerDetail', { code: c.code }, { ariaLabel: `查看客户 ${c.code} ${c.name}` }) },
      { key: 'name', title: '客户名称', width: 220, sub: (c) => [c.type, c.short ? `简称 ${c.short}` : ''].filter(Boolean).join(' · ') },
      { key: 'groupName', title: '客户分组', width: 150 },
    ] },
    { title: '结算', columns: [{ key: 'settleType', title: '结算方式', render: biz.custBadges, nowrap: true }] },
    { title: '联系信息', columns: [
      { key: 'contact', title: '联系代表 / 电话', width: 130, nowrap: true, render: (c) => c.contact || '未提供', sub: (c) => c.phone },
      { key: 'qq', title: 'QQ / 微信', nowrap: true, render: (c) => c.qq || '—', sub: (c) => c.wechat },
      { key: 'address', title: '地址 / 商圈', width: 200, render: (c) => c.address || '未提供', sub: (c) => c.district },
    ] },
    { title: '其他', columns: [{ key: 'remark', title: '说明备注', width: 120 }] },
  ];
  const fullDefs = () => {
    const g = basicDefs();
    g[1].columns.push({ key: 'debt', title: '欠款（元）', type: 'money', sum: true }, { key: 'prestoreBalance', title: '预存余额（元）', type: 'money', sum: true },
      { key: 'writeOffPending', title: '待销账（元）', type: 'money', sum: true }, { key: 'creditLimit', title: '信用额度（元）', type: 'money', render: (c) => (c.creditLimit ? F.money(c.creditLimit) : '不限') });
    g[2].columns.push({ key: 'fax', title: '传真' }, { key: 'email', title: '电子邮件', width: 160 }, { key: 'zip', title: '邮编', type: 'mono' });
    g.splice(3, 1,
      { title: '特征属性', columns: [{ key: 'created', title: '建交日期', type: 'date' }, { key: 'value', title: '价值评估' }, { key: 'relation', title: '关系等级' },
        { key: 'credit', title: '信誉等级' }, { key: 'source', title: '客户来源' }, { key: 'industry', title: '所属行业' }] },
      { title: '开票信息', columns: [{ key: 'invoiceTitle', title: '开票抬头', width: 200 }, { key: 'taxNo', title: '税号', type: 'mono' }, { key: 'bank', title: '开户银行', width: 150 }] },
      { title: '管控', columns: [{ key: 'owner', title: '负责人员' }, { key: 'lastAudit', title: '最近对账', type: 'date', render: (c) => F.date(c.lastAudit) || '未对账' },
        { key: 'noOrderRemind', title: '无委托提醒（天）', type: 'num', render: (c) => (c.noOrderRemind ? F.num(c.noOrderRemind) : '不提醒') }] },
      { title: '其他', columns: [{ key: 'remark', title: '说明备注', width: 120 }, { key: 'intro', title: '说明简介', width: 160 }] });
    return g;
  };
  const exportCols = (defs) => defs.flatMap((g) => g.columns).map((c) => ({ ...c, render: null }));
  // 当前地址里的参数（切换列视图时保留筛选）
  const hashParams = () => ERP.params();

  function custManagePage(el, params, ctx, full) {
    ctx.setActions([
      link('新建机构客户', 'newOrgCustomer', null, { button: true, variant: 'primary' }),
      link('新建个人客户', 'newPersonCustomer', null, { button: true }),
      btn('导出筛选结果', () => ERP.ui.exportCsv('客户资料', exportCols(defs), list.rows)),
    ]);
    const slot = msgSlot();
    el.appendChild(slot);
    const defs = full ? fullDefs() : basicDefs();
    const view = ERP.ui.radios('custView', [['basic', '基础'], ['full', '全面']], full ? 'full' : 'basic', (v) => ERP.go(v === 'full' ? 'custManageFull' : 'custManage', hashParams()));
    view.setAttribute('aria-label', '列视图');
    const has = (v, k) => String(v || '').toLocaleLowerCase('zh-CN').includes(k.toLocaleLowerCase('zh-CN'));
    const list = ERP.ui.list(el, {
      title: '客户', note: full ? '全面视图：含账务、特征属性、开票与管控信息' : '基础视图：常用联系与结算信息', params,
      actions: [h('span.apb-erp-muted', '列视图'), view],
      load: allCustomers,
      sort: (a, b) => (+a.code || 0) - (+b.code || 0),
      filters: [
        { key: 'keyword', type: 'search', label: '搜索客户', placeholder: '编号 / 名称 / 电话 / 联系人 / 地址',
          match: (c, v) => [c.code, c.name, c.short, c.phone, c.tel, c.contact, c.address, c.district, c.qq, c.wechat, c.email, c.remark, c.intro].some((x) => x && has(x, v)) },
        { key: 'group', type: 'select', label: '客户分组', options: groupOpts() },
        { key: 'type', type: 'select', label: '客户类型', options: ['机构', '个人'] },
        { key: 'settle', type: 'select', label: '结算方式', options: [['cash', '现结'], ['book', '记账 / 月结']], match: (c, v) => (v === 'book') === isBook(c) },
        { key: 'attr', type: 'select', label: '业务属性', options: [['debt', '有欠款'], ['pre', '有预存余额'], ['wo', '有待销账']],
          match: (c, v) => (v === 'debt' ? c.debt > 0 : v === 'pre' ? c.prestoreBalance > 0 : c.writeOffPending > 0) },
        { key: 'owner', type: 'select', label: '负责人员', options: [...new Set(D.customers.map((c) => c.owner).filter(Boolean))] },
      ],
      groups: full ? defs.map((g) => ({ title: g.title, span: g.columns.length })) : null,
      columns: defs.flatMap((g) => g.columns),
      rowActions: (c) => [
        link('详情', 'customerDetail', { code: c.code }, { ariaLabel: `查看客户 ${c.code} 详情` }),
        link('编辑', 'customerEdit', { code: c.code }, { ariaLabel: `编辑客户 ${c.code}` }),
        c.code === '000000' ? null : linkBtn('删除', () => deleteCustomer(c, slot, () => list.reload()), { variant: 'danger', ariaLabel: `删除客户 ${c.code}` }),
      ],
      selectable: true, idKey: 'code',
      batch: [{ label: '导出所选', onClick: (rows) => ERP.ui.exportCsv('客户资料', exportCols(defs), rows) }],
      emptyTitle: '尚无客户资料', emptyText: '新建客户后会显示在这里；前台开单时新建的客户也会出现。',
      emptyAction: link('新建机构客户', 'newOrgCustomer', null, { button: true, variant: 'primary' }),
    });
  }
  ERP.page('custManage', {
    module: 'cust', title: '客户资料', desc: '客户档案台账。点编号查看客户综合信息；分组决定默认价格与折扣。',
    render: (el, p, ctx) => custManagePage(el, p, ctx, false),
  });
  ERP.page('custManageFull', {
    module: 'cust', title: '客户资料（全面）', nav: false, parent: 'custManage', desc: '包含账务、特征属性、开票与管控信息的全部列；宽表可左右滚动。',
    render: (el, p, ctx) => custManagePage(el, p, ctx, true),
  });

  /* ==================== 客户详情（客户综合信息） ==================== */
  ERP.page('customerDetail', {
    module: 'cust', title: '客户详情', nav: false, parent: 'custManage', smokeParams: { code: '1070' },
    render(el, params, ctx) {
      const c = biz.customer(params.code);
      if (!c) return el.appendChild(h('section.apb-erp-panel', ERP.ui.empty({ title: `找不到客户 ${params.code || ''}`, text: '可能已被删除或合并，或链接有误。', action: link('返回客户资料', 'custManage', null, { button: true }) })));
      ctx.setTitle(`客户 ${c.code} ${c.name}`);
      const org = c.type !== '个人';
      ctx.setActions([
        link('编辑资料', 'customerEdit', { code: c.code }, { button: true, variant: 'primary' }),
        link('协议价格', 'agreementPrice', { code: c.code }, { button: true }),
        link('联络人员', 'contacts', { cust: c.code }, { button: true }),
        c.code === '000000' ? null : link('合并到其他客户', 'custMerge', { from: c.code }, { button: true }),
      ]);
      const slot = msgSlot();
      el.appendChild(slot);
      const orders = D.workOrders.filter((w) => w.custCode === c.code).sort((a, b) => b.created - a.created);
      const sts = D.settlements.filter((s) => s.custCode === c.code).sort((a, b) => b.date - a.date);
      const cards = (D.cards || []).filter((k) => k.custCode === c.code);
      const contacts = D.contacts.filter((x) => x.custCode === c.code);
      const agrees = D.agreementPrices.filter((a) => a.custCode === c.code);
      const sum = (a, k) => r2(a.reduce((s, x) => s + (Number(x[k]) || 0), 0));
      const or = (v, t = '未提供') => (v == null || v === '' ? t : v);
      const mono = (v) => h('span.apb-erp-mono', v);

      // 账务概况：对客户有实际意义的余额
      const p0 = panel({ title: '账务概况', note: `数据截至 ${F.stamp(new Date())}` });
      p0.body.appendChild(ERP.ui.summary([
        ['欠款（元）', F.money(c.debt)], ['预存余额（元）', F.money(c.prestoreBalance)], ['结余（预存 − 欠款）（元）', F.money(r2(c.prestoreBalance - c.debt))],
        ['待销账（元）', F.money(c.writeOffPending)], ['未结工单金额（元）', F.money(sum(orders, 'unpaid'))], ['累计结算（元）', F.money(sum(sts, 'amount'))],
      ]));
      if (c.creditLimit && c.debt > c.creditLimit) p0.body.appendChild(notice('warning', `欠款已超出信用额度 ${F.money(c.creditLimit)} 元。开单前请先收款或调整额度。`));
      el.appendChild(p0.el);

      const p1 = panel({ title: '基本资料', note: `${c.type}客户 · 建交 ${F.date(c.created) || '未知'}` });
      p1.body.appendChild(kv([
        ['客户编号', mono(c.code)], ['客户名称', c.name], ['简称', c.short], ['客户类型', badge(c.type)],
        ['客户分组', `${c.group} ${c.groupName}`], ['结算方式', biz.custBadges(c)],
        ['联系代表', c.contact], ['联系电话', c.phone ? mono(c.phone) : ''],
        ['常用地址', c.address], ['城市商圈', c.district],
        ['QQ', c.qq], ['微信', c.wechat], ['电子邮件', c.email], ['传真', c.fax], ['邮政编码', c.zip],
        ['网站地址', c.website && c.website !== 'http://' ? c.website : ''], ['其它方式', c.other], ['取送距离（公里）', c.distance != null ? F.num(c.distance, 2) : '未知'],
      ]));
      el.appendChild(p1.el);

      const p2 = panel({ title: '业务资料' });
      p2.body.appendChild(kv([
        ['负责人员', or(c.owner, '未指定')], ['信用额度（元）', c.creditLimit ? mono(F.money(c.creditLimit)) : '不限'],
        ['价值评估', c.value], ['关系等级', c.relation], ['信誉等级', c.credit], ['客户来源', c.source], ['所属行业', c.industry],
        org ? ['机构类型', c.orgType] : ['所在单位', c.company], org ? ['人员规模', c.scale] : ['个人爱好', c.hobby],
        ['无委托提醒', c.noOrderRemind ? `${c.noOrderRemind} 天` : '不提醒'], ['最近对账', F.date(c.lastAudit) || '未对账'],
        ['开票抬头', c.invoiceTitle], ['税号', c.taxNo ? mono(c.taxNo) : ''], ['开户银行', c.bank],
        ['说明备注', c.remark], ['说明简介', c.intro],
      ]));
      el.appendChild(p2.el);

      // 业务记录：页签（面板内）
      const p3 = panel({ title: '业务记录', flush: true });
      const paneBar = (...kids) => h('div.apb-erp-panelbody.apb-erp-row', ...kids);
      ERP.ui.tabs(p3.body, [
        { title: `近期工单（${orders.length}）`, render: (q) => {
          q.appendChild(paneBar(h('span.apb-erp-muted', orders.length > 20 ? `显示最近 20 张，共 ${orders.length} 张。` : `共 ${orders.length} 张。`), orders.length ? link('在工单台账中查看', 'frontdesk', { q: c.name }) : null));
          ERP.ui.table(q, {
            caption: '近期工单', rows: orders.slice(0, 20),
            columns: [{ key: 'no', title: '工单编号', type: 'mono', render: (w) => link(w.no, 'orderDetail', { no: w.no }, { ariaLabel: `查看工单 ${w.no}` }) },
              { key: 'created', title: '委托时间', type: 'time' }, { key: 'task', title: '制作任务 / 要求', render: (w) => w.task || '—' },
              { key: 'settleStatus', title: '结算状态', render: (w) => (biz.settleBadge ? biz.settleBadge(w) : w.settleStatus) },
              { key: 'flow', title: '生产流程', render: (w) => (biz.flowBadge ? biz.flowBadge(w) : w.flow) },
              { key: 'amount', title: '实收（元）', type: 'money', sum: true }, { key: 'paid', title: '已结（元）', type: 'money', sum: true }, { key: 'unpaid', title: '未结（元）', type: 'money', sum: true }],
            empty: { title: '尚无工单', text: '在前台新建工单时选择该客户，工单会显示在这里。' },
          });
        } },
        { title: `结算记录（${sts.length}）`, render: (q) => ERP.ui.table(q, {
          caption: '结算记录', rows: sts,
          columns: [{ key: 'no', title: '结算单号', type: 'mono' }, { key: 'date', title: '时间', type: 'time' }, { key: 'method', title: '支付方式' },
            { key: 'orderNo', title: '工单', type: 'mono', render: (s) => (s.orderNo ? link(s.orderNo, 'orderDetail', { no: s.orderNo }) : '—') },
            { key: 'handler', title: '经手' }, { key: 'audited', title: '审核', render: (s) => badge(s.audited ? '已审核' : '未审核', s.audited ? 'success' : undefined) },
            { key: 'wipe', title: '抹零（元）', type: 'money', sum: true }, { key: 'amount', title: '金额（元）', type: 'money', sum: true }],
          empty: { title: '尚无结算记录', text: '工单收款后会显示在这里。' },
        }) },
        { title: `联络人员（${contacts.length}）`, render: (q) => {
          q.appendChild(paneBar(link('新建联络人员', 'contactEdit', { cust: c.code }, { button: true })));
          ERP.ui.table(q, {
            caption: '联络人员', rows: contacts,
            columns: [{ key: 'name', title: '姓名', sub: (x) => x.call }, { key: 'type', title: '人员类型', render: (x) => badge(x.type) }, { key: 'dept', title: '部门 / 职务', render: (x) => [x.dept, x.title].filter(Boolean).join(' · ') || '—' },
              { key: 'mobile', title: '手机', type: 'mono' }, { key: 'tel', title: '固定电话', type: 'mono' }, { key: 'email', title: '电子邮件' }],
            rowActions: (x) => [link('编辑', 'contactEdit', { id: x.id, cust: c.code }, { ariaLabel: `编辑联络人员 ${x.name}` })],
            empty: { title: '尚无联络人员', text: org ? '机构客户可登记经办人、财务、设计师等多位联络人员。' : '个人客户通常无需另建联络人员。' },
          });
        } },
        { title: `协议价格（${agrees.length}）`, render: (q) => {
          q.appendChild(paneBar(h('span.apb-erp-muted', '开单时优先使用协议价格。'), link('管理协议价格', 'agreementPrice', { code: c.code })));
          ERP.ui.table(q, {
            caption: '协议价格', rows: agrees.map((a) => ({ ...a, it: itemOf(a.itemCode) })),
            columns: [{ key: 'itemCode', title: '项目编号', type: 'mono' }, { key: 'name', title: '经营子项', render: (a) => a.it.name },
              { key: 'unit', title: '单位', render: (a) => a.it.unit }, { key: 'list', title: '标准单价（元）', type: 'money', render: (a) => F.money(a.it.price) },
              { key: 'price', title: '协议价格（元）', type: 'money' }, { key: 'start', title: '开始日期', type: 'date' }, { key: 'remark', title: '说明备注' }],
            empty: { title: '尚无协议价格', text: '按分组价格或标准单价开单。' },
          });
        } },
        { title: `预存卡（${cards.length}）`, render: (q) => ERP.ui.table(q, {
          caption: '预存卡', rows: cards,
          columns: [{ key: 'cardNo', title: '卡号', type: 'mono' }, { key: 'group', title: '卡类型' }, { key: 'issueDate', title: '发卡日期', type: 'date' },
            { key: 'status', title: '状态', render: (k) => badge(k.status, k.status === '正常' ? 'success' : 'warning') },
            { key: 'totalIn', title: '累计储值（元）', type: 'money', sum: true }, { key: 'totalOut', title: '累计消费（元）', type: 'money', sum: true }, { key: 'balance', title: '余额（元）', type: 'money', sum: true }],
          empty: { title: '没有预存卡', text: isPre(c) ? '该客户属于预存分组，但尚未发卡。' : '非预存分组客户。' },
        }) },
      ]);
      el.appendChild(p3.el);

      // 上一位 / 下一位 / 删除
      const i = D.customers.indexOf(c);
      el.appendChild(h('div.apb-erp-row',
        i > 0 ? link('← 上一位客户', 'customerDetail', { code: D.customers[i - 1].code }, { button: true }) : null,
        i < D.customers.length - 1 ? link('下一位客户 →', 'customerDetail', { code: D.customers[i + 1].code }, { button: true }) : null,
        c.code === '000000' ? null : btn('删除客户', () => deleteCustomer(c, slot, () => ERP.go('custManage')), { variant: 'danger' })));
    },
  });

  /* ==================== 新建 / 编辑客户（表单页） ==================== */
  function customerEditPage(el, params, ctx) {
    const src = params.code ? biz.customer(params.code) : null;
    if (params.code && !src) return el.appendChild(notice('danger', `找不到客户 ${params.code}，可能已被删除或合并。`, ' ', link('返回客户资料', 'custManage')));
    let type = src ? src.type : params.type === '个人' ? '个人' : '机构';
    const c = src || ensure({ code: '', name: '', group: '10', type, created: today(), owner: D.currentUser.name, city: '北京', district: '北京>中关村', source: '门店接待', industry: type === '个人' ? '个人' : '未知', short: '', qq: '', email: '', website: '' });
    if (src) ctx.setTitle(`编辑客户 ${src.code} ${src.name}`);
    else ctx.setTitle(`新建${type}客户`);
    const v = (k) => (c[k] == null ? '' : c[k]);
    // 文本输入：名称、长度
    const ti = (name, attrs = {}) => input(Object.assign({ name, value: v(name), maxlength: 100 }, attrs));
    const sel = (name, opts) => select(opts, { name, value: v(name) });

    const nameIn = ti('name');
    nameIn._validate = (val) => {
      const dup = D.customers.find((x) => x.name === val && x !== src);
      return dup ? `已存在同名客户 ${dup.code} ${dup.name}。可以打开该客户，或改用能区分的名称（如加上部门）。` : null;
    };
    const phone = ti('phone', { inputmode: 'tel', maxlength: 20 }); phone.dataset.validate = 'phone';
    const fax = ti('fax', { inputmode: 'tel', maxlength: 20 }); fax.dataset.validate = 'phone';
    const email = ti('email', { inputmode: 'email' });
    email._validate = (val) => (val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val) ? '请填写有效电子邮件，例如 name@example.com。' : null);
    const created = dateInput({ name: 'created', value: F.date(c.created) }); created.dataset.validate = 'date';
    const credit = money({ name: 'creditLimit', value: c.creditLimit ? Number(c.creditLimit).toFixed(2) : '' }); credit.dataset.validate = 'money';
    const remind = input({ name: 'noOrderRemind', value: c.noOrderRemind || '', inputmode: 'numeric', class: 'lerp-amount' });
    remind._validate = (val) => (val && !/^\d{1,4}$/.test(val) ? '请填写 0–9999 的整数天数。' : null);
    const dist = input({ name: 'distance', value: c.distance ?? '', inputmode: 'decimal', class: 'lerp-amount' });
    dist._validate = (val) => (val && !/^\d+(\.\d{1,2})?$/.test(val) ? '请填写公里数，最多两位小数，例如 3.5。' : null);
    const districts = [...new Set([c.district, ...D.customers.map((x) => x.district)].filter(Boolean))].sort();

    // 机构 / 个人专属字段，随客户类型切换
    const orgFields = [field({ label: '机构类型', control: sel('orgType', OPT.orgType) }), field({ label: '人员规模', control: sel('scale', OPT.scale) })];
    const personFields = [field({ label: '所在单位', control: ti('company') }), field({ label: '个人爱好', control: ti('hobby') })];
    const syncType = () => { orgFields.forEach((f) => (f.hidden = type !== '机构')); personFields.forEach((f) => (f.hidden = type !== '个人')); };

    const form = ERP.ui.form({
      ctx, submitLabel: src ? '保存资料' : '创建客户',
      cancel: src ? { href: ERP.href('customerDetail', { code: src.code }), label: '返回详情' } : { href: ERP.href('custManage'), label: '返回列表' },
      sections: [
        { title: '基本资料', note: '带“必填”的字段需要填写，其余可稍后补充。', fields: [
          field({ label: '客户名称', control: nameIn, required: true, help: '可填写企业名或客户称呼，最多 100 个字符。', error: '请输入客户名称。' }),
          field({ label: '客户编号', control: input({ value: src ? src.code : '', readOnly: true, class: 'apb-erp-mono', placeholder: '保存时自动生成' }), help: src ? '由系统分配，可选中复制。' : '保存时由系统分配。' }),
          h('div.apb-erp-field', h('span.lerp-label', { id: 'cust-type-label' }, '客户类型'),
            ERP.ui.radios('type', [['机构', '机构客户'], ['个人', '个人客户']], type, (t) => { type = t; syncType(); })),
          field({ label: '简称', control: ti('short', { maxlength: 20 }), help: '用于工单和报表的短名称，可不填。' }),
          field({ label: '客户分组', control: sel('group', groupOpts()), help: '分组决定默认价格与折扣；预存分组可发预存卡。' }),
          field({ label: '联系代表', control: ti('contact', { maxlength: 30 }) }),
          field({ label: '联系电话', control: phone, help: '手机或座机，例如 13800001234、010-62345678。' }),
          field({ label: '常用地址', control: ti('address', { maxlength: 200 }), span: 'all', help: '送货默认使用此地址。' }),
        ] },
        { title: '联系方式', cols: 3, fields: [
          field({ label: '城市商圈', control: input({ name: 'district', value: v('district'), list: 'cust-districts', maxlength: 40 }), help: '格式：城市>商圈，例如 北京>中关村。' }),
          field({ label: '取送距离（公里）', control: dist }),
          field({ label: 'QQ 号码', control: ti('qq', { inputmode: 'numeric', maxlength: 15 }) }),
          field({ label: '微信号码', control: ti('wechat', { maxlength: 40 }) }),
          field({ label: '电子邮件', control: email }),
          field({ label: '传真号码', control: fax }),
          field({ label: '邮政编码', control: ti('zip', { inputmode: 'numeric', maxlength: 6, class: 'apb-erp-mono' }) }),
          field({ label: '网站地址', control: ti('website', { placeholder: 'https://', maxlength: 200 }), span: 2 }),
          field({ label: '其它方式', control: ti('other', { maxlength: 100 }), span: 'all' }),
          h('datalist#cust-districts', districts.map((d) => h('option', { value: d }))),
        ] },
        { title: '业务资料', cols: 3, fields: [
          field({ label: '结算方式', control: sel('settleType', OPT.settle), help: '记账、月结客户可在结算时选择记账。' }),
          field({ label: '信用额度（元）', control: credit, help: '欠款超出时开单提示；不填表示不限。' }),
          field({ label: '负责人员', control: sel('owner', empOpts()) }),
          field({ label: '建交日期', control: created, help: '例如 2026-10-21。' }),
          field({ label: '客户来源', control: sel('source', OPT.source) }),
          field({ label: '所属行业', control: sel('industry', OPT.industry) }),
          field({ label: '价值评估', control: sel('value', OPT.level) }),
          field({ label: '关系等级', control: sel('relation', OPT.level) }),
          field({ label: '信誉等级', control: sel('credit', OPT.level) }),
          field({ label: '无委托提醒（天）', control: remind, help: '超过该天数无委托时在业务提醒中提示；不填为不提醒。' }),
          ...orgFields, ...personFields,
        ] },
        { title: '开票信息', fields: [
          field({ label: '开票抬头', control: ti('invoiceTitle', { maxlength: 100 }), help: '不填则使用客户名称。', span: 'all' }),
          field({ label: '税号', control: ti('taxNo', { maxlength: 20, class: 'apb-erp-mono' }), help: '统一社会信用代码，18 位。' }),
          field({ label: '开户银行', control: ti('bank') }),
        ] },
        { title: '备注', fields: [
          field({ label: '说明简介', control: textarea({ name: 'intro', value: v('intro'), maxlength: 500, rows: 4 }), help: '最多 500 个字符。不要填写密码或访问凭证。', span: 'all' }),
          field({ label: '说明备注', control: ti('remark', { maxlength: 200 }), help: '显示在客户列表中，例如“月结”“已开票”。', span: 'all' }),
        ] },
      ],
      onSubmit: (val) => ERP.api.write(() => {
        const t = src || {};
        Object.assign(t, {
          name: val.name.trim(), short: val.short.trim(), type: val.type || type, group: val.group, groupName: D.groupName(val.group),
          contact: val.contact.trim(), phone: val.phone.trim(), address: val.address.trim(), district: val.district.trim(),
          city: (val.district.split('>')[0] || '').trim() || c.city, distance: val.distance === '' ? null : Number(val.distance),
          qq: val.qq.trim(), wechat: val.wechat.trim(), email: val.email.trim(), fax: val.fax.trim(), zip: val.zip.trim(), website: val.website.trim(), other: val.other.trim(),
          settleType: val.settleType, creditLimit: val.creditLimit ? r2(Number(val.creditLimit.replace(/,/g, ''))) : 0, owner: val.owner,
          created: val.created ? ERP.parseDate(val.created) : null, source: val.source, industry: val.industry, value: val.value, relation: val.relation, credit: val.credit,
          noOrderRemind: Number(val.noOrderRemind) || 0, orgType: val.orgType, scale: val.scale, company: val.company.trim(), hobby: val.hobby.trim(),
          invoiceTitle: val.invoiceTitle.trim() || val.name.trim(), taxNo: val.taxNo.trim(), bank: val.bank.trim(), intro: val.intro, remark: val.remark.trim(),
        });
        if (src) {
          // 名称、分组同步到既有单据的冗余字段
          D.workOrders.filter((w) => w.custCode === src.code).forEach((w) => { w.custName = src.name; w.group = src.groupName; });
          D.settlements.filter((s) => s.custCode === src.code).forEach((s) => (s.custName = src.name));
        } else {
          ensure(Object.assign(t, { code: nextCode(), debt: 0, prestoreBalance: 0, writeOffPending: 0, lastAudit: null }));
          D.customers.push(t);
        }
        form.markClean();
        toast(src ? `客户 ${t.code} ${t.name} 已保存。` : `已新建${t.type}客户 ${t.code} ${t.name}。`);
        ERP.go('customerDetail', { code: t.code });
      }),
    });
    el.appendChild(panel({ title: '客户资料', note: src ? `${src.type}客户 · 修改后点“保存资料”` : '保存后进入客户详情，可继续添加联络人员与协议价格。' }).el).querySelector('.apb-erp-panelbody').appendChild(form);
    const typeGroup = form.querySelector('[role=radiogroup]');
    typeGroup.setAttribute('aria-labelledby', 'cust-type-label');
    syncType();
  }
  ERP.page('customerEdit', { module: 'cust', title: '新建客户', nav: false, parent: 'custManage', desc: '客户档案：基本资料 → 联系方式 → 业务资料 → 开票 → 备注。', render: customerEditPage });
  ERP.page('newOrgCustomer', { module: 'cust', title: '新建机构客户', nav: false, parent: 'custManage', desc: '公司、政府机关、学校等单位客户，可登记多位联络人员。',
    render: (el, p, ctx) => customerEditPage(el, { type: '机构' }, ctx) });
  ERP.page('newPersonCustomer', { module: 'cust', title: '新建个人客户', nav: false, parent: 'custManage', desc: '以个人身份委托的客户。',
    render: (el, p, ctx) => customerEditPage(el, { type: '个人' }, ctx) });

  /* ==================== 联络人员 ==================== */
  const contactCols = () => [
    { key: 'name', title: '姓名 / 称呼', width: 100, sub: (x) => x.call },
    { key: 'custName', title: '所属客户', width: 220, render: (x) => link(x.custName, 'customerDetail', { code: x.custCode }, { ariaLabel: `查看客户 ${x.custName}` }), sub: (x) => `${x.custCode} · ${x.groupName || '未分组'}` },
    { key: 'type', title: '人员类型', render: (x) => badge(x.type) },
    { key: 'dept', title: '部门 / 职务', nowrap: true, render: (x) => [x.dept, x.title].filter(Boolean).join(' · ') || '—' },
    { key: 'mobile', title: '手机', type: 'mono', nowrap: true },
    { key: 'tel', title: '固定电话', type: 'mono', nowrap: true },
    { key: 'email', title: '电子邮件', width: 140 },
    { key: 'owner', title: '负责人员' },
    { key: 'cloud', title: '云端账号', type: 'mono', nowrap: true, render: (x) => x.cloud || '未绑定' },
    { key: 'gender', title: '性别' },
    { key: 'remark', title: '说明备注', width: 120 },
  ];
  function setContactType(rows, done) {
    let v = rows.length === 1 ? rows[0].type : OPT.contactType[0];
    dialog({
      title: '设置人员类型', kicker: `已选择 ${rows.length} 位联络人员`,
      body: h('div.apb-erp-field', h('span.lerp-label', '人员类型'), ERP.ui.radios('ctype', OPT.contactType, v, (t) => (v = t))),
      actions: [{ label: '取消' }, { label: '确定', variant: 'primary', onClick: (close) => ERP.api.write(() => {
        rows.forEach((x) => (x.type = v)); close(); toast(`已将 ${rows.length} 位联络人员设为「${v}」。`); done && done();
      }) }],
    });
  }
  ERP.page('contacts', {
    module: 'cust', title: '联络人员', desc: '机构客户的经办人、财务、设计师等联系人。点客户名查看客户详情。',
    render(el, params, ctx) {
      ctx.setActions([link('新建联络人员', 'contactEdit', params.cust ? { cust: params.cust } : null, { button: true, variant: 'primary' })]);
      const surnames = () => {
        const cnt = {};
        D.contacts.forEach((x) => (cnt[x.name[0]] = (cnt[x.name[0]] || 0) + 1));
        return Object.keys(cnt).sort((a, b) => a.localeCompare(b, 'zh')).map((s) => [s, `${s}（${cnt[s]}）`]);
      };
      const list = ERP.ui.list(el, {
        title: '联络人员', params,
        load: () => D.contacts.map((x) => { const c = custOf(x.custCode); return Object.assign(x, { custName: c.name, groupName: c.groupName, group: c.group }); }),
        sort: (a, b) => a.custCode.localeCompare(b.custCode) || a.id - b.id,
        filters: [
          { key: 'q', type: 'search', label: '搜索联络人员', placeholder: '姓名 / 称呼 / 手机 / 电话 / 邮箱 / 备注', keys: ['name', 'call', 'mobile', 'tel', 'email', 'dept', 'title', 'remark', 'intro', 'custName'] },
          { key: 'cust', type: 'select', label: '所属客户', allLabel: '全部客户', options: custOpts((c) => D.contacts.some((x) => x.custCode === c.code)), match: (x, v) => x.custCode === v },
          { key: 'type', type: 'select', label: '人员类型', options: OPT.contactType },
          { key: 'group', type: 'select', label: '客户分组', options: groupOpts() },
          { key: 'surname', type: 'select', label: '姓氏', options: surnames(), match: (x, v) => x.name[0] === v },
          { key: 'mobile', type: 'select', label: '手机号', options: [['has', '有手机号'], ['none', '无手机号']], match: (x, v) => (v === 'has') === !!x.mobile },
        ],
        columns: contactCols(),
        rowActions: (x) => [
          link('编辑', 'contactEdit', { id: x.id }, { ariaLabel: `编辑联络人员 ${x.name}` }),
          linkBtn('删除', async () => {
            if (!(await confirm(`删除联络人员 ${x.name}（${x.custName}）？`, { okLabel: '删除', danger: true, detail: '删除后不能恢复；客户资料不受影响。' }))) return;
            await ERP.api.write(() => D.contacts.splice(D.contacts.indexOf(x), 1));
            toast(`联络人员 ${x.name} 已删除。`); list.reload();
          }, { variant: 'danger', ariaLabel: `删除联络人员 ${x.name}` }),
        ],
        selectable: true,
        batch: [
          { label: '设置人员类型', onClick: (rows) => setContactType(rows, () => list.reload()) },
          { label: '导出所选', onClick: (rows) => ERP.ui.exportCsv('联络人员', contactCols().map((c) => ({ ...c, render: null })), rows) },
        ],
        emptyTitle: '尚无联络人员', emptyText: '为机构客户登记经办人、财务等联系人后会显示在这里。',
        emptyAction: link('新建联络人员', 'contactEdit', null, { button: true, variant: 'primary' }),
      });
    },
  });

  /* 联络人员（新建 / 编辑，表单页）：从客户详情进入时（params.cust）保存后返回客户详情 */
  ERP.page('contactEdit', {
    module: 'cust', title: '新建联络人员', nav: false, parent: 'contacts',
    render(el, params, ctx) {
      const src = params.id ? D.contacts.find((x) => String(x.id) === String(params.id)) : null;
      if (params.id && !src) return el.appendChild(notice('danger', `找不到联络人员（编号 ${params.id}），可能已被删除。`, ' ', link('返回联络人员', 'contacts')));
      const t = src || { custCode: params.cust || '', type: '未评估', gender: '男', ageBand: '', owner: D.currentUser.name, created: today() };
      if (src) ctx.setTitle(`编辑联络人员 ${src.name}`);
      const back = params.cust ? { href: ERP.href('customerDetail', { code: params.cust }), label: '返回客户详情' } : { href: ERP.href('contacts'), label: '返回列表' };
      const v = (k) => (t[k] == null ? '' : t[k]);
      const ti = (name, attrs = {}) => input(Object.assign({ name, value: v(name), maxlength: 60 }, attrs));
      const cust = select([['', '请选择客户'], ...custOpts((c) => c.code !== '000000')], { name: 'custCode', value: t.custCode });
      const mobile = ti('mobile', { inputmode: 'tel', maxlength: 20 }); mobile.dataset.validate = 'phone';
      const tel = ti('tel', { inputmode: 'tel', maxlength: 20 }); tel.dataset.validate = 'phone';
      const email = ti('email', { inputmode: 'email', maxlength: 100 });
      email._validate = (val) => (val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val) ? '请填写有效电子邮件，例如 name@example.com。' : null);
      const created = dateInput({ name: 'created', value: F.date(t.created) }); created.dataset.validate = 'date';
      const form = ERP.ui.form({
        ctx, submitLabel: src ? '保存资料' : '创建联络人员', cancel: back,
        sections: [
          { title: '基本资料', note: '带“必填”的字段需要填写。', fields: [
            field({ label: '所属客户', control: cust, required: true, error: '请选择所属客户。', help: '散户不能登记联络人员。', span: 'all' }),
            field({ label: '人员姓名', control: ti('name', { maxlength: 30 }), required: true, error: '请输入人员姓名。' }),
            field({ label: '称谓称呼', control: ti('call', { maxlength: 20 }), help: '例如 王经理、李女士。' }),
            field({ label: '性别', control: select(OPT.gender, { name: 'gender', value: t.gender }) }),
            field({ label: '年龄段', control: select(OPT.ageBand.map((a) => [a, a || '（未知）']), { name: 'ageBand', value: t.ageBand }) }),
          ] },
          { title: '联系信息', fields: [
            field({ label: '移动电话', control: mobile, help: '用于云端自助下单登录。' }),
            field({ label: '固定电话', control: tel, help: '例如 010-62345678。' }),
            field({ label: '电子邮件', control: email }),
            field({ label: 'QQ 号码', control: ti('qq', { inputmode: 'numeric', maxlength: 15 }) }),
            field({ label: '人员地址', control: ti('address', { maxlength: 200 }), span: 'all' }),
            field({ label: 'ID 卡序号', control: ti('idCard', { class: 'apb-erp-mono', maxlength: 30 }), help: '刷卡读取或手工输入。' }),
            field({ label: '云端账号', control: input({ value: t.cloud || '', readOnly: true, class: 'apb-erp-mono', placeholder: '未绑定' }), help: '联络人员微信扫码后自动绑定，可选中复制。' }),
          ] },
          { title: '工作信息', cols: 3, fields: [
            field({ label: '人员类型', control: select(OPT.contactType, { name: 'type', value: t.type }) }),
            field({ label: '所属部门', control: ti('dept', { maxlength: 30 }) }),
            field({ label: '职位职务', control: ti('title', { maxlength: 30 }) }),
            field({ label: '负责人员', control: select(empOpts(), { name: 'owner', value: t.owner }) }),
            field({ label: '建交日期', control: created, help: '例如 2026-10-21。' }),
          ] },
          { title: '备注', fields: [
            field({ label: '人员简介', control: textarea({ name: 'intro', value: v('intro'), maxlength: 500, rows: 4 }), help: '最多 500 个字符。', span: 'all' }),
            field({ label: '说明备注', control: ti('remark', { maxlength: 200 }), span: 'all' }),
          ] },
        ],
        onSubmit: (val) => ERP.api.write(() => {
          const x = src || { id: Math.max(0, ...D.contacts.map((c) => c.id)) + 1, cloud: '' };
          Object.assign(x, { custCode: val.custCode, name: val.name.trim(), call: val.call.trim(), gender: val.gender, ageBand: val.ageBand, mobile: val.mobile.trim(), tel: val.tel.trim(),
            email: val.email.trim(), qq: val.qq.trim(), address: val.address.trim(), idCard: val.idCard.trim(), type: val.type, dept: val.dept.trim(), title: val.title.trim(),
            owner: val.owner, created: val.created ? ERP.parseDate(val.created) : null, intro: val.intro, remark: val.remark.trim() });
          if (!src) D.contacts.unshift(x);
          form.markClean();
          toast(src ? `联络人员 ${x.name} 已保存。` : `已新建联络人员 ${x.name}（${custOf(x.custCode).name}）。`);
          if (params.cust) ERP.go('customerDetail', { code: x.custCode }); else ERP.go('contacts', { cust: x.custCode });
        }),
      });
      el.appendChild(panel({ title: '联络人员资料' }).el).querySelector('.apb-erp-panelbody').appendChild(form);
    },
  });

  /* ==================== 分组价格（选择分组，逐项编辑价格后统一保存） ==================== */
  const validPrice = (s) => s === '' || /^\d+(\.\d{1,2})?$/.test(s.replace(/,/g, ''));
  ERP.page('groupPrice', {
    module: 'cust', title: '分组价格', desc: '为客户分组设定统一价格。开单取价顺序：客户协议价格 → 分组价格 → 标准单价 × 分组折扣。',
    render(el, params, ctx) {
      const grp = D.groups.find((g) => g.code === params.group) || D.groups.find((g) => g.code === '20') || D.groups[0];
      let cat = params.cat || '', kw = params.q || '';
      const draft = new Map();                       // itemCode → 输入的文本（'' 表示清除分组价格）
      const prices = gp(grp.code);
      ctx.guard(() => (draft.size ? ERP.ui.discardDialog() : Promise.resolve(true)), () => draft.size > 0);
      const slot = msgSlot();
      el.appendChild(slot);
      const say = (tone, ...m) => { slot.hidden = false; slot.replaceChildren(notice(tone, ...m)); };
      const sync = () => ERP.setParams({ group: grp.code, cat, q: kw });

      // 工具栏：分组（切换会重新打开页面）、主项、关键词
      const grpSel = select(groupOpts(), { value: grp.code, onchange: async () => {
        if (draft.size && !(await ERP.ui.discardDialog())) { grpSel.value = grp.code; return; }
        draft.clear();
        ERP.go('groupPrice', { group: grpSel.value, cat, q: kw });
      } });
      const catSel = select([['', '全部主项'], ...catOpts()], { value: cat, onchange: () => { cat = catSel.value; sync(); draw(); } });
      let timer;
      const kwIn = input({ type: 'search', value: kw, placeholder: '项目编号 / 名称' });
      kwIn.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { kw = kwIn.value.trim(); sync(); draw(); }, 300); });
      const toolbar = h('form.apb-erp-toolbar', { novalidate: true, onsubmit: (e) => { e.preventDefault(); kw = kwIn.value.trim(); sync(); draw(); } },
        field({ label: '客户分组', control: grpSel }), field({ label: '经营主项', control: catSel }), field({ label: '搜索项目', control: kwIn }), btn('筛选', null, { type: 'submit' }));

      const visible = () => D.items.filter((i) => (!cat || i.cat === cat) && (!kw || i.code.includes(kw) || i.name.includes(kw)));
      const cur = (code) => (draft.has(code) ? draft.get(code) : prices[code] != null ? prices[code].toFixed(2) : '');
      const p = panel({
        title: `${grp.code} ${grp.name}`, flush: true,
        note: `默认折扣 ${F.pct(grp.discount)}${grp.prestore ? ` · 预存门槛 ${F.money(grp.prestore)} 元` : ''} · 已设分组价格 ${Object.keys(prices).length} 项 · 价格单位：元`,
        actions: [
          btn('按分组折扣生成', async () => {
            if (grp.discount >= 1) return say('warning', `分组「${grp.name}」的折扣为 100%，没有可生成的折扣价。可以直接在表中填写分组价格。`);
            const items = visible();
            if (!(await confirm(`按 ${F.pct(grp.discount)} 为当前显示的 ${items.length} 个项目生成分组价格？`, { okLabel: '生成', detail: '已有价格会被覆盖；生成后需点“保存分组价格”才生效。' }))) return;
            items.forEach((i) => draft.set(i.code, r2(i.price * grp.discount).toFixed(2)));
            draw(); toast(`已生成 ${items.length} 项，检查后点“保存分组价格”。`);
          }),
          btn('清除当前显示的价格', async () => {
            const items = visible().filter((i) => cur(i.code) !== '');
            if (!items.length) return say('info', '当前显示的项目没有分组价格，无需清除。');
            if (!(await confirm(`清除当前显示的 ${items.length} 项分组价格？`, { okLabel: '清除', danger: true, detail: '清除后这些项目按标准单价 × 分组折扣开单；保存后生效。' }))) return;
            items.forEach((i) => draft.set(i.code, ''));
            draw(); toast(`已清除 ${items.length} 项，点“保存分组价格”生效。`);
          }),
          btn('导出', () => ERP.ui.exportCsv(`分组价格-${grp.code}`, [{ key: 'code', title: '项目编号' }, { key: 'name', title: '经营子项' }, { key: 'unit', title: '单位' }, { key: 'price', title: '标准单价（元）', type: 'money' }, { key: 'gp', title: '分组价格（元）' }],
            visible().map((i) => ({ ...i, gp: cur(i.code) })))),
        ],
      });
      el.appendChild(p.el);
      const holder = h('div'), status = h('p.apb-erp-muted', { role: 'status', 'aria-live': 'polite' });
      const save = btn('保存分组价格', () => doSave(), { variant: 'primary', busySlot: true });
      p.body.append(toolbar, h('div.apb-erp-footer', h('p.apb-erp-muted', '开单时客户协议价格优先；留空表示按分组折扣计算。'), h('p.apb-erp-muted', '宽表可左右滚动查看全部列')), holder,
        h('div.apb-erp-footer', status, h('div.apb-erp-row', save, btn('撤销修改', () => { draft.clear(); draw(); toast('已撤销未保存的修改。'); }))));
      const updStatus = () => { status.textContent = draft.size ? `有 ${draft.size} 项未保存的修改。` : '没有未保存的修改。'; };

      function draw() {
        const rows = visible().map((it) => {
          const r = { it };
          r.price = input({ class: 'lerp-cell lerp-amount', inputmode: 'decimal', value: cur(it.code), 'aria-label': `${it.name} 分组价格（元）`, style: { width: '110px' } });
          r.disc = input({ class: 'lerp-cell lerp-amount', inputmode: 'decimal', 'aria-label': `${it.name} 折扣（%）`, style: { width: '84px' } });
          r.diff = h('span.apb-erp-mono'); r.flag = h('span');
          const refresh = () => {
            const s = r.price.value.trim(), ok = validPrice(s), n = Number(s.replace(/,/g, ''));
            r.price.setAttribute('aria-invalid', String(!ok));
            r.disc.value = ok && s !== '' && it.price ? (r2((n / it.price) * 10000) / 100).toFixed(2) : '';
            r.diff.textContent = ok && s !== '' ? F.money(r2(it.price - n)) : '—';
            const orig = prices[it.code] != null ? prices[it.code].toFixed(2) : '';
            const changed = draft.has(it.code) && (ok ? (s === '' ? '' : n.toFixed(2)) : s) !== orig;
            r.flag.replaceChildren(!ok ? badge('格式有误', 'danger') : changed ? badge('未保存', 'warning') : s === '' ? badge('按折扣') : badge('已设置', 'success'));
          };
          r.price.addEventListener('input', () => { draft.set(it.code, r.price.value.trim()); refresh(); updStatus(); });
          r.disc.addEventListener('change', () => {
            const d = r.disc.value.trim();
            if (d === '') { r.price.value = ''; } else if (/^\d+(\.\d{1,2})?$/.test(d)) { r.price.value = r2((it.price * Number(d)) / 100).toFixed(2); } else { r.disc.setAttribute('aria-invalid', 'true'); return; }
            r.disc.removeAttribute('aria-invalid');
            draft.set(it.code, r.price.value); refresh(); updStatus();
          });
          refresh();
          return r;
        });
        holder.replaceChildren();
        ERP.ui.table(holder, {
          caption: `分组价格：${grp.code} ${grp.name}`, rows,
          columns: [
            { key: 'code', title: '项目编号', type: 'mono', render: (r) => r.it.code },
            { key: 'name', title: '经营子项', render: (r) => h('span', r.it.name, h('span.apb-erp-muted', `${D.itemCatName(r.it.cat)} · ${r.it.unit}`)) },
            { key: 'tier', title: '定价量级', render: (r) => r.it.tier },
            { key: 'list', title: '标准单价（元）', type: 'money', render: (r) => F.money(r.it.price) },
            { key: 'price', title: '分组价格（元）', align: 'right', render: (r) => r.price },
            { key: 'disc', title: '折扣（%）', align: 'right', render: (r) => r.disc },
            { key: 'diff', title: '优惠（元）', align: 'right', render: (r) => r.diff },
            { key: 'flag', title: '状态', render: (r) => r.flag },
          ],
          empty: { title: '没有符合条件的项目', text: '换个主项或关键词试试。' },
        });
        updStatus();
      }
      async function doSave() {
        const bad = [...draft].filter(([, s]) => !validPrice(s));
        if (bad.length) {
          say('danger', `尚未保存：${bad.length} 项价格格式有误（${bad.slice(0, 5).map(([code]) => itemOf(code).name).join('、')}${bad.length > 5 ? ' 等' : ''}）。请填写金额，最多两位小数，例如 12.50；已填内容保留。`);
          const first = holder.querySelector('input[aria-invalid="true"]');
          if (first) first.focus();
          return;
        }
        if (!draft.size) return toast('没有需要保存的修改。');
        await ERP.ui.busy(save, ERP.api.write(() => {
          draft.forEach((s, code) => { if (s === '') delete prices[code]; else prices[code] = r2(Number(s.replace(/,/g, ''))); });
        }));
        const n = draft.size;
        draft.clear(); slot.hidden = true;
        draw(); toast(`分组「${grp.name}」已保存 ${n} 项价格。`);
      }
      draw();
    },
  });

  /* ==================== 协议价格（客户专属单价） ==================== */
  // 修改单条协议价格：短操作用对话框
  function editAgreement(a, done) {
    const it = itemOf(a.itemCode);
    const price = money({ name: 'price', value: Number(a.price).toFixed(2) }); price.dataset.validate = 'money';
    price._validate = (v) => (Number(v.replace(/,/g, '')) < 0 ? '协议价格不能为负数。' : null);
    const start = dateInput({ name: 'start', value: F.date(a.start) }); start.dataset.validate = 'date';
    const dlg = dialog({
      title: '修改协议价格', kicker: `${custOf(a.custCode).name} · ${it.code} ${it.name}`,
      body: (b) => {
        b.appendChild(kv([['标准单价（元）', h('span.apb-erp-mono', F.money(it.price))], ['单位', it.unit || '未提供'], ['定价量级', it.tier]]));
        b.appendChild(ERP.ui.form({
          submitLabel: '保存协议价格',
          sections: [{ fields: [
            field({ label: '协议价格（元）', control: price, required: true, help: '开单时优先使用；可高于或低于标准单价。' }),
            field({ label: '开始日期', control: start, help: '例如 2026-10-21。' }),
            field({ label: '负责人员', control: select(empOpts(), { name: 'owner', value: a.owner || '' }) }),
            field({ label: '说明备注', control: input({ name: 'remark', value: a.remark || '', maxlength: 200 }) }),
            field({ label: '协议说明', control: textarea({ name: 'desc', value: a.desc || '', maxlength: 500, rows: 3 }), span: 'all' }),
          ] }],
          moreActions: btn('取消', () => dlg.close()),
          onSubmit: (v) => ERP.api.write(() => {
            Object.assign(a, { price: r2(Number(v.price.replace(/,/g, ''))), start: v.start ? ERP.parseDate(v.start) : null, owner: v.owner, remark: v.remark.trim(), desc: v.desc });
            dlg.close(); toast(`协议价格已改为 ${F.money(a.price)} 元。`); done && done();
          }),
        }));
      },
    });
  }
  ERP.page('agreementPrice', {
    module: 'cust', title: '协议价格', desc: '客户专属单价，开单时优先于分组价格和标准单价。先选择协议客户，再添加经营项目。',
    render(el, params, ctx) {
      const c = params.code ? biz.customer(params.code) : null;
      if (params.code && !c) el.appendChild(notice('warning', `找不到客户 ${params.code}，已显示全部协议价格。`));
      ctx.setActions([link('价格复制', 'priceCopy', c ? { from: c.code } : null, { button: true })]);
      // 选择协议客户：切换后重新打开页面（地址保留客户编号）
      const counts = {};
      D.agreementPrices.forEach((a) => (counts[a.custCode] = (counts[a.custCode] || 0) + 1));
      const custSel = select([['', '全部客户'], ...custOpts((x) => x.code !== '000000').map(([v, t]) => [v, counts[v] ? `${t} · ${counts[v]} 条` : t])],
        { value: c ? c.code : '', onchange: () => ERP.go('agreementPrice', { code: custSel.value }) });
      const p0 = panel({ title: '协议客户' });
      p0.body.appendChild(h('div.apb-erp-formgrid', field({ label: '选择客户', control: custSel, help: '有协议价格的客户后面显示条数。' }),
        c ? kv([['客户', link(`${c.code} ${c.name}`, 'customerDetail', { code: c.code })], ['客户分组', c.groupName || '未分组'], ['协议项目', `${counts[c.code] || 0} 条`]]) : h('p.apb-erp-muted', '选择客户后可添加协议项目；未选择时显示全部客户的协议价格。')));
      el.appendChild(p0.el);

      const addBtn = btn('添加协议项目', () => biz.itemPicker((it) => {
        if (D.agreementPrices.some((x) => x.custCode === c.code && x.itemCode === it.code)) {
          // itemPicker 在 onPick 后会提示“已添加”，这里延后覆盖为准确提示
          return setTimeout(() => toast(`${it.name} 已有协议价格，未重复添加；可在列表中改价。`));
        }
        const pr = biz.priceFor(c.code, it.code);
        D.agreementPrices.unshift({ id: nextAgreementId(), custCode: c.code, itemCode: it.code, price: pr.price, owner: D.currentUser.name, start: today(), desc: '', remark: '' });
        list.reload();
      }), { variant: 'primary', disabled: !c, describedby: c ? null : 'agree-add-note' });
      const cols = [
        c ? null : { key: 'custName', title: '协议客户', width: 200, render: (r) => link(r.custName, 'customerDetail', { code: r.custCode }), sub: (r) => `${r.custCode} · ${r.groupName || '未分组'}` },
        { key: 'itemCode', title: '项目编号', type: 'mono' },
        { key: 'itemName', title: '经营子项', width: 200, sub: (r) => `${r.catName} · ${r.unit}` },
        { key: 'tier', title: '定价量级' },
        { key: 'listPrice', title: '标准单价（元）', type: 'money' },
        { key: 'price', title: '协议价格（元）', type: 'money', sub: (r) => (r.price < r.listPrice ? `低于标价 ${F.money(r2(r.listPrice - r.price))}` : r.price > r.listPrice ? '高于标价' : '等于标价') },
        { key: 'start', title: '开始日期', type: 'date' },
        { key: 'owner', title: '负责人员', render: (r) => r.owner || '未指定' },
        { key: 'remark', title: '说明备注', width: 120 },
      ].filter(Boolean);
      const list = ERP.ui.list(el, {
        title: c ? `${c.name} 的协议价格` : '全部协议价格', params, keepParams: c ? { code: c.code } : {},
        actions: [addBtn, c ? null : h('span.apb-erp-muted#agree-add-note', '添加前请先选择协议客户。')],
        load: () => D.agreementPrices.filter((a) => !c || a.custCode === c.code).map((a) => {
          const cu = custOf(a.custCode), it = itemOf(a.itemCode);
          return { _ref: a, custCode: a.custCode, custName: cu.name, groupName: cu.groupName, itemCode: a.itemCode, cat: it.cat, catName: D.itemCatName(it.cat), itemName: it.name,
            unit: it.unit, tier: it.tier, price: a.price, listPrice: it.price, start: a.start, owner: a.owner, remark: a.remark };
        }),
        sort: (a, b) => a.custCode.localeCompare(b.custCode) || a.itemCode.localeCompare(b.itemCode),
        filters: [
          { key: 'q', type: 'search', label: '搜索项目', placeholder: '项目编号 / 名称 / 备注', keys: ['itemCode', 'itemName', 'catName', 'remark', 'custName'] },
          { key: 'cat', type: 'select', label: '经营主项', options: catOpts() },
          { key: 'owner', type: 'select', label: '负责人员', options: [...new Set(D.agreementPrices.map((a) => a.owner).filter(Boolean))] },
        ],
        columns: cols,
        rowActions: (r) => [
          linkBtn('改价', () => editAgreement(r._ref, () => list.reload()), { ariaLabel: `修改 ${r.itemName} 的协议价格` }),
          linkBtn('删除', async () => {
            if (!(await confirm(`删除 ${r.custName} 的协议价格「${r.itemName}」？`, { okLabel: '删除', danger: true, detail: '删除后该项目按分组价格或标准单价开单。' }))) return;
            await ERP.api.write(() => D.agreementPrices.splice(D.agreementPrices.indexOf(r._ref), 1));
            toast(`已删除协议价格：${r.itemName}。`); list.reload();
          }, { variant: 'danger', ariaLabel: `删除 ${r.itemName} 的协议价格` }),
        ],
        selectable: true, idKey: 'itemName',
        batch: [
          { label: '导出所选', onClick: (rows) => ERP.ui.exportCsv('协议价格', cols.map((x) => ({ ...x, render: null })), rows) },
          { label: '删除所选', variant: 'danger', onClick: async (rows) => {
            if (!(await confirm(`删除所选 ${rows.length} 条协议价格？`, { okLabel: '删除', danger: true, detail: '删除后这些项目按分组价格或标准单价开单。' }))) return;
            await ERP.api.write(() => rows.forEach((r) => D.agreementPrices.splice(D.agreementPrices.indexOf(r._ref), 1)));
            toast(`已删除 ${rows.length} 条协议价格。`); list.reload();
          } },
        ],
        emptyTitle: c ? '该客户尚无协议价格' : '尚无协议价格',
        emptyText: c ? '点“添加协议项目”选择经营项目；默认价格取当前分组价。' : '选择协议客户后添加。',
        emptyAction: c ? btn('添加协议项目', () => addBtn.click(), { variant: 'primary' }) : null,
      });
    },
  });

  /* ==================== 客户合并（表单页，不可逆） ==================== */
  // 合并：来源客户的单据、联络人员、协议价格（目标已有同项目则保留目标的）、余额并入目标，然后删除来源客户档案
  function mergeCustomers(a, b) {
    const mv = (list) => (list || []).forEach((x) => { if (x.custCode === a.code) { x.custCode = b.code; if ('custName' in x) x.custName = b.name; } });
    [D.workOrders, D.settlements, D.cards, D.prestores, D.contacts, D.arBills, D.writeOffs, D.cloudOrders].forEach(mv);
    D.workOrders.filter((w) => w.custCode === b.code).forEach((w) => (w.group = b.groupName));
    (D.cards || []).filter((k) => k.custCode === b.code).forEach((k) => (k.group = b.groupName));
    D.agreementPrices.filter((x) => x.custCode === a.code).forEach((x) => {
      if (D.agreementPrices.some((y) => y.custCode === b.code && y.itemCode === x.itemCode)) D.agreementPrices.splice(D.agreementPrices.indexOf(x), 1);
      else x.custCode = b.code;
    });
    b.debt = r2(b.debt + a.debt); b.prestoreBalance = r2(b.prestoreBalance + a.prestoreBalance); b.writeOffPending = r2(b.writeOffPending + a.writeOffPending);
    D.customers.splice(D.customers.indexOf(a), 1);
  }
  const mergeImpact = (code) => ({
    orders: D.workOrders.filter((w) => w.custCode === code).length, sts: D.settlements.filter((s) => s.custCode === code).length,
    cards: (D.cards || []).filter((k) => k.custCode === code).length, contacts: D.contacts.filter((x) => x.custCode === code).length,
    agrees: D.agreementPrices.filter((x) => x.custCode === code).length,
    bills: (D.arBills || []).filter((x) => x.custCode === code).length,
  });
  ERP.page('custMerge', {
    module: 'cust', title: '客户合并', desc: '把重复建档的来源客户并入目标客户。合并后来源客户档案被删除，不能撤销。',
    render(el, params, ctx) {
      const opts = [['', '请选择客户'], ...custOpts()];
      const from = select(opts, { name: 'from', value: params.from || '' }), to = select(opts, { name: 'to', value: params.to || '' });
      from._validate = (v) => (v === '000000' ? '散户（000000）为系统默认客户，不能作为来源客户。' : null);
      to._validate = (v) => (v && v === from.value ? '目标客户不能与来源客户相同。' : null);
      const ack = h('input.apb-erp-checkbox', { type: 'checkbox', name: 'ack' });
      ack._validate = () => (ack.checked ? null : '请勾选确认：已核对来源与目标客户，了解合并不能撤销。');
      const preview = h('div');
      const drawPreview = () => {
        const a = biz.customer(from.value), b = biz.customer(to.value);
        if (!a || !b || a === b) return preview.replaceChildren(h('p.apb-erp-muted', '选择来源客户和目标客户后，这里显示将要转移的记录。'));
        const m = mergeImpact(a.code);
        const t = mergeImpact(b.code);
        const tbl = h('div');
        ERP.ui.table(tbl, {
          caption: '合并影响', compact: true,
          rows: [
            { k: '工单', a: m.orders, b: t.orders, r: m.orders + t.orders },
            { k: '结算记录', a: m.sts, b: t.sts, r: m.sts + t.sts },
            { k: '预存卡', a: m.cards, b: t.cards, r: m.cards + t.cards },
            { k: '联络人员', a: m.contacts, b: t.contacts, r: m.contacts + t.contacts },
            { k: '协议价格（同项目保留目标的）', a: m.agrees, b: t.agrees, r: t.agrees + D.agreementPrices.filter((x) => x.custCode === a.code && !D.agreementPrices.some((y) => y.custCode === b.code && y.itemCode === x.itemCode)).length },
            { k: '欠款（元）', a: F.money(a.debt), b: F.money(b.debt), r: F.money(r2(a.debt + b.debt)) },
            { k: '预存余额（元）', a: F.money(a.prestoreBalance), b: F.money(b.prestoreBalance), r: F.money(r2(a.prestoreBalance + b.prestoreBalance)) },
            { k: '待销账（元）', a: F.money(a.writeOffPending), b: F.money(b.writeOffPending), r: F.money(r2(a.writeOffPending + b.writeOffPending)) },
          ],
          columns: [{ key: 'k', title: '项目' }, { key: 'a', title: `来源 ${a.code}`, align: 'right' }, { key: 'b', title: `目标 ${b.code}`, align: 'right' }, { key: 'r', title: '合并后（目标）', align: 'right' }],
        });
        preview.replaceChildren(tbl);
        preview.querySelectorAll('td.apb-erp-number').forEach((td) => td.classList.add('apb-erp-mono'));
      };
      from.addEventListener('change', drawPreview); to.addEventListener('change', drawPreview);
      const form = ERP.ui.form({
        ctx, submitLabel: '合并客户',
        cancel: { href: params.from ? ERP.href('customerDetail', { code: params.from }) : ERP.href('custManage'), label: params.from ? '返回客户详情' : '返回客户资料' },
        sections: [
          { title: '选择客户', fields: [
            field({ label: '来源客户', control: from, required: true, error: '请选择来源客户。', help: '重复建档、将被删除的客户。' }),
            field({ label: '目标客户', control: to, required: true, error: '请选择目标客户。', help: '保留的客户，接收来源客户的全部记录。' }),
          ] },
          { title: '合并影响', note: '客户资料（名称、分组、联系方式等）以目标客户为准，来源客户的资料不会合并。', content: preview },
          { title: '确认', content: [
            notice('danger', h('strong', '该操作不能撤销。'), h('ol', { style: { margin: '4px 0 0', paddingLeft: '20px' } },
              h('li', '来源客户的工单、结算、预存卡、联络人员、协议价格都归目标客户所有。'),
              h('li', '欠款、预存余额、待销账累加到目标客户。'),
              h('li', '来源客户档案被删除，原编号不再可用。'))),
            field({ label: '我已核对来源与目标客户，了解合并后不能撤销', control: ack }),
          ] },
        ],
        onSubmit: async (v) => {
          const a = biz.customer(v.from), b = biz.customer(v.to);
          if (!(await confirm(`把「${a.code} ${a.name}」合并到「${b.code} ${b.name}」？`, { title: '确认合并客户', okLabel: '合并并删除来源客户', danger: true,
            detail: `将转移 ${mergeImpact(a.code).orders} 张工单、${mergeImpact(a.code).sts} 条结算记录；来源客户 ${a.code} 随后删除，不能撤销。` }))) return keepDirty(form);
          await ERP.api.write(() => mergeCustomers(a, b));
          form.markClean();
          toast(`合并完成：${a.code} ${a.name} → ${b.code} ${b.name}。`);
          ERP.go('customerDetail', { code: b.code });
        },
      });
      // 勾选框放进 label 内、文字之前（错误提示仍紧随其下）
      const ackLabel = ack.closest('.apb-erp-field').querySelector('label');
      Object.assign(ackLabel.style, { display: 'inline-flex', alignItems: 'center', gap: '8px' });
      ackLabel.prepend(ack);
      el.appendChild(panel({ title: '合并客户资料' }).el).querySelector('.apb-erp-panelbody').appendChild(form);
      drawPreview();
    },
  });

  /* ==================== 价格复制（客户间协议价格复制，表单页） ==================== */
  ERP.page('priceCopy', {
    module: 'cust', title: '价格复制', desc: '把来源客户的协议价格复制给目标客户。可按项目勾选，或按经营主项整批复制。',
    render(el, params, ctx) {
      const opts = [['', '请选择客户'], ...custOpts((c) => c.code !== '000000')];
      const counts = {};
      D.agreementPrices.forEach((a) => (counts[a.custCode] = (counts[a.custCode] || 0) + 1));
      const from = select(opts.map(([v, t]) => [v, counts[v] ? `${t} · ${counts[v]} 条` : t]), { name: 'from', value: params.from || '' });
      const to = select(opts, { name: 'to', value: params.to || '' });
      to._validate = (v) => (v && v === from.value ? '目标客户不能与来源客户相同。' : null);
      from._validate = (v) => (v && !counts[v] ? '该客户没有协议价格，请选择有协议价格的来源客户。' : null);
      let mode = 'item';
      const picked = new Set();                      // 按项目：agreement id；按主项：cat code
      const scopeMsg = msgSlot();
      const box = h('div');
      const srcRows = () => D.agreementPrices.filter((a) => a.custCode === from.value);
      const keys = () => (mode === 'item' ? srcRows().map((a) => a.id) : [...new Set(srcRows().map((a) => itemOf(a.itemCode).cat))]);
      const cb = (key, label) => h('input.apb-erp-checkbox', { type: 'checkbox', checked: picked.has(key), 'aria-label': `复制 ${label}`, onchange: (e) => { e.target.checked ? picked.add(key) : picked.delete(key); count(); } });
      const countEl = h('span.apb-erp-muted', { role: 'status' });
      const count = () => { countEl.textContent = from.value ? `已勾选 ${picked.size} / ${keys().length} ${mode === 'item' ? '项' : '个主项'}` : ''; };
      function draw(reset) {
        if (reset) { picked.clear(); keys().forEach((k) => picked.add(k)); }   // 默认全选
        box.replaceChildren();
        if (!from.value) { box.appendChild(ERP.ui.empty({ title: '请先选择来源客户', text: '选择后列出该客户的协议价格。' })); return count(); }
        if (mode === 'item') ERP.ui.table(box, {
          caption: '来源客户的协议价格', compact: true, rows: srcRows().map((a) => ({ ...a, it: itemOf(a.itemCode) })),
          columns: [{ key: 'pick', title: '复制', render: (a) => cb(a.id, a.it.name) }, { key: 'itemCode', title: '项目编号', type: 'mono' },
            { key: 'name', title: '经营子项', render: (a) => h('span', a.it.name, h('span.apb-erp-muted', `${D.itemCatName(a.it.cat)} · ${a.it.unit}`)) },
            { key: 'list', title: '标准单价（元）', type: 'money', render: (a) => F.money(a.it.price) }, { key: 'price', title: '协议价格（元）', type: 'money' },
            { key: 'exists', title: '目标已有', render: (a) => (to.value && D.agreementPrices.some((x) => x.custCode === to.value && x.itemCode === a.itemCode) ? badge('已有', 'warning') : '—') }],
          empty: { title: '来源客户没有协议价格', text: '换一个来源客户。' },
        });
        else ERP.ui.table(box, {
          caption: '按经营主项', compact: true,
          rows: keys().map((cat) => ({ cat, n: srcRows().filter((a) => itemOf(a.itemCode).cat === cat).length })),
          columns: [{ key: 'pick', title: '复制', render: (r) => cb(r.cat, D.itemCatName(r.cat)) }, { key: 'cat', title: '经营主项', render: (r) => `${r.cat} ${D.itemCatName(r.cat)}` }, { key: 'n', title: '协议价格条数', type: 'num' }],
          empty: { title: '来源客户没有协议价格', text: '换一个来源客户。' },
        });
        count();
      }
      const setAll = (fn) => { keys().forEach((k) => (fn(picked.has(k)) ? picked.add(k) : picked.delete(k))); draw(); };
      from.addEventListener('change', () => draw(true));
      to.addEventListener('change', () => draw());
      const overwrite = ERP.ui.checkbox('覆盖目标客户已有的同项目协议价格', true, { name: 'overwrite' });
      const form = ERP.ui.form({
        ctx, submitLabel: '复制价格', wide: true,
        cancel: { href: ERP.href('agreementPrice', params.from ? { code: params.from } : null), label: '返回协议价格' },
        sections: [
          { title: '客户', fields: [
            field({ label: '来源客户', control: from, required: true, error: '请选择来源客户。', help: '列表后面显示协议价格条数。' }),
            field({ label: '目标客户', control: to, required: true, error: '请选择目标客户。', help: '复制后的价格开始日期为今天。' }),
          ] },
          { title: '复制范围', content: [
            ERP.ui.radios('copyMode', [['item', '按项目勾选'], ['cat', '按经营主项整批复制']], mode, (m) => { mode = m; draw(true); }),
            h('div.apb-erp-row', btn('全选', () => setAll(() => true)), btn('反选', () => setAll((v) => !v)), btn('清除', () => setAll(() => false)), countEl),
            scopeMsg, box,
          ] },
          { title: '选项', content: h('div.lerp-checks', overwrite) },
        ],
        onSubmit: async (v) => {
          const src = mode === 'item' ? srcRows().filter((a) => picked.has(a.id)) : srcRows().filter((a) => picked.has(itemOf(a.itemCode).cat));
          if (!src.length) { scopeMsg.hidden = false; scopeMsg.replaceChildren(notice('danger', '尚未复制：请至少勾选一项要复制的协议价格。')); box.querySelector('input')?.focus(); return keepDirty(form); }
          scopeMsg.hidden = true;
          const ow = !!v.overwrite;
          const exist = src.filter((a) => D.agreementPrices.some((x) => x.custCode === v.to && x.itemCode === a.itemCode)).length;
          const tc = custOf(v.to);
          if (exist && ow && !(await confirm(`目标客户 ${tc.name} 已有其中 ${exist} 项协议价格，将被来源客户的价格覆盖。继续？`, { okLabel: '覆盖并复制', detail: `共复制 ${src.length} 项。` }))) return keepDirty(form);
          let add = 0, upd = 0, skip = 0;
          await ERP.api.write(() => src.forEach((a) => {
            const ex = D.agreementPrices.find((x) => x.custCode === v.to && x.itemCode === a.itemCode);
            if (ex) { if (ow) { ex.price = a.price; ex.start = today(); upd++; } else skip++; }
            else { D.agreementPrices.push({ ...a, id: nextAgreementId(), custCode: v.to, start: today() }); add++; }
          }));
          form.markClean();
          toast(`复制完成：新增 ${add} 条，覆盖 ${upd} 条${skip ? `，跳过 ${skip} 条（目标已有）` : ''}。`);
          ERP.go('agreementPrice', { code: v.to });
        },
      });
      el.appendChild(panel({ title: '客户间协议价格复制' }).el).querySelector('.apb-erp-panelbody').appendChild(form);
      draw(true);
    },
  });
})();
