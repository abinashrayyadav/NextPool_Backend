const validateJobDescription = ({
  jobTitle,
  jobLevel,
  jobLocation,
  salaryRange,
  coreSkills,
  mandatorySkills,
}) => {
  if (
    !jobTitle ||
    !jobLevel ||
    !jobLocation ||
    !Array.isArray(coreSkills) ||
    !Array.isArray(mandatorySkills) ||
    !typeof salaryRange === "object"
  ) {
    return false;
  }

  return true;
};

module.exports = {
  validateJobDescription,
};
