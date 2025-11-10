<script setup lang="ts">
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Text,
} from '@vue-email/components'
import { env } from '@@/env'

interface FeedbackReplyProps {
  userName?: string
  originalMessage?: string
  replyMessage?: string
}

withDefaults(defineProps<FeedbackReplyProps>(), {
  userName: '',
  originalMessage: '',
  replyMessage: '',
})

const main = {
  backgroundColor: '#ffffff',
}

const container = {
  paddingLeft: '12px',
  paddingRight: '12px',
  margin: '0 auto',
}

const h1 = {
  color: '#333',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '40px 0',
  padding: '0',
}

const text = {
  color: '#333',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontSize: '14px',
  margin: '24px 0',
}

const messageBox = {
  backgroundColor: '#f4f4f4',
  borderRadius: '5px',
  border: '1px solid #eee',
  padding: '16px',
  margin: '16px 0',
}

const footer = {
  color: '#898989',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontSize: '12px',
  lineHeight: '22px',
  marginTop: '12px',
  marginBottom: '24px',
}
</script>

<template>
  <Html>
    <Head />
    <Preview>Response to your feedback</Preview>
    <Body :style="main">
      <Container :style="container">
        <Heading :style="h1">Response to your feedback</Heading>
        <Text :style="text">Hello {{ userName }},</Text>
        <Text :style="text">We appreciate you taking the time to share your thoughts. Here's our response:</Text>

        <div :style="messageBox">
          <Text :style="{ ...text, margin: '0 0 8px 0', fontWeight: 'bold' }">
            Your feedback:
          </Text>
          <Text :style="{ ...text, margin: '0', whiteSpace: 'pre-line' }">
            {{ originalMessage }}
          </Text>
        </div>

        <div :style="messageBox">
          <Text :style="{ ...text, margin: '0 0 8px 0', fontWeight: 'bold' }">
            Our response:
          </Text>
          <Text :style="{ ...text, margin: '0', whiteSpace: 'pre-line' }">
            {{ replyMessage }}
          </Text>
        </div>

        <Text :style="text">
          If you have any further questions or concerns, please don't hesitate to reach out.
        </Text>

        <Text :style="text">
          Thanks,<br>
          {{ env.APP_NAME }} team
        </Text>

        <Img :src="env.LOGO_URL" width="32" alt="Logo" />
        <Text :style="footer">
          <Link
            :href="env.BASE_URL"
            target="_blank"
            :style="{ color: '#898989', textDecoration: 'underline' }"
          >
            {{ env.APP_NAME }}
          </Link>, {{ env.APP_DESCRIPTION }}
        </Text>
      </Container>
    </Body>
  </Html>
</template>
