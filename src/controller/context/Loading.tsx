import { createContext } from "react";
import type { ReactNode } from "react";
import { Message } from "@/@types/types";

type loadingContext = {
  setIsLoading?: (isLoading: boolean) => void;
  isLoading?: boolean;
};

type contextProps = {
  children: ReactNode;
  value?: loadingContext;
};

export const loadingContext = createContext<loadingContext>({});

/**
 * レイヤー用コンテクスト
 * @param props
 * @constructor
 */
const LoadingContext = (props: contextProps): JSX.Element => {
  return (
    <loadingContext.Provider value={props.value || {}}>
      {props.children}
    </loadingContext.Provider>
  );
};

export { LoadingContext };
