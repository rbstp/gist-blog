const { POSTS_PER_PAGE } = require('./config');

class DataShaper {
  constructor({ formatDate, now }) {
    // Injected utilities for date formatting to keep this module pure/testable
    this.formatDate = formatDate; // (iso, fmt) => string
    this.now = now;               // (fmt) => string
  }

  buildPostData(post) {
    const currentTopic = Array.isArray(post.tags) && post.tags.length ? String(post.tags[0]) : '';
    return {
      ...post,
      formattedDate: this.formatDate(post.createdAt, 'MMM d, yyyy'),
      formattedUpdateDate: post.updatedAt !== post.createdAt ? this.formatDate(post.updatedAt, 'MMM d, yyyy') : null,
      shortId: post.id.substring(0, 7),
      currentTopic,
      tagsCsv: Array.isArray(post.tags) ? post.tags.join(',') : '',
      timestamp: Date.now()
    };
  }

  buildIndexData(sortedPosts) {
    const lastUpdateFormatted = this.now('MMM d, HH:mm');

    const acc = sortedPosts.reduce((state, post) => {
      const shaped = {
        ...post,
        formattedDate: this.formatDate(post.createdAt, 'MMM d, yyyy'),
        excerpt: post.content.length > 150 ? post.content.substring(0, 150) + '...' : post.content,
        shortId: post.id.substring(0, 7),
        lastUpdate: lastUpdateFormatted,
        hasTags: post.tags && post.tags.length > 0,
      };
      state.posts.push(shaped);
      if (post.tags && post.tags.length) {
        for (const t of post.tags) state.tagSet.add(t);
      }
      return state;
    }, { posts: [], tagSet: new Set() });

    const allTags = Array.from(acc.tagSet).sort();
    const totalPosts = acc.posts.length;
    const totalPages = Math.ceil(totalPosts / POSTS_PER_PAGE);

    return {
      posts: acc.posts,
      postsLength: totalPosts,
      lastUpdate: new Date().toISOString(),
      allTags,
      hasAnyTags: allTags.length > 0,
      timestamp: Date.now(),
      pagination: totalPages > 1 ? { totalPages, postsPerPage: POSTS_PER_PAGE } : null
    };
  }
}

module.exports = DataShaper;
