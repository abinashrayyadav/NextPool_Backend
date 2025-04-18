const { PDFLoader } = require("@langchain/community/document_loaders/fs/pdf");
const { DocxLoader } = require("@langchain/community/document_loaders/fs/docx");
const path = require("path");

const { logger } = require("../services");

exports.loadFile = async (filePath, fileBuffer) => {
  try {
    const extension = path.extname(filePath);

    logger.info(`File Data for extraction ${filePath} - ${extension}`);

    const blob = new Blob([fileBuffer]);

    switch (extension) {
      case ".pdf":
        const pdfLoader = new PDFLoader(blob);
        return await pdfLoader.load(filePath);
      case ".docx":
      case ".ocx":
        const docxLoader = new DocxLoader(blob);
        return await docxLoader.load(filePath);
      default:
        // const pdfLoaderDef = new PDFLoader(blob);
        // return await pdfLoaderDef.load(filePath);
        throw new Error("Unable to parser the files!");
    }
  } catch (error) {
    logger.error("File Read Error -> ", { error });
    return false;
  }
};
