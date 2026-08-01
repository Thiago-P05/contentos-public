const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export function getYouTubeEmbedUrl(videoId: string) {
  const normalizedVideoId = videoId.trim();

  if (!YOUTUBE_VIDEO_ID_PATTERN.test(normalizedVideoId)) {
    return null;
  }

  const url = new URL(`https://www.youtube-nocookie.com/embed/${normalizedVideoId}`);
  url.searchParams.set("autoplay", "1");
  url.searchParams.set("modestbranding", "1");
  url.searchParams.set("rel", "0");

  return url.toString();
}
