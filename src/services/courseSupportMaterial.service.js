// Older production databases restrict course_contents.type to video/pdf.
// Store support links in the existing PDF slot with a private marker, then
// expose them as type=link through the API. This keeps deployments working
// before (and after) the optional ENUM migration is run.
const SUPPORT_LINK_PREFIX = "unihub-support-link:";

const storeSupportLink = (url) => `${SUPPORT_LINK_PREFIX}${url}`;
const readSupportLink = (url) =>
  typeof url === "string" && url.startsWith(SUPPORT_LINK_PREFIX)
    ? url.slice(SUPPORT_LINK_PREFIX.length)
    : null;

const presentCourseContent = (content) => {
  const raw = content?.toJSON ? content.toJSON() : content;
  const supportUrl = readSupportLink(raw?.url);
  return supportUrl ? { ...raw, type: "link", url: supportUrl } : raw;
};

module.exports = { storeSupportLink, readSupportLink, presentCourseContent };
