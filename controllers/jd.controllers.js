const qs = require("qs");
const { default: mongoose } = require("mongoose");
const { v4 } = require("uuid");
const { isEmpty } = require("lodash");
const fs = require("fs");
const { google } = require("googleapis");

const Agents = require("../agents");
const {
  JobDescription,
  AppInstance,
  ResumeJdMembership,
  Resume,
} = require("../models");
const { asyncHandler, ApiResponse, ApiError } = require("../utils");
const {
  MongooseHelpers: { getMongoosePaginationOptions },
  S3Helpers,
  JDHelpers,
  DriveHelpers,
  SQSHelpers,
  FileHelpers,
} = require("../helpers");
const {
  RESUME_SOURCES,
  RESUME_PROCESSING_STATUSES,
  JD_SOURCES,
  GOOGLE_DRIVE_URL_TYPES,
} = require("../constants");
const { logger } = require("../services");

const { DRIVE_CLIENT_ID, DRIVE_CLIENT_SECRET, DRIVE_CALLBACK_URL } =
  process.env;

exports.getAllJobDescriptions = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 10 } = req.query;

  const jobDescriptionsAggregate = JobDescription.aggregate([
    {
      $match: {
        postedBy: new mongoose.Types.ObjectId(req.user._id),
      },
    },
    {
      $lookup: {
        from: "resumejdmemberships",
        localField: "_id",
        foreignField: "jdId",
        as: "candidates",
      },
    },
    {
      $addFields: {
        candidateCount: { $size: "$candidates" },
      },
    },
    {
      $project: {
        candidates: 0,
        weights: 0,
      },
    },
    {
      $sort: {
        createdAt: -1,
      },
    },
  ]);

  const jobDescriptions = await JobDescription.aggregatePaginate(
    jobDescriptionsAggregate,
    getMongoosePaginationOptions({
      page,
      limit,
    }),
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        jobDescriptions,
        "Job Descriptions fetched successfully!",
      ),
    );
});

exports.createJobDescription = asyncHandler(async (req, res, next) => {
  const {
    providedAdditionalJobDescription,
    automaticDataCollectionEnabled = false,
    resumeSource,
    driveFolderId,
    jdSource,
    additionalInformation,
  } = req.body;
  const { files } = req;

  let providedJobDescription = req.body.providedJobDescription;
  let jdFileObjectUrl = null;

  const parsedFiles = qs.parse(files).files;

  if (isEmpty(parsedFiles) && jdSource === JD_SOURCES.FILE) {
    throw new ApiError(400, "File is needed to create Job Descriptions");
  }

  if (jdSource === JD_SOURCES.FILE) {
    const providedJobDescriptionResult = await FileHelpers.loadFile(
      parsedFiles[0].name,
      fs.readFileSync(parsedFiles[0].tempFilePath),
    );

    jdFileObjectUrl = await S3Helpers.uploadFilesToS3({
      files: [
        {
          name: parsedFiles[0].name,
          tempFilePath: parsedFiles[0].tempFilePath,
          mimetype: parsedFiles[0].mimetype,
          size: parsedFiles[0].size,
        },
      ],
    });

    if (!jdFileObjectUrl.length) {
      throw new ApiError(500, "Could not store file into server");
    }

    if (!providedJobDescriptionResult)
      throw new ApiError(400, "Unable to read provided file");

    providedJobDescription = providedJobDescriptionResult
      .map((item) => item.pageContent)
      .join(" ");
  }

  let appInstance;

  if (resumeSource === RESUME_SOURCES.DRIVE) {
    appInstance = await AppInstance.findOne({
      createdBy: req.user._id,
    }).lean();

    if (!appInstance) {
      throw new ApiError(400, "Drive app not installed!");
    }

    const existingJobDescription = await JobDescription.findOne({
      "resumeSourceMeta.driveFolderId": driveFolderId,
    }).lean();

    if (existingJobDescription) {
      throw new ApiError(
        400,
        "Drive folder is already used, Please use another folder!",
      );
    }
  }

  if (!providedJobDescription) {
    throw new ApiError(400, "Unable to create Job Description");
  }

  const extractedData = await Agents.jdExtractionAgent(providedJobDescription);

  if (!extractedData) {
    throw new ApiError(400, "Failed to extract job description details!");
  }

  const jdValidation = JDHelpers.validateJobDescription(extractedData);

  if (!jdValidation) {
    throw new ApiError(400, "Invalid job description!", []);
  }

  let watchResponse;
  let channelId;

  if (resumeSource === RESUME_SOURCES.DRIVE && appInstance) {
    channelId = v4();

    watchResponse = await DriveHelpers.watchFolder({
      appInstanceId: appInstance._id,
      channelId,
      folderId: driveFolderId,
    });

    if (!watchResponse) {
      throw new ApiError(
        400,
        "Failed to watch drive folder!, Reconnect with google drive",
      );
    }
  }

  const jobDescription = await JobDescription.create({
    ...extractedData,
    providedJobDescription,
    providedAdditionalJobDescription,
    automaticDataCollectionEnabled,
    resumeSource,
    postedBy: req.user._id,
    jdSource,
    additionalInformation,
    ...(channelId &&
      watchResponse &&
      appInstance && {
        resumeSourceMeta: {
          watchResponse,
          channelId,
          driveFolderId,
        },
      }),
    ...(jdSource === JD_SOURCES.FILE && {
      jdFileObjectUrl: jdFileObjectUrl[0],
    }),
  });

  if (!jobDescription) {
    throw new ApiError(400, "Failed to create job description!");
  }

  return res
    .status(201)
    .json(
      new ApiResponse(
        201,
        jobDescription,
        "Job Description created successfully!",
      ),
    );
});

