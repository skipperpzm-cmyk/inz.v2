import React from 'react';

export default function Form({ children }: { children: React.ReactNode }) {
  return <form className="space-y-4">{children}</form>;
}
