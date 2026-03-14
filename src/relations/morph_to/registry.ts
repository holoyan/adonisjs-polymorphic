/**
 * Global morph map registry from @holoyan/morph-map-js.
 *
 * Always available as a direct dependency. Usage is optional —
 * decorate models with @MorphMap('posts') to register them, or
 * keep using the explicit morphMap option on @morphTo instead.
 * If no @MorphMap decorators are used the registry is simply empty.
 */
import { morphMap } from '@holoyan/morph-map-js'

export function getRegistry() {
  return morphMap
}
