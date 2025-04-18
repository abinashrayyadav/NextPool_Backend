const { default: mongoose } = require("mongoose");
const _ = require("lodash");
const mongooseAggregatePaginate = require("mongoose-aggregate-paginate-v2");
const {
  RESUME_SOURCES_ENUM,
  JOB_DEPARTMENTS_ENUM,
  JOB_LEVELS_ENUM,
  JOB_LOCATION_ENUM,
  JOB_TYPES_ENUM,
  DEGREE_TYPES_ENUM,
  SALARY_RANGE_DURATION_ENUM,
  DEFAULT_JD_WEIGHTS,
  JD_SOURCES_ENUM,
  JD_SOURCES,
} = require("../constants");

const { Schema } = mongoose;

const salarySchema = new Schema({
  min: {
    type: Number,
    default: 0,
  },
  max: {
    type: Number,
    default: 0,
  },
  currency: {
    type: String,
    default: "INR",
  },
  negotiable: {
    type: Boolean,
    default: false,
  },
  duration: {
    type: String,
    enum: SALARY_RANGE_DURATION_ENUM,
  },
});

const experienceSchema = new Schema({
  min: {
    type: Number,
    required: true,
  },
  max: {
    type: Number,
    required: true,
  },
});

const educationalQualificationsSchema = new Schema({
  degreeType: {
    type: String,
    enum: DEGREE_TYPES_ENUM,
  },
  major: {
    type: String,
    default: "",
  },
  relatedFieldAccepted: {
    type: Boolean,
    default: false,
  },
});

const weightsSchema = new Schema(
  {
    ...Object.keys(DEFAULT_JD_WEIGHTS).reduce((acc, key) => {
      acc[key] = {
        type: Number,
        default: DEFAULT_JD_WEIGHTS[key],
      };
      return acc;
    }, {}),
  },
  {
    timestamps: true,
  },
);

const jobDescriptionSchema = new Schema(
  {
    // The title of the position
    jobTitle: {
      type: String,
      required: true,
      trim: true,
      maxLength: 255,
    },
    // Seniority level of the position
    jobLevel: {
      type: String,
      required: true,
      trim: true,
      enum: JOB_LEVELS_ENUM,
    },
    // Department under which the position falls
    jobDepartment: {
      type: String,
      trim: true,
      enum: JOB_DEPARTMENTS_ENUM,
    },
    // Location of the job (e.g., remote, in-office)
    jobLocation: {
      type: String,
      required: true,
      trim: true,
      enum: JOB_LOCATION_ENUM,
    },
    geographicJobLocations: {
      type: [String],
    },
    // Employment type (e.g., full-time, part-time, contract)
    jobType: {
      type: String,
      required: true,
      trim: true,
      enum: JOB_TYPES_ENUM,
    },
    // The salary range for the position
    salaryRange: {
      type: salarySchema,
      required: true,
    },
    joiningAvailability: {
      type: Number,
      default: 0,
    },
    // Key tasks and responsibilities of the role - Ex-Manage product roadmap, lead teams
    primaryResponsibilities: {
      type: [String],
      required: true,
    },
    // Skills required - jinke binah job nahi chalega
    coreSkills: {
      type: [String],
      required: true,
    },
    // Skills that are not mandatory but are nice to have
    mandatorySkills: {
      type: [String],
    },
    goodToHaveSkills: {
      type: [String],
    },
    softSkills: {
      type: [String],
    },
    experience: {
      type: experienceSchema,
      required: true,
    },
    // THis is to be discuessed how to store this.
    educationalQualifications: {
      type: educationalQualificationsSchema,
      required: true,
    },
    postedBy: {
      type: Schema.Types.ObjectId,
      ref: "user",
    },
    providedJobDescription: {
      type: String,
      required: true,
    },
    automaticDataCollectionEnabled: {
      type: Boolean,
      default: false,
    },
    resumeSource: {
      type: String,
      enum: RESUME_SOURCES_ENUM,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    resumeSourceMeta: {
      type: Object,
    },
    weights: {
      type: weightsSchema,
      default: () => ({}),
    },
    metaData: {
      type: Object,
    },
    jdSource: {
      type: String,
      enum: JD_SOURCES_ENUM,
      default: JD_SOURCES.TEXT,
    },
    jdFileObjectUrl: {
      type: Object,
    },
    additionalInformation: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

jobDescriptionSchema.plugin(mongooseAggregatePaginate);

module.exports = mongoose.model("jobDescription", jobDescriptionSchema);
