const mongoose = require("mongoose");

const jobDescription = `
About the job
Optum is a global organization that delivers care, aided by technology to help millions of people live healthier lives. The work you do with our team will directly improve health outcomes by connecting people with the care, pharmacy benefits, data and resources they need to feel their best. Here, you will find a culture guided by diversity and inclusion, talented peers, comprehensive benefits and career development opportunities. Come make an impact on the communities we serve as you help us advance health equity on a global scale. Join us to start Caring. Connecting. Growing together.

We are a dynamic and innovative team specializing in workflow automation software. Our flagship product, Sophia, is a cutting-edge tool that enables non-technical business teams to construct and automate Standard Operating Procedure (SOP) documents for manual Claims Processors. Our software streamlines the claims adjudication process by providing processors with the information they need without the need to sift through long documents.

We are seeking a talented and motivated Full Stack Software Engineer to join our team. A successful candidate will play a key role in designing, developing, and implementing new features for the Sophia platform.

Primary Responsibilities

Participate in the entire application lifecycle, focusing on coding and debugging
Write clean, maintainable, and efficient code
Collaborate with the team to design and launch new features
Maintain and improve the performance of existing software
Clearly and regularly communicate with management and technical support colleagues
Participate in our agile development process, Scrum
Comply with the terms and conditions of the employment contract, company policies and procedures, and any and all directives (such as, but not limited to, transfer and/or re-assignment to different work locations, change in teams and/or work shifts, policies in regards to flexibility of work benefits and/or work environment, alternative work arrangements, and other decisions that may arise due to the changing business environment). The Company may adopt, vary or rescind these policies and directives in its absolute discretion and without any limitation (implied or otherwise) on its ability to do so

Required Qualifications

Proven experience as a Software Engineer or similar role
Experience with backend API development, NodeJS
MongoDB and experience designing and maintaining databases
Solid proficiency with JavaScript and familiarity with React
Understanding of fundamental design principles behind scalable applications
Proven excellent analytical and problem-solving skills
Solid team player with excellent communication and interpersonal skills
A quick learner who is excited about learning new programming languages and technologies
CI/CD framework with Kubeernates, Jenkins

At UnitedHealth Group, our mission is to help people live healthier lives and make the health system work better for everyone. We believe everyone-of every race, gender, sexuality, age, location and income-deserves the opportunity to live their healthiest life. Today, however, there are still far too many barriers to good health which are disproportionately experienced by people of color, historically marginalized groups and those with lower incomes. We are committed to mitigating our impact on the environment and enabling and delivering equitable care that addresses health disparities and improves health outcomes — an enterprise priority reflected in our mission..
`;

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "None",
};

const CROSS_ORIGIN_LIST = process.env.ALLOWED_ORIGIN.split(",");

// Statuses for Processing Resumes
const RESUME_PROCESSING_STATUSES = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  MATCHING: "MATCHING",
  DONE: "DONE",
  ERROR: "ERROR",
};

const RESUME_PROCESSING_STATUSES_ENUM = Object.values(
  RESUME_PROCESSING_STATUSES,
);

const JOB_DESCRIPTION_STATUSES = {
  PROCESSING: "PROCESSING",
  DONE: "DONE",
};

const JOB_DESCRIPTION_STATUSES_ENUM = Object.values(JOB_DESCRIPTION_STATUSES);

const educationalQualificationsSchema = new mongoose.Schema({
  educationType: {
    type: String,
    required: true,
    enum: [
      "high_school",
      "intermediate",
      "diploma",
      "bachelors",
      "masters",
      "phd",
    ],
  },
  institutionName: {
    type: String,
    required: true,
  },
  startDate: {
    // type: Date,
    // required: true,
    type: String,
  },
  endDate: {
    type: String,
    // required: true,
  },
  fieldOfStudy: {
    type: String,
    // required: true,
  },
  scoreAchieved: {
    type: String,
  },
});

const RESUME_SOURCES = {
  MANNUAL: "MANNUAL",
  DRIVE: "DRIVE",
};

const RESUME_SOURCES_ENUM = Object.values(RESUME_SOURCES);

// For Entire Compentency Weights
const DEFAULT_JD_WEIGHTS = {
  jobTitle: 10,
  primaryResponsibilities: 25,
  educationalQualifications: 5,

  // All Skills should add up to 60
  coreSkills: 40,
  goodToHaveSkills: 20,
};

