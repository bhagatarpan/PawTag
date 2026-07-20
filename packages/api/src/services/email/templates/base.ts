const CURRENT_YEAR = new Date().getFullYear();

const PAW_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z"/></svg>`;

export interface BaseTemplateData {
  preheader?: string;
  title: string;
  subtitle?: string;
  bodyHtml: string;
}

export function renderBase(data: BaseTemplateData): string {
  const preheader = data.preheader || '';

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
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;">
  <span style="display:none !important;visibility:hidden;mso-hide:all;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</span>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0d9488,#0f766e);padding:32px 40px;border-radius:12px 12px 0 0;text-align:center;">
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

export function renderCtaButton(url: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto;">
    <tr>
      <td align="center" style="background-color:#0d9488;border-radius:10px;">
        <a href="${url}" target="_blank" class="cta-button" style="display:inline-block;padding:14px 40px;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;letter-spacing:0.3px;">${label}</a>
      </td>
    </tr>
  </table>`;
}

export function renderInfoBox(content: string): string {
  return `<div style="background-color:#f0fdfa;border:1px solid #ccfbf1;border-radius:8px;padding:16px 20px;margin:20px 0;">
    ${content}
  </div>`;
}

export function renderDivider(): string {
  return `<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">`;
}
