import { unique } from '@adonisjs/lucid/utils'
import { MorphBaseQueryBuilder } from '../shared/query_builder.js'
import type { MorphOne } from './index.js'

/**
 * Query builder for morphOne relations.
 * Scopes queries to WHERE morphType = value AND morphId = parentId LIMIT 1
 */
export class MorphOneQueryBuilder extends MorphBaseQueryBuilder {
  constructor(
    builder: any,
    client: any,
    private parent: any,
    public relation: MorphOne
  ) {
    super(builder, relation.relatedModel(), client, (userFn: any) => {
      return ($builder: any) => {
        const subQuery = new MorphOneQueryBuilder($builder, this.client, this.parent, this.relation)
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
      // Single query: WHERE type = 'posts' AND id = 5 LIMIT 1
      const id = this.parent[this.relation.localKey]
      if (id === undefined) {
        throw new Error(
          `Cannot ${queryAction} "${this.relation.relationName}", value of "${this.relation.model.name}.${this.relation.localKey}" is undefined`
        )
      }
      this.wrapExisting()
        .where(this.relation.morphTypeColumnName, this.relation.morphValue)
        .where(this.relation.morphIdColumnName, id)

      if (!['update', 'delete'].includes(queryAction)) {
        this.limit(1)
      }
    }
  }

  clone(): MorphOneQueryBuilder {
    const clonedQuery = new MorphOneQueryBuilder(
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

  paginate(): never {
    throw new Error(
      `Cannot paginate a morphOne relationship "(${this.relation.relationName})"`
    )
  }

  getGroupLimitQuery(): never {
    throw new Error(
      `Cannot apply groupLimit on a morphOne relationship "(${this.relation.relationName})"`
    )
  }
}