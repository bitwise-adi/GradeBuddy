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

/** Grade requirement result */
export interface GradeRequirement {
  grade: string;
  gpa: number;
  requiredSEE: number;
  status: 'guaranteed' | 'achievable' | 'difficult' | 'impossible';
  color: string;
}
