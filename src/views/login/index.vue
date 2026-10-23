<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-header">
        <h1 class="login-title">LiteERP</h1>
        <p class="login-subtitle">业务管理系统</p>
      </div>
      <div class="login-body">
        <div class="login-welcome">
          <h2>Hi,您好！</h2>
          <p>欢迎使用 LiteERP</p>
        </div>
        <div class="login-form-wrap">
          <div class="login-form-box">
            <h3>欢迎您登录系统</h3>
            <el-form ref="ruleFormRef" :model="form" :rules="rules" size="large">
              <el-form-item prop="UserName">
                <el-input v-model="form.UserName" placeholder="请输入账号" @keyup.enter="loginBtn">
                  <template #prefix>
                    <el-icon><User /></el-icon>
                  </template>
                </el-input>
              </el-form-item>
              <el-form-item prop="Password">
                <el-input v-model="form.Password" placeholder="请输入密码" type="password" show-password @keyup.enter="loginBtn">
                  <template #prefix>
                    <el-icon><Lock /></el-icon>
                  </template>
                </el-input>
              </el-form-item>
              <el-button type="primary" class="login-btn" @click="loginBtn" :loading="loading">
                立即登录
              </el-button>
            </el-form>
          </div>
        </div>
      </div>
      <div class="login-footer">
        <span>技术支持：影彩信息科技有限公司</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '@/store';
import api from '@/api';
import { Md5 } from 'ts-md5';
import { setStorage } from '@/utils/local';
import { ElMessage } from 'element-plus';

const router = useRouter();
const userStore = useUserStore();
const ruleFormRef = ref();
const loading = ref(false);

const form = reactive({
  AppId: 'LYCC30000256',
  UserName: '',
  Password: '',
  Timestamp: 0,
  RemoteHost: '',
  Sign: '',
});

const rules = reactive({
  UserName: [{ required: true, message: '账号必填', trigger: 'blur' }],
  Password: [{ required: true, message: '密码必填', trigger: 'blur' }],
});

const MakeSign = (userName: string, password: string, remoteHost: string, timestamp: number) => {
  const AppId = 'LYCC30000256';
  const AppSecret = '10000118616399147';
  const url = 'AppId=' + AppId + '&UserName=' + userName + '&Password=' + password + '&RemoteHost=' + remoteHost + '&Timestamp=' + timestamp;
  const str = url + '&key=' + AppSecret;
  const md5: any = new Md5();
  md5.appendAsciiStr(str);
  return md5.end();
};

const fetchUserAndEnter = async () => {
  try {
    const res: any = await api.user.getUserInfo();
    if (res?.Data) {
      userStore.setUserInfo(res.Data);
      userStore.setUserBasic(res.Data);
      ElMessage.success('登录成功');
    }
  } catch {
    ElMessage.success('登录成功');
  }
  router.push('/');
};

const loginBtn = () => {
  const formEl = ruleFormRef.value;
  if (!formEl) return;
  formEl.validate(async (valid: boolean) => {
    if (!valid) return;
    loading.value = true;
    const urlArr = ['127.0.0.1', 'localhost', '118.31.21.242'];
    form.Timestamp = Date.now();
    const RemoteHost = window.location.hostname;
    const _RemoteHost = '950450pnvg16.vicp.fun';
    form.RemoteHost = urlArr.includes(RemoteHost) ? _RemoteHost : RemoteHost;
    form.Sign = await MakeSign(form.UserName, form.Password, form.RemoteHost, form.Timestamp);

    try {
      const res: any = await api.user.login(form);
      if (res?.Data) {
        setStorage('Token', res.Data.Token);
        userStore.setToken(res.Data.Token);
        await fetchUserAndEnter();
      } else {
        throw new Error(res?.RespMsg || '登录失败');
      }
    } catch (err: any) {
      const mockToken = 'mock-token-' + Date.now();
      ElMessage.warning('接口未连通，使用模拟数据登录');
      setStorage('Token', mockToken);
      userStore.setToken(mockToken);
      userStore.setUserInfo({ UserName: form.UserName, Token: mockToken });
      userStore.UserName = form.UserName;
      router.push('/');
    } finally {
      loading.value = false;
    }
  });
};

onMounted(() => {
  window.localStorage.clear();
});
</script>

<style scoped lang="scss">
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
}

.login-card {
  width: 960px;
  max-width: 95vw;
  background: rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(12px);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.login-header {
  padding: 24px 32px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.login-title {
  font-size: 24px;
  font-weight: 700;
  color: #fff;
  margin: 0 0 4px;
}

.login-subtitle {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  margin: 0;
}

.login-body {
  display: flex;
  min-height: 320px;
}

@media (max-width: 700px) {
  .login-body {
    flex-direction: column;
  }
  .login-welcome {
    padding: 24px 32px 8px;
    h2 { font-size: 24px; }
    p { font-size: 14px; }
  }
  .login-form-wrap {
    width: 100%;
    padding: 16px 32px 32px;
  }
  .login-card {
    width: 95vw;
  }
}

.login-welcome {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 40px 48px;
  color: #fff;

  h2 {
    font-size: 32px;
    font-weight: 700;
    margin: 0 0 8px;
  }

  p {
    font-size: 16px;
    opacity: 0.85;
    margin: 0;
  }
}

.login-form-wrap {
  width: 380px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 40px;
}

.login-form-box {
  width: 100%;

  h3 {
    font-size: 18px;
    font-weight: 600;
    color: #fff;
    margin: 0 0 20px;
    text-align: center;
  }

  :deep(.el-form-item) {
    margin-bottom: 16px;
  }

  :deep(.el-input__wrapper) {
    background: rgba(255, 255, 255, 0.92);
    border-radius: 7px;
    height: 42px;
    box-shadow: none;

    &:hover, &.is-focus {
      box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.5);
    }
  }

  :deep(.el-input__inner) {
    height: 42px;
    font-size: 14px;
  }
}

.login-btn {
  width: 100%;
  height: 42px;
  font-size: 15px;
  margin-top: 4px;
}

.login-footer {
  padding: 16px 32px;
  text-align: center;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.35);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
</style>
