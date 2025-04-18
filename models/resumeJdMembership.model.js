const { default: mongoose } = require("mongoose");
const mongooseAggregatePaginate = require("mongoose-aggregate-paginate-v2");
const {
  RESUME_PROCESSING_STATUSES_ENUM,
  RESUME_PROCESSING_STATUSES,
} = require("../constants");

const { Schema } = mongoose;

const resumeJDMembership = new Schema(
  {
    resumeFileName: {
      type: String,
      required: true,
    },
    resumePath: {
      type: String,
      required: true,
    },
    jdId: {
      type: Schema.Types.ObjectId,
      ref: "jobDescription",
      required: true,
    },
    status: {
      enum: RESUME_PROCESSING_STATUSES_ENUM,
      default: RESUME_PROCESSING_STATUSES.PENDING,
      type: String,
    },
    metaData: {
      type: Object,
    },
    parsedResumeContent: {
      type: String,
    },
    resumeId: {
      type: Schema.Types.ObjectId,
      ref: "resume",
    },
    matchResult: {
      type: Object,
    },
    parsingError: {
      type: Object,
    },
  },
  {
    timestamps: true,
  },
);

resumeJDMembership.index({ jdId: 1, resumeId: 1 });

// Create a post save hook such that, if status is updated from DONE to any other status, then update the scores to null
resumeJDMembership.post("save", async function (doc) {
  if (doc.status !== RESUME_PROCESSING_STATUSES.DONE) {
    await doc.updateOne({ scores: null });
  }
});

resumeJDMembership.plugin(mongooseAggregatePaginate);

module.exports = mongoose.model("resumeJdMembership", resumeJDMembership);
