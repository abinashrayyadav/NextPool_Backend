const fileUploadHandler = require("./file.middleware");
const errorHandler = require("./error.middleware");
const { verifyJWT } = require("./auth.middleware");
const morganMiddleware = require("./morgan.middleware");

module.exports = {
  fileUploadHandler,
  errorHandler,
  verifyJWT,
  morganMiddleware,
};
