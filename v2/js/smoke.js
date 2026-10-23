/* 冒烟测试（仅 ?smoke=1 时生效，tools/smoke.sh 使用）：逐个路由渲染全部页面，记录异常与渲染失败提示。 */
(function () {
  if (new URLSearchParams(location.search).get('smoke') !== '1') return;
  const errors = [];
  window.addEventListener('error', (e) => errors.push(String(e.message)));
  window.addEventListener('unhandledrejection', (e) => errors.push(String(e.reason && e.reason.message || e.reason)));
  window.addEventListener('load', async () => {
    const out = [];
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    for (const id of Object.keys(ERP.pages)) {
      const before = errors.length;
      location.hash = ERP.href(id, ERP.pages[id].smokeParams || {});
      await wait(400);
      document.querySelectorAll('dialog[open]').forEach((d) => d.remove());
      const failed = ERP.root.querySelector('#lerp-body > .apb-erp-notice[data-tone="danger"]');
      const errs = errors.slice(before).concat(failed && /渲染失败/.test(failed.textContent) ? [failed.textContent] : []);
      out.push((errs.length ? 'FAIL ' : 'ok   ') + id + (errs.length ? ' — ' + errs.join('; ') : ''));
    }
    const mods = ERP.modules.map((m) => `${m.title}:${Object.values(ERP.pages).filter((p) => p.module === m.id).length}`).join(' ');
    out.push('', `pages: ${Object.keys(ERP.pages).length} (${mods})`);
    document.body.appendChild(Object.assign(document.createElement('pre'), { id: 'smoke', textContent: out.join('\n') }));
  });
})();
