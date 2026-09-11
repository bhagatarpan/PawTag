import { useState, useEffect, useCallback } from 'react';

const SIDEBAR_KEY = 'pawtag-admin-sidebar-collapsed';
const SECTIONS_KEY = 'pawtag-admin-sidebar-sections';

function getInitialSidebarCollapsed(): boolean {
  try {
    const stored = localStorage.getItem(SIDEBAR_KEY);
    if (stored !== null) return stored === 'true';
  } catch {}
  return false;
}

function getInitialCollapsedSections(): string[] {
  try {
    const stored = localStorage.getItem(SECTIONS_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return ['operations'];
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

  return {
    sidebarCollapsed,
    toggleSidebar,
    collapsedSections,
    toggleSection,
    isSectionCollapsed,
    expandSection,
  };
}
