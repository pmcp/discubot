export default {
  // SQLite database via NuxtHub
  dialect: 'sqlite',

  // Target layers
  targets: [
    {
      layer: 'discussion-sync',
      collections: [
        'discussions',
        'threads',
        'sources',
        'syncJobs',
        'tasks',
        'sourceConfigs',
      ],
    },
  ],

  // Collection definitions
  collections: [
    {
      name: 'discussions',
      fieldsFile: './schemas/discussion-schema.json',
    },
    {
      name: 'threads',
      fieldsFile: './schemas/thread-schema.json',
    },
    {
      name: 'sources',
      fieldsFile: './schemas/source-schema.json',
    },
    {
      name: 'syncJobs',
      fieldsFile: './schemas/sync-job-schema.json',
    },
    {
      name: 'tasks',
      fieldsFile: './schemas/task-schema.json',
    },
    {
      name: 'sourceConfigs',
      fieldsFile: './schemas/source-config-schema.json',
    },
  ],

  // External connectors
  connectors: {
    users: {
      type: 'supersaas',
      autoInstall: true,
      copyFiles: true,
      updateAppConfig: true,
    },
  },

  // Generation flags
  flags: {
    useTeamUtility: true, // Team-scoped APIs
    useMetadata: true, // createdAt/updatedAt
    autoRelations: true, // Relation stubs
    autoConnectors: true, // Auto-setup connectors
    force: false,
    noTranslations: true, // No i18n needed initially
    noDb: false,
    dryRun: false,
    useMaps: false, // No geocoding needed
  },
}
