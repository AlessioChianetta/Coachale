import { useState, useEffect } from "react";
import { Play, AlertCircle } from "lucide-react";

interface GuiddePlayerProps {
  embedUrl: string | null;
  localVideoUrl?: string | null;
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

export function GuiddePlayer({ embedUrl, localVideoUrl, videoType = "iframe", title }: GuiddePlayerProps) {
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    setVideoError(false);
  }, [localVideoUrl]);

  if (localVideoUrl && !videoError) {
    return (
      <div className="relative w-full overflow-hidden rounded-2xl bg-black shadow-xl">
        <video
          src={localVideoUrl}
          controls
          className="w-full aspect-video"
          preload="metadata"
          playsInline
          onError={() => setVideoError(true)}
          onLoadedData={(e) => {
            const v = e.currentTarget;
            if (v.videoWidth === 0 && v.videoHeight === 0) {
              setVideoError(true);
            }
          }}
        />
      </div>
    );
  }

  if (videoError && localVideoUrl) {
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
        className="relative w-full overflow-hidden rounded-2xl shadow-xl"
        style={{
          paddingTop: "56.25%",
          background: "linear-gradient(135deg, #1a0000 0%, #4a1c1c 50%, #1a0000 100%)",
        }}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-400" />
          <div>
            <p className="text-white font-semibold text-base mb-1">Errore video</p>
            <p className="text-red-200 text-sm">Il file video locale non e' riproducibile o e' danneggiato</p>
          </div>
        </div>
      </div>
    );
  }

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
          <p className="text-blue-200 text-sm">Il video per questa lezione sara' disponibile presto</p>
        </div>
        <span className="px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-medium">
          Coming soon
        </span>
      </div>
    </div>
  );
}
