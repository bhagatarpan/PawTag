import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, Sparkles } from 'lucide-react';
import { API } from '@pawtag/shared/api';
import api from '../lib/api';

interface Announcement {
  _id: string;
  title: string;
  message: string;
  type: string;
  link?: string;
  linkText?: string;
  dismissible: boolean;
}

const STORAGE_KEY = 'pawtag_announcement_dismissed';

export default function AnnouncementBar() {
  const [visible, setVisible] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

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
    fetchAnnouncements();
  }, []);

  useEffect(() => {
    if (!visible || announcements.length === 0) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % announcements.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [visible, announcements]);

  async function fetchAnnouncements() {
    try {
      const res = await api.get(API.public.cms.announcements);
      setAnnouncements(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch announcements:', err);
      // Fallback to default announcements
      setAnnouncements([
        { _id: '1', title: 'Membership', message: 'Protect your pet — Join Gold from $89/year', type: 'promotion', link: '/membership', dismissible: true },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
  };

  if (!visible || loading || announcements.length === 0) return null;

  const announcement = announcements[currentIndex];

  return (
    <div className="bg-primary-600 text-white py-2 px-4 relative z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 text-sm">
        <Sparkles className="h-4 w-4 text-primary-200 shrink-0" />
        {announcement.link ? (
          <Link to={announcement.link} className="hover:underline font-medium">
            {announcement.message}
          </Link>
        ) : (
          <span className="font-medium">{announcement.message}</span>
        )}
        {announcement.dismissible && (
          <button
            onClick={handleDismiss}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors"
            aria-label="Dismiss announcement"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
