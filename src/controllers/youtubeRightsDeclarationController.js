const { YouTubeRightsDeclaration } = require("../models");
const {
  YOUTUBE_RIGHTS_DECLARATION_VERSION,
  YOUTUBE_RIGHTS_DECLARATION_TEXT,
} = require("../constants/youtubeRightsDeclaration");

const normalizeName = (value = "") =>
  String(value).trim().replace(/\s+/g, " ").toLocaleLowerCase("en");

const declarationPayload = (declaration) => ({
  id: declaration.id,
  signatoryName: declaration.signatoryName,
  agreementVersion: declaration.agreementVersion,
  agreementText: declaration.agreementText,
  acceptedAt: declaration.acceptedAt,
  createdAt: declaration.createdAt,
});

const getMyYouTubeRightsDeclaration = async (req, res, next) => {
  try {
    const declaration = await YouTubeRightsDeclaration.findOne({
      where: { userId: req.user.id },
    });
    const expectedSignatoryName = `${req.user.firstName} ${req.user.lastName}`.trim();

    res.status(200).json({
      success: true,
      data: {
        hasDeclaration: Boolean(declaration),
        declaration: declaration ? declarationPayload(declaration) : null,
        agreement: {
          version: YOUTUBE_RIGHTS_DECLARATION_VERSION,
          text: YOUTUBE_RIGHTS_DECLARATION_TEXT,
        },
        expectedSignatoryName,
      },
    });
  } catch (error) {
    next(error);
  }
};

const signYouTubeRightsDeclaration = async (req, res, next) => {
  try {
    const existing = await YouTubeRightsDeclaration.findOne({
      where: { userId: req.user.id },
    });

    if (existing) {
      return res.status(200).json({
        success: true,
        message: "Your YouTube rights declaration is already on file.",
        data: { declaration: declarationPayload(existing) },
      });
    }

    const signatoryName = String(req.body?.signatoryName || "")
      .trim()
      .replace(/\s+/g, " ");
    const expectedSignatoryName = `${req.user.firstName} ${req.user.lastName}`.trim();

    if (req.body?.accepted !== true) {
      return res.status(400).json({
        success: false,
        message: "You must accept the declaration before signing it.",
      });
    }

    if (!signatoryName || normalizeName(signatoryName) !== normalizeName(expectedSignatoryName)) {
      return res.status(400).json({
        success: false,
        message: `Type your full account name exactly as shown: ${expectedSignatoryName}`,
      });
    }

    const declaration = await YouTubeRightsDeclaration.create({
      userId: req.user.id,
      signatoryName,
      agreementVersion: YOUTUBE_RIGHTS_DECLARATION_VERSION,
      agreementText: YOUTUBE_RIGHTS_DECLARATION_TEXT,
      acceptedAt: new Date(),
      acceptedIp: req.ip || null,
      acceptedUserAgent: String(req.get("user-agent") || "").slice(0, 500) || null,
    });

    res.status(201).json({
      success: true,
      message: "Your signed YouTube rights declaration has been saved.",
      data: { declaration: declarationPayload(declaration) },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyYouTubeRightsDeclaration,
  signYouTubeRightsDeclaration,
};
