import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

export type BattleOverlayArrowState = 'lock' | 'target' | 'impact' | 'preview';
export type BattleOverlayAnchor = 'auto' | 'center' | 'top' | 'right' | 'bottom' | 'left';
export type BattleOverlaySlotKey = string;

export interface BattleOverlayArrowSpec {
  id: string;
  sourceKey: BattleOverlaySlotKey;
  targetKey: BattleOverlaySlotKey;
  state?: BattleOverlayArrowState;
  side?: 'player' | 'enemy';
  label?: string | null;
  hidden?: boolean;
  anchor?: BattleOverlayAnchor;
}

export interface BattleOverlayRectMap {
  [key: BattleOverlaySlotKey]: DOMRect | DOMRectReadOnly | null | undefined;
}

export interface BattleOverlayResolvedArrow extends BattleOverlayArrowSpec {
  path: string;
  length: number;
  midpoint: { x: number; y: number };
  start: { x: number; y: number };
  end: { x: number; y: number };
}

export interface UseBattleTargetOverlayOptions {
  arrows: BattleOverlayArrowSpec[];
  externalRects?: BattleOverlayRectMap;
  disabled?: boolean;
}

export interface UseBattleTargetOverlayResult {
  containerRef: (node: HTMLElement | null) => void;
  registerSlot: (slotKey: BattleOverlaySlotKey) => (node: HTMLElement | null) => void;
  setSlotNode: (slotKey: BattleOverlaySlotKey, node: HTMLElement | null) => void;
  getSlotRef: (slotKey: BattleOverlaySlotKey) => (node: HTMLElement | null) => void;
  getSlotRect: (slotKey: BattleOverlaySlotKey) => DOMRectReadOnly | null;
  refresh: () => void;
  width: number;
  height: number;
  arrows: BattleOverlayResolvedArrow[];
  isReady: boolean;
}

interface RelativeRect {
  left: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
  centerX: number;
  centerY: number;
}

const EMPTY_RECTS: Record<string, DOMRectReadOnly | null> = {};

const toRelativeRect = (rect: DOMRect | DOMRectReadOnly, containerRect: DOMRect | DOMRectReadOnly): RelativeRect => {
  const left = rect.left - containerRect.left;
  const top = rect.top - containerRect.top;
  const width = rect.width;
  const height = rect.height;
  const right = left + width;
  const bottom = top + height;

  return {
    left,
    top,
    width,
    height,
    right,
    bottom,
    centerX: left + width / 2,
    centerY: top + height / 2,
  };
};

const resolveAnchorPoint = (
  rect: RelativeRect,
  otherRect: RelativeRect,
  preferredAnchor: BattleOverlayAnchor,
): { x: number; y: number } => {
  if (preferredAnchor === 'center') {
    return { x: rect.centerX, y: rect.centerY };
  }

  if (preferredAnchor === 'top') {
    return { x: rect.centerX, y: rect.top };
  }

  if (preferredAnchor === 'right') {
    return { x: rect.right, y: rect.centerY };
  }

  if (preferredAnchor === 'bottom') {
    return { x: rect.centerX, y: rect.bottom };
  }

  if (preferredAnchor === 'left') {
    return { x: rect.left, y: rect.centerY };
  }

  const dx = otherRect.centerX - rect.centerX;
  const dy = otherRect.centerY - rect.centerY;

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx >= 0 ? { x: rect.right, y: rect.centerY } : { x: rect.left, y: rect.centerY };
  }

  return dy >= 0 ? { x: rect.centerX, y: rect.bottom } : { x: rect.centerX, y: rect.top };
};

const buildArrowPath = (
  sourceRect: RelativeRect,
  targetRect: RelativeRect,
  preferredAnchor: BattleOverlayAnchor,
): Omit<BattleOverlayResolvedArrow, keyof BattleOverlayArrowSpec> => {
  const start = resolveAnchorPoint(sourceRect, targetRect, preferredAnchor);
  const end = resolveAnchorPoint(targetRect, sourceRect, preferredAnchor);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.hypot(dx, dy);
  const dominantAxis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
  const controlFactor = Math.max(34, Math.min(136, distance * 0.34));

  const controlA =
    dominantAxis === 'x'
      ? { x: start.x + Math.sign(dx || 1) * controlFactor, y: start.y }
      : { x: start.x, y: start.y + Math.sign(dy || 1) * controlFactor };
  const controlB =
    dominantAxis === 'x'
      ? { x: end.x - Math.sign(dx || 1) * controlFactor, y: end.y }
      : { x: end.x, y: end.y - Math.sign(dy || 1) * controlFactor };

  return {
    path: `M ${start.x} ${start.y} C ${controlA.x} ${controlA.y}, ${controlB.x} ${controlB.y}, ${end.x} ${end.y}`,
    length: distance,
    midpoint: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
    start,
    end,
  };
};

