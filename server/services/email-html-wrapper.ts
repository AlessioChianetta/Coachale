/**
 * Professional Email HTML Wrapper
 * 
 * Wraps email content in a beautifully designed, responsive HTML template
 * with perfect typography, consistent spacing, and tracking capabilities.
 * 
 * Design Principles:
 * - Font sizes: 24px titles, 18px subtitles, 16px body, 14px small
 * - Line height: 1.6 minimum for readability
 * - Consistent spacing: 20px base, 30px sections, 40px major
 * - Colors: #2563eb (blue), #7c3aed (purple), #10b981 (green)
 * - Responsive: Works on all email clients and devices
 */

import * as cheerio from 'cheerio';
import * as crypto from 'crypto';

export interface EmailWrapperOptions {
  subject: string;
  clientName: string;
  consultantName?: string;
  trackingPixelUrl?: string;
}

/**
 * Wraps email content in a professional HTML template
 * with perfect typography and responsive design
 */
export function wrapEmailInProfessionalTemplate(
  content: string,
  options: EmailWrapperOptions
): string {
  const consultantSignature = options.consultantName || "Il Tuo Consulente";
  const trackingPixel = options.trackingPixelUrl 
    ? `<img src="${options.trackingPixelUrl}" alt="" width="1" height="1" style="display:block;border:0;width:1px;height:1px;opacity:0;" />`
    : '';

  return `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${options.subject}</title>
  <style type="text/css">
    /* Reset */
    body {
      margin: 0;
      padding: 0;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table {
      border-collapse: collapse;
      border-spacing: 0;
    }
    img {
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
    }
    
    /* Base typography for perfect readability */
    .email-body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 16px;
      line-height: 1.6;
      color: #1e293b;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    
    /* Responsive */
    @media only screen and (max-width: 600px) {
      .email-container {
        width: 100% !important;
      }
      .email-content {
        padding: 20px !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
  
  <!-- Email Container -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; padding: 20px 0;">
    <tr>
      <td align="center">
        <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.08);">
          
          <!-- Header with gradient -->
          <tr>
            <td style="background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; line-height: 1.3; letter-spacing: -0.5px;">
                ${options.subject}
              </h1>
              <p style="margin: 10px 0 0 0; font-size: 16px; color: rgba(255,255,255,0.9); line-height: 1.5;">
                Ogni passo ti avvicina alla tua libertà
              </p>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td class="email-content" style="padding: 40px 30px; font-size: 16px; line-height: 1.75; color: #334155;">
              ${processContentForPerfectTypography(content)}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 15px 0; font-size: 16px; font-weight: 600; color: #1e293b;">
                ${consultantSignature}
              </p>
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #64748b; line-height: 1.6;">
                <strong>Coachale Platform</strong><br/>
                La tua crescita, il nostro impegno
              </p>
              <p style="margin: 10px 0 0 0; font-size: 12px; color: #94a3b8;">
                © ${new Date().getFullYear()} Coachale Platform. Tutti i diritti riservati.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
  
  ${trackingPixel}
  
</body>
</html>
  `.trim();
}

/**
 * Converts markdown syntax to HTML tags
 * Safety net in case AI generates markdown instead of HTML
 */
function convertMarkdownToHtml(text: string): string {
  let result = text;
  
  // Convert **bold text** to <strong>bold text</strong>
  // Use negative lookbehind/lookahead to avoid matching HTML attributes
  result = result.replace(/(?<!\\)\*\*(?![\s*])([^\*]+?)(?<![\s*])\*\*(?!>)/g, '<strong>$1</strong>');
  
  // Convert *italic text* to <em>italic text</em>
  // But not if it's part of ** (already converted above)
  result = result.replace(/(?<![\*\\])\*(?![\s\*])([^\*]+?)(?<![\s\*])\*(?![\*>])/g, '<em>$1</em>');
  
  return result;
}

/**
 * Enhances existing email HTML with perfect typography
 * Works on already-generated HTML from AI to ensure consistency
 */
export function enhanceEmailTypography(html: string, trackingPixelUrl?: string): string {
  // First convert any markdown to HTML as safety net
  let htmlWithoutMarkdown = convertMarkdownToHtml(html);
  
  // Then apply typography enhancements
  let enhanced = processContentForPerfectTypography(htmlWithoutMarkdown);
  
  // Add tracking pixel at the end if provided
  if (trackingPixelUrl) {
    const trackingPixel = `<img src="${trackingPixelUrl}" alt="" width="1" height="1" style="display:block;border:0;width:1px;height:1px;opacity:0;position:absolute;" />`;
    // Insert before closing body or at the end
    if (enhanced.includes('</body>')) {
      enhanced = enhanced.replace('</body>', `${trackingPixel}</body>`);
    } else if (enhanced.includes('</html>')) {
      enhanced = enhanced.replace('</html>', `${trackingPixel}</html>`);
    } else {
      enhanced += trackingPixel;
    }
  }
  
  return enhanced;
}

