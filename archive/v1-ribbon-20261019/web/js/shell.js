/* LiteERP 静态原型 — 主界面外壳：功能区（Ribbon）、快速查询栏、状态栏
 * 功能区按钮的 id 与 ERP.page(id, …) 注册的页面一一对应。 */
(function () {
  'use strict';
  const { h } = ERP.ui;

  // 图标：彩色方块 + 单字，颜色取自旧版图标的主色
  const C = { red: '#e8424a', orange: '#f08a24', blue: '#3b82f6', sky: '#38a3d6', green: '#22a559', purple: '#8b5cf6', teal: '#14a39a', gray: '#8a8580', gold: '#e0a21a' };

  /* type: 'big'（大图标按钮）| 'small'（文字小按钮组） ；menu: 下拉子项 */
  ERP.ribbon = [
    { tab: '前台', groups: [
      { title: '接待', items: [
        { id: 'frontdesk', label: '前台业务中心', icon: '前', color: C.orange },
        { id: 'newOrder', label: '新建工单', icon: '+', color: C.orange },
        { id: 'orderRecords', label: '工单记录', icon: '单', color: C.sky, menu: [['orderRecords', '工单记录（全面）'], ['orderRecordsBasic', '工单记录（基础）']] },
        { id: 'cloudCenter', label: '云端业务中心', icon: '云', color: C.blue },
      ] },
      { title: '结算', items: [
        { id: 'settleRecords', label: '结算记录', icon: '结', color: C.sky, menu: [['settleRecords', '结算记录（现金收款）'], ['settleRecordsBasic', '结算记录（基础）']] },
      ] },
      { title: '预存', items: [
        { id: 'cardIssue', label: '卡片发行', icon: '卡', color: C.gold },
        { id: 'cardInfo', label: '卡片资料', icon: '资', color: C.sky },
        { id: 'prestore', label: '预存储值', icon: '存', color: C.sky, menu: [['prestore', '预存储值'], ['prestoreRecords', '预存记录']] },
        { id: 'prestoreRefund', label: '预存退款', icon: '退', color: C.sky, menu: [['prestoreRefund', '预存退款'], ['prestoreRecords', '预存记录']] },
      ] },
      { title: '更多', items: [
        { id: 'dailyReport', label: '营业日报表', icon: '日', color: C.orange },
        { id: 'miscIncome', label: '零收', icon: '零', color: C.sky, menu: [['miscIncome', '零收'], ['miscIncomeRecords', '零收记录']] },
      ] },
    ] },
    { tab: '生产', groups: [
      { title: '制作', items: [
        { id: 'prodCenter', label: '生产业务中心', icon: '产', color: C.blue },
        { id: 'prodDetail', label: '制作明细记录', icon: '明', color: C.sky },
      ] },
    ] },
    { tab: '财务', groups: [
      { title: '基础', items: [
        { id: 'finCenter', label: '财务业务中心', icon: '±', color: C.green },
        { id: 'smartSettle', label: '智多结算中心', icon: '智', color: C.gold },
        { id: 'cashBalance', label: '现金余额', icon: '¥', color: C.green },
        { id: 'bankBalance', label: '银行余额', icon: '银', color: C.green },
        { id: 'transfer', label: '转账', icon: '转', color: C.red, menu: [['transfer', '新建转账'], ['transferRecords', '转账记录']] },
      ] },
      { title: '客户', items: [
        { id: 'custBalance', label: '客户结余', icon: '余', color: C.green },
        { id: 'custStatement', label: '客户对账', icon: '对', color: C.sky },
        { id: 'arSummary', label: '应收汇总', icon: '应', color: C.green },
        { id: 'writeOff', label: '销账', icon: '销', color: C.sky, menu: [['writeOff', '新建销账'], ['writeOffRecords', '销账记录']] },
      ] },
      { title: '一般', items: [
        { id: 'generalIncome', label: '一般收入', icon: '收', color: C.sky, menu: [['generalIncome', '新建一般收入'], ['generalRecords', '收支记录']] },
        { id: 'generalExpense', label: '一般支出', icon: '支', color: C.sky, menu: [['generalExpense', '新建一般支出'], ['generalRecords', '收支记录']] },
      ] },
      { title: '其他', items: [
        { id: 'periodClose', label: '期末结账', icon: '期', color: C.sky },
        { type: 'small', items: [{ id: 'accountCalendar', label: '会计日历' }] },
      ] },
    ] },
    { tab: '客户', groups: [
      { title: '资料', items: [
        { id: 'custManage', label: '客户资料管理', icon: '客', color: C.green, menu: [['custManage', '客户资料管理（基础）'], ['custManageFull', '客户资料管理（全面）']] },
        { type: 'small', items: [{ id: 'newOrgCustomer', label: '新建机构客户' }, { id: 'newPersonCustomer', label: '新建个人客户' }] },
        { id: 'contacts', label: '联络人员管理', icon: '联', color: C.sky },
      ] },
      { title: '价格', items: [
        { id: 'groupPrice', label: '分组价格管理', icon: '组', color: C.sky },
        { id: 'agreementPrice', label: '协议价格管理', icon: '协', color: C.sky },
      ] },
      { title: '其他', items: [
        { type: 'small', items: [{ id: 'custMerge', label: '客户合并' }, { id: 'priceCopy', label: '价格复制' }] },
      ] },
    ] },
    { tab: '报表', groups: [
      { title: '基础', items: [
        { id: 'reportCenter', label: '报表中心', icon: '表', color: C.red },
        { id: 'bizAlert', label: '业务提醒', icon: '!', color: C.orange },
        { type: 'small', items: [{ id: 'rptIncomeExpense', label: '营业收支汇总表' }, { id: 'rptOrderSettle', label: '工单结算汇总表' }, { id: 'rptItems', label: '经营项目汇总表' }] },
      ] },
      { title: '客户类', items: [
        { type: 'small', items: [{ id: 'rptCustValue', label: '客户价值分析表' }, { id: 'rptCustNew', label: '客户新增汇总表' }, { id: 'rptCardSummary', label: '会员办卡汇总表' }] },
        { type: 'small', items: [{ id: 'rptCustRevenueRank', label: '客户工单实收排行表' }, { id: 'rptCustAvgRank', label: '客户工单均价排行表' }, { id: 'rptCustCountRank', label: '客户工单数量排行表' }] },
      ] },
    ] },
    { tab: '系统', groups: [
      { title: '资料', items: [{ id: 'employees', label: '员工资料', icon: '员', color: C.purple }] },
      { title: '配置', items: [
        { id: 'bizItems', label: '经营项目', icon: '项', color: C.orange },
        { id: 'custGroups', label: '客户分组', icon: '组', color: C.green },
        { id: 'prodFlow', label: '生产流程', icon: '流', color: C.sky },
        { id: 'chartOfAccounts', label: '会计科目', icon: '科', color: C.sky },
        { id: 'roles', label: '角色配置', icon: '角', color: C.blue },
        { id: 'runParams', label: '运行参数', icon: '参', color: C.purple },
        { id: 'printStyles', label: '打印样式', icon: '印', color: C.sky },
        { id: 'baseData', label: '基础数据', icon: '基', color: C.sky },
      ] },
      { title: '其他', items: [{ id: 'dataImport', label: '数据导入', icon: '导', color: C.sky }] },
    ] },
  ];

  function renderRibbon(tabIndex) {
    const tabs = document.getElementById('ribbon-tabs'), rb = document.getElementById('ribbon');
    tabs.querySelectorAll('button[data-i]').forEach((b) => b.classList.toggle('active', +b.dataset.i === tabIndex));
    rb.innerHTML = '';
    for (const g of ERP.ribbon[tabIndex].groups) {
      const items = h('div.items');
      for (const it of g.items) {
        if (it.type === 'small') {
          items.appendChild(h('div.rsmall', it.items.map((s) => h('button', { onclick: () => ERP.open(s.id) }, s.label))));
          continue;
        }
        const btn = h('button.rbtn', {
          title: it.label,
          onclick: (e) => {
            if (!it.menu) return ERP.open(it.id);
            const r = btn.getBoundingClientRect();
            ERP.ui.contextMenu(r.left, r.bottom, it.menu.map(([id, label]) => ({ label, action: () => ERP.open(id) })));
          },
        }, h('span.ico', { style: { background: it.color } }, it.icon), h('span', it.label), it.menu ? h('span.caret', '▼') : null);
        items.appendChild(btn);
      }
      rb.appendChild(h('div.rgroup', items, h('div.gtitle', g.title)));
    }
    try { localStorage.setItem('erp.ribbonTab', tabIndex); } catch (e) {}
  }

  // 打开页面时切换到包含该页面的功能区标签
  ERP.selectRibbonFor = function (id) {
    const ids = (it) => (it.items ? it.items.map((s) => s.id) : [it.id, ...(it.menu || []).map((m) => m[0])]);
    const i = ERP.ribbon.findIndex((t) => t.groups.some((g) => g.items.some((it) => ids(it).includes(id))));
    const cur = document.querySelector('#ribbon-tabs button.active');
    if (i >= 0 && (!cur || +cur.dataset.i !== i)) renderRibbon(i);
  };

  function boot() {
    const D = ERP.data;
    const tabs = document.getElementById('ribbon-tabs');
    ERP.ribbon.forEach((r, i) => tabs.appendChild(h('button', { 'data-i': i, onclick: () => renderRibbon(i) }, r.tab)));
    tabs.appendChild(h('span.grow'));
    tabs.appendChild(h('button', { title: '折叠功能区', onclick: () => document.getElementById('ribbon').classList.toggle('collapsed') }, '⌃'));

    // quick bar
    const qc = ERP.ui.input({ placeholder: '客户编号 / 名称 / 电话', style: { width: '200px' } });
    const qtype = ERP.ui.select(['生产 > 工作单', '财务 > 结算单', '财务 > 预存单', '财务 > 销账单'], { style: { width: '140px' } });
    const qno = ERP.ui.input({ placeholder: '单据编号', style: { width: '170px' } });
    const findCust = () => {
      const k = qc.value.trim();
      if (!k) return ERP.open('custManage');
      const hit = D.customers.filter((c) => c.code.includes(k) || c.name.includes(k) || c.phone.includes(k));
      ERP.ui.toast(`找到 ${hit.length} 个客户`);
      ERP.open('custManage', { keyword: k });
    };
    const findDoc = () => {
      const k = qno.value.trim();
      const w = D.workOrders.find((x) => x.no.includes(k));
      if (w && k) ERP.open('orderDetail', { no: w.no }); else ERP.ui.toast('未找到单据');
    };
    qc.addEventListener('keydown', (e) => e.key === 'Enter' && findCust());
    qno.addEventListener('keydown', (e) => e.key === 'Enter' && findDoc());
    ERP.ui.append(document.getElementById('quickbar'), [
      h('label', '查询客户'), qc, ERP.ui.btn('查找', findCust, 'sm'),
      h('label', { style: { marginLeft: '12px' } }, '查询单据'), qtype, qno, ERP.ui.btn('查找', findDoc, 'sm'),
      h('button.alert-btn', { title: '业务提醒', onclick: () => ERP.open('bizAlert') }, '⚠ 提醒'),
      h('span.grow'),
      h('span.muted', '快捷键：Ctrl+N 新建工单 · Ctrl+K 打开工单 · Ctrl+R 刷新'),
    ]);

    const sb = document.getElementById('statusbar');
    const clock = h('span');
    ERP.ui.append(sb, [h('span', '印特解决方案 ▾'), h('span', `${D.company.branch}/${D.currentUser.code}-${D.currentUser.name}`),
      h('span.grow', '就绪...'), h('span#status-period', `会计期间：${D.company.period}`), clock]);
    // 期末结账等功能调用以更新会计期间
    ERP.setPeriod = (p) => { D.company.period = p; document.getElementById('status-period').textContent = `会计期间：${p}`; };
    const tick = () => (clock.textContent = '服务器：' + ERP.fmt.datetime(new Date()));
    tick(); setInterval(tick, 1000);

    document.getElementById('usr').textContent = `${D.company.branch} · ${D.currentUser.name}`;

    let rt = 0;
    try { rt = +localStorage.getItem('erp.ribbonTab') || 0; } catch (e) {}
    renderRibbon(rt);

    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'n') { e.preventDefault(); ERP.open('newOrder'); }
    });

    // 首页：根据 URL hash 或默认打开前台业务中心
    // 支持 #页面id 或 #页面id?参数=值（便于直接打开某个对话框做演示 / 截图）
    const parseHash = () => {
      const [id, qs] = decodeURIComponent(location.hash.slice(1)).split('?');
      return { id, params: Object.fromEntries(new URLSearchParams(qs || '')) };
    };
    const { id, params } = parseHash();
    if (id !== 'frontdesk') ERP.open('frontdesk');
    if (ERP.pages[id]) ERP.open(id, params);
    window.addEventListener('hashchange', () => { const p = parseHash(); if (ERP.pages[p.id]) ERP.open(p.id, p.params); });
  }
  document.addEventListener('DOMContentLoaded', boot);
})();

