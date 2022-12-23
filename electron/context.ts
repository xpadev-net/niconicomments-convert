import { app } from "electron";

const baseUrl = app.isPackaged
  ? `file://${__dirname}/html/index.html`
  : "http://localhost:5173";
export { baseUrl };
