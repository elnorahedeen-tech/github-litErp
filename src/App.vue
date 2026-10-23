<template>
  <el-config-provider :locale="zhCn" :z-index="3000">
    <router-view />
  </el-config-provider>
</template>

<script setup lang="ts">
import zhCn from 'element-plus/es/locale/lang/zh-cn';
</script>
