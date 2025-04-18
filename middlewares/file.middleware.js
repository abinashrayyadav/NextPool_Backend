const fileUpload = require("express-fileupload");
const { ApiError } = require("../utils");

const fileUploadHandler = fileUpload({
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  preservePath: true,
  abortOnLimit: true,
  safeFileNames: true,
  preserveExtension: true,
  createParentPath: true,
  useTempFiles: true,
  tempFileDir: "/tmp/",
  debug: false,
  limitHandler: (req, res, next) => {
    throw new ApiError(413, "File size limit exceeded");
  },
});

module.exports = fileUploadHandler;
