import { PL } from './pl';

/** Klucz słownika — wszystko, co ma polską wersję (pl.ts jest źródłem prawdy). */
export type StringKey = keyof typeof PL;
