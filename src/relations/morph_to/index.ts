import type { MorphToOptions } from '../../types.js'
import { MorphToEagerLoader } from './eager_loader.js'
import { MorphToQueryClient } from './query_client.js'

/**
 * MorphTo relation - the child model belongs to one of many possible parent types.
 *
 * Example: Comment morphTo Post | Video (commentable)
 *   comments table has: commentable_type = 'posts'|'videos', commentable_id = parent.id
 */
export class MorphTo {
  /**
   * Use 'belongsTo' so the Lucid preloader handles single-parent eager loading
   * correctly (passes result[0] instead of full array).
   */
  readonly type = 'belongsTo'
  booted = false
  serializeAs: string | null

  onQueryHook: ((query: any) => void) | undefined

  /** Map of morph type strings to model factories */
  morphMap: Record<string, () => any>

  /** Attribute name for the type column on THIS (child) model */
  morphTypeKey!: string
  /** DB column name for the type column */
  morphTypeColumnName!: string
  /** Attribute name for the id column on THIS (child) model */
  morphIdKey!: string
  /** DB column name for the id column */
  morphIdColumnName!: string

  /** Reverse map: model table name -> morph type string (built at boot) */
  private reverseMorphMap: Map<any, string> = new Map()

  constructor(
    public readonly relationName: string,
    private readonly options: MorphToOptions,
    public readonly model: any
  ) {
    this.onQueryHook = options.onQuery
    this.morphMap = options.morphMap
    this.serializeAs =
      options.serializeAs === undefined ? relationName : options.serializeAs
  }

  /**
   * morphTo doesn't have a single relatedModel() since the type is dynamic.
   * This is a placeholder used for compatibility with some Lucid internals.
   */
  relatedModel(): never {
    throw new Error(
      `[MorphTo] relatedModel() cannot be called on a morphTo relation. ` +
        `The related model is determined at runtime from the morph type value.`
    )
  }

  clone(parent: any): MorphTo {
    return new MorphTo(this.relationName, { ...this.options }, parent)
  }

  boot(): void {
    if (this.booted) return

    // Derive attribute names from name option or explicit typeKey/idKey
    const name = this.options.name ?? this.relationName
    const typeAttr = this.options.typeKey ?? `${name}Type`
    const idAttr = this.options.idKey ?? `${name}Id`

    const typeColDef = this.model.$getColumn(typeAttr)
    if (!typeColDef) {
      throw new Error(
        `[MorphTo] "${typeAttr}" column not found on "${this.model.name}". ` +
          `Add @column() declare ${typeAttr}: string`
      )
    }
    const idColDef = this.model.$getColumn(idAttr)
    if (!idColDef) {
      throw new Error(
        `[MorphTo] "${idAttr}" column not found on "${this.model.name}". ` +
          `Add @column() declare ${idAttr}: number`
      )
    }

    this.morphTypeKey = typeAttr
    this.morphTypeColumnName = typeColDef.columnName
    this.morphIdKey = idAttr
    this.morphIdColumnName = idColDef.columnName

    // Build the reverse map for associate(): ModelClass -> type string
    for (const [morphType, factory] of Object.entries(this.morphMap)) {
      const ModelClass = factory()
      this.reverseMorphMap.set(ModelClass, morphType)
    }

    this.booted = true
  }

  /**
   * Looks up the morph type string for a given model class.
   * Used by MorphToQueryClient.associate().
   */
  getMorphTypeFor(ModelClass: any): string | undefined {
    return this.reverseMorphMap.get(ModelClass)
  }

  setRelated(parent: any, related: any): void {
    if (related === undefined) return
    parent.$setRelated(this.relationName, related)
  }

  pushRelated(parent: any, related: any): void {
    if (related === undefined) return
    parent.$setRelated(this.relationName, related)
  }

  /**
   * Matches and sets related models on each parent during eager loading.
   * Uses __morphType and __morphPk stored in $extras by MorphToEagerLoader.exec().
   */
  setRelatedForMany(parents: any[], related: any[]): void {
    parents.forEach((parentModel) => {
      const morphType = parentModel[this.morphTypeKey]
      const morphId = parentModel[this.morphIdKey]

      if (!morphType || morphId == null) {
        this.setRelated(parentModel, null)
        return
      }

      const match = related.find(
        (r) =>
          r.$extras.__morphType === morphType &&
          // Use loose comparison to handle number/string mismatch
          // eslint-disable-next-line eqeqeq
          r.$extras.__morphPk == morphId
      )

      this.setRelated(parentModel, match ?? null)
    })
  }

  client(parent: any, client: any): MorphToQueryClient {
    if (!this.booted) this.boot()
    return new MorphToQueryClient(this, parent, client)
  }

  /**
   * Returns the eager loader (used by the Lucid preloader).
   * For a single parent, wrap it in an array for unified handling.
   */
  eagerQuery(parent: any | any[], client: any): MorphToEagerLoader {
    if (!this.booted) this.boot()
    const parents = Array.isArray(parent) ? parent : [parent]
    return new MorphToEagerLoader(client, this, parents)
  }

  /**
   * MorphTo subqueries are not supported.
   */
  subQuery(_client: any): never {
    throw new Error(
      `morphTo: whereHas/withCount is not yet supported for polymorphic relations ("${this.relationName}")`
    )
  }

  /**
   * MorphTo does not hydrate for persistence (the child model owns the FK columns
   * and they are set via associate() or directly by the user).
   */
  hydrateForPersistance(_parent: any, _related: any): void {
    // No-op: for morphTo the child model holds the FK, not the parent
  }
}