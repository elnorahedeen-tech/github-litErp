/* 系统：员工资料、经营项目、客户分组、生产流程、会计科目、角色配置、运行参数、打印样式、基础数据、数据导入
 * 旧版中除「员工资料管理」为多文档标签外，其余配置均以（可最大化的）对话框打开，此处保持一致。
 * 所有修改直接作用于内存中的 ERP.data（刷新页面即恢复）。 */
(function () {
  'use strict';
  const { h, grid, dialog, field, input, select, check, btn, toast, contextMenu, itabs } = ERP.ui;
  const D = ERP.data, F = ERP.fmt;
  const biz = (ERP.biz = ERP.biz || {});

  /* ---------- 本模块用到的少量样式（树、权限分区、颜色块、打印样式分组） ---------- */
  if (!document.getElementById('sys-style')) {
    document.head.appendChild(h('style#sys-style', `
      .sys-box { border: 1px solid var(--line); border-radius: var(--radius); background: #fff; overflow: auto; min-height: 0; }
      .sys-tree ul { list-style: none; margin: 0; padding-left: 18px; }
      .sys-tree > ul { padding: 4px; }
      .sys-tree .tn { display: flex; align-items: center; gap: 4px; padding: 2px 6px; border-radius: 4px; cursor: pointer; white-space: nowrap; }
      .sys-tree .tn:hover { background: var(--hover); }
      .sys-tree .tn.sel { background: var(--sel); color: var(--primary-active); font-weight: 600; }
      .sys-tree .tg { width: 14px; text-align: center; color: var(--muted); font-size: 11px; font-family: var(--mono); }
      .sys-perm-sec { display: grid; grid-template-columns: 88px 1fr; gap: 4px 12px; padding: 8px 0; border-bottom: 1px dashed var(--line); }
      .sys-perm-sec .lb { background: var(--primary-3); color: var(--banner-text); font-weight: 700; text-align: center; padding: 2px 0;
        border-radius: 4px; height: 24px; cursor: pointer; letter-spacing: 2px; user-select: none; }
      .sys-perm-sec .lb:hover { background: var(--primary-2); }
      .sys-perm-row { display: flex; flex-wrap: wrap; gap: 4px 18px; padding: 2px 0; }
      .sys-perm-row .chk { min-width: 86px; }
      .sys-sw { display: inline-block; width: 22px; height: 14px; border: 1px solid rgba(0,0,0,.25); border-radius: 2px; flex: 0 0 auto; }
      .sys-ps-sec { font-weight: 700; display: flex; align-items: center; gap: 8px; margin: 10px 0 4px; }
      .sys-ps-sec::after { content: ''; flex: 1; border-top: 1px solid var(--line); }
      .sys-ps-items { display: flex; flex-wrap: wrap; gap: 6px 28px; padding: 4px 14px 8px; }
      .sys-ps-items a { cursor: pointer; color: var(--text); text-decoration: none; }
      .sys-ps-items a:hover { color: var(--primary); text-decoration: underline; }
      .sys-ps-items a.rare { color: var(--muted); }
      .sys-paper { background: #fff; box-shadow: 0 2px 10px rgba(0,0,0,.15); margin: 0 auto; padding: 16px; font-size: 11px; }
      .sys-opt { border: 1px solid var(--line); border-radius: 8px; padding: 12px; cursor: pointer; background: #fff; }
      .sys-opt.on { border-color: var(--primary); background: var(--primary-3); }`));
  }

  /* ---------- 通用小工具 ---------- */
  const ymdSlash = (d) => { d = d && new Date(d); return d && !isNaN(d) ? `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}` : ''; };
  const isoDate = (d) => (d ? F.date(d) : '');
  const yearsSince = (d) => (d ? Math.max(0, new Date().getFullYear() - new Date(d).getFullYear()) : '');
  const box = (style, ...children) => h('div.sys-box', { style }, ...children);
  // 带标题的分组框（旧版 GroupBox）
  const group = (title, ...children) => h('div.fieldset', h('legend', title), ...children);
  // 输入小对话框：fields = [{k, label, value, type, options}]
  function formDialog(title, fields, onOk, { width = 420, banner } = {}) {
    const ctl = {};
    dialog({
      title, width, banner,
      body: h('div.col', fields.map((f) => {
        const c = f.options ? select(f.options, { value: f.value }) : f.type === 'textarea' ? h('textarea.inp', { rows: 3, value: f.value || '' })
          : f.type === 'check' ? h('input', { type: 'checkbox', checked: !!f.value }) : input({ type: f.type || 'text', value: f.value ?? '' });
        ctl[f.k] = c;
        return field(f.label, c, { lw: 72 });
      })),
      buttons: [
        { label: '✔ 确定(S)', primary: true, action: (close) => {
          const v = {};
          for (const k in ctl) v[k] = ctl[k].type === 'checkbox' ? ctl[k].checked : ctl[k].value.trim();
          if (onOk(v) !== false) close();
        } },
        { label: '✕ 关闭(C)' },
      ],
    });
  }
  /* 颜色下拉（色块 + 名称），options: [[value, 名称, css颜色]] */
  function colorSelect(options, value) {
    const sw = h('span.sys-sw');
    const s = select(options.map(([v, n]) => [v, n]), { value });
    const sync = () => { const o = options.find((x) => x[0] === s.value); sw.style.background = o ? o[2] : '#000'; };
    s.addEventListener('change', sync);
    sync();
    return { el: h('div.row', { style: { gap: '6px' } }, sw, s), sel: s, get value() { return s.value; }, set value(v) { s.value = v; sync(); } };
  }
  /* 简单树：nodes = [{label, children, open, ...}]，返回 {refresh, selected, select} */
  function tree(container, nodes, { onSelect, menu, onDblClick } = {}) {
    const root = h('div.sys-tree');
    container.appendChild(root);
    let selected = null;
    const render = () => {
      root.innerHTML = '';
      const build = (list) => h('ul', list.map((n) => {
        const kids = n.children && n.children.length;
        const tn = h('div.tn' + (n === selected ? '.sel' : ''), {
          onclick: () => { selected = n; render(); onSelect && onSelect(n); },
          ondblclick: () => { if (kids) { n.open = !n.open; render(); } else onDblClick && onDblClick(n); },
          oncontextmenu: (e) => { if (!menu) return; e.preventDefault(); selected = n; render(); onSelect && onSelect(n); contextMenu(e.clientX, e.clientY, menu(n)); },
        }, h('span.tg', { onclick: (e) => { e.stopPropagation(); if (kids) { n.open = !n.open; render(); } } }, kids ? (n.open ? '⊟' : '⊞') : '·'),
        h('span', { class: n.cls || '' }, n.label));
        return h('li', tn, kids && n.open ? build(n.children) : null);
      }));
      root.appendChild(build(nodes));
    };
    render();
    root.addEventListener('contextmenu', (e) => { if (!e.defaultPrevented && menu) { e.preventDefault(); contextMenu(e.clientX, e.clientY, menu(null)); } });
    return { el: root, refresh: render, get selected() { return selected; }, select(n) { selected = n; render(); onSelect && onSelect(n); } };
  }
  /* 左侧编号-名称列表（旧版 ListBox），返回 {refresh, select} */
  function listBox(container, getItems, labelOf, onSelect) {
    const ul = h('ul.slist', { style: { padding: '4px' } });
    container.appendChild(ul);
    let cur = null;
    const api = {
      refresh() {
        ul.innerHTML = '';
        getItems().forEach((it) => ul.appendChild(h('li' + (it === cur ? '.active' : ''), { onclick: () => api.select(it) }, labelOf(it))));
      },
      select(it) { cur = it; api.refresh(); onSelect(it); },
      get current() { return cur; },
    };
    api.refresh();
    return api;
  }

  /* ======================================================================
   * 员工资料管理（标签页）
   * ====================================================================== */
  function employeeDialog(emp, done) {
    const isNew = !emp;
    const e = Object.assign({ code: '', name: '', role: D.roles[0], dept: D.depts[1], mobile: '', online: false, mobileLogin: false, locked: false, left: false,
      regular: false, ssn: '', gender: '男', birthday: null, joinDate: new Date(), regularDate: null, remark: '', password: '' }, emp || {});
    if (isNew) {
      const max = Math.max(...D.employees.map((x) => +x.code).filter((n) => n < 5000));
      e.code = String(max + 1).padStart(4, '0');
    }
    const c = {
      code: input({ value: e.code, readOnly: !isNew }), name: input({ value: e.name }),
      role: select(D.roles, { value: e.role }), dept: select(D.depts, { value: e.dept }),
      mobile: input({ value: e.mobile }), gender: select(['男', '女'], { value: e.gender }), ssn: input({ value: e.ssn }),
      birthday: input({ type: 'date', value: isoDate(e.birthday) }), joinDate: input({ type: 'date', value: isoDate(e.joinDate) }),
      regularDate: input({ type: 'date', value: isoDate(e.regularDate) }), remark: h('textarea.inp', { rows: 3, value: e.remark }),
      pwd: input({ type: 'password', placeholder: isNew ? '初始密码（默认 123456）' : '留空表示不修改' }),
    };
    const ck = { mobileLogin: check('允许移动端登录', e.mobileLogin), locked: check('锁定（禁止登录）', e.locked),
      left: check('离职', e.left), regular: check('已转正', e.regular) };
    const val = (k) => ck[k].querySelector('input').checked;
    dialog({
      title: isNew ? '新建员工' : `修改员工 - ${e.code}/${e.name}`, width: 720,
      banner: isNew ? '登记新员工资料，员工编号即登录账号。' : '修改员工资料、角色与登录控制。',
      body: h('div.col',
        group('基础信息', h('div.formgrid.c2',
          field('员工编号', c.code, { lw: 64 }), field('员工姓名', c.name, { lw: 64 }),
          field('员工角色', c.role, { lw: 64 }), field('部门岗位', c.dept, { lw: 64 }),
          field('手机号码', c.mobile, { lw: 64 }), field('登录密码', c.pwd, { lw: 64 }))),
        group('控制', h('div.row', { style: { gap: '24px', flexWrap: 'wrap' } }, ck.mobileLogin, ck.locked, ck.left, ck.regular,
          h('span.muted', '在线：', e.online ? h('b.c-green', '是') : '否'))),
        group('其他', h('div.formgrid.c3',
          field('性别', c.gender, { lw: 52 }), field('生日', c.birthday, { lw: 52 }), field('社保号码', c.ssn, { lw: 52 }),
          field('入职', c.joinDate, { lw: 52 }), field('转正日期', c.regularDate, { lw: 52 })),
        field('说明备注', c.remark, { lw: 64 }))),
      buttons: [
        { label: '✔ 确定(S)', primary: true, action: (close) => {
          const code = c.code.value.trim(), name = c.name.value.trim();
          if (!code || !name) return toast('员工编号和姓名不能为空');
          if (isNew && D.employees.some((x) => x.code === code)) return toast('员工编号已存在：' + code);
          const toDate = (s) => (s ? new Date(s.replace(/-/g, '/')) : null);
          const r = isNew ? {} : emp;
          Object.assign(r, { code, name, role: c.role.value, dept: c.dept.value, mobile: c.mobile.value.trim(), gender: c.gender.value, ssn: c.ssn.value.trim(),
            birthday: toDate(c.birthday.value), joinDate: toDate(c.joinDate.value), regularDate: toDate(c.regularDate.value), remark: c.remark.value,
            mobileLogin: val('mobileLogin'), locked: val('locked'), left: val('left'), regular: val('regular'), online: !!e.online });
          r.age = yearsSince(r.birthday); r.years = yearsSince(r.joinDate);
          if (isNew) D.employees.push(r);
          close(); toast((isNew ? '已新建员工：' : '已保存：') + `${code}/${name}` + (c.pwd.value ? '（密码已设置）' : ''));
          done && done(r);
        } },
        { label: '✕ 关闭(C)' },
      ],
    });
  }
  biz.employeeDialog = employeeDialog;

  ERP.page('employees', {
    title: '员工资料管理',
    render(el) {
      const wrap = h('div.fill', { style: { padding: '6px', gap: '6px' } });
      el.appendChild(wrap);
      let showLeft = true, kw = '';
      const kwIn = input({ placeholder: '编号 / 姓名 / 手机', style: { width: '180px' }, oninput: (e) => { kw = e.target.value.trim(); apply(); } });
      const add = () => employeeDialog(null, (r) => { apply(); g.select(r); });
      const edit = (r) => (r ? employeeDialog(r, apply) : toast('请先选择员工'));
      const del = (r) => {
        if (!r) return toast('请先选择员工');
        if (r.code === '0000') return toast('系统管理员不能删除');
        ERP.ui.confirm(`确定删除员工 ${r.code}/${r.name}？已有业务单据的员工建议改为「离职」。`, () => { D.employees.splice(D.employees.indexOf(r), 1); apply(); toast('已删除'); });
      };
      const toggle = (r, k, label) => { if (!r) return; r[k] = !r[k]; g.refresh(); toast(`${r.name}：${r[k] ? '' : '取消'}${label}`); };
      wrap.appendChild(h('div.row',
        btn('＋ 新建(N)', add, 'sm primary'), btn('修改(M)', () => edit(g.selected), 'sm'), btn('删除(D)', () => del(g.selected), 'sm'),
        btn('重置密码', () => g.selected ? toast(`已将 ${g.selected.name} 的密码重置为 123456`) : toast('请先选择员工'), 'sm'),
        h('span.grow'), check('显示离职员工', true, { onchange: (e) => { showLeft = e.target.checked; apply(); } }), kwIn));
      const ck = (key, title) => ({ key, title, type: 'check', width: 56 });
      const g = grid(wrap, {
        groups: [
          { title: '基础', columns: [
            { key: 'code', title: '员工编号', width: 90 }, { key: 'name', title: '员工姓名', width: 120 },
            { key: 'role', title: '员工角色', width: 80 }, { key: 'dept', title: '部门岗位', width: 120 }, { key: 'mobile', title: '手机号码', width: 120 },
          ] },
          { title: '控制', columns: [ck('online', '在线'), ck('mobileLogin', '移动'), ck('locked', '锁定'), ck('left', '离职'), ck('regular', '转正')] },
          { title: '其他', columns: [
            { key: 'ssn', title: '社保号码', width: 130 }, { key: 'gender', title: '性别', width: 50 },
            { key: 'birthday', title: '生日', width: 90, render: (r) => ymdSlash(r.birthday) },
            { key: 'age', title: '年龄', type: 'int', width: 56 },
            { key: 'joinDate', title: '入职', width: 90, render: (r) => ymdSlash(r.joinDate) },
            { key: 'regularDate', title: '转正日期', width: 90, render: (r) => (r.regularDate ? F.date(r.regularDate) : '') },
            { key: 'years', title: '工龄', type: 'int', width: 56 },
            { key: 'remark', title: '说明备注', width: 200 },
          ] },
        ],
        rows: [], footer: false,
        rowColor: (r) => (r.left ? 'gray' : r.locked ? 'red' : null),
        onDblClick: edit,
        contextMenu: (r) => [
          { label: '新建员工(N)', action: add },
          { label: '修改员工(M)', disabled: !r, action: () => edit(r) },
          { label: '删除员工(D)', disabled: !r, action: () => del(r) },
          '-',
          { label: '重置密码', disabled: !r, action: () => toast(`已将 ${r.name} 的密码重置为 123456`) },
          { label: '允许移动端登录', disabled: !r, checked: r && r.mobileLogin, action: () => toggle(r, 'mobileLogin', '允许移动端登录') },
          { label: '锁定', disabled: !r, checked: r && r.locked, action: () => toggle(r, 'locked', '锁定') },
          { label: '离职', disabled: !r, checked: r && r.left, action: () => toggle(r, 'left', '离职') },
          { label: '强制下线', disabled: !r || !r.online, action: () => { r.online = false; g.refresh(); toast(r.name + ' 已下线'); } },
          '-',
          { label: '导出(E)', action: () => g.exportCsv('员工资料') },
          { label: '刷新(R)', shortcut: 'Ctrl+R', action: () => { apply(); toast('已刷新'); } },
        ],
      });
      function apply() {
        g.setRows(D.employees.filter((r) => (showLeft || !r.left) && (!kw || r.code.includes(kw) || r.name.includes(kw) || (r.mobile || '').includes(kw))));
      }
      apply();
    },
  });

  /* ======================================================================
   * 经营项目设置（最大化窗口：经营主项 + 经营子项 / 项目规格）
   * ====================================================================== */
  // 项目规格（旧版「项目规格」页签），按主项生成示例数据
  const specs = {};
  const specsOf = (cat) => specs[cat] || (specs[cat] = (cat === '10' || cat === '12' || cat === '11'
    ? [['纸张', '普通纸，80g'], ['纸张', '铜版纸，105g'], ['纸张', '铜版纸，128g'], ['纸张', '铜版纸，157g'], ['纸张', '铜版纸，200g'], ['尺寸', 'A4'], ['尺寸', 'A3'], ['面数', '单面'], ['面数', '双面']]
    : cat === '25' ? [['材料', '户外写真'], ['材料', '室内写真'], ['材料', '喷绘布'], ['工艺', '覆亮膜'], ['工艺', '覆哑膜'], ['工艺', '裱 KT 板']]
      : cat === '15' ? [['方式', '胶装'], ['方式', '骑马钉'], ['方式', '铁圈装'], ['封面', '透明胶片'], ['封面', '皮纹纸']]
        : [['规格', '标准'], ['规格', '加大']]).map(([type, name], i) => ({ code: cat + String(i + 1).padStart(2, '0'), type, name, addMode: '不加价', add: 0 })));
  const nextItemCode = (cat) => {
    const codes = D.items.filter((i) => i.cat === cat).map((i) => i.code);
    if (!codes.length) return cat + '0001';
    const max = codes.reduce((a, b) => (+b > +a ? b : a));
    return String(+max + 1).padStart(max.length, '0');
  };

  ERP.page('bizItems', {
    title: '经营项目设置', kind: 'dialog',
    render() {
      let cat = D.itemCategories[0], sub, spec, mainG;
      D.items.forEach((it, i) => { if (it.renamable == null) it.renamable = i < 10; });
      const refreshSub = () => { sub.setRows(D.items.filter((i) => i.cat === cat.code)); spec && spec.setRows(specsOf(cat.code)); };
      const addCat = () => formDialog('新建经营主项', [
        { k: 'code', label: '主项编号', value: String(Math.max(...D.itemCategories.map((c) => +c.code)) + 1) }, { k: 'name', label: '主项名称', value: '' }],
      (v) => {
        if (!v.code || !v.name) return toast('编号和名称不能为空'), false;
        if (D.itemCategories.some((c) => c.code === v.code)) return toast('主项编号已存在'), false;
        D.itemCategories.push({ code: v.code, name: v.name });
        D.itemCategories.sort((a, b) => a.code.localeCompare(b.code));
        mainG.setRows(D.itemCategories); toast('已新建经营主项：' + v.name);
      });
      const addItem = () => {
        const it = { code: nextItemCode(cat.code), cat: cat.code, name: '新项目', unit: '张', tier: '-', price: 0, renamable: false };
        D.items.push(it); refreshSub(); sub.select(it); toast('已添加经营子项 ' + it.code + '，可直接在表格中修改');
      };
      dialog({
        title: '经营项目设置', maximized: true, width: 1200, height: 760, flush: true, banner: '设置对外的经营项目、项目规格信息',
        body: (b) => {
          const left = h('div.col', { style: { minHeight: 0 } }), right = h('div.col', { style: { minHeight: 0 } });
          b.appendChild(h('div', { style: { display: 'grid', gridTemplateColumns: '300px 1fr', gap: '10px', padding: '10px', flex: 1, minHeight: 0 } },
            h('div.fieldset', { style: { display: 'flex', flexDirection: 'column', marginTop: 0 } }, h('legend', '经营主项'), left), right));
          mainG = grid(left, {
            columns: [{ key: 'code', title: '编号', width: 70 }, { key: 'name', title: '名称', width: 180 }],
            rows: D.itemCategories, footer: false, rowNumbers: false,
            onSelect: (c) => { cat = c; refreshSub(); },
            contextMenu: (c) => [
              { label: '新建经营主项(N)', action: addCat },
              { label: '修改主项名称', disabled: !c, action: () => formDialog('修改经营主项', [{ k: 'name', label: '主项名称', value: c.name }], (v) => {
                c.name = v.name; mainG.refresh(); toast('已修改');
              }) },
              { label: '删除经营主项', disabled: !c, action: () => {
                if (D.items.some((i) => i.cat === c.code)) return toast('该主项下还有经营子项，不能删除');
                D.itemCategories.splice(D.itemCategories.indexOf(c), 1); mainG.setRows(D.itemCategories); toast('已删除');
              } },
            ],
          });
          itabs(right, [
            { title: '经营子项', render: (p) => {
              p.appendChild(h('div.row', btn('＋ 添加子项(Insert)', addItem, 'sm'), btn('删除子项(Del)', () => delItem(sub.selected), 'sm'),
                h('span.muted', '单元格可直接修改；可重命名：开单时允许修改项目名称')));
              sub = grid(p, {
                groups: [
                  { title: '核心', columns: [{ key: 'code', title: '编号', width: 90 }, { key: 'name', title: '名称', width: 260, editable: true }, { key: 'unit', title: '单位', width: 60, editable: true }] },
                  { title: '基础', columns: [{ key: 'tier', title: '定价量级', width: 90, editable: true }, { key: 'price', title: '销售单价', type: 'money4', editable: true, width: 100 },
                    { key: 'renamable', title: '可重命名', type: 'check', editable: true, width: 70 }] },
                ],
                rows: [], footer: false,
                contextMenu: (it) => [
                  { label: '添加经营子项(Insert)', action: addItem },
                  { label: '删除经营子项(Del)', disabled: !it, action: () => delItem(it) },
                  '-',
                  { label: '批量调价…', action: () => formDialog('批量调价', [{ k: 'pct', label: '调整比例%', value: '10', type: 'number' }], (v) => {
                    const k = 1 + (+v.pct || 0) / 100;
                    D.items.filter((i) => i.cat === cat.code).forEach((i) => (i.price = Math.round(i.price * k * 10000) / 10000));
                    sub.refresh(); toast(`「${cat.name}」销售单价已调整 ${v.pct}%`);
                  }) },
                  { label: '导出(E)', action: () => sub.exportCsv('经营项目') },
                ],
              });
              function delItem(it) {
                if (!it) return toast('请先选择经营子项');
                ERP.ui.confirm(`确定删除经营子项 ${it.code}/${it.name}？`, () => { D.items.splice(D.items.indexOf(it), 1); refreshSub(); toast('已删除'); });
              }
              refreshSub();
            } },
            { title: '项目规格', render: (p) => {
              p.appendChild(h('div.row', btn('＋ 添加规格', () => { const l = specsOf(cat.code); l.push({ code: cat.code + String(l.length + 1).padStart(2, '0'), type: '规格', name: '新规格', addMode: '不加价', add: 0 }); spec.setRows(l); }, 'sm'),
                h('span.muted', '规格用于开单时组合选择（如纸张 × 尺寸 × 面数），可设置加价')));
              spec = grid(p, {
                columns: [{ key: 'code', title: '规格编号', width: 90 }, { key: 'type', title: '规格类型', width: 100, editable: true }, { key: 'name', title: '规格名称', width: 200, editable: true },
                  { key: 'addMode', title: '加价方式', width: 90, render: (r) => select(['不加价', '按金额', '按比例'], { value: r.addMode, onchange: (e) => (r.addMode = e.target.value) }) },
                  { key: 'add', title: '加价', type: 'money4', editable: true }],
                rows: specsOf(cat.code), footer: false,
                contextMenu: (r) => [{ label: '删除规格', disabled: !r, action: () => { const l = specsOf(cat.code); l.splice(l.indexOf(r), 1); spec.setRows(l); } }],
              });
            } },
          ]);
          mainG.select(cat);
        },
        leftButtons: [{ label: '新建经营主项(N)', action: () => { addCat(); return false; } }],
        buttons: [{ label: '✔ 确定(S)', primary: true, action: (close) => { close(); toast('经营项目已保存'); } }, { label: '✕ 关闭(C)' }],
      });
    },
  });

  /* ======================================================================
   * 客户分组
   * ====================================================================== */
  const NAMED = [['Black', 'Black', '#000000'], ['Crimson', 'Crimson', '#dc143c'], ['Red', 'Red', '#ff0000'], ['DarkOrange', 'DarkOrange', '#ff8c00'],
    ['Goldenrod', 'Goldenrod', '#daa520'], ['ForestGreen', 'ForestGreen', '#228b22'], ['Teal', 'Teal', '#008080'], ['RoyalBlue', 'RoyalBlue', '#4169e1'],
    ['Blue', 'Blue', '#0000ff'], ['HotPink', 'HotPink', '#ff69b4'], ['Purple', 'Purple', '#800080'], ['Gray', 'Gray', '#808080']];
  ERP.page('custGroups', {
    title: '客户分组', kind: 'dialog',
    render() {
      // 工作副本：确定后才写回 ERP.data.groups
      const rows = D.groups.map((g) => Object.assign({ color: 'Black', desc: '', noCash: false, noZeroOpen: false }, g, { _orig: g }));
      let cur = null, lb;
      const c = { code: input({ type: 'number', min: 1, max: 99, style: { width: '120px' } }), name: input(), color: colorSelect(NAMED, 'Black'), desc: h('textarea.inp', { rows: 8 }),
        noCash: h('input', { type: 'checkbox' }), noZeroOpen: h('input', { type: 'checkbox' }) };
      const load = (g) => {
        cur = g;
        c.code.value = g.code; c.name.value = g.name; c.color.value = g.color; c.desc.value = g.desc; c.noCash.checked = g.noCash; c.noZeroOpen.checked = g.noZeroOpen;
      };
      const save = () => {
        if (!cur) return;
        Object.assign(cur, { code: c.code.value.trim(), name: c.name.value.trim(), color: c.color.value, desc: c.desc.value, noCash: c.noCash.checked, noZeroOpen: c.noZeroOpen.checked });
        lb.refresh();
      };
      [c.code, c.name, c.color.sel, c.desc, c.noCash, c.noZeroOpen].forEach((x) => x.addEventListener('change', save));
      dialog({
        title: '客户分组', width: 1000, height: 640, banner: '配置客户的业务分组，为众多营销、查询、统计的功能做基础准备。',
        body: (b) => {
          const left = box({ flex: 1 });
          b.appendChild(h('div', { style: { display: 'grid', gridTemplateColumns: '260px 1fr', gap: '10px', flex: 1, minHeight: 0 } },
            group('客户分组', left),
            h('div.col', { style: { minHeight: 0 } },
              group('基础信息', field('分组编号', h('div.row', c.code, h('span.muted', '两位数字，决定排列顺序')), { lw: 64 }), field('分组名称', c.name, { lw: 64 }),
                field('分组颜色', c.color.el, { lw: 64 }), field('分组描述', c.desc, { lw: 64 })),
              group('预存相关', h('div.row', { style: { gap: '24px' } }, h('label.chk', c.noCash, '预存储值客户禁止使用现金收款结算'), h('label.chk', c.noZeroOpen, '预存可用余额为0时禁止开单'))))));
          lb = listBox(left, () => rows, (g) => `${g.code} - ${g.name}`, load);
          lb.select(rows[0]);
        },
        leftButtons: [
          { label: '新建(N)', action: () => {
            const code = String(Math.min(99, Math.max(...rows.map((g) => +g.code)) + 5));
            const g = { code, name: `新建分组…（${code}）`, discount: 1, color: 'Black', desc: '', noCash: false, noZeroOpen: false };
            rows.push(g); lb.select(g); c.name.focus(); return false;
          } },
          { label: '删除(D)', action: () => {
            if (!cur) return false;
            const used = D.customers.filter((x) => x.group === (cur._orig || {}).code).length;
            if (used) { toast(`该分组下有 ${used} 个客户，不能删除`); return false; }
            rows.splice(rows.indexOf(cur), 1); lb.select(rows[0]); return false;
          } },
        ],
        buttons: [
          { label: '✔ 确定(S)', primary: true, action: (close) => {
            const codes = rows.map((g) => g.code);
            if (codes.some((x) => !x) || new Set(codes).size !== codes.length) return toast('分组编号不能为空或重复');
            // 写回：保持原对象引用（客户的分组编号同步改名）
            const next = rows.map((r) => {
              const o = r._orig || {};
              if (r._orig && o.code !== r.code) D.customers.forEach((x) => { if (x.group === o.code) x.group = r.code; });
              const { _orig, ...rest } = r;
              return Object.assign(o, rest, { short: rest.name.length > 8 ? rest.name.slice(0, 7) + '…' : undefined });
            }).sort((a, b) => a.code.localeCompare(b.code));
            D.groups.splice(0, D.groups.length, ...next);
            D.customers.forEach((x) => (x.groupName = D.groupName(x.group)));
            close(); toast('客户分组已保存');
          } },
          { label: '✕ 关闭(C)' },
        ],
      });
    },
  });

  /* ======================================================================
   * 生产流程设置
   * ====================================================================== */
  const FLOW_COLORS = [['red', 'Crimson', '#dc143c'], ['blue', 'RoyalBlue', '#4169e1'], ['pink', 'HotPink', '#db2777'], ['green', 'ForestGreen', '#228b22'],
    ['orange', 'DarkOrange', '#ea580c'], ['purple', 'Purple', '#7c3aed'], ['gray', 'Gray', '#78716c']];
  ERP.page('prodFlow', {
    title: '生产流程设置', kind: 'dialog',
    render() {
      const rows = D.flows.map((f) => Object.assign({}, f, { _orig: f }));
      let cur = null, lb;
      const c = { code: input({ type: 'number', min: 1, max: 99, style: { width: '120px' } }), name: input(), color: colorSelect(FLOW_COLORS, 'red') };
      const load = (f) => { cur = f; c.code.value = f.code; c.name.value = f.name; c.color.value = f.color; };
      const save = () => { if (!cur) return; Object.assign(cur, { code: c.code.value.trim(), name: c.name.value.trim(), color: c.color.value }); lb.refresh(); };
      [c.code, c.name, c.color.sel].forEach((x) => x.addEventListener('change', save));
      dialog({
        title: '生产流程设置', width: 860, height: 560, banner: '定制企业生产流程规格信息',
        body: (b) => {
          const left = box({ flex: 1 });
          b.appendChild(h('div', { style: { display: 'grid', gridTemplateColumns: '320px 1fr', gap: '10px', flex: 1, minHeight: 0 } },
            group('生产流程', left),
            group('流程信息', field('流程编号', c.code, { lw: 64 }), field('流程名称', c.name, { lw: 64 }), field('流程颜色', c.color.el, { lw: 64 }),
              h('div.note', { style: { marginTop: '12px' } }, '流程按编号顺序流转：最小编号为新单默认流程（排队），最大编号视为「完工」。流程颜色用于各工单列表的行颜色。'))));
          lb = listBox(left, () => rows, (f) => h('span.c-' + f.color, `${f.code}-${f.name}`), load);
          lb.select(rows[0]);
        },
        leftButtons: [
          { label: '新建(N)', action: () => {
            const f = { code: String(Math.min(99, Math.max(...rows.map((x) => +x.code)) + 5)), name: '新流程', color: 'orange' };
            rows.push(f); lb.select(f); c.name.select(); return false;
          } },
          { label: '删除(D)', action: () => {
            if (!cur) return false;
            const used = cur._orig ? D.workOrders.filter((w) => w.flow === cur._orig.name).length : 0;
            if (used) { toast(`有 ${used} 张工单处于该流程，不能删除`); return false; }
            if (rows.length <= 2) { toast('至少保留两个流程'); return false; }
            rows.splice(rows.indexOf(cur), 1); lb.select(rows[0]); return false;
          } },
        ],
        buttons: [
          { label: '✔ 确定(S)', primary: true, action: (close) => {
            if (rows.some((f) => !f.code || !f.name) || new Set(rows.map((f) => f.name)).size !== rows.length) return toast('流程编号/名称不能为空，名称不能重复');
            const next = rows.map((r) => {
              const o = r._orig || {};
              if (r._orig && o.name !== r.name) D.workOrders.forEach((w) => { if (w.flow === o.name) w.flow = r.name; });
              return Object.assign(o, { code: r.code, name: r.name, color: r.color });
            }).sort((a, b) => +a.code - +b.code);
            D.flows.splice(0, D.flows.length, ...next);
            biz.notifyOrdersChanged && biz.notifyOrdersChanged();
            close(); toast('生产流程已保存');
          } },
          { label: '✕ 关闭(C)' },
        ],
      });
    },
  });

  /* ======================================================================
   * 会计科目设置（资产类 / 损益类 树）
   * ====================================================================== */
  let coa = null;
  const buildCoa = () => {
    const n = (code, name, children, extra) => Object.assign({ code, name, children: children || [], dir: code[0] === '6' && /^6[0-3]/.test(code) ? '贷' : '借' }, extra);
    const banks = D.accounts.filter((a) => a.parent === '1002').map((a) => n(a.code, a.name, [], { acc: a }));
    return {
      asset: [
        n('1001', '现金', [n('1001001', '前台钱箱'), n('1001002', '财务保险柜')]), n('1002', '银行存款', banks),
        n('1122', '应收账款', [n('1122001', '客户应收'), n('1122002', '员工借款')]), n('1123', '预付账款', [n('1123001', '预付货款')]),
        n('1231', '其他应收款'), n('1401', '材料采购'), n('1403', '原材料'), n('1406', '库存商品'), n('1412', '包装物及低值易耗品'),
        n('1501', '待摊费用'), n('1601', '固定资产'), n('1602', '累计折旧'),
      ],
      pl: [
        n('6001', '主营业务收入', [n('6001001', '图文快印收入'), n('6001002', '广告制作收入'), n('6001003', '设计服务收入')]),
        n('6051', '其他业务收入', D.incomeTypes.map((t, i) => n('6051' + String(i + 1).padStart(3, '0'), t))),
        n('6301', '营业外收入'), n('6401', '主营业务成本', [n('6401001', '材料成本'), n('6401002', '外协加工')]),
        n('6601', '销售费用', D.expenseTypes.map((t, i) => n('6601' + String(i + 1).padStart(3, '0'), t))),
        n('6602', '管理费用'), n('6603', '财务费用', [n('6603001', '手续费'), n('6603002', '利息')]), n('6711', '营业外支出'),
      ],
    };
  };
  const label = (x) => { x.label = `${x.code}-${x.name}`; x.children.forEach(label); return x; };

  ERP.page('chartOfAccounts', {
    title: '会计科目设置', kind: 'dialog',
    render() {
      coa = coa || buildCoa();
      [...coa.asset, ...coa.pl].forEach(label);
      const findParent = (list, node, p = null) => {
        for (const x of list) { if (x === node) return p || list; const r = findParent(x.children, node, x); if (r) return r; }
        return null;
      };
      const editDlg = (t, parent, node) => {
        const isNew = !node;
        const sibs = parent ? parent.children : null;
        const code = isNew ? (parent ? parent.code + String(Math.max(0, ...sibs.map((x) => +x.code.slice(parent.code.length) || 0)) + 1).padStart(3, '0') : '') : node.code;
        formDialog(isNew ? '新增科目' : '修改科目', [
          { k: 'code', label: '科目编号', value: code }, { k: 'name', label: '科目名称', value: isNew ? '' : node.name },
          { k: 'dir', label: '余额方向', value: isNew ? (parent ? parent.dir : '借') : node.dir, options: ['借', '贷'] },
          { k: 'aux', label: '辅助核算', value: isNew ? '无' : node.aux || '无', options: ['无', '客户', '员工', '供应商'] },
        ], (v) => {
          if (!v.code || !v.name) return toast('编号和名称不能为空'), false;
          if (isNew) {
            const x = label({ code: v.code, name: v.name, dir: v.dir, aux: v.aux, children: [] });
            (parent ? parent.children : coa[t]).push(x);
            if (parent) parent.open = true;
            // 银行存款下的新科目同步为资金账户
            if (parent && parent.code === '1002') D.accounts.push({ code: v.code, name: v.name, type: '银行', parent: '1002', balance: 0 });
            toast('已新增科目：' + x.label);
          } else {
            Object.assign(node, { code: v.code, name: v.name, dir: v.dir, aux: v.aux }); label(node);
            if (node.acc) Object.assign(node.acc, { code: v.code, name: v.name });
            toast('已修改科目');
          }
          trees[t].refresh();
        });
      };
      const trees = {};
      const menu = (t) => (n) => [
        { label: '新增一级科目', action: () => editDlg(t, null, null) },
        { label: '新增下级科目', disabled: !n, action: () => editDlg(t, n, null) },
        { label: '修改科目', disabled: !n, action: () => editDlg(t, null, n) },
        { label: '删除科目', disabled: !n || (n && n.children.length > 0), action: () => ERP.ui.confirm(`确定删除科目 ${n.label}？`, () => {
          const p = findParent(coa[t], n); const list = Array.isArray(p) ? p : p.children;
          list.splice(list.indexOf(n), 1);
          if (n.acc) D.accounts.splice(D.accounts.indexOf(n.acc), 1);
          trees[t].refresh(); toast('已删除');
        }) },
        '-',
        { label: '全部展开', action: () => { const all = (l) => l.forEach((x) => { x.open = true; all(x.children); }); all(coa[t]); trees[t].refresh(); } },
        { label: '全部折叠', action: () => { const all = (l) => l.forEach((x) => { x.open = false; all(x.children); }); all(coa[t]); trees[t].refresh(); } },
      ];
      dialog({
        title: '会计科目设置', width: 820, height: 600, banner: '编制会计科目',
        body: (b) => {
          const info = h('div.muted', { style: { fontSize: '12px' } }, '右键科目可新增下级 / 修改 / 删除；双击末级科目修改。');
          itabs(b, [['asset', '资产类'], ['pl', '损益类']].map(([t, title]) => ({
            title, render: (p) => {
              const bx = box({ flex: 1 });
              p.appendChild(bx);
              trees[t] = tree(bx, coa[t], { menu: menu(t), onDblClick: (n) => editDlg(t, null, n),
                onSelect: (n) => { info.textContent = `${n.label}　余额方向：${n.dir}${n.aux && n.aux !== '无' ? '　辅助核算：' + n.aux : ''}${n.acc ? '　当前余额：' + F.money(n.acc.balance) : ''}`; } });
            },
          })));
          b.appendChild(info);
        },
        buttons: [{ label: '✔ 确定(S)', primary: true, action: (close) => { close(); toast('会计科目已保存'); } }, { label: '✕ 关闭(C)' }],
      });
    },
  });

  /* ======================================================================
   * 角色配置（角色 × 权限）
   * ====================================================================== */
  const STD = ['查看', '新建', '修改', '打印', '查询', '审核', '反审', '冲红', '删除', '导出'];
  const PERMS = {
    '前台': [
      { sec: '业务中心', rows: [['前台业务中心', '前台业务中心（打印导出）', '前台营业日报表', '前台营业日报表（打印导出）']] },
      { sec: '工 作 单', rows: [STD, ['开单时查看客户应收结余', '开单时查看客户预存结余', '查看结算过程', '审核（0元）'], ['流程转单', '变更委托客户', '复制', '自助付款']], discount: true },
      { sec: '结 算 单', rows: [['查看', '新建', '修改', '打印', '查询', '反审_云端（退款）', '导出'], ['变更结算方式', '变更结算金额'],
        ['审核', '审核-现金', '审核-记账', '审核-扣预存', '审核-优惠抵扣'], ['反审', '反审-现金', '反审-记账', '反审-扣预存', '反审-优惠抵扣'],
        ['冲红', '冲红-现金', '冲红-记账', '冲红-扣预存', '冲红-优惠抵扣'], ['删除', '删除-现金', '删除-记账', '删除-扣预存', '删除-优惠抵扣']] },
      { sec: '零 收 单', rows: [STD, ['反审_云端（退款）']] },
      { sec: '会员卡片', rows: [['发行', '刷卡', '修改', '换卡', '查询', '改写', '锁定', '挂失', '调级', '注销'], ['结算时跳过密码验证', '记录查询', '记录导出', '导出']] },
      { sec: '预 存 单', rows: [[...STD, '日志'], ['反审_云端（退款）']] },
      { sec: '退 款 单', rows: [[...STD, '日志']] },
    ],
    '生产': [
      { sec: '业务中心', rows: [['生产业务中心', '生产业务中心（打印导出）', '制作明细记录', '制作明细记录（导出）']] },
      { sec: '生产处理', rows: [['我来处理', '流程转单', '查看全部工单', '查看工单金额', '修改制作要求', '修改交付时间']] },
      { sec: '工单文件', rows: [['打开文件夹', '保留文件', '删除文件', '上传附件']] },
    ],
    '供应': [
      { sec: '供 应 商', rows: [['查看', '新建', '修改', '删除', '导出']] },
      { sec: '采 购 单', rows: [STD] },
      { sec: '入 库 单', rows: [STD] },
      { sec: '库存查询', rows: [['库存余额', '出入库明细', '库存预警']] },
    ],
    '财务': [
      { sec: '业务中心', rows: [['财务业务中心', '智多结算中心', '现金余额', '银行余额', '客户结余', '应收汇总']] },
      { sec: '转 账 单', rows: [STD] },
      { sec: '销 账 单', rows: [STD] },
      { sec: '一般收入', rows: [STD] },
      { sec: '一般支出', rows: [STD] },
      { sec: '期末处理', rows: [['期末结账', '反结账', '会计日历', '客户对账']] },
    ],
    '客户': [
      { sec: '客户资料', rows: [['查看', '新建', '修改', '删除', '导出', '合并'], ['查看电话', '查看地址', '查看应收结余', '变更客户分组', '变更业务员']] },
      { sec: '联络人员', rows: [['查看', '新建', '修改', '删除', '导出']] },
      { sec: '价格管理', rows: [['分组价格查看', '分组价格修改', '协议价格查看', '协议价格修改', '价格复制']] },
    ],
    '系统': [
      { sec: '员工资料', rows: [['查看', '新建', '修改', '删除', '重置密码', '导出']] },
      { sec: '系统配置', rows: [['经营项目', '客户分组', '生产流程', '会计科目', '角色配置'], ['运行参数', '打印样式', '基础数据', '数据导入']] },
    ],
    '报表': [
      { sec: '基础报表', rows: [['报表中心', '业务提醒', '营业收支汇总表', '工单结算汇总表', '经营项目汇总表']] },
      { sec: '客户报表', rows: [['客户价值分析表', '客户新增汇总表', '会员办卡汇总表'], ['客户工单实收排行表', '客户工单均价排行表', '客户工单数量排行表']] },
      { sec: '打印导出', rows: [['打印报表', '导出报表']] },
    ],
    '通用': [
      { sec: '快速查询', rows: [['查询客户', '查询单据', '业务提醒']] },
      { sec: '个人设置', rows: [['修改个人密码', '切换会计期间', '查看服务器时间']] },
    ],
    '【安全】': [
      { sec: '登录控制', rows: [['允许移动端登录', '允许异地登录', '限制登录时段']] },
      { sec: '数据安全', rows: [['查看敏感数据（电话/地址）', '导出数据', '查看他人单据', '修改历史期间单据']] },
    ],
    '扩展': [
      { sec: '云端业务', rows: [['云端业务中心', '在线付款码', '推送收银台', '推顾客微信', '短信通知']] },
    ],
    '超级': [
      { sec: '超级权限', rows: [['超级管理员（拥有全部权限）', '修改已审核单据', '删除历史数据', '数据初始化']] },
    ],
  };
  const permKeys = (tab) => PERMS[tab].flatMap((s) => s.rows.flat().map((p) => `${tab}|${s.sec}|${p}`));
  const allPermKeys = () => Object.keys(PERMS).flatMap(permKeys);
  // 角色元数据与权限（模块内保存，重复打开窗口时保留修改）
  const roleMeta = {};
  const metaOf = (name, i) => {
    if (roleMeta[name]) return roleMeta[name];
    const keys = allPermKeys();
    // 默认权限：综合=全部；其他角色以本角色相关模块为主（固定种子，保证每次一致）
    const home = { '前台': ['前台', '客户', '通用'], '生产': ['生产', '通用'], '财务': ['财务', '前台', '报表', '通用'], '后道': ['生产', '通用'], '设计': ['生产', '前台', '通用'] }[name] || [];
    let s = 7;
    const perms = new Set(keys.filter((k) => {
      s = (s * 9301 + 49297) % 233280;
      const tab = k.split('|')[0];
      if (name === '综合') return tab !== '超级';
      return home.includes(tab) && !/删除|反审|冲红/.test(k) ? s / 233280 < 0.85 : s / 233280 < 0.08;
    }));
    return (roleMeta[name] = { code: String(10000 + (i + 1) * 1000), name, collapse: false, noToolbar: false, prod: ['生产', '后道', '设计', '综合', '前台'].includes(name), enabled: true, perms, maxDiscount: '' });
  };

  ERP.page('roles', {
    title: '角色配置', kind: 'dialog',
    render() {
      D.roles.forEach(metaOf);
      let cur = null, roleList, permPane;
      const roleBox = h('div.col', { style: { width: '110px', flex: '0 0 auto' } });
      const fields = { code: input({ style: { width: '120px' } }), name: input({ style: { width: '140px' } }),
        collapse: h('input', { type: 'checkbox' }), noToolbar: h('input', { type: 'checkbox' }), prod: h('input', { type: 'checkbox' }), enabled: h('span') };
      const syncHead = () => {
        fields.code.value = cur.code; fields.name.value = cur.name; fields.collapse.checked = cur.collapse; fields.noToolbar.checked = cur.noToolbar; fields.prod.checked = cur.prod;
        fields.enabled.replaceChildren(cur.enabled ? h('span.tag.green', '已启用') : h('span.tag.gray', '已停用'));
      };
      fields.code.addEventListener('change', () => (cur.code = fields.code.value.trim()));
      fields.name.addEventListener('change', () => {
        const v = fields.name.value.trim();
        if (!v || (v !== cur.name && roleMeta[v])) { fields.name.value = cur.name; return toast('角色名称不能为空或重复'); }
        const old = cur.name; delete roleMeta[old]; roleMeta[v] = cur; cur.name = v;
        D.roles[D.roles.indexOf(old)] = v; D.employees.forEach((e) => { if (e.role === old) e.role = v; });
        renderRoles();
      });
      ['collapse', 'noToolbar', 'prod'].forEach((k) => fields[k].addEventListener('change', () => (cur[k] = fields[k].checked)));

      // 某个模块页签下的权限分区
      const renderPerms = (tab, pane) => {
        pane.innerHTML = '';
        const body = box({ flex: 1, padding: '4px 12px' });
        pane.appendChild(body);
        for (const s of PERMS[tab]) {
          const boxes = [];
          const rowsEl = h('div', s.rows.map((r) => h('div.sys-perm-row', r.map((p) => {
            const key = `${tab}|${s.sec}|${p}`;
            const cb = h('input', { type: 'checkbox', checked: cur.perms.has(key), onchange: (e) => (e.target.checked ? cur.perms.add(key) : cur.perms.delete(key)) });
            boxes.push([cb, key]);
            return h('label.chk', cb, p);
          }))));
          if (s.discount) rowsEl.appendChild(h('div.sys-perm-row', h('label.chk', '普通客户最大整单折扣', input({ value: cur.maxDiscount, placeholder: '如 8.5', style: { width: '80px' }, onchange: (e) => (cur.maxDiscount = e.target.value) }))));
          // 点击分区标签：全选 / 全不选
          const lb = h('div.lb', { title: '点击全选 / 全不选', onclick: () => {
            const on = !boxes.every(([cb]) => cb.checked);
            boxes.forEach(([cb, key]) => { cb.checked = on; on ? cur.perms.add(key) : cur.perms.delete(key); });
          } }, s.sec);
          body.appendChild(h('div.sys-perm-sec', lb, rowsEl));
        }
      };
      const renderRight = () => {
        syncHead();
        permPane.innerHTML = '';
        itabs(permPane, Object.keys(PERMS).map((tab) => ({ title: tab, render: (p) => renderPerms(tab, p) })));
      };
      const renderRoles = () => {
        roleBox.innerHTML = '';
        roleList = h('ul.slist');
        D.roles.forEach((r, i) => {
          const m = metaOf(r, i);
          roleList.appendChild(h('li' + (m === cur ? '.active' : ''), { style: m.enabled ? null : { color: 'var(--muted)', textDecoration: 'line-through' },
            onclick: () => { cur = m; renderRoles(); renderRight(); } }, r));
        });
        roleBox.append(h('div.muted', { style: { fontSize: '12px', padding: '2px 8px' } }, '角色'), roleList);
      };
      cur = metaOf(D.roles[1] || D.roles[0], D.roles[1] ? 1 : 0);
      dialog({
        title: '角色配置', maximized: true, width: 1200, height: 760, banner: '配置用户的角色配置，角色权限。',
        body: (b) => {
          permPane = h('div.col', { style: { flex: 1, minHeight: 0 } });
          b.appendChild(h('div.row', { style: { alignItems: 'stretch', flex: 1, minHeight: 0, gap: '10px' } },
            box({ width: '120px', flex: '0 0 auto', padding: '4px' }, roleBox),
            h('div.col', { style: { flex: 1, minWidth: 0, minHeight: 0 } },
              group('角色配置',
                h('div.row', { style: { gap: '18px' } }, field('角色编号', fields.code, { lw: 56 }), field('角色名称', fields.name, { lw: 56 }), fields.enabled),
                h('div.row', { style: { gap: '18px', marginTop: '6px' } }, h('span', '界面相关'), h('label.chk', fields.collapse, '默认折叠主菜单'), h('label.chk', fields.noToolbar, '不启用工具栏'), h('label.chk', fields.prod, '参与生产'))),
              h('div.fieldset', { style: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } }, h('legend', '角色权限'), permPane))));
          renderRoles(); renderRight();
        },
        leftButtons: [
          { label: '启用(E)', action: () => { cur.enabled = !cur.enabled; renderRoles(); syncHead(); toast(`角色「${cur.name}」已${cur.enabled ? '启用' : '停用'}`); return false; } },
          { label: '新建角色(N)', action: () => { formDialog('新建角色', [{ k: 'name', label: '角色名称', value: '' }, { k: 'copy', label: '复制权限自', value: '', options: ['', ...D.roles] }], (v) => {
            if (!v.name || roleMeta[v.name]) return toast('角色名称不能为空或重复'), false;
            D.roles.push(v.name);
            const m = metaOf(v.name, D.roles.length - 1);
            m.perms = v.copy ? new Set(roleMeta[v.copy].perms) : new Set();
            cur = m; renderRoles(); renderRight(); toast('已新建角色：' + v.name);
          }); return false; } },
          { label: '删除角色(D)', action: () => {
            const used = D.employees.filter((e) => e.role === cur.name).length;
            if (used) { toast(`有 ${used} 名员工使用该角色，不能删除`); return false; }
            ERP.ui.confirm(`确定删除角色「${cur.name}」？`, () => { D.roles.splice(D.roles.indexOf(cur.name), 1); delete roleMeta[cur.name]; cur = metaOf(D.roles[0], 0); renderRoles(); renderRight(); toast('已删除'); });
            return false;
          } },
        ],
        buttons: [{ label: '✔ 确定(S)', primary: true, action: (close) => { close(); toast(`角色权限已保存（${cur.name}：${cur.perms.size} 项权限）`); } }, { label: '✕ 关闭(C)' }],
      });
    },
  });
  biz.rolePerms = (role) => metaOf(role, D.roles.indexOf(role)).perms;

  /* ======================================================================
   * 运行参数（分组设置表单）
   * ====================================================================== */
  const PARAM_DEFS = [
    { g: '基础', sets: [
      { t: '企业信息', items: [['company', '企业名称', 'text', D.company.name], ['branch', '门店名称', 'text', '0 - 本店'], ['tel', '联系电话', 'text', '0731-88888888'], ['addr', '地址', 'text', '长沙市岳麓区麓山南路 1 号']] },
      { t: '编号规则', items: [['woPrefix', '工作单前缀', 'text', 'GD'], ['jsPrefix', '结算单前缀', 'text', 'JS'], ['noDigits', '流水号位数', 'number', 5], ['custCodeAuto', '客户编号自动生成', 'check', true]] },
    ] },
    { g: '前台', sets: [
      { t: '开单', items: [['defaultCust', '默认客户', 'text', '000000/散户'], ['mustTask', '开单必须填写制作任务', 'check', false], ['mustDue', '开单必须填写交付时间', 'check', false],
        ['autoPrint', '保存后自动打印工单', 'check', false], ['showDebt', '开单时提示客户应收结余', 'check', true], ['priceEdit', '允许修改实价', 'check', true]] },
      { t: '金额', items: [['moneyDigits', '金额小数位数', 'select', '2', ['0', '1', '2']], ['priceDigits', '单价小数位数', 'select', '4', ['2', '3', '4']], ['wipe', '抹零方式', 'select', '不抹零', ['不抹零', '抹角', '抹分', '四舍五入到元']]] },
    ] },
    { g: '结算', sets: [
      { t: '收款', items: [['defMethod', '默认结算方式', 'select', '现金', D.payMethods], ['defAccount', '默认入账科目', 'select', '现金>前台钱箱', ['现金>前台钱箱', ...D.accounts.filter((a) => a.parent).map((a) => '银行存款>' + a.name)]],
        ['autoAudit', '收款后自动审核结算单', 'check', true], ['allowCredit', '允许记账（挂账）', 'check', true], ['creditLimit', '默认信用额度', 'number', 0]] },
      { t: '在线支付', items: [['payWx', '启用微信支付', 'check', true], ['payAli', '启用支付宝支付', 'check', true], ['payExpire', '收款码有效期（分钟）', 'number', 30]] },
    ] },
    { g: '预存', sets: [
      { t: '会员卡', items: [['cardPwd', '刷卡结算需要密码', 'check', true], ['cardGift', '储值赠送比例 %', 'number', 5], ['cardLowWarn', '余额低于此值提醒', 'number', 100], ['cardReader', '读卡器型号', 'select', 'URF-R330', ['URF-R330', 'MW-D8', '无']]] },
    ] },
    { g: '生产', sets: [
      { t: '流程', items: [['autoQueue', '新建工单自动进入第一个流程', 'check', true], ['doneAudit', '完工时自动审核工单', 'check', false], ['warnDays', '交付预警提前天数', 'number', 1],
        ['keepFileDays', '客户文件保留天数', 'number', 30], ['fileRoot', '客户文件根目录', 'text', 'D:\\客户文件']] },
    ] },
    { g: '财务', sets: [
      { t: '会计期间', items: [['period', '当前会计期间', 'text', D.company.period], ['closeDay', '每月结账日', 'number', 25], ['lockAfterClose', '结账后禁止修改本期单据', 'check', true]] },
    ] },
    { g: '打印', sets: [
      { t: '打印机', items: [['ticketPrinter', '小票打印机', 'select', 'POS-80', ['POS-80', 'XP-58', 'Microsoft Print to PDF']], ['a4Printer', 'A4 打印机', 'select', 'HP LaserJet', ['HP LaserJet', 'Canon iR', 'Microsoft Print to PDF']], ['preview', '打印前预览', 'check', true], ['copies', '默认打印份数', 'number', 1]] },
    ] },
    { g: '安全', sets: [
      { t: '登录', items: [['pwdLen', '密码最小长度', 'number', 6], ['lockTimes', '连续输错锁定次数', 'number', 5], ['idleLock', '空闲自动锁屏（分钟）', 'number', 0], ['mobileLogin', '允许移动端登录', 'check', true]] },
      { t: '备份', items: [['autoBackup', '每日自动备份数据库', 'check', true], ['backupTime', '备份时间', 'text', '23:30'], ['backupKeep', '备份保留份数', 'number', 7]] },
    ] },
  ];
  const sysParams = (ERP.sysParams = ERP.sysParams || {});
  PARAM_DEFS.forEach((g) => g.sets.forEach((s) => s.items.forEach(([k, , , v]) => { if (!(k in sysParams)) sysParams[k] = v; })));

  ERP.page('runParams', {
    title: '运行参数', kind: 'dialog',
    render() {
      const draft = Object.assign({}, sysParams);
      let gi = 0;
      dialog({
        title: '运行参数', width: 900, height: 600, banner: '设置系统运行时的各项业务参数，修改后对全部门店与员工生效。',
        body: (b) => {
          const nav = h('ul.slist', { style: { padding: '4px' } }), right = h('div.col', { style: { flex: 1, minWidth: 0, overflow: 'auto' } });
          b.appendChild(h('div.row', { style: { alignItems: 'stretch', flex: 1, minHeight: 0, gap: '10px' } }, box({ width: '140px', flex: '0 0 auto' }, nav), right));
          const show = () => {
            nav.innerHTML = '';
            PARAM_DEFS.forEach((g, i) => nav.appendChild(h('li' + (i === gi ? '.active' : ''), { onclick: () => { gi = i; show(); } }, h('span.ic', '⚙'), g.g)));
            right.innerHTML = '';
            for (const s of PARAM_DEFS[gi].sets) {
              right.appendChild(group(s.t, h('div.formgrid.c2', s.items.map(([k, lbl, type, , opts]) => {
                if (type === 'check') return h('label.chk', { style: { padding: '4px 0' } }, h('input', { type: 'checkbox', checked: !!draft[k], onchange: (e) => (draft[k] = e.target.checked) }), lbl);
                const c = type === 'select' ? select(opts, { value: draft[k] }) : input({ type, value: draft[k] });
                c.addEventListener('change', () => (draft[k] = type === 'number' ? Number(c.value) || 0 : c.value));
                return field(lbl, c, { lw: 140 });
              }))));
            }
          };
          show();
        },
        leftButtons: [{ label: '恢复默认', action: () => { PARAM_DEFS.forEach((g) => g.sets.forEach((s) => s.items.forEach(([k, , , v]) => (draft[k] = v)))); toast('已恢复默认值（确定后生效）'); return false; } }],
        buttons: [
          { label: '✔ 确定(S)', primary: true, action: (close) => {
            const changed = Object.keys(draft).filter((k) => draft[k] !== sysParams[k]).length;
            Object.assign(sysParams, draft);
            if (sysParams.company) D.company.name = sysParams.company;
            close(); toast(changed ? `运行参数已保存（${changed} 项修改）` : '运行参数未修改');
          } },
          { label: '✕ 关闭(C)' },
        ],
      });
    },
  });

  /* ======================================================================
   * 打印样式管理
   * ====================================================================== */
  const STYLE_DOCS = [
    ['财务', '对账单（结算单据-单据记录）', 1], ['财务', '对账单（结算单据-明细记录）', 1], ['财务', '销账单', 1], ['财务', '一般收支单', 0], ['财务', '转账单', 0],
    ['前台', '结算单', 1], ['前台', '营业日报表（仅现金业务明细）', 1], ['前台', '营业日报表（全部的业务明细）', 1], ['前台', '预存单', 1], ['前台', '零收单', 0], ['前台', '退款单', 0], ['前台', '会员卡（卡面）', 0],
    ['生产', '工作单', 1], ['生产', '工作单（小票）', 0], ['生产', '送货单', 0], ['生产', '制作标签', 0],
    ['客户', '客户资料卡', 0], ['客户', '价格表', 0],
  ].map(([sec, name, common]) => ({ sec, name, common: !!common,
    styles: [{ name: '默认样式', paper: /小票|标签/.test(name) ? '80mm 小票' : 'A4', dir: '纵向', def: true }, { name: '简洁样式', paper: 'A5', dir: '横向', def: false }] }));

  function styleEditor(doc) {
    let g;
    const preview = h('div', { style: { flex: 1, background: '#e7e5e4', borderRadius: '6px', padding: '14px', overflow: 'auto' } });
    const drawPreview = (s) => {
      if (!s) return;
      const narrow = /小票/.test(s.paper);
      preview.innerHTML = '';
      preview.appendChild(h('div.sys-paper', { style: { width: narrow ? '220px' : s.dir === '横向' ? '420px' : '300px', minHeight: narrow ? '300px' : s.dir === '横向' ? '290px' : '420px' } },
        h('div', { style: { textAlign: 'center', fontWeight: 700, fontSize: '14px' } }, D.company.name),
        h('div', { style: { textAlign: 'center', marginBottom: '8px' } }, doc.name),
        h('div.kv', h('b', '单号'), 'GD26101910003', h('b', '客户'), '散户', h('b', '日期'), F.date(new Date())),
        h('table', { style: { width: '100%', borderCollapse: 'collapse', marginTop: '8px' } },
          h('tr', ['项目', '数量', '金额'].map((x) => h('th', { style: { borderBottom: '1px solid #999', textAlign: 'left' } }, x))),
          ...[['彩色打印 A4', 10, '20.00'], ['胶装', 1, '10.00']].map((r) => h('tr', r.map((x) => h('td', String(x)))))),
        h('div', { style: { textAlign: 'right', marginTop: '8px', fontWeight: 700 } }, '合计：30.00'),
        h('div.muted', { style: { marginTop: '12px' } }, `${s.name} · ${s.paper} · ${s.dir}`)));
    };
    dialog({
      title: `打印样式 - ${doc.name}`, width: 960, height: 600, banner: '选择默认样式，或启动样式设计器编辑',
      body: (b) => {
        const left = h('div.col', { style: { width: '440px', flex: '0 0 auto', minHeight: 0 } });
        b.appendChild(h('div.row', { style: { alignItems: 'stretch', flex: 1, minHeight: 0, gap: '10px' } }, left, preview));
        g = grid(left, {
          columns: [{ key: 'name', title: '样式名称', width: 140, editable: true }, { key: 'paper', title: '纸张', width: 90 }, { key: 'dir', title: '方向', width: 60 },
            { key: 'def', title: '默认', type: 'check', width: 50 }],
          rows: doc.styles, footer: false, onSelect: drawPreview, onDblClick: (s) => toast(`启动样式设计器：${s.name}（原型）`),
          contextMenu: (s) => [
            { label: '设为默认', disabled: !s, action: () => { doc.styles.forEach((x) => (x.def = x === s)); g.refresh(); toast('已设为默认样式'); } },
            { label: '复制样式', disabled: !s, action: () => { doc.styles.push(Object.assign({}, s, { name: s.name + '-副本', def: false })); g.setRows(doc.styles); } },
            { label: '删除样式', disabled: !s || s.def, action: () => { doc.styles.splice(doc.styles.indexOf(s), 1); g.setRows(doc.styles); toast('已删除'); } },
          ],
        });
        left.appendChild(h('div.row',
          btn('设计(E)', () => toast(`启动样式设计器：${(g.selected || doc.styles[0]).name}（原型）`), 'sm primary'),
          btn('设为默认', () => { const s = g.selected; if (!s) return toast('请先选择样式'); doc.styles.forEach((x) => (x.def = x === s)); g.refresh(); toast('已设为默认样式'); }, 'sm'),
          btn('复制', () => { const s = g.selected || doc.styles[0]; doc.styles.push(Object.assign({}, s, { name: s.name + '-副本', def: false })); g.setRows(doc.styles); }, 'sm'),
          btn('导入…', () => toast('导入样式文件（原型）'), 'sm'), btn('导出…', () => toast('导出样式文件（原型）'), 'sm')));
        g.select(doc.styles.find((x) => x.def) || doc.styles[0]);
      },
      leftButtons: [{ label: '打印预览(V)', action: () => { window.print(); return false; } }],
      buttons: [{ label: '✕ 关闭(C)' }],
    });
  }

  ERP.page('printStyles', {
    title: '打印样式管理', kind: 'dialog',
    render() {
      let commonOnly = true;
      const area = box({ flex: 1, padding: '4px 10px' });
      const draw = () => {
        area.innerHTML = '';
        ['财务', '前台', '生产', '客户'].forEach((sec) => {
          const docs = STYLE_DOCS.filter((d) => d.sec === sec && (!commonOnly || d.common));
          if (!docs.length) return;
          area.append(h('div.sys-ps-sec', sec), h('div.sys-ps-items', docs.map((d) => h('a' + (d.common ? '' : '.rare'), { onclick: () => styleEditor(d), title: '点击编辑样式' }, d.name))));
        });
      };
      draw();
      dialog({
        title: '打印样式管理', width: 980, height: 560, banner: '汇总全部打印样式，并可启动编辑样式',
        body: area,
        leftButtons: [{ label: '☑ 常用样式', action: () => {
          commonOnly = !commonOnly; draw();
          document.querySelectorAll('.dlg-foot button').forEach((x) => { if (/常用样式/.test(x.textContent)) x.textContent = (commonOnly ? '☑' : '☐') + ' 常用样式'; });
          return false;
        } }],
        buttons: [{ label: '✕ 关闭(C)' }],
      });
    },
  });

  /* ======================================================================
   * 基础数据管理（枚举型 / 层次型基础数据）
   * ====================================================================== */
  // link：与 ERP.data 中的数组联动（修改后写回，其他模块即时可见）
  const BD_TYPES = [
    { cat: '客户', types: [['关系等级', ['密切', '较好', '一般', '较差', '未评估'], 1385], ['人员规模', ['1-10人', '11-50人', '51-200人', '200人以上']],
      ['机构类型', ['企业', '政府机关', '事业单位', '学校', '社会团体']], ['价值评估', ['A', 'B', 'C', '未评估']], ['主营行业', ['建筑设计', '教育', '政府', '制造业', '广告传媒', '其他']],
      ['联系人分类', ['决策人', '经办人', '财务', '其他']], ['身份证件', ['居民身份证', '护照', '港澳通行证', '营业执照']], ['信用等级', ['AAA', 'AA', 'A', 'B', 'C']],
      ['来源方式', ['互联网', '老客户介绍', '路过', '电话', '其他']]] },
    { cat: '生产', types: [['制作任务', D.tasks], ['工单类型', D.orderTypes], ['取送要求', D.deliveryTypes], ['计量单位', ['张', '页', '本', '套', '㎡', '个', '盒', '块']]] },
    { cat: '财务', types: [['结算方式', D.payMethods], ['收入类型', D.incomeTypes], ['支出类型', D.expenseTypes], ['发票类型', ['增值税普通发票', '增值税专用发票', '电子发票']]] },
    { cat: '通用', types: [['城市', ['北京', '上海', '广州', '深圳', '长沙', '武汉', '天津', '重庆', '合肥', '漳州']], ['节假日', ['元旦', '春节', '清明', '劳动节', '端午', '中秋', '国庆']]] },
    { cat: '人员', types: [['部门岗位', D.depts], ['学历', ['初中', '高中', '大专', '本科', '硕士']], ['离职原因', ['个人原因', '合同到期', '辞退', '其他']]] },
    { cat: '系统', types: [['门店', ['0 - 本店']], ['单据状态', ['未审核', '已审核', '已冲红']]] },
  ];
  let bdStore = null;
  const initBd = () => BD_TYPES.map((c) => ({
    label: c.cat, open: c.cat === '客户', children: c.types.map(([name, src, start]) => {
      const link = Array.isArray(src) && Object.values(D).includes(src) ? src : null;
      const s = start || 1000;
      return { label: name, link, keepEmpty: link ? link.includes('') : false, children: [],
        entries: src.filter((x) => x !== '').map((x, i) => ({ code: String(s + i * 5), name: x, desc: '' })) };
    }),
  }));
  const writeBack = (t) => { if (t.link) t.link.splice(0, t.link.length, ...(t.keepEmpty ? [''] : []), ...t.entries.map((e) => e.name)); };

  ERP.page('baseData', {
    title: '基础数据管理', kind: 'dialog',
    render() {
      bdStore = bdStore || initBd();
      let type = bdStore[0].children[0], cur = null, lb;
      const c = { code: input({ type: 'number', style: { width: '120px' } }), name: input(), desc: h('textarea.inp', { rows: 12 }) };
      const load = (e) => { cur = e; c.code.value = e ? e.code : ''; c.name.value = e ? e.name : ''; c.desc.value = e ? e.desc : ''; [c.code, c.name, c.desc].forEach((x) => (x.disabled = !e)); };
      const save = () => {
        if (!cur) return;
        const code = c.code.value.trim();
        if (code !== cur.code && type.entries.some((x) => x !== cur && x.code === code)) { c.code.value = cur.code; return toast('编号重复'); }
        Object.assign(cur, { code, name: c.name.value.trim() || cur.name, desc: c.desc.value });
        type.entries.sort((a, b) => +a.code - +b.code);
        writeBack(type); lb.refresh();
      };
      [c.code, c.name, c.desc].forEach((x) => x.addEventListener('change', save));
      const typeInfo = h('div.muted', { style: { fontSize: '12px' } });
      const showType = (t) => {
        if (!t.entries) return;
        type = t;
        typeInfo.textContent = t.link ? `「${t.label}」与业务数据联动：修改后在开单、结算等界面中立即生效。` : `「${t.label}」共 ${t.entries.length} 项`;
        lb.refresh(); load(t.entries[0] || null);
        if (t.entries[0]) lb.select(t.entries[0]);
      };
      dialog({
        title: '基础数据管理', width: 1000, height: 640, banner: '配置各系统共同使用的枚举型、层次型基础数据',
        body: (b) => {
          const typeBox = box({ flex: 1 }), listEl = box({ flex: 1 });
          b.appendChild(h('div', { style: { display: 'grid', gridTemplateColumns: '220px 1fr', gap: '10px', flex: 1, minHeight: 0 } },
            group('数据类型', typeBox),
            h('div.fieldset', { style: { display: 'flex', flexDirection: 'column', marginTop: '8px' } }, h('legend', '数据编辑'),
              h('div', { style: { display: 'grid', gridTemplateColumns: '240px 1fr', gap: '12px', flex: 1, minHeight: 0 } },
                listEl,
                h('div.col', field('编号', h('div.row', c.code, h('span.muted', '请慎重修改')), { lw: 40 }), field('名称', c.name, { lw: 40 }), field('描述', c.desc, { lw: 40 }), typeInfo)))));
          const tr = tree(typeBox, bdStore, { onSelect: showType });
          lb = listBox(listEl, () => type.entries, (e) => `${e.code}-${e.name}`, load);
          tr.select(type);
        },
        leftButtons: [
          { label: '新建(N)', action: () => {
            const code = String(Math.max(995, ...type.entries.map((e) => +e.code)) + 5);
            const e = { code, name: '新' + type.label, desc: '' };
            type.entries.push(e); writeBack(type); lb.select(e); c.name.select(); return false;
          } },
          { label: '删除(D)', action: () => {
            if (!cur) return false;
            ERP.ui.confirm(`确定删除「${cur.code}-${cur.name}」？`, () => { type.entries.splice(type.entries.indexOf(cur), 1); writeBack(type); lb.refresh(); load(null); if (type.entries[0]) lb.select(type.entries[0]); toast('已删除'); });
            return false;
          } },
        ],
        buttons: [{ label: '✕ 关闭(C)', action: (close) => { close(); toast('基础数据已保存'); } }],
      });
    },
  });

  /* ======================================================================
   * 数据导入（向导：类型 → 文件 → 字段对应 → 预览校验 → 完成）
   * ====================================================================== */
  const IMPORT = {
    customers: { label: '客户资料', icon: '客', desc: '客户编号、名称、分组、联系人、电话、地址等',
      fields: [['code', '客户编号', 1], ['name', '客户名称', 1], ['groupName', '客户分组'], ['type', '客户类型'], ['contact', '联系人'], ['phone', '手机'], ['address', '地址'], ['remark', '说明备注']],
      sample: [['客户编号', '客户名称', '分组', '类型', '联系人', '手机号码', '地址', '备注'], ['2001', '长沙理工大学设计学院', '设计院', '机构', '王老师', '13800138001', '长沙市天心区万家丽南路2段960号', ''],
        ['2002', '湖南省测绘院', '政府单位', '机构', '李工', '13900139002', '长沙市岳麓区', '月结'], ['2003', '张三', '普通', '个人', '', '13700137003', '', ''], ['1010', '商务局（更新）', '设计院', '机构', '赵科长', '13600136004', '', ''], ['', '缺少编号的客户', '普通', '', '', '', '', '']] },
    items: { label: '经营项目', icon: '项', desc: '主项、子项编号、名称、单位、定价量级、销售单价',
      fields: [['code', '项目编号', 1], ['catName', '经营主项', 1], ['name', '项目名称', 1], ['unit', '单位'], ['tier', '定价量级'], ['price', '销售单价', 1]],
      sample: [['编号', '主项', '名称', '单位', '量级', '单价'], ['250010', '广告喷绘◎', '车贴（反光膜）', '㎡', '-', '65'], ['350010', '标识标牌◎', '不锈钢腐蚀牌', '块', '-', '180'],
        ['880001', '文创产品', '帆布袋印刷', '个', '-', '18'], ['500020', '标准产品', '', '个', '-', '10']] },
    employees: { label: '员工资料', icon: '员', desc: '员工编号、姓名、角色、部门岗位、手机、性别、入职日期',
      fields: [['code', '员工编号', 1], ['name', '员工姓名', 1], ['role', '员工角色'], ['dept', '部门岗位'], ['mobile', '手机号码'], ['gender', '性别'], ['joinDate', '入职日期']],
      sample: [['工号', '姓名', '角色', '部门', '手机', '性别', '入职日期'], ['0101', '陈晓', '前台', '生产制作>前台', '13511112222', '女', '2026-09-01'],
        ['0102', '刘设计', '设计', '生产制作>设计', '13511113333', '男', '2026-09-15'], ['0103', '周后道', '后道', '生产制作>后道', '', '男', '2026-10-08']] },
  };
  // 简单 CSV 解析（支持引号与逗号/制表符分隔）
  function parseCsv(text) {
    const sep = text.split('\n')[0].includes('\t') ? '\t' : ',';
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; continue; }
      if (ch === '"') q = true;
      else if (ch === sep) { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((x) => x.trim()));
  }
  // 按表头自动匹配：标题包含目标字段名的关键字
  const ALIAS = { code: ['编号', '编码', '工号', '代码'], name: ['名称', '姓名', '客户', '项目'], groupName: ['分组'], type: ['类型'], contact: ['联系人'], phone: ['手机', '电话'],
    address: ['地址'], remark: ['备注', '说明'], catName: ['主项', '大类', '类别'], unit: ['单位'], tier: ['量级'], price: ['单价', '价格'], role: ['角色'], dept: ['部门', '岗位'], mobile: ['手机', '电话'],
    gender: ['性别'], joinDate: ['入职'] };

  ERP.page('dataImport', {
    title: '数据导入', kind: 'dialog',
    render() {
      const st = { step: 0, type: 'customers', fileName: '', header: [], rows: [], map: {}, dup: 'skip', result: null };
      const STEPS = ['选择数据类型', '选择文件', '字段对应', '预览校验', '导入完成'];
      let dlg, stepsEl, pane;
      const autoMap = () => {
        st.map = {};
        IMPORT[st.type].fields.forEach(([k, lbl]) => {
          let idx = st.header.findIndex((x) => x.trim() === lbl);
          if (idx < 0) idx = st.header.findIndex((x) => (ALIAS[k] || []).some((a) => x.includes(a)) && !Object.values(st.map).includes(st.header.indexOf(x)));
          st.map[k] = idx;
        });
      };
      const loadTable = (table, name) => { st.header = table[0] || []; st.rows = table.slice(1); st.fileName = name; autoMap(); draw(); };
      // 转换并校验
      const converted = () => {
        const def = IMPORT[st.type];
        return st.rows.map((r, i) => {
          const o = { _line: i + 2 };
          def.fields.forEach(([k]) => (o[k] = st.map[k] >= 0 ? String(r[st.map[k]] ?? '').trim() : ''));
          const miss = def.fields.filter(([k, , req]) => req && !o[k]).map(([, l]) => l);
          const exists = st.type === 'customers' ? D.customer(o.code) : st.type === 'items' ? D.items.find((x) => x.code === o.code) : D.employees.find((x) => x.code === o.code);
          if (st.type === 'items' && o.price && isNaN(+o.price)) miss.push('销售单价格式');
          o._exists = exists;
          o._status = miss.length ? '错误：缺少' + miss.join('、') : exists ? (st.dup === 'skip' ? '跳过（已存在）' : '覆盖') : '新增';
          return o;
        });
      };
      const doImport = () => {
        const list = converted();
        const res = { add: 0, upd: 0, skip: 0, err: 0 };
        const now = new Date();
        list.forEach((o) => {
          if (o._status.startsWith('错误')) return res.err++;
          if (o._status.startsWith('跳过')) return res.skip++;
          if (st.type === 'customers') {
            const grp = D.groups.find((g) => g.name === o.groupName || g.code === o.groupName) || D.groups[0];
            const v = { code: o.code, name: o.name, group: grp.code, groupName: grp.name, type: o.type || '机构', contact: o.contact, phone: o.phone, address: o.address, remark: o.remark };
            if (o._exists) { Object.assign(o._exists, v); res.upd++; } else {
              D.customers.push(Object.assign({ tel: '', city: '', owner: D.currentUser.name, value: '未评估', debt: 0, writeOffPending: 0, prestoreBalance: 0, created: now, lastAudit: null,
                invoiceTitle: o.name, taxNo: '', bank: '', creditLimit: 0, settleType: '现结' }, v)); res.add++;
            }
          } else if (st.type === 'items') {
            let cat = D.itemCategories.find((c) => c.name === o.catName || c.code === o.catName);
            if (!cat) { cat = { code: String(Math.max(...D.itemCategories.map((c) => +c.code)) + 1), name: o.catName }; D.itemCategories.push(cat); }
            const v = { code: o.code, cat: cat.code, name: o.name, unit: o.unit || '个', tier: o.tier || '-', price: +o.price || 0 };
            if (o._exists) { Object.assign(o._exists, v); res.upd++; } else { D.items.push(v); res.add++; }
          } else {
            const jd = o.joinDate ? new Date(o.joinDate.replace(/-/g, '/')) : now;
            const v = { code: o.code, name: o.name, role: D.roles.includes(o.role) ? o.role : D.roles[0], dept: o.dept || D.depts[1], mobile: o.mobile, gender: o.gender || '男', joinDate: jd, years: yearsSince(jd) };
            if (o._exists) { Object.assign(o._exists, v); res.upd++; } else {
              D.employees.push(Object.assign({ online: false, mobileLogin: false, locked: false, left: false, regular: false, ssn: '', birthday: null, regularDate: null, age: '', remark: '' }, v)); res.add++;
            }
          }
        });
        st.result = res;
        if (st.type === 'employees') ERP.refreshTab('employees');
      };

      function draw() {
        stepsEl.replaceChildren(...STEPS.map((s, i) => h('div.st' + (i < st.step ? '.done' : i === st.step ? '.cur' : ''), `${i + 1}. ${s}`)));
        pane.innerHTML = '';
        const def = IMPORT[st.type];
        if (st.step === 0) {
          pane.append(h('div.cards', Object.entries(IMPORT).map(([k, d]) => h('div.sys-opt' + (k === st.type ? '.on' : ''), { onclick: () => { if (st.type !== k) Object.assign(st, { type: k, header: [], rows: [], fileName: '' }); draw(); } },
            h('div.row', h('span.tag' + (k === st.type ? '.red' : ''), d.icon), h('b', d.label)), h('div.muted', { style: { marginTop: '6px', fontSize: '12px' } }, d.desc)))),
          h('div.note', '支持 Excel（.xlsx/.xls）与 CSV（.csv，UTF-8 或 GBK）文件；首行须为列标题。建议先下载导入模板，按模板整理数据后再导入。'),
          h('div.row', btn('下载「' + def.label + '」导入模板', () => downloadTemplate(), 'sm')));
        } else if (st.step === 1) {
          const file = h('input', { type: 'file', accept: '.csv,.txt,.xlsx,.xls', onchange: (e) => readFile(e.target.files[0]) });
          pane.append(group('选择文件', h('div.row', file, h('span.muted', '或'), btn('使用示例数据', () => loadTable(def.sample, '示例数据.csv'), 'sm'))),
            st.fileName ? h('div.row', '已读取：', h('b', st.fileName), h('span.muted', `共 ${st.rows.length} 行数据、${st.header.length} 列`)) : h('div.muted', '尚未选择文件'));
          if (st.header.length) {
            const box2 = h('div.col', { style: { flex: 1, minHeight: '160px' } });
            pane.appendChild(box2);
            grid(box2, { columns: st.header.map((t, i) => ({ key: 'c' + i, title: t || `列${i + 1}`, width: 120 })),
              rows: st.rows.slice(0, 50).map((r) => Object.fromEntries(r.map((v, i) => ['c' + i, v]))), footer: false });
          }
        } else if (st.step === 2) {
          const opts = [[-1, '（不导入）'], ...st.header.map((t, i) => [i, `${String.fromCharCode(65 + i)}：${t}`])];
          const rows = def.fields.map(([k, lbl, req]) => ({ k, lbl, req: req ? '必填' : '' }));
          const box2 = h('div.col', { style: { flex: 1, minHeight: 0 } });
          pane.append(h('div.row', h('span', '已存在的记录（按编号判断）：'),
            ...[['skip', '跳过'], ['update', '覆盖更新']].map(([v, t]) => h('label.chk', h('input', { type: 'radio', name: 'dup', checked: st.dup === v, onchange: () => (st.dup = v) }), t)),
            h('span.grow'), btn('自动匹配', () => { autoMap(); draw(); }, 'sm')), box2);
          const g = grid(box2, {
            columns: [{ key: 'lbl', title: '目标字段', width: 140 }, { key: 'req', title: '必填', width: 60, class: (r) => (r.req ? 'c-red' : '') },
              { key: 'src', title: '对应文件列', width: 220, render: (r) => select(opts, { value: st.map[r.k], style: { height: '22px' }, onchange: (e) => { st.map[r.k] = +e.target.value; g.refresh(); } }) },
              { key: 'ex', title: '示例值（第 1 行）', width: 260, render: (r) => (st.map[r.k] >= 0 ? String((st.rows[0] || [])[st.map[r.k]] ?? '') : '') }],
            rows, footer: false, rowColor: (r) => (r.req && !(st.map[r.k] >= 0) ? 'red' : null),
          });
        } else if (st.step === 3) {
          const list = converted();
          const n = (p) => list.filter((o) => o._status.startsWith(p)).length;
          const box2 = h('div.col', { style: { flex: 1, minHeight: 0 } });
          pane.append(h('div.row', h('span.tag.green', `新增 ${n('新增')}`), h('span.tag', `覆盖 ${n('覆盖')}`), h('span.tag.gray', `跳过 ${n('跳过')}`), h('span.tag.red', `错误 ${n('错误')}`),
            h('span.muted', '错误行不会导入；可返回上一步调整字段对应。')), box2);
          grid(box2, {
            columns: [{ key: '_line', title: '行', type: 'int', width: 50 }, { key: '_status', title: '校验结果', width: 180 }, ...def.fields.map(([k, l]) => ({ key: k, title: l, width: k === 'name' || k === 'address' ? 200 : 100 }))],
            rows: list, footer: false, rowColor: (o) => (o._status.startsWith('错误') ? 'red' : o._status.startsWith('跳过') ? 'gray' : o._status === '覆盖' ? 'blue' : 'green'),
          });
        } else {
          const r = st.result || { add: 0, upd: 0, skip: 0, err: 0 };
          pane.append(h('div', { style: { textAlign: 'center', padding: '20px 0 10px', fontSize: '18px', fontWeight: 700 } }, h('span.c-green', '✔ '), `「${def.label}」导入完成`),
            h('div.cards', [['新增', r.add, 'c-green'], ['覆盖更新', r.upd, 'c-blue'], ['跳过', r.skip, 'c-gray'], ['错误未导入', r.err, 'c-red']].map(([k, v, c]) => h('div.card', h('div.k', k), h('div.v.' + c, String(v))))),
            h('div.muted', { style: { textAlign: 'center' } }, `来源文件：${st.fileName}`));
        }
        // 底部按钮状态
        const [prev, next] = [...dlg.foot.querySelectorAll('button')].filter((x) => /上一步|下一步|开始导入|继续导入/.test(x.textContent));
        prev.disabled = st.step === 0 || st.step === 4;
        next.textContent = st.step === 3 ? '✔ 开始导入' : st.step === 4 ? '继续导入' : '下一步 ▶';
      }
      function downloadTemplate() {
        const def = IMPORT[st.type];
        const csv = '\uFEFF' + def.fields.map((f) => f[1]).join(',') + '\n';
        h('a', { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: `${def.label}导入模板.csv` }).click();
        toast('已下载导入模板');
      }
      function readFile(f) {
        if (!f) return;
        if (/\.xlsx?$/i.test(f.name)) {
          // 浏览器端无依赖无法解析 Excel 二进制：原型中以示例数据代替
          toast('Excel 解析（原型）：已载入示例数据，正式版将在服务端解析');
          return loadTable(IMPORT[st.type].sample, f.name);
        }
        const rd = new FileReader();
        rd.onload = () => {
          let text = new TextDecoder('utf-8').decode(rd.result);
          if (text.includes('\uFFFD')) { try { text = new TextDecoder('gbk').decode(rd.result); } catch (e) { /* 保持 UTF-8 */ } }
          loadTable(parseCsv(text.replace(/^\uFEFF/, '')), f.name);
        };
        rd.readAsArrayBuffer(f);
      }
      dlg = dialog({
        title: '数据导入', width: 980, height: 640, banner: '从 Excel / CSV 文件批量导入客户、经营项目、员工资料',
        body: (b) => {
          stepsEl = h('div.steps');
          pane = h('div.col', { style: { flex: 1, minHeight: 0 } });
          b.append(stepsEl, pane);
        },
        leftButtons: [{ label: '下载模板(T)', action: () => { downloadTemplate(); return false; } }],
        buttons: [
          { label: '◀ 上一步', action: () => { if (st.step > 0) { st.step--; draw(); } return false; } },
          { label: '下一步 ▶', primary: true, action: () => {
            if (st.step === 1 && !st.rows.length) return toast('请先选择文件或使用示例数据'), false;
            if (st.step === 2) {
              const miss = IMPORT[st.type].fields.filter(([k, , req]) => req && !(st.map[k] >= 0)).map((f) => f[1]);
              if (miss.length) return toast('请为必填字段指定对应列：' + miss.join('、')), false;
            }
            if (st.step === 3) {
              doImport();
              biz.notifyOrdersChanged && biz.notifyOrdersChanged();
              toast(`导入完成：新增 ${st.result.add}，更新 ${st.result.upd}`);
            }
            if (st.step === 4) Object.assign(st, { step: 0, header: [], rows: [], fileName: '', result: null });
            else st.step++;
            draw(); return false;
          } },
          { label: '✕ 关闭(C)' },
        ],
      });
      draw();
    },
  });
})();
