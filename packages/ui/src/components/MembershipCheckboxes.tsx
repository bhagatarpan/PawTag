export interface MembershipCheckboxesProps {
  goldPrice: string;
  addGold: boolean;
  onGoldChange: (checked: boolean) => void;
  goldJoined?: boolean;
  goldError?: string;
  className?: string;
}

export function MembershipCheckboxes({
  goldPrice,
  addGold,
  onGoldChange,
  goldJoined = false,
  goldError,
  className = '',
}: MembershipCheckboxesProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      {/* Guardian membership — included free */}
      <div className="flex items-start gap-3 p-3 bg-teal-50 border border-teal-200 rounded-lg opacity-80">
        <input
          type="checkbox"
          id="guardianMembership"
          checked={true}
          disabled={true}
          className="mt-1 h-4 w-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500 cursor-not-allowed"
        />
        <label htmlFor="guardianMembership" className="text-sm">
          <span className="font-medium text-teal-800">Guardian Membership — Free for life</span>
          <span className="text-teal-600 block text-xs mt-0.5">
            Earn rewards on every purchase, track your pet's health, and more.
          </span>
        </label>
      </div>

      {/* Gold membership */}
      <div className={`flex items-start gap-3 p-3 rounded-lg ${goldJoined ? 'bg-amber-50 border border-amber-200 opacity-80' : 'bg-amber-50 border border-amber-200'}`}>
        <input
          type="checkbox"
          id="addGold"
          checked={addGold}
          onChange={(e) => onGoldChange(e.target.checked)}
          disabled={goldJoined}
          className="mt-1 h-4 w-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500 disabled:opacity-50 cursor-not-allowed"
        />
        <label htmlFor="addGold" className="text-sm">
          {goldJoined ? (
            <>
              <span className="font-medium text-amber-800">Gold Membership — Active ✓</span>
              <span className="text-amber-600 block text-xs mt-0.5">
                Your Gold membership is already active.
              </span>
            </>
          ) : (
            <>
              <span className="font-medium text-amber-800">Add Gold Membership — ${goldPrice}/mo</span>
              <span className="text-amber-600 block text-xs mt-0.5">
                Earn 2× points on every purchase, free shipping over $50, and more.
              </span>
            </>
          )}
        </label>
      </div>

      {goldError && <p className="text-xs text-red-500">{goldError}</p>}
    </div>
  );
}
