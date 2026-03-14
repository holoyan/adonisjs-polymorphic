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

    const found = await (Post.query() as any)
      .where('id', post.id)
      .preload('image')
      .firstOrFail() as Post

    assert.instanceOf(found.image, Image)
    assert.equal(found.image!.url, 'a.jpg')
  })

  test('returns null when post has no image', async ({ assert }) => {
    const post = await Post.create({ title: 'Empty' })

    const found = await (Post.query() as any)
      .where('id', post.id)
      .preload('image')
      .firstOrFail() as Post

    assert.isNull(found.image)
  })

  test('preloads image for a video', async ({ assert }) => {
    const video = await Video.create({ title: 'My Video' })
    await Image.create({ url: 'v.jpg', imageableType: 'videos', imageableId: video.id })

    const found = await (Video.query() as any)
      .where('id', video.id)
      .preload('image')
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

    const foundPost = await (Post.query() as any).where('id', post.id).preload('image').firstOrFail() as Post
    const foundVideo = await (Video.query() as any).where('id', video.id).preload('image').firstOrFail() as Video

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

    const posts = await (Post.query() as any).orderBy('id').preload('image') as Post[]

    assert.equal(posts[0].image!.url, 'img1.jpg')
    assert.equal(posts[1].image!.url, 'img2.jpg')
  })

  test('sets null for posts without images during eager load', async ({ assert }) => {
    const p1 = await Post.create({ title: 'Post with image' })
    await Post.create({ title: 'Post without image' })
    await Image.create({ url: 'img.jpg', imageableType: 'posts', imageableId: p1.id })

    const posts = await (Post.query() as any).orderBy('id').preload('image') as Post[]

    assert.instanceOf(posts[0].image, Image)
    assert.isNull(posts[1].image)
  })

  // ─── Ad-hoc query ────────────────────────────────────────────────────────────

  test('queries related image via model.related()', async ({ assert }) => {
    const post = await Post.create({ title: 'Hello' })
    await Image.create({ url: 'a.jpg', imageableType: 'posts', imageableId: post.id })

    const image = await (post as any).related('image').query().first() as Image

    assert.instanceOf(image, Image)
    assert.equal(image.url, 'a.jpg')
  })

  // ─── Persistence ─────────────────────────────────────────────────────────────

  test('creates a related image via related().create()', async ({ assert }) => {
    const post = await Post.create({ title: 'Hello' })
    const image = await (post as any).related('image').create({ url: 'new.jpg' }) as Image

    assert.instanceOf(image, Image)
    assert.equal(image.url, 'new.jpg')
    assert.equal(image.imageableType, 'posts')
    assert.equal(image.imageableId, post.id)
  })

  test('saves a related image via related().save()', async ({ assert }) => {
    const post = await Post.create({ title: 'Hello' })
    const image = new Image()
    image.url = 'saved.jpg'

    await (post as any).related('image').save(image)

    assert.equal(image.imageableType, 'posts')
    assert.equal(image.imageableId, post.id)
    assert.isTrue(image.$isPersisted)
  })
})