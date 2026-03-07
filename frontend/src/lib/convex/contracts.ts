export type MigrationSource = 'legacy-flask' | 'convex'
export type ThemePreference = 'light' | 'dark'
export type LandingView = 'dashboard' | 'schedule' | 'explore'
export type PlanningMode = 'upcoming_semester' | 'four_year_plan' | 'view_progress'
export type TimeOfDayPreference = 'morning' | 'afternoon' | 'evening' | 'flexible'
export type WorkStatus = 'none' | 'part_time' | 'full_time'
export type PriorityFocus = 'major_requirements' | 'electives' | 'graduation_timeline' | 'balanced'
export type ProgramEvaluationStatus = 'pending' | 'processing' | 'completed' | 'failed'
export type ChatScope = 'onboarding' | 'explore' | 'general'
export type ChatSender = 'user' | 'assistant' | 'system'

export interface AppUserRecord {
  id: string
  clerkUserId: string
  primaryEmail?: string
  firstName?: string
  lastName?: string
  displayName?: string
  activeOrganizationId?: string
  migrationSource: MigrationSource
}

export interface UserPreferencesRecord {
  userId: string
  theme: ThemePreference
  landingView: LandingView
  hasProgramEvaluation: boolean
  onboardingComplete: boolean
}

export interface SchedulingPreferencesRecord {
  userId: string
  planningMode?: PlanningMode
  preferredCreditsMin?: number
  preferredCreditsMax?: number
  preferredTimeOfDay?: TimeOfDayPreference
  daysToAvoid?: string[]
  workStatus?: WorkStatus
  priorityFocus?: PriorityFocus
  onboardingComplete: boolean
  collectedFields: string[]
}

export type SchedulingPreferencesFormValues = {
  planning_mode?: PlanningMode
  credit_load?: 'light' | 'standard' | 'heavy'
  schedule_preference?: 'mornings' | 'afternoons' | 'flexible'
  work_status?: WorkStatus
  priority?: 'major' | 'electives' | 'graduate'
}

export interface ProgramEvaluationRecord {
  id: string
  userId: string
  originalFilename?: string
  storagePath?: string
  mimeType?: string
  fileSizeBytes?: number
  processingStatus: ProgramEvaluationStatus
  migrationSource: MigrationSource
}

export interface ParsedProgramEvaluationData {
  [key: string]: unknown
}

export interface ProgramEvaluationPayload {
  email?: string
  uploaded_at?: string
  original_filename?: string
  parsed_data?: ParsedProgramEvaluationData
  storage_path?: string
  mime_type?: string
  file_size_bytes?: number
}

export interface ProgramEvaluationMutationPayload extends ProgramEvaluationPayload {}

export interface ProgramEvaluationUploadResponse {
  filename?: string
  parsed?: ParsedProgramEvaluationData
  error?: string
}

export interface OnboardingCompletionResult {
  userPreferences: {
    theme?: ThemePreference
    landingView?: LandingView
    hasProgramEvaluation?: boolean
    onboardingComplete?: boolean
  }
  schedulingPreferences: SchedulingPreferencesFormValues | null
}

export interface ChatSessionSummary {
  id: string
  scope: ChatScope
  title: string
  createdAt: number
  lastMessageAt: number | null
  legacySessionId?: string
}

export interface ChatMessageRecord {
  id: string
  role: ChatSender
  content: string
  createdAt: number
}

export interface ChatSessionDetail {
  session: ChatSessionSummary
  messages: ChatMessageRecord[]
}

export interface ChatExchangeResult extends ChatSessionDetail {
  suggestions: string[]
}

export interface OnboardingFlowState {
  sessionId: string | null
  answers: SchedulingPreferencesFormValues
  currentQuestionIndex: number
  isComplete: boolean
}

export interface ScheduleSnapshotRecord {
  id: string
  userId: string
  name: string
  classIds: string[]
  totalCredits: number
  classCount: number
  migrationSource: MigrationSource
}