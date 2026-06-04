'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, ArrowRight, BookOpen } from 'lucide-react';
import { Course } from '@/lib/types';

interface ManualEntryProps {
  onBack: () => void;
}

export default function ManualEntry({ onBack }: ManualEntryProps) {
  const router = useRouter();
  const [courses, setCourses] = useState<Partial<Course>[]>([
    { courseCode: '', courseName: '', credits: 4, cieMarks: 0, cieMax: 100, hasSEE: true, nature: 'Core', components: [], attendance: null },
  ]);
  const [studentName, setStudentName] = useState('');

  const addCourse = () => {
    setCourses([
      ...courses,
      { courseCode: '', courseName: '', credits: 3, cieMarks: 0, cieMax: 100, hasSEE: true, nature: 'Core', components: [], attendance: null },
    ]);
  };

  const removeCourse = (index: number) => {
    if (courses.length <= 1) return;
    setCourses(courses.filter((_, i) => i !== index));
  };

  const updateCourse = (index: number, field: string, value: string | number | boolean) => {
    const updated = [...courses];
    (updated[index] as Record<string, unknown>)[field] = value;

    // Auto-set hasSEE based on credits
    if (field === 'credits') {
      updated[index].hasSEE = Number(value) > 0;
    }

    setCourses(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const validCourses = courses.filter(c => c.courseName || c.courseCode) as Course[];

    if (validCourses.length === 0) return;

    const profile = {
      name: studentName || 'Student',
      usn: '',
      branch: '',
      semester: '',
      section: '',
    };

    sessionStorage.setItem('gradebuddy_profile', JSON.stringify(profile));
    sessionStorage.setItem('gradebuddy_courses', JSON.stringify(validCourses));
    router.push('/dashboard');
  };

  return (
    <div className="login-card glass-card glow-border" style={{ maxWidth: '600px' }}>
      <form onSubmit={handleSubmit} className="animate-fade-in">
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <BookOpen size={28} color="var(--accent-primary)" style={{ marginBottom: '0.5rem' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Manual Entry</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Enter your course details manually
          </p>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="student-name">Your Name (optional)</label>
          <input
            id="student-name"
            type="text"
            className="form-input"
            placeholder="e.g. Aditya Raj"
            value={studentName}
            onChange={e => setStudentName(e.target.value)}
          />
        </div>

        <div className="manual-courses">
          <label className="form-label">Courses</label>

          {courses.map((course, index) => (
            <div key={index} style={{
              padding: '1rem',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '0.75rem',
              border: '1px solid var(--border-subtle)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Course {index + 1}
                </span>
                {courses.length > 1 && (
                  <button type="button" className="remove-course" onClick={() => removeCourse(index)} aria-label="Remove course">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Code"
                  value={course.courseCode || ''}
                  onChange={e => updateCourse(index, 'courseCode', e.target.value.toUpperCase())}
                  style={{ padding: '0.6rem 0.75rem', fontSize: '0.85rem' }}
                />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Course Name"
                  value={course.courseName || ''}
                  onChange={e => updateCourse(index, 'courseName', e.target.value)}
                  style={{ padding: '0.6rem 0.75rem', fontSize: '0.85rem' }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Credits</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="Credits"
                    value={course.credits || ''}
                    onChange={e => updateCourse(index, 'credits', Number(e.target.value))}
                    min={0}
                    max={10}
                    step={1}
                    required
                    style={{ padding: '0.6rem 0.75rem', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>CIE Marks</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="CIE"
                    value={course.cieMarks || ''}
                    onChange={e => updateCourse(index, 'cieMarks', Number(e.target.value))}
                    min={0}
                    max={course.cieMax || 100}
                    required
                    style={{ padding: '0.6rem 0.75rem', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>CIE Max</label>
                  <select
                    className="form-input form-select"
                    value={course.cieMax || 100}
                    onChange={e => updateCourse(index, 'cieMax', Number(e.target.value))}
                    style={{ padding: '0.6rem 0.75rem', fontSize: '0.85rem' }}
                  >
                    <option value={100}>/ 100</option>
                    <option value={50}>/ 50</option>
                  </select>
                </div>
              </div>
            </div>
          ))}

          <button type="button" className="add-course-btn" onClick={addCourse}>
            <Plus size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
            Add Course
          </button>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          style={{ marginTop: '1.5rem' }}
          disabled={!courses.some(c => c.courseName || c.courseCode)}
        >
          <ArrowRight size={18} />
          Calculate Grades
        </button>

        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
            ← Back to Portal Login
          </button>
        </div>
      </form>
    </div>
  );
}
