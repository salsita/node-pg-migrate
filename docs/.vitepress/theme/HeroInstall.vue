<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';

const managers = ['npm', 'pnpm', 'yarn', 'bun'] as const;
const manager = ref<(typeof managers)[number]>('npm');
// not -D: runner() and pg are runtime dependencies when migrating from app code
const command = computed(() => `${manager.value} add node-pg-migrate pg`);

const code = ref<HTMLElement>();
const copied = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;
onBeforeUnmount(() => clearTimeout(timer));

async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(command.value);
    copied.value = true;
    clearTimeout(timer);
    timer = setTimeout(() => (copied.value = false), 2000);
  } catch {
    // clipboard blocked: select the command so it can be copied by hand
    if (code.value) {
      window.getSelection()?.selectAllChildren(code.value);
    }
  }
}
</script>

<template>
  <div class="hero-install">
    <!-- radio inputs, like VitePress's code-group tabs: arrow keys switch managers -->
    <div class="managers" role="radiogroup" aria-label="Package manager">
      <template v-for="m in managers" :key="m">
        <input
          :id="`install-${m}`"
          v-model="manager"
          type="radio"
          name="install-manager"
          :value="m"
        />
        <label :for="`install-${m}`">{{ m }}</label>
      </template>
    </div>
    <div class="command">
      <code ref="code"
        ><span class="prompt" aria-hidden="true">$ </span>{{ command }}</code
      >
      <button
        type="button"
        class="copy"
        :aria-label="copied ? 'Copied' : 'Copy install command'"
        :title="copied ? 'Copied' : 'Copy'"
        @click="copy"
      >
        <!-- the same icons VitePress uses on its code blocks -->
        <span
          class="vp-icon"
          :style="{
            '--icon': copied ? 'var(--vp-icon-copied)' : 'var(--vp-icon-copy)',
          }"
        />
      </button>
    </div>
  </div>
</template>

<style scoped>
/* inline-block, so it follows the hero's own text alignment at every breakpoint */
.hero-install {
  display: inline-block;
  vertical-align: top;
  margin-top: 28px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background-color: var(--vp-c-bg-soft);
  max-width: 100%;
  overflow: hidden;
  text-align: start;
}

.managers {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--vp-c-divider);
  padding: 6px 8px 0;
}

.managers input {
  position: fixed;
  opacity: 0;
  pointer-events: none;
}

/* styled like the code-group tabs further down the page */
.managers label {
  border-bottom: 2px solid transparent;
  padding: 4px 8px 6px;
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  font-weight: 500;
  color: var(--vp-code-tab-text-color);
  cursor: pointer;
  transition:
    color 0.2s,
    border-color 0.2s;
}

.managers label:hover {
  color: var(--vp-code-tab-hover-text-color);
}

.managers input:checked + label {
  border-bottom-color: var(--vp-code-tab-active-bar-color);
  color: var(--vp-code-tab-active-text-color);
}

.command {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 10px 10px 16px;
}

.command code {
  font-size: 14px;
  white-space: nowrap;
}

@media (max-width: 639px) {
  .command code {
    font-size: 13px;
    white-space: normal;
  }
}

.prompt {
  color: var(--vp-c-text-3);
  user-select: none;
}

.copy {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  border-radius: 8px;
  width: 32px;
  height: 32px;
  font-size: 16px;
  color: var(--vp-c-text-2);
  transition:
    color 0.2s,
    background-color 0.2s;
}

.copy:hover {
  background-color: var(--vp-c-default-soft);
  color: var(--vp-c-brand-1);
}

.managers input:focus-visible + label,
.copy:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}
</style>
