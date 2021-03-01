import {
  ActeLegislatif,
  AvantAApres,
  DossierParlementaire,
  Legislature,
  Node,
  NodeType,
  parseTexteMarkdown,
  stringifyTree,
  TypeActeLegislatif,
} from "@tricoteuses/assemblee"
import {
  EnabledDatasets,
  loadAssembleeData,
} from "@tricoteuses/assemblee/lib/loaders"
import assert from "assert"
import commandLineArgs from "command-line-args"
import fetch from "node-fetch"
import metslesliens, {
  Reference,
  ReferenceAtomic,
  ReferenceType,
} from "metslesliens"
import Papa from "papaparse"
import TurndownService from "turndown"

const optionsDefinitions = [
  {
    defaultOption: true,
    help: "directory containing Assemblée open data files",
    name: "dataDir",
    type: String,
  },
]
const options = commandLineArgs(optionsDefinitions)
const turndownService = new TurndownService({
  blankReplacement: function (content: string) {
    return content
  },
})

function indexedName(name: string, index: number) {
  return index === 0 ? name : name + index.toString()
}

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
  for (const acte of iterActes(dossier.actesLegislatifs ?? [])) {
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

function* iterNodes(nodes: Node[]): Generator<Node, void, void> {
  for (const node of nodes) {
    yield node
    if (node.children !== undefined) {
      yield* iterNodes(node.children)
    }
  }
}

async function main() {
  const {
    amendementByUid,
    documentByUid,
    dossierParlementaireByUid,
  } = loadAssembleeData(
    options.dataDir,
    EnabledDatasets.Amendements | EnabledDatasets.DossiersLegislatifs,
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

  const infosAmendementByTitreArticleByDocumentUid = new Map<
    string,
    Map<
      string,
      {
        amendementsMoins10Signataires: number
        amendementsPlus10Signataires: number
      }
    >
  >()
  for (const amendement of Object.values(amendementByUid)) {
    const {
      cycleDeVie,
      pointeurFragmentTexte,
      signataires,
      texteLegislatifRef,
    } = amendement
    if (!documentsLegislatifsUid.has(texteLegislatifRef)) {
      continue
    }
    if (cycleDeVie.etatDesTraitements.etat.libelle !== "Discuté") {
      continue
    }
    if (pointeurFragmentTexte.division.avantAApres !== AvantAApres.A) {
      continue
    }
    let infosAmendementByTitreArticle = infosAmendementByTitreArticleByDocumentUid.get(
      texteLegislatifRef,
    )
    if (infosAmendementByTitreArticle === undefined) {
      infosAmendementByTitreArticle = new Map()
      infosAmendementByTitreArticleByDocumentUid.set(
        texteLegislatifRef,
        infosAmendementByTitreArticle,
      )
    }
    const titreArticle = pointeurFragmentTexte.division.titre.toLocaleUpperCase()
    let infosAmendement = infosAmendementByTitreArticle.get(titreArticle)
    if (infosAmendement === undefined) {
      infosAmendement = {
        amendementsMoins10Signataires: 0,
        amendementsPlus10Signataires: 0,
      }
      infosAmendementByTitreArticle.set(titreArticle, infosAmendement)
    }
    if (
      signataires.cosignatairesRefs !== undefined &&
      signataires.cosignatairesRefs.length >= 9
    ) {
      infosAmendement.amendementsPlus10Signataires++
    } else {
      infosAmendement.amendementsMoins10Signataires++
    }
  }

  const rows = []
  const columns = new Set<string>([
    "amendementsMoins10Signataires",
    "amendementsPlus10Signataires",
    "text",
    "texteLegislatif",
    "texteLegislatifArticle",
    "year",
  ])
  for (const documentUid of documentsLegislatifsUid) {
    const document = documentByUid[documentUid]!
    assert.notStrictEqual(document, undefined)
    const infosAmendementByTitreArticle = infosAmendementByTitreArticleByDocumentUid.get(
      documentUid,
    )
    if (infosAmendementByTitreArticle === undefined) {
      // Document has no amendment => Ignore it.
      continue
    }

    if (documentUid.substr(4, 2) === "SN") {
      continue
    }
    // Note: Both URLs should work.
    // const documentUrl = `https://www.assemblee-nationale.fr/dyn/docs/${documentUid}.raw`
    const documentUrl = `https://www.assemblee-nationale.fr/dyn/opendata/${documentUid}.html`
    const response = await fetch(documentUrl)
    if (response.status === 404) {
      console.log(`${documentUrl}: ${response.status} ${response.statusText}`)
      continue
    }
    assert(
      response.ok,
      `${documentUrl}: ${response.status} ${response.statusText}`,
    )
    const documentHtml = await response.text()
    const documentMarkdown = turndownService
      .turndown(documentHtml)
      // Replace non-breaking Hyphen with normal hyphen.
      .replace(/\u{2011}/gu, "-")
      .replace(/!\[\]\(data:image\/png\;base64,.*?\)/g, "")
    const documentNodes = parseTexteMarkdown(documentMarkdown, [
      document.titres.titrePrincipal,
    ])
    for (const node of iterNodes(documentNodes)) {
      if (node.type === NodeType.ARTICLE) {
        const articleMarkdown = stringifyTree(node)
          // Replace multiple spaces with a single space.
          .replace(/ {2,}/g, " ")
          // Replace sequences of more than 2 \n with exactly 2 \n.
          .replace(/\n{3,}/g, "\n\n")
          // Remove leading line breaks.
          .replace(/^\n+/, "")
          // Remove trailing line breaks.
          .replace(/\n{2,}$/, "")
        // console.log("====================================================================")
        // console.log(JSON.stringify(node, null, 2))
        // console.log(articleMarkdown)
        const titreArticle = node.headers[0]!.toUpperCase()
        const infosAmendement = infosAmendementByTitreArticle.get(titreArticle)
        if (infosAmendement === undefined) {
          // Article has no amendment => Ignore it.
          continue
        }

        const links = metslesliens.getLinks(articleMarkdown)
        for (const link of links) {
          for (const flattenedReferences of iterFlattenedReferences(
            link.tree,
          )) {
            const countByType = new Map<ReferenceType, number>()
            const row: { [name: string]: Reference | string | undefined } = {
              amendementsMoins10Signataires: infosAmendement.amendementsMoins10Signataires.toString(),
              amendementsPlus10Signataires: infosAmendement.amendementsPlus10Signataires.toString(),
              text: link.text,
              texteLegislatif: document.titres.titrePrincipalCourt,
              texteLegislatifArticle: titreArticle,
              year: document.cycleDeVie.chrono.dateDepot
                ?.getFullYear()
                .toString(),
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
    }
    continue
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