const FLAGS_TABLE_WEIGHTS = {
  GREEN_FLAG: 50,
  RED_FLAG: 50,
};

const JOB_DEPARTMENTS = {
  ADMINISTRATION: "Administration",
  HUMAN_RESOURCE_DEPARTMENT: "Human Resource Department",
  FINANCE_AND_ACCOUNTS_DEPARTMENT: "Finance and Accounts Department",
  MARKETING_DEPARTMENT: "Marketing Department",
  SALES: "Sales",
  IT_DEPARTMENT: "IT Department",
  RESEARCH_AND_DEVELOPMENT: "Research and Development",
  CUSTOMER_SERVICE_DEPARTMENT: "Customer Service Department",
  LEGAL_DEPARTMENT: "The Legal Department",
};

const JOB_DEPARTMENTS_ENUM = Object.keys(JOB_DEPARTMENTS);

const JOB_LEVELS = {
  INTERN: "Intern",
  ASSOCIATE: "Associate",
  JUNIOR: "Junior",
  SENIOR: "Senior",
  LEAD: "Lead",
  MANAGER: "Manager",
  DIRECTOR: "Director",
  VP: "VP",
  EXECUTIVE: "Executive",
};

const JOB_LEVELS_ENUM = Object.keys(JOB_LEVELS);

const JOB_LOCATION = {
  REMOTE: "Remote",
  IN_OFFICE: "In Office",
  HYBRID: "Hybrid",
};

const JOB_LOCATION_ENUM = Object.keys(JOB_LOCATION);

const JOB_TYPES = {
  FULL_TIME: "Full Time",
  PART_TIME: "Part Time",
  CONTRACT: "Contract",
};

const JOB_TYPES_ENUM = Object.keys(JOB_TYPES);

const DEGREE_TYPES = {
  HIGH_SCHOOL: "High School",
  INTERMEDIATE: "Intermediate",
  DIPLOMA: "Diploma",
  BACHELORS: "Bachelors",
  MASTERS: "Masters",
  PHD: "PhD",
};

const DEGREE_TYPES_ENUM = Object.keys(DEGREE_TYPES);

const SALARY_RANGE_DURATION = {
  HOURLY: "Hourly",
  WEEKLY: "Weekly",
  DAYLY: "Daily",
  MONTHLY: "Monthly",
  ANNUALLY: "Annually",
};

const SALARY_RANGE_DURATION_ENUM = Object.keys(SALARY_RANGE_DURATION);

const JD_SOURCES = {
  TEXT: "TEXT",
  FILE: "FILE",
  LINKEDIN: "LINKEDIN",
  DEFAULT: "DEFAULT",
};

const JD_SOURCES_ENUM = Object.keys(JD_SOURCES);

const GOOGLE_DRIVE_URL_TYPES = {
  FOLDER: "FOLDER",
  FILE: "FILE",
};

const GOOGLE_DRIVE_URL_TYPES_ENUM = Object.keys(GOOGLE_DRIVE_URL_TYPES);

module.exports = {
  jobDescription,
  educationalQualificationsSchema,
  COOKIE_OPTIONS,
  CROSS_ORIGIN_LIST,
  RESUME_PROCESSING_STATUSES,
  RESUME_PROCESSING_STATUSES_ENUM,
  JOB_DESCRIPTION_STATUSES,
  JOB_DESCRIPTION_STATUSES_ENUM,
  RESUME_SOURCES,
  RESUME_SOURCES_ENUM,
  DEFAULT_JD_WEIGHTS,
  FLAGS_TABLE_WEIGHTS,
  JOB_DEPARTMENTS,
  JOB_DEPARTMENTS_ENUM,
  JOB_LEVELS,
  JOB_LEVELS_ENUM,
  JOB_LOCATION,
  JOB_LOCATION_ENUM,
  JOB_TYPES,
  JOB_TYPES_ENUM,
  DEGREE_TYPES_ENUM,
  SALARY_RANGE_DURATION,
  SALARY_RANGE_DURATION_ENUM,
  JD_SOURCES,
  JD_SOURCES_ENUM,
  GOOGLE_DRIVE_URL_TYPES,
  GOOGLE_DRIVE_URL_TYPES_ENUM,
};
