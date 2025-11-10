# Phase 4 - End-to-End Testing Guide

**Status:** ✅ Code Complete | 🟡 Ready for Testing
**Date:** 2025-11-10
**Tests Passing:** 210/305 (69%) - Slack integration tests: ✅ 100%

---

## Prerequisites

### 1. Environment Setup

Generate encryption key:
```bash
tsx server/utils/generate-encryption-key.ts
```

Copy the output and add to your `.env` file as `ENCRYPTION_KEY=<generated-key>`.

### 2. Required API Keys

Add these to your `.env` file:

```bash
# Required for Slack webhook verification
SLACK_SIGNING_SECRET=<from-slack-app-settings>

# Required for AI summaries
ANTHROPIC_API_KEY=sk-ant-<your-key>

# Required for task creation
NOTION_API_KEY=secret_<your-key>

# Optional: For OAuth flow
SLACK_CLIENT_ID=<from-slack-app-settings>
SLACK_CLIENT_SECRET=<from-slack-app-settings>
```

### 3. Slack App Setup

1. **Create Slack App**
   - Go to https://api.slack.com/apps
   - Click "Create New App" → "From scratch"
   - Name: "Discussion Sync Bot" (or your preference)
   - Pick your development workspace

2. **Bot Token Scopes** (OAuth & Permissions)
   Add these Bot Token Scopes:
   - `channels:history` - Read channel messages
   - `channels:read` - View channel info
   - `chat:write` - Post messages
   - `reactions:write` - Add/remove reactions
   - `users:read` - Get user info
   - `app_mentions:read` - Receive mentions

3. **Install App to Workspace**
   - Click "Install to Workspace"
   - Copy the "Bot User OAuth Token" (starts with `xoxb-`)
   - This will be stored in your database as `apiToken` for the source config

4. **Get Signing Secret**
   - Go to "Basic Information"
   - Under "App Credentials", find "Signing Secret"
   - Copy and add to `.env` as `SLACK_SIGNING_SECRET`

---

## Local Testing with ngrok

### Step 1: Start Development Server

```bash
pnpm dev
```

Server should start on http://localhost:3000

### Step 2: Expose with ngrok

```bash
ngrok http 3000
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

### Step 3: Configure Slack Event Subscriptions

1. In your Slack app settings, go to "Event Subscriptions"
2. Turn on "Enable Events"
3. Set Request URL: `https://abc123.ngrok.io/api/webhook/slack/events`
4. Slack will send a verification challenge - your endpoint should automatically respond
5. Under "Subscribe to bot events", add:
   - `app_mention`
6. Click "Save Changes"

---

## Database Setup

### Step 1: Seed Source Definitions

```bash
tsx server/database/seed/cli.ts sources
```

This creates the Slack and Figma source type definitions.

### Step 2: Create Source Config

You need to create a source config record manually or via SQL:

```sql
INSERT INTO discussion_sync_sourceconfigs
(sourceId, name, teamId, owner, apiToken, notionToken, notionDatabaseId,
 aiEnabled, autoSync, postConfirmation, active, metadata)
VALUES
('slack', 'Test Slack Workspace', 'test-team-id', 'test-owner',
 '<your-slack-bot-token-xoxb>', '<your-notion-token>', '<your-notion-db-id>',
 true, true, true, true,
 '{"workspaceId": "<your-slack-team-id>"}');
```

**Important:**
- Replace `<your-slack-bot-token-xoxb>` with your Bot User OAuth Token
- Replace `<your-notion-token>` with your Notion integration token
- Replace `<your-notion-db-id>` with your Notion database ID
- Replace `<your-slack-team-id>` with your Slack workspace/team ID (you can find this in webhook payloads)

The `apiToken` will be automatically encrypted when inserted.

### Step 3: Create Notion Database

1. Create a new database in Notion
2. Add these properties (if not already present):
   - **Title** - Title
   - **Status** - Select/Status
   - **Description** - Text
   - **Source** - Text
   - **URL** - URL
3. Share the database with your Notion integration
4. Copy the database ID from the URL

---

## E2E Test Flow

### Test 1: Basic Mention

1. **Invite bot to a channel**
   ```
   /invite @YourBot
   ```

2. **Mention the bot**
   ```
   @YourBot help with this issue
   ```

3. **Expected behavior:**
   - Console logs show webhook received
   - Bot adds :clock: reaction to your message
   - Database record created in `discussion_sync_discussions`
   - Notion task created in your database
   - Bot posts confirmation message in thread
   - Reaction changes to :white_check_mark:

4. **Verify:**
   ```bash
   # Check database
   SELECT * FROM discussion_sync_discussions ORDER BY createdAt DESC LIMIT 1;

   # Check logs
   # Should see:
   # [Slack Webhook] Received event
   # [Slack Webhook] Processing app_mention event
   # [Slack Webhook] Discussion created: <id>
   ```

