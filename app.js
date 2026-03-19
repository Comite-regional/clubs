const MAP_CENTER = [47.35, -1.75];
const MAP_ZOOM = 8;

// Éléments UI
const elSearch = document.getElementById("search");
const elOnlyYouth = document.getElementById("onlyYouth");
const elOnlyRef = document.getElementById("onlyRef");
const elDept = document.getElementById("dept");
const elPractice = document.getElementById("practice");
const elCoachLevel = document.getElementById("coachLevel"); // Assurez-vous que cet ID existe dans votre HTML
const elReset = document.getElementById("reset");
const elStats = document.getElementById("stats");
const elList = document.getElementById("list");
const elPanelBtn = document.getElementById("panelBtn");
const elSidebar = document.querySelector(".sidebar");
const elOverlay = document.getElementById("overlay");
const elLegend = document.getElementById("legend");
const elModeButtons = document.querySelectorAll(".segBtn");
const elClusterToggle = document.getElementById("clusterToggle");

let map, clustersLayer, plainLayer, clubs = [], filtered = [];
let displayMode = "licences";
let modeScale = {min:0, max:100};

// Utilitaires
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
  "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
}[c]));

// --- Fonctions de Rendu et Visualisation ---

/**
 * Génère le HTML pour le badge de label (Ambition, Excellence, etc.)
 */
function labelBadge(label){
  if(!label) return "";
  const key = String(label).toLowerCase();
  // IMPORTANT: La classe CSS 'labelBadge' doit limiter la hauteur (ex: max-height: 30px;)
  return `<img class="labelBadge" src="assets/label_${key}.png" alt="Label ${esc(label)}" title="Label ${esc(label)}" style="max-height: 35px; width: auto; vertical-align: middle; margin-left: 8px;" />`;
}

/**
 * Génère un SVG de graphique circulaire (camembert)
 * @param {number} pct - Pourcentage à afficher (0-100)
 * @param {string} color - Couleur de la partie remplie
 * @param {number} size - Taille du SVG en pixels
 * @param {boolean} showText - Afficher le texte du pourcentage au centre
 */
function pieSvg(pct, color = "#ec4899", size = 56, showText = true){
  const p = Math.max(0, Math.min(100, Number(pct||0)));
  const r = 22, c = 2 * Math.PI * r;
  const filled = c * (p/100);
  const fontSize = size * 0.2;
  const textY = size * 0.55;
  
  let textHtml = "";
  if (showText) {
      textHtml = `<text x="28" y="${textY}" text-anchor="middle" font-size="${fontSize}" font-weight="800" fill="#0f172a">${Math.round(p)}%</text>`;
  }

  return `
  <svg viewBox="0 0 56 56" class="pie" width="${size}" height="${size}" aria-hidden="true" style="display: block;">
    <circle cx="28" cy="28" r="22" fill="none" stroke="#e5e7eb" stroke-width="8"></circle>
    <circle cx="28" cy="28" r="22" fill="none" stroke="${color}" stroke-width="8"
      stroke-linecap="round" stroke-dasharray="${filled} ${c-filled}" transform="rotate(-90 28 28)"></circle>
    ${textHtml}
  </svg>`;
}

/**
 * Rendu générique pour les listes de personnes (entraîneurs, arbitres)
 */
function renderNamedPeople(list, emptyText, valueKey){
  if(!Array.isArray(list) || !list.length) return `<div class="empty-list" style="font-size: 12px; color: #64748b; font-style: italic;">${emptyText}</div>`;
  const sorted = list.slice().sort((a,b) => String(a.nom || "").localeCompare(String(b.nom || ""), "fr"));
  return `<ul style="margin: 0; padding-left: 18px; font-size: 12px;">${sorted.map(x => `<li>${esc(x?.nom || "Inconnu")}${x[valueKey] ? ` — <b>${esc(x[valueKey])}</b>` : ""}</li>`).join("")}</ul>`;
}

/**
 * Définit la couleur principale pour chaque mode de visualisation
 */
