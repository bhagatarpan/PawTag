import { Link } from 'react-router-dom';
import { CheckCircle, Mail, Home, FileText, Truck, Clock, Check, Share2, Download, Printer, ExternalLink, Crown, PawPrint } from 'lucide-react';
import api from '../../../lib/api';
import OrderSummaryCard from '../OrderSummaryCard';

interface ConfirmationStepProps {
  orderNumber: string;
  confirmedItems: any[];
  confirmedTotal: number;
  confirmedInvoice: any;
  confirmedPawTagOrder: any;
  user: any;
  guardianTier: string | null;
  isGoldMember: boolean;
  estimatedPoints: number;
  pointsToNextTier: number | null;
  nextTierName: string;
  goldPrice: string;
}

export default function ConfirmationStep({
  orderNumber,
  confirmedItems,
  confirmedTotal,
  confirmedInvoice,
  confirmedPawTagOrder,
  user,
  guardianTier,
  isGoldMember,
  estimatedPoints,
  pointsToNextTier,
  nextTierName,
  goldPrice,
}: ConfirmationStepProps) {
  const handleInvoiceAction = async (action: 'view' | 'download' | 'print') => {
    try {
      const res = await api.post(`/customer/invoices/${confirmedInvoice._id}/access`);
      const { secureUrl } = res.data.data;
      if (secureUrl) window.open(secureUrl, '_blank');
    } catch {
      window.open('/account/orders', '_blank');
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-6">
      {/* Success Header */}
      <div className="text-center">
        <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="h-12 w-12 text-green-500" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Order Confirmed!</h1>
        <p className="text-lg text-gray-600">
          Thank you for your purchase{user?.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}.
        </p>
        <div className="mt-3 bg-white border border-gray-200 rounded-xl px-5 py-3 inline-flex items-center gap-3">
          <span className="text-sm text-gray-500">Order</span>
          <span className="font-mono text-lg font-bold text-primary-700 tracking-wide">{orderNumber}</span>
          <span className="text-gray-300">|</span>
          <span className="text-sm font-medium text-gray-700">
            {new Date().toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Confirmation Sent */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-start gap-3">
        <Mail className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-green-800">Confirmation sent</p>
          <p className="text-sm text-green-700 mt-0.5">
            {confirmedPawTagOrder?.confirmationEmailSent
              ? <>Order confirmation and invoice have been sent to <strong>{user?.email}</strong>.</>
              : <>You'll receive an order confirmation at <strong>{user?.email}</strong> shortly.</>
            }
          </p>
        </div>
      </div>

      {/* Points Earned */}
      {user && guardianTier && (
        <div className="bg-primary-50 border border-primary-100 rounded-xl p-5 flex items-start gap-3">
          <PawPrint className="h-5 w-5 text-primary-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-primary-800">
              You earned <strong>{estimatedPoints} Guardian Points</strong> from this order!
            </p>
            {pointsToNextTier && pointsToNextTier > 0 && (
              <p className="text-sm text-primary-600 mt-1">
                You're now {pointsToNextTier - estimatedPoints} Points away from {nextTierName}.
              </p>
            )}
            <Link to="/account/guardian" className="text-xs font-medium text-primary-700 underline mt-1 inline-block">
              View your Guardian Dashboard
            </Link>
          </div>
        </div>
      )}

      {/* Gold Upsell */}
      {user && guardianTier && !isGoldMember && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3">
          <Crown className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              With Gold, you'd have earned <strong>{estimatedPoints * 2} Points</strong> on this order!
            </p>
            <p className="text-xs text-amber-600 mt-1">
              Gold members earn 2× points on every purchase — just ${goldPrice}/month.
            </p>
            <Link to="/gold" className="text-xs font-medium text-amber-700 underline mt-1 inline-block">
              Upgrade to Gold →
            </Link>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link to="/" className="flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-all">
          <Home size={18} /> Home
        </Link>
        {confirmedInvoice && (
          <button
            onClick={() => handleInvoiceAction('view')}
            className="flex items-center justify-center gap-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all"
          >
            <FileText size={18} /> View Invoice
          </button>
        )}
        <Link to="/account/orders" className="flex items-center justify-center gap-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all">
          My Dashboard
        </Link>
      </div>
      <div className="text-center mt-3">
        <Link to="/shop" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
          Continue Shopping →
        </Link>
      </div>

      {/* Order Summary */}
      {confirmedItems.length > 0 && (
        <OrderSummaryCard items={confirmedItems} subtotal={confirmedTotal} total={confirmedTotal} />
      )}

      {/* Order Status Timeline */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <Truck className="h-4 w-4" /> Order Status
        </h2>
        <div className="relative">
          <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-gray-200" />
          <div className="space-y-0">
            {[
              { label: 'Order Placed', time: 'Just now', done: true },
              { label: 'Being Processed', time: 'Pending', done: false },
              { label: confirmedPawTagOrder?.trackingNumber ? `Shipped — ${confirmedPawTagOrder.carrier || 'Courier'}` : 'Shipped (tracking will appear here)', time: confirmedPawTagOrder?.trackingNumber || 'Pending', done: !!confirmedPawTagOrder?.trackingNumber },
              { label: 'Delivered', time: 'Pending', done: false },
            ].map((step, i) => (
              <div key={i} className="relative flex items-start gap-3 pb-5 last:pb-0">
                <div className={`relative z-10 w-[30px] h-[30px] rounded-full flex items-center justify-center shrink-0 ${
                  step.done ? 'bg-primary-600' : 'bg-gray-200'
                } ${i === 0 ? 'ring-2 ring-offset-2 ring-green-200' : ''}`}>
                  {step.done ? <Check className="h-4 w-4 text-white" /> : <Clock className="h-4 w-4 text-gray-400" />}
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className={`text-sm ${i === 0 ? 'font-medium text-gray-900' : 'text-gray-700'}`}>{step.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{step.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Invoice Section */}
      {confirmedInvoice && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4" /> Invoice
          </h2>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-mono font-medium text-gray-900">{confirmedInvoice.invoiceNumber}</p>
              <p className="text-sm text-gray-500">${confirmedInvoice.amount.toFixed(2)} · <span className="text-green-600 font-medium">Paid</span></p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              onClick={() => handleInvoiceAction('view')}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-all"
            >
              <ExternalLink size={14} /> View
            </button>
            <button
              onClick={() => handleInvoiceAction('download')}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 border border-primary-600 text-primary-600 rounded-xl text-sm font-semibold hover:bg-primary-50 transition-all"
            >
              <Download size={14} /> Download
            </button>
            <button
              onClick={() => handleInvoiceAction('print')}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-all"
            >
              <Printer size={14} /> Print
            </button>
            <button
              onClick={() => {
                const url = window.location.origin + '/account/orders';
                if (navigator.share) {
                  navigator.share({ title: `PawTag Order ${orderNumber}`, url });
                } else {
                  navigator.clipboard.writeText(url);
                }
              }}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-all"
            >
              <Share2 size={14} /> Share
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
