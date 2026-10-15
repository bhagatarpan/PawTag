# Hero Image Creative Briefs — Photography Production

**Owner action required.** The homepage hero is fully implemented and image-ready; it currently renders a full-bleed deep teal→charcoal gradient canvas until these three photographs are supplied and uploaded (Admin → CMS → Media, then assign per slide in Admin → CMS → Homepage Sections).

**Rendered hero geometry (from the implemented component — do not use older brief numbers):**

| Viewport | Hero canvas | Implication |
|---|---|---|
| Desktop ≥1024px | Full viewport width × 620px (lg) / 680px (xl) | Image is cropped by `object-cover`; a ~2.1–2.2:1 landscape survives all desktop widths with minimal loss |
| Tablet 768–1023px | Full width × 600px | Same landscape image, tighter crop |
| Mobile <768px | Full width × ≥600px (portrait canvas) | Purpose-made portrait crop strongly recommended; desktop image is cropped hard otherwise |

## Hard rules for all three images

- One cohesive campaign: same lighting temperature, colour grade, and photographic style across all three. Warm, natural, premium — like a modern pet-lifestyle brand.
- Real photography only (AI or professional). No cartoon/illustration hero art.
- **Never bake text into the image** — all copy is live HTML.
- If a tag is visible, it must look like a plausible PawTag product (round tag, QR visible at close range). **Never show an invented QR code as functional** — when a QR appears in close-up, composite the real PawTag QR artwork and real phone UI from the application.
- No people's faces unless released; hands/arms fine.
- **Desktop composition:** subject on the **right half**; the left half stays uncluttered (copy sits left, behind a dark-to-clear gradient scrim that the layout applies automatically — the photo itself does not need to be dark).
- **Mobile composition:** subject in the **upper half**; copy sits low over a bottom-weighted dark scrim.
- File specs (desktop): **WebP preferred (JPG fallback), 2400 × 1100 px (≈2.18:1), max ~450 KB**, sRGB.
- File specs (mobile crop): **1080 × 1620 px (2:3 portrait), max ~350 KB**, WebP/JPG — a true re-crop, never a scaled desktop image.
- Alt text: describe the photo plainly for screen readers (e.g. "Golden Retriever wearing a PawTag tag in warm afternoon light").
- Focal point settings (assigned in the CMS after upload): desktop → **Right**; mobile → **Top** (adjust per photo if the subject sits elsewhere).

---

## Slide 1 — Emotional Connection (default slide "Hero — Pet Safety")

**Story:** why PawTag matters — instantly.
**Approved copy:** *PET SAFETY, SIMPLIFIED / They can't tell someone where they live. Their tag can.*

**Image concept:** A beautiful Golden Retriever wearing a PawTag identification tag, outdoors in warm late-afternoon sunlight.
**Visual direction:** premium lifestyle photography · natural expression · warm golden light · rich fur detail · shallow depth of field · realistic collar · authentic-looking tag · **dog positioned right-of-frame (desktop), upper-centre (mobile)** · clean negative space left for the headline · uncluttered background.
**Mood:** warm, emotional, reassuring, premium.

## Slide 2 — Product Understanding ("Hero — Smart Identification")

**Story:** the core value — one scan.
**Approved copy:** *SMART IDENTIFICATION / One scan can make all the difference.*

**Image concept:** A believable outdoor lifestyle photograph — someone holding a smartphone near the PawTag QR tag on a dog's collar.
**Visual direction:** realistic smartphone · visible round QR tag · natural human interaction (hand/wrist only) · premium outdoor light · the scanning action clearly readable at a glance · product detail visible but not dominating · negative space for the headline (left of frame) · **dog + hand right-of-frame (desktop), upper-centre (mobile)**.
**Mood:** confident, clear, modern.
**Accuracy requirement:** the phone screen must not display an invented UI or fake QR — either keep the screen out of focus/off-frame, or composite the real PawTag finder screen + real QR artwork in post.

## Slide 3 — Pet Profiles / Everyday Confidence ("Hero — Pet Profiles")

**Story:** more than an engraved name tag.
**Approved copy:** *MORE THAN A NAME TAG / Their important details, always close.*

**Image concept:** A beautiful cat wearing an identification collar in a contemporary, naturally lit home, with its owner nearby (hands/body only is fine).
**Visual direction:** premium interior lifestyle photography · soft natural window light · calm reassuring mood · contemporary home · realistic collar/tag · **cat right-of-frame (desktop), upper-centre (mobile)**, clear space left for headline · consistent grade with slides 1–2.
**Mood:** calm, close, everyday.

---

## Upload & assignment checklist (per slide)

1. Upload desktop image (2400×1100) and mobile crop (1080×1620) via **Admin → CMS → Media** (WebP/JPG, ≤ 10 MB — under 450/350 KB ideal).
2. Open **Admin → CMS → Homepage Sections** → the slide → Photography section.
3. Pick the desktop image, then the mobile crop, set **alt text**, and choose the **focal points** (desktop: Right; mobile: Top — adjust per photo). Separate desktop/mobile focal controls exist.
4. Preview panes in the editor show the full-width cinematic composition (photo + scrim + overlaid text) at desktop and mobile shapes before saving.
5. Verify on the live homepage at phone and desktop widths — the photo fills the entire hero with text overlaid on the left.
