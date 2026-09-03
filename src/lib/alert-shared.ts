import type { Condition, Operand, RuleSet } from "./strategy";

export interface SavedAlert {
  id: string;
  user_id: string;
  name: string;
  symbol: string;
  interval: string;
  rule: RuleSet;
  channels: ("toast" | "push" | "email")[];
  cooldown_sec: number;
  enabled: boolean;
  last_fired_at: string | null;
  created_at: string;
  updated_at: string;
}

const uid = () => crypto.randomUUID();

export function defaultAlertRule(): RuleSet {
  return {
    join: "AND",
    conditions: [{
      id: uid(),
      left: { kind: "rsi", period: 14 } as Operand,
      op: "lt",
      right: { kind: "value", value: 30 } as Operand,
    } as Condition],
  };
}
