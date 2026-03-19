/** CONFIGURATION ET VARIABLES GLOBALES **/
const MAP_CENTER = [47.35, -1.75];
const MAP_ZOOM = 8;

let map, clustersLayer, plainLayer, clubs = [], filtered = [];
let displayMode = "licences"; // licences, femmes, para, jeunes

// Utilitaire pour éviter les failles XSS et erreurs de caractères
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
  "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
}[c]));

/** 1. FONCTIONS DE RENDU (POPUP & DESSIN) **/

function labelBadge(label){
  if(!label) return "";
  const key = String(label).toLowerCase();
  return `<img src="assets/label_${key}.png" style="height: 20px; margin-left: 5px; vertical-align: middle;" onerror="this.style.display='none'"/>`;
}

function pieSvg(pct, color = "#2563eb", size = 40){
  const p = Math.max(0, Math.min(100, Number(pct||0)));
  const r = 22, c = 2 * Math.PI * r;
  const filled = c * (p/100);
  return `
  <svg viewBox="0 0 56 56" width="${size}" height="${size}" style="display:block">
    <circle cx="28" cy="28" r="22" fill="none" stroke="#e2e8f0" stroke-width="8"></circle>
    <circle cx="28" cy="28" r="22" fill="none" stroke="${color}" stroke-width="8"
      stroke-linecap="round" stroke-dasharray="${filled} ${c-filled}" transform="rotate(-90 28 28)"></circle>
    <text x="28" y="32" text-anchor="middle" font-size="12" font-weight="bold" fill="#1e293b">${Math.round(p)}%</text>
  </svg>`;
}

function makePopupHtml(c){
  return `
  <div style="width: 280px; font-family: 'Inter', sans-serif;">
    <div style="display: flex; align-items: center; gap: 10px; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-bottom: 8px;">
      <img src="${c.logo_url || 'assets/logo_placeholder.svg'}" style="width: 45px; height: 45px; object-fit: contain;" onerror="this.src='assets/logo_placeholder.svg'">
      <div style="min-width:0; flex:1">
        <div style="font-weight: bold; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${esc(c.nom)} ${labelBadge(c.label_club)}</div>
        <div style="font-size: 11px; color: #666;">${esc(c.ville)} (${c.cp})</div>
      </div>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px;">
        <div style="background:#eff6ff; padding:8px; border-radius:6px; text-align:center;">
            <div style="font-size:9px; color:#1e40af; font-weight:700;">LICENCIÉS</div>
            <div style="font-weight:800; font-size:15px; color:#1e40af;">${c.licences_total}</div>
        </div>
        <div style="background:#f0fdf4; padding:8px; border-radius:6px; text-align:center;">
            <div style="font-size:9px; color:#166534; font-weight:700;">% JEUNES</div>
            <div style="font-weight:800; font-size:15px; color:#166534;">${Math.round(c.pourcentage_jeunes)}%</div>
        </div>
    </div>
    <div style="font-size: 11px; background: #f8fafc; padding: 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
        <div style="font-weight:bold; margin-bottom:4px; color:#475569; text-transform:uppercase; font-size:9px;">Equipe technique :</div>
        ${c.entraineurs && c.entraineurs.length ? c.entraineurs.map(e => `• ${esc(e.nom)} (${esc(e.diplome)})`).join("<br>") : "<em>Aucun entraîneur</em>"}
    </div>
    <div style="margin-top: 12px; display: flex; justify-content: center; gap: 15px; border-top: 1px solid #eee; padding-top: 8px;">
        <a href="mailto:${esc(c.email)}" style="color: #2563eb; text-decoration: none; font-weight: bold; font-size: 12px;">✉ Email</a>
        ${c.site ? `<a href="${esc(c.site)}" target="_blank" style="color: #2563eb; text-decoration: none; font-weight: bold; font-size: 12px;">🌐 Site Web</a>` : ''}
    </div>
  </div>`;
}

/** 2. LOGIQUE DE FILTRAGE ET CARTE **/

function applyFilters(){
    const elSearch = document.getElementById("search");
    const elDept = document.getElementById("dept");
    const elPractice = document.getElementById("practice");
    const elCoach = document.getElementById("coachLevel");

    const q = elSearch ? elSearch.value.toLowerCase().trim() : "";
    const dept = elDept ? elDept.value : "";
    const practice = elPractice ? elPractice.value : "";
    const coach = elCoach ? elCoach.value : "";

    filtered = clubs.filter(c => {
        const matchSearch = !q || `${c.nom} ${c.ville} ${c.cp}`.toLowerCase().includes(q);
        const matchDept = !dept || c.departement === dept;
        const matchPrac = !practice || (c.pratiques && c.pratiques.includes(practice));
        const matchCoach = !coach || (c.niveaux_entraineurs && c.niveaux_entraineurs.some(n => n.niveau === coach));
        return matchSearch && matchDept && matchPrac && matchCoach;
    });
    renderAll();
}

