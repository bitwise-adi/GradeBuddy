// ===========================
// GradeBuddy Type Definitions
// ===========================

/** Grade scale entry */
export interface GradeEntry {
  grade: string;
  gpa: number;
  minMarks: number;
  maxMarks: number;
  color: string;
  bgColor: string;
}

/** CIE component breakdown (T1, T2, Q1, Q2, IL1/EL1, IL2/EL2, etc.) */
export interface CIEComponent {
  name: string;
  marksObtained: number | null;
  maxMarks: number | null;
}

/** A single course with all its data */
export interface Course {
  courseCode: string;
  courseName: string;
  credits: number;
  nature: 'Core' | 'Elective' | 'Open Elective' | string;
  cieMarks: number;
  cieMax: number; // typically 100, sometimes 50
  components: CIEComponent[];
  attendance: number | null; // percentage
  hasSEE: boolean; // false for 0-credit courses
}

/** Course with user-selected GPA for the simulator */
export interface CourseWithGPA extends Course {
  selectedGPA: number;
  requiredSEE: number | null; // null if no SEE
}

/** Student profile info */
export interface StudentProfile {
  name: string;
  usn: string;
  branch: string;
  semester: string;
  section: string;
}

/** Login step 1 credentials */
export interface LoginCredentials {
  usn: string;
  dobDay: string;
  dobMonth: string;
  dobYear: string;
}

/** Login step 2 OTP verification */
export interface OTPVerification {
  verificationType: string;
  digits: [string, string, string, string];
}

/** API response for login step 1 */
export interface LoginResponse {
  success: boolean;
  message: string;
  requiresOTP: boolean;
  sessionId?: string;
}

/** API response for OTP verification */
export interface VerifyResponse {
  success: boolean;
  message: string;
  sessionId?: string;
}

/** API response for marks fetch */
export interface MarksResponse {
  success: boolean;
  message: string;
  profile?: StudentProfile;
  courses?: Course[];
}

/** Grade requirement result */
export interface GradeRequirement {
  grade: string;
  gpa: number;
  requiredSEE: number;
  status: 'guaranteed' | 'achievable' | 'difficult' | 'impossible';
  color: string;
}
