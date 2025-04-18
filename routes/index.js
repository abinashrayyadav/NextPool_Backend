const authRouter = require("./auth.routes");
const jdRouter = require("./jd.routes");
const WebhookRouter = require("./webhooks.routes");
const extensionRouter = require("./ext.routes");
const resumeRouter = require("./resume.routes");

module.exports = {
  authRouter,
  jdRouter,
  WebhookRouter,
  extensionRouter,
  resumeRouter,
};
