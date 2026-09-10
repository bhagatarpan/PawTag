/**
 * @module API Endpoints
 * @description Centralized API endpoint definitions for the entire PawTag codebase.
 *
 * Every API path used by any frontend app (web, admin, finder, mobile) is defined here.
 * Endpoint functions accept parameters and return the full path string.
 *
 * Convention:
 * - Static paths are string constants: `login: '/auth/login'`
 * - Dynamic paths are functions: `get: (id: string) => \`/admin/users/${id}\``
 * - All paths are relative to the API base URL (typically `/api`)
 *
 * @example
 * ```typescript
 * import { API } from '@pawtag/shared/api';
 * api.get(API.admin.users.list);
 * api.get(API.admin.users.get('123'));
 * ```
 */

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export const API = {
  auth: {
    login: '/auth/login',
    register: '/auth/register',
    me: '/auth/me',
    refresh: '/auth/refresh',
    captcha: '/auth/captcha',
    forgotPassword: '/auth/forgot-password',
    resetPassword: '/auth/reset-password',
    verifyEmail: '/auth/verify-email',
    verificationStatus: '/auth/verification-status',
    resendEmailVerification: '/auth/resend-email-verification',
    sendPhoneOtp: '/auth/send-phone-otp',
    verifyPhone: '/auth/verify-phone',
    resendPhoneOtp: '/auth/resend-phone-otp',
    profile: '/auth/profile',
    changePassword: '/auth/change-password',
    deleteAccount: '/auth/account',
    mfa: {
      sendOtp: '/auth/mfa/send-otp',
      verify: '/auth/mfa/verify',
    },
  },

  // ---------------------------------------------------------------------------
  // Admin — Users
  // ---------------------------------------------------------------------------
  admin: {
    users: {
      list: '/admin/users',
      get: (id: string) => `/admin/users/${id}` as const,
      update: (id: string) => `/admin/users/${id}` as const,
      delete: (id: string) => `/admin/users/${id}` as const,
      resetPassword: (id: string) => `/admin/users/${id}/reset-password` as const,
      lock: (id: string) => `/admin/users/${id}/lock` as const,
      unlock: (id: string) => `/admin/users/${id}/unlock` as const,
      setRole: (id: string) => `/admin/users/${id}/role` as const,
      setStatus: (id: string) => `/admin/users/${id}/status` as const,
      skipInvoiceOtp: (id: string) => `/admin/users/${id}/skip-invoice-otp` as const,
      orders: (id: string) => `/admin/users/${id}/orders` as const,
      subscriptions: (id: string) => `/admin/users/${id}/subscriptions` as const,
      referrals: (id: string) => `/admin/users/${id}/referrals` as const,
    },

    // ---------------------------------------------------------------------------
    // Admin — RBAC
    // ---------------------------------------------------------------------------
    rbac: {
      roles: {
        list: '/admin/rbac/roles',
        create: '/admin/rbac/roles',
        update: (id: string) => `/admin/rbac/roles/${id}` as const,
        delete: (id: string) => `/admin/rbac/roles/${id}` as const,
        clone: (id: string) => `/admin/rbac/roles/${id}/clone` as const,
        permissions: {
          list: (id: string) => `/admin/rbac/roles/${id}/permissions` as const,
          set: (id: string) => `/admin/rbac/roles/${id}/permissions` as const,
          remove: (roleId: string, permId: string) => `/admin/rbac/roles/${roleId}/permissions/${permId}` as const,
        },
      },
      permissions: {
        list: '/admin/rbac/permissions',
        create: '/admin/rbac/permissions',
        update: (id: string) => `/admin/rbac/permissions/${id}` as const,
        delete: (id: string) => `/admin/rbac/permissions/${id}` as const,
      },
      permissionGroups: {
        list: '/admin/rbac/permission-groups',
        create: '/admin/rbac/permission-groups',
        update: (id: string) => `/admin/rbac/permission-groups/${id}` as const,
        delete: (id: string) => `/admin/rbac/permission-groups/${id}` as const,
      },
      scopes: {
        list: '/admin/rbac/scopes',
        create: '/admin/rbac/scopes',
        update: (id: string) => `/admin/rbac/scopes/${id}` as const,
        delete: (id: string) => `/admin/rbac/scopes/${id}` as const,
      },
      effectivePermissions: (id: string) => `/admin/rbac/users/${id}/effective-permissions` as const,
    },

    // ---------------------------------------------------------------------------
    // Admin — Pets
    // ---------------------------------------------------------------------------
    pets: {
      list: '/admin/pets',
      create: '/admin/pets',
      get: (id: string) => `/admin/pets/${id}` as const,
      update: (id: string) => `/admin/pets/${id}` as const,
      setStatus: (id: string) => `/admin/pets/${id}/status` as const,
      delete: (id: string) => `/admin/pets/${id}` as const,
    },

    // ---------------------------------------------------------------------------
    // Admin — Tags
    // ---------------------------------------------------------------------------
    tags: {
      list: '/admin/tags',
      create: '/admin/tags',
      get: (id: string) => `/admin/tags/${id}` as const,
      update: (id: string) => `/admin/tags/${id}` as const,
      delete: (id: string) => `/admin/tags/${id}` as const,
      qrBulk: '/admin/tags/qr-bulk',
    },

    // ---------------------------------------------------------------------------
    // Admin — Products
    // ---------------------------------------------------------------------------
    products: {
      list: '/admin/products',
      create: '/admin/products',
      update: (id: string) => `/admin/products/${id}` as const,
      delete: (id: string) => `/admin/products/${id}` as const,
    },

    // ---------------------------------------------------------------------------
    // Admin — Orders
    // ---------------------------------------------------------------------------
    orders: {
      list: '/admin/orders',
      setStatus: (id: string) => `/admin/orders/${id}/status` as const,
      createShipment: (id: string) => `/admin/orders/${id}/create-shipment` as const,
      markDelivered: (id: string) => `/admin/orders/${id}/mark-delivered` as const,
      action: (id: string, action: string) => `/admin/orders/${id}/${action}` as const,
    },

    // ---------------------------------------------------------------------------
    // Admin — Invoices
    // ---------------------------------------------------------------------------
    invoices: {
      view: (id: string) => `/admin/invoices/${id}/view` as const,
      email: (id: string) => `/admin/invoices/${id}/email` as const,
      print: (id: string) => `/admin/invoices/${id}/print` as const,
    },

    // ---------------------------------------------------------------------------
    // Admin — Subscriptions
    // ---------------------------------------------------------------------------
    subscriptions: {
      list: '/admin/subscriptions',
      stats: '/admin/subscriptions/stats',
      get: (id: string) => `/admin/subscriptions/${id}` as const,
      setStatus: (id: string) => `/admin/subscriptions/${id}/status` as const,
      extend: (id: string) => `/admin/subscriptions/${id}/extend` as const,
    },

    // ---------------------------------------------------------------------------
    // Admin — Commerce
    // ---------------------------------------------------------------------------
    commerce: {
      settings: '/admin/commerce/settings',
      cancellationReasons: '/admin/commerce/cancellation-reasons',
      accounting: {
        status: '/admin/commerce/accounting/status',
        connectXero: '/admin/commerce/accounting/connect/xero',
        disconnectXero: '/admin/commerce/accounting/disconnect/xero',
      },
      orders: '/admin/commerce/orders',
      products: '/admin/commerce/products',
      reorderProducts: '/admin/commerce/products/reorder',
      inventory: {
        movements: (id: string) => `/admin/commerce/inventory/${id}/movements` as const,
        adjust: (id: string) => `/admin/commerce/inventory/${id}/adjust` as const,
      },
      invoices: '/admin/commerce/invoices',
      categories: {
        list: '/admin/commerce/categories',
        create: '/admin/commerce/categories',
        update: (id: string) => `/admin/commerce/categories/${id}` as const,
        delete: (id: string) => `/admin/commerce/categories/${id}` as const,
      },
      collections: {
        list: '/admin/commerce/collections',
        create: '/admin/commerce/collections',
        update: (id: string) => `/admin/commerce/collections/${id}` as const,
        delete: (id: string) => `/admin/commerce/collections/${id}` as const,
      },
      brands: {
        list: '/admin/commerce/brands',
        create: '/admin/commerce/brands',
        update: (id: string) => `/admin/commerce/brands/${id}` as const,
        delete: (id: string) => `/admin/commerce/brands/${id}` as const,
      },
      promoCodes: {
        list: '/admin/commerce/promo-codes',
        create: '/admin/commerce/promo-codes',
        update: (id: string) => `/admin/commerce/promo-codes/${id}` as const,
        delete: (id: string) => `/admin/commerce/promo-codes/${id}` as const,
      },
      shippingMethods: {
        list: '/admin/commerce/shipping-methods',
        create: '/admin/commerce/shipping-methods',
        update: (id: string) => `/admin/commerce/shipping-methods/${id}` as const,
        delete: (id: string) => `/admin/commerce/shipping-methods/${id}` as const,
      },
      fulfilments: {
        list: '/admin/commerce/fulfilments',
        setStatus: (id: string) => `/admin/commerce/fulfilments/${id}/status` as const,
      },
      shipments: {
        list: '/admin/commerce/shipments',
        tracking: (id: string) => `/admin/commerce/shipments/${id}/tracking` as const,
        setStatus: (id: string) => `/admin/commerce/shipments/${id}/status` as const,
        pollTracking: '/admin/commerce/shipments/poll-tracking',
      },
      returns: {
        list: '/admin/commerce/returns',
        setStatus: (id: string) => `/admin/commerce/returns/${id}/status` as const,
      },
      payments: {
        reconciliation: '/admin/commerce/payments/reconciliation',
      },
      refunds: {
        list: '/admin/commerce/refunds',
        export: '/admin/commerce/refunds/export',
        sync: (id: string) => `/admin/commerce/refunds/${id}/sync` as const,
        retry: (id: string) => `/admin/commerce/refunds/${id}/retry` as const,
        reconcile: '/admin/commerce/refunds/reconcile',
      },
    },

    // ---------------------------------------------------------------------------
    // Admin — Analytics & Stats
    // ---------------------------------------------------------------------------
    analytics: {
      overview: '/admin/analytics/overview',
    },
    stats: {
      lostFound: '/admin/stats/lost-found',
    },

    // ---------------------------------------------------------------------------
    // Admin — Notifications
    // ---------------------------------------------------------------------------
    notifications: {
      list: '/admin/notifications',
      unreadCount: '/admin/notifications/unread-count',
      markRead: (id: string) => `/admin/notifications/${id}/read` as const,
      markAllRead: '/admin/notifications/mark-all-read',
    },

    // ---------------------------------------------------------------------------
    // Admin — CMS
    // ---------------------------------------------------------------------------
    cms: {
      pages: {
        list: '/admin/cms/pages',
        create: '/admin/cms/pages',
        get: (id: string) => `/admin/cms/pages/${id}` as const,
        update: (id: string) => `/admin/cms/pages/${id}` as const,
        publish: (id: string) => `/admin/cms/pages/${id}/publish` as const,
        delete: (id: string) => `/admin/cms/pages/${id}` as const,
      },
      navigation: {
        list: '/admin/cms/navigation',
        create: '/admin/cms/navigation',
        update: (id: string) => `/admin/cms/navigation/${id}` as const,
        delete: (id: string) => `/admin/cms/navigation/${id}` as const,
      },
      footer: {
        list: '/admin/cms/footer',
        create: '/admin/cms/footer',
        update: (id: string) => `/admin/cms/footer/${id}` as const,
        delete: (id: string) => `/admin/cms/footer/${id}` as const,
      },
      homepage: {
        list: '/admin/cms/homepage',
        create: '/admin/cms/homepage',
        update: (id: string) => `/admin/cms/homepage/${id}` as const,
        toggle: (id: string) => `/admin/cms/homepage/${id}/toggle` as const,
        delete: (id: string) => `/admin/cms/homepage/${id}` as const,
      },
      announcements: {
        list: '/admin/cms/announcements',
        create: '/admin/cms/announcements',
        update: (id: string) => `/admin/cms/announcements/${id}` as const,
        delete: (id: string) => `/admin/cms/announcements/${id}` as const,
      },
      onboarding: {
        get: '/admin/cms/onboarding',
        update: '/admin/cms/onboarding',
      },
      emailTemplates: {
        list: '/admin/cms/email/email-templates',
        getInvoiceTemplate: '/admin/cms/email/email-templates/slug/invoice-template',
        create: '/admin/cms/email/email-templates',
        update: (id: string) => `/admin/cms/email/email-templates/${id}` as const,
        delete: (id: string) => `/admin/cms/email/email-templates/${id}` as const,
      },
      smsTemplates: {
        list: '/admin/cms/sms/sms-templates',
        create: '/admin/cms/sms/sms-templates',
        update: (id: string) => `/admin/cms/sms/sms-templates/${id}` as const,
        delete: (id: string) => `/admin/cms/sms/sms-templates/${id}` as const,
      },
      media: {
        list: '/admin/cms/media',
        upload: '/admin/cms/media/upload',
        update: (id: string) => `/admin/cms/media/${id}` as const,
        delete: (id: string) => `/admin/cms/media/${id}` as const,
      },
      shopPages: {
        list: '/admin/cms/shop-pages',
        create: '/admin/cms/shop-pages',
        update: (id: string) => `/admin/cms/shop-pages/${id}` as const,
        delete: (id: string) => `/admin/cms/shop-pages/${id}` as const,
      },
      authPages: {
        list: '/admin/cms/auth-pages',
        update: (id: string) => `/admin/cms/auth-pages/${id}` as const,
      },
      petReferences: {
        list: '/admin/cms/pet-refs/pet-references',
        create: '/admin/cms/pet-refs/pet-references',
        update: (id: string) => `/admin/cms/pet-refs/pet-references/${id}` as const,
        delete: (id: string) => `/admin/cms/pet-refs/pet-references/${id}` as const,
        bulk: '/admin/cms/pet-refs/pet-references/bulk',
      },
      redirects: {
        list: '/admin/cms/redirects',
        create: '/admin/cms/redirects',
        update: (id: string) => `/admin/cms/redirects/${id}` as const,
        delete: (id: string) => `/admin/cms/redirects/${id}` as const,
      },
    },

    // ---------------------------------------------------------------------------
    // Admin — Guardian Loyalty
    // ---------------------------------------------------------------------------
    guardian: {
      stats: '/admin/guardian/stats',
      activity: '/admin/guardian/activity',
      members: '/admin/guardian/members',
      settings: '/admin/guardian/settings',
    },

    // ---------------------------------------------------------------------------
    // Admin — Audit
    // ---------------------------------------------------------------------------
    audit: {
      list: '/admin/audit',
      summary: '/admin/audit/summary',
      verifyChain: '/admin/audit/verify-chain',
      export: '/admin/audit/export',
      purge: '/admin/audit/purge',
      settings: {
        get: '/admin/audit/settings',
        update: (kind: string, key: string) => `/admin/audit/settings/${kind}/${key}` as const,
        updateCategory: (key: string) => `/admin/audit/settings/category/${key}` as const,
        updateActor: (key: string) => `/admin/audit/settings/actor/${key}` as const,
      },
      entity: (type: string, id: string) => `/admin/audit/entity/${type}/${id}` as const,
      transaction: (id: string) => `/admin/audit/transaction/${id}` as const,
      correlation: (id: string) => `/admin/audit/correlation/${id}` as const,
    },

    // ---------------------------------------------------------------------------
    // Admin — Feature Flags
    // ---------------------------------------------------------------------------
    featureFlags: {
      toggle: (key: string) => `/admin/feature-flags/${key}` as const,
      create: '/admin/feature-flags',
      delete: (key: string) => `/admin/feature-flags/${key}` as const,
    },

    // ---------------------------------------------------------------------------
    // Admin — Settings
    // ---------------------------------------------------------------------------
    settings: {
      list: '/admin/settings',
      get: (key: string) => `/admin/settings/${key}` as const,
      update: (key: string) => `/admin/settings/${key}` as const,
      create: '/admin/settings',
      delete: (key: string) => `/admin/settings/${key}` as const,
    },

    // ---------------------------------------------------------------------------
    // Admin — Site Availability
    // ---------------------------------------------------------------------------
    siteAvailability: {
      status: '/admin/site-availability/status',
    },

    // ---------------------------------------------------------------------------
    // Admin — Webhooks
    // ---------------------------------------------------------------------------
    webhooks: {
      status: '/admin/webhooks/status',
      deadLetter: '/admin/webhooks/dead-letter',
      action: (action: string) => `/admin/webhooks/${action}` as const,
      retry: (eventId: string) => `/admin/webhooks/retry/${eventId}` as const,
      retryAll: '/admin/webhooks/retry-all',
      deleteDeadLetter: '/admin/webhooks/dead-letter',
      settings: '/admin/webhooks/settings',
    },

    // ---------------------------------------------------------------------------
    // Admin — System Logs
    // ---------------------------------------------------------------------------
    systemLogs: {
      list: '/admin/system-logs',
      summary: '/admin/system-logs/summary',
      export: '/admin/system-logs/export',
      request: (id: string) => `/admin/system-logs/request/${id}` as const,
      purge: '/admin/system-logs/purge',
      settings: {
        get: '/admin/system-logs/settings',
        update: (key: string) => `/admin/system-logs/settings/${key}` as const,
      },
    },

    // ---------------------------------------------------------------------------
    // Admin — Tag Expiry Notifications
    // ---------------------------------------------------------------------------
    tagExpiryNotifications: {
      list: '/admin/tag-expiry-notifications',
      stats: '/admin/tag-expiry-notifications/stats',
      acknowledge: (id: string) => `/admin/tag-expiry-notifications/${id}/acknowledge` as const,
    },

    // ---------------------------------------------------------------------------
    // Admin — Support Requests
    // ---------------------------------------------------------------------------
    supportRequests: {
      list: '/admin/support-requests',
      resolve: (id: string) => `/admin/support-requests/${id}/resolve` as const,
    },

    // ---------------------------------------------------------------------------
    // Admin — Referrals
    // ---------------------------------------------------------------------------
    referrals: {
      list: '/admin/referrals',
      stats: '/admin/referrals/stats',
    },
  },

  // ---------------------------------------------------------------------------
  // Customer
  // ---------------------------------------------------------------------------
  customer: {
    pets: {
      list: '/customer/pets',
      create: '/customer/pets',
      update: (id: string) => `/customer/pets/${id}` as const,
      delete: (id: string) => `/customer/pets/${id}` as const,
      foundTimer: (id: string) => `/customer/pets/${id}/found-timer` as const,
      markLost: (id: string) => `/customer/pets/${id}/mark-lost` as const,
      markFound: (id: string) => `/customer/pets/${id}/mark-found` as const,
      markTerminal: (id: string) => `/customer/pets/${id}/mark-terminal` as const,
      section: (id: string, section: string) => `/customer/pets/${id}/${section}` as const,
      sectionItem: (id: string, section: string, subId: string) => `/customer/pets/${id}/${section}/${subId}` as const,
      desexing: (id: string) => `/customer/pets/${id}/desexing` as const,
    },
    orders: {
      list: '/customer/orders',
      get: (id: string) => `/customer/orders/${id}` as const,
      invoice: (id: string) => `/customer/orders/${id}/invoice` as const,
      cancel: (id: string) => `/customer/returns/orders/${id}/cancel` as const,
    },
    returns: {
      create: '/customer/returns',
    },
    subscriptions: {
      list: '/customer/subscriptions',
      get: (id: string) => `/customer/subscriptions/${id}` as const,
      invoices: (id: string) => `/customer/subscriptions/${id}/invoices` as const,
      renew: (id: string) => `/customer/subscriptions/${id}/renew` as const,
      cancel: (id: string) => `/customer/subscriptions/${id}/cancel` as const,
      autoRenew: (id: string) => `/customer/subscriptions/${id}/auto-renew` as const,
      changePlan: (id: string) => `/customer/subscriptions/${id}/change-plan` as const,
      goldSubscribe: '/customer/subscriptions/gold/subscribe',
    },
    guardian: {
      points: '/customer/guardian/points',
      pointsHistory: '/customer/guardian/points/history',
      rewards: '/customer/guardian/rewards',
      rewardsHistory: '/customer/guardian/rewards/history',
      redeemRewards: '/customer/guardian/rewards/redeem',
      tier: '/customer/guardian/tier',
      history: '/customer/guardian/history',
      benefits: '/customer/guardian/benefits',
      activity: '/customer/guardian/activity',
    },
    escalations: {
      list: '/customer/escalations',
      resolve: (id: string) => `/customer/escalations/${id}/resolve` as const,
      forward: (id: string) => `/customer/escalations/${id}/forward` as const,
    },
    notifications: {
      list: '/customer/notifications',
      unreadCount: '/customer/notifications/unread-count',
      markRead: (id: string) => `/customer/notifications/${id}/read` as const,
      markAllRead: '/customer/notifications/mark-all-read',
      clearRead: '/customer/notifications/clear-read',
    },
    notificationPreferences: {
      get: '/customer/notification-preferences',
      update: '/customer/notification-preferences',
    },
    referral: {
      get: '/customer/referral',
      stats: '/customer/referral/stats',
      history: '/customer/referral/history',
      referredBy: '/customer/referral/referred-by',
    },
    tags: {
      list: '/customer/tags',
      unredeemedCount: '/customer/tags/unredeemed-count',
      redeem: '/customer/tags/redeem',
    },
    invoices: {
      access: (id: string) => `/customer/invoices/${id}/access` as const,
    },
    settings: {
      mfa: {
        get: '/customer/settings/mfa',
        update: '/customer/settings/mfa',
      },
      finderPrivacy: {
        get: '/customer/settings/finder-privacy',
        update: '/customer/settings/finder-privacy',
      },
      onboardingComplete: '/customer/settings/onboarding-complete',
      onboardingSkip: '/customer/settings/onboarding-skip',
      onboardingDismiss: '/customer/settings/onboarding-dismiss',
    },
    checkoutOtp: {
      status: '/customer/checkout-otp/status',
      send: '/customer/checkout-otp/send',
      verify: '/customer/checkout-otp/verify',
    },
    responsibility: '/customer/responsibility',
  },

  // ---------------------------------------------------------------------------
  // Cart
  // ---------------------------------------------------------------------------
  cart: {
    get: '/cart',
    addItem: '/cart/items',
    updateItem: (id: string) => `/cart/items/${id}` as const,
    removeItem: (id: string) => `/cart/items/${id}` as const,
    clear: '/cart',
    promo: {
      apply: '/cart/promo',
      remove: '/cart/promo',
    },
  },

  // ---------------------------------------------------------------------------
  // Checkout
  // ---------------------------------------------------------------------------
  checkout: {
    paymentIntent: '/checkout/payment-intent',
    confirm: '/checkout/confirm',
  },

  // ---------------------------------------------------------------------------
  // Shipping
  // ---------------------------------------------------------------------------
  shipping: {
    rates: '/shipping/rates',
    select: '/shipping/select',
  },

  // ---------------------------------------------------------------------------
  // Products (public)
  // ---------------------------------------------------------------------------
  products: {
    list: '/products',
    bySlug: (slug: string) => `/products/slug/${slug}` as const,
    bySku: (sku: string) => `/products/sku/${sku}` as const,
    byId: (id: string) => `/products/${id}` as const,
  },

  // ---------------------------------------------------------------------------
  // Public — CMS
  // ---------------------------------------------------------------------------
  public: {
    cms: {
      navigation: (location: string) => `/public/cms/navigation/${location}` as const,
      footer: '/public/cms/footer',
      page: (slug: string) => `/public/cms/pages/${slug}` as const,
      settings: '/public/cms/settings',
      petReferences: '/public/cms/pet-references',
      petReferencesGrouped: '/public/cms/pet-references/grouped',
      homepageSections: '/public/cms/homepage/sections',
      shopPage: (slug: string) => `/public/cms/shop/${slug}` as const,
      authPage: (pageType: string) => `/public/cms/auth/${pageType}` as const,
      onboarding: '/public/cms/onboarding',
    },
    commerce: {
      cancellationReasons: '/public/commerce/cancellation-reasons',
    },
    points: {
      estimate: '/public/points/estimate',
      rates: '/public/points/rates',
      goldContent: '/public/points/gold-content',
    },
    promo: {
      validate: '/public/promo/validate',
    },
    system: {
      status: '/public/system/status',
    },
  },

  // ---------------------------------------------------------------------------
  // Finder
  // ---------------------------------------------------------------------------
  finder: {
    tag: (tagId: string) => `/finder/${tagId}` as const,
    foundTimer: (tagId: string) => `/finder/${tagId}/found-timer` as const,
    notify: (tagId: string) => `/finder/${tagId}/notify` as const,
    stats: '/finder/stats',
    referral: (code: string) => `/finder/referral/${code}` as const,
  },

  // ---------------------------------------------------------------------------
  // Upload
  // ---------------------------------------------------------------------------
  upload: {
    profilePicture: '/upload/profile-picture',
    petPhoto: '/upload/pet-photo',
    productImages: '/upload/product-images',
    deleteProductImage: (filename: string) => `/upload/product-images/${filename}` as const,
  },

  // ---------------------------------------------------------------------------
  // Address
  // ---------------------------------------------------------------------------
  address: {
    suggest: '/address/suggest',
    invalidateCache: '/address/invalidate-cache',
  },

  // ---------------------------------------------------------------------------
  // Tags (QR/Sticker images)
  // ---------------------------------------------------------------------------
  tags: {
    qr: (tagId: string) => `/tags/${tagId}/qr` as const,
    sticker: (tagId: string) => `/tags/${tagId}/sticker` as const,
  },

  // ---------------------------------------------------------------------------
  // Invoice (public access)
  // ---------------------------------------------------------------------------
  invoice: {
    status: (token: string) => `/invoice/${token}/status` as const,
    verify: (token: string) => `/invoice/${token}/verify` as const,
    resendOtp: (token: string) => `/invoice/${token}/resend-otp` as const,
  },

  // ---------------------------------------------------------------------------
  // Support
  // ---------------------------------------------------------------------------
  support: {
    contact: '/support/contact',
  },
} as const;

/** Type-safe endpoint path */
export type EndpointPath = string | ((...args: any[]) => string);
