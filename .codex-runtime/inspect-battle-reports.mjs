import { listPlayerWorlds, listBattleReports, getBattleReportSummary } from "../server/gameService.js";
const worldsPayload = listPlayerWorlds("Hayato");
const result = {
  defaultWorldId: worldsPayload.defaultWorldId,
  worlds: worldsPayload.worlds.map((w) => ({ id: w.id, region: w.region, villageCount: w.player?.villageCount ?? 0, prestige: w.player?.prestige ?? 0 })),
  reportsDefault: getBattleReportSummary("Hayato"),
  reportsByWorld: worldsPayload.worlds.map((w) => ({
    id: w.id,
    region: w.region,
    summary: getBattleReportSummary("Hayato", w.id),
    list: listBattleReports("Hayato", { page: 1, pageSize: 5 }, w.id),
  })),
};
console.log(JSON.stringify(result, null, 2));
