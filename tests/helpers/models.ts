/**
 * Test model definitions used across all spec files.
 *
 * Note: Properties are declared with their runtime types (Image | null, Comment[], etc.).
 * TypeScript type integration with Lucid's preload/related overloads is a future improvement.
 * Tests use `(model as any).related(...)` and `(query as any).preload(...)` to bypass this.
 *
 * Schema:
 *   posts: id, title
 *   videos: id, title
 *   images: id, url, imageable_type, imageable_id   (morphOne target)
 *   comments: id, body, commentable_type, commentable_id (morphMany + morphTo target)
 *   tags: id, name, taggable_type, taggable_id
 */
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { morphOne, morphMany, morphTo } from '../../src/index.js'

// ── Post ──────────────────────────────────────────────────────────────────────

export class Post extends BaseModel {
  static table = 'posts'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare title: string

  @morphOne(() => Image, { name: 'imageable' })
  declare image: Image | null

  @morphMany(() => Comment, { name: 'commentable' })
  declare comments: Comment[]

  @morphMany(() => Tag, { name: 'taggable' })
  declare tags: Tag[]
}

// ── Video ─────────────────────────────────────────────────────────────────────

export class Video extends BaseModel {
  static table = 'videos'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare title: string

  @morphOne(() => Image, { name: 'imageable' })
  declare image: Image | null

  @morphMany(() => Comment, { name: 'commentable' })
  declare comments: Comment[]
}

// ── Image ─────────────────────────────────────────────────────────────────────

export class Image extends BaseModel {
  static table = 'images'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare url: string

  @column()
  declare imageableType: string

  @column()
  declare imageableId: number

  @morphTo({ name: 'imageable', morphMap: { posts: () => Post, videos: () => Video } })
  declare imageable: Post | Video | null
}

// ── Comment ───────────────────────────────────────────────────────────────────

export class Comment extends BaseModel {
  static table = 'comments'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare body: string

  @column()
  declare commentableType: string

  @column()
  declare commentableId: number

  @morphTo({
    name: 'commentable',
    morphMap: { posts: () => Post, videos: () => Video },
  })
  declare commentable: Post | Video | null
}

// ── Tag ───────────────────────────────────────────────────────────────────────

export class Tag extends BaseModel {
  static table = 'tags'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare taggableType: string

  @column()
  declare taggableId: number

  @morphTo({ name: 'taggable', morphMap: { posts: () => Post } })
  declare taggable: Post | null
}