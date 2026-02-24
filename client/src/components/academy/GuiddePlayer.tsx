import { Play } from "lucide-react";

interface GuiddePlayerProps {
  embedUrl: string | null;
  videoType?: string;
  title: string;
}

function getYouTubeEmbedUrl(url: string): string | null {
  let videoId: string | null = null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtube.com")) {
      videoId = parsed.searchParams.get("v");
      if (!videoId) {
        const match = parsed.pathname.match(/\/embed\/([^/?]+)/);
        if (match) videoId = match[1];
      }
    } else if (parsed.hostname === "youtu.be") {
      videoId = parsed.pathname.slice(1);
    }
  } catch {}
  return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
}

export function GuiddePlayer({ embedUrl, videoType = "iframe", title }: GuiddePlayerProps) {
  if (embedUrl) {
    let src = embedUrl;
    if (videoType === "youtube") {
      const ytEmbed = getYouTubeEmbedUrl(embedUrl);
      if (ytEmbed) src = ytEmbed;
    }

    return (
      <div className="relative w-full overflow-hidden rounded-2xl bg-black shadow-xl" style={{ paddingTop: "56.25%" }}>
        <iframe
          src={src}
          title={title}
          className="absolute inset-0 h-full w-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl shadow-xl flex flex-col items-center justify-center gap-4 select-none"
      style={{
        paddingTop: "56.25%",
        background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #1e1b4b 100%)",
      }}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-lg">
          <Play className="w-7 h-7 text-white ml-1" fill="white" />
        </div>
        <div>
          <p className="text-white font-semibold text-base mb-1">Video tutorial in arrivo</p>
          <p className="text-blue-200 text-sm">Il video per questa lezione sarà disponibile presto</p>
        </div>
        <span className="px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-medium">
          🎬 Coming soon
        </span>
      </div>
    </div>
  );
}
