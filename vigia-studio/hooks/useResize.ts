import { useState, useCallback, useRef, useEffect } from 'react';

// ─────────────────────────────────────────────
// useResize — Vertical drag-resize for panels
// ─────────────────────────────────────────────

export function useVerticalResize(
  initialHeight: number,
  minHeight: number,
  maxHeightFn: () => number
) {
  const [height, setHeight] = useState(initialHeight);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(initialHeight);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    startY.current = e.clientY;
    startHeight.current = height;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  }, [height]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = startY.current - e.clientY;
      const newHeight = Math.max(
        minHeight,
        Math.min(maxHeightFn(), startHeight.current + delta)
      );
      setHeight(newHeight);
    };

    const onMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [minHeight, maxHeightFn]);

  return { height, onMouseDown };
}
