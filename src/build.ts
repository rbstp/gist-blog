import BlogGenerator from './lib/BlogGenerator.js';

// Run the build
const generator = new BlogGenerator();
generator.build().catch(console.error);