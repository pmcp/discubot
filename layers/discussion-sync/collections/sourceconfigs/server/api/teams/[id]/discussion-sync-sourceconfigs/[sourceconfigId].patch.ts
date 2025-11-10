import { updateDiscussionSyncSourceConfig } from '../../../../database/queries'
import { resolveTeamAndCheckMembership } from '#crouton/team-auth'
import type { DiscussionSyncSourceConfig } from '../../../../../types'

export default defineEventHandler(async (event) => {
  const { sourceconfigId } = getRouterParams(event)
  const { team, user } = await resolveTeamAndCheckMembership(event)

  const body = await readBody<Partial<DiscussionSyncSourceConfig>>(event)

  return await updateDiscussionSyncSourceConfig(sourceconfigId, team.id, user.id, {
    id: body.id,
    sourceId: body.sourceId,
    name: body.name,
    emailAddress: body.emailAddress,
    emailSlug: body.emailSlug,
    webhookUrl: body.webhookUrl,
    webhookSecret: body.webhookSecret,
    apiToken: body.apiToken,
    notionToken: body.notionToken,
    notionDatabaseId: body.notionDatabaseId,
    notionFieldMapping: body.notionFieldMapping,
    anthropicApiKey: body.anthropicApiKey,
    aiEnabled: body.aiEnabled,
    aiSummaryPrompt: body.aiSummaryPrompt,
    aiTaskPrompt: body.aiTaskPrompt,
    autoSync: body.autoSync,
    postConfirmation: body.postConfirmation,
    active: body.active,
    onboardingComplete: body.onboardingComplete,
    sourceMetadata: body.sourceMetadata
  })
})