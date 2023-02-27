import { atom } from "jotai";
import { Message } from "@/@types/types";
const messageAtom = atom<Message | undefined>(undefined);
const isLoadingAtom = atom(false);
export { messageAtom, isLoadingAtom };
