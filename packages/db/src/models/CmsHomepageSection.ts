import mongoose, { Schema, Document } from 'mongoose';

export interface ICmsHomepageSectionDocument extends Document {
  sectionType: 'hero_slide' | 'how_it_works' | 'trust' | 'testimonial' | 'responsibility_score' | 'banner' | 'faq';
  title: string;
  subtitle?: string;
  content: Record<string, unknown>;
  order: number;
  isActive: boolean;
  status?: 'draft' | 'published';
  duration?: number;
  transition?: string;
  thumbnail?: string;
  deletedAt?: Date;
}

const CmsHomepageSectionSchema = new Schema<ICmsHomepageSectionDocument>(
  {
    sectionType: {
      type: String,
      required: true,
      enum: ['hero_slide', 'how_it_works', 'trust', 'testimonial', 'responsibility_score', 'banner', 'faq'],
    },
    title: { type: String, required: true },
    subtitle: { type: String },
    content: { type: Schema.Types.Mixed, required: true, default: {} },
    order: { type: Number, required: true, default: 0 },
    isActive: { type: Boolean, required: true, default: true },
    status: { type: String, enum: ['draft', 'published'], default: 'published' },
    duration: { type: Number }, // Per-slide autoplay duration in ms
    transition: { type: String }, // Per-slide transition override
    thumbnail: { type: String }, // Auto-generated preview thumbnail URL
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

CmsHomepageSectionSchema.index({ sectionType: 1, order: 1 });
CmsHomepageSectionSchema.index({ isActive: 1 });
CmsHomepageSectionSchema.index({ status: 1 });

const CmsHomepageSection = mongoose.models.CmsHomepageSection || mongoose.model<ICmsHomepageSectionDocument>(
  'CmsHomepageSection',
  CmsHomepageSectionSchema
);

export default CmsHomepageSection;