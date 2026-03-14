/**
 * lucid-polymorph
 *
 * Polymorphic relations for AdonisJS Lucid 21.x
 * Provides morphOne, morphMany, and morphTo decorators
 */

export { morphOne, morphMany, morphTo } from './decorators.js'
export { MorphOne } from './relations/morph_one/index.js'
export { MorphMany } from './relations/morph_many/index.js'
export { MorphTo } from './relations/morph_to/index.js'
export type { MorphOneOptions, MorphManyOptions, MorphToOptions } from './types.js'