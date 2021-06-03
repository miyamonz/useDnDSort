import React, { useState, useEffect, useMemo } from "react";
import { isHover, getElementPosition } from "./func";
import { useRefArr, usePromiseResolve } from "./hooks";

interface Position {
  x: number;
  y: number;
}

const sub = (a: Position, b: Position) => ({ x: a.x - b.x, y: a.y - b.y });

// ドラッグ＆ドロップ要素の情報をまとめた型
interface DnDItem<T> {
  value: T;
  key: string;
  element: HTMLElement;
  hitArea: DOMRect;
}
interface MouseDownResolvedValue<T> {
  item: DnDItem<T>;
  event: React.MouseEvent<HTMLElement>;
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

  const [dndItems, setDnDItems] = useRefArr<DnDItem<T>>();

  const [getMouseDownPromise, resolveMouseDown] =
    usePromiseResolve<MouseDownResolvedValue<T>>();
  const [getMouseUpPromise, resolveMouseUp] = usePromiseResolve<void>();

  async function listenDragUntilMouseUp(onMouseMove: (e: MouseEvent) => void) {
    window.addEventListener("mouseup", resolveMouseUp);
    window.addEventListener("mousemove", onMouseMove);
    await getMouseUpPromise();
    window.removeEventListener("mouseup", resolveMouseUp);
    window.removeEventListener("mousemove", onMouseMove);
  }

  const run = async () => {
    while (true) {
      await lifecycle({
        getMouseDownPromise,
        listenDragUntilMouseUp,
        dndItems,
        setItems: setDnDItems,
        render: (items) => setItems(items.map((v) => v.value)),
      });
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
            const hitArea = element.getBoundingClientRect();
            setDnDItems([...dndItems, { key, value, element, hitArea }]);
          }
        },

        onMouseDown: (event: React.MouseEvent<HTMLElement>) => {
          const dragItem = dndItems.find((item) => key === item.key);
          if (dragItem === undefined) throw new Error("drag item not found");
          resolveMouseDown({ item: dragItem, event });
        },
      },
    };
  });
};

interface LifecycleProp<T> {
  getMouseDownPromise: () => Promise<MouseDownResolvedValue<T>>;
  listenDragUntilMouseUp: (
    onMouseMove: (e: MouseEvent) => void
  ) => Promise<void>;
  dndItems: readonly DnDItem<T>[];
  setItems: (items: DnDItem<T>[]) => void;
  render: (items: DnDItem<T>[]) => void;
}
async function lifecycle<T>({
  getMouseDownPromise,
  listenDragUntilMouseUp,
  dndItems,
  setItems,
  render,
}: LifecycleProp<T>) {
  const {
    item: dragItem,
    event: { clientX, clientY },
  } = await getMouseDownPromise();

  // when sorting, this will be updated.
  let downPos = { x: clientX, y: clientY };
  const dragItemStyle = dragItem.element.style;

  const { cursor, transform, zIndex } = dragItemStyle;
  const prevStyle = { cursor, transform, zIndex };

  // ドラッグしている要素のスタイルを上書き
  Object.assign(dragItemStyle, {
    transition: "",
    cursor: "grabbing",
  });

  // ドラッグ中の処理
  const onMouseMove = (event: MouseEvent) => {
    const mousePos = { x: event.clientX, y: event.clientY };

    // assign drag item style
    // マウスポインターの移動量を計算
    const offset = sub(mousePos, downPos);

    // ドラッグ要素の座標とスタイルを更新
    Object.assign(dragItemStyle, {
      zIndex: "100",
      cursor: "grabbing",
      transform: `translate(${offset.x}px,${offset.y}px)`,
    });

    // 入れ替え判定
    // ホバーされている要素の配列の位置を取得
    const hoveredIndex = dndItems.findIndex(
      ({ hitArea, key }) => key !== dragItem.key && isHover(mousePos, hitArea)
    );

    // ホバーされている要素があれば、ドラッグしている要素と入れ替える
    if (hoveredIndex === -1) return;
    const dragIndex = dndItems.findIndex(({ key }) => key === dragItem.key);
    //sort
    const sorted = [...dndItems];
    sorted.splice(dragIndex, 1);
    sorted.splice(hoveredIndex, 0, dragItem);

    // get previous position
    const beforeRenderData = sorted.map((item) => {
      return {
        ...item,
        prevPos: getElementPosition(item.element),
      };
    });

    // re-render
    render(sorted);

    // calculate new position and hitArea
    const newItems = beforeRenderData.map((item) => {
      item.element.style.transform = "";
      item.element.style.transition = "";
      const position = getElementPosition(item.element);
      const hitArea = item.element.getBoundingClientRect();
      return Object.assign({}, item, { position, hitArea });
    });

    // apply transform and animation
    newItems
      .map((item) => {
        return {
          diff: sub(item.prevPos, item.position),
          style: item.element.style,
          isDragItem: item.key == dragItem.key,
        };
      })
      .forEach(({ diff, style, isDragItem }) => {
        style.transform = `translate(${diff.x}px,${diff.y}px)`;

        if (isDragItem) {
          // update down position to ajust dragging offset
          downPos = sub(mousePos, diff);
        } else {
          requestAnimationFrame(() => {
            style.transform = "";
            style.transition = "all 200ms";
          });
        }
      });

    setItems(newItems);
  };

  await listenDragUntilMouseUp(onMouseMove);
  // ドラッグしてる要素に適用していたCSSを削除
  Object.assign(dragItemStyle, { ...prevStyle });
}
