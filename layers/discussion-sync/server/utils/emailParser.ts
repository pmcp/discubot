/**
 * Email Parser Utility - Extracts Figma comment data from HTML emails
 *
 * This parser implements multiple strategies to extract comment data from Figma emails,
 * with all improvements from the Phase 3 briefing implemented.
 */

import * as cheerio from 'cheerio'
import type { CheerioAPI } from 'cheerio'

// ============================================
// CONSTANTS
// ============================================

const EMAIL_PATTERNS = {
  COMMENT_MARKERS: ['View comment', 'View in Figma', 'commented on'],
  FILE_MARKERS: ['design file', 'Figma file', 'file:', 'commented on'],
  URL_PATTERN: /https:\/\/(www\.)?figma\.com\/(file|board)\/([a-zA-Z0-9]+)/gi,
  COMMENT_ID_PATTERN: /#comment-([a-zA-Z0-9_-]+)/,
  FILE_KEY_FROM_EMAIL: /comments-([a-zA-Z0-9]+)@/i,
  MENTION_PATTERN: /@([A-Za-z0-9_]+)/g,
  CSS_MENTION_FILTER: /@(font-face|media|import|keyframes|charset|supports|mentions)/gi,
} as const

const BOILERPLATE_PATTERNS = [
  'unsubscribe',
  'privacy policy',
  'Figma, Inc',
  'mobile app',
  'stay on top',
  'View in Figma',
] as const

const PARSER_CONFIG = {
  MAX_COMMENT_LENGTH: 500,
  MIN_COMMENT_LENGTH: 5,
  CONTEXT_CHARS_BEFORE: 100,
  CONTEXT_CHARS_AFTER: 100,
  HTML_PREVIEW_LENGTH: 200,
} as const

// ============================================
// TYPES
// ============================================

export interface FigmaEmailData {
  commentText: string
  fileKey: string
  commentId: string
  fileName: string
  authorEmail: string
  authorName: string
  figmaUrl: string
  metadata: Record<string, unknown>
}

export interface ParseResult {
  success: boolean
  data?: FigmaEmailData
  error?: string
  strategy?: string // Which parsing strategy worked
}

// ============================================
// PARSING STRATEGIES
// ============================================

/**
 * Abstract base class for parsing strategies
 */
abstract class EmailParserStrategy {
  abstract readonly name: string

  abstract parse(html: string, $: CheerioAPI, fromEmail: string): Partial<FigmaEmailData> | null

  /**
   * Check if text is boilerplate content
   */
  protected isBoilerplate(text: string): boolean {
    const lowerText = text.toLowerCase()
    return BOILERPLATE_PATTERNS.some(pattern =>
      lowerText.includes(pattern.toLowerCase())
    )
  }

