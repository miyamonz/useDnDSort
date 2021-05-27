import React, { useRef, useState, useEffect, useMemo } from "react";
import { isHover } from "./func";
import { useRefFn } from "./useRefFn";

interface Position {
  x: number;
  y: number;
}

// ドラッグ＆ドロップ要素の情報をまとめた型
interface DnDItem<T> {
  value: T;
  key: string;
  position: Position;
  element: HTMLElement;
}

// useRef()で保持するデータの型
interface DnDRef<T> {
  dndItems: DnDItem<T>[]; // 並び替える全ての要素を保持するための配列
  canCheckHovered: boolean; // 重なり判定ができるかのフラグ
  dragElement: DnDItem<T> | null; // ドラッグしてる要素
}

function usePointerPosition() {
  const position = useRef<Position>({ x: 0, y: 0 }).current;

  const setPosition = (pos: Position | ((prev: Position) => Position)) => {
    const p = typeof pos === "function" ? pos(position) : pos;
    position.x = p.x;
    position.y = p.y;
  };

  return [position, setPosition] as const;
}

// 返り値の型
interface DnDSortResult<T> {
  key: string;
  value: T;
  events: {
    ref: (element: HTMLElement | null) => void;
    onMouseDown: (event: React.MouseEvent<HTMLElement>) => void;
  };
}

const getElementPosition = (element: HTMLElement): Position => {
  const { left, top } = element.getBoundingClientRect();
  return { x: left, y: top };
};

/**
 * @description ドラッグ＆ドロップの並び替え処理を提供します
 */
