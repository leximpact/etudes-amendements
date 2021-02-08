import { Legislature } from "@tricoteuses/assemblee"
import {
  EnabledDatasets,
  loadAssembleeData,
} from "@tricoteuses/assemblee/lib/loaders"
import commandLineArgs from "command-line-args"
// import fs from "fs-extra"
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

const { amendementByUid } = loadAssembleeData(
  options.dataDir,
  EnabledDatasets.Amendements,
  Legislature.Quinze,
)
const amendementsExport: { dispositif?: string; exposeSommaire?: string }[] = []
for (const amendement of Object.values(amendementByUid)) {
  const { corps, cycleDeVie } = amendement
  if (cycleDeVie.etatDesTraitements.etat.libelle !== "Discuté") {
    continue
  }
  const { contenuAuteur } = corps
  if (contenuAuteur === undefined) {
    continue
  }
  amendementsExport.push({
    dispositif: contenuAuteur.dispositif,
    exposeSommaire: contenuAuteur.exposeSommaire,
  })
}
const amendementsCsv = Papa.unparse(amendementsExport)
console.log(amendementsCsv)
