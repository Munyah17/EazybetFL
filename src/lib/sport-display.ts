// The Odds API's `group` field comes through as "Soccer" -- we present it
// to Zimbabwean users as "Football" everywhere without touching the
// underlying synced data (a re-sync would just overwrite a DB edit anyway).
const DISPLAY_NAME_OVERRIDES: Record<string, string> = {
  Soccer: "Football",
};

export function displayGroupName(name: string) {
  return DISPLAY_NAME_OVERRIDES[name] ?? name;
}
