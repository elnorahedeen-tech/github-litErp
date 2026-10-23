/* 端到端交互测试（仅 ?e2e=1 时生效，tools/e2e.sh 使用）：在真实 DOM 上操作核心流程并断言结果。 */
(function () {
  if (new URLSearchParams(location.search).get('e2e') !== '1') return;
  const log = [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const ok = (cond, msg) => log.push((cond ? 'PASS ' : 'FAIL ') + msg);
  const go = async (hash, ms = 500) => { location.hash = hash; await wait(ms); };
  const set = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const btnByText = (t, root = document) => $$('button, a', root).find((b) => b.textContent.trim() === t);
  window.addEventListener('load', async () => {
    try {
      const D = ERP.data;
      // 1. 列表筛选与分页、地址保存
      await go('#/frontdesk');
      ok($$('#lerp-body tbody tr').length === 20, '前台列表默认每页 20 条');
      set($('#lerp-body select'), '完成结算');
      await wait(200);
      ok($$('#lerp-body tbody tr').length === D.workOrders.filter((w) => w.settleStatus === '完成结算').length, '结算状态筛选生效');
      ok(location.hash.includes('settle='), '筛选写入地址');
      const search = $('#lerp-body input[type=search]');
      set(search, '不存在的关键词xyz');
      await wait(500);
      ok(!!btnByText('清除筛选'), '无匹配时显示“清除筛选”');
      btnByText('清除筛选').click(); await wait(300);
      ok($$('#lerp-body tbody tr').length === 20, '清除筛选后恢复');
      // 2. 选择：当前页全选与批量按钮
      $('#lerp-body thead input[type=checkbox]').click(); await wait(50);
      ok(/已选择 20 条/.test($('#lerp-body [role=status]').textContent), '页头复选框全选当前页');
      // 3. 新建工单：校验 → 填写 → 保存 → 跳转详情
      await go('#/newOrder');
      $$('input[name^=custMode]').find((r) => r.value === 'new').click(); await wait(50);
      $('form.apb-erp-form').requestSubmit(); await wait(100);
      ok(!$('form.apb-erp-form > .apb-erp-notice').hidden, '必填缺失显示错误摘要');
      ok(document.activeElement && document.activeElement.name === 'newName', '首个错误字段获得焦点');
      set($('input[name=newName]'), '测试新客户');
      set($('input[name=due]'), '2026-02-30');
      $('form.apb-erp-form').requestSubmit(); await wait(100);
      ok($('input[name=due]').getAttribute('aria-invalid') === 'true', '无效日期被拦截');
      set($('input[name=due]'), '2026-10-30');
      btnByText('添加经营项目').click(); await wait(200);
      btnByText('添加', $('dialog[open]')).click(); await wait(50);
      btnByText('完成', $('dialog[open]')).click(); await wait(100);
      const count = D.workOrders.length;
      $('form.apb-erp-form').requestSubmit(); await wait(900);
      ok(D.workOrders.length === count + 1, '工单已创建');
      ok(location.hash.startsWith('#/orderDetail'), '保存后进入详情页');
      const no = new URLSearchParams(location.hash.split('?')[1]).get('no');
      const w = D.workOrders.find((x) => x.no === no);
      ok(w && w.custName === '测试新客户' && w.lines.length === 1, '工单客户与明细正确');
      // 4. 收款结算（对话框）
      btnByText('收款结算').click(); await wait(200);
      const dlg = $('dialog[open]');
      ok(!!dlg, '收款对话框打开');
      set($('input[name=amount]', dlg), '999999');
      $('form', dlg).requestSubmit(); await wait(100);
      ok($('input[name=amount]', dlg).getAttribute('aria-invalid') === 'true', '超额收款被拦截');
      set($('input[name=amount]', dlg), String(w.amount));
      $('form', dlg).requestSubmit(); await wait(900);
      ok(w.settleStatus === '完成结算' && !$('dialog[open]'), '收款后完成结算并关闭对话框');
      // 5. 离开保护
      await go('#/newOrder');
      set($('input[name=contact]'), '有修改');
      location.hash = '#/frontdesk'; await wait(300);
      ok(!!$('dialog[open]') && /放弃未保存/.test($('dialog[open]').textContent), '有未保存修改时离开出现确认');
      btnByText('放弃修改', $('dialog[open]')).click(); await wait(500);
      ok(location.hash.startsWith('#/frontdesk'), '放弃修改后离开');
      // 6. 回归：代码审查发现的问题（结算一致性、编号、地址解码、图表转义、合并）
      const fin = ERP.biz.fin, mk = (amount) => {
        const no = ERP.biz.nextOrderNo();
        const o = { no, custCode: '1070', custName: '北京亚德鲁公司', group: '', paid: 0, flow: '排队', created: new Date(), lines: [{ amount }], audited: false };
        ERP.biz.recalcOrder(o); D.workOrders.unshift(o); return o;
      };
      const c1070 = D.customer('1070'), debt0 = c1070.debt, bills0 = D.arBills.length;
      const o1 = mk(300);
      const st = fin.settleAmount(o1, 300, { mode: '记账' });
      ok(c1070.debt === Math.round((debt0 + 300) * 100) / 100 && D.arBills.length === bills0 + 1 && st.arNo, '记账收款生成记账单并增加欠款');
      fin.reverseSettlement(st);
      ok(c1070.debt === debt0 && D.arBills.length === bills0 && o1.paid === 0, '删除记账结算单冲回记账单、欠款与工单已结');
      const cash = fin.acctBy('1001'), bal0 = cash.balance;
      const st2 = fin.settleAmount(o1, 100, { mode: '收款', a: cash, method: '现钞' });
      ok(Math.abs(cash.balance - bal0 - 100) < 0.001, '现金收款记入资金科目');
      fin.reverseSettlement(st2);
      ok(Math.abs(cash.balance - bal0) < 0.001, '删除现金结算单冲回资金科目');
      let threw = false; try { fin.settleAmount(mk(999999), 999999, { mode: '预存扣款' }); } catch (e) { threw = true; }
      ok(threw, '预存余额不足时拒绝扣款');
      const a = mk(1), b = mk(1); D.workOrders.splice(D.workOrders.indexOf(a), 1);
      const c = ERP.biz.nextOrderNo();
      ok(c !== b.no && !D.workOrders.some((x) => x.no === c), '删除单据后新编号不与现存单据重号');
      const code = ERP.biz.nextCustCode();
      ok(!D.customers.some((x) => x.code === code), '新客户编号不与现有客户重复');
      ERP.go('frontdesk', { q: 'A&B +86' }); await wait(400);
      ok(ERP.params().q === 'A&B +86', '地址参数含 & 与 + 时解码正确');
      const box = document.createElement('div');
      ERP.ui.chart(box, { labels: ['<img src=x onerror=window.__xss=1>'], series: [{ name: '<b>s</b>', values: [1] }] });
      ok(!box.querySelector('img') && !box.querySelector('b') && !window.__xss, '图表文字已转义（无 XSS）');
      ok(box.querySelector('.lerp-legend').textContent.includes('<b>s</b>'), '图例显示原文');
    } catch (e) { log.push('FAIL 异常：' + e.message); }
    document.body.appendChild(Object.assign(document.createElement('pre'), { id: 'e2e', textContent: log.join('\n') }));
  });
})();
