// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { toast, ToastHost } from '../../packages/ui/src';

/**
 * Shared toast system (packages/ui) — the single save/update feedback
 * mechanism for customer web and admin.
 *
 * Regression context: the previous SaveToast rendered inside a
 * transformed page wrapper (animate-fade-in), which turned its
 * `position: fixed` into absolute positioning against that wrapper —
 * invisible whenever the user was scrolled to the bottom. The host now
 * mounts once at the app root; these tests pin the API contract and the
 * viewport-fixed positioning classes that make that impossible.
 */

describe('toast API + ToastHost', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      vi.runOnlyPendingTimers();
    });
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('renders a success toast from toast.success()', () => {
    render(<ToastHost />);
    act(() => {
      toast.success('Pet saved successfully');
    });
    expect(screen.getByText('Pet saved successfully')).toBeTruthy();
  });

  it('renders error and info toasts with distinct roles', () => {
    render(<ToastHost />);
    act(() => {
      toast.error('Failed to save');
      toast.info('No changes to save');
    });
    expect(screen.getByText('Failed to save')).toBeTruthy();
    expect(screen.getByText('No changes to save')).toBeTruthy();
    // Both announce politely to screen readers
    const statuses = document.querySelectorAll('[role="status"]');
    expect(statuses.length).toBe(2);
  });

  it('renders nothing when no toasts are active', () => {
    const { container } = render(<ToastHost />);
    expect(container.innerHTML).toBe('');
  });

  it('auto-dismisses after ~3.5s', () => {
    render(<ToastHost />);
    act(() => {
      toast.success('Auto dismiss');
    });
    expect(screen.getByText('Auto dismiss')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(3500); // auto-dismiss fires…
      vi.advanceTimersByTime(300); // …then the exit animation completes
    });
    expect(screen.queryByText('Auto dismiss')).toBeNull();
  });

  it('dismiss button removes the toast immediately (after exit animation)', () => {
    render(<ToastHost />);
    act(() => {
      toast.error('Dismissible');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.queryByText('Dismissible')).toBeNull();
  });

  it('stacks multiple toasts and caps the stack at 3', () => {
    render(<ToastHost />);
    act(() => {
      toast.success('One');
      toast.success('Two');
      toast.success('Three');
      toast.success('Four');
    });
    // Oldest dropped; the three newest remain
    expect(screen.queryByText('One')).toBeNull();
    expect(screen.getByText('Two')).toBeTruthy();
    expect(screen.getByText('Three')).toBeTruthy();
    expect(screen.getByText('Four')).toBeTruthy();
  });

  it('is positioned fixed: bottom-center on mobile, top-right on desktop', () => {
    render(<ToastHost />);
    act(() => {
      toast.success('Positioned');
    });
    const container = document.querySelector('[aria-live="polite"]');
    expect(container).toBeTruthy();
    const classes = container!.className;
    // Fixed to the viewport — not absolute to any page wrapper
    expect(classes).toContain('fixed');
    // Mobile: bottom-center with safe-area padding for notches/home bars
    expect(classes).toContain('bottom-0');
    expect(classes).toContain('inset-x-0');
    expect(classes).toContain('items-center');
    expect(classes).toContain('env(safe-area-inset-bottom)');
    // Desktop: top-right
    expect(classes).toContain('md:top-4');
    expect(classes).toContain('md:right-4');
    // Above every page element (modals use z-50, sticky bars z-40)
    expect(classes).toContain('z-[100]');
  });

  it('multiple toasts from separate calls all appear (retries are visible)', () => {
    render(<ToastHost />);
    act(() => {
      toast.error('First failure');
      toast.error('Second failure');
    });
    expect(screen.getByText('First failure')).toBeTruthy();
    expect(screen.getByText('Second failure')).toBeTruthy();
  });
});
