import { insertSubscriber } from '@@/server/database/queries/admin'

export default defineEventHandler(async (event) => {
  const { email } = await readBody(event)
  await insertSubscriber({ email })
  sendNoContent(event)
})
