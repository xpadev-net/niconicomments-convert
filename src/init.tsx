import { createRoot } from "react-dom/client";
import { Downloader } from "./downloader";
import { Controller } from "./controller";

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
