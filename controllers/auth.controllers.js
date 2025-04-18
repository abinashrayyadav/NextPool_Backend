const { User, AppInstance } = require("../models");
const DriveService = require("../apps/drive/drive.oauth.service");

const {
  asyncHandler,
  ApiError,
  ApiResponse,
  CustomJwtToken,
} = require("../utils");
const { COOKIE_OPTIONS } = require("../constants");

const { CLIENT_SSO_REDIRECT_URL } = process.env;

// Generate Access and Refresh Tokens for the user
const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    user.accessToken = accessToken;

    await user.save({ validateBeforeSave: false });
    return { accessToken };
  } catch (error) {
    throw new ApiError(500, "Something went wrong in generating tokens");
  }
};

exports.getCurrentUser = asyncHandler(async (req, res) => {
  const driveConnection = await AppInstance.findOne({
    createdBy: req.user._id,
  })
    .select("-connectionMeta.tokenObj")
    .lean();

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        ...req.user.toJSON(),
        driveConnection,
      },
      "Profile fetched successfully!",
    ),
  );
});

exports.handleSocialLogin = asyncHandler(async (req, res) => {
  const token = req.query.state;
  const { withDrive } = CustomJwtToken.verifyCustomJWT(token);

  const user = await User.findById(req.user._id);

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  const { accessToken } = await generateAccessAndRefreshTokens(user._id);

  let redirect_path = CLIENT_SSO_REDIRECT_URL + "/dashboard?isAuth=true";

  if (withDrive) {
    redirect_path += "&closeWindow=true";
  }

  return res
    .status(301)
    .cookie("isAuthenticated", true, COOKIE_OPTIONS)
    .cookie("accessToken", accessToken, COOKIE_OPTIONS)
    .redirect(redirect_path);
});

exports.logout = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  user.accessToken = null;

  await user.save({ validateBeforeSave: false });

  return res
    .status(301)
    .clearCookie("isAuthenticated", COOKIE_OPTIONS)
    .clearCookie("accessToken", COOKIE_OPTIONS)
    .json(new ApiResponse(200, {}, "User logged out"));
});

exports.handleAddDriveInstanceConnection = asyncHandler(
  async (req, res, next) => {
    const isAppInstanceExists = await AppInstance.findOne({
      createdBy: req.user._id,
    }).lean();

    if (isAppInstanceExists) {
      throw new ApiError(400, "Drive instance already connected");
    }

    return DriveService.getDriveOAuthURl(req, res, next);
  },
);

exports.updateUserProfile = asyncHandler(async (req, res, next) => {
  const { name } = req.body;

  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        name,
      },
    },
    {
      new: true,
    },
  )
    .select("-accessToken")
    .lean();

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  const driveConnection = await AppInstance.findOne({
    createdBy: req.user._id,
  }).lean();

  return res
    .status(201)
    .json(
      new ApiResponse(
        201,
        { ...user, driveConnection },
        "Profile updated successfully!",
      ),
    );
});

exports.deleteAppInstanceById = asyncHandler(async (req, res, next) => {
  const { appId } = req.query;

  const appInstance = await AppInstance.findOneAndDelete({
    createdBy: req.user._id,
    _id: appId,
  }).lean();

  if (!appInstance) {
    throw new ApiError(404, "AppInstance/Integration does not exist");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, {}, "Integration removed successfully!"));
});
