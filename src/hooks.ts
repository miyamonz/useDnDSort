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

export function usePromiseResolve<T>() {
  const [resolve, setResolve] = useRefFn<(arg: T) => void>();
  const getPromise = () => makePromise(setResolve);
  return [getPromise, resolve] as const;
}

export function useRefArr<T>() {
  const ref = useRef<T[]>([]);
  return [
    ref.current as readonly T[],
    (newArr: T[]) => {
      ref.current.length = 0;
      Array.prototype.push.apply(ref.current, newArr);
    },
  ] as const;
}
