import { createAdminClient } from "@/lib/supabase/admin";
import { getSpecialPredictionLeaders } from "@/lib/scoring/ucl-stats";
import crypto from "crypto";

export type SettlementReadiness = "READY" | "IN_PROGRESS" | "NOT_READY";

export interface ProposedAnswer {
  id: string; // team_id or player_id
  name: string;
  subtext?: string;
  logoUrl?: string | null;
  teamName?: string | null;
}

export interface ImpactedUserPrediction {
  userId: string;
  username: string;
  selectedName: string;
  isCorrect: boolean;
  pointsAwarded: number;
}

export interface CategorySettlementPreview {
  categoryId: string;
  categorySlug: string;
  title: string;
  description: string;
  targetType: "team" | "player";
  pointsValue: number;
  status: "open" | "locked" | "settled";
  readiness: SettlementReadiness;
  canSettle: boolean;
  readinessReason: string;
  proposedAnswers: ProposedAnswer[];
  proposedTeamIds: string[];
  proposedPlayerIds: string[];
  correctAnswersCount: number;
  winningUsersCount: number;
  totalPointsToAward: number;
  previewHash: string;
  impactedUsers: ImpactedUserPrediction[];
}

export interface SpecialPredictionsSettlementReport {
  competitionCompleted: boolean;
  finalMatch: {
    id: string;
    homeTeamId: string;
    homeTeamName: string;
    awayTeamId: string;
    awayTeamName: string;
    homeScore: number | null;
    awayScore: number | null;
    status: string;
    winnerTeamId: string | null;
    winnerTeamName: string | null;
  } | null;
  categories: CategorySettlementPreview[];
}

function computePreviewHash(categoryId: string, teamIds: string[], playerIds: string[], status: string): string {
  const content = `${categoryId}|${status}|teams:${teamIds.sort().join(",")}|players:${playerIds.sort().join(",")}`;
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
}

/**
 * Evaluates full settlement preview for all 6 Special Prediction categories.
 * Enforces competition completeness checks and strict tie-handling rules.
 */
