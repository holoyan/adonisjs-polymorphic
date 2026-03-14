import type Configure from '@adonisjs/core/commands/configure'
import { stubsRoot } from './stubs/main.js'

/**
 * Configure hook — runs when the user executes:
 *   node ace configure @holoyan/adonisjs-polymorphic
 *
 * - Registers the service provider in adonisrc.ts
 * - Publishes config/polymorphic.ts
 */
export async function configure(command: Configure) {
  const codemods = await command.createCodemods()

  await codemods.updateRcFile((rcFile) => {
    rcFile.addProvider('@holoyan/adonisjs-polymorphic/provider')
  })

  await codemods.makeUsingStub(stubsRoot, 'config/polymorphic.stub', {})

  command.logger.log('')
  command.logger.log('  Install complete. Next steps:')
  command.logger.log('')
  command.logger.log('  1. Decorate your parent models with @MorphMap:')
  command.logger.log('       @MorphMap(\'posts\') export default class Post extends BaseModel {}')
  command.logger.log('')
  command.logger.log('  2. Register them in config/polymorphic.ts:')
  command.logger.log('       morphModels: [() => import(\'#models/post\')]')
  command.logger.log('')
  command.logger.log('  3. Use @morphOne, @morphMany, @morphTo in your models.')
  command.logger.log('')
}
