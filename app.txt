// app.js
import { NBA_LOGOS } from './logos.js';

const API = 'https://www.balldontlie.io/api/v1';
const API_KEY = '433ab9b9-a787-4baa-9cb6-9871e4fcdf11';
const HEADERS = { 'Authorization': API_KEY };

// --- Utils ---
function toLocalISODate(d = new Date()) {
  const tzo = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzo).toISOString().slice(0, 10);
}

function computeSeasonFromDate(dateString) {
  const d = new Date(dateString + 'T00:00:00'); // safe parse
  const y = d.getFullYear();
  const m = d.getMonth() + 1; // 1..12
  // Saison NBA commence ~octobre : si oct (10) à déc (12) => saison = année courante, sinon année - 1
  return m >= 10 ? y : y - 1;
}

function enrichGamesWithLogos(games) {
  return games.map((g) => ({
    ...g,
    homeLogo: NBA_LOGOS[g.home_team?.abbreviation] || null,
    visitorLogo: NBA_LOGOS[g.visitor_team?.abbreviation] || null,
  }));
}

// --- API calls ---
async function fetchGamesByDate(dateString) {
  const season = computeSeasonFromDate(dateString);
  const url = `${API}/games?season=${season}&dates[]=${dateString}&per_page=100`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Erreur API BallDontLie: ${res.status}`);
  const json = await res.json();
  return json.data;
}

async function fetchStatsByGameId(gameId) {
  const url = `${API}/stats?game_ids[]=${gameId}&per_page=100`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Erreur chargement stats: ${res.status}`);
  const json = await res.json();
  return json.data; // liste des stats par joueur
}

// --- UI helpers ---
function showLoader() {
  const el = document.getElementById('loader');
  el.classList.remove('hidden');
  el.setAttribute('aria-hidden', 'false');
  document.getElementById('scores').innerHTML = '';
}

function hideLoader() {
  const el = document.getElementById('loader');
  el.classList.add('hidden');
  el.setAttribute('aria-hidden', 'true');
}

function renderEmpty(message) {
  const container = document.getElementById('scores');
  container.innerHTML = `<p class="empty">${message}</p>`;
}

function renderError(err) {
  const container = document.getElementById('scores');
  container.innerHTML = `<p class="error">${err.message}</p>`;
}

function renderScores(games) {
  const container = document.getElementById('scores');
  if (!games.length) return renderEmpty("Aucun match trouvé à cette date.");

  const tpl = document.getElementById('game-template');
  container.innerHTML = '';

  games.forEach((g) => {
    const node = tpl.content.cloneNode(true);

    const away = node.querySelector('.team--away');
    const awayLogo = away.querySelector('.team-logo');
    const awayName = away.querySelector('.team-name');

    const home = node.querySelector('.team--home');
    const homeLogo = home.querySelector('.team-logo');
    const homeName = home.querySelector('.team-name');

    const score = node.querySelector('.score');
    const statsBtn = node.querySelector('.stats-btn');
    const statsPanel = node.querySelector('.stats-panel');

    // Visitor
    awayLogo.src = g.visitorLogo || '';
    awayLogo.alt = `${g.visitor_team.full_name} logo`;
    awayName.textContent = g.visitor_team.full_name;

    // Home
    homeLogo.src = g.homeLogo || '';
    homeLogo.alt = `${g.home_team.full_name} logo`;
    homeName.textContent = g.home_team.full_name;

    score.textContent = `${g.visitor_team_score} - ${g.home_team_score}`;

    // Bouton stats (toggle + lazy fetch)
    statsBtn.addEventListener('click', async () => {
      if (!statsPanel.dataset.loaded) {
        statsBtn.disabled = true;
        statsBtn.textContent = 'Chargement des stats…';
        try {
          const stats = await fetchStatsByGameId(g.id);
          renderStatsPanel(statsPanel, stats, g);
          statsPanel.dataset.loaded = '1';
          statsBtn.textContent = 'Masquer les stats';
        } catch (e) {
          statsPanel.innerHTML = `<p class="error">${e.message}</p>`;
          statsBtn.textContent = 'Réessayer';
        } finally {
          statsBtn.disabled = false;
        }
      } else {
        // toggle
        if (statsPanel.classList.contains('hidden')) {
          statsPanel.classList.remove('hidden');
          statsBtn.textContent = 'Masquer les stats';
        } else {
          statsPanel.classList.add('hidden');
          statsBtn.textContent = 'Voir les stats';
        }
      }
    });

    container.appendChild(node);
  });
}

function aggregateTeamTotals(stats, teamId) {
  return stats
    .filter(s => s.team && s.team.id === teamId)
    .reduce((acc, s) => {
      acc.pts += Number(s.pts || 0);
      acc.reb += Number(s.reb || 0);
      acc.ast += Number(s.ast || 0);
      return acc;
    }, { pts: 0, reb: 0, ast: 0 });
}

function topScorers(stats, teamId, n=3) {
  const arr = stats
    .filter(s => s.team && s.team.id === teamId)
    .map(s => ({ name: `${s.player.first_name} ${s.player.last_name}`, pts: s.pts || 0, reb: s.reb || 0, ast: s.ast || 0 }));
  return arr.sort((a,b) => b.pts - a.pts).slice(0, n);
}

function renderStatsPanel(panel, stats, game) {
  const homeId = game.home_team.id;
  const awayId = game.visitor_team.id;

  const homeTotals = aggregateTeamTotals(stats, homeId);
  const awayTotals = aggregateTeamTotals(stats, awayId);

  const homeTop = topScorers(stats, homeId);
  const awayTop = topScorers(stats, awayId);

  panel.innerHTML = `
    <div class="team-title">${game.visitor_team.full_name} — Totaux: PTS ${awayTotals.pts}, REB ${awayTotals.reb}, AST ${awayTotals.ast}</div>
    <table>
      <thead><tr><th>Joueur</th><th>PTS</th><th>REB</th><th>AST</th></tr></thead>
      <tbody>
        ${awayTop.map(p => `<tr><td>${p.name}</td><td>${p.pts}</td><td>${p.reb}</td><td>${p.ast}</td></tr>`).join('')}
      </tbody>
    </table>
    <div class="team-title" style="margin-top:8px;">${game.home_team.full_name} — Totaux: PTS ${homeTotals.pts}, REB ${homeTotals.reb}, AST ${homeTotals.ast}</div>
    <table>