function getColorForMode(mode) {
    switch(mode) {
        case "femmes": return "#ec4899"; // Rose
        case "para": return "#10b981";    // Vert
        case "jcomp": return "#f59e0b";   // Orange
        default: return "#2563eb";      // Bleu (Licenciés)
    }
}

/**
 * Calcule la valeur numérique pertinente pour le club selon le mode actuel
 */
function valueForMode(c){
  if(displayMode==="femmes") return Number(c.pct_femmes||0);
  if(displayMode==="para") return Number(c.pct_para||0);
  if(displayMode==="jcomp") return Number(c.pct_jeunes_competiteurs_18m||0);
  return Number(c.licences_total||0);
}

// --- Logique des Marqueurs et Cartographie ---

/**
 * Crée un marqueur Leaflet pour un club.
 * Utilise un DivIcon pour afficher un camembert si un mode de pourcentage est actif.
 */
function createMarker(c) {
    const mainColor = getColorForMode(displayMode);
    
    // Taille de base basée sur le nombre de licenciés
    const baseRadius = 8 + Math.sqrt(Number(c.licences_total || 0)) * 1.5;

    if (displayMode === "licences") {
        // Mode normal : Point bleu
        return L.circleMarker([c.lat, c.lng], {
            radius: baseRadius,
            weight: 2,
            color: "#ffffff",
            fillColor: mainColor,
            fillOpacity: 0.9
        });
    } else {
        // Modes pourcentages : Petit camembert comme marqueur
        const pct = valueForMode(c);
        const size = Math.max(24, baseRadius * 2); // Taille du camembert sur la carte
        
        // Création d'un DivIcon Leaflet contenant le SVG du camembert
        const icon = L.divIcon({
            html: `<div style="transform: translate(-50%, -50%);">${pieSvg(pct, mainColor, size, false)}</div>`,
            className: 'club-pie-marker',
            iconSize: [size, size],
            iconAnchor: [size/2, size/2]
        });
        
        return L.marker([c.lat, c.lng], { icon: icon });
    }
}

/**
 * Génère le HTML complet pour la popup d'un club
 */
