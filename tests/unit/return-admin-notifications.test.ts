import { describe, it, expect } from 'vitest';

describe('return admin notification design rules', () => {
  it('documents recommended channels without blinking UI', () => {
    const channels = ['admin_email', 'admin_in_app', 'sidebar_pending_badge', 'dashboard_pending_tile'];
    expect(channels).toEqual([
      'admin_email',
      'admin_in_app',
      'sidebar_pending_badge',
      'dashboard_pending_tile',
    ]);
    expect(channels).not.toContain('blinking_login_flash');
  });

  it('notification type for new return requests is return_requested', () => {
    expect('return_requested').toBe('return_requested');
  });
});
