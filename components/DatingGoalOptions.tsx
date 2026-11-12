import { RingIcon, LoveGoalIcon, ChatIcon, CwtchIcon, ShrugIcon } from "./DatingGoalIcons";

export const VET_INTE = "Vet inte";

export const DATING_GOAL_OPTIONS = [
  { label: "Seriöst förhållande", value: "Seriöst förhållande" },
  { label: "Casual dating", value: "Casual" },
  { label: "Nya vänner", value: "Vänner" },
  { label: "Öppen för allt", value: "Öppen" },
  { label: VET_INTE, value: VET_INTE },
];

export function DatingGoalIcon({ value, size = 18 }: { value: string; size?: number }) {
  switch (value) {
    case "Seriöst förhållande": return <RingIcon size={size} />;
    case "Casual": return <LoveGoalIcon size={size} />;
    case "Vänner": return <ChatIcon size={size} />;
    case "Öppen": return <CwtchIcon size={size} />;
    case VET_INTE: return <ShrugIcon size={size} />;
    default: return null;
  }
}

// "Vet inte" is mutually exclusive with everything else; all other options
// combine freely with each other.
export function toggleDatingGoal(current: string[], value: string): string[] {
  if (value === VET_INTE) {
    return current.length === 1 && current[0] === VET_INTE ? [] : [VET_INTE];
  }
  const base = current.filter((v) => v !== VET_INTE);
  return base.includes(value) ? base.filter((v) => v !== value) : [...base, value];
}
