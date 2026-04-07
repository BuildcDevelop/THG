import type { CSSProperties } from 'react';
import type { BattleOverlayResolvedArrow } from '../hooks/useBattleTargetOverlay';
import './battle-target-overlay.css';

export interface BattleTargetOverlayProps {
  className?: string;
  width: number;
  height: number;
  arrows: BattleOverlayResolvedArrow[];
  hidden?: boolean;
  showLabels?: boolean;
  ariaLabel?: string;
}

const buildLabelTransform = (x: number, y: number): string => `translate(${x}px, ${y}px)`;

export const BattleTargetOverlay = ({
  className,
  width,
  height,
  arrows,
  hidden = false,
  showLabels = true,
  ariaLabel = 'Prehled cilu na bojisti',
}: BattleTargetOverlayProps) => {
  if (hidden || width <= 0 || height <= 0) {
    return null;
  }

  return (
    <div className={`battle-target-overlay ${className ?? ''}`.trim()} aria-hidden="true">
      <svg
        className="battle-target-overlay__svg"
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        focusable="false"
        role="img"
        aria-label={ariaLabel}
      >
        <defs>
          <marker
            id="battle-target-overlay-arrowhead"
            markerWidth="14"
            markerHeight="14"
            refX="10"
            refY="7"
            orient="auto-start-reverse"
            markerUnits="userSpaceOnUse"
          >
            <path className="battle-target-overlay__marker-path" d="M 0 0 L 14 7 L 0 14 z" />
          </marker>
        </defs>

        {arrows.map((arrow) => {
          const labelStyle = {
            '--battle-overlay-label-transform': buildLabelTransform(arrow.midpoint.x, arrow.midpoint.y),
          } as CSSProperties;

          return (
            <g
              className={`battle-target-overlay__arrow battle-target-overlay__arrow--${arrow.state ?? 'target'}${
                arrow.side ? ` battle-target-overlay__arrow--${arrow.side}` : ''
              }`}
              key={arrow.id}
            >
              <path className="battle-target-overlay__path battle-target-overlay__path--glow" d={arrow.path} pathLength={Math.max(1, arrow.length)} />
              <path
                className="battle-target-overlay__path battle-target-overlay__path--core"
                d={arrow.path}
                markerEnd="url(#battle-target-overlay-arrowhead)"
                pathLength={Math.max(1, arrow.length)}
              />
              {showLabels && arrow.label ? (
                <foreignObject
                  className="battle-target-overlay__label-wrap"
                  x={arrow.midpoint.x - 70}
                  y={arrow.midpoint.y - 18}
                  width="140"
                  height="40"
                >
                  <div className="battle-target-overlay__label" style={labelStyle}>
                    {arrow.label}
                  </div>
                </foreignObject>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
};
