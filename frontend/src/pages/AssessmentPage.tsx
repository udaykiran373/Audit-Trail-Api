// Import React and the React hooks used in this component.
import React, { useState, useEffect, useRef } from 'react';

// Import the component responsible for face-detection/proctoring.

import AssessmentRoom from '../components/AssessmentRoom';

// Import icons used in the assessment UI.
import {
  Award,
  BookOpen,
  CheckCircle,
  XCircle,
  Timer,
  RefreshCw,
  Video,
  AlertTriangle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

// Import TypeScript types used for questions and assessment history.
import type { Question, Assessment } from '../types';

// Import the sidebar component.
import Sidebar from '../components/Sidebar';
import { API_BASE_URL } from '../config.js';


// Base URL of the backend API.
// const API_BASE_URL = 'http://localhost:5081/api';

// Remove '/api' to get the backend server origin.
const API_ORIGIN = API_BASE_URL.replace('/api', '');


// Main React component for the assessment page.
const AssessmentPage: React.FC = () => {

  // Get the currently logged-in user from localStorage.
  // If no user exists, use "anonymous".
  const activeUser =
    localStorage.getItem('audit_active_user') || 'anonymous';


  // Store the available assessment categories.
  const [categories] = useState<string[]>([
    'C# .NET Core',
    'React JS Essentials',
    'SQL & Database Design',
    'Data Structures & Algorithms'
  ]);


  // Store the category currently selected by the user.
  // null means that no assessment has been selected yet.
  const [selectedCategory, setSelectedCategory] =
    useState<string | null>(null);


  // Store all questions loaded for the selected assessment.
  const [questions, setQuestions] =
    useState<Question[]>([]);


  // Store the index of the question currently displayed.
  // 0 means the first question.
  const [activeQuestionIdx, setActiveQuestionIdx] =
    useState<number>(0);


  // Store the user's answers.
  // The key is the question ID and the value is the selected option index.
  const [answers, setAnswers] =
    useState<Record<string, number>>({});


  // Store the user's previous assessment attempts.
  const [history, setHistory] =
    useState<Assessment[]>([]);


  // Control whether assessment history is visible.
  const [showHistory, setShowHistory] =
    useState(false);


  // Track whether questions are currently being loaded.
  const [isLoadingQuestions, setIsLoadingQuestions] =
    useState(false);


  // Track whether assessment history is currently being loaded.
  const [isLoadingHistory, setIsLoadingHistory] =
    useState(false);


  // Track whether assessment submission is currently happening.
  const [isSubmitting, setIsSubmitting] =
    useState(false);


  // Indicates whether an assessment is currently active.
  const [quizActive, setQuizActive] =
    useState(false);


  // Store the result/scorecard after submission.
  // null means that no result is available yet.
  const [scorecard, setScorecard] =
    useState<Assessment | null>(null);


  // useRef stores a mutable value that does not cause a React re-render.
  // This flag prevents the same assessment from being submitted multiple times.
  const submissionStartedRef =
    useRef(false);


  // ---------------- PROCTORING STATES ----------------

  // Store the total number of proctoring warnings.
  const [warningsCount, setWarningsCount] =
    useState<number>(0);


  // Store the textual details of every warning.
  const [warningsLog, setWarningsLog] =
    useState<string[]>([]);


  // Store the ID of the assessment attempt whose warning details are expanded.
  const [expandedAttemptId, setExpandedAttemptId] =
    useState<string | null>(null);


  // ---------------- QUESTION TIMER ----------------

  // Store the number of seconds remaining for the current question.
  // Each question starts with 60 seconds.
  const [questionSecondsLeft, setQuestionSecondsLeft] =
    useState<number>(60);


  // ---------------- PERMISSION STATE ----------------

  // Track the current camera/microphone permission state.
  const [permissionState, setPermissionState] =
    useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');


  // ---------------- AUTO-SUBMIT TIMER LOCK ----------------

  // Prevent the timer from triggering the same action multiple times.
  const timerLockRef = useRef(false);


  // ---------------- WEBCAM REFERENCES ----------------

  // Reference to the HTML video element that displays the webcam feed.
  const videoPreviewRef =
    useRef<HTMLVideoElement | null>(null);


  // Store the actual webcam and microphone MediaStream.
  const streamRef =
    useRef<MediaStream | null>(null);


  // Store the MediaRecorder instance used to record the webcam stream.
  const mediaRecorderRef =
    useRef<MediaRecorder | null>(null);


  // Store video data chunks produced by MediaRecorder.
  const chunksRef =
    useRef<Blob[]>([]);


  // ---------------- COMPUTER VISION REFERENCES ----------------

  // Reference to a hidden HTML canvas used to analyze webcam frames.
  const canvasRef =
    useRef<HTMLCanvasElement | null>(null);


  // Store the previous webcam frame for pixel comparison.
  const prevFrameDataRef =
    useRef<Uint8ClampedArray | null>(null);


  // Count consecutive frames where almost no visual change is detected.
  const staticFrameCountRef =
    useRef<number>(0);


  // Store the timestamp when the assessment started.
  const testStartTimeRef =
    useRef<number>(Date.now());


  // Get the existing audit session ID from localStorage.
  // If none exists, generate a new UUID.
  const activeSessionId =
    localStorage.getItem('audit_session_id') ||
    crypto.randomUUID();


  // Create common headers used when communicating with the backend.
  const getHeaders = () => ({
    // Tell the backend that the request body is JSON.
    'Content-Type': 'application/json',

    // Send the audit session ID so backend logs can be connected.
    'X-Session-ID': activeSessionId,

    // Send the current user ID.
    'X-User-ID': activeUser,
  });


  // ---------------- PAGE VIEW LOGGING ----------------

  // Run this effect when the AssessmentPage component is mounted.
  useEffect(() => {

    // Send an audit event indicating that the assessment page was opened.
    fetch(`${API_BASE_URL}/assessment/log-view`, {
      // Use POST because we are creating an audit event.
      method: 'POST',

      // Attach the common audit headers.
      headers: getHeaders()

    // Log an error if the audit request fails.
    }).catch(err =>
      console.error('Failed to log page view:', err)
    );

  // Empty dependency array means this runs once when the component mounts.
  }, []);


  // ---------------- FETCH ASSESSMENT HISTORY ----------------

  // Function used to retrieve the user's previous assessment attempts.
  const fetchHistory = async () => {

    // Show the history loading state.
    setIsLoadingHistory(true);

    try {

      // Request assessment history for the active user.
      const response = await fetch(
        `${API_BASE_URL}/assessment/history/${activeUser}`,
        {
          // Attach the common headers.
          headers: getHeaders()
        }
      );


      // Continue only when the server returned a successful response.
      if (response.ok) {

        // Convert the JSON response into JavaScript data.
        const data = await response.json();

        // Store the history in React state.
        setHistory(data);
      }

    } catch (err) {

      // Handle network/request errors.
      console.error(
        'Failed to load assessment history:',
        err
      );

    } finally {

      // Stop showing the loading indicator.
      setIsLoadingHistory(false);
    }
  };


  // Toggle the assessment history section.
  const toggleHistory = () => {

    // If history is currently hidden, load the latest history first.
    if (!showHistory) {
      fetchHistory();
    }

    // Change the visibility state.
    setShowHistory(!showHistory);
  };


  // ---------------- PER-QUESTION TIMER ----------------

  // Run this effect whenever quiz state or remaining seconds changes.
  useEffect(() => {

    // If the timer has been reset to a positive value,
    // release the auto-submit/navigation lock.
    if (questionSecondsLeft > 0) {
      timerLockRef.current = false;
    }


    // If the quiz is not active OR the timer has reached zero,
    // do not create another interval.
    if (!quizActive || questionSecondsLeft <= 0) {

      // Check that the timer reached exactly zero
      // and the action has not already been triggered.
      if (
        quizActive &&
        questionSecondsLeft === 0 &&
        !timerLockRef.current
      ) {

        // Lock immediately to prevent duplicate execution.
        timerLockRef.current = true;

        // Automatically move to the next question
        // or submit the assessment if this is the last question.
        handleNextQuestionAuto();
      }

      // Stop execution of this effect.
      return;
    }


    // Create an interval that runs every 1 second.
    const timer = setInterval(() => {

      // Decrease the remaining time by one second.
      setQuestionSecondsLeft(prev => prev - 1);

    }, 1000);


    // Clean up the interval when the effect runs again
    // or the component is unmounted.
    return () => clearInterval(timer);

  // Re-run the effect when either value changes.
  }, [quizActive, questionSecondsLeft]);


  // ---------------- TAB SWITCHING PROCTORING ----------------

  // Register browser focus/visibility listeners while the quiz is active.
  useEffect(() => {

    // If no quiz is running, there is nothing to monitor.
    if (!quizActive) return;


    // Called when the browser window loses focus.
    const handleBlur = () => {

      // Add a warning because the user may have switched windows/tabs.
      addWarning(
        "Window focus lost (tab/window switch detected)."
      );
    };


    // Called whenever document visibility changes.
    const handleVisibility = () => {

      // Check whether the current page has become hidden.
      if (document.visibilityState === 'hidden') {

        // Record a tab-switch warning.
        addWarning("Document tab switch detected.");
      }
    };


    // Listen for browser window focus loss.
    window.addEventListener('blur', handleBlur);


    // Listen for page visibility changes.
    document.addEventListener(
      'visibilitychange',
      handleVisibility
    );


    // Remove both listeners when the quiz ends
    // or when the effect is cleaned up.
    return () => {

      // Remove the blur listener.
      window.removeEventListener('blur', handleBlur);

      // Remove the visibility listener.
      document.removeEventListener(
        'visibilitychange',
        handleVisibility
      );
    };

  // Re-register listeners when quizActive changes.
  }, [quizActive]);


  // ---------------- AUTOMATIC COMPUTER-VISION SCAN ----------------

  // Start/stop the automatic webcam analysis depending on quiz state.
  useEffect(() => {

    // Do nothing when the quiz is not active.
    if (!quizActive) return;


    // Run the proctoring scan every 3 seconds.
    const interval = setInterval(() => {

      // Analyze the current webcam frame.
      runProctorScan();

    }, 3000);


    // Stop the interval when the quiz ends
    // or when the effect is recreated.
    return () => clearInterval(interval);

  // Re-run when quizActive or warning count changes.
  }, [quizActive, warningsCount]);


  // ---------------- COMPUTER-VISION PROCTORING ----------------

  // Analyze the current webcam frame to detect suspicious conditions.
  const runProctorScan = () => {

    // If either the video element or canvas is unavailable,
    // there is nothing to analyze.
    if (
      !videoPreviewRef.current ||
      !canvasRef.current
    ) return;


    // Get the HTML video element.
    const video = videoPreviewRef.current;


    // Get the hidden canvas element.
    const canvas = canvasRef.current;


    // Check whether the webcam has a valid video resolution.
    // A width or height of zero means the video is not ready.
    if (
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) return;


    // Get the 2D drawing context from the canvas.
    const ctx = canvas.getContext('2d');


    // If the canvas context could not be created, stop processing.
    if (!ctx) return;


    // Resize the hidden canvas to a small resolution.
    // This reduces the amount of data that needs to be analyzed.
    canvas.width = 160;
    canvas.height = 120;


    // Copy the current webcam frame into the hidden canvas.
    ctx.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    );


    try {

      // Extract the pixel data from the current frame.
      const frame = ctx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
      );


      // Get the RGBA pixel array.
      const data = frame.data;


      // Store the total brightness of all pixels.
      let totalBrightness = 0;


      // Iterate through the pixels.
      // Every pixel contains 4 values: R, G, B and Alpha.
      for (let i = 0; i < data.length; i += 4) {

        // Read the red channel.
        const r = data[i];

        // Read the green channel.
        const g = data[i + 1];

        // Read the blue channel.
        const b = data[i + 2];


        // Calculate approximate brightness for this pixel
        // and add it to the total.
        totalBrightness += (r + g + b) / 3;
      }


      // Calculate the average brightness of the complete frame.
      const avgBrightness =
        totalBrightness / (data.length / 4);


      // Check whether the camera image is extremely dark.
      if (avgBrightness < 10) {

        // Add a warning because the camera may be blocked
        // or the environment may be too dark.
        addWarning(
          "Webcam feed blocked or user left frame (Camera feed is too dark)."
        );

        // Stop processing this frame.
        return;
      }


      // ---------------- STATIC FRAME DETECTION ----------------

      // Only compare frames if a previous frame exists.
      if (prevFrameDataRef.current) {

        // Count how many pixels changed significantly.
        let diffPixels = 0;


        // Get the previous frame's pixel data.
        const prev = prevFrameDataRef.current;


        // Compare the current frame with the previous frame.
        for (let i = 0; i < data.length; i += 4) {

          // Calculate the total RGB difference.
          const diff =
            Math.abs(data[i] - prev[i]) +
            Math.abs(data[i + 1] - prev[i + 1]) +
            Math.abs(data[i + 2] - prev[i + 2]);


          // Consider this pixel changed if the difference is greater than 80.
          if (diff > 80) {

            // Increase the changed-pixel count.
            diffPixels++;
          }
        }


        // Calculate what percentage of pixels changed.
        const diffPercentage =
          (diffPixels / (data.length / 4)) * 100;


        // If less than 0.1% of pixels changed,
        // consider the frame almost static.
        if (diffPercentage < 0.1) {

          // Increase the consecutive static-frame counter.
          staticFrameCountRef.current += 1;


          // Four consecutive scans occur approximately every 3 seconds,
          // so four static scans represent roughly 12 seconds.
          if (staticFrameCountRef.current >= 4) {

            // Add a warning for possible user absence/frozen video.
            addWarning(
              "User absence or frozen feed detected."
            );


            // Reset the counter after creating the warning.
            staticFrameCountRef.current = 0;
          }

        } else {

          // If movement is detected, reset the static-frame counter.
          staticFrameCountRef.current = 0;
        }
      }


      // Save the current frame as the previous frame
      // for comparison during the next scan.
      prevFrameDataRef.current = data;

    } catch (e) {

      // Handle errors when accessing/analyzing canvas pixel data.
      console.warn(
        'Proctor canvas analyzer context blocked.',
        e
      );
    }
  };


  // ---------------- ADD PROCTORING WARNING ----------------

  // Add a warning, log it to the backend,
  // and automatically submit after 3 warnings.
  const addWarning = (reason: string) => {

    // Get the current local time for displaying the warning.
    const timestamp =
      new Date().toLocaleTimeString();


    // Combine the timestamp and reason into one readable log entry.
    const detail =
      `[${timestamp}] ${reason}`;


    // Default warning type.
    let warningType = 'LookingAway';


    // If the reason contains "switch" or "focus",
    // classify it as a window-switch warning.
    if (
      reason.toLowerCase().includes('switch') ||
      reason.toLowerCase().includes('focus')
    ) {

      // Set the warning type.
      warningType = 'WindowSwitch';

    // If the reason indicates a blocked/dark camera,
    // classify it as a camera warning.
    } else if (
      reason.toLowerCase().includes('blocked') ||
      reason.toLowerCase().includes('dark')
    ) {

      // Set the warning type.
      warningType = 'CameraBlocked';

    // If the reason indicates absence/frozen feed,
    // classify it as a user-absence warning.
    } else if (
      reason.toLowerCase().includes('absence') ||
      reason.toLowerCase().includes('frozen')
    ) {

      // Set the warning type.
      warningType = 'UserAbsent';
    }


    // Calculate how many seconds have passed since the assessment started.
    // Date.now() is used so this does not depend on React state closures.
    const elapsedSeconds =
      Math.floor(
        (Date.now() - testStartTimeRef.current) / 1000
      );


    // Convert elapsed seconds into minutes.
    const minutes =
      Math.floor(elapsedSeconds / 60);


    // Get the remaining seconds after extracting minutes.
    const secs =
      elapsedSeconds % 60;


    // Convert the elapsed time into HH:MM:SS-style video timestamp.
    const videoTimestamp =
      `00:${minutes.toString().padStart(2, '0')}:${secs
        .toString()
        .padStart(2, '0')}`;


    // Send the proctoring warning to the backend.
    // This request is intentionally non-blocking.
    fetch(
      `${API_BASE_URL}/assessment/log-warning`,
      {
        // Use POST because a new audit event is being created.
        method: 'POST',

        // Attach session/user information.
        headers: getHeaders(),

        // Send the warning type and timestamp as JSON.
        body: JSON.stringify({
          warningType,
          videoTimestamp
        })
      }

    // Log an error if the warning audit request fails.
    ).catch(err =>
      console.error(
        "Failed to log proctor warning audit log:",
        err
      )
    );


    // Add the warning to the React warning log.
    setWarningsLog(prev => {

      // Create a new array containing the old warnings
      // plus the new warning.
      const nextLog = [
        ...prev,
        detail
      ];


      // Update the total warning count.
      setWarningsCount(curr => {

        // Calculate the new warning count.
        const nextCount = curr + 1;


        // If warning count reaches 3,
        // automatically submit the assessment.
        if (
          nextCount >= 3 &&
          !submissionStartedRef.current
        ) {

          // Inform the user that the exam will be submitted.
          alert(
            "Maximum proctoring warnings exceeded (3/3). Your exam is being submitted immediately."
          );


          // Submit using the latest warning count and log.
          // These values avoid relying on possibly stale React state.
          handleSubmitQuiz(
            nextCount,
            nextLog
          );
        }


        // Return the updated warning count.
        return nextCount;
      });


      // Return the updated warning log.
      return nextLog;
    });
  };


  // ---------------- PERMISSION CHECK ----------------

  // Request camera and microphone permission before starting the assessment.
  const handleInitiateQuiz = (category: string) => {

    // Tell the UI that permission is currently being requested.
    setPermissionState('requesting');


    // Request access to both webcam and microphone.
    navigator.mediaDevices
      .getUserMedia({
        video: true,
        audio: true
      })

      // Execute this block when permission is successfully granted.
      .then((stream) => {

        // Stop the temporary stream immediately.
        // It was only used to verify permission.
        stream.getTracks().forEach(
          t => t.stop()
        );


        // Update the UI to indicate that permission was granted.
        setPermissionState('granted');


        // Log the successful permission event.
        fetch(
          `${API_BASE_URL}/assessment/log-permissions`,
          {
            // Create a new permission audit event.
            method: 'POST',

            // Attach audit headers.
            headers: getHeaders(),

            // Tell backend that camera and microphone were granted.
            body: JSON.stringify({
              granted: true,
              cameraGranted: true,
              microphoneGranted: true
            })
          }

        // Permission logging should not block starting the quiz.
        ).catch(e => console.error(e));


        // After permission is granted, actually load the quiz.
        executeStartQuiz(category);
      })


      // Execute this block if permission request fails.
      .catch((err) => {

        // Log the browser error for debugging.
        console.warn(
          'Permissions denied',
          err
        );


        // Update the UI to show permission was denied.
        setPermissionState('denied');


        // Log the failed permission event.
        fetch(
          `${API_BASE_URL}/assessment/log-permissions`,
          {
            // Create a new permission audit event.
            method: 'POST',

            // Attach audit headers.
            headers: getHeaders(),

            // Tell backend that permission was not granted.
            body: JSON.stringify({
              granted: false,
              cameraGranted: false,
              microphoneGranted: false
            })
          }

        // Do not block the UI if audit logging fails.
        ).catch(e => console.error(e));
      });
  };


  // ---------------- START QUIZ ----------------

  // Load questions and initialize all assessment-related resources.
  const executeStartQuiz = async (category: string) => {

    // Reset duplicate-submission protection for this new attempt.
    submissionStartedRef.current = false;


    // Display the question-loading state.
    setIsLoadingQuestions(true);


    try {

      // Request questions for the selected category.
      // encodeURIComponent safely encodes spaces/special characters in the URL.
      const response = await fetch(
        `${API_BASE_URL}/assessment/questions/${encodeURIComponent(category)}`,
        {
          // Attach common headers.
          headers: getHeaders()
        }
      );


      // Continue only if the backend returned a successful response.
      if (response.ok) {

        // Convert the response body from JSON into JavaScript data.
        const data = await response.json();


        // Store the downloaded questions.
        setQuestions(data);


        // Remove answers from any previous attempt.
        setAnswers({});


        // Start from the first question.
        setActiveQuestionIdx(0);


        // Store the selected category.
        setSelectedCategory(category);


        // ---------------- RESET ASSESSMENT STATE ----------------

        // Reset the timer to 60 seconds for the first question.
        setQuestionSecondsLeft(60);


        // Reset the proctoring warning count.
        setWarningsCount(0);


        // Clear warnings from any previous assessment.
        setWarningsLog([]);


        // Mark the quiz as active.
        setQuizActive(true);


        // Clear any previous scorecard.
        setScorecard(null);


        // ---------------- START WEBCAM ----------------

        // Wait approximately 200ms before initializing the webcam.
        // This gives React time to render the video element.
        setTimeout(async () => {

          try {

            // Request the actual webcam and microphone stream.
            const stream =
              await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
              });


            // Store the stream so it can be stopped later.
            streamRef.current = stream;


            // If the video element exists, display the webcam stream.
            if (videoPreviewRef.current) {

              // Connect the MediaStream to the <video> element.
              videoPreviewRef.current.srcObject =
                stream;
            }


            // Create a MediaRecorder for the webcam stream.
            // The recorded format is WebM.
            const recorder =
              new MediaRecorder(
                stream,
                {
                  mimeType: 'video/webm'
                }
              );


            // Store the recorder for later stopping/submission.
            mediaRecorderRef.current = recorder;


            // Remove video chunks from any previous assessment.
            chunksRef.current = [];


            // Called whenever MediaRecorder produces video data.
            recorder.ondataavailable = (e) => {

              // Only store non-empty data chunks.
              if (
                e.data &&
                e.data.size > 0
              ) {

                // Add the chunk to the recording buffer.
                chunksRef.current.push(e.data);
              }
            };


            // Start recording.
            // 1000 means request data roughly every 1 second.
            recorder.start(1000);

          } catch (err) {

            // Log webcam initialization errors.
            console.warn(
              'Webcam feed could not be initialized.',
              err
            );
          }

        }, 200);
      }

    } catch (err) {

      // Handle network/request errors while loading questions.
      console.error(
        'Failed to fetch questions:',
        err
      );

    } finally {

      // Stop showing the question-loading state.
      setIsLoadingQuestions(false);


      // Return permission UI state to idle.
      setPermissionState('idle');
    }
  };


  // ---------------- SELECT ANSWER ----------------

  // Store the selected option for a particular question.
  const handleSelectOption = (
    questionId: string,
    optionIdx: number
  ) => {

    // Update only the selected question's answer.
    // Previous answers are preserved using the spread operator.
    setAnswers(prev => ({
      ...prev,
      [questionId]: optionIdx
    }));
  };


  // ---------------- MANUAL NEXT QUESTION ----------------

  // Move to the next question when the user clicks Next.
  const handleNextManual = () => {

    // Check whether there is another question after the current one.
    if (
      activeQuestionIdx <
      questions.length - 1
    ) {

      // Increase the question index by one.
      setActiveQuestionIdx(
        prev => prev + 1
      );


      // Reset the timer for the new question.
      setQuestionSecondsLeft(60);
    }
  };


  // ---------------- PREVIOUS QUESTION ----------------

  // Move to the previous question.
  const handlePrev = () => {

    // Make sure we are not already on the first question.
    if (activeQuestionIdx > 0) {

      // Decrease the question index by one.
      setActiveQuestionIdx(
        prev => prev - 1
      );


      // Reset the timer for the previous question.
      setQuestionSecondsLeft(60);
    }
  };


  // ---------------- AUTOMATIC NEXT QUESTION ----------------

  // Called automatically when the current question's timer reaches zero.
  const handleNextQuestionAuto = () => {

    // Determine whether the current question is the final question.
    const isLastQuestion =
      activeQuestionIdx === questions.length - 1;


    // If this is the final question, submit the assessment.
    if (isLastQuestion) {

      // Print a debugging message.
      console.log(
        "times up auto submiting the assesment"
      );


      // Submit the entire assessment.
      handleSubmitQuiz();

    } else {

      // Print a debugging message.
      console.log(
        "times up moving to next question"
      );


      // Move to the next question.
      setActiveQuestionIdx(
        prev => prev + 1
      );


      // Reset the timer to 60 seconds.
      setQuestionSecondsLeft(60);
    }
  };


  // ---------------- SUBMIT ASSESSMENT ----------------

  // Submit the assessment and optionally receive the latest warning values.
  const handleSubmitQuiz = async (
    overrideWarningsCount?: number,
    overrideWarningsLog?: string[]
  ) => {

    // Do not submit if no category has been selected.
    if (!selectedCategory) return;


    // Prevent multiple submission requests.
    if (submissionStartedRef.current) {

      // Log that submission was already initiated.
      console.log(
        "Submission already started. Ignoring duplicate submit."
      );


      // Stop here.
      return;
    }


    // Lock submission immediately.
    submissionStartedRef.current = true;


    // Stop the quiz UI.
    setQuizActive(false);


    // Display submission/loading state.
    setIsSubmitting(true);


    // ---------------- STOP WEBCAM ----------------

    // Check whether a webcam stream exists.
    if (streamRef.current) {

      // Stop every track in the webcam/microphone stream.
      streamRef.current
        .getTracks()
        .forEach(t => t.stop());
    }


    // ---------------- COMPILE RECORDED VIDEO ----------------

    // Initially there is no video to upload.
    let videoBlob: Blob | null = null;


    // Check whether a recorder exists
    // and is currently recording.
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {

      try {

        // Create a Promise that will resolve when recording stops.
        const stopPromise =
          new Promise<Blob>((resolve) => {

            // onstop runs after MediaRecorder finishes stopping.
            mediaRecorderRef.current!.onstop =
              () => {

                // Combine all recorded chunks into one Blob.
                resolve(
                  new Blob(
                    chunksRef.current,
                    {
                      type: 'video/webm'
                    }
                  )
                );
              };
          });


        // Stop the recorder.
        mediaRecorderRef.current.stop();


        // Wait until the final Blob has been created.
        videoBlob =
          await stopPromise;

      } catch (err) {

        // Log recording/Blob creation errors.
        console.warn(
          'Failed to compile video recording blob:',
          err
        );
      }
    }


    // ---------------- FINAL WARNING VALUES ----------------

    // Use the explicitly supplied warning count if available.
    // Otherwise use the current React state.
    const finalWarningsCount =
      overrideWarningsCount !== undefined
        ? overrideWarningsCount
        : warningsCount;


    // Use the explicitly supplied warning log if available.
    // Otherwise use the current React state.
    const finalWarningsLog =
      overrideWarningsLog !== undefined
        ? overrideWarningsLog
        : warningsLog;


    // Create a multipart/form-data request body.
    // This allows us to send both normal fields and the video file.
    const formData = new FormData();


    // Add the username to the multipart request.
    formData.append(
      'username',
      activeUser
    );


    // Add the selected quiz category.
    formData.append(
      'quizCategory',
      selectedCategory
    );


    // Convert the answers object into JSON text.
    formData.append(
      'answersJson',
      JSON.stringify(answers)
    );


    // Add the final warning count.
    formData.append(
      'warningsCount',
      String(finalWarningsCount)
    );


    // Convert the warning array into JSON text.
    formData.append(
      'warningsLogJson',
      JSON.stringify(finalWarningsLog)
    );


    // Upload the recorded video only when recording succeeded.
    if (videoBlob) {

      // Add the Blob as the videoFile field.
      formData.append(
        'videoFile',
        videoBlob,
        `${activeUser}-proctor.webm`
      );
    }


    // ---------------- SEND SUBMISSION TO BACKEND ----------------

    try {

      // Send the completed assessment to the backend.
      const response = await fetch(
        `${API_BASE_URL}/assessment/submit`,
        {

          // Use POST because we are creating/submitting an assessment.
          method: 'POST',


          // Do NOT manually set Content-Type here.
          // The browser automatically creates the multipart/form-data
          // boundary required by FormData.
          headers: {

            // Send the current audit session ID.
            'X-Session-ID':
              localStorage.getItem(
                'audit_session_id'
              ) ||
              'sess_' + activeUser,


            // Send the active user ID.
            'X-User-ID':
              activeUser
          },


          // Send the multipart form data.
          body: formData
        }
      );


      // Continue only if the backend accepted the submission.
      if (response.ok) {

        // Convert the response JSON into JavaScript data.
        const result =
          await response.json();


        // Store the returned assessment result.
        setScorecard(result);


        // Assessment history refresh is currently disabled.
        // fetchHistory();
      }

    } catch (err) {

      // Handle network/submission errors.
      console.error(
        'Failed to submit assessment:',
        err
      );

    } finally {

      // Stop the submission loading state.
      setIsSubmitting(false);
    }
  };


  // ---------------- RETURN TO LOBBY ----------------

  // Reset the current assessment and return to the category-selection screen.
  const handleBackToLobby = () => {

    // Allow a new assessment to be submitted.
    submissionStartedRef.current = false;


    // Remove the selected category.
    setSelectedCategory(null);


    // Remove the current questions.
    setQuestions([]);


    // Clear the previous scorecard.
    setScorecard(null);


    // Mark the quiz as inactive.
    setQuizActive(false);


    // Reset the warning count.
    setWarningsCount(0);


    // Clear the warning history.
    setWarningsLog([]);
  };


  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)' }}>
      <Sidebar activePage="assessment" />
      <div style={{ flex: 1, marginLeft: '260px', padding: '32px 24px', boxSizing: 'border-box' }}>
        <div style={{ maxWidth: '850px', margin: '0 auto' }}>

          {/* Hidden Canvas for background CV proctor check */}
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {/* Title Heading */}
          <div style={{ marginBottom: '24px' }}>
            <h1 className="neon-title" style={{ fontSize: '24px' }}>
              <Award size={22} style={{ color: 'var(--accent-purple)' }} />
              Skill Assessments
            </h1>
           
          </div>

          {/* Permission Flow Modal */}
          {permissionState === 'requesting' && (
            <div className="modal-backdrop">
              <div className="modal-content" style={{ maxWidth: '450px', textAlign: 'center', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 600 }}>AI Interview Setup</h3>
                <div style={{ margin: '12px auto' }}>
                  <Video size={48} className="pulse-dot" style={{ color: 'var(--accent-purple)', animationDuration: '2s' }} />
                </div>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  This assessment runs on an **AI Proctoring and Video Response** system. Please click "Allow" on the browser prompt to grant **Camera and Microphone** access.
                </p>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Waiting for device permissions...</span>
              </div>
            </div>
          )}

          {permissionState === 'denied' && (
            <div className="modal-backdrop">
              <div className="modal-content" style={{ maxWidth: '450px', textAlign: 'center', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--status-failed)' }}>Permissions Blocked</h3>
                <div style={{ margin: '12px auto' }}>
                  <AlertTriangle size={48} style={{ color: 'var(--status-failed)' }} />
                </div>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Camera and Microphone access are required to take this assessment. Please enable them in your browser settings and try again.
                </p>
                <button onClick={() => setPermissionState('idle')} className="btn btn-primary" style={{ height: '36px' }}>
                  Close
                </button>
              </div>
            </div>
          )}

          {/* Quiz Active View */}
          {quizActive && selectedCategory && questions.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', alignItems: 'start', marginBottom: '24px' }}>
              
              {/* Left Side - Question panel */}
              <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Header: Progress & Timer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                  <div>
                    <strong style={{ color: 'var(--accent-purple)', fontSize: '15px' }}>{selectedCategory} Quiz</strong>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      Question {activeQuestionIdx + 1} of {questions.length}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255, 255, 255, 0.04)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <Timer size={14} style={{ color: questionSecondsLeft < 15 ? 'var(--status-failed)' : 'var(--accent-purple)' }} />
                    <span style={{ fontSize: '14px', fontWeight: 'bold', fontFamily: 'monospace', color: questionSecondsLeft < 15 ? 'var(--status-failed)' : 'var(--text-primary)' }}>
                      0:{questionSecondsLeft.toString().padStart(2, '0')}
                    </span>
                  </div>
                </div>

                {/* Quiz Body */}
                <div>
                  <p style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '16px', lineHeight: 1.5 }}>
                    {questions[activeQuestionIdx].questionText}
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {questions[activeQuestionIdx].options && questions[activeQuestionIdx].options.map((option, idx) => {
                      const qId = questions[activeQuestionIdx].id!;
                      const isSelected = answers[qId] === idx;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectOption(qId, idx)}
                          style={{
                            padding: '12px 16px',
                            borderRadius: '8px',
                            background: isSelected ? 'rgba(168, 85, 247, 0.1)' : 'rgba(255,255,255,0.02)',
                            border: `1px solid ${isSelected ? 'var(--accent-purple)' : 'var(--border-color)'}`,
                            color: isSelected ? 'var(--accent-purple)' : 'var(--text-primary)',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: '13px',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <strong style={{ marginRight: '8px' }}>{String.fromCharCode(65 + idx)}.</strong>
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Footer Navigation */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                  <button
                    type="button"
                    onClick={handlePrev}
                    disabled={activeQuestionIdx === 0}
                    className="btn btn-secondary"
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                  >
                    Previous
                  </button>

                  {activeQuestionIdx === questions.length - 1 ? (
                    <button
                      type="button"
                      onClick={() => handleSubmitQuiz()}
                      className="btn btn-primary"
                      style={{ height: '36px', padding: '0 16px', fontSize: '12px' }}
                    >
                      Submit Assessment
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleNextManual}
                      className="btn btn-secondary"
                      style={{ fontSize: '12px', padding: '6px 12px' }}
                    >
                      Next
                    </button>
                  )}
                </div>

              </div>

              {/* Right Side - Live webcam proctoring feed */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Proctor Monitor</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div className="pulse-dot"></div>
                      <span style={{ fontSize: '11px', color: 'var(--status-success)', fontWeight: 600 }}>LIVE</span>
                    </div>
                  </div>

                    <div style={{ width: '100%', height: '140px', background: '#000', borderRadius: '8px', border: '1px solid var(--border-color)', position: 'relative', overflow: 'hidden' }}>
                    {/* Live webcam feed element */}
                    <video
                      ref={videoPreviewRef}
                      autoPlay
                      playsInline
                      muted
                      style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                    />
                      {/* Attach face detection to the live video preview */}
                      {quizActive && <AssessmentRoom videoRef={videoPreviewRef} triggerWarning={(type: string, _ts?: string) => addWarning(type === 'FaceNotVisible' ? 'User left camera frame.' : type === 'MultipleFacesDetected' ? 'Multiple faces detected in frame.' : String(type))} />}
                  </div>
                </div>

                {/* Proctor Infractions Summary */}
                <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <h4 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--status-failed)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={14} />
                    Proctoring Infractions
                  </h4>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px' }}>Warnings: <strong style={{ color: warningsCount > 0 ? 'var(--status-failed)' : 'var(--status-success)' }}>{warningsCount} / 3</strong></span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '80px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '10px', fontFamily: 'monospace' }}>
                    {warningsLog.length === 0 ? (
                      <span style={{ color: 'var(--text-muted)' }}>No infractions logged. Focus maintained.</span>
                    ) : (
                      warningsLog.map((log, idx) => (
                        <div key={idx} style={{ color: 'var(--status-warning)' }}>{log}</div>
                      ))
                    )}
                  </div>
                </div>

              </div>

            </div>
          ) : scorecard ? (
            /* scorecard View */
            <div className="glass-card" style={{ padding: '24px', marginBottom: '24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: scorecard.isPassed ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                border: `2px solid ${scorecard.isPassed ? 'var(--status-success)' : 'var(--status-failed)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: scorecard.isPassed ? '0 0 15px rgba(16, 185, 129, 0.2)' : '0 0 15px rgba(239, 68, 68, 0.2)'
              }}>
                {scorecard.isPassed ? (
                  <CheckCircle size={36} style={{ color: 'var(--status-success)' }} />
                ) : (
                  <XCircle size={36} style={{ color: 'var(--status-failed)' }} />
                )}
              </div>

              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {scorecard.isPassed ? 'Assessment Completed!' : 'Assessment Failed'}
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  You completed the {scorecard.quizCategory} evaluation.
                </p>
              </div>

              <div style={{ padding: '16px 24px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px', border: '1px solid var(--border-color)', minWidth: '180px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Your Score</div>
                <div style={{ fontSize: '32px', fontWeight: 800, color: scorecard.isPassed ? 'var(--status-success)' : 'var(--status-failed)' }}>
                  {scorecard.score}%
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Passing Score: 70% | Warnings Triggered: {scorecard.warningsCount}
                </div>
              </div>

              <button
                type="button"
                onClick={handleBackToLobby}
                className="btn btn-secondary"
                style={{ fontSize: '13px', padding: '8px 16px' }}
              >
                Back to Assessments
              </button>
            </div>
          ) : (
            /* Lobby Selection View */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Category Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                {categories.map((category, index) => {
                  let description = '';
                  if (category.includes('C#')) {
                    description = 'Test your logic on collections, disposal patterns, and basic compiler architectures.';
                  } else if (category.includes('React')) {
                    description = 'Evaluate your knowledge on functional components, hooks, virtual DOM, and render hooks.';
                  } else if (category.includes('SQL')) {
                    description = 'Verify database query joins, primary keys, aggregation, and performance structures.';
                  } else {
                    description = 'Test your problem-solving skills with time and space complexity challenges.';
                  }

                  return (
                    <div key={index} className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <BookOpen size={16} style={{ color: 'var(--accent-purple)' }} />
                          <strong style={{ fontSize: '15px', color: 'var(--text-primary)' }}>{category}</strong>
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                          {description}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleInitiateQuiz(category)}
                        disabled={isLoadingQuestions}
                        className="btn btn-primary"
                        style={{ height: '36px', width: '100%', fontSize: '12px' }}
                      >
                        {isLoadingQuestions ? 'Preparing...' : 'Start Assessment'}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Past History Log */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>My Assessment History</h3>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={toggleHistory}
                      className="btn btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '11px' }}
                    >
                      {showHistory ? 'Hide History' : 'Show History'}
                    </button>
                    {showHistory && (
                      <button
                        type="button"
                        onClick={fetchHistory}
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '11px' }}
                        disabled={isLoadingHistory}
                      >
                        <RefreshCw size={11} className={isLoadingHistory ? 'spin' : ''} />
                        Refresh
                      </button>
                    )}
                  </div>
                </div>

                {showHistory && (
                  <>
                    {isLoadingHistory && history.length === 0 ? (
                      <div className="glass-card" style={{ padding: '30px', textAlign: 'center' }}>
                        <div className="pulse-dot" style={{ margin: '0 auto 8px auto' }}></div>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Retrieving test logs...</span>
                      </div>
                    ) : history.length === 0 ? (
                      <div className="glass-card" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                        No assessments logged yet. Start a quiz above to record evaluation logs.
                      </div>
                    ) : (
                      <div style={{ overflowX: 'auto', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                        <table className="logs-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                          <thead>
                            <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border-color)' }}>
                              <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 500 }}>Category</th>
                              <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 500 }}>Date Taken</th>
                              <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 500 }}>Grade Score</th>
                              <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 500 }}>Evaluation</th>
                              <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 500 }}>Proctoring</th>
                            </tr>
                          </thead>
                          <tbody>
                            {history.map((item) => (
                              <React.Fragment key={item.id}>
                                <tr
                                  onClick={() => setExpandedAttemptId(expandedAttemptId === item.id ? null : item.id!)}
                                  style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
                                >
                                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{item.quizCategory}</td>
                                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                                    {new Date(item.completedAt).toLocaleDateString()} -{' '}
                                    {new Date(item.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </td>
                                  <td style={{ padding: '12px 16px', fontWeight: 'bold', color: item.isPassed ? 'var(--status-success)' : 'var(--status-failed)' }}>
                                    {item.quizCategory && item.quizCategory.includes('Data Structures') ? (item.isPassed ? 'Pending' : 'Failed') : `${item.score}%`}
                                  </td>
                                  <td style={{ padding: '12px 16px' }}>
                                    <span style={{
                                      padding: '2px 8px',
                                      borderRadius: '4px',
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      background: item.isPassed ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                      border: `1px solid ${item.isPassed ? 'var(--status-success)' : 'var(--status-failed)'}`,
                                      color: item.isPassed ? 'var(--status-success)' : 'var(--status-failed)'
                                }}>
                                  {item.isPassed ? 'PASSED' : 'FAILED'}
                                </span>
                              </td>
                              <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontSize: '12px', color: item.warningsCount > 0 ? 'var(--status-failed)' : 'var(--status-success)', fontWeight: 600 }}>
                                    {item.warningsCount > 0 ? `${item.warningsCount} Warnings` : 'Clean Feed'}
                                  </span>
                                  {expandedAttemptId === item.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </div>
                              </td>
                            </tr>

                            {/* Expanded Proctoring Report details */}
                            {expandedAttemptId === item.id && (
                              <tr style={{ background: 'rgba(255, 255, 255, 0.01)' }}>
                                <td colSpan={5} style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
                                  <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                                    
                                    {/* Video Player */}
                                    <div style={{ flex: '0 0 320px' }}>
                                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                        Recorded proctor session
                                      </div>
                                      {item.videoData && item.videoData.includes('/uploads/') ? (
                                        <video
                                          src={API_ORIGIN + item.videoData}
                                          controls
                                          width="320"
                                          style={{ borderRadius: '8px', border: '1px solid var(--border-color)', background: '#000', outline: 'none' }}
                                        />
                                      ) : (
                                        <div style={{ width: '320px', height: '180px', background: '#000', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--status-success)', border: '1px solid var(--border-color)', position: 'relative' }}>
                                          <div className="pulse-dot" style={{ position: 'absolute', top: '12px', right: '12px' }}></div>
                                          <Video size={30} />
                                          <span style={{ fontSize: '11px', marginTop: '6px', fontWeight: 600 }}>PROCTOR SCAN CAPTURED</span>
                                          <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Length: 10:00 | Simulated video feed</span>
                                        </div>
                                      )}
                                    </div>

                                    {/* Proctoring Warnings Log */}
                                    <div style={{ flex: 1, minWidth: '250px' }}>
                                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                        Proctoring Journal: {item.warningsCount} Violations
                                      </div>
                                      {item.warningsLog && item.warningsLog.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', fontFamily: 'monospace', background: 'rgba(0,0,0,0.15)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', maxHeight: '140px', overflowY: 'auto' }}>
                                          {item.warningsLog.map((logStr, idx) => (
                                            <div key={idx} style={{ color: 'var(--status-warning)', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                                              <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: '2px' }} />
                                              <span>{logStr}</span>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <div style={{ background: 'rgba(16, 185, 129, 0.04)', color: 'var(--status-success)', border: '1px solid rgba(16, 185, 129, 0.1)', padding: '12px 16px', borderRadius: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          <CheckCircle size={14} />
                                          <span>Proctor validation passed. Focus was fully maintained with 0 violations.</span>
                                        </div>
                                      )}
                                    </div>

                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>

        </div>
      )}

    </div>
  </div>

      {/* Grading Toast */}
      {isSubmitting && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          padding: '12px 20px',
          borderRadius: '8px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          color: 'var(--text-primary)',
          fontSize: '14px',
          boxShadow: '0 10px 20px rgba(0,0,0,0.5)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Timer size={14} className="spin" />
          <span>Uploading video & grading assessment...</span>
        </div>
      )}
    </div>
  );
};

export default AssessmentPage;
