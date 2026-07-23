import HeroSlider from '../components/HeroSlider';
import EngagementTicker from '../components/EngagementTicker';
import HowItWorks from '../components/HowItWorks';
import TrustSection from '../components/TrustSection';
import ResponsibilityScore from '../components/ResponsibilityScore';
import Testimonials from '../components/Testimonials';
import EmergencyLostPet from '../components/EmergencyLostPet';
import SeoHead from '../components/SeoHead';

export default function Home() {
  return (
    <div>
      <SeoHead 
        title="Home"
        description="Smart QR-coded pet recovery tags. Because every pet deserves a safe way home."
        keywords={['pet recovery', 'QR code', 'pet tag', 'lost pet', 'found pet', 'pet safety']}
      />
      <HeroSlider />
      <EngagementTicker />
      <HowItWorks />
      <TrustSection />
      <ResponsibilityScore />
      <Testimonials />
      <EmergencyLostPet />
    </div>
  );
}
