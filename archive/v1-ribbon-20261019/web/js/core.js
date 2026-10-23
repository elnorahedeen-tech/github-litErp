/* LiteERP 静态原型 — 核心框架（无依赖）
 *
 * 页面注册：
 *   ERP.page('frontdesk', { title: '前台业务中心', kind: 'tab', render(el, params, ctx) {} })
 *     kind: 'tab'    — 在多文档标签中打开（同一页面只开一个）
 *           'dialog' — 模态对话框，render 需自行调用 ERP.ui.dialog
 *   ERP.open(id, params)
 *
 * 组件（ERP.ui.*）：h, grid, sidebar, split, dialog, reportWindow, itabs,
 *   dateRange, field, select, contextMenu, toast, confirm
 * 数据：ERP.data（见 data.js），格式化：ERP.fmt
 */
(function () {
  'use strict';
  const ERP = (window.ERP = window.ERP || {});
  const pages = {};
  ERP.pages = pages;

  /* ---------- hyperscript ---------- */
  function h(tag, attrs, ...children) {
    const m = /^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i.exec(tag) || [];
    const el = document.createElement(m[1] || 'div');
    (m[2] || '').replace(/([.#])([\w-]+)/g, (_, t, v) => (t === '.' ? el.classList.add(v) : (el.id = v)));
    if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) {
      children.unshift(attrs);
      attrs = null;
    }
    for (const k in attrs || {}) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'style' && typeof v === 'object') for (const p in v) { if (v[p] == null) continue; p.startsWith('--') ? el.style.setProperty(p, v[p]) : (el.style[p] = v[p]); }
      else if (k === 'class') el.className += (el.className ? ' ' : '') + v;
      else if (k === 'html') el.innerHTML = v;
      else if (k in el && k !== 'list' && k !== 'form') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    append(el, children);
    return el;
  }
  function append(el, children) {
    for (const c of children.flat(Infinity)) {
      if (c == null || c === false) continue;
      el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  }

  /* ---------- formatting ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  ERP.fmt = {
    money: (v, d = 2) => (v == null || v === '' ? '' : Number(v).toFixed(d)),
    money4: (v) => (v == null || v === '' ? '' : Number(v).toFixed(4)),
    date: (d) => { d = new Date(d); return isNaN(d) ? '' : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; },
    datetime: (d) => { d = new Date(d); return isNaN(d) ? '' : `${ERP.fmt.date(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; },
    short: (d) => { d = new Date(d); return isNaN(d) ? '' : `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; },
    pct: (v) => (v == null ? '' : (Number(v) * 100).toFixed(2) + '%'),
  };

  /* ---------- page registry & document tabs ---------- */
  ERP.page = function (id, def) { pages[id] = Object.assign({ id, kind: 'tab' }, def); };
  const openTabs = []; // {id, key, title, el, tabEl}
  let activeKey = null;

  ERP.open = function (id, params = {}) {
    const def = pages[id];
    if (!def) return ERP.ui.toast(`「${id}」尚未实现`);
    if (def.kind !== 'tab') return def.render(null, params, { id });
    const key = params.key ? `${id}:${params.key}` : id;
    let t = openTabs.find((x) => x.key === key);
    // 已打开的标签再次带参数打开（如快速查询栏再次搜索）：用新参数重新渲染
    const hasParams = Object.keys(params).some((k) => k !== 'key' && k !== 'title');
    if (t && hasParams) { t.el.innerHTML = ''; def.render(t.el, params, { id, close: () => close(key), setTitle: (s) => { t.tabEl.firstChild.textContent = s; } }); }
    if (!t) {
      const el = h('div.docpage');
      document.getElementById('workspace').appendChild(el);
      const title = params.title || def.title;
      const tabEl = h('div.doctab', { onclick: () => activate(key), onmousedown: (e) => e.button === 1 && close(key) },
        h('span', title), h('button.x', { title: '关闭', onclick: (e) => { e.stopPropagation(); close(key); } }, '✕'));
      document.getElementById('doctabs').appendChild(tabEl);
      t = { id, key, title, el, tabEl };
      openTabs.push(t);
      try { def.render(el, params, { id, close: () => close(key), setTitle: (s) => { tabEl.firstChild.textContent = s; } }); }
      catch (err) { console.error(err); el.appendChild(h('pre.note', String(err.stack || err))); }
    }
    activate(key);
  };
  function activate(key) {
    activeKey = key;
    for (const t of openTabs) {
      t.el.classList.toggle('active', t.key === key);
      t.tabEl.classList.toggle('active', t.key === key);
    }
    const t = openTabs.find((x) => x.key === key);
    if (t && ERP.selectRibbonFor) ERP.selectRibbonFor(t.id);
    document.getElementById('empty-ws').classList.toggle('hidden', !!t);
    if (t) document.getElementById('wintitle').textContent = `${t.title} - 【管理员】综合-精诚图文广告 [LiteERP Web 原型]`;
    try { localStorage.setItem('erp.lastTab', t ? t.id : ''); } catch (e) {}
  }
  function close(key) {
    const i = openTabs.findIndex((x) => x.key === key);
    if (i < 0) return;
    const [t] = openTabs.splice(i, 1);
    t.el.remove(); t.tabEl.remove();
    if (activeKey === key) activate(openTabs.length ? openTabs[Math.min(i, openTabs.length - 1)].key : null);
  }
  ERP.closeAllTabs = () => [...openTabs].forEach((t) => close(t.key));
  ERP.refreshTab = function (id) {
    const t = openTabs.find((x) => x.id === id);
    if (!t) return;
    t.el.innerHTML = '';
    pages[id].render(t.el, {}, { id, close: () => close(t.key) });
  };

  /* ---------- UI components ---------- */
  const ui = (ERP.ui = { h, append });

  ui.toast = function (msg, ms = 2200) {
    let w = document.querySelector('.toast-wrap');
    if (!w) document.body.appendChild((w = h('div.toast-wrap')));
    const t = h('div.toast', msg);
    w.appendChild(t);
    setTimeout(() => t.remove(), ms);
  };

  /* context menu: items = [{label, shortcut, icon, disabled, checked, action}|'-'] */
  ui.contextMenu = function (x, y, items) {
    document.querySelectorAll('.ctxmenu').forEach((m) => m.remove());
    const m = h('div.ctxmenu');
    for (const it of items) {
      if (it === '-') { m.appendChild(h('div.sep')); continue; }
      m.appendChild(h('div.mi' + (it.disabled ? '.disabled' : ''), {
        onclick: () => { m.remove(); it.action && it.action(); },
      }, h('span', (it.checked ? '✓ ' : '') + it.label), it.shortcut ? h('span.sc', it.shortcut) : null));
    }
    document.body.appendChild(m);
    const r = m.getBoundingClientRect();
    m.style.left = Math.min(x, innerWidth - r.width - 4) + 'px';
    m.style.top = Math.min(y, innerHeight - r.height - 4) + 'px';
    setTimeout(() => document.addEventListener('mousedown', function off(e) {
      if (!m.contains(e.target)) { m.remove(); document.removeEventListener('mousedown', off); }
    }), 0);
  };

  /* layout: left filter side + main */
  ui.split = function (container, { sideWidth = 230 } = {}) {
    const side = h('div.side'), main = h('div.main');
    const root = h('div.split', { style: { '--side-w': sideWidth + 'px' } }, side, main);
    container.appendChild(root);
    return { root, side, main };
  };

  /* collapsible side panels:
   * panels: [{title, closed, body: Node|Node[]} | {title, list: [{label, count, color, icon, value}], value, onSelect}] */
  ui.sidebar = function (container, panels) {
    const api = {};
    for (const p of panels) {
      const body = h('div.sp-body');
      const panel = h('div.spanel' + (p.closed ? '.closed' : ''),
        h('div.sp-head', { onclick: () => panel.classList.toggle('closed') }, p.title), body);
      if (p.list) {
        const ul = h('ul.slist');
        const render = () => {
          ul.innerHTML = '';
          for (const it of p.list) {
            const li = h('li' + (it.color ? '.c-' + it.color : ''), {
              onclick: () => { p.value = it.value; render(); p.onSelect && p.onSelect(it.value, it); },
            }, h('span.ic', it.icon || ''), h('span', it.label), it.count != null ? h('span.cnt', `<${it.count}>`) : null);
            if (it.value === p.value) li.classList.add('active');
            ul.appendChild(li);
          }
        };
        render();
        body.appendChild(ul);
        api[p.key || p.title] = { setList(list) { p.list = list; render(); }, get value() { return p.value; } };
      } else append(body, [p.body]);
      container.appendChild(panel);
    }
    return api;
  };

  /* form field: label + control */
  ui.field = function (label, control, opts = {}) {
    return h('div.fld', { style: opts.lw ? { '--lbl-w': opts.lw + 'px' } : null, class: opts.class }, h('label', label), control);
  };
  ui.input = (attrs = {}) => h('input.inp', attrs);
  ui.select = function (options, attrs = {}) {
    const s = h('select.inp', attrs);
    for (const o of options) {
      const [v, t] = Array.isArray(o) ? o : typeof o === 'object' ? [o.value, o.label] : [o, o];
      s.appendChild(h('option', { value: v }, t));
    }
    if (attrs.value != null) s.value = attrs.value;
    return s;
  };
  ui.check = (label, checked, attrs = {}) => h('label.chk', h('input', Object.assign({ type: 'checkbox', checked }, attrs)), label);
  ui.btn = (label, onclick, cls = '') => h('button.btn' + (cls ? '.' + cls.split(' ').join('.') : ''), { onclick }, label);

  /* 单据登记时间 筛选面板（今天/昨天/前天/本月/上月/30天以来/今年以来/自定义） */
  ui.dateRange = function ({ preset = 'today', onChange, label = '单据登记时间' } = {}) {
    const presets = [['today', '今天'], ['lastMonth', '上月'], ['yesterday', '昨天'], ['last30', '30天以来'],
      ['before', '前天'], ['year', '今年以来'], ['month', '本月'], ['custom', '自定义']];
    const name = 'dr' + Math.random().toString(36).slice(2);
    const from = ui.input({ type: 'datetime-local' }), to = ui.input({ type: 'datetime-local' });
    const calc = (p) => {
      const n = new Date(), d0 = new Date(n.getFullYear(), n.getMonth(), n.getDate());
      const day = 864e5; let a = d0, b = new Date(+d0 + day - 1000);
      if (p === 'yesterday') { a = new Date(+d0 - day); b = new Date(+d0 - 1000); }
      if (p === 'before') { a = new Date(+d0 - 2 * day); b = new Date(+d0 - day - 1000); }
      if (p === 'month') a = new Date(n.getFullYear(), n.getMonth(), 1);
      if (p === 'lastMonth') { a = new Date(n.getFullYear(), n.getMonth() - 1, 1); b = new Date(n.getFullYear(), n.getMonth(), 1, 0, 0, -1); }
      if (p === 'last30') a = new Date(+d0 - 30 * day);
      if (p === 'year') a = new Date(n.getFullYear(), 0, 1);
      return [a, b];
    };
    const iso = (d) => ERP.fmt.datetime(d).replace(' ', 'T');
    const set = (p) => {
      const custom = p === 'custom';
      from.readOnly = to.readOnly = !custom;
      if (!custom) { const [a, b] = calc(p); from.value = iso(a); to.value = iso(b); }
      onChange && onChange(api.value);
    };
    const el = h('div.col',
      ui.select([label, '业务日期', '审核时间'].map((x) => [x, x])),
      h('div.radios', presets.map(([v, t]) => h('label', h('input', { type: 'radio', name, value: v, checked: v === preset, onchange: () => set(v) }), t))),
      ui.field('从', from, { lw: 20 }), ui.field('到', to, { lw: 20 }));
    const api = { el, get value() { return { from: new Date(from.value), to: new Date(to.value) }; } };
    set(preset);
    return api;
  };

  /* 年-月-日 下拉（报表常用：开始 2026 10 01） */
  ui.ymd = function (date) {
    const d = new Date(date);
    const y = ui.select([2024, 2025, 2026, 2027], { value: d.getFullYear(), style: { width: '70px' } });
    const m = ui.select(Array.from({ length: 12 }, (_, i) => [i + 1, pad(i + 1)]), { value: d.getMonth() + 1, style: { width: '56px' } });
    const dd = ui.select(Array.from({ length: 31 }, (_, i) => [i + 1, pad(i + 1)]), { value: d.getDate(), style: { width: '56px' } });
    const el = h('div.row', { style: { gap: '4px' } }, y, m, dd);
    return { el, get value() { return new Date(+y.value, +m.value - 1, +dd.value); } };
  };

  /* inner tabs: tabs = [{title, render(pane)}] */
  ui.itabs = function (container, tabs, { active = 0, onChange } = {}) {
    const bar = h('div.itab-bar'), body = h('div.itab-body');
    const root = h('div.itabs', bar, body);
    const panes = tabs.map((t, i) => {
      const pane = h('div.itab-pane');
      body.appendChild(pane);
      bar.appendChild(h('button', { onclick: () => sel(i) }, t.title));
      return pane;
    });
    const rendered = new Set();
    function sel(i) {
      [...bar.children].forEach((b, j) => b.classList.toggle('active', i === j));
      panes.forEach((p, j) => p.classList.toggle('active', i === j));
      if (!rendered.has(i)) { rendered.add(i); tabs[i].render && tabs[i].render(panes[i]); }
      onChange && onChange(i);
    }
    container.appendChild(root);
    sel(active);
    return { root, panes, select: sel };
  };

  /* ---------- Grid ----------
   * opts.columns: [{key, title, width, align, type:'text'|'money'|'money4'|'int'|'check'|'date'|'datetime'|'short',
   *                 sum:boolean|'count', footer(rows)->合计行自定义值（均价/比例等）, render(row)->Node|string, class(row)->string, editable:boolean}]
   *       或分组：opts.groups: [{title, columns:[...]}]
   * opts.rows, opts.rowColor(row)->'red'|'green'|..., opts.rowClass(row), opts.onSelect(row), opts.onDblClick(row),
   * opts.contextMenu(row)->items 或 items 数组, opts.footer(默认在有 sum 列时显示), opts.rowNumbers(默认 true),
   * opts.multi(复选框列), opts.emptyText
   * 返回 { el, setRows(rows), get rows, get selected, get checked, refresh() } */
  ui.grid = function (container, opts) {
    const groups = opts.groups || [{ title: null, columns: opts.columns }];
    const cols = groups.flatMap((g) => g.columns);
    const hasGroups = groups.some((g) => g.title);
    const rn = opts.rowNumbers !== false;
    let rows = opts.rows || [], view = rows, selected = null, sortKey = null, sortDir = 1;
    const checked = new Set();
    const el = h('div.grid');
    if (opts.height) el.style.flex = '0 0 ' + opts.height + 'px';
    const table = h('table'), thead = h('thead'), tbody = h('tbody'), tfoot = h('tfoot');
    const colgroup = h('colgroup');
    if (rn) colgroup.appendChild(h('col', { style: { width: '44px' } }));
    if (opts.multi) colgroup.appendChild(h('col', { style: { width: '32px' } }));
    cols.forEach((c) => colgroup.appendChild(h('col', { style: { width: (c.width || defaultWidth(c)) + 'px' } })));
    table.append(colgroup, thead, tbody, tfoot);
    el.appendChild(table);
    container.appendChild(el);

    function defaultWidth(c) {
      if (c.type === 'check') return 56;
      if (['money', 'money4', 'int'].includes(c.type)) return 96;
      if (c.type === 'datetime') return 150;
      if (c.type === 'date') return 100;
      return Math.max(80, (c.title || '').length * 16 + 24);
    }
    function headers() {
      thead.innerHTML = '';
      if (hasGroups) {
        const tr = h('tr.g');
        if (rn) tr.appendChild(h('th.rn', { rowSpan: 2 }));
        if (opts.multi) tr.appendChild(h('th', { rowSpan: 2 }));
        groups.forEach((g) => tr.appendChild(h('th', { colSpan: g.columns.length }, g.title || '')));
        thead.appendChild(tr);
      }
      const tr = h('tr.c');
      if (!hasGroups && rn) tr.appendChild(h('th.rn'));
      if (!hasGroups && opts.multi) tr.appendChild(h('th'));
      cols.forEach((c) => {
        const th = h('th', { title: c.title, onclick: () => sortBy(c.key) }, c.title);
        if (c.key === sortKey) th.classList.add(sortDir > 0 ? 'sorted-asc' : 'sorted-desc');
        if (['money', 'money4', 'int'].includes(c.type)) th.style.textAlign = 'right';
        tr.appendChild(th);
      });
      thead.appendChild(tr);
      requestAnimationFrame(() => {
        const g = thead.querySelector('tr.g');
        el.style.setProperty('--gh', g ? g.getBoundingClientRect().height + 'px' : '0px');
      });
    }
    function cellValue(c, r) {
      const v = r[c.key];
      switch (c.type) {
        case 'money': return v === 0 && c.hideZero ? '' : ERP.fmt.money(v);
        case 'money4': return ERP.fmt.money4(v);
        case 'date': return v ? ERP.fmt.date(v) : '';
        case 'datetime': return v ? ERP.fmt.datetime(v) : '';
        case 'short': return v ? ERP.fmt.short(v) : '';
        case 'check': return h('input', { type: 'checkbox', checked: !!v, disabled: !c.editable, onchange: (e) => { r[c.key] = e.target.checked; c.onChange && c.onChange(r); } });
        default: return v == null ? '' : v;
      }
    }
    function body() {
      tbody.innerHTML = '';
      if (!view.length) {
        tbody.appendChild(h('tr', h('td.empty', { colSpan: cols.length + (rn ? 1 : 0) + (opts.multi ? 1 : 0) }, opts.emptyText || '没有数据')));
      }
      view.forEach((r, i) => {
        const tr = h('tr');
        if (opts.rowColor) { const c = opts.rowColor(r); if (c) tr.classList.add('c-' + c); }
        if (opts.rowClass) { const c = opts.rowClass(r); if (c) c.split(' ').forEach((x) => tr.classList.add(x)); }
        if (r === selected) tr.classList.add('sel');
        if (rn) tr.appendChild(h('td.rn', (r === selected ? '▸' : '') + (i + 1)));
        if (opts.multi) tr.appendChild(h('td.ctr', h('input', { type: 'checkbox', checked: checked.has(r), onclick: (e) => e.stopPropagation(), onchange: (e) => { e.target.checked ? checked.add(r) : checked.delete(r); opts.onCheck && opts.onCheck([...checked]); } })));
        for (const c of cols) {
          const td = h('td');
          if (['money', 'money4', 'int'].includes(c.type) || c.align === 'right') td.classList.add('num');
          if (c.type === 'check' || c.align === 'center') td.classList.add('ctr');
          if (c.class) { const k = c.class(r); if (k) k.split(' ').forEach((x) => td.classList.add(x)); }
          if (c.editable && c.type !== 'check') {
            const raw = r[c.key];
            const shown = typeof raw === 'number' && c.type === 'money' ? ERP.fmt.money(raw) : typeof raw === 'number' && c.type === 'money4' ? ERP.fmt.money4(raw) : raw ?? '';
            td.appendChild(h('input.cell', { value: shown, style: { textAlign: td.classList.contains('num') ? 'right' : 'left' },
              onchange: (e) => { r[c.key] = c.type && c.type !== 'text' ? Number(e.target.value) || 0 : e.target.value; c.onChange && c.onChange(r); footer(); } }));
          } else {
            const v = c.render ? c.render(r) : cellValue(c, r);
            append(td, [v]);
            if (typeof v === 'string' || typeof v === 'number') td.title = String(v);
          }
          tr.appendChild(td);
        }
        tr.addEventListener('click', () => select(r));
        tr.addEventListener('dblclick', () => opts.onDblClick && opts.onDblClick(r));
        tr.addEventListener('contextmenu', (e) => {
          if (!opts.contextMenu) return;
          e.preventDefault(); select(r);
          const items = typeof opts.contextMenu === 'function' ? opts.contextMenu(r) : opts.contextMenu;
          ui.contextMenu(e.clientX, e.clientY, items);
        });
        tbody.appendChild(tr);
      });
      footer();
    }
    function footer() {
      tfoot.innerHTML = '';
      const show = opts.footer ?? cols.some((c) => c.sum || c.footer);
      if (!show) return;
      const tr = h('tr');
      if (rn) tr.appendChild(h('td.rn', 'Σ'));
      if (opts.multi) tr.appendChild(h('td'));
      cols.forEach((c, i) => {
        let v = '';
        if (typeof c.footer === 'function') v = c.footer(view);
        else if (c.sum === 'count') v = view.length;
        else if (c.sum) v = ERP.fmt.money(view.reduce((s, r) => s + (Number(r[c.key]) || 0), 0), c.type === 'int' ? 0 : 2);
        else if (i === 0 && opts.footerLabel !== false) v = `共 ${view.length} 条`;
        tr.appendChild(h('td' + (c.sum || c.footer ? '.num' : ''), v));
      });
      tfoot.appendChild(tr);
    }
    function select(r) {
      selected = r;
      [...tbody.children].forEach((tr, i) => {
        tr.classList.toggle('sel', view[i] === r);
        const td = tr.querySelector('td.rn');
        if (td && view[i]) td.textContent = (view[i] === r ? '▸' : '') + (i + 1);
      });
      opts.onSelect && opts.onSelect(r);
    }
    function sortBy(key) {
      if (sortKey === key) sortDir = -sortDir; else { sortKey = key; sortDir = 1; }
      view = [...view].sort((a, b) => {
        const x = a[key], y = b[key];
        return (x == null ? -1 : y == null ? 1 : x > y ? 1 : x < y ? -1 : 0) * sortDir;
      });
      headers(); body();
    }
    el.addEventListener('contextmenu', (e) => {
      if (e.defaultPrevented || !opts.contextMenu) return;
      e.preventDefault();
      const items = typeof opts.contextMenu === 'function' ? opts.contextMenu(null) : opts.contextMenu;
      ui.contextMenu(e.clientX, e.clientY, items);
    });
    headers(); body();
    const api = {
      el,
      setRows(r) { rows = r; view = r; selected = null; checked.clear(); sortKey = null; headers(); body(); },
      refresh() { body(); },
      get rows() { return view; },
      get selected() { return selected; },
      get checked() { return [...checked]; },
      setChecked(list) { checked.clear(); (list || []).forEach((r) => checked.add(r)); body(); opts.onCheck && opts.onCheck([...checked]); },
      checkAll(on = true) { api.setChecked(on ? view : []); },
      select,
      exportCsv(name = 'export') {
        const esc = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
        const lines = [cols.map((c) => esc(c.title)).join(',')].concat(view.map((r) => cols.map((c) => esc(r[c.key])).join(',')));
        const a = h('a', { href: URL.createObjectURL(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv' })), download: name + '.csv' });
        a.click();
      },
    };
    return api;
  };
  /* 标准表格右键菜单 */
  ui.stdMenu = (grid, extra = [], name = 'export') => [
    ...extra, ...(extra.length ? ['-'] : []),
    { label: '导出(E)', shortcut: 'Ctrl+P', action: () => grid().exportCsv(name) },
    { label: '刷新(R)', shortcut: 'Ctrl+R', action: () => ui.toast('已刷新') },
  ];

  /* ---------- Dialog ----------
   * opts: {title, banner, width, height, body: Node|fn(bodyEl, close), buttons:[{label, primary, danger, action(close)->false 保持打开}],
   *        leftButtons:[...], maximized, flush, onClose} */
  ui.dialog = function (opts) {
    const overlay = h('div.overlay');
    const dlg = h('div.dlg' + (opts.maximized ? '.max' : ''), { style: { width: (opts.width || 640) + 'px', height: opts.height ? opts.height + 'px' : null } });
    const close = () => { overlay.remove(); opts.onClose && opts.onClose(); };
    const head = h('div.dlg-head', h('span.t', opts.title),
      h('button', { title: '最大化', onclick: () => dlg.classList.toggle('max') }, '▢'),
      h('button.close', { title: '关闭', onclick: close }, '✕'));
    const body = h('div.dlg-body' + (opts.flush ? '.flush' : ''));
    const mkBtn = (b) => h('button.btn' + (b.primary ? '.primary' : '') + (b.danger ? '.danger' : ''), {
      onclick: () => { const r = b.action ? b.action(close) : undefined; if (r !== false && b.close !== false && !b.action) close(); },
    }, b.label);
    const foot = h('div.dlg-foot', (opts.leftButtons || []).map(mkBtn), h('span.grow'), (opts.buttons || [{ label: '关闭(C)' }]).map(mkBtn));
    append(dlg, [head, opts.banner ? h('div.dlg-banner', opts.banner) : null, body, opts.buttons === null ? null : foot]);
    overlay.appendChild(dlg);
    document.body.appendChild(overlay);
    if (typeof opts.body === 'function') opts.body(body, close); else append(body, [opts.body]);
    // drag
    head.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON' || dlg.classList.contains('max')) return;
      const r = dlg.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
      dlg.style.position = 'fixed';
      const mv = (ev) => { dlg.style.left = ev.clientX - sx + 'px'; dlg.style.top = ev.clientY - sy + 'px'; };
      document.addEventListener('mousemove', mv);
      document.addEventListener('mouseup', () => document.removeEventListener('mousemove', mv), { once: true });
    });
    overlay.addEventListener('keydown', (e) => e.key === 'Escape' && close());
    return { el: dlg, body, foot, close };
  };
  ui.confirm = (msg, onOk, title = '确认') => ui.dialog({ title, width: 380, body: h('div', { style: { padding: '8px 4px' } }, msg),
    buttons: [{ label: '确定', primary: true, action: (c) => { c(); onOk && onOk(); } }, { label: '取消' }] });

  /* ---------- Report window（原系统中报表以独立窗口打开）----------
   * opts: {title, banner, side(sideEl)->void, render(mainEl)->void, onStat(), width/height, extraLeft:[buttons]} */
  ui.reportWindow = function (opts) {
    let mainEl;
    return ui.dialog({
      title: opts.title, banner: opts.banner, maximized: opts.maximized !== false, width: opts.width || 1200, height: opts.height || 720, flush: true,
      body: (b) => {
        const side = h('div.side'); mainEl = h('div.main');
        b.appendChild(h('div.rptwin', { style: opts.sideWidth ? { gridTemplateColumns: opts.sideWidth + 'px 1fr' } : null }, side, mainEl));
        opts.side && opts.side(side);
        opts.render && opts.render(mainEl);
      },
      leftButtons: [{ label: '导出(P)', action: () => { opts.onExport ? opts.onExport() : ui.toast('已导出（原型）'); return false; } }, ...(opts.extraLeft || [])],
      buttons: [{ label: '✔ 统计[S]', primary: true, action: () => { opts.onStat ? opts.onStat() : ui.toast('统计完成'); return false; } }, { label: '✕ 关闭(C)' }],
    });
  };

  /* 简单 SVG 折线/柱状图（用于报表图表区域）
   * series: [{name, values:[n], color}], labels: [str] */
  ui.chart = function (container, { labels = [], series = [], type = 'line', height = 260 } = {}) {
    const W = 900, H = height, P = 36;
    const max = Math.max(1, ...series.flatMap((s) => s.values)) * 1.1;
    const n = Math.max(1, labels.length), slot = (W - 2 * P) / n;
    const x = type === 'bar' ? (i) => P + slot * (i + 0.5) : (i) => P + (labels.length <= 1 ? 0 : (i * (W - 2 * P)) / (labels.length - 1));
    const y = (v) => H - P - (v / max) * (H - 2 * P);
    let svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" style="display:block">`;
    for (let i = 0; i <= 5; i++) {
      const v = (max * i) / 5, yy = y(v);
      svg += `<line x1="${P}" x2="${W - P}" y1="${yy}" y2="${yy}" stroke="#e5e7eb"/><text x="4" y="${yy + 4}" font-size="11" fill="#6b7280">${v.toFixed(0)}</text>`;
    }
    labels.forEach((l, i) => (svg += `<text x="${x(i)}" y="${H - 12}" font-size="11" text-anchor="middle" fill="#6b7280">${l}</text>`));
    series.forEach((s, si) => {
      const c = s.color || ['#2563eb', '#16a34a', '#ea580c', '#7c3aed'][si % 4];
      if (type === 'bar') {
        const bw = Math.max(4, slot / (series.length + 1));
        s.values.forEach((v, i) => (svg += `<rect x="${x(i) - (bw * series.length) / 2 + si * bw}" y="${y(v)}" width="${bw - 2}" height="${H - P - y(v)}" fill="${c}" rx="2"/>`));
      } else {
        svg += `<polyline fill="none" stroke="${c}" stroke-width="2" points="${s.values.map((v, i) => x(i) + ',' + y(v)).join(' ')}"/>`;
        s.values.forEach((v, i) => (svg += `<circle cx="${x(i)}" cy="${y(v)}" r="3" fill="${c}"/>`));
      }
    });
    svg += '</svg>';
    const legend = series.length > 1 || series[0]?.name ? `<div class="row" style="gap:14px;padding:6px 10px;font-size:12px">${series.map((s, si) => `<span><i style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${s.color || ['#2563eb', '#16a34a', '#ea580c', '#7c3aed'][si % 4]}"></i> ${s.name || ''}</span>`).join('')}</div>` : '';
    const el = h('div.chart', { html: legend + svg });
    container.appendChild(el);
    return el;
  };
})();
