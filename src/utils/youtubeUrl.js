// Shared with courseContentController, chunkUploadController and
// adminController, which each carried their own copy of this pair.

const getYouTubeVideoId = (url = "") => {
  const match = String(url).match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube-nocookie\.com\/embed\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  );
  return match?.[1] || null;
};

const buildPrivacyEmbedUrl = (videoId) =>
  videoId
    ? `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1&iv_load_policy=3&cc_load_policy=0`
    : null;

module.exports = { getYouTubeVideoId, buildPrivacyEmbedUrl };
