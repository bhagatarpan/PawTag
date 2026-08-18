import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'pawtag-admin-sidebar-collapsed';

function getInitialCollapsed(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  // Default: all sections expanded except Operations
  return ['operations'];
}

export function useSidebarCollapse() {
  const [collapsedSections, setCollapsedSections] = useState<string[]>(getInitialCollapsed);

  const toggleSection = useCallback((sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = prev.includes(sectionId)
        ? prev.filter((id) => id !== sectionId)
        : [...prev, sectionId];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const isCollapsed = useCallback(
    (sectionId: string) => collapsedSections.includes(sectionId),
    [collapsedSections],
  );

  // Auto-expand section containing active route
  const expandSection = useCallback((sectionId: string) => {
    setCollapsedSections((prev) => {
      if (!prev.includes(sectionId)) return prev;
      const next = prev.filter((id) => id !== sectionId);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  return { collapsedSections, toggleSection, isCollapsed, expandSection };
}