/**
 * Processes HTML content to ensure perfect typography
 * Uses cheerio to properly merge styles without creating duplicate attributes
 */
function processContentForPerfectTypography(html: string): string {
  try {
    // Load HTML with cheerio - load as fragment to avoid adding html/body wrapper
    const $ = cheerio.load(html, {
      xml: false,
      decodeEntities: false,
      // Don't add document structure wrapper
      _useHtmlParser2: true
    }, false); // Third parameter false = don't add root element

    // Helper to merge styles
    const mergeStyles = (el: cheerio.Cheerio, newStyles: Record<string, string>) => {
      const existingStyle = el.attr('style') || '';
      const styleObj: Record<string, string> = {};
      
      // Parse existing styles
      existingStyle.split(';').forEach(rule => {
        const [prop, value] = rule.split(':').map(s => s.trim());
        if (prop && value) {
          styleObj[prop] = value;
        }
      });
      
      // Merge new styles (existing styles take precedence)
      Object.entries(newStyles).forEach(([prop, value]) => {
        if (!styleObj[prop]) {
          styleObj[prop] = value;
        }
      });
      
      // Convert back to string
      const mergedStyle = Object.entries(styleObj)
        .map(([prop, value]) => `${prop}: ${value}`)
        .join('; ');
      
      el.attr('style', mergedStyle);
    };

    // Fix paragraphs
    $('p').each((_, elem) => {
      mergeStyles($(elem), {
        'margin': '0 0 20px 0',
        'font-size': '16px',
        'line-height': '1.75',
        'color': '#334155'
      });
    });

    // Fix H1
    $('h1').each((_, elem) => {
      mergeStyles($(elem), {
        'margin': '0 0 20px 0',
        'font-size': '24px',
        'font-weight': '700',
        'line-height': '1.3',
        'color': '#0f172a',
        'letter-spacing': '-0.5px'
      });
    });

    // Fix H2
    $('h2').each((_, elem) => {
      mergeStyles($(elem), {
        'margin': '30px 0 16px 0',
        'font-size': '20px',
        'font-weight': '700',
        'line-height': '1.4',
        'color': '#1e293b',
        'letter-spacing': '-0.3px'
      });
    });

    // Fix H3
    $('h3').each((_, elem) => {
      mergeStyles($(elem), {
        'margin': '24px 0 12px 0',
        'font-size': '18px',
        'font-weight': '600',
        'line-height': '1.4',
        'color': '#334155'
      });
    });

    // Fix strong/bold
    $('strong').each((_, elem) => {
      mergeStyles($(elem), {
        'font-weight': '700',
        'color': '#0f172a'
      });
    });

    // Fix links
    $('a').each((_, elem) => {
      mergeStyles($(elem), {
        'color': '#2563eb',
        'text-decoration': 'underline',
        'font-weight': '600'
      });
    });

    // Fix lists
    $('ul').each((_, elem) => {
      mergeStyles($(elem), {
        'margin': '20px 0',
        'padding-left': '20px',
        'font-size': '16px',
        'line-height': '1.8',
        'color': '#334155'
      });
    });

    $('li').each((_, elem) => {
      mergeStyles($(elem), {
        'margin-bottom': '10px',
        'font-size': '16px',
        'line-height': '1.75'
      });
    });

    // Fix divs with background (highlight boxes)
    $('div').each((_, elem) => {
      const style = $(elem).attr('style') || '';
      if (style.includes('background')) {
        mergeStyles($(elem), {
          'padding': '20px',
          'border-radius': '12px',
          'margin': '20px 0'
        });
      }
    });

    // Return only the body content without html/body wrapper
    // Using $.root().html() to get just the children without document wrapper
    return $.root().html() || html;
  } catch (error) {
    console.error('Error processing typography:', error);
    // Return original HTML if processing fails
    return html;
  }
}

/**
 * Generates a secure tracking ID using HMAC
 * This prevents tampering and validates that tracking requests are legitimate
 */
function generateTrackingId(emailLogId: string): string {
  const secret = process.env.EMAIL_TRACKING_SECRET || 'default-tracking-secret-change-in-production';
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(emailLogId);
  return hmac.digest('hex').substring(0, 16); // Use first 16 chars for URL brevity
}

/**
 * Validates that a tracking ID matches the email log ID
 */
export function validateTrackingId(trackingId: string, emailLogId: string): boolean {
  const expectedTrackingId = generateTrackingId(emailLogId);
  return trackingId === expectedTrackingId;
}

/**
 * Generates a tracking pixel URL for email open tracking
 * Uses HMAC-based tracking ID for security
 */
export function generateTrackingPixelUrl(emailLogId: string, baseUrl: string): string {
  const trackingId = generateTrackingId(emailLogId);
  return `${baseUrl}/api/email-tracking/${trackingId}/${emailLogId}`;
}
