import { useRef, useCallback } from "react";

function useRefFn<Fn extends CallableFunction>() {
  const ref = useRef<Fn>();
  const fn = useCallback((...args) => {
    ref.current?.(...args);
  }, []);
  return [fn, (fn: Fn) => (ref.current = fn)] as const;
}
type Resolve<T> = (value: T) => void;
function makePromise<T>(
  setRes: (resolve: Resolve<T>) => void,
  cancel?: Promise<void>
): Promise<T> {
  return new Promise((res, rej) => {
    setRes(res);
    cancel?.then(() => rej());
  });
}

export function usePromise<T>() {
  const [resolve, setResolve] = useRefFn<(arg: T) => void>();
  const getPromise = () => makePromise(setResolve);
  return [resolve, getPromise] as const;
}
