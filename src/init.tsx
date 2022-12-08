import { createRoot } from "react-dom/client";
import { Downloader } from "./downloader";
import { Controller } from "./controller";
import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";

const init = () => {
  const reactRootDom = document.getElementById("root");
  if (!reactRootDom) return;
  const reactRoot = createRoot(reactRootDom);
  const loc = window.location.search;
  if (loc === "") {
    reactRoot.render(<Controller />);
  } else if (loc === "downloader") {
    reactRoot.render(<Downloader />);
  }
};
init();
