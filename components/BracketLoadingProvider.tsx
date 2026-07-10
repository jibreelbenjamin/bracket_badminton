"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type BracketLoadingContextType = {
  isBracketLoading: boolean;
  setBracketLoading: (loading: boolean) => void;
};

const BracketLoadingContext = createContext<BracketLoadingContextType>({
  isBracketLoading: false,
  setBracketLoading: () => {},
});

export function BracketLoadingProvider({ children }: { children: ReactNode }) {
  const [isBracketLoading, setBracketLoading] = useState(false);

  const setLoading = useCallback((loading: boolean) => {
    setBracketLoading(loading);
  }, []);

  return (
    <BracketLoadingContext.Provider value={{ isBracketLoading, setBracketLoading: setLoading }}>
      {children}
    </BracketLoadingContext.Provider>
  );
}

export function useBracketLoading() {
  return useContext(BracketLoadingContext);
}
