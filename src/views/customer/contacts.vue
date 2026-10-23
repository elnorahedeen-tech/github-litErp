<template>
  <div class="erp-content">
    <div class="erp-pagehead">
      <div class="erp-pagehead-info">
        <p class="erp-breadcrumb">业务 / LiteERP / 客户</p>
        <h1>联络人员</h1>
        <p class="erp-pagehead-desc">机构客户的经办人、财务、设计师等联系人。点客户名查看客户详情。</p>
      </div>
      <div class="erp-pagehead-actions">
        <el-button type="primary" @click="openAdd">
          <el-icon><Plus /></el-icon> 新建联络人员
        </el-button>
        <el-button @click="handleExport">导出</el-button>
      </div>
    </div>

    <div class="erp-toolbar">
      <div class="erp-toolbar-item">
        <label>搜索</label>
        <el-input v-model="search.q" placeholder="姓名 / 称呼 / 手机 / 电话 / 邮箱" clearable style="width: 240px" />
      </div>
      <div class="erp-toolbar-item">
        <label>所属客户</label>
        <el-select v-model="search.cust" clearable placeholder="全部客户" filterable style="width: 200px">
          <el-option v-for="c in custOptions" :key="c.code" :label="`${c.code} ${c.name}`" :value="c.code" />
        </el-select>
      </div>
      <div class="erp-toolbar-item">
        <label>人员类型</label>
        <el-select v-model="search.type" clearable placeholder="全部" style="width: 120px">
          <el-option v-for="t in typeOptions" :key="t" :label="t" :value="t" />
        </el-select>
      </div>
      <div class="erp-toolbar-item">
        <label>客户分组</label>
        <el-select v-model="search.group" clearable placeholder="全部" style="width: 140px">
          <el-option v-for="g in groupOptions" :key="g" :label="g" :value="g" />
        </el-select>
      </div>
      <div class="erp-toolbar-actions">
        <el-button type="primary" @click="loadData">筛选</el-button>
        <el-button @click="resetSearch">重置</el-button>
      </div>
    </div>

    <div class="erp-panel">
      <div class="erp-table-wrap">
        <el-table :data="filteredData" v-loading="loading" stripe style="width: 100%">
          <el-table-column prop="name" label="姓名" width="120">
            <template #default="{ row }">
              {{ row.name }}
              <div class="sub-text">{{ row.call }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="type" label="人员类型" width="100" align="center">
            <template #default="{ row }">
              <span class="erp-badge" :data-tone="row.type === '决策人' ? 'success' : row.type === '未评估' ? 'info' : ''">{{ row.type }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="custName" label="所属客户" min-width="180">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="router.push(`/customer/detail?code=${row.custCode}`)">{{ row.custName }}</el-button>
              <div class="sub-text">{{ row.groupName }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="dept" label="部门 / 职务" width="140">
            <template #default="{ row }">{{ [row.dept, row.title].filter(Boolean).join(' · ') || '—' }}</template>
          </el-table-column>
          <el-table-column prop="mobile" label="手机" width="130">
            <template #default="{ row }"><span class="mono-text">{{ row.mobile || '未提供' }}</span></template>
          </el-table-column>
          <el-table-column prop="tel" label="固定电话" width="140">
            <template #default="{ row }"><span class="mono-text">{{ row.tel || '—' }}</span></template>
          </el-table-column>
          <el-table-column prop="email" label="电子邮件" min-width="160" :show-overflow-tooltip="true" />
          <el-table-column prop="owner" label="负责人员" width="90" />
          <el-table-column prop="created" label="建交日期" width="110" />
          <el-table-column prop="remark" label="备注" width="120" :show-overflow-tooltip="true" />
          <el-table-column label="操作" width="120" fixed="right">
            <template #default="{ row }">
              <div class="table-actions">
                <el-button link type="primary" size="small" @click="editRow(row)">编辑</el-button>
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
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';

const router = useRouter();
const route = useRoute();
const loading = ref(false);
const tableData = ref<any[]>([]);

const search = reactive({ q: '', cust: '', type: '', group: '' });

const custOptions = [
  { code: '100001', name: '世纪出版社' },
  { code: '100002', name: '新华书店' },
  { code: '100003', name: '万科地产' },
  { code: '100004', name: '华为技术' },
  { code: '100005', name: '晨光文具' },
];
const typeOptions = ['未评估', '决策人', '经办人', '财务', '设计师', '采购'];
const groupOptions = ['普通客户', 'VIP客户', '预存客户', '协议客户'];

const filteredData = computed(() => {
  let data = tableData.value;
  if (search.q) {
    const q = search.q.toLowerCase();
    data = data.filter(r => (r.name + r.call + r.mobile + r.tel + r.email).toLowerCase().includes(q));
  }
  if (search.cust) data = data.filter(r => r.custCode === search.cust);
  if (search.type) data = data.filter(r => r.type === search.type);
  if (search.group) data = data.filter(r => r.groupName === search.group);
  return data;
});

const resetSearch = () => { search.q = ''; search.cust = ''; search.type = ''; search.group = ''; };
const openAdd = () => { router.push('/customer/contactEdit'); };
const editRow = (row: any) => { router.push(`/customer/contactEdit?id=${row.id}`); };
const handleExport = () => { ElMessage.info('导出联络人员 CSV'); };

const handleDelete = (row: any) => {
  ElMessageBox.confirm(`删除联络人员 ${row.name}（${row.custName}）？`, '提示', { type: 'warning' })
    .then(() => { tableData.value = tableData.value.filter(r => r.id !== row.id); ElMessage.success('删除成功'); })
    .catch(() => {});
};

const loadData = () => {
  loading.value = true;
  setTimeout(() => {
    tableData.value = [
      { id: 1, custCode: '100001', custName: '世纪出版社', groupName: 'VIP客户', type: '决策人', dept: '办公室', title: '主任', name: '王伟', call: '王主任', mobile: '13800001111', tel: '010-62345678', email: 'wang@example.com', owner: '管理员', created: '2025-03-15', remark: '' },
      { id: 2, custCode: '100001', custName: '世纪出版社', groupName: 'VIP客户', type: '财务', dept: '财务部', title: '会计', name: '李芳', call: '李会计', mobile: '13800001112', tel: '', email: 'li@example.com', owner: '管理员', created: '2025-03-15', remark: '' },
      { id: 3, custCode: '100002', custName: '新华书店', groupName: 'VIP客户', type: '经办人', dept: '采购部', title: '专员', name: '张敏', call: '张专员', mobile: '13900002222', tel: '', email: 'zhang@example.com', owner: '管理员', created: '2025-06-20', remark: '' },
      { id: 4, custCode: '100003', custName: '万科地产', groupName: '协议客户', type: '决策人', dept: '', title: '总经理', name: '刘强', call: '刘总', mobile: '13700003333', tel: '010-88886666', email: 'liu@vanke.com', owner: '总管', created: '2025-01-10', remark: '' },
      { id: 5, custCode: '100004', custName: '华为技术', groupName: '协议客户', type: '采购', dept: '采购部', title: '经理', name: '陈静', call: '陈经理', mobile: '13600004444', tel: '', email: 'chen@huawei.com', owner: '管理员', created: '2025-09-01', remark: '' },
      { id: 6, custCode: '100005', custName: '晨光文具', groupName: '普通客户', type: '未评估', dept: '', title: '', name: '孙磊', call: '孙先生', mobile: '13500005555', tel: '', email: '', owner: '', created: '2026-02-15', remark: '' },
    ];
    loading.value = false;
  }, 200);
};

onMounted(() => {
  const cust = route.query.cust as string;
  if (cust) search.cust = cust;
  loadData();
});
</script>

<style scoped lang="scss">
.table-actions { display: flex; align-items: center; gap: 4px; }
.mono-text { font-family: var(--erp-font-mono); font-variant-numeric: tabular-nums; }
</style>
