import react from "@vitejs/plugin-react";
export default {
  plugins: [react()],
  root: "src",
  build: {
    emptyOutDir: true,
    outDir: "../build/electron/html/",
  },
  resolve: {
    alias: {
      "@/": `${__dirname}/src/`,
    },
  },
  base: "",
};
