interface Position {
  x: number;
  y: number;
}
/**
 * @description マウスポインターが要素と被っているか判定します
 */
export const isHover = ({ x, y }: Position, rect: DOMRect): boolean => {
  return y < rect.bottom && y > rect.top && x < rect.right && x > rect.left;
};

export const getElementPosition = (element: HTMLElement): Position => {
  const { left, top } = element.getBoundingClientRect();
  return { x: left, y: top };
};