exports.getJobDescriptionFile = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const jobDescription = await JobDescription.findOne({
    _id: id,
    postedBy: req.user._id,
  })
    .select("jdSource jdFileObjectUrl _id")
    .lean();

  if (!jobDescription) {
    throw new ApiError(404, "Job Description not found!");
  }

  if (
    jobDescription.jdSource !== JD_SOURCES.FILE ||
    !jobDescription?.jdFileObjectUrl?.Key
  ) {
    throw new ApiError(400, "File url doesn't exists");
  }

  const jdUrl = await S3Helpers.getSignedUrl({
    fileKey: jobDescription?.jdFileObjectUrl.Key,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, { jdUrl }, "File url fetched successfully!"));
});

exports.getJobDescriptionById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const jobDescription = await JobDescription.findOne({
    _id: id,
    postedBy: req.user._id,
  });

  if (!jobDescription) {
    throw new ApiError(404, "Job Description not found!");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        jobDescription,
        "Job Description fetched successfully!",
      ),
    );
});

exports.updateJobDescriptionById = asyncHandler(async (req, res, next) => {
  const { automaticDataCollectionEnabled = false, weights, ...rest } = req.body;

  const { id } = req.params;

  const jobDescription = await JobDescription.findOneAndUpdate(
    {
      _id: id,
      postedBy: req.user._id,
    },
    {
      $set: {
        automaticDataCollectionEnabled,
        weights,
        ...rest,
      },
    },
    {
      new: true,
    },
  );

  if (!jobDescription) {
    throw new ApiError(404, "Job Description not found!");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        jobDescription,
        "Job Description updated successfully!",
      ),
    );
});

exports.getAllResumesForJobDescription = asyncHandler(
  async (req, res, next) => {
    const { id } = req.params;
    const { page, limit, status = RESUME_PROCESSING_STATUSES.DONE } = req.query;

    const jobDescription = await JobDescription.findOne({
      _id: id,
      postedBy: req.user._id,
    });

    if (!jobDescription) {
      throw new ApiError(404, "Job Description not found!");
    }

    const resumeJdMembershipsAggregate = ResumeJdMembership.aggregate([
      {
        $match: {
          jdId: new mongoose.Types.ObjectId(id),
          ...(status && {
            status,
          }),
        },
      },
      {
        $lookup: {
          from: "resumes",
          localField: "resumeId",
          foreignField: "_id",
          as: "resumeDetails",
          pipeline: [
            {
              $project: {
                embeddings: 0,
              },
            },
          ],
        },
      },
      {
        $addFields: {
          resumeDetails: {
            $arrayElemAt: ["$resumeDetails", 0],
          },
          statusPriority: {
            $switch: {
              branches: [
                { case: { $eq: ["$status", "DONE"] }, then: 1 },
                { case: { $eq: ["$status", "MATCHING"] }, then: 2 },
                { case: { $eq: ["$status", "PROCESSING"] }, then: 3 },
                { case: { $eq: ["$status", "PENDING"] }, then: 4 },
                { case: { $eq: ["$status", "ERROR"] }, then: 5 },
              ],
              default: 6,
            },
          },
        },
      },
      {
        $sort: {
          statusPriority: 1,
          "matchResult.finalScores.normalizedScore": -1,
          createdAt: -1,
        },
      },
    ]);

    const resumeJdMemberships = await ResumeJdMembership.aggregatePaginate(
      resumeJdMembershipsAggregate,
      getMongoosePaginationOptions({
        page,
        limit,
      }),
    );

    const pendingResumesCount = await ResumeJdMembership.countDocuments({
      jdId: new mongoose.Types.ObjectId(id),
      status: {
        $nin: ["DONE", "ERROR"],
      },
    });

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { ...resumeJdMemberships, status, pendingResumesCount },
          "Resumes fetched successfully!",
        ),
      );
  },
);

