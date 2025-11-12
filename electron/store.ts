import * as ElectronStore from "electron-store";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-expect-error
const store = new ElectronStore() as ElectronStore<Record<string, unknown>>;
export { store };
