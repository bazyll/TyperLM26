import { describe, it, expect } from "vitest";
import { escapeCsvField, generateRankingCsv, generateRankingTxt } from "./utils";

describe("Export & CSV Formula Injection Protection", () => {
  it("escapes standard strings properly", () => {
    expect(escapeCsvField("Jan")).toBe("Jan");
    expect(escapeCsvField(100)).toBe("100");
  });

  it("escapes fields with commas and double quotes", () => {
    expect(escapeCsvField('Kowalski, "Jan"')).toBe('"Kowalski, ""Jan"""');
  });

  it("neutralizes potential formula injection symbols (=, +, -, @)", () => {
    expect(escapeCsvField("=SUM(A1:A10)")).toBe("'=SUM(A1:A10)");
    expect(escapeCsvField("+CMD")).toBe("'+CMD");
    expect(escapeCsvField("-2+3")).toBe("'-2+3");
    expect(escapeCsvField("@username")).toBe("'@username");
  });

  it("generates structured ranking CSV and TXT", () => {
    const data = [
      {
        position: 1,
        username: "bartek",
        firstName: "Bartek",
        lastName: "Kowalski",
        matchPoints: 52,
        specialPoints: 40,
        pickemPoints: 63,
        totalPoints: 155,
        generatedAt: "2026-09-23T22:15:00Z",
      },
    ];

    const csv = generateRankingCsv(data);
    expect(csv).toContain("position,username,first_name,last_name,match_points,special_points,pickem_points,total_points,generated_at");
    expect(csv).toContain("1,bartek,Bartek,Kowalski,52,40,63,155,2026-09-23T22:15:00Z");

    const txt = generateRankingTxt(data, "23.09.2026 22:15");
    expect(txt).toContain("1. Bartek Kowalski (@bartek)");
    expect(txt).toContain("Mecze: 52 pkt");
    expect(txt).toContain("Typy specjalne: 40 pkt");
    expect(txt).toContain("Pick'em: 63 pkt");
    expect(txt).toContain("RAZEM: 155 pkt");
  });
});
