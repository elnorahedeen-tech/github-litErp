<template>
  <div class="erp-content">
    <div class="erp-pagehead">
      <div class="erp-pagehead-info">
        <p class="erp-breadcrumb">业务 / LiteERP / 客户</p>
        <h1>协议价格</h1>
        <p class="erp-pagehead-desc">客户专属单价，开单时优先于分组价格和标准单价。先选择协议客户，再添加经营项目。</p>
      </div>
      <div class="erp-pagehead-actions">
        <el-button @click="router.push('/customer/custMerge')">价格复制</el-button>
      </div>
    </div>

    <div class="erp-panel">
      <div class="erp-panelhead"><h2>协议客户</h2></div>
      <div class="erp-panelbody">
        <div class="erp-toolbar" style="padding: 0; border: none;">
          <div class="erp-toolbar-item">
            <label>选择客户</label>
            <el-select v-model="selectedCust" clearable placeholder="全部客户" filterable style="width: 300px" @change="loadData">
              <el-option v-for="c in custOptions" :key="c.code" :label="`${c.code} ${c.name}（${c.count} 条）`" :value="c.code" />
            </el-select>
          </div>
        </div>
        <div v-if="selectedCustInfo" class="cust-info-bar">
          <span>客户：{{ selectedCustInfo.code }} {{ selectedCustInfo.name }}</span>
          <span>分组：{{ selectedCustInfo.groupName }}</span>
          <span>协议项目：{{ selectedCustInfo.count }} 条</span>
        </div>
      </div>
    </div>

    <div class="erp-toolbar">
      <div class="erp-toolbar-item">
        <label>搜索项目</label>
        <el-input v-model="search.q" placeholder="项目编号 / 名称 / 备注" clearable style="width: 220px" />
      </div>
      <div class="erp-toolbar-item">
        <label>经营主项</label>
        <el-select v-model="search.cat" clearable placeholder="全部" style="width: 140px">
          <el-option v-for="c in catOptions" :key="c" :label="c" :value="c" />
        </el-select>
      </div>
      <div class="erp-toolbar-item">
        <label>负责人员</label>
        <el-select v-model="search.owner" clearable placeholder="全部" style="width: 120px">
          <el-option v-for="o in ownerOptions" :key="o" :label="o" :value="o" />
        </el-select>
      </div>
      <div class="erp-toolbar-actions">
        <el-button type="primary" :disabled="!selectedCust" @click="addDialogVisible = true">添加协议项目</el-button>
        <el-button @click="handleExport">导出</el-button>
      </div>
    </div>

    <div class="erp-panel">
      <div class="erp-table-wrap">
        <el-table :data="filteredData" v-loading="loading" stripe style="width: 100%">
          <el-table-column v-if="!selectedCust" prop="custName" label="协议客户" min-width="180">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="router.push(`/customer/detail?code=${row.custCode}`)">{{ row.custName }}</el-button>
              <div class="sub-text">{{ row.custCode }} · {{ row.groupName }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="itemCode" label="项目编号" width="100">
            <template #default="{ row }"><span class="mono-text">{{ row.itemCode }}</span></template>
          </el-table-column>
          <el-table-column prop="itemName" label="经营子项" min-width="180">
            <template #default="{ row }">
              {{ row.itemName }}
              <div class="sub-text">{{ row.catName }} · {{ row.unit }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="tier" label="定价量级" width="90" align="center" />
          <el-table-column prop="listPrice" label="标准单价（元）" width="120" align="right">
            <template #default="{ row }"><span class="mono-cell">{{ fmtMoney(row.listPrice) }}</span></template>
          </el-table-column>
          <el-table-column prop="price" label="协议价格（元）" width="120" align="right">
            <template #default="{ row }">
              <span class="mono-cell">{{ fmtMoney(row.price) }}</span>
              <div v-if="row.price < row.listPrice" class="sub-text text-success">低于标价 {{ fmtMoney(row.listPrice - row.price) }}</div>
              <div v-else-if="row.price > row.listPrice" class="sub-text text-danger">高于标价</div>
            </template>
          </el-table-column>
          <el-table-column prop="start" label="开始日期" width="110" />
          <el-table-column prop="owner" label="负责人员" width="90" />
          <el-table-column prop="remark" label="备注" min-width="100" :show-overflow-tooltip="true" />
          <el-table-column label="操作" width="120" fixed="right">
            <template #default="{ row }">
              <div class="table-actions">
                <el-button link type="primary" size="small" @click="editPrice(row)">改价</el-button>
                <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <div class="erp-pagination" style="padding: 12px 16px">
        <span>共 {{ filteredData.length }} 条记录</span>
      </div>
    </div>

    <!-- 添加协议项目对话框 -->
    <el-dialog v-model="addDialogVisible" title="添加协议项目" width="480px">
      <div class="dialog-form">
        <div class="dialog-form-row">
          <label>经营项目</label>
          <el-select v-model="newItem" filterable placeholder="请选择经营项目" style="width: 100%">
            <el-option v-for="it in availableItems" :key="it.code" :label="`${it.code} ${it.name}（${fmtMoney(it.price)}）`" :value="it.code" />
          </el-select>
        </div>
        <div class="dialog-form-row">
          <label>协议价格（元）</label>
          <el-input v-model="newPrice" placeholder="0.00" style="width: 200px" />
        </div>
        <div class="dialog-form-row">
          <label>开始日期</label>
          <el-date-picker v-model="newStart" type="date" placeholder="选择日期" value-format="YYYY-MM-DD" style="width: 200px" />
        </div>
        <div class="dialog-form-row">
          <label>备注</label>
          <el-input v-model="newRemark" placeholder="可选" style="width: 100%" />
        </div>
      </div>
      <template #footer>
        <el-button @click="addDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleAdd">确认添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';

const router = useRouter();
const loading = ref(false);
const selectedCust = ref('');
const tableData = ref<any[]>([]);
const addDialogVisible = ref(false);
const newItem = ref('');
const newPrice = ref('');
const newStart = ref('');
const newRemark = ref('');

const search = reactive({ q: '', cat: '', owner: '' });

const custOptions = [
  { code: '100001', name: '世纪出版社', groupName: 'VIP客户', count: 3 },
  { code: '100003', name: '万科地产', groupName: '协议客户', count: 5 },
  { code: '100004', name: '华为技术', groupName: '协议客户', count: 2 },
  { code: '100007', name: '格式广告', groupName: '预存客户', count: 1 },
];

const catOptions = ['印刷', '设计', '制作', '安装', '其他'];
const ownerOptions = ['管理员', '总管'];

const availableItems = [
  { code: 'Y001', name: '彩色名片', price: 35, cat: '印刷', unit: '盒', tier: '1-99' },
  { code: 'Y002', name: '传单A4', price: 0.5, cat: '印刷', unit: '张', tier: '100+' },
  { code: 'Y003', name: '画册设计', price: 200, cat: '设计', unit: '页', tier: '-' },
  { code: 'Y004', name: '易拉宝', price: 120, cat: '制作', unit: '个', tier: '-' },
  { code: 'Y005', name: '不干胶标签', price: 0.3, cat: '印刷', unit: '张', tier: '500+' },
  { code: 'Y008', name: 'Logo设计', price: 1500, cat: '设计', unit: '套', tier: '-' },
];

const selectedCustInfo = computed(() => custOptions.find(c => c.code === selectedCust.value) || null);

const filteredData = computed(() => {
  let data = tableData.value;
  if (search.q) {
    const q = search.q.toLowerCase();
    data = data.filter(r => (r.itemCode + r.itemName + r.remark).toLowerCase().includes(q));
  }
  if (search.cat) data = data.filter(r => r.cat === search.cat);
  if (search.owner) data = data.filter(r => r.owner === search.owner);
  return data;
});

const fmtMoney = (v: any) => '￥' + Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const editPrice = (row: any) => {
  ElMessageBox.prompt('请输入新的协议价格', '改价', { inputValue: String(row.price), confirmButtonText: '确认' })
    .then(({ value }) => { row.price = Number(value); ElMessage.success('协议价格已更新'); })
    .catch(() => {});
};

const handleDelete = (row: any) => {
  ElMessageBox.confirm(`删除协议价格「${row.itemName}」？删除后按分组价格或标准单价开单。`, '提示', { type: 'warning' })
    .then(() => { tableData.value = tableData.value.filter(r => r !== row); ElMessage.success('删除成功'); })
    .catch(() => {});
};

const handleAdd = () => {
  if (!newItem.value || !newPrice.value) { ElMessage.warning('请填写经营项目和协议价格'); return; }
  const it = availableItems.find(x => x.code === newItem.value);
  if (!it) return;
  tableData.value.unshift({
    custCode: selectedCust.value,
    custName: selectedCustInfo.value?.name || '',
    groupName: selectedCustInfo.value?.groupName || '',
    itemCode: it.code,
    itemName: it.name,
    cat: it.cat,
    catName: it.cat,
    unit: it.unit,
    tier: it.tier,
    listPrice: it.price,
    price: Number(newPrice.value),
    start: newStart.value || new Date().toISOString().slice(0, 10),
    owner: '管理员',
    remark: newRemark.value,
  });
  addDialogVisible.value = false;
  newItem.value = ''; newPrice.value = ''; newStart.value = ''; newRemark.value = '';
  ElMessage.success('协议项目已添加');
};

const handleExport = () => { ElMessage.info('导出协议价格 CSV'); };

const loadData = () => {
  loading.value = true;
  setTimeout(() => {
    tableData.value = [
      { custCode: '100001', custName: '世纪出版社', groupName: 'VIP客户', itemCode: 'Y001', itemName: '彩色名片', cat: '印刷', catName: '印刷', unit: '盒', tier: '1-99', listPrice: 35, price: 28, start: '2026-01-01', owner: '管理员', remark: '年度协议' },
      { custCode: '100001', custName: '世纪出版社', groupName: 'VIP客户', itemCode: 'Y003', itemName: '画册设计', cat: '设计', catName: '设计', unit: '页', tier: '-', listPrice: 200, price: 160, start: '2026-01-01', owner: '管理员', remark: '' },
      { custCode: '100001', custName: '世纪出版社', groupName: 'VIP客户', itemCode: 'Y008', itemName: 'Logo设计', cat: '设计', catName: '设计', unit: '套', tier: '-', listPrice: 1500, price: 1200, start: '2026-03-01', owner: '总管', remark: '年度协议' },
      { custCode: '100003', custName: '万科地产', groupName: '协议客户', itemCode: 'Y001', itemName: '彩色名片', cat: '印刷', catName: '印刷', unit: '盒', tier: '1-99', listPrice: 35, price: 24.5, start: '2025-06-01', owner: '管理员', remark: '长期协议' },
      { custCode: '100003', custName: '万科地产', groupName: '协议客户', itemCode: 'Y002', itemName: '传单A4', cat: '印刷', catName: '印刷', unit: '张', tier: '100+', listPrice: 0.5, price: 0.35, start: '2025-06-01', owner: '管理员', remark: '' },
      { custCode: '100003', custName: '万科地产', groupName: '协议客户', itemCode: 'Y004', itemName: '易拉宝', cat: '制作', catName: '制作', unit: '个', tier: '-', listPrice: 120, price: 90, start: '2025-06-01', owner: '总管', remark: '' },
      { custCode: '100004', custName: '华为技术', groupName: '协议客户', itemCode: 'Y003', itemName: '画册设计', cat: '设计', catName: '设计', unit: '页', tier: '-', listPrice: 200, price: 170, start: '2026-09-01', owner: '管理员', remark: '' },
      { custCode: '100004', custName: '华为技术', groupName: '协议客户', itemCode: 'Y005', itemName: '不干胶标签', cat: '印刷', catName: '印刷', unit: '张', tier: '500+', listPrice: 0.3, price: 0.22, start: '2026-09-01', owner: '管理员', remark: '' },
    ];
    loading.value = false;
  }, 200);
};

onMounted(() => loadData());
</script>

<style scoped lang="scss">
.cust-info-bar {
  display: flex;
  gap: var(--erp-space-6);
  padding: var(--erp-space-2) 0;
  font-size: var(--erp-table-size);
  color: var(--erp-text-soft);
  span { display: inline-flex; align-items: center; gap: var(--erp-space-1); }
}
.table-actions { display: flex; align-items: center; gap: 4px; }
.mono-text { font-family: var(--erp-font-mono); font-variant-numeric: tabular-nums; }
.dialog-form { display: flex; flex-direction: column; gap: var(--erp-space-3); }
.dialog-form-row {
  display: flex;
  align-items: center;
  gap: var(--erp-space-3);
  label { min-width: 100px; font-size: var(--erp-table-size); color: var(--erp-text); }
}
</style>
