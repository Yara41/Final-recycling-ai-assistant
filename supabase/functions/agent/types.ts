import type { FunctionDeclaration } from "../_shared/gemini.ts";

export type Role = "student" | "faculty" | "staff" | "facilities" | "admin";
export const MEMBER_ROLES: Role[] = ["student", "faculty", "staff"];
export const ALL_ROLES: Role[] = [...MEMBER_ROLES, "facilities", "admin"];

export const CATEGORIES = ["plastic", "paper", "metal", "glass", "organic", "hazardous", "general"] as const;
export type Category = typeof CATEGORIES[number];

export type Bin = { id: string; label_ar: string; label_en: string; color: string; accepts: string[] };

export type University = {
  id: string;
  name: string;
  country: string;
  bins: Bin[];
  sorting_rules: string;
  points_per_item: number;
  default_language?: "ar" | "en";
};

export type ToolContext = {
  userId: string;
  role: Role;
  jwt: string;
  lang: "ar" | "en";
  university: University;
  conversationId: string | null;
  image?: { data: string; mimeType: string };
};

export type ActionCard = {
  kind:
    | "classified" | "logged" | "report" | "audit" | "dropoff" | "impact" | "leaderboard"
    | "reports" | "resolved" | "stats" | "insight" | "campaign" | "knowledge";
  title: string;
  detail?: string;
  points?: number;
  /** The bin station this action happened at, so the campus can animate it. */
  location_id?: string | null;
  data?: unknown;
};

export type ToolResult = { ok: boolean; data?: unknown; card?: ActionCard; error?: string };

export type Tool = {
  name: string;
  roles: Role[];
  declaration: FunctionDeclaration;
  run(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
};
