
// app.js
import { NBA_LOGOS } from "./logos.js";

// ======== API ========
const API = "https://www.balldontlie.io/api/v1";

// Cache
let teamsData = [];
let playersData = [];
let scoresData = [];

// DOM
const sectionScores = document.getElementById("section-scores");
const sectionTeams = document.getElementById("section-teams");
const sectionPlayers = document.getElementById("section-players");

const inputPlayerSearch = document.getElementById("playerSearch");
const inputTeamSearch = document.getElementById("teamSearch");
const inputGameDate = document.getElementById("gameDate");
const btnFilterDate = document.getElementById("filterDateBtn");

// ======== FETCH ========

// Scores (games)
async function fetchScores(date = null) {
  let url = `${API}/games?per_page=40`;
  if (date) {
    url += `&start_date=${date}&end_date=${date}`;
  }
  const res = await fetch(url);
  const json = await res.json();
  return json.data;
}

// Teams
async function fetchTeams() {
  const res = await fetch(`${API}/teams`);
  const json = await res.json();
  return json.data;
}

// Players (search enabled)
async function fetchPlayers(search = "") {
  const res = await fetch(`${API}/players?search=${search}&per_page=50`);
  const json = await res.json();
  return json.data;
}

// ======== RENDERERS ========

// Utility: get logo from logos.js
function getLogo(teamId) {
  return logos[teamId] || "";
}

// ---- Scores ----
function renderScores(games) {
  sectionScores.innerHTML = "<h2>Scores</h2>";

  games.forEach(g => {
    const div = document.createElement("div");
    div.className = "sh-card";

    const homeLogo = NBA_LOGOS[g.home_team.abbreviation];
    const awayLogo = NBA_LOGOS[g.visitor_team.abbreviation];

    div.innerHTML = `
      <div class="sh-game">
        <img src="${homeLogo}" width="40"/>
        <strong>${g.home_team.full_name} ${g.home_team_score}</strong>

        <span> - </span>

        <strong>${g.visitor_team_score} ${g.visitor_team.full_name}</strong>
        <img src="${awayLogo}" width="40"/>
      </div>
    `;

    sectionScores.appendChild(div);
  });
}

// ---- Teams ----
function renderTeams(teams) {
  sectionTeams.innerHTML = "<h2>Équipes</h2>";

  teams.forEach(t => {
    const div = document.createElement("div");
    div.className = "sh-card";

    const logo = NBA_LOGOS[t.abbreviation];

    div.innerHTML = `
      <img src="${logo}" width="40"/>
      <strong>${t.full_name}</strong><br>
      <span>${t.conference} - ${t.division}</span>
    `;

    sectionTeams.appendChild(div);
  });
}

// ---- Players ----
function renderPlayers(players) {
  sectionPlayers.innerHTML = "<h2>Joueurs</h2>";

  players.forEach(p => {
    const div = document.createElement("div");
    div.className = "sh-card";

    const logo = NBA_LOGOS[p.team.abbreviation];

    div.innerHTML = `
      <strong>${p.first_name} ${p.last_name}</strong><br>
      <span>${p.team.full_name}</span><br>
      <img src="${logo}" width="40"/>
    `;

    sectionPlayers.appendChild(div);
  });
}


// ======== EVENTS ========

// Search players (live)
inputPlayerSearch.addEventListener("input", async () => {
  const q = inputPlayerSearch.value.trim();
  const players = await fetchPlayers(q);
  renderPlayers(players);
});

// Search teams (local filter)
inputTeamSearch.addEventListener("input", () => {
  const q = inputTeamSearch.value.toLowerCase();
  const filtered = teamsData.filter(t =>
    t.full_name.toLowerCase().includes(q)
  );
  renderTeams(filtered);
});

// Filter games by date
btnFilterDate.addEventListener("click", async () => {
  const date = inputGameDate.value;
  const games = await fetchScores(date);
  renderScores(games);
});

// ======== INIT ========
window.addEventListener("DOMContentLoaded", async () => {
  teamsData = await fetchTeams();
  playersData = await fetchPlayers("");
  scoresData = await fetchScores();

  renderScores(scoresData);
  renderTeams(teamsData);
  renderPlayers(playersData);
});