function makePopupHtml(c){
  // Préparation des données spécifiques
  const coachLevelsHtml = (c.niveaux_entraineurs?.length)
    ? `<ul style="margin: 0; padding-left: 18px; font-size: 12px;">${c.niveaux_entraineurs.map(x => `<li>${esc(x.niveau)} : <b>${esc(x.nb)}</b></li>`).join("")}</ul>`
    : `<div class="empty-list" style="font-size: 12px; color: #64748b; font-style: italic;">Aucun diplôme actif.</div>`;

  const logo = c.logo_url ? `<img class="logo" src="${esc(c.logo_url)}" onerror="this.src='assets/logo_placeholder.svg';" style="width: 50px; height: 50px; object-fit: contain; border-radius: 8px; background: #f1f5f9;" />` : `<div class="logo" style="width: 50px; height: 50px; border-radius: 8px; background: #f1f5f9; display:flex; align-items:center; justify-content:center; color:#64748b; font-size:12px;">LOGO</div>`;
  const links = [c.site ? `<a href="${esc(c.site)}" target="_blank" style="font-weight:700;">Site</a>` : "", c.email ? `<a href="mailto:${esc(c.email)}" style="font-weight:700;">Email</a>` : ""].filter(Boolean).join(" &nbsp;&bull;&nbsp; ");

  // Calculs pour la popup (indépendants du displayMode de la carte)
  const pctFemmesPopup = Number(c.pct_femmes || 0);
  const colorFemmes = getColorForMode("femmes");

  // Formatage propre des pourcentages
  const fmtPct = (val) => (typeof val === 'number') ? `${val.toFixed(1)}%` : "0.0%";

  return `
  <div class="popup" style="width: 340px; line-height: 1.4;">
    <div class="h" style="display: flex; gap: 12px; align-items: center; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
      ${logo}
      <div style="flex:1; min-width: 0;">
        <div class="clubRow" style="display: flex; align-items: center; flex-wrap: wrap;">
            <div class="club" style="font-weight: 800; font-size: 1.2rem; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;">${esc(c.nom)}</div>
            ${labelBadge(c.label_club)}
        </div>
        <div class="addr" style="font-size: 12px; color: #64748b; margin-top: 2px;"><strong>Président :</strong> ${esc(c.president || "Non renseigné")}</div>
      </div>
    </div>

    <div class="grid3 compact-stats" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px;">
      <div class="box" style="background: #f8fafc; padding: 8px; border-radius: 8px; text-align: center;"><div class="t" style="font-size: 11px; color: #64748b; text-transform: uppercase;">Total</div><div class="v" style="font-weight: 800; font-size: 1.1rem;">${c.licences_total}</div></div>
      <div class="box" style="background: #f8fafc; padding: 8px; border-radius: 8px; text-align: center;"><div class="t" style="font-size: 11px; color: #64748b; text-transform: uppercase;">Jeunes</div><div class="v" style="font-weight: 800; font-size: 1.1rem;">${fmtPct(c.pourcentage_jeunes)}</div></div>
      <div class="box" style="background: #f8fafc; padding: 8px; border-radius: 8px; text-align: center;"><div class="t" style="font-size: 11px; color: #64748b; text-transform: uppercase;">Para</div><div class="v" style="font-weight: 800; font-size: 1.1rem;">${fmtPct(c.pct_para)}</div></div>
    </div>

    <div class="split" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">
      <div class="box wide" style="background: #f8fafc; padding: 10px; border-radius: 8px;">
        <div class="t" style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight:700; margin-bottom:6px;">Féminisation</div>
        <div class="genderRow" style="display: flex; gap: 10px; align-items: center;">
          <div class="pieWrap" style="flex: 0 0 40px;">${pieSvg(pctFemmesPopup, colorFemmes, 40, true)}</div>
          <div class="legend" style="font-size:11px; line-height: 1.3;">
            <div><span class="sw sF" style="display:inline-block; width:8px; height:8px; background:${colorFemmes}; margin-right:4px;"></span> F : <b>${c.nb_femmes}</b></div>
            <div><span class="sw sH" style="display:inline-block; width:8px; height:8px; background:#0ea5e9; margin-right:4px;"></span> H : <b>${c.nb_hommes}</b></div>
          </div>
        </div>
      </div>
      
      <div class="box" style="background: #f8fafc; padding: 10px; border-radius: 8px; text-align: center; display: flex; flex-direction: column; justify-content: center;">
        <div class="t" style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight:700; margin-bottom: 4px;">J. Compétiteurs</div>
        <div class="v" style="font-weight: 800; font-size: 1.1rem; color: ${getColorForMode('jcomp')};">${fmtPct(c.pct_jeunes_competiteurs_18m)}</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 2px;">(${esc(c.jeunes_competiteurs_18m || 0)} archers)</div>
      </div>
    </div>

    <div class="box-full" style="background: #f8fafc; padding: 8px; border-radius: 8px; margin-bottom: 12px; text-align: center; border: 1px solid #e2e8f0;">
        <div class="t" style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight:700;">Arbitres disponibles</div>
        <div class="v" style="font-weight: 800; font-size: 1rem;">${c.a_arbitre ? "Oui ✅" : "Non ❌"} <span class="sub-val" style="font-weight: 600; color: #64748b; font-size: 0.9rem;">(${c.nb_arbitres} actifs)</span></div>
    </div>

    <div class="scroll-section" style="max-height: 150px; overflow-y: auto; background: #f1f5f9; border-radius: 8px; padding: 10px; margin-bottom: 12px; border: 1px solid #e2e8f0;">
        <div class="box-full" style="margin-bottom: 8px;"><div class="t" style="font-weight: 700; color: #475569; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px; margin-bottom: 4px; font-size: 12px;">Diplômes Entraîneurs</div>${coachLevelsHtml}</div>
        <div class="box-full"><div class="t" style="font-weight: 700; color: #475569; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px; margin-bottom: 4px; font-size: 12px;">Liste Arbitres</div>${renderNamedPeople(c.arbitres, "Aucun arbitre certifié.", "niveau")}</div>
    </div>
    
    <div class="links" style="text-align: center; margin-top: 10px; font-size: 12px;">${links || `<span class="muted" style="color: #64748b; font-style: italic;">Aucun lien disponible.</span>`}</div>
  </div>`;
}

