import { ModelQueryBuilder } from '@adonisjs/lucid/orm'

/**
 * Shared base for morphOne and morphMany query builders.
 * Extends Lucid's ModelQueryBuilder and adds the boilerplate needed
 * to act as a relation query builder (applyConstraints, selectRelationKeys, etc.)
 */
export abstract class MorphBaseQueryBuilder extends ModelQueryBuilder {
  /**
   * Marks this as a relation eager-load query when set by the query client.
   */
  isRelatedPreloadQuery: boolean = false

  /**
   * Guards against applying constraints more than once.
   */
  protected appliedConstraints: boolean = false

  get isRelatedQuery(): boolean {
    return true
  }

  get isRelatedSubQuery(): boolean {
    return false
  }

  /**
   * Returns the names of the columns that must always be selected
   * so that setRelatedForMany() can match rows to parent models.
   */
  abstract getRelationKeys(): string[]

  /**
   * Returns data used by the query profiler / logger.
   */
  abstract profilerData(): Record<string, any>

  /**
   * Applies the WHERE conditions that scope this query to the relation.
   * Called lazily before exec/toSQL/first.
   */
  abstract applyConstraints(): void

  /**
   * Dis-allow groupLimit. Subclasses may throw.
   */
  abstract getGroupLimitQuery(): any

  /**
   * Reads the currently selected columns from the underlying knex query.
   * Knex stores these in an internal _statements array.
   */
  private getSelectedColumns() {
    return (this.knexQuery as any)['_statements'].find(
      ({ grouping }: { grouping: string }) => grouping === 'columns'
    ) as { value: string[] } | undefined
  }

  /**
   * Ensures that the morph id column is always included in SELECT so that
   * setRelatedForMany() can match rows to parent models.
   */
  selectRelationKeys(): this {
    const columns = this.getSelectedColumns()
    if (!columns) return this

    this.getRelationKeys().forEach((key) => {
      const resolved = (this as any).resolveKey(key)
      if (!columns.value.includes(resolved)) {
        columns.value.push(resolved)
      }
    })

    return this
  }

  /**
   * Returns the current query action string ('select', 'preload', 'update', 'delete').
   * Used only for descriptive error messages.
   */
  protected queryAction(): string {
    const method = (this.knexQuery as any)['_method'] as string | undefined
    if (method === 'del') return 'delete'
    if (method === 'select' && this.isRelatedPreloadQuery) return 'preload'
    return method ?? 'select'
  }

  toSQL() {
    this.applyConstraints()
    return super.toSQL()
  }

  exec() {
    this.applyConstraints()
    return super.exec()
  }

  first() {
    this.applyConstraints()
    return super.first()
  }
}