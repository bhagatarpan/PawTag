import { brandColors, semanticColors } from '@pawtag/design-tokens';

const CURRENT_YEAR = new Date().getFullYear();

// ─── Email Design Tokens (DESIGN.md → Email Design System) ────────
// Single source of truth for email styling. Values mirror docs/DESIGN.md.
// Colors reference @pawtag/design-tokens; layout/spacing/radius are email-specific.

export const EMAIL_TOKENS = {
  layout: {
    contentWidth: 600,
    outerPadding: '32px 16px',
    bodyPadding: '40px',
    mobilePadding: '24px',
    mobileContainerPadding: '16px',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '40px',
  },
  border: {
    standard: `1px solid ${semanticColors.gray[200]}`,
    radius: '8px',
    radiusLg: '12px',
    radiusPill: '20px',
    dashed: `2px dashed ${brandColors.primary[600]}`,
  },
  typography: {
    fontFamily: `system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif`,
    monoFont: `'Courier New',Courier,monospace`,
    headingSize: '22px',
    bodySize: '16px',
    captionSize: '14px',
    labelSize: '13px',
    smallSize: '12px',
    tinySize: '11px',
    bodyLineHeight: '1.6',
    bodyColor: semanticColors.gray[700],
    mutedColor: semanticColors.gray[500],
    subtleColor: semanticColors.gray[400],
  },
  colors: {
    white: '#ffffff',
    canvas: brandColors.primary[100],
    surface: '#ffffff',
    footerBg: semanticColors.gray[50],
    border: semanticColors.gray[200],
    link: brandColors.primary[600],
  },
  cta: {
    paddingY: '14px',
    paddingX: '40px',
    radius: '10px',
    fontSize: '16px',
    fontWeight: '600',
    letterSpacing: '0.3px',
    marginY: '24px',
  },
  breakpoint: 600,
} as const;

// ─── Color Themes ─────────────────────────────────────────────────

export type EmailTheme = 'default' | 'warning' | 'danger' | 'success';

const THEMES: Record<EmailTheme, { gradient: string; accent: string; accentLight: string; accentBorder: string }> = {
  default: {
    gradient: `linear-gradient(135deg,${brandColors.primary[600]},${brandColors.primary[700]})`,
    accent: brandColors.primary[600],
    accentLight: brandColors.primary[50],
    accentBorder: brandColors.primary[100],
  },
  warning: {
    gradient: `linear-gradient(135deg,${semanticColors.amber[500]},${semanticColors.amber[600]})`,
    accent: semanticColors.amber[500],
    accentLight: semanticColors.amber[50],
    accentBorder: semanticColors.amber[200],
  },
  danger: {
    gradient: `linear-gradient(135deg,${semanticColors.red[600]},${semanticColors.red[500]})`,
    accent: semanticColors.red[600],
    accentLight: semanticColors.red[50],
    accentBorder: semanticColors.red[200],
  },
  success: {
    gradient: `linear-gradient(135deg,${semanticColors.green[500]},${semanticColors.green[600]})`,
    accent: semanticColors.green[500],
    accentLight: semanticColors.green[50],
    accentBorder: semanticColors.green[200],
  },
};

const CARD_STYLES: Record<string, { bg: string; border: string }> = {
  info:       { bg: brandColors.primary[50],   border: `1px solid ${brandColors.primary[100]}` },
  warning:    { bg: semanticColors.amber[50],  border: `1px solid ${semanticColors.amber[200]}` },
  danger:     { bg: semanticColors.red[50],    border: `1px solid ${semanticColors.red[200]}` },
  success:    { bg: semanticColors.green[100], border: `1px solid ${semanticColors.green[200]}` },
  processing: { bg: semanticColors.blue[100],  border: `1px solid ${semanticColors.blue[200]}` },
};

// ─── Base Template ─────────────────────────────────────────────────

export interface BaseTemplateData {
  preheader?: string;
  title: string;
  subtitle?: string;
  bodyHtml: string;
  theme?: EmailTheme;
}

