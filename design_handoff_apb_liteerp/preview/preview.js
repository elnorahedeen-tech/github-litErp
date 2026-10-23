/* Offline, synthetic state only. No fetch, storage, credentials or APB operations. */
(() => {
  'use strict';
  const root = document.querySelector('[data-apb-erp]');
  const $ = selector => root.querySelector(selector);
  const labels = {blocked: ['已暂停', 'warning'], running: ['处理中', 'info'], complete: ['已完成', 'success'], pending: ['待接收', 'neutral']};
  const rows = [
    ['DEMO-20261020-001', '春晓设计工作室', 'blocked', 2, 26800, '10:32'],
    ['DEMO-20261020-002', '海棠文化有限公司', 'running', 1, 12800, '10:28'],
    ['DEMO-20261020-003', '远山教育 · 课程资料', 'complete', 3, 96000, '10:15'],
    ['DEMO-20261020-004', '南风建筑设计事务所（项目资料归档与补充图纸）', 'pending', 1, 5860, '10:02'],
    ['DEMO-20261020-005', '松林出版工作室', 'complete', 2, 30000, '09:46'],
    ['DEMO-20261020-006', '长河展览服务', 'blocked', 1, 18720, '09:31'],
  ].map(([id, customer, state, parts, cents, time]) => ({id, customer, state, parts, cents, time}));
  const currency = cents => new Intl.NumberFormat('zh-CN', {minimumFractionDigits: 2, maximumFractionDigits: 2}).format(cents / 100);
  const params = new URLSearchParams(location.search);
  if (params.get('mode') === 'embedded') document.body.dataset.previewMode = 'embedded';
  let page = Math.max(1, Number(params.get('page')) || 1), selected = new Set(), visible = [], timer;
  let composing = false, view = 'orders', dirty = false, saving = false, saveOperation = 0, pendingHash = '', lastTrigger;
  $('#order-search').value = params.get('q') || '';
  $('#status-filter').value = params.get('status') || '';
  const el = (tag, text, className) => {const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node;};
  function saveURL() {
    const next = new URL(location.href);
    for (const [key, value] of [['q', $('#order-search').value.trim()], ['status', $('#status-filter').value], ['page', String(page)]]) {
      if (value && !(key === 'page' && value === '1')) next.searchParams.set(key, value); else next.searchParams.delete(key);
    }
    history.replaceState(null, '', next);
  }
  function selection(changed = false) {
    $('#select-page').checked = visible.length > 0 && selected.size === visible.length;
    $('#select-page').indeterminate = selected.size > 0 && selected.size < visible.length;
    $('#select-page').disabled = !visible.length;
    $('#selection-status').textContent = (changed ? '列表已变化，选择已清除。' : '') + (selected.size ? `已选择 ${selected.size} 单 · 仅当前页` : '未选择订单 · 仅选择当前页');
  }
  function render() {
    clearTimeout(timer);
    const q = $('#order-search').value.trim().toLocaleLowerCase('zh-CN'), state = $('#status-filter').value;
    const filtered = rows.filter(row => (!q || `${row.id} ${row.customer}`.toLocaleLowerCase('zh-CN').includes(q)) && (!state || row.state === state));
    const pages = Math.max(1, Math.ceil(filtered.length / 4));
    page = Math.min(Math.max(Math.floor(page), 1), pages);
    const hadSelection = selected.size > 0;
    selected = new Set(); visible = filtered.slice((page - 1) * 4, page * 4);
    $('#order-rows').replaceChildren();
    for (const row of visible) {
      const tr = el('tr'), checkCell = el('td', undefined, 'apb-erp-check'), check = el('input');
      check.type = 'checkbox'; check.className = 'apb-erp-checkbox'; check.setAttribute('aria-label', `选择订单 ${row.id}`);
      check.addEventListener('change', () => {if (check.checked) selected.add(row.id); else selected.delete(row.id); selection();});
      checkCell.append(check); tr.append(checkCell);
      const identity = el('td'), id = el('span', row.id, 'apb-erp-mono'); identity.append(id, el('div', row.customer, 'apb-erp-muted')); tr.append(identity);
      const business = el('td'); business.append(el('span', '已保存', 'apb-erp-badge')); tr.append(business);
      const status = el('td'), badge = el('span', labels[row.state][0], 'apb-erp-badge'); badge.dataset.tone = labels[row.state][1]; status.append(badge); tr.append(status);
      tr.append(el('td', String(row.parts), 'apb-erp-number'), el('td', currency(row.cents), 'apb-erp-number apb-erp-mono'), el('td', row.time, 'apb-erp-mono'));
      const action = el('td'), link = el('a', '查看详情'); link.href = `#order/${row.id}`; link.setAttribute('aria-label', `查看订单 ${row.id} 详情`); action.append(link); tr.append(action);
      $('#order-rows').append(tr);
    }
    $('#clear-search').hidden = !$('#order-search').value;
    $('#no-results').hidden = filtered.length > 0;
    $('#previous-page').disabled = page === 1; $('#next-page').disabled = page === pages;
    $('#page-number').textContent = `第 ${page} / ${pages} 页`;
    $('#result-status').textContent = filtered.length ? `显示 ${(page - 1) * 4 + 1}–${Math.min(page * 4, filtered.length)}，共 ${filtered.length} 单` : '共 0 单';
    selection(hadSelection); saveURL();
  }
  function search() { if (composing) return; page = 1; render(); }
  $('#order-search').addEventListener('compositionstart', () => {composing = true; clearTimeout(timer);});
  $('#order-search').addEventListener('compositionend', () => {composing = false; clearTimeout(timer); timer = setTimeout(search, 300);});
  $('#order-search').addEventListener('input', () => {$('#clear-search').hidden = !$('#order-search').value; clearTimeout(timer); if (!composing) timer = setTimeout(search, 300);});
  $('#search-form').addEventListener('submit', event => {event.preventDefault(); search();});
  $('#order-search').addEventListener('keydown', event => {if (event.key === 'Enter' && (event.isComposing || composing)) event.preventDefault();});
  $('#status-filter').addEventListener('change', search);
  $('#clear-search').addEventListener('click', () => {clearTimeout(timer); composing = false; $('#order-search').value = ''; search(); $('#order-search').focus();});
  $('#reset-filters').addEventListener('click', () => {$('#order-search').value = ''; $('#status-filter').value = ''; search(); $('#order-search').focus();});
  $('#previous-page').addEventListener('click', () => {page--; render();});
  $('#next-page').addEventListener('click', () => {page++; render();});
  $('#select-page').addEventListener('change', event => {selected = new Set(event.target.checked ? visible.map(row => row.id) : []); $('#order-rows').querySelectorAll('input').forEach(input => {input.checked = event.target.checked;}); selection();});

  function showDetail(row) {
    $('#detail-title').textContent = row.id;
    $('#detail-facts').replaceChildren();
    for (const [key, value] of [['客户', row.customer], ['ERP 状态', '已保存'], ['APB 状态', labels[row.state][0]], ['订单金额（元）', currency(row.cents)], ['更新时间', `2026-10-20 ${row.time}（北京时间）`], ['部件数', String(row.parts)]]) {
      const pair = el('div'); pair.append(el('dt', key), el('dd', value)); $('#detail-facts').append(pair);
    }
    $('#detail-body').replaceChildren();
    if (row.state === 'blocked') {
      const note = el('div', '部件 1 · 内页：输出检查暂停，所选设备未找到符合订单要求的纸张。', 'apb-erp-notice'); note.dataset.tone = 'warning';
      const list = el('ol', undefined, 'apb-erp-tree');
      for (const text of ['✓ 入口：第 2 条“黑白”规则命中，后续规则未评估', '✓ 文件检查：12 页，CropBox A4', '✓ 缩放：CropBox A5', '✓ 拼版：A3', '暂停 · 输出检查：没有符合要求的纸张', '○ 提交打印：未执行']) list.append(el('li', text));
      const details = el('details'); details.append(el('summary', '查看本次输入的页面尺寸 metadata'));
      const metadata = el('dl', undefined, 'apb-erp-kv');
      for (const [key, value] of [['MediaBox', '210 × 297 mm · 原文显式'], ['CropBox', '210 × 297 mm · 原文显式'], ['TrimBox', '210 × 297 mm · 默认取 CropBox'], ['BleedBox', '210 × 297 mm · 默认取 CropBox'], ['ArtBox', '210 × 297 mm · 默认取 CropBox'], ['Rotate / UserUnit', '0° / 1 · 默认值']]) {const item = el('div'); item.append(el('dt', key), el('dd', value)); metadata.append(item);}
      details.append(metadata); $('#detail-body').append(note, list, details);
      if (row.parts > 1) $('#detail-body').append(el('p', '部件 2 · 封面：执行记录未提供，当前状态未知。', 'apb-erp-muted'));
    } else $('#detail-body').append(el('p', '此样例未附逐部件执行记录。正式界面按 APB 回执展示，不从订单总状态推断各部件结果。'));
    if (!$('#detail-dialog').open) $('#detail-dialog').showModal();
  }
  function route() {
    const raw = location.hash.slice(1), target = ['orders', 'form', 'states'].includes(raw) ? raw : 'orders';
    view = target;
    for (const name of ['orders', 'form', 'states']) $('#' + name).hidden = name !== target;
    root.querySelectorAll('[data-view]').forEach(link => {if (link.dataset.view === target) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');});
    const title = {orders: '订单管理', form: '客户资料', states: '组件与状态'}[target];
    $('#page-title').textContent = title; document.title = `${title} — LiteERP · APB 样式预览`;
    if (raw.startsWith('order/')) {const row = rows.find(item => item.id === raw.slice(6)); if (row) {showDetail(row); document.title = '订单详情 — LiteERP · APB 样式预览';}}
    else if ($('#detail-dialog').open) $('#detail-dialog').close();
  }
  function closeDetail() {$('#detail-dialog').close(); history.replaceState(null, '', location.pathname + location.search + '#orders'); route(); if (lastTrigger?.isConnected) lastTrigger.focus(); else $('#page-title').focus();}
  $('#close-detail').addEventListener('click', closeDetail);
  $('#detail-dialog').addEventListener('cancel', event => {event.preventDefault(); closeDetail();});
  // Keep Tab inside the authored modal instead of cycling to browser chrome.
  root.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const stops = Array.from(dialog.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex="0"]')).filter(node => node.getClientRects().length);
    const first = stops[0], last = stops[stops.length - 1];
    if (!first) {event.preventDefault(); dialog.focus(); return;}
    if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last.focus();}
    else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first.focus();}
  }));
  root.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]'); if (!link) return;
    if (link.hash.startsWith('#order/')) lastTrigger = link;
    if (dirty && view === 'form' && link.hash !== '#form') {event.preventDefault(); pendingHash = link.hash; $('#discard-dialog').showModal();}
  });
  $('#keep-editing').addEventListener('click', () => $('#discard-dialog').close());
  $('#discard-changes').addEventListener('click', () => {
    saveOperation++; saving = false; dirty = false; $('#customer-form').reset();
    $('#save-demo').disabled = false; $('#save-demo').removeAttribute('aria-busy');
    $('#save-status').textContent = ''; $('#form-error').hidden = true;
    for (const id of ['name-error', 'date-error']) $('#' + id).hidden = true;
    $('#customer-form').querySelectorAll('[aria-invalid]').forEach(input => input.removeAttribute('aria-invalid'));
    $('#discard-dialog').close(); location.hash = pendingHash;
  });
  window.addEventListener('hashchange', () => {
    if (dirty && view === 'form' && location.hash !== '#form') {pendingHash = location.hash || '#orders'; history.replaceState(null, '', location.pathname + location.search + '#form'); if (!$('#discard-dialog').open) $('#discard-dialog').showModal(); return;}
    route(); if (!$('#detail-dialog').open) $('#page-title').focus();
  });
  window.addEventListener('beforeunload', event => {if (dirty) {event.preventDefault(); event.returnValue = '';}});
  $('#customer-form').addEventListener('input', () => {dirty = true; $('#save-status').textContent = '';});
  $('#customer-form').addEventListener('change', () => {dirty = true;});
  function validDate(value) {
    if (!value) return true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + 'T00:00:00Z');
    return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  }
  $('#customer-form').addEventListener('submit', event => {
    event.preventDefault(); if (saving) return;
    const invalid = [];
    for (const [inputId, errorId, ok] of [['customer-name', 'name-error', !!$('#customer-name').value.trim()], ['contact-date', 'date-error', validDate($('#contact-date').value)]]) {
      $('#' + errorId).hidden = ok; $('#' + inputId).setAttribute('aria-invalid', String(!ok)); if (!ok) invalid.push($('#' + inputId));
    }
    $('#form-error').hidden = !invalid.length;
    if (invalid.length) {invalid[0].focus(); return;}
    const operation = ++saveOperation;
    saving = true; $('#save-demo').disabled = true; $('#save-demo').setAttribute('aria-busy', 'true');
    const snapshot = new FormData($('#customer-form')).get('customer_name');
    // Demonstration of fixed-size pending state, not a network call or persistence.
    const revision = JSON.stringify(Array.from($('#customer-form').elements, input => input.value));
    setTimeout(() => {
      if (operation !== saveOperation) return;
      saving = false; $('#save-demo').disabled = false; $('#save-demo').removeAttribute('aria-busy');
      const unchanged = revision === JSON.stringify(Array.from($('#customer-form').elements, input => input.value));
      dirty = !unchanged;
      $('#save-status').textContent = unchanged ? `“${snapshot}”样例校验完成；数据仅留在本页，没有写入服务器。` : '先前填写的样例校验完成；你随后修改的内容尚未校验。';
    }, 500);
  });
  render(); route();
})();
