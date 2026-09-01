/**
 * Demo Data Definition for TyperLM26
 * 36 clubs with realistic attributes, players, and 8-round round-robin generator.
 */

export interface DemoTeamDef {
  name: string;
  short_name: string;
  code: string;
  logo_url: string;
  uefa_coefficient: number;
  disciplinary_points: number;
  players: Array<{
    name: string;
  }>;
}

export const DEMO_USERS = [
  { username: "demo1", firstName: "Jan", lastName: "Kowalski" },
  { username: "demo2", firstName: "Anna", lastName: "Nowak" },
  { username: "demo3", firstName: "Piotr", lastName: "Zieliński" },
  { username: "demo4", firstName: "Michał", lastName: "Wiśniewski" },
  { username: "demo5", firstName: "Katarzyna", lastName: "Wójcik" },
];

export const DEMO_TEAMS: DemoTeamDef[] = [
  {
    name: "Real Madrid CF",
    short_name: "Real",
    code: "RMA",
    logo_url: "",
    uefa_coefficient: 136.0,
    disciplinary_points: 3,
    players: [
      { name: "Kylian Mbappé" },
      { name: "Vinícius Júnior" },
      { name: "Jude Bellingham" },
    ],
  },
  {
    name: "Manchester City FC",
    short_name: "Man City",
    code: "MCI",
    logo_url: "",
    uefa_coefficient: 148.0,
    disciplinary_points: 2,
    players: [
      { name: "Erling Haaland" },
      { name: "Kevin De Bruyne" },
      { name: "Phil Foden" },
    ],
  },
  {
    name: "FC Bayern München",
    short_name: "Bayern",
    code: "BAY",
    logo_url: "",
    uefa_coefficient: 140.0,
    disciplinary_points: 1,
    players: [
      { name: "Harry Kane" },
      { name: "Jamal Musiala" },
      { name: "Manuel Neuer" },
    ],
  },
  {
    name: "Paris Saint-Germain FC",
    short_name: "PSG",
    code: "PSG",
    logo_url: "",
    uefa_coefficient: 116.0,
    disciplinary_points: 5,
    players: [
      { name: "Ousmane Dembélé" },
      { name: "Bradley Barcola" },
      { name: "Gianluigi Donnarumma" },
    ],
  },
  {
    name: "Liverpool FC",
    short_name: "Liverpool",
    code: "LIV",
    logo_url: "",
    uefa_coefficient: 114.0,
    disciplinary_points: 2,
    players: [
      { name: "Mohamed Salah" },
      { name: "Virgil van Dijk" },
      { name: "Alisson Becker" },
    ],
  },
  {
    name: "FC Internazionale Milano",
    short_name: "Inter",
    code: "INT",
    logo_url: "",
    uefa_coefficient: 101.0,
    disciplinary_points: 4,
    players: [
      { name: "Lautaro Martínez" },
      { name: "Marcus Thuram" },
      { name: "Nicolò Barella" },
    ],
  },
  {
    name: "Borussia Dortmund",
    short_name: "Dortmund",
    code: "BVB",
    logo_url: "",
    uefa_coefficient: 97.0,
    disciplinary_points: 3,
    players: [
      { name: "Serhou Guirassy" },
      { name: "Julian Brandt" },
      { name: "Gregor Kobel" },
    ],
  },
  {
    name: "RB Leipzig",
    short_name: "Leipzig",
    code: "RBL",
    logo_url: "",
    uefa_coefficient: 97.0,
    disciplinary_points: 2,
    players: [
      { name: "Benjamin Šeško" },
      { name: "Xavi Simons" },
      { name: "Péter Gulácsi" },
    ],
  },
  {
    name: "FC Barcelona",
    short_name: "Barça",
    code: "BAR",
    logo_url: "",
    uefa_coefficient: 91.0,
    disciplinary_points: 6,
    players: [
      { name: "Robert Lewandowski" },
      { name: "Lamine Yamal" },
      { name: "Raphinha Belloli" },
    ],
  },
  {
    name: "Bayer 04 Leverkusen",
    short_name: "Leverkusen",
    code: "B04",
    logo_url: "",
    uefa_coefficient: 90.0,
    disciplinary_points: 2,
    players: [
      { name: "Florian Wirtz" },
      { name: "Victor Boniface" },
      { name: "Lukáš Hrádecký" },
    ],
  },
  {
    name: "Club Atlético de Madrid",
    short_name: "Atlético",
    code: "ATM",
    logo_url: "",
    uefa_coefficient: 89.0,
    disciplinary_points: 8,
    players: [
      { name: "Antoine Griezmann" },
      { name: "Julián Alvarez" },
      { name: "Jan Oblak" },
    ],
  },
  {
    name: "Atalanta BC",
    short_name: "Atalanta",
    code: "ATA",
    logo_url: "",
    uefa_coefficient: 81.0,
    disciplinary_points: 4,
    players: [
      { name: "Ademola Lookman" },
      { name: "Mateo Retegui" },
      { name: "Marco Carnesecchi" },
    ],
  },
  {
    name: "Juventus FC",
    short_name: "Juventus",
    code: "JUV",
    logo_url: "",
    uefa_coefficient: 80.0,
    disciplinary_points: 5,
    players: [
      { name: "Dušan Vlahović" },
      { name: "Kenan Yıldız" },
      { name: "Michele Di Gregorio" },
    ],
  },
  {
    name: "SL Benfica",
    short_name: "Benfica",
    code: "SLB",
    logo_url: "",
    uefa_coefficient: 79.0,
    disciplinary_points: 3,
    players: [
      { name: "Ángel Di María" },
      { name: "Vangelis Pavlidis" },
      { name: "Anatoliy Trubin" },
    ],
  },
  {
    name: "Arsenal FC",
    short_name: "Arsenal",
    code: "ARS",
    logo_url: "",
    uefa_coefficient: 72.0,
    disciplinary_points: 2,
    players: [
      { name: "Bukayo Saka" },
      { name: "Martin Ødegaard" },
      { name: "David Raya" },
    ],
  },
  {
    name: "Club Brugge KV",
    short_name: "Brugge",
    code: "CLU",
    logo_url: "",
    uefa_coefficient: 64.0,
    disciplinary_points: 4,
    players: [
      { name: "Hans Vanaken" },
      { name: "Andreas Skov Olsen" },
      { name: "Simon Mignolet" },
    ],
  },
  {
    name: "Sporting Clube de Portugal",
    short_name: "Sporting",
    code: "SCP",
    logo_url: "",
    uefa_coefficient: 54.5,
    disciplinary_points: 3,
    players: [
      { name: "Viktor Gyökeres" },
      { name: "Pedro Gonçalves" },
      { name: "Franco Israel" },
    ],
  },
  {
    name: "Feyenoord Rotterdam",
    short_name: "Feyenoord",
    code: "FEY",
    logo_url: "",
    uefa_coefficient: 57.0,
    disciplinary_points: 5,
    players: [
      { name: "Santiago Giménez" },
      { name: "Quinten Timber" },
      { name: "Timon Wellenreuther" },
    ],
  },
  {
    name: "AC Milan",
    short_name: "Milan",
    code: "MIL",
    logo_url: "",
    uefa_coefficient: 59.0,
    disciplinary_points: 4,
    players: [
      { name: "Rafael Leão" },
      { name: "Christian Pulisic" },
      { name: "Mike Maignan" },
    ],
  },
  {
    name: "PSV Eindhoven",
    short_name: "PSV",
    code: "PSV",
    logo_url: "",
    uefa_coefficient: 54.0,
    disciplinary_points: 2,
    players: [
      { name: "Luuk de Jong" },
      { name: "Johan Bakayoko" },
      { name: "Walter Benítez" },
    ],
  },
  {
    name: "GNK Dinamo Zagreb",
    short_name: "Dinamo",
    code: "DIN",
    logo_url: "",
    uefa_coefficient: 50.0,
    disciplinary_points: 6,
    players: [
      { name: "Bruno Petković" },
      { name: "Martin Baturina" },
      { name: "Ivan Nevistić" },
    ],
  },
  {
    name: "FC Salzburg",
    short_name: "Salzburg",
    code: "SAL",
    logo_url: "",
    uefa_coefficient: 50.0,
    disciplinary_points: 3,
    players: [
      { name: "Karim Konaté" },
      { name: "Oscar Gloukh" },
      { name: "Janis Blaswich" },
    ],
  },
  {
    name: "Lille OSC",
    short_name: "Lille",
    code: "LOS",
    logo_url: "",
    uefa_coefficient: 47.0,
    disciplinary_points: 3,
    players: [
      { name: "Jonathan David" },
      { name: "Edon Zhegrova" },
      { name: "Lucas Chevalier" },
    ],
  },
  {
    name: "FK Crvena Zvezda",
    short_name: "Zvezda",
    code: "CRV",
    logo_url: "",
    uefa_coefficient: 40.0,
    disciplinary_points: 7,
    players: [
      { name: "Cherif Ndiaye" },
      { name: "Mirko Ivanić" },
      { name: "Omri Glazer" },
    ],
  },
  {
    name: "BSC Young Boys Bern",
    short_name: "Young Boys",
    code: "YBB",
    logo_url: "",
    uefa_coefficient: 34.5,
    disciplinary_points: 4,
    players: [
      { name: "Silvere Ganvoula" },
      { name: "Filip Ugrinic" },
      { name: "David von Ballmoos" },
    ],
  },
  {
    name: "Celtic FC",
    short_name: "Celtic",
    code: "CEL",
    logo_url: "",
    uefa_coefficient: 32.0,
    disciplinary_points: 5,
    players: [
      { name: "Kyogo Furuhashi" },
      { name: "Callum McGregor" },
      { name: "Kasper Schmeichel" },
    ],
  },
  {
    name: "ŠK Slovan Bratislava",
    short_name: "Slovan",
    code: "SLO",
    logo_url: "",
    uefa_coefficient: 30.5,
    disciplinary_points: 6,
    players: [
      { name: "David Strelec" },
      { name: "Vladimír Weiss" },
      { name: "Dominik Takáč" },
    ],
  },
  {
    name: "AS Monaco FC",
    short_name: "Monaco",
    code: "ASM",
    logo_url: "",
    uefa_coefficient: 24.0,
    disciplinary_points: 3,
    players: [
      { name: "Folarin Balogun" },
      { name: "Aleksandr Golovin" },
      { name: "Philipp Köhn" },
    ],
  },
  {
    name: "AC Sparta Praha",
    short_name: "Sparta",
    code: "SPA",
    logo_url: "",
    uefa_coefficient: 22.5,
    disciplinary_points: 4,
    players: [
      { name: "Victor Olatunji" },
      { name: "Lukáš Haraslín" },
      { name: "Peter Vindahl" },
    ],
  },
  {
    name: "Aston Villa FC",
    short_name: "Aston Villa",
    code: "AVL",
    logo_url: "",
    uefa_coefficient: 20.8,
    disciplinary_points: 2,
    players: [
      { name: "Ollie Watkins" },
      { name: "Youri Tielemans" },
      { name: "Emiliano Martínez" },
    ],
  },
  {
    name: "Bologna FC 1909",
    short_name: "Bologna",
    code: "BOL",
    logo_url: "",
    uefa_coefficient: 18.0,
    disciplinary_points: 3,
    players: [
      { name: "Santiago Castro" },
      { name: "Riccardo Orsolini" },
      { name: "Łukasz Skorupski" },
    ],
  },
  {
    name: "Girona FC",
    short_name: "Girona",
    code: "GIR",
    logo_url: "",
    uefa_coefficient: 17.5,
    disciplinary_points: 3,
    players: [
      { name: "Abel Ruiz" },
      { name: "Viktor Tsygankov" },
      { name: "Paulo Gazzaniga" },
    ],
  },
  {
    name: "VfB Stuttgart 1893",
    short_name: "Stuttgart",
    code: "VFB",
    logo_url: "",
    uefa_coefficient: 17.0,
    disciplinary_points: 2,
    players: [
      { name: "Deniz Undav" },
      { name: "Ermedin Demirović" },
      { name: "Alexander Nübel" },
    ],
  },
  {
    name: "SK Sturm Graz",
    short_name: "Sturm",
    code: "STU",
    logo_url: "",
    uefa_coefficient: 14.5,
    disciplinary_points: 5,
    players: [
      { name: "Mika Biereth" },
      { name: "Otar Kiteishvili" },
      { name: "Kjell Scherpen" },
    ],
  },
  {
    name: "Stade Brestois 29",
    short_name: "Brest",
    code: "BRE",
    logo_url: "",
    uefa_coefficient: 13.0,
    disciplinary_points: 2,
    players: [
      { name: "Ludovic Ajorque" },
      { name: "Romain Del Castillo" },
      { name: "Marco Bizot" },
    ],
  },
  {
    name: "FC Shakhtar Donetsk",
    short_name: "Shakhtar",
    code: "SHK",
    logo_url: "",
    uefa_coefficient: 63.0,
    disciplinary_points: 4,
    players: [
      { name: "Danylo Sikan" },
      { name: "Georgiy Sudakov" },
      { name: "Dmytro Riznyk" },
    ],
  },
];

