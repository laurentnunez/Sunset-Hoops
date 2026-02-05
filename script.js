/***************************
  CONFIG API
***************************/
const API_BASE = "https://api.balldontlie.io/v1/";
const API_KEY = "433ab9b9-a787-4baa-9cb6-9871e4fcdf11"; // Laissez vide si vous n'avez pas de clé

const FETCH_OPTS = {
  method:"GET",
  headers:{
    "Accept":"application/json",
    ...(API_KEY ? { "Authorization": API_KEY } : {})
  }
};

/***************************
  SELECTORS
***************************/
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

/***************************
  ONGLET NAVIGATION
***************************/
$$(".tab").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    $$(".tab").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    ["scores","standings","teams","players"].forEach(id=>{
      $("#"+id).style.display = (btn.dataset.tab===id)?"":"none";
    });
  });
});

/***************************
  API WRAPPER
***************************/
async function getJson(url){
  const res = await fetch(url, FETCH_OPTS);
  if(!res.ok) throw new Error("API "+res.status);
  return res.json();
}

/***************************
        SCORES
***************************/

/* Helpers date */
function addDays(base, days){
  const d = new Date(base);
  d.setDate(d.getDate()+days);
  return d;
}

function toISODate(dateObj){
  const z = new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0,10);
}

function formatFrenchShort(d){
  const day = new Intl.DateTimeFormat('fr-FR',{ weekday:'short' })
    .format(d).replace(/\.$/,'');
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dayCap = day.charAt(0).toUpperCase() + day.slice(1);
  return `${dayCap} ${dd}/${mm}`;
}

/* Génère les 5 boutons J-2..J+2 */
function renderScoreButtons(){
  const c = $("#score-days");
  const today = new Date();
  const offsets = [-2,-1,0,1,2];

  c.innerHTML = offsets.map(off=>{
    const d = addDays(today, off);
    const iso = toISODate(d);
    const label = formatFrenchShort(d);
    return `<button class="day-btn" data-date="${iso}">${label}</button>`;
  }).join("");

  // Gestion du clic + bouton actif
  c.querySelectorAll(".day-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      c.querySelectorAll(".day-btn").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      loadScoresByDate(btn.dataset.date);
    });
  });

  // Activer "aujourd'hui"
  const todayISO = toISODate(today);
  const todayBtn = c.querySelector(`[data-date="${todayISO}"]`);
  if(todayBtn) todayBtn.classList.add("active");
}

/* Charge les scores du jour demandé */
async function loadScoresByDate(dateISO){
  const list=$("#scores-list");
  const status=$("#scores-status");
  list.innerHTML="";
  status.textContent="Chargement…";

  try{
    const json = await getJson(`${API_BASE}/games?dates[]=${dateISO}`);
    const games = json.data;

    if(!games.length){
      const [y,m,d] = dateISO.split('-').map(n=>parseInt(n,10));
      const dateFr = new Intl.DateTimeFormat('fr-FR', {
        weekday:'long', day:'2-digit', month:'2-digit'
      }).format(new Date(y,m-1,d));
      list.innerHTML = `<div>Aucun match le ${dateFr}.</div>`;
      status.textContent="";
      return;
    }

    list.innerHTML = games.map(g=>`
      <div class="row">
        <div>
          <div><span class="badge">${g.time}</span></div>
        
	<div class="team away">
            <img src="${g.visitorLogo}" alt="${visitor.full_name} logo" width="40" height="40">
            <span>${visitor.full_name}</span>
          </div>

	<div class="score">
            ${g.visitor_team_score} - ${g.home_team_score}
         </div>

	<div class="team home">
            <img src="${g.homeLogo}" alt="${home.full_name} logo" width="40" height="40">
            <span>${home.full_name}</span>
          </div>
        </div>

        </div>
      </div>
    `).join("");

  } catch(e){
    list.innerHTML = `<div>Erreur : ${e.message}</div>`;
  } finally {
    status.textContent="";
  }
}

/* Initialisation du module SCORE */
renderScoreButtons();
loadScoresByDate(toISODate(new Date()));

/***************************
       STANDINGS
***************************/
const seasonSelect = $("#season-select");

