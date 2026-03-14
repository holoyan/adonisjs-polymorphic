import type { ApplicationService } from '@adonisjs/core/types'
import type { PolymorphicConfig } from '../src/define_config.js'

/**
 * Service provider for adonisjs-polymorphic.
 *
 * During boot, imports every model listed in config/polymorphic.ts so that
 * @MorphMap decorators run and the global registry is fully populated before
 * any request, command, or test query executes.
 */
export default class PolymorphicProvider {
  constructor(protected app: ApplicationService) {}

  register() {}

  async boot() {
    const config = this.app.config.get<PolymorphicConfig>('polymorphic', {})

    if (config.morphModels?.length) {
      await Promise.all(config.morphModels.map((factory) => factory()))
    }
  }
}
