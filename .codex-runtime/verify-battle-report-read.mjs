import { listBattleReports, getBattleReportSummary } from "../server/gameService.js";
const reportsPrimary = listBattleReports("Hayato", { page: 1, pageSize: 5 }, "dominion-1");
const summaryPrimary = getBattleReportSummary("Hayato", "dominion-1");
console.log(JSON.stringify({ reportsPrimary, summaryPrimary }, null, 2));
