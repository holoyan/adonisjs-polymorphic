import { unique } from '@adonisjs/lucid/utils'
import { MorphBaseQueryBuilder } from '../shared/query_builder.js'
import type { MorphMany } from './index.js'

/**
 * Query builder for morphMany relations.
 * Scopes queries to WHERE morphType = value AND morphId IN (parentIds)
 */
export class MorphManyQueryBuilder extends MorphBaseQueryBuilder {
  constructor(
    builder: any,
    client: any,
    private parent: any,
    public relation: MorphMany
  ) {
    super(builder, relation.relatedModel(), client, (userFn: any) => {
      return ($builder: any) => {
        const subQuery = new MorphManyQueryBuilder($builder, this.client, this.parent, this.relation)
        subQuery.isChildQuery = true
        subQuery.isRelatedPreloadQuery = this.isRelatedPreloadQuery
        userFn(subQuery)
        subQuery.applyWhere()
      }
    })
  }

  profilerData() {
    return {
      type: this.relation.type,
      model: this.relation.model.name,
      relatedModel: this.relation.relatedModel().name,
    }
  }

  getRelationKeys(): string[] {
    return [this.relation.morphIdKey]
  }

  applyConstraints(): void {
    if (this.appliedConstraints) return
    this.appliedConstraints = true

    const queryAction = this.queryAction()

    if (Array.isArray(this.parent)) {
      // Eager loading: WHERE type = 'posts' AND id IN (1, 2, 3)
      const ids = unique(
        this.parent.map((model: any) => {
          const val = model[this.relation.localKey]
          if (val === undefined) {
            throw new Error(
              `Cannot preload "${this.relation.relationName}", value of "${this.relation.model.name}.${this.relation.localKey}" is undefined`
            )
          }
          return val
        })
      )
      this.wrapExisting()
        .where(this.relation.morphTypeColumnName, this.relation.morphValue)
        .whereIn(this.relation.morphIdColumnName, ids)
    } else {
      // Single parent: WHERE type = 'posts' AND id = 5
      const id = this.parent[this.relation.localKey]
      if (id === undefined) {
        throw new Error(
          `Cannot ${queryAction} "${this.relation.relationName}", value of "${this.relation.model.name}.${this.relation.localKey}" is undefined`
        )
      }
      this.wrapExisting()
        .where(this.relation.morphTypeColumnName, this.relation.morphValue)
        .where(this.relation.morphIdColumnName, id)
    }
  }

  clone(): MorphManyQueryBuilder {
    const clonedQuery = new MorphManyQueryBuilder(
      this.knexQuery.clone(),
      this.client,
      this.parent,
      this.relation
    )
    clonedQuery.appliedConstraints = this.appliedConstraints
    clonedQuery.isRelatedPreloadQuery = this.isRelatedPreloadQuery
    ;(this as any).applyQueryFlags(clonedQuery)
    return clonedQuery
  }

  paginate(page: number, perPage: number = 20) {
    if (this.isRelatedPreloadQuery) {
      throw new Error(
        `Cannot paginate relationship "${this.relation.relationName}" during preload`
      )
    }
    this.applyConstraints()
    return super.paginate(page, perPage)
  }

  getGroupLimitQuery(): never {
    throw new Error(
      `Cannot apply groupLimit on a morphMany relationship "(${this.relation.relationName})"`
    )
  }
}