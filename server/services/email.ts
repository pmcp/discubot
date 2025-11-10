import { useEmail } from 'use-email'
import { env } from '@@/env'

const EMAIL_PROVIDER = env.EMAIL_PROVIDER
const emailService = useEmail(EMAIL_PROVIDER)

export interface BaseEmailPayload {
  to: string | string[]
  subject: string
}

export interface TextEmailPayload extends BaseEmailPayload {
  text: string
  html?: string
}

export interface HtmlEmailPayload extends BaseEmailPayload {
  text?: string
  html: string
}

export type EmailPayload = TextEmailPayload | HtmlEmailPayload

export async function sendEmail({ to, subject, text, html }: EmailPayload) {
  try {
    await emailService.send({
      from: env.FROM_EMAIL,
      to,
      subject,
      text,
      html,
    })
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to send email',
    })
  }
}
