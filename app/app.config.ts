import { discussionsyncDiscussionsConfig } from '../layers/discussion-sync/collections/discussions/app/composables/useDiscussionSyncDiscussions'
import { discussionsyncThreadsConfig } from '../layers/discussion-sync/collections/threads/app/composables/useDiscussionSyncThreads'
import { discussionsyncSourcesConfig } from '../layers/discussion-sync/collections/sources/app/composables/useDiscussionSyncSources'
import { discussionsyncSyncJobsConfig } from '../layers/discussion-sync/collections/syncjobs/app/composables/useDiscussionSyncSyncJobs'
import { discussionsyncTasksConfig } from '../layers/discussion-sync/collections/tasks/app/composables/useDiscussionSyncTasks'
import { discussionsyncSourceConfigsConfig } from '../layers/discussion-sync/collections/sourceconfigs/app/composables/useDiscussionSyncSourceConfigs'

export default defineAppConfig({
  croutonCollections: {
    discussionSyncSourceConfigs: discussionsyncSourceConfigsConfig,
    discussionSyncTasks: discussionsyncTasksConfig,
    discussionSyncSyncJobs: discussionsyncSyncJobsConfig,
    discussionSyncSources: discussionsyncSourcesConfig,
    discussionSyncThreads: discussionsyncThreadsConfig,
    discussionSyncDiscussions: discussionsyncDiscussionsConfig,
  },
  ui: {
    icons: {
      loading: 'i-lucide-loader-circle',
    },
    button: {
      slots: {
        base: 'cursor-pointer',
      },
    },
    colors: {
      primary: 'emerald',
      neutral: 'neutral',
    },
  },
  seo: {
    title: 'Supersaas',
    description: 'The fullstack Nuxt 3 SaaS starter kit',
  },
})
