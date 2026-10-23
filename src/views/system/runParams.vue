<template>
  <div class="erp-content">
    <div class="erp-pagehead">
      <div class="erp-pagehead-info">
        <p class="erp-breadcrumb">业务 / LiteERP / 系统</p>
        <h1>运行参数</h1>
        <p class="erp-pagehead-desc">系统运行时的业务参数，保存后对全部门店与员工生效。</p>
      </div>
      <div class="erp-pagehead-actions">
        <el-button @click="resetDefaults">恢复默认值</el-button>
        <el-button type="primary" @click="saveParams">保存参数</el-button>
      </div>
    </div>

    <!-- 分组快速跳转 -->
    <div class="erp-panel" style="margin-bottom: 16px">
      <div class="param-nav">
        <span class="param-nav-label">跳到：</span>
        <el-button v-for="g in paramGroups" :key="g" link type="primary" @click="scrollToGroup(g)">{{ g }}</el-button>
      </div>
    </div>

    <div class="erp-panel">
      <div class="erp-panelhead"><h2>参数设置</h2><span class="erp-panelhead-note">{{ totalParamCount }} 项参数，按业务分组</span></div>
      <div class="param-body">
        <div v-for="group in paramGroups" :key="group" :ref="(el) => setGroupRef(group, el as HTMLElement)" class="param-group">
          <div v-for="section in getSections(group)" :key="section" class="param-section">
            <h3 class="param-section-title">{{ group }} · {{ section }}</h3>
            <el-form label-width="200px" size="default">
              <template v-for="item in getItems(group, section)" :key="item.key">
                <el-form-item v-if="item.type === 'check'" :label="item.label">
                  <el-checkbox v-model="params[item.key]">{{ item.label }}</el-checkbox>
                </el-form-item>
                <el-form-item v-else-if="item.type === 'select'" :label="item.label" :required="item.required">
                  <el-select v-model="params[item.key]" style="width: 240px">
                    <el-option v-for="opt in item.options" :key="opt" :label="opt" :value="opt" />
                  </el-select>
                </el-form-item>
                <el-form-item v-else-if="item.type === 'number'" :label="item.label" :required="item.required">
                  <el-input v-model="params[item.key]" type="number" :placeholder="item.placeholder || ''" style="width: 200px" />
                  <span v-if="item.help" class="param-help">{{ item.help }}</span>
                </el-form-item>
                <el-form-item v-else :label="item.label" :required="item.required">
                  <el-input v-model="params[item.key]" :placeholder="item.placeholder || ''" style="width: 300px" />
                  <span v-if="item.help" class="param-help">{{ item.help }}</span>
                </el-form-item>
              </template>
            </el-form>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';

interface ParamItem {
  key: string; label: string; type: 'text' | 'number' | 'check' | 'select'; defaultVal: any;
  options?: string[]; required?: boolean; placeholder?: string; help?: string;
}
interface ParamSection { title: string; items: ParamItem[]; }
interface ParamGroup { name: string; sections: ParamSection[]; }

const paramGroups = ref<string[]>([]);
const groupRefs = ref<Record<string, HTMLElement>>({});
const sectionsMap = ref<Record<string, ParamSection[]>>({});
const itemsMap = ref<Record<string, Record<string, ParamItem[]>>>({});
const params = reactive<Record<string, any>>({});
const totalParamCount = ref(0);

