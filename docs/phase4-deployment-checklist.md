# Phase 4 - Production Deployment Checklist

**Status:** 🟡 Ready for Deployment
**Date:** 2025-11-10
**Pre-requisites:** E2E testing completed successfully

---

## Pre-Deployment Checklist

### Code & Tests
- [x] All Slack integration code implemented
- [x] Unit tests passing (210+ tests)
- [x] Slack webhook tests passing (14/14)
- [ ] E2E tests completed successfully
- [ ] No critical bugs identified

### Environment Configuration
- [ ] Production encryption key generated
- [ ] All required environment variables documented
- [ ] Secrets stored securely (not in code)
- [ ] Database schema up to date

### Infrastructure
- [ ] NuxtHub account set up
- [ ] Domain configured (or using NuxtHub subdomain)
- [ ] Database provisioned
- [ ] SSL certificates configured

---

## Deployment Steps

### 1. Generate Production Secrets

```bash
# Generate encryption key
tsx server/utils/generate-encryption-key.ts
# Save output securely - you'll need it for NuxtHub env vars
```

### 2. Set Environment Variables in NuxtHub

Navigate to your NuxtHub project settings and add:

#### Required Variables
```bash
# Critical - Keep secure!
ENCRYPTION_KEY=<generated-256-bit-hex-key>

# Slack webhook verification
SLACK_SIGNING_SECRET=<from-slack-app-settings>

# API Keys
ANTHROPIC_API_KEY=sk-ant-<your-key>
NOTION_API_KEY=secret_<your-key>
```

#### Optional Variables (for OAuth)
```bash
SLACK_CLIENT_ID=<from-slack-app-settings>
SLACK_CLIENT_SECRET=<from-slack-app-settings>
```

#### Other Existing Variables
```bash
# Copy from your current .env if needed:
NUXT_SESSION_PASSWORD=<32-char-secret>
BASE_URL=https://your-domain.com

# ... other app-specific variables
```

### 3. Database Setup

#### Option A: Via NuxtHub CLI

```bash
# Seed source definitions
npx nuxthub database execute --sql "$(cat server/database/seed/sources.sql)"

# OR use seed script if available
npx nuxthub remote run tsx server/database/seed/cli.ts sources
```

#### Option B: Via SQL

Connect to your production database and run:

```sql
-- Insert Slack source definition
INSERT INTO discussion_sync_sources (id, name, description, active, features, config)
VALUES (
  'slack',
  'Slack',
  'Slack workspace integration with app_mention events',
  true,
  '["thread_support", "reactions", "user_mentions", "real_time"]',
  '{
    "webhookPath": "/api/webhook/slack/events",
    "requiresSignature": true,
    "eventTypes": ["app_mention", "message"]
  }'
);

-- Insert Figma source definition (if needed)
INSERT INTO discussion_sync_sources (id, name, description, active, features, config)
VALUES (
  'figma',
  'Figma',
  'Figma comments via email notifications',
  true,
  '["comments", "mentions", "file_links"]',
  '{
    "webhookPath": "/api/webhook/figma/inbound",
    "requiresEmail": true,
    "emailProvider": "mailgun"
  }'
);
```

### 4. Create Initial Source Config

```sql
INSERT INTO discussion_sync_sourceconfigs
(sourceId, name, teamId, owner, apiToken, notionToken, notionDatabaseId,
 aiEnabled, autoSync, postConfirmation, active, metadata, createdBy, updatedBy)
VALUES
('slack', 'Production Slack', '<your-team-id>', '<owner-id>',
 '<slack-bot-token-xoxb>', '<notion-token>', '<notion-db-id>',
 true, true, true, true,
 '{"workspaceId": "<slack-workspace-id>"}',
 'deployment-script', 'deployment-script');
```

**Note:** The `apiToken` will be automatically encrypted on insert.

### 5. Deploy Application

#### Via NuxtHub Dashboard
1. Push code to your git repository
2. NuxtHub will automatically build and deploy
3. Wait for deployment to complete

#### Via CLI
```bash
# Deploy to NuxtHub
pnpm run deploy

# OR via Git (if configured)
git push nuxthub main
```

### 6. Update Slack App Configuration

1. Go to https://api.slack.com/apps
2. Select your app
3. Navigate to "Event Subscriptions"
4. Update Request URL to: `https://your-domain.com/api/webhook/slack/events`
5. Slack will verify the endpoint (should see checkmark)
6. Save changes

### 7. Verify Deployment

#### Health Check
```bash
curl https://your-domain.com/api/health
# Should return { "status": "ok", ... }
```

#### Test Slack Webhook
1. Go to your Slack workspace
2. Invite bot to a test channel: `/invite @YourBot`
3. Mention the bot: `@YourBot test production deployment`
4. Verify:
   - Bot adds reaction
   - Discussion created in database
   - Notion task created
   - Bot replies with confirmation

---

## Post-Deployment

### 1. Monitor Initial Traffic

Check logs for:
- Successful webhook deliveries
- Any errors or warnings
- Performance metrics

### 2. Set Up Monitoring

#### Error Tracking (Optional but Recommended)
- Set up Sentry or similar service
- Add Sentry DSN to environment variables
- Track webhook failures, API errors, processing failures

