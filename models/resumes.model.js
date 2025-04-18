const { default: mongoose } = require("mongoose");
const {
  educationalQualificationsSchema,
  SALARY_RANGE_DURATION_ENUM,
  SALARY_RANGE_DURATION,
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
  duration: {
    type: String,
    enum: SALARY_RANGE_DURATION_ENUM,
    // default: SALARY_RANGE_DURATION.ANNUALLY,
  },
});

const currentCompanyDetails = new Schema({
  companyName: {
    type: String,
    // required: true,
    default: "Not Applicable",
  },
  designation: {
    type: String,
    default: "Not Applicable",
    // required: true,
  },
});

const ctcDetails = new Schema({
  currentCTC: {
    type: salarySchema,
    default: () => ({}),
  },
  // Be defaulyt, it should be treated as minimum expected CTC
  expectedCTC: {
    type: salarySchema,
    default: () => ({}),
  },

});

const employmentHistorySchema = new Schema({
  companyName: {
    type: String,
    required: true,
  },
  designation: {
    type: String,
    required: true,
  },
  startDate: {
    type: Date,
    // required: true,
    default: null,
  },
  endDate: {
    type: String,
    default: null,
  },
  workExperienceDescription: {
    type: String,
    // required: true,
    default: "Not Provided",
  },
  skillsUsedInRole: {
    type: [String],
    required: true,
  },
});

const totalExperienceSchema = new Schema({
  years: {
    type: Number,
    required: true,
  },
  months: {
    type: Number,
    required: true,
  },
});

const analysedSkillsSchema = new Schema({
  advanced: {
    type: [String],
  },
  medium: {
    type: [String],
  },
  basic: {
    type: [String],
  },
});

const personalProjectsSchema = new Schema(
  {
    projectName: {
      type: String,
      // required: true,
    },
    projectDescription: {
      type: String,
      // required: true,
    },
    projectLink: {
      type: String,
      // required: true,
    },
    skillsUsedInProject: {
      type: [String],
      // required: true,
    },
  },
  {
    timestamps: true,
  },
);

const certificationsSchema = new Schema(
  {
    name: {
      type: String,
      // required: true,
    },
    issuingAuthority: {
      type: String,
      // required: true,
    },
    certificateLink: {
      type: String,
      // required
    },
    certificateCredentialID: {
      type: String,
      // required
    },
  },
  {
    timestamps: true,
  },
);

const socialProfilesSchema = new Schema(
  {
    platform: {
      type: String,
      // required: true,
    },
    url: {
      type: String,
      // required: true,
    },
  },
  {
    timestamps: true,
  },
);

const redFlagsSchema = new Schema(
  {
    containsMistakes: {
      type: Boolean,
    },
    containsMistakesDescription: {
      type: String,
    },
    frequentJobSwitcher: {
      type: Boolean,
    },
    frequentJobSwitcherDescription: {
      type: String,
    },
    overstatedAchievements: {
      type: Boolean,
    },
    overstatedAchievementsDescription: {
      type: String,
    },
    employmentGap: {
      type: Boolean,
    },
    employmentGapDescription: {
      type: String,
    },
    incompleteEducation: {
      type: Boolean,
    },
    incompleteEducationDescription: {
      type: String,
    },
    lackOfRoleProgression: {
      type: Boolean,
    },
    lackOfRoleProgressionDescription: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

const resumeSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxLength: 255,
    },
    email: {
      type: String,
      // required: true,
      trim: true,
      lowercase: true,
      maxLength: 255,
    },
    phoneNumber: {
      type: String,
      // required: true,
      trim: true,
      maxLength: 255,
    },
    languagesKnown: {
      type: [String],
    },
    resumeLink: {
      type: String,
      trim: true,
      maxLength: 255,
    },
    relocationDetails: [String],
    currentCompanyDetails: {
      type: currentCompanyDetails,
    },
    employmentHistory: {
      type: [employmentHistorySchema],
      required: true,
    },
    ctcDetails: {
      type: ctcDetails,
      // required: true,
    },
    totalExperience: {
      type: totalExperienceSchema,
    },
    skills: {
      type: [String],
    },
    analysedSkills: {
      type: analysedSkillsSchema,
    },
    educationalBackground: {
      type: [educationalQualificationsSchema],
    },
    personalProjects: {
      type: [personalProjectsSchema],
    },
    certifications: {
      type: [certificationsSchema],
    },
    socialProfiles: {
      type: [socialProfilesSchema],
    },
    redFlags: {
      type: redFlagsSchema,
    },
    currentNoticePeriod: {
      type: Number,
      default: 30
    },
    resumeJDMemberships: [
      {
        type: Schema.Types.ObjectId,
        ref: "resumeJdMembership",
      },
    ],
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("resume", resumeSchema);
