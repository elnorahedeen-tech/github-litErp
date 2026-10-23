/* 前台：前台业务中心、新建工单、工作单窗口（收款结算 / 收款码 / 流程转单 / 审核）
 * 本文件也是其他模块的参考实现。共享组件：ERP.biz.itemPicker / openOrder / flowTransfer / settle */
(function () {
  'use strict';
  const { h, grid, sidebar, split, dialog, field, input, select, check, btn, toast } = ERP.ui;
  const D = ERP.data, F = ERP.fmt;
  const biz = (ERP.biz = ERP.biz || {});

  /* ---------- 工作单列表列定义（前台、生产共用） ---------- */
  biz.orderColumns = () => [
    { title: '基础', columns: [
      { key: 'no', title: '工单编号', width: 140 },
      { key: 'group', title: '客户分组', width: 110 },
      { key: 'custName', title: '客户名称', width: 220 },
    ] },
    { title: '特征', columns: [
      { key: 'task', title: '制作任务', width: 160 },
      { key: 'req', title: '制作要求', width: 220 },
      { key: 'delivery', title: '取送要求', width: 90 },
      { key: 'orderType', title: '工单类型', width: 90 },
    ] },
    { title: '金额', columns: [
      { key: 'amount', title: '实收', type: 'money', sum: true },
      { key: 'paid', title: '已结', type: 'money', sum: true, hideZero: true },
      { key: 'unpaid', title: '未结', type: 'money', sum: true },
    ] },
    { title: '生产', columns: [
      { key: 'flow', title: '生产流程', width: 80, align: 'center' },
      { key: 'handler', title: '当前处理', width: 90 },
      { key: 'due', title: '交付时间', type: 'short', width: 110 },
    ] },
  ];
  biz.orderRowColor = (w) => D.flowColor(w.flow);

  /* 工作单右键菜单 */
  biz.orderMenu = (getGrid, w) => [
    { label: '打开工单', shortcut: 'Ctrl+K', disabled: !w, action: () => biz.openOrder(w.no) },
    '-',
    { label: '我来处理 (W)', disabled: !w, action: () => { w.handler = D.currentUser.name; getGrid().refresh(); toast('已接手：' + w.no); } },
    { label: '流程转单 (L)', shortcut: 'Ctrl+L', disabled: !w, action: () => biz.flowTransfer(w, () => getGrid().refresh()) },
    { label: '收款结算', disabled: !w, action: () => biz.settle(w, () => getGrid().refresh()) },
    '-',
    { label: '前景颜色', checked: true, action: () => toast('切换前景色（原型）') },
    { label: '背景颜色', checked: true, action: () => toast('切换背景色（原型）') },
    '-',
    { label: '导出(E)', action: () => getGrid().exportCsv('工作单') },
    { label: '刷新(R)', shortcut: 'Ctrl+R', action: () => getGrid().refresh() },
    { label: '刷新全部', action: () => getGrid().setRows(D.workOrders) },
  ];

  /* ---------- 前台业务中心 ---------- */
  ERP.page('frontdesk', {
    title: '前台业务中心',
    render(el) {
      const { side, main } = split(el);
      let fSettle = 'all', fFlow = 'all';
      const apply = () => g.setRows(D.workOrders.filter((w) =>
        (fSettle === 'all' || w.settleStatus === fSettle) && (fFlow === 'all' || w.flow === fFlow)));
      const cnt = (fn) => D.workOrders.filter(fn).length;
      const settleList = () => [
        { label: '全部', value: 'all', count: cnt((w) => w.settleStatus !== '完成结算') },
        { label: '0元空单', value: '0元空单', icon: '□', count: cnt((w) => w.settleStatus === '0元空单') },
        { label: '尚未结算', value: '尚未结算', icon: '▭', count: cnt((w) => w.settleStatus === '尚未结算') },
        { label: '部分结算', value: '部分结算', icon: '◔', count: cnt((w) => w.settleStatus === '部分结算') },
        { label: '完成结算', value: '完成结算', icon: '●', count: cnt((w) => w.settleStatus === '完成结算') },
      ];
      const flowList = () => [{ label: '全部', value: 'all', count: D.workOrders.length }]
        .concat(D.flows.map((f) => ({ label: f.name, value: f.name, icon: '➜', color: f.color, count: cnt((w) => w.flow === f.name) || null })));
      const sb = sidebar(side, [
        { key: 'settle', title: '结算状态', list: settleList(), value: 'all', onSelect: (v) => { fSettle = v; apply(); } },
        { key: 'flow', title: '生产流程', list: flowList(), value: 'all', onSelect: (v) => { fFlow = v; apply(); } },
        { title: '交付预警', closed: true, list: [{ label: '已超期', value: 'over', color: 'red' }, { label: '今天交付', value: 'today', color: 'orange' }, { label: '明天交付', value: 'tomorrow' }],
          onSelect: () => toast('交付预警筛选（原型）') },
      ]);
      const g = grid(main, {
        groups: biz.orderColumns(), rows: D.workOrders, rowColor: biz.orderRowColor,
        onDblClick: (w) => biz.openOrder(w.no),
        contextMenu: (w) => biz.orderMenu(() => g, w),
      });
      // 新建工单保存后刷新
      el.addEventListener('erp:orders-changed', () => { sb.settle.setList(settleList()); sb.flow.setList(flowList()); apply(); });
    },
  });
  biz.notifyOrdersChanged = () => document.querySelectorAll('.docpage').forEach((p) => p.dispatchEvent(new Event('erp:orders-changed')));

  /* ---------- 经营项目选择器（主项列表 + 子项表格） ---------- */
  biz.itemPicker = function (onPick, { custGroup } = {}) {
    let cat = D.itemCategories[0].code;
    const dlg = dialog({
      title: '选择经营项目', width: 900, height: 520, flush: true,
      body: (b) => {
        const kw = input({ placeholder: '输入编号 / 名称过滤，回车选中第一项' });
        const cats = h('ul.slist', { style: { width: '200px', borderRight: '1px solid var(--line)', overflow: 'auto', padding: '4px' } });
        const right = h('div.fill', { style: { padding: '6px' } });
        b.appendChild(h('div', { style: { padding: '8px', borderBottom: '1px solid var(--line)' } }, kw));
        b.appendChild(h('div.row', { style: { flex: 1, minHeight: 0, alignItems: 'stretch' } }, cats, right));
        const g = grid(right, {
          columns: [{ key: 'code', title: '编号', width: 90 }, { key: 'name', title: '名称', width: 300 }, { key: 'unit', title: '单位', width: 60 },
            { key: 'tier', title: '定价量级', width: 80 }, { key: 'price', title: '标价', type: 'money4' }],
          rows: [], footer: false, rowColor: (r) => (r.unit === '张' ? 'blue' : null),
          onDblClick: (r) => { onPick(r); dlg.close(); },
        });
        const refresh = () => {
          const k = kw.value.trim();
          cats.innerHTML = '';
          D.itemCategories.forEach((c) => cats.appendChild(h('li' + (c.code === cat && !k ? '.active' : ''), { onclick: () => { cat = c.code; kw.value = ''; refresh(); } }, `${c.code}-${c.name}`)));
          g.setRows(D.items.filter((i) => (k ? i.code.includes(k) || i.name.includes(k) : i.cat === cat)));
        };
        kw.addEventListener('input', refresh);
        kw.addEventListener('keydown', (e) => { if (e.key === 'Enter' && g.rows[0]) { onPick(g.rows[0]); dlg.close(); } });
        refresh();
        setTimeout(() => kw.focus());
      },
      buttons: [{ label: '关闭(C)' }],
    });
  };

  /* 工单明细表格（新建工单、工作单窗口共用） */
  function linesGrid(container, lines, onChange) {
    const calc = (l) => { l.amount = ERP.data.util.r2(l.price * l.qty * (l.copies || 1)); };
    const g = grid(container, {
      groups: [
        { title: '经营项目', columns: [{ key: 'code', title: '编号', width: 90 }, { key: 'catName', title: '主项', width: 120 }, { key: 'name', title: '子项', width: 220 }, { key: 'unit', title: '单位', width: 50 }] },
        { title: '价格', columns: [{ key: 'listPrice', title: '标价', type: 'money4' }, { key: 'price', title: '实价', type: 'money4', editable: true, onChange: (l) => { calc(l); onChange(); g.refresh(); } }, { key: 'discount', title: '折扣', type: 'int', width: 60 }] },
        { title: '数量', columns: [{ key: 'copies', title: '份数', type: 'int', width: 60, editable: true, onChange: (l) => { calc(l); onChange(); g.refresh(); } },
          { key: 'qty', title: '计量明细（每份数量）', type: 'int', width: 150, editable: true, onChange: (l) => { calc(l); onChange(); g.refresh(); } },
          { key: 'amount', title: '金额', type: 'money', sum: true }] },
        { title: '其他', columns: [{ key: 'remark', title: '说明', width: 160, editable: true }] },
      ],
      rows: lines, height: 220,
      contextMenu: (l) => [
        { label: '添加项目(Insert)', action: () => add() },
        { label: '删除项目(Del)', disabled: !l, action: () => { lines.splice(lines.indexOf(l), 1); g.setRows(lines); onChange(); } },
      ],
    });
    const add = () => biz.itemPicker((it) => {
      lines.push({ code: it.code, cat: it.cat, catName: D.itemCatName(it.cat), name: it.name, unit: it.unit, listPrice: it.price, price: it.price, discount: 10, copies: 1, qty: 1, amount: it.price, remark: '' });
      g.setRows(lines); onChange();
    });
    return { g, add };
  }

  /* ---------- 新建工单 ---------- */
  ERP.page('newOrder', {
    title: '新建工单', kind: 'dialog',
    render() {
      const now = new Date();
      const order = { custCode: '000000', custName: '散户', group: '普通', contact: '', phone: '', address: '', task: '', req: '', delivery: '', due: '', lines: [], remark: '', file: '' };
      let totalEl;
      const recalc = () => { totalEl.textContent = F.money(order.lines.reduce((s, l) => s + l.amount, 0)); };
      dialog({
        title: '新建工单', width: 1000, height: 720,
        banner: '为客户新开工作单，如果有需要，您可同时进行客户资料新建。',
        body: (b) => {
          const custBox = h('div');
          ERP.ui.itabs(custBox, [
            { title: '默认客户(1)', render: (p) => {
              const cust = input({ value: '000000/散户/-', readOnly: true });
              p.append(field('客户', cust, { lw: 40 }), h('div.formgrid.c3',
                field('人员', input({ oninput: (e) => (order.contact = e.target.value) }), { lw: 40 }),
                field('电话', input({ oninput: (e) => (order.phone = e.target.value) }), { lw: 40 }),
                field('地址', input({ oninput: (e) => (order.address = e.target.value) }), { lw: 40 })));
            } },
            { title: '选老客户(2)', render: (p) => {
              const kw = input({ placeholder: '输入客户编号 / 名称 / 电话 / 拼音首字母' });
              const chosen = h('span.muted', '尚未选择');
              p.append(h('div.row', kw, btn('读卡(D)', () => toast('请将 IC 卡放到读卡器（原型）'), 'sm'), chosen));
              const g = grid(p, { columns: [{ key: 'code', title: '编号', width: 70 }, { key: 'type', title: '类型', width: 60 }, { key: 'name', title: '名称', width: 300 }, { key: 'groupName', title: '分组', width: 180 }, { key: 'phone', title: '手机', width: 120 }],
                rows: D.customers.slice(1), height: 150, footer: false,
                onSelect: (c) => { Object.assign(order, { custCode: c.code, custName: c.name, group: c.groupName, contact: c.contact, phone: c.phone, address: c.address }); chosen.textContent = `已选：${c.code}/${c.name}`; chosen.className = 'c-green'; } });
              kw.addEventListener('input', () => { const k = kw.value.trim(); g.setRows(D.customers.slice(1).filter((c) => !k || c.code.includes(k) || c.name.includes(k) || c.phone.includes(k))); });
            } },
            { title: '建新客户(3)', render: (p) => {
              const nm = input(), ph = input();
              const grp = select(D.groups.map((x) => [x.code, `${x.code} - ${x.name}`]));
              p.append(h('div.formgrid.c3',
                field('客户', nm, { lw: 40 }), field('电话', ph, { lw: 40 }), field('分组', grp, { lw: 40 }),
                field('类型', h('div.row', h('label.chk', h('input', { type: 'radio', name: 'nct', checked: true }), '个人'), h('label.chk', h('input', { type: 'radio', name: 'nct' }), '机构')), { lw: 40 }),
                field('来源', select(['互联网', '老客户介绍', '路过', '电话', '其他']), { lw: 40 }), field('地址', input(), { lw: 40 })));
              const sync = () => Object.assign(order, { custCode: 'NEW', custName: nm.value, phone: ph.value, group: D.groupName(grp.value), newCustomer: true });
              [nm, ph, grp].forEach((x) => x.addEventListener('change', sync));
            } },
          ]);
          custBox.firstChild.style.flex = '0 0 auto';
          const lineBox = h('div.col');
          const lg = linesGrid(lineBox, order.lines, recalc);
          totalEl = h('b.c-red', '0.00');
          b.append(
            h('div.fieldset', custBox),
            h('div.formgrid.c3',
              field('任务', select(D.tasks, { onchange: (e) => (order.task = e.target.value) }), { lw: 40 }),
              field('交付', input({ type: 'datetime-local', onchange: (e) => (order.due = e.target.value) }), { lw: 40 }),
              field('取送要求', select(D.deliveryTypes, { onchange: (e) => (order.delivery = e.target.value) }), { lw: 60 })),
            field('要求', h('textarea.inp', { rows: 3, oninput: (e) => (order.req = e.target.value) }), { lw: 40 }),
            h('div.row', h('b', '明细'), btn('＋ 添加项目', () => lg.add(), 'sm'), h('span.muted', '双击单元格可修改实价/份数/数量；右键可删除'), h('span.grow'), '合计：', totalEl),
            lineBox,
            h('div.formgrid.c2',
              field('文件', h('div.row', input({ placeholder: '客户文件所在文件夹', oninput: (e) => (order.file = e.target.value) }), btn('浏览…', () => toast('选择文件夹（Web 版改为上传附件）'), 'sm')), { lw: 40 }),
              field('备注', input({ oninput: (e) => (order.remark = e.target.value) }), { lw: 40 })));
        },
        leftButtons: [{ label: '☐ 自动打印', action: () => { toast('保存后自动打印工单'); return false; } }],
        buttons: [
          { label: '✔ 确定(S)', primary: true, action: (close) => {
            if (order.custCode === 'NEW' && !order.custName) { toast('请填写新客户名称'); return false; }
            const seq = String(D.workOrders.length + 1).padStart(5, '0');
            const no = `GD${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${seq}`;
            if (order.custCode === 'NEW') {
              const code = String(1400 + D.customers.length);
              D.customers.push({ code, name: order.custName, group: '10', groupName: order.group, type: '个人', phone: order.phone, contact: '', address: '', debt: 0, created: now });
              order.custCode = code;
            }
            const amount = order.lines.reduce((s, l) => s + l.amount, 0);
            D.workOrders.unshift(Object.assign({}, order, { no, amount, paid: 0, unpaid: amount, settleStatus: amount ? '尚未结算' : '0元空单',
              flow: '排队', handler: '', created: now, due: order.due ? new Date(order.due) : null, receptionist: D.currentUser.name, audited: false, orderType: '' }));
            biz.notifyOrdersChanged();
            close();
            toast('工单已创建：' + no);
            biz.openOrder(no);
          } },
          { label: '✕ 关闭(C)' },
        ],
      });
    },
  });

  /* ---------- 工作单窗口 ---------- */
  ERP.page('orderDetail', { title: '工作单', kind: 'dialog', render: (_, p) => biz.openOrder(p.no) });

  biz.openOrder = function (no) {
    let idx = D.workOrders.findIndex((w) => w.no === no);
    if (idx < 0) return toast('未找到工单 ' + no);
    let dlg;
    const show = () => {
      const w = D.workOrders[idx];
      const lines = w.lines.map((l) => Object.assign({}, l));
      const ro = w.audited;
      let sumEls = {};
      const recalc = () => {
        const list = lines.reduce((s, l) => s + l.listPrice * l.qty * (l.copies || 1), 0), sale = lines.reduce((s, l) => s + l.amount, 0);
        sumEls.list.value = F.money(list); sumEls.sale.value = F.money(sale); sumEls.real.value = F.money(sale);
        sumEls.paid.value = F.money(w.paid); sumEls.unpaid.value = F.money(sale - w.paid);
      };
      const tb = (label, color, action, disabled) => h('button.rbtn', { disabled, style: disabled ? { opacity: .4 } : null, onclick: action }, h('span.ico', { style: { background: color, width: '28px', height: '28px', fontSize: '14px' } }, label[0]), h('span', label));
      const refreshList = () => biz.notifyOrdersChanged();
      if (dlg) dlg.close();
      dlg = dialog({
        title: `${w.no}-工作单`, width: 1180, height: 760, flush: true,
        body: (b) => {
          const C = { gray: '#a8a29e', sky: '#38a3d6', red: '#e8424a', orange: '#f08a24', green: '#22a559', gold: '#e0a21a', blue: '#3b82f6' };
          b.append(h('div.ribbon', { style: { minHeight: '64px' } },
            h('div.rgroup', h('div.items', tb('撤销', C.gray, null, true), tb('刷新', C.sky, show), tb('删除', C.red, () => ERP.ui.confirm(`确定删除工单 ${w.no}？`, () => { D.workOrders.splice(idx, 1); dlg.close(); refreshList(); toast('已删除'); }), ro)), h('div.gtitle', '编辑')),
            h('div.rgroup', h('div.items', tb('前一单', C.sky, () => { if (idx > 0) { idx--; show(); } }), tb('后一单', C.sky, () => { if (idx < D.workOrders.length - 1) { idx++; show(); } })), h('div.gtitle', '导航')),
            h('div.rgroup', h('div.items', tb('收款结算', C.orange, () => biz.settle(w, () => { show(); refreshList(); })), tb('【收款码】', C.sky, () => biz.payCode(w)), tb('结算过程', C.gray, () => biz.settleHistory(w)), tb('复制工单', C.sky, () => toast('已复制为新工单（原型）'))), h('div.gtitle', '业务')),
            h('div.rgroup', h('div.items', tb('保存', C.gold, () => { w.lines = lines; w.amount = lines.reduce((s, l) => s + l.amount, 0); w.unpaid = w.amount - w.paid; refreshList(); toast('已保存'); }, ro), tb('打印', C.green, () => window.print()),
              tb(w.audited ? '反审核' : '审核', C.red, () => { w.audited = !w.audited; toast(w.audited ? '已审核：单据不可再修改/删除' : '已反审核'); show(); refreshList(); })), h('div.gtitle', '关键')),
            h('div.rgroup', h('div.items', tb('流程转单', C.blue, () => biz.flowTransfer(w, () => { show(); refreshList(); })), tb('帮助', C.sky, () => toast('审核快捷键：Ctrl+G'))), h('div.gtitle', '其它'))));
          const body = h('div.dlg-body');
          b.appendChild(body);
          body.append(
            h('div.formgrid.c4',
              field('门店', input({ value: '0 - 本店', readOnly: true }), { lw: 40 }), field('编号', input({ value: w.no, readOnly: true }), { lw: 40 }),
              field('日期', input({ value: F.date(w.created), readOnly: true }), { lw: 40 }), field('经手', select(D.employees.map((e) => e.name), { value: w.receptionist }), { lw: 40 })),
            h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 280px', gap: '14px' } },
              h('div',
                field('客户', input({ value: `${w.custCode}/${w.custName}/-`, readOnly: true }), { lw: 40 }),
                h('div.formgrid.c3', field('人员', input({ value: w.contact, readOnly: ro }), { lw: 40 }), field('电话', input({ value: w.phone, readOnly: ro }), { lw: 40 }), field('地址', input({ value: w.address, readOnly: ro }), { lw: 40 })),
                field('任务', input({ value: w.task, readOnly: ro }), { lw: 40 }),
                h('div.formgrid.c2', field('取送', select(D.deliveryTypes, { value: w.delivery, disabled: ro }), { lw: 40 }), field('交付', input({ type: 'datetime-local', disabled: ro }), { lw: 40 })),
                field('文件', input({ value: w.file, readOnly: ro }), { lw: 40 }),
                field('要求', h('textarea.inp', { rows: 3, value: w.req, readOnly: ro }), { lw: 40 })),
              h('div',
                field('委托', input({ value: F.datetime(w.created), readOnly: true }), { lw: 40 }),
                field('类型', select(D.orderTypes, { value: w.orderType, disabled: ro }), { lw: 40 }),
                h('div', { style: { height: '60px' } }),
                field(h('span.c-red', '流程'), h('b.c-' + D.flowColor(w.flow), w.flow + (w.handler ? ` · ${w.handler}` : '')), { lw: 40 }),
                field('审核', w.audited ? h('span.tag.green', '已审核') : h('span.tag.gray', '未审核'), { lw: 40 }))));
          const lineBox = h('div.col');
          body.appendChild(lineBox);
          const lg = linesGrid(lineBox, lines, () => recalc());
          if (!ro) body.appendChild(h('div.row', btn('＋ 添加项目', () => lg.add(), 'sm')));
          const mk = (k) => (sumEls[k] = input({ readOnly: true, style: { textAlign: 'right', fontFamily: 'var(--mono)' } }));
          body.append(h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px' } },
            field('标售', mk('list'), { lw: 34 }), field('实售', mk('sale'), { lw: 34 }), field('抹零', input({ value: '0.00', readOnly: true, style: { textAlign: 'right' } }), { lw: 34 }),
            field('实收', mk('real'), { lw: 34 }), field(h('span.c-blue', '已结'), mk('paid'), { lw: 34 }), field('未结', mk('unpaid'), { lw: 34 })),
          input({ placeholder: '说明备注', value: w.remark }),
          h('div.muted', { style: { fontSize: '12px' } }, `登记：${w.receptionist} ${F.datetime(w.created)}，最后更新：${D.currentUser.name} ${F.datetime(new Date())}`));
          recalc();
        },
        buttons: null,
      });
    };
    show();
  };

  /* ---------- 收款结算 ---------- */
  biz.settle = function (w, done) {
    const due = ERP.data.util.r2(w.amount - w.paid);
    if (due <= 0) return toast('该工单已完成结算');
    const amt = input({ value: F.money(due), style: { fontSize: '40px', height: '64px', textAlign: 'right', fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--mono)' } });
    const acct = select(['现金>前台钱箱', ...D.accounts.filter((a) => a.parent).map((a) => '银行存款>' + a.name)]);
    const method = select(['现钞', '微信', '支付宝', '刷卡', '转账', '记账', '预存扣款']);
    dialog({
      title: '收款结算', width: 760, banner: '结算工作单实收款项',
      body: h('div.col',
        h('div.fieldset', h('legend', '工单信息'), h('div.row', { style: { justifyContent: 'space-between' } },
          h('span', '实售：', h('b', F.money(w.amount))), h('span', '抹零：', h('b', '0.00')), h('span', '实收：', h('b.c-green', F.money(w.amount))),
          h('span', '已结金额：', h('b.c-blue', F.money(w.paid))), h('span', '此次结算：', h('b.c-red', F.money(due))))),
        h('div', { style: { display: 'grid', gridTemplateColumns: '160px 1fr', gap: '10px' } },
          h('div.fieldset', h('legend', '结算方式'), h('div.col', ...['现金收款', '扫码收款', '记账', '预存扣款'].map((x, i) => h('button.btn' + (i === 0 ? '.primary' : ''), x)))),
          h('div.fieldset', h('legend', '现金收款'),
            field('结算金额', amt, { lw: 64 }), field('入账科目', acct, { lw: 64 }), field('支付方式', method, { lw: 64 }),
            field('业务信息', h('div', { style: { display: 'grid', gridTemplateColumns: 'auto auto', gap: '4px 20px', justifyContent: 'start' } },
              h('label.chk', h('input', { type: 'radio', name: 'bi', checked: true }), '现场结算'), check('打印单据'),
              h('label.chk', h('input', { type: 'radio', name: 'bi' }), '需要送货'), check('已开发票')), { lw: 64 }),
            field('说明备注', input(), { lw: 64 })))),
      leftButtons: [{ label: '找零计算器(L)', action: () => { const got = prompt('客户付款金额：', F.money(due)); if (got) toast(`找零：${F.money(got - amt.value)}`); return false; } }],
      buttons: [
        { label: '✔ 确定(S)', primary: true, action: (close) => {
          const v = Math.min(Number(amt.value) || 0, due);
          w.paid = ERP.data.util.r2(w.paid + v); w.unpaid = ERP.data.util.r2(w.amount - w.paid);
          w.settleStatus = w.unpaid <= 0 ? '完成结算' : '部分结算';
          D.settlements.unshift({ no: 'JS' + Date.now().toString().slice(-9), date: new Date(), custCode: w.custCode, custName: w.custName, handler: D.currentUser.name, method: method.value, amount: v, discount: 0, wipe: 0, orderNo: w.no, audited: true, invoice: false, remark: '' });
          close(); toast(`收款 ${F.money(v)} 成功`); done && done();
        } },
        { label: '✕ 关闭(C)' },
      ],
    });
  };
  biz.settleHistory = function (w) {
    dialog({ title: `结算过程 - ${w.no}`, width: 720, body: (b) => grid(b, {
      columns: [{ key: 'no', title: '结算单号', width: 140 }, { key: 'date', title: '日期', type: 'datetime' }, { key: 'method', title: '方式', width: 80 }, { key: 'amount', title: '金额', type: 'money', sum: true }, { key: 'handler', title: '经手', width: 80 }],
      rows: D.settlements.filter((s) => s.orderNo === w.no), height: 260 }) });
  };

  /* ---------- 工单结算收款码 ---------- */
  biz.payCode = function (w) {
    dialog({
      title: '工单结算收款码 - 智多结算', width: 820, banner: '请选用合适的方式告知客户进行工作单的支付',
      body: h('div', { style: { background: '#ecfdf3', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '14px' } },
        h('div.row', { style: { background: '#16a34a', color: '#fff', padding: '8px 14px', borderRadius: '6px', fontSize: '18px', fontWeight: 700, letterSpacing: '6px' } },
          '扫码自助结算付款', h('span.grow'), h('span', { style: { fontSize: '13px', letterSpacing: 0, color: '#fde047' } }, '【演示模式】扫码了解更多！')),
        h('div.row', { style: { alignItems: 'stretch', marginTop: '12px', gap: '14px' } },
          h('div', { style: { background: '#fff', padding: '10px', borderRadius: '6px' } }, h('div.qr')),
          h('div.col.grow',
            h('div.card', h('div.k', '支付方式 PAYMENT'), h('div.row', check('微信支付'), check('支付宝支付'))),
            h('div.card', h('div.kv', h('b', '业务类型'), '工单结算', h('b', '结算客户'), w.custName, h('b', '业务信息'), '工单：' + w.no)),
            h('div.card.row', h('div.k', '付款金额 AMOUNT'), h('span.grow'), h('b.c-red', { style: { fontSize: '26px' } }, `¥ ${F.money(w.amount - w.paid)}元`)))),
        h('div.row.muted', { style: { marginTop: '10px' } }, '商家门店：0-本店', h('span.grow'), '有效期至：…')),
      leftButtons: [
        { label: '推送收银台(S)', action: () => { toast('已推送至收银台'); return false; } },
        { label: '复制(C)', action: () => { toast('付款链接已复制'); return false; } },
        { label: '保存至桌面(D)', action: () => { toast('已下载收款码图片（原型）'); return false; } },
        { label: '推顾客微信(W)', action: () => { toast('已推送（原型）'); return false; } },
      ],
      buttons: [{ label: '✕ 关闭(C)' }],
    });
  };

  /* ---------- 流程转单 ---------- */
  biz.flowTransfer = function (w, done) {
    let target = D.flows[Math.min(D.flows.length - 1, D.flows.findIndex((f) => f.name === w.flow) + 1)].name;
    let nobody = false, g;
    const emps = D.employees.map((e) => ({ code: e.code, name: e.name, pick: false, amount: 0, count: '' }));
    dialog({
      title: '流程转单', width: 820, height: 600, banner: '将当前工作单转给下一流程的员工继续处理',
      body: (b) => {
        b.append(h('div.fieldset', h('legend', '当前流程'), h('div', '当前生产流程：', h('b', w.flow), '，当前处理员工：', h('b', `【${w.handler || '空'}】`), '。')));
        const flows = h('div.col');
        const renderFlows = () => {
          flows.innerHTML = '';
          D.flows.forEach((f) => flows.appendChild(h('label.chk.c-' + f.color, { style: { padding: '4px 6px', borderRadius: '4px', background: f.name === w.flow ? '#ffedd5' : null } },
            h('input', { type: 'radio', name: 'tf', checked: f.name === target, onchange: () => { target = f.name; } }), `${f.code}-${f.name}` + (f.name === w.flow ? '（当前）' : ''))));
        };
        renderFlows();
        const right = h('div.col', { style: { minHeight: 0 } }, check('无人处理', false, { onchange: (e) => (nobody = e.target.checked) }));
        b.append(h('div', { style: { display: 'grid', gridTemplateColumns: '220px 1fr', gap: '10px', flex: 1, minHeight: 0 } },
          h('div.fieldset', h('legend', '目标流程'), flows), h('div.fieldset', { style: { display: 'flex', flexDirection: 'column' } }, h('legend', '处理员工'), right)));
        g = grid(right, { columns: [{ key: 'pick', title: '处理', type: 'check', editable: true }, { key: 'code', title: '编号', width: 70 }, { key: 'name', title: '员工', width: 100 }, { key: 'amount', title: '金额', type: 'money' }, { key: 'count', title: '单数', width: 60 }], rows: emps, footer: false });
        b.append(field('转单说明', input(), { lw: 64 }));
      },
      buttons: [
        { label: '✔ 确定(S)', primary: true, action: (close) => {
          const who = emps.filter((e) => e.pick).map((e) => e.name);
          w.flow = target; w.handler = nobody ? '' : who.join(',');
          close(); toast(`已转至「${target}」${w.handler ? '：' + w.handler : ''}`); done && done();
        } },
        { label: '✕ 关闭(C)' },
      ],
    });
  };
})();
