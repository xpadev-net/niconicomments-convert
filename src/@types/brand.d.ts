export type UUID = string & { readonly UUID: unique symbol };
/**
 * (sm|so)?[0-9]+
 */
export type NicoId = string & { readonly NicoId: unique symbol };
