import React, { createContext, useContext, useState } from 'react';
import type { RouteResponse } from '../types';

interface RouteContextValue {
  activeRoute: RouteResponse | null;
  setActiveRoute: (route: RouteResponse | null) => void;
}

const RouteContext = createContext<RouteContextValue | null>(null);

export function RouteProvider({ children }: { children: React.ReactNode }) {
  const [activeRoute, setActiveRoute] = useState<RouteResponse | null>(null);
  return (
    <RouteContext.Provider value={{ activeRoute, setActiveRoute }}>
      {children}
    </RouteContext.Provider>
  );
}

export function useRoute() {
  const ctx = useContext(RouteContext);
  if (!ctx) throw new Error('useRoute must be used inside RouteProvider');
  return ctx;
}
