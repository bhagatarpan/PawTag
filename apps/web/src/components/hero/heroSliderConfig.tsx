/**
 * Hero Slider Puck Configuration
 * 
 * Defines the PawTag-approved components for the hero slide WYSIWYG editor.
 * Used by both admin (Puck editor) and public (preview/render).
 */

import type { Config } from '@puckeditor/core';
import {
  HeroHeading,
  HeroText,
  HeroButton,
  HeroBadge,
  HeroImage,
  HeroStats,
  HeroFlow,
  HeroPetProfiles,
  HeroQRCode,
  HeroPhoneScan,
  HeroTrustBadges,
  HeroTestimonial,
  HeroLocation,
  HeroAwards,
  HeroHeart,
  HeroPaw,
} from './HeroComponents';

// ─── Component Types ───────────────────────────────────────────────

type HeroSlideComponents = {
  HeroHeading: {
    text: string;
    level: 'h1' | 'h2' | 'h3';
    color: 'white' | 'gray-900';
  };
  HeroText: {
    text: string;
    size: 'sm' | 'base' | 'lg';
    color: 'white' | 'white/80' | 'gray-600';
  };
  HeroButton: {
    text: string;
    url: string;
    variant: 'primary' | 'secondary' | 'ghost';
    openInNewTab: boolean;
  };
  HeroBadge: {
    text: string;
    variant: 'teal' | 'amber' | 'green' | 'white';
  };
  HeroImage: {
    url: string;
    alt: string;
    width: 'full' | 'large' | 'medium';
    rounded: boolean;
  };
  HeroStats: {
    items: { number: string; label: string }[];
  };
  HeroFlow: {
    steps: { icon: string; label: string; desc: string }[];
  };
  HeroPetProfiles: {
    pets: { name: string; breed: string }[];
  };
  HeroQRCode: {
    tagId: string;
  };
  HeroPhoneScan: Record<string, never>;
  HeroTrustBadges: Record<string, never>;
  HeroTestimonial: {
    quote: string;
    author: string;
    rating: number;
  };
  HeroLocation: {
    lat: number;
    lng: number;
  };
  HeroAwards: Record<string, never>;
  HeroHeart: Record<string, never>;
  HeroPaw: {
    companyName: string;
  };
};

// ─── Puck Configuration ────────────────────────────────────────────

