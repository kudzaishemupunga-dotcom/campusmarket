export type Role = "user" | "model";
export type HistoryTurn = { role: Role; text: string };
export type ChatResult = {
  reply: string;
  mode: "local" | "ai";
  model?: string;
  notice?: string;
};

export function validHistory(value: unknown): value is HistoryTurn[] {
  return Array.isArray(value) && value.length <= 8 && value.every((entry) =>
    typeof entry === "object" && entry !== null &&
    (entry.role === "user" || entry.role === "model") &&
    typeof entry.text === "string" && entry.text.length <= 1000,
  );
}
