<script setup lang="ts">
import DefaultTheme from 'vitepress/theme';
import Logo from './Logo.vue';

const { Layout } = DefaultTheme;
</script>

<template>
  <Layout>
    <template #nav-bar-title-before>
      <Logo class="logo" decorative />
    </template>
    <template #home-hero-image>
      <Logo class="image-src" decorative />
    </template>
  </Layout>
</template>
