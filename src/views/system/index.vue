<template>
  <div class="erp-content">
    <div class="erp-pagehead">
      <div class="erp-pagehead-info">
        <p class="erp-breadcrumb">业务 / LiteERP / 系统</p>
        <h1>员工资料</h1>
        <p class="erp-pagehead-desc">员工编号即登录账号。已有业务单据的员工不能删除，请改为"离职"。</p>
      </div>
      <div class="erp-pagehead-actions">
        <el-button type="primary" @click="openAdd">
          <el-icon><Plus /></el-icon> 新建员工
        </el-button>
        <el-button @click="handleExport">导出</el-button>
      </div>
    </div>

    <div class="erp-toolbar">
      <div class="erp-toolbar-item">
        <label>搜索员工</label>
        <el-input v-model="search.q" placeholder="编号 / 姓名 / 手机" clearable style="width: 220px" />
      </div>
      <div class="erp-toolbar-item">
        <label>员工角色</label>
        <el-select v-model="search.role" clearable placeholder="全部" style="width: 120px">
          <el-option v-for="r in roleOptions" :key="r" :label="r" :value="r" />
        </el-select>
      </div>
      <div class="erp-toolbar-item">
        <label>部门岗位</label>
        <el-select v-model="search.dept" clearable placeholder="全部" style="width: 140px">
          <el-option v-for="d in deptOptions" :key="d" :label="d" :value="d" />
        </el-select>
      </div>
      <div class="erp-toolbar-item">
        <label>状态</label>
        <el-select v-model="search.state" clearable placeholder="全部" style="width: 120px">
          <el-option label="在职" value="active" />
          <el-option label="离职" value="left" />
          <el-option label="已锁定" value="locked" />
          <el-option label="在线" value="online" />
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
          <el-table-column prop="UserName" label="员工姓名" width="100" />
          <el-table-column prop="RoleName" label="员工角色" width="100" />
          <el-table-column prop="DepName" label="部门岗位" min-width="140" />
          <el-table-column prop="Phone" label="手机号码" width="130">
            <template #default="{ row }"><span class="mono-text">{{ row.Phone || '未提供' }}</span></template>
          </el-table-column>
          <el-table-column label="状态" width="160" align="center">
            <template #default="{ row }">
              <span class="erp-badge" :data-tone="row.IsLeave ? '' : 'success'">{{ row.IsLeave ? '离职' : '在职' }}</span>
              <span v-if="row.IsLocked" class="erp-badge" data-tone="danger" style="margin-left: 4px">已锁定</span>
              <span v-if="row.IsOnline" class="erp-badge" data-tone="primary" style="margin-left: 4px">在线</span>
            </template>
          </el-table-column>
          <el-table-column prop="MobileLogin" label="移动端登录" width="100" align="center">
            <template #default="{ row }">{{ row.MobileLogin ? '允许' : '不允许' }}</template>
          </el-table-column>
          <el-table-column label="转正" width="110" align="center">
            <template #default="{ row }">
              <span class="erp-badge" :data-tone="row.IsRegular ? 'success' : 'info'">{{ row.IsRegular ? '已转正' : '试用期' }}</span>
              <div v-if="row.RegularDate" class="sub-text">{{ row.RegularDate }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="Gender" label="性别" width="60" align="center" />
          <el-table-column prop="Birthday" label="生日" width="110" />
          <el-table-column prop="JoinDate" label="入职日期" width="110" />
          <el-table-column prop="Remark" label="备注" min-width="120" :show-overflow-tooltip="true" />
          <el-table-column label="操作" width="220" fixed="right">
            <template #default="{ row }">
              <div class="table-actions">
                <el-button link type="primary" size="small" @click="editRow(row)">编辑</el-button>
                <el-button link type="primary" size="small" @click="resetPwd(row)">重置密码</el-button>
                <el-button link type="primary" size="small" @click="toggleLock(row)">{{ row.IsLocked ? '解锁' : '锁定' }}</el-button>
                <el-button v-if="row.IsOnline" link type="warning" size="small" @click="forceOffline(row)">强制下线</el-button>
                <el-button v-if="row.UserCode !== '0000'" link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
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
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/api';

const router = useRouter();
const loading = ref(false);
const tableData = ref<any[]>([]);

const search = reactive({ q: '', role: '', dept: '', state: '' });

const roleOptions = ref<string[]>([]);
const deptOptions = ref<string[]>([]);

const filteredData = computed(() => {
  let data = tableData.value;
  if (search.q) {
    const q = search.q.toLowerCase();
    data = data.filter(r => ((r.UserCode || '') + (r.UserName || '') + (r.Phone || '')).toLowerCase().includes(q));
  }
  if (search.role) data = data.filter(r => r.RoleName === search.role);
  if (search.dept) data = data.filter(r => r.DepName === search.dept);
  if (search.state === 'active') data = data.filter(r => !r.IsLeave);
  if (search.state === 'left') data = data.filter(r => r.IsLeave);
  if (search.state === 'locked') data = data.filter(r => r.IsLocked);
  if (search.state === 'online') data = data.filter(r => r.IsOnline);
  return data;
});

const resetSearch = () => { search.q = ''; search.role = ''; search.dept = ''; search.state = ''; };
const openAdd = () => { router.push('/system/employeeEdit?type=new'); };
const editRow = (row: any) => { router.push(`/system/employeeEdit?code=${row.UserCode}`); };
const handleExport = () => { ElMessage.info('导出员工资料 CSV'); };

const resetPwd = (row: any) => {
  ElMessageBox.confirm(`把 ${row.UserCode} ${row.UserName} 的登录密码重置为 123456？`, '重置密码', { type: 'warning' })
    .then(() => { ElMessage.success(`已将 ${row.UserName} 的密码重置为 123456`); })
    .catch(() => {});
};

const toggleLock = (row: any) => {
  if (!row.IsLocked) {
    ElMessageBox.confirm(`锁定员工 ${row.UserCode} ${row.UserName}？锁定后不能登录。`, '提示', { type: 'warning' })
      .then(() => { row.IsLocked = true; row.IsOnline = false; ElMessage.success(`${row.UserName} 已锁定`); })
      .catch(() => {});
  } else {
    row.IsLocked = false;
    ElMessage.success(`${row.UserName} 已解锁`);
  }
};

const forceOffline = (row: any) => {
  ElMessageBox.confirm(`让 ${row.UserName} 立即下线？未保存的单据可能丢失。`, '强制下线', { type: 'warning' })
    .then(() => { row.IsOnline = false; ElMessage.success(`${row.UserName} 已下线`); })
    .catch(() => {});
};

const handleDelete = (row: any) => {
  if (row.HasRecords) {
    ElMessage.warning(`不能删除员工 ${row.UserCode} ${row.UserName}：已有接待、处理或结算记录。请改为"离职"。`);
    return;
  }
  ElMessageBox.confirm(`删除员工 ${row.UserCode} ${row.UserName}？删除后不能恢复。`, '提示', { type: 'warning' })
    .then(() => { tableData.value = tableData.value.filter(r => r.UserCode !== row.UserCode); ElMessage.success(`员工 ${row.UserCode} 已删除`); })
    .catch(() => {});
};

const loadData = async () => {
  loading.value = true;
  try {
    const res: any = await api.user.GetAllSysUsers();
    if (res?.Data) {
      tableData.value = Array.isArray(res.Data) ? res.Data : [];
    }
  } catch {
    tableData.value = [];
  }
  loading.value = false;
};

const loadOptions = async () => {
  try {
    const [rolesRes, depsRes]: any = await Promise.all([
      api.user.GetAllRoles(),
      api.user.GetAllDeps(),
    ]);
    if (rolesRes?.Data) {
      roleOptions.value = Array.isArray(rolesRes.Data) ? rolesRes.Data.map((r: any) => r.RoleName || r.Name || '').filter(Boolean) : [];
    }
    if (depsRes?.Data) {
      deptOptions.value = Array.isArray(depsRes.Data) ? depsRes.Data.map((d: any) => d.DepName || d.Name || '').filter(Boolean) : [];
    }
  } catch {
    // ignore
  }
};

onMounted(() => {
  loadData();
  loadOptions();
});
</script>

<style scoped lang="scss">
.table-actions { display: flex; align-items: center; gap: 4px; }
.mono-text { font-family: var(--erp-font-mono); font-variant-numeric: tabular-nums; }
</style>