// --- Fonctions Principales de l'Application ---

function syncFilters(){
  const depts = [...new Set(clubs.map(c => String(c.departement || "").trim()).filter(Boolean))].sort();
  const practices = [...new Set(clubs.flatMap(c => c.pratiques || []))].sort();
  // Correction: Vérification de l'existence de niveaux_entraineurs
  const coachLvls = [...new Set(clubs.flatMap(c => (c.niveaux_entraineurs && Array.isArray(c.niveaux_entraineurs)) ? c.niveaux_entraineurs.map(n => n.niveau) : []))].sort();

  if(elDept) elDept.innerHTML = `<option value="">Tous départements</option>` + depts.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join("");
  if(elPractice) elPractice.innerHTML = `<option value="">Toutes pratiques</option>` + practices.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join("");
  if(elCoachLevel) elCoachLevel.innerHTML = `<option value="">Tous les diplômes</option>` + coachLvls.map(l => `<option value="${esc(l)}">${esc(l)}</option>`).join("");
}

function applyFilters(){
  const q = (elSearch.value || "").toLowerCase().trim();
  const dept = elDept ? elDept.value : "";
  const practice = elPractice ? elPractice.value : "";
  const coachLvl = elCoachLevel ? elCoachLevel.value : "";

  filtered = clubs.filter(c => {
    const text = [c.nom, c.departement, c.president].join(" ").toLowerCase();
    const okQ = !q || text.includes(q);
    const okDept = !dept || c.departement === dept;
    const okPrac = !practice || (c.pratiques && c.pratiques.includes(practice));
    // Correction: Vérification de l'existence de niveaux_entraineurs pour le filtre
    const okCoach = !coachLvl || (c.niveaux_entraineurs && Array.isArray(c.niveaux_entraineurs) && c.niveaux_entraineurs.some(n => n.niveau === coachLvl));
    const okYouth = !elOnlyYouth.checked || (c.pourcentage_jeunes && c.pourcentage_jeunes > 0);
    const okRef = !elOnlyRef.checked || c.a_arbitre;
    return okQ && okDept && okPrac && okCoach && okYouth && okRef;
  });

  renderAll();
}

/**
 * Met à jour la légende de la carte selon le mode d'affichage
 */
function updateLegend() {
    if(!elLegend) return;
    const mainColor = getColorForMode(displayMode);
    
    let html = "";
    if (displayMode === "licences") {
        html = `<div style="display: flex; align-items: center; gap: 8px;"><span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: ${mainColor}; border: 2px solid white; box-shadow: 0 0 3px rgba(0,0,0,0.3);"></span> Taille = Nombre de licenciés</div>`;
    } else {
        let label = "";
        switch(displayMode) {
            case "femmes": label = "% Femmes"; break;
            case "para": label = "% Para-tir"; break;
            case "jcomp": label = "% Jeunes Compétiteurs"; break;
        }
        html = `<div style="display: flex; align-items: center; gap: 8px;">${pieSvg(75, mainColor, 20, false)} Marqueur = ${label}</div>`;
    }
    elLegend.innerHTML = html;
}

