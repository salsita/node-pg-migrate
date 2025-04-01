export type LogFn = (msg: string) => void;

export type Logger = {
  debug?: LogFn;
  info: LogFn;
  warn: LogFn;
  error: LogFn;
};
