import { updateDiscussionSyncSource } from '../../../../database/queries'
import { resolveTeamAndCheckMembership } from '#crouton/team-auth'
import type { DiscussionSyncSource } from '../../../../../types'

export default defineEventHandler(async (event) => {
  const { sourceId } = getRouterParams(event)
  const { team, user } = await resolveTeamAndCheckMembership(event)

  const body = await readBody<Partial<DiscussionSyncSource>>(event)

  return await updateDiscussionSyncSource(sourceId, team.id, user.id, {
    id: body.id,
    sourceType: body.sourceType,
    name: body.name,
    description: body.description,
    adapterClass: body.adapterClass,
    icon: body.icon,
    configSchema: body.configSchema,
    webhookPath: body.webhookPath,
    requiresEmail: body.requiresEmail,
    requiresWebhook: body.requiresWebhook,
    requiresApiToken: body.requiresApiToken,
    active: body.active,
    metadata: body.metadata
  })
})