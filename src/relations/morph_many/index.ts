import type { MorphManyOptions } from '../../types.js'
import { MorphManyQueryClient } from './query_client.js'
import { getRegistry } from '../morph_to/registry.js'

/**
 * MorphMany relation - the parent model has many polymorphic children.
 *
 * Example: Post morphMany Comment (commentable)
 *   comments table has: commentable_type = 'posts', commentable_id = post.id
 */
export class MorphMany {
  readonly type = 'hasMany'
  booted = false
  serializeAs: string | null

  onQueryHook: ((query: any) => void) | undefined

  morphTypeKey!: string
  morphTypeColumnName!: string
  morphIdKey!: string
  morphIdColumnName!: string
  localKey!: string
  localKeyColumnName!: string
  morphValue!: string

  constructor(
    public readonly relationName: string,
    public readonly relatedModel: () => any,
    private readonly options: MorphManyOptions,
    public readonly model: any
  ) {
    this.onQueryHook = options.onQuery
    this.serializeAs =
      options.serializeAs === undefined ? relationName : options.serializeAs
  }

  clone(parent: any): MorphMany {
    return new MorphMany(this.relationName, this.relatedModel, { ...this.options }, parent)
  }

  boot(): void {
    if (this.booted) return

    const relatedModel = this.relatedModel()
    const morphName = this.options.name

    const typeAttr = `${morphName}Type`
    const idAttr = `${morphName}Id`

    const typeColDef = relatedModel.$getColumn(typeAttr)
    if (!typeColDef) {
      throw new Error(
        `[MorphMany] "${typeAttr}" column not found on "${relatedModel.name}". ` +
          `Add @column() declare ${typeAttr}: string`
      )
    }
    const idColDef = relatedModel.$getColumn(idAttr)
    if (!idColDef) {
      throw new Error(
        `[MorphMany] "${idAttr}" column not found on "${relatedModel.name}". ` +
          `Add @column() declare ${idAttr}: number`
      )
    }

    this.morphTypeKey = typeAttr
    this.morphTypeColumnName = typeColDef.columnName
    this.morphIdKey = idAttr
    this.morphIdColumnName = idColDef.columnName

    const localKeyAttr = this.options.localKey ?? this.model.primaryKey
    const localColDef = this.model.$getColumn(localKeyAttr)
    if (!localColDef) {
      throw new Error(
        `[MorphMany] "${localKeyAttr}" column not found on "${this.model.name}".`
      )
    }
    this.localKey = localKeyAttr
    this.localKeyColumnName = localColDef.columnName

    // Priority: explicit option → @MorphMap alias → model table name
    if (this.options.morphValue) {
      this.morphValue = this.options.morphValue
    } else {
      const registry = getRegistry()
      const alias = registry?.hasTarget(this.model) ? registry.getAlias(this.model) : null
      this.morphValue = alias ?? this.model.table
    }

    this.booted = true
  }

  setRelated(parent: any, related: any): void {
    parent.$setRelated(this.relationName, related)
  }

  pushRelated(parent: any, related: any): void {
    parent.$pushRelated(this.relationName, related)
  }

  /**
   * Groups and sets related rows on each parent model during eager loading.
   */
  setRelatedForMany(parents: any[], related: any[]): void {
    parents.forEach((parentModel) => {
      const parentId = parentModel[this.localKey]
      const rows = related.filter(
        (r) => parentId !== undefined && r[this.morphIdKey] === parentId
      )
      this.setRelated(parentModel, rows)
    })
  }

  client(parent: any, client: any): MorphManyQueryClient {
    if (!this.booted) this.boot()
    return new MorphManyQueryClient(this, parent, client)
  }

  eagerQuery(parent: any | any[], client: any) {
    if (!this.booted) this.boot()
    return MorphManyQueryClient.eagerQuery(client, this, parent)
  }

  subQuery(client: any): never {
    return MorphManyQueryClient.subQuery(client, this)
  }

  hydrateForPersistance(parent: any, related: any): void {
    related[this.morphTypeKey] = this.morphValue
    related[this.morphIdKey] = parent[this.localKey]
  }
}