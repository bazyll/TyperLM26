/**
 * Escapes a field for CSV export and prevents CSV formula injection.
 * Formula triggers: '=', '+', '-', '@', '\t', '\r'
 */
export function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return "";
  let str = String(val);

  // CSV Formula Injection prevention: prepend a single quote if string starts with formula chars
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // If contains comma, quote, or newline, wrap in double quotes and escape internal quotes
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    str = `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

export interface RankingExportRow {
  position: number;
  username: string;
  firstName: string;
  lastName: string;
  matchPoints: number;
  specialPoints: number;
  pickemPoints: number;
  totalPoints: number;
  generatedAt: string;
}

/**
 * Generates CSV string for ranking
 */
export function generateRankingCsv(rows: RankingExportRow[]): string {
  const headers = [
    "position",
    "username",
    "first_name",
    "last_name",
    "match_points",
    "special_points",
    "pickem_points",
    "total_points",
    "generated_at",
  ];

  const lines = [headers.join(",")];

  for (const r of rows) {
    const line = [
      escapeCsvField(r.position),
      escapeCsvField(r.username),
      escapeCsvField(r.firstName),
      escapeCsvField(r.lastName),
      escapeCsvField(r.matchPoints),
      escapeCsvField(r.specialPoints),
      escapeCsvField(r.pickemPoints),
      escapeCsvField(r.totalPoints),
      escapeCsvField(r.generatedAt),
    ].join(",");
    lines.push(line);
  }

  return lines.join("\r\n");
}

/**
 * Generates human-readable TXT snapshot for ranking
 */
export function generateRankingTxt(rows: RankingExportRow[], generatedAtFormatted: string, season = "2026/2027"): string {
  const lines: string[] = [
    "=================================================================",
    "                            TyperLM26                            ",
    "                        Snapshot rankingu                        ",
    "=================================================================",
    `Wygenerowano: ${generatedAtFormatted}`,
    `Sezon: ${season}`,
    "",
  ];

  rows.forEach((r) => {
    lines.push(`${r.position}. ${r.firstName} ${r.lastName} (@${r.username})`);
    lines.push(`   Mecze: ${r.matchPoints} pkt`);
    lines.push(`   Typy specjalne: ${r.specialPoints} pkt`);
    lines.push(`   Pick'em: ${r.pickemPoints} pkt`);
    lines.push(`   RAZEM: ${r.totalPoints} pkt`);
    lines.push("");
  });

  lines.push("=================================================================");
  lines.push(`Łącznie graczy w rankingu: ${rows.length}`);
  lines.push("=================================================================");

  return lines.join("\r\n");
}
