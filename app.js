/** 1. CONFIGURATION **/
const MAP_CENTER = [47.35, -1.75];
const MAP_ZOOM = 8;

let map, clustersLayer, plainLayer, clubs = [], filtered = [];
let displayMode = "licences"; 

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
  "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
}[c]));

/** 2. MOTEUR GRAPHIQUE (PIE CHARTS) **/

function pieSvg(pct, color = "#2563eb", size = 40, showText = true) {
    const p = Math.max(0, Math.min(100, Number(pct||0)));
    const r = 22, c = 2 * Math.PI * r;
    const filled = c * (p/100);
    return `
    <svg viewBox="0 0 56 56" width="${size}" height="${size}" style="display:block">
        <circle cx="28" cy="28" r="22" fill="none" stroke="#e2e8f0" stroke-width="9"></circle>
        <circle cx="28" cy="28" r="22" fill="none" stroke="${color}" stroke-width="9"
            stroke-linecap="round" stroke-dasharray="${filled} ${c-filled}" transform="rotate(-90 28 28)"></circle>
        ${showText ? `<text x="28" y="33" text-anchor="middle" font-size="11" font-weight="800" fill="#1e293b">${Math.round(p)}%</text>` : ''}
    </svg>`;
}

/** 3. RENDU DU POPUP ENRICHI **/

function makePopupHtml(c) {
    const listE = c.entraineurs?.length ? c.entraineurs.map(e => `<li>${esc(e.nom)} <span style="color:#64748b">(${esc(e.diplome)})</span></li>`).join("") : "<li><em>Aucun entraîneur</em></li>";
    const listA = c.arbitres?.length ? c.arbitres.map(a => `<li>${esc(a.nom)} <span style="color:#64748b">(${esc(a.niveau)})</span></li>`).join("") : "<li><em>Aucun arbitre</em></li>";
    const listP = c.pratiques?.length ? c.pratiques.map(p => `<span style="display:inline-block; background:#e2e8f0; padding:2px 8px; border-radius:10px; margin:2px; font-size:10px;">${esc(p)}</span>`).join("") : "Non renseigné";

    return `
    <div style="width: 350px; font-family: 'Inter', sans-serif; color: #1e293b;">
        <div style="display:flex; align-items:center; gap:12px; border-bottom:1px solid #eee; padding-bottom:10px; margin-bottom:10px;">
            <img src="${c.logo_url || 'assets/logo_placeholder.svg'}" style="width:50px; height:50px; object-fit:contain;">
            <div style="flex:1; min-width:0;">
                <div style="font-weight:800; font-size:15px; text-transform:uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(c.nom)}</div>
                <div style="font-size:11px; color:#64748b;">${esc(c.ville)} • Prés : ${esc(c.president || 'N/C')}</div>
            </div>
        </div>

        <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:6px; margin-bottom:12px;">
            <div style="background:#eff6ff; padding:8px; border-radius:8px; text-align:center; border:1px solid #dbeafe;">
                <div style="font-size:8px; font-weight:700; color:#1e40af;">LICENCIÉS</div>
                <div style="font-size:14px; font-weight:800; color:#1e40af;">${c.licences_total}</div>
            </div>
            <div style="background:#f0fdf4; padding:8px; border-radius:8px; text-align:center; border:1px solid #dcfce7;">
                <div style="font-size:8px; font-weight:700; color:#166534;">% JEUNES</div>
                <div style="font-size:14px; font-weight:800; color:#166534;">${Math.round(c.pourcentage_jeunes)}%</div>
            </div>
            <div style="background:#fff7ed; padding:8px; border-radius:8px; text-align:center; border:1px solid #ffedd5;">
                <div style="font-size:8px; font-weight:700; color:#9a3412;">J. COMPÉT.</div>
                <div style="font-size:14px; font-weight:800; color:#9a3412;">${Math.round(c.pct_jeunes_competiteurs_18m || 0)}%</div>
            </div>
        </div>

        <div style="margin-bottom:12px;">${listP}</div>

        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px; max-height:150px; overflow-y:auto; font-size:11px;">
            <div style="font-weight:800; text-transform:uppercase; font-size:9px; color:#64748b; border-bottom:1px solid #cbd5e1; padding-bottom:3px; margin-bottom:5px;">🎯 Équipe Technique</div>
            <ul style="margin:0 0 10px 0; padding-left:15px;">${listE}</ul>
            <div style="font-weight:800; text-transform:uppercase; font-size:9px; color:#64748b; border-bottom:1px solid #cbd5e1; padding-bottom:3px; margin-bottom:5px;">⚖️ Corps Arbitral</div>
            <ul style="margin:0; padding-left:15px;">${listA}</ul>
        </div>

        <div style="margin-top:12px; display:flex; justify-content:center; gap:20px; border-top:1px solid #eee; padding-top:10px;">
            <a href="mailto:${esc(c.email)}" style="color:#2563eb; font-weight:bold; text-decoration:none; font-size:12px;">✉ Email</a>
            ${c.site ? `<a href="${esc(c.site)}" target="_blank" style="color:#2563eb; font-weight:bold; text-decoration:none; font-size:12px;">🌐 Site Web</a>` : ''}
        </div>
    </div>`;
}

