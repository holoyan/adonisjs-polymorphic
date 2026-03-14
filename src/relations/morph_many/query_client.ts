import { managedTransaction } from '@adonisjs/lucid/utils'
import { MorphManyQueryBuilder } from './query_builder.js'
import type { MorphMany } from './index.js'

/**
 * Query client for morphMany - provides read and write methods
 * in scope of the relation.
 */
export class MorphManyQueryClient {
  constructor(
    private relation: MorphMany,
    private parent: any,
    private client: any
  ) {}

  static eagerQuery(client: any, relation: MorphMany, rows: any | any[]) {
    const query = new MorphManyQueryBuilder(client.knexQuery(), client, rows, relation)
    query.isRelatedPreloadQuery = true
    if (typeof relation.onQueryHook === 'function') relation.onQueryHook(query)
    return query
  }

  static subQuery(_client: any, relation: MorphMany): never {
    throw new Error(
      `morphMany: whereHas/withCount is not yet supported for polymorphic relations ("${relation.relationName}")`
    )
  }

  query(): MorphManyQueryBuilder {
    const query = new MorphManyQueryBuilder(
      this.client.knexQuery(),
      this.client,
      this.parent,
      this.relation
    )
    if (typeof this.relation.onQueryHook === 'function') this.relation.onQueryHook(query)
    return query
  }

  /**
   * Saves a single related model instance.
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
   * Saves multiple related model instances.
   */
  async saveMany(related: any[]): Promise<void> {
    await managedTransaction(this.parent.$trx || this.client, async (trx: any) => {
      this.parent.$trx = trx
      await this.parent.save()
      for (const row of related) {
        this.relation.hydrateForPersistance(this.parent, row)
        row.$trx = trx
        await row.save()
      }
    })
  }

  /**
   * Creates a new related model instance.
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
   * Creates multiple related model instances.
   */
  async createMany(values: Record<string, any>[], options?: any): Promise<any[]> {
    return managedTransaction(this.parent.$trx || this.client, async (trx: any) => {
      this.parent.$trx = trx
      await this.parent.save()
      const results: any[] = []
      for (const row of values) {
        const valuesToPersist = { ...row }
        this.relation.hydrateForPersistance(this.parent, valuesToPersist)
        results.push(
          await this.relation.relatedModel().create(valuesToPersist, { client: trx, ...options })
        )
      }
      return results
    })
  }

  /**
   * First or create a related model.
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
   * Update or create a related model.
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