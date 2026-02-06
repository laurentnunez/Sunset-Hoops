
// app.js
import { NBA_LOGOS } from "./logos.js";

/* ============================================
   CONFIG API (BallDontLie nouvelle arborescence)
   ============================================ */
const API_BASE = "https://api.balldontlie.io";
const NBA = "/nba/v1";

const API_KEY = "433ab9b9-a787-4baa-9cb6-9871e4fcdf11";
const HEADERS = { Authorization: API_KEY }; // pas de Bearer selon la doc

/* =============== UTILS ================== */
function toLocalISODate(d = new Date()) {
  const tzo = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzo).toISOString().slice(0, 10);
}

function computeSeasonFromDate(dateString) {
  const d = new Date(dateString + "T00:00:00");
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return m >= 10 ? y : y - 1;
}

function setView(viewId) {
  const views = ["scores", "standings", "teams", "players", "team-detail", "player-detail"];
  views.forEach(v => document.getElementById(v).classList.add("hidden"));
  document.getElementById(viewId).classList.remove("hidden");
  document.getElementById("score-controls").classList.toggle("hidden", viewId !== "scores");
}

const logo = abbr => NBA_LOGOS[abbr] || "";

/* =============== API CALLS ================== */
async function fetchGamesByDate(dateString) {
  const season = computeSeasonFromDate(dateString);
  const url = `${API_BASE}${NBA}/games?dates[]=${dateString}&seasons[]=${season}&per_page=100`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Erreur API games: ${res.status}`);
  return (await res.json()).data;
}

async function fetchTeams() {
  const url = `${API_BASE}${NBA}/teams?per_page=100`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Erreur API teams: ${res.status}`);
  return (await res.json()).data;
}

async function fetchPlayers({ perPage = 100, teamId } = {}) {
  const params = new URLSearchParams();
  params.set("per_page", perPage);
  if (teamId) params.append("team_ids[]", teamId);
  const url = `${API_BASE}${NBA}/players?${params}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Erreur API players: ${res.status}`);
  return await res.json(); // { data, meta }
}

