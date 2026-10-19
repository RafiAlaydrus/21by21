import { createContext, useContext } from 'react';

export type LogKind =
  | 'drink' | 'supplement' | 'cardio' | 'sleep' | 'craving' | 'checkin' | 'weighin' | 'measurements'
  | 'photo' | 'soreness' | 'steps' | 'tag' | 'note' | 'reminder' | 'custom' | 'startSession';

export interface LogProps { id?: string; dayKey?: string; trackerId?: string; label?: string }
export interface LoggerApi {
  quick: (dayKey?: string) => void;
  open: (kind: LogKind, props?: LogProps) => void;
  close: () => void;
}
export const LoggerCtx = createContext<LoggerApi>({ quick: () => {}, open: () => {}, close: () => {} });
export const useLogger = () => useContext(LoggerCtx);
