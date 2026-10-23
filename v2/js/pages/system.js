/* 系统：员工资料、经营项目、客户分组、生产流程、会计科目、角色配置、运行参数、打印样式、基础数据、数据导入
 * 旧版这些配置多以对话框打开；新版改为：列表页（工具栏筛选 + 分页 + 操作列）→ 编辑表单页（ERP.ui.form + 离开保护），
 * 只有短操作（批量调价、新建角色、科目/基础数据条目）用对话框。
 * 所有修改直接写回内存中的 ERP.data（刷新页面即恢复）；改名会同步到引用它的业务数据（与旧版一致）。 */
(function () {
  'use strict';
  const { h, btn, link, linkBtn, badge, notice, kv, panel, field, input, money, dateInput, textarea, select, checkbox, dialog, confirm, toast } = ERP.ui;
  const D = ERP.data, F = ERP.fmt;
  const biz = (ERP.biz = ERP.biz || {});

  /* ---------- 通用小工具 ---------- */
  const yearsSince = (d) => (d ? Math.max(0, new Date().getFullYear() - new Date(d).getFullYear()) : null);
  const toDate = (s) => (s ? ERP.parseDate(s.trim()) : null);
  const curParams = () => ERP.params();
  // 找不到记录：说明 + 返回所属列表
  const missing = (el, what, back, backLabel) => el.appendChild(h('section.apb-erp-panel',
    ERP.ui.empty({ title: `找不到${what}`, text: '可能已被删除或改名，或链接有误。', action: link(backLabel, back, null, { button: true }) })));
  // 页面级常驻提示位（行操作失败的原因 + 下一步）
  const msgSlot = (el) => { const s = h('div'); el.appendChild(s); return { show: (tone, ...c) => { s.replaceChildren(notice(tone, ...c)); s.scrollIntoView({ block: 'nearest' }); }, clear: () => s.replaceChildren() }; };
  const checks = (...items) => h('div.lerp-checks.lerp-spanall', items);
  const intCheck = (min, max) => (v) => (!/^\d+$/.test(v) || +v < min || +v > max ? `请填写 ${min}～${max} 的整数。` : null);
  // 4 位小数以内的非负单价
  const price4 = (v) => Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 4 });

  /* ======================================================================
   * 员工资料
   * ====================================================================== */
  const emp = (code) => D.employees.find((e) => e.code === code);
  const empStatus = (e) => h('span.apb-erp-row', e.left ? badge('离职') : badge('在职', 'success'), e.locked ? badge('已锁定', 'danger') : null, e.online ? badge('在线', 'info') : null);
  // 员工是否已有业务单据（接待、处理、结算经手）
  const empUsed = (e) => D.workOrders.some((w) => w.receptionist === e.name || (w.handler || '').split(/[、,]/).includes(e.name)) || D.settlements.some((s) => s.handler === e.name);

  ERP.page('employees', {
    module: 'sys', title: '员工资料', desc: '员工编号即登录账号。已有业务单据的员工不能删除，请改为“离职”。',
    render(el, params, ctx) {
      const msg = msgSlot(el);
      const columns = [
        { key: 'code', title: '员工编号', type: 'mono', render: (e) => link(e.code, 'employeeEdit', { code: e.code }, { ariaLabel: `编辑员工 ${e.code} ${e.name}` }) },
        { key: 'name', title: '员工姓名' },
        { key: 'role', title: '员工角色' },
        { key: 'dept', title: '部门岗位', nowrap: true },
        { key: 'mobile', title: '手机号码', type: 'mono', render: (e) => e.mobile || '未提供' },
        { key: 'status', title: '状态', render: empStatus },
        { key: 'mobileLogin', title: '移动端登录', render: (e) => (e.mobileLogin ? '允许' : '不允许') },
        { key: 'regular', title: '转正', nowrap: true, render: (e) => (e.regular ? badge('已转正', 'success') : badge('试用期')), sub: (e) => (e.regularDate ? F.date(e.regularDate) : null) },
        { key: 'gender', title: '性别' },
        { key: 'birthday', title: '生日', type: 'date', nowrap: true, render: (e) => (e.birthday ? F.date(e.birthday) : '未提供') },
        { key: 'age', title: '年龄', type: 'num' },
        { key: 'joinDate', title: '入职日期', type: 'date', nowrap: true, render: (e) => (e.joinDate ? F.date(e.joinDate) : '未提供') },
        { key: 'years', title: '工龄（年）', type: 'num' },
        { key: 'remark', title: '说明备注', render: (e) => e.remark || '—' },
      ];
      const exportCols = [{ key: 'code', title: '员工编号' }, { key: 'name', title: '员工姓名' }, { key: 'role', title: '员工角色' }, { key: 'dept', title: '部门岗位', nowrap: true }, { key: 'mobile', title: '手机号码' },
        { key: 'state', title: '状态' }, { key: 'gender', title: '性别' }, { key: 'birthday', title: '生日', type: 'date' }, { key: 'joinDate', title: '入职日期', type: 'date' }, { key: 'remark', title: '说明备注' }];
      const exportRows = (rows) => rows.map((e) => ({ ...e, state: [e.left ? '离职' : '在职', e.locked ? '已锁定' : ''].filter(Boolean).join('、') }));
      ctx.setActions([link('新建员工', 'employeeEdit', null, { button: true, variant: 'primary' }), btn('导出筛选结果', () => ERP.ui.exportCsv('员工资料', exportCols, exportRows(list.rows)))]);

      const toggleLock = async (e) => {
        if (!e.locked && !(await confirm(`锁定员工 ${e.code} ${e.name}？`, { okLabel: '锁定', detail: '锁定后该员工不能登录；业务单据不受影响，可以随时解锁。' }))) return;
        await ERP.api.write(() => { e.locked = !e.locked; if (e.locked) e.online = false; });
        msg.clear(); toast(`${e.name} 已${e.locked ? '锁定' : '解锁'}。`); list.reload();
      };
      const del = async (e) => {
        if (empUsed(e)) return msg.show('danger', `不能删除员工 ${e.code} ${e.name}：已有接待、处理或结算记录。请改为“离职”，历史单据保留经手人。`, ' ', link('编辑员工', 'employeeEdit', { code: e.code }));
        if (!(await confirm(`删除员工 ${e.code} ${e.name}？`, { okLabel: '删除', danger: true, detail: '删除后该账号不能登录，且不能恢复。' }))) return;
        await ERP.api.write(() => D.employees.splice(D.employees.indexOf(e), 1));
        msg.clear(); toast(`员工 ${e.code} 已删除。`); list.reload();
      };
      const list = ERP.ui.list(el, {
        title: '员工', note: '按员工编号排序 · 状态列显示在职 / 离职 / 锁定', params,
        load: () => D.employees,
        sort: (a, b) => a.code.localeCompare(b.code),
        filters: [
          { key: 'q', type: 'search', label: '搜索员工', placeholder: '编号 / 姓名 / 手机', keys: ['code', 'name', 'mobile'] },
          { key: 'role', type: 'select', label: '员工角色', options: D.roles },
          { key: 'dept', type: 'select', label: '部门岗位', options: D.depts },
          { key: 'state', type: 'select', label: '状态', options: [['active', '在职'], ['left', '离职'], ['locked', '已锁定'], ['online', '在线']],
            match: (e, v) => (v === 'active' ? !e.left : v === 'left' ? e.left : v === 'locked' ? e.locked : e.online) },
        ],
        groups: [{ title: '基础', span: 5 }, { title: '控制', span: 3 }, { title: '其他', span: 6 }],
        columns, idKey: 'code',
        rowActions: (e) => [
          link('编辑', 'employeeEdit', { code: e.code }, { ariaLabel: `编辑员工 ${e.code} ${e.name}` }),
          linkBtn('重置密码', async () => {
            if (!(await confirm(`把 ${e.code} ${e.name} 的登录密码重置为 123456？`, { okLabel: '重置密码', detail: '员工下次登录时须修改密码。' }))) return;
            await ERP.api.write(() => { e.pwdReset = new Date(); });
            toast(`已将 ${e.name} 的密码重置为 123456。`);
          }, { ariaLabel: `重置 ${e.name} 的密码` }),
          e.code === '0000' ? null : linkBtn(e.locked ? '解锁' : '锁定', () => toggleLock(e), { ariaLabel: `${e.locked ? '解锁' : '锁定'}员工 ${e.name}` }),
          e.online ? linkBtn('强制下线', async () => {
            if (!(await confirm(`让 ${e.name} 立即下线？`, { okLabel: '强制下线', detail: '未保存的单据可能丢失。' }))) return;
            await ERP.api.write(() => { e.online = false; });
            toast(`${e.name} 已下线。`); list.reload();
          }, { ariaLabel: `强制 ${e.name} 下线` }) : null,
          e.code === '0000' ? null : linkBtn('删除', () => del(e), { variant: 'danger', ariaLabel: `删除员工 ${e.name}` }),
        ],
        emptyTitle: '尚无员工', emptyText: '新建员工后，员工可用编号登录。', emptyAction: link('新建员工', 'employeeEdit', null, { button: true, variant: 'primary' }),
      });
    },
  });

  /* 新建 / 编辑员工（表单页） */
  ERP.page('employeeEdit', {
    module: 'sys', title: '新建员工', nav: false, parent: 'employees', smokeParams: { code: '0001' },
    render(el, params, ctx) {
      const e = params.code ? emp(params.code) : null;
      if (params.code && !e) return missing(el, `员工 ${params.code}`, 'employees', '返回员工资料');
      const isNew = !e;
      if (e) ctx.setTitle(`编辑员工 ${e.code} ${e.name}`);
      const nextCode = () => String(Math.max(0, ...D.employees.map((x) => +x.code).filter((n) => n < 5000)) + 1).padStart(4, '0');
      const v0 = e || { code: nextCode(), name: '', role: D.roles[0], dept: D.depts[1], mobile: '', gender: '男', ssn: '', birthday: null, joinDate: new Date(), regularDate: null, remark: '' };
      const code = input({ name: 'code', value: v0.code, maxlength: 10, readOnly: !isNew, class: 'apb-erp-mono' });
      code._validate = (v) => (!/^[0-9A-Za-z]{1,10}$/.test(v) ? '员工编号只能是 1～10 位数字或字母。' : isNew && emp(v) ? `员工编号 ${v} 已存在，请换一个。` : null);
      const mobile = input({ name: 'mobile', value: v0.mobile, inputmode: 'tel' });
      mobile.dataset.validate = 'phone';
      const dateCtl = (name, d) => { const c = dateInput({ name, value: d ? F.date(d) : '' }); c.dataset.validate = 'date'; return c; };
      const pwd = input({ name: 'pwd', type: 'password', autocomplete: 'new-password' });
      pwd._validate = (v) => (v && v.length < (+ERP.sysParams?.pwdLen || 6) ? `密码至少 ${+ERP.sysParams?.pwdLen || 6} 位。` : null);
      const form = ERP.ui.form({
        ctx, submitLabel: isNew ? '创建员工' : '保存员工',
        cancel: { href: ERP.href('employees'), label: '返回列表' },
        sections: [
          { title: '基本资料', fields: [
            field({ label: '员工编号', control: code, required: true, help: isNew ? '即登录账号，保存后不能修改。' : '登录账号，不能修改。' }),
            field({ label: '员工姓名', control: input({ name: 'name', value: v0.name, maxlength: 20 }), required: true, help: '改名后，工单接待、处理和结算经手人同步更新。' }),
            field({ label: '员工角色', control: select(D.roles, { name: 'role', value: v0.role }), help: '权限在“角色配置”中设置。' }),
            field({ label: '部门岗位', control: select(D.depts, { name: 'dept', value: v0.dept }) }),
            field({ label: '手机号码', control: mobile }),
            field({ label: isNew ? '初始密码' : '登录密码', control: pwd, help: isNew ? '不填则为 123456，首次登录须修改。' : '不填表示不修改。' }),
          ] },
          { title: '登录控制', note: e ? `当前在线：${e.online ? '是' : '否'}` : null, content: checks(
            checkbox('允许移动端登录', !!v0.mobileLogin, { name: 'mobileLogin' }), checkbox('锁定（禁止登录）', !!v0.locked, { name: 'locked' }),
            checkbox('离职', !!v0.left, { name: 'left' }), checkbox('已转正', !!v0.regular, { name: 'regular' })) },
          { title: '其他资料', cols: 3, fields: [
            field({ label: '性别', control: select(['男', '女'], { name: 'gender', value: v0.gender }) }),
            field({ label: '生日', control: dateCtl('birthday', v0.birthday), help: '例如 1995-06-18。' }),
            field({ label: '社保号码', control: input({ name: 'ssn', value: v0.ssn, maxlength: 30 }) }),
            field({ label: '入职日期', control: dateCtl('joinDate', v0.joinDate) }),
            field({ label: '转正日期', control: dateCtl('regularDate', v0.regularDate) }),
          ] },
          { title: '备注', fields: [field({ label: '说明备注', control: textarea({ name: 'remark', value: v0.remark, maxlength: 200 }), span: 'all', help: '最多 200 个字符。' })] },
        ],
        onSubmit: (v) => ERP.api.write(() => {
          const r = e || { online: false };
          const oldName = e ? e.name : null, name = v.name.trim();
          Object.assign(r, { code: v.code.trim(), name, role: v.role, dept: v.dept, mobile: v.mobile.trim(), gender: v.gender, ssn: v.ssn.trim(),
            birthday: toDate(v.birthday), joinDate: toDate(v.joinDate), regularDate: toDate(v.regularDate), remark: v.remark,
            mobileLogin: !!v.mobileLogin, locked: !!v.locked, left: !!v.left, regular: !!v.regular });
          r.age = yearsSince(r.birthday); r.years = yearsSince(r.joinDate);
          if (r.locked || r.left) r.online = false;
          let synced = 0;
          if (oldName && oldName !== name) {
            // 改名同步：工单接待/处理、结算经手、客户业务员、当前登录员工
            D.workOrders.forEach((w) => {
              if (w.receptionist === oldName) { w.receptionist = name; synced++; }
              const hs = (w.handler || '').split('、');
              if (hs.includes(oldName)) { w.handler = hs.map((x) => (x === oldName ? name : x)).join('、'); synced++; }
            });
            D.settlements.forEach((s) => { if (s.handler === oldName) { s.handler = name; synced++; } });
            D.customers.forEach((c) => { if (c.owner === oldName) c.owner = name; });
            if (D.currentUser.code === r.code) D.currentUser.name = name;
          }
          if (isNew) D.employees.push(r);
          form.markClean();
          toast(`${isNew ? '已新建员工' : '已保存员工'} ${r.code} ${r.name}${isNew && !v.pwd ? '，初始密码 123456' : v.pwd ? '，密码已设置' : ''}${synced ? `；已同步 ${synced} 条业务记录的经手人` : ''}。`);
          ERP.go('employees', { q: r.code });
        }),
      });
      el.appendChild(panel({ title: isNew ? '新员工' : '员工资料' }).el).querySelector('.apb-erp-panelbody').appendChild(form);
    },
  });

  /* ======================================================================
   * 经营项目（主项 + 子项 + 项目规格）
   * ====================================================================== */
  // 项目规格（开单时组合选择，可加价），按主项生成示例数据；存放在 ERP.data.itemSpecs
  D.itemSpecs = D.itemSpecs || {};
  const specsOf = (cat) => D.itemSpecs[cat] || (D.itemSpecs[cat] = (['10', '11', '12'].includes(cat)
    ? [['纸张', '普通纸，80g'], ['纸张', '铜版纸，105g'], ['纸张', '铜版纸，128g'], ['纸张', '铜版纸，157g'], ['纸张', '铜版纸，200g'], ['尺寸', 'A4'], ['尺寸', 'A3'], ['面数', '单面'], ['面数', '双面']]
    : cat === '25' ? [['材料', '户外写真'], ['材料', '室内写真'], ['材料', '喷绘布'], ['工艺', '覆亮膜'], ['工艺', '覆哑膜'], ['工艺', '裱 KT 板']]
      : cat === '15' ? [['方式', '胶装'], ['方式', '骑马钉'], ['方式', '铁圈装'], ['封面', '透明胶片'], ['封面', '皮纹纸']]
        : [['规格', '标准'], ['规格', '加大']]).map(([type, name], i) => ({ code: cat + String(i + 1).padStart(2, '0'), type, name, addMode: '不加价', add: 0 })));
  D.items.forEach((it, i) => { if (it.renamable == null) it.renamable = i < 10; });
  const nextItemCode = (cat) => {
    const codes = D.items.filter((i) => i.cat === cat).map((i) => i.code);
    if (!codes.length) return cat + '0001';
    const max = codes.reduce((a, b) => (+b > +a ? b : a));
    return String(+max + 1).padStart(max.length, '0');
  };
  const itemUsed = (code) => D.workOrders.filter((w) => w.lines.some((l) => l.code === code)).length;

  ERP.page('bizItems', {
    module: 'sys', title: '经营项目', desc: '对外的经营项目：先选经营主项，再维护子项（名称、单位、单价）与项目规格。',
    render(el, params, ctx) {
      const msg = msgSlot(el);
      ctx.setActions([
        btn('新建子项', () => ERP.go('bizItemEdit', { cat: curParams().cat }), { variant: 'primary' }),
        link('新建主项', 'itemCatEdit', null, { button: true }),
      ]);
      const columns = [
        { key: 'code', title: '编号', type: 'mono', render: (i) => link(i.code, 'bizItemEdit', { code: i.code }, { ariaLabel: `编辑经营项目 ${i.code} ${i.name}` }) },
        { key: 'name', title: '名称', width: 220, sub: (i) => (i.renamable ? '开单时可改名' : null) },
        { key: 'cat', title: '经营主项', render: (i) => `${i.cat} ${D.itemCatName(i.cat)}` },
        { key: 'unit', title: '单位' },
        { key: 'tier', title: '定价量级' },
        { key: 'price', title: '销售单价（元）', type: 'num', render: (i) => h('span.apb-erp-mono', price4(i.price)) },
      ];
      const exportCols = [{ key: 'code', title: '编号' }, { key: 'name', title: '名称' }, { key: 'catName', title: '经营主项' }, { key: 'unit', title: '单位' }, { key: 'tier', title: '定价量级' }, { key: 'price', title: '销售单价（元）' }];
      // 批量调价：按比例调整所选子项的销售单价（保留 4 位小数）
      const adjust = (rows) => new Promise((resolve) => {
        const pct = input({ name: 'pct', value: '10', inputmode: 'decimal', class: 'lerp-amount' });
        pct._validate = (v) => (!/^-?\d+(\.\d+)?$/.test(v) || +v <= -100 ? '请填写大于 -100 的百分比，例如 10 或 -5。' : null);
        const dlg = dialog({
          title: '批量调价', kicker: `已选择 ${rows.length} 个子项 · 仅当前页`, onClose: resolve,
          body: (b) => b.appendChild(ERP.ui.form({
            submitLabel: '调整单价',
            sections: [{ fields: [field({ label: '调整比例（%）', control: pct, required: true, help: '正数涨价、负数降价；结果保留 4 位小数。' })] }],
            moreActions: btn('取消', () => dlg.close()),
            onSubmit: (v) => ERP.api.write(() => {
              const k = 1 + Number(v.pct) / 100;
              rows.forEach((i) => (i.price = Math.round(i.price * k * 10000) / 10000));
              dlg.close(); toast(`已调整 ${rows.length} 个子项的销售单价（${+v.pct > 0 ? '+' : ''}${+v.pct}%）。`); list.reload();
            }),
          })),
        });
      });
      const list = ERP.ui.list(el, {
        title: '经营子项', note: '单价最多 4 位小数', params,
        load: () => D.items,
        sort: (a, b) => a.cat.localeCompare(b.cat) || a.code.localeCompare(b.code),
        filters: [
          { key: 'cat', type: 'select', label: '经营主项', allLabel: '全部主项', options: D.itemCategories.map((c) => [c.code, `${c.code} ${c.name}`]) },
          { key: 'q', type: 'search', label: '搜索子项', placeholder: '编号 / 名称', keys: ['code', 'name'] },
        ],
        columns, idKey: 'code',
        rowActions: (i) => [
          link('编辑', 'bizItemEdit', { code: i.code }, { ariaLabel: `编辑经营项目 ${i.name}` }),
          linkBtn('删除', async () => {
            const n = itemUsed(i.code);
            if (!(await confirm(`删除经营子项 ${i.code} ${i.name}？`, { okLabel: '删除', danger: true, detail: n ? `已有 ${n} 张工单使用该项目；删除后历史工单明细保留原名称和金额，开单时不能再选。` : '删除后开单时不能再选择该项目。' }))) return;
            await ERP.api.write(() => D.items.splice(D.items.indexOf(i), 1));
            msg.clear(); toast(`经营子项 ${i.code} 已删除。`); list.reload(); drawCats();
          }, { variant: 'danger', ariaLabel: `删除经营项目 ${i.name}` }),
        ],
        selectable: true,
        batch: [
          { label: '批量调价', onClick: adjust },
          { label: '导出所选', onClick: (rows) => ERP.ui.exportCsv('经营项目', exportCols, rows.map((i) => ({ ...i, catName: D.itemCatName(i.cat) }))) },
        ],
        emptyTitle: '尚无经营项目', emptyText: '先建经营主项，再添加子项。',
      });
      // 经营主项
      const pc = panel({ title: '经营主项', note: '主项编号决定排列顺序；主项下还有子项时不能删除。', flush: true });
      el.appendChild(pc.el);
      function drawCats() {
        pc.body.replaceChildren();
        ERP.ui.table(pc.body, {
          caption: '经营主项', rows: D.itemCategories,
          columns: [{ key: 'code', title: '编号', type: 'mono' }, { key: 'name', title: '名称' },
            { key: 'n', title: '子项数', type: 'num', render: (c) => String(D.items.filter((i) => i.cat === c.code).length) },
            { key: 'specs', title: '项目规格', type: 'num', render: (c) => String(specsOf(c.code).length) }],
          rowActions: (c) => [
            link('查看子项', 'bizItems', { cat: c.code }, { ariaLabel: `查看 ${c.name} 的子项` }),
            link('编辑', 'itemCatEdit', { code: c.code }, { ariaLabel: `编辑主项 ${c.name}` }),
            linkBtn('删除', async () => {
              const n = D.items.filter((i) => i.cat === c.code).length;
              if (n) return msg.show('danger', `不能删除主项「${c.name}」：还有 ${n} 个子项。请先删除或移到其他主项。`, ' ', link('查看子项', 'bizItems', { cat: c.code }));
              if (!(await confirm(`删除经营主项 ${c.code} ${c.name}？`, { okLabel: '删除', danger: true }))) return;
              await ERP.api.write(() => { D.itemCategories.splice(D.itemCategories.indexOf(c), 1); delete D.itemSpecs[c.code]; });
              msg.clear(); toast(`经营主项 ${c.name} 已删除。`); drawCats();
            }, { variant: 'danger', ariaLabel: `删除主项 ${c.name}` }),
          ],
          empty: { title: '尚无经营主项', text: '点“新建主项”。' },
        });
      }
      drawCats();
    },
  });

  /* 新建 / 编辑经营子项 */
  ERP.page('bizItemEdit', {
    module: 'sys', title: '新建经营子项', nav: false, parent: 'bizItems', smokeParams: { code: '101001' },
    render(el, params, ctx) {
      const it = params.code ? D.items.find((i) => i.code === params.code) : null;
      if (params.code && !it) return missing(el, `经营项目 ${params.code}`, 'bizItems', '返回经营项目');
      if (!D.itemCategories.length) return el.appendChild(notice('warning', '还没有经营主项，请先新建主项。', ' ', link('新建主项', 'itemCatEdit')));
      if (it) ctx.setTitle(`编辑经营子项 ${it.code}`);
      const cat0 = it ? it.cat : D.itemCategories.some((c) => c.code === params.cat) ? params.cat : D.itemCategories[0].code;
      const cat = select(D.itemCategories.map((c) => [c.code, `${c.code} ${c.name}`]), { name: 'cat', value: cat0 });
      const code = input({ name: 'code', value: it ? it.code : nextItemCode(cat0), readOnly: !!it, class: 'apb-erp-mono', maxlength: 12 });
      let codeTouched = false;
      code.addEventListener('input', () => (codeTouched = true));
      if (!it) cat.addEventListener('change', () => { if (!codeTouched) code.value = nextItemCode(cat.value); });
      code._validate = (v) => (!/^\d{4,12}$/.test(v) ? '编号为 4～12 位数字。' : !it && D.items.some((i) => i.code === v) ? `编号 ${v} 已存在。` : null);
      const price = money({ name: 'price', value: it ? String(it.price) : '' });
      price._validate = (v) => (!/^\d+(\.\d{1,4})?$/.test(v.replace(/,/g, '')) ? '请填写不小于 0 的单价，最多 4 位小数，例如 1.5。' : null);
      const used = it ? itemUsed(it.code) : 0;
      const form = ERP.ui.form({
        ctx, submitLabel: it ? '保存子项' : '创建子项',
        cancel: { href: ERP.href('bizItems', { cat: cat0 }), label: '返回列表' },
        sections: [
          { title: '基本资料', fields: [
            field({ label: '经营主项', control: cat, required: true }),
            field({ label: '项目编号', control: code, required: true, help: it ? '编号不能修改。' : '按主项自动编号，可修改。' }),
            field({ label: '项目名称', control: input({ name: 'name', value: it ? it.name : '', maxlength: 100 }), required: true, span: 'all',
              help: used ? `已有 ${used} 张工单使用；改名不影响历史工单明细。` : '例如：铜版纸，128g，A4，单面。' }),
          ] },
          { title: '定价', fields: [
            field({ label: '单位', control: input({ name: 'unit', value: it ? it.unit : '张', maxlength: 6 }), required: true, help: '张、页、本、㎡ 等。' }),
            field({ label: '定价量级', control: input({ name: 'tier', value: it ? it.tier : '-', maxlength: 20 }), help: '数量区间，例如 1-10；不分级填“-”。' }),
            field({ label: '销售单价（元）', control: price, required: true }),
          ], content: checks(checkbox('开单时允许修改项目名称（可重命名）', it ? !!it.renamable : false, { name: 'renamable' })) },
        ],
        onSubmit: (v) => ERP.api.write(() => {
          const r = it || {};
          Object.assign(r, { code: v.code.trim(), cat: v.cat, name: v.name.trim(), unit: v.unit.trim(), tier: v.tier.trim() || '-', price: Number(v.price.replace(/,/g, '')), renamable: !!v.renamable });
          if (!it) D.items.push(r);
          form.markClean();
          toast(`${it ? '已保存' : '已创建'}经营子项 ${r.code} ${r.name}。`);
          ERP.go('bizItems', { cat: r.cat, q: r.code });
        }),
      });
      el.appendChild(panel({ title: it ? '子项资料' : '新子项' }).el).querySelector('.apb-erp-panelbody').appendChild(form);
    },
  });

  /* 新建 / 编辑经营主项（含项目规格） */
  ERP.page('itemCatEdit', {
    module: 'sys', title: '新建经营主项', nav: false, parent: 'bizItems', smokeParams: { code: '10' },
    render(el, params, ctx) {
      const c = params.code ? D.itemCategories.find((x) => x.code === params.code) : null;
      if (params.code && !c) return missing(el, `经营主项 ${params.code}`, 'bizItems', '返回经营项目');
      if (c) ctx.setTitle(`编辑经营主项 ${c.code} ${c.name}`);
      const code = input({ name: 'code', value: c ? c.code : String(Math.max(0, ...D.itemCategories.map((x) => +x.code)) + 1), readOnly: !!c, class: 'apb-erp-mono', maxlength: 4 });
      code._validate = (v) => (!/^\d{2,4}$/.test(v) ? '主项编号为 2～4 位数字。' : !c && D.itemCategories.some((x) => x.code === v) ? `主项编号 ${v} 已存在。` : null);
      const name = input({ name: 'name', value: c ? c.name : '', maxlength: 30 });
      name._validate = (v) => (D.itemCategories.some((x) => x !== c && x.name === v) ? `已有同名主项「${v}」。` : null);
      // 规格工作副本：保存时才写回
      const specs = (c ? specsOf(c.code) : []).map((s) => ({ ...s }));
      const box = h('div');
      const changed = () => form.dispatchEvent(new Event('input'));
      const cellInput = (s, key, label, attrs = {}) => {
        const i = input(Object.assign({ value: s[key], class: 'lerp-cell', 'aria-label': `${s.code} ${label}` }, attrs));
        i.addEventListener('change', () => { s[key] = attrs.inputmode ? Number(i.value) || 0 : i.value.trim(); });
        return i;
      };
      function drawSpecs() {
        box.replaceChildren();
        ERP.ui.table(box, {
          caption: '项目规格', rows: specs,
          columns: [
            { key: 'code', title: '规格编号', type: 'mono' },
            { key: 'type', title: '规格类型', render: (s) => cellInput(s, 'type', '规格类型', { style: { width: '110px' } }) },
            { key: 'name', title: '规格名称', render: (s) => cellInput(s, 'name', '规格名称') },
            { key: 'addMode', title: '加价方式', render: (s) => select(['不加价', '按金额', '按比例'], { value: s.addMode, class: 'lerp-cell', 'aria-label': `${s.code} 加价方式`, onchange: (e) => (s.addMode = e.target.value) }) },
            { key: 'add', title: '加价', align: 'right', render: (s) => cellInput(s, 'add', '加价', { inputmode: 'decimal', class: 'lerp-cell lerp-amount', style: { width: '96px' } }) },
          ],
          rowActions: (s) => [linkBtn('移除', () => { specs.splice(specs.indexOf(s), 1); drawSpecs(); changed(); }, { variant: 'danger', ariaLabel: `移除规格 ${s.name}` })],
          empty: { title: '尚无规格', text: '规格用于开单时组合选择（如纸张 × 尺寸 × 面数），可设置加价。' },
        });
      }
      drawSpecs();
      const form = ERP.ui.form({
        ctx, wide: true, submitLabel: c ? '保存主项' : '创建主项',
        cancel: { href: ERP.href('bizItems', c ? { cat: c.code } : null), label: '返回列表' },
        sections: [
          { title: '基本资料', fields: [field({ label: '主项编号', control: code, required: true, help: c ? '编号不能修改。' : '决定排列顺序。' }), field({ label: '主项名称', control: name, required: true })] },
          { title: '项目规格', note: '按金额：每单位加价（元）；按比例：加价百分比。', content: [h('div.apb-erp-row', btn('添加规格', () => {
            const n = Math.max(0, ...specs.map((s) => +s.code.slice(-2) || 0)) + 1;
            specs.push({ code: code.value.trim() + String(n).padStart(2, '0'), type: '规格', name: '新规格', addMode: '不加价', add: 0 });
            drawSpecs(); changed();
          })), box] },
        ],
        onSubmit: (v) => ERP.api.write(() => {
          const r = c || { code: v.code.trim() };
          r.name = v.name.trim();
          if (!c) { D.itemCategories.push(r); D.itemCategories.sort((a, b) => a.code.localeCompare(b.code)); }
          D.itemSpecs[r.code] = specs.filter((s) => s.name);
          form.markClean();
          toast(`${c ? '已保存' : '已创建'}经营主项 ${r.code} ${r.name}（${D.itemSpecs[r.code].length} 个规格）。`);
          ERP.go('bizItems', { cat: r.code });
        }),
      });
      el.appendChild(panel({ title: c ? '主项资料' : '新主项' }).el).querySelector('.apb-erp-panelbody').appendChild(form);
    },
  });

  /* ======================================================================
   * 客户分组
   * ====================================================================== */
  const GROUP_COLORS = [['Black', '黑色'], ['Crimson', '深红'], ['Red', '红色'], ['DarkOrange', '深橙'], ['Goldenrod', '金黄'], ['ForestGreen', '森林绿'],
    ['Teal', '青色'], ['RoyalBlue', '宝蓝'], ['Blue', '蓝色'], ['HotPink', '亮粉'], ['Purple', '紫色'], ['Gray', '灰色']];
  D.groups.forEach((g) => Object.assign(g, Object.assign({ color: 'Black', desc: '', noCash: false, noZeroOpen: false }, g)));
  const groupCount = (code) => D.customers.filter((c) => c.group === code).length;
  const discountText = (d) => (d == null || d >= 1 ? '不打折' : `${+(d * 10).toFixed(2)} 折`);

  ERP.page('custGroups', {
    module: 'sys', title: '客户分组', desc: '客户的业务分组：决定默认折扣、预存规则，并用于营销、查询与统计。',
    render(el, params, ctx) {
      const msg = msgSlot(el);
      ctx.setActions([link('新建分组', 'custGroupEdit', null, { button: true, variant: 'primary' })]);
      const list = ERP.ui.list(el, {
        title: '客户分组', note: '编号决定排列顺序', params,
        load: () => D.groups,
        sort: (a, b) => a.code.localeCompare(b.code),
        filters: [{ key: 'q', type: 'search', label: '搜索分组', placeholder: '编号 / 名称 / 描述', keys: ['code', 'name', 'desc'] }],
        columns: [
          { key: 'code', title: '编号', type: 'mono', render: (g) => link(g.code, 'custGroupEdit', { code: g.code }, { ariaLabel: `编辑分组 ${g.name}` }) },
          { key: 'name', title: '分组名称', width: 200, sub: (g) => g.desc || null },
          { key: 'discount', title: '默认折扣', render: (g) => discountText(g.discount) },
          { key: 'prestore', title: '预存金额（元）', type: 'money', render: (g) => (g.prestore ? F.money(g.prestore) : '—') },
          { key: 'rules', title: '预存规则', render: (g) => (g.noCash || g.noZeroOpen ? h('span.apb-erp-row', g.noCash ? badge('禁止现金结算', 'warning') : null, g.noZeroOpen ? badge('余额为 0 禁止开单', 'warning') : null) : '—') },
          { key: 'n', title: '客户数', type: 'num', render: (g) => String(groupCount(g.code)) },
        ],
        idKey: 'code',
        rowActions: (g) => [
          link('编辑', 'custGroupEdit', { code: g.code }, { ariaLabel: `编辑分组 ${g.name}` }),
          linkBtn('删除', async () => {
            const n = groupCount(g.code);
            if (n) return msg.show('danger', `不能删除分组「${g.name}」：还有 ${n} 个客户。请先把这些客户改到其他分组。`);
            if (!(await confirm(`删除客户分组 ${g.code} ${g.name}？`, { okLabel: '删除', danger: true }))) return;
            await ERP.api.write(() => D.groups.splice(D.groups.indexOf(g), 1));
            msg.clear(); toast(`客户分组 ${g.name} 已删除。`); list.reload();
          }, { variant: 'danger', ariaLabel: `删除分组 ${g.name}` }),
        ],
        emptyTitle: '尚无客户分组', emptyText: '至少需要一个分组才能新建客户。', emptyAction: link('新建分组', 'custGroupEdit', null, { button: true, variant: 'primary' }),
      });
    },
  });

  ERP.page('custGroupEdit', {
    module: 'sys', title: '新建客户分组', nav: false, parent: 'custGroups', smokeParams: { code: '30' },
    render(el, params, ctx) {
      const g = params.code ? D.groups.find((x) => x.code === params.code) : null;
      if (params.code && !g) return missing(el, `客户分组 ${params.code}`, 'custGroups', '返回客户分组');
      if (g) ctx.setTitle(`编辑客户分组 ${g.code} ${g.name}`);
      const n = g ? groupCount(g.code) : 0;
      const code = input({ name: 'code', value: g ? g.code : String(Math.min(99, Math.max(0, ...D.groups.map((x) => +x.code)) + 5)), maxlength: 2, inputmode: 'numeric', class: 'apb-erp-mono' });
      code._validate = (v) => (!/^\d{2}$/.test(v) ? '分组编号为两位数字，例如 35。' : D.groups.some((x) => x !== g && x.code === v) ? `分组编号 ${v} 已被使用。` : null);
      const name = input({ name: 'name', value: g ? g.name : '', maxlength: 30 });
      name._validate = (v) => (D.groups.some((x) => x !== g && x.name === v) ? `已有同名分组「${v}」。` : null);
      const disc = input({ name: 'discount', value: g ? String(g.discount ?? 1) : '1', inputmode: 'decimal', class: 'lerp-amount' });
      disc._validate = (v) => (!/^\d(\.\d{1,3})?$/.test(v) || +v <= 0 || +v > 1 ? '请填写 0～1 之间的折扣率，例如 0.85。' : null);
      const pre = money({ name: 'prestore', value: g && g.prestore ? g.prestore.toFixed(2) : '' });
      pre.dataset.validate = 'money';
      const form = ERP.ui.form({
        ctx, submitLabel: g ? '保存分组' : '创建分组',
        cancel: { href: ERP.href('custGroups'), label: '返回列表' },
        sections: [
          { title: '基本资料', fields: [
            field({ label: '分组编号', control: code, required: true, help: n ? `两位数字，决定排列顺序；修改后 ${n} 个客户同步改到新编号。` : '两位数字，决定排列顺序。' }),
            field({ label: '分组名称', control: name, required: true, help: n ? `修改后 ${n} 个客户的分组名称同步更新。` : null }),
          ] },
          { title: '业务资料', fields: [
            field({ label: '默认折扣率', control: disc, required: true, help: '1 表示不打折，0.85 表示 85 折。' }),
            field({ label: '预存金额（元）', control: pre, help: '会员卡分组的办卡预存金额；普通分组不填。' }),
            field({ label: '分组颜色', control: select(GROUP_COLORS, { name: 'color', value: g ? g.color : 'Black' }), help: '用于旧版客户列表标识；新版以文字为准。' }),
          ], content: checks(checkbox('预存储值客户禁止使用现金收款结算', g ? !!g.noCash : false, { name: 'noCash' }), checkbox('预存可用余额为 0 时禁止开单', g ? !!g.noZeroOpen : false, { name: 'noZeroOpen' })) },
          { title: '备注', fields: [field({ label: '分组描述', control: textarea({ name: 'desc', value: g ? g.desc : '', maxlength: 200 }), span: 'all' })] },
        ],
        onSubmit: (v) => ERP.api.write(() => {
          const r = g || {};
          const oldCode = g ? g.code : null, newCode = v.code.trim(), nm = v.name.trim();
          // 改编号/改名同步到客户资料（与旧版一致）
          if (oldCode && oldCode !== newCode) {
            D.customers.forEach((x) => { if (x.group === oldCode) x.group = newCode; });
            // 分组价格按分组编号保存，一并迁移
            if (D.groupPrices && D.groupPrices[oldCode]) { D.groupPrices[newCode] = D.groupPrices[oldCode]; delete D.groupPrices[oldCode]; }
          }
          Object.assign(r, { code: newCode, name: nm, short: nm.length > 8 ? nm.slice(0, 7) + '…' : undefined, discount: Number(v.discount),
            prestore: v.prestore ? Number(v.prestore.replace(/,/g, '')) : undefined, color: v.color, desc: v.desc.trim(), noCash: !!v.noCash, noZeroOpen: !!v.noZeroOpen });
          if (!g) D.groups.push(r);
          D.groups.sort((a, b) => a.code.localeCompare(b.code));
          D.customers.forEach((x) => (x.groupName = D.groupName(x.group)));
          // 工单、会员卡上显示的分组名称随客户同步
          const gName = (code) => (D.customer(code) || {}).groupName;
          D.workOrders.forEach((w) => { const n = gName(w.custCode); if (n) w.group = n; });
          (D.cards || []).forEach((k) => { const n = gName(k.custCode); if (n) k.group = n; });
          form.markClean();
          toast(`${g ? '已保存' : '已创建'}客户分组 ${r.code} ${r.name}。`);
          ERP.go('custGroups');
        }),
      });
      el.appendChild(panel({ title: g ? '分组资料' : '新分组' }).el).querySelector('.apb-erp-panelbody').appendChild(form);
    },
  });

  /* ======================================================================
   * 生产流程
   * ====================================================================== */
  const FLOW_COLORS = [['red', '红色'], ['blue', '蓝色'], ['pink', '粉色'], ['green', '绿色'], ['orange', '橙色'], ['purple', '紫色'], ['gray', '灰色']];
  const flowUsed = (name) => D.workOrders.filter((w) => w.flow === name).length;

  ERP.page('prodFlow', {
    module: 'sys', title: '生产流程', desc: '工单按编号顺序流转：编号最小的是新单默认流程，编号最大的视为“完工”。',
    render(el, params, ctx) {
      const msg = msgSlot(el);
      ctx.setActions([link('新建流程', 'prodFlowEdit', null, { button: true, variant: 'primary' })]);
      const list = ERP.ui.list(el, {
        title: '生产流程', note: '按编号排序', params,
        load: () => D.flows,
        sort: (a, b) => +a.code - +b.code,
        columns: [
          { key: 'code', title: '编号', type: 'mono', render: (f) => link(f.code, 'prodFlowEdit', { code: f.code }, { ariaLabel: `编辑流程 ${f.name}` }) },
          { key: 'name', title: '流程名称', render: (f) => badge(f.name, biz.flowTone && biz.flowTone(f.name)) },
          { key: 'role', title: '位置', render: (f) => (f === D.flows[0] ? '新单默认' : f === D.flows[D.flows.length - 1] ? '视为完工' : '中间流程') },
          { key: 'color', title: '流程颜色', render: (f) => (FLOW_COLORS.find((c) => c[0] === f.color) || [, '未设置'])[1] },
          { key: 'n', title: '工单数', type: 'num', render: (f) => link(String(flowUsed(f.name)), 'prodCenter', { flow: f.name }, { ariaLabel: `查看${f.name}的工单` }) },
        ],
        idKey: 'code',
        rowActions: (f) => [
          link('编辑', 'prodFlowEdit', { code: f.code }, { ariaLabel: `编辑流程 ${f.name}` }),
          linkBtn('删除', async () => {
            const n = flowUsed(f.name);
            if (n) return msg.show('danger', `不能删除流程「${f.name}」：有 ${n} 张工单处于该流程。请先把这些工单转到其他流程。`, ' ', link('查看这些工单', 'prodCenter', { flow: f.name }));
            if (D.flows.length <= 2) return msg.show('danger', '不能删除：至少保留两个流程（新单默认与完工）。');
            if (!(await confirm(`删除生产流程 ${f.code} ${f.name}？`, { okLabel: '删除', danger: true }))) return;
            await ERP.api.write(() => D.flows.splice(D.flows.indexOf(f), 1));
            msg.clear(); toast(`生产流程 ${f.name} 已删除。`); list.reload();
          }, { variant: 'danger', ariaLabel: `删除流程 ${f.name}` }),
        ],
        emptyTitle: '尚无生产流程', emptyText: '至少需要两个流程。',
      });
    },
  });

  ERP.page('prodFlowEdit', {
    module: 'sys', title: '新建生产流程', nav: false, parent: 'prodFlow', smokeParams: { code: '20' },
    render(el, params, ctx) {
      const f = params.code ? D.flows.find((x) => x.code === params.code) : null;
      if (params.code && !f) return missing(el, `生产流程 ${params.code}`, 'prodFlow', '返回生产流程');
      if (f) ctx.setTitle(`编辑生产流程 ${f.code} ${f.name}`);
      const n = f ? flowUsed(f.name) : 0;
      const code = input({ name: 'code', value: f ? f.code : String(Math.min(99, Math.max(0, ...D.flows.map((x) => +x.code)) + 5)), maxlength: 2, inputmode: 'numeric', class: 'apb-erp-mono' });
      code._validate = (v) => intCheck(1, 99)(v) || (D.flows.some((x) => x !== f && +x.code === +v) ? `流程编号 ${v} 已被使用。` : null);
      const name = input({ name: 'name', value: f ? f.name : '', maxlength: 10 });
      name._validate = (v) => (D.flows.some((x) => x !== f && x.name === v) ? `已有同名流程「${v}」。` : null);
      const form = ERP.ui.form({
        ctx, submitLabel: f ? '保存流程' : '创建流程',
        cancel: { href: ERP.href('prodFlow'), label: '返回列表' },
        sections: [{ title: '基本资料', fields: [
          field({ label: '流程编号', control: code, required: true, help: '1～99，决定流转顺序。' }),
          field({ label: '流程名称', control: name, required: true, help: n ? `修改后，处于该流程的 ${n} 张工单同步改名。` : '例如：设计、印刷、后道。' }),
          field({ label: '流程颜色', control: select(FLOW_COLORS, { name: 'color', value: f ? f.color : 'orange' }), help: '旧版列表行颜色；新版列表以状态文字为准。' }),
        ] }],
        onSubmit: (v) => ERP.api.write(() => {
          const r = f || {};
          const old = f ? f.name : null, nm = v.name.trim();
          if (old && old !== nm) D.workOrders.forEach((w) => { if (w.flow === old) w.flow = nm; });
          Object.assign(r, { code: String(+v.code), name: nm, color: v.color });
          if (!f) D.flows.push(r);
          D.flows.sort((a, b) => +a.code - +b.code);
          form.markClean();
          toast(`${f ? '已保存' : '已创建'}生产流程 ${r.code} ${r.name}${old && old !== nm && n ? `，${n} 张工单已同步` : ''}。`);
          ERP.go('prodFlow');
        }),
      });
      el.appendChild(panel({ title: f ? '流程资料' : '新流程' }).el).querySelector('.apb-erp-panelbody').appendChild(form);
    },
  });

  /* ======================================================================
   * 会计科目（资产类 / 损益类 树），存放在 ERP.data.chartOfAccounts
   * 银行存款（1002）下的科目与资金账户 ERP.data.accounts 联动
   * ====================================================================== */
  const buildCoa = () => {
    const n = (code, name, children, extra) => Object.assign({ code, name, children: children || [], open: true, aux: '无', dir: /^6[0-3]/.test(code) ? '贷' : '借' }, extra);
    const banks = D.accounts.filter((a) => a.parent === '1002').map((a) => n(a.code, a.name, [], { acc: a }));
    const cash = D.accounts.find((a) => a.code === '1001');
    return {
      asset: [
        n('1001', '现金', [n('1001001', '前台钱箱'), n('1001002', '财务保险柜')], { acc: cash }), n('1002', '银行存款', banks),
        n('1122', '应收账款', [n('1122001', '客户应收', [], { aux: '客户' }), n('1122002', '员工借款', [], { aux: '员工' })]), n('1123', '预付账款', [n('1123001', '预付货款', [], { aux: '供应商' })]),
        n('1231', '其他应收款'), n('1401', '材料采购'), n('1403', '原材料'), n('1406', '库存商品'), n('1412', '包装物及低值易耗品'),
        n('1501', '待摊费用'), n('1601', '固定资产'), n('1602', '累计折旧', [], { dir: '贷' }),
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
  const coaAll = (list) => list.flatMap((x) => [x, ...coaAll(x.children)]);
  const coaParent = (list, node, p = null) => {
    for (const x of list) { if (x === node) return p; const r = coaParent(x.children, node, x); if (r !== undefined) return r; }
    return undefined;
  };

  ERP.page('chartOfAccounts', {
    module: 'sys', title: '会计科目', desc: '编制会计科目。银行存款下的科目即资金账户，收款结算时可选为入账科目。',
    render(el, params, ctx) {
      const coa = (D.chartOfAccounts = D.chartOfAccounts || buildCoa());
      const msg = msgSlot(el);
      const TABS = [['asset', '资产类'], ['pl', '损益类']];
      const panes = {};
      let active = params.tab === 'pl' ? 1 : 0;
      const setOpen = (on) => { coaAll(coa[TABS[active][0]]).forEach((x) => (x.open = on)); draw(TABS[active][0]); };
      const p = panel({ title: '科目树', note: '余额方向、辅助核算与资金账户余额显示在科目后面。', actions: [btn('全部展开', () => setOpen(true)), btn('全部收起', () => setOpen(false))] });
      el.appendChild(p.el);
      ctx.setActions([btn('新增一级科目', () => edit(TABS[active][0], null, null), { variant: 'primary' })]);

      // 新增 / 修改科目（短操作：对话框内的表单）
      function edit(t, parent, node) {
        const isNew = !node;
        const sibs = parent ? parent.children : coa[t];
        const code0 = isNew ? (parent ? parent.code + String(Math.max(0, ...sibs.map((x) => +x.code.slice(parent.code.length) || 0)) + 1).padStart(3, '0') : '') : node.code;
        const code = input({ name: 'code', value: code0, maxlength: 12, class: 'apb-erp-mono' });
        code._validate = (v) => (!/^\d{4,12}$/.test(v) ? '科目编号为 4～12 位数字。' : parent && !v.startsWith(parent.code) ? `下级科目编号须以 ${parent.code} 开头。` : coaAll([...coa.asset, ...coa.pl]).some((x) => x !== node && x.code === v) ? `科目编号 ${v} 已存在。` : null);
        const dlg = dialog({
          title: isNew ? (parent ? '新增下级科目' : '新增一级科目') : '修改科目', kicker: parent ? `上级：${parent.code} ${parent.name}` : TABS.find((x) => x[0] === t)[1],
          body: (b) => b.appendChild(ERP.ui.form({
            submitLabel: isNew ? '新增科目' : '保存科目',
            sections: [{ fields: [
              field({ label: '科目编号', control: code, required: true }),
              field({ label: '科目名称', control: input({ name: 'name', value: isNew ? '' : node.name, maxlength: 30 }), required: true }),
              field({ label: '余额方向', control: select(['借', '贷'], { name: 'dir', value: isNew ? (parent ? parent.dir : t === 'pl' ? '贷' : '借') : node.dir }) }),
              field({ label: '辅助核算', control: select(['无', '客户', '员工', '供应商'], { name: 'aux', value: isNew ? (parent ? parent.aux : '无') : node.aux || '无' }) }),
            ] }],
            moreActions: btn('取消', () => dlg.close()),
            onSubmit: (v) => ERP.api.write(() => {
              const vals = { code: v.code.trim(), name: v.name.trim(), dir: v.dir, aux: v.aux };
              if (isNew) {
                const x = Object.assign({ children: [], open: true }, vals);
                // 银行存款下的新科目同步为资金账户
                if (parent && parent.code === '1002') { x.acc = { code: x.code, name: x.name, type: '银行', parent: '1002', balance: 0 }; D.accounts.push(x.acc); }
                sibs.push(x); sibs.sort((a, b) => a.code.localeCompare(b.code));
                if (parent) parent.open = true;
              } else {
                Object.assign(node, vals);
                if (node.acc) Object.assign(node.acc, { code: vals.code, name: vals.name });
              }
              dlg.close(); msg.clear(); draw(t);
              toast(`${isNew ? '已新增' : '已保存'}科目 ${vals.code} ${vals.name}${parent && parent.code === '1002' && isNew ? '，并新建资金账户' : ''}。`);
            }),
          })),
        });
      }
      async function del(t, node) {
        if (node.acc && node.acc.balance) return msg.show('danger', `不能删除科目 ${node.code} ${node.name}：资金账户余额为 ${F.money(node.acc.balance)} 元。请先转出余额。`);
        if (!(await confirm(`删除科目 ${node.code} ${node.name}？`, { okLabel: '删除', danger: true, detail: node.acc ? '同时删除对应的资金账户。' : '删除后不能恢复。' }))) return;
        await ERP.api.write(() => {
          const par = coaParent(coa[t], node);
          const list = par ? par.children : coa[t];
          list.splice(list.indexOf(node), 1);
          if (node.acc) D.accounts.splice(D.accounts.indexOf(node.acc), 1);
        });
        msg.clear(); toast(`科目 ${node.code} 已删除。`); draw(t);
      }
      // 树：每个节点一行（展开按钮、编号名称、方向/辅助核算、余额、操作）
      function nodeEl(t, n) {
        const kids = n.children.length > 0;
        const toggle = kids
          ? h('button.lerp-linkbtn', { type: 'button', 'aria-expanded': String(!!n.open), 'aria-label': `${n.open ? '收起' : '展开'} ${n.code} ${n.name}`, style: { width: '1.5em', textDecoration: 'none' }, onclick: () => { n.open = !n.open; draw(t); } }, n.open ? '▾' : '▸')
          : h('span', { 'aria-hidden': 'true', style: { display: 'inline-block', width: '1.5em' } });
        return h('li',
          h('div.apb-erp-row', toggle, h('span.apb-erp-mono', n.code), h('strong', n.name), badge(`${n.dir}方`),
            n.aux && n.aux !== '无' ? badge(`辅助核算：${n.aux}`, 'info') : null,
            n.acc ? h('span.apb-erp-muted', `余额 ${F.money(n.acc.balance ?? 0)} 元`) : null,
            h('span.apb-erp-row', { style: { marginLeft: 'auto' } },
              linkBtn('新增下级', () => edit(t, n, null), { ariaLabel: `在 ${n.name} 下新增科目` }),
              linkBtn('修改', () => edit(t, coaParent(coa[t], n), n), { ariaLabel: `修改科目 ${n.name}` }),
              kids ? null : linkBtn('删除', () => del(t, n), { variant: 'danger', ariaLabel: `删除科目 ${n.name}` }))),
          kids && n.open ? h('ul', n.children.map((c) => nodeEl(t, c))) : null);
      }
      function draw(t) {
        const pane = panes[t];
        if (!pane) return;
        pane.replaceChildren(coa[t].length ? h('ul.lerp-tree', { 'aria-label': `${TABS.find((x) => x[0] === t)[1]}科目` }, coa[t].map((n) => nodeEl(t, n)))
          : ERP.ui.empty({ title: '尚无科目', text: '点“新增一级科目”。' }));
      }
      ERP.ui.tabs(p.body, TABS.map(([t, title]) => ({ title, render: (pane) => { panes[t] = pane; pane.style.paddingTop = '12px'; draw(t); } })),
        { active, onChange: (i) => { active = i; ERP.setParams(i ? { tab: 'pl' } : {}); } });
    },
  });

  /* ======================================================================
   * 角色配置（角色 × 权限），角色元数据存放在 ERP.data.roleMeta
   * ====================================================================== */
  const STD = ['查看', '新建', '修改', '打印', '查询', '审核', '反审', '冲红', '删除', '导出'];
  const PERMS = {
    '前台': [
      { sec: '业务中心', rows: [['前台业务中心', '前台业务中心（打印导出）', '前台营业日报表', '前台营业日报表（打印导出）']] },
      { sec: '工作单', rows: [STD, ['开单时查看客户应收结余', '开单时查看客户预存结余', '查看结算过程', '审核（0元）'], ['流程转单', '变更委托客户', '复制', '自助付款']], discount: true },
      { sec: '结算单', rows: [['查看', '新建', '修改', '打印', '查询', '反审_云端（退款）', '导出'], ['变更结算方式', '变更结算金额'],
        ['审核', '审核-现金', '审核-记账', '审核-扣预存', '审核-优惠抵扣'], ['反审', '反审-现金', '反审-记账', '反审-扣预存', '反审-优惠抵扣'],
        ['冲红', '冲红-现金', '冲红-记账', '冲红-扣预存', '冲红-优惠抵扣'], ['删除', '删除-现金', '删除-记账', '删除-扣预存', '删除-优惠抵扣']] },
      { sec: '零收单', rows: [STD, ['反审_云端（退款）']] },
      { sec: '会员卡片', rows: [['发行', '刷卡', '修改', '换卡', '查询', '改写', '锁定', '挂失', '调级', '注销'], ['结算时跳过密码验证', '记录查询', '记录导出', '导出']] },
      { sec: '预存单', rows: [[...STD, '日志'], ['反审_云端（退款）']] },
      { sec: '退款单', rows: [[...STD, '日志']] },
    ],
    '生产': [
      { sec: '业务中心', rows: [['生产业务中心', '生产业务中心（打印导出）', '制作明细记录', '制作明细记录（导出）']] },
      { sec: '生产处理', rows: [['我来处理', '流程转单', '查看全部工单', '查看工单金额', '修改制作要求', '修改交付时间']] },
      { sec: '工单文件', rows: [['打开文件夹', '保留文件', '删除文件', '上传附件']] },
    ],
    '供应': [
      { sec: '供应商', rows: [['查看', '新建', '修改', '删除', '导出']] },
      { sec: '采购单', rows: [STD] },
      { sec: '入库单', rows: [STD] },
      { sec: '库存查询', rows: [['库存余额', '出入库明细', '库存预警']] },
    ],
    '财务': [
      { sec: '业务中心', rows: [['财务业务中心', '智多结算中心', '现金余额', '银行余额', '客户结余', '应收汇总']] },
      { sec: '转账单', rows: [STD] }, { sec: '销账单', rows: [STD] }, { sec: '一般收入', rows: [STD] }, { sec: '一般支出', rows: [STD] },
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
    '安全': [
      { sec: '登录控制', rows: [['允许移动端登录', '允许异地登录', '限制登录时段']] },
      { sec: '数据安全', rows: [['查看敏感数据（电话/地址）', '导出数据', '查看他人单据', '修改历史期间单据']] },
    ],
    '扩展': [{ sec: '云端业务', rows: [['云端业务中心', '在线付款码', '推送收银台', '推顾客微信', '短信通知']] }],
    '超级': [{ sec: '超级权限', rows: [['超级管理员（拥有全部权限）', '修改已审核单据', '删除历史数据', '数据初始化']] }],
  };
  const permKeys = (mod) => PERMS[mod].flatMap((s) => s.rows.flat().map((p) => `${mod}|${s.sec}|${p}`));
  const ALL_PERMS = Object.keys(PERMS).flatMap(permKeys);
  D.roleMeta = D.roleMeta || {};
  // 默认权限：综合 = 除“超级”外全部；其他角色以本角色相关模块为主（固定种子，保证每次一致）
  const metaOf = (name) => {
    if (D.roleMeta[name]) return D.roleMeta[name];
    const i = Math.max(0, D.roles.indexOf(name));
    const home = { 前台: ['前台', '客户', '通用'], 生产: ['生产', '通用'], 财务: ['财务', '前台', '报表', '通用'], 后道: ['生产', '通用'], 设计: ['生产', '前台', '通用'] }[name] || [];
    let s = 7;
    const perms = new Set(ALL_PERMS.filter((k) => {
      s = (s * 9301 + 49297) % 233280;
      const mod = k.split('|')[0];
      if (name === '综合') return mod !== '超级';
      return home.includes(mod) && !/删除|反审|冲红/.test(k) ? s / 233280 < 0.85 : s / 233280 < 0.08;
    }));
    return (D.roleMeta[name] = { code: String(10000 + (i + 1) * 1000), name, collapse: false, noToolbar: false, prod: ['生产', '后道', '设计', '综合', '前台'].includes(name), enabled: true, perms, maxDiscount: '' });
  };
  biz.rolePerms = (role) => metaOf(role).perms;
  const roleUsers = (name) => D.employees.filter((e) => e.role === name).length;

  ERP.page('roles', {
    module: 'sys', title: '角色配置', desc: '员工按角色获得权限。停用的角色不能登录；有员工使用的角色不能删除。',
    render(el, params, ctx) {
      const msg = msgSlot(el);
      D.roles.forEach(metaOf);
      // 新建角色（短操作）：名称 + 复制权限来源，创建后进入权限编辑页
      const create = () => {
        const name = input({ name: 'name', maxlength: 10 });
        name._validate = (v) => (D.roles.includes(v) ? `角色「${v}」已存在。` : null);
        const dlg = dialog({
          title: '新建角色', kicker: '创建后进入权限配置',
          body: (b) => b.appendChild(ERP.ui.form({
            submitLabel: '创建角色',
            sections: [{ fields: [
              field({ label: '角色名称', control: name, required: true }),
              field({ label: '复制权限自', control: select([['', '（不复制，空白权限）'], ...D.roles], { name: 'copy' }) }),
            ] }],
            moreActions: btn('取消', () => dlg.close()),
            onSubmit: (v) => ERP.api.write(() => {
              const nm = v.name.trim();
              D.roles.push(nm);
              const m = metaOf(nm);
              m.perms = v.copy ? new Set(metaOf(v.copy).perms) : new Set();
              dlg.close(); toast(`已新建角色「${nm}」（${m.perms.size} 项权限）。`);
              ERP.go('roleEdit', { name: nm });
            }),
          })),
        });
      };
      ctx.setActions([btn('新建角色', create, { variant: 'primary' })]);
      const list = ERP.ui.list(el, {
        title: '角色', note: `权限共 ${ALL_PERMS.length} 项，分 ${Object.keys(PERMS).length} 个模块`, params,
        load: () => D.roles.map(metaOf),
        columns: [
          { key: 'code', title: '角色编号', type: 'mono' },
          { key: 'name', title: '角色名称', render: (m) => link(m.name, 'roleEdit', { name: m.name }, { ariaLabel: `配置角色 ${m.name} 的权限` }) },
          { key: 'enabled', title: '状态', render: (m) => (m.enabled ? badge('已启用', 'success') : badge('已停用', 'warning')) },
          { key: 'prod', title: '参与生产', render: (m) => (m.prod ? '是' : '否') },
          { key: 'users', title: '员工数', type: 'num', render: (m) => link(String(roleUsers(m.name)), 'employees', { role: m.name }, { ariaLabel: `查看角色 ${m.name} 的员工` }) },
          { key: 'perms', title: '已授权限', type: 'num', render: (m) => `${m.perms.size} / ${ALL_PERMS.length}` },
        ],
        idKey: 'name',
        rowActions: (m) => [
          link('配置权限', 'roleEdit', { name: m.name }, { ariaLabel: `配置角色 ${m.name} 的权限` }),
          linkBtn(m.enabled ? '停用' : '启用', async () => {
            const n = roleUsers(m.name);
            if (m.enabled && !(await confirm(`停用角色「${m.name}」？`, { okLabel: '停用', detail: n ? `${n} 名员工使用该角色，停用后他们不能登录。` : '没有员工使用该角色。' }))) return;
            await ERP.api.write(() => { m.enabled = !m.enabled; });
            msg.clear(); toast(`角色「${m.name}」已${m.enabled ? '启用' : '停用'}。`); list.reload();
          }, { ariaLabel: `${m.enabled ? '停用' : '启用'}角色 ${m.name}` }),
          linkBtn('删除', async () => {
            const n = roleUsers(m.name);
            if (n) return msg.show('danger', `不能删除角色「${m.name}」：有 ${n} 名员工使用。请先把他们改为其他角色。`, ' ', link('查看这些员工', 'employees', { role: m.name }));
            if (!(await confirm(`删除角色「${m.name}」？`, { okLabel: '删除', danger: true, detail: '角色的权限配置一并删除，不能恢复。' }))) return;
            await ERP.api.write(() => { D.roles.splice(D.roles.indexOf(m.name), 1); delete D.roleMeta[m.name]; });
            msg.clear(); toast(`角色「${m.name}」已删除。`); list.reload();
          }, { variant: 'danger', ariaLabel: `删除角色 ${m.name}` }),
        ],
        emptyTitle: '尚无角色', emptyAction: btn('新建角色', create, { variant: 'primary' }),
      });
    },
  });

  /* 角色权限编辑（表单页）：基本资料 → 界面与生产 → 按模块分页签的权限复选框组 */
  ERP.page('roleEdit', {
    module: 'sys', title: '角色权限', nav: false, parent: 'roles', smokeParams: { name: '前台' },
    render(el, params, ctx) {
      if (!params.name || !D.roles.includes(params.name)) return missing(el, `角色「${params.name || ''}」`, 'roles', '返回角色配置');
      const m = metaOf(params.name);
      ctx.setTitle(`角色权限：${m.name}`);
      const work = new Set(m.perms); // 工作副本，保存时写回
      let maxDiscount = m.maxDiscount || '';
      const count = h('p.apb-erp-muted', { role: 'status', 'aria-live': 'polite' });
      const updCount = () => { count.textContent = `已选 ${work.size} / ${ALL_PERMS.length} 项权限。`; };
      const changed = () => { updCount(); form.dispatchEvent(new Event('input')); };
      const name = input({ name: 'name', value: m.name, maxlength: 10 });
      name._validate = (v) => (v !== m.name && D.roles.includes(v) ? `角色「${v}」已存在。` : null);
      const users = roleUsers(m.name);
      // 某个模块的权限分区：每个分区一组复选框 + “全选/全不选”
      const modulePane = (mod, pane) => {
        pane.style.paddingTop = '12px';
        pane.appendChild(h('div.apb-erp-stack', PERMS[mod].map((s) => {
          const boxes = [];
          const rows = s.rows.map((r) => h('div.lerp-checks', r.map((p) => {
            const key = `${mod}|${s.sec}|${p}`;
            const lab = checkbox(p, work.has(key), { onchange: (e) => { e.target.checked ? work.add(key) : work.delete(key); updCount(); } });
            boxes.push([lab.querySelector('input'), key]);
            return lab;
          })));
          const all = linkBtn('全选 / 全不选', () => {
            const on = !boxes.every(([cb]) => cb.checked);
            boxes.forEach(([cb, key]) => { cb.checked = on; on ? work.add(key) : work.delete(key); });
            changed();
          }, { ariaLabel: `${mod} ${s.sec}：全选或全不选` });
          let disc = null;
          if (s.discount) {
            const di = input({ value: maxDiscount, inputmode: 'decimal', placeholder: '如 8.5', class: 'lerp-amount', style: { maxWidth: '160px' }, oninput: (e) => (maxDiscount = e.target.value.trim()) });
            di._validate = (v) => (v && (!/^\d+(\.\d)?$/.test(v) || +v <= 0 || +v > 10) ? '请填写 0～10 之间的折扣，例如 8.5；不限制则留空。' : null);
            disc = field({ label: '普通客户最大整单折扣', control: di, help: '10 表示不打折；留空表示不限制。' });
          }
          return h('fieldset.apb-erp-field', { style: { border: 0, borderTop: '1px solid var(--apb-erp-line)', padding: '8px 0 0', margin: 0 } },
            h('legend', s.sec), h('div.apb-erp-row', all), rows, disc);
        })));
      };
      const permBox = h('div');
      const drawPerms = () => { permBox.replaceChildren(); ERP.ui.tabs(permBox, Object.keys(PERMS).map((mod) => ({ title: mod, render: (pane) => modulePane(mod, pane) }))); updCount(); };
      const copyFrom = () => {
        const src = select(D.roles.filter((r) => r !== m.name), { 'aria-label': '复制来源角色' });
        dialog({
          title: '从其他角色复制权限', kicker: `复制到：${m.name}`,
          body: [field({ label: '来源角色', control: src }), notice('warning', '会替换当前页面上的全部权限勾选；保存后才生效。')],
          actions: [{ label: '取消' }, { label: '复制权限', variant: 'primary', onClick: (close) => {
            work.clear(); metaOf(src.value).perms.forEach((k) => work.add(k));
            maxDiscount = metaOf(src.value).maxDiscount || '';
            close(); drawPerms(); changed(); toast(`已复制「${src.value}」的 ${work.size} 项权限，保存后生效。`);
          } }],
        });
      };
      const form = ERP.ui.form({
        ctx, wide: true, submitLabel: '保存角色',
        cancel: { href: ERP.href('roles'), label: '返回列表' },
        moreActions: btn('从其他角色复制…', copyFrom),
        sections: [
          { title: '基本资料', cols: 3, fields: [
            field({ label: '角色编号', control: input({ name: 'code', value: m.code, maxlength: 10, class: 'apb-erp-mono' }) }),
            field({ label: '角色名称', control: name, required: true, help: users ? `改名后 ${users} 名员工同步改到新名称。` : null }),
            h('div.apb-erp-field', h('span.lerp-label', '状态'), h('div', m.enabled ? badge('已启用', 'success') : badge('已停用', 'warning')), h('span.apb-erp-muted', '在角色列表中启用或停用。')),
          ] },
          { title: '界面与生产', content: checks(checkbox('默认折叠主菜单', m.collapse, { name: 'collapse' }), checkbox('不启用工具栏', m.noToolbar, { name: 'noToolbar' }), checkbox('参与生产（可被选为处理员工）', m.prod, { name: 'prod' })) },
          { title: '角色权限', note: '按模块分页签；点分区的“全选 / 全不选”快速勾选。', content: [count, permBox] },
        ],
        onSubmit: (v) => ERP.api.write(() => {
          const nm = v.name.trim(), old = m.name;
          if (nm !== old) {
            // 改名同步：角色列表、员工角色、当前登录员工
            D.roles[D.roles.indexOf(old)] = nm;
            D.employees.forEach((e) => { if (e.role === old) e.role = nm; });
            if (D.currentUser.role === old) D.currentUser.role = nm;
            delete D.roleMeta[old]; D.roleMeta[nm] = m; m.name = nm;
          }
          Object.assign(m, { code: v.code.trim(), collapse: !!v.collapse, noToolbar: !!v.noToolbar, prod: !!v.prod, perms: new Set(work), maxDiscount });
          form.markClean();
          toast(`角色「${nm}」已保存：${m.perms.size} 项权限${nm !== old && users ? `，${users} 名员工已同步` : ''}。`);
          ERP.go('roles');
        }),
      });
      drawPerms();
      el.appendChild(panel({ title: '角色资料' }).el).querySelector('.apb-erp-panelbody').appendChild(form);
    },
  });

  /* ======================================================================
   * 运行参数（分组表单），参数值存放在 ERP.sysParams
   * ====================================================================== */
  const PARAM_DEFS = [
    { g: '基础', sets: [
      { t: '企业信息', items: [['company', '企业名称', 'text', D.company.name], ['branch', '门店名称', 'text', '0 - 本店'], ['tel', '联系电话', 'text', '0731-88888888'], ['addr', '地址', 'text', '长沙市岳麓区麓山南路 1 号']] },
      { t: '编号规则', items: [['woPrefix', '工作单前缀', 'text', 'GD'], ['jsPrefix', '结算单前缀', 'text', 'JS'], ['noDigits', '流水号位数', 'number', 5], ['custCodeAuto', '客户编号自动生成', 'check', true]] },
    ] },
    { g: '前台', sets: [
      { t: '开单', items: [['defaultCust', '默认客户', 'text', '000000/散户'], ['mustTask', '开单必须填写制作任务', 'check', false], ['mustDue', '开单必须填写交付日期', 'check', false],
        ['autoPrint', '保存后自动打印工单', 'check', false], ['showDebt', '开单时提示客户应收结余', 'check', true], ['priceEdit', '允许修改实价', 'check', true]] },
      { t: '金额', items: [['moneyDigits', '金额小数位数', 'select', '2', ['0', '1', '2']], ['priceDigits', '单价小数位数', 'select', '4', ['2', '3', '4']], ['wipe', '抹零方式', 'select', '不抹零', ['不抹零', '抹角', '抹分', '四舍五入到元']]] },
    ] },
    { g: '结算', sets: [
      { t: '收款', items: [['defMethod', '默认结算方式', 'select', '现金', D.payMethods], ['defAccount', '默认入账科目', 'select', '现金 > 前台钱箱', ['现金 > 前台钱箱', ...D.accounts.filter((a) => a.parent).map((a) => '银行存款 > ' + a.name)]],
        ['autoAudit', '收款后自动审核结算单', 'check', true], ['allowCredit', '允许记账（挂账）', 'check', true], ['creditLimit', '默认信用额度（元）', 'number', 0]] },
      { t: '在线支付', items: [['payWx', '启用微信支付', 'check', true], ['payAli', '启用支付宝支付', 'check', true], ['payExpire', '收款码有效期（分钟）', 'number', 30]] },
    ] },
    { g: '预存', sets: [
      { t: '会员卡', items: [['cardPwd', '刷卡结算需要密码', 'check', true], ['cardGift', '储值赠送比例（%）', 'number', 5], ['cardLowWarn', '余额低于此值提醒（元）', 'number', 100], ['cardReader', '读卡器型号', 'select', 'URF-R330', ['URF-R330', 'MW-D8', '无']]] },
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
      { t: '登录', items: [['pwdLen', '密码最小长度', 'number', 6], ['lockTimes', '连续输错锁定次数', 'number', 5], ['idleLock', '空闲自动锁屏（分钟，0 为不锁）', 'number', 0], ['mobileLogin', '允许移动端登录', 'check', true]] },
      { t: '备份', items: [['autoBackup', '每日自动备份数据库', 'check', true], ['backupTime', '备份时间', 'text', '23:30'], ['backupKeep', '备份保留份数', 'number', 7]] },
    ] },
  ];
  const PARAM_ITEMS = PARAM_DEFS.flatMap((g) => g.sets.flatMap((s) => s.items));
  const sysParams = (ERP.sysParams = ERP.sysParams || {});
  PARAM_ITEMS.forEach(([k, , , v]) => { if (!(k in sysParams)) sysParams[k] = v; });

  ERP.page('runParams', {
    module: 'sys', title: '运行参数', desc: '系统运行时的业务参数，保存后对全部门店与员工生效。',
    render(el, params, ctx) {
      const ctl = {};
      const mk = ([k, label, type, , opts]) => {
        if (type === 'check') return (ctl[k] = checkbox(label, !!sysParams[k], { name: k }));
        const c = type === 'select' ? select(opts, { name: k, value: sysParams[k] }) : input({ name: k, value: sysParams[k], inputmode: type === 'number' ? 'numeric' : null, class: type === 'number' ? 'lerp-amount' : null });
        if (type === 'number') c._validate = (v) => (!/^\d+$/.test(v) ? '请填写不小于 0 的整数。' : null);
        if (k === 'backupTime') c._validate = (v) => (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? '请填写 24 小时制时间，例如 23:30。' : null);
        ctl[k] = c;
        return field({ label, control: c, required: ['company', 'woPrefix', 'jsPrefix', 'period'].includes(k) });
      };
      const sections = PARAM_DEFS.flatMap((g) => g.sets.map((s) => ({
        title: `${g.g} · ${s.t}`,
        fields: s.items.filter((i) => i[2] !== 'check').map(mk),
        content: s.items.some((i) => i[2] === 'check') ? h('div.lerp-checks', s.items.filter((i) => i[2] === 'check').map(mk)) : null,
      })));
      const resetBtn = btn('恢复默认值', async () => {
        if (!(await confirm('把全部运行参数恢复为默认值？', { okLabel: '恢复默认值', detail: '只改页面上的值，点“保存参数”后才生效。' }))) return;
        PARAM_ITEMS.forEach(([k, , type, v]) => { if (type === 'check') ctl[k].querySelector('input').checked = !!v; else ctl[k].value = v; });
        form.dispatchEvent(new Event('input'));
        toast('已恢复默认值，保存后生效。');
      });
      const form = ERP.ui.form({
        ctx, submitLabel: '保存参数', sections, moreActions: resetBtn,
        onSubmit: (v) => ERP.api.write(() => {
          const next = {};
          PARAM_ITEMS.forEach(([k, , type]) => { next[k] = type === 'check' ? !!v[k] : type === 'number' ? Number(v[k]) : String(v[k] ?? '').trim(); });
          const changedKeys = Object.keys(next).filter((k) => next[k] !== sysParams[k]);
          Object.assign(sysParams, next);
          if (sysParams.company) D.company.name = sysParams.company;
          if (sysParams.period) D.company.period = sysParams.period;
          form.markClean();
          const m = changedKeys.length ? `运行参数已保存：${changedKeys.length} 项修改，${F.stamp(new Date())}。` : '运行参数没有修改。';
          toast(m);
          return m;
        }),
      });
      // 分组快速跳转（页内）
      const secs = [...form.querySelectorAll('.lerp-section > h2')];
      secs.forEach((x) => (x.tabIndex = -1));
      const jump = h('nav.apb-erp-row', { 'aria-label': '参数分组' }, h('span.apb-erp-muted', '跳到：'),
        PARAM_DEFS.map((g) => linkBtn(g.g, () => { const t = secs.find((x) => x.textContent.startsWith(g.g + ' ·')); t.scrollIntoView({ block: 'start' }); t.focus({ preventScroll: true }); })));
      const p = panel({ title: '参数设置', note: `${PARAM_ITEMS.length} 项参数，按业务分组` });
      p.body.append(jump, h('div', { style: { height: '16px' } }), form);
      el.appendChild(p.el);
    },
  });

  /* ======================================================================
   * 打印样式（单据 × 样式），存放在 ERP.data.printStyles
   * ====================================================================== */
  const PAPERS = ['A4', 'A5', '80mm 小票', '58mm 小票', '标签 60×40mm'];
  const initStyles = () => [
    ['财务', '对账单（结算单据-单据记录）', 1], ['财务', '对账单（结算单据-明细记录）', 1], ['财务', '销账单', 1], ['财务', '一般收支单', 0], ['财务', '转账单', 0],
    ['前台', '结算单', 1], ['前台', '营业日报表（仅现金业务明细）', 1], ['前台', '营业日报表（全部的业务明细）', 1], ['前台', '预存单', 1], ['前台', '零收单', 0], ['前台', '退款单', 0], ['前台', '会员卡（卡面）', 0],
    ['生产', '工作单', 1], ['生产', '工作单（小票）', 0], ['生产', '送货单', 0], ['生产', '制作标签', 0],
    ['客户', '客户资料卡', 0], ['客户', '价格表', 0],
  ].map(([sec, name, common]) => ({ sec, name, common: !!common,
    styles: [{ name: '默认样式', paper: /小票/.test(name) ? '80mm 小票' : /标签/.test(name) ? '标签 60×40mm' : 'A4', dir: '纵向', def: true }, { name: '简洁样式', paper: 'A5', dir: '横向', def: false }] }));
  const styleDocs = () => (D.printStyles = D.printStyles || initStyles());
  const defStyle = (d) => d.styles.find((s) => s.def) || d.styles[0];

  ERP.page('printStyles', {
    module: 'sys', title: '打印样式', desc: '全部单据的打印样式。每种单据可有多个样式，打印时使用“默认”样式。',
    render(el, params) {
      const list = ERP.ui.list(el, {
        title: '单据打印样式', params,
        load: styleDocs,
        filters: [
          { key: 'q', type: 'search', label: '搜索单据', placeholder: '单据名称', keys: ['name'] },
          { key: 'sec', type: 'select', label: '业务分类', options: ['前台', '生产', '财务', '客户'] },
          { key: 'common', type: 'select', label: '常用', options: [['1', '仅常用'], ['0', '不常用']], match: (d, v) => d.common === (v === '1') },
        ],
        columns: [
          { key: 'name', title: '单据', width: 240, render: (d) => link(d.name, 'printStyleEdit', { doc: d.name }, { ariaLabel: `管理 ${d.name} 的打印样式` }) },
          { key: 'sec', title: '业务分类' },
          { key: 'def', title: '默认样式', render: (d) => defStyle(d).name, sub: (d) => `${defStyle(d).paper} · ${defStyle(d).dir}` },
          { key: 'n', title: '样式数', type: 'num', render: (d) => String(d.styles.length) },
          { key: 'common', title: '常用', render: (d) => (d.common ? badge('常用', 'info') : '—') },
        ],
        idKey: 'name',
        rowActions: (d) => [
          link('管理样式', 'printStyleEdit', { doc: d.name }, { ariaLabel: `管理 ${d.name} 的打印样式` }),
          linkBtn(d.common ? '取消常用' : '设为常用', async () => { await ERP.api.write(() => { d.common = !d.common; }, 200); toast(`「${d.name}」已${d.common ? '设为常用' : '取消常用'}。`); list.reload(); },
            { ariaLabel: `${d.common ? '取消常用' : '设为常用'}：${d.name}` }),
        ],
      });
    },
  });

  ERP.page('printStyleEdit', {
    module: 'sys', title: '单据打印样式', nav: false, parent: 'printStyles', smokeParams: { doc: '工作单' },
    render(el, params, ctx) {
      const doc = styleDocs().find((d) => d.name === params.doc);
      if (!doc) return missing(el, `单据「${params.doc || ''}」`, 'printStyles', '返回打印样式');
      ctx.setTitle(`打印样式：${doc.name}`);
      let cur = defStyle(doc);
      ctx.setActions([btn('打印预览', () => window.print())]);
      el.appendChild(notice('info', '原型：样式设计器需在桌面客户端中打开；这里可以管理样式、设默认并预览大致版式。'));
      const p1 = panel({ title: '样式', note: `${doc.sec} · ${doc.name}`, flush: true });
      const p2 = panel({ title: '版式预览', note: '示例数据；实际版式以样式设计器为准' });
      el.append(p1.el, p2.el);
      // 修改样式（短操作）
      const editStyle = (s) => {
        const nm = input({ name: 'name', value: s.name, maxlength: 30 });
        nm._validate = (v) => (doc.styles.some((x) => x !== s && x.name === v) ? `已有同名样式「${v}」。` : null);
        const dlg = dialog({
          title: '修改样式', kicker: doc.name,
          body: (b) => b.appendChild(ERP.ui.form({
            submitLabel: '保存样式',
            sections: [{ fields: [field({ label: '样式名称', control: nm, required: true }),
              field({ label: '纸张', control: select(PAPERS, { name: 'paper', value: s.paper }) }), field({ label: '方向', control: select(['纵向', '横向'], { name: 'dir', value: s.dir }) })] }],
            moreActions: btn('取消', () => dlg.close()),
            onSubmit: (v) => ERP.api.write(() => { Object.assign(s, { name: v.name.trim(), paper: v.paper, dir: v.dir }); cur = s; dlg.close(); draw(); toast(`样式「${s.name}」已保存。`); }),
          })),
        });
      };
      function draw() {
        p1.body.replaceChildren();
        ERP.ui.table(p1.body, {
          caption: '打印样式', rows: doc.styles,
          columns: [
            { key: 'name', title: '样式名称', render: (s) => h('span', s.name, s === cur ? h('span.apb-erp-muted', '正在预览') : null) },
            { key: 'paper', title: '纸张' }, { key: 'dir', title: '方向' },
            { key: 'def', title: '默认', render: (s) => (s.def ? badge('默认', 'success') : '—') },
          ],
          rowActions: (s) => [
            s === cur ? null : linkBtn('预览', () => { cur = s; draw(); }, { ariaLabel: `预览样式 ${s.name}` }),
            linkBtn('修改', () => editStyle(s), { ariaLabel: `修改样式 ${s.name}` }),
            linkBtn('设计', () => toast(`样式设计器（原型）：${s.name}。`), { ariaLabel: `设计样式 ${s.name}` }),
            s.def ? null : linkBtn('设为默认', async () => { await ERP.api.write(() => doc.styles.forEach((x) => (x.def = x === s)), 200); toast(`「${s.name}」已设为默认样式。`); draw(); }, { ariaLabel: `把 ${s.name} 设为默认` }),
            linkBtn('复制', async () => {
              await ERP.api.write(() => { let n = s.name + '-副本', i = 2; while (doc.styles.some((x) => x.name === n)) n = `${s.name}-副本${i++}`; doc.styles.push({ ...s, name: n, def: false }); }, 200);
              toast('已复制样式。'); draw();
            }, { ariaLabel: `复制样式 ${s.name}` }),
            s.def ? null : linkBtn('删除', async () => {
              if (!(await confirm(`删除样式「${s.name}」？`, { okLabel: '删除', danger: true }))) return;
              await ERP.api.write(() => doc.styles.splice(doc.styles.indexOf(s), 1), 200);
              if (cur === s) cur = defStyle(doc);
              toast('样式已删除。'); draw();
            }, { variant: 'danger', ariaLabel: `删除样式 ${s.name}` }),
          ],
        });
        // 版式预览：按纸张/方向给出大致宽度
        const narrow = /小票|标签/.test(cur.paper);
        const width = narrow ? 300 : cur.dir === '横向' ? 640 : 460;
        const lines = [{ name: '彩色打印 A4', qty: 10, amount: 20 }, { name: '胶装', qty: 1, amount: 10 }];
        const paper = h('div', { style: { maxWidth: width + 'px', padding: '16px', border: '1px solid var(--apb-erp-line)', borderRadius: 'var(--apb-erp-control-radius)', background: 'var(--apb-erp-surface)' } },
          h('h3', { style: { textAlign: 'center', margin: 0 } }, D.company.name), h('p.apb-erp-muted', { style: { textAlign: 'center' } }, doc.name),
          kv([['单号', h('span.apb-erp-mono', 'GD26101910003')], ['客户', '散户'], ['日期', F.date(new Date())], ['经手', D.currentUser.name]]));
        ERP.ui.table(paper, { caption: '预览明细', compact: true, rows: lines, columns: [{ key: 'name', title: '项目' }, { key: 'qty', title: '数量', type: 'num' }, { key: 'amount', title: '金额（元）', type: 'money', sum: true }] });
        paper.appendChild(h('p.apb-erp-muted', `${cur.name} · ${cur.paper} · ${cur.dir}`));
        p2.body.replaceChildren(paper);
      }
      draw();
    },
  });

  /* ======================================================================
   * 基础数据（枚举型数据），存放在 ERP.data.baseData
   * 与 ERP.data 中数组联动的类型（制作任务、结算方式等）修改后写回，其他模块即时可见
   * ====================================================================== */
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
  const baseData = () => (D.baseData = D.baseData || BD_TYPES.map((c) => ({
    cat: c.cat, types: c.types.map(([name, src, start]) => {
      const linked = Object.values(D).includes(src) ? src : null;
      const s = start || 1000;
      return { name, link: linked, keepEmpty: linked ? linked.includes('') : false, entries: src.filter((x) => x !== '').map((x, i) => ({ code: String(s + i * 5), name: x, desc: '' })) };
    }),
  })));
  const writeBack = (t) => { if (t.link) t.link.splice(0, t.link.length, ...(t.keepEmpty ? [''] : []), ...t.entries.map((e) => e.name)); };

  ERP.page('baseData', {
    module: 'sys', title: '基础数据', desc: '各模块共用的枚举数据（制作任务、结算方式、部门岗位等）。先选数据类型，再维护条目。',
    render(el, params) {
      const cats = baseData();
      const allTypes = cats.flatMap((c) => c.types);
      const type = allTypes.find((t) => t.name === params.t) || allTypes[0];
      const msg = msgSlot(el);
      const wrap = h('div.apb-erp-row', { style: { alignItems: 'flex-start', gap: '16px' } });
      el.appendChild(wrap);
      // 左：数据类型（按分类分组的链接）
      const pt = panel({ title: '数据类型', note: '“联动”表示修改后开单、结算等界面立即生效' });
      pt.el.style.flex = '1 1 220px';
      pt.body.appendChild(h('ul.lerp-tree', cats.map((c) => h('li', h('strong', c.cat),
        h('ul', c.types.map((t) => h('li', h('a', { href: ERP.href('baseData', { t: t.name }), 'aria-current': t === type ? 'page' : null, style: t === type ? { fontWeight: 700 } : null }, t.name),
          ' ', h('span.apb-erp-muted', { style: { display: 'inline' } }, `${t.entries.length} 项${t.link ? ' · 联动' : ''}`))))))));
      wrap.appendChild(pt.el);
      // 右：条目列表
      const right = h('div', { style: { flex: '3 1 480px', minWidth: 0 } });
      wrap.appendChild(right);
      const editEntry = (e) => {
        const isNew = !e;
        const code = input({ name: 'code', value: isNew ? String(Math.max(995, ...type.entries.map((x) => +x.code)) + 5) : e.code, maxlength: 6, inputmode: 'numeric', class: 'apb-erp-mono' });
        code._validate = (v) => (!/^\d{1,6}$/.test(v) ? '编号为 1～6 位数字。' : type.entries.some((x) => x !== e && x.code === v) ? `编号 ${v} 已存在。` : null);
        const nm = input({ name: 'name', value: isNew ? '' : e.name, maxlength: 30 });
        nm._validate = (v) => (type.entries.some((x) => x !== e && x.name === v) ? `「${v}」已存在。` : null);
        const dlg = dialog({
          title: isNew ? `新建${type.name}` : `修改${type.name}`, kicker: type.link ? '联动数据：保存后其他界面立即生效' : '基础数据',
          body: (b) => b.appendChild(ERP.ui.form({
            submitLabel: isNew ? '新建' : '保存',
            sections: [{ fields: [
              field({ label: '编号', control: code, required: true, help: '决定排列顺序，请慎重修改。' }), field({ label: '名称', control: nm, required: true }),
              field({ label: '描述', control: textarea({ name: 'desc', value: isNew ? '' : e.desc, maxlength: 200 }), span: 'all' }),
            ] }],
            moreActions: btn('取消', () => dlg.close()),
            onSubmit: (v) => ERP.api.write(() => {
              const r = e || {};
              Object.assign(r, { code: v.code.trim(), name: v.name.trim(), desc: v.desc.trim() });
              if (isNew) type.entries.push(r);
              type.entries.sort((a, b) => +a.code - +b.code);
              writeBack(type);
              dlg.close(); msg.clear(); toast(`${isNew ? '已新建' : '已保存'}${type.name}：${r.name}。`); list.reload();
            }),
          })),
        });
      };
      const list = ERP.ui.list(right, {
        title: type.name, note: type.link ? '联动数据：与开单、结算等界面共用' : `共 ${type.entries.length} 项`, params, keepParams: { t: type.name },
        actions: [btn('新建条目', () => editEntry(null), { variant: 'primary' })],
        load: () => type.entries,
        filters: [{ key: 'q', type: 'search', label: '搜索条目', placeholder: '编号 / 名称', keys: ['code', 'name', 'desc'] }],
        columns: [{ key: 'code', title: '编号', type: 'mono' }, { key: 'name', title: '名称' }, { key: 'desc', title: '描述', render: (e) => e.desc || '—' }],
        idKey: 'code',
        rowActions: (e) => [
          linkBtn('修改', () => editEntry(e), { ariaLabel: `修改 ${e.name}` }),
          linkBtn('删除', async () => {
            if (!(await confirm(`删除${type.name}「${e.code} ${e.name}」？`, { okLabel: '删除', danger: true, detail: '已使用该值的历史单据不受影响；新单据不能再选择。' }))) return;
            await ERP.api.write(() => { type.entries.splice(type.entries.indexOf(e), 1); writeBack(type); });
            toast(`已删除：${e.name}。`); list.reload();
          }, { variant: 'danger', ariaLabel: `删除 ${e.name}` }),
        ],
        emptyTitle: `尚无${type.name}`, emptyText: '点“新建条目”添加。', emptyAction: btn('新建条目', () => editEntry(null), { variant: 'primary' }),
      });
    },
  });

  /* ======================================================================
   * 数据导入（向导：数据类型 → 文件（CSV）→ 字段对应 → 预览校验 → 完成）
   * ====================================================================== */
  const IMPORT = {
    customers: { label: '客户资料', page: 'custManage', desc: '客户编号、名称、分组、联系人、手机、地址',
      fields: [['code', '客户编号', 1], ['name', '客户名称', 1], ['groupName', '客户分组'], ['type', '客户类型'], ['contact', '联系人'], ['phone', '手机'], ['address', '地址'], ['remark', '说明备注']],
      sample: [['客户编号', '客户名称', '分组', '类型', '联系人', '手机号码', '地址', '备注'], ['2001', '长沙理工大学设计学院', '设计院', '机构', '王老师', '13800138001', '长沙市天心区万家丽南路2段960号', ''],
        ['2002', '湖南省测绘院', '政府单位', '机构', '李工', '13900139002', '长沙市岳麓区', '月结'], ['2003', '张三', '普通', '个人', '', '13700137003', '', ''], ['1010', '商务局（更新）', '设计院', '机构', '赵科长', '13600136004', '', ''], ['', '缺少编号的客户', '普通', '', '', '', '', '']] },
    items: { label: '经营项目', page: 'bizItems', desc: '项目编号、经营主项、名称、单位、定价量级、销售单价',
      fields: [['code', '项目编号', 1], ['catName', '经营主项', 1], ['name', '项目名称', 1], ['unit', '单位'], ['tier', '定价量级'], ['price', '销售单价', 1]],
      sample: [['编号', '主项', '名称', '单位', '量级', '单价'], ['250010', '广告喷绘◎', '车贴（反光膜）', '㎡', '-', '65'], ['350010', '标识标牌◎', '不锈钢腐蚀牌', '块', '-', '180'],
        ['880001', '文创产品', '帆布袋印刷', '个', '-', '18'], ['500020', '标准产品', '', '个', '-', '10'], ['500021', '标准产品', '台历', '本', '-', '十五']] },
    employees: { label: '员工资料', page: 'employees', desc: '员工编号、姓名、角色、部门岗位、手机、性别、入职日期',
      fields: [['code', '员工编号', 1], ['name', '员工姓名', 1], ['role', '员工角色'], ['dept', '部门岗位'], ['mobile', '手机号码'], ['gender', '性别'], ['joinDate', '入职日期']],
      sample: [['工号', '姓名', '角色', '部门', '手机', '性别', '入职日期'], ['0101', '陈晓', '前台', '生产制作>前台', '13511112222', '女', '2026-09-01'],
        ['0102', '刘设计', '设计', '生产制作>设计', '13511113333', '男', '2026-09-15'], ['0103', '周后道', '后道', '生产制作>后道', '', '男', '2026/10/08'], ['0101', '陈晓（重复）', '前台', '', '', '女', '']] },
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
  biz.parseCsv = parseCsv;
  // 按表头自动匹配：先找同名列，再找包含关键字的列
  const ALIAS = { code: ['编号', '编码', '工号', '代码'], name: ['名称', '姓名', '客户', '项目'], groupName: ['分组'], type: ['类型'], contact: ['联系人'], phone: ['手机', '电话'],
    address: ['地址'], remark: ['备注', '说明'], catName: ['主项', '大类', '类别'], unit: ['单位'], tier: ['量级'], price: ['单价', '价格'], role: ['角色'], dept: ['部门', '岗位'], mobile: ['手机', '电话'],
    gender: ['性别'], joinDate: ['入职'] };
  const STEPS = ['选择数据类型', '选择文件', '字段对应', '预览校验', '导入完成'];
  const STATUS_TONE = { 新增: 'success', 覆盖: 'info', 跳过: undefined, 错误: 'danger' };

  ERP.page('dataImport', {
    module: 'sys', title: '数据导入', desc: '从 CSV 文件批量导入客户资料、经营项目、员工资料。按编号判断记录是否已存在。',
    render(el, params, ctx) {
      const st = { step: 0, type: 'customers', fileName: '', header: [], rows: [], map: {}, dup: 'skip', result: null };
      const reset = () => Object.assign(st, { step: 0, fileName: '', header: [], rows: [], map: {}, result: null });
      ctx.setActions([btn('下载导入模板', () => downloadTemplate())]);
      ctx.guard(() => (st.rows.length && st.step < 4 ? ERP.ui.discardDialog() : Promise.resolve(true)), () => !!st.rows.length && st.step < 4);
      const stepsEl = h('ol.lerp-steps', { 'aria-label': '导入步骤' });
      const errSlot = h('div');
      const pane = h('div.apb-erp-stack');
      const prev = btn('上一步', () => { st.step--; draw(true); });
      const next = btn('下一步', () => goNext(), { variant: 'primary', busySlot: true });
      const p = panel({ title: '导入向导' });
      p.body.append(h('div.apb-erp-stack', stepsEl, errSlot, pane, h('div.apb-erp-formactions', next, prev)));
      el.appendChild(p.el);
      const def = () => IMPORT[st.type];
      const fail = (...c) => { errSlot.replaceChildren(notice('danger', ...c)); };

      const autoMap = () => {
        st.map = {};
        const used = new Set();
        def().fields.forEach(([k, lbl]) => {
          let idx = st.header.findIndex((x) => x.trim() === lbl);
          if (idx < 0) idx = st.header.findIndex((x, i) => !used.has(i) && (ALIAS[k] || []).some((a) => x.includes(a)));
          if (idx >= 0) used.add(idx);
          st.map[k] = idx;
        });
      };
      const loadTable = (table, name) => {
        if (table.length < 2) return fail(`文件「${name}」没有数据行。首行须为列标题，从第 2 行开始是数据。`);
        st.header = table[0]; st.rows = table.slice(1); st.fileName = name; autoMap(); errSlot.replaceChildren(); draw();
      };
      // 转换并校验：缺必填、格式、文件内编号重复、是否已存在
      const converted = () => {
        const seen = new Set();
        return st.rows.map((r, i) => {
          const o = { _line: i + 2 };
          def().fields.forEach(([k]) => (o[k] = st.map[k] >= 0 ? String(r[st.map[k]] ?? '').trim() : ''));
          const errs = def().fields.filter(([k, , req]) => req && !o[k]).map(([, l]) => '缺少' + l);
          if (st.type === 'items' && o.price && !/^\d+(\.\d{1,4})?$/.test(o.price)) errs.push('销售单价不是数字');
          if (st.type === 'employees' && o.joinDate && !ERP.validDate(o.joinDate.replace(/\//g, '-').replace(/-(\d)(?=-|$)/g, '-0$1'))) errs.push('入职日期格式');
          if (o.code && seen.has(o.code)) errs.push('文件内编号重复');
          if (o.code) seen.add(o.code);
          o._exists = st.type === 'customers' ? D.customer(o.code) : st.type === 'items' ? D.items.find((x) => x.code === o.code) : D.employees.find((x) => x.code === o.code);
          o._status = errs.length ? '错误' : o._exists ? (st.dup === 'skip' ? '跳过' : '覆盖') : '新增';
          o._note = errs.length ? errs.join('、') : o._exists ? (st.dup === 'skip' ? '编号已存在，跳过' : '编号已存在，覆盖更新') : '';
          return o;
        });
      };
      const doImport = () => {
        const res = { add: 0, upd: 0, skip: 0, err: 0 };
        const now = new Date();
        converted().forEach((o) => {
          if (o._status === '错误') return res.err++;
          if (o._status === '跳过') return res.skip++;
          if (st.type === 'customers') {
            const grp = D.groups.find((g) => g.name === o.groupName || g.code === o.groupName) || D.groups[0];
            const v = { code: o.code, name: o.name, group: grp.code, groupName: grp.name, type: o.type || '机构', contact: o.contact, phone: o.phone, address: o.address, remark: o.remark };
            if (o._exists) { Object.assign(o._exists, v); res.upd++; } else {
              D.customers.push(Object.assign({ tel: '', city: '', owner: D.currentUser.name, value: '未评估', debt: 0, writeOffPending: 0, prestoreBalance: 0, created: now, lastAudit: null,
                invoiceTitle: o.name, taxNo: '', bank: '', creditLimit: 0, settleType: '现结' }, v)); res.add++;
            }
          } else if (st.type === 'items') {
            // 找不到的主项自动新建
            let cat = D.itemCategories.find((c) => c.name === o.catName || c.code === o.catName);
            if (!cat) { cat = { code: String(Math.max(0, ...D.itemCategories.map((c) => +c.code)) + 1), name: o.catName }; D.itemCategories.push(cat); }
            const v = { code: o.code, cat: cat.code, name: o.name, unit: o.unit || '个', tier: o.tier || '-', price: +o.price || 0 };
            if (o._exists) { Object.assign(o._exists, v); res.upd++; } else { D.items.push(Object.assign({ renamable: false }, v)); res.add++; }
          } else {
            const jd = o.joinDate ? new Date(o.joinDate.replace(/-/g, '/')) : now;
            const v = { code: o.code, name: o.name, role: D.roles.includes(o.role) ? o.role : D.roles[0], dept: D.depts.includes(o.dept) ? o.dept : D.depts[1], mobile: o.mobile, gender: o.gender === '女' ? '女' : '男', joinDate: jd, years: yearsSince(jd) };
            if (o._exists) { Object.assign(o._exists, v); res.upd++; } else {
              D.employees.push(Object.assign({ online: false, mobileLogin: false, locked: false, left: false, regular: false, ssn: '', birthday: null, regularDate: null, age: null, remark: '' }, v)); res.add++;
            }
          }
        });
        st.result = res;
      };
      function downloadTemplate() {
        const d = def();
        const csv = '\uFEFF' + d.fields.map((f) => f[1]).join(',') + '\r\n';
        h('a', { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: `${d.label}导入模板.csv` }).click();
        toast(`已下载「${d.label}」导入模板（CSV）。`);
      }
      function readFile(f) {
        if (!f) return;
        if (/\.xlsx?$/i.test(f.name)) return fail(`暂不能直接读取 Excel 文件「${f.name}」。请在 Excel 中“另存为 CSV（逗号分隔）”后重新选择，或先用示例数据试导。`);
        const rd = new FileReader();
        rd.onerror = () => fail(`读取文件「${f.name}」失败。请确认文件没有被其他程序占用后重试。`);
        rd.onload = () => {
          let text = new TextDecoder('utf-8').decode(rd.result);
          if (text.includes('\uFFFD')) { try { text = new TextDecoder('gbk').decode(rd.result); } catch (e) { /* 保持 UTF-8 */ } }
          loadTable(parseCsv(text.replace(/^\uFEFF/, '')), f.name);
        };
        rd.readAsArrayBuffer(f);
      }
      async function goNext() {
        errSlot.replaceChildren();
        if (st.step === 1 && !st.rows.length) return fail('还没有读取到数据。请选择 CSV 文件，或点“使用示例数据”。');
        if (st.step === 2) {
          const miss = def().fields.filter(([k, , req]) => req && !(st.map[k] >= 0));
          if (miss.length) {
            fail(`请为必填字段指定对应的文件列：${miss.map((f) => f[1]).join('、')}。`);
            const s = pane.querySelector(`select[data-field="${miss[0][0]}"]`); s && s.focus();
            return;
          }
        }
        if (st.step === 3) {
          const list = converted();
          const n = (s) => list.filter((o) => o._status === s).length;
          if (!n('新增') && !n('覆盖')) return fail('没有可导入的记录：全部为错误或跳过。可以返回上一步调整字段对应，或选择“覆盖更新”。');
          if (!(await confirm(`导入「${def().label}」：新增 ${n('新增')} 条、覆盖 ${n('覆盖')} 条？`, { okLabel: '开始导入', detail: `跳过 ${n('跳过')} 条，错误 ${n('错误')} 条不导入。导入后不能自动撤销。` }))) return;
          await ERP.ui.busy(next, ERP.api.write(doImport, 600));
          toast(`「${def().label}」导入完成：新增 ${st.result.add} 条，更新 ${st.result.upd} 条。`);
        }
        if (st.step === 4) reset(); else st.step++;
        draw(true);
      }

      function draw(focus) {
        stepsEl.replaceChildren(...STEPS.map((s, i) => h('li', { 'aria-current': i === st.step ? 'step' : null }, s, i < st.step ? h('span.apb-erp-sr', '（已完成）') : null)));
        const d = def();
        const head = h('h3', { tabindex: '-1', style: { margin: 0 } }, `第 ${st.step + 1} 步：${STEPS[st.step]}`);
        pane.replaceChildren(head);
        if (st.step === 0) {
          pane.append(
            h('fieldset.lerp-fieldset', h('legend', '要导入的数据'),
              h('div.apb-erp-stack', { role: 'radiogroup' }, Object.entries(IMPORT).map(([k, x]) => h('label', { style: { display: 'flex', gap: '8px', alignItems: 'flex-start', cursor: 'pointer' } },
                h('input', { type: 'radio', name: 'imp-type', value: k, checked: k === st.type, class: 'lerp-radio', onchange: () => { st.type = k; st.header = []; st.rows = []; st.fileName = ''; st.map = {}; } }),
                h('span', h('strong', x.label), h('span.apb-erp-muted', { style: { display: 'block' } }, x.desc)))))),
            notice('info', '支持 CSV 文件（UTF-8 或 GBK 编码，逗号或制表符分隔），首行须为列标题。Excel 文件请先另存为 CSV。建议先下载导入模板，按模板整理数据。'),
            h('div.apb-erp-row', btn('下载导入模板', () => downloadTemplate())));
        } else if (st.step === 1) {
          const file = h('input.apb-erp-input', { type: 'file', accept: '.csv,.txt,.xlsx,.xls', onchange: (e) => readFile(e.target.files[0]) });
          pane.append(h('div.apb-erp-row', { style: { alignItems: 'flex-end' } }, field({ label: `选择「${d.label}」文件`, control: file, help: 'CSV 或 TXT；首行为列标题。' }), btn('使用示例数据', () => loadTable(d.sample, '示例数据.csv'))));
          if (st.rows.length) {
            pane.append(kv([['已读取', st.fileName], ['数据', `${st.rows.length} 行 · ${st.header.length} 列`]]));
            const box = h('div');
            ERP.ui.table(box, { caption: '文件内容（前 20 行）', compact: true, columns: st.header.map((t, i) => ({ key: 'c' + i, title: t || `第 ${i + 1} 列` })),
              rows: st.rows.slice(0, 20).map((r) => Object.fromEntries(st.header.map((_, i) => ['c' + i, r[i] ?? '']))) });
            pane.append(h('p.apb-erp-muted', '文件内容（前 20 行）'), box);
          } else pane.append(h('p.apb-erp-muted', '尚未选择文件。'));
        } else if (st.step === 2) {
          const opts = [[-1, '（不导入）'], ...st.header.map((t, i) => [i, `第 ${i + 1} 列：${t}`])];
          pane.append(
            h('div.apb-erp-row', h('span', '编号已存在的记录：'), ERP.ui.radios('imp-dup', [['skip', '跳过'], ['update', '覆盖更新']], st.dup, (v) => (st.dup = v)),
              btn('重新自动匹配', () => { autoMap(); draw(); toast('已按列标题重新匹配。'); })));
          const box = h('div');
          ERP.ui.table(box, {
            caption: '字段对应', rows: d.fields.map(([k, lbl, req]) => ({ k, lbl, req })),
            columns: [
              { key: 'lbl', title: '目标字段', render: (r) => h('span', r.lbl, r.req ? '（必填）' : '') },
              { key: 'src', title: '对应文件列', render: (r) => select(opts, { value: st.map[r.k], 'aria-label': `${r.lbl} 对应的文件列`, 'data-field': r.k, class: 'lerp-cell', onchange: (e) => { st.map[r.k] = +e.target.value; draw(); pane.querySelector(`select[data-field="${r.k}"]`).focus(); } }) },
              { key: 'state', title: '状态', render: (r) => (st.map[r.k] >= 0 ? badge('已对应', 'success') : r.req ? badge('未对应', 'danger') : badge('不导入')) },
              { key: 'ex', title: '示例值（第 1 行数据）', render: (r) => (st.map[r.k] >= 0 ? String((st.rows[0] || [])[st.map[r.k]] ?? '') || '（空）' : '—') },
            ],
          });
          pane.append(box);
        } else if (st.step === 3) {
          const list = converted();
          const n = (s) => list.filter((o) => o._status === s).length;
          pane.append(h('div.apb-erp-row', ['新增', '覆盖', '跳过', '错误'].map((s) => badge(`${s} ${n(s)} 条`, STATUS_TONE[s]))),
            n('错误') ? notice('warning', `${n('错误')} 行有错误，不会导入。可以返回上一步调整字段对应，或修改文件后重新选择。`) : null);
          const box = h('div');
          ERP.ui.table(box, {
            caption: '预览校验', compact: true, rows: list,
            columns: [{ key: '_line', title: '文件行', type: 'num' }, { key: '_status', title: '校验结果', render: (o) => h('span', badge(o._status, STATUS_TONE[o._status]), o._note ? h('span.apb-erp-muted', o._note) : null) },
              ...d.fields.map(([k, l]) => ({ key: k, title: l, type: k === 'code' ? 'mono' : undefined, render: (o) => o[k] || '—' }))],
          });
          pane.append(box);
        } else {
          const r = st.result || { add: 0, upd: 0, skip: 0, err: 0 };
          pane.append(notice('success', `「${d.label}」导入完成（${F.stamp(new Date())}）。来源文件：${st.fileName}。`),
            kv([['新增', `${r.add} 条`], ['覆盖更新', `${r.upd} 条`], ['跳过', `${r.skip} 条`], ['错误未导入', `${r.err} 条`]]),
            h('div.apb-erp-row', link(`查看${d.label}`, d.page, null, { button: true })));
        }
        prev.disabled = st.step === 0 || st.step === 4;
        prev.hidden = st.step === 4;
        next.lastChild.textContent = st.step === 3 ? '开始导入' : st.step === 4 ? '继续导入' : '下一步';
        if (focus) head.focus();
      }
      draw();
    },
  });
})();
