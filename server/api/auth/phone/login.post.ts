import { findUserByPhoneNumber } from '@@/server/database/queries/users'
import { validateBody } from '@@/server/utils/bodyValidation'
import { phoneSchema } from '@@/shared/validations/auth'
import { generateNumericCode } from '@@/server/utils/nanoid'
import { env } from '@@/env'
import { saveOneTimePassword } from '@@/server/database/queries/auth'
import { OneTimePasswordTypes } from '@@/constants'

export default defineEventHandler(async (event) => {
  const data = await validateBody(event, phoneSchema)

  const user = await findUserByPhoneNumber(data.phoneNumber)
  if (!user) {
    throw createError({
      statusCode: 400,
      statusMessage: 'User not found',
    })
  }
  if (!user.emailVerified) {
    throw createError({
      statusCode: 400,
      statusMessage: 'User has not verified their account',
    })
  }

  if (user.banned && user.bannedUntil && user.bannedUntil > new Date()) {
    throw createError({
      statusCode: 403,
      statusMessage: 'You account has been banned',
    })
  }

  const oneTimePassword = generateNumericCode(6)

  await saveOneTimePassword({
    userId: user.id,
    identifier: data.phoneNumber,
    code: oneTimePassword,
    type: OneTimePasswordTypes.login,
    expiresAt: new Date(Date.now() + 1000 * 60 * 5), // 5 minutes
  })

  await $fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        Body: `Your verification code for ${env.APP_NAME} is: ${oneTimePassword}`,
        To: data.phoneNumber,
        From: env.TWILIO_PHONE_NUMBER,
      }).toString(),
    },
  )

  sendNoContent(event)
})
