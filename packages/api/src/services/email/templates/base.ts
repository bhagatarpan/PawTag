const CURRENT_YEAR = new Date().getFullYear();

const PAW_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z"/></svg>`;

// ─── Email Design Tokens (from DESIGN.md) ──────────────────────────

export type EmailTheme = 'default' | 'warning' | 'danger' | 'success';

const THEMES: Record<EmailTheme, { gradient: string; accent: string; accentLight: string; accentBorder: string }> = {
  default: { gradient: 'linear-gradient(135deg,#0d9488,#0f766e)', accent: '#0d9488', accentLight: '#f0fdfa', accentBorder: '#ccfbf1' },
  warning: { gradient: 'linear-gradient(135deg,#f59e0b,#d97706)', accent: '#f59e0b', accentLight: '#fffbeb', accentBorder: '#fcd34d' },
  danger:  { gradient: 'linear-gradient(135deg,#dc2626,#ef4444)', accent: '#dc2626', accentLight: '#fef2f2', accentBorder: '#fca5a5' },
  success: { gradient: 'linear-gradient(135deg,#10b981,#059669)', accent: '#10b981', accentLight: '#f0fdf4', accentBorder: '#bbf7d0' },
};

const CARD_STYLES: Record<string, { bg: string; border: string }> = {
  info:      { bg: '#f0fdfa', border: '1px solid #ccfbf1' },
  warning:   { bg: '#fffbeb', border: '1px solid #fcd34d' },
  danger:    { bg: '#fee2e2', border: '1px solid #fca5a5' },
  success:   { bg: '#dcfce7', border: '1px solid #86efac' },
  processing: { bg: '#dbeafe', border: '1px solid #93c5fd' },
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

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${data.title} | PawTag</title>
  <style>
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; padding: 16px !important; }
      .content-cell { padding: 24px !important; }
      .cta-button { width: 100% !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f0fdfa;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;">
  <span style="display:none !important;visibility:hidden;mso-hide:all;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</span>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0fdfa;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:${t.gradient};padding:32px 40px;border-radius:12px 12px 0 0;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="background:rgba(255,255,255,0.15);border-radius:10px;padding:8px;vertical-align:middle;">
                    ${PAW_ICON_SVG}
                  </td>
                  <td style="padding-left:10px;vertical-align:middle;">
                    <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Paw<span style="color:#ccfbf1;">Tag</span></span>
                  </td>
                </tr>
              </table>
              ${data.subtitle ? `<p style="color:rgba(255,255,255,0.85);margin:16px 0 0;font-size:14px;">${data.subtitle}</p>` : ''}
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td class="content-cell" style="background-color:#ffffff;padding:40px;border:1px solid #e5e7eb;border-top:none;">
              ${data.bodyHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f9fafb;padding:32px 40px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;text-align:center;">
              <p style="margin:0 0 8px;color:#374151;font-size:14px;font-weight:600;">PawTag</p>
              <p style="margin:0 0 16px;color:#9ca3af;font-size:13px;font-style:italic;">Because every pet deserves a safe way home.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="padding:0 8px;"><a href="mailto:support@pawtag.co.nz" style="color:#0d9488;text-decoration:none;font-size:12px;">support@pawtag.co.nz</a></td>
                  <td style="color:#d1d5db;padding:0;">|</td>
                  <td style="padding:0 8px;"><a href="https://pawtag.co.nz" style="color:#0d9488;text-decoration:none;font-size:12px;">pawtag.co.nz</a></td>
                </tr>
              </table>
              <p style="margin:16px 0 0;color:#9ca3af;font-size:11px;">
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
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto;">
    <tr>
      <td align="center" style="background-color:${t.accent};border-radius:10px;">
        <a href="${url}" target="_blank" class="cta-button" style="display:inline-block;padding:14px 40px;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;letter-spacing:0.3px;">${label}</a>
      </td>
    </tr>
  </table>`;
}

// ─── Info Box ──────────────────────────────────────────────────────

export function renderInfoBox(content: string, variant: keyof typeof CARD_STYLES = 'info'): string {
  const style = CARD_STYLES[variant] || CARD_STYLES.info;
  return `<div style="background-color:${style.bg};border:${style.border};border-radius:8px;padding:16px 20px;margin:20px 0;">
    ${content}
  </div>`;
}

// ─── Divider ───────────────────────────────────────────────────────

export function renderDivider(): string {
  return `<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">`;
}

// ─── OTP Code Display ──────────────────────────────────────────────

export function renderOtpCode(code: string, expiresIn: string = '5 minutes'): string {
  return `<div style="background-color:#f0fdfa;border:2px dashed #0d9488;border-radius:12px;padding:32px;margin:24px 0;text-align:center;">
    <p style="color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">Your verification code</p>
    <p style="font-size:42px;font-weight:800;letter-spacing:10px;color:#0d9488;font-family:'Courier New',monospace;margin:0;">${code}</p>
    <p style="color:#6b7280;font-size:13px;margin:12px 0 0;">This code expires in ${expiresIn}</p>
  </div>`;
}

// ─── Data Table (Key-Value Pairs) ──────────────────────────────────

export function renderDataTable(rows: Array<{ label: string; value: string }>): string {
  const rowHtml = rows.map((row) => `
    <tr>
      <td style="background-color:#f9fafb;font-weight:600;color:#374151;font-size:13px;padding:12px 16px;border-bottom:1px solid #e5e7eb;width:40%;vertical-align:top;">${row.label}</td>
      <td style="color:#6b7280;font-size:13px;font-family:'Courier New',monospace;padding:12px 16px;border-bottom:1px solid #e5e7eb;">${row.value}</td>
    </tr>`).join('');

  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;border-collapse:separate;">
    ${rowHtml}
  </table>`;
}

// ─── Status Card ───────────────────────────────────────────────────

export function renderStatusCard(status: 'info' | 'warning' | 'danger' | 'success' | 'processing', label: string, description: string): string {
  const style = CARD_STYLES[status] || CARD_STYLES.info;
  return `<div style="background-color:${style.bg};border:${style.border};border-radius:8px;padding:16px;margin:20px 0;">
    <p style="font-weight:600;font-size:14px;margin:0 0 4px;color:#374151;">${label}</p>
    <p style="font-size:13px;margin:0;color:#6b7280;">${description}</p>
  </div>`;
}

// ─── Uppercase Label ───────────────────────────────────────────────

export function renderLabel(text: string): string {
  return `<p style="color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px;">${text}</p>`;
}

// ─── Body Paragraph ────────────────────────────────────────────────

export function renderParagraph(text: string, options?: { size?: string; color?: string; weight?: string; margin?: string }): string {
  const size = options?.size || '16px';
  const color = options?.color || '#374151';
  const weight = options?.weight || '400';
  const margin = options?.margin || '0 0 16px';
  return `<p style="color:${color};font-size:${size};line-height:1.6;font-weight:${weight};margin:${margin};">${text}</p>`;
}

// ─── Card Container ────────────────────────────────────────────────

export function renderCard(content: string, variant: keyof typeof CARD_STYLES = 'info'): string {
  const style = CARD_STYLES[variant] || CARD_STYLES.info;
  return `<div style="background-color:${style.bg};border:${style.border};border-radius:8px;padding:16px 20px;margin:20px 0;">
    ${content}
  </div>`;
}
