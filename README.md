---

# Pour consulter la dernière version du projet, merci de vous rendre sur https://git.leximpact.dev/leximpact/etudes-amendements/

---
![](changement-depot-github-gitlab-illustration-small.png)
---

# Études des amendements pour LexImpact



Diverses études des amendements et projets de lois de l'Assemblée, pour le projet [LexImpact](https://leximpact.an.fr/)

Les données extraites par ces scripts sont généralement mises dans le [dépôt Git des données extraites de l'Assemblée](https://github.com/leximpact/donnees-extraites-assemblee).


## Utilisation

### Extraction des textes des amendements sous forme de fichier CSV

```bash
npx babel-node --extensions ".ts" --max-old-space-size=4096 src/scripts/extraire_textes_amendements_plfss_2020-2021.ts ../../tricoteuses/assemblee-data/ > ../donnees-extraites-assemblee/textes_amendements_plfss_2020-2021.csv
```

### Extraction des références aux articles de lois faites par les amendements sous forme de fichier CSV

Note : Ces script utilisent la bibliothèque [metslesliens](https://www.npmjs.com/package/metslesliens) pour extraire des amendements les références qu'ils font aux articles de lois (et à leurs alinéas).

#### Pour les amendements des PLFSS 2020 et 2021 :

```bash
npx babel-node --extensions ".ts" --max-old-space-size=4096 src/scripts/extraire_references_amendements_plfss_2020-2021.ts ../../tricoteuses/assemblee-data/ > ../donnees-extraites-assemblee/references_amendements_plfss_2020-2021.csv
```

#### Pour les amendements de tous les textes passés en Commission des affaires sociales :

```bash
npx babel-node --extensions ".ts" --max-old-space-size=4096 src/scripts/extraire_references_amendements_affaires_sociales.ts ../../tricoteuses/assemblee-data/ > ../donnees-extraites-assemblee/references_amendements_affaires_sociales.csv
```

### Extraction des références extraites des articles amendés sous forme de fichier CSV

Note : Ces script utilisent la bibliothèque [metslesliens](https://www.npmjs.com/package/metslesliens) pour extraire des articles des projets de lois, les références qu'ils font aux articles de lois (et à leurs alinéas).

#### Pour les PLFSS 2020 et 2021 :

```bash
npx babel-node --extensions ".ts" --max-old-space-size=4096 src/scripts/extraire_references_articles_amendes_plfss_2020-2021.ts ../../tricoteuses/assemblee-data > ../donnees-extraites-assemblee/references_articles_amendes_plfss_2020-2021.csv
```

