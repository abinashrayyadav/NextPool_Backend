const mongoose = require("mongoose");
const passport = require("passport");
const { Strategy: GoogleStrategy } = require("passport-google-oauth20");
const { User, AppInstance, JobDescription } = require("../models");
const { ApiError, CustomJwtToken } = require("../utils");
const { logger } = require("../services");
const { JD_SOURCES } = require("../constants");

const {
  DRIVE_CLIENT_ID,
  DRIVE_CLIENT_SECRET,
  GOOGLE_AUTH_CALLBACK_URL,
  DEFAULT_JD_IDS,
} = process.env;

const GOOGLE_STRATEGY_OPTIONS = {
  clientID: DRIVE_CLIENT_ID,
  clientSecret: DRIVE_CLIENT_SECRET,
  callbackURL: GOOGLE_AUTH_CALLBACK_URL,
};

try {
  passport.serializeUser((user, next) => {
    next(null, user);
  });

  //Deserialize the User
  passport.deserializeUser(async (id, next) => {
    try {
      const user = await User.findById(id);
      if (user) next(null, user);
      else next(new ApiError(404, "User not found"), null);
    } catch (error) {
      next(
        new ApiError(
          500,
          "Something went wrong while deserializing the user" + error,
        ),
        null,
      );
    }
  });

  passport.use(
    new GoogleStrategy(
      {
        ...GOOGLE_STRATEGY_OPTIONS,
        passReqToCallback: true,
      },
      async (req, access_token, refresh_token, profile, next) => {
        try {
          const { email, name, picture: avatar } = profile._json;

          // Find or create user in a single operation
          const user = await User.findOneAndUpdate(
            { email },
            { $setOnInsert: { name }, avatar },
            { new: true, upsert: true, setDefaultsOnInsert: true },
          );

          if (user.updatedAt.toString() === user.createdAt.toString()) {
            try {
              const objectIds = DEFAULT_JD_IDS?.split(",").map(
                (id) => new mongoose.Types.ObjectId(id),
              );
              const jobDescriptions = await JobDescription.find({
                _id: { $in: objectIds },
              });

              const clonedJDs = jobDescriptions.map((jd) => {
                const jdObject = jd.toObject();
                delete jdObject._id;
                jdObject.postedBy = user._id;
                jdObject.jdSource = JD_SOURCES.DEFAULT;
                return jdObject;
              });

              await JobDescription.insertMany(clonedJDs);
            } catch (err) {
              logger.info("Error Occured while creating default Jds");
            }
          }

          const token = req.query.state;

          const { withDrive } = CustomJwtToken.verifyCustomJWT(token);

          if (withDrive) {
            const isDriveAccountAlreadyUsed = await AppInstance.findOne({
              "connectionMeta.externalAccountUsed.email": email,
            }).lean();

            if (isDriveAccountAlreadyUsed) {
              logger.warn("Drive account is already used", {
                isDriveAccountAlreadyUsed,
                user,
                profile,
                query: req.query,
              });
              throw new ApiError(400, "Drive account is already used.");
            }

            await AppInstance.create({
              name: "Drive",
              connectionMeta: {
                tokenObj: {
                  access_token,
                  refresh_token,
                },
                externalAccountUsed: {
                  email,
                  name,
                  avatar,
                },
              },
              createdBy: user._id,
            });
          }

          return next(null, user);
        } catch (error) {
          logger.error("Error in Google Strategy:", { error });
          return next(error);
        }
      },
    ),
  );
} catch (error) {
  logger.error("Error in setting up Passport Strategies", { error });
}
