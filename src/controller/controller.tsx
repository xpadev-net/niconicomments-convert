import { Convert } from "@/controller/convert";
import { useState } from "react";
import { Queue } from "@/@types/queue";
import { QueueContext } from "@/controller/context/queue";

const Controller = () => {
  const [queue, setQueue] = useState<Queue[]>();
  return (
    <QueueContext value={{ queue, setQueue }}>
      <div>
        <Convert />
      </div>
    </QueueContext>
  );
};
export { Controller };
