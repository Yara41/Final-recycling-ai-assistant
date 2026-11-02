import React from 'react';

// Living campus. Task 4 replaces this placeholder with the data-driven campus.
export default function Campus({ mode = 'showcase' }) {
  return <div className={`campus-stage campus-${mode}`}><div className="campus-fallback" aria-hidden="true" /></div>;
}
