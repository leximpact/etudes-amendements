// import { strictAudit } from "@auditors/core"
// import { auditLinks } from "@auditors/metslesliens"
import assert from "assert"
import commandLineArgs from "command-line-args"
import fs from "fs-extra"
import metslesliens, {
  Reference,
  ReferenceAtomic,
  ReferenceType,
} from "metslesliens"
import Papa from "papaparse"

const optionsDefinitions = [
  {
    defaultOption: true,
    help: "path of file to parse",
    name: "document",
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
  const markdown = await fs.readFile(options.document, "utf-8")

  const links = metslesliens.getLinks(markdown)
  // const [links, linksError] = auditLinks(
  //   strictAudit,
  //   metslesliens.getLinks(markdown),
  // )
  // if (linksError !== null) {
  //   for (const [linkIndex, linkError] of Object.entries(linksError)) {
  //     console.error(
  //       `Error while validating links: ${JSON.stringify(
  //         linkError,
  //         null,
  //         2,
  //       )}\nin: ${JSON.stringify(links[linkIndex], null, 2)}`,
  //     )
  //   }
  //   process.exit(1)
  // }

  const rows = []
  const columns = new Set<string>(["text"])
  for (const link of links) {
    for (const flattenedReferences of iterFlattenedReferences(link.tree)) {
      const countByType = new Map<ReferenceType, number>()
      const row: { [name: string]: Reference | string } = { text: link.text }
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
