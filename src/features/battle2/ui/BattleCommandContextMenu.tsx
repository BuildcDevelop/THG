import { useEffect, useMemo, useRef } from 'react';

export interface BattleCommandContextMenuItem {
  id: string;
  label: string;
  description?: string;
  badge?: string;
  disabled?: boolean;
  disabledReason?: string;
  onSelect: () => void;
}

export interface BattleCommandContextMenuProps {
  open: boolean;
  position: { x: number; y: number } | null;
  title: string;
  subtitle?: string;
  items: BattleCommandContextMenuItem[];
  emptyLabel?: string;
  onClose: () => void;
}

export const BattleCommandContextMenu = ({
  open,
  position,
  title,
  subtitle,
  items,
  emptyLabel = 'Pro tento kontext nejsou dostupne zadne rozkazy.',
  onClose,
}: BattleCommandContextMenuProps) => {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const focusableItems = useMemo(() => items.filter((item) => !item.disabled), [items]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const firstButton = menuRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)');
    firstButton?.focus();
  }, [focusableItems.length, open]);

  if (!open || !position) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      className="battle-command-menu"
      style={{ left: position.x, top: position.y }}
      role="menu"
      aria-label={title}
    >
      <header className="battle-command-menu__header">
        <strong>{title}</strong>
        {subtitle ? <p>{subtitle}</p> : null}
      </header>

      <div className="battle-command-menu__items">
        {items.length === 0 ? <p className="battle-command-menu__empty">{emptyLabel}</p> : null}
        {items.map((item) => (
          <button
            key={item.id}
            className="battle-command-menu__item"
            type="button"
            role="menuitem"
            disabled={item.disabled}
            title={item.disabled ? item.disabledReason ?? item.description ?? item.label : item.description ?? item.label}
            aria-label={item.disabledReason ? `${item.label}. ${item.disabledReason}` : item.label}
            onClick={() => {
              if (item.disabled) {
                return;
              }
              item.onSelect();
              onClose();
            }}
          >
            <span className="battle-command-menu__label-row">
              <span className="battle-command-menu__label">{item.label}</span>
              {item.badge ? <span className="battle-command-menu__badge">{item.badge}</span> : null}
            </span>
            {item.description ? <span className="battle-command-menu__description">{item.description}</span> : null}
            {item.disabled && item.disabledReason ? <span className="battle-command-menu__reason">{item.disabledReason}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
};
