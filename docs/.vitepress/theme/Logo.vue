<script setup lang="ts">
// Inlined (not an <img>) so the slabs can animate on hover; see style.css.
import svg from '../../src/public/logo.svg?raw';

defineProps<{ decorative?: boolean }>();
</script>

<template>
  <span
    class="site-logo"
    :aria-hidden="decorative ? 'true' : undefined"
    v-html="svg"
  />
</template>
