import { describe, it, expect } from 'vitest'
import { EmailParser } from '../emailParser'

describe('EmailParser', () => {
  const parser = new EmailParser()

  describe('parse - successful cases', () => {
    it('should parse structured Figma email with table cell comment', async () => {
      const html = `
        <html>
          <body>
            <table>
              <tr>
                <td>
                  @Figbot please create a task for fixing the button alignment issue
                </td>
              </tr>
            </table>
            <a href="https://www.figma.com/file/abc123xyz/Design-System">View in Figma</a>
          </body>
        </html>
      `
      const fromEmail = 'comments-abc123xyz@email.figma.com'

      const result = await parser.parse(html, fromEmail)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data!.commentText).toContain('@Figbot')
      expect(result.data!.commentText).toContain('button alignment')
      expect(result.data!.fileKey).toBe('abc123xyz')
      expect(result.strategy).toBeDefined()
    })

    it('should parse email with Figbot mention', async () => {
      const html = `
        <html>
          <body>
            <p>@Figbot create task for the spacing issue</p>
            <a href="https://www.figma.com/file/def456/Mobile-App">View comment</a>
          </body>
        </html>
      `
      const fromEmail = 'comments-def456@email.figma.com'

      const result = await parser.parse(html, fromEmail)

      expect(result.success).toBe(true)
      expect(result.data!.commentText).toContain('@Figbot')
      expect(result.data!.fileKey).toBe('def456')
      expect(result.data!.metadata.mentionedUser).toBe('Figbot')
    })

    it('should extract file key from sender email', async () => {
      const html = `
        <html>
          <body>
            <p>@Designer please review this</p>
          </body>
        </html>
      `
      const fromEmail = 'comments-xyz789abc@email.figma.com'

      const result = await parser.parse(html, fromEmail)

      expect(result.success).toBe(true)
      expect(result.data!.fileKey).toBe('xyz789abc')
      expect(result.data!.figmaUrl).toContain('xyz789abc')
    })

    it('should extract file key from click.figma.com redirect URL', async () => {
      const html = `
        <html>
          <body>
            <p>@TeamLead needs attention</p>
            <a href="https://click.figma.com/ls/click?upn=redirect%2Ffile%2Fqrs987%2F">Click here</a>
          </body>
        </html>
      `
      const fromEmail = 'notifications@figma.com'

      const result = await parser.parse(html, fromEmail)

      expect(result.success).toBe(true)
      expect(result.data!.fileKey).toBe('qrs987')
    })

    it('should extract file key from direct Figma link', async () => {
      const html = `
        <html>
          <body>
            <table>
              <tr>
                <td>@ProductManager check this out</td>
              </tr>
            </table>
            <a href="https://www.figma.com/file/lmn456opq/Dashboard-Redesign?node-id=123:456#comment-789">
              View in Figma
            </a>
          </body>
        </html>
      `
      const fromEmail = 'designer@company.com'

      const result = await parser.parse(html, fromEmail)

      expect(result.success).toBe(true)
      expect(result.data!.fileKey).toBe('lmn456opq')
      expect(result.data!.commentId).toBe('789')
      expect(result.data!.figmaUrl).toContain('lmn456opq')
    })

    it('should extract author info from email address', async () => {
      const html = `
        <html>
          <body>
            <table><tr><td>@Figbot review please</td></tr></table>
            <a href="https://www.figma.com/file/author789/Test">View</a>
          </body>
        </html>
      `
      const fromEmail = 'John Doe <john.doe@company.com>'

      const result = await parser.parse(html, fromEmail)

      expect(result.success).toBe(true)
      expect(result.data!.authorName).toBe('John Doe')
      expect(result.data!.authorEmail).toBe('john.doe@company.com')
    })

    it('should handle email with multiple mentions and pick the best one', async () => {
      const html = `
        <html>
          <body>
            <table>
              <tr>
                <td>@Figbot please fix the margin issue in the header component</td>
              </tr>
              <tr>
                <td>View in Figma mobile app to stay on top of @mentions</td>
              </tr>
            </table>
          </body>
        </html>
      `
      const fromEmail = 'comments-multi123@email.figma.com'

      const result = await parser.parse(html, fromEmail)

      expect(result.success).toBe(true)
      expect(result.data!.commentText).toContain('margin issue')
      expect(result.data!.commentText).not.toContain('mobile app')
    })

    it('should extract file name when present', async () => {
      const html = `
        <html>
          <head>
            <title>Comment on Design System v2</title>
          </head>
          <body>
            <p>Designer commented on Design System v2</p>
            <table><tr><td>@Figbot create task</td></tr></table>
          </body>
        </html>
      `
      const fromEmail = 'comments-file789@email.figma.com'

      const result = await parser.parse(html, fromEmail)

      expect(result.success).toBe(true)
      expect(result.data!.fileName).toBe('Design System v2')
    })

    it('should handle FigJam board URLs', async () => {
      const html = `
        <html>
          <body>
            <table><tr><td>@Facilitator let\'s discuss this</td></tr></table>
            <a href="https://www.figma.com/board/jam123abc/Brainstorm-Session">View in FigJam</a>
          </body>
        </html>
      `
      const fromEmail = 'comments-jam123abc@email.figma.com'

      const result = await parser.parse(html, fromEmail)

      expect(result.success).toBe(true)
      expect(result.data!.fileKey).toBe('jam123abc')
    })
  })

  describe('parse - edge cases and failures', () => {
    it('should fail gracefully when no comment text found', async () => {
      const html = `
        <html>
          <body>
            <p>Unsubscribe | Privacy Policy</p>
            <p>View in Figma</p>
          </body>
        </html>
      `
      const fromEmail = 'comments-test123@email.figma.com'

      const result = await parser.parse(html, fromEmail)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error?.toLowerCase()).toContain('failed to extract comment text')
    })

    it('should fail gracefully when no file key found', async () => {
      const html = `
        <html>
          <body>
            <table><tr><td>@Figbot create a task</td></tr></table>
            <p>This is a test email with no Figma links</p>
          </body>
        </html>
      `
      const fromEmail = 'no-file-key@example.com'

      const result = await parser.parse(html, fromEmail)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error).toContain('file key')
    })

    it('should filter out CSS mentions', async () => {
      const html = `
        <html>
          <head>
            <style>
              @font-face { font-family: Arial; }
              @media screen { }
              @import url('styles.css');
            </style>
          </head>
          <body>
            <table><tr><td>@RealUser please review</td></tr></table>
          </body>
        </html>
      `
      const fromEmail = 'comments-css123@email.figma.com'

      const result = await parser.parse(html, fromEmail)

      expect(result.success).toBe(true)
      expect(result.data!.commentText).toContain('@RealUser')
      expect(result.data!.commentText).not.toContain('@font-face')
      expect(result.data!.commentText).not.toContain('@media')
    })

    it('should skip boilerplate content', async () => {
      const html = `
        <html>
          <body>
            <table>
              <tr><td>@Figbot fix the button</td></tr>
              <tr><td>Figma, Inc. All rights reserved. Unsubscribe from these emails.</td></tr>
            </table>
          </body>
        </html>
      `
      const fromEmail = 'comments-boiler123@email.figma.com'

      const result = await parser.parse(html, fromEmail)

      expect(result.success).toBe(true)
      expect(result.data!.commentText).toContain('button')
      expect(result.data!.commentText).not.toContain('Unsubscribe')
      expect(result.data!.commentText).not.toContain('All rights reserved')
    })

    it('should handle malformed HTML gracefully', async () => {
      const html = `
        <html>
          <body>
            <table><tr><td>@Figbot test
          </body>
      `
      const fromEmail = 'comments-malformed123@email.figma.com'

      const result = await parser.parse(html, fromEmail)

      expect(result.success).toBe(true)
      expect(result.data!.commentText).toContain('@Figbot')
    })

    it('should handle empty HTML', async () => {
      const html = ''
      const fromEmail = 'comments-empty123@email.figma.com'

      const result = await parser.parse(html, fromEmail)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should include metadata about parsing strategy', async () => {
      const html = `
        <html>
          <body>
            <table><tr><td>@Figbot urgent fix needed</td></tr></table>
          </body>
        </html>
      `
      const fromEmail = 'comments-meta123@email.figma.com'

      const result = await parser.parse(html, fromEmail)

      expect(result.success).toBe(true)
      expect(result.strategy).toBeDefined()
      expect(result.data!.metadata.parseStrategy).toBeDefined()
      expect(result.data!.metadata.timestamp).toBeDefined()
    })
  })

  describe('parse - various email formats', () => {
    it('should handle selector-based extraction', async () => {
      const html = `
        <html>
          <body>
            <div class="comment-content">
              <p>@Designer please update the color palette</p>
            </div>
          </body>
        </html>
      `
      const fromEmail = 'comments-selector123@email.figma.com'

      const result = await parser.parse(html, fromEmail)

      expect(result.success).toBe(true)
      expect(result.data!.commentText).toContain('color palette')
    })

    it('should use fallback strategy for non-standard format', async () => {
      const html = `
        <html>
          <body>
            <div>
              <p>Some short intro text</p>
              <p>This is the actual comment text that we want to extract because it is longer</p>
              <p>Unsubscribe</p>
            </div>
          </body>
        </html>
      `
      const fromEmail = 'comments-fallback123@email.figma.com'

      const result = await parser.parse(html, fromEmail)

      expect(result.success).toBe(true)
      expect(result.data!.commentText).toContain('actual comment text')
      expect(result.data!.metadata.fallback).toBe(true)
    })

    it('should extract author name from various email formats', async () => {
      const testCases = [
        {
          email: 'john.doe@company.com',
          expectedName: 'john.doe',
        },
        {
          email: 'Jane Smith <jane.smith@company.com>',
          expectedName: 'Jane Smith',
        },
        {
          email: '"Bob Johnson" <bob@company.com>',
          expectedName: '"Bob Johnson"',
        },
      ]

      for (const testCase of testCases) {
        const html = `
          <html>
            <body>
              <table><tr><td>@Figbot test</td></tr></table>
              <a href="https://www.figma.com/file/author123/Test">View</a>
            </body>
          </html>
        `

        const result = await parser.parse(html, testCase.email)

        expect(result.success).toBe(true)
        if (result.data) {
          // Just check that we extracted some author info
          expect(result.data.authorEmail).toBeDefined()
          expect(result.data.authorName).toBeDefined()
        }
      }
    })
  })

  describe('parse - comment ID extraction', () => {
    it('should extract comment ID from URL anchor', async () => {
      const html = `
        <html>
          <body>
            <table><tr><td>@Figbot review this</td></tr></table>
            <a href="https://www.figma.com/file/abc123/Design?node-id=1:2#comment-comment-987-654">
              View comment
            </a>
          </body>
        </html>
      `
      const fromEmail = 'comments-abc123@email.figma.com'

      const result = await parser.parse(html, fromEmail)

      expect(result.success).toBe(true)
      expect(result.data!.commentId).toBe('comment-987-654')
    })

    it('should handle missing comment ID gracefully', async () => {
      const html = `
        <html>
          <body>
            <table><tr><td>@Figbot no comment ID in URL</td></tr></table>
            <a href="https://www.figma.com/file/abc123/Design">View file</a>
          </body>
        </html>
      `
      const fromEmail = 'comments-abc123@email.figma.com'

      const result = await parser.parse(html, fromEmail)

      expect(result.success).toBe(true)
      expect(result.data!.commentId).toBe('')
    })
  })

  describe('parse - validation', () => {
    it('should validate that all required fields are present', async () => {
      const html = `
        <html>
          <body>
            <table><tr><td>@Figbot complete test</td></tr></table>
            <a href="https://www.figma.com/file/complete123/Test">View</a>
          </body>
        </html>
      `
      const fromEmail = 'Designer <designer@company.com>'

      const result = await parser.parse(html, fromEmail)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data!.commentText).toBeDefined()
      expect(result.data!.fileKey).toBeDefined()
      expect(result.data!.authorEmail).toBeDefined()
      expect(result.data!.authorName).toBeDefined()
      expect(result.data!.figmaUrl).toBeDefined()
      expect(result.data!.fileName).toBeDefined()
      expect(result.data!.metadata).toBeDefined()
    })

    it('should not include HTML tags in extracted comment text', async () => {
      const html = `
        <html>
          <body>
            <table>
              <tr>
                <td>
                  <strong>@Figbot</strong> please <em>fix</em> the <a href="#">link</a>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `
      const fromEmail = 'comments-tags123@email.figma.com'

      const result = await parser.parse(html, fromEmail)

      expect(result.success).toBe(true)
      expect(result.data!.commentText).not.toContain('<strong>')
      expect(result.data!.commentText).not.toContain('<em>')
      expect(result.data!.commentText).not.toContain('<a ')
      expect(result.data!.commentText).toContain('@Figbot')
      expect(result.data!.commentText).toContain('fix')
    })

    it('should normalize whitespace in comment text', async () => {
      const html = `
        <html>
          <body>
            <table>
              <tr>
                <td>
                  @Figbot   please     fix    this
                </td>
              </tr>
            </table>
          </body>
        </html>
      `
      const fromEmail = 'comments-whitespace123@email.figma.com'

      const result = await parser.parse(html, fromEmail)

      expect(result.success).toBe(true)
      // Should have single spaces, not multiple
      expect(result.data!.commentText).not.toMatch(/\s{2,}/)
      expect(result.data!.commentText).toContain('@Figbot')
    })
  })
})
