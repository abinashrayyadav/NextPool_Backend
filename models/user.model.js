const { default: mongoose } = require("mongoose");
const jwt = require("jsonwebtoken");

const { Schema } = mongoose;
const { ACCESS_TOKEN_SECRET, ACCESS_TOKEN_EXPIRY } = process.env;

const userSchema = new Schema(
  {
    avatar: String,
    name: {
      type: String,
      trim: true,
      minLength: 1,
      maxLength: 255,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      minLength: 5,
      maxLength: 255,
      unique: true,
    },
    accessToken: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      id: this._id,
      email: this.email,
    },
    ACCESS_TOKEN_SECRET,
    {
      expiresIn: ACCESS_TOKEN_EXPIRY,
    }
  );
};

module.exports = mongoose.model("user", userSchema);
