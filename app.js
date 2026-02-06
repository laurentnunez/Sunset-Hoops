// app.js
import { NBA_LOGOS } from './logos.js';

// ==== CONFIG API (nouvelle arborescence) ====
const API_BASE = 'https://api.balldontlie.io';
const NBA = '/nba/v1';
const API_KEY = '433ab9b9-a787-4baa-9cb6-9871e4fcdf11';
const HEADERS = { 'Authorization': API_KEY }; // pas de "Bearer"

// --- Utils ---
function toLocalISODate(d = new Date()) {
  const tzo = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzo).toISOString().slice(0, 10);
}
function computeSeasonFromDate(dateString) {
  const d = new Date(dateString + 'T00:00:00');
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return m >= 10 ? y : y - 1; // saison = année de début (ex. 2025 pour 2025-26)
}
function setView(viewId) {
  // Vues principales
  ['scores','standings','teams','players'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
  // Détails
  ['team-detail','player-detail'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
  document.getElementById(viewId).classList.remove('hidden');
  // Contrôles date visibles seulement pour scores
  document.getElementById('score-controls').classList.toggle('hidden', viewId !== 'scores');
}
function getLogo(abbr) {
  return NBA_LOGOS[abbr] || '';
}

// --- API calls ---
async function fetchGamesByDate(dateString) {
  const season = computeSeasonFromDate(dateString);
  const url = `${API_BASE}${NBA}/games?dates[]=${dateString}&seasons[]=${season}&per_page=100`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Erreur API (games): ${res.status}`);
  const json = await res.json();
  return json.data;
}
async function fetchTeams() {
  const url = `${API_BASE}${NBA}/teams?per_page=100`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Erreur API (teams): ${res.status}`);
  const json = await res.json();
  return json.data;
}
async function fetchPlayers({ cursor, perPage = 100, teamId } = {}) {
  const params = new URLSearchParams();
  params.set('per_page', perPage);
  if (cursor) params.set('cursor', cursor);
  if (teamId) params.append('team_ids[]', teamId);
  const url = `${API_BASE}${NBA}/players?${params.toString()}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Erreur API (players): ${res.status}`);
  return res.json(); // { data, meta: { next_cursor } }
}
async function fetchStandings() {
  const url = `${API_BASE}${NBA}/standings?per_page=100`;
  const res = await fetch(url, { headers: HEADERS });
  // Selon le plan, standings peut ne pas être dispo → on gère proprement
  if (!res.ok) throw new Error(`Standings indisponibles (status ${res.status})`);
  return res.json(); // { data: [...] }
}
async function fetchTeamById(id) {
  const url = `${API_BASE}${NBA}/teams/${id}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Erreur API (team): ${res.status}`);
  return res.json(); // { data: {...} }
}
async function fetchPlayerById(id) {
  const url = `${API_BASE}${NBA}/players/${id}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Erreur API (player): ${res.status}`);
  return res.json(); // { data: {...} }
}

// --- Loader & Errors ---
function showLoader() {
  const el = document.getElementById('loader');
  el.classList.remove('hidden');
  el.setAttribute('aria-hidden', 'false');
}
function hideLoader() {
  const el = document.getElementById('loader');
  el.classList.add('hidden');
  el.setAttribute('aria-hidden', 'true');
}
function renderErrorIn(containerId, err) {
  const c = document.getElementById(containerId);
  c.innerHTML = `<p class="error">${err.message}</p>`;
}

