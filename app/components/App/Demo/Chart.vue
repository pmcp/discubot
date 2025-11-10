<template>
  <AppDemoCard :title="title" :description="description">
    <div class="overflow-x-auto">
      <div class="flex h-64 min-w-[600px] items-end gap-2 px-1">
        <div
          v-for="item in impressionsChartData"
          :key="item.date"
          class="flex flex-1 flex-col items-center"
        >
          <UTooltip :delay-duration="0" :text="item.value.toString()">
            <div
              class="w-full min-w-6 cursor-pointer rounded bg-neutral-200 ring-1 ring-neutral-300 transition-all duration-300 hover:-translate-y-1 dark:bg-neutral-800 dark:ring-white/10"
              :style="{
                height: `${Math.max((item.value / maxValue) * 200, 1)}px`,
              }"
            />
          </UTooltip>
          <div class="mt-2 text-xs text-neutral-600 dark:text-neutral-400">
            {{ formatDate(item.date) }}
          </div>
        </div>
      </div>
    </div>
  </AppDemoCard>
</template>

<script lang="ts" setup>
defineProps<{
  title: string
  description?: string
}>()

const impressionsChartData = [
  { date: '2024-01-01', value: 2100 },
  { date: '2024-01-02', value: 3400 },
  { date: '2024-01-03', value: 2800 },
  { date: '2024-01-04', value: 4200 },
  { date: '2024-01-05', value: 3800 },
  { date: '2024-01-06', value: 5100 },
  { date: '2024-01-07', value: 4600 },
  { date: '2024-01-08', value: 3200 },
  { date: '2024-01-09', value: 4800 },
  { date: '2024-01-10', value: 3900 },
  { date: '2024-01-11', value: 5300 },
  { date: '2024-01-12', value: 4400 },
  { date: '2024-01-13', value: 3700 },
  { date: '2024-01-14', value: 5000 },
  { date: '2024-01-15', value: 4100 },
  { date: '2024-01-16', value: 5600 },
  { date: '2024-01-17', value: 4900 },
  { date: '2024-01-18', value: 3500 },
  { date: '2024-01-19', value: 5200 },
  { date: '2024-01-20', value: 4300 },
  { date: '2024-01-21', value: 5800 },
  { date: '2024-01-22', value: 4700 },
  { date: '2024-01-23', value: 3300 },
  { date: '2024-01-24', value: 4900 },
  { date: '2024-01-25', value: 3600 },
  { date: '2024-01-26', value: 5400 },
  { date: '2024-01-27', value: 4500 },
  { date: '2024-01-28', value: 3100 },
  { date: '2024-01-29', value: 4700 },
  { date: '2024-01-30', value: 3800 },
]

// Calculate the maximum value for scaling the bars
const maxValue = Math.max(...impressionsChartData.map((item) => item.value))

// Format date to show only the day
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', { day: 'numeric' })
}
</script>
