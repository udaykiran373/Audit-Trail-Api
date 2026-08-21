import React, { useEffect, useRef } from 'react';
import * as faceapi from 'face-api.js';

type Props = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  triggerWarning: (type: string, videoTimestamp?: string) => void;
};

export default function AssessmentRoom({ videoRef, triggerWarning }: Props) {
  const faceMissingCounter = useRef(0);
  const detectionInterval = useRef<number | null>(null);
  const recordingStart = useRef<number>(Date.now());

  useEffect(() => {
    let mounted = true;

    const initializeFaceDetection = async () => {
      try {
        console.log("🤖 1. Loading face-api models...");
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        console.log("🤖 2. Models loaded successfully!");
        
        if (!mounted) return;
        startDetectionLoop();
      } catch (e) {
        console.error('❌ Failed to load face-api models.', e);
      }
    };

    const startDetectionLoop = () => {
      console.log("🤖 3. Starting detection loop...");
      
      detectionInterval.current = window.setInterval(async () => {
        const video = videoRef?.current;
        
        // --- DIAGNOSTIC CHECKS ---
        if (!video) {
          console.log("⚠️ Video element not found yet.");
          return;
        }
        if (video.paused) {
          console.log("⚠️ Video is paused.");
          return;
        }
        if (video.videoWidth === 0) {
          console.log("⚠️ Video width is 0 (waiting for camera to initialize...).");
          return;
        }

        try {
          const detections = await faceapi.detectAllFaces(
            video,
            new faceapi.TinyFaceDetectorOptions()
          );
          
          console.log(`👀 Frame scanned. Faces detected: ${detections.length} | Missing counter: ${faceMissingCounter.current}/3`);

          const elapsedMs = Date.now() - recordingStart.current;
          const secs = Math.floor(elapsedMs / 1000);
          const videoTimestamp = `00:${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;

          if (detections.length === 0) {
            faceMissingCounter.current += 1;
            
            if (faceMissingCounter.current >= 3) {
              console.log("🚨 TRIGGERING WARNING: FaceNotVisible");
              triggerWarning('FaceNotVisible', videoTimestamp);
              faceMissingCounter.current = 0; 
            }
          } else {
            faceMissingCounter.current = 0; 
            if (detections.length > 1) {
              console.log("🚨 TRIGGERING WARNING: MultipleFacesDetected");
              triggerWarning('MultipleFacesDetected', videoTimestamp);
            }
          }
        } catch (err) {
          console.error('❌ Face detection processing error:', err);
        }
      }, 1000);
    };

// ... rest of the code above ...
    
    initializeFaceDetection();

    return () => {
      mounted = false;
      if (detectionInterval.current) {
        window.clearInterval(detectionInterval.current);
      }
    };
    // Fix: Remove triggerWarning from this array so the timer doesn't reset the AI
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoRef]); 

  return null;
}