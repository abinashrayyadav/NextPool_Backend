const { google } = require("googleapis");

const {
  asyncHandler,
  CustomJwtToken,
  ApiResponse,
  ApiError,
} = require("../../utils");
const { AppInstance } = require("../../models");

const {
  DRIVE_CLIENT_ID,
  DRIVE_CLIENT_SECRET,
  DRIVE_CALLBACK_URL,
  CLIENT_SSO_REDIRECT_URL,
} = process.env;

const DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/userinfo.profile",
];

exports.getDriveOAuthURl = asyncHandler(async (req, res, next) => {
  const oauth2Client = new google.auth.OAuth2(
    DRIVE_CLIENT_ID,
    DRIVE_CLIENT_SECRET,
    DRIVE_CALLBACK_URL,
  );

  const state = CustomJwtToken.createCustomJwt({
    user_id: req.user._id,
  });

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: DRIVE_SCOPES,
    prompt: "consent",
    state,
  });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { redirect_url: url },
        "Drive OAuth URL generated successfully!",
      ),
    );
});

exports.handleDriveCallback = asyncHandler(async (req, res, next) => {
  const oauth2Client = new google.auth.OAuth2(
    DRIVE_CLIENT_ID,
    DRIVE_CLIENT_SECRET,
    DRIVE_CALLBACK_URL,
  );

  const { code, state } = req.query;

  const { user_id } = CustomJwtToken.verifyCustomJWT(state);

  const { tokens, res: result } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  //   Get Profile Of Drive User

  const drive = google.drive({ version: "v3", auth: oauth2Client });

  const profile = await drive.about.get({
    fields: "user",
  });

  const isDriveAccountAlreadyUsed = await AppInstance.findOne({
    "connectionMeta.externalAccountUsed.email": profile.data.user.emailAddress,
  }).lean();

  if (isDriveAccountAlreadyUsed) {
    return res
      .status(200)
      .redirect(
        CLIENT_SSO_REDIRECT_URL +
          "/error?status=400&message=Drive account already connected",
      );
  }

  const newAppInstance = await AppInstance.create({
    name: "Drive",
    connectionMeta: {
      tokenObj: tokens,
      externalAccountUsed: {
        email: profile.data.user.emailAddress,
        name: profile.data.user.displayName,
        avatar: profile.data.user.photoLink,
      },
    },
    createdBy: user_id,
  });

  if (!newAppInstance) {
    throw new ApiError(500, "Something went wrong in creating app instance");
  }

  return res
    .status(200)
    .redirect(CLIENT_SSO_REDIRECT_URL + "/dashboard?isAuth=true");
});
