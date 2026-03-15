# @holoyan/adonisjs-polymorphic

Polymorphic relations for [AdonisJS Lucid ORM](https://lucid.adonisjs.com) — `morphOne`, `morphMany`, and `morphTo`.

| Package version | AdonisJS version |
|---|---|
| v0.x | v6 + v7 |

---

## How can you support me?

It's simple — just star this repository. That is enough to keep me motivated to maintain this package.

---

## Related packages

- [@holoyan/adonisjs-permissions](https://github.com/holoyan/adonisjs-permissions) — Role & permission system for AdonisJS. Supports multi-model ACL, resource-level permissions, scopes (multi-tenancy), and events.
- [@holoyan/morph-map-js](https://github.com/holoyan/morph-map-js) — The framework-agnostic morph map registry that powers the `@MorphMap` decorator used by this package.

---

## Table of Contents

- [Installation](#installation)
- [What are polymorphic relations?](#what-are-polymorphic-relations)
- [morphOne](#morphone)
- [morphMany](#morphmany)
- [morphTo](#morphto)
- [Global morph map with @MorphMap](#global-morph-map-with-morphmap)
- [Options reference](#options-reference)

---

## Installation

```bash
npm install @holoyan/adonisjs-polymorphic
```

Register the service provider by running the configure command:

```bash
node ace configure @holoyan/adonisjs-polymorphic
```

This automatically adds the provider to your `adonisrc.ts`.

---

## What are polymorphic relations?

A polymorphic relation lets a single child model belong to more than one parent model using a shared pair of columns — a **type** column and an **id** column.

```
images
  id
  url
  imageable_type   ← 'posts' | 'videos'
  imageable_id     ← id of the parent row
```

This means a single `images` table can store thumbnails for both posts and videos without needing separate `post_images` and `video_images` tables.

---

## morphOne

A parent model **has one** polymorphic child.

### Database migration

```ts
await schema.createTable('images', (table) => {
  table.increments('id')
  table.string('url').notNullable()
  table.string('imageable_type').notNullable()
  table.integer('imageable_id').notNullable()
  table.index(['imageable_type', 'imageable_id'])
})
```

### Model setup

```ts
// app/models/image.ts
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { morphTo } from '@holoyan/adonisjs-polymorphic'
import Post from '#models/post'
import Video from '#models/video'

export default class Image extends BaseModel {
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
```

```ts
// app/models/post.ts
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { morphOne } from '@holoyan/adonisjs-polymorphic'
import Image from '#models/image'

export default class Post extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare title: string

  @morphOne(() => Image, { name: 'imageable' })
  declare image: Image | null
}
```

```ts
// app/models/video.ts
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { morphOne } from '@holoyan/adonisjs-polymorphic'
import Image from '#models/image'

export default class Video extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare title: string

  @morphOne(() => Image, { name: 'imageable' })
  declare image: Image | null
}
```

### Querying

**Eager load (preload):**

```ts
const post = await Post.query()
  .preload('image' as any)
  .firstOrFail()

console.log(post.image)         // Image | null
console.log(post.image?.url)    // 'photo.jpg'
```

**Preload multiple parents at once:**

```ts
const posts = await Post.query()
  .preload('image' as any) as Post[]

// One SQL query — no N+1
// SELECT * FROM images WHERE imageable_type = 'posts' AND imageable_id IN (1, 2, 3)
```

**Ad-hoc query:**

```ts
const image = await post.related('image' as any)
  .query()
  .firstOrFail()
```

### Writing

**Create a related image:**

```ts
// imageableType and imageableId are set automatically
const image = await post.related('image' as any)
  .create({ url: 'photo.jpg' })
```

**Save an existing image instance:**

```ts
const image = new Image()
image.url = 'photo.jpg'

await post.related('image' as any).save(image)
```

**Find or create:**

```ts
const image = await post.related('image' as any)
  .firstOrCreate({ url: 'photo.jpg' })
```

**Update or create:**

```ts
const image = await post.related('image' as any)
  .updateOrCreate({ imageableId: post.id }, { url: 'new-photo.jpg' })
```

---

## morphMany

A parent model **has many** polymorphic children. Works exactly like `morphOne` but returns an array.

### Database migration

```ts
await schema.createTable('comments', (table) => {
  table.increments('id')
  table.text('body').notNullable()
  table.string('commentable_type').nullable()
  table.integer('commentable_id').nullable()
  table.index(['commentable_type', 'commentable_id'])
})
```

### Model setup

```ts
// app/models/comment.ts
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { morphTo } from '@holoyan/adonisjs-polymorphic'
import Post from '#models/post'
import Video from '#models/video'

export default class Comment extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare body: string

  @column()
  declare commentableType: string

  @column()
  declare commentableId: number

  @morphTo({ name: 'commentable', morphMap: { posts: () => Post, videos: () => Video } })
  declare commentable: Post | Video | null
}
```

```ts
// app/models/post.ts
import { morphOne, morphMany } from '@holoyan/adonisjs-polymorphic'
import Image from '#models/image'
import Comment from '#models/comment'

export default class Post extends BaseModel {
  // ...

  @morphOne(() => Image, { name: 'imageable' })
  declare image: Image | null

  @morphMany(() => Comment, { name: 'commentable' })
  declare comments: Comment[]
}
```

### Querying

**Eager load:**

```ts
const post = await Post.query()
  .preload('comments' as any)
  .firstOrFail()

console.log(post.comments)          // Comment[]
console.log(post.comments.length)   // 3
```

**Comments are isolated by type — a post only gets its own comments, not a video's:**

```ts
const post = await Post.query().preload('comments' as any).firstOrFail()
const video = await Video.query().preload('comments' as any).firstOrFail()

// Each only sees their own comments
```

**Ad-hoc query with additional constraints:**

```ts
const recentComments = await post.related('comments' as any)
  .query()
  .orderBy('created_at', 'desc')
  .limit(5)
```

### Writing

**Create one:**

```ts
const comment = await post.related('comments' as any)
  .create({ body: 'Great post!' })

console.log(comment.commentableType)  // 'posts'
console.log(comment.commentableId)    // post.id
```

**Create many:**

```ts
await post.related('comments' as any).createMany([
  { body: 'First comment' },
  { body: 'Second comment' },
])
```

**Save an existing instance:**

```ts
const comment = new Comment()
comment.body = 'Hello'

await post.related('comments' as any).save(comment)
```

**Save many:**

```ts
await post.related('comments' as any).saveMany([comment1, comment2])
```

---

## morphTo

The child side of a polymorphic relation. A comment **belongs to** either a `Post` or a `Video`.

### Querying

**Preload the parent:**

```ts
const comment = await Comment.query()
  .preload('commentable' as any)
  .firstOrFail()

if (comment.commentable instanceof Post) {
  console.log('belongs to a post:', comment.commentable.title)
} else if (comment.commentable instanceof Video) {
  console.log('belongs to a video:', comment.commentable.title)
}
```

**Preload mixed parent types in one query:**

```ts
// All comments in one query, parents resolved in two queries (posts + videos)
const comments = await Comment.query()
  .preload('commentable' as any) as Comment[]
```

**Ad-hoc query:**

```ts
const parent = await comment.related('commentable' as any)
  .query()
  .firstOrFail()
```

### Writing

**Associate with a parent:**

```ts
const post = await Post.findOrFail(1)
await comment.related('commentable' as any).associate(post)

// comment.commentableType is now 'posts'
// comment.commentableId is now post.id
```

**Dissociate from parent:**

```ts
await comment.related('commentable' as any).dissociate()

// comment.commentableType is now null
// comment.commentableId is now null
```

---

## Global morph map with @MorphMap

When you have many `morphTo` relations, repeating `morphMap: { posts: () => Post, videos: () => Video }` on each one gets tedious. Use the `@MorphMap` decorator from `@holoyan/morph-map-js` (bundled as a dependency) to register each model once globally.

### Setup

Decorate each parent model with its alias:

```ts
// app/models/post.ts
import { MorphMap } from '@holoyan/morph-map-js'

@MorphMap('posts')
export default class Post extends BaseModel {
  // ...
}
```

```ts
// app/models/video.ts
import { MorphMap } from '@holoyan/morph-map-js'

@MorphMap('videos')
export default class Video extends BaseModel {
  // ...
}
```

Now `morphTo` relations can omit the `morphMap` option entirely:

```ts
// app/models/comment.ts
import { morphTo } from '@holoyan/adonisjs-polymorphic'

export default class Comment extends BaseModel {
  @column()
  declare commentableType: string

  @column()
  declare commentableId: number

  // No morphMap needed — resolved from global registry at query time
  @morphTo({ name: 'commentable' })
  declare commentable: Post | Video | null
}
```

Adding a new parent type (e.g. `Podcast`) only requires one change:

```ts
@MorphMap('podcasts')
export default class Podcast extends BaseModel {}
```

All existing `morphTo` relations pick it up automatically.

### Alias vs table name

The `@MorphMap` alias is also used as the `morphValue` stored in the type column. This lets you decouple the alias from the table name:

```ts
@MorphMap('post')        // alias stored in type column
export default class Post extends BaseModel {
  static table = 'posts' // actual DB table
}
```

```ts
@morphOne(() => Image, { name: 'imageable' })
// morphValue will be 'post' (from @MorphMap), not 'posts' (from table)
```

### Ensuring models are registered at boot time

The global registry is populated when a model file is **imported**. To guarantee the registry is fully populated before any request, seeder, or test query runs, register your parent models in `config/polymorphic.ts` (published automatically by `node ace configure`):

```ts
// config/polymorphic.ts
import { defineConfig } from '@holoyan/adonisjs-polymorphic'

export default defineConfig({
  morphModels: [
    () => import('#models/post'),
    () => import('#models/video'),
    () => import('#models/podcast'),  // add new parent models here
  ],
})
```

The service provider imports all listed models during `boot()` — before the app serves any request, before seeders run, before tests execute. This completely eliminates any load order concerns.

Every time you add a new model decorated with `@MorphMap`, add it to this list.

### Explicit morphMap always wins

You can always override the registry on a per-relation basis:

```ts
@morphTo({
  name: 'commentable',
  morphMap: { posts: () => Post },  // only posts, ignores registry
})
declare commentable: Post | null
```

### Priority order

| What's set | morphTo resolution | morphOne/morphMany morphValue |
|---|---|---|
| Explicit `morphMap` option | Used directly | — |
| `morphValue` option | — | Used directly |
| `@MorphMap` on model | Registry fallback | Registry alias |
| Nothing | Error at query time | `model.table` |

---

## Options reference

### `@morphOne(relatedModel, options)`

| Option | Type | Default | Description |
|---|---|---|---|
| `name` | `string` | **required** | Prefix for the type/id columns on the related model. `'imageable'` → `imageableType` + `imageableId` |
| `localKey` | `string` | primary key | Attribute on the parent used to match against the id column |
| `morphValue` | `string` | `@MorphMap` alias or `model.table` | Value stored in the type column to identify this parent |
| `serializeAs` | `string \| null` | relation name | Key used during serialization. `null` excludes it |
| `onQuery` | `(query) => void` | — | Hook to add default constraints to every query on this relation |

### `@morphMany(relatedModel, options)`

Same options as `@morphOne`.

### `@morphTo(options)`

| Option | Type | Default | Description |
|---|---|---|---|
| `name` | `string` | relation name | Prefix used to derive the type/id attribute names on this model |
| `morphMap` | `Record<string, () => Model>` | global registry | Maps type strings to model factories. Optional when `@MorphMap` is used |
| `typeKey` | `string` | `${name}Type` | Explicit attribute name for the type column if it doesn't follow the naming convention |
| `idKey` | `string` | `${name}Id` | Explicit attribute name for the id column if it doesn't follow the naming convention |
| `serializeAs` | `string \| null` | relation name | Key used during serialization. `null` excludes it |
| `onQuery` | `(query) => void` | — | Hook to add default constraints |
