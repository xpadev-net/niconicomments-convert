import { createContext } from "react";
import type { ReactNode } from "react";
import { Message } from "@/@types/types";

type messageContext = {
  setMessage?: (message: Message) => void;
  message?: Message;
};

type contextProps = {
  children: ReactNode;
  value?: messageContext;
};

export const messageContext = createContext<messageContext>({});

/**
 * レイヤー用コンテクスト
 * @param props
 * @constructor
 */
const MessageContext = (props: contextProps): JSX.Element => {
  return (
    <messageContext.Provider value={props.value || {}}>
      {props.children}
    </messageContext.Provider>
  );
};

export { MessageContext };
