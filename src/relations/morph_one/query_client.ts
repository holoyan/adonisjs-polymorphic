import { managedTransaction } from '@adonisjs/lucid/utils'
import { MorphOneQueryBuilder } from './query_builder.js'
import type { MorphOne } from './index.js'

/**
 * Query client for morphOne - provides read and write methods
 * in scope of the relation.
 */
export class MorphOneQueryClient {
  constructor(
    private relation: MorphOne,
    private parent: any,
    private client: any
  ) {}

  /**
   * Creates an eager-load query builder (used by the Lucid preloader).
   */
  static eagerQuery(client: any, relation: MorphOne, rows: any | any[]) {
    const query = new MorphOneQueryBuilder(client.knexQuery(), client, rows, relation)
    query.isRelatedPreloadQuery = true
    if (typeof relation.onQueryHook === 'function') relation.onQueryHook(query)
    return query
  }

  /**
   * Creates a subquery builder (used for whereHas / withCount).
   */
  static subQuery(_client: any, relation: MorphOne): never {
    throw new Error(
      `morphOne: whereHas/withCount is not yet supported for polymorphic relations ("${relation.relationName}")`
    )
  }

  /**
   * Returns a query builder scoped to this relation for ad-hoc queries.
   */
  query(): MorphOneQueryBuilder {
    const query = new MorphOneQueryBuilder(
      this.client.knexQuery(),
      this.client,
      this.parent,
      this.relation
    )
    if (typeof this.relation.onQueryHook === 'function') this.relation.onQueryHook(query)
    return query
  }

  /**
   * Saves an existing related model instance, hydrating the morph FK columns.
   */
  async save(related: any): Promise<void> {
    await managedTransaction(this.parent.$trx || this.client, async (trx: any) => {
      this.parent.$trx = trx
      await this.parent.save()
      this.relation.hydrateForPersistance(this.parent, related)
      related.$trx = trx
      await related.save()
    })
  }

  /**
   * Creates a new related model instance, automatically setting morph FK columns.
   */
  async create(values: Record<string, any>, options?: any): Promise<any> {
    return managedTransaction(this.parent.$trx || this.client, async (trx: any) => {
      this.parent.$trx = trx
      await this.parent.save()
      const valuesToPersist = { ...values }
      this.relation.hydrateForPersistance(this.parent, valuesToPersist)
      return this.relation.relatedModel().create(valuesToPersist, { client: trx, ...options })
    })
  }

  /**
   * Finds the first matching related model or creates a new one.
   */
  async firstOrCreate(
    search: Record<string, any>,
    savePayload?: Record<string, any>,
    options?: any
  ): Promise<any> {
    return managedTransaction(this.parent.$trx || this.client, async (trx: any) => {
      this.parent.$trx = trx
      await this.parent.save()
      const valuesToPersist = { ...search }
      this.relation.hydrateForPersistance(this.parent, valuesToPersist)
      return this.relation
        .relatedModel()
        .firstOrCreate(valuesToPersist, savePayload, { client: trx, ...options })
    })
  }

  /**
   * Updates the existing related model or creates a new one.
   */
  async updateOrCreate(
    search: Record<string, any>,
    updatePayload: Record<string, any>,
    options?: any
  ): Promise<any> {
    return managedTransaction(this.parent.$trx || this.client, async (trx: any) => {
      this.parent.$trx = trx
      await this.parent.save()
      const valuesToPersist = { ...search }
      this.relation.hydrateForPersistance(this.parent, valuesToPersist)
      return this.relation
        .relatedModel()
        .updateOrCreate(valuesToPersist, updatePayload, { client: trx, ...options })
    })
  }
}