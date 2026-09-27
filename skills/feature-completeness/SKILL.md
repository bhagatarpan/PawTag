# Skill: feature-completeness

# Feature Completeness — Think Before You Code

**The #1 rule: Never build a feature in isolation.**

This skill enforces a thinking protocol that prevents building features that nobody can access, use, or see. Apply this to EVERY feature, fix, or change — no matter how small.

---

## The Core Problem This Solves

Bad pattern:
```
Developer builds feature → Feature exists in code → Nobody can see it → Waste of time
```

Example: Building credit note generation without checking if customers or admins can view credit notes.

---

## Before Coding Protocol

Before writing ANY code, answer these 5 questions:

### 1. WHO consumes this?

| Consumer | How do they access it? |
|----------|----------------------|
| Customer | Which page? Which route? |
| Admin | Which page? Which route? |
| Warehouse staff | Which page? Which route? |
| External system | Which API? Which webhook? |

If you can't answer this, **stop and ask the product owner**.

### 2. What's the COMPLETE user journey?

Map the full path from trigger to consumption:

```
Event happens
    ↓
Data created/stored
    ↓
Notification sent (email? push? in-app?)
    ↓
Consumer sees it (where exactly?)
    ↓
Consumer acts on it (what can they do?)
```

If any step is missing, **the feature is incomplete**.

### 3. Does the downstream path EXIST?

Before building the upstream, verify the downstream:

| Check | Question |
|-------|----------|
| Route exists? | Does the page/route the user will land on exist? |
| API exists? | Does the endpoint the frontend calls exist? |
| Template works? | Does the email/notification template render correctly? |
| Link works? | Does the URL in the email/notification actually resolve? |

If the downstream doesn't exist, **build it first or build it together**.

### 4. What's the acceptance criteria?

Define "done" BEFORE starting:

```markdown
- [ ] Feature creates data correctly
- [ ] Data is visible to [consumer] at [location]
- [ ] Consumer can [action] on the data
- [ ] Email/notification includes working link
- [ ] Admin can see/manage the data
- [ ] Tests verify the complete flow
```

If you can't write acceptance criteria, **you don't understand the requirement**.

### 5. What already exists?

Check existing infrastructure:

| Check | Search for |
|-------|-----------|
| Similar patterns | How do other features handle this flow? |
| Existing routes | Is there a route that could be extended? |
| Existing components | Is there a UI component that could be reused? |
| Existing templates | Is there an email template pattern to follow? |
| Existing models | Does the data model support what you need? |

Don't reinvent — extend what exists.

---

## Implementation Checklist

For EVERY feature, verify all layers are connected:

```
LAYER 1: DATA CREATION
  ✅ Model/schema exists
  ✅ Service creates data correctly
  ✅ Data stored with correct fields

LAYER 2: API EXPOSURE
  ✅ Endpoint exists to retrieve data
  ✅ Endpoint returns correct shape
  ✅ Authorization checks in place
  ✅ Type field/filter available if needed

LAYER 3: FRONTEND DISPLAY
  ✅ Page/route exists
  ✅ Component renders data correctly
  ✅ Consumer can distinguish from similar data
  ✅ Consumer can act on the data (view/download/email)

LAYER 4: NOTIFICATION
  ✅ Email/notification sent correctly
  ✅ Link in notification resolves to working page
  ✅ Consumer sees relevant context

LAYER 5: ADMIN VISIBILITY
  ✅ Admin can see the data in admin UI
  ✅ Admin can filter/search by relevant fields
  ✅ Admin can act on the data
```

**If ANY layer is missing, the feature is NOT done.**

---

## Real-World Example: Credit Note Feature

### What was done WRONG:
1. Built credit note generation ✅
2. Never checked if customers can view it ❌
3. Never checked if admins can see it ❌
4. Never checked if email link works ❌
5. Never checked if existing invoice routes handle the new type ❌

### What SHOULD have been done:
1. DEFINE: "Credit note must be visible to customer and admin, linked to original order"
2. MAP: Refund → Credit note created → Customer views from order detail → Admin views from invoices list
3. CHECK: Does invoice viewing route handle `type: 'credit_note'`? → NO → Build it
4. CRITERIA: Customer can view CN, Admin can see type column, Email link works
5. EXISTING: Use existing invoice HTML pattern, extend not rebuild

---

## Common Anti-Patterns to Avoid

| Anti-Pattern | Why It's Wrong | What To Do Instead |
|-------------|---------------|-------------------|
| Build data, forget display | Feature invisible to users | Map complete journey first |
| Build API, forget frontend | Data exists but no way to see it | Build layers together |
| Build email, forget route | Links 404 | Verify route exists before linking |
| Build frontend, forget auth | Security hole | Check authorization at every layer |
| Build for one consumer, ignore others | Partial feature | Map ALL consumers first |
| Build feature, forget admin | Ops can't manage it | Admin visibility is part of "done" |
| Build without acceptance criteria | No definition of "done" | Write criteria before coding |

---

## Questions to Ask the Product Owner

Before starting any feature, ask:

1. "Who will use this feature?" (Customer, admin, warehouse, etc.)
2. "Where will they see it?" (Which page, which screen)
3. "How do they get there?" (From where? Email link? Navigation?)
4. "What should they be able to do with it?" (View, download, print, etc.)
5. "Should this be visible in the admin UI?" (Yes/No — if yes, where?)
6. "Should an email/notification be sent?" (If yes, what link should be included?)

---

## Verification Checklist (Before Saying "Done")

- [ ] I can describe the complete user journey from trigger to consumption
- [ ] I can point to the exact page/route where the consumer sees this
- [ ] I have verified the downstream route exists and works
- [ ] I have verified email/notification links resolve correctly
- [ ] I have verified admin can see and manage this
- [ ] I have verified the consumer can distinguish this from similar data
- [ ] I have acceptance criteria and all are met
- [ ] I have tested the complete flow, not just the creation step

---

## When This Skill Applies

Apply this skill to:

- Any new feature
- Any bug fix that creates new data
- Any workflow change
- Any email/notification change
- Any admin UI change
- Any API endpoint that returns new data types
- Any integration with external systems

**If in doubt, apply this skill. The overhead is 5 minutes of thinking. The cost of not applying it is hours of wasted work.**

---

Base directory for this skill: C:\work\PawTag\skills\feature-completeness
