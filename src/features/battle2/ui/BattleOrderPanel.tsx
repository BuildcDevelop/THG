import type { BattleSlotId, SlotActionId, SlotRuntimeState, UnitTemplate } from '../engine/types';
import { SLOT_ACTION_OPTIONS } from '../engine/constants';
import { formatActionLabel, formatStatusLabel, getSlotLabel, getTemplateLabel } from './battleUiUtils';
import './battle2-ui.css';

export interface BattleOrderTargetOption {
  slotId: BattleSlotId;
  label: string;
  disabled?: boolean;
}

export interface BattleOrderPanelProps {
  className?: string;
  slot: SlotRuntimeState | null;
  template?: UnitTemplate | null;
  actionValue: SlotActionId | null;
  targetSlotId: BattleSlotId | null;
  targetOptions: BattleOrderTargetOption[];
  actionOptions?: SlotActionId[];
  disabled?: boolean;
  onActionChange: (action: SlotActionId | null) => void;
  onTargetChange: (targetSlotId: BattleSlotId | null) => void;
  onClearOverride: () => void;
}

export const BattleOrderPanel = ({
  className,
  slot,
  template,
  actionValue,
  targetSlotId,
  targetOptions,
  actionOptions = SLOT_ACTION_OPTIONS,
  disabled = false,
  onActionChange,
  onTargetChange,
  onClearOverride,
}: BattleOrderPanelProps) => {
  return (
    <section className={`battle2-panel battle2-order-panel ${className ?? ''}`.trim()}>
      <header className="battle2-panel__header">
        <div>
          <p className="battle2-eyebrow">Rucni rozkaz</p>
          <h2 className="battle2-title">Takticke zasahy</h2>
        </div>
        <div className="battle2-panel__meta-stack">
          {slot ? <span className="battle2-chip battle2-chip--subtle">{getSlotLabel(slot.slotId)}</span> : null}
          {slot ? <span className="battle2-chip battle2-chip--subtle">{formatStatusLabel(slot.status)}</span> : null}
        </div>
      </header>

      <p className="battle2-panel__subtitle">
        {slot
          ? `Naplanuj jednorazovy zasah pro ${slot.templateName}. Nabidka obsahuje jen akce platne pro tuto jednotku.`
          : 'Vyber slot a zadej rucni rozkaz.'}
      </p>

      {!slot ? (
        <p className="battle2-empty-state">Neni vybran zadny slot.</p>
      ) : (
        <div className="battle2-order-stack">
          <div className="battle2-order-summary">
            <div>
              <span className="battle2-order-summary__label">Jednotka</span>
              <strong>{slot.templateName}</strong>
            </div>
            <div>
              <span className="battle2-order-summary__label">Aktualne</span>
              <strong>{formatActionLabel(slot.action)}</strong>
            </div>
            <div>
              <span className="battle2-order-summary__label">Prepis</span>
              <strong>{actionValue ? formatActionLabel(actionValue) : 'Zadny'}</strong>
            </div>
          </div>

          <label className="battle2-field">
            <span className="battle2-field__label">Akce</span>
            <select
              className="battle2-select"
              value={actionValue ?? ''}
              disabled={disabled}
              onChange={(event) => onActionChange(event.currentTarget.value ? (event.currentTarget.value as SlotActionId) : null)}
            >
              <option value="">Vyber akci</option>
              {actionOptions.map((action) => (
                <option key={action} value={action}>
                  {formatActionLabel(action)}
                </option>
              ))}
            </select>
          </label>

          <label className="battle2-field">
            <span className="battle2-field__label">Cil</span>
            <select
              className="battle2-select"
              value={targetSlotId ?? ''}
              disabled={disabled}
              onChange={(event) => onTargetChange(event.currentTarget.value ? (event.currentTarget.value as BattleSlotId) : null)}
            >
              <option value="">Bez cile</option>
              {targetOptions.map((option) => (
                <option key={option.slotId} value={option.slotId} disabled={option.disabled}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="battle2-order-footer">
            <div className="battle2-order-footer__meta">
              <span className="battle2-order-footer__label">Sablona</span>
              <strong>{template ? getTemplateLabel(template) : 'Neznama sablona'}</strong>
            </div>
            <button className="battle2-button battle2-button--subtle" type="button" disabled={disabled} onClick={onClearOverride}>
              Zrusit prepis
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
