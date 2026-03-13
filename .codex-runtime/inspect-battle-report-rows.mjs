import Database from "better-sqlite3";
const db = new Database("./server/data/game.sqlite", { readonly: true });
const rows = db.prepare(`
  SELECT br.id, br.player_id AS playerId, br.origin_village_id AS originVillageId, br.target_village_id AS targetVillageId,
         ov.region AS originRegion, tv.region AS targetRegion, br.title, br.created_at AS createdAt
  FROM battle_reports br
  LEFT JOIN villages ov ON ov.id = br.origin_village_id
  LEFT JOIN villages tv ON tv.id = br.target_village_id
  ORDER BY br.id DESC
  LIMIT 20
`).all();
console.log(JSON.stringify(rows, null, 2));