(function initSeasons(){
  const y = new Date().getFullYear();
  const years = [y, y-1, y-2, y-3];
  seasonSelect.innerHTML = years.map(yy=>`<option value="${yy}">${yy}</option>`).join("");
})();

async function loadStandings(){
  const status=$("#standings-status");
  const eastBody=$("#east-table tbody");
  const westBody=$("#west-table tbody");

  eastBody.innerHTML=westBody.innerHTML="";
  status.textContent="Chargement…";

  try{
    const teams = (await getJson(`${API_BASE}/teams`)).data;
    const byId = Object.fromEntries(teams.map(t=>[t.id,{team:t,w:0,l:0}]));

    async function getAllPages(url){
      let page=1, out=[], total=1;
      do{
        const data = await getJson(url+`&per_page=100&page=${page}`);
        out = out.concat(data.data);
        total = data.meta.total_pages;
        page++;
      }while(page<=total);
      return out;
    }

    const games = await getAllPages(`${API_BASE}/games?seasons[]=${seasonSelect.value}&postseason=false`);

    games.forEach(g=>{
      const h = byId[g.home_team.id];
      const a = byId[g.visitor_team.id];
      if(typeof g.home_team_score==="number"){
        if(g.home_team_score > g.visitor_team_score){ h.w++; a.l++; }
        else if(g.home_team_score < g.visitor_team_score){ a.w++; h.l++; }
      }
    });

    const east=[], west=[];
    for(const id in byId){
      const o = byId[id];
      const t = o.team;
      const pct = (o.w+o.l ? o.w/(o.w+o.l) : 0);
      const row = {team:t,w:o.w,l:o.l,pct};
      (t.conference==="East" ? east : west).push(row);
    }

    const sortFn = (a,b)=>b.pct-a.pct || b.w-a.w;
    east.sort(sortFn); west.sort(sortFn);

    function render(list, tbody){
      tbody.innerHTML = list.map((r,i)=>`
        <tr>
          <td>${i+1}</td>
          <td>${r.team.full_name}</td>
          <td class="right">${r.w}</td>
          <td class="right">${r.l}</td>
          <td class="right">${r.pct.toFixed(3).slice(1)}</td>
        </tr>`
      ).join("");
    }

    render(east, eastBody);
    render(west, westBody);

  } catch(e){
    eastBody.innerHTML=westBody.innerHTML=
      `<tr><td colspan="5">Erreur : ${e.message}</td></tr>`;
  } finally {
    status.textContent="";
  }
}

$("#btn-load-standings").addEventListener("click", loadStandings);

/***************************
          TEAMS
***************************/
$("#btn-load-teams").addEventListener("click", async ()=>{
  const grid=$("#teams-grid");
  const status=$("#teams-status");
  grid.innerHTML="";
  status.textContent="Chargement…";

  try{
    const teams = (await getJson(`${API_BASE}/teams`)).data;
    grid.innerHTML = teams.map(t=>`
      <div class="team-card">
        <strong>${t.full_name}</strong><br>
        <span class="muted">${t.city} · ${t.division} · ${t.conference}</span>
      </div>
    `).join("");

  }catch(e){
    grid.innerHTML=`<div>Erreur : ${e.message}</div>`;
  }finally{
    status.textContent="";
  }
});

/***************************
          PLAYERS
***************************/
$("#btn-search-players").addEventListener("click", async ()=>{
  const q = $("#player-q").value.trim();
  const list=$("#players-list");
  const status=$("#players-status");

  if(!q){
    list.innerHTML="Saisis un nom";
    return;
  }

  list.innerHTML="";
  status.textContent="Recherche…";

  try{
    const data = await getJson(`${API_BASE}/players?search=${encodeURIComponent(q)}`);
    const players = data.data;

    if(!players.length){
      list.innerHTML="Aucun résultat";
      return;
    }

    list.innerHTML = players.map(p=>`
      <div class="row">
        <div>
          <strong>${p.first_name} ${p.last_name}</strong>
          <div class="muted">${p.team.full_name}</div>
        </div>
        <span class="badge">ID ${p.id}</span>
      </div>
    `).join("");

  }catch(e){
    list.innerHTML=`Erreur : ${e.message}`;
  }finally{
    status.textContent="";
  }
});