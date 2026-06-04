import { GradeEntry, GradeRequirement, CourseWithGPA, Course } from './types';

// ==============================
// Grade Scale Definition
// ==============================

export const GRADE_SCALE: GradeEntry[] = [
  { grade: 'O',  gpa: 10, minMarks: 90, maxMarks: 100, color: '#FFD700', bgColor: 'rgba(255, 215, 0, 0.15)' },
  { grade: 'A+', gpa: 9,  minMarks: 80, maxMarks: 89,  color: '#10B981', bgColor: 'rgba(16, 185, 129, 0.15)' },
  { grade: 'A',  gpa: 8,  minMarks: 70, maxMarks: 79,  color: '#14B8A6', bgColor: 'rgba(20, 184, 166, 0.15)' },
  { grade: 'B',  gpa: 7,  minMarks: 60, maxMarks: 69,  color: '#3B82F6', bgColor: 'rgba(59, 130, 246, 0.15)' },
  { grade: 'C',  gpa: 6,  minMarks: 50, maxMarks: 59,  color: '#8B5CF6', bgColor: 'rgba(139, 92, 246, 0.15)' },
  { grade: 'P',  gpa: 5,  minMarks: 40, maxMarks: 49,  color: '#F59E0B', bgColor: 'rgba(245, 158, 11, 0.15)' },
  { grade: 'F',  gpa: 0,  minMarks: 0,  maxMarks: 39,  color: '#EF4444', bgColor: 'rgba(239, 68, 68, 0.15)' },
];

// ==============================
// Core Calculations
// ==============================

/**
 * Get the grade entry for a given GPA value.
 */
export function getGradeForGPA(gpa: number): GradeEntry | undefined {
  return GRADE_SCALE.find(g => g.gpa === gpa);
}

/**
 * Get the grade entry for a given final marks value.
 */
export function getGradeForMarks(marks: number): GradeEntry {
  for (const entry of GRADE_SCALE) {
    if (marks >= entry.minMarks && marks <= entry.maxMarks) {
      return entry;
    }
  }
  return GRADE_SCALE[GRADE_SCALE.length - 1]; // F grade
}

/**
 * Calculate final marks from CIE and SEE.
 * Final = (CIE + SEE) / 2, both standardized to 100.
 * For courses without SEE (0-credit), final = CIE directly.
 */
export function calculateFinalMarks(
  cieMarks: number,
  cieMax: number,
  seeMarks: number | null,
  hasSEE: boolean
): number {
  // Standardize CIE to 100
  const cieStandardized = (cieMarks / cieMax) * 100;

  if (!hasSEE || seeMarks === null) {
    return Math.round(cieStandardized);
  }

  // SEE is always out of 100
  const final = (cieStandardized + seeMarks) / 2;
  return Math.round(final);
}

/**
 * Calculate the required SEE marks to achieve a target GPA.
 * Returns the minimum SEE marks needed, or status indicators.
 */
export function calculateRequiredSEE(
  cieMarks: number,
  cieMax: number,
  targetGPA: number
): GradeRequirement {
  const gradeEntry = getGradeForGPA(targetGPA);
  if (!gradeEntry) {
    return {
      grade: '?',
      gpa: targetGPA,
      requiredSEE: 0,
      status: 'impossible',
      color: '#EF4444',
    };
  }

  const targetMinFinal = gradeEntry.minMarks;
  const cieStandardized = (cieMarks / cieMax) * 100;

  // Final = (CIE_std + SEE) / 2 >= targetMinFinal
  // SEE >= (targetMinFinal * 2) - CIE_std
  const requiredSEE = Math.ceil((targetMinFinal * 2) - cieStandardized);

  let status: GradeRequirement['status'];
  if (requiredSEE <= 0) {
    status = 'guaranteed';
  } else if (requiredSEE > 100) {
    status = 'impossible';
  } else if (requiredSEE > 85) {
    status = 'difficult';
  } else {
    status = 'achievable';
  }

  return {
    grade: gradeEntry.grade,
    gpa: gradeEntry.gpa,
    requiredSEE: Math.max(0, requiredSEE),
    status,
    color: gradeEntry.color,
  };
}

/**
 * Calculate all grade requirements for a course.
 */
export function calculateAllGradeRequirements(
  cieMarks: number,
  cieMax: number
): GradeRequirement[] {
  return GRADE_SCALE
    .filter(g => g.gpa > 0) // Exclude F
    .map(g => calculateRequiredSEE(cieMarks, cieMax, g.gpa));
}

/**
 * Calculate weighted SGPA from courses with selected GPAs.
 * SGPA = Σ(course_gpa × credits) / Σ(credits)
 * Excludes 0-credit courses from the calculation.
 */
export function calculateSGPA(courses: CourseWithGPA[]): number {
  const validCourses = courses.filter(c => c.credits > 0);

  if (validCourses.length === 0) return 0;

  const totalWeighted = validCourses.reduce(
    (sum, c) => sum + c.selectedGPA * c.credits,
    0
  );
  const totalCredits = validCourses.reduce(
    (sum, c) => sum + c.credits,
    0
  );

  return totalCredits > 0 ? totalWeighted / totalCredits : 0;
}

/**
 * Get the total credits for a list of courses.
 */
export function getTotalCredits(courses: Course[]): number {
  return courses.reduce((sum, c) => sum + c.credits, 0);
}

/**
 * Determine if a course has SEE based on credits.
 * 0-credit courses do not have SEE.
 */
export function courseHasSEE(credits: number): boolean {
  return credits > 0;
}

/**
 * Get the GPA for given final marks.
 */
export function getGPAForMarks(marks: number): number {
  return getGradeForMarks(marks).gpa;
}

/**
 * Calculate best and worst possible SGPA.
 */
export function calculateSGPARange(courses: Course[]): {
  best: number;
  worst: number;
  current: number;
} {
  const coursesWithBest: CourseWithGPA[] = courses.map(c => ({
    ...c,
    selectedGPA: 10,
    requiredSEE: null,
  }));

  const coursesWithWorst: CourseWithGPA[] = courses.map(c => ({
    ...c,
    selectedGPA: c.hasSEE ? 5 : getGPAForMarks((c.cieMarks / c.cieMax) * 100),
    requiredSEE: null,
  }));

  // Current = based on CIE alone (assuming SEE = CIE for estimate)
  const coursesWithCurrent: CourseWithGPA[] = courses.map(c => {
    const cieStd = (c.cieMarks / c.cieMax) * 100;
    const estimatedFinal = c.hasSEE ? cieStd : cieStd; // CIE only for now
    return {
      ...c,
      selectedGPA: getGPAForMarks(estimatedFinal),
      requiredSEE: null,
    };
  });

  return {
    best: calculateSGPA(coursesWithBest),
    worst: calculateSGPA(coursesWithWorst),
    current: calculateSGPA(coursesWithCurrent),
  };
}
