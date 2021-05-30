import React, { useRef, useState, useEffect, useMemo } from "react";
import { isHover, getElementPosition } from "./func";
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
  hitArea: DOMRect;
}
interface DragInfo {
  position: Position;
  mousePos: Position;
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

const onDrag = (startPos: Position) => (dragPos: Position) => {
  // マウスポインターの移動量を計算
  const x = dragPos.x - startPos.x;
  const y = dragPos.y - startPos.y;

  // ドラッグ要素の座標とスタイルを更新
  return {
    zIndex: "100",
    cursor: "grabbing",
    transform: `translate(${x}px,${y}px)`,
  };
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

  const dndItems = useRef<DnDItem<T>[]>([]).current;

  const [resolveMouseDown, getMouseDownPromise] =
    usePromise<[DnDItem<T>, React.MouseEvent<HTMLElement>]>();
  const [resolveMouseUp, getMouseUpPromise] = usePromise<void>();

  async function onDragPromise(onMouseMove: (e: MouseEvent) => void) {
    window.addEventListener("mouseup", resolveMouseUp);
    window.addEventListener("mousemove", onMouseMove);
    await getMouseUpPromise();
    window.removeEventListener("mouseup", resolveMouseUp);
    window.removeEventListener("mousemove", onMouseMove);
  }

  const run = async () => {
    while (true) {
      const [dragItem, { clientX, clientY }] = await getMouseDownPromise();
      console.log("onmousedown");

      // マウスポインターの座標を保持しておく
      let downPos = { x: clientX, y: clientY };

      const { cursor, transform, zIndex } = dragItem.element.style;
      const prevStyle = { cursor, transform, zIndex };

      // ドラッグしている要素のスタイルを上書き
      Object.assign(dragItem.element.style, {
        transition: "",
        cursor: "grabbing",
      });

      // ドラッグ中の処理
      const onMouseMove = (event: MouseEvent) => {
        const mousePos = { x: event.clientX, y: event.clientY };

        // assign drag item style
        const dragStyle = onDrag(downPos)(mousePos);
        Object.assign(dragItem.element.style, dragStyle);

        // 入れ替え判定
        // ホバーされている要素の配列の位置を取得
        const hoveredIndex = dndItems.findIndex(
          ({ hitArea, key }) =>
            key !== dragItem.key && isHover(mousePos, hitArea)
        );

        // ホバーされている要素があれば、ドラッグしている要素と入れ替える
        if (hoveredIndex >= 0) {
          const dragIndex = dndItems.findIndex(
            ({ key }) => key === dragItem.key
          );
          //swap
          dndItems.splice(dragIndex, 1);
          dndItems.splice(hoveredIndex, 0, dragItem);

          const dragInfo = {
            position: getElementPosition(dragItem.element),
            mousePos,
          };
          // get previous position
          const prevPosList = dndItems.map((item) => {
            return {
              key: item.key,
              position: getElementPosition(item.element),
            };
          });
          // re-render
          setItems(dndItems.map((v) => v.value));

          // ここで再配置後の処理を行う
          const newItems = dndItems.map((item) => {
            const { element } = item;

            // 位置をリセットする
            element.style.transform = "";
            element.style.transition = "";

            // 要素の位置を取得
            // これは位置をリセットしてからの取得なので並べ替え後の,最終位置の座標になる
            const position = getElementPosition(element);
            const hitArea = element.getBoundingClientRect();

            if (dragItem.key === item.key) {
              applyStyleForDragItem(
                dragInfo,
                (p) => (downPos = p)
              )(item.element);
            } else {
              const prevPos = prevPosList.find((l) => l.key === item.key);
              if (prevPos) {
                applyAnimation(prevPos.position, position, item.element);
              }
            }
            return {
              ...item,
              position,
              hitArea,
            };
          });

          dndItems.length = 0;
          Array.prototype.push.apply(dndItems, newItems);
        }
      };

      await onDragPromise(onMouseMove);
      console.log("onmouseup");

      // ドラッグしてる要素に適用していたCSSを削除
      Object.assign(dragItem.element.style, { ...prevStyle });
    }
  };
  useEffect(() => {
    run().catch((e) => {
      console.log("stopped");
    });
  }, []);

  return items.map((value: T): DnDSortResult<T> => {
    const key = keyMap.get(value) as string;
    return {
      value,
      key,
      events: {
        ref: (element: HTMLElement | null) => {
          if (!element) return;

          const exists = dndItems.find((item) => item.key === key);
          if (exists === undefined) {
            element.style.transform = "";
            const position = getElementPosition(element);
            const hitArea = element.getBoundingClientRect();
            return dndItems.push({ key, value, element, position, hitArea });
          }
        },

        onMouseDown: (event: React.MouseEvent<HTMLElement>) => {
          const dragItem = dndItems.find((item) => key === item.key);
          if (dragItem === undefined) throw new Error("drag item not found");
          resolveMouseDown([dragItem, event]);
        },
      },
    };
  });
};

const applyAnimation = (
  prevPos: Position,
  position: Position,
  element: HTMLElement
) => {
  // ドラッグ要素の時は、ズレを修正する
  // 前回の座標を計算
  const x = prevPos.x - position.x;
  const y = prevPos.y - position.y;

  // 要素を前回の位置に留めておく
  element.style.transform = `translate(${x}px,${y}px)`;

  // 一フレーム後に要素をアニメーションさせながら元に位置に戻す
  requestAnimationFrame(() => {
    element.style.transform = "";
    element.style.transition = "all 200ms";
  });
};

const applyStyleForDragItem =
  (dragInfo: DragInfo, setMouseDownPos: (p: Position) => void) =>
  (element: HTMLElement) => {
    // 要素の位置を取得
    // これは位置をリセットしてからの取得なので並べ替え後の,最終位置の座標になる
    const position = getElementPosition(element);

    const prevPos = dragInfo.position;

    // ドラッグ要素のズレを計算する
    // ここわかりにくい
    // dragInfoのpositionはonMouseMoveで更新してるから
    // positionは現在のelement位置からのpositionで、これはソート済みの位置を意味する
    // 結果として、dragX, dragYは、新しい並び替え位置からのマウスズレ差分を意味する
    const dragX = prevPos.x - position.x;
    const dragY = prevPos.y - position.y;

    // 入れ替え時のズレを無くす
    element.style.transform = `translate(${dragX}px,${dragY}px)`;

    // マウスポインターの位置も再計算してズレを無くす
    setMouseDownPos({
      x: dragInfo.mousePos.x - dragX,
      y: dragInfo.mousePos.y - dragY,
    });
  };