/**
 * Standard Polygon Algorithm to generate exactly 8 rounds of 18 matches
 * for 36 teams (144 matches total, each team plays exactly 8 matches).
 */
export function generateFullLeagueSchedule(teamIds: string[]): Array<{
  homeTeamId: string;
  awayTeamId: string;
  matchday: number;
}> {
  if (teamIds.length !== 36) {
    throw new Error(`Expected exactly 36 teams, got ${teamIds.length}`);
  }

  const matches: Array<{ homeTeamId: string; awayTeamId: string; matchday: number }> = [];
  const n = 36;
  const pivot = n - 1;
  const circleSize = n - 1;

  for (let round = 0; round < 8; round++) {
    const matchday = round + 1;
    const isRoundEven = round % 2 === 0;

    const opponentIndex = round % circleSize;
    if (isRoundEven) {
      matches.push({
        homeTeamId: teamIds[pivot],
        awayTeamId: teamIds[opponentIndex],
        matchday,
      });
    } else {
      matches.push({
        homeTeamId: teamIds[opponentIndex],
        awayTeamId: teamIds[pivot],
        matchday,
      });
    }

    for (let j = 1; j <= 17; j++) {
      const idx1 = (round + j) % circleSize;
      const idx2 = (round - j + circleSize) % circleSize;

      if (isRoundEven) {
        matches.push({
          homeTeamId: teamIds[idx1],
          awayTeamId: teamIds[idx2],
          matchday,
        });
      } else {
        matches.push({
          homeTeamId: teamIds[idx2],
          awayTeamId: teamIds[idx1],
          matchday,
        });
      }
    }
  }

  return matches;
}
