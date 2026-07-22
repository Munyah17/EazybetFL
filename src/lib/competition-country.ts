// The Odds API's /v4/sports response has no explicit country field (verified
// directly against the live API -- see conversation history). This maps each
// competition's odds_api_key to a country/region label, hand-curated from the
// actual key/title/description patterns the API returns. Continental or
// international cup competitions bucket under "International" rather than a
// single country, matching how sportsbooks conventionally group them.
const COMPETITION_COUNTRY: Record<string, string> = {
  // Soccer
  soccer_argentina_primera_division: "Argentina",
  soccer_austria_bundesliga: "Austria",
  soccer_belgium_first_div: "Belgium",
  soccer_brazil_campeonato: "Brazil",
  soccer_brazil_serie_b: "Brazil",
  soccer_chile_campeonato: "Chile",
  soccer_china_superleague: "China",
  soccer_conmebol_copa_libertadores: "International",
  soccer_conmebol_copa_sudamericana: "International",
  soccer_denmark_superliga: "Denmark",
  soccer_efl_champ: "England",
  soccer_england_efl_cup: "England",
  soccer_england_league1: "England",
  soccer_england_league2: "England",
  soccer_epl: "England",
  soccer_fa_cup: "England",
  soccer_finland_veikkausliiga: "Finland",
  soccer_france_ligue_one: "France",
  soccer_france_ligue_two: "France",
  soccer_germany_bundesliga: "Germany",
  soccer_germany_bundesliga2: "Germany",
  soccer_germany_dfb_pokal: "Germany",
  soccer_germany_liga3: "Germany",
  soccer_greece_super_league: "Greece",
  soccer_italy_serie_a: "Italy",
  soccer_italy_serie_b: "Italy",
  soccer_japan_j_league: "Japan",
  soccer_korea_kleague1: "South Korea",
  soccer_league_of_ireland: "Ireland",
  soccer_mexico_ligamx: "Mexico",
  soccer_netherlands_eredivisie: "Netherlands",
  soccer_norway_eliteserien: "Norway",
  soccer_poland_ekstraklasa: "Poland",
  soccer_portugal_primeira_liga: "Portugal",
  soccer_russia_premier_league: "Russia",
  soccer_spain_la_liga: "Spain",
  soccer_spain_segunda_division: "Spain",
  soccer_spl: "Scotland",
  soccer_sweden_allsvenskan: "Sweden",
  soccer_sweden_superettan: "Sweden",
  soccer_switzerland_superleague: "Switzerland",
  soccer_turkey_super_league: "Turkey",
  soccer_uefa_champs_league: "International",
  soccer_uefa_champs_league_qualification: "International",
  soccer_uefa_europa_league: "International",
  soccer_uefa_europa_conference_league: "International",
  soccer_uefa_european_championship: "International",
  soccer_usa_mls: "USA",
  soccer_fifa_world_cup: "International",
  soccer_fifa_world_cup_womens: "International",

  // Other sports -- mostly single-country leagues.
  basketball_nba: "USA",
  basketball_wnba: "USA",
  basketball_ncaab: "USA",
  americanfootball_nfl: "USA",
  americanfootball_ncaaf: "USA",
  icehockey_nhl: "USA/Canada",
  baseball_mlb: "USA",
};

export function competitionCountry(oddsApiKey: string): string {
  return COMPETITION_COUNTRY[oddsApiKey] ?? "International";
}
