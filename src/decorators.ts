import { MorphOne } from './relations/morph_one/index.js'
import { MorphMany } from './relations/morph_many/index.js'
import { MorphTo } from './relations/morph_to/index.js'
import type { MorphOneOptions, MorphManyOptions, MorphToOptions } from './types.js'

/**
 * Decorator to define a morphOne (has-one polymorphic) relation on a parent model.
 *
 * @example
 * ```ts
 * class Post extends BaseModel {
 *   @morphOne(() => Image, { name: 'imageable' })
 *   declare image: Image | null
 * }
 * ```
 */
export function morphOne(relatedModelFactory: () => any, options: MorphOneOptions) {
  return function decorateAsMorphOne(target: any, relationName: string) {
    const Model = target.constructor
    Model.boot()
    const relation = new MorphOne(relationName, relatedModelFactory, options, Model)
    Model.$relationsDefinitions.set(relationName, relation)
  }
}

/**
 * Decorator to define a morphMany (has-many polymorphic) relation on a parent model.
 *
 * @example
 * ```ts
 * class Post extends BaseModel {
 *   @morphMany(() => Comment, { name: 'commentable' })
 *   declare comments: Comment[]
 * }
 * ```
 */
export function morphMany(relatedModelFactory: () => any, options: MorphManyOptions) {
  return function decorateAsMorphMany(target: any, relationName: string) {
    const Model = target.constructor
    Model.boot()
    const relation = new MorphMany(relationName, relatedModelFactory, options, Model)
    Model.$relationsDefinitions.set(relationName, relation)
  }
}

/**
 * Decorator to define a morphTo (belongs-to polymorphic) relation on a child model.
 *
 * @example
 * ```ts
 * class Comment extends BaseModel {
 *   @column() declare commentableType: string
 *   @column() declare commentableId: number
 *
 *   @morphTo({ name: 'commentable', morphMap: { posts: () => Post, videos: () => Video } })
 *   declare commentable: Post | Video | null
 * }
 * ```
 */
export function morphTo(options: MorphToOptions) {
  return function decorateAsMorphTo(target: any, relationName: string) {
    const Model = target.constructor
    Model.boot()
    const relation = new MorphTo(relationName, options, Model)
    Model.$relationsDefinitions.set(relationName, relation)
  }
}