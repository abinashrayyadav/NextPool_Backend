const { default: mongoose } = require("mongoose");
const { Schema } = mongoose;

const AppInstanceSchema = new Schema(
  {
    name: {
      type: String,
      default: "Drive",
    },
    status: {
      type: String,
      default: "active",
      enum: ["active", "uninstalled"],
    },
    connectionMeta: {
      connectedAt: {
        type: Date,
        default: Date.now,
      },
      tokenObj: {
        type: Object,
      },
      externalAccountUsed: {
        type: Object,
      },
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("app_instances", AppInstanceSchema);
