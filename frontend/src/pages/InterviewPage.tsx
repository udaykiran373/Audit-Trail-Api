import { useState, useRef, useEffect } from 'react';
import { Mic, CheckCircle, AlertTriangle, RefreshCw, StopCircle, PlayCircle, Video, FileText, UserCircle, ArrowLeft } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import AssessmentRoom from '../components/AssessmentRoom';
import {API_BASE_URL} from '../config';
// const API_BASE_URL = 'http://localhost:5081/api';

const INTERVIEW_ROLES = [
  { role: "Full-Stack Developer", question: "Can you explain your approach to designing a scalable backend architecture for a high-traffic application?" },
  { role: "Frontend Architect", question: "How do you manage state and optimize performance in a large-scale React application?" },
  { role: "Database Administrator", question: "Describe a time you had to optimize a slow SQL query. What steps did you take?" }
];

export default function InterviewPage() {
  const activeUser = localStorage.getItem('audit_active_user') || 'anonymous';
  const activeSessionId = localStorage.getItem('audit_session_id') || crypto.randomUUID();

  const [selectedRoleIndex, setSelectedRoleIndex] = useState(0);
  const currentRole = INTERVIEW_ROLES[selectedRoleIndex];

  const [isRecording, setIsRecording] = useState(false);
  const [isInterviewActive, setIsInterviewActive] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [feedback, setFeedback] = useState<{ score: string, text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Proctoring States
  const [warningsCount, setWarningsCount] = useState<number>(0);
  const [warningsLog, setWarningsLog] = useState<string[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  const [permissionState, setPermissionState] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');
  const [selectedTranscript, setSelectedTranscript] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const speechRecognitionRef = useRef<any>(null);

  // Log page view on mount
  useEffect(() => {
    fetch(`${API_BASE_URL}/aiinterview/log-view`, {
      method: 'POST',
      headers: {
        'X-Session-ID': activeSessionId,
        'X-User-ID': activeUser,
        'Content-Type': 'application/json'
      }
    }).catch(err => console.error('Failed to log interview page view:', err));
  }, []);

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const response = await fetch(`${API_BASE_URL}/aiinterview/history/${activeUser}`, {
        headers: {
          'X-Session-ID': activeSessionId,
          'X-User-ID': activeUser,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      }
    } catch (err) {
      console.error('Failed to load interview history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const toggleHistory = () => {
    if (!showHistory) {
      fetchHistory();
    }
    setShowHistory(!showHistory);
  };

  const handleInitiateInterview = (index: number) => {
    setSelectedRoleIndex(index);
    setPermissionState('requesting');
    
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        // Stop temporary stream since the actual video tag will request it again or we can reuse it
        stream.getTracks().forEach(t => t.stop());
        setPermissionState('granted');
        
        fetch(`${API_BASE_URL}/aiinterview/log-permissions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-ID': activeSessionId,
            'X-User-ID': activeUser
          },
          body: JSON.stringify({ granted: true, cameraGranted: true, microphoneGranted: true })
        }).catch(e => console.error(e));

        setIsInterviewActive(true);
      })
      .catch((err) => {
        console.warn('Permissions denied', err);
        setPermissionState('denied');
        
        fetch(`${API_BASE_URL}/aiinterview/log-permissions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-ID': activeSessionId,
            'X-User-ID': activeUser
          },
          body: JSON.stringify({ granted: false, cameraGranted: false, microphoneGranted: false })
        }).catch(e => console.error(e));
      });
  };

  useEffect(() => {
    // We get camera stream when component renders the video tag, 
    // which is handled below in another useEffect for isInterviewActive.


    // Initialize Web Speech API
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      speechRecognitionRef.current = new SpeechRecognition();
      speechRecognitionRef.current.continuous = true;
      speechRecognitionRef.current.interimResults = true;
      
      speechRecognitionRef.current.onresult = (event: any) => {
        let text = '';
        for (let i = 0; i < event.results.length; i++) {
          text += event.results[i][0].transcript + ' ';
        }
        setTranscript(text);
      };
    }
  }, []);

  // Tab switching focus proctoring listeners
  useEffect(() => {
    if (!isRecording) return;

    const handleBlur = () => {
      setWarningsCount(prev => prev + 1);
      setWarningsLog(prev => [...prev, `Tab switched or focus lost at ${new Date().toLocaleTimeString()}`]);
    };
    
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setWarningsCount(prev => prev + 1);
        setWarningsLog(prev => [...prev, `Browser hidden or minimized at ${new Date().toLocaleTimeString()}`]);
      }
    };

    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isRecording]);

  useEffect(() => {
    if (isInterviewActive) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then((stream) => {
          if (videoRef.current) videoRef.current.srcObject = stream;
        })
        .catch(err => console.error("Could not attach camera to video view:", err));
    } else {
      // Stop stream when exiting interview room
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(t => t.stop());
        videoRef.current.srcObject = null;
      }
    }
  }, [isInterviewActive]);

  const addWarning = (type: string) => {
    setWarningsCount(prev => prev + 1);
    setWarningsLog(prev => [...prev, `${type} detected at ${new Date().toLocaleTimeString()}`]);
  };

  const startInterview = () => {
    if (!videoRef.current || !videoRef.current.srcObject) return;
    
    setTranscript('');
    setWarningsCount(0);
    setWarningsLog([]);
    chunksRef.current = [];
    
    // Start Video Recording
    const stream = videoRef.current.srcObject as MediaStream;
    mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'video/webm' });
    mediaRecorderRef.current.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    mediaRecorderRef.current.start(1000);

    // Start Speech Recognition
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.start();
    }

    setIsRecording(true);
  };

  const endInterview = async () => {
    setIsRecording(false);
    setIsSubmitting(true);

    if (speechRecognitionRef.current) speechRecognitionRef.current.stop();

    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = async () => {
        const videoBlob = new Blob(chunksRef.current, { type: 'video/webm' });
        await submitData(videoBlob);
      };
      mediaRecorderRef.current.stop();
    } else {
      setIsSubmitting(false);
    }
  };

  const submitData = async (videoBlob: Blob) => {
    const formData = new FormData();
    formData.append('username', activeUser);
    formData.append('role', currentRole.role);
    formData.append('question', currentRole.question);
    formData.append('transcript', transcript);
    formData.append('warningsCount', String(warningsCount));
    formData.append('warningsLogJson', JSON.stringify(warningsLog));
    formData.append('videoFile', videoBlob, 'interview.webm');

    try {
      const response = await fetch(`${API_BASE_URL}/aiinterview/submit`, {
        method: 'POST',
        headers: {
          'X-Session-ID': activeSessionId,
          'X-User-ID': activeUser
        },
        body: formData
      });
      const result = await response.json();
      setFeedback({ score: result.score, text: result.feedback });
      fetchHistory();
    } catch (err) {
      console.error("Failed to submit interview:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)' }}>
      <Sidebar activePage="interview" />
      <div style={{ flex: 1, marginLeft: '260px', padding: '32px 24px', boxSizing: 'border-box' }}>
        <h1 className="neon-title" style={{ fontSize: '24px', marginBottom: '8px' }}>AI Video Interview</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Proctored automated technical screening</p>

        {/* Permission Flow Modal */}
        {permissionState === 'requesting' && (
          <div className="modal-backdrop">
            <div className="modal-content" style={{ maxWidth: '450px', textAlign: 'center', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600 }}>AI Interview Setup</h3>
              <div style={{ margin: '12px auto' }}>
                <Video size={48} className="pulse-dot" style={{ color: 'var(--accent-purple)', animationDuration: '2s' }} />
              </div>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                This interview runs on an **AI Proctoring and Video Response** system. Please click "Allow" on the browser prompt to grant **Camera and Microphone** access.
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
                Camera and Microphone access are required to take this interview. Please enable them in your browser settings and try again.
              </p>
              <button onClick={() => setPermissionState('idle')} className="btn btn-primary" style={{ height: '36px' }}>
                Close
              </button>
            </div>
          </div>
        )}

        {feedback ? (
          <div className="glass-card" style={{ padding: '24px', textAlign: 'center', marginBottom: '24px' }}>
            <CheckCircle size={48} style={{ color: 'var(--status-success)', margin: '0 auto 16px auto' }} />
            <h2>Interview Submitted</h2>
            <div style={{ fontSize: '32px', fontWeight: 'bold', margin: '16px 0', color: 'var(--accent-purple)' }}>Score: {feedback.score}</div>
            <p>{feedback.text}</p>
            <button className="btn btn-primary" onClick={() => { setFeedback(null); setIsInterviewActive(false); }} style={{ marginTop: '16px' }}>Return to Roles</button>
          </div>
        ) : isInterviewActive ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '24px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Role: {currentRole.role}</h2>
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  if (isRecording) {
                    if (!window.confirm('Are you sure you want to exit? Your recording will be lost.')) return;
                  }
                  setIsInterviewActive(false);
                }}
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                <ArrowLeft size={14} style={{ marginRight: '6px' }} />
                Back to Roles
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              {/* Left Side: Video & Controls */}
              <div className="glass-card" style={{ padding: '24px', position: 'relative' }}>
                <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px' }}>{currentRole.question}</div>
                <div style={{ position: 'relative', width: '100%', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                  <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', display: 'block', background: '#000', transform: 'scaleX(-1)' }} />
                  {isRecording && (
                    <>
                      <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div className="pulse-dot" style={{ background: 'red' }}></div>
                        <span style={{ color: 'white', fontSize: '12px', fontWeight: 'bold' }}>REC</span>
                      </div>
                      <AssessmentRoom 
                        videoRef={videoRef} 
                        triggerWarning={(type: string) => addWarning(type === 'FaceNotVisible' ? 'User left camera frame.' : type === 'MultipleFacesDetected' ? 'Multiple faces detected in frame.' : type)} 
                      />
                    </>
                  )}
                </div>
                
                <div style={{ marginTop: '16px', display: 'flex', gap: '12px', justifyContent: 'center' }}>
                  {!isRecording ? (
                    <button onClick={startInterview} className="btn btn-primary" disabled={isSubmitting}>
                      <PlayCircle size={16} style={{ marginRight: '8px' }} /> Start Answering
                    </button>
                  ) : (
                    <button onClick={endInterview} className="btn" style={{ background: 'var(--status-failed)', color: 'white' }}>
                      <StopCircle size={16} style={{ marginRight: '8px' }} /> Finish Answer
                    </button>
                  )}
                </div>

                {warningsCount > 0 && (
                  <div style={{ marginTop: '16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--status-failed)', padding: '12px', borderRadius: '8px', fontSize: '12px' }}>
                    <div style={{ color: 'var(--status-failed)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <AlertTriangle size={14} /> Warnings Detected: {warningsCount}
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-secondary)' }}>
                      {warningsLog.slice(-2).map((log, i) => <li key={i}>{log}</li>)}
                    </ul>
                  </div>
                )}
              </div>

              {/* Right Side: Live Transcript */}
              <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--text-secondary)' }}>
                  <Mic size={18} className={isRecording ? "pulse-dot" : ""} color={isRecording ? "var(--status-success)" : "currentColor"} />
                  <strong>Live Transcript</strong>
                </div>
                <div style={{ flex: 1, background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px', overflowY: 'auto', minHeight: '200px', fontStyle: transcript ? 'normal' : 'italic', color: transcript ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  {transcript || "Speak clearly into your microphone. Your answer will be transcribed here in real-time..."}
                </div>
                {isSubmitting && <div style={{ marginTop: '16px', color: 'var(--accent-purple)' }}>Uploading and analyzing video response...</div>}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
              {INTERVIEW_ROLES.map((r, i) => {
                let description = '';
                if (r.role.includes('Full-Stack')) {
                  description = 'Technical screening focusing on backend architectures and high-traffic system design.';
                } else if (r.role.includes('Frontend')) {
                  description = 'Evaluation covering state management, performance, and advanced React patterns.';
                } else if (r.role.includes('Database')) {
                  description = 'Test your ability to optimize queries, manage database performance, and tune SQL.';
                } else {
                  description = 'General behavioral and technical screening.';
                }

                return (
                  <div key={i} className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <UserCircle size={16} style={{ color: 'var(--accent-purple)' }} />
                        <strong style={{ fontSize: '15px', color: 'var(--text-primary)' }}>{r.role}</strong>
                      </div>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        {description}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleInitiateInterview(i)}
                      className="btn btn-primary"
                      style={{ height: '36px', width: '100%', fontSize: '12px' }}
                    >
                      Start Interview
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Past History Log */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Interview History</h3>
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
                  <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Retrieving interview logs...</span>
                </div>
              ) : history.length === 0 ? (
                <div className="glass-card" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                  No interviews logged yet.
                </div>
              ) : (
                <div style={{ overflowX: 'auto', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <table className="logs-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 500 }}>Role Applied</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 500 }}>Date Taken</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 500 }}>Score</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 500 }}>Warnings</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 500 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((item) => (
                        <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>{item.roleAppliedFor}</td>
                          <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                            {new Date(item.completedAt).toLocaleDateString()} {new Date(item.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ 
                              padding: '4px 8px', 
                              borderRadius: '4px', 
                              background: item.score === 'Pending' ? 'rgba(234, 179, 8, 0.1)' : 'rgba(168, 85, 247, 0.1)', 
                              color: item.score === 'Pending' ? '#eab308' : 'var(--accent-purple)' 
                            }}>
                              {item.score}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', color: item.warningsCount > 0 ? 'var(--status-failed)' : 'var(--status-success)' }}>
                            {item.warningsCount}
                          </td>
                          <td style={{ padding: '12px 16px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                            {item.videoUrl ? (
                              <a href={`http://localhost:5081${item.videoUrl}`} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--accent-purple)', textDecoration: 'none' }}>
                                <Video size={14} /> View Video
                              </a>
                            ) : <span style={{ color: 'var(--text-muted)' }}>No Video</span>}
                            <button 
                              type="button" 
                              onClick={() => setSelectedTranscript(item.candidateTranscript)} 
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--accent-purple)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontSize: '13px' }}
                            >
                              <FileText size={14} /> View Text
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Transcript Modal */}
      {selectedTranscript !== null && (
        <div className="modal-backdrop" onClick={() => setSelectedTranscript(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '100%', padding: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={20} style={{ color: 'var(--accent-purple)' }} /> Interview Transcript
            </h3>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', minHeight: '150px', maxHeight: '400px', overflowY: 'auto', lineHeight: 1.6, color: 'var(--text-primary)' }}>
              {selectedTranscript || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No transcript recorded.</span>}
            </div>
            <div style={{ marginTop: '24px', textAlign: 'right' }}>
              <button className="btn btn-secondary" onClick={() => setSelectedTranscript(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
