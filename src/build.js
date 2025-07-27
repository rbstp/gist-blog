const BlogGenerator = require('./lib/BlogGenerator');

// Run the build
const generator = new BlogGenerator();
generator.build().catch(console.error);