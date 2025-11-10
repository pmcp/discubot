# Figma Integration Quick Start Guide

This guide will help you set up and test the Figma-to-Notion integration.

---

## Prerequisites

1. Figma account with API access
2. Mailgun account (free tier works)
3. Domain with DNS access
4. Notion workspace with API access

---

## Step 1: Get API Keys

### Figma API Key
1. Go to https://www.figma.com/settings
2. Scroll to "Personal Access Tokens"
3. Click "Create a new personal access token"
4. Give it a name like "Discussion Sync"
5. Copy the token (starts with `figd_`)

### Mailgun API Key & Domain
1. Sign up at https://www.mailgun.com
2. Add and verify your domain (e.g., `mg.yourdomain.com`)
3. Get your webhook signing key from Settings > Webhooks
4. Copy the signing key

### Notion API Key
If you haven't already:
1. Go to https://www.notion.so/my-integrations
2. Create a new integration
3. Copy the Internal Integration Token

---

## Step 2: Configure Environment

Add to your `.env` file:

```bash
# AI & Notion (already configured in Phase 2)
ANTHROPIC_API_KEY=sk-ant-xxx...
NOTION_API_KEY=secret_xxx...

# Figma Integration (Phase 3)
FIGMA_API_KEY=figd_xxx...
MAILGUN_WEBHOOK_SECRET=whsec_xxx...
MAILGUN_DOMAIN=mg.yourdomain.com
```

---

## Step 3: Configure Mailgun DNS

Add these DNS records to your domain:

### SPF Record
```
Type: TXT
Host: mg.yourdomain.com
Value: v=spf1 include:mailgun.org ~all
```

### DKIM Record
```
Type: TXT
Host: mx._domainkey.mg.yourdomain.com
Value: [Get this from Mailgun dashboard]
```

### MX Records
```
Type: MX
Host: mg.yourdomain.com
Value: mxa.mailgun.org
Priority: 10

Type: MX
Host: mg.yourdomain.com
Value: mxb.mailgun.org
Priority: 10
```

**Note:** DNS propagation can take up to 48 hours, but usually happens within 15 minutes.

---

## Step 4: Configure Mailgun Route

In Mailgun dashboard (Routes section):

1. Click "Create Route"
2. Set Priority: `1`
3. Set Expression: `match_recipient("*@comments.yourdomain.com")`
4. Set Actions:
   - Forward to URL: `https://yourdomain.com/api/webhook/mailgun/figma`
   - Check "Stop"
5. Click "Create Route"

---

## Step 5: Create Source Config

In your database, create a source config for your team:

```sql
INSERT INTO discussion_sync_sourceconfigs (
  id,
  teamId,
  owner,
  sourceId,
  name,
  active,
  apiToken,
  notionToken,
  notionDatabaseId,
  notionFieldMapping,
  aiEnabled,
  autoSync,
  postConfirmation,
  metadata,
  createdBy,
  updatedBy
) VALUES (
  'figma-config-team-1',
  'your-team-id',
  'your-user-id',
  'figma-source-id',
  'Figma Comments',
  true,
  'figd_xxx...', -- Your Figma API key
  'secret_xxx...', -- Your Notion API key
  'your-notion-database-id',
  '{"title": "Name", "url": "URL"}', -- Notion field mapping
  true, -- Enable AI
  true, -- Auto sync
  true, -- Post confirmation
  '{"fileKey": ""}', -- Empty metadata, will be filled per-discussion
  'system',
  'system'
);
```

---

## Step 6: Configure Figma Notification Email

In your Figma file:

1. Click on a frame/component
2. Add a comment mentioning @Figbot
3. Click the three dots menu (···) in the comment
4. Click "Email notifications"
5. Add the email: `your-team-slug@comments.yourdomain.com`

**Important:** The email format is `{team-slug}@comments.yourdomain.com`
- Example: If your team ID is `acme-design`, use `acme-design@comments.yourdomain.com`

---

## Step 7: Test the Integration

### Method 1: Create a Test Comment

1. Go to your Figma file
2. Add a comment: `@Figbot please create a task for fixing the button alignment`
3. Figma will send an email to Mailgun
4. Mailgun forwards to your webhook
5. Check your logs for processing

### Method 2: Manual Webhook Test

You can test the webhook manually using curl:

