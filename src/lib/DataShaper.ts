import StringUtils from './StringUtils.ts';
import {
  POSTS_PER_PAGE,
  MAX_FILTER_TAGS,
  EXCERPT_LENGTH,
  META_DESCRIPTION_LENGTH,
  SITE_URL,
  SITE_TITLE,
  SITE_TAGLINE,
  SITE_ROLE,
  SITE_AUTHOR,
  OG_DIR,
} from './config.ts';
import type {
  Post,
  PostTemplateData,
  IndexTemplateData,
  IndexPostData,
  FormatDateFn,
  NowFn,
  NowMsFn,
  TagChip,
  TagFilterChip,
  PageMeta,
  PageMetaInput,
} from './types.ts';

class DataShaper {
  private formatDate: FormatDateFn;
  private now: NowFn;
  private nowMs: NowMsFn;

  constructor({ formatDate, now, nowMs = () => Date.now() }: {
    formatDate: FormatDateFn;
    now: NowFn;
    /** Injected clock (epoch ms) so relative dates and `new` badges are deterministic in tests. */
    nowMs?: NowMsFn;
  }) {
    // Injected utilities for date formatting to keep this module pure/testable
    this.formatDate = formatDate; // (iso, fmt) => string
    this.now = now;               // (fmt) => string
    this.nowMs = nowMs;           // () => epoch ms
  }

  /**
   * Preview line for an archive entry. The gist description is preferred, but GistParser falls
   * back to the title (or a placeholder) when a gist has no description, and an entry that repeats
   * its own heading reads as noise — in that case the opening prose of the post is used instead.
   */
  buildExcerpt(post: Post): string {
    const description = StringUtils.toPlainText(post.description ?? '');
    const title = StringUtils.toPlainText(post.title ?? '');
    const echoesTitle = description.toLowerCase() === title.toLowerCase();
    const source = !description || echoesTitle || description === 'No description' ? post.content : description;
    return StringUtils.summarize(source, EXCERPT_LENGTH);
  }

  /** Tag names wrapped as objects, which is the shape the template engine iterates. */
  buildTagChips(tags: string[] | undefined): TagChip[] {
    return Array.isArray(tags) ? tags.map((name) => ({ name })) : [];
  }

  /** Absolute URL of a post's social card. */
  ogImagePath(postId: string): string {
    return `/${OG_DIR}/${postId}.png`;
  }

  /**
   * Page-level metadata (title, description, canonical + Open Graph/Twitter values) shared by
   * every template render through the layout.
   */
  buildPageMeta({ title, description, path: pagePath, image, type = 'website' }: PageMetaInput): PageMeta {
    const canonicalUrl = `${SITE_URL}${pagePath.startsWith('/') ? pagePath : `/${pagePath}`}`;
    const metaDescription = StringUtils.summarize(description || `${SITE_ROLE}. ${SITE_TAGLINE}`, META_DESCRIPTION_LENGTH);
    return {
      siteName: SITE_TITLE,
      author: SITE_AUTHOR,
      documentTitle: title === SITE_TITLE ? title : `${title} · ${SITE_TITLE}`,
      canonicalUrl,
      metaDescription,
      ogTitle: title,
      ogType: type,
      ogImageUrl: `${SITE_URL}${image.startsWith('/') ? image : `/${image}`}`,
      ogImageAlt: `${title} — ${SITE_TITLE}`,
    };
  }

  buildPostData(post: Post): PostTemplateData {
    const currentTopic = Array.isArray(post.tags) && post.tags.length ? String(post.tags[0]) : '';
    return {
      ...post,
      formattedDate: this.formatDate(post.createdAt, 'MMM d, yyyy'),
      formattedUpdateDate: post.updatedAt !== post.createdAt ? this.formatDate(post.updatedAt, 'MMM d, yyyy') : null,
      shortId: post.id.substring(0, 7),
      currentTopic,
      tagsCsv: Array.isArray(post.tags) ? post.tags.join(',') : '',
      tagList: this.buildTagChips(post.tags),
      hasTags: Array.isArray(post.tags) && post.tags.length > 0,
      summary: StringUtils.summarize(post.description || post.content, META_DESCRIPTION_LENGTH),
      ogImage: this.ogImagePath(post.id),
    };
  }

  buildIndexData(sortedPosts: Post[], timestamp: number = this.nowMs()): IndexTemplateData {
    const lastUpdateFormatted = this.now('MMM d, HH:mm');

    const acc = sortedPosts.reduce((state: { posts: IndexPostData[]; tagCounts: Map<string, number> }, post) => {
      const hasTags = Array.isArray(post.tags) && post.tags.length > 0;
      const shaped: IndexPostData = {
        ...post,
        // One date format everywhere: an archive is easier to scan than it is charming.
        formattedDate: this.formatDate(post.createdAt, 'MMM d, yyyy'),
        excerpt: this.buildExcerpt(post),
        shortId: post.id.substring(0, 7),
        lastUpdate: lastUpdateFormatted,
        hasTags,
        tagList: this.buildTagChips(post.tags),
      };
      state.posts.push(shaped);
      if (hasTags) {
        for (const t of post.tags) state.tagCounts.set(t, (state.tagCounts.get(t) ?? 0) + 1);
      }
      return state;
    }, { posts: [], tagCounts: new Map<string, number>() });

    const allTags = Array.from(acc.tagCounts.keys()).sort();
    // Filter row: most-used topics first, alphabetical within the same count, capped for layout.
    const topTags: TagFilterChip[] = Array.from(acc.tagCounts.entries())
      .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
      .slice(0, MAX_FILTER_TAGS)
      .map(([name, count]) => ({ name, count }));

    const totalPosts = acc.posts.length;
    const totalPages = Math.ceil(totalPosts / POSTS_PER_PAGE);

    return {
      posts: acc.posts,
      postsLength: totalPosts,
      lastUpdate: new Date(this.nowMs()).toISOString(),
      allTags,
      hasAnyTags: allTags.length > 0,
      topTags,
      tagline: SITE_TAGLINE,
      role: SITE_ROLE,
      author: SITE_AUTHOR,
      timestamp,
      pagination: totalPages > 1 ? { totalPages, postsPerPage: POSTS_PER_PAGE } : null
    };
  }
}

export default DataShaper;
