import type { ArmyDefinition, BattleSlotId, UnitTemplate } from '../engine/types';
import type { EnemyTemplateDefinition } from '../engine/contracts';
import {
  formatArchetypeLabel,
  formatPlanLabel,
  formatQualityLabel,
  formatTemplateStats,
  getSectorLabel,
  getShortSlotLabel,
  getSlotLabel,
  getTemplateLabel,
  groupSlotsBySector,
} from './battleUiUtils';
import './battle2-ui.css';

export interface BattleEnemyPreviewProps {
  className?: string;
  enemyArmy: ArmyDefinition;
  templatesById: Record<string, UnitTemplate>;
  scenarioSeed: string;
  enemyTemplate: EnemyTemplateDefinition;
}

const countSlotsByArchetype = (army: ArmyDefinition, templatesById: Record<string, UnitTemplate>) => {
  const counts = { infantry: 0, archer: 0, cavalry: 0 };

  for (const slot of army.slots) {
    if (!slot.templateId) {
      continue;
    }
    const template = templatesById[slot.templateId];
    if (!template) {
      continue;
    }
    counts[template.archetype] += 1;
  }

  return counts;
};

const renderDeploymentLine = (
  slotId: BattleSlotId,
  army: ArmyDefinition,
  templatesById: Record<string, UnitTemplate>,
) => {
  const loadout = army.slots.find((slot) => slot.slotId === slotId) ?? null;
  const template = loadout?.templateId ? templatesById[loadout.templateId] ?? null : null;

  return (
    <article key={slotId} className="battle2-formation-slot">
      <div className="battle2-formation-slot__heading">
        <span className="battle2-formation-slot__slot">{getSlotLabel(slotId)}</span>
        <span className="battle2-chip battle2-chip--slot">{getShortSlotLabel(slotId)}</span>
      </div>
      {template ? (
        <>
          <h4 className="battle2-formation-slot__name">{template.name}</h4>
          <p className="battle2-formation-slot__meta">{getTemplateLabel(template)}</p>
          <div className="battle2-slot-card__stats">
            <span className={`battle2-chip battle2-chip--${template.archetype}`}>{formatArchetypeLabel(template.archetype)}</span>
            <span className="battle2-chip battle2-chip--muted">{formatQualityLabel(template.quality)}</span>
            <span className="battle2-chip battle2-chip--muted">{formatTemplateStats(template)}</span>
          </div>
        </>
      ) : (
        <p className="battle2-formation-slot__empty">Prazdny slot rozestaveni.</p>
      )}
    </article>
  );
};

export const BattleEnemyPreview = ({
  className,
  enemyArmy,
  templatesById,
  scenarioSeed,
  enemyTemplate,
}: BattleEnemyPreviewProps) => {
  const sectorGroups = groupSlotsBySector(enemyArmy.slots);
  const counts = countSlotsByArchetype(enemyArmy, templatesById);

  return (
    <section className={`battle2-panel battle2-enemy-preview ${className ?? ''}`.trim()}>
      <header className="battle2-panel__header">
        <div>
          <p className="battle2-eyebrow">Nahled nepritele</p>
          <h2 className="battle2-title">{enemyTemplate.label}</h2>
        </div>
        <div className="battle2-panel__meta-stack">
          <span className="battle2-chip battle2-chip--subtle">Seed {scenarioSeed}</span>
          <span className="battle2-chip battle2-chip--subtle">{formatPlanLabel(enemyArmy.plan)}</span>
        </div>
      </header>

      <p className="battle2-panel__subtitle">{enemyTemplate.description}</p>

      <div className="battle2-hero-strip">
        <div className="battle2-hero-strip__card">
          <span className="battle2-hero-strip__label">General</span>
          <strong>{enemyArmy.general.name}</strong>
        </div>
        <div className="battle2-hero-strip__card">
          <span className="battle2-hero-strip__label">Plan</span>
          <strong>{formatPlanLabel(enemyArmy.plan)}</strong>
        </div>
        <div className="battle2-hero-strip__card">
          <span className="battle2-hero-strip__label">Rozestaveni</span>
          <strong>{enemyArmy.slots.filter((slot) => slot.templateId).length} slotu</strong>
        </div>
      </div>

      <div className="battle2-army-snapshot">
        <div className="battle2-army-snapshot__item">
          <span className="battle2-army-snapshot__label">Pechota</span>
          <strong>{counts.infantry}</strong>
        </div>
        <div className="battle2-army-snapshot__item">
          <span className="battle2-army-snapshot__label">Strelci</span>
          <strong>{counts.archer}</strong>
        </div>
        <div className="battle2-army-snapshot__item">
          <span className="battle2-army-snapshot__label">Jizda</span>
          <strong>{counts.cavalry}</strong>
        </div>
      </div>

      <div className="battle2-slot-grid battle2-slot-grid--preview">
        {Object.entries(sectorGroups).map(([sector, sectorSlots]) => (
          <article key={sector} className="battle2-sector-card">
            <header className="battle2-sector-card__header">
              <span className="battle2-sector-card__label">{getSectorLabel(sector as 'left' | 'center' | 'right')}</span>
              <span className="battle2-chip battle2-chip--subtle">Nepratelske kridlo</span>
            </header>

            <div className="battle2-slot-stack">
              {sectorSlots.map((slot) => renderDeploymentLine(slot.slotId, enemyArmy, templatesById))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};
