import { useRef, useCallback } from "react";

export function useRefFn<Fn extends CallableFunction>() {
  const ref = useRef<Fn>();
  const fn = useCallback((...args) => {
    ref.current?.(...args);
  }, []);
  return [fn, (fn: Fn) => (ref.current = fn)] as const;
}
