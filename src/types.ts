/**
 * Options accepted by morphOne and morphMany relations.
 * These are defined on the "parent" model (the one that owns the polymorphic children).
 */
export interface MorphOneOptions {
  /**
   * The morph name prefix used to derive type and id column names on the related model.
   * Example: name: 'imageable' -> attributes 'imageableType' and 'imageableId' on related model
   *          which map to columns 'imageable_type' and 'imageable_id' in the DB
   */
  name: string

  /**
   * The local key attribute on the parent model.
   * Defaults to the parent model's primary key.
   */
  localKey?: string

  /**
   * The value stored in the morph type column to identify this parent model.
   * Defaults to the parent model's table name (e.g., 'posts').
   */
  morphValue?: string

  /**
   * Serialize as key. Set to null to exclude from serialization.
   */
  serializeAs?: string | null

  /**
   * Hook to add custom query constraints to all queries for this relation.
   */
  onQuery?: (query: any) => void

  /**
   * Extra meta data attached to the relation. Not used internally.
   */
  meta?: any
}

/**
 * Options accepted by morphMany. Same as morphOne.
 */
export interface MorphManyOptions extends MorphOneOptions {}

/**
 * Options accepted by morphTo relations.
 * These are defined on the "child" model (the one that holds the type and id columns).
 */
export interface MorphToOptions {
  /**
   * Maps morph type string values to model factories.
   * Example: { posts: () => Post, videos: () => Video }
   */
  morphMap: Record<string, () => any>

  /**
   * The morph name prefix used to derive type and id attribute names on THIS model.
   * Example: name: 'commentable' -> attributes 'commentableType' and 'commentableId'
   * Defaults to the relation name.
   */
  name?: string

  /**
   * Explicit attribute name for the type column on this model.
   * Overrides the name-derived attribute.
   */
  typeKey?: string

  /**
   * Explicit attribute name for the id column on this model.
   * Overrides the name-derived attribute.
   */
  idKey?: string

  /**
   * Serialize as key. Set to null to exclude from serialization.
   */
  serializeAs?: string | null

  /**
   * Hook to add custom query constraints. Note: for MorphTo this is limited
   * since the target model is dynamic.
   */
  onQuery?: (query: any) => void

  /**
   * Extra meta data attached to the relation.
   */
  meta?: any
}