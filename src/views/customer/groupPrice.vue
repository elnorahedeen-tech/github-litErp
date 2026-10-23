<template>
  <div class="erp-content">
    <div class="erp-pagehead">
      <div class="erp-pagehead-info">
        <p class="erp-breadcrumb">业务 / LiteERP / 客户</p>
        <h1>分组价格</h1>
        <p class="erp-pagehead-desc">为客户分组设定统一价格。开单取价顺序：客户协议价格 → 分组价格 → 标准单价 × 分组折扣。</p>
      </div>
      <div class="erp-pagehead-actions">
        <el-button @click="handleExport">导出</el-button>
      </div>
    </div>

    <div class="erp-toolbar">
      <div class="erp-toolbar-item">
        <label>客户分组</label>
        <el-select v-model="currentGroup" style="width: 200px" @change="loadData">
          <el-option v-for="g in groupOptions" :key="g.code" :label="`${g.code} ${g.name}（折扣 ${g.discount}%）`" :value="g.code" />
        </el-select>
      </div>
      <div class="erp-toolbar-item">
        <label>经营主项</label>
        <el-select v-model="filterCat" clearable placeholder="全部主项" style="width: 160px">
          <el-option v-for="c in catOptions" :key="c" :label="c" :value="c" />
        </el-select>
      </div>
      <div class="erp-toolbar-item">
        <label>搜索项目</label>
        <el-input v-model="filterQ" placeholder="项目编号 / 名称" clearable style="width: 180px" />
      </div>
      <div class="erp-toolbar-actions">
        <el-button @click="generateByDiscount">按分组折扣生成</el-button>
        <el-button type="primary" @click="savePrices" :disabled="!hasChanges">保存分组价格</el-button>
        <el-button @click="discardChanges" :disabled="!hasChanges">撤销修改</el-button>
      </div>
    </div>

    <div v-if="hasChanges" class="erp-notice">
      <span>有 {{ changedCount }} 项未保存的修改。</span>
    </div>

    <div class="erp-panel">
      <div class="erp-panelhead">
        <h2>{{ currentGroupName }}</h2>
        <span class="erp-panelhead-note">已设分组价格 {{ setCount }} 项 · 价格单位：元</span>
      </div>
      <div class="erp-table-wrap">
        <el-table :data="filteredItems" v-loading="loading" stripe style="width: 100%">
          <el-table-column prop="code" label="项目编号" width="120">
            <template #default="{ row }"><span class="mono-text">{{ row.code }}</span></template>
          </el-table-column>
          <el-table-column prop="name" label="经营子项" min-width="200">
            <template #default="{ row }">
              {{ row.name }}
              <div class="sub-text">{{ row.cat }} · {{ row.unit }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="cat" label="经营主项" width="120" />
          <el-table-column prop="unit" label="单位" width="70" align="center" />
          <el-table-column prop="tier" label="定价量级" width="100" align="center" />
          <el-table-column prop="price" label="标准单价（元）" width="130" align="right">
            <template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.price) }}</span></template>
          </el-table-column>
          <el-table-column label="分组价格（元）" width="150" align="right">
            <template #default="{ row }">
              <el-input v-model="row.groupPrice" size="small" style="width: 110px" @input="onPriceChange(row)" />
            </template>
          </el-table-column>
          <el-table-column label="折扣（%）" width="120" align="right">
            <template #default="{ row }">
              <el-input v-model="row.discount" size="small" style="width: 84px" @change="onDiscountChange(row)" />
            </template>
          </el-table-column>
          <el-table-column label="差价（元）" width="110" align="right">
            <template #default="{ row }">
              <span class="mono-cell">{{ row.groupPrice ? fmtMoney(Number(row.price) - Number(row.groupPrice || 0)) : '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100" align="center">
            <template #default="{ row }">
              <span v-if="row.changed" class="erp-badge" data-tone="warning">未保存</span>
              <span v-else-if="row.groupPrice" class="erp-badge" data-tone="success">已设置</span>
              <span v-else class="erp-badge" data-tone="info">按折扣</span>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <div class="erp-pagination" style="padding: 12px 16px">
        <span>共 {{ filteredItems.length }} 项</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';

const loading = ref(false);
const currentGroup = ref('10');
const filterCat = ref('');
const filterQ = ref('');
const items = ref<any[]>([]);

const groupOptions = [
  { code: '10', name: '普通客户', discount: 100 },
  { code: '20', name: 'VIP客户', discount: 90 },
  { code: '30', name: '预存客户', discount: 95 },
  { code: '40', name: '协议客户', discount: 85 },
];
const catOptions = ['印刷', '设计', '制作', '安装', '其他'];

const currentGroupName = computed(() => {
  const g = groupOptions.find(x => x.code === currentGroup.value);
  return g ? `${g.code} ${g.name}` : '';
});

const fmtMoney = (v: any) => '￥' + Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const filteredItems = computed(() => {
  let data = items.value;
  if (filterCat.value) data = data.filter(r => r.cat === filterCat.value);
  if (filterQ.value) {
    const q = filterQ.value.toLowerCase();
    data = data.filter(r => (r.code + r.name).toLowerCase().includes(q));
  }
  return data;
});

const hasChanges = computed(() => items.value.some(r => r.changed));
const changedCount = computed(() => items.value.filter(r => r.changed).length);
const setCount = computed(() => items.value.filter(r => r.groupPrice && !r.changed).length);

const onPriceChange = (row: any) => {
  const p = Number(row.groupPrice);
  row.discount = p > 0 && row.price > 0 ? String(Math.round((p / Number(row.price)) * 10000) / 100) : '';
  row.changed = row.groupPrice !== row.originalPrice;
};

const onDiscountChange = (row: any) => {
  const d = Number(row.discount);
  if (d > 0) {
    row.groupPrice = String(Math.round((Number(row.price) * d) / 100 * 100) / 100);
  } else {
    row.groupPrice = '';
  }
  row.changed = row.groupPrice !== row.originalPrice;
};

const generateByDiscount = () => {
  const g = groupOptions.find(x => x.code === currentGroup.value);
  if (!g || g.discount >= 100) {
    ElMessage.warning('该分组折扣为 100%，没有可生成的折扣价。');
    return;
  }
  filteredItems.value.forEach(row => {
    const p = Math.round((Number(row.price) * g.discount) / 100 * 100) / 100;
    row.groupPrice = String(p);
    row.discount = String(g.discount);
    row.changed = row.groupPrice !== row.originalPrice;
  });
  ElMessage.success(`已按 ${g.discount}% 折扣生成价格，请检查后保存。`);
};

const savePrices = () => {
  items.value.forEach(row => {
    row.originalPrice = row.groupPrice;
    row.changed = false;
  });
  ElMessage.success('分组价格已保存。');
};

const discardChanges = () => {
  items.value.forEach(row => {
    row.groupPrice = row.originalPrice;
    row.changed = false;
    const p = Number(row.groupPrice);
    row.discount = p > 0 && row.price > 0 ? String(Math.round((p / Number(row.price)) * 10000) / 100) : '';
  });
  ElMessage.info('已撤销未保存的修改。');
};

const handleExport = () => { ElMessage.info(`导出分组价格-${currentGroupName.value} CSV`); };

const loadData = () => {
  loading.value = true;
  setTimeout(() => {
    const g = groupOptions.find(x => x.code === currentGroup.value);
    const disc = g ? g.discount / 100 : 1;
    items.value = [
      { code: 'Y001', name: '彩色名片', cat: '印刷', unit: '盒', tier: '1-99', price: 35, groupPrice: disc < 1 ? String(Math.round(35 * disc * 100) / 100) : '', discount: disc < 1 ? String(g!.discount) : '', originalPrice: disc < 1 ? String(Math.round(35 * disc * 100) / 100) : '', changed: false },
      { code: 'Y002', name: '传单A4', cat: '印刷', unit: '张', tier: '100+', price: 0.5, groupPrice: disc < 1 ? String(Math.round(0.5 * disc * 100) / 100) : '', discount: disc < 1 ? String(g!.discount) : '', originalPrice: disc < 1 ? String(Math.round(0.5 * disc * 100) / 100) : '', changed: false },
      { code: 'Y003', name: '画册设计', cat: '设计', unit: '页', tier: '-', price: 200, groupPrice: disc < 1 ? String(Math.round(200 * disc * 100) / 100) : '', discount: disc < 1 ? String(g!.discount) : '', originalPrice: disc < 1 ? String(Math.round(200 * disc * 100) / 100) : '', changed: false },
      { code: 'Y004', name: '易拉宝', cat: '制作', unit: '个', tier: '-', price: 120, groupPrice: disc < 1 ? String(Math.round(120 * disc * 100) / 100) : '', discount: disc < 1 ? String(g!.discount) : '', originalPrice: disc < 1 ? String(Math.round(120 * disc * 100) / 100) : '', changed: false },
      { code: 'Y005', name: '展架租赁', cat: '其他', unit: '天', tier: '-', price: 50, groupPrice: '', discount: '', originalPrice: '', changed: false },
      { code: 'Y006', name: '不干胶标签', cat: '印刷', unit: '张', tier: '500+', price: 0.3, groupPrice: disc < 1 ? String(Math.round(0.3 * disc * 100) / 100) : '', discount: disc < 1 ? String(g!.discount) : '', originalPrice: disc < 1 ? String(Math.round(0.3 * disc * 100) / 100) : '', changed: false },
      { code: 'Y007', name: '安装服务', cat: '安装', unit: '次', tier: '-', price: 150, groupPrice: '', discount: '', originalPrice: '', changed: false },
      { code: 'Y008', name: 'Logo设计', cat: '设计', unit: '套', tier: '-', price: 1500, groupPrice: disc < 1 ? String(Math.round(1500 * disc * 100) / 100) : '', discount: disc < 1 ? String(g!.discount) : '', originalPrice: disc < 1 ? String(Math.round(1500 * disc * 100) / 100) : '', changed: false },
    ];
    loading.value = false;
  }, 200);
};

onMounted(() => loadData());
</script>

<style scoped lang="scss">
.erp-notice {
  display: flex;
  align-items: center;
  gap: var(--erp-space-3);
  padding: var(--erp-space-2) var(--erp-space-4);
  margin-bottom: var(--erp-space-3);
  background: #fffbe6;
  border: 1px solid #ffe58f;
  border-radius: 4px;
  font-size: var(--erp-table-size);
}
.mono-text { font-family: var(--erp-font-mono); font-variant-numeric: tabular-nums; }
</style>
