import type { ApplicationService } from '@adonisjs/core/types'

/**
 * Service provider for adonisjs-polymorphic.
 *
 * Registers the package with the AdonisJS application lifecycle.
 * The decorators (morphOne, morphMany, morphTo) work standalone —
 * this provider exists as the standard AdonisJS extension point for
 * future hooks or container bindings.
 */
export default class PolymorphicProvider {
  constructor(protected app: ApplicationService) {}

  register() {}

  async boot() {}
}
