const jwt = require("jsonwebtoken");

const { CUSTOM_TOKEN_SECRET } = process.env;

exports.createCustomJwt = (payload, expiresIn = "5m") => {
  return jwt.sign(payload, CUSTOM_TOKEN_SECRET, {
    expiresIn,
  });
};

exports.verifyCustomJWT = (token) => {
  return jwt.verify(token, CUSTOM_TOKEN_SECRET);
};
