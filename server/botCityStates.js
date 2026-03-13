export const BOT_CITY_STATE_TITLE = 'Městský stát';
export const PLAYER_SETTLEMENT_KIND = 'player';
export const ABANDONED_SETTLEMENT_KIND = 'abandoned';
export const BOT_CITY_STATE_SETTLEMENT_KIND = 'bot_city_state';

export const BOT_CITY_STATE_NAME_POOL = Object.freeze([
  'Trója',
  'Sparta',
  'Athény',
  'Korint',
  'Théby',
  'Argos',
  'Megara',
  'Milét',
  'Efes',
  'Syrakusy',
  'Kartágo',
  'Řím',
  'Byzanc',
  'Alexandrie',
  'Babylon',
  'Uruk',
  'Ur',
  'Lagaš',
  'Ninive',
  'Aššur',
  'Sidón',
  'Týr',
  'Jericho',
  'Súsa',
  'Persepolis',
  'Ekbatana',
  'Memfis',
  'Thinis',
  'Avaris',
  'Lhasa',
  'Samarkand',
  'Buchara',
  'Merv',
  'Balkh',
  'Kábul',
  'Pataliputra',
  'Ujjain',
  'Taxila',
  'Varanásí',
  'Mathura',
  'Ayodhya',
  'Kannauj',
  'Káňčí',
  'Madurai',
  'Anurádhapura',
  'Polonnaruwa',
  'Angkor',
  'Ayutthaya',
  'Sukhothai',
  'Pagan',
  'Prome',
  'Bagan',
  'Nara',
  'Heian',
  'Kamakura',
  'Edo',
  'Kyoto',
  'Osaka',
  'Nanjing',
  'Chang-an',
  'Luoyang',
  'Kaifeng',
  'Hangzhou',
  'Guangzhou',
  'Anyang',
  'Xianyang',
  'Yarkand',
  'Kášgar',
  'Bursa',
  'Edirne',
  'Konya',
  'Iznik',
  'Antiochie',
  'Damšek',
  'Aleppo',
  'Mosul',
  'Basra',
  'Kufa',
  'Fustat',
  'Káhira',
  'Córdoba',
  'Toledo',
  'Sevilla',
  'Granada',
  'Lisabon',
  'Porto',
  'Benátky',
  'Janov',
  'Florencie',
  'Pisa',
  'Siena',
  'Milán',
  'Neapol',
  'Ravenna',
  'Kolín',
  'Trevír',
  'Praha',
  'Krakov',
  'Kyjev',
  'Novgorod',
]);

const normalizeName = (value) => String(value ?? '').trim();

export const formatBotCityStateVillageName = (historicalNameRaw) => {
  const historicalName = normalizeName(historicalNameRaw);
  if (!historicalName) {
    return BOT_CITY_STATE_TITLE;
  }
  return `${BOT_CITY_STATE_TITLE} ${historicalName}`;
};

export const extractBotCityStateHistoricalName = (villageNameRaw) => {
  const villageName = normalizeName(villageNameRaw);
  const prefix = `${BOT_CITY_STATE_TITLE} `;
  if (!villageName.startsWith(prefix)) {
    return '';
  }
  return normalizeName(villageName.slice(prefix.length));
};

export const pickRandomUnusedBotCityStateName = (usedHistoricalNames, randomSource = Math.random) => {
  const used = usedHistoricalNames instanceof Set ? usedHistoricalNames : new Set();
  const available = BOT_CITY_STATE_NAME_POOL.filter((name) => !used.has(name));
  if (available.length <= 0) {
    return null;
  }
  const randomValue = Number(randomSource?.() ?? Math.random());
  const safeRandom = Number.isFinite(randomValue) ? Math.min(0.999999, Math.max(0, randomValue)) : Math.random();
  const index = Math.floor(safeRandom * available.length);
  return String(available[index]);
};

export const createFallbackBotCityStateVillageName = (usedVillageNames, startAt = 101) => {
  const used = usedVillageNames instanceof Set ? usedVillageNames : new Set();
  let counter = Math.max(1, Math.floor(Number(startAt) || 1));
  while (counter < 100_000) {
    const candidate = formatBotCityStateVillageName(String(counter));
    if (!used.has(candidate)) {
      return candidate;
    }
    counter += 1;
  }
  const entropy = Math.floor(Math.random() * 9_000_000) + 1_000_000;
  return formatBotCityStateVillageName(`X-${entropy}`);
};