```bash
curl -X POST https://yourdomain.com/api/webhook/mailgun/figma \
  -H "Content-Type: application/json" \
  -d '{
    "body-html": "<html><body><table><tr><td>@Figbot create a task</td></tr></table></body></html>",
    "From": "comments-ABC123XYZ@email.figma.com",
    "To": "your-team-slug@comments.yourdomain.com",
    "Subject": "Comment on Design System",
    "timestamp": "'$(date +%s)'",
    "token": "test-token-123",
    "signature": "test-signature"
  }'
```

**Note:** In development (no `MAILGUN_WEBHOOK_SECRET`), signature verification is skipped.

---

## Step 8: Verify Processing

### Check Discussion Created

```sql
SELECT * FROM discussion_sync_discussions
ORDER BY createdAt DESC
LIMIT 1;
```

### Check Sync Job Status

```sql
SELECT * FROM discussion_sync_syncjobs
WHERE discussionId = 'your-discussion-id';
```

### Check Notion Task Created

```sql
SELECT * FROM discussion_sync_tasks
WHERE jobId = 'your-job-id';
```

### Check Figma Reply

1. Go back to your Figma comment
2. You should see:
   - A reply from your bot with the Notion link
   - A ✅ emoji reaction on the root comment

---

## Troubleshooting

### "No HTML body found in email payload"
- Check that Mailgun is forwarding the full email body
- Verify your route configuration includes `forward()`

### "Failed to parse email"
- The email format may not match expected patterns
- Check logs for the HTML preview
- You may need to add a new parsing strategy

### "File key not found"
- Ensure the sender email contains the file key: `comments-FILEKEY@email.figma.com`
- Or ensure the email body contains a direct Figma link

### "Team not found"
- Verify the recipient email format: `team-slug@comments.yourdomain.com`
- Check that the team ID matches your database records

### "No active Figma config found"
- Ensure you created a source config (Step 5)
- Verify `active = true` in the config
- Check that `teamId` matches

### "Figma API access denied"
- Verify your Figma API key is correct
- Ensure the API key has access to the file
- Try generating a new token

### "Invalid Mailgun signature"
- Check that `MAILGUN_WEBHOOK_SECRET` is correct
- Verify timestamp is recent (within 15 minutes)
- In development, remove the secret to skip verification

---

## Monitoring

### View Recent Discussions

```sql
SELECT
  id,
  teamId,
  sourceType,
  title,
  status,
  createdAt
FROM discussion_sync_discussions
ORDER BY createdAt DESC
LIMIT 10;
```

### View Processing Logs

```sql
SELECT
  j.id,
  j.discussionId,
  j.status,
  j.currentStage,
  j.error,
  j.createdAt
FROM discussion_sync_syncjobs j
ORDER BY j.createdAt DESC
LIMIT 10;
```

### View Created Tasks

```sql
SELECT
  t.id,
  t.jobId,
  t.notionPageId,
  t.notionUrl,
  t.createdAt,
  d.title as discussionTitle
FROM discussion_sync_tasks t
JOIN discussion_sync_syncjobs j ON t.jobId = j.id
JOIN discussion_sync_discussions d ON j.discussionId = d.id
ORDER BY t.createdAt DESC
LIMIT 10;
```

---

## Next Steps

Once basic integration works:

1. **Test AI Processing**
   - Enable AI in config: `aiEnabled: true`
   - Add custom prompts for summary and task generation

2. **Customize Notion Mapping**
   - Map Figma fields to Notion properties
   - Add custom fields like Priority, Tags, etc.

3. **Set Up Multiple Teams**
   - Create configs for different teams
   - Use different email addresses: `team-a@comments...`, `team-b@comments...`

4. **Add Monitoring**
   - Set up alerts for failed jobs
   - Monitor processing times
   - Track success rates

5. **Optimize Performance**
   - Tune cache TTL settings
   - Adjust retry intervals
   - Configure circuit breaker thresholds

---

## Production Checklist

Before going to production:

- [ ] Mailgun domain verified and DNS records active
- [ ] Webhook secret configured and secure
- [ ] HTTPS enabled for webhook endpoint
- [ ] All API keys stored securely (not in git)
- [ ] Rate limiting configured
- [ ] Error monitoring in place (Sentry, etc.)
- [ ] Backup strategy for database
- [ ] Load testing completed
- [ ] Documentation shared with team
- [ ] Rollback plan prepared

---

## Support

For issues or questions:

1. Check the logs for detailed error messages
2. Review the Phase 3 implementation summary
3. Refer to the briefing document for architecture details
4. Open an issue in the repository

---

Happy syncing! 🎨 → 📝