export async function evaluateSpecialPredictionsSettlement(
  supabaseClient?: any
): Promise<SpecialPredictionsSettlementReport> {
  const adminSupabase = supabaseClient || createAdminClient();

  // 1. Fetch all required datasets concurrently
  const [
    { data: rawCategories },
    { data: rawTeams },
    { data: rawPlayers },
    { data: rawMatches },
    { data: rawPredictions },
    leaders,
  ] = await Promise.all([
    adminSupabase
      .from("special_prediction_categories")
      .select("*")
      .order("created_at", { ascending: true }),
    adminSupabase.from("teams").select("id, name, code, logo_url"),
    adminSupabase.from("players").select("id, name, team_id, goal_api_player_api_id, jersey_number, photo_url"),
    adminSupabase
      .from("matches")
      .select("id, stage, status, home_team_id, away_team_id, home_score, away_score, winner_team_id, kickoff_at")
      .order("kickoff_at", { ascending: true }),
    adminSupabase
      .from("special_predictions")
      .select("id, user_id, category_id, selected_team_id, selected_player_id, points_awarded, profiles(id, username)"),
    getSpecialPredictionLeaders(adminSupabase),
  ]);

  const categories = rawCategories || [];
  const teams = rawTeams || [];
  const players = rawPlayers || [];
  const matches = rawMatches || [];
  const predictions = rawPredictions || [];

  const teamMap = new Map<string, typeof teams[0]>();
  teams.forEach((t: any) => teamMap.set(t.id, t));

  const playerMap = new Map<string, typeof players[0]>();
  players.forEach((p: any) => playerMap.set(p.id, p));

  // Also map by goal_api_player_api_id for scorer/assist match
  const playerByApiIdMap = new Map<string, typeof players[0]>();
  players.forEach((p: any) => {
    if (p.goal_api_player_api_id) playerByApiIdMap.set(p.goal_api_player_api_id, p);
  });

  // 2. Identify Final Match & Validate Competition Completeness
  const finalMatches = matches.filter((m: any) => m.stage === "final");
  const finalMatch = finalMatches.length === 1 ? finalMatches[0] : null;

  let finalWinnerId: string | null = null;
  const finalHomeTeam = finalMatch ? teamMap.get(finalMatch.home_team_id) : null;
  const finalAwayTeam = finalMatch ? teamMap.get(finalMatch.away_team_id) : null;

  if (finalMatch && finalMatch.status === "finished") {
    const hScore = Number(finalMatch.home_score);
    const aScore = Number(finalMatch.away_score);

    if (hScore > aScore) {
      finalWinnerId = finalMatch.home_team_id;
    } else if (aScore > hScore) {
      finalWinnerId = finalMatch.away_team_id;
    } else if (finalMatch.winner_team_id) {
      // Draw in regular/extra time -> resolved by winner_team_id (penalties)
      finalWinnerId = finalMatch.winner_team_id;
    }

    // Strict validation: Winner MUST be one of the two finalist teams
    if (
      finalWinnerId &&
      finalWinnerId !== finalMatch.home_team_id &&
      finalWinnerId !== finalMatch.away_team_id
    ) {
      finalWinnerId = null;
    }
  }

  const finalWinnerTeam = finalWinnerId ? teamMap.get(finalWinnerId) : null;

  // Comprehensive Competition Completeness Checks
  const TOTAL_EXPECTED_UCL_MATCHES = 189; // 144 league + 16 playoff + 16 round_of_16 + 8 quarters + 4 semis + 1 final
  const leagueMatchesCount = matches.filter((m: any) => m.stage === "league").length;
  const finishedMatchesCount = matches.filter((m: any) => m.status === "finished").length;

  const hasScheduledOrLiveMatches = matches.some(
    (m: any) => m.status === "scheduled" || m.status === "live"
  );
  const hasFinishedWithoutScore = matches.some(
    (m: any) => m.status === "finished" && (m.home_score === null || m.away_score === null)
  );
  const hasPastKickoffUnfinalized = matches.some(
    (m: any) =>
      (m.status === "scheduled" || m.status === "live") &&
      new Date(m.kickoff_at).getTime() < Date.now() - 4 * 3600 * 1000
  );

  // Check event reconciliation on finished matches
  const unreconciledEventsMatches = matches.filter(
    (m: any) => m.status === "finished" && !m.events_reconciled_at
  );

  let completenessFailureReason: string | null = null;
  if (!finalMatch) {
    completenessFailureReason = "Brak jednoznacznego meczu finałowego w terminarzu.";
  } else if (finalMatch.status !== "finished") {
    completenessFailureReason = "Mecz finałowy Ligi Mistrzów nie został jeszcze rozegrany i zakończony.";
  } else if (matches.length < TOTAL_EXPECTED_UCL_MATCHES) {
    completenessFailureReason = `Terminarz nie zawiera pełnego zestawu ${TOTAL_EXPECTED_UCL_MATCHES} spotkań UCL (obecnie w bazie: ${matches.length} meczów, w tym ${leagueMatchesCount} fazy ligowej).`;
  } else if (hasScheduledOrLiveMatches) {
    completenessFailureReason = "W terminarzu istnieją jeszcze niezakończone spotkania UCL.";
  } else if (hasFinishedWithoutScore) {
    completenessFailureReason = "Wykryto zakończone mecze bez wpisanego wyniku końcowego.";
  } else if (hasPastKickoffUnfinalized) {
    completenessFailureReason = "Istnieją mecze z przeszłości wymagające synchronizacji / finalizacji.";
  }

  const competitionCompleted = completenessFailureReason === null;

  // 3. Evaluate Each Category
  const categoryPreviews: CategorySettlementPreview[] = [];

  for (const cat of categories) {
    const slug = cat.slug;
    const targetType = cat.target_type as "team" | "player";
    const pointsValue = cat.points_value || 20;

    let readiness: SettlementReadiness = "NOT_READY";
    let canSettle = false;
    let readinessReason = "";
    const proposedAnswers: ProposedAnswer[] = [];
    const proposedTeamIds: string[] = [];
    const proposedPlayerIds: string[] = [];

    // Category 1: WINNER (Zwycięzca LM)
    if (slug === "winner") {
      if (!finalMatch || finalMatch.status !== "finished") {
        readiness = "NOT_READY";
        canSettle = false;
        readinessReason = "Mecz finałowy Ligi Mistrzów nie został jeszcze rozegrany i zakończony.";
      } else if (!finalWinnerId) {
        readiness = "NOT_READY";
        canSettle = false;
        readinessReason = "Finał zakończył się remisem — oczekiwanie na rozstrzygnięcie po rzutach karnych (winner_team_id).";
      } else {
        readiness = "READY";
        canSettle = true;
        readinessReason = `Finał zakończony. Zwycięzca Ligi Mistrzów: ${finalWinnerTeam?.name || "Nieznany"}.`;
        proposedTeamIds.push(finalWinnerId);
        proposedAnswers.push({
          id: finalWinnerId,
          name: finalWinnerTeam?.name || "Zwycięzca finału",
          subtext: "Zwycięzca finału Ligi Mistrzów",
          logoUrl: finalWinnerTeam?.logo_url,
          teamName: finalWinnerTeam?.name,
        });
      }
    }

    // Category 2: FINALIST (Finalista LM - OBIE drużyny grające w finale)
    else if (slug === "finalist") {
      if (!finalMatch || finalMatch.status !== "finished") {
        readiness = "NOT_READY";
        canSettle = false;
        readinessReason = "Mecz finałowy Ligi Mistrzów nie został jeszcze zakończony.";
      } else {
        readiness = "READY";
        canSettle = true;
        readinessReason = "Finał zakończony. Obaj uczestnicy finału są poprawnymi odpowiedziami.";
        if (finalMatch.home_team_id) {
          proposedTeamIds.push(finalMatch.home_team_id);
          proposedAnswers.push({
            id: finalMatch.home_team_id,
            name: finalHomeTeam?.name || "Finalista (Gospodarz)",
            subtext: "Uczestnik meczu finałowego",
            logoUrl: finalHomeTeam?.logo_url,
            teamName: finalHomeTeam?.name,
          });
        }
        if (finalMatch.away_team_id && finalMatch.away_team_id !== finalMatch.home_team_id) {
          proposedTeamIds.push(finalMatch.away_team_id);
          proposedAnswers.push({
            id: finalMatch.away_team_id,
            name: finalAwayTeam?.name || "Finalista (Gość)",
            subtext: "Uczestnik meczu finałowego",
            logoUrl: finalAwayTeam?.logo_url,
            teamName: finalAwayTeam?.name,
          });
        }
      }
    }

    // Category 3: TOP_SCORER (Król strzelców)
    else if (slug === "top_scorer") {
      const topScorers = leaders.topScorers;
      topScorers.forEach((s) => {
        let pId: string | undefined;
        if (s.scorerExternalId && playerByApiIdMap.has(s.scorerExternalId)) {
          pId = playerByApiIdMap.get(s.scorerExternalId)?.id;
        } else {
          // Name fallback search
          const found = players.find((p: any) => p.name.toLowerCase() === s.playerName.toLowerCase());
          pId = found?.id;
        }

        if (pId) {
          proposedPlayerIds.push(pId);
          const pRecord = playerMap.get(pId);
          const pTeam = pRecord?.team_id ? teamMap.get(pRecord.team_id) : null;
          proposedAnswers.push({
            id: pId,
            name: s.playerName,
            subtext: `${s.goalsCount} goli`,
            logoUrl: pTeam?.logo_url || null,
            teamName: pTeam?.name || s.teamName || null,
          });
        }
      });

      if (!competitionCompleted) {
        readiness = "IN_PROGRESS";
        canSettle = false;
        readinessReason = `Rozgrywki w toku: ${completenessFailureReason || "Statystyki strzelców można rozliczyć dopiero po finale UCL."}`;
      } else if (unreconciledEventsMatches.length > 0) {
        readiness = "NOT_READY";
        canSettle = false;
        readinessReason = `Oczekiwanie na końcową synchronizację zdarzeń meczowych (match_events): ${unreconciledEventsMatches.length} mecz(y).`;
      } else if (proposedAnswers.length === 0) {
        readiness = "NOT_READY";
        canSettle = false;
        readinessReason = "Brak zarejestrowanych bramek w turnieju.";
      } else {
        readiness = "READY";
        canSettle = true;
        readinessReason = `Rozgrywki zakończone. ${proposedAnswers.length} lider(ów) klasyfikacji strzelców.`;
      }
    }

    // Category 4: TOP_ASSISTS (Król asyst)
    else if (slug === "top_assists") {
      const topAssists = leaders.topAssists;
      topAssists.forEach((a) => {
        let pId: string | undefined;
        if (a.scorerExternalId && playerByApiIdMap.has(a.scorerExternalId)) {
          pId = playerByApiIdMap.get(a.scorerExternalId)?.id;
        } else {
          const found = players.find((p: any) => p.name.toLowerCase() === a.playerName.toLowerCase());
          pId = found?.id;
        }

        if (pId) {
          proposedPlayerIds.push(pId);
          const pRecord = playerMap.get(pId);
          const pTeam = pRecord?.team_id ? teamMap.get(pRecord.team_id) : null;
          proposedAnswers.push({
            id: pId,
            name: a.playerName,
            subtext: `${a.assistsCount} asyst`,
            logoUrl: pTeam?.logo_url || null,
            teamName: pTeam?.name || a.teamName || null,
          });
        }
      });

      if (!competitionCompleted) {
        readiness = "IN_PROGRESS";
        canSettle = false;
        readinessReason = `Rozgrywki w toku: ${completenessFailureReason || "Statystyki asyst można rozliczyć dopiero po finale UCL."}`;
      } else if (unreconciledEventsMatches.length > 0) {
        readiness = "NOT_READY";
        canSettle = false;
        readinessReason = `Oczekiwanie na końcową synchronizację zdarzeń meczowych (match_events): ${unreconciledEventsMatches.length} mecz(y).`;
      } else if (proposedAnswers.length === 0) {
        readiness = "NOT_READY";
        canSettle = false;
        readinessReason = "Brak zarejestrowanych asyst w turnieju.";
      } else {
        readiness = "READY";
        canSettle = true;
        readinessReason = `Rozgrywki zakończone. ${proposedAnswers.length} lider(ów) klasyfikacji asyst.`;
      }
    }

    // Category 5: TEAM_MOST_GOALS (Drużyna z największą liczbą goli)
    else if (slug === "team_most_goals") {
      const mostGoals = leaders.teamMostGoals;
      mostGoals.forEach((t) => {
        proposedTeamIds.push(t.teamId);
        const tRecord = teamMap.get(t.teamId);
        proposedAnswers.push({
          id: t.teamId,
          name: t.teamName,
          subtext: `${t.goalsScored} goli`,
          logoUrl: tRecord?.logo_url || null,
          teamName: t.teamName,
        });
      });

      if (!competitionCompleted) {
        readiness = "IN_PROGRESS";
        canSettle = false;
        readinessReason = `Rozgrywki w toku: ${completenessFailureReason || "Bramki drużynowe można rozliczyć dopiero po finale UCL."}`;
      } else if (proposedAnswers.length === 0) {
        readiness = "NOT_READY";
        canSettle = false;
        readinessReason = "Brak bramek drużynowych w turnieju.";
      } else {
        readiness = "READY";
        canSettle = true;
        readinessReason = `Rozgrywki zakończone. ${proposedAnswers.length} drużyna(y) z największą liczbą goli.`;
      }
    }

    // Category 6: TEAM_MOST_CLEAN_SHEETS (Najwięcej czystych kont)
    else if (slug === "team_most_clean_sheets") {
      const cleanSheets = leaders.teamMostCleanSheets;
      cleanSheets.forEach((t) => {
        proposedTeamIds.push(t.teamId);
        const tRecord = teamMap.get(t.teamId);
        proposedAnswers.push({
          id: t.teamId,
          name: t.teamName,
          subtext: `${t.cleanSheetsCount} czystych kont`,
          logoUrl: tRecord?.logo_url || null,
          teamName: t.teamName,
        });
      });

      if (!competitionCompleted) {
        readiness = "IN_PROGRESS";
        canSettle = false;
        readinessReason = `Rozgrywki w toku: ${completenessFailureReason || "Czyste konta można rozliczyć dopiero po finale UCL."}`;
      } else if (proposedAnswers.length === 0) {
        readiness = "NOT_READY";
        canSettle = false;
        readinessReason = "Brak czystych kont w turnieju.";
      } else {
        readiness = "READY";
        canSettle = true;
        readinessReason = `Rozgrywki zakończone. ${proposedAnswers.length} drużyna(y) z największą liczbą czystych kont.`;
      }
    }

    // Calculate Impacted User Predictions
    const catPredictions = predictions.filter((p: any) => p.category_id === cat.id);
    const correctSet = new Set(targetType === "team" ? proposedTeamIds : proposedPlayerIds);

    const impactedUsers: ImpactedUserPrediction[] = catPredictions.map((p: any) => {
      const userChoiceId = targetType === "team" ? p.selected_team_id : p.selected_player_id;
      const isCorrect = Boolean(userChoiceId && correctSet.has(userChoiceId));
      let selectedName = "Brak wyboru";

      if (targetType === "team" && p.selected_team_id) {
        selectedName = teamMap.get(p.selected_team_id)?.name || "Nieznana drużyna";
      } else if (targetType === "player" && p.selected_player_id) {
        selectedName = playerMap.get(p.selected_player_id)?.name || "Nieznany zawodnik";
      }

      return {
        userId: p.user_id,
        username: p.profiles?.username || "Użytkownik",
        selectedName,
        isCorrect,
        pointsAwarded: isCorrect ? pointsValue : 0,
      };
    });

    const winningUsersCount = impactedUsers.filter((u) => u.isCorrect).length;
    const totalPointsToAward = winningUsersCount * pointsValue;
    const previewHash = computePreviewHash(cat.id, proposedTeamIds, proposedPlayerIds, cat.status);

    categoryPreviews.push({
      categoryId: cat.id,
      categorySlug: slug,
      title: cat.title,
      description: cat.description,
      targetType,
      pointsValue,
      status: cat.status as "open" | "locked" | "settled",
      readiness,
      canSettle,
      readinessReason,
      proposedAnswers,
      proposedTeamIds,
      proposedPlayerIds,
      correctAnswersCount: proposedAnswers.length,
      winningUsersCount,
      totalPointsToAward,
      previewHash,
      impactedUsers,
    });
  }

  return {
    competitionCompleted,
    finalMatch: finalMatch
      ? {
          id: finalMatch.id,
          homeTeamId: finalMatch.home_team_id,
          homeTeamName: finalHomeTeam?.name || "Gospodarz finału",
          awayTeamId: finalMatch.away_team_id,
          awayTeamName: finalAwayTeam?.name || "Gość finału",
          homeScore: finalMatch.home_score,
          awayScore: finalMatch.away_score,
          status: finalMatch.status,
          winnerTeamId: finalWinnerId,
          winnerTeamName: finalWinnerTeam?.name || null,
        }
      : null,
    categories: categoryPreviews,
  };
}
