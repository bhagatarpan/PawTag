import {
  AlertCircle,
  AlertTriangle,
  Bug,
  Info,
  Skull,
  Globe,
  Database,
  Shield,
  Zap,
  Clock,
  Bell,
  Settings,
  FileText,
  type LucideIcon,
} from 'lucide-react';

export const LEVEL_COLORS: Record<string, string> = {
  debug: 'bg-gray-100 text-gray-600 border-gray-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
  warn: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  error: 'bg-red-50 text-red-700 border-red-200',
  fatal: 'bg-red-100 text-red-800 border-red-300',
};

export const LEVEL_DOT_COLORS: Record<string, string> = {
  debug: 'bg-gray-400',
  info: 'bg-blue-500',
  warn: 'bg-yellow-500',
  error: 'bg-red-500',
  fatal: 'bg-red-700',
};

export const CATEGORY_COLORS: Record<string, string> = {
  HTTP: 'bg-purple-50 text-purple-700 border-purple-200',
  DATABASE: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  AUTH: 'bg-orange-50 text-orange-700 border-orange-200',
  INTEGRATION: 'bg-teal-50 text-teal-700 border-teal-200',
  JOB: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  SECURITY: 'bg-rose-50 text-rose-700 border-rose-200',
  NOTIFICATION: 'bg-amber-50 text-amber-700 border-amber-200',
  CONFIG: 'bg-slate-50 text-slate-700 border-slate-200',
  GENERAL: 'bg-gray-50 text-gray-600 border-gray-200',
};

export const LEVEL_ICONS: Record<string, LucideIcon> = {
  debug: Bug,
  info: Info,
  warn: AlertTriangle,
  error: AlertCircle,
  fatal: Skull,
};

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  HTTP: Globe,
  DATABASE: Database,
  AUTH: Shield,
  INTEGRATION: Zap,
  JOB: Clock,
  SECURITY: Shield,
  NOTIFICATION: Bell,
  CONFIG: Settings,
  GENERAL: FileText,
};

export const LEVEL_DESCRIPTIONS: Record<string, string> = {
  debug: 'Detailed debugging information. High volume.',
  info: 'General operational events. Moderate volume.',
  warn: 'Potential issues and degraded operations.',
  error: 'Application errors and failures.',
  fatal: 'Critical failures causing process exit.',
};

export const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  HTTP: 'HTTP request/response logging.',
  DATABASE: 'Database operations and slow queries.',
  AUTH: 'Authentication and identity events.',
  INTEGRATION: 'External service calls (Stripe, Resend, Twilio, etc.).',
  JOB: 'Background jobs and scheduled tasks.',
  SECURITY: 'Rate limiting, CAPTCHA, and security events.',
  NOTIFICATION: 'Push, email, and in-app notifications.',
  CONFIG: 'Configuration and settings changes.',
  GENERAL: 'Catch-all for uncategorized logs.',
};

export function formatDuration(ms: number): string {
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export function truncateMessage(msg: string, maxLen = 120): string {
  if (!msg) return '';
  return msg.length > maxLen ? msg.slice(0, maxLen) + '...' : msg;
}
