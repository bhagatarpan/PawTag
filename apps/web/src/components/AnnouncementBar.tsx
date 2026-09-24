import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, Sparkles } from 'lucide-react';

const announcements = [
  { text: 'Protect your pet — Join Gold from $89/year', link: '/membership' },
  { text: 'Platinum members get 2× Points + Emergency Contacts', link: '/membership' },
  { text: 'New: 3-tier membership system — Find your perfect plan', link: '/membership' },
];

const STORAGE_KEY = 'pawtag_announcement_dismissed';

export default function AnnouncementBar() {
  const [visible, setVisible] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      const hoursSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60);
      if (hoursSinceDismissed < 24) {
        setVisible(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % announcements.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [visible]);

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
  };

  if (!visible) return null;

  const announcement = announcements[currentIndex];

  return (
    <div className="bg-primary-600 text-white py-2 px-4 relative z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 text-sm">
        <Sparkles className="h-4 w-4 text-primary-200 shrink-0" />
        <Link to={announcement.link} className="hover:underline font-medium">
          {announcement.text}
        </Link>
        <button
          onClick={handleDismiss}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors"
          aria-label="Dismiss announcement"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
