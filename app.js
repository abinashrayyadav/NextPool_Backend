require("dotenv").config();

const express = require("express");
const cors = require("cors");
const passport = require("passport");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const path = require("path");
const AWS = require("aws-sdk");

require("./passport/index");
const { CROSS_ORIGIN_LIST } = require("./constants");
const {
  errorHandler,
  fileUploadHandler,
  morganMiddleware,
} = require("./middlewares");
const {
  authRouter,
  jdRouter,
  WebhookRouter,
  extensionRouter,
  resumeRouter,
} = require("./routes");

const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION } = process.env;

const app = express();

app.use(morganMiddleware);
app.use(express.json());
app.set("trust proxy", 1);
app.use(
  cors({
    origin: CROSS_ORIGIN_LIST,
    credentials: true,
    preflightContinue: true,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    optionsSuccessStatus: 204,
  }),
);
app.use(
  session({
    secret: process.env.CUSTOM_TOKEN_SECRET,
    resave: false,
    saveUninitialized: true,
  }),
);
app.use(passport.initialize());
app.use(passport.session());
app.use(fileUploadHandler);
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "downloads")));

AWS.config.update({
  region: AWS_REGION,
  accessKeyId: AWS_ACCESS_KEY_ID,
  secretAccessKey: AWS_SECRET_ACCESS_KEY,
});

app.get("/", (_, res) => {
  return res.status(200).json({ message: "Working fine" });
});
app.use("/api/v1/webhooks", WebhookRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/jd", jdRouter);
app.use("/api/v1/resume", resumeRouter);
// app.use("/api/v1/ext", extensionRouter);

app.use(errorHandler);

module.exports = app;
