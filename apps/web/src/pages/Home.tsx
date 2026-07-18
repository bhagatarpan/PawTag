import { Link } from 'react-router-dom';
import { Shield, QrCode, MapPin, Heart } from 'lucide-react';

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-600 to-primary-800 text-white">
        <div className="max-w-7xl mx-auto px-4 py-24 text-center">
          <h1 className="text-5xl font-bold mb-6">Never Lose Your Pet Again</h1>
          <p className="text-xl text-primary-100 mb-8 max-w-2xl mx-auto">
            PawTag uses QR code technology to help reunite lost pets with their families.
            Simple, fast, and effective.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              to="/shop"
              className="bg-white text-primary-700 px-8 py-3 rounded-lg font-semibold hover:bg-primary-50 transition-colors"
            >
              Buy a PawTag
            </Link>
            <Link
              to="/about"
              className="border border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white/10 transition-colors"
            >
              Learn More
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">How PawTag Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: QrCode, title: '1. Tag Your Pet', desc: 'Attach a PawTag QR code to your pet\'s collar.' },
              { icon: MapPin, title: '2. Someone Scans It', desc: 'If your pet is found, the finder scans the QR code with their phone.' },
              { icon: Heart, title: '3. Get Reunited', desc: 'You receive an instant notification with the finder\'s location.' },
            ].map((step, i) => (
              <div key={i} className="bg-white rounded-xl p-8 text-center shadow-sm border border-gray-100">
                <div className="inline-flex p-4 rounded-full bg-primary-100 mb-4">
                  <step.icon size={28} className="text-primary-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                <p className="text-gray-600">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Why Choose PawTag</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              { icon: Shield, title: 'Secure & Private', desc: 'Your data is encrypted and your address is never shared with finders.' },
              { icon: QrCode, title: 'No App Required', desc: 'Finders can scan the QR code with any smartphone camera. No app download needed.' },
              { icon: MapPin, title: 'GPS Location Sharing', desc: 'Finders can share their location with one tap so you know exactly where your pet was found.' },
              { icon: Heart, title: 'Instant Notifications', desc: 'Get notified immediately when someone scans your pet\'s tag.' },
            ].map((f, i) => (
              <div key={i} className="flex gap-4 p-6 rounded-xl border border-gray-100">
                <div className="shrink-0 p-3 rounded-lg bg-primary-100 h-fit">
                  <f.icon size={24} className="text-primary-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-1">{f.title}</h3>
                  <p className="text-gray-600 text-sm">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary-600 text-white py-16">
        <div className="max-w-3xl mx-auto text-center px-4">
          <h2 className="text-3xl font-bold mb-4">Protect Your Pet Today</h2>
          <p className="text-primary-100 mb-8">Join thousands of pet owners who trust PawTag to keep their furry family safe.</p>
          <Link to="/shop" className="bg-white text-primary-700 px-8 py-3 rounded-lg font-semibold hover:bg-primary-50 transition-colors inline-block">
            Get Started
          </Link>
        </div>
      </section>
    </div>
  );
}
