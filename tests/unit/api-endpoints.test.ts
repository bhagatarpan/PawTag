import { describe, it, expect } from 'vitest';
import { API } from '../../packages/shared/src/api/endpoints';

describe('API Endpoints', () => {
  describe('Auth endpoints', () => {
    it('has correct auth paths', () => {
      expect(API.auth.login).toBe('/auth/login');
      expect(API.auth.register).toBe('/auth/register');
      expect(API.auth.me).toBe('/auth/me');
      expect(API.auth.refresh).toBe('/auth/refresh');
      expect(API.auth.captcha).toBe('/auth/captcha');
      expect(API.auth.forgotPassword).toBe('/auth/forgot-password');
      expect(API.auth.resetPassword).toBe('/auth/reset-password');
      expect(API.auth.verifyEmail).toBe('/auth/verify-email');
      expect(API.auth.verificationStatus).toBe('/auth/verification-status');
      expect(API.auth.profile).toBe('/auth/profile');
      expect(API.auth.changePassword).toBe('/auth/change-password');
    });

    it('has correct MFA paths', () => {
      expect(API.auth.mfa.sendOtp).toBe('/auth/mfa/send-otp');
      expect(API.auth.mfa.verify).toBe('/auth/mfa/verify');
    });
  });

  describe('Admin endpoints', () => {
    it('has correct user endpoints with ID functions', () => {
      expect(API.admin.users.list).toBe('/admin/users');
      expect(API.admin.users.get('123')).toBe('/admin/users/123');
      expect(API.admin.users.update('abc')).toBe('/admin/users/abc');
      expect(API.admin.users.delete('xyz')).toBe('/admin/users/xyz');
      expect(API.admin.users.resetPassword('456')).toBe('/admin/users/456/reset-password');
      expect(API.admin.users.lock('789')).toBe('/admin/users/789/lock');
    });

    it('has correct product endpoints', () => {
      expect(API.admin.products.list).toBe('/admin/products');
      expect(API.admin.products.create).toBe('/admin/products');
      expect(API.admin.products.update('id1')).toBe('/admin/products/id1');
      expect(API.admin.products.delete('id2')).toBe('/admin/products/id2');
    });

    it('has correct commerce endpoints', () => {
      expect(API.admin.commerce.settings).toBe('/admin/commerce/settings');
      expect(API.admin.commerce.orders).toBe('/admin/commerce/orders');
      expect(API.admin.commerce.products).toBe('/admin/commerce/products');
      expect(API.admin.commerce.reorderProducts).toBe('/admin/commerce/products/reorder');
    });

    it('has correct CMS endpoints', () => {
      expect(API.admin.cms.pages.list).toBe('/admin/cms/pages');
      expect(API.admin.cms.pages.create).toBe('/admin/cms/pages');
      expect(API.admin.cms.pages.update('p1')).toBe('/admin/cms/pages/p1');
      expect(API.admin.cms.navigation.list).toBe('/admin/cms/navigation');
      expect(API.admin.cms.footer.list).toBe('/admin/cms/footer');
    });

    it('has correct RBAC endpoints', () => {
      expect(API.admin.rbac.roles.list).toBe('/admin/rbac/roles');
      expect(API.admin.rbac.permissions.list).toBe('/admin/rbac/permissions');
      expect(API.admin.rbac.scopes.list).toBe('/admin/rbac/scopes');
    });

    it('has correct audit endpoints', () => {
      expect(API.admin.audit.list).toBe('/admin/audit');
      expect(API.admin.audit.summary).toBe('/admin/audit/summary');
      expect(API.admin.audit.entity('user', '123')).toBe('/admin/audit/entity/user/123');
    });

    it('has correct guardian endpoints', () => {
      expect(API.admin.guardian.stats).toBe('/admin/guardian/stats');
      expect(API.admin.guardian.members).toBe('/admin/guardian/members');
      expect(API.admin.guardian.settings).toBe('/admin/guardian/settings');
    });
  });

  describe('Customer endpoints', () => {
    it('has correct pet endpoints', () => {
      expect(API.customer.pets.list).toBe('/customer/pets');
      expect(API.customer.pets.create).toBe('/customer/pets');
      expect(API.customer.pets.update('pet1')).toBe('/customer/pets/pet1');
      expect(API.customer.pets.markLost('pet2')).toBe('/customer/pets/pet2/mark-lost');
      expect(API.customer.pets.markFound('pet3')).toBe('/customer/pets/pet3/mark-found');
    });

    it('has correct order endpoints', () => {
      expect(API.customer.orders.list).toBe('/customer/orders');
      expect(API.customer.orders.get('ord1')).toBe('/customer/orders/ord1');
      expect(API.customer.orders.invoice('ord2')).toBe('/customer/orders/ord2/invoice');
    });

    it('has correct guardian endpoints', () => {
      expect(API.customer.guardian.points).toBe('/customer/guardian/points');
      expect(API.customer.guardian.rewards).toBe('/customer/guardian/rewards');
      expect(API.customer.guardian.tier).toBe('/customer/guardian/tier');
      expect(API.customer.guardian.redeemRewards).toBe('/customer/guardian/rewards/redeem');
    });

    it('has correct subscription endpoints', () => {
      expect(API.customer.subscriptions.list).toBe('/customer/subscriptions');
      expect(API.customer.subscriptions.get('sub1')).toBe('/customer/subscriptions/sub1');
      expect(API.customer.subscriptions.cancel('sub2')).toBe('/customer/subscriptions/sub2/cancel');
    });
  });

  describe('Cart endpoints', () => {
    it('has correct cart paths', () => {
      expect(API.cart.get).toBe('/cart');
      expect(API.cart.addItem).toBe('/cart/items');
      expect(API.cart.updateItem('item1')).toBe('/cart/items/item1');
      expect(API.cart.removeItem('item2')).toBe('/cart/items/item2');
      expect(API.cart.clear).toBe('/cart');
      expect(API.cart.promo.apply).toBe('/cart/promo');
      expect(API.cart.promo.remove).toBe('/cart/promo');
    });
  });

  describe('Public endpoints', () => {
    it('has correct CMS public paths', () => {
      expect(API.public.cms.settings).toBe('/public/cms/settings');
      expect(API.public.cms.navigation('header')).toBe('/public/cms/navigation/header');
      expect(API.public.cms.footer).toBe('/public/cms/footer');
      expect(API.public.cms.page('about')).toBe('/public/cms/pages/about');
      expect(API.public.cms.onboarding).toBe('/public/cms/onboarding');
    });

    it('has correct commerce public paths', () => {
      expect(API.public.commerce.cancellationReasons).toBe('/public/commerce/cancellation-reasons');
    });

    it('has correct points estimate paths', () => {
      expect(API.public.points.estimate).toBe('/public/points/estimate');
      expect(API.public.points.rates).toBe('/public/points/rates');
    });

    it('has correct system paths', () => {
      expect(API.public.system.status).toBe('/public/system/status');
    });
  });

  describe('Finder endpoints', () => {
    it('has correct finder paths', () => {
      expect(API.finder.tag('PT-123')).toBe('/finder/PT-123');
      expect(API.finder.foundTimer('PT-456')).toBe('/finder/PT-456/found-timer');
      expect(API.finder.notify('PT-789')).toBe('/finder/PT-789/notify');
      expect(API.finder.stats).toBe('/finder/stats');
    });
  });

  describe('Upload endpoints', () => {
    it('has correct upload paths', () => {
      expect(API.upload.profilePicture).toBe('/upload/profile-picture');
      expect(API.upload.petPhoto).toBe('/upload/pet-photo');
      expect(API.upload.productImages).toBe('/upload/product-images');
      expect(API.upload.deleteProductImage('file.jpg')).toBe('/upload/product-images/file.jpg');
    });
  });

  describe('All static paths start with /', () => {
    it('every static endpoint starts with /', () => {
      const checkPaths = (obj: any, prefix = '') => {
        for (const [key, value] of Object.entries(obj)) {
          if (typeof value === 'string') {
            expect(value).toMatch(/^\//);
          } else if (typeof value === 'object' && value !== null) {
            checkPaths(value, `${prefix}${key}.`);
          }
        }
      };
      checkPaths(API);
    });
  });
});