async function fetchStandings() {
  const url = `${API_BASE}${NBA}/standings`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Standings indisponibles (status ${res.status})`);
  return await res.json();
}

async function fetchTeamById(id) {
  const url = `${API_BASE}${NBA}/teams/${id}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Erreur API team: ${res.status}`);
  return await res.json();
}

async function fetchPlayerById(id) {
  const url = `${API_BASE}${NBA}/players/${id}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Erreur API player: ${res.status}`);
  return await res.json();
}

/* =============== LOADER + ERRORS ================== */
function showLoader() {
  const el = document.getElementById("loader");
  el.classList.remove("hidden");
  el.setAttribute("aria-hidden", "false");
}

function hideLoader() {
  const el = document.getElementById("loader");
  el.classList.add("hidden");
  el.setAttribute("aria-hidden", "true");
}

function renderErrorIn(id, err) {
  document.getElementById(id).innerHTML = `<p class="error">${err.message}</p>`;
}

/* ====================================
   SCORES
   ==================================== */
function enrichGamesWithLogos(g) {
  return g.map(m => ({
    ...m,
    homeLogo: logo(m.home_team?.abbreviation),
    visitorLogo: logo(m.visitor_team?.abbreviation)
  }));
}

function renderScores(games) {
  const c = document.getElementById("scores");
  if (!games.length) {
    c.innerHTML = `<p class="empty">Aucun match trouvé.</p>`;
    return;
  }
  const tpl = document.getElementById("game-template");
  c.innerHTML = "";

  games.forEach(g => {
    const node = tpl.content.cloneNode(true);

    // AWAY
    const away = node.querySelector(".team--away");
    const awayLogo = away.querySelector(".team-logo");
    const awayName = away.querySelector(".team-name");

    awayLogo.src = g.visitorLogo;
    awayName.textContent = g.visitor_team.full_name;
    awayLogo.addEventListener("click", () => showTeamDetail(g.visitor_team));
    awayName.addEventListener("click", () => showTeamDetail(g.visitor_team));

    // HOME
    const home = node.querySelector(".team--home");
    const homeLogo = home.querySelector(".team-logo");
    const homeName = home.querySelector(".team-name");

    homeLogo.src = g.homeLogo;
    homeName.textContent = g.home_team.full_name;
    homeLogo.addEventListener("click", () => showTeamDetail(g.home_team));
    homeName.addEventListener("click", () => showTeamDetail(g.home_team));

    // SCORE
    node.querySelector(".score").textContent = `${g.visitor_team_score} - ${g.home_team_score}`;

    c.appendChild(node);
  });
}

async function loadGames(dateString) {
  setView("scores");
  showLoader();
  try {
    const games = await fetchGamesByDate(dateString);
    renderScores(enrichGamesWithLogos(games));
  } catch (e) {
    renderErrorIn("scores", e);
  } finally {
    hideLoader();
  }
}

/* ====================================
   STANDINGS
   ==================================== */
function renderStandings(data) {
  const c = document.getElementById("standings");

  if (!data?.data) {
    c.innerHTML = `<p class="empty">Classements indisponibles.</p>`;
    return;
  }

  const east = [];
  const west = [];

  data.data.forEach(t => {
    const team = t.team || t;
    const conf = (t.conference || team.conference || "").toLowerCase();

    const o = {
      name: team.full_name,
      abbr: team.abbreviation,
      wins: t.wins ?? "?",
      losses: t.losses ?? "?"
    };

    if (conf.startsWith("e")) east.push(o);
    else west.push(o);
  });

  function table(title, arr) {
    return `
      <div>
        <h3>${title}</h3>
        <table class="table">
          <thead><tr><th>#</th><th>Équipe</th><th>Bilan</th></tr></thead>
          <tbody>
            ${arr.map((t, i) => `
              <tr>
                <td>${i + 1}</td>
                <td><button class="linklike" data-team="${t.abbr}">${t.name}</button></td>
                <td>${t.wins}-${t.losses}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  c.innerHTML = `
    <div class="standings-grid">
      ${table("Conférence Est", east)}
      ${table("Conférence Ouest", west)}
    </div>
  `;

  c.querySelectorAll("button[data-team]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const abbr = btn.dataset.team;
      const teams = await fetchTeams();
      const t = teams.find(x => x.abbreviation === abbr);
      if (t) showTeamDetail(t);
    });
  });
}

async function loadStandings() {
  setView("standings");
  showLoader();
  try {
    renderStandings(await fetchStandings());
  } catch (e) {
    renderErrorIn("standings", e);
  } finally {
    hideLoader();
  }
}

/* ====================================
   TEAMS
   ==================================== */
function renderTeamsGrid(teams) {
  const c = document.getElementById("teams");
  const tpl = document.getElementById("team-card-template");
  c.innerHTML = "";

  teams.forEach(t => {
    const node = tpl.content.cloneNode(true);
    node.querySelector(".team-card-logo").src = logo(t.abbreviation);
    node.querySelector(".team-card-name").textContent = t.full_name;
    node.querySelector(".team-card-meta").textContent = `${t.conference} / ${t.division}`;

    const card = node.querySelector(".team-card");
    card.addEventListener("click", () => showTeamDetail(t));

    c.appendChild(node);
  });
}


async function loadTeams() {
  setView("teams");
  showLoader();
  try {
    const teams = await fetchTeams();

       const nbaTeams = teams.filter(t => {
      const c = (t.conference || '').toLowerCase();
      return c === 'east' || c === 'west';
    });

    renderTeamsGrid(nbaTeams);
  } catch (e) {
    renderErrorIn("teams", e);
  } finally {
    hideLoader();
  }
}



/* ====================================
   TEAM DETAIL + ROSTER
   ==================================== */
async function showTeamDetail(team) {
  setView("team-detail");
  showLoader();

  try {
    const t = team.id ? team : (await fetchTeamById(team)).data;
    const container = document.getElementById("team-detail");

    const playersResp = await fetchPlayers({ teamId: t.id });
    const players = playersResp.data;

    container.innerHTML = `
      <div class="team-hero">
        <img src="${logo(t.abbreviation)}" alt="${t.full_name}" />
        <div>
          <div class="title">${t.full_name}</div>
          <div class="sub">${t.city} / ${t.conference} / ${t.division}</div>
        </div>
      </div>

      <div class="section-title">Effectif</div>
      <div class="roster"></div>
    `;

    document.getElementById("back-teams")
      .addEventListener("click", () => setView("teams"));

    const r = container.querySelector(".roster");
    r.innerHTML = "";

    players.forEach(p => {
      const row = document.createElement("div");
      row.className = "player-row";
      row.innerHTML = `
        <span class="player-name">${p.first_name} ${p.last_name}</span>
        <span class="player-meta">${p.position || "?"}</span>
      `;
      row.addEventListener("click", () => showPlayerDetail(p.id));
      r.appendChild(row);
    });

  } catch (e) {
    renderErrorIn("team-detail", e);
  } finally {
    hideLoader();
  }
}

/* ====================================
   PLAYERS LIST + PLAYER DETAIL
   ==================================== */
async function loadPlayers() {
  setView("players");
  showLoader();

  try {
    const resp = await fetchPlayers({ perPage: 100 });
    const players = resp.data;
    const container = document.getElementById("players");

    container.innerHTML = "";
    const tpl = document.getElementById("player-row-template");

    players.forEach(p => {
      const node = tpl.content.cloneNode(true);
      node.querySelector(".player-name").textContent = `${p.first_name} ${p.last_name}`;
      node.querySelector(".player-meta").textContent = `${p.team?.full_name || "—"} • ${p.position || "?"}`;

      node.querySelector(".player-row")
        .addEventListener("click", () => showPlayerDetail(p.id));

      container.appendChild(node);
    });

  } catch (e) {
    renderErrorIn("players", e);
  } finally {
    hideLoader();
  }
}

async function showPlayerDetail(id) {
  setView("player-detail");
  showLoader();

  try {
    const resp = await fetchPlayerById(id);
    const p = resp.data;

    const c = document.getElementById("player-detail");
    const team = p.team;

    c.innerHTML = `
      <h2>${p.first_name} ${p.last_name}</h2>

      <div class="detail-grid">
        <div><strong>Équipe :</strong>
          <button class="linklike" id="player-team-btn">
            ${team?.full_name || "—"}
          </button>
        </div>

        <div><strong>Poste :</strong> ${p.position || "?"}</div>
        <div><strong>Taille :</strong> ${p.height_feet ? `${p.height_feet}'${p.height_inches}"` : "?"}</div>
        <div><strong>Poids :</strong> ${p.weight_pounds ? `${p.weight_pounds} lbs` : "?"}</div>
      </div>

      <button id="back-players" class="nav-btn" style="margin-top:10px;">
        Retour
      </button>
    `;

    document.getElementById("back-players")
      .addEventListener("click", () => setView("players"));

    document.getElementById("player-team-btn")
      .addEventListener("click", async () => {
        const teams = await fetchTeams();
        const t = teams.find(x => x.id === team?.id);
        if (t) showTeamDetail(t);
      });

  } catch (e) {
    renderErrorIn("player-detail", e);
  } finally {
    hideLoader();
  }
}

/* ====================================
   INIT
   ==================================== */
function init() {
  
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {

    // --- effet bouton actif ---
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    // --- ta logique existante ---
    const view = btn.dataset.view;
    if (view === "scores")
      loadGames(document.getElementById("game-date").value);
    else if (view === "standings")
      loadStandings();
    else if (view === "teams")
      loadTeams();
    else if (view === "players")
      loadPlayers();
  });
});


  const dateInput = document.getElementById("game-date");
  const todayBtn = document.getElementById("today-btn");

  const today = toLocalISODate();
  dateInput.value = today;

  todayBtn.addEventListener("click", () => {
    const t = toLocalISODate();
    dateInput.value = t;
    loadGames(t);
  });

  dateInput.addEventListener("change", e => loadGames(e.target.value));
  document.querySelector('.nav-btn[data-view="scores"]').classList.add("active");

  loadGames(today);
}

init();

// Global error catcher
window.onerror = function (m, s, l, c, e) {
  console.error("[GLOBAL ERROR]", m, s, l, c, e);
};
