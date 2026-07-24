import type { Config } from '@puckeditor/core';
import { useState } from 'react';
import { useSiteSettings } from '../../hooks/useCms';

type PawtagComponents = {
  HeroBanner: {
    heading: string;
    subheading: string;
    buttonText: string;
    buttonUrl: string;
    backgroundUrl: string;
  };
  FeaturesGrid: {
    heading: string;
    items: { icon: string; title: string; description: string }[];
  };
  RichTextBlock: {
    html: string;
  };
  ImageGallery: {
    heading: string;
    images: { url: string }[];
  };
  CardsGrid: {
    heading: string;
    items: { icon: string; title: string; description: string; link: string }[];
  };
  PricingTable: {
    heading: string;
    plans: { name: string; price: string; features: string; cta: string; ctaUrl: string; highlighted: string }[];
  };
  TestimonialsSection: {
    heading: string;
    items: { name: string; role: string; quote: string; avatar: string }[];
  };
  FaqAccordion: {
    heading: string;
    items: { question: string; answer: string }[];
  };
  TimelineSection: {
    heading: string;
    items: { year: string; title: string; description: string }[];
  };
  StatsCounter: {
    heading: string;
    stats: { label: string; value: string; suffix: string }[];
  };
  VideoEmbed: {
    url: string;
    caption: string;
  };
  CtaBanner: {
    heading: string;
    subheading: string;
    buttonText: string;
    buttonUrl: string;
  };
  PartnersLogos: {
    heading: string;
    logos: { url: string }[];
  };
  MapBlock: {
    latitude: number;
    longitude: number;
    zoom: number;
  };
  CustomHtml: {
    html: string;
  };
  TextBlock: {
    heading: string;
    subheading: string;
    alignment: string;
    headingLevel: string;
  };
  ImageBlock: {
    url: string;
    alt: string;
    caption: string;
    width: string;
    alignment: string;
    rounded: string;
  };
  ImageTextBlock: {
    imageUrl: string;
    imageAlt: string;
    heading: string;
    content: string;
    buttonText: string;
    buttonUrl: string;
    imagePosition: string;
  };
  ButtonBlock: {
    text: string;
    url: string;
    style: string;
    size: string;
    alignment: string;
    openInNewTab: string;
  };
  SpacerBlock: {
    height: string;
  };
  DividerBlock: {
    style: string;
    color: string;
    width: string;
    spacing: string;
  };
  ColumnsBlock: {
    columns: string;
    gap: string;
    items: { heading: string; content: string; imageUrl: string }[];
  };
  AlertBlock: {
    type: string;
    heading: string;
    content: string;
    dismissible: string;
  };
  NewsletterSignupBlock: {
    heading: string;
    subheading: string;
    buttonText: string;
    placeholder: string;
    backgroundColor: string;
  };
  TeamBlock: {
    heading: string;
    members: { name: string; role: string; bio: string; avatar: string; linkedin: string }[];
  };
  AccordionBlock: {
    heading: string;
    items: { title: string; content: string; defaultOpen: string }[];
  };
  TabsBlock: {
    items: { label: string; content: string }[];
  };
  IconListBlock: {
    heading: string;
    items: { icon: string; text: string }[];
    columns: string;
  };
  BadgeBlock: {
    heading: string;
    badges: { icon: string; label: string; description: string }[];
  };
  EmbedBlock: {
    url: string;
    caption: string;
    height: string;
  };
  BackToTopBlock: {
    text: string;
    style: string;
  };
  MarqueeBlock: {
    items: { text: string }[];
    speed: string;
    backgroundColor: string;
  };
  SocialLinksBlock: {
    facebook: string;
    twitter: string;
    instagram: string;
    linkedin: string;
    youtube: string;
    tiktok: string;
    alignment: string;
  };
  AnnouncementBarBlock: {
    text: string;
    linkText: string;
    linkUrl: string;
    backgroundColor: string;
    textColor: string;
    closable: string;
  };
  CountdownBlock: {
    targetDate: string;
    targetTime: string;
    heading: string;
    expiredText: string;
  };
  ContactForm: {
    heading: string;
    subtitle: string;
    businessHours: string;
    businessHoliday: string;
    formTitle: string;
    formButtonText: string;
    formSuccessMessage: string;
  };
};

