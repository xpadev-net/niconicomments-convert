import * as express from "express";
import * as bodyParser from "body-parser";
import { typeGuard } from "./typeGuard";
import { appendBuffers } from "./converterManager";
const launchServer = () => {
  const app = express();
  const port = 55535;
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json({ extended: true, limit: "1gb" }));
  app.post("/image", (req, res) => {
    const value = req.body;
    if (typeGuard.renderer.buffer(value)) {
      void appendBuffers(value.data);
      res.send({ status: "ok" });
    } else {
      res.send({ status: "error" });
    }
  });
  app.get("/check", (req, res) => {
    res.send({ status: "ok" });
  });
  app.listen(port, function () {});
};
export { launchServer };
