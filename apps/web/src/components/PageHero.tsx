import React from 'react';

interface PageHeroProps {
  title: string;
  subtitle?: string;
  centered?: boolean;
  children?: React.ReactNode;
}

export default function PageHero({ title, subtitle, centered = true, children }: PageHeroProps) {
  return (
    <div className="bg-gradient-to-r from-primary-700 to-primary-600 text-white py-16">
      <div className={`max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 ${centered ? 'text-center' : ''}`}>
        <h1 className="text-4xl font-bold mb-4">{title}</h1>
        {subtitle && (
          <p className="text-primary-100 text-lg">{subtitle}</p>
        )}
        {children}
      </div>
    </div>
  );
}
