/**
 * adonisjs-polymorphic
 *
 * Polymorphic relations for AdonisJS Lucid ORM
 * Provides morphOne, morphMany, and morphTo decorators
 */

export { morphOne, morphMany, morphTo } from './decorators.js'
export { defineConfig } from './define_config.js'
export type { PolymorphicConfig } from './define_config.js'
export { MorphOne } from './relations/morph_one/index.js'
export { MorphMany } from './relations/morph_many/index.js'
export { MorphTo } from './relations/morph_to/index.js'
export type { MorphOneOptions, MorphManyOptions, MorphToOptions } from './types.js'

// Re-exported so `node ace configure adonisjs-polymorphic` can find the hook
export { configure } from '../configure.js'
export { stubsRoot } from '../stubs/main.js'