import react from "@vitejs/plugin-react";
module.exports = {
  plugins: [
    react(),
  ],
  root: 'src',
  build: {
    emptyOutDir: true,
    outDir: '../build/electron/html/'
  },
  resolve:{
    alias: {
      "@/": `${__dirname}/src/`,
    },
  },
  base:""
}