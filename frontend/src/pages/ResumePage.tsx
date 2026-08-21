import React, { useState, useEffect, useRef } from 'react';
import { Briefcase, FileText, Plus, Trash2, User, BookOpen, Settings, Check, Download, Globe, Camera, Upload, X } from 'lucide-react';
import type { Resume, WorkExperience, EducationItem, ProjectItem } from '../types';
import Sidebar from '../components/Sidebar';

const API_BASE_URL = 'http://localhost:5081/api';

const ResumePage: React.FC = () => {
  const activeUser = localStorage.getItem('audit_active_user') || 'anonymous';
  const activeSessionId = localStorage.getItem('audit_session_id') || crypto.randomUUID();

  const [resume, setResume] = useState<Resume>({
    username: activeUser,
    fullName: '',
    email: '',
    phone: '',
    summary: '',
    profilePhoto: '',
    videoResumeUrl: '',
    experience: [],
    education: [],
    projects: [],
    skills: []
  });

  const [skillInput, setSkillInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success'
  });

  // Camera state
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // (video resume removed)

  const triggerToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 3000);
  };

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'X-Session-ID': activeSessionId,
    'X-User-ID': activeUser,
  });

  // Calculate completeness percentage dynamically
  const getCompletenessPercent = () => {
    let pct = 0;
    if (resume.fullName.trim()) pct += 15;
    if (resume.email.trim()) pct += 15;
    if (resume.profilePhoto.trim()) pct += 15;
    if (resume.summary.trim()) pct += 15;
    if (resume.experience && resume.experience.length > 0) pct += 15;
    if (resume.projects && resume.projects.length > 0) pct += 15;
    if (resume.skills && resume.skills.length > 0) pct += 10;
    return pct;
  };

  const loadResume = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/resume/${activeUser}`, {
        headers: getHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setResume({
          username: activeUser,
          fullName: data.fullName || '',
          email: data.email || '',
          phone: data.phone || '',
          summary: data.summary || '',
          profilePhoto: data.profilePhoto || '',
          videoResumeUrl: data.videoResumeUrl || '',
          experience: data.experience || [],
          education: data.education || [],
          projects: data.projects || [],
          skills: data.skills || []
        });
      }
    } catch (err) {
      console.error('Failed to load resume details:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadResume();
    return () => {
      // Clean up camera stream on unmount
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleFieldChange = (field: keyof Resume, value: any) => {
    setResume(prev => ({ ...prev, [field]: value }));
  };

  // Upload Photo from Gallery
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      triggerToast('Please select a valid image file.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        handleFieldChange('profilePhoto', event.target.result.toString());
        triggerToast('Photo loaded from gallery!', 'success');
      }
    };
    reader.readAsDataURL(file);
  };

  // Camera capture routines
  const startCamera = async () => {
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 300, height: 300, facingMode: 'user' }
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Failed to access webcam:', err);
      triggerToast('Could not access camera stream. Check permissions.', 'error');
      setShowCamera(false);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 200;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Draw centered square from video stream
        ctx.drawImage(videoRef.current, 0, 0, 200, 200);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        handleFieldChange('profilePhoto', dataUrl);
        triggerToast('Photo captured successfully!', 'success');
      }
      stopCamera();
    }
  };

  // Video resume removed

  // Experience controls
  const addExperience = () => {
    const newItem: WorkExperience = { company: '', role: '', duration: '', description: '' };
    setResume(prev => ({ ...prev, experience: [...prev.experience, newItem] }));
  };

  const updateExperience = (index: number, field: keyof WorkExperience, value: string) => {
    setResume(prev => {
      const list = [...prev.experience];
      list[index] = { ...list[index], [field]: value };
      return { ...prev, experience: list };
    });
  };

  const removeExperience = (index: number) => {
    setResume(prev => ({ ...prev, experience: prev.experience.filter((_, i) => i !== index) }));
  };

  // Education controls
  const addEducation = () => {
    const newItem: EducationItem = { institution: '', degree: '', year: '' };
    setResume(prev => ({ ...prev, education: [...prev.education, newItem] }));
  };

  const updateEducation = (index: number, field: keyof EducationItem, value: string) => {
    setResume(prev => {
      const list = [...prev.education];
      list[index] = { ...list[index], [field]: value };
      return { ...prev, education: list };
    });
  };

  const removeEducation = (index: number) => {
    setResume(prev => ({ ...prev, education: prev.education.filter((_, i) => i !== index) }));
  };

  // Projects controls
  const addProject = () => {
    const newItem: ProjectItem = { title: '', technologies: '', description: '', link: '' };
    setResume(prev => ({ ...prev, projects: [...prev.projects, newItem] }));
  };

  const updateProject = (index: number, field: keyof ProjectItem, value: string) => {
    setResume(prev => {
      const list = [...prev.projects];
      list[index] = { ...list[index], [field]: value };
      return { ...prev, projects: list };
    });
  };

  const removeProject = (index: number) => {
    setResume(prev => ({ ...prev, projects: prev.projects.filter((_, i) => i !== index) }));
  };

  // Skill tags operations
  const handleAddSkill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!skillInput.trim()) return;
    if (resume.skills.includes(skillInput.trim())) {
      setSkillInput('');
      return;
    }
    setResume(prev => ({ ...prev, skills: [...prev.skills, skillInput.trim()] }));
    setSkillInput('');
  };

  const removeSkill = (skill: string) => {
    setResume(prev => ({ ...prev, skills: prev.skills.filter(s => s !== skill) }));
  };

  const handleSaveResume = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      // If videoResumeUrl is a data URL (recorded/uploaded client-side blob), upload it first
      if (resume.videoResumeUrl && resume.videoResumeUrl.startsWith('data:')) {
        try {
          const blob = await (await fetch(resume.videoResumeUrl)).blob();
          const form = new FormData();
          form.append('videoFile', blob, `${activeUser}-resume.webm`);
          form.append('username', activeUser);

          const uploadResp = await fetch(`${API_BASE_URL}/resume/upload-video`, {
            method: 'POST',
            headers: {
              'X-Session-ID': activeSessionId,
              'X-User-ID': activeUser
            },
            body: form
          });

          if (!uploadResp.ok) {
            triggerToast('Video upload failed. Resume not saved.', 'error');
            setIsSaving(false);
            return;
          }

          const upData = await uploadResp.json();
          // server returns relative url (/uploads/resumes/...), store that
          handleFieldChange('videoResumeUrl', upData.url);
        } catch (err) {
          console.error('Video upload error:', err);
          triggerToast('Video upload failed. Resume not saved.', 'error');
          setIsSaving(false);
          return;
        }
      }
      const response = await fetch(`${API_BASE_URL}/resume`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(resume)
      });

      if (response.ok) {
        triggerToast('Profile Resume successfully updated in MongoDB!', 'success');
      } else {
        triggerToast('Failed to save resume.', 'error');
      }
    } catch (err) {
      console.error('Failed to save resume:', err);
      triggerToast('Server connection error.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Simulate Export / Download Resume PDF
  const handleExportResume = async () => {
    try {
      await fetch(`${API_BASE_URL}/audit`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          sessionId: activeSessionId,
          userId: activeUser,
          eventType: 'BUSINESS_EVENT',
          module: 'Resume',
          action: 'RESUME_DOWNLOADED',
          status: 'SUCCESS',
          metadata: {
            fullName: resume.fullName || 'Anonymous User',
            format: 'PDF_TEMPLATE',
            version: 'AchnetResume_v1.2',
            completenessScore: getCompletenessPercent()
          }
        })
      });
      triggerToast('Simulating resume PDF download... Logging event to audit database.', 'success');
    } catch (err) {
      console.error('Failed to log export event:', err);
    }
  };

  const progressPercent = getCompletenessPercent();

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)' }}>
      <Sidebar activePage="resume" />
      <div style={{ flex: 1, marginLeft: '260px', padding: '32px 24px', boxSizing: 'border-box' }}>
        <div style={{ maxWidth: '850px', margin: '0 auto' }}>

        {/* Title Heading */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 className="neon-title" style={{ fontSize: '24px' }}>
              <FileText size={22} style={{ color: 'var(--accent-purple)' }} />
              Achnet Profile Resume Builder
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Fill in your professional credentials. All updates are logged dynamically in MongoDB.
            </p>
          </div>
          <button
            onClick={handleExportResume}
            className="btn btn-secondary"
            style={{ fontSize: '13px', height: '38px' }}
            disabled={!resume.fullName}
          >
            <Download size={14} />
            Export Profile PDF
          </button>
        </div>

        {/* Completeness Tracker Card */}
        <div className="glass-card" style={{ padding: '20px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>Profile Completeness</strong>
            <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--accent-purple)' }}>{progressPercent}% Complete</span>
          </div>

          <div style={{ height: '8px', background: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${progressPercent}%`,
              background: 'linear-gradient(90deg, var(--accent-purple) 0%, var(--accent-purple-glow) 100%)',
              borderRadius: '4px',
              transition: 'width 0.4s ease-out'
            }}></div>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '11px', color: 'var(--text-secondary)' }}>
            <span style={{ color: resume.fullName ? 'var(--status-success)' : 'inherit' }}>✓ Personal Details (+15%)</span>
            <span style={{ color: resume.email ? 'var(--status-success)' : 'inherit' }}>✓ Email Contact (+15%)</span>
            <span style={{ color: resume.profilePhoto ? 'var(--status-success)' : 'inherit' }}>✓ Avatar Photo (+15%)</span>
            <span style={{ color: resume.summary ? 'var(--status-success)' : 'inherit' }}>✓ Summary (+15%)</span>
            <span style={{ color: resume.experience.length > 0 ? 'var(--status-success)' : 'inherit' }}>✓ Work Exp (+15%)</span>
            <span style={{ color: resume.projects.length > 0 ? 'var(--status-success)' : 'inherit' }}>✓ Projects (+15%)</span>
            <span style={{ color: resume.skills.length > 0 ? 'var(--status-success)' : 'inherit' }}>✓ Skills (+10%)</span>
          </div>
        </div>

        {isLoading ? (
          <div className="glass-card" style={{ padding: '60px', textAlign: 'center' }}>
            <div className="pulse-dot" style={{ margin: '0 auto 12px auto' }}></div>
            <span style={{ color: 'var(--text-secondary)' }}>Retrieving resume profile from database...</span>
          </div>
        ) : (
          <form onSubmit={handleSaveResume} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Personal Details */}
            <div className="glass-card" style={{ padding: '24px' }}>
              <h3 className="section-title" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <User size={16} />
                Personal Details
              </h3>
              
              <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Avatar Preview & Source Inputs */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '120px',
                    height: '120px',
                    borderRadius: '50%',
                    border: '2px solid var(--accent-purple)',
                    background: 'var(--border-color)',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 15px rgba(168, 85, 247, 0.2)',
                    position: 'relative'
                  }}>
                    {resume.profilePhoto ? (
                      <img src={resume.profilePhoto} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <User size={48} style={{ color: 'var(--text-secondary)' }} />
                    )}
                  </div>
                  
                  {/* Photo Actions Button row */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button
                      type="button"
                      onClick={startCamera}
                      className="btn btn-secondary"
                      style={{ fontSize: '11px', padding: '6px 10px', height: 'auto', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Camera size={11} />
                      Camera
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="btn btn-secondary"
                      style={{ fontSize: '11px', padding: '6px 10px', height: 'auto', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Upload size={11} />
                      Gallery
                    </button>

                  </div>
                  
                  {/* Hidden file input */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    style={{ display: 'none' }}
                  />
                </div>

                {/* Form Fields */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '260px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label className="form-label">Full Name</label>
                      <input
                        type="text"
                        value={resume.fullName}
                        onChange={(e) => handleFieldChange('fullName', e.target.value)}
                        className="input-field"
                        placeholder="John Doe"
                        required
                      />
                    </div>
                    <div>
                      <label className="form-label">Email Address</label>
                      <input
                        type="email"
                        value={resume.email}
                        onChange={(e) => handleFieldChange('email', e.target.value)}
                        className="input-field"
                        placeholder="john.doe@example.com"
                        required
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label className="form-label">Phone Number</label>
                      <input
                        type="text"
                        value={resume.phone}
                        onChange={(e) => handleFieldChange('phone', e.target.value)}
                        className="input-field"
                        placeholder="+1 (555) 019-2834"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Webcam Live Capture Overlay Modal */}
            {showCamera && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: 'rgba(0,0,0,0.8)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: 'modalSlide 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
              }}>
                <div className="glass-card" style={{ padding: '24px', maxWidth: '350px', display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '15px', color: 'var(--text-primary)' }}>Webcam Camera Capture</strong>
                    <button type="button" onClick={stopCamera} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                      <X size={16} />
                    </button>
                  </div>

                  <div style={{ width: '300px', height: '300px', borderRadius: '12px', overflow: 'hidden', background: '#000', border: '2px solid var(--border-color)' }}>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={capturePhoto}
                      className="btn btn-primary"
                      style={{ flex: 1, height: '40px' }}
                    >
                      <Camera size={14} />
                      Capture Photo
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="btn btn-secondary"
                      style={{ height: '40px' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Video resume feature removed */}

            {/* Executive Summary */}
            <div className="glass-card" style={{ padding: '24px' }}>
              <h3 className="section-title" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Settings size={16} />
                Executive Summary
              </h3>
              <div>
                <label className="form-label">Professional Summary</label>
                <textarea
                  value={resume.summary}
                  onChange={(e) => handleFieldChange('summary', e.target.value)}
                  className="input-field"
                  placeholder="Experienced Software Architect specializing in C# .NET, React, and MongoDB cloud architectures..."
                  rows={4}
                  style={{ resize: 'none', width: '100%' }}
                />
              </div>
            </div>

            {/* Projects List */}
            <div className="glass-card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Globe size={16} />
                  Portfolio Projects
                </h3>
                <button
                  type="button"
                  onClick={addProject}
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '12px' }}
                >
                  <Plus size={12} />
                  Add Project
                </button>
              </div>

              {resume.projects.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px 0', fontSize: '13px' }}>
                  No projects listed. Click 'Add Project' to list your key projects.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {resume.projects.map((proj, index) => (
                    <div key={index} style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-purple)' }}>Project #{index + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeProject(index)}
                          style={{ background: 'none', border: 'none', color: 'var(--status-failed)', cursor: 'pointer' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                          <label className="form-label">Project Title</label>
                          <input
                            type="text"
                            value={proj.title}
                            onChange={(e) => updateProject(index, 'title', e.target.value)}
                            className="input-field"
                            placeholder="e.g. Chat App Integration"
                            required
                          />
                        </div>
                        <div>
                          <label className="form-label">Technologies Used</label>
                          <input
                            type="text"
                            value={proj.technologies}
                            onChange={(e) => updateProject(index, 'technologies', e.target.value)}
                            className="input-field"
                            placeholder="e.g. React, SignalR, MongoDB"
                            required
                          />
                        </div>
                        <div style={{ gridColumn: 'span 2' }}>
                          <label className="form-label">Project Link / Source Code</label>
                          <input
                            type="text"
                            value={proj.link}
                            onChange={(e) => updateProject(index, 'link', e.target.value)}
                            className="input-field"
                            placeholder="e.g. https://github.com/user/project"
                          />
                        </div>
                        <div style={{ gridColumn: 'span 2' }}>
                          <label className="form-label">Description</label>
                          <textarea
                            value={proj.description}
                            onChange={(e) => updateProject(index, 'description', e.target.value)}
                            className="input-field"
                            placeholder="Detail your architecture design, roles, and scope..."
                            rows={3}
                            style={{ resize: 'none', width: '100%' }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Professional Work Experience */}
            <div className="glass-card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Briefcase size={16} />
                  Professional Experience
                </h3>
                <button
                  type="button"
                  onClick={addExperience}
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '12px' }}
                >
                  <Plus size={12} />
                  Add Position
                </button>
              </div>

              {resume.experience.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px 0', fontSize: '13px' }}>
                  No experience items listed. Click 'Add Position' to start detailing your career.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {resume.experience.map((exp, index) => (
                    <div key={index} style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-purple)' }}>Position #{index + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeExperience(index)}
                          style={{ background: 'none', border: 'none', color: 'var(--status-failed)', cursor: 'pointer' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                          <label className="form-label">Company Name</label>
                          <input
                            type="text"
                            value={exp.company}
                            onChange={(e) => updateExperience(index, 'company', e.target.value)}
                            className="input-field"
                            placeholder="e.g. Acme Corporation"
                            required
                          />
                        </div>
                        <div>
                          <label className="form-label">Job Title / Role</label>
                          <input
                            type="text"
                            value={exp.role}
                            onChange={(e) => updateExperience(index, 'role', e.target.value)}
                            className="input-field"
                            placeholder="e.g. Senior Developer"
                            required
                          />
                        </div>
                        <div style={{ gridColumn: 'span 2' }}>
                          <label className="form-label">Employment Duration</label>
                          <input
                            type="text"
                            value={exp.duration}
                            onChange={(e) => updateExperience(index, 'duration', e.target.value)}
                            className="input-field"
                            placeholder="e.g. June 2021 - Present"
                          />
                        </div>
                        <div style={{ gridColumn: 'span 2' }}>
                          <label className="form-label">Responsibilities & Achievements</label>
                          <textarea
                            value={exp.description}
                            onChange={(e) => updateExperience(index, 'description', e.target.value)}
                            className="input-field"
                            placeholder="Led frontend migrations, implemented microservices..."
                            rows={3}
                            style={{ resize: 'none', width: '100%' }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Academic History / Education */}
            <div className="glass-card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BookOpen size={16} />
                  Academic History
                </h3>
                <button
                  type="button"
                  onClick={addEducation}
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '12px' }}
                >
                  <Plus size={12} />
                  Add Degree
                </button>
              </div>

              {resume.education.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px 0', fontSize: '13px' }}>
                  No educational items listed. Click 'Add Degree' to start.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {resume.education.map((edu, index) => (
                    <div key={index} style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-purple)' }}>Institution #{index + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeEducation(index)}
                          style={{ background: 'none', border: 'none', color: 'var(--status-failed)', cursor: 'pointer' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                          <label className="form-label">Institution Name</label>
                          <input
                            type="text"
                            value={edu.institution}
                            onChange={(e) => updateEducation(index, 'institution', e.target.value)}
                            className="input-field"
                            placeholder="e.g. Stanford University"
                            required
                          />
                        </div>
                        <div>
                          <label className="form-label">Degree / Field of Study</label>
                          <input
                            type="text"
                            value={edu.degree}
                            onChange={(e) => updateEducation(index, 'degree', e.target.value)}
                            className="input-field"
                            placeholder="e.g. Bachelor of Science in Computer Science"
                            required
                          />
                        </div>
                        <div style={{ gridColumn: 'span 2' }}>
                          <label className="form-label">Graduation Year</label>
                          <input
                            type="text"
                            value={edu.year}
                            onChange={(e) => updateEducation(index, 'year', e.target.value)}
                            className="input-field"
                            placeholder="e.g. 2020"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Professional Skills Tagging */}
            <div className="glass-card" style={{ padding: '24px' }}>
              <h3 className="section-title" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Settings size={16} />
                Professional Skills
              </h3>
              
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <input
                  type="text"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  className="input-field"
                  placeholder="e.g. TypeScript, Docker, ASP.NET Core"
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  onClick={handleAddSkill}
                  className="btn btn-secondary"
                  style={{ height: '42px', padding: '0 16px' }}
                >
                  Add Skill
                </button>
              </div>

              {resume.skills.length === 0 ? (
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  No skills tagged. Enter a skill tag above to add it.
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {resume.skills.map((skill, idx) => (
                    <span
                      key={idx}
                      style={{
                        fontSize: '12px',
                        color: 'var(--accent-purple)',
                        background: 'rgba(168, 85, 247, 0.08)',
                        border: '1px solid rgba(168, 85, 247, 0.2)',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      {skill}
                      <button
                        type="button"
                        onClick={() => removeSkill(skill)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          padding: 0,
                          fontSize: '10px',
                          fontWeight: 'bold'
                        }}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Save Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSaving}
                style={{ height: '44px', padding: '0 24px', fontSize: '14px' }}
              >
                {isSaving ? 'Saving profile...' : 'Save Resume Profile'}
                <Check size={16} />
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Toast Alert */}
      {toast.show && (
        <div className={`notification-toast ${toast.type}`} style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          padding: '12px 20px',
          borderRadius: '8px',
          background: toast.type === 'success' ? 'var(--status-success-bg)' : 'var(--status-failed-bg)',
          border: `1px solid ${toast.type === 'success' ? 'var(--status-success)' : 'var(--status-failed)'}`,
          color: toast.type === 'success' ? 'var(--status-success)' : 'var(--status-failed)',
          fontSize: '14px',
          fontWeight: 600,
          boxShadow: '0 10px 20px rgba(0,0,0,0.5)',
          zIndex: 1000,
          animation: 'modalSlide 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          <span>{toast.message}</span>
        </div>
      )}
      </div>
    </div>
  );
};

export default ResumePage;
