import type { MorphOneOptions } from '../../types.js'
import { MorphOneQueryClient } from './query_client.js'

/**
 * MorphOne relation - the parent model has exactly one polymorphic child.
 *
 * Example: Post morphOne Image (imageable)
 *   images table has: imageable_type = 'posts', imageable_id = post.id
 */
export class MorphOne {
  readonly type = 'hasOne'
  booted = false
  serializeAs: string | null

  /** @internal used by the query hook */
  onQueryHook: ((query: any) => void) | undefined

  /** Attribute name for the morph type column on the related model */
  morphTypeKey!: string
  /** DB column name for the morph type on the related model */
  morphTypeColumnName!: string
  /** Attribute name for the morph id column on the related model */
  morphIdKey!: string
  /** DB column name for the morph id on the related model */
  morphIdColumnName!: string
  /** Attribute name of the local key on the parent model */
  localKey!: string
  /** DB column name of the local key on the parent model */
  localKeyColumnName!: string
  /** Value stored in the morph type column to identify this parent model */
  morphValue!: string

  constructor(
    public readonly relationName: string,
    public readonly relatedModel: () => any,
    private readonly options: MorphOneOptions,
    public readonly model: any
  ) {
    this.onQueryHook = options.onQuery
    this.serializeAs =
      options.serializeAs === undefined ? relationName : options.serializeAs
  }

  clone(parent: any): MorphOne {
    return new MorphOne(this.relationName, this.relatedModel, { ...this.options }, parent)
  }

  /**
   * Boot the relation - validates that all required columns exist and
   * resolves attribute names / column names.
   */
  boot(): void {
    if (this.booted) return

    const relatedModel = this.relatedModel()
    const morphName = this.options.name

    // Derive camelCase attribute names from the morph name
    const typeAttr = `${morphName}Type` // e.g., 'imageableType'
    const idAttr = `${morphName}Id` // e.g., 'imageableId'

    // Resolve column names from related model's @column() definitions
    const typeColDef = relatedModel.$getColumn(typeAttr)
    if (!typeColDef) {
      throw new Error(
        `[MorphOne] "${typeAttr}" column not found on "${relatedModel.name}". ` +
          `Add @column() declare ${typeAttr}: string`
      )
    }
    const idColDef = relatedModel.$getColumn(idAttr)
    if (!idColDef) {
      throw new Error(
        `[MorphOne] "${idAttr}" column not found on "${relatedModel.name}". ` +
          `Add @column() declare ${idAttr}: number`
      )
    }

    this.morphTypeKey = typeAttr
    this.morphTypeColumnName = typeColDef.columnName
    this.morphIdKey = idAttr
    this.morphIdColumnName = idColDef.columnName

    // Resolve local key on parent model
    const localKeyAttr = this.options.localKey ?? this.model.primaryKey
    const localColDef = this.model.$getColumn(localKeyAttr)
    if (!localColDef) {
      throw new Error(
        `[MorphOne] "${localKeyAttr}" column not found on "${this.model.name}".`
      )
    }
    this.localKey = localKeyAttr
    this.localKeyColumnName = localColDef.columnName

    // The value stored in the type column (defaults to parent table name)
    this.morphValue = this.options.morphValue ?? this.model.table

    this.booted = true
  }

  /**
   * Sets the related model instance on the parent (used by the preloader).
   */
  setRelated(parent: any, related: any): void {
    if (related === undefined) return
    parent.$setRelated(this.relationName, related)
  }

  pushRelated(parent: any, related: any): void {
    if (related === undefined) return
    parent.$pushRelated(this.relationName, related)
  }

  /**
   * Matches and sets related models on each parent during eager loading.
   * For morphOne there is at most one related row per parent.
   */
  setRelatedForMany(parents: any[], related: any[]): void {
    parents.forEach((parentModel) => {
      const parentId = parentModel[this.localKey]
      const match = related.find(
        (r) => parentId !== undefined && r[this.morphIdKey] === parentId
      )
      this.setRelated(parentModel, match ?? null)
    })
  }

  /**
   * Returns a query client that can be used from model.related('relation').
   */
  client(parent: any, client: any): MorphOneQueryClient {
    if (!this.booted) this.boot()
    return new MorphOneQueryClient(this, parent, client)
  }

  /**
   * Returns an eager-load query (used by the Lucid preloader).
   */
  eagerQuery(parent: any | any[], client: any) {
    if (!this.booted) this.boot()
    return MorphOneQueryClient.eagerQuery(client, this, parent)
  }

  /**
   * Returns a subquery builder (for whereHas / withCount).
   */
  subQuery(client: any): never {
    return MorphOneQueryClient.subQuery(client, this)
  }

  /**
   * Hydrates the related model / plain object with the morph FK values
   * before persisting. Called by the query client's create/save methods.
   */
  hydrateForPersistance(parent: any, related: any): void {
    related[this.morphTypeKey] = this.morphValue
    related[this.morphIdKey] = parent[this.localKey]
  }
}