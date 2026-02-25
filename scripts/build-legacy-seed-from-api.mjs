import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import Database from 'better-sqlite3';
import { BUILDING_ORDER, UNIT_ORDER } from '../server/gameConfig.js';
import { applySqliteSnapshot } from '../server/sqliteSnapshot.js';

const SOURCE_API_BASE = String(process.env.SOURCE_API_BASE ?? 'https://thg.89-167-89-109.sslip.io').replace(/\/+$/, '');
const TEMPLATE_SQLITE = path.resolve(process.cwd(), process.env.TEMPLATE_SQLITE ?? 'server/data/game.sqlite');
const OUTPUT_SQLITE = path.resolve(process.cwd(), process.env.OUTPUT_SQLITE ?? 'server/data/game.seed.sqlite.backup');
const OUTPUT_SNAPSHOT = String(process.env.OUTPUT_SNAPSHOT ?? '').trim();
const DISCOVERY_USERNAME = String(process.env.SOURCE_WORLD_DISCOVERY_USERNAME ?? '').trim();
const SOURCE_WORLD_IDS = String(process.env.SOURCE_WORLD_IDS ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const STARTING_RESOURCES = {
  wood: 1000,
  stone: 1000,
  iron: 1000,
};

const VILLAGE_BUILDING_LEVEL_FLOORS = {
  woodcutter: 1,
  quarry: 1,
  'iron-mine': 1,
  warehouse: 1,
  barracks: 0,
  stable: 0,
  workshop: 0,
  fortification: 0,
  gate: 0,
  townhall: 0,
  university: 0,
  'residential-quarter': 1,
};

const ABANDONED_STARTING_BUILDING_LEVELS = {
  woodcutter: 5,
  quarry: 5,
  'iron-mine': 5,
  warehouse: 1,
};

const ABANDONED_MILITIA_COUNT = 100;

const PRIORITY_PLAYER_PASSWORDS = new Map([
  ['Hayato', 'Hayato@Dominion26'],
  ['-SaThAn?!', 'SaThAn?!_Abyss26'],
  ['*333*', 'Star333!Forge26'],
  ['Pegak', 'Pegak!Bastion26'],
  ['Torreya', 'Torreya!Raven26'],
  ['TSN', 'TSN!Legion26'],
  ['Sentryn', 'Sentryn!Citadel26'],
  ['Chakitis', '5555s6s6s5'],
  ['Insanity', '98854657da5'],
  ['Nicol', '22244444433a'],
  ['Wild', '7777dd95'],
]);

const normalizeUsername = (value) => String(value ?? '').trim().toLowerCase();
const nowIso = () => new Date().toISOString();

const getJson = async (pathnameWithQuery, retries = 3) => {
  const url = `${SOURCE_API_BASE}${pathnameWithQuery}`;
  let attempt = 0;
  let lastError = null;

  while (attempt < retries) {
    attempt += 1;
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt >= retries) {
        throw new Error(`Nepodarilo se nacist ${url}: ${error instanceof Error ? error.message : String(error)}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    }
  }

  throw lastError ?? new Error(`Nepodarilo se nacist ${url}`);
};

const resolveSeedPassword = (username) => {
  const normalized = String(username ?? '');
  return String(PRIORITY_PLAYER_PASSWORDS.get(normalized) ?? '123');
};

const toSortedRows = (rows, comparator) => [...rows].sort(comparator);

const main = async () => {
  if (!fs.existsSync(TEMPLATE_SQLITE)) {
    throw new Error(`Template SQLite soubor nebyl nalezen: ${TEMPLATE_SQLITE}`);
  }

  console.log(`[restore] source=${SOURCE_API_BASE}`);
  console.log(`[restore] template=${TEMPLATE_SQLITE}`);
  console.log(`[restore] output=${OUTPUT_SQLITE}`);

  const adminPlayersPayload = await getJson('/api/v1/admin/players');
  if (!adminPlayersPayload?.ok || !Array.isArray(adminPlayersPayload.data)) {
    throw new Error('Neplatna odpoved z /api/v1/admin/players');
  }
  const adminPlayers = adminPlayersPayload.data;

  const initialDiscoveryUsername =
    DISCOVERY_USERNAME || String(adminPlayers[0]?.username ?? '').trim() || 'Hayato';
  let discoveredWorldIds = [];
  try {
    const worldsPayload = await getJson(`/api/v1/worlds?username=${encodeURIComponent(initialDiscoveryUsername)}`);
    discoveredWorldIds = Array.isArray(worldsPayload?.data?.worlds)
      ? worldsPayload.data.worlds
          .map((world) => String(world?.id ?? '').trim())
          .filter(Boolean)
      : [];
  } catch (error) {
    console.warn(`[restore] Nepodarilo se nacist seznam svetu z /api/v1/worlds (${String(error)}).`);
  }

  const worldIds = SOURCE_WORLD_IDS.length > 0 ? SOURCE_WORLD_IDS : discoveredWorldIds;
  if (worldIds.length === 0) {
    worldIds.push('dominion-1', 'dominion-1-fire');
  }
  console.log(`[restore] worlds=${worldIds.join(', ')}`);

  const adminPlayerMetaByNormalizedUsername = new Map(
    adminPlayers.map((row) => [
      normalizeUsername(row?.username),
      {
        username: String(row?.username ?? '').trim(),
        createdAt: String(row?.createdAt ?? nowIso()),
      },
    ]),
  );

  const playersById = new Map();
  const playerIdByNormalizedUsername = new Map();
  const playerIdAliases = new Map();
  const villagesById = new Map();
  const resourcesByVillageId = new Map();
  const buildingsByVillageAndId = new Map();
  const unitsByVillageAndId = new Map();
  const buildingUpgradesById = new Map();
  const unitRecruitmentsById = new Map();
  const armyMovementsById = new Map();
  const armyMovementUnitsByKey = new Map();
  const battleReportsById = new Map();
  const kingdomInvitesById = new Map();
  const kingdomEventsById = new Map();
  const kingdomInviteDraftsById = new Map();
  const kingdomEventDraftsById = new Map();
  const settlementsByVillageId = new Map();

  const upsertPlayer = ({
    id,
    username,
    password = null,
    isBot = 0,
    createdAt = null,
  }) => {
    const normalizedUsername = normalizeUsername(username);
    if (!normalizedUsername) {
      return null;
    }

    const rawNumericId = Number(id);
    if (!Number.isFinite(rawNumericId)) {
      return null;
    }

    const resolveCanonicalPlayerId = (value) => {
      let current = Number(value);
      let guard = 0;
      while (playerIdAliases.has(current) && guard < 32) {
        current = Number(playerIdAliases.get(current));
        guard += 1;
      }
      return Number(current);
    };

    const numericId = resolveCanonicalPlayerId(rawNumericId);
    const existingIdByUsername = playerIdByNormalizedUsername.get(normalizedUsername);
    if (existingIdByUsername != null && Number(existingIdByUsername) !== Number(numericId)) {
      const canonicalId = resolveCanonicalPlayerId(existingIdByUsername);
      playerIdAliases.set(rawNumericId, canonicalId);
      const existing = playersById.get(canonicalId);
      const finalUsername = String(existing?.username ?? username ?? '').trim();
      playersById.set(canonicalId, {
        id: canonicalId,
        username: finalUsername,
        password: String(existing?.password ?? password ?? resolveSeedPassword(finalUsername)),
        is_bot: Number(existing?.is_bot ?? isBot),
        created_at: String(existing?.created_at ?? createdAt ?? nowIso()),
      });
      return canonicalId;
    }

    const existing = playersById.get(numericId);
    nextPlayerId = Math.max(nextPlayerId, Number(numericId) + 1);
    const finalUsername = String(username).trim();
    const nextPlayer = {
      id: numericId,
      username: existing?.username ?? finalUsername,
      password: String(password ?? existing?.password ?? resolveSeedPassword(finalUsername)),
      is_bot: Number(existing?.is_bot ?? isBot),
      created_at: String(createdAt ?? existing?.created_at ?? nowIso()),
    };

    playersById.set(numericId, nextPlayer);
    playerIdByNormalizedUsername.set(normalizedUsername, numericId);
    return numericId;
  };

  const resolveCanonicalPlayerId = (value) => {
    let current = Number(value);
    let guard = 0;
    while (playerIdAliases.has(current) && guard < 32) {
      current = Number(playerIdAliases.get(current));
      guard += 1;
    }
    return Number(current);
  };

  let nextPlayerId = 1;
  const ensurePlayerByUsername = (username, fallbackCreatedAt = null) => {
    const normalized = normalizeUsername(username);
    if (!normalized) {
      return null;
    }

    const existingId = playerIdByNormalizedUsername.get(normalized);
    if (existingId != null) {
      return existingId;
    }

    const createdAt =
      fallbackCreatedAt ??
      adminPlayerMetaByNormalizedUsername.get(normalized)?.createdAt ??
      nowIso();
    const canonicalUsername = adminPlayerMetaByNormalizedUsername.get(normalized)?.username ?? String(username).trim();
    while (playersById.has(nextPlayerId) || playerIdAliases.has(nextPlayerId)) {
      nextPlayerId += 1;
    }
    const allocatedId = nextPlayerId++;
    upsertPlayer({
      id: allocatedId,
      username: canonicalUsername,
      password: resolveSeedPassword(username),
      isBot: 0,
      createdAt,
    });
    return allocatedId;
  };

  const botPlayerIdByVillageId = new Map();
  let botOrdinal = 1;
  const ensureBotPlayerForVillage = (villageId) => {
    if (botPlayerIdByVillageId.has(villageId)) {
      return botPlayerIdByVillageId.get(villageId);
    }

    while (playersById.has(nextPlayerId) || playerIdAliases.has(nextPlayerId)) {
      nextPlayerId += 1;
    }
    const playerId = nextPlayerId++;
    const username = `__abandoned_ai__${String(botOrdinal).padStart(3, '0')}`;
    botOrdinal += 1;
    upsertPlayer({
      id: playerId,
      username,
      password: '',
      isBot: 1,
      createdAt: nowIso(),
    });
    botPlayerIdByVillageId.set(villageId, playerId);
    return playerId;
  };

  const isSettlementBot = (settlement) => {
    const ownerNormalized = String(settlement?.owner ?? '')
      .trim()
      .toLowerCase();
    const ownerAscii = ownerNormalized
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const kindNormalized = String(settlement?.kind ?? '')
      .trim()
      .toLowerCase();
    return (
      ownerAscii === 'opustena osada' ||
      ownerNormalized === 'abandoned settlement' ||
      ownerNormalized === '' ||
      kindNormalized === 'abandoned' ||
      kindNormalized === 'bot'
    );
  };

  const captureWorldSettlement = (world) => {
    if (!world || !Array.isArray(world.settlements)) {
      return;
    }

    for (const settlement of world.settlements) {
      const villageId = Number(settlement?.villageId);
      if (!Number.isFinite(villageId)) {
        continue;
      }

      settlementsByVillageId.set(villageId, {
        villageId,
        name: String(settlement?.name ?? `Vesnice ${villageId}`),
        owner: String(settlement?.owner ?? '').trim(),
        kingdom: String(settlement?.kingdom ?? 'Neutral'),
        region: Number(settlement?.region ?? world.region ?? 1),
        coordX: Number(settlement?.globalX ?? 0),
        coordY: Number(settlement?.globalY ?? 0),
        prestige: Number(settlement?.prestige ?? 0),
        loyalty: Number(settlement?.loyalty ?? 100),
        isBot: isSettlementBot(settlement),
      });
    }
  };

  const captureKingdomHub = (stateRoot) => {
    const region = Number(stateRoot?.world?.region ?? 1);
    const currentPlayerId = Number(stateRoot?.player?.id);
    const currentPlayerUsername = String(stateRoot?.player?.username ?? '').trim();
    const createdAtFallback =
      adminPlayerMetaByNormalizedUsername.get(normalizeUsername(currentPlayerUsername))?.createdAt ??
      nowIso();
    const currentResolvedPlayerId =
      Number.isFinite(currentPlayerId) && currentPlayerId > 0
        ? upsertPlayer({
            id: currentPlayerId,
            username: currentPlayerUsername,
            createdAt: createdAtFallback,
          })
        : null;

    const hub = stateRoot?.kingdomHub ?? {};

    for (const invite of Array.isArray(hub.incomingInvites) ? hub.incomingInvites : []) {
      const inviteId = Number(invite?.id);
      if (!Number.isFinite(inviteId)) {
        continue;
      }
      if (!Number.isFinite(currentResolvedPlayerId) || Number(currentResolvedPlayerId) <= 0) {
        continue;
      }

      kingdomInviteDraftsById.set(inviteId, {
        id: inviteId,
        region,
        kingdom: String(invite?.kingdom ?? 'Neutral'),
        inviter_username: String(invite?.inviterUsername ?? invite?.inviter ?? '').trim(),
        target_username: currentPlayerUsername,
        status: String(invite?.status ?? 'pending'),
        created_at: String(invite?.createdAt ?? createdAtFallback),
        responded_at: invite?.respondedAt == null ? null : String(invite.respondedAt),
      });
    }

    for (const event of Array.isArray(hub.auditLog) ? hub.auditLog : []) {
      const eventId = Number(event?.id);
      if (!Number.isFinite(eventId)) {
        continue;
      }
      kingdomEventDraftsById.set(eventId, {
        id: eventId,
        region,
        kingdom: event?.kingdom == null ? null : String(event.kingdom),
        event_type: String(event?.eventType ?? 'unknown'),
        actor_username: String(event?.actorUsername ?? '').trim(),
        target_username: String(event?.targetUsername ?? '').trim(),
        payload_json: JSON.stringify({
          message: String(event?.message ?? ''),
        }),
        created_at: String(event?.createdAt ?? createdAtFallback),
      });
    }
  };

  const captureVillageDetail = (stateDetail) => {
    const playerId = Number(stateDetail?.player?.id);
    const playerUsername = String(stateDetail?.player?.username ?? '').trim();
    const resolvedPlayerId = Number.isFinite(playerId)
      ? upsertPlayer({
          id: playerId,
          username: playerUsername,
          createdAt: nowIso(),
        })
      : ensurePlayerByUsername(playerUsername);

    const village = stateDetail?.village;
    if (
      !village ||
      !Number.isFinite(Number(village.id)) ||
      !Number.isFinite(Number(resolvedPlayerId)) ||
      Number(resolvedPlayerId) <= 0
    ) {
      return;
    }

    const villageId = Number(village.id);
    villagesById.set(villageId, {
      id: villageId,
      player_id: Number(resolvedPlayerId),
      name: String(village?.name ?? `Vesnice ${villageId}`),
      kingdom: String(village?.kingdom ?? 'Neutral'),
      coord_x: Number(village?.coordX ?? 0),
      coord_y: Number(village?.coordY ?? 0),
      region: Number(village?.region ?? stateDetail?.world?.region ?? 1),
      prestige: Number(village?.prestige ?? 0),
      loyalty: Number(village?.loyalty ?? 100),
      created_at: nowIso(),
    });

    const resources = stateDetail?.resources ?? {};
    resourcesByVillageId.set(villageId, {
      village_id: villageId,
      wood: Number(resources?.wood ?? 0),
      stone: Number(resources?.stone ?? 0),
      iron: Number(resources?.iron ?? 0),
    });

    for (const building of Array.isArray(stateDetail?.buildings) ? stateDetail.buildings : []) {
      const buildingId = String(building?.id ?? '').trim();
      if (!buildingId) {
        continue;
      }
      buildingsByVillageAndId.set(`${villageId}|${buildingId}`, {
        village_id: villageId,
        building_id: buildingId,
        level: Number(building?.level ?? 0),
      });
    }

    for (const unit of Array.isArray(stateDetail?.units) ? stateDetail.units : []) {
      const unitId = String(unit?.id ?? '').trim();
      if (!unitId) {
        continue;
      }
      unitsByVillageAndId.set(`${villageId}|${unitId}`, {
        village_id: villageId,
        unit_id: unitId,
        amount: Number(unit?.amount ?? 0),
      });
    }

    for (const upgrade of Array.isArray(stateDetail?.activeUpgrades) ? stateDetail.activeUpgrades : []) {
      const upgradeId = Number(upgrade?.id);
      if (!Number.isFinite(upgradeId)) {
        continue;
      }
      buildingUpgradesById.set(upgradeId, {
        id: upgradeId,
        village_id: villageId,
        building_id: String(upgrade?.buildingId ?? ''),
        from_level: Number(upgrade?.fromLevel ?? 0),
        to_level: Number(upgrade?.toLevel ?? 0),
        wood_cost: Number(upgrade?.woodCost ?? 0),
        stone_cost: Number(upgrade?.stoneCost ?? 0),
        iron_cost: Number(upgrade?.ironCost ?? 0),
        started_at: String(upgrade?.startedAt ?? nowIso()),
        finish_at: String(upgrade?.finishAt ?? nowIso()),
        status: 'in_progress',
        completed_at: null,
      });
    }

    for (const recruitment of Array.isArray(stateDetail?.activeRecruitments) ? stateDetail.activeRecruitments : []) {
      const recruitmentId = Number(recruitment?.id);
      if (!Number.isFinite(recruitmentId)) {
        continue;
      }
      unitRecruitmentsById.set(recruitmentId, {
        id: recruitmentId,
        village_id: villageId,
        unit_id: String(recruitment?.unitId ?? ''),
        amount: Number(recruitment?.amount ?? 0),
        wood_cost: Number(recruitment?.woodCost ?? 0),
        stone_cost: Number(recruitment?.stoneCost ?? 0),
        iron_cost: Number(recruitment?.ironCost ?? 0),
        started_at: String(recruitment?.startedAt ?? nowIso()),
        finish_at: String(recruitment?.finishAt ?? nowIso()),
        status: 'in_progress',
        completed_at: null,
      });
    }

    const movementRows = Array.isArray(stateDetail?.army?.activeMovements)
      ? stateDetail.army.activeMovements
      : [];
    for (const movement of movementRows) {
      const movementId = Number(movement?.id);
      if (!Number.isFinite(movementId)) {
        continue;
      }

      armyMovementsById.set(movementId, {
        id: movementId,
        player_id: Number(resolvedPlayerId),
        command_type: String(movement?.commandType ?? 'move'),
        origin_village_id: Number(movement?.originVillageId ?? villageId),
        target_village_id: Number(movement?.targetVillageId ?? villageId),
        home_village_id: Number(movement?.homeVillageId ?? villageId),
        loot_priority: movement?.lootPriority == null ? null : String(movement.lootPriority),
        carry_wood: Number(movement?.carryWood ?? 0),
        carry_stone: Number(movement?.carryStone ?? 0),
        carry_iron: Number(movement?.carryIron ?? 0),
        started_at: String(movement?.startedAt ?? nowIso()),
        arrive_at: String(movement?.arriveAt ?? nowIso()),
        status: 'in_progress',
        completed_at: null,
      });

      for (const movementUnit of Array.isArray(movement?.units) ? movement.units : []) {
        const unitId = String(movementUnit?.unitId ?? '').trim();
        if (!unitId) {
          continue;
        }
        const key = `${movementId}|${unitId}`;
        armyMovementUnitsByKey.set(key, {
          movement_id: movementId,
          unit_id: unitId,
          amount: Number(movementUnit?.amount ?? 0),
        });
      }
    }
  };

  const captureReports = async (username, worldId) => {
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      const reportPayload = await getJson(
        `/api/v1/reports?username=${encodeURIComponent(username)}&worldId=${encodeURIComponent(worldId)}&page=${page}&pageSize=100`,
      );
      const reportData = reportPayload?.data;
      if (!reportData) {
        break;
      }
      totalPages = Math.max(1, Number(reportData.totalPages ?? 1));
      const items = Array.isArray(reportData.items) ? reportData.items : [];
      for (const item of items) {
        const reportId = Number(item?.id);
        if (!Number.isFinite(reportId)) {
          continue;
        }
        battleReportsById.set(reportId, {
          id: reportId,
          player_id: resolveCanonicalPlayerId(Number(item?.playerId ?? 0)),
          origin_village_id: item?.originVillageId == null ? null : Number(item.originVillageId),
          target_village_id: item?.targetVillageId == null ? null : Number(item.targetVillageId),
          battle_at: String(item?.battleAt ?? nowIso()),
          created_at: String(item?.createdAt ?? nowIso()),
          title: String(item?.title ?? ''),
          summary: String(item?.summary ?? ''),
          payload_json: JSON.stringify(item?.payload ?? {}),
        });
      }
      page += 1;
    }
  };

  for (const player of adminPlayers) {
    const username = String(player?.username ?? '').trim();
    if (!username) {
      continue;
    }

    for (const worldId of worldIds) {
      let stateRootPayload = null;
      try {
        stateRootPayload = await getJson(
          `/api/v1/state?username=${encodeURIComponent(username)}&worldId=${encodeURIComponent(worldId)}`,
        );
      } catch (error) {
        console.warn(`[restore] Preskakuji state root pro ${username}/${worldId}: ${String(error)}`);
        continue;
      }

      const stateRoot = stateRootPayload?.data;
      if (!stateRoot || !stateRoot.player) {
        continue;
      }

      captureWorldSettlement(stateRoot.world);
      captureKingdomHub(stateRoot);

      const villages = Array.isArray(stateRoot.villages) ? stateRoot.villages : [];
      for (const village of villages) {
        const villageId = Number(village?.id);
        if (!Number.isFinite(villageId)) {
          continue;
        }

        try {
          const detailPayload = await getJson(
            `/api/v1/state?username=${encodeURIComponent(username)}&worldId=${encodeURIComponent(worldId)}&villageId=${villageId}`,
          );
          captureVillageDetail(detailPayload?.data);
        } catch (error) {
          console.warn(`[restore] Preskakuji detail vesnice ${username}/${worldId}/${villageId}: ${String(error)}`);
        }
      }

      if (villages.length > 0) {
        try {
          await captureReports(username, worldId);
        } catch (error) {
          console.warn(`[restore] Preskakuji reporty pro ${username}/${worldId}: ${String(error)}`);
        }
      }
    }
  }

  for (const settlement of settlementsByVillageId.values()) {
    const villageId = Number(settlement.villageId);
    const existingVillage = villagesById.get(villageId);
    let playerId = existingVillage?.player_id ?? null;

    if (!Number.isFinite(Number(playerId)) || Number(playerId) <= 0) {
      if (settlement.isBot) {
        playerId = ensureBotPlayerForVillage(villageId);
      } else {
        playerId = ensurePlayerByUsername(settlement.owner, nowIso());
      }
    }

    if (!Number.isFinite(Number(playerId)) || Number(playerId) <= 0) {
      playerId = ensureBotPlayerForVillage(villageId);
    }

    villagesById.set(villageId, {
      id: villageId,
      player_id: Number(playerId),
      name: existingVillage?.name ?? String(settlement.name),
      kingdom: existingVillage?.kingdom ?? String(settlement.kingdom ?? 'Neutral'),
      coord_x: Number(existingVillage?.coord_x ?? settlement.coordX ?? 0),
      coord_y: Number(existingVillage?.coord_y ?? settlement.coordY ?? 0),
      region: Number(existingVillage?.region ?? settlement.region ?? 1),
      prestige: Number(existingVillage?.prestige ?? settlement.prestige ?? 0),
      loyalty: Number(existingVillage?.loyalty ?? settlement.loyalty ?? 100),
      created_at: String(existingVillage?.created_at ?? nowIso()),
    });
  }

  const playerById = playersById;
  for (const village of villagesById.values()) {
    const villageId = Number(village.id);
    const canonicalPlayerId = resolveCanonicalPlayerId(Number(village.player_id));
    village.player_id = Number(canonicalPlayerId);
    const owner = playerById.get(Number(canonicalPlayerId));
    const isBotVillage = Number(owner?.is_bot ?? 0) === 1;

    if (!resourcesByVillageId.has(villageId)) {
      resourcesByVillageId.set(villageId, {
        village_id: villageId,
        wood: Number(STARTING_RESOURCES.wood),
        stone: Number(STARTING_RESOURCES.stone),
        iron: Number(STARTING_RESOURCES.iron),
      });
    }

    for (const buildingId of BUILDING_ORDER) {
      const key = `${villageId}|${buildingId}`;
      if (buildingsByVillageAndId.has(key)) {
        continue;
      }
      const level = isBotVillage
        ? Number(ABANDONED_STARTING_BUILDING_LEVELS[buildingId] ?? 0)
        : Number(VILLAGE_BUILDING_LEVEL_FLOORS[buildingId] ?? 0);
      buildingsByVillageAndId.set(key, {
        village_id: villageId,
        building_id: buildingId,
        level,
      });
    }

    for (const unitId of UNIT_ORDER) {
      const key = `${villageId}|${unitId}`;
      if (unitsByVillageAndId.has(key)) {
        continue;
      }
      const amount = isBotVillage && unitId === 'militia' ? ABANDONED_MILITIA_COUNT : 0;
      unitsByVillageAndId.set(key, {
        village_id: villageId,
        unit_id: unitId,
        amount,
      });
    }
  }

  const villageIds = new Set([...villagesById.keys()].map((id) => Number(id)));
  let playerIds = new Set([...playersById.keys()].map((id) => Number(id)));

  for (const row of kingdomInviteDraftsById.values()) {
    const inviterPlayerId = ensurePlayerByUsername(row.inviter_username, row.created_at);
    const targetPlayerId = ensurePlayerByUsername(row.target_username, row.created_at);
    if (!Number.isFinite(inviterPlayerId) || Number(inviterPlayerId) <= 0) {
      continue;
    }
    if (!Number.isFinite(targetPlayerId) || Number(targetPlayerId) <= 0) {
      continue;
    }
    kingdomInvitesById.set(Number(row.id), {
      id: Number(row.id),
      region: Number(row.region ?? 1),
      kingdom: String(row.kingdom ?? 'Neutral'),
      inviter_player_id: Number(inviterPlayerId),
      target_player_id: Number(targetPlayerId),
      status: String(row.status ?? 'pending'),
      created_at: String(row.created_at ?? nowIso()),
      responded_at: row.responded_at == null ? null : String(row.responded_at),
    });
  }

  for (const row of kingdomEventDraftsById.values()) {
    const actorPlayerId = row.actor_username ? ensurePlayerByUsername(row.actor_username, row.created_at) : null;
    const targetPlayerId = row.target_username ? ensurePlayerByUsername(row.target_username, row.created_at) : null;
    kingdomEventsById.set(Number(row.id), {
      id: Number(row.id),
      region: Number(row.region ?? 1),
      kingdom: row.kingdom == null ? null : String(row.kingdom),
      event_type: String(row.event_type ?? 'unknown'),
      actor_player_id: actorPlayerId == null ? null : Number(actorPlayerId),
      target_player_id: targetPlayerId == null ? null : Number(targetPlayerId),
      payload_json: String(row.payload_json ?? '{}'),
      created_at: String(row.created_at ?? nowIso()),
    });
  }

  playerIds = new Set([...playersById.keys()].map((id) => Number(id)));

  const filteredBattleReports = [];
  for (const row of battleReportsById.values()) {
    const canonicalPlayerId = resolveCanonicalPlayerId(Number(row.player_id));
    if (!playerIds.has(canonicalPlayerId)) {
      continue;
    }
    filteredBattleReports.push({
      ...row,
      player_id: Number(canonicalPlayerId),
      origin_village_id: row.origin_village_id != null && villageIds.has(Number(row.origin_village_id))
        ? Number(row.origin_village_id)
        : null,
      target_village_id: row.target_village_id != null && villageIds.has(Number(row.target_village_id))
        ? Number(row.target_village_id)
        : null,
    });
  }

  const filteredKingdomInvites = [...kingdomInvitesById.values()]
    .map((row) => ({
      ...row,
      inviter_player_id: resolveCanonicalPlayerId(Number(row.inviter_player_id)),
      target_player_id: resolveCanonicalPlayerId(Number(row.target_player_id)),
    }))
    .filter(
      (row) =>
        playerIds.has(Number(row.inviter_player_id)) &&
        playerIds.has(Number(row.target_player_id)),
    );

  const filteredKingdomEvents = [...kingdomEventsById.values()]
    .map((row) => ({
      ...row,
      actor_player_id: row.actor_player_id == null ? null : resolveCanonicalPlayerId(Number(row.actor_player_id)),
      target_player_id: row.target_player_id == null ? null : resolveCanonicalPlayerId(Number(row.target_player_id)),
    }))
    .filter(
      (row) =>
        (row.actor_player_id == null || playerIds.has(Number(row.actor_player_id))) &&
        (row.target_player_id == null || playerIds.has(Number(row.target_player_id))),
    );

  const healthPayload = await getJson('/api/health').catch(() => null);
  const lastTickAt = String(healthPayload?.serverTime ?? nowIso());

  const snapshot = {
    players: toSortedRows(playersById.values(), (left, right) => Number(left.id) - Number(right.id)),
    villages: toSortedRows(villagesById.values(), (left, right) => Number(left.id) - Number(right.id)),
    resources: toSortedRows(resourcesByVillageId.values(), (left, right) => Number(left.village_id) - Number(right.village_id)),
    buildings: toSortedRows(buildingsByVillageAndId.values(), (left, right) => {
      const byVillage = Number(left.village_id) - Number(right.village_id);
      return byVillage !== 0 ? byVillage : String(left.building_id).localeCompare(String(right.building_id));
    }),
    units: toSortedRows(unitsByVillageAndId.values(), (left, right) => {
      const byVillage = Number(left.village_id) - Number(right.village_id);
      return byVillage !== 0 ? byVillage : String(left.unit_id).localeCompare(String(right.unit_id));
    }),
    buildingUpgrades: toSortedRows(buildingUpgradesById.values(), (left, right) => Number(left.id) - Number(right.id)),
    unitRecruitments: toSortedRows(unitRecruitmentsById.values(), (left, right) => Number(left.id) - Number(right.id)),
    armyMovements: toSortedRows(armyMovementsById.values(), (left, right) => Number(left.id) - Number(right.id)),
    armyMovementUnits: toSortedRows(armyMovementUnitsByKey.values(), (left, right) => {
      const byMovement = Number(left.movement_id) - Number(right.movement_id);
      return byMovement !== 0 ? byMovement : String(left.unit_id).localeCompare(String(right.unit_id));
    }),
    battleReports: toSortedRows(filteredBattleReports, (left, right) => Number(left.id) - Number(right.id)),
    kingdomInvites: toSortedRows(filteredKingdomInvites, (left, right) => Number(left.id) - Number(right.id)),
    kingdomEvents: toSortedRows(filteredKingdomEvents, (left, right) => Number(left.id) - Number(right.id)),
    gameState: [{ id: 1, last_tick_at: lastTickAt }],
  };

  if (OUTPUT_SNAPSHOT) {
    const outputSnapshotPath = path.resolve(process.cwd(), OUTPUT_SNAPSHOT);
    fs.mkdirSync(path.dirname(outputSnapshotPath), { recursive: true });
    fs.writeFileSync(outputSnapshotPath, JSON.stringify(snapshot, null, 2), 'utf8');
    console.log(`[restore] snapshot-json=${outputSnapshotPath}`);
  }

  fs.mkdirSync(path.dirname(OUTPUT_SQLITE), { recursive: true });
  fs.copyFileSync(TEMPLATE_SQLITE, OUTPUT_SQLITE);
  const db = new Database(OUTPUT_SQLITE);
  applySqliteSnapshot(db, snapshot);
  const foreignKeyIssues = db.prepare('PRAGMA foreign_key_check').all();
  if (foreignKeyIssues.length > 0) {
    db.close();
    throw new Error(`Foreign key check selhal (${foreignKeyIssues.length} problemu).`);
  }

  const topFire = db
    .prepare(
      `SELECT
          p.username,
          v.kingdom,
          SUM(v.prestige) AS prestige,
          COUNT(v.id) AS villages
       FROM players p
       INNER JOIN villages v ON v.player_id = p.id
       WHERE p.is_bot = 0
         AND v.region = 2
       GROUP BY p.id
       ORDER BY prestige DESC, villages DESC, p.username COLLATE NOCASE ASC
       LIMIT 10`,
    )
    .all();

  db.close();

  console.log('[restore] top-fire-world');
  topFire.forEach((row, index) => {
    console.log(
      `  ${index + 1}. ${String(row.username)} | ${String(row.kingdom)} | ${Number(row.prestige)} | ${Number(row.villages)}`,
    );
  });
  console.log(
    `[restore] done players=${snapshot.players.length} villages=${snapshot.villages.length} reports=${snapshot.battleReports.length}`,
  );
};

main().catch((error) => {
  console.error(`[restore] ERROR: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  process.exitCode = 1;
});
