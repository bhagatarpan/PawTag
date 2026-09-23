import { renderBase } from './base';

interface JobNotificationData {
  jobName: string;
  result: 'success' | 'error';
  durationMs: number;
  error?: string;
  timestamp: Date;
  recentHistory?: Array<{
    startedAt: Date;
    result: string;
    durationMs: number;
    error?: string;
  }>;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-NZ', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: 'Pacific/Auckland',
  }).format(date);
}

function formatTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export function renderJobNotificationEmail(data: JobNotificationData): string {
  const isError = data.result === 'error';
  const theme = isError ? 'danger' : 'success';
  const statusIcon = isError ? '❌' : '✅';
  const statusText = isError ? 'FAILED' : 'COMPLETED';

  // Build recent history table
  let historyHtml = '';
  if (data.recentHistory && data.recentHistory.length > 0) {
    const rows = data.recentHistory.map((h) => {
      const icon = h.result === 'success' ? '✅' : '❌';
      return `
        <tr>
          <td style="padding:6px 12px;font-size:13px;color:#374151;font-family:'Courier New',Courier,monospace;">${icon} ${formatTimeAgo(new Date(h.startedAt))}</td>
          <td style="padding:6px 12px;font-size:13px;color:#374151;font-family:'Courier New',Courier,monospace;">${formatDuration(h.durationMs)}</td>
          <td style="padding:6px 12px;font-size:13px;color:${h.result === 'error' ? '#dc2626' : '#374151'};font-family:'Courier New',Courier,monospace;">${h.result}${h.error ? ` — ${h.error}` : ''}</td>
        </tr>`;
    }).join('');

    historyHtml = `
      <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#f9fafb;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;">Time</th>
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;">Duration</th>
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;">Result</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  // Build error details section
  let errorHtml = '';
  if (isError && data.error) {
    errorHtml = `
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="color:#991b1b;font-size:14px;font-weight:600;margin:0 0 8px;">Error Details</p>
        <pre style="color:#991b1b;font-size:13px;font-family:'Courier New',Courier,monospace;white-space:pre-wrap;margin:0;">${data.error}</pre>
      </div>`;
  }

  const bodyHtml = `
    <div style="background:${isError ? '#fef2f2' : '#f0fdf4'};border:1px solid ${isError ? '#fecaca' : '#bbf7d0'};border-radius:8px;padding:20px;margin:0 0 24px;">
      <table style="width:100%;">
        <tr>
          <td style="font-size:32px;vertical-align:top;padding-right:16px;">${statusIcon}</td>
          <td>
            <p style="color:${isError ? '#991b1b' : '#166534'};font-size:18px;font-weight:700;margin:0;">Job ${statusText}</p>
            <p style="color:${isError ? '#991b1b' : '#166534'};font-size:14px;margin:4px 0 0;">
              <strong>${data.jobName}</strong> — ${formatDuration(data.durationMs)}
            </p>
            <p style="color:${isError ? '#991b1b' : '#166534'};font-size:13px;margin:4px 0 0;">
              ${formatDate(data.timestamp)}
            </p>
          </td>
        </tr>
      </table>
    </div>

    ${errorHtml}

    ${historyHtml}

    <p style="color:#9ca3af;font-size:12px;margin:24px 0 0;">
      View job details in the <a href="${process.env.ADMIN_URL || 'http://localhost:3001'}/background-jobs" style="color:#0d9488;">Admin Portal — Background Jobs</a>
    </p>
  `;

  return renderBase({
    title: `Job ${statusText}: ${data.jobName}`,
    subtitle: `PawTag Background Job System`,
    bodyHtml,
    theme,
  });
}
