import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TeamLogo, getTeamFallbackText } from "./team-logo";

describe("TeamLogo and getTeamFallbackText", () => {
  describe("getTeamFallbackText", () => {
    it("returns teamCode uppercase when provided", () => {
      expect(getTeamFallbackText("Real Madrid CF", "RMA")).toBe("RMA");
      expect(getTeamFallbackText("Arsenal FC", "ars")).toBe("ARS");
      expect(getTeamFallbackText("Demo Team", "D01")).toBe("D01");
    });

    it("returns 2 initials for multi-word team names when code is missing", () => {
      expect(getTeamFallbackText("Real Madrid", null)).toBe("RM");
      expect(getTeamFallbackText("Bayern München", undefined)).toBe("BM");
      expect(getTeamFallbackText("Man City", "")).toBe("MC");
    });

    it("returns first 3 letters for single-word team names when code is missing", () => {
      expect(getTeamFallbackText("Arsenal", null)).toBe("ARS");
      expect(getTeamFallbackText("Liverpool", undefined)).toBe("LIV");
      expect(getTeamFallbackText("Inter", "")).toBe("INT");
    });

    it("returns FC fallback when both name and code are missing/empty", () => {
      expect(getTeamFallbackText("", "")).toBe("FC");
      expect(getTeamFallbackText("   ", null)).toBe("FC");
      expect(getTeamFallbackText(undefined, undefined)).toBe("FC");
    });
  });

  describe("TeamLogo Rendering (SSR / Static Markup)", () => {
    it("renders fallback badge when logoUrl is null", () => {
      const html = renderToStaticMarkup(
        <TeamLogo logoUrl={null} teamName="Real Madrid" teamCode="RMA" size={32} />
      );
      expect(html).toContain('data-testid="team-logo-fallback"');
      expect(html).toContain("RMA");
      expect(html).not.toContain("<img");
    });

    it("renders fallback badge when logoUrl is undefined", () => {
      const html = renderToStaticMarkup(
        <TeamLogo logoUrl={undefined} teamName="Arsenal FC" teamCode="ARS" size={24} />
      );
      expect(html).toContain('data-testid="team-logo-fallback"');
      expect(html).toContain("ARS");
      expect(html).not.toContain("<img");
    });

    it("renders fallback badge when logoUrl is an empty string", () => {
      const html = renderToStaticMarkup(
        <TeamLogo logoUrl="" teamName="Bayern München" teamCode="BAY" size={48} />
      );
      expect(html).toContain('data-testid="team-logo-fallback"');
      expect(html).toContain("BAY");
      expect(html).not.toContain("<img");
    });

    it("renders fallback badge when logoUrl is only whitespace", () => {
      const html = renderToStaticMarkup(
        <TeamLogo logoUrl="   " teamName="Liverpool FC" teamCode="LIV" size={32} />
      );
      expect(html).toContain('data-testid="team-logo-fallback"');
      expect(html).toContain("LIV");
      expect(html).not.toContain("<img");
    });

    it("renders Image / img tag when logoUrl is a valid non-empty string", () => {
      const html = renderToStaticMarkup(
        <TeamLogo
          logoUrl="https://example.com/crest.png"
          teamName="Manchester City"
          teamCode="MCI"
          size={32}
        />
      );
      expect(html).toContain("<img");
      expect(html).toContain('src="https://example.com/crest.png"');
      expect(html).not.toContain('data-testid="team-logo-fallback"');
    });
  });
});
