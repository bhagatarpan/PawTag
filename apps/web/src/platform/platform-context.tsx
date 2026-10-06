import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { getPlatform, type PlatformCapabilities } from './capabilities';

const PlatformContext = createContext<PlatformCapabilities>(getPlatform());

export function PlatformProvider({ children, platform }: { children: ReactNode; platform?: PlatformCapabilities }) {
  const value = useMemo(() => platform ?? getPlatform(), [platform]);
  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>;
}

export function usePlatform(): PlatformCapabilities {
  return useContext(PlatformContext);
}