exports.getCandidateProfile = asyncHandler(async (req, res, next) => {
  const { id: jdId, resumeJdMembershipId } = req.params;

  const jobDescription = await ResumeJdMembership.findOne({
    jdId,
    _id: resumeJdMembershipId,
  });

  if (!jobDescription) {
    throw new ApiError(404, "Job Description not found!");
  }

  const resume = await Resume.findById(jobDescription.resumeId);

  if (!resume) {
    throw new ApiError(404, "Resume not found!");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { jobDescription, resume },
        "Candidate profile fetched successfully!",
      ),
    );
});

// mode == 1 for files and mode = 2 for google drive folder  and mode = 3 for text
exports.uploadResumesManually = asyncHandler(async (req, res, next) => {
  const { files } = req;
  const { id: jdId } = req.params;

  // Validate Job Description
  const jobDescription = await JobDescription.findOne({
    _id: jdId,
    postedBy: req.user._id,
  }).lean();

  if (!jobDescription) {
    throw new ApiError(404, "Job Description not found!");
  }

  // Parse uploaded files
  const parsedFiles = qs.parse(files).files;

  if (!parsedFiles || !parsedFiles.length) {
    throw new ApiError(400, "No files uploaded!");
  }

  const s3Files = parsedFiles.map((file) => ({
    tempFilePath: file.tempFilePath,
    name: `${v4()}_${file.name}`,
    mimetype: file.mimetype,
    size: file.size,
  }));

  const s3UploadResults = await S3Helpers.uploadFilesToS3({ files: s3Files });

  const recordsToInsert = s3UploadResults.map((result, index) => {
    const originalFile = parsedFiles[index];
    return {
      resumeFileName: originalFile.name,
      jdId,
      resumePath: result.Key,
      metaData: {
        id: result.Key,
        name: originalFile.name,
        mimeType: originalFile.mimetype,
        size: originalFile.size,
      },
    };
  });

  const memberships = await ResumeJdMembership.insertMany(recordsToInsert);

  await SQSHelpers.producetoResumeParsingQueue(
    memberships.map((item) => item._id.toString()),
  );

  return res
    .status(200)
    .json(
      new ApiResponse(200, { memberships }, "Files uploaded successfully!"),
    );
});

