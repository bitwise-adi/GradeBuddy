'use client';

import ManualEntry from '@/components/ManualEntry';
import { GraduationCap } from 'lucide-react';

export default function Home() {
  return (
    <main className="login-page">
      <div className="login-hero animate-fade-in-up">
        <div style={{ marginBottom: '1rem' }}>
          <GraduationCap
            size={48}
            color="var(--accent-primary)"
            style={{ filter: 'drop-shadow(0 0 20px rgba(129, 140, 248, 0.4))' }}
          />
        </div>
        <h1>
          <span className="gradient-text">GradeBuddy</span>
        </h1>
        <p>Know exactly what you need to score. Plan your grades, ace your semester.</p>
      </div>

      <ManualEntry />

      <p style={{
        marginTop: '2rem',
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
        textAlign: 'center',
        maxWidth: '400px',
      }}>
        Built for NIE students. Enter your CIE marks and see exactly what you need in your SEE to hit your target grade.
      </p>
    </main>
  );
}
