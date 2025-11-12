import * as ElectronStore from "electron-store";

const store = new ElectronStore() as ElectronStore<Record<string, unknown>>;
export { store };
