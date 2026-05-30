import BlogGenerator from './lib/BlogGenerator.ts';

// Run the build
const generator = new BlogGenerator();
generator.build().catch(console.error);