exports.uploadResumesFromGoogleDrive = asyncHandler(async (req, res, next) => {
  const { googleDriveFolderId, driveUrlType } = req.body;
  const { id: jdId } = req.params;

  // Validate Job Description
  const jobDescription = await JobDescription.findOne({
    _id: jdId,
    postedBy: req.user._id,
  }).lean();

  if (!jobDescription) {
    throw new ApiError(404, "Job Description not found!");
  }

  const appInstance = await AppInstance.findOne({
    createdBy: req.user._id,
  }).lean();

  if (!appInstance) {
    throw new ApiError(400, "Please Integrate Google Drive");
  }

  const oauth2Client = new google.auth.OAuth2(
    DRIVE_CLIENT_ID,
    DRIVE_CLIENT_SECRET,
    DRIVE_CALLBACK_URL,
  );

  oauth2Client.setCredentials({
    access_token: appInstance.connectionMeta.tokenObj.access_token,
    refresh_token: appInstance.connectionMeta.tokenObj.refresh_token,
  });

  const drive = google.drive({ version: "v3", auth: oauth2Client });

  let driveFiles = [];

  if (driveUrlType === GOOGLE_DRIVE_URL_TYPES.FOLDER) {
    const response = await drive.files.list({
      q: `'${googleDriveFolderId}' in parents and trashed=false and (mimeType='application/pdf' or mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document')`,
      prettyPrint: true,
    });
    driveFiles = response.data.files;

    if (driveFiles.length === 0) {
      throw new ApiError(
        400,
        "Folder is empty, Please add files to the folder",
      );
    }
  } else if (driveUrlType === GOOGLE_DRIVE_URL_TYPES.FILE) {
    const fileResponse = await drive.files.get({
      fileId: googleDriveFolderId,
      fields: "id, name, mimeType",
    });

    if (
      !fileResponse.data ||
      ![
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ].includes(fileResponse.data.mimeType)
    ) {
      throw new ApiError(
        400,
        "Invalid file type. Please upload a PDF or DOCX file.",
      );
    }

    driveFiles.push(fileResponse.data);
  } else {
    throw new ApiError(400, "Invalid Google Drive URL type");
  }

  const uploadResponse = await Promise.all(
    driveFiles.map(async (file) =>
      DriveHelpers.downloadDriveFile({
        driveClient: oauth2Client,
        driveFileId: file.id,
        fileName: v4() + file.name,
      }),
    ),
  );

  const memberships = await ResumeJdMembership.insertMany(
    uploadResponse.map((item) => ({
      resumeFileName: item[0].Key,
      jdId,
      resumePath: item[0].Key,
      metaData: {
        id: item[0].Key,
        source: "drive",
      },
    })),
  );

  const sqsResponse = await SQSHelpers.producetoResumeParsingQueue(
    memberships.map((item) => item._id.toString()),
  );

  return res
    .status(201)
    .json(
      new ApiResponse(
        201,
        { sqsResponse },
        `${driveFiles.length} file(s) processed. Results will be available soon on your dashboard`,
      ),
    );
});

exports.uploadResumeViaText = asyncHandler(async (req, res, next) => {
  // Validate Job Description
  const { id: jdId } = req.params;

  const jobDescription = await JobDescription.findOne({
    _id: jdId,
    postedBy: req.user._id,
  }).lean();

  if (!jobDescription) {
    throw new ApiError(404, "Job Description not found!");
  }

  const { resume } = req.body;

  const parsedResume = await Agents.resumeExtractionAgent(resume);

  if (!parsedResume) {
    throw new ApiError(400, "Unable to create candidate profile!");
  }

  const createdResume = await Resume.create(parsedResume);

  const membershipData = await ResumeJdMembership.create({
    resumeFileName: createdResume._id,
    resumePath: createdResume._id,
    jdId,
    resumeId: createdResume._id,
  });

  try {
    const matchResult = await Agents.matchingAgent({
      jd: jobDescription,
      resume: createdResume,
    });

    await ResumeJdMembership.findByIdAndUpdate(
      membershipData._id,
      {
        status: RESUME_PROCESSING_STATUSES.DONE,
        matchResult,
      },
      { new: true },
    );

    return res
      .status(200)
      .json(
        new ApiResponse(
          201,
          { membership: membershipData },
          "Profile matched successfully!",
        ),
      );
  } catch (error) {
    logger.error("Error in uploadResumeViaText api");
    await ResumeJdMembership.findByIdAndUpdate(membershipData._id, {
      status: RESUME_PROCESSING_STATUSES.ERROR,
    });

    return res.status(400).json(new ApiError(201, "Please try again later!"));
  }
});

exports.getResumeFile = asyncHandler(async (req, res, next) => {
  const { id: jdId, resumeJdMembershipId } = req.params;

  const jobDescription = await ResumeJdMembership.findOne({
    jdId,
    _id: resumeJdMembershipId,
  }).lean();

  if (!jobDescription) {
    throw new ApiError(404, "Job Description not found!");
  }

  const { resumePath } = jobDescription;

  if (!resumePath) {
    throw new ApiError(404, "Resume not found!");
  }

  const signedUrl = await S3Helpers.getSignedUrl({
    fileKey: resumePath,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, { signedUrl }, "Resume fetched successfully!"));
});

exports.deleteResumeFromJobDescription = asyncHandler(
  async (req, res, next) => {
    const { resumeJdMembershipId, id: jdId } = req.params;

    const membershipId = await ResumeJdMembership.findOneAndDelete(
      {
        _id: resumeJdMembershipId,
        jdId,
      },
      {
        new: true,
      },
    );

    if (!membershipId) {
      throw new ApiError(404, "Resume not found!");
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          membershipId,
          "Resume deleted from job description successfully!",
        ),
      );
  },
);
