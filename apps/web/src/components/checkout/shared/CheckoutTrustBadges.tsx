import { Shield, Lock, CreditCard } from 'lucide-react';

export default function CheckoutTrustBadges() {
  return (
    <div className="flex items-center justify-center gap-6 mt-4 text-xs text-gray-500">
      <div className="flex items-center gap-1.5">
        <Lock size={12} />
        <span>SSL Encrypted</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Shield size={12} />
        <span>PCI DSS Compliant</span>
      </div>
      <div className="flex items-center gap-1.5">
        <CreditCard size={12} />
        <span>Powered by Stripe</span>
      </div>
    </div>
  );
}
