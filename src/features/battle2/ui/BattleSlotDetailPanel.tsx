import {
  formatActionLabel,
  formatArchetypeLabel,
  formatDoctrineLabel,
  formatQualityLabel,
  formatSideLabel,
  formatStanceLabel,
  formatStatusLabel,
  getRankLabel,
  getSectorLabel,
  getSlotLabel,
  getTemplateLabel,
} from './battleUiUtils';
import type { SlotRuntimeState, UnitTemplate } from '../engine/types';
import './battle2-ui.css';

export interface BattleSlotDetailPanelProps {
  className?: string;
  slot: SlotRuntimeState | null;
  template?: UnitTemplate | null;
  targetSlot?: SlotRuntimeState | null;
  title?: string;
  subtitle?: string;
  emptyLabel?: string;
}

const formatValue = (current: number, max: number): string => `${Math.max(0, Math.round(current))}/${Math.max(1, Math.round(max))}`;

export const BattleSlotDetailPanel = ({
  className,
  slot,
  template,
  targetSlot,
  title = 'Detail slotu',
  subtitle = 'Rozklad stavu vybrane jednotky a jeji role na bojisti.',
  emptyLabel = 'Vyber slot pro zobrazeni ziveho stavu boje.',
}: BattleSlotDetailPanelProps) => {
  return (
    <section className={`battle2-panel battle2-detail-panel ${className ?? ''}`.trim()}>
      <header className="battle2-panel__header">
        <div>
          <p className="battle2-eyebrow">Vybrany slot</p>
          <h2 className="battle2-title">{title}</h2>
        </div>
        <div className="battle2-panel__meta-stack">
          {slot ? <span className="battle2-chip battle2-chip--subtle">{getSlotLabel(slot.slotId)}</span> : null}
          {slot ? <span className="battle2-chip battle2-chip--subtle">{formatSideLabel(slot.side)}</span> : null}
        </div>
      </header>

      <p className="battle2-panel__subtitle">{subtitle}</p>

      {!slot ? (
        <p className="battle2-empty-state">{emptyLabel}</p>
      ) : (
        <div className="battle2-detail-stack">
          <div className="battle2-detail-hero">
            <div className="battle2-detail-hero__copy">
              <p className="battle2-detail-hero__slot">{getSlotLabel(slot.slotId)}</p>
              <h3>{slot.templateName}</h3>
              <p className="battle2-detail-hero__meta">{template ? getTemplateLabel(template) : 'Neznama sablona'}</p>
            </div>
            <div className="battle2-detail-hero__chips">
              <span className={`battle2-chip battle2-chip--${slot.archetype}`}>{formatArchetypeLabel(slot.archetype)}</span>
              <span className="battle2-chip battle2-chip--muted">{formatQualityLabel(slot.quality)}</span>
              <span className="battle2-chip battle2-chip--muted">{formatStatusLabel(slot.status)}</span>
            </div>
          </div>

          <div className="battle2-detail-grid">
            <article className="battle2-detail-card">
              <span className="battle2-detail-card__label">HP</span>
              <strong>{formatValue(slot.currentHp, slot.maxHp)}</strong>
              <span className="battle2-detail-card__meta">{slot.currentModels} modelu</span>
            </article>
            <article className="battle2-detail-card">
              <span className="battle2-detail-card__label">Moralka</span>
              <strong>{formatValue(slot.currentMorale, template ? template.morale + template.fortMorale : slot.currentMorale)}</strong>
              <span className="battle2-detail-card__meta">{formatActionLabel(slot.action)}</span>
            </article>
            <article className="battle2-detail-card">
              <span className="battle2-detail-card__label">Vytrvalost</span>
              <strong>{formatValue(slot.currentStamina, template ? template.staminaMax : slot.currentStamina)}</strong>
              <span className="battle2-detail-card__meta">{formatDoctrineLabel(slot.rangedDoctrine)}</span>
            </article>
          </div>

          <div className="battle2-detail-grid battle2-detail-grid--compact">
            <article className="battle2-detail-card">
              <span className="battle2-detail-card__label">Formace</span>
              <strong>{getSectorLabel(slot.sector)} / {getRankLabel(slot.rank)}</strong>
              <span className="battle2-detail-card__meta">{formatStanceLabel(slot.stance)}</span>
            </article>
            <article className="battle2-detail-card">
              <span className="battle2-detail-card__label">Aktualni akce</span>
              <strong>{formatActionLabel(slot.action)}</strong>
              <span className="battle2-detail-card__meta">
                {slot.targetSlotId ? `Cil ${getSlotLabel(slot.targetSlotId)}` : 'Bez cile'}
              </span>
            </article>
          </div>

          {template?.archetype === 'archer' ? (
            <div className="battle2-detail-note">
              <span className="battle2-detail-note__label">Munice</span>
              <strong>{slot.currentAmmo}</strong>
            </div>
          ) : null}

          {targetSlot ? (
            <section className="battle2-detail-target">
              <div className="battle2-detail-target__head">
                <span className="battle2-detail-target__label">Cil</span>
                <span className="battle2-chip battle2-chip--subtle">{getSlotLabel(targetSlot.slotId)}</span>
              </div>
              <strong>{targetSlot.templateName}</strong>
              <p className="battle2-detail-target__meta">
                {formatStatusLabel(targetSlot.status)} · {formatArchetypeLabel(targetSlot.archetype)} · {formatQualityLabel(targetSlot.quality)}
              </p>
            </section>
          ) : slot.targetSlotId ? (
            <section className="battle2-detail-target">
              <div className="battle2-detail-target__head">
                <span className="battle2-detail-target__label">Cil</span>
                <span className="battle2-chip battle2-chip--subtle">{getSlotLabel(slot.targetSlotId)}</span>
              </div>
              <p className="battle2-detail-target__meta">Detail cile neni v aktualnim pohledu dostupny.</p>
            </section>
          ) : null}
        </div>
      )}
    </section>
  );
};
