import React, { useState, useEffect, useRef } from 'react';
import AssessmentRoom from '../components/AssessmentRoom';
import { Award, BookOpen, CheckCircle, XCircle, Timer, RefreshCw, Video, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import type { Question, Assessment } from '../types';
import Sidebar from '../components/Sidebar';

  const API_BASE_URL = 'http://localhost:5081/api';
  const API_ORIGIN = API_BASE_URL.replace('/api', '');

const AssessmentPage: React.FC = () => {
  const activeUser = localStorage.getItem('audit_active_user') || 'anonymous';

  const [categories] = useState<string[]>([
    'C# .NET Core',
    'React JS Essentials',
    'SQL & Database Design',
    'Data Structures & Algorithms'
  ]);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [activeQuestionIdx, setActiveQuestionIdx] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [history, setHistory] = useState<Assessment[]>([]);
  
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quizActive, setQuizActive] = useState(false);
  const [scorecard, setScorecard] = useState<Assessment | null>(null);
  
  // Proctoring States
  const [warningsCount, setWarningsCount] = useState<number>(0);
  const [warningsLog, setWarningsLog] = useState<string[]>([]);
  const [expandedAttemptId, setExpandedAttemptId] = useState<string | null>(null);

  // AI Interview Question Timer (1 minute per question)
  const [questionSecondsLeft, setQuestionSecondsLeft] = useState<number>(60);
  
  // Permission Flow State
  const [permissionState, setPermissionState] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');

  // Webcam Streams & Recorder Refs
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  // Hidden Canvas for Auto-proctoring scan
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevFrameDataRef = useRef<Uint8ClampedArray | null>(null);
  const staticFrameCountRef = useRef<number>(0);

  const activeSessionId = localStorage.getItem('audit_session_id') || crypto.randomUUID();

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'X-Session-ID': activeSessionId,
    'X-User-ID': activeUser,
  });

  // Fetch assessment history
  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const response = await fetch(`${API_BASE_URL}/assessment/history/${activeUser}`, {
        headers: getHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      }
    } catch (err) {
      console.error('Failed to load assessment history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // Per-Question 1-Minute Timer Loop
  useEffect(() => {
    if (!quizActive || questionSecondsLeft <= 0) {
      if (quizActive && questionSecondsLeft === 0) {
        // Auto submit current question or final quiz
        handleNextQuestionAuto();
      }
      return;
    }
    const timer = setInterval(() => {
      setQuestionSecondsLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [quizActive, questionSecondsLeft]);

  // Tab switching focus proctoring listeners
  useEffect(() => {
    if (!quizActive) return;

    const handleBlur = () => {
      addWarning("Window focus lost (tab/window switch detected).");
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        addWarning("Document tab switch detected.");
      }
    };

    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [quizActive]);

  // Hidden canvas automatic computer-vision proctor scan loop (runs every 3 seconds)
  useEffect(() => {
    if (!quizActive) return;

    const interval = setInterval(() => {
      runProctorScan();
    }, 3000);

    return () => clearInterval(interval);
  }, [quizActive, warningsCount]);

  // Auto-proctoring scan method
  const runProctorScan = () => {
    if (!videoPreviewRef.current || !canvasRef.current) return;
    const video = videoPreviewRef.current;
    const canvas = canvasRef.current;
    
    // Check if the stream is active and holds valid resolutions
    if (video.videoWidth === 0 || video.videoHeight === 0) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw current frame into hidden canvas
    canvas.width = 160;
    canvas.height = 120;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    try {
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = frame.data;

      // 1. Brightness check (checks if the lens is covered or user leaves a dark room)
      let totalBrightness = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        totalBrightness += (r + g + b) / 3;
      }
      const avgBrightness = totalBrightness / (data.length / 4);

      if (avgBrightness < 10) {
        addWarning("Webcam feed blocked or user left frame (Camera feed is too dark).");
        return;
      }

      // 2. Pixel difference check (checks for absence or static frozen feeds)
      if (prevFrameDataRef.current) {
        let diffPixels = 0;
        const prev = prevFrameDataRef.current;
        for (let i = 0; i < data.length; i += 4) {
          const diff = Math.abs(data[i] - prev[i]) + 
                       Math.abs(data[i + 1] - prev[i + 1]) + 
                       Math.abs(data[i + 2] - prev[i + 2]);
          if (diff > 80) { // threshold for change
            diffPixels++;
          }
        }

        const diffPercentage = (diffPixels / (data.length / 4)) * 100;

        // If the camera feed has no changes at all (< 0.1% change) for multiple cycles (12+ seconds),
        // it means the candidate is absent or has set a static frozen overlay
        if (diffPercentage < 0.1) {
          staticFrameCountRef.current += 1;
          if (staticFrameCountRef.current >= 4) {
            addWarning("User absence or frozen feed detected.");
            staticFrameCountRef.current = 0;
          }
        } else {
          staticFrameCountRef.current = 0;
        }
      }

      prevFrameDataRef.current = data;
    } catch (e) {
      console.warn('Proctor canvas analyzer context blocked.', e);
    }
  };

  // Method to log infractions, trigger real-time Event 2 logging, and auto-submit at 3 violations
  const addWarning = (reason: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const detail = `[${timestamp}] ${reason}`;
    
    // Map reason text to WarningType keyword for Event 2 proctoring warning
    let warningType = 'LookingAway';
    if (reason.toLowerCase().includes('switch') || reason.toLowerCase().includes('focus')) {
      warningType = 'WindowSwitch';
    } else if (reason.toLowerCase().includes('blocked') || reason.toLowerCase().includes('dark')) {
      warningType = 'CameraBlocked';
    } else if (reason.toLowerCase().includes('absence') || reason.toLowerCase().includes('frozen')) {
      warningType = 'UserAbsent';
    }

    // Compute active recording video timestamp offset (e.g. 00:02:15)
    const elapsedSeconds = (activeQuestionIdx * 60) + (60 - questionSecondsLeft);
    const minutes = Math.floor(elapsedSeconds / 60);
    const secs = elapsedSeconds % 60;
    const videoTimestamp = `00:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    // Fire Event 2: Real-time Proctoring Warning (lightweight, non-blocking API call)
    fetch(`${API_BASE_URL}/assessment/log-warning`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        warningType,
        videoTimestamp
      })
    }).catch(err => console.error("Failed to log proctor warning audit log:", err));

    setWarningsLog(prev => {
      const nextLog = [...prev, detail];
      setWarningsCount(curr => {
        const nextCount = curr + 1;
        if (nextCount >= 3) {
          alert("Maximum proctoring warnings exceeded (3/3). Your exam is being submitted immediately.");
          handleSubmitQuiz(nextCount, nextLog);
        }
        return nextCount;
      });
      return nextLog;
    });
  };

  // Trigger permission check (Event 1 logging) before starting the test
  const handleInitiateQuiz = (category: string) => {
    setPermissionState('requesting');

    // Request Mic and Camera permissions
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        // Stop the temporary stream tracks immediately
        stream.getTracks().forEach(t => t.stop());
        setPermissionState('granted');

        // Fire Event 1: Setup and Permissions (Accepted)
        fetch(`${API_BASE_URL}/assessment/log-permissions`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            granted: true,
            cameraGranted: true,
            microphoneGranted: true
          })
        }).catch(e => console.error(e));

        executeStartQuiz(category);
      })
      .catch((err) => {
        console.warn('Permissions denied', err);
        setPermissionState('denied');

        // Fire Event 1: Setup and Permissions (Denied)
        fetch(`${API_BASE_URL}/assessment/log-permissions`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            granted: false,
            cameraGranted: false,
            microphoneGranted: false
          })
        }).catch(e => console.error(e));
      });
  };

  // Load questions and start quiz
  const executeStartQuiz = async (category: string) => {
    setIsLoadingQuestions(true);
    try {
      const response = await fetch(`${API_BASE_URL}/assessment/questions/${encodeURIComponent(category)}`, {
        headers: getHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setQuestions(data);
        setAnswers({});
        setActiveQuestionIdx(0);
        setSelectedCategory(category);
        
        // Reset states
        setQuestionSecondsLeft(60); // 1 minute per question
        setWarningsCount(0);
        setWarningsLog([]);
        setQuizActive(true);
        setScorecard(null);

        // Turn on Webcam stream for CV proctoring (no recording)
        setTimeout(async () => {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            streamRef.current = stream;
            if (videoPreviewRef.current) {
              videoPreviewRef.current.srcObject = stream;
            }
            // --- ADD THIS RECORDING LOGIC ---
            const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
            mediaRecorderRef.current = recorder;
            chunksRef.current = [];
            
            recorder.ondataavailable = (e) => {
              if (e.data && e.data.size > 0) {
                chunksRef.current.push(e.data);
              }
            };
            
            recorder.start(1000);
          } catch (err) {
            console.warn('Webcam feed could not be initialized.', err);
          }
        }, 200);
      }
    } catch (err) {
      console.error('Failed to fetch questions:', err);
    } finally {
      setIsLoadingQuestions(false);
      setPermissionState('idle');
    }
  };

  const handleSelectOption = (questionId: string, optionIdx: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: optionIdx }));
  };

  // Navigates to next question manually (re-init 1-minute countdown)
  const handleNextManual = () => {
    if (activeQuestionIdx < questions.length - 1) {
      setActiveQuestionIdx(prev => prev + 1);
      setQuestionSecondsLeft(60);
    }
  };

  const handlePrev = () => {
    if (activeQuestionIdx > 0) {
      setActiveQuestionIdx(prev => prev - 1);
      setQuestionSecondsLeft(60);
    }
  };

  // Auto-navigates on 1-minute timer run-out
  const handleNextQuestionAuto = () => {
    addWarning(`Timer ran out for question ${activeQuestionIdx + 1} (Auto-advancing).`);
    
    if (activeQuestionIdx < questions.length - 1) {
      setActiveQuestionIdx(prev => prev + 1);
      setQuestionSecondsLeft(60);
    } else {
      // Last question completed, submit entire assessment
      handleSubmitQuiz();
    }
  };

  // Handles Event 3: Submission
 const handleSubmitQuiz = async (overrideWarningsCount?: number, overrideWarningsLog?: string[]) => {
    if (!selectedCategory) return;
    setQuizActive(false);
    setIsSubmitting(true);

    // 1. Stop Webcam stream tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }

    // 2. Safely compile the recorded video into a Blob
    let videoBlob: Blob | null = null;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        const stopPromise = new Promise<Blob>((resolve) => {
          mediaRecorderRef.current!.onstop = () => {
            resolve(new Blob(chunksRef.current, { type: 'video/webm' }));
          };
        });
        mediaRecorderRef.current.stop();
        videoBlob = await stopPromise;
      } catch (err) {
        console.warn('Failed to compile video recording blob:', err);
      }
    }

    const finalWarningsCount = overrideWarningsCount !== undefined ? overrideWarningsCount : warningsCount;
    const finalWarningsLog = overrideWarningsLog !== undefined ? overrideWarningsLog : warningsLog;

    // 3. Create the FormData object (This fixes the red line)
    const formData = new FormData();
    formData.append('username', activeUser);
    formData.append('quizCategory', selectedCategory);
    formData.append('answersJson', JSON.stringify(answers));
    formData.append('warningsCount', String(finalWarningsCount));
    formData.append('warningsLogJson', JSON.stringify(finalWarningsLog));
    
    // Attach the video file if it was successfully recorded
    if (videoBlob) {
      formData.append('videoFile', videoBlob, `${activeUser}-proctor.webm`);
    }

    // 4. Send the data to the API
    try {
      const response = await fetch(`${API_BASE_URL}/assessment/submit`, {
        method: 'POST',
        headers: {
          'X-Session-ID': localStorage.getItem('audit_session_id') || 'sess_' + activeUser,
          'X-User-ID': activeUser
          // Notice there is NO 'Content-Type' here. The browser handles it automatically for FormData.
        },
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        setScorecard(result);
        fetchHistory();
      }
    } catch (err) {
      console.error('Failed to submit assessment:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackToLobby = () => {
    setSelectedCategory(null);
    setQuestions([]);
    setScorecard(null);
    setQuizActive(false);
    setWarningsCount(0);
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
                  <button
                    type="button"
                    onClick={fetchHistory}
                    className="btn btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '11px' }}
                    disabled={isLoadingHistory}
                  >
                    <RefreshCw size={11} className={isLoadingHistory ? 'spin' : ''} />
                    Refresh History
                  </button>
                </div>

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