function renderAll(){
    if(!map) return;
    const elClusterToggle = document.getElementById("clusterToggle");
    const elStats = document.getElementById("stats");
    const elList = document.getElementById("list");

    clustersLayer.clearLayers();
    plainLayer.clearLayers();
    
    filtered.forEach(c => {
        if(!c.lat || !c.lng) return;
        
        let m;
        const color = (displayMode === "femmes") ? "#ec4899" : (displayMode === "para" ? "#10b981" : (displayMode === "jeunes" ? "#3b82f6" : "#2563eb"));
        
        if (displayMode === "licences") {
            const radius = 8 + Math.sqrt(c.licences_total) * 1.5;
            m = L.circleMarker([c.lat, c.lng], { radius, color: "#fff", weight: 2, fillColor: color, fillOpacity: 0.8 });
        } else {
            const pct = (displayMode === "femmes") ? c.pct_femmes : (displayMode === "para" ? c.pct_para : c.pourcentage_jeunes);
            const icon = L.divIcon({
                html: `<div style="transform:translate(-20px,-20px)">${pieSvg(pct, color, 40)}</div>`,
                className: '', iconSize: [40, 40]
            });
            m = L.marker([c.lat, c.lng], { icon });
        }

        m.bindPopup(makePopupHtml(c));
        
        if(elClusterToggle && elClusterToggle.checked && displayMode === "licences") {
            clustersLayer.addLayer(m);
        } else {
            plainLayer.addLayer(m);
        }
    });

    if(elStats) elStats.innerHTML = `<strong>${filtered.length}</strong> clubs trouvés`;
    if(elList) {
        const top = filtered.sort((a,b) => b.licences_total - a.licences_total).slice(0, 15);
        elList.innerHTML = top.map(c => `
            <div class="list-item" onclick="map.setView([${c.lat}, ${c.lng}], 13)" style="padding:12px; border-bottom:1px solid #f1f5f9; cursor:pointer;">
                <div style="font-weight:700; font-size:12px; color:#1e293b;">${esc(c.nom)}</div>
                <div style="font-size:11px; color:#64748b;">${esc(c.ville)} • ${c.licences_total} licenciés</div>
            </div>`).join("");
    }
}

/** 3. CHARGEMENT ET INITIALISATION **/

async function loadData() {
    try {
        const res = await fetch("./clubs.json");
        const data = await res.json();
        clubs = data.map(c => ({
            ...c, 
            lat: Number(c.lat), 
            lng: Number(c.lon || c.lng),
            licences_total: Number(c.licences_total || 0),
            pourcentage_jeunes: Number(c.pourcentage_jeunes || 0),
            entraineurs: Array.isArray(c.entraineurs) ? c.entraineurs : [],
            pratiques: Array.isArray(c.pratiques) ? c.pratiques : [],
            niveaux_entraineurs: Array.isArray(c.niveaux_entraineurs) ? c.niveaux_entraineurs : [],
            arbitres: Array.isArray(c.arbitres) ? c.arbitres : []
        }));

        // Remplissage dynamique des menus déroulants
        const elDept = document.getElementById("dept");
        if(elDept) {
            const depts = [...new Set(clubs.map(c => c.departement))].filter(Boolean).sort();
            elDept.innerHTML = `<option value="">Département</option>` + depts.map(d => `<option value="${d}">${d}</option>`).join("");
        }

        const elCoach = document.getElementById("coachLevel");
        if(elCoach) {
            const coachs = [...new Set(clubs.flatMap(c => c.niveaux_entraineurs.map(n => n.niveau)))].filter(Boolean).sort();
            elCoach.innerHTML = `<option value="">Tous les diplômes</option>` + coachs.map(l => `<option value="${l}">${l}</option>`).join("");
        }

        applyFilters();
    } catch (e) {
        console.error("Erreur critique au chargement du JSON :", e);
        alert("Impossible de charger les données des clubs.");
    }
}

function init() {
    // Eviter les doubles initialisations
    if (map) return;

    map = L.map("map", { zoomControl: false }).setView(MAP_CENTER, MAP_ZOOM);
    L.control.zoom({ position: 'topright' }).addTo(map);
    
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; CartoDB'
    }).addTo(map);

    plainLayer = L.layerGroup().addTo(map);
    clustersLayer = L.markerClusterGroup().addTo(map);

    // Bouton Me Localiser
    const b = document.createElement('button');
    b.className = 'btn-locate'; b.innerHTML = '📍';
    b.style.cssText = "position:absolute; bottom:25px; left:25px; z-index:500; width:45px; height:45px; border-radius:50%; border:none; background:white; box-shadow:0 4px 10px rgba(0,0,0,0.2); cursor:pointer; font-size:20px;";
    document.body.appendChild(b);
    b.onclick = () => map.locate({setView: true, maxZoom: 13});

    // Événements Recherche et Filtres
    const elSearch = document.getElementById("search");
    const elSearchBtn = document.getElementById("searchValidate");
    if(elSearchBtn) elSearchBtn.onclick = applyFilters;
    if(elSearch) elSearch.onkeypress = (e) => { if(e.key === "Enter") applyFilters(); };
    
    ["dept", "practice", "coachLevel", "clusterToggle"].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.onchange = applyFilters;
    });

    // Boutons de Mode
    document.querySelectorAll(".segBtn").forEach(btn => {
        btn.onclick = () => {
            displayMode = btn.dataset.mode;
            document.querySelectorAll(".segBtn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            applyFilters();
        };
    });

    // Gestion Mobile
    const elPanelBtn = document.getElementById("panelBtn");
    const elSidebar = document.querySelector(".sidebar");
    if(elPanelBtn && elSidebar) {
        elPanelBtn.onclick = () => {
            const open = elSidebar.classList.toggle("open");
            document.getElementById("overlay").classList.toggle("show");
            elPanelBtn.textContent = open ? "✖ Fermer" : "📊 Liste & Filtres";
        };
    }

    loadData();
}

// Lancement au chargement du DOM
document.addEventListener("DOMContentLoaded", init);
