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

const maintainers = [
  {
    avatar: 'https://github.com/Shinigami92.png?size=192',
    name: 'Christopher Quadflieg',
    title: 'Project Leader & Maintainer',
    links: [
      { icon: 'github', link: 'https://github.com/Shinigami92' },
      { icon: 'mastodon', link: 'https://mas.to/@Shini92' },
    ],
    sponsor: 'https://github.com/sponsors/Shinigami92',
  },
  {
    avatar: 'https://github.com/brenoepics.png?size=192',
    name: 'Breno A.',
    title: 'Co-Maintainer',
    links: [{ icon: 'github', link: 'https://github.com/brenoepics' }],
    sponsor: 'https://github.com/sponsors/brenoepics',
  },
  {
    avatar: 'https://github.com/osdiab.png?size=192',
    name: 'Omar Diab',
    title: 'Co-Maintainer',
    links: [{ icon: 'github', link: 'https://github.com/osdiab' }],
  },
];

const contributors = [
  {
    avatar: 'https://github.com/Creatixpy.png?size=192',
    name: 'Gabriel Pereira',
    title: 'Core Contributor',
    desc: 'I am a developer constantly evolving, building my own projects and contributing to open source projects.',
    links: [{ icon: 'github', link: 'https://github.com/Creatixpy' }],
  },
];

const emeriti = [
  {
    avatar: 'https://github.com/theoephraim.png?size=128',
    name: 'Theo Ephraim',
    links: [{ icon: 'github', link: 'https://github.com/theoephraim/' }],
  },
  {
    avatar: 'https://github.com/salsita.png?size=128',
    name: 'Salsita Software',
    org: 'salsita.ai',
    orgLink: 'https://salsita.ai/',
  },
];
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
