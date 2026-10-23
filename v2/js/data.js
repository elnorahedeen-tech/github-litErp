/* LiteERP 静态原型 — 共享模拟数据（取自旧系统截图，部分为生成数据）
 * 所有页面通过 ERP.data 读取；页面内修改只在内存中生效，刷新即恢复。 */
(function () {
  'use strict';
  const D = (window.ERP = window.ERP || {}).data = {};

  // 伪随机（固定种子，保证每次刷新数据一致）
  let seed = 20261019;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const r2 = (n) => Math.round(n * 100) / 100;
  D.util = { rnd, pick, r2 };

  D.company = { name: '精诚图文广告', branch: '综合', version: '印特331-普及版-3.2606.682', period: '202107', server: '2026-10-19 16:50:42' };
  D.currentUser = { code: '0000', name: '管理员', role: '综合' };

  /* 客户分组（含预存卡等级与折扣） */
  D.groups = [
    { code: '10', name: '普通', discount: 1 },
    { code: '20', name: '协议', discount: 1 },
    { code: '30', name: '预存（会员卡-1000-7折）', short: '预存（会员…', discount: 0.7, prestore: 1000 },
    { code: '40', name: '预存（银卡-5000）', short: '预存（银卡-5…', discount: 0.85, prestore: 5000 },
    { code: '50', name: '预存（金卡-10000）', short: '预存（金卡-1…', discount: 0.8, prestore: 10000 },
    { code: '60', name: '预存（钻石卡）', short: '预存（钻石卡）', discount: 0.7, prestore: 20000 },
    { code: '65', name: '设计院', discount: 1 },
    { code: '70', name: '政府单位', discount: 1 },
    { code: '75', name: '同行客户', discount: 0.9 },
    { code: '80', name: '新建分组（临时）', discount: 1 },
  ];
  D.groupName = (code) => (D.groups.find((g) => g.code === code) || {}).name || '';

  /* 客户 */
  const custSeed = [
    ['000000', '散户', '10', '个人'], ['1005', '印特', '50'], ['1010', '商务局', '65'], ['1040', '人民法院', '70'],
    ['1045', '印特软件', '40'], ['1055', '清华大学大公司服务有限公司北京分公司', '10'], ['1060', '重庆一份林图文', '20'],
    ['1065', '上海新科技公司', '50'], ['1070', '北京亚德鲁公司', '30'], ['1090', '长沙文集图文广告', '10'],
    ['1145', '醇龙箱包', '50'], ['1155', '临时', '20'], ['1160', '美益添', '10'], ['1165', '文雅', '40'], ['1170', '春阳', '20'],
    ['1180', '天津工业大学', '75'], ['1190', '长沙国美集团', '50'], ['1220', '北京格式快印公司', '50'], ['1235', '设计院公司—规划院', '10'],
    ['1240', '广东广州建筑设计院（工程部）', '65'], ['1245', '广东深圳工程设计院', '10'], ['1255', '台州印达达图文', '10'],
    ['1260', '武汉大学', '10'], ['1270', '吉林长春大众公司', '10'], ['1285', '上海电气总公司（飞哥-01002）', '10'],
    ['1295', '中铁十二局', '10'], ['1300', '昊美图文', '10'], ['1305', '深圳心智公司', '40'], ['1320', '漳州宝宝公司', '50'],
    ['1350', '中规院(北京)规划设计有限公司', '65'], ['1355', '合肥建鑫图文有限公司', '10'], ['1360', '涿州华为公司', '10'],
    ['1365', '宏图公司', '10'], ['1370', '上海大众分销公司', '10'], ['1375', '北京印特印科技公司', '10'], ['1380', '一（1）班', '10', '个人'], ['1385', '123', '10', '个人'],
  ];
  const cities = ['北京', '上海', '广州', '深圳', '长沙', '武汉', '天津', '重庆', '合肥', '漳州'];
  const surnames = '王李张刘陈杨黄赵周吴徐孙马朱胡郭何林罗高'.split('');
  D.customers = custSeed.map(([code, name, group, type], i) => {
    const debt = code === '000000' ? 0 : r2(rnd() * 3000);
    return {
      code, name, group, groupName: D.groupName(group), type: type || '机构',
      contact: code === '000000' ? '' : pick(surnames) + pick(['先生', '女士', '经理', '工']),
      phone: code === '000000' ? '' : '1' + pick(['3', '5', '8']) + String(Math.floor(rnd() * 1e9)).padStart(9, '0'),
      tel: '', address: pick(cities) + '市' + pick(['朝阳区', '海淀区', '天河区', '南山区', '岳麓区']) + Math.floor(rnd() * 300 + 1) + '号',
      city: pick(cities), owner: pick(['管理员', '总管', '小管', '前台']), value: pick(['未评估', 'A', 'B', 'C']),
      debt, writeOffPending: i === 8 ? 123.12 : 0, prestoreBalance: group >= '30' && group <= '60' ? r2(rnd() * 8000) : 0,
      created: new Date(Math.min(+new Date(2026, 9, 19), +new Date(2023 + Math.floor(rnd() * 4), Math.floor(rnd() * 12), 1 + Math.floor(rnd() * 27)))),
      lastAudit: rnd() > 0.5 ? new Date(2025 + Math.floor(rnd() * 2), Math.floor(rnd() * 10), 1 + Math.floor(rnd() * 27)) : null,
      remark: pick(['', '', '', '已开发票', '已开票', '月结']), invoiceTitle: name, taxNo: '', bank: '', creditLimit: 0, settleType: pick(['现结', '记账', '月结']),
    };
  });
  D.customer = (code) => D.customers.find((c) => c.code === code);

  /* 员工 */
  const empSeed = [['0000', '管理员', '综合', '办公室>总经理', '2013/2/25'], ['0001', '崔普', '综合', '生产制作>前台', '2021/7/20'],
    ['0002', '前台', '前台', '生产制作>前台', '2023/2/25'], ['0003', '小千千', '前台', '生产制作>前台', '2023/3/8'], ['0004', '小管特', '综合', '办公室>总经理', '2023/4/4'],
    ['0005', '小前', '前台', '生产制作>前台', '2023/10/17'], ['0006', '总管', '综合', '办公室>总经理', '2024/2/19'], ['0008', '小综总', '综合', '生产制作>前台', '2024/2/27'],
    ['0010', '印老板', '综合', '生产制作>前台', '2024/10/29'], ['0012', '管SIR', '综合', '生产制作>前台', '2024/3/13'], ['0015', '肖产', '生产', '生产制作>前台', '2025/3/29'],
    ['0028', '罗SIR', '综合', '生产制作>前台', '2024/12/30'], ['0808', '龙老师', '综合', '生产制作>前台', '2024/5/6'], ['0810', '李升', '综合', '生产制作>前台', '2026/8/5'],
    ['0851', 'XZ-邹SIR', '综合', '生产制作>前台', '2026/7/10'], ['5120', '轻功能', '综合', '生产制作>前台', '2024/11/21'], ['5177', '小管', '综合', '生产制作>前台', '2023/4/26'],
    ['5188', '小特s', '综合', '生产制作>前台', '2023/9/6'], ['5199', 'ceshitan', '综合', '生产制作>前台', '2024/10/28']];
  D.employees = empSeed.map(([code, name, role, dept, join], i) => {
    const j = new Date(join);
    return { code, name, role, dept, mobile: '', online: i === 0, mobileLogin: i === 0, locked: false, left: false, regular: i === 0,
      ssn: '', gender: '男', birthday: i === 0 ? new Date('2000/1/1') : j, joinDate: j, regularDate: i === 0 ? new Date('2000/01/01') : null,
      age: 2026 - (i === 0 ? 2000 : j.getFullYear()), years: 2026 - j.getFullYear(), remark: '' };
  });

  D.roles = ['综合', '前台', '生产', '财务', '后道', '设计'];
  D.depts = ['办公室>总经理', '生产制作>前台', '生产制作>设计', '生产制作>后道', '财务部>出纳'];

  /* 生产流程 */
  D.flows = [
    { code: '10', name: '排队', color: 'red' },
    { code: '20', name: '制作', color: 'blue' },
    { code: '30', name: '后道', color: 'pink' },
    { code: '40', name: '完工', color: 'green' },
  ];
  D.flowColor = (name) => (D.flows.find((f) => f.name === name) || {}).color;

  /* 经营项目：主项（大类）+ 子项（产品） */
  D.itemCategories = [
    { code: '10', name: '彩色打印★KM' }, { code: '11', name: '★零散复印★' }, { code: '12', name: '黑白打印★' }, { code: '15', name: '文本装订★' },
    { code: '20', name: '图纸输出◆' }, { code: '21', name: '图纸加工◆' }, { code: '25', name: '广告喷绘◎' }, { code: '32', name: '洗晒' },
    { code: '35', name: '标识标牌◎' }, { code: '50', name: '标准产品' }, { code: '60', name: '影像个性' }, { code: '80', name: '前期制作' },
    { code: '81', name: '后期制作' }, { code: '82', name: '特殊工艺' }, { code: '85', name: '办公用品' },
  ];
  const paper = [['普通纸，80g', 1, 2], ['铜版纸，105g', 1.5, 3], ['铜版纸，128g', 1.5, 3], ['铜版纸，157g', 1.5, 3], ['铜版纸，200g', 2, 4]];
  D.items = [];
  paper.forEach(([p, a4, a3], pi) => {
    [['A4', '单面', a4], ['A4', '双面', a4 * 2], ['A3', '单面', a3], ['A3', '双面', a3 * 2]].forEach(([size, side, price], si) => {
      D.items.push({ code: `10${pi + 1}${String(si + 1).padStart(3, '0')}`.slice(0, 6), cat: '10', name: `${p}，${size}，${side}`, unit: pi === 0 && si === 0 ? '页' : '张', tier: pi === 0 && si === 0 ? '1-10' : '-', price });
    });
  });
  const extra = [['11', '复印 A4 黑白', '张', 0.3], ['11', '复印 A3 黑白', '张', 0.6], ['12', '黑白打印 A4 单面', '张', 0.5], ['12', '黑白打印 A4 双面', '张', 1],
    ['12', '黑白打印 A3 单面', '张', 1], ['15', '胶装', '本', 10], ['15', '骑马钉', '本', 3], ['15', '铁圈装', '本', 8], ['15', '精装硬壳', '本', 45],
    ['20', 'A0 图纸 黑白', '张', 6], ['20', 'A1 图纸 黑白', '张', 4], ['20', 'A0 图纸 彩色', '张', 30], ['21', '图纸折叠', '张', 0.5], ['21', '图纸装订', '套', 15],
    ['25', '户外写真', '㎡', 35], ['25', '室内写真', '㎡', 30], ['25', '喷绘布', '㎡', 18], ['25', 'KT 板', '㎡', 45], ['32', '蓝图晒图 A0', '张', 5],
    ['35', '亚克力标牌', '块', 120], ['35', '门牌', '块', 60], ['50', '名片（盒）', '盒', 30], ['50', '易拉宝', '个', 120], ['50', 'X 展架', '个', 80],
    ['60', '证件照', '版', 25], ['60', '照片冲印 6 寸', '张', 1.5], ['80', '平面设计', '项', 200], ['80', '排版', '页', 10], ['81', '覆膜', '张', 1],
    ['81', '裁切', '刀', 0.2], ['82', 'UV 工艺', '张', 3], ['82', '烫金', '张', 5], ['85', 'A4 复印纸（包）', '包', 25], ['85', '档案袋', '个', 1]];
  const catCount = {};
  extra.forEach(([cat, name, unit, price]) => {
    catCount[cat] = (catCount[cat] || 0) + 1;
    D.items.push({ code: `${cat}${String(catCount[cat]).padStart(4, '0')}`, cat, name, unit, tier: '-', price });
  });
  D.itemCatName = (code) => (D.itemCategories.find((c) => c.code === code) || {}).name || '';

  /* 结算方式 & 资金账户 */
  D.payMethods = ['现金', '微信', '支付宝', '刷卡', '转账', '记账', '预存', '在线付款码', '抹零'];
  D.accounts = [
    { code: '1001', name: '现金', type: '现金', parent: null, balance: 307575.91 },
    { code: '1002', name: '银行存款', type: '银行', parent: null },
    { code: '1002002', name: '一般账户（XX银行）', type: '银行', parent: '1002', balance: 143440.25 },
    { code: '1002010', name: '营业现金（XX银行）', type: '银行', parent: '1002', balance: 5204.0 },
    { code: '1002030', name: '支付宝', type: '银行', parent: '1002', balance: 4958.36 },
    { code: '1002031', name: '微信', type: '银行', parent: '1002', balance: 100378.1 },
  ];
  D.incomeTypes = ['营业外收入', '废品收入', '房租收入', '其他收入'];
  D.expenseTypes = ['房租', '水电', '工资', '材料采购', '设备维修', '办公费', '其他支出'];
  D.deliveryTypes = ['', '自取', '送货', '快递', '同城跑腿'];
  D.orderTypes = ['', '普通', '加急', '返工', '样品'];
  D.tasks = ['', '黑白', '彩色', '图纸', '装订', '喷绘', 'a智能系统现场布置'];

  /* 工作单 */
  const woSeed = [
    ['GD26101910003', '000000', '', '', 6, 0, '排队', '', '2026-10-19 16:14'],
    ['GD26101410002', '1055', '', '和工单的', 61, 0, '排队', '', '2026-10-14 11:23'],
    ['GD26092210017', '1320', '', '', 6.6, 0, '排队', '', '2026-09-22 10:54'],
    ['GD26092210014', '1370', '', '', 75.5, 0, '排队', '', '2026-09-22 10:31'],
    ['GD26091810010', '1375', 'a智能系统现场布置', '1、', 1298.4, 0, '排队', '', '2026-09-18 16:28'],
    ['GD26091610009', '1350', '', 'ghdgfdgjhdf', 2.1, 2.1, '排队', '', '2026-09-16 14:55'],
    ['GD26091410008', '000000', '', '', 10, 0, '完工', '管理员', '2026-09-14 14:37'],
    ['GD26091310004', '000000', '', '', 0, 0, '完工', '轻功能', '2026-09-13 14:10'],
    ['GD26090710003', '000000', '', 'w无', 0.4, 0, '排队', '', '2026-09-07 11:30'],
    ['GD26090110001', '1350', '黑白', 'jfh', 200000.3, 0, '制作', '管理员', '2026-09-01 09:56'],
    ['GD26082210047', '1380', '黑白', '', 2000, 400, '制作', '管理员', '2026-08-22 17:18', '自取', '普通'],
    ['GD26082210046', '1385', '黑白', '', 200, 0, '排队', '', '2026-08-22 17:07'],
    ['GD26082210045', '1350', '黑白', 'jfh', 200000.3, 0, '完工', '管理员', '2026-08-22 17:01'],
    ['GD26082210044', '1350', '', 'hfhf', 6.6, 6.6, '制作', '总管', '2026-08-22 16:56'],
    ['GD26081410043', '000000', '', '', 150, 0, '排队', '', '2026-08-14 14:04'],
    ['GD26081410042', '000000', '', '', 150, 0, '排队', '', '2026-08-14 14:04'],
    ['GD26081410038', '000000', '', '', 150, 0, '排队', '', '2026-08-14 12:17'],
    ['GD26081410037', '000000', '', '', 360, 0, '排队', '', '2026-08-14 12:10'],
    ['GD26081410036', '000000', '', '', 60, 0, '排队', '', '2026-08-14 12:09'],
    ['GD26081410035', '000000', '', '', 35, 0, '排队', '', '2026-08-14 11:57'],
    ['GD26081410032', '000000', '', '', 10, 0, '排队', '', '2026-08-14 10:47'],
    ['GD26081410031', '000000', '', '', 150, 0, '排队', '', '2026-08-14 09:50'],
  ];
  D.workOrders = woSeed.map(([no, cc, task, req, amount, paid, flow, handler, time, delivery, otype]) => {
    const c = D.customer(cc);
    const lines = [];
    let left = amount;
    const n = amount > 0 ? 1 + Math.floor(rnd() * 3) : 0;
    for (let i = 0; i < n; i++) {
      const it = pick(D.items);
      const sub = i === n - 1 ? r2(left) : r2(left * (0.3 + rnd() * 0.4));
      left = r2(left - sub);
      const qty = Math.max(1, Math.round(sub / it.price)) || 1;
      lines.push({ code: it.code, cat: it.cat, catName: D.itemCatName(it.cat), name: it.name, unit: it.unit, listPrice: it.price,
        price: r2(sub / qty), discount: 10, qty, copies: 1, amount: sub, remark: '' });
    }
    return {
      no, custCode: cc, custName: c.name, group: c.groupName, contact: cc === '000000' ? '3' : c.contact, phone: cc === '000000' ? '233' : c.phone, address: '',
      task, req, delivery: delivery || '', orderType: otype || '', amount, paid, unpaid: r2(amount - paid),
      settleStatus: amount === 0 ? '0元空单' : paid === 0 ? '尚未结算' : paid >= amount ? '完成结算' : '部分结算',
      flow, handler, created: new Date(time.replace(' ', 'T')), due: null, receptionist: '管理员', keepFile: false,
      audited: paid > 0 || flow === '完工', file: '', remark: '', lines,
    };
  });

  /* 结算单（收款记录） */
  D.settlements = [];
  D.workOrders.filter((w) => w.paid > 0).forEach((w, i) => {
    D.settlements.push({ no: 'JS' + w.no.slice(2, 10) + String(i + 1).padStart(3, '0'), date: w.created, custCode: w.custCode, custName: w.custName,
      handler: '管理员', method: pick(['现金', '微信', '支付宝']), amount: w.paid, discount: 0, wipe: 0, orderNo: w.no, audited: true, invoice: false, remark: '' });
  });
  for (let i = 0; i < 16; i++) {
    const c = pick(D.customers.slice(1, 20));
    const amt = r2(rnd() * 2400 + 3);
    D.settlements.push({ no: 'JS2608' + String(1000 + i * 7), date: new Date(2026, 1 + Math.floor(rnd() * 8), 1 + Math.floor(rnd() * 27), 9 + Math.floor(rnd() * 8)),
      custCode: c.code, custName: c.name, handler: pick(['管理员', '总管', '前台']), method: pick(D.payMethods.slice(0, 6)), amount: amt, discount: 0,
      wipe: rnd() > 0.8 ? 0.12 : 0, orderNo: '', audited: rnd() > 0.2, invoice: rnd() > 0.6, remark: '' });
  }

  /* 预存/储值记录、IC 卡 */
  D.cards = D.customers.filter((c) => c.prestoreBalance > 0).map((c, i) => ({
    cardNo: 'IC' + String(880001 + i), custCode: c.code, custName: c.name, group: c.groupName, issueDate: c.created, issuer: '管理员',
    balance: c.prestoreBalance, totalIn: r2(c.prestoreBalance * 1.6), totalOut: r2(c.prestoreBalance * 0.6), status: '正常', password: true, remark: '' }));
  D.prestores = D.cards.flatMap((k, i) => [
    { no: 'YC26' + String(5001 + i * 2), date: k.issueDate, custCode: k.custCode, custName: k.custName, cardNo: k.cardNo, type: '储值', amount: k.totalIn, gift: r2(k.totalIn * 0.05), method: pick(['现金', '微信', '转账']), handler: '管理员', audited: true, remark: '' },
  ]);
  D.miscIncomes = Array.from({ length: 8 }, (_, i) => ({
    no: 'LS2610' + String(100 + i), date: new Date(2026, 9, 1 + i * 2, 10 + i), item: pick(['复印', '打印', '扫描', '证件照', '装订']), qty: 1 + Math.floor(rnd() * 20),
    amount: r2(rnd() * 80 + 2), method: pick(['现金', '微信', '支付宝']), handler: pick(['前台', '管理员']), remark: '' }));

  /* 一般收支、转账 */
  D.cashJournal = Array.from({ length: 12 }, (_, i) => {
    const inc = rnd() > 0.5;
    return { no: (inc ? 'SR' : 'ZC') + '2610' + String(10 + i), date: new Date(2026, 8 + (i % 2), 1 + i * 2), kind: inc ? '一般收入' : '一般支出',
      type: inc ? pick(D.incomeTypes) : pick(D.expenseTypes), account: pick(D.accounts.filter((a) => a.balance != null)).name,
      amount: r2(rnd() * 3000 + 50), handler: '管理员', audited: rnd() > 0.3, remark: '' };
  });
})();