/* 冒烟测试：打开 index.html#__smoke 时依次渲染全部页面并输出结果（tools/smoke.sh 使用） */
(function () {
  if (location.hash !== '#__smoke') return;
  const errors = [];
  window.addEventListener('error', (e) => errors.push(String(e.message)));
  document.addEventListener('DOMContentLoaded', () => setTimeout(() => {
    const out = [];
    for (const id of Object.keys(ERP.pages)) {
      if (id === 'orderDetail' || id === 'customerDetail') continue;
      const before = errors.length;
      try { ERP.open(id); } catch (e) { errors.push(`${id}: ${e.message}`); }
      document.querySelectorAll('.overlay').forEach((o) => o.remove());
      out.push((errors.length > before ? 'FAIL ' : 'ok   ') + id + (errors.length > before ? ' — ' + errors.slice(before).join('; ') : ''));
    }
    const missing = ERP.ribbon.flatMap((t) => t.groups.flatMap((g) => g.items.flatMap((i) => (i.items ? i.items.map((s) => s.id) : [i.id, ...(i.menu || []).map((m) => m[0])]))))
      .filter((id, i, a) => a.indexOf(id) === i && !ERP.pages[id]);
    out.push('', `pages: ${Object.keys(ERP.pages).length}, missing ribbon targets: ${missing.join(', ') || 'none'}`);
    document.body.appendChild(Object.assign(document.createElement('pre'), { id: 'smoke', textContent: out.join('\n') }));
  }, 300));
})();
