import { Award, Camera, Syringe, ClipboardCheck, Star, Sparkles } from 'lucide-react';
import { useHomepageSections, useSiteSettings } from '../hooks/useCms';

const iconMap: Record<string, typeof Award> = { Award, Camera, Syringe, ClipboardCheck, Star, Sparkles };

const defaultActivities = [
  { icon: 'ClipboardCheck', points: '+10', label: 'Complete Profile', color: 'text-primary-600 bg-primary-50' },
  { icon: 'Camera', points: '+15', label: 'Upload Pet Photo', color: 'text-sky-600 bg-sky-50' },
  { icon: 'Syringe', points: '+20', label: 'Add Vaccination Record', color: 'text-emerald-600 bg-emerald-50' },
  { icon: 'Star', points: '+25', label: 'Keep Info Updated', color: 'text-amber-600 bg-amber-50' },
];

export default function ResponsibilityScore() {
  const { sections } = useHomepageSections('responsibility_score');
  const { settings } = useSiteSettings();
  const companyName = settings?.['company.name'] || 'PawTag';
  const content = sections[0]?.content as Record<string, unknown> | undefined;

  const score = (content?.score as string) || '820';
  const scoreLabel = (content?.scoreLabel as string) || 'Excellent';
  const sectionTitle = (content?.title as string) || sections[0]?.title || 'Earn points for being a great pet parent';
  const sectionDesc = (content?.desc as string) || sections[0]?.subtitle || `${companyName} Responsibility Score rewards you for keeping your pet's profile complete and up to date. The higher your score, the more trusted your profile appears to potential finders.`;

  const activities = (content?.activities as Array<Record<string, string>>) || defaultActivities;

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold uppercase tracking-wider mb-4">
              <Sparkles size={12} />
              Coming Soon
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              {sectionTitle}
            </h2>
            <p className="text-gray-500 text-lg mb-8 leading-relaxed">
              {sectionDesc}
            </p>
            <div className="flex items-center gap-4">
              <div className="px-4 py-2 rounded-xl bg-primary-50 border border-primary-100">
                <p className="text-primary-600 font-semibold text-sm">Beta Feature</p>
                <p className="text-primary-500 text-xs">Launching with customer portal</p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-3xl p-8 text-white shadow-2xl">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <p className="text-white/70 text-sm font-medium">Responsibility Score</p>
                  <p className="text-5xl font-bold mt-1">{score}</p>
                  <p className="text-primary-200 text-sm mt-1">{scoreLabel}</p>
                </div>
                <div className="w-20 h-20 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20">
                  <Award size={40} className="text-white" />
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-white/60 text-xs font-semibold uppercase tracking-wider">How to earn points</p>
                {activities.map((act) => {
                  const Icon = iconMap[act.icon] || Star;
                  return (
                    <div key={act.label} className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${act.color}`}>
                        <Icon size={16} />
                      </div>
                      <span className="flex-1 text-sm font-medium text-white">{act.label}</span>
                      <span className="text-primary-200 font-bold text-sm">{act.points}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}