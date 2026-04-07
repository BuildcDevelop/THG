import type { EnemyTemplateDefinition } from '../engine/contracts';

export const ENEMY_TEMPLATE_DEFINITIONS: EnemyTemplateDefinition[] = [
  {
    id: 'balanced',
    label: 'Balanced Host',
    description: 'Vyrovnana armada s pevnym stredem a bez extremni preference.',
    preferredQualities: ['retainer', 'garrison'],
    preferredArchetypes: ['infantry', 'archer', 'cavalry'],
  },
  {
    id: 'pressure',
    label: 'Pressure Line',
    description: 'Agresivnejsi linie s tlakem na frontu a mensi ochotou cekat.',
    preferredQualities: ['retainer', 'mercenary'],
    preferredArchetypes: ['infantry', 'cavalry'],
  },
  {
    id: 'bowline',
    label: 'Bowline',
    description: 'Silnejsi strelci v main linii, pechota kryje predni sled.',
    preferredQualities: ['garrison', 'retainer'],
    preferredArchetypes: ['archer', 'infantry'],
  },
  {
    id: 'cavalry_wing',
    label: 'Cavalry Wing',
    description: 'Vetsi duraz na jizdu na kridlech a v rezerve.',
    preferredQualities: ['retainer', 'mercenary'],
    preferredArchetypes: ['cavalry', 'infantry'],
  },
];
