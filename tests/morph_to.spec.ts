/**
 * MorphTo tests
 *
 * The relation name argument uses `as any` because our dynamically-registered relations
 * are not in Lucid's static type system. Runtime works correctly.
 */
import { test } from '@japa/runner'
import { setupDatabase, closeDatabase, schema } from './helpers/db.js'
import { Post, Video, Comment, Image } from './helpers/models.js'

test.group('MorphTo', (group) => {
  group.setup(async () => {
    setupDatabase()

    await schema().createTableIfNotExists('posts', (t) => {
      t.increments('id')
      t.string('title').notNullable()
    })
    await schema().createTableIfNotExists('videos', (t) => {
      t.increments('id')
      t.string('title').notNullable()
    })
    await schema().createTableIfNotExists('comments', (t) => {
      t.increments('id')
      t.text('body').notNullable()
      t.string('commentable_type').nullable()
      t.integer('commentable_id').nullable()
    })
    await schema().createTableIfNotExists('images', (t) => {
      t.increments('id')
      t.string('url').notNullable()
      t.string('imageable_type').notNullable()
      t.integer('imageable_id').notNullable()
    })
  })

  group.teardown(async () => {
    await schema().dropTableIfExists('comments')
    await schema().dropTableIfExists('images')
    await schema().dropTableIfExists('posts')
    await schema().dropTableIfExists('videos')
    await closeDatabase()
  })

  group.each.teardown(async () => {
    await Comment.query().delete()
    await Image.query().delete()
    await Post.query().delete()
    await Video.query().delete()
  })

  // ─── Single parent preload ────────────────────────────────────────────────────

  test('preloads post for a comment (single parent)', async ({ assert }) => {
    const post = await Post.create({ title: 'Target Post' })
    const comment = await Comment.create({
      body: 'Hello',
      commentableType: 'posts',
      commentableId: post.id,
    })

    const found = await Comment.query()
      .where('id', comment.id)
      .preload('commentable' as any)
      .firstOrFail() as Comment

    assert.instanceOf(found.commentable, Post)
    assert.equal((found.commentable as Post).title, 'Target Post')
  })

  test('preloads video for a comment (single parent)', async ({ assert }) => {
    const video = await Video.create({ title: 'Target Video' })
    const comment = await Comment.create({
      body: 'Hi',
      commentableType: 'videos',
      commentableId: video.id,
    })

    const found = await Comment.query()
      .where('id', comment.id)
      .preload('commentable' as any)
      .firstOrFail() as Comment

    assert.instanceOf(found.commentable, Video)
    assert.equal((found.commentable as Video).title, 'Target Video')
  })

  // ─── Many parents (mixed types) ───────────────────────────────────────────────

  test('eager loads mixed commentable types for many comments', async ({ assert }) => {
    const post = await Post.create({ title: 'A Post' })
    const video = await Video.create({ title: 'A Video' })

    const [c1, c2] = await Comment.createMany([
      { body: 'On Post', commentableType: 'posts', commentableId: post.id },
      { body: 'On Video', commentableType: 'videos', commentableId: video.id },
    ])

    const comments = await Comment.query()
      .whereIn('id', [c1.id, c2.id])
      .preload('commentable' as any) as Comment[]

    const postComment = comments.find((c) => c.body === 'On Post')!
    const videoComment = comments.find((c) => c.body === 'On Video')!

    assert.instanceOf(postComment.commentable, Post)
    assert.equal((postComment.commentable as Post).title, 'A Post')

    assert.instanceOf(videoComment.commentable, Video)
    assert.equal((videoComment.commentable as Video).title, 'A Video')
  })

  test('multiple comments pointing to the same parent', async ({ assert }) => {
    const post = await Post.create({ title: 'Shared' })
    const [c1, c2] = await Comment.createMany([
      { body: 'First', commentableType: 'posts', commentableId: post.id },
      { body: 'Second', commentableType: 'posts', commentableId: post.id },
    ])

    const comments = await Comment.query()
      .whereIn('id', [c1.id, c2.id])
      .preload('commentable' as any) as Comment[]

    for (const c of comments) {
      assert.instanceOf(c.commentable, Post)
      assert.equal((c.commentable as Post).title, 'Shared')
    }
  })

  // ─── Ad-hoc query ────────────────────────────────────────────────────────────

  test('queries related post via comment.related().query()', async ({ assert }) => {
    const post = await Post.create({ title: 'My Post' })
    const comment = await Comment.create({
      body: 'Test',
      commentableType: 'posts',
      commentableId: post.id,
    })

    const found = await comment.related('commentable' as any).query().firstOrFail() as Post

    assert.instanceOf(found, Post)
    assert.equal(found.title, 'My Post')
  })

  test('queries related video via comment.related().query()', async ({ assert }) => {
    const video = await Video.create({ title: 'My Video' })
    const comment = await Comment.create({
      body: 'Test',
      commentableType: 'videos',
      commentableId: video.id,
    })

    const found = await comment.related('commentable' as any).query().firstOrFail() as Video

    assert.instanceOf(found, Video)
    assert.equal(found.title, 'My Video')
  })

  // ─── Persistence ─────────────────────────────────────────────────────────────

  test('associates a comment with a post via related().associate()', async ({ assert }) => {
    const post1 = await Post.create({ title: 'Original' })
    const post2 = await Post.create({ title: 'New target' })
    const comment = await Comment.create({
      body: 'Test',
      commentableType: 'posts',
      commentableId: post1.id,
    })

    await comment.related('commentable' as any).associate(post2)

    const refreshed = await Comment.findOrFail(comment.id)
    assert.equal(refreshed.commentableType, 'posts')
    assert.equal(refreshed.commentableId, post2.id)
  })

  test('dissociates a comment from its parent via related().dissociate()', async ({ assert }) => {
    const post = await Post.create({ title: 'Target' })
    const comment = await Comment.create({
      body: 'Hello',
      commentableType: 'posts',
      commentableId: post.id,
    })

    await comment.related('commentable' as any).dissociate()

    const refreshed = await Comment.findOrFail(comment.id)
    assert.isNull(refreshed.commentableType)
    assert.isNull(refreshed.commentableId)
  })

  // ─── Image morphTo (alternative morphable) ────────────────────────────────────

  test('preloads Post via image.imageable', async ({ assert }) => {
    const post = await Post.create({ title: 'A Post' })
    const image = await Image.create({
      url: 'test.jpg',
      imageableType: 'posts',
      imageableId: post.id,
    })

    const found = await Image.query()
      .where('id', image.id)
      .preload('imageable' as any)
      .firstOrFail() as Image

    assert.instanceOf(found.imageable, Post)
    assert.equal((found.imageable as Post).title, 'A Post')
  })

  test('preloads Video via image.imageable', async ({ assert }) => {
    const video = await Video.create({ title: 'A Video' })
    const image = await Image.create({
      url: 'test.jpg',
      imageableType: 'videos',
      imageableId: video.id,
    })

    const found = await Image.query()
      .where('id', image.id)
      .preload('imageable' as any)
      .firstOrFail() as Image

    assert.instanceOf(found.imageable, Video)
    assert.equal((found.imageable as Video).title, 'A Video')
  })
})
