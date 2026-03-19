const MAP_CENTER = [47.35, -1.75];
const MAP_ZOOM = 8;
let map, clustersLayer, plainLayer, clubs = [], filtered = [], displayMode = "licences";

// Initialisation
function init() {
    map = L.map("map", { zoomControl: false }).setView(MAP_CENTER, MAP_ZOOM);
    L.control.zoom({ position: 'topright' }).addTo(map);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png").addTo(map);

    plainLayer = L.layerGroup().addTo(map);
    clustersLayer = L.markerClusterGroup().addTo(map);

    // Bouton Localisation
    const btnLoc = document.createElement('button');
    btnLoc.className = 'btn-locate'; btnLoc.innerHTML = '📍';
    document.body.appendChild(btnLoc);
    btnLoc.onclick = () => map.locate({setView: true, maxZoom: 13});
    map.on('locationfound', (e) => L.marker(e.latlng).addTo(map).bindPopup("Vous êtes ici").openPopup());

    // Event listeners
    document.getElementById("searchValidate").onclick = () => { applyFilters(); closeMobile(); };
    document.getElementById("search").onkeypress = (e) => { if(e.key === "Enter") { applyFilters(); closeMobile(); } };
    
    [document.getElementById("dept"), document.getElementById("practice"), document.getElementById("coachLevel")].forEach(el => {
        el.onchange = applyFilters;
    });

    document.querySelectorAll(".segBtn").forEach(btn => {
        btn.onclick = () => {
            displayMode = btn.dataset.mode;
            document.querySelectorAll(".segBtn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            applyFilters();
        };
    });

    // Toggle Mobile
    document.getElementById("panelBtn").onclick = () => {
        const open = document.querySelector(".sidebar").classList.toggle("open");
        document.getElementById("overlay").classList.toggle("show");
        document.getElementById("panelBtn").textContent = open ? "✖ Fermer" : "📊 Liste & Filtres";
    };

    loadData();
}

function closeMobile() {
    document.querySelector(".sidebar").classList.remove("open");
    document.getElementById("overlay").classList.remove("show");
}

function applyFilters() {
    const q = document.getElementById("search").value.toLowerCase().trim();
    const d = document.getElementById("dept").value;
    const p = document.getElementById("practice").value;
    const cL = document.getElementById("coachLevel").value;

    filtered = clubs.filter(c => {
        const matchSearch = !q || `${c.nom} ${c.ville} ${c.cp}`.toLowerCase().includes(q);
        const matchDept = !d || c.departement === d;
        const matchPrac = !p || (c.pratiques && c.pratiques.includes(p));
        const matchCoach = !cL || (c.niveaux_entraineurs && c.niveaux_entraineurs.some(n => n.niveau === cL));
        return matchSearch && matchDept && matchPrac && matchCoach;
    });
    renderAll();
}

async function loadData() {
    const res = await fetch("./clubs.json");
    const data = await res.json();
    clubs = data.map(c => ({
        ...c, lat: Number(c.lat), lng: Number(c.lon || c.lng),
        licences_total: Number(c.licences_total || 0),
        pourcentage_jeunes: Number(c.pourcentage_jeunes || 0)
    }));

    // Remplissage des selects
    const depts = [...new Set(clubs.map(c => c.departement))].filter(Boolean).sort();
    document.getElementById("dept").innerHTML = '<option value="">Département</option>' + depts.map(d => `<option value="${d}">${d}</option>`).join("");
    
    const coachs = [...new Set(clubs.flatMap(c => (c.niveaux_entraineurs || []).map(n => n.niveau)))].filter(Boolean).sort();
    document.getElementById("coachLevel").innerHTML = '<option value="">Tous les diplômes</option>' + coachs.map(l => `<option value="${l}">${l}</option>`).join("");

    applyFilters();
}

// Réutiliser tes fonctions renderMarkers et makePopupHtml ici...
function renderAll() {
    renderMarkers(); 
    document.getElementById("stats").innerHTML = `<strong>${filtered.length}</strong> clubs trouvés`;
}

document.addEventListener("DOMContentLoaded", init);
