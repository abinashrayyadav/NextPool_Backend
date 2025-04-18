const winston = require("winston");

const { combine, timestamp, json, errors, printf, colorize } = winston.format;

const { LOG_LEVEL } = process.env;

const format = combine(
  timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  errors({ stack: true }),
  json(),
);

const colors = {
  error: "red",
  warn: "yellow",
  info: "green",
  http: "cyan",
  verbose: "blue",
  debug: "magenta",
  silly: "grey",
};

winston.addColors(colors);

const consoleFormat = printf(
  ({ level, message, timestamp, metadata, stack, ...rest }) => {
    const colorizer = colorize();

    if (level === "http") {
      const {
        method = "N/A",
        url = "N/A",
        status = "N/A",
        responseTime = 0,
      } = metadata || {};
      return colorizer.colorize(
        level,
        `${timestamp} [${level}]: ${method} ${url} ${status} ${responseTime}ms`,
      );
    }

    const metaInfo = metadata ? JSON.stringify(metadata) : "";
    const stackTrace = stack ? `\nStack: ${stack}` : "";

    const restString =
      JSON.stringify(
        rest,
        (key, value) => (typeof value === "symbol" ? value.toString() : value),
        2,
      ) || "";

    return colorizer.colorize(
      level,
      `${timestamp} [${level}]: ${message} ${metaInfo}${stackTrace} ${restString === "{}" ? "" : restString}`,
    );
  },
);

const logger = winston.createLogger({
  level: LOG_LEVEL || "info",
  format,
  transports: [
    new winston.transports.Console({
      format: combine(
        timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        consoleFormat,
      ),
    }),
  ],
  exitOnError: false, // Avoid crashing on error
});

module.exports = logger;
