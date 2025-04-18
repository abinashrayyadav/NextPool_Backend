const { ApiError } = require("../utils/index");
const { logger } = require("../services");

const errorHandler = (err, req, res, next) => {
  const error = {
    message: err.message || "Something went wrong!",
    errors: err.errors || [],
    stack: err.stack,
    statusCode: err.statusCode,
  };
  const logLevel = error.statusCode >= 500 ? "error" : "warn";
  logger[logLevel](error.message, { error });

  // Return structured API response
  return res.status(error.statusCode).json(error);
};

module.exports = errorHandler;
