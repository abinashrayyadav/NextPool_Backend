const router = require("express").Router();
const passport = require("passport");

const { AuthController } = require("../controllers");
const { CustomJwtToken, validateRoute } = require("../utils");
const { AuthValidators } = require("../validators");
const { verifyJWT } = require("../middlewares");
const DriveService = require("../apps/drive/drive.oauth.service");

router.get("/me", verifyJWT, AuthController.getCurrentUser);

router.patch(
  "/profile",
  AuthValidators.updateProfileValidator(),
  validateRoute,
  verifyJWT,
  AuthController.updateUserProfile,
);

router.delete(
  "/integration",
  AuthValidators.deleteAppInstanceValidator(),
  validateRoute,
  verifyJWT,
  AuthController.deleteAppInstanceById,
);

// Google OAuth Routes
router.get("/google", (req, res, next) => {
  const { redirect_url, withDrive = 0 } = req.query;
  const token = CustomJwtToken.createCustomJwt({
    redirect_url,
    withDrive,
  });

  const scopes = ["profile", "email"];

  if (withDrive === "1") {
    scopes.push(
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/userinfo.profile",
    );
  }

  passport.authenticate("google", {
    scope: scopes,
    state: token,
    failureRedirect: process.env.CLIENT_SSO_REDIRECT_URL,
  })(req, res, next);
});

// Google OAuth Callback Route
router.get(
  "/google.oauth.callback",
  (req, res, next) => {
    const token = req.query.state;
    const { redirect_url } = CustomJwtToken.verifyCustomJWT(token);

    passport.authenticate("google", {
      failureRedirect: redirect_url + "/login",
    })(req, res, next);
  },
  AuthController.handleSocialLogin,
);

// Logout Route
router.post("/logout", verifyJWT, AuthController.logout);

// Drive add instance route
router.get("/drive.add", verifyJWT, DriveService.getDriveOAuthURl);

// Drive add instance callback route
router.get("/drive.callback", DriveService.handleDriveCallback);

module.exports = router;