export const pawtagConfig: Config<PawtagComponents> = {
  components: {
    HeroBanner: {
      fields: {
        heading: { type: 'text', label: 'Heading' },
        subheading: { type: 'text', label: 'Subheading' },
        buttonText: { type: 'text', label: 'Button Text' },
        buttonUrl: { type: 'text', label: 'Button URL' },
        backgroundUrl: { type: 'text', label: 'Background Image URL' },
      },
      defaultProps: {
        heading: 'Welcome to PawTag',
        subheading: 'Keep your pets safe with smart QR tags',
        buttonText: 'Get Started',
        buttonUrl: '/register',
        backgroundUrl: '',
      },
      render: ({ heading, subheading, buttonText, buttonUrl, backgroundUrl }) => (
        <section
          className="relative flex items-center justify-center min-h-[400px] bg-gradient-to-br from-primary-600 to-primary-800 text-white text-center px-6 py-16 rounded-xl overflow-hidden"
          style={backgroundUrl ? { backgroundImage: `url(${backgroundUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
        >
          <div className="relative z-10 max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">{heading}</h1>
            <p className="text-xl text-white/80 mb-8">{subheading}</p>
            {buttonText && (
              <a href={buttonUrl} className="inline-block bg-white text-primary-700 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-all">
                {buttonText}
              </a>
            )}
          </div>
        </section>
      ),
    },

    RichTextBlock: {
      fields: {
        html: { type: 'textarea', label: 'HTML Content' },
      },
      defaultProps: {
        html: '<p>Write your content here...</p>',
      },
      render: ({ html }) => (
        <section className="py-12 px-6 max-w-4xl mx-auto">
          <div dangerouslySetInnerHTML={{ __html: html }} className="prose prose-lg max-w-none" />
        </section>
      ),
    },

    FaqAccordion: {
      fields: {
        heading: { type: 'text', label: 'Heading' },
        items: {
          type: 'array',
          label: 'FAQ Items',
          defaultItemProps: { question: '', answer: '' },
          arrayFields: {
            question: { type: 'text', label: 'Question' },
            answer: { type: 'textarea', label: 'Answer' },
          },
        },
      },
      defaultProps: { heading: 'FAQ', items: [] },
      render: ({ heading, items }) => (
        <section className="py-12 px-6 max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">{heading || 'FAQ'}</h2>
          <div className="space-y-3">
            {(items || []).map((item, i) => (
              <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="p-5">
                  <h3 className="font-semibold text-gray-900">{item.question}</h3>
                  <p className="text-gray-600 text-sm mt-2">{item.answer}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ),
    },

    ContactForm: {
      fields: {
        heading: { type: 'text', label: 'Page Heading' },
        subtitle: { type: 'text', label: 'Subtitle' },
        businessHours: { type: 'text', label: 'Business Hours' },
        businessHoliday: { type: 'text', label: 'Business Holiday' },
        formTitle: { type: 'text', label: 'Form Title' },
        formButtonText: { type: 'text', label: 'Form Button Text' },
        formSuccessMessage: { type: 'text', label: 'Form Success Message' },
      },
      defaultProps: {
        heading: 'Contact Us',
        subtitle: "Have a question or need help? We'd love to hear from you.",
        businessHours: 'Mon-Fri: 7am-6pm, Sat: 8am-2pm',
        businessHoliday: 'Christmas day, Boxing day, Waitangi day, ANZAC day',
        formTitle: 'Send Us a Message',
        formButtonText: 'Send Message',
        formSuccessMessage: "Thank you! We'll be in touch soon.",
      },
      render: ({ heading, subtitle, businessHours, businessHoliday, formTitle, formButtonText, formSuccessMessage }) => {
        const { settings } = useSiteSettings();
        const contactEmail = settings['company.email'] || 'support@pawtag.co.nz';
        const contactPhone = settings['company.phone'] || '+64 21 123 4567';
        const contactAddress = settings['company.address'] || 'Auckland, New Zealand';
        const hours = businessHours || settings['contact.businessHours'] || 'Mon-Fri: 7am-6pm, Sat: 8am-2pm';
        const holiday = businessHoliday || settings['contact.businessHoliday'] || 'Christmas day, Boxing day, Waitangi day, ANZAC day';
        return (
        <section className="py-12 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
              {/* Contact Form - Left */}
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-8">{formTitle || 'Send Us a Message'}</h2>
                <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); alert(formSuccessMessage); }}>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Name *</label>
                      <input type="text" className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Email *</label>
                      <input type="email" className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
                      <input type="tel" className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Subject</label>
                      <select className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white">
                        <option>Online Enquiry</option>
                        <option>General Question</option>
                        <option>Support</option>
                        <option>Feedback</option>
                        <option>Other</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Message *</label>
                    <textarea rows={5} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Attachments (optional)</label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-teal-400 transition-colors cursor-pointer bg-gray-50">
                      <svg className="mx-auto h-8 w-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="text-sm text-gray-600 mb-1">Choose files to upload</p>
                      <p className="text-xs text-gray-400">Max 5 files, up to 10MB each. Allowed: pdf,doc,docx,xls,xlsx,jpg,jpeg,png,gif,webp</p>
                    </div>
                  </div>
                  <button type="submit" className="w-full bg-teal-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-teal-700 transition-all flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    {formButtonText || 'Send Message'}
                  </button>
                </form>
              </div>
              {/* Contact Info - Right */}
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-8">Contact Information</h2>
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 mb-1">Address</h3>
                      <p className="text-gray-500 text-sm">{contactAddress}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 mb-1">Phone</h3>
                      <p className="text-gray-500 text-sm">{contactPhone}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 mb-1">Email</h3>
                      <p className="text-gray-500 text-sm">{contactEmail}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 mb-1">Business Hours</h3>
                      <p className="text-gray-500 text-sm">{hours}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 mb-1">Business Holiday</h3>
                      <p className="text-gray-500 text-sm">{holiday}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        );
      },
    },

    FeaturesGrid: {
      fields: {
        heading: { type: 'text', label: 'Heading' },
        items: {
          type: 'array',
          label: 'Features',
          defaultItemProps: { icon: '', title: '', description: '' },
          arrayFields: {
            icon: { type: 'text', label: 'Icon (emoji or text)' },
            title: { type: 'text', label: 'Title' },
            description: { type: 'textarea', label: 'Description' },
          },
        },
      },
      defaultProps: { heading: 'Features', items: [] },
      render: ({ heading, items }) => (
        <section className="py-16 px-6">
          <h2 className="text-3xl font-bold text-center mb-12">{heading || 'Features'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {(items || []).map((item, i) => (
              <div key={i} className="text-center p-6 rounded-xl border border-gray-200 hover:shadow-lg transition">
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-gray-600 text-sm">{item.description}</p>
              </div>
            ))}
          </div>
        </section>
      ),
    },

    ImageGallery: {
      fields: {
        heading: { type: 'text', label: 'Heading' },
        images: {
          type: 'array',
          label: 'Images',
          defaultItemProps: { url: '' },
          arrayFields: {
            url: { type: 'text', label: 'Image URL' },
          },
        },
      },
      defaultProps: { heading: 'Gallery', images: [] },
      render: ({ heading, images }) => (
        <section className="py-12 px-6">
          <h2 className="text-3xl font-bold text-center mb-8">{heading || 'Gallery'}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
            {(images || []).map((img: any, i) => (
              <img key={i} src={typeof img === 'string' ? img : img?.url || ''} alt={`Gallery ${i + 1}`} className="w-full h-48 object-cover rounded-lg" />
            ))}
          </div>
        </section>
      ),
    },

    CardsGrid: {
      fields: {
        heading: { type: 'text', label: 'Heading' },
        items: {
          type: 'array',
          label: 'Cards',
          defaultItemProps: { icon: '', title: '', description: '', link: '' },
          arrayFields: {
            icon: { type: 'text', label: 'Icon' },
            title: { type: 'text', label: 'Title' },
            description: { type: 'textarea', label: 'Description' },
            link: { type: 'text', label: 'Link URL' },
          },
        },
      },
      defaultProps: { heading: 'Cards', items: [] },
      render: ({ heading, items }) => (
        <section className="py-12 px-6">
          <h2 className="text-3xl font-bold text-center mb-8">{heading || 'Cards'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {(items || []).map((item, i) => (
              <div key={i} className="p-6 rounded-xl border border-gray-200 hover:shadow-lg transition">
                <div className="text-3xl mb-3">{item.icon}</div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-gray-600 text-sm">{item.description}</p>
                {item.link && <a href={item.link} className="text-primary-600 text-sm mt-3 inline-block hover:underline">Learn more</a>}
              </div>
            ))}
          </div>
        </section>
      ),
    },

    PricingTable: {
      fields: {
        heading: { type: 'text', label: 'Heading' },
        plans: {
          type: 'array',
          label: 'Plans',
          defaultItemProps: { name: '', price: '', features: '', cta: '', ctaUrl: '', highlighted: '' },
          arrayFields: {
            name: { type: 'text', label: 'Plan Name' },
            price: { type: 'text', label: 'Price' },
            features: { type: 'textarea', label: 'Features (one per line)' },
            cta: { type: 'text', label: 'Button Text' },
            ctaUrl: { type: 'text', label: 'Button URL' },
            highlighted: { type: 'text', label: 'Highlighted (true/false)' },
          },
        },
      },
      defaultProps: { heading: 'Pricing', plans: [] },
      render: ({ heading, plans }) => (
        <section className="py-12 px-6">
          <h2 className="text-3xl font-bold text-center mb-8">{heading || 'Pricing'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {(plans || []).map((plan, i) => (
              <div key={i} className={`p-6 rounded-xl border ${plan.highlighted === 'true' ? 'border-primary-500 shadow-lg' : 'border-gray-200'}`}>
                <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                <p className="text-3xl font-bold text-primary-600 mb-4">{plan.price}</p>
                <div className="text-sm text-gray-600 mb-6 whitespace-pre-line">{plan.features}</div>
                {plan.cta && <a href={plan.ctaUrl} className="block text-center bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700 transition">{plan.cta}</a>}
              </div>
            ))}
          </div>
        </section>
      ),
    },

    TestimonialsSection: {
      fields: {
        heading: { type: 'text', label: 'Heading' },
        items: {
          type: 'array',
          label: 'Testimonials',
          defaultItemProps: { name: '', role: '', quote: '', avatar: '' },
          arrayFields: {
            name: { type: 'text', label: 'Name' },
            role: { type: 'text', label: 'Role' },
            quote: { type: 'textarea', label: 'Quote' },
            avatar: { type: 'text', label: 'Avatar URL' },
          },
        },
      },
      defaultProps: { heading: 'Testimonials', items: [] },
      render: ({ heading, items }) => (
        <section className="py-12 px-6 bg-gray-50">
          <h2 className="text-3xl font-bold text-center mb-8">{heading || 'Testimonials'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {(items || []).map((item, i) => (
              <div key={i} className="bg-white p-6 rounded-xl border border-gray-100">
                <p className="text-gray-600 text-sm italic mb-4">"{item.quote}"</p>
                <div className="flex items-center gap-3">
                  {item.avatar && <img src={item.avatar} alt={item.name} className="w-10 h-10 rounded-full" />}
                  <div>
                    <p className="font-semibold text-sm">{item.name}</p>
                    <p className="text-gray-400 text-xs">{item.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ),
    },

    TimelineSection: {
      fields: {
        heading: { type: 'text', label: 'Heading' },
        items: {
          type: 'array',
          label: 'Timeline Items',
          defaultItemProps: { year: '', title: '', description: '' },
          arrayFields: {
            year: { type: 'text', label: 'Year' },
            title: { type: 'text', label: 'Title' },
            description: { type: 'textarea', label: 'Description' },
          },
        },
      },
      defaultProps: { heading: 'Timeline', items: [] },
      render: ({ heading, items }) => (
        <section className="py-12 px-6">
          <h2 className="text-3xl font-bold text-center mb-8">{heading || 'Timeline'}</h2>
          <div className="max-w-3xl mx-auto">
            {(items || []).map((item, i) => (
              <div key={i} className="flex gap-4 mb-6">
                <div className="w-16 text-right text-sm font-bold text-primary-600 pt-1">{item.year}</div>
                <div className="w-px bg-primary-200 relative">
                  <div className="absolute top-1.5 -left-1.5 w-3 h-3 bg-primary-600 rounded-full" />
                </div>
                <div className="flex-1 pb-6">
                  <h3 className="font-semibold mb-1">{item.title}</h3>
                  <p className="text-gray-600 text-sm">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ),
    },

    StatsCounter: {
      fields: {
        heading: { type: 'text', label: 'Heading' },
        stats: {
          type: 'array',
          label: 'Stats',
          defaultItemProps: { label: '', value: '', suffix: '' },
          arrayFields: {
            label: { type: 'text', label: 'Label' },
            value: { type: 'text', label: 'Value' },
            suffix: { type: 'text', label: 'Suffix' },
          },
        },
      },
      defaultProps: { heading: 'Stats', stats: [] },
      render: ({ heading, stats }) => (
        <section className="py-12 px-6 bg-gray-50">
          <h2 className="text-3xl font-bold text-center mb-8">{heading || 'Stats'}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {(stats || []).map((stat, i) => (
              <div key={i} className="text-center">
                <p className="text-3xl font-bold text-primary-600">{stat.value}{stat.suffix}</p>
                <p className="text-gray-600 text-sm mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </section>
      ),
    },

    VideoEmbed: {
      fields: {
        url: { type: 'text', label: 'Video URL' },
        caption: { type: 'text', label: 'Caption' },
      },
      defaultProps: { url: '', caption: '' },
      render: ({ url, caption }) => (
        <section className="py-12 px-6">
          <div className="max-w-4xl mx-auto">
            {url && (
              <div className="aspect-video rounded-xl overflow-hidden bg-gray-100">
                <iframe src={url} className="w-full h-full" allowFullScreen title={caption || 'Video'} />
              </div>
            )}
            {caption && <p className="text-center text-gray-500 text-sm mt-3">{caption}</p>}
          </div>
        </section>
      ),
    },

    CtaBanner: {
      fields: {
        heading: { type: 'text', label: 'Heading' },
        subheading: { type: 'text', label: 'Subheading' },
        buttonText: { type: 'text', label: 'Button Text' },
        buttonUrl: { type: 'text', label: 'Button URL' },
      },
      defaultProps: { heading: 'Ready to get started?', subheading: 'Join thousands of pet owners who trust PawTag.', buttonText: 'Get Started', buttonUrl: '/register' },
      render: ({ heading, subheading, buttonText, buttonUrl }) => (
        <section className="py-16 px-6 bg-primary-600 text-white text-center">
          <h2 className="text-3xl font-bold mb-4">{heading}</h2>
          <p className="text-white/80 mb-8 max-w-2xl mx-auto">{subheading}</p>
          {buttonText && <a href={buttonUrl} className="inline-block bg-white text-primary-700 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition">{buttonText}</a>}
        </section>
      ),
    },

    PartnersLogos: {
      fields: {
        heading: { type: 'text', label: 'Heading' },
        logos: {
          type: 'array',
          label: 'Logos',
          defaultItemProps: { url: '' },
          arrayFields: {
            url: { type: 'text', label: 'Logo URL' },
          },
        },
      },
      defaultProps: { heading: 'Partners', logos: [] },
      render: ({ heading, logos }) => (
        <section className="py-12 px-6 text-center">
          <h2 className="text-2xl font-bold mb-8 text-gray-700">{heading || 'Partners'}</h2>
          <div className="flex flex-wrap items-center justify-center gap-8 max-w-4xl mx-auto">
            {(logos || []).map((logo: any, i) => (
              <img key={i} src={typeof logo === 'string' ? logo : logo?.url || ''} alt={`Partner ${i + 1}`} className="h-12 object-contain opacity-60 hover:opacity-100 transition" />
            ))}
          </div>
        </section>
      ),
    },

    MapBlock: {
      fields: {
        latitude: { type: 'number', label: 'Latitude' },
        longitude: { type: 'number', label: 'Longitude' },
        zoom: { type: 'number', label: 'Zoom Level' },
      },
      defaultProps: { latitude: -36.8485, longitude: 174.7633, zoom: 12 },
      render: ({ latitude, longitude, zoom }) => (
        <section className="py-8 px-6">
          <div className="max-w-5xl mx-auto rounded-xl overflow-hidden shadow-lg h-80 bg-gray-100 flex items-center justify-center">
            <iframe
              title="Map"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${longitude - 0.05}%2C${latitude - 0.05}%2C${longitude + 0.05}%2C${latitude + 0.05}&layer=mapnik&marker=${latitude}%2C${longitude}`}
            />
          </div>
        </section>
      ),
    },

    CustomHtml: {
      fields: {
        html: { type: 'textarea', label: 'Custom HTML' },
      },
      defaultProps: { html: '<div>Custom content</div>' },
      render: ({ html }) => (
        <div dangerouslySetInnerHTML={{ __html: html }} />
      ),
    },

    TextBlock: {
      fields: {
        heading: { type: 'text', label: 'Heading' },
        subheading: { type: 'textarea', label: 'Subheading' },
        alignment: { type: 'radio', label: 'Alignment', options: [{ label: 'Left', value: 'left' }, { label: 'Center', value: 'center' }, { label: 'Right', value: 'right' }] },
        headingLevel: { type: 'select', label: 'Heading Size', options: [{ label: 'H1', value: 'h1' }, { label: 'H2', value: 'h2' }, { label: 'H3', value: 'h3' }] },
      },
      defaultProps: { heading: 'Section Heading', subheading: '', alignment: 'center', headingLevel: 'h2' },
      render: ({ heading, subheading, alignment, headingLevel }) => {
        const Tag = (['h1','h2','h3'].includes(headingLevel) ? headingLevel : 'h2') as 'h1' | 'h2' | 'h3';
        const sizeClass = { h1: 'text-4xl', h2: 'text-3xl', h3: 'text-2xl' }[headingLevel] || 'text-3xl';
        return (
          <section className="py-8 px-6" style={{ textAlign: alignment as any }}>
            <div className="max-w-4xl mx-auto">
              <Tag className={`${sizeClass} font-bold text-gray-900 mb-3`}>{heading}</Tag>
              {subheading && <p className="text-gray-500 text-lg mt-2">{subheading}</p>}
            </div>
          </section>
        );
      },
    },

    ImageBlock: {
      fields: {
        url: { type: 'text', label: 'Image URL' },
        alt: { type: 'text', label: 'Alt Text' },
        caption: { type: 'text', label: 'Caption' },
        width: { type: 'select', label: 'Width', options: [{ label: 'Full', value: 'full' }, { label: 'Large', value: 'large' }, { label: 'Medium', value: 'medium' }, { label: 'Small', value: 'small' }] },
        alignment: { type: 'radio', label: 'Alignment', options: [{ label: 'Left', value: 'left' }, { label: 'Center', value: 'center' }, { label: 'Right', value: 'right' }] },
        rounded: { type: 'radio', label: 'Rounded Corners', options: [{ label: 'Yes', value: 'true' }, { label: 'No', value: 'false' }] },
      },
      defaultProps: { url: '', alt: '', caption: '', width: 'full', alignment: 'center', rounded: 'true' },
      render: ({ url, alt, caption, width, alignment, rounded }) => {
        const w = { full: 'max-w-5xl', large: 'max-w-4xl', medium: 'max-w-2xl', small: 'max-w-lg' }[width] || 'max-w-5xl';
        return (
          <section className="py-6 px-6" style={{ textAlign: alignment as any }}>
            <div className={`${w} mx-auto`}>
              {url ? <img src={url} alt={alt} className={`w-full ${rounded === 'true' ? 'rounded-xl' : ''}`} /> : <div className="bg-gray-100 h-48 rounded-xl flex items-center justify-center text-gray-400">Add image URL</div>}
              {caption && <p className="text-sm text-gray-500 mt-2">{caption}</p>}
            </div>
          </section>
        );
      },
    },

    ImageTextBlock: {
      fields: {
        imageUrl: { type: 'text', label: 'Image URL' },
        imageAlt: { type: 'text', label: 'Image Alt Text' },
        heading: { type: 'text', label: 'Heading' },
        content: { type: 'textarea', label: 'Content' },
        buttonText: { type: 'text', label: 'Button Text' },
        buttonUrl: { type: 'text', label: 'Button URL' },
        imagePosition: { type: 'radio', label: 'Image Position', options: [{ label: 'Left', value: 'left' }, { label: 'Right', value: 'right' }] },
      },
      defaultProps: { imageUrl: '', imageAlt: '', heading: 'Heading', content: 'Your content goes here.', buttonText: '', buttonUrl: '', imagePosition: 'left' },
      render: ({ imageUrl, imageAlt, heading, content, buttonText, buttonUrl, imagePosition }) => (
        <section className="py-12 px-6">
          <div className={`max-w-5xl mx-auto flex flex-col ${imagePosition === 'right' ? 'md:flex-row-reverse' : 'md:flex-row'} gap-12 items-center`}>
            <div className="flex-1">
              {imageUrl ? <img src={imageUrl} alt={imageAlt} className="w-full rounded-xl" /> : <div className="bg-gray-100 h-64 rounded-xl flex items-center justify-center text-gray-400">Add image URL</div>}
            </div>
            <div className="flex-1">
              <h2 className="text-3xl font-bold mb-4">{heading}</h2>
              <p className="text-gray-600 mb-6 whitespace-pre-line">{content}</p>
              {buttonText && <a href={buttonUrl || '#'} className="inline-block bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-700 transition">{buttonText}</a>}
            </div>
          </div>
        </section>
      ),
    },

    ButtonBlock: {
      fields: {
        text: { type: 'text', label: 'Button Text' },
        url: { type: 'text', label: 'Button URL' },
        style: { type: 'select', label: 'Style', options: [{ label: 'Primary', value: 'primary' }, { label: 'Secondary', value: 'secondary' }, { label: 'Outline', value: 'outline' }, { label: 'Ghost', value: 'ghost' }] },
        size: { type: 'select', label: 'Size', options: [{ label: 'Small', value: 'sm' }, { label: 'Medium', value: 'md' }, { label: 'Large', value: 'lg' }] },
        alignment: { type: 'radio', label: 'Alignment', options: [{ label: 'Left', value: 'left' }, { label: 'Center', value: 'center' }, { label: 'Right', value: 'right' }] },
        openInNewTab: { type: 'radio', label: 'Open in New Tab', options: [{ label: 'Yes', value: 'true' }, { label: 'No', value: 'false' }] },
      },
      defaultProps: { text: 'Click Here', url: '#', style: 'primary', size: 'md', alignment: 'center', openInNewTab: 'false' },
      render: ({ text, url, style, size, alignment, openInNewTab }) => {
        const styleClass = { primary: 'bg-primary-600 text-white hover:bg-primary-700', secondary: 'bg-gray-600 text-white hover:bg-gray-700', outline: 'border-2 border-primary-600 text-primary-600 hover:bg-primary-50', ghost: 'text-primary-600 hover:bg-primary-50' }[style] || 'bg-primary-600 text-white';
        const sizeClass = { sm: 'px-4 py-2 text-sm', md: 'px-6 py-3', lg: 'px-8 py-4 text-lg' }[size] || 'px-6 py-3';
        return (
          <section className="py-4 px-6" style={{ textAlign: alignment as any }}>
            <a href={url || '#'} target={openInNewTab === 'true' ? '_blank' : undefined} className={`inline-block ${sizeClass} rounded-lg font-semibold transition ${styleClass}`}>{text}</a>
          </section>
        );
      },
    },

    SpacerBlock: {
      fields: {
        height: { type: 'select', label: 'Height', options: [{ label: 'Small (24px)', value: '24' }, { label: 'Medium (48px)', value: '48' }, { label: 'Large (80px)', value: '80' }, { label: 'Extra Large (120px)', value: '120' }] },
      },
      defaultProps: { height: '48' },
      render: ({ height }) => <div style={{ height: `${height}px` }} />,
    },

    DividerBlock: {
      fields: {
        style: { type: 'select', label: 'Style', options: [{ label: 'Solid', value: 'solid' }, { label: 'Dashed', value: 'dashed' }, { label: 'Dotted', value: 'dotted' }] },
        color: { type: 'text', label: 'Color (tailwind or hex)' },
        width: { type: 'select', label: 'Width', options: [{ label: 'Full', value: 'full' }, { label: 'Large', value: 'large' }, { label: 'Medium', value: 'medium' }] },
        spacing: { type: 'select', label: 'Spacing', options: [{ label: 'Small', value: 'small' }, { label: 'Medium', value: 'medium' }, { label: 'Large', value: 'large' }] },
      },
      defaultProps: { style: 'solid', color: 'gray-200', width: 'full', spacing: 'medium' },
      render: ({ style, color, width, spacing }) => {
        const w = { full: 'max-w-5xl', large: 'max-w-4xl', medium: 'max-w-2xl' }[width] || 'max-w-5xl';
        const s = { small: 'py-4', medium: 'py-8', large: 'py-12' }[spacing] || 'py-8';
        return (
          <div className={`${s} px-6 flex justify-center`}>
            <hr className={`${w} border-${color}`} style={{ borderStyle: style }} />
          </div>
        );
      },
    },

    ColumnsBlock: {
      fields: {
        columns: { type: 'select', label: 'Number of Columns', options: [{ label: '2', value: '2' }, { label: '3', value: '3' }, { label: '4', value: '4' }] },
        gap: { type: 'select', label: 'Gap', options: [{ label: 'Small', value: '4' }, { label: 'Medium', value: '8' }, { label: 'Large', value: '12' }] },
        items: {
          type: 'array',
          label: 'Columns',
          defaultItemProps: { heading: '', content: '', imageUrl: '' },
          arrayFields: {
            heading: { type: 'text', label: 'Heading' },
            content: { type: 'textarea', label: 'Content' },
            imageUrl: { type: 'text', label: 'Image URL' },
          },
        },
      },
      defaultProps: { columns: '3', gap: '8', items: [{ heading: 'Column 1', content: 'Content for column 1', imageUrl: '' }, { heading: 'Column 2', content: 'Content for column 2', imageUrl: '' }, { heading: 'Column 3', content: 'Content for column 3', imageUrl: '' }] },
      render: ({ columns, gap, items }) => (
        <section className="py-12 px-6">
          <div className={`grid grid-cols-1 md:grid-cols-${columns} gap-${gap} max-w-5xl mx-auto`}>
            {(items || []).map((item, i) => (
              <div key={i} className="text-center p-4">
                {item.imageUrl && <img src={item.imageUrl} alt={item.heading} className="w-full h-40 object-cover rounded-lg mb-4" />}
                {item.heading && <h3 className="text-lg font-semibold mb-2">{item.heading}</h3>}
                {item.content && <p className="text-gray-600 text-sm whitespace-pre-line">{item.content}</p>}
              </div>
            ))}
          </div>
        </section>
      ),
    },

    AlertBlock: {
      fields: {
        type: { type: 'select', label: 'Alert Type', options: [{ label: 'Info', value: 'info' }, { label: 'Success', value: 'success' }, { label: 'Warning', value: 'warning' }, { label: 'Error', value: 'error' }] },
        heading: { type: 'text', label: 'Heading' },
        content: { type: 'textarea', label: 'Content' },
        dismissible: { type: 'radio', label: 'Dismissible', options: [{ label: 'Yes', value: 'true' }, { label: 'No', value: 'false' }] },
      },
      defaultProps: { type: 'info', heading: 'Note', content: 'This is an informational alert.', dismissible: 'false' },
      render: ({ type: heading, content, dismissible }) => {
        const styles = {
          info: 'bg-blue-50 border-blue-200 text-blue-800',
          success: 'bg-green-50 border-green-200 text-green-800',
          warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
          error: 'bg-red-50 border-red-200 text-red-800',
        }[heading as string] || 'bg-blue-50 border-blue-200 text-blue-800';
        const icons = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌' };
        return (
          <section className="py-4 px-6">
            <div className={`max-w-4xl mx-auto ${styles} border rounded-lg p-4 flex items-start gap-3`}>
              <span className="text-lg">{(icons as any)[heading as string] || 'ℹ️'}</span>
              <div className="flex-1">
                {heading && <h3 className="font-semibold mb-1">{heading}</h3>}
                <p className="text-sm">{content}</p>
              </div>
              {dismissible === 'true' && <button className="text-current opacity-50 hover:opacity-100">&times;</button>}
            </div>
          </section>
        );
      },
    },

    NewsletterSignupBlock: {
      fields: {
        heading: { type: 'text', label: 'Heading' },
        subheading: { type: 'text', label: 'Subheading' },
        buttonText: { type: 'text', label: 'Button Text' },
        placeholder: { type: 'text', label: 'Input Placeholder' },
        backgroundColor: { type: 'select', label: 'Background', options: [{ label: 'White', value: 'white' }, { label: 'Gray', value: 'gray' }, { label: 'Primary', value: 'primary' }, { label: 'Dark', value: 'dark' }] },
      },
      defaultProps: { heading: 'Stay Updated', subheading: 'Get the latest news and tips for your pets.', buttonText: 'Subscribe', placeholder: 'Enter your email', backgroundColor: 'primary' },
      render: ({ heading, subheading, buttonText, placeholder, backgroundColor }) => {
        const bg = { white: 'bg-white', gray: 'bg-gray-50', primary: 'bg-primary-50', dark: 'bg-gray-900 text-white' }[backgroundColor] || 'bg-primary-50';
        const textColor = backgroundColor === 'dark' ? 'text-white' : 'text-gray-900';
        return (
          <section className={`py-16 px-6 ${bg}`}>
            <div className="max-w-xl mx-auto text-center">
              <h2 className={`text-2xl font-bold mb-2 ${textColor}`}>{heading}</h2>
              <p className="text-gray-500 mb-6">{subheading}</p>
              <form className="flex gap-2" onSubmit={(e) => e.preventDefault()}>
                <input type="email" placeholder={placeholder} className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-sm" />
                <button type="submit" className="bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-700 transition">{buttonText}</button>
              </form>
            </div>
          </section>
        );
      },
    },

    TeamBlock: {
      fields: {
        heading: { type: 'text', label: 'Heading' },
        members: {
          type: 'array',
          label: 'Team Members',
          defaultItemProps: { name: '', role: '', bio: '', avatar: '', linkedin: '' },
          arrayFields: {
            name: { type: 'text', label: 'Name' },
            role: { type: 'text', label: 'Role' },
            bio: { type: 'textarea', label: 'Bio' },
            avatar: { type: 'text', label: 'Avatar URL' },
            linkedin: { type: 'text', label: 'LinkedIn URL' },
          },
        },
      },
      defaultProps: { heading: 'Our Team', members: [] },
      render: ({ heading, members }) => (
        <section className="py-16 px-6">
          <h2 className="text-3xl font-bold text-center mb-12">{heading || 'Our Team'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {(members || []).map((m, i) => (
              <div key={i} className="text-center">
                {m.avatar && <img src={m.avatar} alt={m.name} className="w-24 h-24 rounded-full mx-auto mb-4 object-cover" />}
                <h3 className="font-semibold">{m.name}</h3>
                <p className="text-sm text-primary-600 mb-2">{m.role}</p>
                <p className="text-sm text-gray-600">{m.bio}</p>
                {m.linkedin && <a href={m.linkedin} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-600 hover:underline mt-2 inline-block">LinkedIn</a>}
              </div>
            ))}
          </div>
        </section>
      ),
    },

    AccordionBlock: {
      fields: {
        heading: { type: 'text', label: 'Heading' },
        items: {
          type: 'array',
          label: 'Accordion Items',
          defaultItemProps: { title: '', content: '', defaultOpen: 'false' },
          arrayFields: {
            title: { type: 'text', label: 'Title' },
            content: { type: 'textarea', label: 'Content' },
            defaultOpen: { type: 'radio', label: 'Default Open', options: [{ label: 'Yes', value: 'true' }, { label: 'No', value: 'false' }] },
          },
        },
      },
      defaultProps: { heading: '', items: [] },
      render: ({ heading, items }) => (
        <section className="py-12 px-6 max-w-3xl mx-auto">
          {heading && <h2 className="text-3xl font-bold text-center mb-8">{heading}</h2>}
          <div className="space-y-3">
            {(items || []).map((item, i) => (
              <details key={i} className="border border-gray-200 rounded-lg" open={item.defaultOpen === 'true'}>
                <summary className="px-6 py-4 font-medium cursor-pointer hover:bg-gray-50 flex items-center justify-between">
                  {item.title}
                  <span className="text-gray-400">▼</span>
                </summary>
                <div className="px-6 pb-4 text-gray-600 text-sm whitespace-pre-line">{item.content}</div>
              </details>
            ))}
          </div>
        </section>
      ),
    },

    TabsBlock: {
      fields: {
        items: {
          type: 'array',
          label: 'Tabs',
          defaultItemProps: { label: 'Tab', content: '' },
          arrayFields: {
            label: { type: 'text', label: 'Tab Label' },
            content: { type: 'textarea', label: 'Tab Content' },
          },
        },
      },
      defaultProps: { items: [{ label: 'Tab 1', content: 'Content for tab 1' }, { label: 'Tab 2', content: 'Content for tab 2' }] },
      render: ({ items }) => {
        const [active, setActive] = useState(0);
        return (
          <section className="py-12 px-6 max-w-4xl mx-auto">
            <div className="flex border-b border-gray-200 mb-6">
              {(items || []).map((item, i) => (
                <button key={i} onClick={() => setActive(i)} className={`px-6 py-3 text-sm font-medium border-b-2 transition ${i === active ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{item.label}</button>
              ))}
            </div>
            <div className="text-gray-700 whitespace-pre-line">{items?.[active]?.content}</div>
          </section>
        );
      },
    },

    IconListBlock: {
      fields: {
        heading: { type: 'text', label: 'Heading' },
        items: {
          type: 'array',
          label: 'Items',
          defaultItemProps: { icon: '', text: '' },
          arrayFields: {
            icon: { type: 'text', label: 'Icon (emoji)' },
            text: { type: 'text', label: 'Text' },
          },
        },
        columns: { type: 'select', label: 'Columns', options: [{ label: '1', value: '1' }, { label: '2', value: '2' }, { label: '3', value: '3' }] },
      },
      defaultProps: { heading: '', items: [], columns: '1' },
      render: ({ heading, items, columns }) => (
        <section className="py-12 px-6">
          {heading && <h2 className="text-3xl font-bold text-center mb-8">{heading}</h2>}
          <div className={`grid grid-cols-1 md:grid-cols-${columns} gap-4 max-w-4xl mx-auto`}>
            {(items || []).map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <span className="text-2xl">{item.icon}</span>
                <span className="text-gray-700">{item.text}</span>
              </div>
            ))}
          </div>
        </section>
      ),
    },

    BadgeBlock: {
      fields: {
        heading: { type: 'text', label: 'Heading' },
        badges: {
          type: 'array',
          label: 'Badges',
          defaultItemProps: { icon: '', label: '', description: '' },
          arrayFields: {
            icon: { type: 'text', label: 'Icon (emoji)' },
            label: { type: 'text', label: 'Label' },
            description: { type: 'text', label: 'Description' },
          },
        },
      },
      defaultProps: { heading: 'Why Choose Us', badges: [] },
      render: ({ heading, badges }) => (
        <section className="py-12 px-6">
          <h2 className="text-3xl font-bold text-center mb-8">{heading || 'Why Choose Us'}</h2>
          <div className="flex flex-wrap justify-center gap-6 max-w-4xl mx-auto">
            {(badges || []).map((b, i) => (
              <div key={i} className="flex items-center gap-3 bg-white border border-gray-200 rounded-full px-6 py-3 shadow-sm">
                <span className="text-2xl">{b.icon}</span>
                <div>
                  <div className="font-semibold text-sm">{b.label}</div>
                  {b.description && <div className="text-xs text-gray-500">{b.description}</div>}
                </div>
              </div>
            ))}
          </div>
        </section>
      ),
    },

    EmbedBlock: {
      fields: {
        url: { type: 'text', label: 'Embed URL' },
        caption: { type: 'text', label: 'Caption' },
        height: { type: 'text', label: 'Height (e.g. 400px)' },
      },
      defaultProps: { url: '', caption: '', height: '400px' },
      render: ({ url, caption, height }) => (
        <section className="py-8 px-6 max-w-4xl mx-auto">
          {url ? (
            <div className="rounded-xl overflow-hidden shadow-lg">
              <iframe src={url} className="w-full" style={{ height }} allowFullScreen title={caption || 'Embedded content'} />
            </div>
          ) : (
            <div className="bg-gray-100 rounded-xl h-48 flex items-center justify-center text-gray-400">Add embed URL</div>
          )}
          {caption && <p className="text-center text-sm text-gray-500 mt-3">{caption}</p>}
        </section>
      ),
    },

    BackToTopBlock: {
      fields: {
        text: { type: 'text', label: 'Button Text' },
        style: { type: 'select', label: 'Style', options: [{ label: 'Icon Only', value: 'icon' }, { label: 'Text + Icon', value: 'text' }] },
      },
      defaultProps: { text: 'Back to Top', style: 'icon' },
      render: ({ text, style }) => (
        <section className="py-8 px-6 text-center">
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="inline-flex items-center gap-2 text-gray-500 hover:text-primary-600 transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
            {style === 'text' && <span className="text-sm">{text}</span>}
          </button>
        </section>
      ),
    },

    MarqueeBlock: {
      fields: {
        items: {
          type: 'array',
          label: 'Items',
          defaultItemProps: { text: '' },
          arrayFields: {
            text: { type: 'text', label: 'Text' },
          },
        },
        speed: { type: 'select', label: 'Speed', options: [{ label: 'Slow', value: '30' }, { label: 'Normal', value: '20' }, { label: 'Fast', value: '10' }] },
        backgroundColor: { type: 'text', label: 'Background Color' },
      },
      defaultProps: { items: [{ text: 'PawTag' }, { text: 'Never Lose Your Pet' }, { text: 'Smart QR Recovery' }], speed: '20', backgroundColor: '#f9fafb' },
      render: ({ items, speed, backgroundColor }) => (
        <div className="overflow-hidden py-4" style={{ backgroundColor }}>
          <div className="flex whitespace-nowrap" style={{ animation: `marquee ${speed}s linear infinite` }}>
            {[...(items || []), ...(items || [])].map((item, i) => (
              <span key={i} className="mx-8 text-lg font-semibold text-gray-700">{item.text}</span>
            ))}
          </div>
        </div>
      ),
    },

    SocialLinksBlock: {
      fields: {
        facebook: { type: 'text', label: 'Facebook URL' },
        twitter: { type: 'text', label: 'Twitter/X URL' },
        instagram: { type: 'text', label: 'Instagram URL' },
        linkedin: { type: 'text', label: 'LinkedIn URL' },
        youtube: { type: 'text', label: 'YouTube URL' },
        tiktok: { type: 'text', label: 'TikTok URL' },
        alignment: { type: 'radio', label: 'Alignment', options: [{ label: 'Left', value: 'left' }, { label: 'Center', value: 'center' }, { label: 'Right', value: 'right' }] },
      },
      defaultProps: { facebook: '', twitter: '', instagram: '', linkedin: '', youtube: '', tiktok: '', alignment: 'center' },
      render: ({ facebook, twitter, instagram, linkedin, youtube, tiktok, alignment }) => {
        const links = [
          { url: facebook, label: 'Facebook', icon: 'M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z' },
          { url: twitter, label: 'Twitter', icon: 'M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z' },
          { url: instagram, label: 'Instagram', icon: 'M16 4H8a4 4 0 0 0-4 4v8a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4V8a4 4 0 0 0-4-4zm-4 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm4.5-7.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z' },
          { url: linkedin, label: 'LinkedIn', icon: 'M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2zM4 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4z' },
          { url: youtube, label: 'YouTube', icon: 'M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19.1c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33zM9.75 15.02V8.48l5.75 3.27-5.75 3.27z' },
          { url: tiktok, label: 'TikTok', icon: 'M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15.2a6.34 6.34 0 0 0 10.86 4.48v-7.2a8.16 8.16 0 0 0 5.58 2.18v-3.45a4.85 4.85 0 0 1-5.58-2.18' },
        ].filter(l => l.url);
        return (
          <section className="py-6 px-6" style={{ textAlign: alignment as any }}>
            <div className="flex items-center justify-center gap-4">
              {links.map((l, i) => (
                <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-primary-50 hover:text-primary-600 transition" title={l.label}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d={l.icon} /></svg>
                </a>
              ))}
            </div>
          </section>
        );
      },
    },

    AnnouncementBarBlock: {
      fields: {
        text: { type: 'text', label: 'Announcement Text' },
        linkText: { type: 'text', label: 'Link Text' },
        linkUrl: { type: 'text', label: 'Link URL' },
        backgroundColor: { type: 'text', label: 'Background Color' },
        textColor: { type: 'text', label: 'Text Color' },
        closable: { type: 'radio', label: 'Closable', options: [{ label: 'Yes', value: 'true' }, { label: 'No', value: 'false' }] },
      },
      defaultProps: { text: 'Free shipping on all orders!', linkText: 'Shop Now', linkUrl: '/shop', backgroundColor: '#16a34a', textColor: '#ffffff', closable: 'true' },
      render: ({ text, linkText, linkUrl, backgroundColor, textColor, closable }) => (
        <div className="flex items-center justify-center gap-2 py-2 px-4 text-sm" style={{ backgroundColor, color: textColor }}>
          <span>{text}</span>
          {linkText && <a href={linkUrl || '#'} className="underline font-semibold hover:opacity-80">{linkText}</a>}
          {closable === 'true' && <button className="ml-2 opacity-70 hover:opacity-100">&times;</button>}
        </div>
      ),
    },

    CountdownBlock: {
      fields: {
        targetDate: { type: 'text', label: 'Target Date (YYYY-MM-DD)' },
        targetTime: { type: 'text', label: 'Target Time (HH:MM)' },
        heading: { type: 'text', label: 'Heading' },
        expiredText: { type: 'text', label: 'Expired Message' },
      },
      defaultProps: { targetDate: '2026-12-31', targetTime: '23:59', heading: 'Coming Soon', expiredText: 'Event has started!' },
      render: ({ targetDate, targetTime, heading, expiredText }) => {
        const target = new Date(`${targetDate}T${targetTime || '23:59'}`).getTime();
        const now = Date.now();
        const diff = Math.max(0, target - now);
        const days = Math.floor(diff / 86400000);
        const hours = Math.floor((diff % 86400000) / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        const units = [{ label: 'Days', value: days }, { label: 'Hours', value: hours }, { label: 'Minutes', value: mins }, { label: 'Seconds', value: secs }];
        return (
          <section className="py-16 px-6 text-center">
            {heading && <h2 className="text-3xl font-bold mb-8">{heading}</h2>}
            {diff > 0 ? (
              <div className="flex justify-center gap-6">
                {units.map((u, i) => (
                  <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 min-w-[80px] shadow-sm">
                    <div className="text-3xl font-bold text-primary-600">{String(u.value).padStart(2, '0')}</div>
                    <div className="text-xs text-gray-500 mt-1">{u.label}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xl text-gray-600">{expiredText}</p>
            )}
          </section>
        );
      },
    },
  },
};
