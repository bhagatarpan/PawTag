import { useState, useCallback } from 'react';

const SIDEBAR_KEY = 'pawtag-admin-sidebar-collapsed';
const SECTIONS_KEY = 'pawtag-admin-sidebar-sections';

const ALL_SECTION_IDS = [
  'overview', 'catalog', 'inventory', 'orders', 'payments',
  'tag-subscriptions', 'guardian-loyalty', 'discounts', 'users',
  'communication', 'content', 'settings', 'security', 'operations',
];

function getInitialSidebarCollapsed(): boolean {
  try {
    const stored = localStorage.getItem(SIDEBAR_KEY);
    if (stored !== null) return stored === 'true';
  } catch {}
  return true;
}

function getInitialCollapsedSections(): string[] {
  try {
    const stored = localStorage.getItem(SECTIONS_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return [...ALL_SECTION_IDS];
}

export function useSidebarCollapse() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(getInitialSidebarCollapsed);
  const [collapsedSections, setCollapsedSections] = useState<string[]>(getInitialCollapsedSections);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_KEY, String(next));
      } catch {}
      return next;
    });
  }, []);

  const toggleSection = useCallback((sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = prev.includes(sectionId)
        ? prev.filter((id) => id !== sectionId)
        : [...prev, sectionId];
      try {
        localStorage.setItem(SECTIONS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const isSectionCollapsed = useCallback(
    (sectionId: string) => collapsedSections.includes(sectionId),
    [collapsedSections],
  );

  const expandSection = useCallback((sectionId: string) => {
    setCollapsedSections((prev) => {
      if (!prev.includes(sectionId)) return prev;
      const next = prev.filter((id) => id !== sectionId);
      try {
        localStorage.setItem(SECTIONS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const expandAllSections = useCallback(() => {
    setCollapsedSections([]);
    try {
      localStorage.setItem(SECTIONS_KEY, JSON.stringify([]));
    } catch {}
  }, []);

  const collapseAllSections = useCallback(() => {
    setCollapsedSections([...ALL_SECTION_IDS]);
    try {
      localStorage.setItem(SECTIONS_KEY, JSON.stringify(ALL_SECTION_IDS));
    } catch {}
  }, []);

  return {
    sidebarCollapsed,
    toggleSidebar,
    collapsedSections,
    toggleSection,
    isSectionCollapsed,
    expandSection,
    expandAllSections,
    collapseAllSections,
  };
}
