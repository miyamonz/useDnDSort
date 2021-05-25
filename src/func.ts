
/**
 * @description マウスポインターが要素と被っているか判定します
 */
export const isHover = (event: MouseEvent, element: HTMLElement): boolean => {
  const {clientX, clientY} = event;
  const rect = element.getBoundingClientRect();
  return (
    clientY < rect.bottom &&
    clientY > rect.top &&
    clientX < rect.right &&
    clientX > rect.left
  );
};
