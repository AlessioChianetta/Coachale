interface LessonProgress {
  status: 'pending' | 'analyzing' | 'generating' | 'completed' | 'error';
  questionsCount?: number;
  message?: string;
}

interface GenerationJob {
  id: string;
  status: 'running' | 'completed' | 'error';
  progress: Record<string, LessonProgress>;
  templates?: any[];
  categorySlug?: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const jobs = new Map<string, GenerationJob>();

const JOB_EXPIRY_MS = 30 * 60 * 1000;

export function createJob(jobId: string, lessonIds: string[]): GenerationJob {
  const progress: Record<string, LessonProgress> = {};
  lessonIds.forEach(id => {
    progress[id] = { status: 'pending' };
  });

  const job: GenerationJob = {
    id: jobId,
    status: 'running',
    progress,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  jobs.set(jobId, job);
  cleanupOldJobs();
  return job;
}

export function updateJobProgress(jobId: string, lessonId: string, progress: LessonProgress): void {
  const job = jobs.get(jobId);
  if (job) {
    job.progress[lessonId] = progress;
    job.updatedAt = new Date();
  }
}

export function completeJob(jobId: string, templates: any[], categorySlug?: string): void {
  const job = jobs.get(jobId);
  if (job) {
    job.status = 'completed';
    job.templates = templates;
    job.categorySlug = categorySlug;
    job.updatedAt = new Date();
  }
}

export function failJob(jobId: string, error: string): void {
  const job = jobs.get(jobId);
  if (job) {
    job.status = 'error';
    job.error = error;
    job.updatedAt = new Date();
  }
}

export function getJob(jobId: string): GenerationJob | undefined {
  return jobs.get(jobId);
}

export function deleteJob(jobId: string): void {
  jobs.delete(jobId);
}

function cleanupOldJobs(): void {
  const now = Date.now();
  for (const [jobId, job] of jobs.entries()) {
    if (now - job.createdAt.getTime() > JOB_EXPIRY_MS) {
      jobs.delete(jobId);
    }
  }
}
