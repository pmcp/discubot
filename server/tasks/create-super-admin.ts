export default defineTask({
  meta: {
    name: 'create-super-admin',
    description: 'Create a super admin user',
  },
  async run({ payload }) {
    if (!import.meta.dev) {
      throw new Error('This task can only be run in development environment')
    }
    console.log('Running create super admin task...')
    const useEmail = payload.email
    const record = await useDB()
      .update(tables.users)
      .set({
        superAdmin: true,
        emailVerified: true,
      })
      .where(eq(tables.users.email, useEmail as string))
      .returning()
      .get()
    return { result: record }
  },
})
