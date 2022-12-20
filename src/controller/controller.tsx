import { Convert } from "@/controller/convert";
import { QueueDisplay } from "@/controller/queue";
import Styles from "./controller.module.scss";

const Controller = () => {
  return (
    <div className={Styles.wrapper}>
      <div className={Styles.convert}>
        <Convert />
      </div>
      <div className={Styles.queue}>
        <QueueDisplay />
      </div>
    </div>
  );
};
export { Controller };
