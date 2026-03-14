/**
 * MorphMany tests
 *
 * preload/related calls use `as any` because our dynamically-registered relations
 * are not in Lucid's static type system. Runtime works correctly.
 */
import { test } from '@japa/runner'
import { setupDatabase, closeDatabase, schema } from './helpers/db.js'
import { Post, Video, Comment } from './helpers/models.js'

test.group('MorphMany', (group) => {
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
      t.string('commentable_type').notNullable()
      t.integer('commentable_id').notNullable()
    })
  })

  group.teardown(async () => {
    await schema().dropTableIfExists('comments')
    await schema().dropTableIfExists('posts')
    await schema().dropTableIfExists('videos')
    await closeDatabase()
  })

  group.each.teardown(async () => {
    await Comment.query().delete()
    await Post.query().delete()
    await Video.query().delete()
  })

  // ─── Basic preload ────────────────────────────────────────────────────────────

  test('returns all comments for a post', async ({ assert }) => {
    const post = await Post.create({ title: 'My Post' })
    await Comment.createMany([
      { body: 'First', commentableType: 'posts', commentableId: post.id },
      { body: 'Second', commentableType: 'posts', commentableId: post.id },
    ])

    const found = await (Post.query() as any)
      .where('id', post.id)
      .preload('comments')
      .firstOrFail() as Post

    assert.lengthOf(found.comments, 2)
    assert.sameMembers(found.comments.map((c) => c.body), ['First', 'Second'])
  })

  test('returns empty array when post has no comments', async ({ assert }) => {
    const post = await Post.create({ title: 'Silent' })

    const found = await (Post.query() as any)
      .where('id', post.id)
      .preload('comments')
      .firstOrFail() as Post

    assert.isArray(found.comments)
    assert.lengthOf(found.comments, 0)
  })

  test('does not mix comments between posts and videos', async ({ assert }) => {
    const post = await Post.create({ title: 'Post' })
    const video = await Video.create({ title: 'Video' })

    await Comment.create({ body: 'Post comment', commentableType: 'posts', commentableId: post.id })
    await Comment.create({ body: 'Video comment', commentableType: 'videos', commentableId: video.id })

    const foundPost = await (Post.query() as any).where('id', post.id).preload('comments').firstOrFail() as Post
    const foundVideo = await (Video.query() as any).where('id', video.id).preload('comments').firstOrFail() as Video

    assert.lengthOf(foundPost.comments, 1)
    assert.equal(foundPost.comments[0].body, 'Post comment')
    assert.lengthOf(foundVideo.comments, 1)
    assert.equal(foundVideo.comments[0].body, 'Video comment')
  })

  // ─── Eager loading (multiple parents) ────────────────────────────────────────

  test('eager loads comments for multiple posts', async ({ assert }) => {
    const [p1, p2] = await Promise.all([
      Post.create({ title: 'Post 1' }),
      Post.create({ title: 'Post 2' }),
    ])

    await Comment.createMany([
      { body: 'A', commentableType: 'posts', commentableId: p1.id },
      { body: 'B', commentableType: 'posts', commentableId: p1.id },
      { body: 'C', commentableType: 'posts', commentableId: p2.id },
    ])

    const posts = await (Post.query() as any).orderBy('id').preload('comments') as Post[]

    const first = posts.find((p) => p.id === p1.id)!
    const second = posts.find((p) => p.id === p2.id)!

    assert.lengthOf(first.comments, 2)
    assert.lengthOf(second.comments, 1)
  })

  // ─── Ad-hoc query ────────────────────────────────────────────────────────────

  test('queries comments via model.related().query()', async ({ assert }) => {
    const post = await Post.create({ title: 'Hello' })
    await Comment.createMany([
      { body: 'X', commentableType: 'posts', commentableId: post.id },
      { body: 'Y', commentableType: 'posts', commentableId: post.id },
    ])

    const comments = await (post as any).related('comments').query().orderBy('body') as Comment[]

    assert.lengthOf(comments, 2)
    assert.equal(comments[0].body, 'X')
    assert.equal(comments[1].body, 'Y')
  })

  test('supports additional where conditions on the related query', async ({ assert }) => {
    const post = await Post.create({ title: 'Hello' })
    await Comment.createMany([
      { body: 'Keep', commentableType: 'posts', commentableId: post.id },
      { body: 'Skip', commentableType: 'posts', commentableId: post.id },
    ])

    const comments = await (post as any).related('comments').query().where('body', 'Keep') as Comment[]

    assert.lengthOf(comments, 1)
    assert.equal(comments[0].body, 'Keep')
  })

  // ─── Persistence ─────────────────────────────────────────────────────────────

  test('creates a comment via related().create()', async ({ assert }) => {
    const post = await Post.create({ title: 'Hello' })
    const comment = await (post as any).related('comments').create({ body: 'Created!' }) as Comment

    assert.instanceOf(comment, Comment)
    assert.equal(comment.commentableType, 'posts')
    assert.equal(comment.commentableId, post.id)
    assert.isTrue(comment.$isPersisted)
  })

  test('creates multiple comments via related().createMany()', async ({ assert }) => {
    const post = await Post.create({ title: 'Hello' })
    const comments = await (post as any)
      .related('comments')
      .createMany([{ body: 'One' }, { body: 'Two' }]) as Comment[]

    assert.lengthOf(comments, 2)
    for (const c of comments) {
      assert.equal(c.commentableType, 'posts')
      assert.equal(c.commentableId, post.id)
    }
  })

  test('saves an existing comment via related().save()', async ({ assert }) => {
    const post = await Post.create({ title: 'Hello' })
    const comment = new Comment()
    comment.body = 'Saved!'

    await (post as any).related('comments').save(comment)

    assert.equal(comment.commentableType, 'posts')
    assert.equal(comment.commentableId, post.id)
    assert.isTrue(comment.$isPersisted)
  })

  test('saves multiple existing comments via related().saveMany()', async ({ assert }) => {
    const post = await Post.create({ title: 'Hello' })

    const c1 = new Comment()
    c1.body = 'First'
    const c2 = new Comment()
    c2.body = 'Second'

    await (post as any).related('comments').saveMany([c1, c2])

    for (const c of [c1, c2]) {
      assert.equal(c.commentableType, 'posts')
      assert.equal(c.commentableId, post.id)
      assert.isTrue(c.$isPersisted)
    }
  })
})