const setGroupRef = (name: string, el: HTMLElement | null) => { if (el) groupRefs.value[name] = el; };
const scrollToGroup = (name: string) => { groupRefs.value[name]?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
const getSections = (group: string) => (sectionsMap.value[group] || []).map(s => s.title);
const getItems = (group: string, section: string) => {
  const sec = (sectionsMap.value[group] || []).find(s => s.title === section);
  return sec?.items || [];
};

const resetDefaults = () => {
  ElMessageBox.confirm('把全部运行参数恢复为默认值？只改页面上的值，点"保存参数"后才生效。', '恢复默认值', { type: 'warning' })
    .then(() => {
      Object.values(itemsMap.value).flat().forEach(sec => {
        sec.items.forEach(item => { params[item.key] = item.defaultVal; });
      });
      ElMessage.success('已恢复默认值，保存后生效');
    })
    .catch(() => {});
};

const saveParams = () => {
  ElMessage.success(`运行参数已保存：${new Date().toLocaleString('zh-CN')}`);
};

onMounted(() => {
  const defs: ParamGroup[] = [
    { name: '基础', sections: [
      { title: '企业信息', items: [
        { key: 'company', label: '企业名称', type: 'text', defaultVal: '图片色彩', required: true },
        { key: 'branch', label: '门店名称', type: 'text', defaultVal: '0 - 本店' },
        { key: 'tel', label: '联系电话', type: 'text', defaultVal: '0731-88888888' },
        { key: 'addr', label: '地址', type: 'text', defaultVal: '长沙市岳麓区麓山南路 1 号' },
      ] },
      { title: '编号规则', items: [
        { key: 'woPrefix', label: '工作单前缀', type: 'text', defaultVal: 'GD', required: true },
        { key: 'jsPrefix', label: '结算单前缀', type: 'text', defaultVal: 'JS', required: true },
        { key: 'noDigits', label: '流水号位数', type: 'number', defaultVal: 5 },
        { key: 'custCodeAuto', label: '客户编号自动生成', type: 'check', defaultVal: true },
      ] },
    ] },
    { name: '前台', sections: [
      { title: '开单', items: [
        { key: 'defaultCust', label: '默认客户', type: 'text', defaultVal: '000000/散户' },
        { key: 'mustTask', label: '开单必须填写制作任务', type: 'check', defaultVal: false },
        { key: 'mustDue', label: '开单必须填写交付日期', type: 'check', defaultVal: false },
        { key: 'autoPrint', label: '保存后自动打印工单', type: 'check', defaultVal: false },
        { key: 'showDebt', label: '开单时提示客户应收结余', type: 'check', defaultVal: true },
        { key: 'priceEdit', label: '允许修改实价', type: 'check', defaultVal: true },
      ] },
      { title: '金额', items: [
        { key: 'moneyDigits', label: '金额小数位数', type: 'select', defaultVal: '2', options: ['0', '1', '2'] },
        { key: 'priceDigits', label: '单价小数位数', type: 'select', defaultVal: '4', options: ['2', '3', '4'] },
        { key: 'wipe', label: '抹零方式', type: 'select', defaultVal: '不抹零', options: ['不抹零', '抹角', '抹分', '四舍五入到元'] },
      ] },
    ] },
    { name: '结算', sections: [
      { title: '收款', items: [
        { key: 'defMethod', label: '默认结算方式', type: 'select', defaultVal: '现金', options: ['现金', '微信', '支付宝', '银行卡', '记账'] },
        { key: 'defAccount', label: '默认入账科目', type: 'select', defaultVal: '现金 > 前台钱箱', options: ['现金 > 前台钱箱', '银行存款 > 工商银行', '银行存款 > 微信', '银行存款 > 支付宝'] },
        { key: 'autoAudit', label: '收款后自动审核结算单', type: 'check', defaultVal: true },
        { key: 'allowCredit', label: '允许记账（挂账）', type: 'check', defaultVal: true },
        { key: 'creditLimit', label: '默认信用额度（元）', type: 'number', defaultVal: 0 },
      ] },
      { title: '在线支付', items: [
        { key: 'payWx', label: '启用微信支付', type: 'check', defaultVal: true },
        { key: 'payAli', label: '启用支付宝支付', type: 'check', defaultVal: true },
        { key: 'payExpire', label: '收款码有效期（分钟）', type: 'number', defaultVal: 30 },
      ] },
    ] },
    { name: '预存', sections: [
      { title: '会员卡', items: [
        { key: 'cardPwd', label: '刷卡结算需要密码', type: 'check', defaultVal: true },
        { key: 'cardGift', label: '储值赠送比例（%）', type: 'number', defaultVal: 5 },
        { key: 'cardLowWarn', label: '余额低于此值提醒（元）', type: 'number', defaultVal: 100 },
        { key: 'cardReader', label: '读卡器型号', type: 'select', defaultVal: 'URF-R330', options: ['URF-R330', 'MW-D8', '无'] },
      ] },
    ] },
    { name: '生产', sections: [
      { title: '流程', items: [
        { key: 'autoQueue', label: '新建工单自动进入第一个流程', type: 'check', defaultVal: true },
        { key: 'doneAudit', label: '完工时自动审核工单', type: 'check', defaultVal: false },
        { key: 'warnDays', label: '交付预警提前天数', type: 'number', defaultVal: 1 },
        { key: 'keepFileDays', label: '客户文件保留天数', type: 'number', defaultVal: 30 },
        { key: 'fileRoot', label: '客户文件根目录', type: 'text', defaultVal: 'D:\\客户文件' },
      ] },
    ] },
    { name: '财务', sections: [
      { title: '会计期间', items: [
        { key: 'period', label: '当前会计期间', type: 'text', defaultVal: '2026年10月', required: true },
        { key: 'closeDay', label: '每月结账日', type: 'number', defaultVal: 25 },
        { key: 'lockAfterClose', label: '结账后禁止修改本期单据', type: 'check', defaultVal: true },
      ] },
    ] },
    { name: '打印', sections: [
      { title: '打印机', items: [
        { key: 'ticketPrinter', label: '小票打印机', type: 'select', defaultVal: 'POS-80', options: ['POS-80', 'XP-58', 'Microsoft Print to PDF'] },
        { key: 'a4Printer', label: 'A4 打印机', type: 'select', defaultVal: 'HP LaserJet', options: ['HP LaserJet', 'Canon iR', 'Microsoft Print to PDF'] },
        { key: 'preview', label: '打印前预览', type: 'check', defaultVal: true },
        { key: 'copies', label: '默认打印份数', type: 'number', defaultVal: 1 },
      ] },
    ] },
    { name: '安全', sections: [
      { title: '登录', items: [
        { key: 'pwdLen', label: '密码最小长度', type: 'number', defaultVal: 6 },
        { key: 'lockTimes', label: '连续输错锁定次数', type: 'number', defaultVal: 5 },
        { key: 'idleLock', label: '空闲自动锁屏（分钟，0 为不锁）', type: 'number', defaultVal: 0 },
        { key: 'mobileLogin', label: '允许移动端登录', type: 'check', defaultVal: true },
      ] },
      { title: '备份', items: [
        { key: 'autoBackup', label: '每日自动备份数据库', type: 'check', defaultVal: true },
        { key: 'backupTime', label: '备份时间', type: 'text', defaultVal: '23:30', placeholder: '24 小时制，如 23:30' },
        { key: 'backupKeep', label: '备份保留份数', type: 'number', defaultVal: 7 },
      ] },
    ] },
  ];

  paramGroups.value = defs.map(d => d.name);
  let count = 0;
  defs.forEach(g => {
    sectionsMap.value[g.name] = g.sections;
    itemsMap.value[g.name] = {};
    g.sections.forEach(s => {
      itemsMap.value[g.name][s.title] = s.items;
      s.items.forEach(item => {
        params[item.key] = item.defaultVal;
        count++;
      });
    });
  });
  totalParamCount.value = count;
});
</script>

<style scoped lang="scss">
.param-nav { display: flex; align-items: center; gap: 4px; padding: 8px 16px; flex-wrap: wrap; }
.param-nav-label { font-size: 13px; color: var(--erp-text-soft); }
.param-body { padding: 0 16px 16px; }
.param-group { margin-bottom: 8px; }
.param-section-title { font-size: 15px; font-weight: 600; margin: 16px 0 8px; padding: 8px 0; border-bottom: 1px solid var(--erp-line); }
.param-help { font-size: 12px; color: var(--erp-text-soft); margin-left: 8px; }
</style>
