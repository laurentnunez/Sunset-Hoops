// app.js
import { NBA_LOGOS } from "./logos.js";

function enrichGamesWithLogos(games) {
  return games.map((g) => {
    const homeAbbr = g.home_team?.abbreviation;
    const visitorAbbr = g.visitor_team?.abbreviation;

    return {
      ...g,
      homeLogo: NBA_LOGOS[homeAbbr] || null,
      visitorLogo: NBA_LOGOS[visitorAbbr] || null,
    };
  });
}



async function init() {
  const games = await fetchTodayGames();
  const enrichedGames = enrichGamesWithLogos(games);
  renderScores(enrichedGames);
}

init();
