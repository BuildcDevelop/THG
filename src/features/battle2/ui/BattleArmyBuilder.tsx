import type { ChangeEvent } from 'react';
import {
  RANGED_DOCTRINE_OPTIONS,
  SLOT_STANCE_OPTIONS,
} from '../engine/constants';
import type { ArmySlotLoadout, BattleSlotId, RangedDoctrineId, SlotStance, UnitTemplate } from '../engine/types';
import {
  buildSelectionOptions,
  formatArchetypeLabel,
  formatDoctrineLabel,
  formatQualityLabel,
  formatStanceLabel,
  formatTemplateStats,
  getSectorLabel,
  getShortSlotLabel,
  getSlotLabel,
  getTemplateLabel,
  groupSlotsBySector,
} from './battleUiUtils';
import './battle2-ui.css';

export interface BattleArmyBuilderProps {
  className?: string;
  title?: string;
  subtitle?: string;
  disabled?: boolean;
  slots: ArmySlotLoadout[];
  availableTemplates: UnitTemplate[];
  onSlotTemplateChange: (slotId: BattleSlotId, templateId: string | null) => void;
  onSlotStanceChange: (slotId: BattleSlotId, stance: SlotStance) => void;
  onSlotDoctrineChange?: (slotId: BattleSlotId, doctrine: RangedDoctrineId) => void;
}

const READ_ONLY = 'Bez jednotky';

const handleTemplateChange = (
  event: ChangeEvent<HTMLSelectElement>,
  slotId: BattleSlotId,
  onSlotTemplateChange: BattleArmyBuilderProps['onSlotTemplateChange'],
): void => {
  const nextTemplateId = event.currentTarget.value || null;
  onSlotTemplateChange(slotId, nextTemplateId);
};

const handleStanceChange = (
  event: ChangeEvent<HTMLSelectElement>,
  slotId: BattleSlotId,
  onSlotStanceChange: BattleArmyBuilderProps['onSlotStanceChange'],
): void => {
  onSlotStanceChange(slotId, event.currentTarget.value as SlotStance);
};

const handleDoctrineChange = (
  event: ChangeEvent<HTMLSelectElement>,
  slotId: BattleSlotId,
  onSlotDoctrineChange: BattleArmyBuilderProps['onSlotDoctrineChange'],
): void => {
  onSlotDoctrineChange?.(slotId, event.currentTarget.value as RangedDoctrineId);
};

export const BattleArmyBuilder = ({
  className,
  title = 'Stavba armady hrace',
  subtitle = 'Sestav 9 slotu vlastni formace. Predni linie drzi pechota, strelci a jizda tvori podporu.',
  disabled = false,
  slots,
  availableTemplates,
  onSlotTemplateChange,
  onSlotStanceChange,
  onSlotDoctrineChange,
}: BattleArmyBuilderProps) => {
  const templateGroups = buildSelectionOptions(availableTemplates);
  const sectorGroups = groupSlotsBySector(slots);

  return (
    <section className={`battle2-panel battle2-builder ${disabled ? ' battle2-panel--disabled' : ''}${className ? ` ${className}` : ''}`.trim()}>
      <header className="battle2-panel__header">
        <div>
          <p className="battle2-eyebrow">Nastaveni armady</p>
          <h2 className="battle2-title">{title}</h2>
        </div>
        <p className="battle2-panel__subtitle">{subtitle}</p>
      </header>

      <div className="battle2-slot-grid battle2-slot-grid--builder">
        {Object.entries(sectorGroups).map(([sector, sectorSlots]) => (
          <article key={sector} className="battle2-sector-card">
            <header className="battle2-sector-card__header">
              <span className="battle2-sector-card__label">{getSectorLabel(sector as 'left' | 'center' | 'right')}</span>
              <span className="battle2-chip battle2-chip--subtle">{sectorSlots.length} pozic</span>
            </header>

            <div className="battle2-slot-stack">
              {sectorSlots.map((slot) => {
                const template = availableTemplates.find((entry) => entry.id === slot.templateId) ?? null;

                return (
                  <article key={slot.slotId} className="battle2-slot-card">
                    <div className="battle2-slot-card__heading">
                      <div>
                        <p className="battle2-slot-card__slot">{getSlotLabel(slot.slotId)}</p>
                        <h3 className="battle2-slot-card__name">
                          {template ? template.name : 'Prazdny slot'}
                        </h3>
                      </div>
                      <span className="battle2-chip battle2-chip--slot">{getShortSlotLabel(slot.slotId)}</span>
                    </div>

                    <p className="battle2-slot-card__meta">
                      {template ? getTemplateLabel(template) : READ_ONLY}
                    </p>

                    {template ? (
                      <div className="battle2-slot-card__stats">
                        <span className={`battle2-chip battle2-chip--${template.archetype}`}>{formatArchetypeLabel(template.archetype)}</span>
                        <span className="battle2-chip battle2-chip--muted">{formatQualityLabel(template.quality)}</span>
                        <span className="battle2-chip battle2-chip--muted">{formatTemplateStats(template)}</span>
                      </div>
                    ) : (
                      <p className="battle2-slot-card__empty">
                        Vyber jednotku a aktivuj tuto pozici.
                      </p>
                    )}

                    <label className="battle2-field">
                      <span className="battle2-field__label">Typ jednotky</span>
                      <select
                        className="battle2-select"
                        value={slot.templateId ?? ''}
                        disabled={disabled}
                        onChange={(event) => handleTemplateChange(event, slot.slotId, onSlotTemplateChange)}
                      >
                        <option value="">Prazdny slot</option>
                        <optgroup label="Pechota">
                          {templateGroups.infantry.map((template) => (
                            <option key={template.id} value={template.id}>
                              {template.name}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Strelci">
                          {templateGroups.archer.map((template) => (
                            <option key={template.id} value={template.id}>
                              {template.name}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Jizda">
                          {templateGroups.cavalry.map((template) => (
                            <option key={template.id} value={template.id}>
                              {template.name}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </label>

                    <label className="battle2-field">
                      <span className="battle2-field__label">Postoj</span>
                      <select
                        className="battle2-select"
                        value={slot.stance}
                        disabled={disabled}
                        onChange={(event) => handleStanceChange(event, slot.slotId, onSlotStanceChange)}
                      >
                        {SLOT_STANCE_OPTIONS.map((stance) => (
                          <option key={stance} value={stance}>
                            {formatStanceLabel(stance)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="battle2-field battle2-field--inline">
                      <span className="battle2-field__label">Doktrina strelby</span>
                      {template?.archetype === 'archer' && onSlotDoctrineChange ? (
                        <select
                          className="battle2-select"
                          value={slot.rangedDoctrine}
                          disabled={disabled}
                          onChange={(event) => handleDoctrineChange(event, slot.slotId, onSlotDoctrineChange)}
                        >
                          {RANGED_DOCTRINE_OPTIONS.map((doctrine) => (
                            <option key={doctrine} value={doctrine}>
                              {formatDoctrineLabel(doctrine)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="battle2-field__readonly">
                          {template?.archetype === 'archer' ? formatDoctrineLabel(slot.rangedDoctrine) : 'Pouziva se jen pro strelce'}
                        </span>
                      )}
                    </div>

                    {template?.archetype === 'archer' && slot.slotId.endsWith('_front') ? (
                      <p className="battle2-slot-card__warning">
                        Strelec je v predni linii. Ponech to jen pokud chces rizikove rozestaveni.
                      </p>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};
