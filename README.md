# Études des amendements pour LexImpact

Diverses études des amendements et projets de lois de l'Assemblée, pour le projet [LexImpact](https://leximpact.an.fr/)

## Utilisation

### Extraction des textes des amendements sous forme de fichier CSV

```bash
npx babel-node --extensions ".ts" --max-old-space-size=4096 src/scripts/extraire_textes_amendements.ts ../../tricoteuses/assemblee-data/ > amendements.csv
```