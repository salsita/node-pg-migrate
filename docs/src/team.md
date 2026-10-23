---
layout: page
title: Team
description: Meet the maintainers and core contributors of node-pg-migrate and recognize its former maintainers.
sidebar: false
---

<script setup>
import {
  VPTeamMembers,
  VPTeamPage,
  VPTeamPageSection,
  VPTeamPageTitle,
} from 'vitepress/theme';
import { contributors, emeriti, maintainers } from './team/members.json';
</script>

<VPTeamPage>
  <VPTeamPageTitle>
    <template #title>Meet the Team</template>
    <template #lead>
      The people keeping node-pg-migrate moving forward.
    </template>
  </VPTeamPageTitle>

  <VPTeamMembers :members="maintainers" />

  <VPTeamPageSection>
    <template #title>Core Contributors</template>
    <template #members>
      <VPTeamMembers :members="contributors" />
    </template>
  </VPTeamPageSection>

  <VPTeamPageSection>
    <template #title>Team Emeriti</template>
    <template #lead>
      We thank our former maintainers for the work and care that helped shape
      node-pg-migrate.
    </template>
    <template #members>
      <VPTeamMembers size="small" :members="emeriti" />
    </template>
  </VPTeamPageSection>
</VPTeamPage>
