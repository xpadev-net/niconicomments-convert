import type { Message } from "@/@types/types";
import { atom } from "jotai";
const messageAtom = atom<Message | undefined>(undefined);
const isLoadingAtom = atom(false);
export { messageAtom, isLoadingAtom };
