const jwt = require("jsonwebtoken");
const { User } = require("../models");
const { ApiError, asyncHandler } = require("../utils");

const { ACCESS_TOKEN_SECRET } = process.env;

exports.verifyJWT = asyncHandler(async (req, res, next) => {
  const token =
    req.cookies?.accessToken || req.headers["Authorization"]?.split(" ")[1];

  if (!token) throw new ApiError(401, "Unauthorized Requests");

  try {
    const decodedToken = jwt.verify(token, ACCESS_TOKEN_SECRET);

    const user = await User.findById(decodedToken.id).select("-accessToken");
    if (!user) throw new ApiError(401, "Invalid Access Token");

    req.user = user;
    next();
  } catch (error) {
    throw new ApiError(401, "Invalid Access Token");
  }
});
