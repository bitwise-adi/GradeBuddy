'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  GraduationCap,
  Calculator,
  SlidersHorizontal,
  BookOpen,
  Award,
  TrendingUp,
  ArrowLeft,
  Star,
  Zap,
  Target,
} from 'lucide-react';
import { Course, StudentProfile, CourseWithGPA } from '@/lib/types';
import {
  GRADE_SCALE,
  calculateAllGradeRequirements,
  calculateSGPA,
  getGradeForMarks,
  calculateSGPARange,
  getTotalCredits,
} from '@/lib/gradeCalc';

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'overview' | 'calculator' | 'simulator'>('overview');
  const [simulatorCourses, setSimulatorCourses] = useState<CourseWithGPA[]>([]);

  useEffect(() => {
    const profileData = sessionStorage.getItem('gradebuddy_profile');
    const coursesData = sessionStorage.getItem('gradebuddy_courses');

    console.log('[Dashboard] Checking sessionStorage...');
    console.log('  Profile data exists:', !!profileData);
    console.log('  Courses data exists:', !!coursesData);

    if (!coursesData) {
      console.log('[Dashboard] No courses data, redirecting to home');
      router.push('/');
      return;
    }

    try {
      if (profileData) {
        const profile = JSON.parse(profileData);
        console.log('[Dashboard] Profile:', profile);
        setProfile(profile);
      }

      const parsedCourses: Course[] = JSON.parse(coursesData);
      console.log('[Dashboard] Parsed courses:', parsedCourses.length, 'courses');
      console.log('[Dashboard] Courses:', parsedCourses);
      
      if (parsedCourses.length === 0) {
        setError('No courses were found. The portal scraping may have failed.');
        setLoading(false);
        return;
      }
      
      setCourses(parsedCourses);

      // Initialize simulator with current CIE-based estimates
      setSimulatorCourses(
        parsedCourses.map(c => {
          const cieStd = (c.cieMarks / c.cieMax) * 100;
          const currentGrade = getGradeForMarks(cieStd);
          return {
            ...c,
            selectedGPA: currentGrade.gpa || 5,
            requiredSEE: null,
          };
        })
      );
      
      setLoading(false);
    } catch (err) {
      console.error('[Dashboard] Error parsing data:', err);
      setError('Failed to load course data: ' + (err instanceof Error ? err.message : 'Unknown error'));
      setLoading(false);
    }
  }, [router]);

  const totalCredits = useMemo(() => getTotalCredits(courses), [courses]);
  const sgpa = useMemo(() => calculateSGPA(simulatorCourses), [simulatorCourses]);
  const sgpaRange = useMemo(() => calculateSGPARange(courses), [courses]);

  const updateSimulatorGPA = useCallback((courseCode: string, gpa: number) => {
    setSimulatorCourses(prev =>
      prev.map(c =>
        c.courseCode === courseCode ? { ...c, selectedGPA: gpa } : c
      )
    );
  }, []);

  const applyPreset = useCallback((gpa: number) => {
    setSimulatorCourses(prev =>
      prev.map(c => ({ ...c, selectedGPA: c.credits === 0 ? c.selectedGPA : gpa }))
    );
  }, []);

  const getSGPAColor = (value: number): string => {
    if (value >= 9) return 'var(--grade-Aplus)';
    if (value >= 8) return 'var(--grade-A)';
    if (value >= 7) return 'var(--grade-B)';
    if (value >= 6) return 'var(--grade-C)';
    return 'var(--grade-F)';
  };

  if (loading) {
    return (
      <div className="loading-overlay" style={{ minHeight: '100vh' }}>
        <div className="loading-dots">
          <span /><span /><span />
        </div>
        <p>Loading your courses...</p>
      </div>
    );
  }

  if (error || courses.length === 0) {
    return (
      <div className="app-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div className="glass-card" style={{ maxWidth: '500px', padding: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <h2 style={{ marginBottom: '1rem' }}>No Courses Found</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            {error || 'The portal scraping returned no course data. This could mean:'}
          </p>
          <ul style={{ textAlign: 'left', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.8' }}>
            <li>The session authentication failed</li>
            <li>The CIE data isn't available yet in the portal</li>
            <li>The portal structure has changed</li>
          </ul>
          <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
            <button className="btn btn-primary" onClick={() => router.push('/')}>
              Try Again
            </button>
            <button className="btn btn-secondary" onClick={() => {
              // Create sample data for testing
              const sampleCourses: Course[] = [
                { courseCode: 'SAMPLE', courseName: 'Add your courses manually', credits: 4, nature: 'Core', cieMarks: 0, cieMax: 100, components: [], attendance: null, hasSEE: true }
              ];
              sessionStorage.setItem('gradebuddy_courses', JSON.stringify(sampleCourses));
              window.location.reload();
            }}>
              Enter Marks Manually
            </button>
          </div>
          <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '8px', fontSize: '0.85rem' }}>
            <strong>Debug Info:</strong>
            <div style={{ fontFamily: 'monospace', marginTop: '0.5rem', color: 'var(--text-muted)' }}>
              Courses in storage: {courses.length}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Header */}
      <div className="dashboard-header">
        <div className="student-info">
          <div className="student-avatar">
            {profile?.name?.[0] || 'S'}
          </div>
          <div>
            <div className="student-name">{profile?.name || 'Student'}</div>
            <div className="student-meta">
              {[profile?.usn, profile?.branch, profile?.semester, profile?.section]
                .filter(Boolean)
                .join(' · ') || `${courses.length} courses · ${totalCredits} credits`}
            </div>
          </div>
        </div>

        <button className="btn btn-ghost btn-sm" onClick={() => router.push('/')}>
          <ArrowLeft size={16} />
          New Session
        </button>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
          id="tab-overview"
        >
          <BookOpen size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
          Courses
        </button>
        <button
          className={`tab ${activeTab === 'calculator' ? 'active' : ''}`}
          onClick={() => setActiveTab('calculator')}
          id="tab-calculator"
        >
          <Calculator size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
          Grade Calculator
        </button>
        <button
          className={`tab ${activeTab === 'simulator' ? 'active' : ''}`}
          onClick={() => setActiveTab('simulator')}
          id="tab-simulator"
        >
          <SlidersHorizontal size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
          GPA Simulator
        </button>
      </div>

      {/* Tab: Course Overview */}
      {activeTab === 'overview' && (
        <div className="animate-fade-in">
          <div className="section-header">
            <div>
              <h2 className="section-title">
                <BookOpen size={22} />
                Your Courses
              </h2>
              <p className="section-subtitle">{courses.length} courses · {totalCredits} total credits</p>
            </div>
          </div>

          <div className="courses-grid">
            {courses.map(course => {
              const ciePercentage = (course.cieMarks / course.cieMax) * 100;
              const grade = getGradeForMarks(ciePercentage);
              const circumference = 2 * Math.PI * 26;
              const dashOffset = circumference - (ciePercentage / 100) * circumference;

              return (
                <div
                  key={course.courseCode}
                  className="course-card glass-card"
                  style={{ '--card-accent': grade.color } as React.CSSProperties}
                >
                  <div className="course-code">{course.courseCode}</div>
                  <div className="course-name">{course.courseName || course.courseCode}</div>

                  <div className="course-stats">
                    <div className="course-cie">
                      <span className="cie-label">CIE</span>
                      <span className="cie-value" style={{ color: grade.color }}>
                        {course.cieMarks}
                        <span className="cie-max">/{course.cieMax}</span>
                      </span>
                    </div>

                    <div className="progress-ring">
                      <svg width="64" height="64" viewBox="0 0 64 64">
                        <circle className="progress-ring-bg" cx="32" cy="32" r="26" />
                        <circle
                          className="progress-ring-fill"
                          cx="32"
                          cy="32"
                          r="26"
                          stroke={grade.color}
                          strokeDasharray={circumference}
                          strokeDashoffset={dashOffset}
                        />
                      </svg>
                      <span className="progress-ring-text" style={{ color: grade.color }}>
                        {Math.round(ciePercentage)}%
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem' }}>
                    <div className="course-credits">
                      <Award size={12} />
                      {course.credits} cr
                    </div>
                    <div style={{
                      padding: '0.2rem 0.6rem',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      background: grade.bgColor,
                      color: grade.color,
                    }}>
                      {grade.grade} ({grade.gpa})
                    </div>
                    {!course.hasSEE && (
                      <div style={{
                        fontSize: '0.7rem',
                        color: 'var(--text-muted)',
                        fontStyle: 'italic',
                      }}>
                        No SEE
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Grade Scale Reference */}
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-secondary)' }}>
              Grade Scale Reference
            </h3>
            <div className="grade-scale-bar">
              {GRADE_SCALE.map(g => (
                <div
                  key={g.grade}
                  className="grade-scale-segment"
                  style={{ background: g.bgColor, color: g.color }}
                  title={`${g.grade}: ${g.minMarks}-${g.maxMarks} marks = ${g.gpa} GPA`}
                >
                  {g.grade}
                </div>
              ))}
            </div>
            <div className="grade-scale-labels">
              {GRADE_SCALE.map(g => (
                <span key={g.grade}>{g.minMarks}-{g.maxMarks}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Grade Calculator */}
      {activeTab === 'calculator' && (
        <div className="animate-fade-in">
          <div className="section-header">
            <div>
              <h2 className="section-title">
                <Target size={22} />
                Required SEE Marks
              </h2>
              <p className="section-subtitle">How many marks you need in SEE for each grade target</p>
            </div>
          </div>

          <div className="grade-table-wrapper glass-card">
            <table className="grade-table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>CIE</th>
                  {GRADE_SCALE.filter(g => g.gpa > 0).map(g => (
                    <th key={g.grade} style={{ color: g.color }}>
                      {g.grade} ({g.gpa})
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {courses
                  .filter(c => c.hasSEE)
                  .map(course => {
                    const requirements = calculateAllGradeRequirements(course.cieMarks, course.cieMax);

                    return (
                      <tr key={course.courseCode}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{course.courseName || course.courseCode}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {course.courseCode} · {course.credits}cr
                          </div>
                        </td>
                        <td>
                          <span style={{ fontWeight: 700 }}>
                            {course.cieMarks}/{course.cieMax}
                          </span>
                        </td>
                        {requirements.map(req => (
                          <td key={req.grade}>
                            <span className={`grade-cell ${req.status}`}>
                              {req.status === 'guaranteed' ? (
                                <Star size={14} />
                              ) : req.status === 'impossible' ? (
                                '✗'
                              ) : (
                                req.requiredSEE
                              )}
                            </span>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {/* Courses without SEE */}
          {courses.some(c => !c.hasSEE) && (
            <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem' }}>
                Courses Without SEE
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                These courses have 0 credits. CIE marks are the final marks.
              </p>
              {courses.filter(c => !c.hasSEE).map(course => {
                const cieStd = (course.cieMarks / course.cieMax) * 100;
                const grade = getGradeForMarks(cieStd);
                return (
                  <div key={course.courseCode} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 0',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}>
                    <div>
                      <span style={{ fontWeight: 600 }}>{course.courseName || course.courseCode}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                        ({course.courseCode})
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span style={{ fontWeight: 700 }}>CIE: {course.cieMarks}/{course.cieMax}</span>
                      <span style={{
                        padding: '0.2rem 0.6rem',
                        borderRadius: '12px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        background: grade.bgColor,
                        color: grade.color,
                      }}>
                        {grade.grade}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Legend */}
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <span><span className="grade-cell guaranteed" style={{ marginRight: '4px', fontSize: '0.75rem' }}><Star size={10} /></span> Guaranteed (CIE alone is enough)</span>
            <span><span className="grade-cell achievable" style={{ marginRight: '4px', fontSize: '0.75rem' }}>75</span> Achievable</span>
            <span><span className="grade-cell difficult" style={{ marginRight: '4px', fontSize: '0.75rem' }}>92</span> Difficult (&gt;85)</span>
            <span><span className="grade-cell impossible" style={{ marginRight: '4px', fontSize: '0.75rem' }}>✗</span> Impossible (&gt;100)</span>
          </div>
        </div>
      )}

      {/* Tab: GPA Simulator */}
      {activeTab === 'simulator' && (
        <div className="animate-fade-in gpa-simulator">
          <div className="section-header">
            <div>
              <h2 className="section-title">
                <TrendingUp size={22} />
                GPA Simulator
              </h2>
              <p className="section-subtitle">Select expected grades and see your predicted SGPA</p>
            </div>
          </div>

          {/* SGPA Display */}
          <div className="sgpa-display glass-card glow-border">
            <div className="sgpa-label">Predicted SGPA</div>
            <div className="sgpa-value" style={{ color: getSGPAColor(sgpa) }}>
              {sgpa.toFixed(2)}
            </div>
            <div className="sgpa-summary">
              <div className="sgpa-stat">
                <span className="sgpa-stat-value" style={{ color: 'var(--grade-Aplus)' }}>
                  {sgpaRange.best.toFixed(2)}
                </span>
                <span className="sgpa-stat-label">Best Case</span>
              </div>
              <div className="sgpa-stat">
                <span className="sgpa-stat-value">{totalCredits}</span>
                <span className="sgpa-stat-label">Total Credits</span>
              </div>
              <div className="sgpa-stat">
                <span className="sgpa-stat-value" style={{ color: 'var(--grade-P)' }}>
                  {sgpaRange.worst.toFixed(2)}
                </span>
                <span className="sgpa-stat-label">Worst Case</span>
              </div>
            </div>
          </div>

          {/* Preset Buttons */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label className="form-label" style={{ marginBottom: '0.75rem' }}>Quick Presets</label>
            <div className="preset-buttons">
              {[
                { label: 'All O (10)', gpa: 10, icon: <Star size={14} />, color: 'var(--grade-O)' },
                { label: 'All A+ (9)', gpa: 9, icon: <Zap size={14} />, color: 'var(--grade-Aplus)' },
                { label: 'All A (8)', gpa: 8, icon: <TrendingUp size={14} />, color: 'var(--grade-A)' },
                { label: 'All B (7)', gpa: 7, icon: <Target size={14} />, color: 'var(--grade-B)' },
              ].map(preset => (
                <button
                  key={preset.gpa}
                  className="btn btn-secondary btn-sm"
                  onClick={() => applyPreset(preset.gpa)}
                  style={{ borderColor: preset.color + '33', color: preset.color }}
                >
                  {preset.icon}
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Simulator Table */}
          <div className="glass-card" style={{ overflow: 'hidden' }}>
            <div className="sim-row sim-row-header">
              <span>Course</span>
              <span style={{ textAlign: 'center' }}>Credits</span>
              <span style={{ textAlign: 'center' }}>CIE</span>
              <span style={{ textAlign: 'center' }}>Grade / GPA</span>
            </div>

            {simulatorCourses
              .filter(c => c.credits > 0)
              .map(course => {
                const selectedGrade = GRADE_SCALE.find(g => g.gpa === course.selectedGPA);
                return (
                  <div key={course.courseCode} className="sim-row">
                    <div>
                      <div className="sim-course-name">{course.courseName || course.courseCode}</div>
                      <div className="sim-course-code">{course.courseCode}</div>
                    </div>
                    <div className="sim-credits">{course.credits}</div>
                    <div className="sim-cie">{course.cieMarks}/{course.cieMax}</div>
                    <div>
                      <select
                        className="gpa-select"
                        value={course.selectedGPA}
                        onChange={e => updateSimulatorGPA(course.courseCode, Number(e.target.value))}
                        style={{
                          borderColor: selectedGrade ? selectedGrade.color + '44' : undefined,
                          color: selectedGrade?.color,
                        }}
                      >
                        {GRADE_SCALE.filter(g => g.gpa > 0).map(g => (
                          <option key={g.gpa} value={g.gpa}>
                            {g.grade} — {g.gpa}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* 0-credit courses note */}
          {simulatorCourses.some(c => c.credits === 0) && (
            <p style={{
              marginTop: '1rem',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              fontStyle: 'italic',
            }}>
              * 0-credit courses ({simulatorCourses.filter(c => c.credits === 0).map(c => c.courseCode).join(', ')}) are excluded from SGPA calculation.
            </p>
          )}
        </div>
      )}

      {/* Footer */}
      <footer style={{
        textAlign: 'center',
        padding: '3rem 0 2rem',
        fontSize: '0.8rem',
        color: 'var(--text-muted)',
      }}>
        <GraduationCap size={20} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
        GradeBuddy — Built for NIE students
      </footer>
    </div>
  );
}
