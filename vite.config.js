import { resolve } from 'path';
import { defineConfig } from 'vite';
import { copyFileSync, mkdirSync, existsSync, rmSync, readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Custom plugin to copy static files and fix output structure
function chromeExtensionPlugin() {
    return {
        name: 'chrome-extension-plugin',
        closeBundle() {
            const distDir = resolve(__dirname, 'dist');
            const srcDir = resolve(__dirname, 'src');

            // Ensure dist exists
            if (!existsSync(distDir)) {
                mkdirSync(distDir, { recursive: true });
            }

            // Copy static files
            copyFileSync(resolve(srcDir, 'pasta_style.css'), resolve(distDir, 'pasta_style.css'));
            copyFileSync(resolve(srcDir, 'content.css'), resolve(distDir, 'content.css'));
            copyFileSync(resolve(srcDir, 'background.js'), resolve(distDir, 'background.js'));

            // Copy icons
            const iconsDistDir = resolve(distDir, 'icons');
            if (!existsSync(iconsDistDir)) mkdirSync(iconsDistDir);
            copyFileSync(resolve(srcDir, 'icons/icon16.png'), resolve(iconsDistDir, 'icon16.png'));
            copyFileSync(resolve(srcDir, 'icons/icon48.png'), resolve(iconsDistDir, 'icon48.png'));
            copyFileSync(resolve(srcDir, 'icons/icon128.png'), resolve(iconsDistDir, 'icon128.png'));

            // Copy manifest to dist
            copyFileSync(resolve(__dirname, 'manifest.dist.json'), resolve(distDir, 'manifest.json'));

            // Move pasta_window.html from dist/src/ to dist/ and fix paths
            const srcHtmlPath = resolve(distDir, 'src', 'pasta_window.html');
            const destHtmlPath = resolve(distDir, 'pasta_window.html');
            if (existsSync(srcHtmlPath)) {
                let htmlContent = readFileSync(srcHtmlPath, 'utf-8');
                // Fix paths - remove ../ prefix since we're moving to dist root
                htmlContent = htmlContent.replace(/src="\.\.\/([^"]+)"/g, 'src="./$1"');
                htmlContent = htmlContent.replace(/href="\.\.\/([^"]+)"/g, 'href="./$1"');
                writeFileSync(destHtmlPath, htmlContent);
                // Clean up dist/src folder
                rmSync(resolve(distDir, 'src'), { recursive: true, force: true });
            }

            // Fix content.js - inline the utils import (content scripts can't use ES modules)
            const contentJsPath = resolve(distDir, 'content.js');
            if (existsSync(contentJsPath)) {
                let contentJs = readFileSync(contentJsPath, 'utf-8');

                const parseDateImpl = `
function parseDate(dateStr) {
    if (!dateStr) return 0;
    try {
        const [datePart, timePart] = dateStr.split(' ');
        const [day, month, year] = datePart.split('/');
        const [hour, min, sec] = timePart.split(':');
        return new Date(year, month - 1, day, hour, min, sec).getTime();
    } catch (e) {
        console.warn("Failed to parse date:", dateStr);
        return 0;
    }
}
`;
                // Remove any import statement and add the inlined function
                contentJs = contentJs.replace(/import\s*{\s*p\s+as\s+parseDate\s*}\s*from\s*['"][^'"]+['"];\s*\n?/g, '');
                contentJs = parseDateImpl + '\n' + contentJs;

                writeFileSync(contentJsPath, contentJs);
            }

            // Note: pasta_window.js can use ES modules since it loads as type="module" in the HTML
            // So we keep utils.js in dist for it to import
        }
    };
}

// Build configuration
export default defineConfig({
    base: './', // Use relative paths
    build: {
        outDir: 'dist',
        emptyDirBeforeWrite: true,
        rollupOptions: {
            input: {
                content: resolve(__dirname, 'src/content.js'),
                pasta_window: resolve(__dirname, 'src/pasta_window.html')
            },
            output: {
                entryFileNames: '[name].js',
                chunkFileNames: '[name].js',
                assetFileNames: '[name].[ext]'
            }
        },
        target: 'esnext',
        minify: false,
        modulePreload: false
    },
    plugins: [chromeExtensionPlugin()]
});
