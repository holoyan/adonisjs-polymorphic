import type { MorphTo } from './index.js'

/**
 * Handles eager loading for morphTo relations.
 *
 * Since different parent rows may belong to completely different model types
 * (e.g., some comments belong to Post, others to Video), a single SQL query
 * cannot cover all cases. This loader:
 *   1. Groups parents by their morph type value
 *   2. Runs one query per unique type against the correct table
 *   3. Tags each result with __morphType and __morphPk in $extras
 *      so setRelatedForMany() can match them back to their parents
 */
export class MorphToEagerLoader {
  isRelatedPreloadQuery = true

  constructor(
    private client: any,
    private relation: MorphTo,
    private parents: any[]
  ) {}

  // The preloader calls these on the object returned by eagerQuery().
  // For MorphTo the underlying query is dynamic, so these are no-ops.
  debug(_flag: boolean): this {
    return this
  }

  sideload(_values: Record<string, any>): this {
    return this
  }

  selectRelationKeys(): this {
    return this
  }

  /**
   * Executes all needed queries and returns a flat list of related model instances.
   * Each instance gets __morphType and __morphPk stored in $extras so that
   * MorphTo.setRelatedForMany() can match it back to the right parent.
   */
  async exec(): Promise<any[]> {
    // Group parent rows by their morph type value
    const groups = new Map<string, any[]>()
    for (const parent of this.parents) {
      const morphType = parent[this.relation.morphTypeKey]
      if (!morphType) continue
      if (!groups.has(morphType)) groups.set(morphType, [])
      groups.get(morphType)!.push(parent)
    }

    const allResults: any[] = []

    for (const [morphType, parentGroup] of groups) {
      const modelFactory = this.relation.morphMap[morphType]
      if (!modelFactory) {
        // Unknown type - skip silently (will result in null on the parent)
        continue
      }

      const RelatedModel = modelFactory()

      // Collect unique IDs for this type
      const ids = [
        ...new Set(
          parentGroup
            .map((p: any) => p[this.relation.morphIdKey])
            .filter((v: any) => v != null)
        ),
      ]

      if (ids.length === 0) continue

      const results = await RelatedModel.query({ client: this.client })
        .whereIn(RelatedModel.primaryKey, ids)
        .exec()

      // Tag each result so we can match it back during setRelatedForMany
      for (const result of results) {
        result.$extras.__morphType = morphType
        result.$extras.__morphPk = result[RelatedModel.primaryKey]
        allResults.push(result)
      }
    }

    return allResults
  }
}