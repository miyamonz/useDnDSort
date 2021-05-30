import React, { useRef, useState, useEffect, useMemo } from "react";
import { isHover } from "./func";
import { usePromise } from "./hooks";

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
interface DragingItem {
  key: string;
  position: Position;
}

// useRef()で保持するデータの型
interface DnDRef {
  canCheckHovered: boolean; // 重なり判定ができるかのフラグ
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
  const state = useRef<DnDRef>({
    canCheckHovered: true,
  }).current;

  // これはonMouseMoveの際に使われてて、入れ替え時にだけなんかいじるので、pointerPositionという名前は正しくない
  // 掴んだときの初期位置だ
  // ドラッグ中の要素のtransformを得るために使っている
  const [pointerPosition, setPointerPosition] = usePointerPosition();

  const [onStartDrag, getStartDragPromise] =
    usePromise<[DnDItem<T>, React.MouseEvent<HTMLElement>]>();
  const [onEndDrag, getEndDragPromise] = usePromise<void>();

  const run = async () => {
    while (true) {
      const [dragItem, event] = await getStartDragPromise();
      console.log("onmousedown");

      // マウスポインターの座標を保持しておく
      setPointerPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // ドラッグしている要素のスタイルを上書き
      dragItem.element.style.transition = ""; // アニメーションを無効にする
      dragItem.element.style.cursor = "grabbing"; // カーソルのデザインを変更

      // ドラッグ中の処理
      const onMouseMove = (event: MouseEvent) => {
        const { clientX, clientY } = event;

        // マウスポインターの移動量を計算
        const x = clientX - pointerPosition.x;
        const y = clientY - pointerPosition.y;

        // ドラッグ要素の座標とスタイルを更新
        const dragStyle = dragItem.element.style;
        dragStyle.zIndex = "100";
        dragStyle.cursor = "grabbing";
        dragStyle.transform = `translate(${x}px,${y}px)`;

        // まだ確認できない場合は処理を終了する
        if (!state.canCheckHovered) return;
        state.canCheckHovered = false;
        setTimeout(() => (state.canCheckHovered = true), 300);

        // ドラッグしている要素の配列の位置を取得
        const dragIndex = dndItems.findIndex(({ key }) => key === dragItem.key);

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
          dndItems.splice(hoveredIndex, 0, dragItem);

          // ドラッグ要素の座標を更新
          dragItem.position = getElementPosition(dragItem.element);

          // 再描画する
          console.log("setItems");
          setItems(dndItems.map((v) => v.value));
          console.log("after setItems");
          // ここで再配置後の処理を行う
          dndItems.forEach((item) => {
            onSorted(dragItem)(item);
          });
        }
      };

      window.addEventListener("mouseup", onEndDrag);
      window.addEventListener("mousemove", onMouseMove);

      await getEndDragPromise();
      console.log("onmouseup");

      // ドラッグしてる要素に適用していたCSSを削除
      const dragStyle = dragItem.element.style;
      dragStyle.zIndex = "";
      dragStyle.cursor = "";
      dragStyle.transform = "";

      window.removeEventListener("mouseup", onEndDrag);
      window.removeEventListener("mousemove", onMouseMove);
    }
  };
  useEffect(() => {
    run().catch((e) => {
      console.log("stopped");
    });
  }, []);

  const dndItems = useRef<DnDItem<T>[]>([]).current;

  // depends dndItems, setPointerPosition
  const onSorted = (dragItem: DragingItem) => (item: DnDItem<T>) => {
    const { key, value, element } = item;
    console.log("onSorted", key);

    // 位置をリセットする
    element.style.transform = "";

    // 要素の位置を取得
    // これは並べ替え後の座標になる
    const position = getElementPosition(element);

    const itemIndex = dndItems.findIndex((item) => item.key === key);
    // assert( itemIndex >= 0 )

    // ドラッグ要素の時は、ズレを修正する
    if (dragItem?.key === key) {
      // ドラッグ要素のズレを計算する
      // ここわかりにくい
      // dragItemのpositionはonMouseMoveで更新してるから
      // positionは現在のelement位置からのpositionで、これはソート済みの位置を意味する
      // 結果として、dragX, dragYは、新しい並び替え位置からのマウスズレ差分を意味する
      const dragX = dragItem.position.x - position.x;
      const dragY = dragItem.position.y - position.y;

      // 入れ替え時のズレを無くす
      element.style.transform = `translate(${dragX}px,${dragY}px)`;

      // マウスポインターの位置も再計算してズレを無くす
      setPointerPosition((prev: Position) => ({
        x: prev.x - dragX,
        y: prev.y - dragY,
      }));
    } else {
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
    dndItems[itemIndex] = { key, value, element, position };
  };

  return items.map((value: T): DnDSortResult<T> => {
    const key = keyMap.get(value) as string;
    return {
      value,
      key,
      events: {
        ref: (element: HTMLElement | null) => {
          if (!element) return;

          const exists = dndItems.find((item) => item.key === key);

          // 要素が無ければ新しく追加して処理を終わる
          if (exists === undefined) {
            element.style.transform = "";
            const position = getElementPosition(element);
            return dndItems.push({ key, value, element, position });
          }
        },

        onMouseDown: (event: React.MouseEvent<HTMLElement>) => {
          const dragItem = dndItems.find((item) => key === item.key);
          if (dragItem === undefined) throw new Error("drag item not found");
          onStartDrag([dragItem, event]);
        },
      },
    };
  });
};
