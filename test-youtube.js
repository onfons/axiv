const YOUTUBE_API_KEY = 'AIzaSyBmUQ3bKTr8Ylj520X3CaWQvfgv9uvy5ls';
async function getYouTubeVideoData(videoId) {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${YOUTUBE_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube API error: ${res.status}`);
  const data = await res.json();
  const item = data.items?.[0];
  if (!item) throw new Error('YouTube에서 비디오를 찾을 수 없습니다.');
  const s = item.snippet;
  return {
    video_id: videoId,
    title: s.title || '',
    description: s.description || '',
    uploader: s.channelTitle || '',
    thumbnail_url: s.thumbnails?.maxres?.url || s.thumbnails?.high?.url || s.thumbnails?.default?.url || '',
  };
}

getYouTubeVideoData('dQw4w9WgXcQ').then(res => console.log('YouTube Success:', res.title)).catch(console.error);
