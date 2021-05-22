import React, { useRef, useState } from "react";

/**
 * @description マウスポインターが要素と被っているか判定します
 */
const isHover = (event: MouseEvent, element: HTMLElement): boolean => {
  // マウスポインターの座標を取得
  const clientX = event.clientX;
  const clientY = event.clientY;

  // 重なりを判定する要素のサイズと座標を取得
  const rect = element.getBoundingClientRect();

  // マウスポインターが要素と重なっているかを判定する
  return (
    clientY < rect.bottom &&
    clientY > rect.top &&
    clientX < rect.right &&
    clientX > rect.left
  );
};

// 座標の型
interface Position {
  x: number;
  y: number;
}

// ドラッグ＆ドロップ要素の情報をまとめた型
interface DnDItem<T> {
  value: T; // useDnDSort()の引数に渡された配列の要素の値
  key: string; // 要素と紐づいた一意な文字列
  position: Position; // 要素の座標
  element: HTMLElement; // DOM情報
}

// useRef()で保持するデータの型
interface DnDRef<T> {
  keys: Map<T, string>; // 要素に紐づいたkey文字列を管理するMap
  dndItems: DnDItem<T>[]; // 並び替える全ての要素を保持するための配列
  canCheckHovered: boolean; // 重なり判定ができるかのフラグ
  pointerPosition: Position; // マウスポインターの座標
  dragElement: DnDItem<T> | null; // ドラッグしてる要素
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

/**
 * @description ドラッグ＆ドロップの並び替え処理を提供します
 */
export const useDnDSort = <T>(defaultItems: T[]): DnDSortResult<T>[] => {
  // 描画内容と紐づいているのでuseStateで管理する
  const [items, setItems] = useState(defaultItems);

  // 状態をrefで管理する
  const state = useRef<DnDRef<T>>({
    dndItems: [],
    keys: new Map(),
    dragElement: null,
    canCheckHovered: true,
    pointerPosition: { x: 0, y: 0 }
  }).current;

  // ドラッグ中の処理
  const onMouseMove = (event: MouseEvent) => {
    const { clientX, clientY } = event;
    const { dndItems, dragElement, pointerPosition } = state;

    // ドラッグして無ければ何もしない
    if (!dragElement) return;

    // マウスポインターの移動量を計算
    const x = clientX - pointerPosition.x;
    const y = clientY - pointerPosition.y;

    const dragStyle = dragElement.element.style;

    // ドラッグ要素の座標とスタイルを更新
    dragStyle.zIndex = "100";
    dragStyle.cursor = "grabbing";
    dragStyle.transform = `translate(${x}px,${y}px)`;

    // まだ確認できない場合は処理を終了する
    if (!state.canCheckHovered) return;

    // 確認できないようにする
    state.canCheckHovered = false;

    // 300ms後に確認できるようにする
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
      state.pointerPosition.x = clientX;
      state.pointerPosition.y = clientY;

      // 要素を入れ替える
      dndItems.splice(dragIndex, 1);
      dndItems.splice(hoveredIndex, 0, dragElement);

      const { left: x, top: y } = dragElement.element.getBoundingClientRect();

      // ドラッグ要素の座標を更新
      dragElement.position = { x, y };

      // 再描画する
      setItems(dndItems.map((v) => v.value));
    }
  };

  // ドラッグが終了した時の処理
  const onMouseUp = (event: MouseEvent) => {
    const { dragElement } = state;

    // ドラッグしていなかったら何もしない
    if (!dragElement) return;

    const dragStyle = dragElement.element.style;

    // ドラッグしてる要素に適用していたCSSを削除
    dragStyle.zIndex = "";
    dragStyle.cursor = "";
    dragStyle.transform = "";

    // ドラッグしている要素をstateから削除
    state.dragElement = null;

    // windowに登録していたイベントを削除
    window.removeEventListener("mouseup", onMouseUp);
    window.removeEventListener("mousemove", onMouseMove);
  };

  return items.map(
    (value: T): DnDSortResult<T> => {
      // keyが無ければ新しく作り、あれば既存のkey文字列を返す
      const key = state.keys.get(value) || Math.random().toString(16);

      // 生成したkey文字列を保存
      state.keys.set(value, key);

      return {
        value,

        key,

        events: {
          ref: (element: HTMLElement | null) => {
            if (!element) return;

            const { dndItems, dragElement, pointerPosition } = state;

            // 位置をリセットする
            element.style.transform = "";

            // 要素の位置を取得
            const { left: x, top: y } = element.getBoundingClientRect();
            const position: Position = { x, y };

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
              pointerPosition.x -= dragX;
              pointerPosition.y -= dragY;
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
            // ドラッグする要素(DOM)
            const element = event.currentTarget;

            // マウスポインターの座標を保持しておく
            state.pointerPosition.x = event.clientX;
            state.pointerPosition.y = event.clientY;

            // ドラッグしている要素のスタイルを上書き
            element.style.transition = ""; // アニメーションを無効にする
            element.style.cursor = "grabbing"; // カーソルのデザインを変更

            // 要素の座標を取得
            const { left: x, top: y } = element.getBoundingClientRect();
            const position: Position = { x, y };

            // ドラッグする要素を保持しておく
            state.dragElement = { key, value, element, position };

            // mousemove, mouseupイベントをwindowに登録する
            window.addEventListener("mouseup", onMouseUp);
            window.addEventListener("mousemove", onMouseMove);
          }
        }
      };
    }
  );
};
