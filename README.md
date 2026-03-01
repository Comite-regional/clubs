# Carte des clubs – Pays de la Loire (FFTA)

Application web statique (Leaflet) : carte interactive des clubs, popups riches, filtres, statistiques.

## Lancer en local
> Important : ouvrir `index.html` directement (double-clic) peut bloquer le chargement de `data/clubs.json`.
Utilise un serveur local :

### Option 1 — VS Code (Live Server)
- Ouvrir le dossier
- Clic droit `index.html` → **Open with Live Server**

### Option 2 — Python
```bash
python -m http.server 8000
```
Puis ouvrir : `http://localhost:8000/`

## Mettre en ligne (GitHub Pages)
1. Déposer le contenu du dossier sur un dépôt GitHub
2. Settings → Pages → Branch: `main` / folder `/root`
3. L’URL publique est générée automatiquement

## Données
- `data/clubs.json` : toutes les informations clubs (géoloc + stats + diplômes + labels + pratiques)
- `assets/` : badges labels
- `logos/` : logos clubs (optionnel)

## Modes d’affichage
- **Licenciés** : taille des points
- **% Femmes / % Para / % Jeunes compétiteurs 18m** : couleur des points
- Clustering automatique pour lisibilité (dézooms)