function renderMarkers(){
  if(clustersLayer) clustersLayer.clearLayers();
  if(plainLayer) plainLayer.clearLayers();

  filtered.forEach(c => {
    if(!c.lat || !c.lng) return; // Sécurité coordonnées
    
    const m = createMarker(c);
    
    // Configuration de la popup Leaflet
    m.bindPopup(makePopupHtml(c), { 
        maxWidth: 360,
        className: 'custom-club-popup'
    });
    
    // Ajout au calque approprié (groupé ou non)
    if(elClusterToggle && elClusterToggle.checked && displayMode === "licences") {
      // Le clustering ne fonctionne bien qu'avec des CircleMarkers simples
      clustersLayer.addLayer(m);
    } else {
      plainLayer.addLayer(m);
    }
  });
  
  // Gestion de l'affichage des calques sur la carte
  if (map) {
      if(elClusterToggle && elClusterToggle.checked && displayMode === "licences") {
          if (!map.hasLayer(clustersLayer)) map.addLayer(clustersLayer);
          if (map.hasLayer(plainLayer)) map.removeLayer(plainLayer);
      } else {
          if (!map.hasLayer(plainLayer)) map.addLayer(plainLayer);
          if (map.hasLayer(clustersLayer)) map.removeLayer(clustersLayer);
      }
  }
}

function renderList(){
  if(!elList) return;
  // On trie par licences_total décroissant et on prend les 10 premiers
  const top10 = filtered.slice().sort((a,b) => b.licences_total - a.licences_total).slice(0, 10);
  
  elList.innerHTML = `<h3 class="top-title" style="padding:10px 15px; font-size:14px; color: #64748b; background: #f8fafc; margin: 0; text-transform: uppercase; letter-spacing: 0.5px;">Top 10 Clubs (Licenciés)</h3>` + top10.map(c => `
    <button class="clubItem" data-id="${c.code_structure}" style="display: flex; align-items: center; width: 100%; padding: 12px 15px; border: none; background: none; border-bottom: 1px solid #f1f5f9; cursor: pointer; text-align: left;">
      <div style="flex:1; min-width: 0; padding-right: 10px;">
        <b style="font-size: 13px; color: #0f172a;">${esc(c.nom)}</b><br>
        <small style="color: #64748b;">Dept. ${esc(c.departement)}</small>
      </div>
      <div class="licence-count" style="font-weight: 800; color: #2563eb; font-size: 1.1rem;">${c.licences_total}</div>
    </button>`).join("");

  // Écouteurs de clic sur la liste
  elList.querySelectorAll(".clubItem").forEach(btn => {
    btn.addEventListener("click", () => {
      const c = clubs.find(x => String(x.code_structure) === btn.dataset.id);
      if(!c) return;
      
      map.setView([c.lat, c.lng], 12);
      
      // Petite temporisation pour laisser la carte se centrer avant d'ouvrir la popup
      setTimeout(() => {
          L.popup({maxWidth: 360})
           .setLatLng([c.lat, c.lng])
           .setContent(makePopupHtml(c))
           .openOn(map);
      }, 200);
      
      // Fermer la sidebar sur mobile après sélection
      if(window.innerWidth <= 768 && elSidebar && elSidebar.classList.contains('open')) {
          elSidebar.classList.remove('open');
          if(elOverlay) elOverlay.classList.remove('show');
      }
    });
  });
}

function renderAll(){
  renderMarkers();
  renderList();
  updateLegend();
  
  if(elStats) {
      elStats.innerHTML = `<div class="stat-main" style="padding: 10px 15px; font-size: 14px;"><b>${filtered.length}</b> clubs affichés sur la carte</div>`;
  }
}

