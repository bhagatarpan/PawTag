import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PawPrint, X, AlertTriangle, Search, UserRoundX, HeartHandshake, LogIn, Compass, ChevronDown } from 'lucide-react';

/**
 * Emergency Lost Pet floating help.
 *
 * - "I Lost My Pet" opens a support modal with a sign-in path to the
 *   customer portal; "I Found a Pet" opens a thank-you modal that sends
 *   the finder to the finder portal (no account needed there).
 * - The button can be dragged anywhere on screen and collapsed to a mini
 *   dot; both preferences persist per device (UI state only).
 */

const POSITION_KEY = 'pawtag_emergency_fab_pos';
const COLLAPSED_KEY = 'pawtag_emergency_fab_collapsed';
const DRAG_THRESHOLD_PX = 6;
const FAB_SIZE_PX = 56;

/** Finder portal origin: configured URL, else the dev app, else relative. */
function finderPortalUrl(): string {
  const configured = import.meta.env.VITE_FINDER_URL;
  if (configured) return String(configured).replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:3003';
  }
  return '/finder';
}

interface FabPosition {
  x: number;
  y: number;
}

function readStoredPosition(): FabPosition | null {
  try {
    const raw = localStorage.getItem(POSITION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FabPosition;
    if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') return parsed;
    return null;
  } catch {
    return null;
  }
}

function clampToViewport(pos: FabPosition): FabPosition {
  const margin = 8;
  return {
    x: Math.min(Math.max(margin, pos.x), Math.max(margin, window.innerWidth - FAB_SIZE_PX - margin)),
    y: Math.min(Math.max(margin, pos.y), Math.max(margin, window.innerHeight - FAB_SIZE_PX - margin)),
  };
}

function EmergencyModal({ variant, onClose }: { variant: 'lost' | 'found'; onClose: () => void }) {
  const primaryRef = useRef<HTMLAnchorElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    primaryRef.current?.focus();
    const restore = previouslyFocused;
    return () => restore.current?.focus?.();
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    // Simple focus trap across the modal's focusable elements.
    const focusables = containerRef.current?.querySelectorAll<HTMLElement>('a[href], button');
    if (!focusables || focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const isLost = variant === 'lost';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="emergency-modal-title"
        onKeyDown={handleKeyDown}
        onClick={(event) => event.stopPropagation()}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 transition-colors rounded-lg"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isLost ? 'bg-red-100' : 'bg-green-100'}`}>
          {isLost ? <UserRoundX size={20} className="text-red-600" /> : <HeartHandshake size={20} className="text-green-600" />}
        </div>

        <h2 id="emergency-modal-title" className="mt-4 text-lg font-semibold text-gray-900">
          {isLost ? "We're here to help" : "Thank you — you're doing great work"}
        </h2>

        {isLost ? (
          <p className="mt-2 text-sm text-gray-600 leading-relaxed">
            Take a deep breath — most lost pets are found close to home. Sign in to report your pet
            as lost, reach anyone who finds them faster, and follow every update in one place.
          </p>
        ) : (
          <p className="mt-2 text-sm text-gray-600 leading-relaxed">
            Reunions happen because people like you take a minute to help. The PawTag finder
            portal guides you through contacting the pet's owner safely — no app and no account
            needed.
          </p>
        )}

        <div className="mt-6 flex flex-col gap-2">
          {isLost ? (
            <Link
              ref={primaryRef}
              to="/login"
              onClick={onClose}
              className="inline-flex items-center justify-center gap-2 min-h-[48px] bg-primary-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary-700 transition-colors shadow-sm"
            >
              <LogIn size={18} />
              Sign in to continue
            </Link>
          ) : (
            <a
              ref={primaryRef}
              href={finderPortalUrl()}
              className="inline-flex items-center justify-center gap-2 min-h-[48px] bg-primary-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary-700 transition-colors shadow-sm"
            >
              <Compass size={18} />
              Open the Finder Portal
            </a>
          )}
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center min-h-[44px] border border-gray-300 text-gray-700 px-6 py-2.5 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EmergencyLostPet() {
  const [modal, setModal] = useState<'lost' | 'found' | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [position, setPosition] = useState<FabPosition | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const dragging = useRef(false);
  const dragged = useRef(false);
  const startPointer = useRef({ x: 0, y: 0 });
  const startPosition = useRef<FabPosition>({ x: 0, y: 0 });
  const positionRef = useRef<FabPosition | null>(null);

  const persistPosition = useCallback((pos: FabPosition) => {
    try {
      localStorage.setItem(POSITION_KEY, JSON.stringify(pos));
    } catch {
      // Storage unavailable — drag still works for this session
    }
  }, []);

  useEffect(() => {
    // Clamp the stored position on load: a position saved against a taller/
    // wider window (mobile URL bar, resized desktop window) can otherwise
    // render the button off-screen — and keep it there across reloads.
    const stored = readStoredPosition();
    setPosition(stored ? clampToViewport(stored) : null);
    setCollapsed(localStorage.getItem(COLLAPSED_KEY) === 'true');
  }, []);

  // Keep the button reachable through viewport changes (window resize,
  // mobile orientation and URL-bar show/hide). Without this, a drag against
  // a tall viewport can leave the saved position below the fold, where no
  // reload can reach it.
  useEffect(() => {
    const reclamp = () => {
      setPosition((current) => {
        if (!current) return current;
        const next = clampToViewport(current);
        if (next.x !== current.x || next.y !== current.y) {
          persistPosition(next);
          return next;
        }
        return current;
      });
    };
    window.addEventListener('resize', reclamp);
    window.visualViewport?.addEventListener('resize', reclamp);
    return () => {
      window.removeEventListener('resize', reclamp);
      window.visualViewport?.removeEventListener('resize', reclamp);
    };
  }, [persistPosition]);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    dragging.current = true;
    dragged.current = false;
    startPointer.current = { x: event.clientX, y: event.clientY };
    startPosition.current = positionRef.current ?? { x: rect.left, y: rect.top };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragging.current) return;
    const deltaX = event.clientX - startPointer.current.x;
    const deltaY = event.clientY - startPointer.current.y;
    if (!dragged.current && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD_PX) return;
    dragged.current = true;
    setPosition(clampToViewport({ x: startPosition.current.x + deltaX, y: startPosition.current.y + deltaY }));
  };

  const handlePointerUp = (togglePanel: boolean) => {
    if (!dragging.current) return;
    dragging.current = false;
    if (dragged.current) {
      if (positionRef.current) persistPosition(clampToViewport(positionRef.current));
      return;
    }
    // Treated as a click, not a drag — only the main FAB toggles the panel;
    // the mini dot's click is handled by its own expand onClick.
    if (togglePanel) setPanelOpen((open) => !open);
  };

  // Safari interrupts touch gestures (system pans, notification pull-downs)
  // with pointercancel — treat it as a clean drag end so no half-drag state
  // survives to fling the button on the next touch.
  const handlePointerCancel = () => {
    if (!dragging.current) return;
    dragging.current = false;
    dragged.current = false;
    if (positionRef.current) persistPosition(clampToViewport(positionRef.current));
  };

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem(COLLAPSED_KEY, String(next));
      } catch {
        // Preference is session-only if storage is unavailable
      }
      return next;
    });
  };

  return (
    <>
      {modal && <EmergencyModal variant={modal} onClose={() => setModal(null)} />}

      {/* State uses {x,y}; CSS needs {left,top} — passing x/y directly to
          style is silently ignored by the browser (the control "disappears"
          after the first drag). */}
      <div
        className={`fixed z-40 ${position ? '' : 'bottom-6 right-6'}`}
        style={position ? { left: position.x, top: position.y } : undefined}
      >
        {collapsed ? (
          <button
            onClick={() => setCollapsed(false)}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={() => handlePointerUp(false)}
            onPointerCancel={handlePointerCancel}
            className="w-10 h-10 rounded-full shadow-lg bg-gradient-to-br from-red-500 to-orange-500 opacity-80 hover:opacity-100 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none transition-opacity"
            aria-label="Show lost pet help"
            title="Lost pet help — drag to move"
          >
            <PawPrint size={16} className="text-white" />
          </button>
        ) : (
          <>
            {/* Collapse control */}
            <button
              onClick={toggleCollapsed}
              className="absolute -top-7 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full shadow bg-white border border-gray-200 text-gray-500 hover:text-gray-700 flex items-center justify-center"
              aria-label="Collapse emergency help"
              title="Collapse"
            >
              <ChevronDown size={14} />
            </button>

            {panelOpen && (
              <div className="mb-3 w-72 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-slide-up">
                <div className="bg-gradient-to-r from-red-500 to-orange-500 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white">
                    <AlertTriangle size={18} />
                    <span className="font-bold text-sm">Lost Pet?</span>
                  </div>
                  <button
                    onClick={() => setPanelOpen(false)}
                    className="text-white/80 hover:text-white transition-colors"
                    aria-label="Close lost pet menu"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="p-4 space-y-3">
                  <button
                    onClick={() => {
                      setPanelOpen(false);
                      setModal('lost');
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-red-50 hover:bg-red-100 border border-red-100 transition-colors group text-left"
                  >
                    <div className="w-10 h-10 rounded-lg bg-red-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <UserRoundX size={20} className="text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">I Lost My Pet</p>
                      <p className="text-gray-500 text-xs">Report and track your pet</p>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      setPanelOpen(false);
                      setModal('found');
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-100 transition-colors group text-left"
                  >
                    <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Search size={20} className="text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">I Found a Pet</p>
                      <p className="text-gray-500 text-xs">Reunite them with their owner</p>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Draggable FAB */}
            <button
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={() => handlePointerUp(true)}
              onPointerCancel={handlePointerCancel}
              className="w-14 h-14 rounded-full shadow-lg flex items-center justify-center cursor-grab active:cursor-grabbing touch-none bg-gradient-to-br from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 transition-colors"
              aria-label={panelOpen ? 'Close lost pet help' : 'Lost pet help — drag to move'}
              aria-expanded={panelOpen}
              title="Drag to move"
            >
              {panelOpen ? <X size={24} className="text-white" /> : <PawPrint size={24} className="text-white" />}
            </button>
          </>
        )}
      </div>
    </>
  );
}
