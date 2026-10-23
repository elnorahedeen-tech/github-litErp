/* 生产：生产业务中心（在制工单台账，生产特征 / 流程 / 交付预警筛选）、制作明细记录（工单明细行级）
 * 工单详情、流程转单复用前台（ERP.biz.orderColumns / flowTransfer，页面 orderDetail）。
 * 旧版的前景/背景行颜色改为状态标签；右键菜单与 Ctrl 快捷键改为“操作”列和批量操作。 */
(function () {
  'use strict';
  const { h, btn, link, linkBtn, badge, notice, toast } = ERP.ui;
  const D = ERP.data, F = ERP.fmt;
  const biz = (ERP.biz = ERP.biz || {});

  /* ---------- 交付日期 ----------
   * 模拟数据的工单都未约定交付日期，交付预警无从演示。这里给几张未完工工单补上相对“今天”的交付日期
   * （已超期 / 今天 / 明天 / 3 天后 / 一周后）；只在全部工单都没有交付日期时执行一次。 */
  const DAY = 864e5;
  const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (D.workOrders.every((w) => !w.due)) {
    const today = dayStart(new Date());
    [['GD26101410002', -2], ['GD26092210014', -1], ['GD26101910003', 0], ['GD26092210017', 1], ['GD26091810010', 3], ['GD26082210047', 7]].forEach(([no, n]) => {
      const w = D.workOrders.find((x) => x.no === no);
      if (w) w.due = new Date(today.getTime() + n * DAY);
    });
  }

  /* 距离交付（天）：未约定返回 null（显示“未约定”，不显示成 0）；已超期为负数 */
  const daysToDue = (w) => (w.due ? Math.round((dayStart(new Date(w.due)) - dayStart(new Date())) / DAY) : null);
  const isDone = (w) => w.flow === (D.flows[D.flows.length - 1] || {}).name;
  // 处理员工可能有多位（流程转单用“、”连接，旧数据用“,”）
  const handlers = (w) => (w.handler || '').split(/[、,]/).map((s) => s.trim()).filter(Boolean);
  const isMine = (w) => handlers(w).includes(D.currentUser.name);
  biz.daysToDue = daysToDue;
  biz.isFlowDone = isDone;

  /* 距离交付文字与标签：超期 danger，今天/明天 warning；完工的工单不再预警 */
  const distText = (w) => {
    const d = daysToDue(w);
    if (d == null) return '未约定';
    if (isDone(w)) return '已完工';
    return d < 0 ? `超期 ${-d} 天` : d === 0 ? '今天交付' : d === 1 ? '明天交付' : `${d} 天后`;
  };
  const distBadge = (w) => {
    const d = daysToDue(w);
    if (d == null) return h('span.apb-erp-muted', '未约定');
    if (isDone(w)) return badge('已完工', 'success');
    return badge(distText(w), d < 0 ? 'danger' : d <= 1 ? 'warning' : undefined);
  };

  /* 交付预警（与旧版左侧“交付预警”分组一致，未完工的工单才预警） */
  const WARN = [
    ['over', '已超期', (d) => d < 0], ['today', '今天交付', (d) => d === 0], ['tomorrow', '明天交付', (d) => d === 1], ['soon', '2～3 天内', (d) => d >= 2 && d <= 3],
  ];
  const warnMatch = (w, v) => {
    if (v === 'none') return !w.due;
    const d = daysToDue(w);
    const rule = WARN.find((x) => x[0] === v);
    return d != null && !isDone(w) && !!rule && rule[2](d);
  };
  /* 生产特征：我处理的 / 无人处理 / 未完工 */
  const FEAT = { mine: isMine, nobody: (w) => !w.handler && !isDone(w), open: (w) => !isDone(w) };

  // 我来处理：当前登录员工接手（替换原处理员工，与旧版一致）
  const takeOver = (rows) => ERP.api.write(() => {
    rows.forEach((w) => { w.handler = D.currentUser.name; w.updated = new Date(); });
  });

  /* ---------- 生产业务中心 ---------- */
  ERP.page('prodCenter', {
    module: 'prod', title: '生产业务中心', desc: '在制工单：按生产特征、流程和交付预警筛选；点工单号查看详情，“流程转单”推进到下一流程。',
    render(el, params, ctx) {
      const oc = biz.orderColumns();
      const col = (k) => oc.find((c) => c.key === k);
      const columns = [
        col('no'), col('task'), col('flow'),
        { key: 'orderType', title: '工单类型 / 取送', render: (w) => w.orderType || '未指定', sub: (w) => (w.delivery ? `取送：${w.delivery}` : null) },
        col('created'),
        { key: 'due', title: '交付日期', type: 'date', nowrap: true, render: (w) => (w.due ? F.date(w.due) : '未约定') },
        { key: 'dist', title: '距离交付', nowrap: true, render: distBadge },
        { key: 'receptionist', title: '接待人员', render: (w) => w.receptionist || '未知' },
        { key: 'keepFile', title: '保留文件', render: (w) => {
          // 行内修改：留在原行，保存中禁用，保存后提示
          const cb = h('input.apb-erp-checkbox', { type: 'checkbox', checked: !!w.keepFile, 'aria-label': `工单 ${w.no} 保留客户文件`,
            onchange: async () => {
              cb.disabled = true;
              try { await ERP.api.write(() => { w.keepFile = cb.checked; }, 200); toast(`工单 ${w.no}：${w.keepFile ? '保留' : '不保留'}客户文件。`); }
              finally { cb.disabled = false; }
            } });
          return cb;
        } },
      ];
      // 导出用的纯文字列
      const exportCols = [
        { key: 'no', title: '工单编号' }, { key: 'group', title: '客户分组' }, { key: 'custName', title: '客户名称' }, { key: 'flow', title: '生产流程' }, { key: 'handler', title: '当前处理' },
        { key: 'orderType', title: '工单类型' }, { key: 'task', title: '制作任务' }, { key: 'req', title: '制作要求' }, { key: 'delivery', title: '取送要求' },
        { key: 'created', title: '委托时间', type: 'time' }, { key: 'due', title: '交付日期', type: 'date' }, { key: 'dist', title: '距离交付' }, { key: 'receptionist', title: '接待人员' },
        { key: 'keepText', title: '保留文件' },
      ];
      const exportRows = (rows) => rows.map((w) => ({ ...w, dist: distText(w), keepText: w.keepFile ? '是' : '否' }));
      ctx.setActions([btn('导出筛选结果', () => ERP.ui.exportCsv('生产业务中心', exportCols, exportRows(list.rows)))]);

      // 超期提醒常驻页首（需要处理，不能只给 toast）
      const over = D.workOrders.filter((w) => warnMatch(w, 'over')).length;
      if (over && params.warn !== 'over') el.appendChild(notice('warning', `${over} 张工单已过交付日期仍未完工。`, ' ', link('只看已超期', 'prodCenter', { warn: 'over' })));

      const list = ERP.ui.list(el, {
        title: '生产工单', note: `当前员工：${D.currentUser.name} · 按委托时间倒序 · 北京时间`, params,
        load: () => D.workOrders,
        sort: (a, b) => b.created - a.created,
        filters: [
          { key: 'q', type: 'search', label: '搜索工单', placeholder: '工单号 / 客户 / 制作要求 / 处理员工', keys: ['no', 'custName', 'req', 'task', 'handler'] },
          { key: 'feat', type: 'select', label: '生产特征', options: [['mine', '我处理的'], ['nobody', '无人处理'], ['open', '未完工']], match: (w, v) => (FEAT[v] ? FEAT[v](w) : true) },
          { key: 'flow', type: 'select', label: '生产流程', options: D.flows.map((f) => f.name) },
          { key: 'warn', type: 'select', label: '交付预警', options: [...WARN.map(([v, t]) => [v, t]), ['none', '未约定交付日期']], match: warnMatch },
        ],
        columns,
        rowActions: (w) => [
          link('详情', 'orderDetail', { no: w.no }, { ariaLabel: `查看工单 ${w.no} 详情` }),
          isMine(w) || isDone(w) ? null : linkBtn('我来处理', async () => { await takeOver([w]); toast(`已接手工单 ${w.no}。`); list.reload(); }, { ariaLabel: `接手工单 ${w.no}` }),
          linkBtn('流程转单', () => biz.flowTransfer(w, () => list.reload()), { ariaLabel: `工单 ${w.no} 流程转单` }),
        ],
        selectable: true, idKey: 'no',
        batch: [
          { label: '我来处理', onClick: (rows) => takeOver(rows).then(() => { toast(`已接手 ${rows.length} 张工单。`); list.reload(); }) },
          { label: '导出所选', onClick: (rows) => ERP.ui.exportCsv('生产业务中心', exportCols, exportRows(rows)) },
        ],
        emptyTitle: '尚无工单', emptyText: '前台新建的工作单会出现在这里。', emptyAction: link('去前台新建工单', 'newOrder', null, { button: true }),
      });
    },
  });

  /* ---------- 制作明细记录（工单明细行级） ---------- */
  ERP.page('prodDetail', {
    module: 'prod', title: '制作明细记录', desc: '把工单展开到明细行，按经营项目核对制作数量与金额。',
    render(el, params, ctx) {
      // 展开为明细行：每行带上所属工单的生产信息
      const allLines = () => D.workOrders.flatMap((w) => w.lines.map((l, i) => ({
        id: `${w.no}#${i + 1}`, order: w, no: w.no, seq: i + 1, created: w.created, custName: w.custName, group: w.group,
        flow: w.flow, handler: w.handler, task: w.task, req: w.req, receptionist: w.receptionist,
        code: l.code, cat: l.cat, catName: l.catName || D.itemCatName(l.cat), name: l.name, unit: l.unit, price: l.price,
        copies: l.copies || 1, qty: l.qty, total: (l.copies || 1) * l.qty, amount: l.amount, remark: l.remark,
      })));
      const columns = [
        { key: 'no', title: '工单编号 / 行号', type: 'mono', nowrap: true, render: (r) => link(r.no, 'orderDetail', { no: r.no }, { ariaLabel: `查看工单 ${r.no}` }), sub: (r) => `第 ${r.seq} 行` },
        { key: 'created', title: '委托时间', type: 'time', nowrap: true },
        { key: 'custName', title: '客户名称', width: 180, sub: (r) => r.group },
        { key: 'code', title: '编号', type: 'mono', nowrap: true },
        { key: 'catName', title: '主项', width: 120 },
        { key: 'name', title: '子项', width: 200 },
        { key: 'unit', title: '单位', nowrap: true },
        { key: 'price', title: '实价（元）', type: 'money' },
        { key: 'copies', title: '份数', type: 'num', sum: true },
        { key: 'qty', title: '每份数量', type: 'num', sum: true },
        { key: 'total', title: '制作总数', type: 'num', sum: true },
        { key: 'amount', title: '金额（元）', type: 'money', sum: true },
        { key: 'flow', title: '生产流程', render: (r) => h('span', biz.flowBadge(r), r.handler ? h('span.apb-erp-muted', r.handler) : null) },
        { key: 'task', title: '制作任务 / 要求', width: 160, render: (r) => r.task || '—', sub: (r) => r.req },
        { key: 'receptionist', title: '接待人员' },
        { key: 'remark', title: '说明', render: (r) => r.remark || '—' },
      ];
      const exportCols = columns.map((c) => ({ ...c, render: null, sub: null }));
      ctx.setActions([btn('导出筛选结果', () => ERP.ui.exportCsv('制作明细记录', exportCols, list.rows))]);
      const list = ERP.ui.list(el, {
        title: '制作明细', note: '合计为全部筛选结果 · 委托时间为北京时间', params,
        load: allLines,
        sort: (a, b) => b.created - a.created || a.seq - b.seq,
        filters: [
          { key: 'q', type: 'search', label: '快速查找', placeholder: '工单编号 / 客户 / 项目名称', keys: ['no', 'custName', 'name', 'code'] },
          { key: 'flow', type: 'select', label: '生产流程', options: D.flows.map((f) => f.name) },
          { key: 'cat', type: 'select', label: '经营主项', options: D.itemCategories.map((c) => [c.code, `${c.code} ${c.name}`]) },
          { key: 'created', type: 'daterange', label: '委托日期', field: 'created', preset: 'year' },
        ],
        groups: [{ title: '工单', span: 3 }, { title: '经营项目', span: 4 }, { title: '数量与金额', span: 5 }, { title: '生产', span: 4 }],
        columns, idKey: 'id',
        rowActions: (r) => [
          link('工单详情', 'orderDetail', { no: r.no }, { ariaLabel: `查看工单 ${r.no} 详情` }),
          linkBtn('流程转单', () => biz.flowTransfer(r.order, () => list.reload()), { ariaLabel: `工单 ${r.no} 流程转单` }),
        ],
        emptyTitle: '尚无制作明细', emptyText: '工单添加经营项目后，明细会显示在这里。',
      });
    },
  });
})();
