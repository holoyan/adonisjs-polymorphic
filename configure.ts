import type Configure from '@adonisjs/core/commands/configure'

/**
 * Configure hook — runs when the user executes:
 *   node ace configure adonisjs-polymorphic
 *
 * Registers the service provider in the application's adonisrc.ts file.
 */
export async function configure(command: Configure) {
  const codemods = await command.createCodemods()

  await codemods.updateRcFile((rcFile) => {
    rcFile.addProvider('adonisjs-polymorphic/provider')
  })

  command.logger.log('  Install complete. You can now use morphOne, morphMany, and morphTo')
  command.logger.log('  decorators in your Lucid models.')
  command.logger.log('')
}