const areRectsEqual = (left: DOMRectReadOnly | null, right: DOMRectReadOnly | null): boolean => {
  if (!left && !right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return (
    left.left === right.left &&
    left.top === right.top &&
    left.width === right.width &&
    left.height === right.height &&
    left.right === right.right &&
    left.bottom === right.bottom
  );
};

export const useBattleTargetOverlay = ({
  arrows,
  externalRects,
  disabled = false,
}: UseBattleTargetOverlayOptions): UseBattleTargetOverlayResult => {
  const containerNodeRef = useRef<HTMLElement | null>(null);
  const slotNodesRef = useRef(new Map<BattleOverlaySlotKey, HTMLElement>());
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const rafRef = useRef<number | null>(null);
  const [containerRect, setContainerRect] = useState<DOMRectReadOnly | null>(null);
  const [slotRects, setSlotRects] = useState<Record<BattleOverlaySlotKey, DOMRectReadOnly | null>>(EMPTY_RECTS);

  const measure = useCallback(() => {
    if (disabled) {
      setContainerRect(null);
      setSlotRects(EMPTY_RECTS);
      return;
    }

    const containerNode = containerNodeRef.current;
    if (!containerNode) {
      setContainerRect(null);
      setSlotRects(EMPTY_RECTS);
      return;
    }

    const nextContainerRect = containerNode.getBoundingClientRect();
    const nextSlotRects: Record<BattleOverlaySlotKey, DOMRectReadOnly | null> = {};

    slotNodesRef.current.forEach((node, key) => {
      nextSlotRects[key] = node.getBoundingClientRect();
    });

    let hasSlotRectChange = false;
    const previousKeys = Object.keys(slotRects);
    const nextKeys = Object.keys(nextSlotRects);

    if (previousKeys.length !== nextKeys.length) {
      hasSlotRectChange = true;
    } else {
      for (const key of nextKeys) {
        if (!areRectsEqual(slotRects[key] ?? null, nextSlotRects[key] ?? null)) {
          hasSlotRectChange = true;
          break;
        }
      }
    }

    if (!areRectsEqual(containerRect, nextContainerRect)) {
      setContainerRect(nextContainerRect);
    }

    if (hasSlotRectChange) {
      setSlotRects(nextSlotRects);
    }
  }, [containerRect, disabled, slotRects]);

  const scheduleMeasure = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      measure();
    });
  }, [measure]);

  const setSlotNode = useCallback(
    (slotKey: BattleOverlaySlotKey, node: HTMLElement | null) => {
      const currentNode = slotNodesRef.current.get(slotKey) ?? null;

      if (currentNode === node) {
        return;
      }

      if (currentNode && resizeObserverRef.current) {
        resizeObserverRef.current.unobserve(currentNode);
      }

      if (node) {
        slotNodesRef.current.set(slotKey, node);
        resizeObserverRef.current?.observe(node);
      } else {
        slotNodesRef.current.delete(slotKey);
      }

      scheduleMeasure();
    },
    [scheduleMeasure],
  );

  const registerSlot = useCallback(
    (slotKey: BattleOverlaySlotKey) => (node: HTMLElement | null) => {
      setSlotNode(slotKey, node);
    },
    [setSlotNode],
  );

  const getSlotRef = registerSlot;

  const containerRef = useCallback(
    (node: HTMLElement | null) => {
      if (containerNodeRef.current === node) {
        return;
      }

      if (containerNodeRef.current && resizeObserverRef.current) {
        resizeObserverRef.current.unobserve(containerNodeRef.current);
      }

      containerNodeRef.current = node;

      if (node) {
        resizeObserverRef.current?.observe(node);
      }

      scheduleMeasure();
    },
    [scheduleMeasure],
  );

  useLayoutEffect(() => {
    if (typeof window === 'undefined' || disabled) {
      return;
    }

    resizeObserverRef.current = new ResizeObserver(() => {
      scheduleMeasure();
    });

    const resizeObserver = resizeObserverRef.current;
    const containerNode = containerNodeRef.current;

    if (containerNode) {
      resizeObserver.observe(containerNode);
    }

    slotNodesRef.current.forEach((node) => {
      resizeObserver.observe(node);
    });

    return () => {
      resizeObserver.disconnect();
      resizeObserverRef.current = null;
    };
  }, [disabled, scheduleMeasure]);

  useEffect(() => {
    if (typeof window === 'undefined' || disabled) {
      return;
    }

    const handleViewportChange = () => {
      scheduleMeasure();
    };

    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [disabled, scheduleMeasure]);

  useEffect(() => {
    scheduleMeasure();
  }, [scheduleMeasure, arrows, externalRects]);

  useEffect(
    () => () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    },
    [],
  );

  const resolvedArrows = useMemo<BattleOverlayResolvedArrow[]>(() => {
    if (!containerRect || disabled) {
      return [];
    }

    return arrows.flatMap((arrow) => {
      if (arrow.hidden) {
        return [];
      }

      const sourceRect = externalRects?.[arrow.sourceKey] ?? slotRects[arrow.sourceKey] ?? null;
      const targetRect = externalRects?.[arrow.targetKey] ?? slotRects[arrow.targetKey] ?? null;

      if (!sourceRect || !targetRect) {
        return [];
      }

      const relativeSourceRect = toRelativeRect(sourceRect, containerRect);
      const relativeTargetRect = toRelativeRect(targetRect, containerRect);

      return [
        {
          ...arrow,
          state: arrow.state ?? 'target',
          ...buildArrowPath(relativeSourceRect, relativeTargetRect, arrow.anchor ?? 'auto'),
        },
      ];
    });
  }, [arrows, containerRect, disabled, externalRects, slotRects]);

  const getSlotRect = useCallback(
    (slotKey: BattleOverlaySlotKey): DOMRectReadOnly | null => {
      return (externalRects?.[slotKey] as DOMRectReadOnly | null | undefined) ?? slotRects[slotKey] ?? null;
    },
    [externalRects, slotRects],
  );

  return {
    containerRef,
    registerSlot,
    setSlotNode,
    getSlotRef,
    getSlotRect,
    refresh: scheduleMeasure,
    width: Math.max(0, Math.round(containerRect?.width ?? 0)),
    height: Math.max(0, Math.round(containerRect?.height ?? 0)),
    arrows: resolvedArrows,
    isReady: Boolean(containerRect),
  };
};
