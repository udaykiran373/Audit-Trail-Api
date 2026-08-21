export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string | null;
  sessionId: string;
  eventType: string;
  module: string;
  action: string;
  status: string;
  correlationId: string;
  requestPath: string | null;
  ipAddress: string;
  userAgent: string;
  metadata: Record<string, any>;
}

export interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SearchFilters {
  search?: string;
  userId?: string;
  sessionId?: string;
  eventType?: string;
  status?: string;
  module?: string;
  correlationId?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  isAscending?: boolean;
}

export interface Post {
  id?: string;
  author: string;
  content: string;
  tags: string;
  likes: number;
  createdAt: string;
}

export interface WorkExperience {
  company: string;
  role: string;
  duration: string;
  description: string;
}

export interface EducationItem {
  institution: string;
  degree: string;
  year: string;
}

export interface ProjectItem {
  title: string;
  technologies: string;
  description: string;
  link: string;
}

export interface Resume {
  id?: string;
  username: string;
  fullName: string;
  email: string;
  phone: string;
  summary: string;
  profilePhoto: string;
  videoResumeUrl: string;
  experience: WorkExperience[];
  education: EducationItem[];
  projects: ProjectItem[];
  skills: string[];
  updatedAt?: string;
}

export interface Question {
  id?: string;
  quizCategory: string;
  questionText: string;
  options?: string[];
  correctOption?: number;
}

export interface Assessment {
  id?: string;
  username: string;
  quizCategory: string;
  score: number;
  isPassed: boolean;
  completedAt: string;
  warningsCount: number;
  warningsLog: string[];
  videoData: string;
}
