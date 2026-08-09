import { useRef, type PointerEvent, type ReactElement } from 'react';

interface SplitterProps {
  /** vertical — pionowa belka rozdzielająca kolumny; horizontal — pozioma, rozdziela wiersze. */
  orientation: 'vertical' | 'horizontal';
  testId: string;
  onDragStart(): void;
  onDrag(dx: number, dy: number): void;
  onDragEnd(): void;
}

export function Splitter({
  orientation,
  testId,
  onDragStart,
  onDrag,
  onDragEnd,
}: SplitterProps): ReactElement {
  const origin = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    origin.current = { x: event.clientX, y: event.clientY };
    document.body.classList.add(`dragging-${orientation}`);
    onDragStart();
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    if (!origin.current) {
      return;
    }
    onDrag(event.clientX - origin.current.x, event.clientY - origin.current.y);
  };

  const finishDrag = (event: PointerEvent<HTMLDivElement>): void => {
    if (!origin.current) {
      return;
    }
    origin.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    document.body.classList.remove(`dragging-${orientation}`);
    onDragEnd();
  };

  return (
    <div
      className={`splitter ${orientation}`}
      data-testid={testId}
      role="separator"
      aria-orientation={orientation}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
    />
  );
}
