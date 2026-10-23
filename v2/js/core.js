/* LiteERP v2 — 内容模块框架（无依赖）
 * 遵循 design_handoff_apb_liteerp：ERP 只绘制 [data-apb-erp] 内容区；外壳（顶栏、主导航、账号）由 APB 提供。
 *
 * 页面注册：
 *   ERP.page('frontdesk', { module: 'front', title: '前台业务中心', desc: '…', nav: true, render(main, params, ctx) {} })
 *     module  所属模块（见 ERP.modules）；nav=false 的页面不出现在二级导航（详情页、表单页）
 *     parent  返回目标页面 id（详情/表单页用于面包屑与“返回列表”）
 *     render  在内容区渲染；ctx.setActions([...按钮]) 设置页头操作；ctx.guard(fn) 注册离开保护
 *   路由：#/<页面id>?参数=值 ；ERP.go(id, params) 导航；ERP.href(id, params) 生成链接
 *
 * 组件见 ERP.ui.*（list / table / form / dialog / confirm / notice / badge / kv / empty / tabs / presetRange / chart / toast）
 */
(function () {
  'use strict';
  const ERP = (window.ERP = window.ERP || {});
  const pages = (ERP.pages = {});
  ERP.modules = [
    { id: 'front', title: '前台', home: 'frontdesk' },
    { id: 'prod', title: '生产', home: 'prodCenter' },
    { id: 'fin', title: '财务', home: 'finCenter' },
    { id: 'cust', title: '客户', home: 'custManage' },
    { id: 'rpt', title: '报表', home: 'reportCenter' },
    { id: 'sys', title: '系统', home: 'employees' },
  ];
  const APP_TITLE = 'LiteERP · AutoPrintBot';

  /* ---------- DOM 工具 ---------- */
  function h(tag, attrs, ...children) {
    const m = /^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i.exec(tag) || [];
    const el = document.createElement(m[1] || 'div');
    (m[2] || '').replace(/([.#])([\w-]+)/g, (_, t, v) => (t === '.' ? el.classList.add(v) : (el.id = v)));
    if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { children.unshift(attrs); attrs = null; }
    for (const k in attrs || {}) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'style' && typeof v === 'object') for (const p in v) { if (v[p] != null) p.startsWith('--') ? el.style.setProperty(p, v[p]) : (el.style[p] = v[p]); }
      else if (k === 'class') el.className += (el.className ? ' ' : '') + v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('aria-') || k.startsWith('data-') || k === 'role' || k === 'for' || k === 'scope' || k === 'list') el.setAttribute(k, v === true ? 'true' : v);
      else if (k in el) el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    append(el, children);
    return el;
  }
  function append(el, children) {
    for (const c of [children].flat(Infinity)) {
      if (c == null || c === false) continue;
      el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  }
  let uidSeq = 0;
  const uid = (p = 'lerp') => `${p}-${++uidSeq}`;

  /* ---------- 格式：金额千分位两位小数；日期 YYYY-MM-DD；时刻注明北京时间 ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  const nf = new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  ERP.fmt = {
    money: (v) => (v == null || v === '' || isNaN(v) ? '未知' : nf.format(Number(v))),
    num: (v, d = 0) => (v == null || v === '' ? '未知' : Number(v).toLocaleString('zh-CN', { minimumFractionDigits: d, maximumFractionDigits: d })),
    date: (d) => { if (!d) return ''; d = new Date(d); return isNaN(d) ? '' : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; },
    time: (d) => { if (!d) return ''; d = new Date(d); return isNaN(d) ? '' : `${ERP.fmt.date(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; },
    stamp: (d) => { if (!d) return '未知'; d = new Date(d); return `${ERP.fmt.date(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}（北京时间）`; },
    pct: (v) => (v == null || !isFinite(v) ? '未知' : (v * 100).toFixed(1) + '%'),
  };
  ERP.validDate = (s) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const d = new Date(s + 'T00:00:00Z');
    return isFinite(d) && d.toISOString().slice(0, 10) === s;
  };
  ERP.parseDate = (s, end) => (ERP.validDate(s) ? new Date(s + (end ? 'T23:59:59' : 'T00:00:00')) : null);

  /* 模拟接口：统一的异步读取，便于演示“读取中 / 失败 / 重试”。URL 带 ?demo=fail 时读取失败。 */
  ERP.api = {
    read(fn, delay = 160) {
      return new Promise((resolve, reject) => setTimeout(() => {
        if (new URLSearchParams(location.search).get('demo') === 'fail') reject(Object.assign(new Error('读取失败'), { code: 'DEMO-READ-001' }));
        else { try { resolve(fn()); } catch (e) { reject(e); } }
      }, delay));
    },
    write(fn, delay = 400) { return new Promise((resolve, reject) => setTimeout(() => { try { resolve(fn()); } catch (e) { reject(e); } }, delay)); },
  };

  /* ---------- 路由 ---------- */
  ERP.page = (id, def) => { pages[id] = Object.assign({ id, nav: true }, def); };
  ERP.href = (id, params) => {
    const qs = new URLSearchParams(Object.entries(params || {}).filter(([, v]) => v != null && v !== '')).toString();
    return `#/${id}${qs ? '?' + qs : ''}`;
  };
  ERP.go = (id, params) => { location.hash = ERP.href(id, params); };
  // 更新当前地址参数（筛选、页码），不产生历史记录
  ERP.setParams = (params) => {
    const { id } = parse();
    history.replaceState(null, '', location.pathname + location.search + ERP.href(id, params));
    lastHash = location.hash;
  };
  const safeDecode = (x) => { try { return decodeURIComponent(x); } catch (e) { return x; } };
  // 参数只由 URLSearchParams 解码一次，避免 & + ? = 被二次解码破坏
  function parse() {
    const raw = location.hash.replace(/^#\/?/, '');
    const q = raw.indexOf('?');
    const id = safeDecode(q < 0 ? raw : raw.slice(0, q)), qs = q < 0 ? '' : raw.slice(q + 1);
    return { id: id || 'frontdesk', params: Object.fromEntries(new URLSearchParams(qs || '')) };
  }
  let current = null, guardFn = null, guardDirty = null, lastHash = location.hash;

  function route() {
    const { id, params } = parse();
    const def = pages[id];
    const root = ERP.root;
    const main = root.querySelector('#lerp-main');
    // 离开保护：有未保存修改时询问
    if (guardFn && current && location.hash !== lastHash) {
      const fn = guardFn;
      const target = location.hash;
      history.pushState(null, '', lastHash);  // 留在当前页；不覆盖目标历史记录
      fn().then((ok) => { if (ok) { guardFn = null; location.hash = target; } });
      return;
    }
    guardFn = null; guardDirty = null;
    lastHash = location.hash;
    if (!def) return renderMissing(main, id);
    const mod = ERP.modules.find((m) => m.id === def.module) || ERP.modules[0];
    current = def;
    // 页头
    const crumbs = h('p.apb-erp-muted', '业务 / LiteERP / ', mod.title, def.parent && pages[def.parent] ? [' / ', h('a', { href: ERP.href(def.parent) }, pages[def.parent].title)] : null);
    const title = h('h1#lerp-title', { tabindex: '-1' }, params.title || def.title);
    const actions = h('div.lerp-headactions');
    const head = h('div.apb-erp-pagehead', h('div', crumbs, title, def.desc ? h('p.apb-erp-muted', def.desc) : null), actions);
    // 一级（模块）与二级（页面）导航
    const nav = h('nav.apb-erp-nav', { 'aria-label': 'LiteERP 模块' },
      ERP.modules.map((m) => h('a', { href: ERP.href(m.home), 'aria-current': m.id === mod.id ? 'page' : null }, m.title)));
    const navPage = def.nav ? id : def.parent || id;
    const sub = h('nav.lerp-subnav', { 'aria-label': `${mod.title}功能` },
      Object.values(pages).filter((p) => p.module === mod.id && p.nav).map((p) => h('a', { href: ERP.href(p.id), 'aria-current': p.id === navPage ? 'page' : null }, p.navTitle || p.title)));
    const body = h('div.apb-erp-stack#lerp-body');
    main.replaceChildren(head, nav, sub, body);
    document.title = `${params.title || def.title} — ${APP_TITLE}`;
    const ctx = {
      id, params,
      setActions: (btns) => actions.replaceChildren(...[btns].flat().filter(Boolean)),
      setTitle: (t) => { title.textContent = t; document.title = `${t} — ${APP_TITLE}`; },
      guard: (fn, isDirty) => { guardFn = fn; guardDirty = isDirty || null; },
    };
    try { def.render(body, params, ctx); }
    catch (err) {
      console.error(err);
      body.replaceChildren(ERP.ui.notice('danger', `页面渲染失败：${err.message}。请刷新重试；如持续出现，请把错误编号 LERP-UI-${Date.now().toString(36)} 告知管理员。`));
    }
    if (!document.querySelector('dialog[open]')) title.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
  function renderMissing(main, id) {
    main.replaceChildren(h('div.apb-erp-pagehead', h('div', h('p.apb-erp-muted', '业务 / LiteERP'), h('h1#lerp-title', { tabindex: '-1' }, '页面不存在'))),
      h('section.apb-erp-panel', ERP.ui.empty({ title: `找不到页面「${id}」`, text: '链接可能已失效。可以返回前台业务中心。', action: h('a.apb-erp-btn', { href: ERP.href('frontdesk') }, '返回前台业务中心') })));
  }
  ERP.reload = () => route();
  // 当前地址参数（筛选、页码等），供页面切换视图时保留条件
  ERP.params = () => parse().params;
  // 会计期间（期末结账后调用）；宿主外壳如需显示，可监听 erp:period 事件
  ERP.setPeriod = (p) => { ERP.data.company.period = p; window.dispatchEvent(new CustomEvent('erp:period', { detail: p })); };
  ERP.start = function (root) {
    ERP.root = root;
    root.append(h('div#lerp-main'), h('div', { 'data-apb-erp-overlays': '' }), h('div.lerp-toast', { role: 'status', 'aria-live': 'polite', id: 'lerp-toast' }));
    window.addEventListener('hashchange', route);
    // 关闭/刷新页面：只在确有未保存修改时提示（未提供 isDirty 的离开保护按“有修改”处理）
    window.addEventListener('beforeunload', (e) => { if (guardFn && (!guardDirty || guardDirty())) { e.preventDefault(); e.returnValue = ''; } });
    route();
  };

  /* ---------- 基础组件 ---------- */
  const ui = (ERP.ui = { h, append, uid });

  ui.btn = (label, onClick, opts = {}) => h('button.apb-erp-btn', {
    type: opts.type || 'button', 'data-variant': opts.variant, disabled: opts.disabled, 'aria-describedby': opts.describedby,
    'aria-label': opts.ariaLabel, title: opts.title, onclick: onClick,
  }, opts.busySlot ? h('span.apb-erp-busy-slot', { 'aria-hidden': 'true' }) : null, h('span', label));
  ui.link = (label, id, params, opts = {}) => h('a' + (opts.button ? '.apb-erp-btn' : ''), { href: ERP.href(id, params), 'data-variant': opts.variant, 'aria-label': opts.ariaLabel }, label);
  ui.linkBtn = (label, onClick, opts = {}) => h('button.lerp-linkbtn', { type: 'button', onclick: onClick, 'data-variant': opts.variant, 'aria-label': opts.ariaLabel }, label);
  // 忙碌：保留按钮尺寸，防重复
  ui.busy = async (btn, promise) => {
    btn.disabled = true; btn.setAttribute('aria-busy', 'true');
    if (!btn.querySelector('.apb-erp-busy-slot')) btn.prepend(h('span.apb-erp-busy-slot', { 'aria-hidden': 'true' }));
    try { return await promise; } finally { btn.disabled = false; btn.removeAttribute('aria-busy'); }
  };
  ui.badge = (text, tone) => h('span.apb-erp-badge', { 'data-tone': tone }, text);
  ui.notice = (tone, ...content) => h('div.apb-erp-notice', { 'data-tone': tone, role: tone === 'danger' ? 'alert' : null }, ...content);
  ui.kv = (pairs, cls = '') => h('dl.apb-erp-kv' + cls, pairs.filter(Boolean).map(([k, v]) => h('div', h('dt', k), h('dd', v == null || v === '' ? '未提供' : v))));
  ui.empty = ({ title, text, action }) => h('div.apb-erp-empty', h('h3', title), text ? h('p.apb-erp-muted', text) : null, action);
  ui.loading = (text = '正在读取…') => h('div.lerp-loading', { 'aria-busy': 'true' }, h('span', text));
  ui.panel = ({ title, note, actions, flush } = {}) => {
    const body = h('div' + (flush ? '' : '.apb-erp-panelbody'));
    const id = uid('panel');
    const el = h('section.apb-erp-panel', { 'aria-labelledby': title ? id : null },
      title ? h('div.apb-erp-panelhead' + (actions ? '.lerp-split' : ''), h('div', h('h2', { id }, title), note ? h('p.apb-erp-muted', note) : null), actions ? h('div.lerp-headactions', actions) : null) : null, body);
    return { el, body };
  };
  ui.summary = (pairs) => h('dl.lerp-summary', pairs.map(([k, v]) => h('div', h('dt', k), h('dd', v))));
  ui.toast = (msg) => {
    const box = document.getElementById('lerp-toast');
    box.replaceChildren(ui.notice('success', msg));
    clearTimeout(ui._tt);
    const arm = () => { ui._tt = setTimeout(() => box.replaceChildren(), 5000); };
    box.onmouseenter = () => clearTimeout(ui._tt); box.onmouseleave = arm; arm();
  };

  /* 字段：label / 帮助 / 错误 关联 */
  ui.field = function ({ label, control, help, required, name, span, error }) {
    const id = control.id || (control.id = uid('f'));
    const helpId = help ? id + '-help' : null, errId = id + '-err';
    const err = h('span.apb-erp-error', { id: errId, hidden: true }, error || `请填写${label.replace(/（.*?）/g, '')}。`);
    control.setAttribute('aria-describedby', [helpId, errId].filter(Boolean).join(' '));
    if (name) control.name = name;
    if (required) control.dataset.required = 'true';
    const el = h('div.apb-erp-field' + (span === 2 ? '.lerp-span2' : span === 'all' ? '.lerp-spanall' : ''),
      h('label', { for: id }, label + (required ? '（必填）' : '')), control, help ? h('span.apb-erp-muted', { id: helpId }, help) : null, err);
    el._err = err; el._control = control;
    return el;
  };
  ui.input = (attrs = {}) => h('input.apb-erp-input', Object.assign({ autocomplete: 'off' }, attrs));
  ui.money = (attrs = {}) => h('input.apb-erp-input.lerp-amount', Object.assign({ inputmode: 'decimal', autocomplete: 'off' }, attrs));
  ui.dateInput = (attrs = {}) => h('input.apb-erp-input.apb-erp-mono', Object.assign({ inputmode: 'numeric', placeholder: 'YYYY-MM-DD', maxlength: 10, autocomplete: 'off' }, attrs));
  ui.textarea = (attrs = {}) => h('textarea.apb-erp-input', attrs);
  ui.select = (options, attrs = {}) => {
    const s = h('select.apb-erp-input', attrs);
    for (const o of options) {
      const [v, t] = Array.isArray(o) ? o : typeof o === 'object' ? [o.value, o.label] : [o, o];
      s.appendChild(h('option', { value: v }, t));
    }
    if (attrs.value != null) s.value = attrs.value;
    return s;
  };
  ui.checkbox = (label, checked, attrs = {}) => h('label', h('input.apb-erp-checkbox', Object.assign({ type: 'checkbox', checked }, attrs)), label);
  ui.radios = (name, options, value, onchange) => h('div.lerp-checks', { role: 'radiogroup' },
    options.map((o) => { const [v, t] = Array.isArray(o) ? o : [o, o]; return h('label', h('input', { type: 'radio', name, value: v, checked: v === value, onchange: () => onchange && onchange(v) }), t); }));

  /* ---------- 表单：novalidate、提交时全表校验、首错聚焦、保留输入、忙碌防重、离开保护 ----------
   * opts: { sections:[{title, fields:[ui.field(...)], cols:2|3}], submitLabel, onSubmit(values, form)->Promise, cancel:{label, href}, wide, ctx, extra }
   * 字段的自定义校验：control.dataset.validate = 'date' | 'money' | 'phone'，或 control._validate = (v)=>错误文本|null */
  ui.form = function (opts) {
    const errBox = ui.notice('danger', '尚未保存，请检查下面标出的字段；已填内容保留。');
    errBox.hidden = true;
    const submit = ui.btn(opts.submitLabel || '保存资料', null, { type: 'submit', variant: 'primary', busySlot: true });
    const status = h('p', { role: 'status', 'aria-live': 'polite' });
    const form = h('form.apb-erp-form' + (opts.wide ? '.lerp-wide' : ''), { novalidate: true }, errBox,
      opts.sections.map((s) => h('div.lerp-section', s.title ? h('h2', s.title) : null, s.note ? h('p.apb-erp-muted', s.note) : null,
        s.fields ? h('div.apb-erp-formgrid' + (s.cols === 3 ? '.lerp-c3' : ''), s.fields) : null, s.content)),
      opts.extra,
      h('div.apb-erp-formactions', submit, opts.cancel ? h('a.apb-erp-btn', { href: opts.cancel.href }, opts.cancel.label || '返回列表') : null, opts.moreActions), status);
    let dirty = false, saving = false;
    form.addEventListener('input', () => { dirty = true; status.textContent = ''; });
    form.addEventListener('change', () => { dirty = true; });
    if (opts.ctx) opts.ctx.guard(() => (dirty ? ui.discardDialog() : Promise.resolve(true)), () => dirty);
    const validate = () => {
      const bad = [];
      form.querySelectorAll('.apb-erp-field').forEach((f) => {
        const c = f._control; if (!c || !f._err) return;
        const v = (c.value || '').trim();
        let msg = null;
        if (c.dataset.required && !v) msg = f._err.dataset.base || f._err.textContent;
        else if (v && c.dataset.validate === 'date' && !ERP.validDate(v)) msg = '请填写有效日期，例如 2026-10-21。';
        else if (v && c.dataset.validate === 'money' && !/^-?\d+(\.\d{1,2})?$/.test(v.replace(/,/g, ''))) msg = '请填写金额，最多两位小数，例如 1280.00。';
        else if (v && c.dataset.validate === 'phone' && !/^[\d\- +]{5,20}$/.test(v)) msg = '请填写有效电话号码。';
        else if (c._validate) msg = c._validate(v);
        if (!f._err.dataset.base) f._err.dataset.base = f._err.textContent;
        f._err.hidden = !msg; if (msg) f._err.textContent = msg;
        c.setAttribute('aria-invalid', String(!!msg));
        if (msg) bad.push(c);
      });
      return bad;
    };
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (saving) return;
      const bad = validate();
      errBox.textContent = '尚未保存，请检查下面标出的字段；已填内容保留。';
      errBox.hidden = !bad.length;
      if (bad.length) { bad[0].focus(); return; }
      saving = true;
      const values = Object.fromEntries(new FormData(form).entries());
      try {
        const msg = await ui.busy(submit, opts.onSubmit(values, form));
        // onSubmit 返回 false 表示未保存（如用户取消确认），保持“有未保存修改”
        if (msg !== false) { dirty = false; if (msg) status.textContent = msg; }
      } catch (err) {
        errBox.hidden = false;
        errBox.textContent = `保存失败：${err.message || err}。已填内容保留，可以修改后重试。`;
        errBox.focus && errBox.focus();
      } finally { saving = false; }
    });
    form.markClean = () => { dirty = false; };
    return form;
  };

  /* ---------- 对话框：原生 <dialog>.showModal()，Escape 关闭，焦点圈定并归还 ----------
   * opts: { title, kicker, body: Node|fn(bodyEl, close), actions:[{label, variant, onClick(close, btn)->Promise|false}], wide, onClose } */
  ui.dialog = function (opts) {
    const trigger = document.activeElement;
    const titleId = uid('dlg');
    const body = h('div.apb-erp-stack');
    const closeBtn = ui.btn('关闭', () => close());
    const dlg = h('dialog.apb-erp-dialog' + (opts.wide ? '.lerp-wide' : ''), { 'aria-labelledby': titleId },
      h('div.apb-erp-dialoghead', h('div', opts.kicker ? h('p.apb-erp-muted', opts.kicker) : null, h('h2', { id: titleId }, opts.title)), closeBtn), body);
    const overlays = ERP.root.querySelector('[data-apb-erp-overlays]');
    overlays.appendChild(dlg);
    let closed = false;
    function close(result) {
      if (closed) return; closed = true;
      dlg.close(); dlg.remove();
      opts.onClose && opts.onClose(result);
      if (trigger && trigger.isConnected) trigger.focus();
    }
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
    dlg.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const stops = [...dlg.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex="0"]')].filter((n) => n.getClientRects().length);
      const first = stops[0], last = stops[stops.length - 1];
      if (!first) return;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    if (typeof opts.body === 'function') opts.body(body, close); else append(body, [opts.body]);
    if (opts.actions && opts.actions.length) {
      body.appendChild(h('div.apb-erp-formactions', opts.actions.map((a) => {
        const b = ui.btn(a.label, async () => {
          if (!a.onClick) return close();
          const r = a.onClick(close, b);
          if (r && r.then) await ui.busy(b, r);
        }, { variant: a.variant, busySlot: !!a.variant });
        if (a.autofocus) b.autofocus = true;
        return b;
      })));
    }
    dlg.showModal();
    return { el: dlg, body, close };
  };
  ui.confirm = (message, { title = '请确认', okLabel = '确定', danger = false, detail } = {}) => new Promise((resolve) => {
    let ok = false;
    ui.dialog({ title, body: [h('p', message), detail ? h('p.apb-erp-muted', detail) : null],
      actions: [{ label: '取消', autofocus: true }, { label: okLabel, variant: danger ? 'danger' : 'primary', onClick: (close) => { ok = true; close(); } }],
      onClose: () => resolve(ok) });
  });
  ui.discardDialog = () => new Promise((resolve) => {
    let ok = false;
    ui.dialog({ title: '放弃未保存的修改？', body: h('p', '离开后，这次填写的内容将被清除。'),
      actions: [{ label: '继续编辑', variant: 'primary', autofocus: true }, { label: '放弃修改', onClick: (close) => { ok = true; close(); } }],
      onClose: () => resolve(ok) });
  });

  /* ---------- 页签（面板内） ---------- */
  ui.tabs = function (container, tabs, { active = 0, onChange } = {}) {
    const bar = h('div.lerp-tabs', { role: 'tablist' });
    const panes = tabs.map((t) => h('div', { role: 'tabpanel', hidden: true }));
    const btns = tabs.map((t, i) => h('button', { type: 'button', role: 'tab', id: uid('tab'), onclick: () => sel(i),
      onkeydown: (e) => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const n = (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length; sel(n); btns[n].focus(); } } }, t.title));
    btns.forEach((b, i) => { panes[i].setAttribute('aria-labelledby', b.id); bar.appendChild(b); });
    const done = new Set();
    function sel(i) {
      btns.forEach((b, j) => { b.setAttribute('aria-selected', String(i === j)); b.tabIndex = i === j ? 0 : -1; });
      panes.forEach((p, j) => (p.hidden = i !== j));
      if (!done.has(i)) { done.add(i); tabs[i].render && tabs[i].render(panes[i]); }
      onChange && onChange(i);
    }
    append(container, [bar, panes]);
    sel(active);
    return { select: sel, panes };
  };

  /* ---------- 日期范围：预设 + 两个 YYYY-MM-DD 文本框 ---------- */
  ui.datePresets = [['today', '今天'], ['yesterday', '昨天'], ['month', '本月'], ['lastMonth', '上月'], ['last30', '近 30 天'], ['year', '今年'], ['all', '全部'], ['custom', '自定义']];
  ui.presetRange = function (p) {
    const n = new Date(), y = n.getFullYear(), m = n.getMonth(), d = n.getDate();
    const D = (a, b, c) => ERP.fmt.date(new Date(a, b, c));
    switch (p) {
      case 'today': return [D(y, m, d), D(y, m, d)];
      case 'yesterday': return [D(y, m, d - 1), D(y, m, d - 1)];
      case 'month': return [D(y, m, 1), D(y, m + 1, 0)];
      case 'lastMonth': return [D(y, m - 1, 1), D(y, m, 0)];
      case 'last30': return [D(y, m, d - 30), D(y, m, d)];
      case 'year': return [D(y, 0, 1), D(y, 11, 31)];
      default: return ['', ''];
    }
  };

  /* ---------- 列表（核心组件） ----------
   * opts:
   *   title, note, actions(面板头按钮)
   *   columns: [{key, title, type:'text'|'money'|'num'|'date'|'time'|'mono', sum, render(row)->Node|string, sub(row)->副行文字, width, nowrap}]
   *   groups:  [{title, span}] 可选分组表头（按列顺序）
   *   load(): 返回行数组或 Promise（默认经 ERP.api.read 模拟异步）
   *   filters: [{key, label, type:'search'|'select'|'daterange', options, placeholder, match(row, value), field(日期字段名)}]
   *   rowActions(row)->[Node]   行内操作（链接或 linkBtn）
   *   selectable + batch: [{label, variant, onClick(rows)}]  仅当前页选择
   *   pageSize(默认 20)，urlState(默认 true：筛选与页码写入地址)
   *   emptyTitle / emptyText / emptyAction  首次为空；无匹配有单独文案
   *   sumScope: 'filtered'（默认，合计全部筛选结果）
   * 返回 { reload(), rows, el } */
  ui.list = function (container, opts) {
    const P = opts.params || {};
    const urlState = opts.urlState !== false;
    const fvals = {};
    const panel = ui.panel({ title: opts.title, note: opts.note, actions: opts.actions, flush: true });
    container.appendChild(panel.el);
    const toolbar = h('form.apb-erp-toolbar', { novalidate: true, onsubmit: (e) => { e.preventDefault(); apply(); } });
    let composing = false, timer = null;
    for (const f of opts.filters || []) {
      if (f.type === 'search') {
        const inp = ui.input({ type: 'search', placeholder: f.placeholder || '关键词', value: P[f.key] || '' });
        const clear = h('button.apb-erp-btn.apb-erp-clear', { type: 'button', 'aria-label': '清除搜索', hidden: !inp.value,
          onclick: () => { clearTimeout(timer); composing = false; inp.value = ''; clear.hidden = true; fvals[f.key] = ''; apply(); inp.focus(); } }, '×');
        inp.addEventListener('compositionstart', () => { composing = true; clearTimeout(timer); });
        inp.addEventListener('compositionend', () => { composing = false; clearTimeout(timer); timer = setTimeout(() => { fvals[f.key] = inp.value.trim(); apply(); }, 300); });
        inp.addEventListener('input', () => { clear.hidden = !inp.value; clearTimeout(timer); if (!composing) timer = setTimeout(() => { fvals[f.key] = inp.value.trim(); apply(); }, 300); });
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.isComposing || composing)) e.preventDefault(); });
        fvals[f.key] = inp.value.trim();
        const fld = ui.field({ label: f.label || '搜索', control: inp });
        fld.classList.add('apb-erp-searchfield');
        const wrap = h('div.apb-erp-search');
        fld.insertBefore(wrap, inp);
        wrap.append(inp, clear);
        f._reset = () => { inp.value = ''; clear.hidden = true; fvals[f.key] = ''; };
        toolbar.appendChild(fld);
      } else if (f.type === 'select') {
        const s = ui.select([['', f.allLabel || '全部'], ...f.options], { value: P[f.key] || f.value || '', onchange: () => { fvals[f.key] = s.value; apply(); } });
        fvals[f.key] = s.value;
        f._reset = () => { s.value = ''; fvals[f.key] = ''; };
        toolbar.appendChild(ui.field({ label: f.label, control: s }));
      } else if (f.type === 'daterange') {
        const preset = P[f.key + 'P'] || f.preset || 'all';
        const [a0, b0] = preset === 'custom' ? [P[f.key + 'From'] || '', P[f.key + 'To'] || ''] : ui.presetRange(preset);
        const sel = ui.select(ui.datePresets, { value: preset });
        const from = ui.dateInput({ value: a0, 'aria-label': `${f.label}开始` }), to = ui.dateInput({ value: b0, 'aria-label': `${f.label}结束` });
        const err = h('span.apb-erp-error', { hidden: true }, '请填写有效日期，例如 2026-10-21。');
        const sync = () => { fvals[f.key] = { preset: sel.value, from: from.value.trim(), to: to.value.trim() }; };
        sel.addEventListener('change', () => { const [a, b] = ui.presetRange(sel.value); if (sel.value !== 'custom') { from.value = a; to.value = b; } sync(); apply(); });
        [from, to].forEach((x) => x.addEventListener('change', () => {
          const ok = [from, to].every((y) => !y.value || ERP.validDate(y.value.trim()));
          err.hidden = ok; [from, to].forEach((y) => y.setAttribute('aria-invalid', String(!!y.value && !ERP.validDate(y.value.trim()))));
          if (ok) { sel.value = 'custom'; sync(); apply(); }
        }));
        sync();
        f._reset = () => { sel.value = f.preset || 'all'; const [a, b] = ui.presetRange(sel.value); from.value = a; to.value = b; sync(); };
        toolbar.appendChild(h('div.apb-erp-field.lerp-daterangefield', h('label', { for: sel.id = uid('f') }, f.label || '日期'),
          h('div.apb-erp-row.lerp-daterange', sel, from, h('span', '至'), to), err));
      }
    }
    if ((opts.filters || []).length) {
      toolbar.appendChild(ui.btn('筛选', null, { type: 'submit' }));
      panel.body.appendChild(toolbar);
    }
    const selStatus = h('p.apb-erp-muted', { role: 'status' });
    const batchBar = h('div.lerp-batchbar');
    const topbar = h('div.apb-erp-footer', h('div.apb-erp-row', selStatus, batchBar), h('p.apb-erp-muted', opts.hint || '宽表可左右滚动查看全部列'));
    panel.body.appendChild(topbar);
    const holder = h('div');
    panel.body.appendChild(holder);
    const resultStatus = h('p.apb-erp-muted', { role: 'status', 'aria-live': 'polite' });
    const prev = ui.btn('上一页', () => { page--; draw(); }), next = ui.btn('下一页', () => { page++; draw(); });
    const pageNo = h('span.apb-erp-muted');
    let pageSize = +P.size || opts.pageSize || 20;
    const sizeSel = ui.select([[20, '每页 20 条'], [50, '每页 50 条'], [100, '每页 100 条']], { value: pageSize, 'aria-label': '每页条数', onchange: () => { pageSize = +sizeSel.value; page = 1; draw(); } });
    sizeSel.style.width = 'auto';
    panel.body.appendChild(h('div.apb-erp-footer', resultStatus, h('nav.apb-erp-row', { 'aria-label': '分页' }, sizeSel, prev, pageNo, next)));

    let all = null, filtered = [], page = +P.page || 1, selected = new Set(), loadError = null, seq = 0;
    const api = { el: panel.el, get rows() { return filtered; }, get all() { return all || []; }, reload: load, get selected() { return [...selected]; } };

    function matches(row) {
      return (opts.filters || []).every((f) => {
        const v = fvals[f.key];
        if (f.type === 'daterange') {
          if (!v || (!v.from && !v.to)) return true;
          const t = row[f.field || 'date'];
          if (!t) return false;
          const a = ERP.parseDate(v.from), b = ERP.parseDate(v.to, true);
          return (!a || new Date(t) >= a) && (!b || new Date(t) <= b);
        }
        if (!v) return true;
        if (f.match) return f.match(row, v);
        if (f.type === 'search') { const k = v.toLocaleLowerCase('zh-CN'); return (f.keys || opts.columns.map((c) => c.key)).some((key) => String(row[key] ?? '').toLocaleLowerCase('zh-CN').includes(k)); }
        return String(row[f.key]) === v;
      });
    }
    function apply() { page = 1; draw(true); }
    function saveUrl() {
      if (!urlState) return;
      const q = Object.assign({}, opts.keepParams || {});
      for (const f of opts.filters || []) {
        const v = fvals[f.key];
        if (f.type === 'daterange') { if (v && v.preset !== (f.preset || 'all')) { q[f.key + 'P'] = v.preset; if (v.preset === 'custom') { q[f.key + 'From'] = v.from; q[f.key + 'To'] = v.to; } } }
        else if (v) q[f.key] = v;
      }
      if (page > 1) q.page = page;
      if (pageSize !== (opts.pageSize || 20)) q.size = pageSize;
      ERP.setParams(q);
    }
    function cell(c, r) {
      const v = r[c.key];
      let out;
      if (c.render) out = c.render(r);
      else if (c.type === 'money') out = ERP.fmt.money(v);
      else if (c.type === 'num') out = v == null ? '' : ERP.fmt.num(v, c.digits || 0);
      else if (c.type === 'date') out = ERP.fmt.date(v);
      else if (c.type === 'time') out = ERP.fmt.time(v);
      else out = v == null ? '' : v;
      const td = h('td' + (['money', 'num'].includes(c.type) || c.align === 'right' ? '.apb-erp-number' : ''), out);
      if (c.type === 'money' || c.type === 'mono' || c.type === 'time' || c.type === 'date') td.classList.add('apb-erp-mono');
      if (c.sub) { const s = c.sub(r); if (s) td.appendChild(h('span.apb-erp-muted', s)); }
      if (c.nowrap) td.style.whiteSpace = 'nowrap';
      return td;
    }
    function draw(changed) {
      if (!all) return;
      filtered = all.filter(matches);
      if (opts.sort) filtered.sort(opts.sort);
      const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
      page = Math.min(Math.max(1, page), pages);
      const had = selected.size > 0;
      selected = new Set();
      const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
      if (!filtered.length) {
        const first = !all.length;
        holder.replaceChildren(first
          ? ui.empty({ title: opts.emptyTitle || '尚无记录', text: opts.emptyText || '新记录会显示在这里。', action: opts.emptyAction })
          : ui.empty({ title: '没有符合条件的记录', text: '可以调整关键词，或清除当前筛选。', action: ui.btn('清除筛选', () => { (opts.filters || []).forEach((f) => f._reset && f._reset()); apply(); }) }));
      } else {
        const pageCheck = opts.selectable ? h('input.apb-erp-checkbox', { type: 'checkbox', 'aria-label': '选择当前页全部记录' }) : null;
        const thead = h('thead');
        if (opts.groups) thead.appendChild(h('tr', opts.selectable ? h('th', { scope: 'col' }) : null, opts.groups.map((g) => h('th', { scope: 'colgroup', colSpan: g.span }, g.title)), opts.rowActions ? h('th', { scope: 'col' }) : null));
        thead.appendChild(h('tr', opts.selectable ? h('th.apb-erp-check', { scope: 'col' }, pageCheck) : null,
          opts.columns.map((c) => h('th' + (['money', 'num'].includes(c.type) || c.align === 'right' ? '.apb-erp-number' : ''), { scope: 'col', style: c.width ? { minWidth: c.width + 'px' } : null }, c.title)),
          opts.rowActions ? h('th', { scope: 'col' }, '操作') : null));
        const tbody = h('tbody');
        const checks = [];
        visible.forEach((r) => {
          const tr = h('tr');
          if (opts.selectable) {
            const cb = h('input.apb-erp-checkbox', { type: 'checkbox', 'aria-label': `选择 ${r[opts.idKey || opts.columns[0].key]}`,
              onchange: () => { cb.checked ? selected.add(r) : selected.delete(r); tr.setAttribute('aria-selected', String(cb.checked)); selection(); } });
            checks.push(cb);
            tr.appendChild(h('td.apb-erp-check', cb));
          }
          opts.columns.forEach((c) => tr.appendChild(cell(c, r)));
          if (opts.rowActions) tr.appendChild(h('td.lerp-actions', opts.rowActions(r)));
          tbody.appendChild(tr);
        });
        const table = h('table.apb-erp-table', h('caption.apb-erp-sr', opts.caption || opts.title || '数据表'), thead, tbody);
        if (opts.columns.some((c) => c.sum)) {
          table.appendChild(h('tfoot', h('tr', opts.selectable ? h('td') : null, opts.columns.map((c, i) => {
            if (c.sum) {
              const total = typeof c.sum === 'function' ? c.sum(filtered) : filtered.reduce((s, r) => s + (Number(r[c.key]) || 0), 0);
              return h('td.apb-erp-number.apb-erp-mono', c.type === 'money' ? ERP.fmt.money(total) : typeof total === 'number' ? ERP.fmt.num(total, c.digits || 0) : total);
            }
            return h('td', i === 0 ? `合计（筛选结果 ${filtered.length} 条）` : '');
          }), opts.rowActions ? h('td') : null)));
        }
        if (pageCheck) pageCheck.addEventListener('change', () => {
          selected = new Set(pageCheck.checked ? visible : []);
          checks.forEach((cb, i) => { cb.checked = pageCheck.checked; cb.closest('tr').setAttribute('aria-selected', String(pageCheck.checked)); });
          selection();
        });
        api._pageCheck = pageCheck;
        api._visible = visible;
        holder.replaceChildren(h('div.apb-erp-tablewrap', { tabindex: '0', role: 'region', 'aria-label': (opts.title || '数据') + '表格，可横向滚动' }, table));
      }
      prev.disabled = page <= 1; next.disabled = page >= pages;
      pageNo.textContent = `第 ${page} / ${pages} 页`;
      resultStatus.textContent = filtered.length ? `显示 ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filtered.length)}，共 ${filtered.length} 条` : '共 0 条';
      selection(changed && had);
      saveUrl();
      opts.onDraw && opts.onDraw(filtered);
    }
    function selection(cleared) {
      if (!opts.selectable) { selStatus.textContent = cleared ? '' : ''; batchBar.replaceChildren(); return; }
      const pc = api._pageCheck, vis = api._visible || [];
      if (pc) { pc.checked = vis.length > 0 && selected.size === vis.length; pc.indeterminate = selected.size > 0 && selected.size < vis.length; }
      selStatus.textContent = (cleared ? '列表已变化，选择已清除。' : '') + (selected.size ? `已选择 ${selected.size} 条 · 仅当前页` : '未选择 · 仅选择当前页');
      batchBar.replaceChildren(...(opts.batch || []).map((b) => ui.btn(b.label, async (e) => {
        const btn = e.currentTarget;
        const r = b.onClick([...selected]);
        if (r && r.then) await ui.busy(btn, r);
      }, { variant: b.variant, disabled: !selected.size })));
    }
    async function load() {
      const my = ++seq;
      loadError = null;
      if (!all) holder.replaceChildren(ui.loading());
      try {
        const data = await (opts.load ? Promise.resolve(opts.load()).then((d) => (d && d.then ? d : ERP.api.read(() => d))) : ERP.api.read(() => opts.rows || []));
        if (my !== seq) return; // 旧请求结果作废
        all = data;
        draw();
      } catch (err) {
        if (my !== seq) return;
        loadError = err;
        holder.replaceChildren(h('div.apb-erp-empty', h('h3', '读取失败'), h('p.apb-erp-muted', `筛选条件已保留，可以稍后重试。错误编号：${err.code || 'LERP-READ'}。`), ui.btn('重试', () => load())));
        resultStatus.textContent = '';
      }
    }
    load();
    return api;
  };

  /* 简单表格（明细、报表结果）：columns 同 list；rows；sum；groups */
  ui.table = function (container, { columns, rows, groups, caption, compact, footLabel, rowActions, empty }) {
    if (!rows.length && empty !== false) { container.appendChild(ui.empty({ title: empty?.title || '没有记录', text: empty?.text })); return null; }
    const num = (c) => ['money', 'num'].includes(c.type) || c.align === 'right';
    const thead = h('thead');
    if (groups) thead.appendChild(h('tr', groups.map((g) => h('th', { scope: 'colgroup', colSpan: g.span }, g.title)), rowActions ? h('th') : null));
    thead.appendChild(h('tr', columns.map((c) => h('th' + (num(c) ? '.apb-erp-number' : ''), { scope: 'col' }, c.title)), rowActions ? h('th', { scope: 'col' }, '操作') : null));
    const tbody = h('tbody', rows.map((r) => h('tr', columns.map((c) => {
      const v = r[c.key];
      const out = c.render ? c.render(r) : c.type === 'money' ? ERP.fmt.money(v) : c.type === 'num' ? (v == null ? '' : ERP.fmt.num(v, c.digits || 0)) : c.type === 'date' ? ERP.fmt.date(v) : c.type === 'time' ? ERP.fmt.time(v) : v ?? '';
      const td = h('td' + (num(c) ? '.apb-erp-number' : ''), out);
      if (['money', 'mono', 'date', 'time'].includes(c.type)) td.classList.add('apb-erp-mono');
      if (c.nowrap || c.type === 'date' || c.type === 'time') td.style.whiteSpace = 'nowrap';
      return td;
    }), rowActions ? h('td.lerp-actions', rowActions(r)) : null)));
    const table = h('table.apb-erp-table' + (compact ? '.lerp-compact' : ''), h('caption.apb-erp-sr', caption || '数据表'), thead, tbody);
    if (columns.some((c) => c.sum)) table.appendChild(h('tfoot', h('tr', columns.map((c, i) => {
      if (!c.sum) return h('td', i === 0 ? footLabel || '合计' : '');
      const t = typeof c.sum === 'function' ? c.sum(rows) : rows.reduce((s, r) => s + (Number(r[c.key]) || 0), 0);
      return h('td.apb-erp-number.apb-erp-mono', c.type === 'money' ? ERP.fmt.money(t) : typeof t === 'number' ? ERP.fmt.num(t, c.digits || 0) : t);
    }), rowActions ? h('td') : null)));
    const wrap = h('div.apb-erp-tablewrap', { tabindex: '0', role: 'region', 'aria-label': (caption || '数据') + '，可横向滚动' }, table);
    container.appendChild(wrap);
    return wrap;
  };

  /* CSV 导出（含 BOM，Excel 可直接打开） */
  ui.exportCsv = function (name, columns, rows, footer) {
    const esc = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const val = (c, r) => (c.type === 'money' ? (Number(r[c.key]) || 0).toFixed(2) : c.type === 'date' ? ERP.fmt.date(r[c.key]) : c.type === 'time' ? ERP.fmt.time(r[c.key]) : r[c.key]);
    const lines = [columns.map((c) => esc(c.title)).join(',')].concat(rows.map((r) => columns.map((c) => esc(val(c, r))).join(',')));
    if (footer) lines.push(columns.map((c) => esc(val(c, footer))).join(','));  // 合计行（不计入条数）
    h('a', { href: URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv' })), download: `${name}-${ERP.fmt.date(new Date())}.csv` }).click();
    ui.toast(`已导出 ${rows.length} 条记录（CSV）。`);
  };

  /* 图表：SVG，系列以线型/图案区分并带图例文字 */
  ui.chart = function (container, { labels = [], series = [], type = 'line', height = 240, unit = '', format }) {
    const W = 900, H = height, PL = 64, PR = 16, PT = 12, PB = 32;
    const fmtV = format || ((v) => ERP.fmt.money(v));
    // SVG 以字符串拼接后 innerHTML 插入：所有文字（客户名、项目名等）必须转义
    const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const rawNames = series.map((se) => se.name), rawUnit = unit;  // 图例用文本节点，保留原文
    labels = labels.map(esc); unit = esc(unit);
    series = series.map((se) => ({ ...se, name: esc(se.name) }));
    const vals = series.flatMap((s) => s.values);
    const max = Math.max(1, ...vals) * 1.1, min = Math.min(0, ...vals) * 1.1;
    const n = Math.max(1, labels.length), slot = (W - PL - PR) / n;
    const x = (i) => PL + slot * (i + 0.5);
    const y = (v) => PT + (H - PT - PB) * (1 - (v - min) / (max - min));
    const dashes = ['', '6 4', '2 4', '10 4 2 4'];
    const fills = ['var(--apb-erp-primary)', 'var(--apb-erp-ink)', 'var(--apb-erp-muted)', 'var(--apb-erp-control-border)'];
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${series.map((x) => x.name).join('、')}图表">`;  // 名称已转义
    for (let i = 0; i <= 4; i++) { const v = min + ((max - min) * i) / 4, yy = y(v); s += `<line x1="${PL}" x2="${W - PR}" y1="${yy}" y2="${yy}" stroke="var(--apb-erp-line)"/><text x="${PL - 6}" y="${yy + 4}" font-size="11" text-anchor="end" fill="var(--apb-erp-muted)">${ERP.fmt.num(v)}</text>`; }
    const step = Math.ceil(labels.length / 14);
    labels.forEach((l, i) => { if (i % step === 0) s += `<text x="${x(i)}" y="${H - 10}" font-size="11" text-anchor="middle" fill="var(--apb-erp-muted)">${l}</text>`; });
    series.forEach((se, si) => {
      if (type === 'bar') {
        const bw = Math.max(3, slot / (series.length + 1));
        se.values.forEach((v, i) => (s += `<rect x="${x(i) - (bw * series.length) / 2 + si * bw}" y="${Math.min(y(v), y(0))}" width="${bw - 2}" height="${Math.abs(y(0) - y(v))}" fill="${fills[si % 4]}"><title>${labels[i]} ${se.name}：${fmtV(v)}${unit}</title></rect>`));
      } else {
        s += `<polyline fill="none" stroke="${fills[si % 4]}" stroke-width="2" stroke-dasharray="${dashes[si % 4]}" points="${se.values.map((v, i) => x(i) + ',' + y(v)).join(' ')}"/>`;
        se.values.forEach((v, i) => (s += `<circle cx="${x(i)}" cy="${y(v)}" r="3" fill="${fills[si % 4]}"><title>${labels[i]} ${se.name}：${fmtV(v)}${unit}</title></circle>`));
      }
    });
    if (min < 0) s += `<line x1="${PL}" x2="${W - PR}" y1="${y(0)}" y2="${y(0)}" stroke="var(--apb-erp-muted)"/>`;
    s += '</svg>';
    const legend = h('div.lerp-legend', series.map((se, si) => h('span', h('span', { 'aria-hidden': 'true', style: { color: fills[si % 4] } }, type === 'bar' ? '■' : ['——', '- - -', '· · ·', '—·—'][si % 4]), ` ${rawNames[si]}${rawUnit ? `（${rawUnit}）` : ''}`)));
    const el = h('div.lerp-chart', legend, h('div', { html: s }));
    container.appendChild(el);
    return el;
  };
})();
