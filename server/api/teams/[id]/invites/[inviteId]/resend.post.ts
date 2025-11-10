import { render } from '@vue-email/render'
import TeamInvitation from '@@/emails/member-invite.vue'
import { sendEmail } from '@@/server/services/email'
import { env } from '@@/env'
import {
  findTeamInvite,
  updateTeamInvite,
} from '@@/server/database/queries/teams'

export default defineEventHandler(async (event) => {
  const teamId = getRouterParam(event, 'id')
  const inviteId = getRouterParam(event, 'inviteId')
  if (!teamId || !inviteId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Team ID and invite ID are required',
    })
  }

  // Validate team ownership and get team and user details
  const { user, team } = await validateTeamOwnership(event, teamId)

  // Find the existing invitation
  const invitation = await findTeamInvite(inviteId)
  if (!invitation) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Invitation not found',
    })
  }
  if (invitation.status === 'accepted') {
    throw createError({
      statusCode: 422,
      statusMessage: 'Invitation has already been accepted',
    })
  }

  // Update invitation expiry
  await updateTeamInvite(inviteId, {
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7 days
  })

  // Resend invitation email
  const htmlTemplate = await render(TeamInvitation, {
    organizationName: team.name,
    inviterName: user.name,
    inviteLink: `${env.BASE_URL}/api/teams/verify-invite?token=${invitation.token}`,
  })

  if (env.MOCK_EMAIL) {
    console.table({
      email: invitation.email,
      teamName: team.name,
      inviterName: user.name,
      inviteLink: `${env.BASE_URL}/api/teams/verify-invite?token=${invitation.token}`,
    })
  } else {
    await sendEmail({
      to: invitation.email,
      subject: `Invitation to join ${team.name} on ${env.APP_NAME}`,
      html: htmlTemplate,
    })
  }
})
