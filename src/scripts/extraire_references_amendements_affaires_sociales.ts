import { Legislature } from "@tricoteuses/assemblee"
import {
  EnabledDatasets,
  loadAssembleeData,
} from "@tricoteuses/assemblee/lib/loaders"
import assert from "assert"
import commandLineArgs from "command-line-args"
import metslesliens, {
  Reference,
  ReferenceAtomic,
  ReferenceType,
} from "metslesliens"
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

function indexedName(name: string, index: number) {
  return index === 0 ? name : name + index.toString()
}

function* iterFlattenedReferences(
  reference: Reference,
  flattenedReferences: Array<ReferenceAtomic> = [],
): Generator<Array<ReferenceAtomic>, void, void> {
  switch (reference.type) {
    case ReferenceType.BoundedIntervalReference:
      yield* iterFlattenedReferences(reference.first, flattenedReferences)
      yield* iterFlattenedReferences(reference.last, flattenedReferences)
      break
    case ReferenceType.CountedIntervalReference:
      yield* iterFlattenedReferences(reference.first, flattenedReferences)
      break
    case ReferenceType.EnumerationReference:
      yield* iterFlattenedReferences(reference.left, flattenedReferences)
      yield* iterFlattenedReferences(reference.right, flattenedReferences)
      break
    default:
      if (reference.child == null) {
        yield [...flattenedReferences, reference]
      } else {
        yield* iterFlattenedReferences(reference.child, [
          ...flattenedReferences,
          reference,
        ])
      }
  }
}

async function main() {
  const { acteurByUid, amendementByUid, documentByUid, organeByUid } = loadAssembleeData(
    options.dataDir,
    EnabledDatasets.ActeursEtOrganes | EnabledDatasets.Amendements | EnabledDatasets.DossiersLegislatifs,
    Legislature.Quinze,
  )

  const rows = []
  const columns = new Set<string>([
    "auteur",
    "auteurType",
    "groupePolitique",
    "sort",
    "text",
    "texteLegislatifUid",
    "uid",
    "year",
  ])
  for (const amendement of Object.values(amendementByUid)) {
    const { corps, cycleDeVie, signataires, texteLegislatifRef, uid } = amendement
    const { auteur } = signataires
    const acteur = auteur.acteurRef === undefined ? undefined : acteurByUid[auteur.acteurRef]
    const ident = acteur?.etatCivil.ident
    const document = documentByUid[texteLegislatifRef]
    if (document === undefined) {
      continue
    }
    let textePresenteEnCommissionAffaireSociales = false
    for (const { organeRef } of document.depotAmendements
      ?.amendementsCommission ?? []) {
      if (organeRef === "PO420120") {
        // Commission des affaires sociales
        textePresenteEnCommissionAffaireSociales = true
        break
      }
    }
    if (!textePresenteEnCommissionAffaireSociales) {
      continue
    }
    if (cycleDeVie.etatDesTraitements.etat.libelle !== "Discuté") {
      continue
    }
    const { contenuAuteur } = corps
    if (contenuAuteur === undefined) {
      continue
    }
    if (contenuAuteur.dispositif === undefined) {
      continue
    }

    const dispositif = parse(contenuAuteur.dispositif).text
    const links = metslesliens.getLinks(dispositif)

    for (const link of links) {
      for (const flattenedReferences of iterFlattenedReferences(link.tree)) {
        const countByType = new Map<ReferenceType, number>()
        const row: { [name: string]: Reference | string | undefined } = {
          auteur: ident === undefined ? undefined : `${ident.nom} ${ident.prenom}`,
          auteurType: auteur.typeAuteur,
          groupePolitique: auteur.groupePolitiqueRef === undefined ? undefined : organeByUid[auteur.groupePolitiqueRef]?.libelleAbrege,
          sort: cycleDeVie.sort,
          text: link.text,
          texteLegislatifUid: texteLegislatifRef,
          uid,
          year: cycleDeVie.dateSort?.getFullYear().toString(),
        }
        for (const reference of flattenedReferences) {
          assert(reference.type.endsWith("-reference"))
          const index = countByType.get(reference.type) ?? 0
          const name = indexedName(
            reference.type.substring(
              0,
              reference.type.length - "-reference".length,
            ),
            index,
          )

          const valueFragments: Array<string> = []
          if (reference.id != null) {
            valueFragments.push(reference.id.toString())
          }
          const indirect = reference.indirect
          if (indirect != null) {
            valueFragments.push(
              `indirect: ${
                typeof indirect === "number"
                  ? indirect
                  : `(relative: ${indirect.relative})`
              }`,
            )
          }
          switch (reference.type) {
            case ReferenceType.LawReference:
              if (reference.lawDate != null) {
                valueFragments.push(`du ${reference.lawDate}`)
              }
              break
          }
          const order = reference.order
          if (order != null) {
            valueFragments.push(`order: ${order}`)
          }

          columns.add(name)
          row[name] = valueFragments.join(" ")

          switch (reference.type) {
            case ReferenceType.LawReference: {
              const lawTypeName = indexedName("lawType", index)
              columns.add(lawTypeName)
              row[lawTypeName] = reference.lawType
              break
            }
          }

          const count = index + 1
          countByType.set(reference.type, count)
        }
        rows.push(row)
      }
    }
  }
  const csv = Papa.unparse(rows, { columns: [...columns].sort() })
  console.log(csv)
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