/** 4. LOGIQUE FILTRES & AFFICHAGE **/

function applyFilters(){
    const q = document.getElementById("search")?.value.toLowerCase().trim() || "";
    const dept = document.getElementById("dept")?.value || "";
    const practice = document.getElementById("practice")?.value || "";
    const coach = document.getElementById("coachLevel")?.value || "";
    const onlyJeunes = document.getElementById("checkJeunes")?.checked;
    const withArbitre = document.getElementById("checkArbitre")?.checked;

    filtered = clubs.filter(c => {
        const okSearch = !q || `${c.nom} ${c.ville} ${c.cp}`.toLowerCase().includes(q);
        const okDept = !dept || c.departement === dept;
        const okPrac = !practice || (c.pratiques && c.pratiques.includes(practice));
        const okCoach = !coach || (c.niveaux_entraineurs && c.niveaux_entraineurs.some(n => n.niveau === coach));
        const okJeunes = !onlyJeunes || (c.pourcentage_jeunes > 0);
        const okArbitre = !withArbitre || (c.arbitres && c.arbitres.length > 0);
        return okSearch && okDept && okPrac && okCoach && okJeunes && okArbitre;
    });
    renderAll();
}

function renderAll(){
    if(!map) return;
    const isClustered = document.getElementById("clusterToggle")?.checked;
    clustersLayer.clearLayers();
    plainLayer.clearLayers();
    
    filtered.forEach(c => {
        let m;
        const color = (displayMode === "femmes") ? "#ec4899" : (displayMode === "para" ? "#10b981" : (displayMode === "jeunes" ? "#3b82f6" : "#2563eb"));
        
        if (displayMode === "licences") {
            // Cercles proportionnels
            const radius = 6 + Math.sqrt(c.licences_total) * 1.8;
            m = L.circleMarker([c.lat, c.lng], { radius, color: "#fff", weight: 2, fillColor: color, fillOpacity: 0.8 });
        } else {
            // Camemberts sur la carte
            const pct = (displayMode === "femmes") ? c.pct_femmes : (displayMode === "para" ? c.pct_para : c.pourcentage_jeunes);
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

    document.getElementById("stats").innerHTML = `<strong>${filtered.length}</strong> clubs affichés`;
}

/** 5. CHARGEMENT **/

async function loadData() {
    try {
        const res = await fetch("./clubs.json");
        const data = await res.json();
        clubs = data.map(c => ({
            ...c, 
            lat: Number(c.lat), lng: Number(c.lon || c.lng),
            licences_total: Number(c.licences_total || 0),
            pourcentage_jeunes: Number(c.pourcentage_jeunes || 0),
            pct_femmes: Number(c.pct_femmes || 0),
            pct_para: Number(c.pct_para || 0),
            pct_jeunes_competiteurs_18m: Number(c.pct_jeunes_competiteurs_18m || 0),
            entraineurs: Array.isArray(c.entraineurs) ? c.entraineurs : [],
            arbitres: Array.isArray(c.arbitres) ? c.arbitres : [],
            pratiques: Array.isArray(c.pratiques) ? c.pratiques : [],
            niveaux_entraineurs: Array.isArray(c.niveaux_entraineurs) ? c.niveaux_entraineurs : []
        }));

        // Remplissage dynamique des filtres
        const elDept = document.getElementById("dept");
        if(elDept) {
            const depts = [...new Set(clubs.map(c => c.departement))].filter(Boolean).sort();
            elDept.innerHTML = `<option value="">Département</option>` + depts.map(d => `<option value="${d}">${d}</option>`).join("");
        }

        const elPrac = document.getElementById("practice");
        if(elPrac) {
            const pracs = [...new Set(clubs.flatMap(c => c.pratiques))].filter(Boolean).sort();
            elPrac.innerHTML = `<option value="">Pratiques</option>` + pracs.map(p => `<option value="${p}">${p}</option>`).join("");
        }

        const elCoach = document.getElementById("coachLevel");
        if(elCoach) {
            const coachs = [...new Set(clubs.flatMap(c => c.niveaux_entraineurs.map(n => n.niveau)))].filter(Boolean).sort();
            elCoach.innerHTML = `<option value="">Diplômes</option>` + coachs.map(l => `<option value="${l}">${l}</option>`).join("");
        }

        applyFilters();
    } catch (e) { console.error(e); }
}

function init() {
    map = L.map("map", { zoomControl: false }).setView(MAP_CENTER, MAP_ZOOM);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png").addTo(map);
    plainLayer = L.layerGroup().addTo(map);
    clustersLayer = L.markerClusterGroup().addTo(map);

    document.getElementById("searchValidate").onclick = applyFilters;
    ["dept", "practice", "coachLevel", "clusterToggle", "checkJeunes", "checkArbitre"].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.onchange = applyFilters;
    });

    document.querySelectorAll(".segBtn").forEach(btn => {
        btn.onclick = () => {
            displayMode = btn.dataset.mode;
            document.querySelectorAll(".segBtn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            applyFilters();
        };
    });

    loadData();
}

document.addEventListener("DOMContentLoaded", init);
