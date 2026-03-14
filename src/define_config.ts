export interface PolymorphicConfig {
  /**
   * Model factory functions whose files should be imported at boot time.
   * Each import triggers the @MorphMap decorator, populating the global
   * registry before any query runs.
   *
   * Example:
   *   morphModels: [
   *     () => import('#models/post'),
   *     () => import('#models/video'),
   *   ]
   */
  morphModels?: Array<() => Promise<any>>
}

/**
 * Define the configuration for @holoyan/adonisjs-polymorphic.
 * Use this in config/polymorphic.ts.
 */
export function defineConfig(config: PolymorphicConfig): PolymorphicConfig {
  return config
}
