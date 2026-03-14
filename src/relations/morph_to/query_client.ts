import { managedTransaction } from '@adonisjs/lucid/utils'
import type { MorphTo } from './index.js'

/**
 * Query client for morphTo - provides read and write methods
 * for the polymorphic "belongs to" side.
 */
export class MorphToQueryClient {
  constructor(
    private relation: MorphTo,
    private parent: any,
    private client: any
  ) {}

  /**
   * Returns a query builder scoped to the related model.
   * The related model is determined dynamically from the parent's morph type value.
   */
  query(): any {
    const morphType = this.parent[this.relation.morphTypeKey]
    const morphId = this.parent[this.relation.morphIdKey]

    if (!morphType) {
      throw new Error(
        `Cannot query "${this.relation.relationName}": ` +
          `"${this.relation.model.name}.${this.relation.morphTypeKey}" is null or undefined`
      )
    }

    const modelFactory = this.relation.morphMap[morphType]
    if (!modelFactory) {
      throw new Error(
        `[MorphTo] Unknown morph type "${morphType}" for relation "${this.relation.relationName}". ` +
          `Check your morphMap configuration.`
      )
    }

    const RelatedModel = modelFactory()
    return RelatedModel.query({ client: this.client }).where(RelatedModel.primaryKey, morphId)
  }

  /**
   * Associates this model with a related model instance by setting the
   * morph type and morph id columns and saving.
   */
  async associate(related: any): Promise<void> {
    await managedTransaction(this.parent.$trx || this.client, async (trx: any) => {
      const morphType = this.relation.getMorphTypeFor(related.constructor)
      if (!morphType) {
        throw new Error(
          `[MorphTo] Cannot associate: model "${related.constructor.name}" is not in the morphMap ` +
            `for relation "${this.relation.relationName}".`
        )
      }

      this.parent[this.relation.morphTypeKey] = morphType
      this.parent[this.relation.morphIdKey] = related[related.constructor.primaryKey]
      this.parent.$trx = trx
      await this.parent.save()
    })
  }

  /**
   * Dissociates this model from its current related model by nulling out
   * the morph type and morph id columns.
   */
  async dissociate(): Promise<void> {
    await managedTransaction(this.parent.$trx || this.client, async (trx: any) => {
      this.parent[this.relation.morphTypeKey] = null
      this.parent[this.relation.morphIdKey] = null
      this.parent.$trx = trx
      await this.parent.save()
    })
  }
}