  /**
   * Clean text by removing HTML entities and normalizing whitespace
   */
  protected cleanText(text: string): string {
    return text
      .replace(/&[a-z]+;/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  /**
   * Check if text looks like CSS or navigation content
   */
  protected isCssOrNavigation(text: string): boolean {
    const lowerText = text.toLowerCase()
    const cssKeywords = ['font-family', 'font-size', 'padding', 'margin', 'background', 'border']
    return cssKeywords.some(keyword => lowerText.includes(keyword))
  }
}

/**
 * Strategy 1: Extract from structured content (mentions in table cells)
 */
class StructuredContentStrategy extends EmailParserStrategy {
  readonly name = 'StructuredContent'

  parse(html: string, $: CheerioAPI, fromEmail: string): Partial<FigmaEmailData> | null {
    // Look for @mentions in table cells (common Figma email structure)
    const tdPattern = /<td[^>]*>([^<]*@[A-Za-z0-9_]+[^<]*)<\/td>/gi
    const tdMatches = Array.from(html.matchAll(tdPattern))

    for (const tdMatch of tdMatches) {
      const cellContent = this.cleanText(tdMatch[1])

      // Check if this cell contains a real comment
      if (
        cellContent.includes('@') &&
        !this.isBoilerplate(cellContent) &&
        !this.isCssOrNavigation(cellContent) &&
        cellContent.length >= PARSER_CONFIG.MIN_COMMENT_LENGTH &&
        cellContent.length <= PARSER_CONFIG.MAX_COMMENT_LENGTH
      ) {
        const mentionMatch = cellContent.match(EMAIL_PATTERNS.MENTION_PATTERN)
        if (mentionMatch && mentionMatch[0]) {
          return {
            commentText: cellContent,
            metadata: {
              extractedMention: mentionMatch[0],
            },
          }
        }
      }
    }

    return null
  }
}

/**
 * Strategy 2: Extract from specific Figbot mentions
 */
class FigbotMentionStrategy extends EmailParserStrategy {
  readonly name = 'FigbotMention'

  parse(html: string, $: CheerioAPI, fromEmail: string): Partial<FigmaEmailData> | null {
    const figbotPattern = /@[Ff]igbot(?:\s+[^<>@]*)?/gi
    const figbotMentions = Array.from(html.matchAll(figbotPattern))
      .map(match => this.cleanText(match[0])) // Clean the text to normalize whitespace
      .filter(mention => mention.length > 7) // More than just "@Figbot"
      .sort((a, b) => b.length - a.length) // Longest first

    if (figbotMentions.length > 0 && figbotMentions[0]) {
      return {
        commentText: figbotMentions[0],
        metadata: {
          mentionedUser: 'Figbot',
        },
      }
    }

    return null
  }
}

/**
 * Strategy 3: Extract from context around mentions
 */
class MentionContextStrategy extends EmailParserStrategy {
  readonly name = 'MentionContext'

  parse(html: string, $: CheerioAPI, fromEmail: string): Partial<FigmaEmailData> | null {
    // Find all mentions, filtering out CSS rules
    const allMentions = Array.from(html.matchAll(EMAIL_PATTERNS.MENTION_PATTERN))
      .map(match => match[0])
      .filter(mention => {
        const mentionLower = mention.toLowerCase()
        return !EMAIL_PATTERNS.CSS_MENTION_FILTER.test(mentionLower) &&
               !mention.includes('@email') &&
               !mention.includes('@mail')
      })

    for (const mention of allMentions) {
      // Look for the mention with surrounding context
      const escapedMention = mention.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const contextPattern = new RegExp(
        `(.{0,${PARSER_CONFIG.CONTEXT_CHARS_BEFORE}})(${escapedMention})(.{0,${PARSER_CONFIG.CONTEXT_CHARS_AFTER}})`,
        'i'
      )
      const contextMatch = html.match(contextPattern)

      if (contextMatch) {
        const fullText = this.cleanText(
          (contextMatch[1] || '') + (contextMatch[2] || '') + (contextMatch[3] || '')
        )

        // Validate it looks like a real comment
        if (
          fullText.length >= PARSER_CONFIG.MIN_COMMENT_LENGTH &&
          fullText.length <= PARSER_CONFIG.MAX_COMMENT_LENGTH &&
          !this.isCssOrNavigation(fullText) &&
          !this.isBoilerplate(fullText)
        ) {
          return {
            commentText: fullText,
            metadata: {
              extractedMention: mention,
            },
          }
        }
      }
    }

    return null
  }
}

/**
 * Strategy 4: Extract from cheerio selectors
 */
class SelectorBasedStrategy extends EmailParserStrategy {
  readonly name = 'SelectorBased'

  parse(html: string, $: CheerioAPI, fromEmail: string): Partial<FigmaEmailData> | null {
    const possibleSelectors = [
      '.comment-content',
      '.message-content',
      'td[style*="font-size: 14px"] p',
      'td[style*="font-family"] p',
      'div[style*="background-color: #f"] p',
      'table table td p',
    ]

    for (const selector of possibleSelectors) {
      const elements = $(selector)
      let foundText: string | null = null

      elements.each((_: number, el: cheerio.Element) => {
        const text = $(el).text().trim()

        if (
          text.length >= PARSER_CONFIG.MIN_COMMENT_LENGTH &&
          (text.includes('@') || text.length > 20) &&
          !this.isBoilerplate(text) &&
          !this.isCssOrNavigation(text)
        ) {
          foundText = text
          return false // Break from each()
        }
      })

      if (foundText) {
        return {
          commentText: foundText,
          metadata: {
            selector,
          },
        }
      }
    }

    return null
  }
}

/**
 * Strategy 5: Fallback - longest non-boilerplate text
 */
class FallbackTextStrategy extends EmailParserStrategy {
  readonly name = 'FallbackText'

  parse(html: string, $: CheerioAPI, fromEmail: string): Partial<FigmaEmailData> | null {
    const allText: string[] = []

    $('p, td').each((_: number, el: cheerio.Element) => {
      const text = $(el).text().trim()

      if (
        text.length >= PARSER_CONFIG.MIN_COMMENT_LENGTH &&
        !this.isBoilerplate(text) &&
        !this.isCssOrNavigation(text)
      ) {
        allText.push(text)
      }
    })

    // Sort by length and pick the longest
    allText.sort((a, b) => b.length - a.length)

    if (allText.length > 0 && allText[0]) {
      return {
        commentText: allText[0],
        metadata: {
          fallback: true,
        },
      }
    }

    return null
  }
}

// ============================================
// EMAIL PARSER CLASS
// ============================================

export class EmailParser {
  private strategies: EmailParserStrategy[]

  constructor() {
    // Strategies are tried in order
    this.strategies = [
      new FigbotMentionStrategy(),
      new StructuredContentStrategy(),
      new MentionContextStrategy(),
      new SelectorBasedStrategy(),
      new FallbackTextStrategy(),
    ]
  }

  /**
   * Parse Figma comment email HTML
   */
  async parse(html: string, fromEmail: string): Promise<ParseResult> {
    try {
      const $ = cheerio.load(html)

      // Try each strategy in order
      let commentText: string | null = null
      let strategy: string | null = null
      let metadata: Record<string, unknown> = {}

      for (const strat of this.strategies) {
        try {
          const result = strat.parse(html, $, fromEmail)

          if (result && result.commentText) {
            commentText = result.commentText
            strategy = strat.name
            metadata = { ...metadata, ...result.metadata }
            console.log(`[Email Parser] Success with strategy: ${strategy}`)
            break
          }
        }
        catch (error) {
          console.error(`[Email Parser] Strategy ${strat.name} failed:`, {
            error: error instanceof Error ? error.message : String(error),
            htmlPreview: html.substring(0, PARSER_CONFIG.HTML_PREVIEW_LENGTH),
          })
          // Continue to next strategy
        }
      }

      if (!commentText) {
        throw new Error('[Email Parser] All strategies failed to extract comment text')
      }

      // Extract file data
      const fileData = this.extractFileData(html, $, fromEmail)

      if (!fileData.fileKey) {
        throw new Error('[Email Parser] Failed to extract file key')
      }

      // Extract author info
      const author = this.extractAuthor(fromEmail, html, $)

      // Build complete data
      const data: FigmaEmailData = {
        commentText,
        fileKey: fileData.fileKey,
        commentId: fileData.commentId || '',
        fileName: fileData.fileName || 'Untitled',
        authorEmail: author.email,
        authorName: author.name,
        figmaUrl: fileData.figmaUrl || `https://www.figma.com/file/${fileData.fileKey}`,
        metadata: {
          ...metadata,
          parseStrategy: strategy,
          timestamp: new Date().toISOString(),
        },
      }

      // Validate completeness
      const validatedData = this.validate(data)

      if (!validatedData) {
        throw new Error('[Email Parser] Validation failed - incomplete data')
      }

      return {
        success: true,
        data: validatedData,
        strategy: strategy || 'unknown',
      }
    }
    catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('[Email Parser] Parse failed:', {
        error: errorMessage,
        htmlPreview: html.substring(0, PARSER_CONFIG.HTML_PREVIEW_LENGTH),
      })

      return {
        success: false,
        error: errorMessage,
      }
    }
  }

  /**
   * Validate parsed data is complete
   */
  private validate(data: Partial<FigmaEmailData>): FigmaEmailData | null {
    // Check required fields
    if (
      !data.commentText ||
      !data.fileKey ||
      !data.authorEmail ||
      !data.figmaUrl
    ) {
      console.warn('[Email Parser] Validation failed - missing required fields:', {
        hasCommentText: !!data.commentText,
        hasFileKey: !!data.fileKey,
        hasAuthorEmail: !!data.authorEmail,
        hasFigmaUrl: !!data.figmaUrl,
      })
      return null
    }

    return data as FigmaEmailData
  }

  /**
   * Extract file key, comment ID, file name, and URL from HTML
   */
  private extractFileData(
    html: string,
    $: CheerioAPI,
    fromEmail: string
  ): {
    fileKey: string | null
    commentId: string | null
    fileName: string | null
    figmaUrl: string | null
  } {
    let fileKey: string | null = null
    let figmaUrl: string | null = null
    let commentId: string | null = null

    // FIRST: Try to extract file key from sender email address
    // Format: comments-[FILEKEY]@email.figma.com
    const emailKeyMatch = fromEmail.match(EMAIL_PATTERNS.FILE_KEY_FROM_EMAIL)
    if (emailKeyMatch && emailKeyMatch[1]) {
      fileKey = emailKeyMatch[1]
      figmaUrl = `https://www.figma.com/file/${fileKey}`
      console.log('[Email Parser] Extracted file key from sender email:', fileKey)
    }

    // SECOND: Try to extract from click.figma.com redirect links
    if (!fileKey) {
      const clickFigmaLink = html.match(/href="(https?:\/\/click\.figma\.com[^"]+)"/)

      if (clickFigmaLink && clickFigmaLink[1]) {
        try {
          const decoded = decodeURIComponent(clickFigmaLink[1])
          // Try multiple patterns for redirect URLs
          const fileMatch = decoded.match(/figma\.com\/(file|board)\/([a-zA-Z0-9]+)/) ||
                           decoded.match(/\/file\/([a-zA-Z0-9]+)/)

          if (fileMatch) {
            fileKey = fileMatch[2] || fileMatch[1]
            figmaUrl = `https://www.figma.com/file/${fileKey}`
            console.log('[Email Parser] Extracted file key from redirect URL:', fileKey)
          }
        }
        catch (e) {
          console.log('[Email Parser] Could not decode redirect URL')
        }
      }
    }

    // THIRD: Try direct Figma file links
    if (!fileKey) {
      const matches = Array.from(html.matchAll(EMAIL_PATTERNS.URL_PATTERN))

      for (const match of matches) {
        // Skip email tracking links
        if (match[0].includes('email.figma.com') || match[0].includes('/email/')) {
          continue
        }

        if (match[3]) {
          fileKey = match[3]
          figmaUrl = match[0]
          console.log('[Email Parser] Found direct Figma file link:', figmaUrl)
          break
        }
      }
    }

    // Extract comment ID from URL if present
    if (figmaUrl) {
      const commentMatch = figmaUrl.match(EMAIL_PATTERNS.COMMENT_ID_PATTERN)
      if (commentMatch && commentMatch[1]) {
        commentId = commentMatch[1]
      }
    }

    // Also try to extract comment ID from HTML links if not found yet
    if (!commentId) {
      const allLinks = Array.from(html.matchAll(/href="([^"]*#comment-[^"]+)"/gi))
      for (const linkMatch of allLinks) {
        if (linkMatch[1]) {
          const commentIdMatch = linkMatch[1].match(EMAIL_PATTERNS.COMMENT_ID_PATTERN)
          if (commentIdMatch && commentIdMatch[1]) {
            commentId = commentIdMatch[1]
            // Update figmaUrl to include comment anchor if we found it
            if (figmaUrl && !figmaUrl.includes('#comment')) {
              figmaUrl = linkMatch[1]
            }
            break
          }
        }
      }
    }

    // Extract file name
    let fileName: string | null = null
    const fileNameMatch =
      html.match(/commented on\s+(.+?)(?:<|$|\n)/i) ||
      html.match(/file:?\s*(.+?)(?:<|$|\n)/i) ||
      html.match(/<title>.*?on\s+(.+?)<\/title>/i)

    if (fileNameMatch && fileNameMatch[1]) {
      fileName = fileNameMatch[1].replace(/<[^>]*>/g, '').trim()
    }

    return { fileKey, commentId, fileName, figmaUrl }
  }

  /**
   * Extract author info from email headers
   */
  private extractAuthor(
    fromEmail: string,
    html: string,
    $: CheerioAPI
  ): { name: string; email: string } {
    // Extract email address
    const emailMatch = fromEmail.match(/([^<\s]+@[^>\s]+)/)
    const email = emailMatch ? emailMatch[1] : fromEmail

    // Try to extract name from "Name <email>" format
    const nameMatch = fromEmail.match(/^([^<]+)</)
    let name = nameMatch ? nameMatch[1].trim() : email.split('@')[0] || 'unknown'

    // Try to find name in HTML
    if (!nameMatch) {
      const userPatterns = [
        /from[:\s]+([^<\n]+)/i,
        /by[:\s]+([^<\n]+)/i,
        /@([a-zA-Z0-9_]+)/,
      ]

      for (const pattern of userPatterns) {
        const match = html.match(pattern)
        if (match && match[1]) {
          name = match[1].trim().replace('@', '')
          break
        }
      }
    }

    return { name, email }
  }
}