export function renderBase(data: BaseTemplateData): string {
  const preheader = data.preheader || '';
  const theme = data.theme || 'default';
  const t = THEMES[theme];
  const E = EMAIL_TOKENS;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${data.title} | PawTag</title>
  <style>
    @media only screen and (max-width: ${E.breakpoint}px) {
      .email-container { width: 100% !important; padding: ${E.layout.mobileContainerPadding} !important; }
      .content-cell { padding: ${E.layout.mobilePadding} !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${E.colors.canvas};font-family:${E.typography.fontFamily};-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;">
  <span style="display:none !important;visibility:hidden;mso-hide:all;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</span>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${E.colors.canvas};">
    <tr>
      <td align="center" style="padding:${E.layout.outerPadding};">
        <table role="presentation" class="email-container" width="${E.layout.contentWidth}" cellpadding="0" cellspacing="0" style="max-width:${E.layout.contentWidth}px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background-color:${t.accent};padding:${E.spacing.xl} ${E.spacing.xxl};border-radius:${E.border.radiusLg} ${E.border.radiusLg} 0 0;text-align:center;">
              <p style="font-size:${E.typography.headingSize};font-weight:700;color:${E.colors.white};letter-spacing:-0.5px;margin:0;">Paw<span style="color:${E.colors.canvas};">Tag</span></p>
              ${data.subtitle ? `<p style="color:${E.colors.white};margin:${E.spacing.md} 0 0;font-size:${E.typography.bodySize};">${data.subtitle}</p>` : ''}
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td class="content-cell" style="background-color:${E.colors.surface};padding:${E.layout.bodyPadding};border:${E.border.standard};border-top:none;">
              ${data.bodyHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:${E.colors.footerBg};padding:${E.spacing.xl} ${E.spacing.xxl};border:${E.border.standard};border-top:none;border-radius:0 0 ${E.border.radiusLg} ${E.border.radiusLg};text-align:center;">
              <p style="margin:0 0 ${E.spacing.sm};color:${E.typography.bodyColor};font-size:${E.typography.captionSize};font-weight:600;">PawTag</p>
              <p style="margin:0 0 ${E.spacing.md};color:${E.typography.subtleColor};font-size:${E.typography.labelSize};font-style:italic;">Because every pet deserves a safe way home.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="padding:0 ${E.spacing.sm};"><a href="mailto:support@pawtag.co.nz" style="color:${E.colors.link};text-decoration:none;font-size:${E.typography.smallSize};">support@pawtag.co.nz</a></td>
                  <td style="color:${semanticColors.gray[300]};padding:0;">|</td>
                  <td style="padding:0 ${E.spacing.sm};"><a href="https://pawtag.co.nz" style="color:${E.colors.link};text-decoration:none;font-size:${E.typography.smallSize};">pawtag.co.nz</a></td>
                </tr>
              </table>
              <p style="margin:${E.spacing.md} 0 0;color:${E.typography.subtleColor};font-size:${E.typography.tinySize};">
                &copy; ${CURRENT_YEAR} PawTag. All rights reserved.<br>
                New Zealand
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── CTA Button ────────────────────────────────────────────────────

export function renderCtaButton(url: string, label: string, theme: EmailTheme = 'default'): string {
  const t = THEMES[theme];
  const E = EMAIL_TOKENS;
  // Padding lives on the <td>, not the <a>, so the background box always wraps the
  // text correctly in clients like Yahoo Mail iOS that don't expand the parent td
  // to fit a padded inline-block anchor.
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:${E.cta.marginY} auto;">
    <tr>
      <td align="center" valign="middle" style="background-color:${t.accent};border-radius:${E.cta.radius};padding:${E.cta.paddingY} ${E.cta.paddingX};">
        <a href="${url}" target="_blank" style="display:inline-block;color:${E.colors.white};font-size:${E.cta.fontSize};font-weight:${E.cta.fontWeight};text-decoration:none;letter-spacing:${E.cta.letterSpacing};">${label}</a>
      </td>
    </tr>
  </table>`;
}

// ─── Info Box ──────────────────────────────────────────────────────

export function renderInfoBox(content: string, variant: keyof typeof CARD_STYLES = 'info'): string {
  const style = CARD_STYLES[variant] || CARD_STYLES.info;
  const E = EMAIL_TOKENS;
  return `<div style="background-color:${style.bg};border:${style.border};border-radius:${E.border.radius};padding:${E.spacing.md} 20px;margin:20px 0;">
    ${content}
  </div>`;
}

// ─── Divider ───────────────────────────────────────────────────────

export function renderDivider(): string {
  const E = EMAIL_TOKENS;
  return `<hr style="border:none;border-top:${E.border.standard};margin:${E.spacing.lg} 0;">`;
}

// ─── OTP Code Display ──────────────────────────────────────────────

export function renderOtpCode(code: string, expiresIn: string = '5 minutes'): string {
  const E = EMAIL_TOKENS;
  return `<div style="background-color:${brandColors.primary[50]};border:${E.border.dashed};border-radius:${E.border.radiusLg};padding:${E.spacing.xl};margin:${E.spacing.lg} 0;text-align:center;">
    <p style="color:${E.typography.mutedColor};font-size:${E.typography.smallSize};text-transform:uppercase;letter-spacing:1px;margin:0 0 ${E.spacing.md};">Your verification code</p>
    <p style="font-size:42px;font-weight:800;letter-spacing:10px;color:${brandColors.primary[600]};font-family:${E.typography.monoFont};margin:0;">${code}</p>
    <p style="color:${E.typography.mutedColor};font-size:${E.typography.labelSize};margin:${E.spacing.md} 0 0;">This code expires in ${expiresIn}</p>
  </div>`;
}

// ─── Data Table (Key-Value Pairs) ──────────────────────────────────

export function renderDataTable(rows: Array<{ label: string; value: string }>): string {
  const E = EMAIL_TOKENS;
  const rowHtml = rows.map((row) => `
    <tr>
      <td style="background-color:${E.colors.footerBg};font-weight:600;color:${E.typography.bodyColor};font-size:${E.typography.labelSize};padding:${E.spacing.md};border-bottom:${E.border.standard};width:40%;vertical-align:top;">${row.label}</td>
      <td style="color:${E.typography.mutedColor};font-size:${E.typography.labelSize};font-family:${E.typography.monoFont};padding:${E.spacing.md};border-bottom:${E.border.standard};">${row.value}</td>
    </tr>`).join('');

  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border:${E.border.standard};border-radius:${E.border.radius};overflow:hidden;border-collapse:separate;">
    ${rowHtml}
  </table>`;
}

// ─── Status Card ───────────────────────────────────────────────────

export function renderStatusCard(status: 'info' | 'warning' | 'danger' | 'success' | 'processing', label: string, description: string): string {
  const style = CARD_STYLES[status] || CARD_STYLES.info;
  const E = EMAIL_TOKENS;
  return `<div style="background-color:${style.bg};border:${style.border};border-radius:${E.border.radius};padding:${E.spacing.md};margin:20px 0;">
    <p style="font-weight:600;font-size:${E.typography.captionSize};margin:0 0 ${E.spacing.xs};color:${E.typography.bodyColor};">${label}</p>
    <p style="font-size:${E.typography.labelSize};margin:0;color:${E.typography.mutedColor};">${description}</p>
  </div>`;
}

// ─── Uppercase Label ───────────────────────────────────────────────

export function renderLabel(text: string): string {
  const E = EMAIL_TOKENS;
  return `<p style="color:${E.typography.mutedColor};font-size:${E.typography.smallSize};text-transform:uppercase;letter-spacing:0.5px;margin:0 0 ${E.spacing.sm};">${text}</p>`;
}

// ─── Body Paragraph ────────────────────────────────────────────────

export function renderParagraph(text: string, options?: { size?: string; color?: string; weight?: string; margin?: string }): string {
  const E = EMAIL_TOKENS;
  const size = options?.size || E.typography.bodySize;
  const color = options?.color || E.typography.bodyColor;
  const weight = options?.weight || '400';
  const margin = options?.margin || `0 0 ${E.spacing.md}`;
  return `<p style="color:${color};font-size:${size};line-height:${E.typography.bodyLineHeight};font-weight:${weight};margin:${margin};">${text}</p>`;
}

// ─── Card Container ────────────────────────────────────────────────

export function renderCard(content: string, variant: keyof typeof CARD_STYLES = 'info'): string {
  const style = CARD_STYLES[variant] || CARD_STYLES.info;
  const E = EMAIL_TOKENS;
  return `<div style="background-color:${style.bg};border:${style.border};border-radius:${E.border.radius};padding:${E.spacing.md} 20px;margin:20px 0;">
    ${content}
  </div>`;
}

// ─── Tier Colors (shared across Guardian emails) ───────────────────

export const TIER_COLORS: Record<string, string> = {
  CARE: semanticColors.green[500],
  NURTURE: brandColors.primary[600],
  PROTECTOR: '#8b5cf6',
  SAFEGUARD: semanticColors.amber[500],
};

// ─── Section Heading ───────────────────────────────────────────────

export function renderSectionHeading(text: string): string {
  const E = EMAIL_TOKENS;
  return `<p style="color:${semanticColors.gray[900]};font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;margin:0 0 ${E.spacing.md};">${text}</p>`;
}

// ─── 2-Column Responsive Grid ──────────────────────────────────────

export function renderTwoColumnGrid(items: Array<{ label: string; value: string; subtext?: string }>): string {
  const E = EMAIL_TOKENS;
  const rows: string[] = [];
  for (let i = 0; i < items.length; i += 2) {
    const left = items[i];
    const right = items[i + 1];
    rows.push(`
      <tr>
        <td style="width:50%;padding:0 6px ${E.spacing.md} 0;vertical-align:top;">
          <div style="background-color:${E.colors.footerBg};border:${E.border.standard};border-radius:${E.border.radius};padding:14px 12px;text-align:center;">
            <p style="color:${E.typography.mutedColor};font-size:10px;text-transform:uppercase;letter-spacing:0.8px;margin:0 0 6px;font-weight:600;">${left.label}</p>
            <p style="color:${brandColors.primary[600]};font-size:20px;font-weight:700;margin:0;">${left.value}</p>
            ${left.subtext ? `<p style="color:${E.typography.subtleColor};font-size:${E.typography.tinySize};margin:${E.spacing.xs} 0 0;">${left.subtext}</p>` : ''}
          </div>
        </td>
        ${right ? `
        <td style="width:50%;padding:0 0 ${E.spacing.md} 6px;vertical-align:top;">
          <div style="background-color:${E.colors.footerBg};border:${E.border.standard};border-radius:${E.border.radius};padding:14px 12px;text-align:center;">
            <p style="color:${E.typography.mutedColor};font-size:10px;text-transform:uppercase;letter-spacing:0.8px;margin:0 0 6px;font-weight:600;">${right.label}</p>
            <p style="color:${brandColors.primary[600]};font-size:20px;font-weight:700;margin:0;">${right.value}</p>
            ${right.subtext ? `<p style="color:${E.typography.subtleColor};font-size:${E.typography.tinySize};margin:${E.spacing.xs} 0 0;">${right.subtext}</p>` : ''}
          </div>
        </td>` : '<td style="width:50%;"></td>'}
      </tr>`);
  }
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 ${E.spacing.sm};">
    ${rows.join('')}
  </table>`;
}

// ─── Vertical Tier Progression ─────────────────────────────────────

export function renderTierProgression(tiers: Array<{ name: string; threshold: string; rewards: string; isCurrent: boolean }>): string {
  const E = EMAIL_TOKENS;
  const tierHtml = tiers.map((tier, idx) => {
    const color = TIER_COLORS[tier.name] || semanticColors.green[500];
    const isLast = idx === tiers.length - 1;
    const bgColor = tier.isCurrent ? brandColors.primary[50] : E.colors.white;
    const borderColor = tier.isCurrent ? color : E.colors.border;
    const textColor = tier.isCurrent ? color : E.typography.bodyColor;
    const badgeBg = tier.isCurrent ? color : E.colors.border;
    const badgeText = tier.isCurrent ? E.colors.white : E.typography.mutedColor;

    return `
      <tr>
        <td style="padding:0;width:24px;vertical-align:top;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:24px;">
            <tr>
              <td style="width:24px;height:24px;border-radius:50%;background-color:${badgeBg};text-align:center;vertical-align:middle;">
                <span style="color:${badgeText};font-size:${E.typography.tinySize};font-weight:700;">${idx + 1}</span>
              </td>
            </tr>
            ${!isLast ? `<tr><td style="width:2px;height:20px;background-color:${E.colors.border};margin:0 auto;padding:0 11px;"><div style="width:2px;height:20px;background-color:${E.colors.border};"></div></td></tr>` : ''}
          </table>
        </td>
        <td style="padding:0 0 ${isLast ? '0' : E.spacing.sm} 12px;vertical-align:top;">
          <div style="background-color:${bgColor};border:1px solid ${borderColor};border-radius:${E.border.radius};padding:12px ${E.spacing.md};${tier.isCurrent ? 'border-left:3px solid ' + color + ';' : ''}">
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
              <tr>
                <td>
                  <p style="color:${textColor};font-size:${E.typography.captionSize};font-weight:700;margin:0;">${tier.name}</p>
                  <p style="color:${E.typography.mutedColor};font-size:${E.typography.smallSize};margin:2px 0 0;">${tier.threshold}</p>
                </td>
                <td style="text-align:right;">
                  <p style="color:${brandColors.primary[600]};font-size:${E.typography.captionSize};font-weight:700;margin:0;">${tier.rewards}</p>
                  <p style="color:${E.typography.subtleColor};font-size:${E.typography.tinySize};margin:2px 0 0;">/month</p>
                </td>
              </tr>
            </table>
          </div>
        </td>
      </tr>`;
  }).join('');

  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0;">
    ${tierHtml}
  </table>`;
}

// ─── Benefits List with Checkmarks ─────────────────────────────────

export function renderBenefitsList(items: string[]): string {
  const E = EMAIL_TOKENS;
  const listHtml = items.map(item => `
    <tr>
      <td style="width:20px;vertical-align:top;padding:${E.spacing.xs} 0;">
        <span style="color:${brandColors.primary[600]};font-size:${E.typography.captionSize};font-weight:700;">✓</span>
      </td>
      <td style="padding:${E.spacing.xs} 0;">
        <p style="color:${E.typography.bodyColor};font-size:${E.typography.labelSize};line-height:1.5;margin:0;">${item}</p>
      </td>
    </tr>`).join('');

  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0;">
    ${listHtml}
  </table>`;
}