async function loadData(){
  try {
      const res = await fetch("./clubs.json");
      if (!res.ok) throw new Error("Erreur lors du chargement du fichier JSON");
      
      const rawData = await res.json();
      
      // Nettoyage et typage strict des données
      clubs = rawData.map(c => ({
        ...c,
        lat: Number(c.lat), 
        lng: Number(c.lng ?? c.lon),
        licences_total: Number(c.licences_total || 0),
        pourcentage_jeunes: Number(c.pourcentage_jeunes || 0),
        pct_femmes: Number(c.pct_femmes || 0),
        pct_para: Number(c.pct_para || 0),
        // CORRECTION: Assurer que cette valeur est bien un nombre
        pct_jeunes_competiteurs_18m: Number(c.pct_jeunes_competiteurs_18m || 0),
        nb_femmes: Number(c.nb_femmes || 0),
        nb_hommes: Number(c.nb_hommes || 0),
        nb_arbitres: Number(c.nb_arbitres || 0),
        nb_para: Number(c.nb_para || 0),
        jeunes_competiteurs_18m: Number(c.jeunes_competiteurs_18m || 0),
        a_arbitre: !!c.a_arbitre,
        pratiques: Array.isArray(c.pratiques) ? c.pratiques : [],
        niveaux_entraineurs: Array.isArray(c.niveaux_entraineurs) ? c.niveaux_entraineurs : [],
        arbitres: Array.isArray(c.arbitres) ? c.arbitres : []
      })).filter(c => !isNaN(c.lat) && !isNaN(c.lng)); // Exclure les clubs sans coordonnées valides
      
      syncFilters();
      applyFilters();
  } catch (error) {
      console.error("Erreur Application:", error);
      alert("Impossible de charger les données des clubs.");
  }
}

function init(){
  // Initialisation de la carte Leaflet
  map = L.map("map", {
      zoomControl: true,
      minZoom: 6
  }).setView(MAP_CENTER, MAP_ZOOM);
  
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  
  // Calques
  plainLayer = L.layerGroup().addTo(map);
  clustersLayer = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 50
  });

  // Écouteurs d'événements pour les filtres
  const filterElements = [elSearch, elDept, elPractice, elCoachLevel, elOnlyYouth, elOnlyRef];
  filterElements.forEach(el => {
      if(!el) return;
      const eventType = (el.type === 'text' || el.type === 'search') ? 'input' : 'change';
      el.addEventListener(eventType, applyFilters);
  });
  
  if(elReset) {
      elReset.addEventListener('click', () => {
          if(elSearch) elSearch.value = "";
          if(elDept) elDept.value = "";
          if(elPractice) elPractice.value = "";
          if(elCoachLevel) elCoachLevel.value = "";
          if(elOnlyYouth) elOnlyYouth.checked = false;
          if(elOnlyRef) elOnlyRef.checked = false;
          applyFilters();
      });
  }
  
  // Gestionnaire pour le regroupement (clustering)
  if(elClusterToggle) {
      elClusterToggle.addEventListener('change', () => {
          renderMarkers();
          // Désactiver le toggle si on n'est pas en mode licences, car le clustering de camemberts est illisible
          if (displayMode !== "licences" && elClusterToggle.checked) {
              alert("Le regroupement est optimisé pour le mode 'Licenciés'.");
              elClusterToggle.checked = false;
              renderMarkers();
          }
      });
  }

  // Écouteurs pour les boutons de mode d'affichage
  elModeButtons.forEach(btn => btn.addEventListener("click", () => {
    displayMode = btn.dataset.mode;
    elModeButtons.forEach(b => b.classList.toggle("active", b === btn));
    
    // Forcer la désactivation du clustering pour les modes camemberts
    if (displayMode !== "licences" && elClusterToggle && elClusterToggle.checked) {
        elClusterToggle.checked = false;
    }
    
    renderAll();
  }));
  
  // Gestion Sidebar Mobile (assurez-vous d'avoir les éléments HTML correspondants si nécessaire)
  if(elPanelBtn && elSidebar) {
      elPanelBtn.addEventListener('click', () => {
          elSidebar.classList.toggle('open');
          if(elOverlay) elOverlay.classList.toggle('show');
      });
  }
  
  if(elOverlay && elSidebar) {
      elOverlay.addEventListener('click', () => {
          elSidebar.classList.remove('open');
          elOverlay.classList.remove('show');
      });
  }

  // Chargement des données
  loadData();
}

// Lancement au chargement du DOM
document.addEventListener('DOMContentLoaded', init);
