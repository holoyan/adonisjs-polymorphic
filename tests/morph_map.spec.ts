/**
 * Tests for @MorphMap integration (global registry from @holoyan/morph-map-js).
 *
 * These models use @MorphMap instead of explicit morphMap on @morphTo,
 * and verify that morphOne/morphMany pick up the registered alias as morphValue.
 *
 * Table names differ from aliases intentionally so tests prove the registry
 * is consulted, not model.table.
 *   articles table  →  @MorphMap('article')   alias: 'article'
 *   clips table     →  @MorphMap('clip')       alias: 'clip'
 *   reactions table →  reactable_type / reactable_id
 */
import { test } from '@japa/runner'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { MorphMap } from '@holoyan/morph-map-js'
import { morphOne, morphMany, morphTo } from '../src/index.js'
import { setupDatabase, closeDatabase, schema } from './helpers/db.js'

// ── Models ────────────────────────────────────────────────────────────────────

@MorphMap('article')
class Article extends BaseModel {
  static table = 'articles'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare title: string

  @morphOne(() => Reaction, { name: 'reactable' })
  declare reaction: Reaction | null

  @morphMany(() => Reaction, { name: 'reactable' })
  declare reactions: Reaction[]
}

@MorphMap('clip')
class Clip extends BaseModel {
  static table = 'clips'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare title: string

  @morphOne(() => Reaction, { name: 'reactable' })
  declare reaction: Reaction | null

  @morphMany(() => Reaction, { name: 'reactable' })
  declare reactions: Reaction[]
}

class Reaction extends BaseModel {
  static table = 'reactions'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare emoji: string

  @column()
  declare reactableType: string

  @column()
  declare reactableId: number

  // No morphMap option — relies entirely on global registry
  @morphTo({ name: 'reactable' })
  declare reactable: Article | Clip | null
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.group('MorphMap registry integration', (group) => {
  group.setup(async () => {
    setupDatabase()

    await schema().createTableIfNotExists('articles', (t) => {
      t.increments('id')
      t.string('title').notNullable()
    })
    await schema().createTableIfNotExists('clips', (t) => {
      t.increments('id')
      t.string('title').notNullable()
    })
    await schema().createTableIfNotExists('reactions', (t) => {
      t.increments('id')
      t.string('emoji').notNullable()
      t.string('reactable_type').nullable()
      t.integer('reactable_id').nullable()
    })
  })

  group.teardown(async () => {
    await schema().dropTableIfExists('reactions')
    await schema().dropTableIfExists('articles')
    await schema().dropTableIfExists('clips')
    await closeDatabase()
  })

  group.each.teardown(async () => {
    await Reaction.query().delete()
    await Article.query().delete()
    await Clip.query().delete()
  })

  // ─── morphTo resolves from registry (no explicit morphMap) ──────────────────

  test('morphTo: preloads article parent via registry', async ({ assert }) => {
    const article = await Article.create({ title: 'Hello' })
    const reaction = await Reaction.create({
      emoji: '👍',
      reactableType: 'article',
      reactableId: article.id,
    })

    const found = await Reaction.query()
      .where('id', reaction.id)
      .preload('reactable' as any)
      .firstOrFail() as Reaction

    assert.instanceOf(found.reactable, Article)
    assert.equal((found.reactable as Article).title, 'Hello')
  })

  test('morphTo: preloads clip parent via registry', async ({ assert }) => {
    const clip = await Clip.create({ title: 'My Clip' })
    const reaction = await Reaction.create({
      emoji: '❤️',
      reactableType: 'clip',
      reactableId: clip.id,
    })

    const found = await Reaction.query()
      .where('id', reaction.id)
      .preload('reactable' as any)
      .firstOrFail() as Reaction

    assert.instanceOf(found.reactable, Clip)
    assert.equal((found.reactable as Clip).title, 'My Clip')
  })

  test('morphTo: eager loads mixed types via registry', async ({ assert }) => {
    const article = await Article.create({ title: 'An Article' })
    const clip = await Clip.create({ title: 'A Clip' })

    const [r1, r2] = await Reaction.createMany([
      { emoji: '👍', reactableType: 'article', reactableId: article.id },
      { emoji: '❤️', reactableType: 'clip', reactableId: clip.id },
    ])

    const reactions = await Reaction.query()
      .whereIn('id', [r1.id, r2.id])
      .preload('reactable' as any) as Reaction[]

    const articleReaction = reactions.find((r) => r.emoji === '👍')!
    const clipReaction = reactions.find((r) => r.emoji === '❤️')!

    assert.instanceOf(articleReaction.reactable, Article)
    assert.instanceOf(clipReaction.reactable, Clip)
  })

  test('morphTo: ad-hoc query via related() uses registry', async ({ assert }) => {
    const article = await Article.create({ title: 'Query Me' })
    const reaction = await Reaction.create({
      emoji: '🔥',
      reactableType: 'article',
      reactableId: article.id,
    })

    const found = await reaction.related('reactable' as any).query().firstOrFail() as Article

    assert.instanceOf(found, Article)
    assert.equal(found.title, 'Query Me')
  })

  test('morphTo: associate() resolves type from registry', async ({ assert }) => {
    const article = await Article.create({ title: 'Target' })
    const reaction = await Reaction.create({
      emoji: '😊',
      reactableType: 'article',
      reactableId: article.id,
    })

    const newArticle = await Article.create({ title: 'New Target' })
    await reaction.related('reactable' as any).associate(newArticle)

    const refreshed = await Reaction.findOrFail(reaction.id)
    assert.equal(refreshed.reactableType, 'article')
    assert.equal(refreshed.reactableId, newArticle.id)
  })

  // ─── morphOne/morphMany use registry alias as morphValue ────────────────────

  test('morphOne: stores @MorphMap alias in type column (not table name)', async ({ assert }) => {
    // Article alias is 'article', table is 'articles' — they differ intentionally
    const article = await Article.create({ title: 'Test' })
    const reaction = await article.related('reaction' as any).create({ emoji: '👍' }) as Reaction

    // The type column must contain the alias 'article', NOT the table name 'articles'
    assert.equal(reaction.reactableType, 'article')
    assert.equal(reaction.reactableId, article.id)
  })

  test('morphMany: stores @MorphMap alias in type column', async ({ assert }) => {
    const clip = await Clip.create({ title: 'Test' })
    const reaction = await clip.related('reactions' as any).create({ emoji: '❤️' }) as Reaction

    assert.equal(reaction.reactableType, 'clip')
    assert.equal(reaction.reactableId, clip.id)
  })

  test('morphOne: preload works end-to-end with registry alias', async ({ assert }) => {
    const article = await Article.create({ title: 'Full E2E' })
    await Reaction.create({ emoji: '🎉', reactableType: 'article', reactableId: article.id })

    const found = await Article.query()
      .where('id', article.id)
      .preload('reaction' as any)
      .firstOrFail() as Article

    assert.instanceOf(found.reaction, Reaction)
    assert.equal(found.reaction!.emoji, '🎉')
  })
})