export const heroSliderConfig: Config<HeroSlideComponents> = {
  components: {
    HeroHeading: {
      fields: {
        text: { type: 'text', label: 'Heading Text' },
        level: {
          type: 'select',
          label: 'Heading Level',
          options: [
            { label: 'H1 (Largest)', value: 'h1' },
            { label: 'H2 (Medium)', value: 'h2' },
            { label: 'H3 (Small)', value: 'h3' },
          ],
        },
        color: {
          type: 'select',
          label: 'Text Color',
          options: [
            { label: 'White', value: 'white' },
            { label: 'Dark', value: 'gray-900' },
          ],
        },
      },
      defaultProps: {
        text: 'Your Heading Here',
        level: 'h1',
        color: 'white',
      },
      render: ({ text, level, color }) => (
        <HeroHeading text={text} level={level} color={color} />
      ),
    },

    HeroText: {
      fields: {
        text: { type: 'textarea', label: 'Text Content' },
        size: {
          type: 'select',
          label: 'Text Size',
          options: [
            { label: 'Small', value: 'sm' },
            { label: 'Base', value: 'base' },
            { label: 'Large', value: 'lg' },
          ],
        },
        color: {
          type: 'select',
          label: 'Text Color',
          options: [
            { label: 'White', value: 'white' },
            { label: 'White (80%)', value: 'white/80' },
            { label: 'Dark', value: 'gray-600' },
          ],
        },
      },
      defaultProps: {
        text: 'Your supporting text here.',
        size: 'lg',
        color: 'white/80',
      },
      render: ({ text, size, color }) => (
        <HeroText text={text} size={size} color={color} />
      ),
    },

    HeroButton: {
      fields: {
        text: { type: 'text', label: 'Button Text' },
        url: { type: 'text', label: 'Button URL' },
        variant: {
          type: 'select',
          label: 'Button Style',
          options: [
            { label: 'Primary (White)', value: 'primary' },
            { label: 'Secondary (Teal)', value: 'secondary' },
            { label: 'Ghost (Outline)', value: 'ghost' },
          ],
        },
        openInNewTab: { type: 'boolean', label: 'Open in New Tab' },
      },
      defaultProps: {
        text: 'Get Started',
        url: '/shop',
        variant: 'primary',
        openInNewTab: false,
      },
      render: ({ text, url, variant, openInNewTab }) => (
        <HeroButton text={text} url={url} variant={variant} openInNewTab={openInNewTab} />
      ),
    },

    HeroBadge: {
      fields: {
        text: { type: 'text', label: 'Badge Text' },
        variant: {
          type: 'select',
          label: 'Badge Style',
          options: [
            { label: 'White', value: 'white' },
            { label: 'Teal', value: 'teal' },
            { label: 'Amber', value: 'amber' },
            { label: 'Green', value: 'green' },
          ],
        },
      },
      defaultProps: {
        text: 'Badge Label',
        variant: 'white',
      },
      render: ({ text, variant }) => (
        <HeroBadge text={text} variant={variant} />
      ),
    },

    HeroImage: {
      fields: {
        url: { type: 'text', label: 'Image URL' },
        alt: { type: 'text', label: 'Alt Text' },
        width: {
          type: 'select',
          label: 'Image Width',
          options: [
            { label: 'Full', value: 'full' },
            { label: 'Large', value: 'large' },
            { label: 'Medium', value: 'medium' },
          ],
        },
        rounded: { type: 'boolean', label: 'Rounded Corners' },
      },
      defaultProps: {
        url: '',
        alt: 'Hero image',
        width: 'large',
        rounded: true,
      },
      render: ({ url, alt, width, rounded }) => (
        <HeroImage url={url} alt={alt} width={width} rounded={rounded} />
      ),
    },

    HeroStats: {
      fields: {
        items: {
          type: 'array',
          label: 'Statistics',
          defaultItemProps: { number: '0', label: 'Stat' },
          arrayFields: {
            number: { type: 'text', label: 'Number' },
            label: { type: 'text', label: 'Label' },
          },
        },
      },
      defaultProps: {
        items: [
          { number: '14K+', label: 'Protected Pets' },
          { number: '42', label: 'Countries' },
          { number: '98%', label: 'Recovery Rate' },
        ],
      },
      render: ({ items }) => <HeroStats items={items} />,
    },

    HeroFlow: {
      fields: {
        steps: {
          type: 'array',
          label: 'Flow Steps',
          defaultItemProps: { icon: 'PawPrint', label: 'Step', desc: 'Description' },
          arrayFields: {
            icon: { type: 'text', label: 'Icon Name' },
            label: { type: 'text', label: 'Step Label' },
            desc: { type: 'text', label: 'Description' },
          },
        },
      },
      defaultProps: {
        steps: [
          { icon: 'PawPrint', label: 'Finder', desc: 'Finds pet' },
          { icon: 'Scan', label: 'Scan', desc: 'Scans tag' },
          { icon: 'UserCheck', label: 'Profile', desc: 'Sees info' },
          { icon: 'Phone', label: 'Contact', desc: 'Calls owner' },
          { icon: 'MapPin', label: 'Reunited', desc: 'Pet home' },
        ],
      },
      render: ({ steps }) => <HeroFlow steps={steps} />,
    },

    HeroPetProfiles: {
      fields: {
        pets: {
          type: 'array',
          label: 'Pet Profiles',
          defaultItemProps: { name: 'Buddy', breed: 'Golden Retriever' },
          arrayFields: {
            name: { type: 'text', label: 'Pet Name' },
            breed: { type: 'text', label: 'Breed' },
          },
        },
      },
      defaultProps: {
        pets: [
          { name: 'Buddy', breed: 'Golden Retriever' },
          { name: 'Luna', breed: 'Siamese Cat' },
          { name: 'Max', breed: 'German Shepherd' },
          { name: 'Bella', breed: 'Labrador' },
        ],
      },
      render: ({ pets }) => <HeroPetProfiles pets={pets} />,
    },

    HeroQRCode: {
      fields: {
        tagId: { type: 'text', label: 'Tag ID' },
      },
      defaultProps: {
        tagId: 'PT-XXXXXXXX',
      },
      render: ({ tagId }) => <HeroQRCode tagId={tagId} />,
    },

    HeroPhoneScan: {
      fields: {},
      defaultProps: {},
      render: () => <HeroPhoneScan />,
    },

    HeroTrustBadges: {
      fields: {},
      defaultProps: {},
      render: () => <HeroTrustBadges />,
    },

    HeroTestimonial: {
      fields: {
        quote: { type: 'textarea', label: 'Testimonial Quote' },
        author: { type: 'text', label: 'Author Name' },
        rating: {
          type: 'select',
          label: 'Star Rating',
          options: [
            { label: '5 Stars', value: 5 },
            { label: '4 Stars', value: 4 },
            { label: '3 Stars', value: 3 },
          ],
        },
      },
      defaultProps: {
        quote: '"PawTag gave us peace of mind. When our cat went missing, we were reunited within hours."',
        author: 'Sarah M.',
        rating: 5,
      },
      render: ({ quote, author, rating }) => (
        <HeroTestimonial quote={quote} author={author} rating={rating} />
      ),
    },

    HeroLocation: {
      fields: {
        lat: { type: 'number', label: 'Latitude' },
        lng: { type: 'number', label: 'Longitude' },
      },
      defaultProps: {
        lat: -36.8485,
        lng: 174.7633,
      },
      render: ({ lat, lng }) => <HeroLocation lat={lat} lng={lng} />,
    },

    HeroAwards: {
      fields: {},
      defaultProps: {},
      render: () => <HeroAwards />,
    },

    HeroHeart: {
      fields: {},
      defaultProps: {},
      render: () => <HeroHeart />,
    },

    HeroPaw: {
      fields: {
        companyName: { type: 'text', label: 'Company Name' },
      },
      defaultProps: {
        companyName: 'PawTag',
      },
      render: ({ companyName }) => <HeroPaw companyName={companyName} />,
    },
  },
};
