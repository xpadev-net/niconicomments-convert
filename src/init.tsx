import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";

import { createTheme, ThemeProvider } from "@mui/material";
import { createRoot } from "react-dom/client";

import { Controller } from "@/controller/controller";
import { Downloader } from "@/downloader";
import { setupRenderer } from "@/renderer/renderer";

const init = (): void => {
  const reactRootDom = document.getElementById("root");
  if (!reactRootDom) return;
  const reactRoot = createRoot(reactRootDom);
  const loc = window.location.search;
  if (loc === "") {
    const darkTheme = createTheme({
      palette: {
        mode: "dark",
      },
    });
    reactRoot.render(
      <ThemeProvider theme={darkTheme}>
        <Controller />
      </ThemeProvider>,
    );
  } else if (loc === "?binary-downloader") {
    reactRoot.render(<Downloader />);
  } else if (loc === "?renderer") {
    void setupRenderer();
  }
};
init();
