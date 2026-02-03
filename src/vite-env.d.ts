// Type declarations for Vite ?raw imports
declare module '*.html?raw' {
    const content: string;
    export default content;
}
