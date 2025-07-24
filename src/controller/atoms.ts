import { atom } from "jotai";

import type { Message } from "@/@types/types";

const messageAtom = atom<Message | undefined>(undefined);
const isLoadingAtom = atom(false);
export { isLoadingAtom, messageAtom };
