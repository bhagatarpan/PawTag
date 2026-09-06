# PawTag Master Project Plan

> **Document Type:** Master Project Plan & Central Tracking Document
> **Date:** September 2026
> **Status:** Active - Central Source of Truth
> **Scope:** Complete project tracking for PawTag's expansion into pet commerce and loyalty system enhancements

---

## Table of Contents

1. [Project Vision & Objectives](#1-project-vision--objectives)
2. [Strategic Approach & Phasing](#2-strategic-approach--phasing)
3. [Current State Assessment](#3-current-state-assessment)
4. [Detailed Phase Breakdown](#4-detailed-phase-breakdown)
5. [Dependencies & Critical Path](#5-dependencies--critical-path)
6. [Resource Allocation & Timeline](#6-resource-allocation--timeline)
7. [Risk Management & Mitigation](#7-risk-management--mitigation)
8. [Success Criteria & Metrics](#8-success-criteria--metrics)
9. [Governance & Reporting](#9-governance--reporting)
10. [Documentation Map & Relationships](#10-documentation-map--relationships)
11. [Appendix: Reference Documents](#11-appendix-reference-documents)

---

## 1. Project Vision & Objectives

### 1.1 Core Vision
Transform PawTag from a pet recovery platform into a comprehensive pet ecosystem that:
- Sells other people's pet products (food, toys, accessories, technology) through a hybrid commerce model
- Enhances the existing Guardian loyalty program to drive engagement and retention
- Maintains PawTag's core identity as a trusted pet safety brand
- Operates with minimal inventory, capital, and operational overhead

### 1.2 Primary Objectives
1. **Commerce Expansion**: Enable PawTag to sell third-party pet products while maintaining low operational overhead
2. **Loyalty Enhancement**: Evolve the Guardian program to increase customer lifetime value and engagement
3. **Technical Foundation**: Build scalable, maintainable systems that extend existing PawTag architecture
4. **Business Sustainability**: Create profitable, self-sustaining revenue streams

### 1.3 Success Definition
PawTag becomes a trusted pet shopping destination where:
- Customers come for pet safety products and stay for pet commerce
- Loyalty program drives repeat purchases and engagement
- Business operates with <10% monthly overhead relative to revenue
- Technical systems require minimal ongoing maintenance

---

## 2. Strategic Approach & Phasing

### 2.1 Overall Strategy
**Additive Extension Model**: Build new capabilities as clean layers on top of existing, proven PawTag commerce infrastructure without modifying core logic.

### 2.2 Phasing Philosophy
- **Dependency-Driven**: Each phase builds on proven foundations from previous phases
- **Risk-Mitigated**: Early phases validate assumptions before major investments
- **Value-Focused**: Early delivery of customer-facing value to validate assumptions
- **Reversible**: Feature flags and modular design allow rollback if needed
- **Test-First**: Comprehensive testing at every stage

### 2.3 Master Phase Sequence
```
Phase 0: Reality Check & Foundation Audit      [COMPLETE]
Phase 1: Commerce Architecture & Domain Foundation
Phase 2: Supplier + Product Source Engine
Phase 3: Product Catalogue & Shop
Phase 4: Orders + Supplier Fulfilment
Phase 5: Affiliate Commerce
Phase 6: Guardian Loyalty Integration
Phase 7: Automation + Reconciliation
Phase 8: Admin + Analytics
Phase 9: SEO + Growth
Phase 10: Production Hardening
```

---

## 3. Current State Assessment

### 3.1 What's Production-Ready (Verified)
- Complete commerce engine (products, cart, checkout, orders, payments, invoices, refunds)
- Robust error handling with commerce-specific errors
- Server-side price validation (never trusts frontend)
- Idempotent order creation with retry logic
- Atomic inventory management with reservations
- Comprehensive audit logging system
- CMS-driven configuration with caching
- Provider interfaces for extensibility
- Background job infrastructure
- TypeScript strict mode throughout
- Consistent API patterns
- Frontend component library (@pawtag/ui)

### 3.2 What Requires Extension
- Supplier management (models, services, routes, UI)
- Product ownership tracking (PAWTAG_OWNED vs DROPSHIP vs AFFILIATE)
- Supplier product mapping
- Supplier order handling (splitting, forwarding, tracking)
- Product feed integration (XML/CSV/API)
- Automated sync infrastructure
- Affiliate tracking and attribution
- Loyalty points for commerce
- Supplier-specific shipping rules
- Multi-supplier cart handling
- Supplier performance analytics

### 3.3 Verified Technical Foundation
All extension patterns exist and are proven:
- ✅ CMS settings system (35+ settings with 60s cache)
- ✅ Provider interfaces (payment, shipping, tax, inventory)
- ✅ Audit logging (SHA-256 hash chain)
- ✅ RBAC system (roles → permissions → scopes)
- ✅ Background jobs (7 existing jobs)
- ✅ System logging (Pino → MongoDB)
- ✅ Frontend patterns (React/Vite/Tailwind)
- ✅ Testing infrastructure (77+ test files)

---

## 4. Detailed Phase Breakdown

### Phase 1: Commerce Architecture & Domain Foundation
**Objective**: Design target architecture and establish data models for supplier/product ownership

**Key Deliverables**:
- `docs/commerce/COMMERCE-ARCHITECTURE.md` - Technical architecture specification
- Enhanced Product model with commerceModel, supplierId, supplierPrice fields
- New Supplier, SupplierProduct, SupplierOrder models
- ISupplierProvider interface definition
- Supplier CRUD service skeleton
- Database migration scripts

**Dependencies**: Phase 0 complete
**Estimated Effort**: 1-2 weeks
**Exit Criteria**: Architecture document approved, data models defined

### Phase 2: Supplier + Product Source Engine
**Objective**: Build infrastructure for bringing external products into PawTag

**Key Deliverables**:
- SupplierService (CRUD operations)
- SupplierProductService (mapping and synchronization)
- Product feed parsers (XML/CSV/JSON)
- SupplierOrderService (order submission and tracking)
- Background job for product feed sync
- Admin supplier management UI
- Feed import/upload interface

**Dependencies**: Phase 1 complete
**Estimated Effort**: 2-3 weeks
**Exit Criteria**: Supplier onboarding workflow functional

### Phase 3: Product Catalogue & Shop
**Objective**: Enable customer-facing product discovery and shopping

**Key Deliverables**:
- Product search and filtering enhancements
- Supplier badges on product cards
- "Ships from NZ/AU/China" indicators
- Cross-sell recommendations
- Product reviews and ratings system
- Shop page enhancements for multi-source products

**Dependencies**: Phase 2 complete
**Estimated Effort**: 1-2 weeks
**Exit Criteria**: Customer can browse and filter products by source

### Phase 4: Orders + Supplier Fulfilment
**Objective**: Implement order splitting and supplier fulfilment engine

**Key Deliverables**:
- Order splitting logic (group items by supplier)
- Supplier order creation/submission service
- Tracking synchronization from suppliers
- Order detail enhancements for multi-supplier tracking
- Return routing to original supplier
- Supplier order management UI

**Dependencies**: Phase 3 complete
**Estimated Effort**: 2-3 weeks
**Exit Criteria**: Orders correctly split and forwarded to suppliers

### Phase 5: Affiliate Commerce
**Objective**: Implement affiliate tracking as another commerce source

**Key Deliverables**:
- AffiliateService (click tracking, conversion attribution)
- CommissionService (lifecycle management)
- Affiliate link generation
- Affiliate dashboard (clicks, conversions, commissions)
- Integration with existing referral system
- Affiliate payout management

**Dependencies**: Phase 4 complete
**Estimated Effort**: 2-3 weeks
**Exit Criteria**: Affiliate clicks and conversions tracked accurately

### Phase 6: Guardian Loyalty Integration
**Objective**: Extend loyalty program to reward commerce transactions

**Key Deliverables**:
- LoyaltyService (points calculation, awarding, redemption)
- LoyaltyPoint model
- Commerce-triggered points earning (purchases, reviews, etc.)
- Loyalty points display in customer portal
- Points redemption for discounts
- Loyalty points expiration and tier calculation

**Dependencies**: Phase 5 complete
**Estimated Effort**: 1-2 weeks
**Exit Criteria**: Customers earn and redeem loyalty points from commerce

### Phase 7: Automation + Reconciliation
**Objective**: Build comprehensive automation and monitoring

**Key Deliverables**:
- Background job for price/stock monitoring
- Background job for tracking synchronization
- Background job for commission reconciliation
- Background job for reorder alerts
- Job monitoring and alerting system
- Sync status dashboard
- Error handling and retry mechanisms

**Dependencies**: Phase 6 complete
**Estimated Effort**: 2-3 weeks
**Exit Criteria**: Key processes automated with monitoring

### Phase 8: Admin + Analytics
**Objective**: Complete admin capabilities and business intelligence

**Key Deliverables**:
- Supplier management admin pages
- Affiliate program management UI
- Loyalty program administration
- Commerce analytics dashboard
- Supplier performance reporting
- Commission tracking and reporting
- Inventory turnover analytics

**Dependencies**: Phase 7 complete
**Estimated Effort**: 2-3 weeks
**Exit Criteria**: Admin can manage all aspects of pet commerce

### Phase 9: SEO + Growth
**Objective**: Optimize for organic growth and customer acquisition

**Key Deliverables**:
- Product SEO optimization
- Category-level SEO
- Structured data implementation
- Sitemap generation for products
- Metadata optimization
- Content strategy implementation
- A/B testing framework
- Conversion rate optimization

**Dependencies**: Phase 8 complete
**Estimated Effort**: 1-2 weeks
**Exit Criteria**: Organic traffic growing steadily

### Phase 10: Production Hardening
**Objective**: Ensure production readiness and reliability

**Key Deliverables**:
- Security audit and hardening
- Performance optimization and load testing
- Comprehensive error handling
- Data backup and recovery procedures
- Disaster recovery plan
- Final documentation completion
- Knowledge transfer and training

**Dependencies**: Phase 9 complete
**Estimated Effort**: 2-3 weeks
**Exit Criteria**: System production-ready with monitoring

---

## 5. Dependencies & Critical Path

### 5.1 External Dependencies
| Dependency | Status | Risk Level | Mitigation |
|------------|--------|------------|------------|
| MongoDB Atlas | Existing | Low | Managed service, backups |
| Stripe API | Existing | Low | API keys managed via secrets |
| Resend Email | Existing | Low | API keys managed via secrets |
| Firebase Push | Existing | Low | API keys managed via secrets |
| Cloudflare R2 | Existing | Low | API keys managed via secrets |
| CJ Dropshipping API | Required | Medium | API key management, rate limiting |
| AliExpress API (via AutoDS) | Required | Medium | AutoDS subscription management |
| NZ Post API | Existing | Low | Already integrated |
| Photon Address API | Existing | Low | Free service |

### 5.2 Internal Dependencies (Critical Path)
```
Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7 → Phase 8 → Phase 9 → Phase 10
   ↓         ↓         ↓         ↓         ↓         ↓         ↓         ↓         ↓         ↓         ↓
Data Models   Services    API Routes  Frontend    Order Splitting Affiliate   Loyalty     Automation  Admin+Analytics SEO       Hardening
Supplier       Supplier   Supplier    Product     Logic          Tracking     Points      Jobs        Dashboards  Content     Security
               Product    Orders      Catalogue   (per supplier)  Sync         (commerce)  (feed/price)          (permissions)         (scans)       (pen testing)
```

### 5.3 Blocking Dependencies
- **Phase 1 cannot start** without Phase 0 audit completion (achieved)
- **Phase 2 cannot start** without Supplier data models defined (Phase 1)
- **Phase 3 cannot start** without SupplierProduct mapping functional (Phase 2)
- **Phase 4 cannot start** without order splitting logic (Phase 3)
- **Phase 5 cannot start** without affiliate tracking foundation (Phase 4)
- **Phase 6 cannot start** without commerce loyalty points foundation (Phase 5)
- **Phase 7 cannot start** without core automation infrastructure (Phase 6)
- **Phase 8 cannot start** without admin UI foundations (Phase 7)
- **Phase 9 cannot start** without analytics data pipelines (Phase 8)
- **Phase 10 cannot start** without all customer-facing features complete (Phase 9)

---

## 6. Resource Allocation & Timeline

### 6.1 Resource Model
- **Primary Resource**: Solo developer (technical implementation)
- **Support Resources**: 
  - AI assistance (code generation, testing, documentation)
  - Business owner (requirements, decisions, validation)
  - Supplier relationship management (outsourced or part-time)
  - Legal/Accounting (as needed for setup and compliance)

### 6.2 Effort Distribution
| Phase | Effort (weeks) | Primary Focus | AI Assistance Value |
|-------|----------------|---------------|---------------------|
| Phase 1 | 1-2 | Data models, interfaces | High (boilerplate generation) |
| Phase 2 | 2-3 | Service logic, parsers | High (API integration patterns) |
| Phase 3 | 1-2 | UI components, features | Medium (component patterns) |
| Phase 4 | 2-3 | Order logic, splitting | High (complex business logic) |
| Phase 5 | 2-3 | Tracking, attribution | Medium (integration patterns) |
| Phase 6 | 1-2 | Points calculation, redemption | Medium (business rules) |
| Phase 7 | 2-3 | Job infrastructure, monitoring | High (retry logic, monitoring) |
| Phase 8 | 2-3 | Admin UI, dashboards | Medium (CRUD patterns) |
| Phase 9 | 1-2 | SEO, content, testing | Low (mostly implementation) |
| Phase 10| 2-3 | Security, performance, docs | Low (review and hardening) |
| **Total** | **16-24 weeks** | | |

### 6.3 Timeline Estimates
| Metric | Estimate | Notes |
|--------|----------|-------|
| **Start Date** | Upon approval |  |
| **Phase 1 Completion** | Week 2-3 |  |
| **Phase 2 Completion** | Week 4-6 |  |
| **Phase 3 Completion** | Week 7-8 |  |
| **Phase 4 Completion** | Week 9-12 |  |
| **Phase 5 Completion** | Week 11-15 |  |
| **Phase 6 Completion** | Week 12-17 |  |
| **Phase 7 Completion** | Week 14-20 |  |
| **Phase 8 Completion** | Week 16-22 |  |
| **Phase 9 Completion** | Week 17-24 |  |
| **Phase 10 Completion** | Week 19-26 |  |
| **Total Duration** | 4-6 months | Depending on effort allocation |
| **Earliest Possible Completion** | ~4 months | If working full-time efficiently |
| **Realistic Completion** | ~5-6 months | Accounting for business decisions, supplier negotiations, etc. |

### 6.4 Milestone Tracking
| Milestone | Target Completion | Success Indicator |
|-----------|-------------------|-------------------|
| **Phase 1 Complete** | Week 2-3 | Architecture approved, data models defined |
| **First Supplier Onboarded** | Week 4-6 | At least one supplier successfully integrated |
| **First Customer Purchase** | Week 7-9 | First commerce transaction completed |
| **Affiliate Program Live** | Week 10-12 | First affiliate click tracked |
| **Loyalty Points Active** | Week 12-14 | Customers earning/redeeming points |
| **Full Automation** | Week 15-18 | Key processes running without manual intervention |
| **Admin Functionality Complete** | Week 17-20 | Admin can manage all commerce aspects |
| **SEO Foundations Laid** | Week 18-22 | Basic SEO implemented, tracking in place |
| **Production Ready** | Week 20-26 | System hardened, monitored, documented |

---

## 7. Risk Management & Mitigation

### 7.1 Technical Risks
| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|---------------------|
| Supplier API instability | Medium | High | Retry logic, circuit breaker, fallback to manual |
| Feed parsing failures | High | Medium | Validation, error queues, manual review |
| Order splitting complexity | Low | High | Start simple, iterate based on actual needs |
| Data consistency issues | Low | High | Idempotent operations, audit trails, reconciliation jobs |
| Performance degradation | Low | Medium | Caching, pagination, background jobs, monitoring |
| Security vulnerabilities | Low | High | Regular audits, penetration testing, code reviews |
| Integration complexity | Medium | Medium | Provider abstraction layer, clear contracts |

### 7.2 Business Risks
| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|---------------------|
| Supplier reliability issues | Medium | High | Multiple suppliers, performance SLAs, backup options |
| Margin erosion | Medium | Medium | Dynamic pricing, supplier negotiation, volume discounts |
| Customer acquisition cost too high | Medium | High | Organic growth focus, referral program optimization |
| Low customer adoption | Medium | High | MVP approach, early feedback loops, iterative improvement |
| Regulatory/compliance issues | Low | High | Early legal consultation, NZ-specific compliance |
| Technical debt accumulation | Medium | Medium | Regular refactoring, tech debt tracking, definition of done |

### 7.3 Resource Risks
| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|---------------------|
| Solo developer bandwidth | High | High | Phased approach, AI assistance, prioritization, MVP focus |
| Supplier onboarding delays | Medium | Medium | Standardized process, templates, parallel processing |
| Business decision delays | Medium | Medium | Decision frameworks, timeboxing, escalation paths |
| Knowledge transfer gaps | Low | Medium | Documentation throughout, video recordings, pairing sessions |
| Testing insufficiency | Medium | Medium | Test-first approach, CI/CD, automated regression suites |

### 7.4 Monitoring & Early Warning System
- **Weekly**: Progress review vs. plan, blocker identification
- **Bi-weekly**: Demo/stakeholder review, feedback collection
- **Monthly**: KPI review, risk reassessment, plan adjustment
- **Continuous**: Error rates, performance metrics, security alerts
- **Milestone-based**: Formal reviews, go/no-go decisions

---

## 8. Success Criteria & Metrics

### 8.1 Phase Completion Criteria
Each phase must achieve:
- ✅ Implemented and tested code
- ✅ Updated documentation (referencing Master Plan)
- ✅ DESIGN.md updates if required
- ✅ Passing unit and integration tests
- ✅ Passing type checking
- ✅ Descriptive git commit with push to GitHub
- ✅ Demo/stakeholder review and approval

### 8.2 Overall Success Metrics (Year 1 Targets)
| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Products listed | 500+ | Product catalog count |
| Monthly orders | 200+ | Order system count |
| Average order value | $70+ | Revenue / Orders |
| Gross margin | 40%+ | (Revenue - COGS) / Revenue |
| Customer satisfaction | 4.5+ stars | Post-purchase surveys |
| Return rate | < 5% | Returns / Orders |
| Shipping time (NZ) | < 5 days | Delivery confirmation timestamps |
| Supplier sync success rate | > 99% | Successful syncs / Total attempts |
| Order fulfilment accuracy | > 99% | Correctly shipped orders / Total |
| Commission tracking accuracy | 100% | Tracked vs. actual commissions |
| System uptime | > 99.5% | Monitoring system reports |
| Error rate | < 0.1% | Error logs / Total requests |
| Page load time | < 3s | Performance monitoring |
| Conversion rate | > 2% | Orders / Cart initiations |
| Customer retention | > 60% | Repeat customers / Total customers |

### 8.3 Loyalty-Specific Metrics
| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Guardian→Gold upgrade rate | >15% within 12 months | Subscription system |
| Repeat purchase rate (Guardian) | >60% quarterly | Order system |
| AOV lift (Guardian vs non-member) | >25% | Order system comparison |
| PawRewards redemption rate | >70% | Loyalty system |
| LTV (Guardian) | >$150 | Revenue cohort analysis |
| LTV (Gold) | >$300 | Revenue cohort analysis |
| LTV:CAC | >3:1 | Marketing spend vs. LTV |
| CAC payback | <6 months | Marketing spend analysis |
| Points earning engagement | >40% of users | Loyalty system activity |
| Points redemption rate | >50% of earned points | Loyalty system |

### 8.4 Technical Health Metrics
| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Test coverage | >80% | Coverage reports |
| Build success rate | 100% | CI/CD pipeline |
| Type checking success | 100% | TypeScript compiler |
| Dependency vulnerabilities | 0 | Security scanning |
| Code maintainability | < Tech debt threshold | Static analysis |
| Documentation completeness | 100% | Documentation audit |
| On-call burden | < 2 alerts/week | Monitoring system |

---

## 9. Governance & Reporting

### 9.1 Decision Making Framework
| Decision Type | Decision Maker | Input Required | Escalation Path |
|---------------|----------------|----------------|-----------------|
| Technical implementation | Lead Developer | Technical research, AI assistance | Business Owner for trade-offs |
| Business model/pricing | Business Owner | Market research, financial analysis | N/A (final authority) |
| UI/UX design | Lead Developer | User research, best practices | Business Officer for final approval |
| Resource allocation | Lead Developer | Progress, blockers, estimates | Business Owner for approval |
| Go/No-Go decisions | Joint | Phase completion criteria, risk assessment | N/A (joint decision) |
| Scope changes | Business Owner | Impact analysis, alternatives | Lead Developer for feasibility |

### 9.2 Reporting Cadence
| Frequency | Format | Audience | Content |
|-----------|--------|----------|---------|
| Daily | Standup notes | Implementation team | What was done, what's next, blockers |
| Weekly | Progress report | Business Owner, Stakeholders | Phase progress, metrics, risks, decisions needed |
| Bi-weekly | Demo/review | Business Owner, Stakeholders | Working software, feedback collection |
| Monthly | Executive summary | Business Owner, Investors | KPIs, financials, risks, next month plan |
| Quarterly | Strategic review | Business Owner, Board | Strategic alignment, major decisions, course correction |
| Ad-hoc | Incident report | All stakeholders | Issues, resolution, lessons learned |

### 9.3 Issue Tracking & Escalation
- **Level 1 (Team)**: Day-to-day blocking issues resolved within 1 day
- **Level 2 (Lead)**: Technical or resource issues requiring escalation, resolved within 3 days
- **Level 3 (Business)**: Strategic or blocking issues requiring business decision, resolved within 1 week
- **Level 4 (Executive)**: Major risks or opportunities requiring executive decision, resolved as needed
- All issues tracked in centralized system with SLA monitoring

---

## 10. Documentation Map & Relationships

### 10.1 Master Plan Centrality
This Master Plan document serves as the **Single Source of Truth** for:
- Overall project strategy and phasing
- Resource allocation and timeline
- Dependencies and critical path
- Risk management and monitoring
- Success criteria and metrics
- Governance and reporting structure
- Phase completion and exit requirements

### 10.2 Reference Document Hierarchy
All detailed documents should:
1. Reference this Master Plan in their frontmatter or introduction
2. Explain their specific role in the overall project
3. Link back to relevant sections of this Master Plan
4. Contain only their domain-specific detailed information
5. Avoid duplicating strategy, planning, or tracking information

### 10.3 Reference Documents & Their Roles

| Document | Purpose | Relationship to Master Plan |
|----------|---------|-----------------------------|
| **SUBSCRIPTION-AUDIT.md** | Detailed analysis of existing subscription system, market research, loyalty program design, and implementation roadmap for loyalty enhancements | Details Phase 6 (Guardian Loyalty Integration) specifics; references Master Plan for overall context and timing |
| **PET-COMMERCE-DISCOVERY.md** | Comprehensive discovery, code audit, business model research, and architecture recommendation for pet commerce expansion | Details Phases 1-5 (commerce foundation through affiliate commerce); references Master Plan for overall context and timing |
| **COMMERCE-CURRENT-STATE.md** | Technical reality check and codebase audit of existing commerce foundation | Supports Phase 0 completion and informs Phase 1 planning; references Master Plan for overall context |
| **COMMERCE-GAP-ANALYSIS.md** | Gap analysis and implementation requirements for pet commerce expansion | Details gaps to be filled in Phases 1-5; references Master Plan for overall context and prioritization |
| **architecture.md** | Technical architecture of PawTag Commerce module | Provides technical foundation for all commerce-related phases; references Master Plan for implementation context |
| **current-state-baseline.md** | Documentation of PawTag's current commerce state pre-migration | Provides historical context; references Master Plan for evolution context |
| **implementation-roadmap.md** | Completed implementation roadmap for the commerce migration | Provides historical reference for approach; references Master Plan for future work context |

### 10.4 Documentation Update Requirements
After Master Plan approval, each reference document should be updated to include:

**Frontmatter Addition**:
```
> **Master Plan Reference:** See [PawTag Master Project Plan](#) for overall project strategy, phasing, and tracking
> **Phase Association:** This document details [specific phase/component] as part of the overall project
> **Last Updated:** [Date] - Updated to reference Master Plan
```

**Introduction Section**:
```
This document provides [specific details] for [specific aspect] of the PawTag Pet Commerce and Loyalty Enhancement project.

For overall project strategy, phasing, resource allocation, timeline, dependencies, risk management, and governance, please refer to the [PawTag Master Project Plan](#).

This document should be read in conjunction with the Master Plan to understand how this specific component fits into the broader project context.
```

---

## 11. Appendix: Reference Documents

### 11.1 Core Reference Documents
1. **SUBSCRIPTION-AUDIT.md** - Loyalty system deep dive (Sections 1-25 of the loyalty audit)
2. **PET-COMMERCE-DISCOVERY.md** - Commerce discovery report (Sections 1-26 of the commerce discovery)
3. **COMMERCE-CURRENT-STATE.md** - Commerce foundation audit
4. **COMMERCE-GAP-ANALYSIS.md** - Commerce gap analysis
5. **architecture.md** - Commerce module technical architecture
6. **current-state-baseline.md** - Pre-migration commerce state documentation
7. **implementation-roadmap.md** - Completed commerce migration roadmap

### 11.2 Key Sections for Reference
When consulting these documents for implementation:

**From SUBSCRIPTION-AUDIT.md**:
- Sections 15-16: Recommended Guardian Model and Points System
- Sections 17-18: Tier Structure & Benefits and PawRewards
- Sections 19-21: Customer Psychology, Gamification, and Financial Analysis
- Sections 22-25: Rules & Edge Cases, Customer Research Plan, Marketing Strategy
- Section 26: Implementation Roadmap (Phases 1-6)

**From PET-COMMERCE-DISCOVERY.md**:
- Sections 11-17: Business Model Research and Supplier Discovery
- Sections 18-20: Profitability and Product Category Strategy
- Sections 21-24: Customer Experience, Guardian Loyalty Integration, SEO & Content
- Sections 25-26: Final Recommendation and Implementation Roadmap
- Appendices 27-29: Full database, API route, and frontend inventories

**From COMMERCE-CURRENT-STATE.md**:
- Sections 18-19: Audit Findings Summary and Conclusion
- Provides the validated baseline for extension work

**From COMMERCE-GAP-ANALYSIS.md**:
- Sections 2-3: Gap Categories Overview and Detailed Gap Analysis
- Sections 6-7: Risk Assessment and Recommendations
- Provides the validated gap list for implementation work

---

*This Master Plan document serves as the central source of truth for the PawTag Pet Commerce and Loyalty Enhancement project. All detailed domain documents should reference this plan and explain their specific relationship to the overall project strategy and tracking.* 

--- 

*Last updated: September 2026* 
*Status: Active - Central Source of Truth* 
*Next review: Upon completion of each major phase or as required by significant changes* 
