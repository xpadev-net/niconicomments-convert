import { Convert } from "@/controller/convert/convert";
import { QueueDisplay } from "@/controller/queue/queue";
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