#### Uptime Monitoring
- Set up uptime monitoring (e.g., UptimeRobot, Pingdom)
- Monitor: `https://your-domain.com/api/health`
- Alert frequency: Every 5 minutes

#### Metrics to Track
- Webhook receipt to discussion creation: < 200ms target
- Discussion processing time: < 3s target
- Notion API success rate: > 99%
- Slack API success rate: > 99%

### 3. Set Up Alerts

Configure alerts for:
- [ ] Application errors (5xx responses)
- [ ] Webhook failures (repeated 4xx/5xx from Slack)
- [ ] Database connection issues
- [ ] High API latency (> 5s)
- [ ] Rate limit warnings

---

## Rollback Plan

If issues occur after deployment:

### Quick Rollback via NuxtHub
1. Go to NuxtHub dashboard
2. Navigate to "Deployments"
3. Click "Rollback" on the previous deployment
4. Update Slack webhook URL if needed

### Via Git
```bash
git revert <commit-hash>
git push nuxthub main
```

### Database Rollback (if needed)
- Keep backup of database before major migrations
- Document any data changes made during deployment
- Have SQL scripts ready to reverse schema changes

---

## Security Checklist

- [ ] All secrets stored in environment variables (not in code)
- [ ] Encryption key generated securely and stored safely
- [ ] Slack signature verification enabled in production
- [ ] API tokens encrypted in database
- [ ] HTTPS enforced (should be automatic with NuxtHub)
- [ ] Database access restricted
- [ ] No sensitive data in logs
- [ ] Rate limiting configured

---

## Performance Optimization

### Database Indexes
Ensure these indexes exist (created via schema):

```sql
-- Check indexes
SELECT name, tbl_name, sql
FROM sqlite_master
WHERE type = 'index'
  AND tbl_name LIKE 'discussion_sync%';
```

Expected indexes:
- `discussion_sync_discussions` on `sourceThreadId`
- `discussion_sync_discussions` on `status`
- `discussion_sync_discussions` on `teamId`
- `discussion_sync_sourceconfigs` on `sourceId`

### Caching
- Slack Service uses LRU cache for:
  - User info (5-minute TTL)
  - Channel info (5-minute TTL)
  - Thread messages (1-minute TTL)

### Rate Limiting
- Slack API: 1 request/second per method (handled automatically)
- Notion API: 3 requests/second (handled by Notion client)
- Circuit breaker: Opens after 5 consecutive failures

---

## Known Limitations

1. **Deduplication via Database**
   - Currently checks database for duplicate events
   - Future: Use KV store (Cloudflare KV) for faster lookups

2. **No Background Job Queue**
   - Processing is fire-and-forget
   - Future: Implement BullMQ or similar for retry logic

3. **Team Resolution**
   - Currently extracts team from email (SuperSaaS email format)
   - Future: Look up actual team in SuperSaaS database

4. **No Admin UI**
   - Source configs must be created via SQL
   - Future: Build admin interface

---

## Future Enhancements (Phase 5+)

### Priority 1: Reliability
- [ ] KV-based webhook deduplication
- [ ] Background job queue (BullMQ)
- [ ] Improved error tracking

### Priority 2: User Experience
- [ ] Slack OAuth flow
- [ ] Admin UI for source configs
- [ ] Team management interface

### Priority 3: Features
- [ ] SuperSaaS team resolution
- [ ] Rate limiting per team
- [ ] Metrics dashboard
- [ ] Multi-workspace support

---

## Troubleshooting Production Issues

### Issue: High error rate

1. Check application logs
2. Verify environment variables are set
3. Test database connectivity
4. Check Slack API status
5. Verify Notion API status

### Issue: Webhooks not being received

1. Check Slack Event Subscriptions logs
2. Verify webhook URL is correct
3. Test endpoint manually:
   ```bash
   curl https://your-domain.com/api/webhook/slack/events
   ```
4. Check Slack retry queue

### Issue: Slow response times

1. Check database query performance
2. Review API call patterns
3. Check for rate limiting
4. Verify caching is working

---

## Support & Documentation

### Internal Resources
- Architecture: `docs/discussion-sync-architecture.md`
- Implementation: `docs/discussion-sync-implementation-progress.md`
- Testing: `docs/phase4-e2e-testing-guide.md`
- Phase 4 Briefing: `docs/phase4-next-steps-briefing.md`

### External Resources
- Slack Events API: https://api.slack.com/apis/connections/events-api
- NuxtHub Docs: https://hub.nuxt.com/docs
- Notion API: https://developers.notion.com/

---

## Deployment Sign-Off

Before marking Phase 4 as complete, verify:

- [ ] All pre-deployment checklist items completed
- [ ] Deployment successful (no errors)
- [ ] Post-deployment verification passed
- [ ] Monitoring configured
- [ ] Team notified of new feature
- [ ] Documentation updated

---

**Deployed By:** _________________
**Date:** _________________
**Verified By:** _________________
**Production URL:** _________________

---

**Document Version:** 1.0
**Last Updated:** 2025-11-10
**Status:** 🟢 Ready for Production
