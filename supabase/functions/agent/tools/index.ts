// Tool registry: which tools each role may use, and a safe runner that re-checks the role.
import type { Role, Tool, ToolContext, ToolResult } from "../types.ts";
import { analyzeTrends, draftCampaign, getCampusStats } from "./admin.ts";
import { classifyItem } from "./classify_item.ts";
import { findDropOff, getLeaderboard, getMyImpact, searchKnowledge } from "./community.ts";
import { logRecycling } from "./log_recycling.ts";
import { auditBinPhoto, listOpenReports, reportBinIssue, resolveReport } from "./reports.ts";

export const TOOLS: Tool[] = [
  searchKnowledge,
  classifyItem,
  logRecycling,
  reportBinIssue,
  auditBinPhoto,
  findDropOff,
  getMyImpact,
  getLeaderboard,
  listOpenReports,
  resolveReport,
  getCampusStats,
  analyzeTrends,
  draftCampaign,
];

export function toolsForRole(role: Role): Tool[] {
  return TOOLS.filter((tool) => tool.roles.includes(role));
}

export async function runTool(name: string, args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const tool = toolsForRole(ctx.role).find((t) => t.name === name);
  if (!tool) return { ok: false, error: "tool_not_allowed" };
  return await tool.run(args ?? {}, ctx);
}
