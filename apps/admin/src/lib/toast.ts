/**
 * Admin toast API — re-export of the shared `@pawtag/ui` toast system.
 * The import path is preserved so existing call sites
 * (`import { toast } from '../lib/toast'`) keep working unchanged.
 * Rendering lives in the shared <ToastHost /> (mounted in Layout).
 */
export { toast } from '@pawtag/ui';
export type { ToastKind, ToastItem } from '@pawtag/ui';
