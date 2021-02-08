import {
  ActeLegislatif,
  AvantAApres,
  DossierParlementaire,
  Legislature,
  TypeActeLegislatif,
} from "@tricoteuses/assemblee"
import {
  EnabledDatasets,
  loadAssembleeData,
} from "@tricoteuses/assemblee/lib/loaders"
import assert from "assert"
import commandLineArgs from "command-line-args"
import { parse } from "node-html-parser"
import Papa from "papaparse"

const optionsDefinitions = [
  {
    defaultOption: true,
    help: "directory containing Assemblée open data files",
    name: "dataDir",
    type: String,
  },
]
const options = commandLineArgs(optionsDefinitions)

function* iterActes(
  actes: ActeLegislatif[],
): Generator<ActeLegislatif, void, void> {
  for (const acte of actes) {
    yield acte
    if (acte.actesLegislatifs !== undefined) {
      for (const childActe of iterActes(acte.actesLegislatifs)) {
        yield childActe
      }
    }
  }
}

function* iterDocumentsLegislatifsUid(
  dossier: DossierParlementaire,
): Generator<string, void, void> {
  for (const acte of iterActes(dossier.actesLegislatifs)) {
    if (acte.texteAdopteRef !== undefined) {
      yield acte.texteAdopteRef
    }
    if (acte.texteAssocieRef !== undefined) {
      if (
        [
          TypeActeLegislatif.DepotInitiativeNavetteType,
          TypeActeLegislatif.DepotInitiativeType,
        ].includes(acte.xsiType)
      ) {
        yield acte.texteAssocieRef
      } else if (
        ![
          TypeActeLegislatif.EtudeImpactType,
          TypeActeLegislatif.DepotRapportType,
        ].includes(acte.xsiType)
      ) {
        if (!options.silent) {
          console.warn(
            `Dans le dossier législatif ${dossier.uid}, le texte associé ${acte.texteAssocieRef} est ignoré, car l'acte est du type "${acte.xsiType}", qui n'est pas supporté.`,
          )
        }
      }
    }
  }
}

async function main() {
  const { dossierParlementaireByUid } = loadAssembleeData(
    options.dataDir,
    EnabledDatasets.DossiersLegislatifs,
    Legislature.Quinze,
  )
  const documentsLegislatifsUid = new Set<string>()
  for (const dossierUid of [
    "DLR5L15N37831", // PLFSS 2020
    "DLR5L15N40633", // PLFSS 2021
  ]) {
    const dossier = dossierParlementaireByUid[dossierUid]
    assert.notStrictEqual(dossier, undefined)
    for (const documentLegislatifUid of iterDocumentsLegislatifsUid(dossier!)) {
      documentsLegislatifsUid.add(documentLegislatifUid)
    }
  }

  const { amendementByUid } = loadAssembleeData(
    options.dataDir,
    EnabledDatasets.Amendements,
    Legislature.Quinze,
  )
  const amendementsExport: {
    dispositif?: string
    exposeSommaire?: string
    texteLegislatifUid: string
    uid: string
  }[] = []
  for (const amendement of Object.values(amendementByUid)) {
    const {
      corps,
      cycleDeVie,
      pointeurFragmentTexte,
      texteLegislatifRef,
      uid,
    } = amendement
    if (!documentsLegislatifsUid.has(texteLegislatifRef)) {
      continue
    }
    if (
      ![AvantAApres.Avant, AvantAApres.Apres].includes(
        pointeurFragmentTexte.division.avantAApres,
      )
    ) {
      continue
    }
    if (cycleDeVie.etatDesTraitements.etat.libelle !== "Discuté") {
      continue
    }
    const { contenuAuteur } = corps
    if (contenuAuteur === undefined) {
      continue
    }
    amendementsExport.push({
      texteLegislatifUid: texteLegislatifRef,
      uid,
      dispositif:
        contenuAuteur.dispositif === undefined
          ? undefined
          : parse(contenuAuteur.dispositif).text,
      exposeSommaire:
        contenuAuteur.exposeSommaire === undefined
          ? undefined
          : parse(contenuAuteur.exposeSommaire).text,
    })
  }
  const amendementsCsv = Papa.unparse(amendementsExport)
  console.log(amendementsCsv)
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