### Test 2: Threaded Conversation

1. **Start a thread and mention bot**
   - Create a message
   - Reply in thread mentioning bot
   - Add more replies

2. **Expected behavior:**
   - Bot captures entire thread context
   - All participants tracked
   - Thread link preserved

### Test 3: AI Summary

1. **Mention bot with longer context**
   ```
   @YourBot We need to refactor the authentication system.

   Current issues:
   - Session timeout too short
   - No refresh token support
   - Password reset flow is broken

   We should prioritize security improvements.
   ```

2. **Expected behavior:**
   - AI generates summary and action items
   - Summary included in Notion task description
   - Task title is meaningful (not just "Slack message")

### Test 4: Error Handling

**Test duplicate event:**
- Slack may retry webhooks
- Same event should be ignored (deduplication)

**Test invalid workspace:**
- Create source config with wrong `workspaceId`
- Bot should return 404 (no matching config found)

**Test missing tokens:**
- Temporarily set `SLACK_SIGNING_SECRET` to wrong value
- Webhook should reject with 401

---

## Debugging

### Check Logs

Watch server logs while testing:
```bash
pnpm dev
```

Look for:
- `[Slack Webhook] Received event`
- `[Slack Webhook] Event type: event_callback`
- `[Slack Webhook] Processing app_mention event`
- `[Slack Webhook] Discussion created: <id>`
- `[Slack Webhook] Processing triggered for discussion: <id>`

### Inspect Database

```bash
# View recent discussions
SELECT * FROM discussion_sync_discussions
ORDER BY createdAt DESC
LIMIT 5;

# View source configs
SELECT id, name, sourceId, teamId, active, metadata
FROM discussion_sync_sourceconfigs;

# Check if token is encrypted
SELECT apiToken FROM discussion_sync_sourceconfigs
WHERE sourceId = 'slack';
# Should show encrypted value, not plaintext
```

### Slack API Logs

- Go to your Slack app settings
- Navigate to "Event Subscriptions"
- Click "View Logs" to see all webhook deliveries
- Check for errors or retry attempts

### ngrok Logs

- ngrok web interface: http://localhost:4040
- Shows all HTTP requests and responses
- Useful for debugging webhook payloads

---

## Common Issues

### Issue 1: "Slack signature verification failed"

**Cause:** Incorrect `SLACK_SIGNING_SECRET` or clock skew

**Fix:**
1. Verify the signing secret in Slack app settings matches `.env`
2. Check server time: `date` (should be accurate)
3. In development, signature verification is skipped

### Issue 2: "No source config found for workspace"

**Cause:** Missing or incorrect `workspaceId` in source config metadata

**Fix:**
1. Check webhook payload in logs for `team_id`
2. Update source config:
   ```sql
   UPDATE discussion_sync_sourceconfigs
   SET metadata = json_set(metadata, '$.workspaceId', 'T123ABC')
   WHERE sourceId = 'slack';
   ```

### Issue 3: "Bot not responding to mentions"

**Checklist:**
- [ ] Bot invited to channel (`/invite @YourBot`)
- [ ] `app_mention` event subscription enabled
- [ ] Event subscription URL verified (shows checkmark)
- [ ] ngrok tunnel is active
- [ ] Server is running

### Issue 4: "Notion task not created"

**Checklist:**
- [ ] `NOTION_API_KEY` is valid
- [ ] Notion database ID is correct
- [ ] Notion integration has access to database
- [ ] Check logs for Notion API errors

### Issue 5: "Encryption key not configured"

**Fix:**
```bash
tsx server/utils/generate-encryption-key.ts
# Add output to .env as ENCRYPTION_KEY=...
```

---

## Performance Benchmarks

Expected latencies (95th percentile):
- Webhook receipt to database insert: < 200ms
- Database insert to processing start: < 500ms
- Full discussion sync (thread + AI + Notion): < 3s
- Reply posted back to Slack: < 5s total

---

## Next Steps After E2E Testing

Once local testing is successful:

1. ✅ Verify all flows work as expected
2. 📝 Document any issues or improvements needed
3. 🚀 Proceed to production deployment (see deployment checklist)
4. 🔍 Set up monitoring and alerts
5. 📊 Track metrics and performance

---

## Test Coverage Status

### ✅ Unit Tests (Passing)
- Slack Signature Verification: 17/17 tests ✅
- Slack Adapter: 30/30 tests ✅
- Slack Service: 50/50 tests ✅
- Slack Webhook: 14/14 tests ✅
- Encryption: 30/30 tests ✅
- LRU Cache: 18/18 tests ✅

### ⚠️ Integration Tests (Needs E2E)
- Full webhook → database → processing → Notion → reply flow
- Multi-message thread handling
- Error recovery and retries
- Rate limiting under load

---

**Document Version:** 1.0
**Last Updated:** 2025-11-10
**Next Review:** After E2E testing completion
