import HeroSlider from '../components/HeroSlider';
import EngagementTicker from '../components/EngagementTicker';
import HowItWorks from '../components/HowItWorks';
import TrustSection from '../components/TrustSection';
import ResponsibilityScore from '../components/ResponsibilityScore';
import Testimonials from '../components/Testimonials';
import EmergencyLostPet from '../components/EmergencyLostPet';

export default function Home() {
  return (
    <div>
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
