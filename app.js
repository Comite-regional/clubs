const MAP_CENTER = [47.35, -1.75];
const MAP_ZOOM = 8;

// Éléments
const elSearch = document.getElementById("search");
const elSearchBtn = document.getElementById("searchValidate");
const elDept = document.getElementById("dept");
const elPractice = document.getElementById("practice");
const elCoachLevel = document.getElementById("coachLevel");
const elStats = document.getElementById("stats");
const elList = document.getElementById("list");
const elPanelBtn = document.getElementById("panelBtn");
const elSidebar = document.querySelector(".sidebar");
const elOverlay = document.getElementById("overlay");
const elClusterToggle = document.getElementById("clusterToggle");

let map, clustersLayer, plainLayer, clubs = [], filtered = [];
let displayMode = "licences";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
  "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
}[c]));

// --- Logique des données ---

function valueForMode(c){
  if(displayMode==="femmes") return Number(c.pct_femmes||0);
  if(displayMode==="para") return Number(c.pct_para||0);
  if(displayMode==="jeunes") return Number(c.pourcentage_jeunes||0); // VRAI taux de jeunes
  return Number(c.licences_total||0);
}

function getColorForMode(mode) {
    switch(mode) {
        case "femmes": return "#ec4899"; 
        case "para": return "#10b981";    
        case "jeunes": return "#3b82f6"; // Bleu pour les jeunes
        default: return "#2563eb";      
    }
}

// --- Filtres et Recherche ---

function applyFilters(){
  const q = (elSearch.value || "").toLowerCase().trim();
  const dept = elDept.value;
  const practice = elPractice.value;
  const coachLvl = elCoachLevel.value;

  filtered = clubs.filter(c => {
    // RECHERCHE ETENDUE : Nom + Ville + CP
    const searchString = `${c.nom} ${c.ville} ${c.cp}`.toLowerCase();
    const okQ = !q || searchString.includes(q);
    
    const okDept = !dept || c.departement === dept;
    
    // FILTRE PRATIQUE
    const okPrac = !practice || (Array.isArray(c.pratiques) && c.pratiques.includes(practice));
    
    // FILTRE ENTRAINEUR (Diplôme)
    const okCoach = !coachLvl || (Array.isArray(c.niveaux_entraineurs) && c.niveaux_entraineurs.some(n => n.niveau === coachLvl));
    
    return okQ && okDept && okPrac && okCoach;
  });

  renderAll();
}

// --- UI et Carte ---

function closeMobileMenu() {
    if(window.innerWidth <= 1024) {
        elSidebar.classList.remove("open");
        elOverlay.classList.remove("show");
        elPanelBtn.textContent = "📊 Liste & Filtres";
    }
}

function init(){
    map = L.map("map", { zoomControl: false }).setView(MAP_CENTER, MAP_ZOOM);
    L.control.zoom({ position: 'topright' }).addTo(map);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png").addTo(map);

    plainLayer = L.layerGroup().addTo(map);
    clustersLayer = L.markerClusterGroup().addTo(map);

    // Event Recherche (Touche Entrée)
    elSearch.addEventListener("keypress", (e) => {
        if(e.key === "Enter") {
            applyFilters();
            closeMobileMenu();
        }
    });

    // Event Recherche (Bouton Loupe)
    elSearchBtn.onclick = () => {
        applyFilters();
        closeMobileMenu();
    };

    // Filtres Select
    [elDept, elPractice, elCoachLevel].forEach(el => {
        el.onchange = applyFilters;
    });

    // Modes d'affichage
    document.querySelectorAll(".segBtn").forEach(btn => {
        btn.onclick = () => {
            displayMode = btn.dataset.mode;
            document.querySelectorAll(".segBtn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            applyFilters();
        };
    });

    // Toggle Mobile
    elPanelBtn.onclick = () => {
        const isOpen = elSidebar.classList.toggle("open");
        elOverlay.classList.toggle("show");
        elPanelBtn.textContent = isOpen ? "✖ Fermer" : "📊 Liste & Filtres";
    };

    loadData();
}

async function loadData(){
    const res = await fetch("./clubs.json");
    const data = await res.json();
    
    clubs = data.map(c => ({
        ...c,
        lat: Number(c.lat), 
        lng: Number(c.lon || c.lng),
        niveaux_entraineurs: Array.isArray(c.niveaux_entraineurs) ? c.niveaux_entraineurs : [],
        pratiques: Array.isArray(c.pratiques) ? c.pratiques : []
    }));

    // Remplissage dynamique des listes déroulantes
    const depts = [...new Set(clubs.map(c => c.departement))].filter(Boolean).sort();
    const practices = [...new Set(clubs.flatMap(c => c.pratiques))].filter(Boolean).sort();
    const coachLvls = [...new Set(clubs.flatMap(c => c.niveaux_entraineurs.map(n => n.niveau)))].filter(Boolean).sort();

    elDept.innerHTML = `<option value="">Département</option>` + depts.map(d => `<option value="${d}">${d}</option>`).join("");
    elPractice.innerHTML = `<option value="">Toutes pratiques</option>` + practices.map(p => `<option value="${p}">${p}</option>`).join("");
    elCoachLevel.innerHTML = `<option value="">Tous diplômes</option>` + coachLvls.map(l => `<option value="${l}">${l}</option>`).join("");

    applyFilters();
}

// (Réutilisez vos fonctions renderAll, renderMarkers, createMarker, etc. de l'étape précédente)
// ...