// --- SCORES ---
function enrichGamesWithLogos(games) {
  return games.map((g) => ({
    ...g,
    homeLogo: getLogo(g.home_team?.abbreviation),
    visitorLogo: getLogo(g.visitor_team?.abbreviation),
  }));
}
function renderScores(games) {
  const container = document.getElementById('scores');
  if (!games.length) {
    container.innerHTML = `<p class="empty">Aucun match trouvé à cette date.</p>`;
    return;
  }
  const tpl = document.getElementById('game-template');
  container.innerHTML = '';
  games.forEach((g) => {
    const node = tpl.content.cloneNode(true);
    const away = node.querySelector('.team--away');
    const home = node.querySelector('.team--home');
    const score = node.querySelector('.score');

    const awayLogo = away.querySelector('.team-logo');
    const awayName = away.querySelector('.team-name');
    awayLogo.src = g.visitorLogo || '';
    awayLogo.alt = `${g.visitor_team.full_name} logo`;
    awayName.textContent = g.visitor_team.full_name;

    const homeLogo = home.querySelector('.team-logo');
    const homeName = home.querySelector('.team-name');
    homeLogo.src = g.homeLogo || '';
    homeLogo.alt = `${g.home_team.full_name} logo`;
    homeName.textContent = g.home_team.full_name;

    score.textContent = `${g.visitor_team_score} - ${g.home_team_score}`;

    // Accès rapide à la fiche équipe en cliquant sur le nom/logo
    [awayLogo, awayName].forEach(el => el.addEventListener('click', () => showTeamDetail(g.visitor_team)));
    [homeLogo, homeName].forEach(el => el.addEventListener('click', () => showTeamDetail(g.home_team)));

    container.appendChild(node);
  });
}
async function loadGames(dateString) {
  setView('scores');
  showLoader();
  try {
    const games = await fetchGamesByDate(dateString);
    const enriched = enrichGamesWithLogos(games);
    renderScores(enriched);
  } catch (e) {
    renderErrorIn('scores', e);
  } finally {
    hideLoader();
  }
}