export const useDnDSort = <T>(defaultItems: T[]): DnDSortResult<T>[] => {
  // 描画内容と紐づいているのでuseStateで管理する
  const [items, setItems] = useState(defaultItems);
  // userがkeyを指定すべき
  const keyMap = useMemo(() => {
    const keyMap = new Map(
      items.map((item) => [item, Math.random().toString(16)])
    );
    return keyMap;
  }, []);

  // 状態をrefで管理する
  const state = useRef<DnDRef<T>>({
    dndItems: [],
    dragElement: null,
    canCheckHovered: true,
  }).current;

  const [pointerPosition, setPointerPosition] = usePointerPosition();

  // ドラッグ中の処理
  const onMouseMove = (dragElement: DnDItem<T>) => (event: MouseEvent) => {
    const { clientX, clientY } = event;
    const { dndItems } = state;

    // マウスポインターの移動量を計算
    const x = clientX - pointerPosition.x;
    const y = clientY - pointerPosition.y;

    // ドラッグ要素の座標とスタイルを更新
    const dragStyle = dragElement.element.style;
    dragStyle.zIndex = "100";
    dragStyle.cursor = "grabbing";
    dragStyle.transform = `translate(${x}px,${y}px)`;

    // まだ確認できない場合は処理を終了する
    if (!state.canCheckHovered) return;
    state.canCheckHovered = false;
    setTimeout(() => (state.canCheckHovered = true), 300);

    // ドラッグしている要素の配列の位置を取得
    const dragIndex = dndItems.findIndex(({ key }) => key === dragElement.key);

    // ホバーされている要素の配列の位置を取得
    const hoveredIndex = dndItems.findIndex(
      ({ element }, index) => index !== dragIndex && isHover(event, element)
    );

    // ホバーされている要素があれば、ドラッグしている要素と入れ替える
    if (hoveredIndex !== -1) {
      // カーソルの位置を更新
      setPointerPosition({ x: clientX, y: clientY });

      // 要素を入れ替える
      dndItems.splice(dragIndex, 1);
      dndItems.splice(hoveredIndex, 0, dragElement);

      // ドラッグ要素の座標を更新
      dragElement.position = getElementPosition(dragElement.element);

      // 再描画する
      console.log("setItems");
      setItems(dndItems.map((v) => v.value));
    }
  };

  const [onStartDrag, setOnStartDrag] =
    useRefFn<(e: StartDragEvent<T>) => void>();
  const [onEndDrag, setOnEndDrag] = useRefFn<() => void>();

  const run = async () => {
    while (true) {
      const { key, value, event, element } = await makePromise(setOnStartDrag);
      console.log("onmousedown");

      // マウスポインターの座標を保持しておく
      setPointerPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // ドラッグしている要素のスタイルを上書き
      element.style.transition = ""; // アニメーションを無効にする
      element.style.cursor = "grabbing"; // カーソルのデザインを変更

      // 要素の座標を取得
      const position = getElementPosition(element);

      // ドラッグする要素を保持しておく
      state.dragElement = { key, value, element, position };

      // mousemove, mouseupイベントをwindowに登録する
      window.addEventListener("mouseup", onEndDrag);
      const _onMouseMove = onMouseMove(state.dragElement);
      window.addEventListener("mousemove", _onMouseMove);

      await makePromise<void>(setOnEndDrag);
      console.log("onmouseup");

      const { dragElement } = state;

      // ドラッグしてる要素に適用していたCSSを削除
      const dragStyle = dragElement.element.style;
      dragStyle.zIndex = "";
      dragStyle.cursor = "";
      dragStyle.transform = "";

      // ドラッグしている要素をstateから削除
      state.dragElement = null;

      // windowに登録していたイベントを削除
      window.removeEventListener("mouseup", onEndDrag);
      window.removeEventListener("mousemove", _onMouseMove);
    }
  };
  useEffect(() => {
    run();
  }, []);

  return items.map((value: T): DnDSortResult<T> => {
    const key = keyMap.get(value) as string;
    return {
      value,
      key,
      events: {
        ref: (element: HTMLElement | null) => {
          console.log("ref");
          if (!element) return;

          const { dndItems, dragElement } = state;

          // 位置をリセットする
          element.style.transform = "";

          // 要素の位置を取得
          const position = getElementPosition(element);

          const itemIndex = dndItems.findIndex((item) => item.key === key);

          // 要素が無ければ新しく追加して処理を終わる
          if (itemIndex === -1) {
            return dndItems.push({ key, value, element, position });
          }

          // ドラッグ要素の時は、ズレを修正する
          if (dragElement?.key === key) {
            // ドラッグ要素のズレを計算する
            const dragX = dragElement.position.x - position.x;
            const dragY = dragElement.position.y - position.y;

            // 入れ替え時のズレを無くす
            element.style.transform = `translate(${dragX}px,${dragY}px)`;

            // マウスポインターの位置も再計算してズレを無くす
            setPointerPosition((prev: Position) => ({
              x: prev.x - dragX,
              y: prev.y - dragY,
            }));
          }

          // ドラッグ要素以外の要素をアニメーションさせながら移動させる
          if (dragElement?.key !== key) {
            const item = dndItems[itemIndex];

            // 前回の座標を計算
            const x = item.position.x - position.x;
            const y = item.position.y - position.y;

            // 要素を前回の位置に留めておく
            element.style.transition = "";
            element.style.transform = `translate(${x}px,${y}px)`;

            // 一フレーム後に要素をアニメーションさせながら元に位置に戻す
            requestAnimationFrame(() => {
              element.style.transform = "";
              element.style.transition = "all 300ms";
            });
          }

          // 要素を更新する
          state.dndItems[itemIndex] = { key, value, element, position };
        },

        onMouseDown: (event: React.MouseEvent<HTMLElement>) => {
          const element = event.currentTarget;
          onStartDrag({ key, value, event, element });
        },
      },
    };
  });
};

type Resolve<T> = (value: T) => void;
function makePromise<T>(setRes: (resolve: Resolve<T>) => void): Promise<T> {
  return new Promise((res) => setRes(res));
}

type StartDragEvent<T> = {
  key: string;
  value: T;
  event: React.MouseEvent<HTMLElement>;
  element: HTMLElement;
};
