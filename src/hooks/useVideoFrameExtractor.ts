import { useState, useCallback } from "react";

interface VideoFrameExtractionResult {
  frames: string[]; // base64 frames
  duration: number;
  frameCount: number;
}

interface UseVideoFrameExtractorOptions {
  maxFrames?: number; // Maximum frames to extract
  framesPerSecond?: number; // Target FPS for extraction
  maxDuration?: number; // Maximum video duration in seconds
}

export function useVideoFrameExtractor(options: UseVideoFrameExtractorOptions = {}) {
  const {
    maxFrames = 10,
    framesPerSecond = 2,
    maxDuration = 30,
  } = options;

  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const extractFrames = useCallback(async (videoFile: File): Promise<VideoFrameExtractionResult | null> => {
    setIsExtracting(true);
    setError(null);
    setProgress(0);

    try {
      // Validate file type
      if (!videoFile.type.startsWith("video/")) {
        throw new Error("Arquivo deve ser um vídeo");
      }

      // Check file size (max 50MB for processing)
      const maxSize = 50 * 1024 * 1024;
      if (videoFile.size > maxSize) {
        throw new Error("Vídeo muito grande. Máximo: 50MB");
      }

      // Create video element
      const video = document.createElement("video");
      const videoUrl = URL.createObjectURL(videoFile);
      video.src = videoUrl;
      video.muted = true;
      video.playsInline = true;

      // Wait for metadata
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error("Erro ao carregar vídeo"));
        video.load();
      });

      const duration = video.duration;
      
      // Validate duration
      if (duration > maxDuration) {
        URL.revokeObjectURL(videoUrl);
        throw new Error(`Vídeo muito longo. Máximo: ${maxDuration} segundos`);
      }

      // Calculate frame extraction times
      const totalFramesToExtract = Math.min(
        maxFrames,
        Math.ceil(duration * framesPerSecond)
      );
      const interval = duration / totalFramesToExtract;
      const frameTimes: number[] = [];
      
      for (let i = 0; i < totalFramesToExtract; i++) {
        frameTimes.push(i * interval);
      }

      // Create canvas for frame extraction
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      
      if (!ctx) {
        throw new Error("Falha ao criar contexto de canvas");
      }

      // Set canvas size (limit to reasonable dimensions)
      const maxWidth = 800;
      const scale = Math.min(1, maxWidth / video.videoWidth);
      canvas.width = video.videoWidth * scale;
      canvas.height = video.videoHeight * scale;

      const frames: string[] = [];

      // Extract frames
      for (let i = 0; i < frameTimes.length; i++) {
        const time = frameTimes[i];
        
        // Seek to time
        await new Promise<void>((resolve) => {
          video.onseeked = () => resolve();
          video.currentTime = time;
        });

        // Draw frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert to base64 (JPEG for smaller size)
        const frameData = canvas.toDataURL("image/jpeg", 0.7);
        frames.push(frameData);

        // Update progress
        setProgress(Math.round(((i + 1) / frameTimes.length) * 100));
      }

      // Clean up
      URL.revokeObjectURL(videoUrl);

      return {
        frames,
        duration,
        frameCount: frames.length,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao extrair frames";
      setError(message);
      return null;
    } finally {
      setIsExtracting(false);
    }
  }, [maxFrames, framesPerSecond, maxDuration]);

  return {
    extractFrames,
    isExtracting,
    error,
    progress,
  };
}
