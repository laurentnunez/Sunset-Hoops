<script>
  // --- Helpers date ---
  function addDays(baseDate, days) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + days);
    return d;
  }

  function toISODate(d) {
    // d est un objet Date
    const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return z.toISOString().slice(0, 10); // YYYY-MM-DD
  }

  function formatFrenchShort(d) {
    // ex: "lun. 02/02" → on nettoie le point final et on uppercase la première lettre
    const day = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }).format(d).replace(/\.$/, '');
    const dd = String(d.getDate()).padStart(2,'0');
    const mm = String(d.getMonth()+1).padStart(2,'0');
    // Capitaliser la première lettre du jour
    const dayCap = day.charAt(0).toUpperCase() + day.slice(1);
    return `${dayCap} ${dd}/${mm}`;
  }

  // --- Rend les 5 boutons J-2..J+2 avec labels dynamiques ---
  function renderScoreButtons() {
    const container = document.getElementById("score-days");
    const today = new Date();  // point de référence local
    const offsets = [-2, -1, 0, 1, 2];

    container.innerHTML = offsets.map(off => {
      const d = addDays(today, off);
      const label = formatFrenchShort(d);
      const iso = toISODate(d);
      return `<button class="day-btn" data-date="${iso}">${label}</button>`;
    }).join("");

    // Gestion du clic + état actif
    container.querySelectorAll(".day-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        container.querySelectorAll(".day-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        loadScoresByDate(btn.dataset.date);
      });
    });

    // Au chargement, activer la date du jour
    const todayISO = toISODate(today);
    const todayBtn = container.querySelector(`.day-btn[data-date="${todayISO}"]`);
    if (todayBtn) {
      todayBtn.classList.add("active");
    }
  }

  // --- Chargement des scores (inchangé, juste appelé avec une date ISO) ---
  async function loadScoresByDate(dateISO) {
    const list = document.getElementById("scores-list");
    const status = document.getElementById("scores-status");
    list.innerHTML = "";
    status.textContent = "Chargement…";

    try {
      const json = await getJson(`${API_BASE}/games?dates[]=${dateISO}`);
      const games = json.data;

      if (!games.length) {
        // On affiche la date en FR pour cohérence
        const [y,m,d] = dateISO.split('-').map(n=>parseInt(n,10));
        const dateFr = new Intl.DateTimeFormat('fr-FR', { weekday:'long', day:'2-digit', month:'2-digit' })
                        .format(new Date(y, m-1, d));
        list.innerHTML = `<div>Aucun match le ${dateFr}.</div>`;
        status.textContent = "";
        return;
      }

      list.innerHTML = games.map(g => `
        <div class="row">
          <div>
            <div><span class="badge">${g.season}</span></div>
            <div class="muted">${g.visitor_team.full_name} @ ${g.home_team.full_name}</div>
          </div>
          <div class="score">
            ${g.visitor_team.abbreviation} ${g.visitor_team_score} –
            ${g.home_team.abbreviation} ${g.home_team_score}
          </div>
        </div>
      `).join("");

    } catch (e) {
      list.innerHTML = `<div>Erreur : ${e.message}</div>`;
    } finally {
      status.textContent = "";
    }
  }

  // --- Initialisation au chargement ---
  renderScoreButtons();
  loadScoresByDate(toISODate(new Date()));
</script>