// --- STANDINGS ---
function renderStandings(data) {
  const container = document.getElementById('standings');
  if (!data?.data?.length) {
    container.innerHTML = `<p class="empty">Classements indisponibles.</p>`;
    return;
  }

  // Essai de groupement par conférence (selon structure des données)
  const east = [];
  const west = [];
  for (const row of data.data) {
    const team = row.team || row; // fallback
    const conference = row.conference || team.conference || '';
    const wins = row.wins ?? row.win ?? row.record?.wins ?? '?';
    const losses = row.losses ?? row.loss ?? row.record?.losses ?? '?';
    const name = team.full_name || team.name || 'Équipe';
    const abbr = team.abbreviation || '';
    const obj = { name, abbr, wins, losses };
    if (String(conference).toLowerCase().startsWith('e')) east.push(obj);
    else if (String(conference).toLowerCase().startsWith('w')) west.push(obj);
    else east.push(obj); // fallback
  }

  const renderTable = (title, arr) => `
    <div>
      <h3>${title}</h3>
      <table class="table">
        <thead><tr><th>#</th><th>Équipe</th><th>Bilan</th></tr></thead>
        <tbody>
          ${arr.map((t, i) => `
            <tr>
              <td>${i+1}</td>
              <td><button class="linklike" data-team-abbr="${t.abbr}">${t.name}</button></td>
              <td>${t.wins}-${t.losses}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`.trim();

  container.innerHTML = `
    <div class="standings-grid">
      ${renderTable('Conférence Est', east)}
      ${renderTable('Conférence Ouest', west)}
    </div>
  `;

  // clic sur équipe -> fiche équipe
  container.querySelectorAll('button.linklike').forEach(btn => {
    btn.addEventListener('click', async () => {
      const abbr = btn.dataset.teamAbbr;
      // retrouver l'équipe via /teams
      const teams = await fetchTeams();
      const team = teams.find(t => t.abbreviation === abbr) || teams.find(t => (t.abbreviation||'').toLowerCase()===abbr.toLowerCase());
      if (team) showTeamDetail(team);
    });
  });
}
async function loadStandings() {
  setView('standings');
  showLoader();
  try {
    const data = await fetchStandings();
    renderStandings(data);
  } catch (e) {
    renderErrorIn('standings', e);
  } finally {
    hideLoader();
  }
}

// --- TEAMS ---
function renderTeamsGrid(teams) {
  const container = document.getElementById('teams');
  container.innerHTML = '';
  const tpl = document.getElementById('team-card-template');

  teams.forEach(t => {
    const node = tpl.content.cloneNode(true);
    const logo = node.querySelector('.team-card-logo');
    const name = node.querySelector('.team-card-name');
    const meta = node.querySelector('.team-card-meta');
    const card = node.querySelector('.team-card');

    logo.src = getLogo(t.abbreviation);
    logo.alt = `${t.full_name} logo`;
    name.textContent = t.full_name;
    meta.textContent = `${t.city} • ${t.conference} / ${t.division}`;

    card.addEventListener('click', () => showTeamDetail(t));
    card.addEventListener('keypress', (e) => e.key === 'Enter' && showTeamDetail(t));

    container.appendChild(node);
  });
}
async function loadTeams() {
  setView('teams');
  showLoader();
  try {
    const teams = await fetchTeams();
    renderTeamsGrid(teams);
  } catch (e) {
    renderErrorIn('teams', e);
  } finally {
    hideLoader();
  }
}

// --- TEAM DETAIL + ROSTER ---
async function showTeamDetail(team) {
  setView('team-detail');
  showLoader();
  try {
    // rafraîchir team si on a juste un id
    const t = team.id ? team : (await fetchTeamById(team)).data;
    const container = document.getElementById('team-detail');

    // Roster : joueurs par équipe (per_page=100 suffit)
    const playersResp = await fetchPlayers({ teamId: t.id, perPage: 100 });
    const players = playersResp.data || [];

    container.innerHTML = `
      <div class="team-hero">
        <img src="${getLogo(t.abbreviation)}" alt="${t.full_name} logo" />
        <div>
          <div class="title">${t.full_name}</div>
          <div class="sub">${t.city} • ${t.conference} / ${t.division}</div>
        </div>
        <div><button id="back-to-teams" class="nav-btn">← Retour aux équipes</button></div>
      </div>

      <div class="section-title">Effectif</div>
      <div class="roster" id="team-roster"></div>
    `;

    document.getElementById('back-to-teams').addEventListener('click', () => setView('teams'));

    const rosterEl = document.getElementById('team-roster');
    rosterEl.innerHTML = '';

    players.forEach(p => {
      const row = document.createElement('div');
      row.className = 'player-row';
      row.innerHTML = `
        <span class="player-name">${p.first_name} ${p.last_name}</span>
        <span class="player-meta">${p.position || '?'}${p.height ? ' • ' + p.height + 'cm' : ''}</span>
      `;
      row.addEventListener('click', () => showPlayerDetail(p.id));
      row.addEventListener('keypress', (e) => e.key === 'Enter' && showPlayerDetail(p.id));
      rosterEl.appendChild(row);
    });

  } catch (e) {
    renderErrorIn('team-detail', e);
  } finally {
    hideLoader();
  }
}

// --- PLAYERS LIST ---
async function loadPlayers() {
  setView('players');
  showLoader();
  try {
    const resp = await fetchPlayers({ perPage: 100 }); // première page
    const container = document.getElementById('players');
    container.innerHTML = '';

    (resp.data || []).forEach(p => {
      const row = document.getElementById('player-row-template').content.cloneNode(true);
      const el = row.querySelector('.player-row');
      row.querySelector('.player-name').textContent = `${p.first_name} ${p.last_name}`;
      const tName = p.team?.full_name || p.team?.name || '';
      row.querySelector('.player-meta').textContent = [tName, p.position || ''].filter(Boolean).join(' • ');
      el.addEventListener('click', () => showPlayerDetail(p.id));
      el.addEventListener('keypress', (e) => e.key === 'Enter' && showPlayerDetail(p.id));
      container.appendChild(row);
    });

    // TODO: on pourra ajouter un bouton "Plus" si besoin (cursor)
  } catch (e) {
    renderErrorIn('players', e);
  } finally {
    hideLoader();
  }
}

// --- PLAYER DETAIL ---
async function showPlayerDetail(playerId) {
  setView('player-detail');
  showLoader();
  try {
    const resp = await fetchPlayerById(playerId);
    const p = resp.data;
    const container = document.getElementById('player-detail');

    const teamName = p.team?.full_name || p.team?.name || '—';
    const teamAbbr = p.team?.abbreviation || '';
    const pos = p.position || '—';
    const height = p.height || (p.height_feet ? `${p.height_feet}'${p.height_inches || ''}` : '—');
    const weight = p.weight || (p.weight_pounds ? `${p.weight_pounds} lbs` : '—');

    container.innerHTML = `
      <h2>${p.first_name} ${p.last_name}</h2>
