<template>
  <AppSidebarPanel v-model="mobileMenu">
    <div class="flex h-full flex-col">
      <Transition
        mode="out-in"
        enter-active-class="transition duration-100 ease-out"
        leave-active-class="transition duration-100 ease-in"
        enter-from-class="translate-x-1/2"
        enter-to-class="translate-x-0"
        leave-from-class="translate-x-0"
        leave-to-class="-translate-x-1/2"
      >
        <div v-if="isTeamRoute" key="team">
          <AppSidebarTeam />
        </div>
        <div v-else-if="isSuperAdminRoute" key="super-admin">
          <AppSidebarSuperAdmin />
        </div>
        <div v-else key="account">
          <AppSidebarAccount />
        </div>
      </Transition>
      <footer class="mt-auto">
        <AppUserDropdown />
      </footer>
    </div>
  </AppSidebarPanel>
</template>

<script lang="ts" setup>
const route = useRoute()

const mobileMenu = useState('mobileMenu', () => false)
const isTeamRoute = computed(() => {
  return (
    route.path.startsWith('/dashboard/')
    && !route.path.startsWith('/dashboard/account')
    && !route.path.startsWith('/dashboard/super-admin')
  )
})

const isSuperAdminRoute = computed(() => {
  return route.path.startsWith('/dashboard/super-admin')
})
</script>
