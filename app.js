/** 1. CONFIGURATION **/
const MAP_CENTER = [47.35, -1.75];
const MAP_ZOOM = 8;
const RADIUS_KM = 20; // Rayon de recherche pour la géolocalisation (km)

let map, clustersLayer, plainLayer, clubs = [], filtered = [];
let displayMode = "licences"; // Mode par défaut
let userCoords = null; // Pour stocker la position de l'utilisateur

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
  "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
}[c]));

/** 2. UTILITAIRES DE CALCUL ET GRAPHIQUE **/

// Calcule la distance en km entre deux points GPS (Haverstine)
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Rayon de la Terre en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function pieSvg(pct, color = "#2563eb", size = 40) {
    const p = Math.max(0, Math.min(100, Number(pct||0)));
    const r = 22, c = 2 * Math.PI * r;
    const filled = c * (p/100);
    return `
    <svg viewBox="0 0 56 56" width="${size}" height="${size}" style="display:block">
        <circle cx="28" cy="28" r="22" fill="none" stroke="#e2e8f0" stroke-width="9"></circle>
        <circle cx="28" cy="28" r="22" fill="none" stroke="${color}" stroke-width="9"
            stroke-linecap="round" stroke-dasharray="${filled} ${c-filled}" transform="rotate(-90 28 28)"></circle>
        <text x="28" y="33" text-anchor="middle" font-size="11" font-weight="800" fill="#1e293b">${Math.round(p)}%</text>
    </svg>`;
}

