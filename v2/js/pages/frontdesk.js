/* 前台：前台业务中心（工单台账）、新建/编辑工单（表单页）、工单详情（详情页）
 * 以及共享业务对话框：收款结算、收款码、流程转单、经营项目选择。其他模块参照本文件的写法。 */
(function () {
  'use strict';
  const { h, btn, link, linkBtn, badge, notice, kv, panel, field, input, money, dateInput, textarea, select, dialog, confirm, toast } = ERP.ui;
  const D = ERP.data, F = ERP.fmt, r2 = D.util.r2;
  const biz = (ERP.biz = ERP.biz || {});

  /* ---------- 状态字典：颜色只辅助，状态文字始终可见 ---------- */
  // 按流程位置取色：首个（排队）中性、最后一个（完工）成功、中间（处理中）信息；流程改名或新增后仍正确
  biz.flowTone = (f) => {
    const i = D.flows.findIndex((x) => x.name === f);
    return i < 0 || i === 0 ? undefined : i === D.flows.length - 1 ? 'success' : 'info';
  };
  biz.settleTone = (s) => ({ 尚未结算: 'warning', 部分结算: 'warning', 完成结算: 'success' }[s]);
  biz.flowBadge = (w) => badge(w.flow || '未知', biz.flowTone(w.flow));
  biz.settleBadge = (w) => badge(w.settleStatus || '未知', biz.settleTone(w.settleStatus));
  biz.auditBadge = (on) => badge(on ? '已审核' : '未审核', on ? 'success' : undefined);
  biz.order = (no) => D.workOrders.find((w) => w.no === no);

  /* 流水号：同前缀已有最大序号 + 1（删除单据后不会与现存单据重号） */
  biz.nextSerial = (list, prefix, width) => {
    const max = list.reduce((m, x) => (String(x.no).startsWith(prefix) ? Math.max(m, +String(x.no).slice(prefix.length) || 0) : m), 0);
    return prefix + String(max + 1).padStart(width, '0');
  };
  /* 工单编号：GD + yyMMdd + 5 位流水 */
  biz.nextOrderNo = (d = new Date()) =>
    biz.nextSerial(D.workOrders, `GD${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`, 5);
  /* 客户编号：现有最大编号 + 5（与客户资料新建一致） */
  biz.nextCustCode = () => String(Math.max(...D.customers.map((c) => +c.code || 0)) + 5);
  biz.recalcOrder = (w) => {
    w.amount = r2(w.lines.reduce((s, l) => s + l.amount, 0));
    w.unpaid = r2(w.amount - w.paid);
    w.settleStatus = w.amount === 0 ? '0元空单' : w.paid <= 0 ? '尚未结算' : w.unpaid <= 0 ? '完成结算' : '部分结算';
  };

  /* 工单台账列（前台、工单记录、生产共用） */
  biz.orderColumns = () => [
    { key: 'no', title: '工单 / 客户', type: 'mono', width: 220, render: (w) => link(w.no, 'orderDetail', { no: w.no }, { ariaLabel: `查看工单 ${w.no}` }), sub: (w) => `${w.custName} · ${w.group}` },
    { key: 'task', title: '制作任务 / 要求', width: 180, render: (w) => w.task || '—', sub: (w) => w.req },
    { key: 'settleStatus', title: '结算状态', render: biz.settleBadge },
    { key: 'flow', title: '生产流程', render: (w) => h('span', biz.flowBadge(w), w.handler ? h('span.apb-erp-muted', w.handler) : null) },
    { key: 'amount', title: '实收（元）', type: 'money', sum: true },
    { key: 'paid', title: '已结（元）', type: 'money', sum: true },
    { key: 'unpaid', title: '未结（元）', type: 'money', sum: true },
    { key: 'created', title: '委托时间', type: 'time', nowrap: true },
  ];

  /* ---------- 前台业务中心 ---------- */
  ERP.page('frontdesk', {
    module: 'front', title: '前台业务中心', desc: '接待中的工作单。结算状态与生产流程分开记录；点工单号查看详情。',
    render(el, params, ctx) {
      ctx.setActions([link('新建工单', 'newOrder', null, { button: true, variant: 'primary' })]);
      const list = ERP.ui.list(el, {
        title: '工作单', note: '按委托时间倒序 · 北京时间', params,
        load: () => D.workOrders,
        sort: (a, b) => b.created - a.created,
        filters: [
          { key: 'q', type: 'search', label: '搜索工单', placeholder: '工单号 / 客户名称 / 制作要求', keys: ['no', 'custName', 'req', 'task'] },
          { key: 'settle', type: 'select', label: '结算状态', options: ['0元空单', '尚未结算', '部分结算', '完成结算'], match: (w, v) => w.settleStatus === v },
          { key: 'flow', type: 'select', label: '生产流程', options: D.flows.map((f) => f.name) },
          { key: 'created', type: 'daterange', label: '委托日期', field: 'created' },
        ],
        columns: biz.orderColumns(),
        rowActions: (w) => [
          link('详情', 'orderDetail', { no: w.no }, { ariaLabel: `查看工单 ${w.no} 详情` }),
          w.unpaid > 0 ? linkBtn('收款', () => biz.settle(w, () => list.reload()), { ariaLabel: `为工单 ${w.no} 收款` }) : null,
          linkBtn('转单', () => biz.flowTransfer(w, () => list.reload()), { ariaLabel: `工单 ${w.no} 流程转单` }),
        ],
        selectable: true,
        batch: [
          { label: '导出所选', onClick: (rows) => ERP.ui.exportCsv('工作单', biz.orderColumns().map((c) => ({ ...c, render: null })), rows) },
          { label: '我来处理', onClick: (rows) => ERP.api.write(() => { rows.forEach((w) => (w.handler = D.currentUser.name)); toast(`已接手 ${rows.length} 张工单。`); list.reload(); }) },
        ],
        emptyTitle: '尚无工作单', emptyText: '新建工单后会显示在这里。', emptyAction: link('新建工单', 'newOrder', null, { button: true, variant: 'primary' }),
      });
    },
  });

  /* ---------- 经营项目选择（onPick 返回 false 表示未添加，不提示“已添加”） ---------- */
  biz.itemPicker = function (onPick) {
    dialog({
      title: '添加经营项目', kicker: '选择主项后点“添加”；可多次添加', wide: true,
      body: (b, close) => {
        const cat = select([['', '全部主项'], ...D.itemCategories.map((c) => [c.code, `${c.code} ${c.name}`])]);
        const kw = input({ type: 'search', placeholder: '编号 / 名称' });
        b.appendChild(h('div.apb-erp-formgrid', field({ label: '经营主项', control: cat }), field({ label: '搜索子项', control: kw })));
        const box = h('div');
        b.appendChild(box);
        const draw = () => {
          const k = kw.value.trim();
          const rows = D.items.filter((i) => (!cat.value || i.cat === cat.value) && (!k || i.code.includes(k) || i.name.includes(k))).slice(0, 60);
          box.replaceChildren();
          ERP.ui.table(box, {
            caption: '经营项目', compact: true, rows,
            columns: [{ key: 'code', title: '编号', type: 'mono' }, { key: 'name', title: '名称' }, { key: 'catName', title: '主项', render: (i) => D.itemCatName(i.cat) }, { key: 'unit', title: '单位' }, { key: 'price', title: '标价（元）', type: 'money' }],
            rowActions: (i) => [linkBtn('添加', () => { if (onPick(i) !== false) toast(`已添加：${i.name}`); }, { ariaLabel: `添加 ${i.name}` })],
            empty: { title: '没有符合条件的项目', text: '换个关键词或主项试试。' },
          });
        };
        cat.addEventListener('change', draw);
        kw.addEventListener('input', draw);
        draw();
      },
      actions: [{ label: '完成', variant: 'primary' }],
    });
  };

  /* 明细编辑表（新建/编辑工单） */
  function linesEditor(container, lines, onChange) {
    const box = h('div');
    container.appendChild(box);
    // 份数为空按 1 份；填 0 即 0（不再被当作 1 份计价）
    const calc = (l) => { l.amount = r2((Number(l.price) || 0) * (Number(l.qty) || 0) * (l.copies === '' || l.copies == null ? 1 : Number(l.copies) || 0)); };
    const num = (l, key, label) => {
      const i = input({ value: l[key], inputmode: 'decimal', class: 'lerp-cell lerp-amount', 'aria-label': `${l.name} ${label}`, style: { width: '96px' } });
      i.addEventListener('change', () => {
        l[key] = Number(i.value) || 0; calc(l);
        const focused = document.activeElement && document.activeElement.getAttribute('aria-label');
        draw(); onChange();
        // 重绘后把焦点还给原单元格（Tab 已移走时还给新位置）
        if (focused) { const back = [...box.querySelectorAll('input')].find((x) => x.getAttribute('aria-label') === focused); if (back) back.focus(); }
      });
      return i;
    };
    function draw() {
      box.replaceChildren();
      ERP.ui.table(box, {
        caption: '工单明细', rows: lines,
        columns: [
          { key: 'code', title: '编号', type: 'mono' }, { key: 'name', title: '项目', render: (l) => h('span', l.name, h('span.apb-erp-muted', `${l.catName} · ${l.unit}`)) },
          { key: 'listPrice', title: '标价（元）', type: 'money' }, { key: 'price', title: '实价（元）', align: 'right', render: (l) => num(l, 'price', '实价') },
          { key: 'copies', title: '份数', align: 'right', render: (l) => num(l, 'copies', '份数') }, { key: 'qty', title: '每份数量', align: 'right', render: (l) => num(l, 'qty', '每份数量') },
          { key: 'amount', title: '金额（元）', type: 'money', sum: true },
        ],
        rowActions: (l) => [linkBtn('移除', () => { lines.splice(lines.indexOf(l), 1); draw(); onChange(); }, { variant: 'danger', ariaLabel: `移除 ${l.name}` })],
        empty: { title: '尚未添加项目', text: '点“添加经营项目”选择打印、装订等项目；也可以先保存为 0 元空单。' },
      });
    }
    draw();
    return { redraw: draw };
  }

  /* ---------- 新建 / 编辑工单（表单页） ---------- */
  ERP.page('newOrder', {
    module: 'front', title: '新建工单', parent: 'frontdesk', desc: '为客户新开工作单；需要时可同时新建客户资料。',
    render(el, params, ctx) {
      const edit = params.no ? biz.order(params.no) : null;
      if (params.no && !edit) return el.appendChild(notice('danger', `找不到工单 ${params.no}，可能已被删除。`, ' ', link('返回前台业务中心', 'frontdesk')));
      if (edit && edit.audited) return el.appendChild(notice('warning', `工单 ${edit.no} 已审核，不能修改。如需修改请先在详情页反审核。`, ' ', link('查看详情', 'orderDetail', { no: edit.no })));
      if (edit) ctx.setTitle(`编辑工单 ${edit.no}`);
      const lines = edit ? edit.lines.map((l) => ({ ...l })) : [];
      // 客户：散户 / 老客户 / 新客户
      let mode = edit ? (edit.custCode === '000000' ? 'walkin' : 'old') : 'walkin';
      const custSel = select(D.customers.filter((c) => c.code !== '000000').map((c) => [c.code, `${c.code} ${c.name}（${c.groupName}）`]), { name: 'custCode', value: edit && edit.custCode !== '000000' ? edit.custCode : undefined });
      const newName = input({ name: 'newName', maxlength: 100 }), newPhone = input({ name: 'newPhone', inputmode: 'tel' }), newGroup = select(D.groups.map((g) => [g.code, `${g.code} ${g.name}`]), { name: 'newGroup' });
      newPhone.dataset.validate = 'phone';
      const fOld = field({ label: '选择客户', control: custSel, help: '可输入首字快速定位。', span: 'all' });
      const fNew = [field({ label: '客户名称', control: newName, help: '企业名或客户称呼，最多 100 个字符。' }), field({ label: '手机', control: newPhone }), field({ label: '客户分组', control: newGroup })];
      const custPanel = h('div.apb-erp-formgrid', fOld, fNew);
      const syncMode = () => {
        fOld.hidden = mode !== 'old';
        fNew.forEach((f) => (f.hidden = mode !== 'new'));
        newName.dataset.required = mode === 'new' ? 'true' : '';
        custSel.dataset.required = mode === 'old' ? 'true' : '';
      };
      const contact = input({ name: 'contact', value: edit ? edit.contact : '' }), phone = input({ name: 'phone', inputmode: 'tel', value: edit ? edit.phone : '' });
      phone.dataset.validate = 'phone';
      const due = dateInput({ name: 'due', value: edit && edit.due ? F.date(edit.due) : '' });
      due.dataset.validate = 'date';
      const totalEl = h('strong.apb-erp-mono', '0.00');
      const upd = () => { totalEl.textContent = F.money(lines.reduce((s, l) => s + l.amount, 0)); };
      const linesBox = h('div');
      const editor = linesEditor(linesBox, lines, upd);
      upd();
      const form = ERP.ui.form({
        ctx, wide: true, submitLabel: edit ? '保存工单' : '创建工单',
        cancel: { href: edit ? ERP.href('orderDetail', { no: edit.no }) : ERP.href('frontdesk'), label: edit ? '返回详情' : '返回列表' },
        sections: [
          { title: '客户', content: [ERP.ui.radios('custMode', [['walkin', '散户（000000）'], ['old', '选老客户'], ['new', '建新客户']], mode, (v) => { mode = v; syncMode(); }), custPanel] },
          { title: '联系与交付', cols: 3, fields: [
            field({ label: '联系人', control: contact }), field({ label: '电话', control: phone }),
            field({ label: '交付日期', control: due, help: '例如 2026-10-21；不填表示未约定。' }),
            field({ label: '制作任务', control: select(D.tasks.map((t) => [t, t || '（未指定）']), { name: 'task', value: edit ? edit.task : '' }) }),
            field({ label: '取送要求', control: select(D.deliveryTypes.map((t) => [t, t || '（未指定）']), { name: 'delivery', value: edit ? edit.delivery : '' }) }),
            field({ label: '工单类型', control: select(D.orderTypes.map((t) => [t, t || '（未指定）']), { name: 'orderType', value: edit ? edit.orderType : '' }) }),
            field({ label: '制作要求', control: textarea({ name: 'req', maxlength: 500, value: edit ? edit.req : '', placeholder: '纸张、尺寸、装订、颜色等' }), help: '最多 500 个字符。', span: 'all' }),
          ] },
          { title: '明细', content: [h('div.apb-erp-row', btn('添加经营项目', () => biz.itemPicker((it) => {
            lines.push({ code: it.code, cat: it.cat, catName: D.itemCatName(it.cat), name: it.name, unit: it.unit, listPrice: it.price, price: it.price, discount: 10, copies: 1, qty: 1, amount: it.price, remark: '' });
            editor.redraw(); upd(); form.dispatchEvent(new Event('input'));
          })), h('span.apb-erp-muted', '合计（元）：'), totalEl), linesBox] },
          { title: '其他', fields: [
            field({ label: '客户文件', control: input({ name: 'file', value: edit ? edit.file : '', placeholder: '文件名或存放位置' }), help: 'Web 版建议改为上传附件，正式版接入文件服务。' }),
            field({ label: '说明备注', control: input({ name: 'remark', maxlength: 200, value: edit ? edit.remark : '' }) }),
          ] },
        ],
        onSubmit: (v) => ERP.api.write(() => {
          // 先校验再改数据：编辑后的合计不能低于已结金额
          const newAmount = r2(lines.reduce((t, l) => t + l.amount, 0));
          if (edit && newAmount < edit.paid) throw new Error(`明细合计 ${F.money(newAmount)} 元低于已结金额 ${F.money(edit.paid)} 元。请先在结算记录中删除多收的结算单`);
          let cust;
          if (mode === 'walkin') cust = D.customer('000000');
          else if (mode === 'old') cust = D.customer(v.custCode);
          else {
            cust = { code: biz.nextCustCode(), name: v.newName.trim(), group: v.newGroup, groupName: D.groupName(v.newGroup), type: '个人', phone: v.newPhone, contact: '', address: '', debt: 0, created: new Date() };
            D.customers.push(cust);
          }
          const w = edit || { no: biz.nextOrderNo(), paid: 0, flow: '排队', handler: '', created: new Date(), receptionist: D.currentUser.name, audited: false, address: '' };
          Object.assign(w, { custCode: cust.code, custName: cust.name, group: cust.groupName, contact: v.contact, phone: v.phone, task: v.task, req: v.req,
            delivery: v.delivery, orderType: v.orderType, due: v.due ? ERP.parseDate(v.due) : null, file: v.file, remark: v.remark, lines, updated: new Date() });
          biz.recalcOrder(w);
          if (!edit) D.workOrders.unshift(w);
          form.markClean();
          toast(edit ? `工单 ${w.no} 已保存。` : `工单 ${w.no} 已创建${mode === 'new' ? `，并新建客户 ${cust.code}` : ''}。`);
          ERP.go('orderDetail', { no: w.no });
        }),
      });
      el.appendChild(panel({ title: edit ? '工单资料' : '新工单' }).el).querySelector('.apb-erp-panelbody').appendChild(form);
      syncMode();
    },
  });

  /* ---------- 工单详情 ---------- */
  ERP.page('orderDetail', {
    module: 'front', title: '工单详情', nav: false, parent: 'frontdesk', smokeParams: { no: 'GD26082210047' },
    render(el, params, ctx) {
      const w = biz.order(params.no);
      if (!w) return el.appendChild(h('section.apb-erp-panel', ERP.ui.empty({ title: `找不到工单 ${params.no || ''}`, text: '可能已被删除，或链接有误。', action: link('返回前台业务中心', 'frontdesk', null, { button: true }) })));
      ctx.setTitle(`工单 ${w.no}`);
      const rerender = () => ERP.reload();
      const i = D.workOrders.indexOf(w);
      ctx.setActions([
        w.unpaid > 0 ? btn('收款结算', () => biz.settle(w, rerender), { variant: 'primary' }) : null,
        w.unpaid > 0 ? btn('收款码', () => biz.payCode(w)) : null,
        btn('流程转单', () => biz.flowTransfer(w, rerender)),
        w.audited ? null : link('编辑', 'newOrder', { no: w.no }, { button: true }),
        btn(w.audited ? '反审核' : '审核', async () => {
          if (!(await confirm(w.audited ? `反审核工单 ${w.no}？反审核后可以修改和删除。` : `审核工单 ${w.no}？审核后不能修改和删除。`, { okLabel: w.audited ? '反审核' : '审核' }))) return;
          await ERP.api.write(() => { w.audited = !w.audited; w.updated = new Date(); });
          toast(w.audited ? '已审核。' : '已反审核。'); rerender();
        }),
        btn('打印', () => window.print()),
      ]);
      if (w.audited) el.appendChild(notice('info', '本工单已审核：资料只读。金额与数量的修改需先反审核。'));
      const p1 = panel({ title: '基础资料', note: `门店 0-本店 · 接待 ${w.receptionist || '未知'}` });
      p1.body.appendChild(kv([
        ['工单编号', h('span.apb-erp-mono', w.no)], ['客户', h('span', link(`${w.custCode} ${w.custName}`, 'customerDetail', { code: w.custCode }), ` · ${w.group}`)],
        ['联系人 / 电话', [w.contact, w.phone].filter(Boolean).join(' · ') || '未提供'], ['委托时间', F.stamp(w.created)],
        ['交付日期', w.due ? F.date(w.due) : '未约定'], ['取送要求', w.delivery || '未指定'],
        ['制作任务', w.task || '未指定'], ['工单类型', w.orderType || '未指定'],
        ['制作要求', w.req || '未提供'], ['客户文件', w.file || '未提供'],
        ['审核', biz.auditBadge(w.audited)], ['说明备注', w.remark || '未提供'],
      ]));
      el.appendChild(p1.el);
      const p2 = panel({ title: '状态', note: '结算状态与生产流程分别记录，互不推断。' });
      p2.body.appendChild(kv([
        ['结算状态', biz.settleBadge(w)], ['生产流程', h('span', biz.flowBadge(w), ' ', w.handler ? `当前处理：${w.handler}` : '当前无人处理')],
        ['实收（元）', h('span.apb-erp-mono', F.money(w.amount))], ['已结（元）', h('span.apb-erp-mono', F.money(w.paid))],
        ['未结（元）', h('strong.apb-erp-mono', F.money(w.unpaid))], ['最后更新', F.stamp(w.updated || w.created)],
      ]));
      el.appendChild(p2.el);
      const p3 = panel({ title: '明细', note: `${w.lines.length} 项`, flush: true });
      ERP.ui.table(p3.body, {
        caption: '工单明细', rows: w.lines,
        columns: [{ key: 'code', title: '编号', type: 'mono' }, { key: 'catName', title: '主项' }, { key: 'name', title: '子项' }, { key: 'unit', title: '单位' },
          { key: 'listPrice', title: '标价（元）', type: 'money' }, { key: 'price', title: '实价（元）', type: 'money' }, { key: 'copies', title: '份数', type: 'num' }, { key: 'qty', title: '每份数量', type: 'num' }, { key: 'amount', title: '金额（元）', type: 'money', sum: true }],
        empty: { title: '没有明细', text: '这是 0 元空单。' },
      });
      el.appendChild(p3.el);
      const p4 = panel({ title: '结算记录', flush: true });
      ERP.ui.table(p4.body, {
        caption: '结算记录', rows: D.settlements.filter((s) => s.orderNo === w.no),
        columns: [{ key: 'no', title: '结算单号', type: 'mono' }, { key: 'date', title: '时间', type: 'time' }, { key: 'method', title: '支付方式' }, { key: 'handler', title: '经手' }, { key: 'amount', title: '金额（元）', type: 'money', sum: true }],
        empty: { title: '尚无结算记录', text: w.amount > 0 ? '点“收款结算”登记收款。' : '0 元空单无需结算。' },
      });
      el.appendChild(p4.el);
      el.appendChild(h('div.apb-erp-row',
        i > 0 ? link('← 上一单', 'orderDetail', { no: D.workOrders[i - 1].no }, { button: true }) : null,
        i < D.workOrders.length - 1 ? link('下一单 →', 'orderDetail', { no: D.workOrders[i + 1].no }, { button: true }) : null,
        w.audited ? null : btn('删除工单', async () => {
          if (!(await confirm(`删除工单 ${w.no}？`, { okLabel: '删除', danger: true, detail: '删除后不能恢复；已有结算记录的工单不能删除。' }))) return;
          if (D.settlements.some((s) => s.orderNo === w.no)) return el.prepend(notice('danger', '不能删除：该工单已有结算记录。请先作废结算单，或改为反审核后调整。'));
          await ERP.api.write(() => D.workOrders.splice(D.workOrders.indexOf(w), 1));
          toast(`工单 ${w.no} 已删除。`); ERP.go('frontdesk');
        }, { variant: 'danger' })));
    },
  });

  /* ---------- 收款结算 ---------- */
  biz.settle = function (w, done) {
    const due = r2(w.amount - w.paid);
    const fin = biz.fin;  // 定义于 finance.js：结算统一入口（记入资金科目 / 生成记账单 / 扣会员卡）
    const amt = money({ value: due.toFixed(2), name: 'amount' });
    amt.dataset.validate = 'money';
    amt._validate = (v) => { const n = Number(v.replace(/,/g, '')); return n <= 0 ? '收款金额需大于 0。' : n > due ? `不能超过未结金额 ${F.money(due)} 元。` : null; };
    const method = select(['现钞', '微信', '支付宝', '刷卡', '转账', '记账', '预存扣款'], { name: 'method' });
    const acct = select(fin.acctOptions(), { name: 'account' });
    const card = D.cards.find((k) => k.custCode === w.custCode);
    const fAcct = field({ label: '入账科目', control: acct });
    const hint = h('p.apb-erp-muted.lerp-spanall');
    const sync = () => {
      const m = method.value, a = fin.methodAcct(m);
      if (a) acct.value = a.code;
      fAcct.hidden = m === '记账' || m === '预存扣款';
      hint.textContent = m === '记账' ? '记账：生成记账单，计入客户欠款，以后在“销账”中收回。'
        : m === '预存扣款' ? (card ? `从会员卡 ${card.cardNo} 扣款，当前余额 ${F.money(card.balance)} 元。` : '该客户没有会员卡，不能预存扣款。')
        : '收款记入所选资金科目。';
    };
    method.addEventListener('change', sync);
    const dlg = dialog({
      title: '收款结算', kicker: `工单 ${w.no} · ${w.custName}`,
      body: (b) => {
        b.appendChild(kv([['实收（元）', F.money(w.amount)], ['已结（元）', F.money(w.paid)], ['本次应收（元）', h('strong.apb-erp-mono', F.money(due))], ['结算后状态', '由收款金额决定']]));
        b.appendChild(ERP.ui.form({
          submitLabel: '确认收款',
          sections: [{ fields: [
            field({ label: '收款金额（元）', control: amt, required: true, help: '可部分收款。' }),
            field({ label: '支付方式', control: method }), fAcct, hint,
            field({ label: '说明备注', control: input({ name: 'remark', maxlength: 200 }), span: 'all' }),
            h('div.lerp-checks.lerp-spanall', ERP.ui.checkbox('打印收据', false, { name: 'print' }), ERP.ui.checkbox('已开发票', false, { name: 'invoice' })),
          ] }],
          moreActions: btn('取消', () => dlg.close()),
          onSubmit: (v) => ERP.api.write(() => {
            const n = r2(Number(v.amount.replace(/,/g, '')));
            const mode = v.method === '记账' ? '记账' : v.method === '预存扣款' ? '预存扣款' : '收款';
            fin.settleAmount(w, n, { mode, a: fin.acctBy(v.account), method: v.method, remark: v.remark, invoice: !!v.invoice });
            dlg.close();
            toast(`已${mode === '记账' ? '记账' : '收款'} ${F.money(n)} 元，工单${w.settleStatus}。`);
            done && done();
          }),
        }));
        sync();
      },
    });
  };

  /* ---------- 收款码 ---------- */
  biz.payCode = function (w) {
    dialog({
      title: '工单收款码', kicker: '智多结算 · 演示模式',
      body: [
        notice('info', '演示：二维码为占位图，不能实际付款。正式版对接微信/支付宝，付款结果以支付回执为准，到账后自动登记结算。'),
        h('div.apb-erp-row', { style: { alignItems: 'flex-start', gap: '24px' } }, h('div.lerp-qr', { role: 'img', 'aria-label': '收款二维码（占位）' }),
          kv([['业务类型', '工单结算'], ['结算客户', w.custName], ['业务信息', h('span.apb-erp-mono', w.no)], ['付款金额（元）', h('strong.lerp-big', F.money(w.unpaid))], ['商家门店', '0-本店'], ['有效期', '生成后 2 小时']])),
      ],
      actions: [
        { label: '复制付款链接', onClick: () => { toast('付款链接已复制（演示）。'); return false; } },
        { label: '推送到收银台', onClick: () => { toast('已推送到收银台（演示）。'); return false; } },
        { label: '关闭', variant: 'primary' },
      ],
    });
  };

  /* ---------- 流程转单 ---------- */
  biz.flowTransfer = function (w, done) {
    const cur = D.flows.findIndex((f) => f.name === w.flow);
    let target = D.flows[Math.min(D.flows.length - 1, cur + 1)].name;
    const picked = new Set();
    let nobody = false;
    const dlg = dialog({
      title: '流程转单', kicker: `工单 ${w.no}`,
      body: (b) => {
        b.appendChild(notice('info', `当前生产流程：${w.flow}；当前处理员工：${w.handler || '无'}。`));
        b.appendChild(h('div.apb-erp-field', h('label', '目标流程'), ERP.ui.radios('flow-' + w.no, D.flows.map((f) => [f.name, `${f.code} ${f.name}${f.name === w.flow ? '（当前）' : ''}`]), target, (v) => (target = v))));
        const emps = h('div.lerp-checks', D.employees.filter((e) => !e.left).map((e) => ERP.ui.checkbox(`${e.code} ${e.name}`, false, { onchange: (ev) => (ev.target.checked ? picked.add(e.name) : picked.delete(e.name)) })));
        b.appendChild(h('fieldset.lerp-fieldset', h('legend', '处理员工（可多选）'), emps));
        b.appendChild(ERP.ui.checkbox('无人处理（放入公共队列）', false, { onchange: (e) => (nobody = e.target.checked) }));
        b.appendChild(field({ label: '转单说明', control: input({ id: 'tf-note-' + w.no, maxlength: 200 }) }));
      },
      actions: [
        { label: '取消' },
        { label: '确认转单', variant: 'primary', onClick: (close) => ERP.api.write(() => {
          w.flow = target; w.handler = nobody ? '' : [...picked].join('、'); w.updated = new Date();
          close(); toast(`已转至「${target}」${w.handler ? '，处理：' + w.handler : ''}。`); done && done();
        }) },
      ],
    });
    return dlg;
  };
})();
