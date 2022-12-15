import { Queue } from "@/@types/queue";
import { createContext, ReactNode } from "react";

type context = {
  setQueue?: (queue: Queue[]) => void;
  queue?: Queue[];
};
type contextProps = {
  children: ReactNode;
  value?: context;
};

const queueContext = createContext<context>({});

const QueueContext = (props: contextProps) => {
  return (
    <queueContext.Provider value={props.value || {}}>
      {props.children}
    </queueContext.Provider>
  );
};
export { queueContext, QueueContext };