function labelBadge(label) {
    if (!label || label === "Non" || label === "Aucun") return "";
    let fileName = String(label).toLowerCase().replace("label ", "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '_'); 
    return `<img src="assets/label_${fileName}.png" title="${esc(label)}" style="height: 25px; margin-left: 10px; vertical-align: middle;">`;
}

/** 3. RENDU DU POPUP **/
function makePopupHtml(c) {
    const listE = c.entraineurs?.length ? c.entraineurs.map(e => `<li>${esc(e.nom)} <span style="color:#64748b">(${esc(e.diplome)})</span></li>`).join("") : "<li><em>Aucun</em></li>";
    const listA = c.arbitres?.length ? c.arbitres.map(a => `<li>${esc(a.nom)} <span style="color:#64748b">(${esc(a.niveau)})</span></li>`).join("") : "<li><em>Aucun</em></li>";
    const listP = c.pratiques?.length ? c.pratiques.map(p => `<span style="display:inline-block; background:#e2e8f0; padding:2px 8px; border-radius:10px; margin:2px; font-size:10px; font-weight:600;">${esc(p)}</span>`).join("") : "";

    return `
    <div style="width: 360px; font-family: 'Inter', sans-serif; color: #1e293b; padding: 5px;">
        <div style="display:flex; align-items:center; gap:12px; border-bottom:2px solid #f1f5f9; padding-bottom:12px; margin-bottom:12px;">
            <img src="${c.logo_url || 'assets/logo_placeholder.svg'}" style="width:55px; height:55px; object-fit:contain;" onerror="this.src='assets/logo_placeholder.svg'">
            <div style="flex:1;">
                <div style="display:flex; align-items:center; flex-wrap:wrap;">
                    <span style="font-weight:900; font-size:15px; text-transform:uppercase;">${esc(c.nom)}</span>
                    ${labelBadge(c.label_club)}
                </div>
                <div style="font-size:11px; color:#64748b;">${esc(c.ville)} • Prés : <strong>${esc(c.president || 'N/C')}</strong></div>
            </div>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-bottom:15px;">
            <div style="background:#eff6ff; padding:8px; border-radius:10px; text-align:center; border:1px solid #dbeafe;">
                <div style="font-size:8px; font-weight:800; color:#1e40af;">LICENCIÉS</div>
                <div style="font-size:16px; font-weight:900; color:#1e40af;">${c.licences_total}</div>
            </div>
            <div style="background:#fdf2f8; padding:8px; border-radius:10px; text-align:center; border:1px solid #fce7f3;">
                <div style="font-size:8px; font-weight:800; color:#9d174d;">ARCHERS PARA</div>
                <div style="font-size:16px; font-weight:900; color:#9d174d;">${Math.round(c.pct_para || 0)}%</div>
            </div>
            <div style="background:#f0fdf4; padding:8px; border-radius:10px; text-align:center; border:1px solid #dcfce7;">
                <div style="font-size:8px; font-weight:800; color:#166534;">% JEUNES</div>
                <div style="font-size:16px; font-weight:900; color:#166534;">${Math.round(c.pourcentage_jeunes || 0)}%</div>
            </div>
            <div style="background:#fff7ed; padding:8px; border-radius:10px; text-align:center; border:1px solid #ffedd5;">
                <div style="font-size:8px; font-weight:800; color:#9a3412;">JEUNES COMPÉTITEURS</div>
                <div style="font-size:16px; font-weight:900; color:#9a3412;">${Math.round(c.pct_jeunes_competiteurs_18m || 0)}%</div>
            </div>
        </div>
        <div style="margin-bottom:12px;">${listP}</div>
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:10px; font-size:11px; max-height:150px; overflow-y:auto;">
            <div style="font-weight:800; text-transform:uppercase; color:#475569; margin-bottom:5px;">🎯 Technique</div>
            <ul style="margin:0 0 10px 0; padding-left:15px;">${listE}</ul>
            <div style="font-weight:800; text-transform:uppercase; color:#475569; margin-bottom:5px;">⚖️ Arbitres</div>
            <ul style="margin:0; padding-left:15px;">${listA}</ul>
        </div>
        <div style="margin-top:12px; display:flex; justify-content:center; gap:20px; border-top:1px solid #f1f5f9; padding-top:10px;">
            <a href="mailto:${esc(c.email)}" style="color:#002395; font-weight:800; text-decoration:none; font-size:12px;">✉ Mail</a>
            ${c.site ? `<a href="${esc(c.site)}" target="_blank" style="color:#002395; font-weight:800; text-decoration:none; font-size:12px;">🌐 Site</a>` : ''}
        </div>
    </div>`;
}

/** 4. LOGIQUE FILTRES ET DESSIN CARTE **/
function applyFilters(){
    const q = document.getElementById("search").value.toLowerCase().trim();
    const dept = document.getElementById("dept").value;
    const practice = document.getElementById("practice").value;
    const coach = document.getElementById("coachLevel").value;
    const onlyJeunes = document.getElementById("checkJeunes").checked;
    const withArbitre = document.getElementById("checkArbitre").checked;

    filtered = clubs.filter(c => {
        const okSearch = !q || `${c.nom} ${c.ville} ${c.cp}`.toLowerCase().includes(q);
        const okDept = !dept || c.departement === dept;
        const okPrac = !practice || (c.pratiques && c.pratiques.includes(practice));
        const okCoach = !coach || (c.niveaux_entraineurs && c.niveaux_entraineurs.some(n => n.niveau === coach));
        const okJeunes = !onlyJeunes || (c.pourcentage_jeunes > 0);
        const okArbitre = !withArbitre || (c.arbitres && c.arbitres.length > 0);
        
        // CORRECTION GÉOLOCALISATION
        let okDist = true;
        if(userCoords) {
            const d = getDistance(userCoords.lat, userCoords.lng, c.lat, c.lng);
            okDist = d <= RADIUS_KM;
        }

        return okSearch && okDept && okPrac && okCoach && okJeunes && okArbitre && okDist;
    });
    renderAll();
}

function renderAll(){
    if(!map) return;
    const isClustered = document.getElementById("clusterToggle").checked;
    clustersLayer.clearLayers();
    plainLayer.clearLayers();
    
    filtered.forEach(c => {
        let m;
        if (displayMode === "licences") {
            const color = "#002395";
            m = L.circleMarker([c.lat, c.lng], { radius: 8 + Math.sqrt(c.licences_total), color: "#fff", weight: 2, fillColor: color, fillOpacity: 0.8 });
        } else {
            let pct = 0, color = "#2563eb";
            if (displayMode === "femmes") { pct = c.pct_femmes; color = "#ec4899"; }
            else if (displayMode === "para") { pct = c.pct_para; color = "#10b981"; }
            else if (displayMode === "jeunes") { pct = c.pourcentage_jeunes; color = "#3b82f6"; }

            const icon = L.divIcon({
                html: `<div style="transform:translate(-20px,-20px)">${pieSvg(pct, color, 40)}</div>`,
                className: '', iconSize: [40, 40]
            });
            m = L.marker([c.lat, c.lng], { icon });
        }
        m.bindPopup(makePopupHtml(c), { maxWidth: 400 });
        if(isClustered && displayMode === "licences") clustersLayer.addLayer(m);
        else plainLayer.addLayer(m);
    });

    const topClubs = [...filtered].sort((a, b) => b.licences_total - a.licences_total).slice(0, 10);
    document.getElementById("list").innerHTML = topClubs.map(c => `
        <div class="list-item" onclick="map.setView([${c.lat}, ${c.lng}], 15)" style="display:flex; justify-content:space-between; padding:12px; cursor:pointer;">
            <div>
                <div style="font-weight:800; font-size:12px;">${esc(c.nom)}</div>
                <div style="font-size:10px; color:#64748b;">${esc(c.ville)}</div>
            </div>
            <div style="background:#e6e9f5; color:#002395; font-weight:800; padding:4px 8px; border-radius:6px;">${c.licences_total}</div>
        </div>
    `).join("");
    document.getElementById("stats").innerHTML = `<strong>${filtered.length}</strong> clubs affichés ${userCoords ? `(dans un rayon de ${RADIUS_KM}km)` : ''}`;
}

/** 5. INIT ET GÉOLOCALISATION **/

async function loadData() {
    try {
        const res = await fetch("./clubs.json");
        const data = await res.json();
        clubs = data.map((c, i) => ({ 
            ...c, 
            id: c.id || i, 
            lat: Number(c.lat), 
            lng: Number(c.lon || c.lng),
            licences_total: Number(c.licences_total || 0),
            pct_femmes: Number(c.pct_femmes || 0),
            pct_para: Number(c.pct_para || 0),
            pourcentage_jeunes: Number(c.pourcentage_jeunes || 0),
            arbitres: Array.isArray(c.arbitres) ? c.arbitres : [],
            niveaux_entraineurs: Array.isArray(c.niveaux_entraineurs) ? c.niveaux_entraineurs : []
        }));
        
        const depts = [...new Set(clubs.map(c => c.departement))].filter(Boolean).sort();
        document.getElementById("dept").innerHTML = `<option value="">Département</option>` + depts.map(d => `<option value="${d}">${d}</option>`).join("");
        
        const coachLevels = [...new Set(clubs.flatMap(c => c.niveaux_entraineurs.map(n => n.niveau)))].filter(Boolean).sort();
        document.getElementById("coachLevel").innerHTML = `<option value="">Entraîneurs</option>` + coachLevels.map(l => `<option value="${l}">${l}</option>`).join("");

        applyFilters();
    } catch (e) { console.error(e); }
}

async function init() {
    map = L.map("map", { zoomControl: false }).setView(MAP_CENTER, MAP_ZOOM);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png").addTo(map);
    plainLayer = L.layerGroup().addTo(map);
    clustersLayer = L.markerClusterGroup().addTo(map);

    // FIX : BOUTON MOBILE
    const panelBtn = document.getElementById('panelBtn');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('overlay');
    if(panelBtn) panelBtn.onclick = () => { sidebar.classList.toggle('open'); overlay.classList.toggle('show'); };
    if(overlay) overlay.onclick = () => { sidebar.classList.remove('open'); overlay.classList.remove('show'); };

    // FIX : BOUTONS DE MODE
    document.querySelectorAll(".segBtn").forEach(btn => {
        btn.onclick = () => {
            displayMode = btn.dataset.mode;
            document.querySelectorAll(".segBtn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            applyFilters();
        };
    });

    // FIX : ÉCOUTEURS DES FILTRES
    document.getElementById("searchValidate").onclick = applyFilters;
    ["dept", "practice", "coachLevel", "clusterToggle", "checkJeunes", "checkArbitre"].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.onchange = applyFilters;
    });

    // --- MODULE GÉOLOCALISATION ---
    const geoControl = L.control({ position: 'bottomright' });
    geoControl.onAdd = function () {
        const div = L.DomUtil.create('div', 'leaflet-control leaflet-bar L-geo-container');
        div.innerHTML = `<button type="button" class="L-geo-btn" title="Trouver les clubs autour de moi">🎯</button>`;
        div.onclick = function() {
            if (!navigator.geolocation) return alert("Désolé, la géolocalisation n'est pas supportée par votre navigateur.");
            div.classList.add('loading');
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    userCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    
                    // Nettoyer ancienne position et marqueur
                    plainLayer.clearLayers();
                    L.marker([userCoords.lat, userCoords.lng], {
                        icon: L.divIcon({ html:pieSvg(100, '#ef4444', 30), className:'', iconSize:[30,30] })
                    }).bindPopup("<b>Vous êtes ici !</b>").addTo(plainLayer);

                    applyFilters(); // Relance les filtres avec userCoords
                    map.setView([userCoords.lat, userCoords.lng], 13);
                    div.classList.remove('loading');
                },
                (err) => { console.error(err); alert("Impossible de vous localiser. Vérifiez vos autorisations."); div.classList.remove('loading'); }
            );
        };
        return div;
    };
    geoControl.addTo(map);

    await loadData(); // Charge les données après avoir tout initialisé
}

document.addEventListener("DOMContentLoaded", init);
