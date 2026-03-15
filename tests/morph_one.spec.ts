/**
 * MorphOne tests
 *
 * preload/related calls use `as any` because our dynamically-registered relations
 * are not in Lucid's static type system (ExtractModelRelations). Runtime works correctly.
 */
import { test } from '@japa/runner'
import { setupDatabase, closeDatabase, schema } from './helpers/db.js'
import { Post, Video, Image } from './helpers/models.js'

test.group('MorphOne', (group) => {
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
    await schema().createTableIfNotExists('images', (t) => {
      t.increments('id')
      t.string('url').notNullable()
      t.string('imageable_type').notNullable()
      t.integer('imageable_id').notNullable()
    })
  })

  group.teardown(async () => {
    await schema().dropTableIfExists('images')
    await schema().dropTableIfExists('posts')
    await schema().dropTableIfExists('videos')
    await closeDatabase()
  })

  group.each.teardown(async () => {
    await Image.query().delete()
    await Post.query().delete()
    await Video.query().delete()
  })

  // ─── Basic preload ────────────────────────────────────────────────────────────

  test('preloads image for a post', async ({ assert }) => {
    const post = await Post.create({ title: 'Hello' })
    await Image.create({ url: 'a.jpg', imageableType: 'posts', imageableId: post.id })

    const found = await Post.query()
      .where('id', post.id)
      .preload('image' as any)
      .firstOrFail() as Post

    assert.instanceOf(found.image, Image)
    assert.equal(found.image!.url, 'a.jpg')
  })

  test('returns null when post has no image', async ({ assert }) => {
    const post = await Post.create({ title: 'Empty' })

    const found = await Post.query()
      .where('id', post.id)
      .preload('image' as any)
      .firstOrFail() as Post

    assert.isNull(found.image)
  })

  test('preloads image for a video', async ({ assert }) => {
    const video = await Video.create({ title: 'My Video' })
    await Image.create({ url: 'v.jpg', imageableType: 'videos', imageableId: video.id })

    const found = await Video.query()
      .where('id', video.id)
      .preload('image' as any)
      .firstOrFail() as Video

    assert.instanceOf(found.image, Image)
    assert.equal(found.image!.url, 'v.jpg')
  })

  // ─── Type isolation ────────────────────────────────────────────────────────────

  test('does not cross-contaminate posts and videos for same id', async ({ assert }) => {
    const post = await Post.create({ title: 'Post One' })
    const video = await Video.create({ title: 'Video One' })

    await Image.create({ url: 'post-image.jpg', imageableType: 'posts', imageableId: post.id })
    await Image.create({ url: 'video-image.jpg', imageableType: 'videos', imageableId: video.id })

    const foundPost = await Post.query().where('id', post.id).preload('image' as any).firstOrFail() as Post
    const foundVideo = await Video.query().where('id', video.id).preload('image' as any).firstOrFail() as Video

    assert.equal(foundPost.image!.url, 'post-image.jpg')
    assert.equal(foundVideo.image!.url, 'video-image.jpg')
  })

  // ─── Eager loading (multiple parents) ────────────────────────────────────────

  test('eager loads images for multiple posts', async ({ assert }) => {
    const [p1, p2] = await Promise.all([
      Post.create({ title: 'Post 1' }),
      Post.create({ title: 'Post 2' }),
    ])
    await Promise.all([
      Image.create({ url: 'img1.jpg', imageableType: 'posts', imageableId: p1.id }),
      Image.create({ url: 'img2.jpg', imageableType: 'posts', imageableId: p2.id }),
    ])

    const posts = await Post.query().orderBy('id').preload('image' as any) as Post[]

    assert.equal(posts[0].image!.url, 'img1.jpg')
    assert.equal(posts[1].image!.url, 'img2.jpg')
  })

  test('sets null for posts without images during eager load', async ({ assert }) => {
    const p1 = await Post.create({ title: 'Post with image' })
    await Post.create({ title: 'Post without image' })
    await Image.create({ url: 'img.jpg', imageableType: 'posts', imageableId: p1.id })

    const posts = await Post.query().orderBy('id').preload('image' as any) as Post[]

    assert.instanceOf(posts[0].image, Image)
    assert.isNull(posts[1].image)
  })

  // ─── Ad-hoc query ────────────────────────────────────────────────────────────

  test('queries related image via model.related()', async ({ assert }) => {
    const post = await Post.create({ title: 'Hello' })
    await Image.create({ url: 'a.jpg', imageableType: 'posts', imageableId: post.id })

    const image = await post.related('image' as any).query().first() as Image

    assert.instanceOf(image, Image)
    assert.equal(image.url, 'a.jpg')
  })

  // ─── Persistence ─────────────────────────────────────────────────────────────

  test('creates a related image via related().create()', async ({ assert }) => {
    const post = await Post.create({ title: 'Hello' })
    const image = await post.related('image' as any).create({ url: 'new.jpg' }) as Image

    assert.instanceOf(image, Image)
    assert.equal(image.url, 'new.jpg')
    assert.equal(image.imageableType, 'posts')
    assert.equal(image.imageableId, post.id)
  })

  test('saves a related image via related().save()', async ({ assert }) => {
    const post = await Post.create({ title: 'Hello' })
    const image = new Image()
    image.url = 'saved.jpg'

    await post.related('image' as any).save(image)

    assert.equal(image.imageableType, 'posts')
    assert.equal(image.imageableId, post.id)
    assert.isTrue(image.$isPersisted)
  })

  test('finds or creates a related image via related().firstOrCreate()', async ({ assert }) => {
    const post = await Post.create({ title: 'Hello' })

    const created = await post.related('image' as any).firstOrCreate({ url: 'first.jpg' }) as Image
    assert.equal(created.url, 'first.jpg')
    assert.equal(created.imageableType, 'posts')
    assert.isTrue(created.$isPersisted)

    // calling again returns the existing row, does not create a duplicate
    const found = await post.related('image' as any).firstOrCreate({ url: 'first.jpg' }) as Image
    assert.equal(found.id, created.id)
    assert.equal(await Image.query().count('* as total').then((r: any) => r[0].$extras.total), 1)
  })

  test('updates or creates a related image via related().updateOrCreate()', async ({ assert }) => {
    const post = await Post.create({ title: 'Hello' })

    // No existing row — creates
    const image = await post.related('image' as any)
      .updateOrCreate({ imageableId: post.id }, { url: 'original.jpg' }) as Image
    assert.equal(image.url, 'original.jpg')

    // Existing row — updates
    await post.related('image' as any)
      .updateOrCreate({ imageableId: post.id }, { url: 'updated.jpg' })

    const refreshed = await Image.findOrFail(image.id)
    assert.equal(refreshed.url, 'updated.jpg')
  })
})